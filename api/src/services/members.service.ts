import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { depositItems, deposits, loans, members, repayments } from '../db/schema';
import { notFound } from '../lib/errors';

export type MemberRow = typeof members.$inferSelect;

const formatAcres = (value: string | null): string | null => {
  if (value === null) return null;
  const n = Number(value);
  return `${n.toFixed(1)} ${n === 1 ? 'Acre' : 'Acres'}`;
};

/**
 * Member shape. Field names match the PWA's member objects. `agriLand` /
 * `irrigatedLand` keep the PWA's display strings ("1.5 Acres"); the numeric
 * values are exposed as `*Acres`. `idNo` (government ID) is only included on the
 * detail route.
 */
export function serializeMember(m: MemberRow, opts: { includeIdNo?: boolean } = {}) {
  return {
    id: m.id,
    hhNo: m.hhNo,
    name: m.name,
    husbandName: m.husbandName,
    ...(opts.includeIdNo ? { idNo: m.idNo } : {}),
    age: m.age,
    caste: m.caste,
    mobileNo: m.mobileNo,
    education: m.education,
    agriLand: formatAcres(m.agriLandAcres),
    irrigatedLand: formatAcres(m.irrigatedLandAcres),
    agriLandAcres: m.agriLandAcres === null ? null : Number(m.agriLandAcres),
    irrigatedLandAcres: m.irrigatedLandAcres === null ? null : Number(m.irrigatedLandAcres),
    goatCount: m.goatCount,
    animalCount: m.animalCount,
    familySize: m.familySize,
    incomeSource: m.incomeSource,
    isActive: m.isActive,
    joinedOn: m.joinedOn,
  };
}

export async function listMembers(db: Db, groupId: string, opts: { includeInactive?: boolean } = {}) {
  const rows = await db
    .select()
    .from(members)
    .where(opts.includeInactive ? eq(members.groupId, groupId) : and(eq(members.groupId, groupId), eq(members.isActive, true)))
    .orderBy(asc(members.hhNo));
  return rows.map((m) => serializeMember(m));
}

/** Member profile + the 3-number financial overview of the PWA's MemberDetailModal. */
export async function getMemberDetail(db: Db, groupId: string, memberId: string) {
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.groupId, groupId), eq(members.id, memberId)))
    .limit(1);
  if (!member) throw notFound('Member');

  const [[savings], [loan], [repaid]] = await Promise.all([
    db
      .select({ value: sql<number>`coalesce(sum(${depositItems.amount}), 0)::int` })
      .from(depositItems)
      .innerJoin(deposits, eq(deposits.id, depositItems.depositId))
      .where(and(eq(deposits.groupId, groupId), eq(depositItems.memberId, memberId))),
    db
      .select({
        activePrincipal: sql<number>`coalesce(sum(${loans.principalAmount}) filter (where ${loans.status} = 'active'), 0)::int`,
        activeCount: sql<number>`count(*) filter (where ${loans.status} = 'active')::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(loans)
      .where(and(eq(loans.groupId, groupId), eq(loans.memberId, memberId))),
    db
      .select({ value: sql<number>`coalesce(sum(${repayments.amountPaid}), 0)::int` })
      .from(repayments)
      .where(and(eq(repayments.groupId, groupId), eq(repayments.memberId, memberId))),
  ]);

  return {
    ...serializeMember(member, { includeIdNo: true }),
    overview: {
      totalSavings: savings.value,
      activeLoanPrincipal: loan.activePrincipal,
      activeLoanCount: loan.activeCount,
      totalLoanCount: loan.totalCount,
      totalRepaid: repaid.value,
    },
  };
}
