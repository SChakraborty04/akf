import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { groups, refreshTokens, systemSettings, users } from '../../db/schema';
import { notFound, unprocessable } from '../../lib/errors';
import { hashPassword } from '../../lib/password';

export type CreateUserInput = {
  username: string;
  password: string;
  fullName: string;
  role: 'super_admin' | 'admin' | 'operator' | 'viewer';
  groupId?: string | null;
  language?: 'en' | 'hi';
};

export type UpdateUserInput = {
  fullName?: string;
  role?: 'super_admin' | 'admin' | 'operator' | 'viewer';
  groupId?: string | null;
  isActive?: boolean;
  unlockAccount?: boolean;
};

/**
 * Retrieves comprehensive settings: interest rates, validation rules, access control matrix.
 */
export async function getAdminSettings(db: Db) {
  const rows = await db.select().from(systemSettings);
  const settingsMap = new Map(rows.map((r) => [r.key, r.value]));

  const monthlyRate = settingsMap.get('global_interest_rate') ?? '0.0200';
  const defaultStampValue = Number(settingsMap.get('default_stamp_value')) || 50;
  const maxLoanAmount = Number(settingsMap.get('default_max_loan_amount')) || 50000;
  const maxStamps = Number(settingsMap.get('default_max_stamps_per_meeting')) || 5;
  const requireApproval = (settingsMap.get('require_transaction_approval') ?? 'true') === 'true';
  const allowViewerExport = (settingsMap.get('access_control_allow_viewer_export') ?? 'true') === 'true';
  const enforcePasswordExpiry = (settingsMap.get('access_control_enforce_password_expiry') ?? 'false') === 'true';

  return {
    rawSettings: rows,
    rateOfInterest: {
      monthlyRate,
      percentage: (Number(monthlyRate) * 100).toFixed(1) + '%',
      annualRate: (Number(monthlyRate) * 12 * 100).toFixed(1) + '%',
      description: 'Simple interest calculated monthly on original principal disbursed',
    },
    validationRules: {
      defaultStampValue,
      maxLoanAmount,
      maxStampsPerMeeting: maxStamps,
      requireApproval,
      description: 'Global threshold defaults applied to newly registered SHGs',
    },
    accessControl: {
      allowViewerExport,
      enforcePasswordExpiry,
      roles: [
        {
          role: 'super_admin',
          label: 'Super Administrator',
          description: 'Full system control, cross-SHG access, rule updates, user provisioning',
          canApprove: true,
          canEditSettings: true,
          canManageUsers: true,
        },
        {
          role: 'admin',
          label: 'Regional Administrator',
          description: 'Approval of transactions, SHG monitoring, and reporting within jurisdiction',
          canApprove: true,
          canEditSettings: false,
          canManageUsers: false,
        },
        {
          role: 'operator',
          label: 'SHG Operator',
          description: 'Field operator recording meeting savings deposits, loans, repayments',
          canApprove: false,
          canEditSettings: false,
          canManageUsers: false,
        },
        {
          role: 'viewer',
          label: 'Auditor / Viewer',
          description: 'Read-only access to SHG ledger, passbook, and dashboards',
          canApprove: false,
          canEditSettings: false,
          canManageUsers: false,
        },
      ],
    },
  };
}

/**
 * Updates system setting key-values atomically.
 */
export async function updateAdminSettings(tx: Db, patch: Record<string, string>) {
  for (const [key, value] of Object.entries(patch)) {
    const [existing] = await tx.select({ id: systemSettings.id }).from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
    if (existing) {
      await tx.update(systemSettings).set({ value: String(value), updatedAt: new Date() }).where(eq(systemSettings.key, key));
    } else {
      await tx.insert(systemSettings).values({
        key,
        value: String(value),
        category: 'general',
      });
    }
  }

  return getAdminSettings(tx);
}

/**
 * Lists all users across the platform with group details and lock status.
 */
export async function listAdminUsers(db: Db, filters: { role?: string; groupId?: string } = {}) {
  const conds = [];
  if (filters.role) conds.push(eq(users.role, filters.role as any));
  if (filters.groupId) conds.push(eq(users.groupId, filters.groupId));

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      language: users.language,
      isActive: users.isActive,
      groupId: users.groupId,
      groupName: groups.name,
      failedLoginCount: users.failedLoginCount,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(groups, eq(groups.id, users.groupId))
    .where(whereClause)
    .orderBy(desc(users.createdAt));

  const now = new Date();
  return rows.map((r) => ({
    ...r,
    isLocked: !!(r.lockedUntil && r.lockedUntil > now),
  }));
}

/**
 * Provisions a new user in the platform.
 */
export async function createAdminUser(tx: Db, input: CreateUserInput) {
  const normalizedUsername = input.username.trim().toLowerCase();
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.username, normalizedUsername)).limit(1);
  if (existing) {
    throw unprocessable('Username already in use', 'USERNAME_TAKEN', { username: normalizedUsername });
  }

  const passwordHash = await hashPassword(input.password);
  const [user] = await tx
    .insert(users)
    .values({
      groupId: input.groupId || null,
      username: normalizedUsername,
      passwordHash,
      fullName: input.fullName.trim(),
      role: input.role,
      language: input.language ?? 'en',
    })
    .returning();

  return user;
}

/**
 * Updates a user's details, unlocks an account, or deactivates.
 */
export async function updateAdminUser(tx: Db, userId: string, patch: UpdateUserInput) {
  const updateData: Record<string, any> = {};
  if (patch.fullName !== undefined) updateData.fullName = patch.fullName.trim();
  if (patch.role !== undefined) updateData.role = patch.role;
  if (patch.groupId !== undefined) updateData.groupId = patch.groupId || null;
  if (patch.isActive !== undefined) updateData.isActive = patch.isActive;
  if (patch.unlockAccount) {
    updateData.lockedUntil = null;
    updateData.failedLoginCount = 0;
  }

  const [user] = await tx.update(users).set(updateData).where(eq(users.id, userId)).returning();
  if (!user) throw notFound('User');
  return user;
}

/**
 * Admin password reset for any user.
 */
export async function resetAdminUserPassword(tx: Db, userId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  const [user] = await tx
    .update(users)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
      lockedUntil: null,
      failedLoginCount: 0,
    })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw notFound('User');

  // Revoke active sessions
  await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, userId));

  return { ok: true, userId: user.id, username: user.username };
}
