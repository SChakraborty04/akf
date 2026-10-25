import { describe, expect, test } from 'bun:test';
import {
  calculateElapsedMonths,
  calculateLoanDetails,
  monthlyBreakdown,
  processRepaymentWaterfall,
  repaymentStampValue,
} from '../src/lib/interest';

const none = { interest: 0, principal: 0, amount: 0 };

describe('calculateElapsedMonths (parity with pwa/src/utils/calculations.js)', () => {
  test('same month counts as 1', () => expect(calculateElapsedMonths('2026-01-15', '2026-01-15')).toBe(1));
  test('exact calendar month = 1', () => expect(calculateElapsedMonths('2026-01-15', '2026-02-15')).toBe(1));
  test('one day into next month rolls over', () => expect(calculateElapsedMonths('2026-01-15', '2026-02-16')).toBe(2));
  test('crosses year boundary', () => expect(calculateElapsedMonths('2026-11-20', '2027-02-25')).toBe(4));
  test('end before start = 0', () => expect(calculateElapsedMonths('2026-03-01', '2026-02-01')).toBe(0));
  test('invalid dates = 0', () => expect(calculateElapsedMonths('2026-02-31', '2026-03-01')).toBe(0));
});

describe('calculateLoanDetails', () => {
  const loan = { principalAmount: 20000, monthlyInterestRate: '0.0200', date: '2026-01-15' };

  test('2% simple interest on original principal', () => {
    const d = calculateLoanDetails(loan, none, '2026-04-15'); // 3 months
    expect(d.elapsedMonths).toBe(3);
    expect(d.totalAccruedInterest).toBe(1200);
    expect(d.unpaidAccruedInterest).toBe(1200);
    expect(d.remainingPrincipal).toBe(20000);
    expect(d.totalDue).toBe(21200);
    expect(d.isPaid).toBe(false);
  });

  test('accounts for prior payments', () => {
    const d = calculateLoanDetails(loan, { interest: 400, principal: 100, amount: 500 }, '2026-02-15');
    expect(d.unpaidAccruedInterest).toBe(0);
    expect(d.remainingPrincipal).toBe(19900);
  });

  test('monthly breakdown rows', () => {
    const rows = monthlyBreakdown(loan, 3);
    expect(rows.map((r) => r.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(rows[2]).toMatchObject({ monthIndex: 3, monthlyAccrued: 400, cumulativeAccrued: 1200, monthLabel: 'Mar 2026' });
  });

  test('breakdown wraps across years', () => {
    const rows = monthlyBreakdown({ ...loan, date: '2026-11-10' }, 3);
    expect(rows.map((r) => r.month)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('processRepaymentWaterfall', () => {
  const loan = { principalAmount: 10000, monthlyInterestRate: 0.02, date: '2026-01-01' };

  test('pays interest first, then principal', () => {
    const d = calculateLoanDetails(loan, none, '2026-03-01'); // 3 months? Jan1->Mar1 = 2 months
    expect(d.unpaidAccruedInterest).toBe(400);
    const w = processRepaymentWaterfall(d, 1000);
    expect(w).toMatchObject({ interestDeducted: 400, principalDeducted: 600, newRemainingPrincipal: 9400, willBeFullyPaid: false, excess: 0 });
  });

  test('payment smaller than interest only reduces interest', () => {
    const d = calculateLoanDetails(loan, none, '2026-03-01');
    const w = processRepaymentWaterfall(d, 150);
    expect(w).toMatchObject({ interestDeducted: 150, principalDeducted: 0, newRemainingPrincipal: 10000 });
  });

  test('exact payoff closes the loan, overpayment shows excess', () => {
    const d = calculateLoanDetails(loan, none, '2026-03-01');
    expect(processRepaymentWaterfall(d, d.totalDue)).toMatchObject({ willBeFullyPaid: true, excess: 0 });
    expect(processRepaymentWaterfall(d, d.totalDue + 50)).toMatchObject({ willBeFullyPaid: true, excess: 50 });
  });
});

describe('repaymentStampValue', () => {
  test('2% of shape face value', () => {
    expect(repaymentStampValue(500, '0.0200')).toBe(10);
    expect(repaymentStampValue(1000, 0.02)).toBe(20);
    expect(repaymentStampValue(10000, 0.02)).toBe(200);
  });
});
