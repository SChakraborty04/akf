import { and, count, desc, eq, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { loanShapes, loans, members, repaymentStamps, repayments } from '../db/schema';
import { assertDateAllowed } from '../lib/dates';
import { notFound, unprocessable } from '../lib/errors';
import {
  calculateLoanDetails,
  processRepaymentWaterfall,
  repaymentStampValue,
  type LoanDetails,
  type Waterfall,
} from '../lib/interest';
import { offsetOf, pageMeta, type PageQuery } from '../lib/pagination';
import type { WriteCtx } from './deposits.service';
import { getCurrentCycle, getGroupRow } from './group.service';
import { insertLedgerEntries } from './ledger.service';
import { paidTotalsByLoan, totalsOf } from './loan-queries';

export type RepaymentFilters = { from?: string; to?: string; memberId?: string; loanId?: string };

export type RepaymentInput = {
  loanId: string;
  /** Optional; when sent it must match the loan's borrower. */
  memberId?: string;
  date?: string;
  clientId?: string;
  stamps: { shape: string }[];
};

type StampView = { shape: string; shapeName: string; value: number };

function where(groupId: string, f: RepaymentFilters): SQL {
  const conds: (SQL | undefined)[] = [eq(repayments.groupId, groupId)];
  if (f.from) conds.push(gte(repayments.date, f.from));
  if (f.to) conds.push(lte(repayments.date, f.to));
  if (f.memberId) conds.push(eq(repayments.memberId, f.memberId));
  if (f.loanId) conds.push(eq(repayments.loanId, f.loanId));
  return and(...conds)!;
}

export async function loadRepaymentStamps(db: Db, repaymentIds: string[]) {
  const map = new Map<string, StampView[]>();
  if (repaymentIds.length === 0) return map;
  const rows = await db
    .select({
      repaymentId: repaymentStamps.repaymentId,
      shape: loanShapes.code,
      shapeName: loanShapes.name,
      value: repaymentStamps.value,
    })
    .from(repaymentStamps)
    .innerJoin(loanShapes, eq(loanShapes.id, repaymentStamps.shapeId))
    .where(inArray(repaymentStamps.repaymentId, repaymentIds))
    .orderBy(repaymentStamps.position);
  for (const { repaymentId, ...s } of rows) {
    const list = map.get(repaymentId) ?? [];
    list.push(s);
    map.set(repaymentId, list);
  }
  return map;
}

const selectCols = {
  id: repayments.id,
  clientId: repayments.clientId,
  loanId: repayments.loanId,
  loanNo: loans.loanNo,
  loanPrincipal: loans.principalAmount,
  memberId: repayments.memberId,
  memberName: members.name,
  hhNo: members.hhNo,
  date: repayments.date,
  amountPaid: repayments.amountPaid,
  interestDeducted: repayments.interestDeducted,
  principalDeducted: repayments.principalDeducted,
  createdAt: repayments.createdAt,
};

async function hydrate(db: Db, rows: { id: string; loanId: string; loanPrincipal: number }[] & Record<string, any>[]) {
  const [stamps, totals] = await Promise.all([
    loadRepaymentStamps(db, rows.map((r) => r.id)),
    paidTotalsByLoan(db, [...new Set(rows.map((r) => r.loanId))]),
  ]);
  return rows.map(({ loanPrincipal, ...r }) => ({
    ...r,
    stamps: stamps.get(r.id) ?? [],
    // Current outstanding principal of the loan (PWA "Remaining Principal" banner).
    loanRemainingPrincipal: Math.max(0, loanPrincipal - totalsOf(totals, r.loanId).principal),
  }));
}

/** Pass `page` = undefined to return everything (offline snapshot). */
export async function listRepayments(db: Db, groupId: string, filters: RepaymentFilters, page?: PageQuery) {
  const w = where(groupId, filters);
  const base = db
    .select(selectCols)
    .from(repayments)
    .innerJoin(loans, eq(loans.id, repayments.loanId))
    .innerJoin(members, eq(members.id, repayments.memberId))
    .where(w)
    .orderBy(desc(repayments.date), desc(repayments.createdAt));

  const [rows, [{ value: total }], [sum]] = await Promise.all([
    page ? base.limit(page.limit).offset(offsetOf(page)) : base,
    db.select({ value: count() }).from(repayments).where(w),
    db
      .select({
        amount: sql<number>`coalesce(sum(${repayments.amountPaid}), 0)::int`,
        interest: sql<number>`coalesce(sum(${repayments.interestDeducted}), 0)::int`,
        principal: sql<number>`coalesce(sum(${repayments.principalDeducted}), 0)::int`,
      })
      .from(repayments)
      .where(w),
  ]);

  return {
    items: await hydrate(db, rows),
    summary: { totalAmount: sum.amount, totalInterest: sum.interest, totalPrincipal: sum.principal },
    meta: page ? pageMeta(page.page, page.limit, total) : { total },
  };
}

export async function getRepayment(db: Db, groupId: string, id: string) {
  const rows = await db
    .select(selectCols)
    .from(repayments)
    .innerJoin(loans, eq(loans.id, repayments.loanId))
    .innerJoin(members, eq(members.id, repayments.memberId))
    .where(and(eq(repayments.groupId, groupId), eq(repayments.id, id)))
    .limit(1);
  if (rows.length === 0) throw notFound('Repayment');
  return (await hydrate(db, rows))[0];
}

export async function findRepaymentByClientId(db: Db, groupId: string, clientId: string) {
  const [row] = await db
    .select({ id: repayments.id })
    .from(repayments)
    .where(and(eq(repayments.groupId, groupId), eq(repayments.clientId, clientId)))
    .limit(1);
  return row ? getRepayment(db, groupId, row.id) : null;
}

type Prepared = {
  loan: typeof loans.$inferSelect;
  memberName: string;
  date: string;
  stamps: { shapeId: string; code: string; name: string; value: number }[];
  amount: number;
  details: LoanDetails;
  waterfall: Waterfall;
};

/**
 * Validates a repayment against the loan's current state and computes the
 * interest-first split. Shared by preview (read-only) and create (locks the
 * loan row so concurrent payments are serialised).
 */
async function prepare(db: Db, ctx: WriteCtx, input: RepaymentInput, mode: 'preview' | 'commit'): Promise<Prepared> {
  const lockedQuery = db
    .select()
    .from(loans)
    .where(and(eq(loans.groupId, ctx.groupId), eq(loans.id, input.loanId)))
    .limit(1);
  const [loan] = await (mode === 'commit' ? lockedQuery.for('update') : lockedQuery);
  if (!loan) throw notFound('Loan');

  if (loan.status === 'paid') throw unprocessable('This loan is already fully paid', 'LOAN_ALREADY_PAID');
  if (input.memberId && input.memberId !== loan.memberId) {
    throw unprocessable('This loan does not belong to the selected member', 'MEMBER_LOAN_MISMATCH');
  }

  const date = input.date ?? ctx.today;
  assertDateAllowed(date, ctx.today);
  if (date < loan.date) throw unprocessable('Repayment date cannot be before the loan date', 'DATE_BEFORE_LOAN', { loanDate: loan.date });

  const [{ lastDate }] = await db
    .select({ lastDate: sql<string | null>`max(${repayments.date})` })
    .from(repayments)
    .where(eq(repayments.loanId, loan.id));
  if (lastDate && date < lastDate) {
    throw unprocessable('Repayment date cannot be before the previous repayment', 'DATE_BEFORE_LAST_REPAYMENT', {
      lastRepaymentDate: lastDate,
    });
  }

  const [member] = await db.select({ name: members.name }).from(members).where(eq(members.id, loan.memberId)).limit(1);

  const group = await getGroupRow(db, ctx.groupId);
  const codes = [...new Set(input.stamps.map((s) => s.shape))];
  const shapeRows = codes.length
    ? await db
        .select()
        .from(loanShapes)
        .where(and(eq(loanShapes.groupId, ctx.groupId), eq(loanShapes.isActive, true), inArray(loanShapes.code, codes)))
    : [];
  const byCode = new Map(shapeRows.map((s) => [s.code, s]));
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length > 0) throw unprocessable('Unknown shape', 'INVALID_SHAPE', { shapes: missing });

  const stamps = input.stamps.map((s) => {
    const shape = byCode.get(s.shape)!;
    return {
      shapeId: shape.id,
      code: shape.code,
      name: shape.name,
      value: repaymentStampValue(shape.value, group.repaymentStampRate),
    };
  });
  const amount = stamps.reduce((sum, s) => sum + s.value, 0);

  const totals = totalsOf(await paidTotalsByLoan(db, [loan.id]), loan.id);
  const details = calculateLoanDetails(loan, totals, date);
  const waterfall = processRepaymentWaterfall(details, amount);

  return { loan, memberName: member?.name ?? 'Member', date, stamps, amount, details, waterfall };
}

/** Read-only "what would happen" for the repayment modal (unpaid interest, split, remaining principal). */
export async function previewRepayment(db: Db, ctx: WriteCtx, input: RepaymentInput) {
  const p = await prepare(db, ctx, input, 'preview');
  return {
    loanId: p.loan.id,
    loanNo: p.loan.loanNo,
    memberId: p.loan.memberId,
    memberName: p.memberName,
    date: p.date,
    stamps: p.stamps.map((s) => ({ shape: s.code, shapeName: s.name, value: s.value })),
    amountPaid: p.amount,
    details: p.details,
    waterfall: p.waterfall,
    /** Highest amount accepted right now; anything above is rejected with OVERPAYMENT. */
    maxPayable: p.details.totalDue,
    valid: p.amount > 0 && p.waterfall.excess === 0,
  };
}

/**
 * Record a repayment: interest first, remainder to principal; marks the loan
 * paid when principal reaches 0. Idempotent per `clientId`. Run in a transaction.
 */
export async function createRepayment(tx: Db, ctx: WriteCtx, input: RepaymentInput) {
  if (input.clientId) {
    const existing = await findRepaymentByClientId(tx, ctx.groupId, input.clientId);
    if (existing) return { repayment: existing, created: false };
  }

  const p = await prepare(tx, ctx, input, 'commit');
  if (p.stamps.length === 0 || p.amount <= 0) throw unprocessable('Add at least one repayment stamp', 'NO_STAMPS');
  if (p.waterfall.excess > 0) {
    throw unprocessable('Payment exceeds the amount due on this loan', 'OVERPAYMENT', {
      amountPaid: p.amount,
      maxPayable: p.details.totalDue,
      unpaidInterest: p.details.unpaidAccruedInterest,
      remainingPrincipal: p.details.remainingPrincipal,
    });
  }

  const cycle = await getCurrentCycle(tx, ctx.groupId);
  const [repayment] = await tx
    .insert(repayments)
    .values({
      groupId: ctx.groupId,
      loanId: p.loan.id,
      memberId: p.loan.memberId,
      cycleId: cycle?.id ?? null,
      clientId: input.clientId ?? null,
      date: p.date,
      amountPaid: p.amount,
      interestDeducted: p.waterfall.interestDeducted,
      principalDeducted: p.waterfall.principalDeducted,
      createdBy: ctx.userId,
    })
    .returning();

  await tx
    .insert(repaymentStamps)
    .values(p.stamps.map((s, i) => ({ repaymentId: repayment.id, shapeId: s.shapeId, value: s.value, position: i })));

  if (p.waterfall.willBeFullyPaid) {
    await tx.update(loans).set({ status: 'paid', closedOn: p.date }).where(eq(loans.id, p.loan.id));
  }

  await insertLedgerEntries(tx, [
    {
      groupId: ctx.groupId,
      type: 'repayment',
      amount: p.amount,
      date: p.date,
      memberId: p.loan.memberId,
      loanId: p.loan.id,
      repaymentId: repayment.id,
      description: `Loan Repayment - ${p.memberName} (Int: ₹${p.waterfall.interestDeducted}, Prin: ₹${p.waterfall.principalDeducted})`,
    },
  ]);

  return { repayment: await getRepayment(tx, ctx.groupId, repayment.id), created: true };
}
