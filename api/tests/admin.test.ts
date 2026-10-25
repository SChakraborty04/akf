import { describe, expect, test } from 'bun:test';
import { createTestApp, PASSWORD } from './helpers';

describe('Admin MIS API Routes', () => {
  test('POST /admin/auth/login authenticates admin and returns token', async () => {
    const { request } = await createTestApp();
    const res = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });

    expect(res.status).toBe(200);
    expect(res.json.success).toBe(true);
    expect(res.json.data.user.username).toBe('admin');
    expect(res.json.data.user.role).toBe('super_admin');
    expect(typeof res.json.data.accessToken).toBe('string');
  });

  test('GET /admin/dashboard returns high-level KPI aggregations', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    const res = await request('/admin/dashboard', { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.json.data.kpis).toBeDefined();
    expect(res.json.data.kpis.totalGroups).toBeGreaterThanOrEqual(1);
    expect(res.json.data.kpis.totalMembers).toBeGreaterThanOrEqual(12);
    expect(res.json.data.districtDistribution).toBeDefined();
  });

  test('GET /admin/locations returns cascading location hierarchy', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    const res = await request('/admin/locations', { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.json.data.states).toContain('Bihar');
    expect(res.json.data.districts).toContain('Patna');
    expect(res.json.data.blocks).toContain('Phulwari Sharif');
    expect(res.json.data.panchayats).toContain('Rampur');
    expect(res.json.data.hierarchy.Bihar.Patna['Phulwari Sharif']).toContain('Rampur');
  });

  test('GET /admin/groups filters SHGs by State / District / Block / Panchayat', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    // Filter by district Patna
    const resPatna = await request('/admin/groups?state=Bihar&district=Patna', { token: adminToken });
    expect(resPatna.status).toBe(200);
    expect(resPatna.json.data.length).toBeGreaterThanOrEqual(1);
    expect(resPatna.json.data[0].district).toBe('Patna');

    // Filter by Block Danapur
    const resDanapur = await request('/admin/groups?block=Danapur', { token: adminToken });
    expect(resDanapur.status).toBe(200);
    expect(resDanapur.json.data.length).toBe(1);
    expect(resDanapur.json.data[0].name).toBe('Pragati Mahila Mandal');
  });

  test('POST /admin/master/shg creates a new SHG with username and password', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    const newShgPayload = {
      name: 'Kalyani SHG',
      hindiName: 'कल्याणी समूह',
      address: 'Ward 2, Maner, Patna',
      state: 'Bihar',
      district: 'Patna',
      block: 'Maner',
      panchayat: 'Haldichhapra',
      village: 'Haldichhapra',
      stampValue: 50,
      maxStampsPerMember: 5,
      maxLoanAmount: 60000,
      approvalRequired: true,
      operatorUsername: 'kalyanioperator',
      operatorPassword: 'kalyanipassword123',
      operatorFullName: 'Kalyani Operator',
    };

    const res = await request('/admin/master/shg', {
      method: 'POST',
      token: adminToken,
      json: newShgPayload,
    });

    expect(res.status).toBe(201);
    expect(res.json.data.group.name).toBe('Kalyani SHG');
    expect(res.json.data.group.block).toBe('Maner');
    expect(res.json.data.operator.username).toBe('kalyanioperator');

    // Verify the newly created operator can immediately log in to the PWA API
    const opLoginRes = await request('/v1/auth/login', {
      method: 'POST',
      json: { username: 'kalyanioperator', password: 'kalyanipassword123' },
    });
    expect(opLoginRes.status).toBe(200);
    expect(opLoginRes.json.data.user.groupName).toBe('Kalyani SHG');
  });

  test('POST /admin/master/shg creates an SHG using nested { group, operator, cycle } MIS client structure', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    const nestedPayload = {
      group: {
        name: 'Jyoti Mahila SHG',
        hindiName: 'ज्योति महिला समूह',
        state: 'Bihar',
        district: 'Patna',
        block: 'Danapur',
        panchayat: 'Saguna',
        village: 'Saguna More',
        stampValue: 100,
        maxStampsPerMember: 5,
        maxLoanAmount: 50000,
        meetingDay: 'Wednesday',
      },
      cycle: {
        cycleNo: 1,
        durationWeeks: 50,
      },
      operator: {
        username: 'jyotioperator',
        password: 'jyotipassword123',
        fullName: 'Jyoti Operator',
      },
    };

    const res = await request('/admin/master/shg', {
      method: 'POST',
      token: adminToken,
      json: nestedPayload,
    });

    expect(res.status).toBe(201);
    expect(res.json.data.group.name).toBe('Jyoti Mahila SHG');
    expect(res.json.data.group.block).toBe('Danapur');
    expect(res.json.data.operator.username).toBe('jyotioperator');
  });

  test('POST /admin/master/upload bulk imports members via Excel/CSV structure', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    // Get an SHG id
    const groupRes = await request('/admin/groups', { token: adminToken });
    const targetGroup = groupRes.json.data[0];

    const bulkPayload = {
      groupId: targetGroup.id,
      members: [
        { hhNo: 'HH-901', name: 'Bulk Member One', mobileNo: '9999900001', husbandName: 'Husband 1' },
        { hhNo: 'HH-902', name: 'Bulk Member Two', mobileNo: '9999900002', husbandName: 'Husband 2' },
      ],
    };

    const res = await request('/admin/master/upload', {
      method: 'POST',
      token: adminToken,
      json: bulkPayload,
    });

    expect(res.status).toBe(200);
    expect(res.json.data.imported).toBe(2);
    expect(res.json.data.errors.length).toBe(0);
  });

  test('Finance transactions filter by approval status and approve button works', async () => {
    const { request, token } = await createTestApp();
    const opToken = await token();

    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    // 1. Operator deposits savings
    const membersRes = await request('/v1/members', { token: opToken });
    const m1 = membersRes.json.data[0];
    const m2 = membersRes.json.data[1];

    const depositRes = await request('/v1/deposits', {
      method: 'POST',
      token: opToken,
      json: {
        date: '2026-04-01',
        items: [
          { memberId: m1.id, stamps: 3 },
          { memberId: m2.id, stamps: 4 },
        ],
      },
    });
    expect(depositRes.status).toBe(201);
    const depositId = depositRes.json.data.id;

    // 2. Query transactions in Admin MIS with member breakdown
    const txRes = await request('/admin/finance/transactions?state=Bihar&district=Patna', {
      token: adminToken,
    });
    expect(txRes.status).toBe(200);
    expect(txRes.json.data.shgs.length).toBeGreaterThanOrEqual(1);

    const shg = txRes.json.data.shgs.find((s: any) => s.deposits.some((d: any) => d.id === depositId));
    expect(shg).toBeDefined();
    const depositEntry = shg.deposits.find((d: any) => d.id === depositId);
    expect(depositEntry.memberDeposits.length).toBe(2);
    expect(depositEntry.memberDeposits[0].memberName).toBeDefined();

    // 2b. Admin edits the pending transaction before approving
    const editRes = await request(`/admin/finance/transactions/deposit/${depositId}`, {
      method: 'PATCH',
      token: adminToken,
      json: {
        note: 'Audited & adjusted by Admin',
        memberDeposits: [
          { memberId: m1.id, stamps: 5 },
          { memberId: m2.id, stamps: 5 },
        ],
      },
    });
    expect(editRes.status).toBe(200);
    expect(editRes.json.data.deposit.totalStamps).toBe(10);
    expect(editRes.json.data.deposit.totalAmount).toBe(500);

    // 3. Admin clicks Approve button
    const approveRes = await request('/admin/finance/approve', {
      method: 'POST',
      token: adminToken,
      json: {
        type: 'deposit',
        id: depositId,
        action: 'approve',
      },
    });
    expect(approveRes.status).toBe(200);
    expect(approveRes.json.data.status).toBe('approved');
  });

  test('GET /admin/finance/ledger returns chronological credit/debit feed', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    const res = await request('/admin/finance/ledger', { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.json.data.summary).toBeDefined();
    expect(Array.isArray(res.json.data.entries)).toBe(true);
  });

  test('Settings get and patch controls system-wide validation and interest rates', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    const getRes = await request('/admin/settings', { token: adminToken });
    expect(getRes.status).toBe(200);
    expect(getRes.json.data.rateOfInterest.monthlyRate).toBe('0.0200');
    expect(getRes.json.data.validationRules.maxLoanAmount).toBe(50000);

    // Patch max loan amount
    const patchRes = await request('/admin/settings', {
      method: 'PATCH',
      token: adminToken,
      json: {
        default_max_loan_amount: '75000',
        global_interest_rate: '0.0250',
      },
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.json.data.validationRules.maxLoanAmount).toBe(75000);
    expect(patchRes.json.data.rateOfInterest.monthlyRate).toBe('0.0250');
  });

  test('User module lists platform users and resets passwords', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    const listRes = await request('/admin/master/users', { token: adminToken });
    expect(listRes.status).toBe(200);
    expect(listRes.json.data.length).toBeGreaterThanOrEqual(2);

    const operatorUser = listRes.json.data.find((u: any) => u.username === 'lakshigroup');
    expect(operatorUser).toBeDefined();

    // Reset password
    const resetRes = await request(`/admin/master/users/${operatorUser.id}/reset-password`, {
      method: 'POST',
      token: adminToken,
      json: { newPassword: 'new-secret-password-999' },
    });
    expect(resetRes.status).toBe(200);
    expect(resetRes.json.data.ok).toBe(true);

    // Verify login with new password
    const loginNewRes = await request('/v1/auth/login', {
      method: 'POST',
      json: { username: 'lakshigroup', password: 'new-secret-password-999' },
    });
    expect(loginNewRes.status).toBe(200);

    // Super_admin logs in with Admin123 and creates another admin user
    const superLoginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'super_admin', password: 'Admin123' },
    });
    expect(superLoginRes.status).toBe(200);
    const superToken = superLoginRes.json.data.accessToken;

    const createAdminRes = await request('/admin/master/users', {
      method: 'POST',
      token: superToken,
      json: {
        username: 'regional_admin_patna',
        password: 'Password123!',
        fullName: 'Patna Regional Officer',
        role: 'admin',
      },
    });
    expect(createAdminRes.status).toBe(201);
    expect(createAdminRes.json.data.role).toBe('admin');

    // Verify regional admin can log in
    const regAdminLogin = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'regional_admin_patna', password: 'Password123!' },
    });
    expect(regAdminLogin.status).toBe(200);
    expect(regAdminLogin.json.data.user.role).toBe('admin');
  });

  test('Master Location CRUD: Add, list, edit, cascade hierarchy, and delete location', async () => {
    const { request } = await createTestApp();
    const loginRes = await request('/admin/auth/login', {
      method: 'POST',
      json: { username: 'admin', password: PASSWORD },
    });
    const adminToken = loginRes.json.data.accessToken;

    // 1. List initial master locations
    const listRes = await request('/admin/master/locations', { token: adminToken });
    expect(listRes.status).toBe(200);
    expect(listRes.json.data.length).toBeGreaterThanOrEqual(1);

    // 2. Create new location
    const createRes = await request('/admin/master/locations', {
      method: 'POST',
      token: adminToken,
      json: {
        state: 'Bihar',
        district: 'Gaya',
        block: 'Tekari',
        panchayat: 'Makhdumpur',
        village: 'Alipur',
        pincode: '824236',
      },
    });
    expect(createRes.status).toBe(201);
    const newLocId = createRes.json.data.id;
    expect(createRes.json.data.village).toBe('Alipur');

    // 3. Edit location
    const editRes = await request(`/admin/master/locations/${newLocId}`, {
      method: 'PATCH',
      token: adminToken,
      json: {
        village: 'Alipur Kalan',
        pincode: '824237',
      },
    });
    expect(editRes.status).toBe(200);
    expect(editRes.json.data.village).toBe('Alipur Kalan');
    expect(editRes.json.data.pincode).toBe('824237');

    // 4. Verify GET /admin/locations reflects Gaya and Tekari
    const locTreeRes = await request('/admin/locations', { token: adminToken });
    expect(locTreeRes.status).toBe(200);
    expect(locTreeRes.json.data.districts).toContain('Gaya');
    expect(locTreeRes.json.data.blocks).toContain('Tekari');
    expect(locTreeRes.json.data.panchayats).toContain('Makhdumpur');
    expect(locTreeRes.json.data.villages).toContain('Alipur Kalan');

    // 5. Delete location
    const delRes = await request(`/admin/master/locations/${newLocId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    expect(delRes.status).toBe(200);
  });
});

