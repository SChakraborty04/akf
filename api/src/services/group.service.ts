import { and, asc, count, desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { cycles, groups, loanShapes, members } from '../db/schema';
import { currentCycleWeek } from '../lib/dates';
import { notFound } from '../lib/errors';
import { repaymentStampValue } from '../lib/interest';

export type GroupRow = typeof groups.$inferSelect;
export type CycleRow = typeof cycles.$inferSelect;
export type ShapeRow = typeof loanShapes.$inferSelect;

export async function getGroupRow(db: Db, groupId: string): Promise<GroupRow> {
  const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  if (!group) throw notFound('Group');
  return group;
}

export async function getCurrentCycle(db: Db, groupId: string): Promise<CycleRow | null> {
  const [current] = await db
    .select()
    .from(cycles)
    .where(and(eq(cycles.groupId, groupId), eq(cycles.isCurrent, true)))
    .limit(1);
  if (current) return current;
  // Fallback: most recent cycle if none is flagged current.
  const [latest] = await db.select().from(cycles).where(eq(cycles.groupId, groupId)).orderBy(desc(cycles.cycleNo)).limit(1);
  return latest ?? null;
}

export function serializeCycle(cycle: CycleRow | null, today: string) {
  if (!cycle) return null;
  return {
    id: cycle.id,
    cycleNo: cycle.cycleNo,
    startDate: cycle.startDate,
    endDate: cycle.endDate,
    durationWeeks: cycle.durationWeeks,
    currentWeek: currentCycleWeek(cycle.startDate, cycle.durationWeeks, today),
    isCurrent: cycle.isCurrent,
  };
}

/**
 * Group profile. Top-level keys mirror the PWA's `groupProfile`
 * (name, hindiName, address, memberCount, stampValue, cycleNo, cycleStart,
 * cycleEnd, cycleWeek, meetingDay) so the Profile page can bind to it as-is.
 */
export async function getGroupProfile(db: Db, groupId: string, today: string) {
  const group = await getGroupRow(db, groupId);
  const cycle = await getCurrentCycle(db, groupId);
  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.isActive, true)));

  return {
    id: group.id,
    name: group.name,
    hindiName: group.hindiName,
    address: group.address,
    memberCount,
    stampValue: group.stampValue,
    maxStampsPerMember: group.maxStampsPerMember,
    monthlyInterestRate: Number(group.monthlyInterestRate),
    repaymentStampRate: Number(group.repaymentStampRate),
    meetingDay: group.meetingDay,
    cycleNo: cycle?.cycleNo ?? null,
    cycleStart: cycle?.startDate ?? null,
    cycleEnd: cycle?.endDate ?? null,
    cycleWeek: cycle?.durationWeeks ?? null,
    cycle: serializeCycle(cycle, today),
  };
}

export async function listShapeRows(db: Db, groupId: string, opts: { includeInactive?: boolean } = {}) {
  return db
    .select()
    .from(loanShapes)
    .where(
      opts.includeInactive
        ? eq(loanShapes.groupId, groupId)
        : and(eq(loanShapes.groupId, groupId), eq(loanShapes.isActive, true)),
    )
    .orderBy(asc(loanShapes.sortOrder), asc(loanShapes.value));
}

/**
 * `id`/`symbol` are the stable shape code ('sun'), matching the PWA's
 * loanShapes; `value` is the loan face value; `repaymentValue` is what the same
 * stamp is worth when paying back (face value x group repayment rate).
 */
export function serializeShape(shape: ShapeRow, repaymentValue: number) {
  return {
    id: shape.code,
    code: shape.code,
    name: shape.name,
    symbol: shape.code,
    value: shape.value,
    repaymentValue,
    color: shape.color,
  };
}

/** Active shapes in display order with their loan and repayment values. */
export async function getShapes(db: Db, groupId: string) {
  const [group, rows] = await Promise.all([getGroupRow(db, groupId), listShapeRows(db, groupId)]);
  return rows.map((s) => serializeShape(s, repaymentStampValue(s.value, group.repaymentStampRate)));
}
