import { inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { repayments } from '../db/schema';
import { EMPTY_TOTALS, type RepaymentTotals } from '../lib/interest';

/** Aggregated repayment totals per loan (interest / principal / total paid). */
export async function paidTotalsByLoan(db: Db, loanIds: string[]): Promise<Map<string, RepaymentTotals>> {
  const map = new Map<string, RepaymentTotals>();
  if (loanIds.length === 0) return map;
  const rows = await db
    .select({
      loanId: repayments.loanId,
      interest: sql<number>`coalesce(sum(${repayments.interestDeducted}), 0)::int`,
      principal: sql<number>`coalesce(sum(${repayments.principalDeducted}), 0)::int`,
      amount: sql<number>`coalesce(sum(${repayments.amountPaid}), 0)::int`,
    })
    .from(repayments)
    .where(inArray(repayments.loanId, loanIds))
    .groupBy(repayments.loanId);
  for (const r of rows) map.set(r.loanId, { interest: r.interest, principal: r.principal, amount: r.amount });
  return map;
}

export const totalsOf = (map: Map<string, RepaymentTotals>, loanId: string): RepaymentTotals =>
  map.get(loanId) ?? EMPTY_TOTALS;
