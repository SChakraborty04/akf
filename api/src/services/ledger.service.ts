import { and, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { ledgerEntries, members } from '../db/schema';
import { offsetOf, pageMeta, type PageQuery } from '../lib/pagination';

export type LedgerInsert = typeof ledgerEntries.$inferInsert;

/** Insert ledger rows (call inside the same transaction as the business write). */
export async function insertLedgerEntries(db: Db, rows: LedgerInsert[]) {
  if (rows.length === 0) return;
  await db.insert(ledgerEntries).values(rows);
}

export type LedgerFilters = {
  type?: 'deposit' | 'loan' | 'repayment';
  memberId?: string;
  from?: string;
  to?: string;
};

function where(groupId: string, f: LedgerFilters): SQL {
  const conds: (SQL | undefined)[] = [eq(ledgerEntries.groupId, groupId)];
  if (f.type) conds.push(eq(ledgerEntries.type, f.type));
  if (f.memberId) conds.push(eq(ledgerEntries.memberId, f.memberId));
  if (f.from) conds.push(gte(ledgerEntries.date, f.from));
  if (f.to) conds.push(lte(ledgerEntries.date, f.to));
  return and(...conds)!;
}

/**
 * Ledger feed, newest first. `totals` follow the active filters exactly like
 * the PWA's Credit/Debit cards: credit = deposits + repayments, debit = loans.
 * Pass `page` = undefined to fetch everything (used by the offline snapshot).
 */
export async function listLedger(db: Db, groupId: string, filters: LedgerFilters, page?: PageQuery) {
  const w = where(groupId, filters);

  const base = db
    .select({
      id: ledgerEntries.id,
      type: ledgerEntries.type,
      amount: ledgerEntries.amount,
      date: ledgerEntries.date,
      memberId: ledgerEntries.memberId,
      memberName: members.name,
      depositId: ledgerEntries.depositId,
      loanId: ledgerEntries.loanId,
      repaymentId: ledgerEntries.repaymentId,
      stamps: ledgerEntries.stamps,
      description: ledgerEntries.description,
      createdAt: ledgerEntries.createdAt,
    })
    .from(ledgerEntries)
    .leftJoin(members, eq(members.id, ledgerEntries.memberId))
    .where(w)
    .orderBy(desc(ledgerEntries.date), desc(ledgerEntries.createdAt), desc(ledgerEntries.id));

  const [items, [totals], [{ value: total }]] = await Promise.all([
    page ? base.limit(page.limit).offset(offsetOf(page)) : base,
    db
      .select({
        credit: sql<number>`coalesce(sum(case when ${ledgerEntries.type} in ('deposit','repayment') then ${ledgerEntries.amount} else 0 end), 0)::int`,
        debit: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'loan' then ${ledgerEntries.amount} else 0 end), 0)::int`,
      })
      .from(ledgerEntries)
      .where(w),
    db.select({ value: count() }).from(ledgerEntries).where(w),
  ]);

  return {
    items,
    totals: { credit: totals.credit, debit: totals.debit },
    meta: page ? pageMeta(page.page, page.limit, total) : { total },
  };
}
