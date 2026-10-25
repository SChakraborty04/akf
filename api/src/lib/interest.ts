/**
 * Loan interest & repayment maths.
 *
 * Direct server-side port of pwa/src/utils/calculations.js so the API and the
 * PWA agree to the rupee. Differences (all deliberate):
 *  - dates are treated as plain YYYY-MM-DD (UTC parts), no local-time drift
 *  - rate maths uses integer basis points to avoid floating point error
 *  - repayment input is aggregated sums, not whole arrays
 *
 * Rules (unchanged from the PWA):
 *  - interest accrues on the ORIGINAL principal, monthly, simple (not compounding)
 *  - elapsed months = calendar month difference, +1 if a day of the next month has
 *    started (or if same month); minimum 1 once the loan exists
 *  - a repayment clears accrued-unpaid interest first, remainder reduces principal
 *  - a loan is paid when remaining principal reaches 0
 */

export type YMD = string; // 'YYYY-MM-DD'

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject overflow dates such as 2026-02-31.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function isValidYmd(s: string): boolean {
  return parseYmd(s) !== null;
}

export function calculateElapsedMonths(startDate: YMD | null | undefined, endDate: YMD): number {
  if (!startDate) return 0;
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) return 0;
  if (endDate < startDate) return 0; // ISO strings compare chronologically

  let total = (end.y - start.y) * 12 + (end.m - start.m);
  if (end.d - start.d > 0 || total === 0) total += 1;
  return Math.max(1, total);
}

/** Basis points (1% = 100bp) from a decimal rate such as 0.02 or '0.0200'. */
export const toBasisPoints = (rate: number | string): number => Math.round(Number(rate) * 10000);

/** round(principal x rate), integer rupees, no float drift. */
export function monthlyInterest(principal: number, rateBp: number): number {
  return Math.round((principal * rateBp) / 10000);
}

export type RepaymentTotals = { interest: number; principal: number; amount: number };

export type LoanLike = { principalAmount: number; monthlyInterestRate: number | string; date: YMD };

export type LoanDetails = {
  principal: number;
  monthlyInterestRate: number;
  asOf: YMD;
  elapsedMonths: number;
  totalAccruedInterest: number;
  totalInterestPaid: number;
  unpaidAccruedInterest: number;
  totalPrincipalPaid: number;
  totalAmountPaid: number;
  remainingPrincipal: number;
  /** Everything needed to close the loan on `asOf`. */
  totalDue: number;
  isPaid: boolean;
};

export const EMPTY_TOTALS: RepaymentTotals = { interest: 0, principal: 0, amount: 0 };

export function calculateLoanDetails(loan: LoanLike, paid: RepaymentTotals, asOf: YMD): LoanDetails {
  const principal = Number(loan.principalAmount);
  const rateBp = toBasisPoints(loan.monthlyInterestRate);
  const elapsedMonths = calculateElapsedMonths(loan.date, asOf);

  // Same as Math.round(principal * rate * months) in the PWA.
  const totalAccruedInterest = Math.round((principal * rateBp * elapsedMonths) / 10000);
  const unpaidAccruedInterest = Math.max(0, totalAccruedInterest - paid.interest);
  const remainingPrincipal = Math.max(0, principal - paid.principal);

  return {
    principal,
    monthlyInterestRate: rateBp / 10000,
    asOf,
    elapsedMonths,
    totalAccruedInterest,
    totalInterestPaid: paid.interest,
    unpaidAccruedInterest,
    totalPrincipalPaid: paid.principal,
    totalAmountPaid: paid.amount,
    remainingPrincipal,
    totalDue: unpaidAccruedInterest + remainingPrincipal,
    isPaid: remainingPrincipal <= 0,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type BreakdownRow = {
  monthIndex: number;
  /** 'YYYY-MM' calendar month the row belongs to. */
  month: string;
  monthLabel: string;
  monthlyAccrued: number;
  cumulativeAccrued: number;
};

/** Month-by-month interest table shown in the expanded loan card. */
export function monthlyBreakdown(loan: LoanLike, elapsedMonths: number): BreakdownRow[] {
  const start = parseYmd(loan.date);
  if (!start) return [];
  const perMonth = monthlyInterest(Number(loan.principalAmount), toBasisPoints(loan.monthlyInterestRate));
  const rows: BreakdownRow[] = [];
  for (let i = 1; i <= elapsedMonths; i++) {
    const idx = start.m - 1 + (i - 1);
    const year = start.y + Math.floor(idx / 12);
    const month = ((idx % 12) + 12) % 12;
    rows.push({
      monthIndex: i,
      month: `${year}-${String(month + 1).padStart(2, '0')}`,
      monthLabel: `${MONTHS[month]} ${year}`,
      monthlyAccrued: perMonth,
      cumulativeAccrued: perMonth * i,
    });
  }
  return rows;
}

export type Waterfall = {
  amountPaid: number;
  interestDeducted: number;
  principalDeducted: number;
  newRemainingPrincipal: number;
  willBeFullyPaid: boolean;
  /** Payment above (unpaid interest + remaining principal). Callers should reject > 0. */
  excess: number;
};

/** Interest first, then principal. */
export function processRepaymentWaterfall(details: LoanDetails, amountPaid: number): Waterfall {
  const payment = Number(amountPaid);
  const interestDeducted = Math.min(payment, details.unpaidAccruedInterest);
  const principalDeducted = Math.max(0, payment - interestDeducted);
  const newRemainingPrincipal = Math.max(0, details.remainingPrincipal - principalDeducted);
  return {
    amountPaid: payment,
    interestDeducted,
    principalDeducted,
    newRemainingPrincipal,
    willBeFullyPaid: newRemainingPrincipal <= 0,
    excess: Math.max(0, payment - details.totalDue),
  };
}

/** Value of one repayment stamp for a shape face value (PWA: round(value x 2%)). */
export function repaymentStampValue(faceValue: number, repaymentRate: number | string): number {
  return Math.round((faceValue * toBasisPoints(repaymentRate)) / 10000);
}
