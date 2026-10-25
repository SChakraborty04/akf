/**
 * Seed helpers. Used by the test-suite and by `scripts/seed.ts` (dev data that
 * mirrors pwa/src/constants/seedData.js).
 */
import { and, eq } from 'drizzle-orm';
import type { Db } from './client';
import { cycles, groups, loanShapes, locations, members, systemSettings, users } from './schema';
import { hashPassword } from '../lib/password';
import { createDeposit, type WriteCtx } from '../services/deposits.service';
import { createLoan } from '../services/loans.service';
import { createRepayment } from '../services/repayments.service';

export const DEFAULT_SHAPES = [
  { code: 'pentagon', name: 'Pentagon', value: 500, color: '#0d9488', sortOrder: 1 },
  { code: 'circle', name: 'Circle', value: 1000, color: '#2563eb', sortOrder: 2 },
  { code: 'triangle', name: 'Triangle', value: 3000, color: '#d97706', sortOrder: 3 },
  { code: 'star', name: 'Star', value: 5000, color: '#7c3aed', sortOrder: 4 },
  { code: 'sun', name: 'Sun', value: 10000, color: '#ea580c', sortOrder: 5 },
];

// hhNo, name, husband, idNo, age, caste, mobile, education, agri acres, irrigated acres, goats, animals, family, income
type M = [string, string, string, string, number, string, string, string, number, number, number, number, number, string];
export const PWA_MEMBERS: M[] = [
  ['HH-101', 'Sunita Devi', 'Ramesh Kumar', 'AADH-8821-4091', 34, 'OBC', '9876543210', '8th Pass', 1.5, 1.0, 3, 2, 5, 'Agriculture & Livestock'],
  ['HH-102', 'Meena Devi', 'Shambhu Nath', 'AADH-7712-3082', 38, 'EBC', '9876543211', '5th Pass', 0.8, 0.5, 5, 1, 6, 'Goat Rearing & Daily Wage'],
  ['HH-103', 'Anita Sharma', 'Rajesh Sharma', 'AADH-6634-1193', 29, 'General', '9876543212', '10th Pass', 2.0, 1.5, 0, 3, 4, 'Dairy Farming & Shop'],
  ['HH-104', 'Rekha Kumari', 'Santosh Kumar', 'AADH-5545-2284', 41, 'SC', '9876543213', 'Illiterate', 0.5, 0.0, 4, 1, 7, 'Labor & Agricultural Work'],
  ['HH-105', 'Geeta Devi', 'Manoj Prasad', 'AADH-4456-3375', 36, 'OBC', '9876543214', '7th Pass', 1.2, 0.8, 2, 2, 5, 'Farming & Poultry'],
  ['HH-106', 'Savitri Devi', 'Dharmendra Singh', 'AADH-3367-4466', 45, 'OBC', '9876543215', 'Primary', 2.5, 2.0, 1, 4, 6, 'Agriculture & Milk Sale'],
  ['HH-107', 'Manju Devi', 'Anil Kumar', 'AADH-2278-5557', 32, 'EBC', '9876543216', '8th Pass', 1.0, 0.5, 6, 1, 4, 'Animal Husbandry'],
  ['HH-108', 'Pushpa Devi', 'Vinod Mahato', 'AADH-1189-6648', 30, 'SC', '9876543217', '10th Pass', 0.6, 0.2, 3, 1, 5, 'Stitching & Agriculture'],
  ['HH-109', 'Phoolmati Devi', 'Ram Swaroop', 'AADH-9900-7739', 50, 'ST', '9876543218', 'Illiterate', 1.8, 1.0, 8, 2, 8, 'Forest Produce & Farming'],
  ['HH-110', 'Chinta Devi', 'Dinesh Ram', 'AADH-8811-8820', 43, 'SC', '9876543219', '5th Pass', 0.4, 0.0, 2, 0, 5, 'Daily Wage Labor'],
  ['HH-111', 'Shanti Devi', 'Brijesh Kumar', 'AADH-7722-9911', 37, 'OBC', '9876543220', '9th Pass', 1.6, 1.2, 4, 3, 6, 'Agriculture & Dairy'],
  ['HH-112', 'Kanti Devi', 'Surendra Prasad', 'AADH-6633-0002', 40, 'EBC', '9876543221', '8th Pass', 1.1, 0.7, 3, 2, 5, 'Vegetable Farming'],
];

export type SeedOptions = {
  groupName?: string;
  username?: string;
  password: string;
  role?: 'operator' | 'viewer';
};

/** Creates complete groups, admin credentials, shapes, settings, and location master data. */
export async function seedBaseData(db: Db, opts: SeedOptions) {
  // 1. Seed global super_admin user if not exists
  const [existingSuperAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.username, 'super_admin')).limit(1);
  if (!existingSuperAdmin) {
    await db.insert(users).values({
      groupId: null,
      username: 'super_admin',
      passwordHash: await hashPassword('Admin123'),
      fullName: 'Global Super Administrator',
      role: 'super_admin',
      language: 'en',
    });
  }

  const [existingAdmin] = await db.select({ id: users.id }).from(users).where(eq(users.username, 'admin')).limit(1);
  if (!existingAdmin) {
    await db.insert(users).values({
      groupId: null,
      username: 'admin',
      passwordHash: await hashPassword(opts.password || 'Admin123'),
      fullName: 'MIS Master Administrator',
      role: 'super_admin',
      language: 'en',
    });
  }

  // 2. Seed global system settings
  const settingsList = [
    { key: 'global_interest_rate', value: '0.0200', category: 'interest', description: 'Monthly interest rate on loans (2% = 0.0200)' },
    { key: 'default_stamp_value', value: '50', category: 'stamps', description: 'Default face value of savings stamp in rupees' },
    { key: 'default_max_loan_amount', value: '50000', category: 'limits', description: 'Maximum disbursement limit per loan' },
    { key: 'default_max_stamps_per_meeting', value: '5', category: 'limits', description: 'Maximum deposit stamps per member per meeting' },
    { key: 'require_transaction_approval', value: 'true', category: 'approval', description: 'Require admin approval for meeting deposits and loan disbursements' },
    { key: 'access_control_allow_viewer_export', value: 'true', category: 'access', description: 'Allow viewers to export ledger and report data' },
    { key: 'access_control_enforce_password_expiry', value: 'false', category: 'access', description: 'Force password change every 90 days' },
  ];
  for (const s of settingsList) {
    const [found] = await db.select({ id: systemSettings.id }).from(systemSettings).where(eq(systemSettings.key, s.key)).limit(1);
    if (!found) {
      await db.insert(systemSettings).values(s);
    }
  }

  // 2b. Seed initial master locations
  const initialLocations = [
    { state: 'Bihar', district: 'Patna', block: 'Phulwari Sharif', panchayat: 'Rampur', village: 'Rampur', pincode: '801505' },
    { state: 'Bihar', district: 'Patna', block: 'Phulwari Sharif', panchayat: 'Rampur', village: 'Korji', pincode: '801505' },
    { state: 'Bihar', district: 'Patna', block: 'Danapur', panchayat: 'Saguna', village: 'Saguna More', pincode: '801503' },
    { state: 'Bihar', district: 'Patna', block: 'Danapur', panchayat: 'Saguna', village: 'Mustafapur', pincode: '801503' },
    { state: 'Bihar', district: 'Patna', block: 'Maner', panchayat: 'Haldichhapra', village: 'Haldichhapra', pincode: '801108' },
    { state: 'Bihar', district: 'Patna', block: 'Maner', panchayat: 'Haldichhapra', village: 'Chhitnawan', pincode: '801108' },
    { state: 'Bihar', district: 'Nalanda', block: 'Bihar Sharif', panchayat: 'Maghra', village: 'Maghra', pincode: '803101' },
    { state: 'Bihar', district: 'Nalanda', block: 'Bihar Sharif', panchayat: 'Maghra', village: 'Tungi', pincode: '803101' },
    { state: 'Bihar', district: 'Nalanda', block: 'Rajgir', panchayat: 'Barhari', village: 'Barhari', pincode: '803116' },
    { state: 'Bihar', district: 'Gaya', block: 'Bodh Gaya', panchayat: 'Bakrour', village: 'Bakrour', pincode: '824231' },
  ];
  for (const loc of initialLocations) {
    const [existing] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.state, loc.state),
          eq(locations.district, loc.district),
          eq(locations.block, loc.block),
          eq(locations.panchayat, loc.panchayat),
          eq(locations.village, loc.village),
        ),
      )
      .limit(1);
    if (!existing) {
      await db.insert(locations).values(loc);
    }
  }

  // 3. Primary SHG: Lakshi Group
  const [group] = await db
    .insert(groups)
    .values({
      name: opts.groupName ?? 'Lakshi Group',
      hindiName: 'लक्ष्मी समूह',
      address: 'Ward No. 4, Village Rampur, Dist. Patna, Bihar - 800001',
      state: 'Bihar',
      district: 'Patna',
      block: 'Phulwari Sharif',
      panchayat: 'Rampur',
      village: 'Rampur',
      stampValue: 50,
      maxStampsPerMember: 5,
      maxLoanAmount: 50000,
      approvalRequired: true,
      meetingDay: 'Monday',
    })
    .returning();

  await db.insert(cycles).values({
    groupId: group.id,
    cycleNo: 3,
    startDate: '2026-01-05',
    endDate: '2026-12-21',
    durationWeeks: 50,
    isCurrent: true,
  });

  await db.insert(loanShapes).values(DEFAULT_SHAPES.map((s) => ({ ...s, groupId: group.id })));

  const memberRows = await db
    .insert(members)
    .values(
      PWA_MEMBERS.map(([hhNo, name, husbandName, idNo, age, caste, mobileNo, education, agri, irrigated, goats, animals, family, income]) => ({
        groupId: group.id,
        hhNo,
        name,
        husbandName,
        idNo,
        age,
        caste,
        mobileNo,
        education,
        agriLandAcres: agri.toFixed(2),
        irrigatedLandAcres: irrigated.toFixed(2),
        goatCount: goats,
        animalCount: animals,
        familySize: family,
        incomeSource: income,
        joinedOn: '2026-01-05',
      })),
    )
    .returning();

  const username = (opts.username ?? 'lakshigroup').trim().toLowerCase();
  const [user] = await db
    .insert(users)
    .values({
      groupId: group.id,
      username,
      passwordHash: await hashPassword(opts.password),
      fullName: 'Lakshi Group Operator',
      role: opts.role ?? 'operator',
    })
    .returning();

  // 4. Secondary Demo SHGs (for rich MIS cascading search across Patna & Nalanda)
  const [g2] = await db.insert(groups).values({
    name: 'Pragati Mahila Mandal',
    hindiName: 'प्रगति महिला मंडल',
    address: 'Danapur Cantt, Dist. Patna, Bihar',
    state: 'Bihar',
    district: 'Patna',
    block: 'Danapur',
    panchayat: 'Saguna',
    village: 'Saguna More',
    stampValue: 100,
    maxStampsPerMember: 5,
    maxLoanAmount: 75000,
    approvalRequired: true,
    meetingDay: 'Wednesday',
  }).returning();

  await db.insert(cycles).values({
    groupId: g2.id,
    cycleNo: 1,
    startDate: '2026-02-01',
    endDate: '2027-01-31',
    durationWeeks: 52,
    isCurrent: true,
  });
  await db.insert(loanShapes).values(DEFAULT_SHAPES.map((s) => ({ ...s, groupId: g2.id })));
  await db.insert(members).values([
    { groupId: g2.id, hhNo: 'HH-201', name: 'Kavita Kumari', husbandName: 'Sanjay Roy', mobileNo: '9876500001', joinedOn: '2026-02-01' },
    { groupId: g2.id, hhNo: 'HH-202', name: 'Sarita Sharma', husbandName: 'Manoj Sharma', mobileNo: '9876500002', joinedOn: '2026-02-01' },
    { groupId: g2.id, hhNo: 'HH-203', name: 'Pooja Devi', husbandName: 'Vikash Singh', mobileNo: '9876500003', joinedOn: '2026-02-01' },
  ]);
  await db.insert(users).values({
    groupId: g2.id,
    username: 'pragatigroup',
    passwordHash: await hashPassword('pragati123'),
    fullName: 'Pragati SHG Operator',
    role: 'operator',
  });

  const [g3] = await db.insert(groups).values({
    name: 'Ujala Self Help Group',
    hindiName: 'उजाला स्वयं सहायता समूह',
    address: 'Main Bazaar, Bihar Sharif, Nalanda, Bihar',
    state: 'Bihar',
    district: 'Nalanda',
    block: 'Bihar Sharif',
    panchayat: 'Maghra',
    village: 'Maghra',
    stampValue: 50,
    maxStampsPerMember: 5,
    maxLoanAmount: 40000,
    approvalRequired: true,
    meetingDay: 'Friday',
  }).returning();

  await db.insert(cycles).values({
    groupId: g3.id,
    cycleNo: 2,
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    durationWeeks: 50,
    isCurrent: true,
  });
  await db.insert(loanShapes).values(DEFAULT_SHAPES.map((s) => ({ ...s, groupId: g3.id })));
  await db.insert(members).values([
    { groupId: g3.id, hhNo: 'HH-301', name: 'Rani Devi', husbandName: 'Ajay Paswan', mobileNo: '9876511111', joinedOn: '2026-01-15' },
    { groupId: g3.id, hhNo: 'HH-302', name: 'Guddi Khatun', husbandName: 'Mohd. Salim', mobileNo: '9876511112', joinedOn: '2026-01-15' },
  ]);
  await db.insert(users).values({
    groupId: g3.id,
    username: 'ujalagroup',
    passwordHash: await hashPassword('ujala123'),
    fullName: 'Ujala SHG Operator',
    role: 'operator',
  });

  const memberIdByHh = Object.fromEntries(memberRows.map((m) => [m.hhNo, m.id]));
  return { groupId: group.id, userId: user.id, memberIdByHh };
}

/** Looks up a seeded group's ids (for the CLI's idempotent re-run). */
export async function findSeededGroup(db: Db, groupName = 'Lakshi Group') {
  const [g] = await db.select({ id: groups.id }).from(groups).where(eq(groups.name, groupName)).limit(1);
  return g?.id ?? null;
}

export async function hasMembers(db: Db, groupId: string) {
  const rows = await db.select({ id: members.id }).from(members).where(and(eq(members.groupId, groupId))).limit(1);
  return rows.length > 0;
}

/**
 * Demo activity equivalent to the PWA seed: 4 monthly deposits, two loans and
 * two repayments. Amounts are computed by the real services, so they differ
 * from the PWA's hand-typed seed numbers (which were not self-consistent).
 */
export async function seedDemoTransactions(
  db: Db,
  base: { groupId: string; userId: string; memberIdByHh: Record<string, string> },
) {
  const ctx: WriteCtx = { groupId: base.groupId, userId: base.userId, today: '2026-12-31' };
  const hh = (n: number) => base.memberIdByHh[`HH-${100 + n}`];

  const firstMeeting = [5, 4, 5, 2, 3, 5, 4, 3, 2, 2, 4, 4];
  const rows = [
    { date: '2026-01-10', stamps: firstMeeting },
    { date: '2026-02-10', stamps: Array(12).fill(5) },
    { date: '2026-03-10', stamps: Array(12).fill(5) },
    { date: '2026-04-10', stamps: Array(12).fill(5) },
  ];
  for (const meeting of rows) {
    await db.transaction((tx) =>
      createDeposit(tx as unknown as Db, ctx, {
        date: meeting.date,
        note: 'Monthly Member Savings',
        items: meeting.stamps.map((stamps: number, i: number) => ({ memberId: hh(i + 1), stamps })),
      }),
    );
  }

  const l1 = await db.transaction((tx) =>
    createLoan(tx as unknown as Db, ctx, { memberId: hh(1), date: '2026-01-15', stamps: [{ shape: 'sun' }, { shape: 'sun' }] }),
  );
  await db.transaction((tx) =>
    createLoan(tx as unknown as Db, ctx, { memberId: hh(2), date: '2026-02-01', stamps: [{ shape: 'sun' }, { shape: 'star' }] }),
  );

  await db.transaction((tx) =>
    createRepayment(tx as unknown as Db, ctx, { loanId: l1.loan.id, date: '2026-02-15', stamps: [{ shape: 'sun' }, { shape: 'sun' }] }),
  );
  await db.transaction((tx) =>
    createRepayment(tx as unknown as Db, ctx, { loanId: l1.loan.id, date: '2026-03-15', stamps: [{ shape: 'sun' }] }),
  );
}
