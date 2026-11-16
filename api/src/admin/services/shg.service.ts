import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  cycles,
  deposits,
  groups,
  ledgerEntries,
  loanShapes,
  loans,
  locations,
  members,
  repayments,
  users,
} from '../../db/schema';
import { notFound, unprocessable } from '../../lib/errors';
import { hashPassword } from '../../lib/password';
import { DEFAULT_SHAPES } from '../../db/seed';

export type ShgFilters = {
  state?: string;
  district?: string;
  block?: string;
  panchayat?: string;
  search?: string;
  isActive?: boolean;
  accessibleGroupIds?: string[];
};

export type CreateShgInput = {
  name: string;
  hindiName?: string;
  address?: string;
  state: string;
  district: string;
  block: string;
  panchayat: string;
  village?: string;
  stampValue?: number;
  maxStampsPerMember?: number;
  monthlyInterestRate?: string;
  repaymentStampRate?: string;
  maxLoanAmount?: number;
  approvalRequired?: boolean;
  meetingDay?: string;
  cycleNo?: number;
  durationWeeks?: number;
  // Operator credentials (optional)
  operatorUsername?: string;
  operatorPassword?: string;
  operatorFullName?: string;
};

export type CreateMemberInput = {
  hhNo: string;
  name: string;
  husbandName?: string;
  idNo?: string;
  age?: number;
  caste?: string;
  mobileNo?: string;
  education?: string;
  agriLandAcres?: string;
  irrigatedLandAcres?: string;
  goatCount?: number;
  animalCount?: number;
  familySize?: number;
  incomeSource?: string;
  joinedOn?: string;
};

/**
 * Returns distinct location options for cascading filters:
 * State -> District -> Block -> Panchayat -> Village
 * Combines entries from master `locations` table and registered `groups`.
 */
export async function listLocations(db: Db) {
  const [groupRows, masterRows] = await Promise.all([
    db
      .select({
        state: groups.state,
        district: groups.district,
        block: groups.block,
        panchayat: groups.panchayat,
        village: groups.village,
      })
      .from(groups)
      .where(eq(groups.isActive, true)),
    db
      .select({
        state: locations.state,
        district: locations.district,
        block: locations.block,
        panchayat: locations.panchayat,
        village: locations.village,
      })
      .from(locations)
      .where(eq(locations.isActive, true)),
  ]);

  const allRows = [...groupRows, ...masterRows];

  const states = [...new Set(allRows.map((r) => r.state).filter(Boolean))].sort();
  const districts = [...new Set(allRows.map((r) => r.district).filter(Boolean))].sort();
  const blocks = [...new Set(allRows.map((r) => r.block).filter(Boolean))].sort();
  const panchayats = [...new Set(allRows.map((r) => r.panchayat).filter(Boolean))].sort();
  const villages = [...new Set(allRows.map((r) => r.village).filter(Boolean))].sort() as string[];

  // Build cascading tree: { [state]: { [district]: { [block]: string[] (panchayats) } } }
  const hierarchy: Record<string, Record<string, Record<string, string[]>>> = {};
  const villageMap: Record<string, string[]> = {};

  for (const r of allRows) {
    if (!r.state || !r.district || !r.block || !r.panchayat) continue;
    if (!hierarchy[r.state]) hierarchy[r.state] = {};
    if (!hierarchy[r.state][r.district]) hierarchy[r.state][r.district] = {};
    if (!hierarchy[r.state][r.district][r.block]) hierarchy[r.state][r.district][r.block] = [];
    if (!hierarchy[r.state][r.district][r.block].includes(r.panchayat)) {
      hierarchy[r.state][r.district][r.block].push(r.panchayat);
    }

    if (r.village) {
      if (!villageMap[r.panchayat]) villageMap[r.panchayat] = [];
      if (!villageMap[r.panchayat].includes(r.village)) {
        villageMap[r.panchayat].push(r.village);
      }
    }
  }

  return { states, districts, blocks, panchayats, villages, hierarchy, villageMap };
}

/**
 * Lists SHGs with administrative location filters and live metrics.
 */
export async function listAdminGroups(db: Db, filters: ShgFilters = {}) {
  const conds: (SQL | undefined)[] = [];

  if (filters.state) conds.push(eq(groups.state, filters.state));
  if (filters.district) conds.push(eq(groups.district, filters.district));
  if (filters.block) conds.push(eq(groups.block, filters.block));
  if (filters.panchayat) conds.push(eq(groups.panchayat, filters.panchayat));
  if (filters.isActive !== undefined) conds.push(eq(groups.isActive, filters.isActive));
  if (filters.accessibleGroupIds) {
    if (filters.accessibleGroupIds.length === 0) return [];
    conds.push(inArray(groups.id, filters.accessibleGroupIds));
  }
  if (filters.search) {
    const q = `%${filters.search.trim()}%`;
    conds.push(
      or(
        ilike(groups.name, q),
        ilike(groups.hindiName, q),
        ilike(groups.village, q),
        ilike(groups.address, q),
      ),
    );
  }

  const whereClause = conds.length > 0 ? and(...conds) : undefined;
  const groupRows = await db
    .select()
    .from(groups)
    .where(whereClause)
    .orderBy(desc(groups.createdAt));

  if (groupRows.length === 0) return [];

  const groupIds = groupRows.map((g) => g.id);

  // Aggregate metrics: member count
  const memberCounts = await db
    .select({ groupId: members.groupId, total: count() })
    .from(members)
    .where(and(inArray(members.groupId, groupIds), eq(members.isActive, true)))
    .groupBy(members.groupId);
  const memberCountMap = new Map(memberCounts.map((m) => [m.groupId, m.total]));

  // Aggregate total savings deposited
  const depositSums = await db
    .select({
      groupId: deposits.groupId,
      totalAmount: sql<number>`coalesce(sum(${deposits.totalAmount}), 0)::int`,
    })
    .from(deposits)
    .where(and(inArray(deposits.groupId, groupIds), eq(deposits.approvalStatus, 'approved')))
    .groupBy(deposits.groupId);
  const depositMap = new Map(depositSums.map((d) => [d.groupId, d.totalAmount]));

  // Aggregate active loans
  const loanSums = await db
    .select({
      groupId: loans.groupId,
      activeAmount: sql<number>`coalesce(sum(${loans.principalAmount}), 0)::int`,
      activeCount: count(),
    })
    .from(loans)
    .where(and(inArray(loans.groupId, groupIds), eq(loans.status, 'active'), eq(loans.approvalStatus, 'approved')))
    .groupBy(loans.groupId);
  const loanMap = new Map(loanSums.map((l) => [l.groupId, l]));

  // Get current cycle per group
  const cycleRows = await db
    .select()
    .from(cycles)
    .where(and(inArray(cycles.groupId, groupIds), eq(cycles.isCurrent, true)));
  const cycleMap = new Map(cycleRows.map((c) => [c.groupId, c]));

  return groupRows.map((g) => ({
    ...g,
    memberCount: memberCountMap.get(g.id) ?? 0,
    totalDeposits: depositMap.get(g.id) ?? 0,
    activeLoanAmount: loanMap.get(g.id)?.activeAmount ?? 0,
    activeLoanCount: loanMap.get(g.id)?.activeCount ?? 0,
    currentCycle: cycleMap.get(g.id) ?? null,
  }));
}

/**
 * Single SHG detail with full members, current cycle, shapes, and users.
 */
export async function getAdminGroupDetail(db: Db, groupId: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw notFound('Group');

  const [memberList, shapeList, cycleList, userList] = await Promise.all([
    db.select().from(members).where(eq(members.groupId, groupId)).orderBy(members.hhNo),
    db
      .select()
      .from(loanShapes)
      .where(eq(loanShapes.groupId, groupId))
      .orderBy(asc(loanShapes.sortOrder), asc(loanShapes.value)),
    db.select().from(cycles).where(eq(cycles.groupId, groupId)).orderBy(desc(cycles.cycleNo)),
    db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.groupId, groupId)),
  ]);

  return {
    ...group,
    members: memberList,
    shapes: shapeList,
    cycles: cycleList,
    currentCycle: cycleList.find((c) => c.isCurrent) ?? null,
    users: userList,
  };
}

/**
 * Creates a brand new SHG atomically:
 * 1. Inserts group row with location hierarchy & validation rules
 * 2. Creates Cycle 1 (52 weeks)
 * 3. Seeds loan shapes
 * 4. Creates operator login account with hashed password
 */
export async function createAdminGroup(tx: Db, input: CreateShgInput) {
  let operatorUser: { id: string; username: string; fullName: string } | null = null;

  if (input.operatorUsername?.trim() && input.operatorPassword) {
    const normalizedUsername = input.operatorUsername.trim().toLowerCase();
    const [existingUser] = await tx.select({ id: users.id }).from(users).where(eq(users.username, normalizedUsername)).limit(1);
    if (existingUser) {
      throw unprocessable('Username already in use', 'USERNAME_TAKEN', { username: normalizedUsername });
    }
  }

  const [group] = await tx
    .insert(groups)
    .values({
      name: input.name.trim(),
      hindiName: input.hindiName?.trim() || null,
      address: input.address?.trim() || null,
      state: input.state.trim(),
      district: input.district.trim(),
      block: input.block.trim(),
      panchayat: input.panchayat.trim(),
      village: input.village?.trim() || input.panchayat.trim(),
      stampValue: input.stampValue ?? 50,
      maxStampsPerMember: input.maxStampsPerMember ?? 5,
      maxLoanAmount: input.maxLoanAmount ?? 50000,
      approvalRequired: input.approvalRequired ?? true,
      monthlyInterestRate: input.monthlyInterestRate ?? '0.0200',
      repaymentStampRate: input.repaymentStampRate ?? '0.0200',
      meetingDay: input.meetingDay || 'Monday',
    })
    .returning();

  // Create Cycle starting today
  const durationWeeks = input.durationWeeks ?? 52;
  const cycleNo = input.cycleNo ?? 1;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + (durationWeeks * 7 - 1) * 86400 * 1000).toISOString().slice(0, 10);
  await tx.insert(cycles).values({
    groupId: group.id,
    cycleNo,
    startDate: today,
    endDate: nextYear,
    durationWeeks,
    isCurrent: true,
  });

  // Seed standard loan shapes
  await tx.insert(loanShapes).values(DEFAULT_SHAPES.map((s) => ({ ...s, groupId: group.id })));

  // Provision operator user if credentials provided
  if (input.operatorUsername?.trim() && input.operatorPassword) {
    const normalizedUsername = input.operatorUsername.trim().toLowerCase();
    const passwordHash = await hashPassword(input.operatorPassword);
    const [user] = await tx
      .insert(users)
      .values({
        groupId: group.id,
        username: normalizedUsername,
        passwordHash,
        fullName: input.operatorFullName?.trim() || `${group.name} Operator`,
        role: 'operator',
        language: 'en',
      })
      .returning();
    operatorUser = { id: user.id, username: user.username, fullName: user.fullName };
  }

  return { group, operator: operatorUser };
}

export type UpdateShgShapeInput = {
  id?: string;
  code?: string;
  name: string;
  value: number;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

/**
 * Updates an SHG profile, location, validation rules, and optional loan shapes.
 */
export async function updateAdminGroup(
  tx: Db,
  groupId: string,
  patch: Partial<{
    name: string;
    hindiName: string;
    address: string;
    state: string;
    district: string;
    block: string;
    panchayat: string;
    village: string;
    stampValue: number;
    maxStampsPerMember: number;
    maxLoanAmount: number;
    approvalRequired: boolean;
    monthlyInterestRate: string;
    repaymentStampRate: string;
    meetingDay: string;
    isActive: boolean;
    shapes: UpdateShgShapeInput[];
  }>,
) {
  const [existingGroup] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!existingGroup) throw notFound('Group');

  const now = new Date();
  const groupUpdates: Record<string, any> = { updatedAt: now };

  if (patch.name !== undefined) {
    const trimmed = String(patch.name).trim();
    if (!trimmed) throw unprocessable('SHG name cannot be empty', 'INVALID_NAME');
    groupUpdates.name = trimmed;
  }
  if (patch.hindiName !== undefined) groupUpdates.hindiName = patch.hindiName ? String(patch.hindiName).trim() : null;
  if (patch.address !== undefined) groupUpdates.address = patch.address ? String(patch.address).trim() : null;
  if (patch.state !== undefined) groupUpdates.state = String(patch.state).trim();
  if (patch.district !== undefined) groupUpdates.district = String(patch.district).trim();
  if (patch.block !== undefined) groupUpdates.block = String(patch.block).trim();
  if (patch.panchayat !== undefined) groupUpdates.panchayat = String(patch.panchayat).trim();
  if (patch.village !== undefined) groupUpdates.village = patch.village ? String(patch.village).trim() : null;

  if (patch.stampValue !== undefined) {
    const val = Math.round(Number(patch.stampValue));
    if (!Number.isFinite(val) || val <= 0) {
      throw unprocessable('Savings stamp value must be greater than 0', 'INVALID_STAMP_VALUE');
    }
    groupUpdates.stampValue = val;
  }

  if (patch.maxStampsPerMember !== undefined) {
    const val = Math.round(Number(patch.maxStampsPerMember));
    if (!Number.isFinite(val) || val <= 0) {
      throw unprocessable('Max stamps per member must be at least 1', 'INVALID_MAX_STAMPS');
    }
    groupUpdates.maxStampsPerMember = val;
  }

  if (patch.maxLoanAmount !== undefined) {
    const val = Math.round(Number(patch.maxLoanAmount));
    if (!Number.isFinite(val) || val <= 0) {
      throw unprocessable('Max loan limit must be greater than 0', 'INVALID_MAX_LOAN');
    }
    groupUpdates.maxLoanAmount = val;
  }

  if (patch.approvalRequired !== undefined) {
    groupUpdates.approvalRequired = Boolean(patch.approvalRequired);
  }

  if (patch.monthlyInterestRate !== undefined) {
    const num = Number(patch.monthlyInterestRate);
    if (!Number.isFinite(num) || num < 0) {
      throw unprocessable('Monthly interest rate must be 0 or greater', 'INVALID_INTEREST_RATE');
    }
    groupUpdates.monthlyInterestRate = num.toFixed(4);
  }

  if (patch.repaymentStampRate !== undefined) {
    const num = Number(patch.repaymentStampRate);
    if (!Number.isFinite(num) || num < 0) {
      throw unprocessable('Repayment stamp rate must be 0 or greater', 'INVALID_REPAYMENT_RATE');
    }
    groupUpdates.repaymentStampRate = num.toFixed(4);
  }

  if (patch.meetingDay !== undefined) {
    groupUpdates.meetingDay = patch.meetingDay ? String(patch.meetingDay).trim() : null;
  }

  if (patch.isActive !== undefined) {
    groupUpdates.isActive = Boolean(patch.isActive);
  }

  const [updated] = await tx.update(groups).set(groupUpdates).where(eq(groups.id, groupId)).returning();

  // Optional: update / add configured loan shapes atomically
  let updatedShapes;
  if (Array.isArray(patch.shapes)) {
    const activeCount = patch.shapes.filter((s) => s.isActive !== false).length;
    if (patch.shapes.length === 0 || activeCount === 0) {
      throw unprocessable('At least one active loan shape is required', 'INVALID_SHAPES');
    }

    const existingShapes = await tx
      .select()
      .from(loanShapes)
      .where(eq(loanShapes.groupId, groupId));

    const existingById = new Map(existingShapes.map((s) => [s.id, s]));
    const existingByCode = new Map(existingShapes.map((s) => [s.code.toLowerCase(), s]));
    const usedCodes = new Set(existingShapes.map((s) => s.code.toLowerCase()));

    for (let idx = 0; idx < patch.shapes.length; idx++) {
      const s = patch.shapes[idx];
      const name = String(s.name || '').trim();
      const value = Math.round(Number(s.value));
      if (!name) {
        throw unprocessable(`Shape #${idx + 1} name is required`, 'INVALID_SHAPE_NAME');
      }
      if (!Number.isFinite(value) || value <= 0) {
        throw unprocessable(`Shape "${name}" value must be greater than 0`, 'INVALID_SHAPE_VALUE');
      }

      const sortOrder = s.sortOrder !== undefined ? Number(s.sortOrder) : idx + 1;
      const color = s.color ? String(s.color).trim() : '#0d9488';
      const isActive = s.isActive !== false;

      const match =
        (s.id && existingById.get(s.id)) ||
        (s.code && existingByCode.get(String(s.code).trim().toLowerCase()));

      if (match) {
        await tx
          .update(loanShapes)
          .set({
            name,
            value,
            color,
            sortOrder,
            isActive,
            updatedAt: now,
          })
          .where(and(eq(loanShapes.id, match.id), eq(loanShapes.groupId, groupId)));
      } else {
        const baseSlug =
          (s.code ? String(s.code).trim().toLowerCase() : name.toLowerCase())
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || `shape-${idx + 1}`;
        let code = baseSlug;
        let suffix = 2;
        while (usedCodes.has(code)) {
          code = `${baseSlug}-${suffix++}`;
        }
        usedCodes.add(code);

        await tx.insert(loanShapes).values({
          groupId,
          code,
          name,
          value,
          color,
          sortOrder,
          isActive,
        });
      }
    }

    updatedShapes = await tx
      .select()
      .from(loanShapes)
      .where(eq(loanShapes.groupId, groupId))
      .orderBy(asc(loanShapes.sortOrder), asc(loanShapes.value));
  }

  return updatedShapes ? { ...updated, shapes: updatedShapes } : updated;
}

/**
 * Permanently deletes an SHG and all associated records (ledger, repayments,
 * loans, deposits, members, shapes, cycles, operator accounts, and DO assignments).
 */
export async function deleteAdminGroup(tx: Db, groupId: string, confirmName?: string) {
  const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw notFound('Group');

  if (confirmName !== undefined && confirmName !== group.name) {
    throw unprocessable(
      `Confirmation name does not match SHG name "${group.name}"`,
      'CONFIRMATION_MISMATCH',
    );
  }

  // Delete child records in topological order to respect `onDelete: 'restrict'` FKs
  await tx.delete(ledgerEntries).where(eq(ledgerEntries.groupId, groupId));
  await tx.delete(repayments).where(eq(repayments.groupId, groupId));
  await tx.delete(loans).where(eq(loans.groupId, groupId));
  await tx.delete(deposits).where(eq(deposits.groupId, groupId));
  await tx.delete(members).where(eq(members.groupId, groupId));
  await tx.delete(loanShapes).where(eq(loanShapes.groupId, groupId));
  await tx.delete(cycles).where(eq(cycles.groupId, groupId));
  await tx.delete(users).where(eq(users.groupId, groupId));

  // Scrub deleted groupId from any DO users' assignedGroupIds
  const doUsers = await tx
    .select({ id: users.id, assignedGroupIds: users.assignedGroupIds })
    .from(users)
    .where(sql`${groupId} = ANY(${users.assignedGroupIds})`);
  for (const u of doUsers) {
    const nextIds = (u.assignedGroupIds || []).filter((id) => id !== groupId);
    await tx.update(users).set({ assignedGroupIds: nextIds }).where(eq(users.id, u.id));
  }

  await tx.delete(groups).where(eq(groups.id, groupId));

  return { deleted: true, id: groupId, name: group.name };
}

/**
 * Adds a new member to an SHG with household number uniqueness check.
 */
export async function addMemberToGroup(tx: Db, groupId: string, input: CreateMemberInput) {
  const [existingHh] = await tx
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.hhNo, input.hhNo.trim())))
    .limit(1);
  if (existingHh) {
    throw unprocessable(`Member with Household No ${input.hhNo} already exists in this SHG`, 'DUPLICATE_HH_NO', {
      hhNo: input.hhNo,
    });
  }

  const [member] = await tx
    .insert(members)
    .values({
      groupId,
      hhNo: input.hhNo.trim(),
      name: input.name.trim(),
      husbandName: input.husbandName?.trim() || null,
      idNo: input.idNo?.trim() || null,
      age: input.age ?? null,
      caste: input.caste?.trim() || null,
      mobileNo: input.mobileNo?.trim() || null,
      education: input.education?.trim() || null,
      agriLandAcres: input.agriLandAcres ?? null,
      irrigatedLandAcres: input.irrigatedLandAcres ?? null,
      goatCount: input.goatCount ?? 0,
      animalCount: input.animalCount ?? 0,
      familySize: input.familySize ?? null,
      incomeSource: input.incomeSource?.trim() || null,
      joinedOn: input.joinedOn || new Date().toISOString().slice(0, 10),
    })
    .returning();

  return member;
}

/**
 * Bulk imports members from structured JSON or parsed Excel array.
 */
export async function bulkImportMembers(tx: Db, groupId: string, rows: Record<string, any>[]) {
  const results = {
    total: rows.length,
    imported: 0,
    errors: [] as { row: number; error: string; data?: any }[],
  };

  const [group] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw notFound('Group');

  const existingHh = new Set(
    (await tx.select({ hhNo: members.hhNo }).from(members).where(eq(members.groupId, groupId))).map((m) => m.hhNo),
  );

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const hhNo = String(r.hhNo || r['Household No'] || r['HH No'] || `HH-${100 + i + 1}`).trim();
    const name = String(r.name || r['Member Name'] || r['Name'] || '').trim();

    if (!name) {
      results.errors.push({ row: i + 1, error: 'Member name is required', data: r });
      continue;
    }

    if (existingHh.has(hhNo)) {
      results.errors.push({ row: i + 1, error: `Household No ${hhNo} already exists in this SHG`, data: r });
      continue;
    }

    try {
      await tx.insert(members).values({
        groupId,
        hhNo,
        name,
        husbandName: String(r.husbandName || r['Husband Name'] || r['Spouse'] || '').trim() || null,
        idNo: String(r.idNo || r['Aadhaar'] || r['ID No'] || '').trim() || null,
        mobileNo: String(r.mobileNo || r['Mobile'] || r['Phone'] || '').trim() || null,
        age: Number(r.age || r['Age']) || null,
        caste: String(r.caste || r['Caste'] || '').trim() || null,
        education: String(r.education || r['Education'] || '').trim() || null,
        incomeSource: String(r.incomeSource || r['Occupation'] || r['Income Source'] || '').trim() || null,
        joinedOn: String(r.joinedOn || r['Join Date'] || new Date().toISOString().slice(0, 10)),
      });
      existingHh.add(hhNo);
      results.imported++;
    } catch (err: any) {
      results.errors.push({ row: i + 1, error: err.message || 'Insert error', data: r });
    }
  }

  return results;
}
