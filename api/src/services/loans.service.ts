import { and, count, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { groups, loanShapes, loanStamps, loans, members } from '../db/schema';
import { assertDateAllowed } from '../lib/dates';
import { notFound, unprocessable } from '../lib/errors';
import { calculateLoanDetails, monthlyBreakdown } from '../lib/interest';
import { offsetOf, pageMeta, type PageQuery } from '../lib/pagination';
import type { WriteCtx } from './deposits.service';
import { getCurrentCycle } from './group.service';
import { insertLedgerEntries } from './ledger.service';
import { paidTotalsByLoan, totalsOf } from './loan-queries';
import { listRepayments } from './repayments.service';

export type LoanFilters = { from?: string; to?: string; memberId?: string; status?: 'active' | 'paid' };

export type CreateLoanInput = {
  memberId: string;
  date?: string;
  clientId?: string;
  stamps: { shape: string }[];
};

const loanRef = (no: number) => `L-${String(no).padStart(4, '0')}`;

const selectCols = {
  id: loans.id,
  loanNo: loans.loanNo,
  clientId: loans.clientId,
  memberId: loans.memberId,
  memberName: members.name,
  hhNo: members.hhNo,
  principalAmount: loans.principalAmount,
  date: loans.date,
  monthlyInterestRate: loans.monthlyInterestRate,
  status: loans.status,
  approvalStatus: loans.approvalStatus,
  closedOn: loans.closedOn,
  createdAt: loans.createdAt,
};

type LoanListRow = {
  id: string;
  loanNo: number;
  clientId: string | null;
  memberId: string;
  memberName: string;
  hhNo: string;
  principalAmount: number;
  date: string;
  monthlyInterestRate: string;
  status: 'active' | 'paid';
  closedOn: string | null;
  createdAt: Date;
};

function where(groupId: string, f: LoanFilters): SQL {
  const conds: (SQL | undefined)[] = [eq(loans.groupId, groupId)];
  if (f.from) conds.push(gte(loans.date, f.from));
  if (f.to) conds.push(lte(loans.date, f.to));
  if (f.memberId) conds.push(eq(loans.memberId, f.memberId));
  if (f.status) conds.push(eq(loans.status, f.status));
  return and(...conds)!;
}

async function loadStamps(db: Db, loanIds: string[]) {
  const map = new Map<string, { shape: string; shapeName: string; value: number }[]>();
  if (loanIds.length === 0) return map;
  const rows = await db
    .select({ loanId: loanStamps.loanId, shape: loanShapes.code, shapeName: loanShapes.name, value: loanStamps.value })
    .from(loanStamps)
    .innerJoin(loanShapes, eq(loanShapes.id, loanStamps.shapeId))
    .where(inArray(loanStamps.loanId, loanIds))
    .orderBy(loanStamps.position);
  for (const { loanId, ...s } of rows) {
    const list = map.get(loanId) ?? [];
    list.push(s);
    map.set(loanId, list);
  }
  return map;
}

/**
 * Loans with live interest figures. `details` is computed as of `asOf`
 * (default today); closed loans are frozen at their closing date so they do
 * not keep accruing interest.
 */
async function hydrate(db: Db, rows: LoanListRow[], today: string, asOf?: string) {
  const [stamps, totals] = await Promise.all([
    loadStamps(db, rows.map((r) => r.id)),
    paidTotalsByLoan(db, rows.map((r) => r.id)),
  ]);
  return rows.map((r) => {
    const rate = Number(r.monthlyInterestRate);
    const effectiveDate = r.status === 'paid' && r.closedOn ? r.closedOn : (asOf ?? today);
    const details = calculateLoanDetails(
      { principalAmount: r.principalAmount, monthlyInterestRate: r.monthlyInterestRate, date: r.date },
      totalsOf(totals, r.id),
      effectiveDate,
    );
    return {
      ...r,
      loanRef: loanRef(r.loanNo),
      monthlyInterestRate: rate,
      stamps: stamps.get(r.id) ?? [],
      details,
    };
  });
}

/** Pass `page` = undefined to return every loan (offline snapshot). */
export async function listLoans(db: Db, groupId: string, filters: LoanFilters, today: string, page?: PageQuery) {
  const w = where(groupId, filters);
  const base = db
    .select(selectCols)
    .from(loans)
    .innerJoin(members, eq(members.id, loans.memberId))
    .where(w)
    .orderBy(desc(loans.date), desc(loans.createdAt));

  const [rows, [{ value: total }], [sum]] = await Promise.all([
    page ? base.limit(page.limit).offset(offsetOf(page)) : base,
    db.select({ value: count() }).from(loans).where(w),
    // PWA "Total Loans" banner = principal of ACTIVE loans within the current filters.
    db
      .select({
        activePrincipal: sql<number>`coalesce(sum(${loans.principalAmount}) filter (where ${loans.status} = 'active'), 0)::int`,
        activeCount: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
      })
      .from(loans)
      .where(w),
  ]);

  return {
    items: await hydrate(db, rows as LoanListRow[], today),
    summary: { totalActivePrincipal: sum.activePrincipal, activeCount: sum.activeCount },
    meta: page ? pageMeta(page.page, page.limit, total) : { total },
  };
}

/** Single loan with month-by-month interest table and its repayments. */
export async function getLoan(db: Db, groupId: string, id: string, today: string, asOf?: string) {
  const rows = await db
    .select(selectCols)
    .from(loans)
    .innerJoin(members, eq(members.id, loans.memberId))
    .where(and(eq(loans.groupId, groupId), eq(loans.id, id)))
    .limit(1);
  if (rows.length === 0) throw notFound('Loan');

  const [loan] = await hydrate(db, rows as LoanListRow[], today, asOf);
  const repaymentList = await listRepayments(db, groupId, { loanId: id });
  return {
    ...loan,
    monthlyBreakdown: monthlyBreakdown(
      { principalAmount: loan.principalAmount, monthlyInterestRate: loan.monthlyInterestRate, date: loan.date },
      loan.details.elapsedMonths,
    ),
    repayments: repaymentList.items,
  };
}

export async function findLoanByClientId(db: Db, groupId: string, clientId: string, today: string) {
  const [row] = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.groupId, groupId), eq(loans.clientId, clientId)))
    .limit(1);
  return row ? getLoan(db, groupId, row.id, today) : null;
}

/**
 * Disburse a loan. The principal is the sum of the chosen shape face values
 * (read from the DB, never from the client). Idempotent per `clientId`.
 * Run inside a transaction.
 */
export async function createLoan(tx: Db, ctx: WriteCtx, input: CreateLoanInput) {
  if (input.clientId) {
    const existing = await findLoanByClientId(tx, ctx.groupId, input.clientId, ctx.today);
    if (existing) return { loan: existing, created: false };
  }

  const date = input.date ?? ctx.today;
  assertDateAllowed(date, ctx.today);

  const [member] = await tx
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.groupId, ctx.groupId), eq(members.id, input.memberId), eq(members.isActive, true)))
    .limit(1);
  if (!member) throw unprocessable('Unknown or inactive member', 'INVALID_MEMBER', { memberId: input.memberId });

  const codes = [...new Set(input.stamps.map((s) => s.shape))];
  const shapeRows = await tx
    .select()
    .from(loanShapes)
    .where(and(eq(loanShapes.groupId, ctx.groupId), eq(loanShapes.isActive, true), inArray(loanShapes.code, codes)));
  const byCode = new Map(shapeRows.map((s) => [s.code, s]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length > 0) throw unprocessable('Unknown shape', 'INVALID_SHAPE', { shapes: missing });

  const stamps = input.stamps.map((s) => byCode.get(s.shape)!);
  const principal = stamps.reduce((sum, s) => sum + s.value, 0);

  // Atomic per-group loan number (also serialises concurrent disbursements in a group).
  const [group] = await tx
    .update(groups)
    .set({ loanSeq: sql`${groups.loanSeq} + 1` })
    .where(eq(groups.id, ctx.groupId))
    .returning({
      loanSeq: groups.loanSeq,
      rate: groups.monthlyInterestRate,
      maxLoanAmount: groups.maxLoanAmount,
      approvalRequired: groups.approvalRequired,
    });
  if (!group) throw notFound('Group');

  if (group.maxLoanAmount && principal > group.maxLoanAmount) {
    throw unprocessable(`Loan amount of ₹${principal} exceeds the group maximum limit of ₹${group.maxLoanAmount}`, 'MAX_LOAN_EXCEEDED', {
      limit: group.maxLoanAmount,
      requested: principal,
    });
  }

  const cycle = await getCurrentCycle(tx, ctx.groupId);
  const [loan] = await tx
    .insert(loans)
    .values({
      groupId: ctx.groupId,
      memberId: member.id,
      cycleId: cycle?.id ?? null,
      loanNo: group.loanSeq,
      clientId: input.clientId ?? null,
      principalAmount: principal,
      date,
      monthlyInterestRate: group.rate,
      approvalStatus: group.approvalRequired ? 'pending' : 'approved',
      createdBy: ctx.userId,
    })
    .returning();

  await tx
    .insert(loanStamps)
    .values(stamps.map((s, i) => ({ loanId: loan.id, shapeId: s.id, value: s.value, position: i })));

  await insertLedgerEntries(tx, [
    {
      groupId: ctx.groupId,
      type: 'loan',
      amount: principal,
      date,
      memberId: member.id,
      loanId: loan.id,
      description: `Loan Disbursed - ${member.name} (${stamps.map((s) => s.name).join(', ')})`,
    },
  ]);

  return { loan: await getLoan(tx, ctx.groupId, loan.id, ctx.today), created: true };
}
