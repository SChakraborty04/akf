import { and, count, desc, eq, exists, gte, inArray, lte, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { depositItems, deposits, members } from '../db/schema';
import { assertDateAllowed } from '../lib/dates';
import { notFound, unprocessable } from '../lib/errors';
import { offsetOf, pageMeta, type PageQuery } from '../lib/pagination';
import { getCurrentCycle, getGroupRow } from './group.service';
import { insertLedgerEntries } from './ledger.service';

export type DepositFilters = { from?: string; to?: string; memberId?: string };

export type CreateDepositInput = {
  date?: string;
  note?: string;
  clientId?: string;
  items: { memberId: string; stamps: number }[];
};

export type WriteCtx = { groupId: string; userId: string; today: string };

type DepositRow = typeof deposits.$inferSelect;

function where(groupId: string, f: DepositFilters): SQL {
  const conds: (SQL | undefined)[] = [eq(deposits.groupId, groupId)];
  if (f.from) conds.push(gte(deposits.date, f.from));
  if (f.to) conds.push(lte(deposits.date, f.to));
  if (f.memberId) {
    conds.push(
      exists(
        sql`(select 1 from ${depositItems} where ${depositItems.depositId} = ${deposits.id} and ${depositItems.memberId} = ${f.memberId})`,
      ),
    );
  }
  return and(...conds)!;
}

async function loadItems(db: Db, depositIds: string[]) {
  const map = new Map<string, { memberId: string; memberName: string; hhNo: string; stamps: number; amount: number; approvalStatus: string }[]>();
  if (depositIds.length === 0) return map;
  const rows = await db
    .select({
      depositId: depositItems.depositId,
      memberId: depositItems.memberId,
      memberName: members.name,
      hhNo: members.hhNo,
      stamps: depositItems.stamps,
      amount: depositItems.amount,
      approvalStatus: depositItems.approvalStatus,
    })
    .from(depositItems)
    .innerJoin(members, eq(members.id, depositItems.memberId))
    .where(inArray(depositItems.depositId, depositIds))
    .orderBy(members.hhNo);
  for (const { depositId, ...item } of rows) {
    const list = map.get(depositId) ?? [];
    list.push(item);
    map.set(depositId, list);
  }
  return map;
}

/**
 * PWA deposit shape: `amount` is the meeting total, `memberDeposits` the
 * per-member breakdown. When filtered by member, `memberAmount`/`memberStamps`
 * carry that member's own contribution (what the PWA shows on the card).
 */
function serialize(row: DepositRow, items: Awaited<ReturnType<typeof loadItems>> extends Map<string, infer V> ? V : never, memberId?: string) {
  const mine = memberId ? items.find((i) => i.memberId === memberId) : undefined;
  return {
    id: row.id,
    clientId: row.clientId,
    date: row.date,
    note: row.note,
    totalStamps: row.totalStamps,
    stampValue: row.stampValue,
    amount: row.totalAmount,
    approvalStatus: row.approvalStatus,
    memberDeposits: items,
    ...(memberId ? { memberAmount: mine?.amount ?? 0, memberStamps: mine?.stamps ?? 0 } : {}),
    createdAt: row.createdAt,
  };
}

/** Pass `page` = undefined to return every deposit (offline snapshot). */
export async function listDeposits(db: Db, groupId: string, filters: DepositFilters, page?: PageQuery) {
  const w = where(groupId, filters);
  const base = db.select().from(deposits).where(w).orderBy(desc(deposits.date), desc(deposits.createdAt));

  const [rows, [{ value: total }], [sum]] = await Promise.all([
    page ? base.limit(page.limit).offset(offsetOf(page)) : base,
    db.select({ value: count() }).from(deposits).where(w),
    // Matches the PWA's "Total Deposits" banner: member-specific when a member is selected.
    filters.memberId
      ? db
          .select({ amount: sql<number>`coalesce(sum(${depositItems.amount}), 0)::int`, stamps: sql<number>`coalesce(sum(${depositItems.stamps}), 0)::int` })
          .from(depositItems)
          .innerJoin(deposits, eq(deposits.id, depositItems.depositId))
          .where(and(w, eq(depositItems.memberId, filters.memberId)))
      : db
          .select({ amount: sql<number>`coalesce(sum(${deposits.totalAmount}), 0)::int`, stamps: sql<number>`coalesce(sum(${deposits.totalStamps}), 0)::int` })
          .from(deposits)
          .where(w),
  ]);

  const items = await loadItems(db, rows.map((r) => r.id));
  return {
    items: rows.map((r) => serialize(r, items.get(r.id) ?? [], filters.memberId)),
    summary: { totalAmount: sum.amount, totalStamps: sum.stamps },
    meta: page ? pageMeta(page.page, page.limit, total) : { total },
  };
}

export async function getDeposit(db: Db, groupId: string, id: string) {
  const [row] = await db.select().from(deposits).where(and(eq(deposits.groupId, groupId), eq(deposits.id, id))).limit(1);
  if (!row) throw notFound('Deposit');
  const items = await loadItems(db, [row.id]);
  return serialize(row, items.get(row.id) ?? []);
}

export async function findDepositByClientId(db: Db, groupId: string, clientId: string) {
  const [row] = await db
    .select({ id: deposits.id })
    .from(deposits)
    .where(and(eq(deposits.groupId, groupId), eq(deposits.clientId, clientId)))
    .limit(1);
  return row ? getDeposit(db, groupId, row.id) : null;
}

/**
 * Record one meeting's savings. Amounts are computed server-side
 * (stamps x group stamp value); clients only send stamp counts.
 * Members with 0 stamps are accepted and simply skipped.
 * Idempotent per `clientId`. Run inside a transaction.
 */
export async function createDeposit(tx: Db, ctx: WriteCtx, input: CreateDepositInput) {
  if (input.clientId) {
    const existing = await findDepositByClientId(tx, ctx.groupId, input.clientId);
    if (existing) return { deposit: existing, created: false };
  }

  const date = input.date ?? ctx.today;
  assertDateAllowed(date, ctx.today);

  const group = await getGroupRow(tx, ctx.groupId);

  const seen = new Set<string>();
  for (const item of input.items) {
    if (seen.has(item.memberId)) throw unprocessable('A member appears more than once', 'DUPLICATE_MEMBER', { memberId: item.memberId });
    seen.add(item.memberId);
  }

  const contributing = input.items.filter((i) => i.stamps > 0);
  if (contributing.length === 0) throw unprocessable('Assign at least 1 stamp to one or more members', 'NO_STAMPS');

  const overLimit = contributing.filter((i) => i.stamps > group.maxStampsPerMember);
  if (overLimit.length > 0) {
    throw unprocessable(`A member can deposit at most ${group.maxStampsPerMember} stamps per meeting`, 'STAMP_LIMIT_EXCEEDED', {
      max: group.maxStampsPerMember,
      memberIds: overLimit.map((i) => i.memberId),
    });
  }

  const memberRows = await tx
    .select({ id: members.id, name: members.name })
    .from(members)
    .where(and(eq(members.groupId, ctx.groupId), eq(members.isActive, true), inArray(members.id, contributing.map((i) => i.memberId))));
  const nameById = new Map(memberRows.map((m) => [m.id, m.name]));
  const unknown = contributing.filter((i) => !nameById.has(i.memberId));
  if (unknown.length > 0) {
    throw unprocessable('Unknown or inactive member', 'INVALID_MEMBER', { memberIds: unknown.map((i) => i.memberId) });
  }

  const totalStamps = contributing.reduce((s, i) => s + i.stamps, 0);
  const cycle = await getCurrentCycle(tx, ctx.groupId);

  const [deposit] = await tx
    .insert(deposits)
    .values({
      groupId: ctx.groupId,
      cycleId: cycle?.id ?? null,
      clientId: input.clientId ?? null,
      date,
      note: input.note?.trim() || 'Meeting Member Savings',
      totalStamps,
      stampValue: group.stampValue,
      totalAmount: totalStamps * group.stampValue,
      approvalStatus: group.approvalRequired ? 'pending' : 'approved',
      createdBy: ctx.userId,
    })
    .returning();

  await tx.insert(depositItems).values(
    contributing.map((i) => ({
      depositId: deposit.id,
      memberId: i.memberId,
      stamps: i.stamps,
      amount: i.stamps * group.stampValue,
      approvalStatus: group.approvalRequired ? ('pending' as const) : ('approved' as const),
    })),
  );

  await insertLedgerEntries(
    tx,
    contributing.map((i) => ({
      groupId: ctx.groupId,
      type: 'deposit' as const,
      amount: i.stamps * group.stampValue,
      date,
      memberId: i.memberId,
      depositId: deposit.id,
      stamps: i.stamps,
      description: `Deposit - ${nameById.get(i.memberId)} (${i.stamps} ${i.stamps === 1 ? 'stamp' : 'stamps'})`,
    })),
  );

  return { deposit: await getDeposit(tx, ctx.groupId, deposit.id), created: true };
}
