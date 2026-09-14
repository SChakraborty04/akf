/**
 * Financial calculations and logic helper module for Lakshi Group SHG
 */

/**
 * Calculates number of full or fractional elapsed months between two date strings (YYYY-MM-DD).
 * Minimum elapsed months is 1 if targetDate >= startDate.
 */
export function calculateElapsedMonths(startDateStr, endDateStr = new Date().toISOString().split('T')[0]) {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  const yearsDiff = end.getFullYear() - start.getFullYear();
  const monthsDiff = end.getMonth() - start.getMonth();
  const daysDiff = end.getDate() - start.getDate();

  let totalMonths = yearsDiff * 12 + monthsDiff;
  
  // If at least one day has passed in the month, count it or round up to full month
  if (daysDiff > 0 || totalMonths === 0) {
    totalMonths += 1;
  }

  return Math.max(1, totalMonths);
}

/**
 * Calculates detailed interest and repayment status for a specific loan
 */
export function calculateLoanDetails(loan, repayments = [], targetDateStr = new Date().toISOString().split('T')[0]) {
  const principal = Number(loan.principalAmount || 0);
  const rate = Number(loan.monthlyInterestRate || 0.02);
  const elapsedMonths = calculateElapsedMonths(loan.date, targetDateStr);
  
  // Total accrued interest over elapsed months on original principal
  const totalAccruedInterest = Math.round(principal * rate * elapsedMonths);

  // Repayments for this loan
  const loanRepayments = repayments.filter(r => r.loanId === loan.id);
  
  const totalInterestPaid = loanRepayments.reduce((sum, r) => sum + Number(r.interestDeducted || 0), 0);
  const totalPrincipalPaid = loanRepayments.reduce((sum, r) => sum + Number(r.principalDeducted || 0), 0);
  const totalAmountPaid = loanRepayments.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);

  const unpaidAccruedInterest = Math.max(0, totalAccruedInterest - totalInterestPaid);
  const remainingPrincipal = Math.max(0, principal - totalPrincipalPaid);

  // Month-by-month interest breakdown table array
  const monthlyBreakdown = [];
  const loanDateObj = new Date(loan.date || targetDateStr);
  
  for (let i = 1; i <= elapsedMonths; i++) {
    const monthDate = new Date(loanDateObj.getFullYear(), loanDateObj.getMonth() + i - 1, 1);
    const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
    const monthlyAccrued = Math.round(principal * rate);
    monthlyBreakdown.push({
      monthIndex: i,
      monthName,
      monthlyAccrued,
      cumulativeAccrued: monthlyAccrued * i
    });
  }

  const isPaid = remainingPrincipal <= 0;

  return {
    loanId: loan.id,
    principal,
    elapsedMonths,
    totalAccruedInterest,
    totalInterestPaid,
    unpaidAccruedInterest,
    totalPrincipalPaid,
    totalAmountPaid,
    remainingPrincipal,
    isPaid,
    monthlyBreakdown
  };
}

/**
 * Computes dashboard 4-quadrant summary metrics
 */
export function calculateDashboardSummary(deposits = [], loans = [], repayments = []) {
  // 1. Total Saving: Sum of all deposits
  const totalSaving = deposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  // 2. Total Loan: Sum of active loan principal amounts
  const activeLoans = loans.filter(l => l.status !== 'Paid');
  const totalLoan = activeLoans.reduce((sum, l) => sum + Number(l.principalAmount || 0), 0);

  // Total Disbursed Loans (all loans)
  const totalLoansDisbursed = loans.reduce((sum, l) => sum + Number(l.principalAmount || 0), 0);

  // Total Repayments Received
  const totalRepayments = repayments.reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);

  // 3. Available Balance: (Total Savings + Total Repayments) - Total Loans Disbursed
  const avlBalance = (totalSaving + totalRepayments) - totalLoansDisbursed;

  // 4. Interest Receivable: Unpaid accrued interest across active loans
  const todayStr = new Date().toISOString().split('T')[0];
  const interestReceivable = activeLoans.reduce((sum, loan) => {
    const details = calculateLoanDetails(loan, repayments, todayStr);
    return sum + details.unpaidAccruedInterest;
  }, 0);

  return {
    totalSaving,
    totalLoan,
    avlBalance,
    interestReceivable,
    totalRepayments,
    totalLoansDisbursed
  };
}

/**
 * Waterfall Repayment Processor
 * Deducts payment against Accrued Interest FIRST, then remaining to Principal Reduction.
 */
export function processRepaymentWaterfall(loan, repayments = [], amountPaid, repaymentDate) {
  const details = calculateLoanDetails(loan, repayments, repaymentDate);
  const unpaidInterest = details.unpaidAccruedInterest;

  const payment = Number(amountPaid);
  
  // Deduct interest first
  const interestDeducted = Math.min(payment, unpaidInterest);
  
  // Remainder to principal
  const principalDeducted = Math.max(0, payment - interestDeducted);

  const newRemainingPrincipal = Math.max(0, details.remainingPrincipal - principalDeducted);
  const willBeFullyPaid = newRemainingPrincipal <= 0;

  return {
    amountPaid: payment,
    interestDeducted,
    principalDeducted,
    newRemainingPrincipal,
    willBeFullyPaid
  };
}

/**
 * Filter array by date range (startDate & endDate strings: YYYY-MM-DD)
 * Returns all items if dates are empty or invalid
 */
export function filterByDateRange(items = [], startDate, endDate, dateField = 'date') {
  if (!startDate && !endDate) return items;

  return items.filter(item => {
    const itemDate = item[dateField];
    if (!itemDate) return true;

    if (startDate && itemDate < startDate) return false;
    if (endDate && itemDate > endDate) return false;

    return true;
  });
}
