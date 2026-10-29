import type {
  DashboardKPIs,
  LedgerEntry,
  LocationHierarchy,
  MasterLocation,
  MISUser,
  SHGGroup,
  SHGTransactionsGroup,
  SystemSettingsData,
} from '../types';

function getApiBase(): string {
  const adminUrl = import.meta.env?.VITE_ADMIN_API_URL?.trim();
  if (adminUrl) {
    return adminUrl.replace(/\/+$/, '');
  }
  const rootApi = import.meta.env?.VITE_API_URL?.trim();
  if (rootApi) {
    const cleaned = rootApi.replace(/\/+$/, '');
    return cleaned.endsWith('/admin') ? cleaned : `${cleaned}/admin`;
  }
  return 'http://localhost:8787/admin';
}

const API_BASE = getApiBase();

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('mis_auth_token');
  }

  setToken(t: string | null) {
    this.token = t;
    if (t) localStorage.setItem('mis_auth_token', t);
    else localStorage.removeItem('mis_auth_token');
  }

  getToken() {
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error ${res.status}`);
      }

      const json = await res.json();
      return json.data as T;
    } catch (err) {
      console.warn(`[MIS API] Request to ${path} failed or offline, using fallback state:`, err);
      throw err;
    }
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{ accessToken: string; user: MISUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.accessToken);
    localStorage.setItem('mis_user', JSON.stringify(data.user));
    return data;
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('mis_user');
  }

  getUser(): MISUser | null {
    if (!this.token) return null;
    const raw = localStorage.getItem('mis_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Dashboard
  async getDashboard(): Promise<{ kpis: DashboardKPIs; districtDistribution: { district: string; groupCount: number }[] }> {
    try {
      return await this.request('/dashboard');
    } catch {
      return {
        kpis: {
          totalGroups: 4,
          totalMembers: 48,
          totalActivePortfolio: 185000,
          activeLoansCount: 6,
          totalSavingsCollected: 342000,
          pendingApprovals: {
            totalCount: 5,
            totalAmount: 42500,
            depositsCount: 3,
            loansCount: 2,
          },
        },
        districtDistribution: [
          { district: 'Patna', groupCount: 3 },
          { district: 'Nalanda', groupCount: 1 },
        ],
      };
    }
  }

  // Locations
  async getLocations(): Promise<LocationHierarchy> {
    try {
      return await this.request('/locations');
    } catch {
      return {
        states: ['Bihar'],
        districts: ['Nalanda', 'Patna'],
        blocks: ['Bihar Sharif', 'Danapur', 'Maner', 'Phulwari Sharif'],
        panchayats: ['Haldichhapra', 'Maghra', 'Rampur', 'Saguna'],
        hierarchy: {
          Bihar: {
            Patna: {
              'Phulwari Sharif': ['Rampur'],
              Danapur: ['Saguna'],
              Maner: ['Haldichhapra'],
            },
            Nalanda: {
              'Bihar Sharif': ['Maghra'],
            },
          },
        },
      };
    }
  }

  // Groups
  async getGroups(filters: { state?: string; district?: string; block?: string; panchayat?: string; search?: string } = {}): Promise<SHGGroup[]> {
    const q = new URLSearchParams();
    if (filters.state) q.set('state', filters.state);
    if (filters.district) q.set('district', filters.district);
    if (filters.block) q.set('block', filters.block);
    if (filters.panchayat) q.set('panchayat', filters.panchayat);
    if (filters.search) q.set('search', filters.search);

    try {
      return await this.request(`/groups?${q.toString()}`);
    } catch {
      return [
        {
          id: 'g-1',
          name: 'Lakshi Group',
          hindiName: 'लक्ष्मी समूह',
          address: 'Ward No. 4, Village Rampur, Dist. Patna, Bihar',
          state: 'Bihar',
          district: 'Patna',
          block: 'Phulwari Sharif',
          panchayat: 'Rampur',
          village: 'Rampur',
          stampValue: 50,
          maxStampsPerMember: 5,
          maxLoanAmount: 50000,
          approvalRequired: true,
          monthlyInterestRate: '0.0200',
          repaymentStampRate: '0.0200',
          meetingDay: 'Monday',
          loanSeq: 3,
          isActive: true,
          memberCount: 12,
          totalDeposits: 140000,
          activeLoanAmount: 60000,
          activeLoanCount: 2,
          currentCycle: {
            id: 'c-1',
            cycleNo: 3,
            startDate: '2026-01-05',
            endDate: '2026-12-21',
            durationWeeks: 50,
            isCurrent: true,
          },
          createdAt: '2026-01-05T00:00:00Z',
        },
        {
          id: 'g-2',
          name: 'Pragati Mahila Mandal',
          hindiName: 'प्रगति महिला मंडल',
          address: 'Danapur Cantt, Dist. Patna, Bihar',
          state: 'Bihar',
          district: 'Patna',
          block: 'Danapur',
          panchayat: 'Saguna',
          village: 'Saguna More',
          stampValue: 100,
          maxStampsPerMember: 5,
          maxLoanAmount: 75000,
          approvalRequired: true,
          monthlyInterestRate: '0.0200',
          repaymentStampRate: '0.0200',
          meetingDay: 'Wednesday',
          loanSeq: 1,
          isActive: true,
          memberCount: 15,
          totalDeposits: 95000,
          activeLoanAmount: 45000,
          activeLoanCount: 1,
          currentCycle: {
            id: 'c-2',
            cycleNo: 1,
            startDate: '2026-02-01',
            endDate: '2027-01-31',
            durationWeeks: 52,
            isCurrent: true,
          },
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'g-3',
          name: 'Ujala Self Help Group',
          hindiName: 'उजाला स्वयं सहायता समूह',
          address: 'Main Bazaar, Bihar Sharif, Nalanda, Bihar',
          state: 'Bihar',
          district: 'Nalanda',
          block: 'Bihar Sharif',
          panchayat: 'Maghra',
          village: 'Maghra',
          stampValue: 50,
          maxStampsPerMember: 5,
          maxLoanAmount: 40000,
          approvalRequired: true,
          monthlyInterestRate: '0.0200',
          repaymentStampRate: '0.0200',
          meetingDay: 'Friday',
          loanSeq: 2,
          isActive: true,
          memberCount: 11,
          totalDeposits: 58000,
          activeLoanAmount: 30000,
          activeLoanCount: 1,
          currentCycle: {
            id: 'c-3',
            cycleNo: 2,
            startDate: '2026-01-15',
            endDate: '2026-12-31',
            durationWeeks: 50,
            isCurrent: true,
          },
          createdAt: '2026-01-15T00:00:00Z',
        },
      ];
    }
  }

  async getGroupDetail(id: string): Promise<any> {
    try {
      return await this.request(`/groups/${id}`);
    } catch {
      const groups = await this.getGroups();
      const g = groups.find((grp) => grp.id === id) || groups[0];
      return {
        ...g,
        members: [
          { id: 'm-1', hhNo: 'HH-101', name: 'Sunita Devi', husbandName: 'Ramesh Kumar', mobileNo: '9876543210', age: 34, caste: 'OBC', isActive: true },
          { id: 'm-2', hhNo: 'HH-102', name: 'Meena Devi', husbandName: 'Shambhu Nath', mobileNo: '9876543211', age: 38, caste: 'EBC', isActive: true },
          { id: 'm-3', hhNo: 'HH-103', name: 'Anita Sharma', husbandName: 'Rajesh Sharma', mobileNo: '9876543212', age: 29, caste: 'General', isActive: true },
        ],
        shapes: [
          { code: 'pentagon', name: 'Pentagon', value: 500, color: '#0d9488' },
          { code: 'circle', name: 'Circle', value: 1000, color: '#2563eb' },
          { code: 'triangle', name: 'Triangle', value: 3000, color: '#d97706' },
          { code: 'star', name: 'Star', value: 5000, color: '#7c3aed' },
          { code: 'sun', name: 'Sun', value: 10000, color: '#ea580c' },
        ],
        users: [
          { id: 'u-1', username: 'lakshigroup', fullName: 'Lakshi Operator', role: 'operator', isActive: true, lastLoginAt: '2026-03-23T08:30:00Z' },
        ],
      };
    }
  }

  async createGroup(input: any) {
    return this.request('/master/shg', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateGroup(id: string, patch: any) {
    return this.request(`/master/shg/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Master Locations
  async getMasterLocations(filters: { state?: string; district?: string; block?: string; panchayat?: string; search?: string } = {}): Promise<MasterLocation[]> {
    const q = new URLSearchParams();
    if (filters.state) q.set('state', filters.state);
    if (filters.district) q.set('district', filters.district);
    if (filters.block) q.set('block', filters.block);
    if (filters.panchayat) q.set('panchayat', filters.panchayat);
    if (filters.search) q.set('search', filters.search);

    try {
      return await this.request(`/master/locations?${q.toString()}`);
    } catch {
      return [
        { id: 'loc-1', state: 'Bihar', district: 'Patna', block: 'Phulwari Sharif', panchayat: 'Rampur', village: 'Rampur', pincode: '801505', isActive: true, linkedGroupCount: 1 },
        { id: 'loc-2', state: 'Bihar', district: 'Patna', block: 'Phulwari Sharif', panchayat: 'Rampur', village: 'Korji', pincode: '801505', isActive: true, linkedGroupCount: 0 },
        { id: 'loc-3', state: 'Bihar', district: 'Patna', block: 'Danapur', panchayat: 'Saguna', village: 'Saguna More', pincode: '801503', isActive: true, linkedGroupCount: 1 },
        { id: 'loc-4', state: 'Bihar', district: 'Patna', block: 'Danapur', panchayat: 'Saguna', village: 'Mustafapur', pincode: '801503', isActive: true, linkedGroupCount: 0 },
        { id: 'loc-5', state: 'Bihar', district: 'Patna', block: 'Maner', panchayat: 'Haldichhapra', village: 'Haldichhapra', pincode: '801108', isActive: true, linkedGroupCount: 0 },
        { id: 'loc-6', state: 'Bihar', district: 'Nalanda', block: 'Bihar Sharif', panchayat: 'Maghra', village: 'Maghra', pincode: '803101', isActive: true, linkedGroupCount: 1 },
      ];
    }
  }

  async createMasterLocation(input: { state: string; district: string; block: string; panchayat: string; village: string; pincode?: string }): Promise<MasterLocation> {
    return this.request('/master/locations', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateMasterLocation(id: string, patch: Partial<{ state: string; district: string; block: string; panchayat: string; village: string; pincode?: string; isActive?: boolean; cascadeUpdateGroups?: boolean }>): Promise<MasterLocation> {
    return this.request(`/master/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async deleteMasterLocation(id: string): Promise<any> {
    return this.request(`/master/locations/${id}`, {
      method: 'DELETE',
    });
  }

  async addMember(groupId: string, member: any) {
    return this.request(`/master/shg/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(member),
    });
  }

  async bulkUploadMembers(groupId: string, members: any[]) {
    return this.request('/master/upload', {
      method: 'POST',
      body: JSON.stringify({ groupId, members }),
    });
  }

  // Finance Transactions
  async getTransactions(filters: {
    state?: string;
    district?: string;
    block?: string;
    panchayat?: string;
    fromDate?: string;
    toDate?: string;
    status?: string;
  }): Promise<{ summary: any; shgs: SHGTransactionsGroup[] }> {
    const q = new URLSearchParams();
    if (filters.state) q.set('state', filters.state);
    if (filters.district) q.set('district', filters.district);
    if (filters.block) q.set('block', filters.block);
    if (filters.panchayat) q.set('panchayat', filters.panchayat);
    if (filters.fromDate) q.set('fromDate', filters.fromDate);
    if (filters.toDate) q.set('toDate', filters.toDate);
    if (filters.status) q.set('status', filters.status);

    try {
      return await this.request(`/finance/transactions?${q.toString()}`);
    } catch {
      return {
        summary: {
          pendingCount: 4,
          approvedCount: 8,
          pendingAmount: 32000,
          approvedAmount: 85000,
        },
        shgs: [
          {
            groupId: 'g-1',
            groupName: 'Lakshi Group',
            hindiName: 'लक्ष्मी समूह',
            state: 'Bihar',
            district: 'Patna',
            block: 'Phulwari Sharif',
            panchayat: 'Rampur',
            pendingCount: 2,
            approvedCount: 4,
            pendingAmount: 18000,
            deposits: [
              {
                id: 'dep-101',
                type: 'deposit',
                date: '2026-03-23',
                note: 'Weekly Meeting Savings',
                totalStamps: 48,
                stampValue: 50,
                totalAmount: 2400,
                approvalStatus: 'pending',
                memberDeposits: [
                  { memberId: 'm-1', memberName: 'Sunita Devi', hhNo: 'HH-101', stamps: 5, amount: 250 },
                  { memberId: 'm-2', memberName: 'Meena Devi', hhNo: 'HH-102', stamps: 4, amount: 200 },
                  { memberId: 'm-3', memberName: 'Anita Sharma', hhNo: 'HH-103', stamps: 5, amount: 250 },
                  { memberId: 'm-4', memberName: 'Rekha Kumari', hhNo: 'HH-104', stamps: 4, amount: 200 },
                ],
                createdAt: '2026-03-23T10:00:00Z',
              },
              {
                id: 'dep-100',
                type: 'deposit',
                date: '2026-03-16',
                note: 'Previous Meeting Savings',
                totalStamps: 50,
                stampValue: 50,
                totalAmount: 2500,
                approvalStatus: 'approved',
                approvedAt: '2026-03-17T11:00:00Z',
                memberDeposits: [
                  { memberId: 'm-1', memberName: 'Sunita Devi', hhNo: 'HH-101', stamps: 5, amount: 250 },
                  { memberId: 'm-2', memberName: 'Meena Devi', hhNo: 'HH-102', stamps: 5, amount: 250 },
                ],
                createdAt: '2026-03-16T10:00:00Z',
              },
            ],
            loans: [
              {
                id: 'loan-201',
                type: 'loan',
                loanNo: 4,
                loanRef: 'L-0004',
                memberId: 'm-1',
                memberName: 'Sunita Devi',
                memberHhNo: 'HH-101',
                principalAmount: 15000,
                date: '2026-03-23',
                monthlyInterestRate: '0.0200',
                status: 'active',
                approvalStatus: 'pending',
                stamps: [
                  { shape: 'sun', name: 'Sun', value: 10000 },
                  { shape: 'star', name: 'Star', value: 5000 },
                ],
                createdAt: '2026-03-23T11:30:00Z',
              },
            ],
          },
          {
            groupId: 'g-2',
            groupName: 'Pragati Mahila Mandal',
            hindiName: 'प्रगति महिला मंडल',
            state: 'Bihar',
            district: 'Patna',
            block: 'Danapur',
            panchayat: 'Saguna',
            pendingCount: 2,
            approvedCount: 2,
            pendingAmount: 14000,
            deposits: [
              {
                id: 'dep-201',
                type: 'deposit',
                date: '2026-03-20',
                note: 'Monthly Collection',
                totalStamps: 40,
                stampValue: 100,
                totalAmount: 4000,
                approvalStatus: 'pending',
                memberDeposits: [
                  { memberId: 'm-201', memberName: 'Kavita Kumari', hhNo: 'HH-201', stamps: 5, amount: 500 },
                  { memberId: 'm-202', memberName: 'Sarita Sharma', hhNo: 'HH-202', stamps: 5, amount: 500 },
                ],
                createdAt: '2026-03-20T14:00:00Z',
              },
            ],
            loans: [
              {
                id: 'loan-301',
                type: 'loan',
                loanNo: 1,
                loanRef: 'L-0001',
                memberId: 'm-201',
                memberName: 'Kavita Kumari',
                memberHhNo: 'HH-201',
                principalAmount: 10000,
                date: '2026-03-20',
                monthlyInterestRate: '0.0200',
                status: 'active',
                approvalStatus: 'pending',
                stamps: [{ shape: 'sun', name: 'Sun', value: 10000 }],
                createdAt: '2026-03-20T15:00:00Z',
              },
            ],
          },
        ],
      };
    }
  }

  async approveTransaction(type: 'deposit' | 'loan', id: string, action: 'approve' | 'reject') {
    return this.request('/finance/approve', {
      method: 'POST',
      body: JSON.stringify({ type, id, action }),
    });
  }

  async editPendingTransaction(type: 'deposit' | 'loan', id: string, patch: any) {
    return this.request(`/finance/transactions/${type}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  // Finance Ledger
  async getLedger(filters: { groupId?: string; fromDate?: string; toDate?: string; type?: string } = {}): Promise<{
    summary: { totalCredit: number; totalDebit: number; netBalance: number; totalEntries: number };
    entries: LedgerEntry[];
  }> {
    const q = new URLSearchParams();
    if (filters.groupId) q.set('groupId', filters.groupId);
    if (filters.fromDate) q.set('fromDate', filters.fromDate);
    if (filters.toDate) q.set('toDate', filters.toDate);
    if (filters.type) q.set('type', filters.type);

    try {
      return await this.request(`/finance/ledger?${q.toString()}`);
    } catch {
      return {
        summary: { totalCredit: 140000, totalDebit: 60000, netBalance: 80000, totalEntries: 4 },
        entries: [
          {
            id: 'led-1',
            groupId: 'g-1',
            groupName: 'Lakshi Group',
            type: 'deposit',
            amount: 250,
            date: '2026-03-16',
            memberId: 'm-1',
            memberName: 'Sunita Devi',
            hhNo: 'HH-101',
            stamps: 5,
            description: 'Deposit - Sunita Devi (5 stamps)',
            createdAt: '2026-03-16T10:00:00Z',
          },
          {
            id: 'led-2',
            groupId: 'g-1',
            groupName: 'Lakshi Group',
            type: 'loan',
            amount: 20000,
            date: '2026-01-15',
            memberId: 'm-1',
            memberName: 'Sunita Devi',
            hhNo: 'HH-101',
            description: 'Loan Disbursed - Sunita Devi (Sun, Sun)',
            createdAt: '2026-01-15T10:00:00Z',
          },
          {
            id: 'led-3',
            groupId: 'g-1',
            groupName: 'Lakshi Group',
            type: 'repayment',
            amount: 400,
            date: '2026-02-15',
            memberId: 'm-1',
            memberName: 'Sunita Devi',
            hhNo: 'HH-101',
            description: 'Loan Repayment - Sunita Devi (Int: ₹400, Prin: ₹0)',
            createdAt: '2026-02-15T10:00:00Z',
          },
          {
            id: 'led-4',
            groupId: 'g-2',
            groupName: 'Pragati Mahila Mandal',
            type: 'deposit',
            amount: 500,
            date: '2026-03-20',
            memberId: 'm-201',
            memberName: 'Kavita Kumari',
            hhNo: 'HH-201',
            stamps: 5,
            description: 'Deposit - Kavita Kumari (5 stamps)',
            createdAt: '2026-03-20T14:00:00Z',
          },
        ],
      };
    }
  }

  // Users
  async getUsers(filters: { role?: string; groupId?: string } = {}): Promise<MISUser[]> {
    const q = new URLSearchParams();
    if (filters.role) q.set('role', filters.role);
    if (filters.groupId) q.set('groupId', filters.groupId);

    try {
      return await this.request(`/master/users?${q.toString()}`);
    } catch {
      return [
        {
          id: 'u-admin',
          username: 'admin',
          fullName: 'MIS Master Administrator',
          role: 'admin',
          language: 'en',
          isActive: true,
          isLocked: false,
          failedLoginCount: 0,
          createdAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'u-do-1',
          username: 'patna_do',
          fullName: 'Rajesh Kumar (DO Patna)',
          role: 'do',
          assignedGroupIds: ['g-1', 'g-2'],
          assignedGroupNames: ['Lakshi Group', 'Pragati Mahila Mandal'],
          language: 'en',
          isActive: true,
          isLocked: false,
          failedLoginCount: 0,
          createdAt: '2026-01-10T00:00:00Z',
        },
        {
          id: 'u-1',
          username: 'lakshigroup',
          fullName: 'Lakshi SHG Recording User',
          role: 'shg',
          groupId: 'g-1',
          groupName: 'Lakshi Group',
          language: 'en',
          isActive: true,
          isLocked: false,
          failedLoginCount: 0,
          lastLoginAt: '2026-03-23T08:30:00Z',
          createdAt: '2026-01-05T00:00:00Z',
        },
        {
          id: 'u-2',
          username: 'pragatigroup',
          fullName: 'Pragati SHG Recording User',
          role: 'shg',
          groupId: 'g-2',
          groupName: 'Pragati Mahila Mandal',
          language: 'en',
          isActive: true,
          isLocked: false,
          failedLoginCount: 0,
          lastLoginAt: '2026-03-20T12:00:00Z',
          createdAt: '2026-02-01T00:00:00Z',
        },
        {
          id: 'u-viewer',
          username: 'auditor_viewer',
          fullName: 'State Audit Officer',
          role: 'viewer',
          language: 'en',
          isActive: true,
          isLocked: false,
          failedLoginCount: 0,
          createdAt: '2026-02-15T00:00:00Z',
        },
      ];
    }
  }

  async createUser(user: any) {
    return this.request('/master/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, patch: any) {
    return this.request(`/master/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }

  async resetPassword(userId: string, newPassword: string) {
    return this.request(`/master/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ passwordChanged: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Settings
  async getSettings(): Promise<SystemSettingsData> {
    try {
      return await this.request('/settings');
    } catch {
      return {
        rateOfInterest: {
          monthlyRate: '0.0200',
          percentage: '2.0%',
          annualRate: '24.0%',
          description: 'Simple interest calculated monthly on original principal disbursed',
        },
        validationRules: {
          defaultStampValue: 50,
          maxLoanAmount: 50000,
          maxStampsPerMeeting: 5,
          requireApproval: true,
          description: 'Global threshold defaults applied to newly registered SHGs',
        },
        accessControl: {
          allowViewerExport: true,
          enforcePasswordExpiry: false,
          roles: [
            {
              role: 'admin',
              label: 'Administrator',
              description: 'Full administrative control, cross-SHG oversight, rule updates, user provisioning',
              canApprove: true,
              canEditSettings: true,
              canManageUsers: true,
            },
            {
              role: 'do',
              label: 'DO (Development Officer)',
              description: 'Supervises and manages multiple SHGs across assigned geography',
              canApprove: true,
              canEditSettings: false,
              canManageUsers: false,
            },
            {
              role: 'shg',
              label: 'SHG User',
              description: 'Field app recording user who has access to the PWA for the specified SHG',
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
  }

  async updateSettings(patch: Record<string, string>) {
    return this.request('/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  }
}

export const api = new ApiClient();
