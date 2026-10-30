// src/db/schema.ts
//
// Data model for the Lakshi SHG (Self Help Group) platform.
//
// Derived from the PWA (pwa/src/context/DataContext.jsx + seedData.js):
//
//   groupProfile  -> groups + cycles
//   loanShapes    -> loan_shapes
//   members       -> members
//   deposits      -> deposits + deposit_items   (one meeting, per-member stamps)
//   loans         -> loans + loan_stamps        (shape-based issuance)
//   repayments    -> repayments + repayment_stamps (interest-first waterfall)
//   ledger        -> ledger_entries             (credit/debit feed)
//
// Everything is scoped by `group_id` so the same database can serve many SHGs
// (the future admin API manages groups/users/members across them).
//
// Money is stored as whole rupees (integer). All stamp values are whole rupees
// and interest is rounded to the nearest rupee, exactly like the PWA does.
// Rates are `numeric(6,4)` fractions (0.0200 = 2% per month).
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

/** super_admin = global access, admin = regional coordinator, do = development officer, shg = field app recording user, operator = legacy field operator, viewer = read-only. */
export const userRole = pgEnum('user_role', ['super_admin', 'admin', 'operator', 'viewer', 'do', 'shg']);
export const languageCode = pgEnum('language_code', ['en', 'hi']);
export const loanStatus = pgEnum('loan_status', ['active', 'paid']);
export const ledgerType = pgEnum('ledger_type', ['deposit', 'loan', 'repayment']);
export const approvalStatus = pgEnum('approval_status', ['pending', 'approved', 'rejected']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/* Group & cycle                                                              */
/* -------------------------------------------------------------------------- */

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    hindiName: text('hindi_name'),
    address: text('address'),
    state: text('state').default('Bihar').notNull(),
    district: text('district').default('Patna').notNull(),
    block: text('block').default('Phulwari Sharif').notNull(),
    panchayat: text('panchayat').default('Rampur').notNull(),
    village: text('village').default('Rampur'),
    /** Value of one savings stamp in rupees (PWA: groupProfile.stampValue). */
    stampValue: integer('stamp_value').default(50).notNull(),
    /** Max savings stamps one member can buy per meeting (PWA: dropdown 0-5). */
    maxStampsPerMember: integer('max_stamps_per_member').default(5).notNull(),
    /** Max loan amount permitted for this SHG in rupees (Admin validation rule). */
    maxLoanAmount: integer('max_loan_amount').default(50000).notNull(),
    /** Whether transactions (deposits/loans) require Admin approval before confirmation. */
    approvalRequired: boolean('approval_required').default(true).notNull(),
    /** Interest charged on loan principal per month (PWA: 2%). */
    monthlyInterestRate: numeric('monthly_interest_rate', { precision: 6, scale: 4 })
      .default('0.0200')
      .notNull(),
    /** Repayment stamp value = shape face value x this rate (PWA: 2%). */
    repaymentStampRate: numeric('repayment_stamp_rate', { precision: 6, scale: 4 })
      .default('0.0200')
      .notNull(),
    meetingDay: text('meeting_day'),
    /** Last issued per-group loan number; incremented atomically on loan create. */
    loanSeq: integer('loan_seq').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('groups_stamp_value_positive', sql`${t.stampValue} > 0`),
    check('groups_max_stamps_positive', sql`${t.maxStampsPerMember} > 0`),
    check('groups_max_loan_positive', sql`${t.maxLoanAmount} > 0`),
    check('groups_rates_non_negative', sql`${t.monthlyInterestRate} >= 0 AND ${t.repaymentStampRate} >= 0`),
  ],
);

/** A savings/lending cycle (PWA: cycleNo, cycleStart, cycleEnd, cycleWeek). */
export const cycles = pgTable(
  'cycles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    cycleNo: integer('cycle_no').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    durationWeeks: integer('duration_weeks').notNull(),
    isCurrent: boolean('is_current').default(false).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('cycles_group_cycle_no_uq').on(t.groupId, t.cycleNo),
    // At most one current cycle per group.
    uniqueIndex('cycles_one_current_per_group_uq').on(t.groupId).where(sql`${t.isCurrent}`),
    check('cycles_dates_ordered', sql`${t.endDate} >= ${t.startDate}`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Login accounts. Groups have operator logins; super_admins/admins can have
 * `groupId = null` for cross-group MIS administration; DOs can have multiple
 * assigned SHGs via `assignedGroupIds`.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    /** Assigned SHG group IDs for DO (Development Officer) with multi-group access. */
    assignedGroupIds: text('assigned_group_ids').array(),
    /** Always stored lower-case & trimmed; globally unique. */
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    role: userRole('role').default('operator').notNull(),
    /** UI language preference (PWA LanguageContext). */
    language: languageCode('language').default('en').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    failedLoginCount: integer('failed_login_count').default(0).notNull(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_username_uq').on(t.username),
    index('users_group_idx').on(t.groupId),
    check('users_username_normalized', sql`${t.username} = lower(btrim(${t.username}))`),
  ],
);

/** Opaque, rotating refresh tokens. Only a SHA-256 hash is stored. */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('refresh_tokens_hash_uq').on(t.tokenHash), index('refresh_tokens_user_idx').on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/* Master data                                                                */
/* -------------------------------------------------------------------------- */

/** Stamp shapes used to issue loans / record repayments (PWA: loanShapes). */
export const loanShapes = pgTable(
  'loan_shapes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    /** Stable identifier used by the PWA, e.g. 'sun', 'star', 'circle'. */
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Face value in rupees (loan value). Repayment value = value x repayment rate. */
    value: integer('value').notNull(),
    color: text('color'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('loan_shapes_group_code_uq').on(t.groupId, t.code),
    check('loan_shapes_value_positive', sql`${t.value} > 0`),
  ],
);

/** SHG members (PWA: members / Profile + MemberDetailModal). */
export const members = pgTable(
  'members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    /** Household number, e.g. 'HH-101'. */
    hhNo: text('hh_no').notNull(),
    name: text('name').notNull(),
    husbandName: text('husband_name'),
    /** Government ID number. Sensitive: only returned by the member detail route. */
    idNo: text('id_no'),
    age: integer('age'),
    caste: text('caste'),
    mobileNo: text('mobile_no'),
    education: text('education'),
    agriLandAcres: numeric('agri_land_acres', { precision: 7, scale: 2 }),
    irrigatedLandAcres: numeric('irrigated_land_acres', { precision: 7, scale: 2 }),
    goatCount: integer('goat_count').default(0).notNull(),
    animalCount: integer('animal_count').default(0).notNull(),
    familySize: integer('family_size'),
    incomeSource: text('income_source'),
    isActive: boolean('is_active').default(true).notNull(),
    joinedOn: date('joined_on', { mode: 'string' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('members_group_hh_no_uq').on(t.groupId, t.hhNo),
    index('members_group_active_idx').on(t.groupId, t.isActive),
  ],
);

/* -------------------------------------------------------------------------- */
/* Deposits (meeting savings)                                                 */
/* -------------------------------------------------------------------------- */

/** One meeting's savings collection (PWA: deposits[]). */
export const deposits = pgTable(
  'deposits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
    /** Client-generated UUID so offline retries are idempotent. */
    clientId: uuid('client_id'),
    date: date('date', { mode: 'string' }).notNull(),
    note: text('note'),
    totalStamps: integer('total_stamps').notNull(),
    /** Stamp value at the time of collection (group.stampValue can change later). */
    stampValue: integer('stamp_value').notNull(),
    totalAmount: integer('total_amount').notNull(),
    approvalStatus: approvalStatus('approval_status').default('approved').notNull(),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('deposits_group_client_uq').on(t.groupId, t.clientId),
    index('deposits_group_date_idx').on(t.groupId, t.date),
    index('deposits_approval_idx').on(t.groupId, t.approvalStatus),
    check('deposits_totals_positive', sql`${t.totalStamps} > 0 AND ${t.totalAmount} > 0`),
  ],
);

/** Per-member stamps in a deposit (PWA: deposit.memberDeposits[]). Only stamps > 0 are stored. */
export const depositItems = pgTable(
  'deposit_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    depositId: uuid('deposit_id')
      .notNull()
      .references(() => deposits.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    stamps: integer('stamps').notNull(),
    amount: integer('amount').notNull(),
    approvalStatus: approvalStatus('approval_status').default('approved').notNull(),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('deposit_items_deposit_member_uq').on(t.depositId, t.memberId),
    index('deposit_items_member_idx').on(t.memberId),
    check('deposit_items_positive', sql`${t.stamps} > 0 AND ${t.amount} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Loans                                                                      */
/* -------------------------------------------------------------------------- */

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
    /** Human friendly per-group number (L-0001). */
    loanNo: integer('loan_no').notNull(),
    clientId: uuid('client_id'),
    principalAmount: integer('principal_amount').notNull(),
    /** Disbursement date; interest accrues monthly from here. */
    date: date('date', { mode: 'string' }).notNull(),
    /** Snapshot of the group's rate at disbursement. */
    monthlyInterestRate: numeric('monthly_interest_rate', { precision: 6, scale: 4 }).notNull(),
    status: loanStatus('status').default('active').notNull(),
    approvalStatus: approvalStatus('approval_status').default('approved').notNull(),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    closedOn: date('closed_on', { mode: 'string' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('loans_group_loan_no_uq').on(t.groupId, t.loanNo),
    uniqueIndex('loans_group_client_uq').on(t.groupId, t.clientId),
    index('loans_group_member_idx').on(t.groupId, t.memberId),
    index('loans_group_status_idx').on(t.groupId, t.status),
    index('loans_group_approval_idx').on(t.groupId, t.approvalStatus),
    index('loans_group_date_idx').on(t.groupId, t.date),
    check('loans_principal_positive', sql`${t.principalAmount} > 0`),
  ],
);

/** Shape stamps that made up the loan principal (PWA: loan.stamps[]). */
export const loanStamps = pgTable(
  'loan_stamps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    shapeId: uuid('shape_id')
      .notNull()
      .references(() => loanShapes.id, { onDelete: 'restrict' }),
    /** Face value at issuance. */
    value: integer('value').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [index('loan_stamps_loan_idx').on(t.loanId), check('loan_stamps_value_positive', sql`${t.value} > 0`)],
);

/* -------------------------------------------------------------------------- */
/* Repayments                                                                 */
/* -------------------------------------------------------------------------- */

export const repayments = pgTable(
  'repayments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    loanId: uuid('loan_id')
      .notNull()
      .references(() => loans.id, { onDelete: 'restrict' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    cycleId: uuid('cycle_id').references(() => cycles.id, { onDelete: 'set null' }),
    clientId: uuid('client_id'),
    date: date('date', { mode: 'string' }).notNull(),
    amountPaid: integer('amount_paid').notNull(),
    /** Waterfall: accrued interest is cleared first ... */
    interestDeducted: integer('interest_deducted').notNull(),
    /** ... and the remainder reduces principal. */
    principalDeducted: integer('principal_deducted').notNull(),
    approvalStatus: approvalStatus('approval_status').default('approved').notNull(),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('repayments_group_client_uq').on(t.groupId, t.clientId),
    index('repayments_loan_idx').on(t.loanId),
    index('repayments_group_date_idx').on(t.groupId, t.date),
    index('repayments_group_member_idx').on(t.groupId, t.memberId),
    check('repayments_amount_positive', sql`${t.amountPaid} > 0`),
    check('repayments_split_non_negative', sql`${t.interestDeducted} >= 0 AND ${t.principalDeducted} >= 0`),
    check('repayments_split_matches_amount', sql`${t.interestDeducted} + ${t.principalDeducted} = ${t.amountPaid}`),
  ],
);

/** Shape stamps used to pay (value = face value x repayment rate). */
export const repaymentStamps = pgTable(
  'repayment_stamps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repaymentId: uuid('repayment_id')
      .notNull()
      .references(() => repayments.id, { onDelete: 'cascade' }),
    shapeId: uuid('shape_id')
      .notNull()
      .references(() => loanShapes.id, { onDelete: 'restrict' }),
    value: integer('value').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [
    index('repayment_stamps_repayment_idx').on(t.repaymentId),
    check('repayment_stamps_value_positive', sql`${t.value} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Ledger                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Chronological money-movement feed (PWA: ledger[]).
 * Credit = deposit | repayment, debit = loan. A deposit produces one entry per
 * contributing member.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    type: ledgerType('type').notNull(),
    amount: integer('amount').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    memberId: uuid('member_id').references(() => members.id, { onDelete: 'restrict' }),
    depositId: uuid('deposit_id').references(() => deposits.id, { onDelete: 'cascade' }),
    loanId: uuid('loan_id').references(() => loans.id, { onDelete: 'cascade' }),
    repaymentId: uuid('repayment_id').references(() => repayments.id, { onDelete: 'cascade' }),
    stamps: integer('stamps'),
    description: text('description').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('ledger_group_date_idx').on(t.groupId, t.date, t.createdAt),
    index('ledger_group_member_idx').on(t.groupId, t.memberId),
    index('ledger_deposit_idx').on(t.depositId),
    index('ledger_loan_idx').on(t.loanId),
    index('ledger_repayment_idx').on(t.repaymentId),
    check('ledger_amount_positive', sql`${t.amount} > 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* System Settings                                                            */
/* -------------------------------------------------------------------------- */

export const systemSettings = pgTable(
  'system_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    category: text('category').default('general').notNull(),
    description: text('description'),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('system_settings_key_uq').on(t.key)],
);

/* -------------------------------------------------------------------------- */
/* Master Data: Locations Hierarchy (State, District, Block, Panchayat, Village) */
/* -------------------------------------------------------------------------- */

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    state: text('state').notNull(),
    district: text('district').notNull(),
    block: text('block').notNull(),
    panchayat: text('panchayat').notNull(),
    village: text('village').notNull(),
    pincode: text('pincode'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('locations_state_district_idx').on(t.state, t.district),
    index('locations_block_panchayat_idx').on(t.block, t.panchayat),
    uniqueIndex('locations_hierarchy_unique_idx').on(t.state, t.district, t.block, t.panchayat, t.village),
  ],
);


