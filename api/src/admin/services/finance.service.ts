import { and, desc, eq, gte, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
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
