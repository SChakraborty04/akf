import { Hono } from 'hono';
import { count, desc, eq, sql } from 'drizzle-orm';
import { deposits, groups, loans, members } from '../db/schema';
import type { AppEnv } from '../env';
import { created, ok } from '../lib/http';
import { AppError, unauthorized, unprocessable } from '../lib/errors';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { changePassword, login } from '../services/auth.service';
import {
  addMemberToGroup,
  bulkImportMembers,
  createAdminGroup,
  getAdminGroupDetail,
  listAdminGroups,
  listLocations,
  updateAdminGroup,
} from './services/shg.service';
import {
  approveMemberWeekly,
  approveTransaction,
  approveWeekAll,
  editMemberWeekly,
  editPendingTransaction,
  getAdminLedger,
  getShgWeeklyFinance,
  listAdminTransactions,
} from './services/finance.service';
import {
  createAdminLocation,
  deleteAdminLocation,
  listAdminLocations,
  updateAdminLocation,
} from './services/location.service';
import {
  createAdminUser,
  getAdminSettings,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminSettings,
  updateAdminUser,
} from './services/settings.service';

export const adminRoutes = new Hono<AppEnv>();

/* -------------------------------------------------------------------------- */
/* Public Admin Routes                                                        */
/* -------------------------------------------------------------------------- */

adminRoutes.get('/health', (c) =>
  ok(c, {
    status: 'ready',
    module: 'admin-api',
    version: 'v1',
    description: 'Admin MIS API for SHG hierarchy, approval workflows, finance and settings',
  }),
);

/**
 * Admin login endpoint.
 */
adminRoutes.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string') {
    throw unprocessable('Username and password are required', 'INVALID_CREDENTIALS');
  }

  const secret = c.env.JWT_SECRET || 'lakshi-shg-super-secure-dev-jwt-secret-key-32chars';
  const result = await c.var.tx((tx) =>
    login(tx, secret, { username: body.username, password: body.password }, c.req.header('User-Agent') ?? null),
  );

  if (!result.ok) {
    if (result.reason === 'ACCOUNT_LOCKED') {
      return c.json(
        {
          success: false,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account is temporarily locked. Try again in ${result.retryAfterSeconds}s`,
          },
        },
        423,
      );
    }
    if (result.reason === 'ACCOUNT_DISABLED') {
      throw unauthorized('Account or associated SHG is deactivated', 'ACCOUNT_DISABLED');
    }
    throw unauthorized('Invalid username or password', 'INVALID_CREDENTIALS');
  }

  return ok(c, result.session);
});

/* -------------------------------------------------------------------------- */
/* Authenticated Admin Routes                                                 */
/* -------------------------------------------------------------------------- */

adminRoutes.use('*', requireAuth);

adminRoutes.get('/auth/me', (c) => ok(c, c.var.auth));

/**
 * Change current logged-in admin's password.
 */
adminRoutes.post('/auth/change-password', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.currentPassword || !body.newPassword) {
    throw unprocessable('Current password and new password are required', 'MISSING_FIELDS');
  }

  const result = await c.var.tx((tx) =>
    changePassword(tx, c.var.auth.userId, body.currentPassword, body.newPassword),
  );

  if (!result.ok) {
    throw new AppError(
      result.reason === 'WRONG_PASSWORD' ? 400 : 404,
      result.reason,
      result.reason === 'WRONG_PASSWORD' ? 'Current password is incorrect' : 'User not found',
    );
  }

  return ok(c, { passwordChanged: true });
});

/**
 * Home / Dashboard KPI Metrics
 */
adminRoutes.get('/dashboard', async (c) => {
  const db = c.var.db;

  const [groupStats] = await db
    .select({
      totalGroups: count(),
    })
    .from(groups)
    .where(eq(groups.isActive, true));

  const [memberStats] = await db
    .select({
      totalMembers: count(),
    })
    .from(members)
    .where(eq(members.isActive, true));

  const [depositStats] = await db
    .select({
      totalAmount: sql<number>`coalesce(sum(${deposits.totalAmount}), 0)::int`,
      pendingCount: sql<number>`coalesce(sum(case when ${deposits.approvalStatus} = 'pending' then 1 else 0 end), 0)::int`,
      pendingAmount: sql<number>`coalesce(sum(case when ${deposits.approvalStatus} = 'pending' then ${deposits.totalAmount} else 0 end), 0)::int`,
    })
    .from(deposits);

  const [loanStats] = await db
    .select({
      totalPrincipal: sql<number>`coalesce(sum(case when ${loans.status} = 'active' and ${loans.approvalStatus} = 'approved' then ${loans.principalAmount} else 0 end), 0)::int`,
      activeLoansCount: sql<number>`coalesce(sum(case when ${loans.status} = 'active' and ${loans.approvalStatus} = 'approved' then 1 else 0 end), 0)::int`,
      pendingCount: sql<number>`coalesce(sum(case when ${loans.approvalStatus} = 'pending' then 1 else 0 end), 0)::int`,
      pendingAmount: sql<number>`coalesce(sum(case when ${loans.approvalStatus} = 'pending' then ${loans.principalAmount} else 0 end), 0)::int`,
    })
    .from(loans);

  // Regional breakdown by District
  const districtDistribution = await db
    .select({
      district: groups.district,
      groupCount: count(),
    })
    .from(groups)
    .where(eq(groups.isActive, true))
    .groupBy(groups.district)
    .orderBy(desc(count()));

  return ok(c, {
    kpis: {
      totalGroups: groupStats.totalGroups,
      totalMembers: memberStats.totalMembers,
      totalActivePortfolio: loanStats.totalPrincipal,
      activeLoansCount: loanStats.activeLoansCount,
      totalSavingsCollected: depositStats.totalAmount,
      pendingApprovals: {
        totalCount: depositStats.pendingCount + loanStats.pendingCount,
        totalAmount: depositStats.pendingAmount + loanStats.pendingAmount,
        depositsCount: depositStats.pendingCount,
        loansCount: loanStats.pendingCount,
      },
    },
    districtDistribution,
  });
});

/**
 * Location Hierarchy for cascading dropdowns
 * State -> District -> Block -> Panchayat
 */
adminRoutes.get('/locations', async (c) => {
  const result = await listLocations(c.var.db);
  return ok(c, result);
});

/**
 * SHG List - Search by State / District / Block / Panchayat
 */
adminRoutes.get('/groups', async (c) => {
  const { state, district, block, panchayat, search, isActive } = c.req.query();
  const auth = c.var.auth;
  let accessibleGroupIds: string[] | undefined = undefined;
  if (auth.role === 'shg' || auth.role === 'operator') {
    accessibleGroupIds = auth.groupId ? [auth.groupId] : [];
  } else if (auth.role === 'do' && auth.assignedGroupIds && auth.assignedGroupIds.length > 0) {
    accessibleGroupIds = auth.assignedGroupIds;
  }

  const list = await listAdminGroups(c.var.db, {
    state,
    district,
    block,
    panchayat,
    search,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    accessibleGroupIds,
  });
  return ok(c, list);
});

adminRoutes.get('/groups/:id', async (c) => {
  const detail = await getAdminGroupDetail(c.var.db, c.req.param('id'));
  return ok(c, detail);
});

/* -------------------------------------------------------------------------- */
/* Master: SHG Creation, Members & Excel Upload                               */
/* -------------------------------------------------------------------------- */

/**
 * Create a new SHG with username and password
 */
adminRoutes.post('/master/shg', async (c) => {
  const rawBody = await c.req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== 'object') {
    throw unprocessable('Request body is required', 'MISSING_FIELDS');
  }

  // Support both nested structure ({ group, operator, cycle }) and flat structure
  const body = (rawBody.group || rawBody.operator)
    ? {
        ...rawBody.group,
        operatorUsername: rawBody.operator?.username ?? rawBody.operatorUsername,
        operatorPassword: rawBody.operator?.password ?? rawBody.operatorPassword,
        operatorFullName: rawBody.operator?.fullName ?? rawBody.operatorFullName,
        cycleNo: rawBody.cycle?.cycleNo ?? rawBody.cycleNo,
        durationWeeks: rawBody.cycle?.durationWeeks ?? rawBody.durationWeeks,
      }
    : rawBody;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const state = typeof body.state === 'string' && body.state.trim() ? body.state.trim() : 'Bihar';
  const district = typeof body.district === 'string' && body.district.trim() ? body.district.trim() : 'Patna';
  const block = typeof body.block === 'string' && body.block.trim() ? body.block.trim() : 'Phulwari Sharif';
  const panchayat = typeof body.panchayat === 'string' && body.panchayat.trim() ? body.panchayat.trim() : 'Rampur';
  const operatorUsername = typeof body.operatorUsername === 'string' ? body.operatorUsername.trim() : '';
  const operatorPassword = typeof body.operatorPassword === 'string' ? body.operatorPassword.trim() : '';

  if (!name || !operatorUsername || !operatorPassword) {
    throw unprocessable('Name, operator username and password are required', 'MISSING_FIELDS');
  }

  const payload = {
    ...body,
    name,
    state,
    district,
    block,
    panchayat,
    operatorUsername,
    operatorPassword,
  };

  const result = await c.var.tx((tx) => createAdminGroup(tx, payload));
  return created(c, result);
});

adminRoutes.patch('/master/shg/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const updated = await c.var.tx((tx) => updateAdminGroup(tx, c.req.param('id'), body));
  return ok(c, updated);
});

/**
 * Add a new member to an SHG
 */
adminRoutes.post('/master/shg/:id/members', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.hhNo || !body.name) {
    throw unprocessable('Household number (hhNo) and Member Name are required', 'MISSING_FIELDS');
  }

  const member = await c.var.tx((tx) => addMemberToGroup(tx, c.req.param('id'), body));
  return created(c, member);
});

/**
 * Excel / CSV Bulk upload of members
 */
adminRoutes.post('/master/upload', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.groupId || !Array.isArray(body.members)) {
    throw unprocessable('groupId and members array are required', 'INVALID_PAYLOAD');
  }

  const result = await c.var.tx((tx) => bulkImportMembers(tx, body.groupId, body.members));
  return ok(c, result);
});

/**
 * Master Data: Locations Hierarchy (State, District, Block, Panchayat, Village)
 */
adminRoutes.get('/master/locations', async (c) => {
  const { state, district, block, panchayat, search, isActive } = c.req.query();
  const list = await listAdminLocations(c.var.db, {
    state,
    district,
    block,
    panchayat,
    search,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
  });
  return ok(c, list);
});

adminRoutes.post('/master/locations', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) throw unprocessable('Request body is required', 'MISSING_FIELDS');
  const loc = await c.var.tx((tx) => createAdminLocation(tx, body));
  return created(c, loc);
});

adminRoutes.patch('/master/locations/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const updated = await c.var.tx((tx) => updateAdminLocation(tx, c.req.param('id'), body));
  return ok(c, updated);
});

adminRoutes.delete('/master/locations/:id', async (c) => {
  const result = await c.var.tx((tx) => deleteAdminLocation(tx, c.req.param('id')));
  return ok(c, result);
});

/* -------------------------------------------------------------------------- */
/* Finance: Transactions with Member-level breakdown & Approvals              */
/* -------------------------------------------------------------------------- */

/**
 * Finance Transactions:
 * Filter by State / District / Block / Panchayat / From Date / To Date / Status (Pending Approval / Approved)
 * Returns list of SHGs. Clicking an SHG reveals member entries and Approve button.
 */
adminRoutes.get('/finance/transactions', async (c) => {
  const { state, district, block, panchayat, fromDate, toDate, status } = c.req.query();
  const auth = c.var.auth;
  let accessibleGroupIds: string[] | undefined = undefined;
  if (auth.role === 'shg' || auth.role === 'operator') {
    accessibleGroupIds = auth.groupId ? [auth.groupId] : [];
  } else if (auth.role === 'do' && auth.assignedGroupIds && auth.assignedGroupIds.length > 0) {
    accessibleGroupIds = auth.assignedGroupIds;
  }

  const data = await listAdminTransactions(c.var.db, {
    state,
    district,
    block,
    panchayat,
    fromDate,
    toDate,
    status: (status as any) || 'all',
    accessibleGroupIds,
  });
  return ok(c, data);
});

/**
 * Returns complete weekly financial ledger & member details for a specific SHG
 */
adminRoutes.get('/finance/weekly/:groupId', async (c) => {
  const groupId = c.req.param('groupId');
  const auth = c.var.auth;
  if (auth.role === 'shg' || auth.role === 'operator') {
    if (auth.groupId && auth.groupId !== groupId) {
      throw unprocessable('Access to this SHG is restricted', 'FORBIDDEN_SHG');
    }
  } else if (auth.role === 'do' && auth.assignedGroupIds && auth.assignedGroupIds.length > 0) {
    if (!auth.assignedGroupIds.includes(groupId)) {
      throw unprocessable('Access to this SHG is restricted for your role', 'FORBIDDEN_SHG');
    }
  }

  const data = await getShgWeeklyFinance(c.var.db, groupId);
  return ok(c, data);
});

/**
 * Approve or Reject an individual member's record in a specific week
 */
adminRoutes.post('/finance/approve-member', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.groupId || !body.weekDate || !body.memberId || !body.action) {
    throw unprocessable('groupId, weekDate, memberId, and action (approve|reject) are required', 'MISSING_FIELDS');
  }

  const result = await c.var.tx((tx) =>
    approveMemberWeekly(tx, c.var.auth.userId, {
      groupId: body.groupId,
      weekDate: body.weekDate,
      memberId: body.memberId,
      action: body.action,
    }),
  );
  return ok(c, result);
});

/**
 * Approve or Reject all member records for an entire week in an SHG
 */
adminRoutes.post('/finance/approve-week', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.groupId || !body.weekDate || !body.action) {
    throw unprocessable('groupId, weekDate, and action (approve|reject) are required', 'MISSING_FIELDS');
  }

  const result = await c.var.tx((tx) =>
    approveWeekAll(tx, c.var.auth.userId, {
      groupId: body.groupId,
      weekDate: body.weekDate,
      action: body.action,
    }),
  );
  return ok(c, result);
});

/**
 * Edit an individual member's weekly figures (deposit stamps, loan, repayment)
 */
adminRoutes.patch('/finance/edit-member-weekly', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.groupId || !body.weekDate || !body.memberId) {
    throw unprocessable('groupId, weekDate, and memberId are required', 'MISSING_FIELDS');
  }

  const result = await c.var.tx((tx) =>
    editMemberWeekly(tx, c.var.auth.userId, {
      groupId: body.groupId,
      weekDate: body.weekDate,
      memberId: body.memberId,
      stamps: body.stamps,
      depositAmount: body.depositAmount,
      loanDisbursed: body.loanDisbursed,
      repayment: body.repayment,
      autoApprove: body.autoApprove,
    }),
  );
  return ok(c, result);
});

/**
 * Approve or Reject a transaction
 */
adminRoutes.post('/finance/approve', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.type || !body.id || !body.action) {
    throw unprocessable('type (deposit|loan), id, and action (approve|reject) are required', 'MISSING_FIELDS');
  }

  const result = await c.var.tx((tx) =>
    approveTransaction(tx, c.var.auth.userId, {
      type: body.type,
      id: body.id,
      action: body.action,
    }),
  );
  return ok(c, result);
});

/**
 * Edit a pending transaction (deposit or loan)
 */
adminRoutes.patch('/finance/transactions/:type/:id', async (c) => {
  const type = c.req.param('type') as 'deposit' | 'loan';
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const result = await c.var.tx((tx) =>
    editPendingTransaction(tx, c.var.auth.userId, {
      type,
      id,
      ...body,
    }),
  );
  return ok(c, result);
});

/**
 * Ledger View - By SHG / Date from Date To
 */
adminRoutes.get('/finance/ledger', async (c) => {
  const { groupId, fromDate, toDate, type } = c.req.query();
  const data = await getAdminLedger(c.var.db, {
    groupId,
    fromDate,
    toDate,
    type: type as any,
  });
  return ok(c, data);
});

/* -------------------------------------------------------------------------- */
/* Master: User Module                                                        */
/* -------------------------------------------------------------------------- */

adminRoutes.get('/master/users', async (c) => {
  const { role, groupId } = c.req.query();
  const usersList = await listAdminUsers(c.var.db, { role, groupId });
  return ok(c, usersList);
});

adminRoutes.post('/master/users', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.username || !body.password || !body.fullName || !body.role) {
    throw unprocessable('username, password, fullName, and role are required', 'MISSING_FIELDS');
  }

  const user = await c.var.tx((tx) => createAdminUser(tx, body));
  return created(c, user);
});

adminRoutes.patch('/master/users/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const updated = await c.var.tx((tx) => updateAdminUser(tx, c.req.param('id'), body));
  return ok(c, updated);
});

adminRoutes.post('/master/users/:id/reset-password', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || !body.newPassword) {
    throw unprocessable('newPassword is required', 'MISSING_NEW_PASSWORD');
  }

  const result = await c.var.tx((tx) => resetAdminUserPassword(tx, c.req.param('id'), body.newPassword));
  return ok(c, result);
});

/* -------------------------------------------------------------------------- */
/* Settings: Access Control, Rate of Interest, Validation Rules               */
/* -------------------------------------------------------------------------- */

adminRoutes.get('/settings', async (c) => {
  const settings = await getAdminSettings(c.var.db);
  return ok(c, settings);
});

adminRoutes.patch('/settings', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const updated = await c.var.tx((tx) => updateAdminSettings(tx, body));
  return ok(c, updated);
});
