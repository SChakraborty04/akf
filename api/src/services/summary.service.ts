import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { deposits, loans, repayments } from '../db/schema';
import { calculateLoanDetails } from '../lib/interest';
import { listDeposits } from './deposits.service';
import { getGroupProfile, getShapes } from './group.service';
import { listLedger } from './ledger.service';
import { paidTotalsByLoan, totalsOf } from './loan-queries';
import { listLoans } from './loans.service';
import { listMembers } from './members.service';
import { listRepayments } from './repayments.service';

/**
 * Dashboard 4-quadrant summary (PWA: calculateDashboardSummary).
 *
 *  totalSaving      sum of all deposits
 *  totalLoan        ORIGINAL principal of loans that are not fully paid
 *  avlBalance       (savings + repayments received) - all loans ever disbursed
 *  interestReceivable accrued-but-unpaid interest across active loans
 *
 * `outstandingPrincipal` is extra: what active borrowers still owe on principal.
 */
export async function getDashboardSummary(db: Db, groupId: string, today: string) {
  const [[dep], [loanAgg], [rep], activeLoans] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${deposits.totalAmount}), 0)::int` })
      .from(deposits)
      .where(eq(deposits.groupId, groupId)),
    db
      .select({
        disbursed: sql<number>`coalesce(sum(${loans.principalAmount}), 0)::int`,
        activePrincipal: sql<number>`coalesce(sum(${loans.principalAmount}) filter (where ${loans.status} = 'active'), 0)::int`,
      })
      .from(loans)
      .where(eq(loans.groupId, groupId)),
    db
      .select({ total: sql<number>`coalesce(sum(${repayments.amountPaid}), 0)::int` })
      .from(repayments)
      .where(eq(repayments.groupId, groupId)),
    db
      .select({
        id: loans.id,
        principalAmount: loans.principalAmount,
        monthlyInterestRate: loans.monthlyInterestRate,
        date: loans.date,
      })
      .from(loans)
      .where(and(eq(loans.groupId, groupId), eq(loans.status, 'active'))),
  ]);

  const totals = await paidTotalsByLoan(db, activeLoans.map((l) => l.id));
  let interestReceivable = 0;
  let outstandingPrincipal = 0;
  for (const loan of activeLoans) {
    const d = calculateLoanDetails(loan, totalsOf(totals, loan.id), today);
    interestReceivable += d.unpaidAccruedInterest;
    outstandingPrincipal += d.remainingPrincipal;
  }

  return {
    asOf: today,
    totalSaving: dep.total,
    totalLoan: loanAgg.activePrincipal,
    avlBalance: dep.total + rep.total - loanAgg.disbursed,
    interestReceivable,
    totalRepayments: rep.total,
    totalLoansDisbursed: loanAgg.disbursed,
    outstandingPrincipal,
    activeLoanCount: activeLoans.length,
  };
}

/**
 * Everything the PWA keeps in its local DataContext, in one response, for
 * first load / full resync of the offline store. Keys match the PWA's
 * INITIAL_SEED_DATA (groupProfile, loanShapes, members, deposits, loans,
 * repayments, ledger) plus `summary` and `serverTime`.
 */
export async function getSnapshot(db: Db, groupId: string, today: string) {
  const [groupProfile, loanShapes, members, deposits, loans, repayments, ledger, summary] = await Promise.all([
    getGroupProfile(db, groupId, today),
    getShapes(db, groupId),
    listMembers(db, groupId),
    listDeposits(db, groupId, {}),
    listLoans(db, groupId, {}, today),
    listRepayments(db, groupId, {}),
    listLedger(db, groupId, {}),
    getDashboardSummary(db, groupId, today),
  ]);
  return {
    serverTime: new Date().toISOString(),
    today,
    groupProfile,
    loanShapes,
    members,
    deposits: deposits.items,
    loans: loans.items,
    repayments: repayments.items,
    ledger: ledger.items,
    summary,
  };
}
