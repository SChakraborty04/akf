import { and, asc, desc, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  depositItems,
  deposits,
  groups,
  ledgerEntries,
  loanShapes,
  loanStamps,
  loans,
  members,
  repayments,
} from '../../db/schema';
import { notFound, unprocessable } from '../../lib/errors';

export type TransactionFilters = {
  state?: string;
  district?: string;
  block?: string;
  panchayat?: string;
  fromDate?: string;
  toDate?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'all';
  accessibleGroupIds?: string[];
};

export type ApproveInput = {
  type: 'deposit' | 'loan';
  id: string;
  action: 'approve' | 'reject';
};

/**
 * Lists transactions structured by SHG, with expandable member-level items.
 * Supports filtering by State, District, Block, Panchayat, Date range, and Approval Status.
 */
export async function listAdminTransactions(db: Db, filters: TransactionFilters = {}) {
  // 1. Find matching groups based on location hierarchy
  const groupConds: (SQL | undefined)[] = [eq(groups.isActive, true)];
  if (filters.accessibleGroupIds) {
    if (filters.accessibleGroupIds.length === 0) {
      return {
        summary: { pendingCount: 0, approvedCount: 0, pendingAmount: 0, approvedAmount: 0 },
        shgs: [],
      };
    }
    groupConds.push(inArray(groups.id, filters.accessibleGroupIds));
  }
  if (filters.state) groupConds.push(eq(groups.state, filters.state));
  if (filters.district) groupConds.push(eq(groups.district, filters.district));
  if (filters.block) groupConds.push(eq(groups.block, filters.block));
  if (filters.panchayat) groupConds.push(eq(groups.panchayat, filters.panchayat));

  const matchedGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      hindiName: groups.hindiName,
      state: groups.state,
      district: groups.district,
      block: groups.block,
      panchayat: groups.panchayat,
      village: groups.village,
    })
    .from(groups)
    .where(and(...groupConds))
    .orderBy(groups.state, groups.district, groups.block, groups.panchayat, groups.name);

  if (matchedGroups.length === 0) {
    return {
      summary: { pendingCount: 0, approvedCount: 0, pendingAmount: 0, approvedAmount: 0 },
      shgs: [],
    };
  }

  const groupIds = matchedGroups.map((g) => g.id);

  // 2. Query Deposits
  const depConds: (SQL | undefined)[] = [inArray(deposits.groupId, groupIds)];
  if (filters.fromDate) depConds.push(gte(deposits.date, filters.fromDate));
  if (filters.toDate) depConds.push(lte(deposits.date, filters.toDate));
  if (filters.status && filters.status !== 'all') {
    depConds.push(eq(deposits.approvalStatus, filters.status));
  }

  const depositRows = await db
    .select()
    .from(deposits)
    .where(and(...depConds))
    .orderBy(desc(deposits.date), desc(deposits.createdAt));

  // 3. Query Loans
  const loanConds: (SQL | undefined)[] = [inArray(loans.groupId, groupIds)];
  if (filters.fromDate) loanConds.push(gte(loans.date, filters.fromDate));
  if (filters.toDate) loanConds.push(lte(loans.date, filters.toDate));
  if (filters.status && filters.status !== 'all') {
    loanConds.push(eq(loans.approvalStatus, filters.status));
  }

  const loanRows = await db
    .select({
      id: loans.id,
      groupId: loans.groupId,
      memberId: loans.memberId,
      loanNo: loans.loanNo,
      principalAmount: loans.principalAmount,
      date: loans.date,
      monthlyInterestRate: loans.monthlyInterestRate,
      status: loans.status,
      approvalStatus: loans.approvalStatus,
      approvedAt: loans.approvedAt,
      createdAt: loans.createdAt,
      memberName: members.name,
      memberHhNo: members.hhNo,
    })
    .from(loans)
    .innerJoin(members, eq(members.id, loans.memberId))
    .where(and(...loanConds))
    .orderBy(desc(loans.date), desc(loans.createdAt));

  // 4. Preload member deposits breakdown
  const depIds = depositRows.map((d) => d.id);
  const itemsByDeposit = new Map<string, { memberId: string; memberName: string; hhNo: string; stamps: number; amount: number }[]>();
  if (depIds.length > 0) {
    const items = await db
      .select({
        depositId: depositItems.depositId,
        memberId: depositItems.memberId,
        memberName: members.name,
        hhNo: members.hhNo,
        stamps: depositItems.stamps,
        amount: depositItems.amount,
      })
      .from(depositItems)
      .innerJoin(members, eq(members.id, depositItems.memberId))
      .where(inArray(depositItems.depositId, depIds))
      .orderBy(members.hhNo);

    for (const it of items) {
      const list = itemsByDeposit.get(it.depositId) ?? [];
      list.push({
        memberId: it.memberId,
        memberName: it.memberName,
        hhNo: it.hhNo,
        stamps: it.stamps,
        amount: it.amount,
      });
      itemsByDeposit.set(it.depositId, list);
    }
  }

  // 5. Preload loan stamps
  const loanIdList = loanRows.map((l) => l.id);
  const stampsByLoan = new Map<string, { shape: string; name: string; value: number }[]>();
  if (loanIdList.length > 0) {
    const stampRows = await db
      .select({
        loanId: loanStamps.loanId,
        value: loanStamps.value,
        shape: loanShapes.code,
        name: loanShapes.name,
      })
      .from(loanStamps)
      .innerJoin(loanShapes, eq(loanShapes.id, loanStamps.shapeId))
      .where(inArray(loanStamps.loanId, loanIdList))
      .orderBy(loanStamps.position);

    for (const s of stampRows) {
      const list = stampsByLoan.get(s.loanId) ?? [];
      list.push({ shape: s.shape, name: s.name, value: s.value });
      stampsByLoan.set(s.loanId, list);
    }
  }

  // 6. Group by SHG
  const depositsByGroup = new Map<string, any[]>();
  for (const d of depositRows) {
    const list = depositsByGroup.get(d.groupId) ?? [];
    list.push({
      id: d.id,
      type: 'deposit' as const,
      date: d.date,
      note: d.note,
      totalStamps: d.totalStamps,
      stampValue: d.stampValue,
      totalAmount: d.totalAmount,
      approvalStatus: d.approvalStatus,
      approvedAt: d.approvedAt,
      memberDeposits: itemsByDeposit.get(d.id) ?? [],
      createdAt: d.createdAt,
    });
    depositsByGroup.set(d.groupId, list);
  }

  const loansByGroup = new Map<string, any[]>();
  for (const l of loanRows) {
    const list = loansByGroup.get(l.groupId) ?? [];
    list.push({
      id: l.id,
      type: 'loan' as const,
      loanNo: l.loanNo,
      loanRef: `L-${String(l.loanNo).padStart(4, '0')}`,
      memberId: l.memberId,
      memberName: l.memberName,
      memberHhNo: l.memberHhNo,
      principalAmount: l.principalAmount,
      date: l.date,
      monthlyInterestRate: l.monthlyInterestRate,
      status: l.status,
      approvalStatus: l.approvalStatus,
      approvedAt: l.approvedAt,
      stamps: stampsByLoan.get(l.id) ?? [],
      createdAt: l.createdAt,
    });
    loansByGroup.set(l.groupId, list);
  }

  let totalPendingCount = 0;
  let totalApprovedCount = 0;
  let totalPendingAmount = 0;
  let totalApprovedAmount = 0;

  const shgs = matchedGroups
    .map((g) => {
      const deps = depositsByGroup.get(g.id) ?? [];
      const lns = loansByGroup.get(g.id) ?? [];
      const pendingDeps = deps.filter((d) => d.approvalStatus === 'pending');
      const pendingLns = lns.filter((l) => l.approvalStatus === 'pending');
      const approvedDeps = deps.filter((d) => d.approvalStatus === 'approved');
      const approvedLns = lns.filter((l) => l.approvalStatus === 'approved');

      const groupPendingCount = pendingDeps.length + pendingLns.length;
      const groupApprovedCount = approvedDeps.length + approvedLns.length;
      const groupPendingAmount =
        pendingDeps.reduce((sum, d) => sum + d.totalAmount, 0) +
        pendingLns.reduce((sum, l) => sum + l.principalAmount, 0);
      const groupApprovedAmount =
        approvedDeps.reduce((sum, d) => sum + d.totalAmount, 0) +
        approvedLns.reduce((sum, l) => sum + l.principalAmount, 0);

      totalPendingCount += groupPendingCount;
      totalApprovedCount += groupApprovedCount;
      totalPendingAmount += groupPendingAmount;
      totalApprovedAmount += groupApprovedAmount;

      return {
        groupId: g.id,
        groupName: g.name,
        hindiName: g.hindiName,
        state: g.state,
        district: g.district,
        block: g.block,
        panchayat: g.panchayat,
        village: g.village,
        pendingCount: groupPendingCount,
        approvedCount: groupApprovedCount,
        pendingAmount: groupPendingAmount,
        deposits: deps,
        loans: lns,
      };
    })
    .filter((g) => {
      // If status filter is active, only include SHGs with transactions matching that status
      if (filters.status === 'pending') return g.pendingCount > 0;
      if (filters.status === 'approved') return g.approvedCount > 0;
      return true;
    });

  return {
    summary: {
      pendingCount: totalPendingCount,
      approvedCount: totalApprovedCount,
      pendingAmount: totalPendingAmount,
      approvedAmount: totalApprovedAmount,
    },
    shgs,
  };
}

/**
 * Approves or rejects a deposit or loan.
 */
export async function approveTransaction(tx: Db, adminUserId: string, input: ApproveInput) {
  const newStatus = input.action === 'approve' ? ('approved' as const) : ('rejected' as const);
  const now = new Date();

  if (input.type === 'deposit') {
    const [dep] = await tx
      .update(deposits)
      .set({
        approvalStatus: newStatus,
        approvedBy: adminUserId,
        approvedAt: now,
      })
      .where(eq(deposits.id, input.id))
      .returning();
    if (!dep) throw notFound('Deposit');
    return { ok: true, type: 'deposit', id: dep.id, status: dep.approvalStatus };
  } else if (input.type === 'loan') {
    const [ln] = await tx
      .update(loans)
      .set({
        approvalStatus: newStatus,
        approvedBy: adminUserId,
        approvedAt: now,
      })
      .where(eq(loans.id, input.id))
      .returning();
    if (!ln) throw notFound('Loan');
    return { ok: true, type: 'loan', id: ln.id, status: ln.approvalStatus };
  }

  throw unprocessable('Invalid transaction type', 'INVALID_TRANSACTION_TYPE');
}

export type EditTransactionInput = {
  type: 'deposit' | 'loan';
  id: string;
  date?: string;
  note?: string;
  principalAmount?: number;
  monthlyInterestRate?: string;
  memberDeposits?: { memberId: string; stamps: number }[];
};

/**
 * Edits a transaction that is still in 'pending' approval status.
 */
export async function editPendingTransaction(tx: Db, _adminUserId: string, input: EditTransactionInput) {
  if (input.type === 'deposit') {
    const [dep] = await tx.select().from(deposits).where(eq(deposits.id, input.id)).limit(1);
    if (!dep) throw notFound('Deposit');
    if (dep.approvalStatus !== 'pending') {
      throw unprocessable('Only transactions with pending approval status can be edited', 'TRANSACTION_NOT_PENDING');
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (input.date) updates.date = input.date;
    if (input.note !== undefined) updates.note = input.note;

    if (input.memberDeposits && Array.isArray(input.memberDeposits)) {
      let totalStamps = 0;
      for (const item of input.memberDeposits) {
        const stamps = Math.max(0, Number(item.stamps) || 0);
        totalStamps += stamps;
        await tx
          .update(depositItems)
          .set({ stamps, amount: stamps * dep.stampValue })
          .where(and(eq(depositItems.depositId, dep.id), eq(depositItems.memberId, item.memberId)));
      }
      updates.totalStamps = totalStamps;
      updates.totalAmount = totalStamps * dep.stampValue;
    }

    const [updated] = await tx.update(deposits).set(updates).where(eq(deposits.id, dep.id)).returning();
    return { ok: true, type: 'deposit', deposit: updated };
  } else if (input.type === 'loan') {
    const [ln] = await tx.select().from(loans).where(eq(loans.id, input.id)).limit(1);
    if (!ln) throw notFound('Loan');
    if (ln.approvalStatus !== 'pending') {
      throw unprocessable('Only transactions with pending approval status can be edited', 'TRANSACTION_NOT_PENDING');
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (input.date) updates.date = input.date;
    if (input.principalAmount !== undefined) updates.principalAmount = Number(input.principalAmount);
    if (input.monthlyInterestRate !== undefined) updates.monthlyInterestRate = String(input.monthlyInterestRate);

    const [updated] = await tx.update(loans).set(updates).where(eq(loans.id, ln.id)).returning();
    return { ok: true, type: 'loan', loan: updated };
  }

  throw unprocessable('Invalid transaction type', 'INVALID_TRANSACTION_TYPE');
}

/**
 * Cross-group or group-specific financial ledger view with member breakdown.
 */
export async function getAdminLedger(
  db: Db,
  filters: { groupId?: string; fromDate?: string; toDate?: string; type?: 'deposit' | 'loan' | 'repayment' },
) {
  const conds: (SQL | undefined)[] = [];
  if (filters.groupId) conds.push(eq(ledgerEntries.groupId, filters.groupId));
  if (filters.fromDate) conds.push(gte(ledgerEntries.date, filters.fromDate));
  if (filters.toDate) conds.push(lte(ledgerEntries.date, filters.toDate));
  if (filters.type) conds.push(eq(ledgerEntries.type, filters.type));

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: ledgerEntries.id,
      groupId: ledgerEntries.groupId,
      groupName: groups.name,
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
      date: ledgerEntries.date,
      memberId: ledgerEntries.memberId,
      memberName: members.name,
      hhNo: members.hhNo,
      stamps: ledgerEntries.stamps,
      description: ledgerEntries.description,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .innerJoin(groups, eq(groups.id, ledgerEntries.groupId))
    .leftJoin(members, eq(members.id, ledgerEntries.memberId))
    .where(whereClause)
    .orderBy(desc(ledgerEntries.date), desc(ledgerEntries.createdAt));

  let totalCredit = 0;
  let totalDebit = 0;
  for (const r of rows) {
    if (r.type === 'deposit' || r.type === 'repayment') totalCredit += r.amount;
    else if (r.type === 'loan') totalDebit += r.amount;
  }

  return {
    summary: {
      totalCredit,
      totalDebit,
      netBalance: totalCredit - totalDebit,
      totalEntries: rows.length,
    },
    entries: rows,
  };
}

/**
 * Helper to format date strings YYYY-MM-DD into DD-MM-YYYY
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

/**
 * Returns weekly financial ledger and member breakdown for a specific SHG:
 * - Weekly overview: Week No (001, 002...), Date (DD-MM-YYYY), Total Deposit, No of Stamps,
 *   Loan Disbursed, Re-Payment, Box Amount (cumulative cash), Outstanding Amount (cumulative loan balance),
 *   Approval column (x/12 approved transactions with x++ increment).
 * - Member-wise breakdown per week:
 *   Week No, Date, Member Name, Total Deposit, No of Stamps, Loan Disbursed, Re-Payment,
 *   Balance Amount (member cumulative savings), Outstanding Amount (member loan balance),
 *   Editable & Approvable status for current/pending week.
 * - Member history across all weeks.
 */
export async function getShgWeeklyFinance(db: Db, groupId: string) {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw notFound('SHG Group');

  const groupMembers = await db
    .select({
      id: members.id,
      name: members.name,
      hhNo: members.hhNo,
      husbandName: members.husbandName,
      mobileNo: members.mobileNo,
      isActive: members.isActive,
      joinedOn: members.joinedOn,
    })
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.isActive, true)))
    .orderBy(members.hhNo);

  const totalMembers = groupMembers.length;

  // 1. Query deposits and their member items
  const depositRows = await db
    .select()
    .from(deposits)
    .where(eq(deposits.groupId, groupId))
    .orderBy(asc(deposits.date), asc(deposits.createdAt));

  const depIds = depositRows.map((d) => d.id);
  const itemsByDepositId = new Map<string, { memberId: string; stamps: number; amount: number; approvalStatus: string }[]>();
  if (depIds.length > 0) {
    const dItems = await db
      .select({
        id: depositItems.id,
        depositId: depositItems.depositId,
        memberId: depositItems.memberId,
        stamps: depositItems.stamps,
        amount: depositItems.amount,
        approvalStatus: depositItems.approvalStatus,
      })
      .from(depositItems)
      .where(inArray(depositItems.depositId, depIds));

    for (const it of dItems) {
      const list = itemsByDepositId.get(it.depositId) ?? [];
      list.push(it);
      itemsByDepositId.set(it.depositId, list);
    }
  }

  // 2. Query loans
  const loanRows = await db
    .select({
      id: loans.id,
      memberId: loans.memberId,
      date: loans.date,
      loanNo: loans.loanNo,
      principalAmount: loans.principalAmount,
      monthlyInterestRate: loans.monthlyInterestRate,
      status: loans.status,
      approvalStatus: loans.approvalStatus,
      approvedAt: loans.approvedAt,
    })
    .from(loans)
    .where(eq(loans.groupId, groupId))
    .orderBy(asc(loans.date), asc(loans.createdAt));

  // 3. Query repayments
  const repaymentRows = await db
    .select({
      id: repayments.id,
      loanId: repayments.loanId,
      memberId: repayments.memberId,
      date: repayments.date,
      amountPaid: repayments.amountPaid,
      interestDeducted: repayments.interestDeducted,
      principalDeducted: repayments.principalDeducted,
      approvalStatus: repayments.approvalStatus,
      approvedAt: repayments.approvedAt,
    })
    .from(repayments)
    .where(eq(repayments.groupId, groupId))
    .orderBy(asc(repayments.date), asc(repayments.createdAt));

  // 4. Gather chronological meeting dates
  const dateSet = new Set<string>();
  depositRows.forEach((d) => dateSet.add(d.date));
  loanRows.forEach((l) => dateSet.add(l.date));
  repaymentRows.forEach((r) => dateSet.add(r.date));
  const sortedDates = Array.from(dateSet).sort();

  // Maps for fast lookup by date
  const depositsByDate = new Map<string, typeof depositRows[0]>();
  depositRows.forEach((d) => depositsByDate.set(d.date, d));

  const loansByDateAndMember = new Map<string, typeof loanRows>();
  loanRows.forEach((l) => {
    const key = `${l.date}__${l.memberId}`;
    const list = loansByDateAndMember.get(key) ?? [];
    list.push(l);
    loansByDateAndMember.set(key, list);
  });

  const repaymentsByDateAndMember = new Map<string, typeof repaymentRows>();
  repaymentRows.forEach((r) => {
    const key = `${r.date}__${r.memberId}`;
    const list = repaymentsByDateAndMember.get(key) ?? [];
    list.push(r);
    repaymentsByDateAndMember.set(key, list);
  });

  // 5. Cumulative state tracking
  let runningBoxAmount = 0;
  let runningOutstandingLoan = 0;
  const memberSavingsBalance = new Map<string, number>();
  const memberLoanBalance = new Map<string, number>();
  const memberHistories: Record<string, any[]> = {};
  groupMembers.forEach((m) => {
    memberSavingsBalance.set(m.id, 0);
    memberLoanBalance.set(m.id, 0);
    memberHistories[m.id] = [];
  });

  const weeks = sortedDates.map((dateStr, idx) => {
    const weekNo = String(idx + 1).padStart(3, '0');
    const displayDate = formatDisplayDate(dateStr);
    const dep = depositsByDate.get(dateStr);
    const depItems = dep ? itemsByDepositId.get(dep.id) ?? [] : [];
    const itemByMemberId = new Map(depItems.map((it) => [it.memberId, it]));

    let weekTotalDeposit = 0;
    let weekTotalStamps = 0;
    let weekLoanDisbursed = 0;
    let weekRepayment = 0;
    let weekPrincipalRepaid = 0;
    let weekApprovedMembers = 0;

    const memberDetails = groupMembers.map((m) => {
      const it = itemByMemberId.get(m.id);
      const memberStamps = it ? it.stamps : 0;
      const memberDeposit = it ? it.amount : memberStamps * group.stampValue;

      const mLoans = loansByDateAndMember.get(`${dateStr}__${m.id}`) ?? [];
      const mLoanDisbursed = mLoans.reduce((sum, l) => sum + l.principalAmount, 0);

      const mRepayments = repaymentsByDateAndMember.get(`${dateStr}__${m.id}`) ?? [];
      const mRepayment = mRepayments.reduce((sum, r) => sum + r.amountPaid, 0);
      const mPrincipalRepaid = mRepayments.reduce((sum, r) => sum + r.principalDeducted, 0);

      // Running cumulative per member
      const prevSavings = memberSavingsBalance.get(m.id) ?? 0;
      const newSavings = prevSavings + memberDeposit;
      memberSavingsBalance.set(m.id, newSavings);

      const prevLoan = memberLoanBalance.get(m.id) ?? 0;
      const newLoan = Math.max(0, prevLoan + mLoanDisbursed - mPrincipalRepaid);
      memberLoanBalance.set(m.id, newLoan);

      // Determine approval status for this member's week
      let isMemberApproved = true;
      if (dep) {
        if (dep.approvalStatus === 'pending') {
          if (it?.approvalStatus === 'approved') {
            isMemberApproved = true;
          } else {
            isMemberApproved = false;
          }
        } else if (dep.approvalStatus === 'rejected') {
          isMemberApproved = false;
        }
      }
      if (mLoans.some((l) => l.approvalStatus === 'pending')) isMemberApproved = false;
      if (mRepayments.some((r) => r.approvalStatus === 'pending')) isMemberApproved = false;

      if (isMemberApproved) {
        weekApprovedMembers += 1;
      }

      weekTotalDeposit += memberDeposit;
      weekTotalStamps += memberStamps;
      weekLoanDisbursed += mLoanDisbursed;
      weekRepayment += mRepayment;
      weekPrincipalRepaid += mPrincipalRepaid;

      const memberRecord = {
        weekNo,
        date: dateStr,
        displayDate,
        memberId: m.id,
        memberName: m.name,
        hhNo: m.hhNo,
        totalDeposit: memberDeposit,
        noOfStamps: memberStamps,
        loanDisbursed: mLoanDisbursed,
        repayment: mRepayment,
        balanceAmount: newSavings,
        outstandingAmount: newLoan,
        approvalStatus: isMemberApproved ? ('approved' as const) : ('pending' as const),
        depositId: dep?.id || null,
        depositItemId: (it as any)?.id || null,
        loanIds: mLoans.map((l) => l.id),
        repaymentIds: mRepayments.map((r) => r.id),
      };

      memberHistories[m.id].push({
        weekNo,
        date: dateStr,
        displayDate,
        totalDeposit: memberDeposit,
        noOfStamps: memberStamps,
        loanDisbursed: mLoanDisbursed,
        repayment: mRepayment,
        balanceAmount: newSavings,
        outstandingAmount: newLoan,
        approvalStatus: isMemberApproved ? 'approved' : 'pending',
      });

      return memberRecord;
    });

    runningBoxAmount += weekTotalDeposit + weekRepayment - weekLoanDisbursed;
    runningOutstandingLoan = Math.max(0, runningOutstandingLoan + weekLoanDisbursed - weekPrincipalRepaid);

    const isCurrentWeek = idx === sortedDates.length - 1;
    const isWeekFullyApproved = totalMembers > 0 && weekApprovedMembers === totalMembers;

    return {
      weekNo,
      weekIndex: idx + 1,
      date: dateStr,
      displayDate,
      totalDeposit: weekTotalDeposit,
      noOfStamps: weekTotalStamps,
      loanDisbursed: weekLoanDisbursed,
      repayment: weekRepayment,
      boxAmount: runningBoxAmount,
      outstandingAmount: runningOutstandingLoan,
      approvedCount: weekApprovedMembers,
      totalCount: totalMembers,
      approvalRatio: `${weekApprovedMembers}/${totalMembers}`,
      approvalStatus: isWeekFullyApproved ? ('approved' as const) : ('pending' as const),
      isCurrentWeek,
      depositId: dep?.id || null,
      members: memberDetails,
    };
  });

  return {
    shg: {
      id: group.id,
      name: group.name,
      hindiName: group.hindiName,
      state: group.state,
      district: group.district,
      block: group.block,
      panchayat: group.panchayat,
      village: group.village,
      stampValue: group.stampValue,
      meetingDay: group.meetingDay,
      maxStampsPerMember: group.maxStampsPerMember,
      maxLoanAmount: group.maxLoanAmount,
      approvalRequired: group.approvalRequired,
    },
    totalMembers,
    currentBoxAmount: runningBoxAmount,
    currentOutstandingAmount: runningOutstandingLoan,
    weeks,
    memberHistories,
  };
}

/**
 * Approve or Reject an individual member's record in a specific week.
 */
export async function approveMemberWeekly(
  tx: Db,
  adminUserId: string,
  input: { groupId: string; weekDate: string; memberId: string; action: 'approve' | 'reject' },
) {
  const newStatus = input.action === 'approve' ? ('approved' as const) : ('rejected' as const);
  const now = new Date();

  // 1. If deposit exists on that week, update the member's depositItem
  const [dep] = await tx
    .select()
    .from(deposits)
    .where(and(eq(deposits.groupId, input.groupId), eq(deposits.date, input.weekDate)))
    .limit(1);

  if (dep) {
    await tx
      .update(depositItems)
      .set({
        approvalStatus: newStatus,
        approvedBy: adminUserId,
        approvedAt: now,
      })
      .where(and(eq(depositItems.depositId, dep.id), eq(depositItems.memberId, input.memberId)));

    // Check if all items for this deposit are now approved
    const allItems = await tx.select().from(depositItems).where(eq(depositItems.depositId, dep.id));
    const allApproved = allItems.length > 0 && allItems.every((it) => it.approvalStatus === 'approved');
    if (allApproved) {
      await tx
        .update(deposits)
        .set({ approvalStatus: 'approved', approvedBy: adminUserId, approvedAt: now })
        .where(eq(deposits.id, dep.id));
    }
  }

  // 2. Loans for this member on that week
  await tx
    .update(loans)
    .set({ approvalStatus: newStatus, approvedBy: adminUserId, approvedAt: now })
    .where(and(eq(loans.groupId, input.groupId), eq(loans.memberId, input.memberId), eq(loans.date, input.weekDate)));

  // 3. Repayments for this member on that week
  await tx
    .update(repayments)
    .set({ approvalStatus: newStatus, approvedBy: adminUserId, approvedAt: now })
    .where(
      and(
        eq(repayments.groupId, input.groupId),
        eq(repayments.memberId, input.memberId),
        eq(repayments.date, input.weekDate),
      ),
    );

  return { ok: true, groupId: input.groupId, weekDate: input.weekDate, memberId: input.memberId, status: newStatus };
}

/**
 * Approves all transactions for all members in a given week.
 */
export async function approveWeekAll(
  tx: Db,
  adminUserId: string,
  input: { groupId: string; weekDate: string; action: 'approve' | 'reject' },
) {
  const newStatus = input.action === 'approve' ? ('approved' as const) : ('rejected' as const);
  const now = new Date();

  // 1. Deposits & deposit items
  const deps = await tx
    .select()
    .from(deposits)
    .where(and(eq(deposits.groupId, input.groupId), eq(deposits.date, input.weekDate)));

  for (const dep of deps) {
    await tx
      .update(deposits)
      .set({ approvalStatus: newStatus, approvedBy: adminUserId, approvedAt: now })
      .where(eq(deposits.id, dep.id));

    await tx
      .update(depositItems)
      .set({ approvalStatus: newStatus, approvedBy: adminUserId, approvedAt: now })
      .where(eq(depositItems.depositId, dep.id));
  }

  // 2. Loans
  await tx
    .update(loans)
    .set({ approvalStatus: newStatus, approvedBy: adminUserId, approvedAt: now })
    .where(and(eq(loans.groupId, input.groupId), eq(loans.date, input.weekDate)));

  // 3. Repayments
  await tx
    .update(repayments)
    .set({ approvalStatus: newStatus, approvedBy: adminUserId, approvedAt: now })
    .where(and(eq(repayments.groupId, input.groupId), eq(repayments.date, input.weekDate)));

  return { ok: true, groupId: input.groupId, weekDate: input.weekDate, status: newStatus };
}

/**
 * Edits an individual member's weekly figures (deposit stamps, loan, repayment).
 */
export async function editMemberWeekly(
  tx: Db,
  adminUserId: string,
  input: {
    groupId: string;
    weekDate: string;
    memberId: string;
    stamps?: number;
    depositAmount?: number;
    loanDisbursed?: number;
    repayment?: number;
    autoApprove?: boolean;
  },
) {
  const [group] = await tx.select().from(groups).where(eq(groups.id, input.groupId)).limit(1);
  if (!group) throw notFound('SHG Group');

  const now = new Date();

  // 1. Find or create deposit on weekDate
  const [dep] = await tx
    .select()
    .from(deposits)
    .where(and(eq(deposits.groupId, input.groupId), eq(deposits.date, input.weekDate)))
    .limit(1);

  if (input.stamps !== undefined) {
    const stamps = Math.max(0, Number(input.stamps));
    const amount = input.depositAmount !== undefined ? Number(input.depositAmount) : stamps * group.stampValue;

    if (dep) {
      const [existingItem] = await tx
        .select()
        .from(depositItems)
        .where(and(eq(depositItems.depositId, dep.id), eq(depositItems.memberId, input.memberId)))
        .limit(1);

      if (existingItem) {
        await tx
          .update(depositItems)
          .set({
            stamps,
            amount,
            approvalStatus: input.autoApprove ? 'approved' : existingItem.approvalStatus,
            approvedBy: input.autoApprove ? adminUserId : existingItem.approvedBy,
            approvedAt: input.autoApprove ? now : existingItem.approvedAt,
          })
          .where(eq(depositItems.id, existingItem.id));
      } else if (stamps > 0) {
        await tx.insert(depositItems).values({
          depositId: dep.id,
          memberId: input.memberId,
          stamps,
          amount,
          approvalStatus: input.autoApprove ? 'approved' : 'pending',
          approvedBy: input.autoApprove ? adminUserId : null,
          approvedAt: input.autoApprove ? now : null,
        });
      }

      // Recalculate deposit totals
      const allItems = await tx.select().from(depositItems).where(eq(depositItems.depositId, dep.id));
      const newTotalStamps = allItems.reduce((sum, it) => sum + it.stamps, 0);
      const newTotalAmount = allItems.reduce((sum, it) => sum + it.amount, 0);
      const allApproved = allItems.length > 0 && allItems.every((it) => it.approvalStatus === 'approved');

      await tx
        .update(deposits)
        .set({
          totalStamps: newTotalStamps,
          totalAmount: newTotalAmount,
          approvalStatus: allApproved ? 'approved' : dep.approvalStatus,
        })
        .where(eq(deposits.id, dep.id));
    }
  }

  // 2. If loan amount is provided, update loan
  if (input.loanDisbursed !== undefined) {
    const [loan] = await tx
      .select()
      .from(loans)
      .where(and(eq(loans.groupId, input.groupId), eq(loans.memberId, input.memberId), eq(loans.date, input.weekDate)))
      .limit(1);

    if (loan) {
      await tx
        .update(loans)
        .set({
          principalAmount: Number(input.loanDisbursed),
          approvalStatus: input.autoApprove ? 'approved' : loan.approvalStatus,
          updatedAt: now,
        })
        .where(eq(loans.id, loan.id));
    }
  }

  // 3. If repayment is provided, update repayment
  if (input.repayment !== undefined) {
    const [rep] = await tx
      .select()
      .from(repayments)
      .where(
        and(
          eq(repayments.groupId, input.groupId),
          eq(repayments.memberId, input.memberId),
          eq(repayments.date, input.weekDate),
        ),
      )
      .limit(1);

    if (rep) {
      await tx
        .update(repayments)
        .set({
          amountPaid: Number(input.repayment),
          principalDeducted: Number(input.repayment),
          approvalStatus: input.autoApprove ? 'approved' : rep.approvalStatus,
        })
        .where(eq(repayments.id, rep.id));
    }
  }

  return { ok: true, groupId: input.groupId, weekDate: input.weekDate, memberId: input.memberId };
}
