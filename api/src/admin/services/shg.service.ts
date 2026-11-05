import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  cycles,
  deposits,
  groups,
  loanShapes,
  loans,
  locations,
  members,
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
    db.select().from(loanShapes).where(eq(loanShapes.groupId, groupId)).orderBy(loanShapes.sortOrder),
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

/**
 * Updates an SHG profile, location, or validation settings.
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
  }>,
) {
  const [updated] = await tx.update(groups).set(patch).where(eq(groups.id, groupId)).returning();
  if (!updated) throw notFound('Group');
  return updated;
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
