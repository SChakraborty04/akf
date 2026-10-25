import { describe, expect, test } from 'bun:test';
import { createTestApp } from './helpers';

describe('User API Business Routes', () => {
  test('GET /v1/group and GET /v1/group/shapes return SHG profile and shape stamps', async () => {
    const { request, token } = await createTestApp();
    const t = await token();

    // Group profile
    const groupRes = await request('/v1/group', { token: t });
    expect(groupRes.status).toBe(200);
    expect(groupRes.json.data.name).toBe('Lakshi Group');
    expect(groupRes.json.data.stampValue).toBe(50);
    expect(groupRes.json.data.monthlyInterestRate).toBe(0.02);
    expect(groupRes.json.data.memberCount).toBe(12);
    expect(groupRes.json.data.cycleNo).toBe(3);

    // Shape stamps
    const shapesRes = await request('/v1/group/shapes', { token: t });
    expect(shapesRes.status).toBe(200);
    expect(shapesRes.json.data.length).toBe(5);
    const sun = shapesRes.json.data.find((s: any) => s.code === 'sun');
    expect(sun).toBeDefined();
    expect(sun.value).toBe(10000);
    expect(sun.repaymentValue).toBe(200); // 2% of 10000
  });

  test('GET /v1/members lists all active members and GET /v1/members/:id returns detailed overview', async () => {
    const { request, token } = await createTestApp();
    const t = await token();

    const listRes = await request('/v1/members', { token: t });
    expect(listRes.status).toBe(200);
    expect(listRes.json.data.length).toBe(12);
    const m1 = listRes.json.data[0];
    expect(m1.hhNo).toBe('HH-101');
    expect(m1.name).toBe('Sunita Devi');
    expect(m1.idNo).toBeUndefined(); // Sensitive ID number hidden in summary list

    // Detail route returns ID number and 3-number financial overview
    const detailRes = await request(`/v1/members/${m1.id}`, { token: t });
    expect(detailRes.status).toBe(200);
    expect(detailRes.json.data.idNo).toBe('AADH-8821-4091');
    expect(detailRes.json.data.overview).toEqual({
      totalSavings: 0,
      activeLoanPrincipal: 0,
      activeLoanCount: 0,
      totalLoanCount: 0,
      totalRepaid: 0,
    });
  });

  test('POST /v1/deposits records meeting savings and computes member breakdown', async () => {
    const { request, token } = await createTestApp();
    const t = await token();

    const membersRes = await request('/v1/members', { token: t });
    const members = membersRes.json.data;

    const clientId = crypto.randomUUID();
    const depositPayload = {
      date: '2026-02-10',
      note: 'Monthly Member Savings Test',
      clientId,
      items: [
        { memberId: members[0].id, stamps: 5 }, // 5 stamps * 50 = 250
        { memberId: members[1].id, stamps: 4 }, // 4 stamps * 50 = 200
        { memberId: members[2].id, stamps: 0 }, // 0 stamps skipped
      ],
    };

    const createRes = await request('/v1/deposits', {
      method: 'POST',
      token: t,
      json: depositPayload,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.json.success).toBe(true);
    expect(createRes.json.data.totalStamps).toBe(9);
    expect(createRes.json.data.amount).toBe(450);
    expect(createRes.json.data.memberDeposits.length).toBe(2);

    // Idempotency: replaying same clientId returns 200 with idempotentReplay flag
    const replayRes = await request('/v1/deposits', {
      method: 'POST',
      token: t,
      json: depositPayload,
    });
    expect(replayRes.status).toBe(200);
    expect(replayRes.json.idempotentReplay).toBe(true);
    expect(replayRes.json.data.id).toBe(createRes.json.data.id);

    // Check member 1 detail now shows savings
    const m1Detail = await request(`/v1/members/${members[0].id}`, { token: t });
    expect(m1Detail.json.data.overview.totalSavings).toBe(250);
  });

  test('POST /v1/loans disburses loan using shape stamps and computes monthly interest schedule', async () => {
    const { request, token } = await createTestApp();
    const t = await token();

    const membersRes = await request('/v1/members', { token: t });
    const m1 = membersRes.json.data[0];

    const clientId = crypto.randomUUID();
    const loanPayload = {
      memberId: m1.id,
      date: '2026-01-15',
      clientId,
      stamps: [{ shape: 'sun' }, { shape: 'sun' }], // 10000 + 10000 = 20000
    };

    const createRes = await request('/v1/loans', {
      method: 'POST',
      token: t,
      json: loanPayload,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.json.data.principalAmount).toBe(20000);
    expect(createRes.json.data.loanNo).toBe(1);
    expect(createRes.json.data.loanRef).toBe('L-0001');
    expect(createRes.json.data.status).toBe('active');
    expect(createRes.json.data.stamps.length).toBe(2);

    // Fetch loan detail with monthly breakdown
    const loanId = createRes.json.data.id;
    const getRes = await request(`/v1/loans/${loanId}?asOf=2026-03-15`, { token: t });
    expect(getRes.status).toBe(200);
    expect(getRes.json.data.details.elapsedMonths).toBe(2); // Jan 15 -> Mar 15 = 2 months
    expect(getRes.json.data.details.totalAccruedInterest).toBe(800); // 20000 * 2% * 2 = 800
    expect(getRes.json.data.monthlyBreakdown.length).toBe(2);
    expect(getRes.json.data.monthlyBreakdown[0].monthlyAccrued).toBe(400);
  });

  test('POST /v1/repayments/preview and POST /v1/repayments execute interest-first waterfall', async () => {
    const { request, token } = await createTestApp();
    const t = await token();

    const membersRes = await request('/v1/members', { token: t });
    const m1 = membersRes.json.data[0];

    // Create loan of 10000
    const loanRes = await request('/v1/loans', {
      method: 'POST',
      token: t,
      json: {
        memberId: m1.id,
        date: '2026-01-01',
        stamps: [{ shape: 'sun' }], // 10000
      },
    });
    const loanId = loanRes.json.data.id;

    // Preview repayment with two 2% shape stamps (circle repayment value = 20, 2 circles = 40)
    // Jan 01 -> Feb 01 is 1 month. Unpaid interest = 10000 * 0.02 = 200.
    const previewRes = await request('/v1/repayments/preview', {
      method: 'POST',
      token: t,
      json: {
        loanId,
        date: '2026-02-01',
        stamps: [{ shape: 'circle' }, { shape: 'circle' }], // 20 + 20 = 40
      },
    });
    expect(previewRes.status).toBe(200);
    expect(previewRes.json.data.amountPaid).toBe(40);
    expect(previewRes.json.data.waterfall.interestDeducted).toBe(40);
    expect(previewRes.json.data.waterfall.principalDeducted).toBe(0);

    // Now execute a repayment with 2x sun (repayment stamp value: 200 each = 400 total)
    // 200 clears accrued interest, remaining 200 reduces principal to 9800
    const repayRes = await request('/v1/repayments', {
      method: 'POST',
      token: t,
      json: {
        loanId,
        date: '2026-02-01',
        stamps: [{ shape: 'sun' }, { shape: 'sun' }],
      },
    });
    expect(repayRes.status).toBe(201);
    expect(repayRes.json.data.amountPaid).toBe(400);
    expect(repayRes.json.data.interestDeducted).toBe(200);
    expect(repayRes.json.data.principalDeducted).toBe(200);
    expect(repayRes.json.data.loanRemainingPrincipal).toBe(9800);

    // Verify ledger has records for both loan and repayment
    const ledgerRes = await request('/v1/ledger', { token: t });
    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.json.data.length).toBeGreaterThanOrEqual(2);
    expect(ledgerRes.json.totals.credit).toBe(400); // repayment is credit
    expect(ledgerRes.json.totals.debit).toBe(10000); // loan is debit
  });

  test('GET /v1/dashboard and GET /v1/snapshot return summary and full offline dataset', async () => {
    const { request, token } = await createTestApp();
    const t = await token();

    // Dashboard
    const dashRes = await request('/v1/dashboard', { token: t });
    expect(dashRes.status).toBe(200);
    expect(dashRes.json.data.summary).toBeDefined();
    expect(typeof dashRes.json.data.summary.totalSaving).toBe('number');
    expect(typeof dashRes.json.data.summary.avlBalance).toBe('number');
    expect(Array.isArray(dashRes.json.data.recentLedger)).toBe(true);

    // Offline Snapshot
    const snapRes = await request('/v1/snapshot', { token: t });
    expect(snapRes.status).toBe(200);
    const snap = snapRes.json.data;
    expect(snap.groupProfile).toBeDefined();
    expect(snap.loanShapes.length).toBe(5);
    expect(snap.members.length).toBe(12);
    expect(Array.isArray(snap.deposits)).toBe(true);
    expect(Array.isArray(snap.loans)).toBe(true);
    expect(Array.isArray(snap.repayments)).toBe(true);
    expect(Array.isArray(snap.ledger)).toBe(true);
    expect(snap.summary).toBeDefined();
  });

  test('GET /admin/health returns admin api status scaffold', async () => {
    const { request, token } = await createTestApp();
    const t = await token();
    const res = await request('/admin/health', { token: t });
    expect(res.status).toBe(200);
    expect(res.json.data.module).toBe('admin-api');
  });
});
