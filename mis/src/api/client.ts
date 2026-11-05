import type {
  DashboardKPIs,
  LedgerEntry,
  LocationHierarchy,
  MasterLocation,
  MISUser,
  SHGGroup,
  SHGTransactionsGroup,
  SHGWeeklyFinanceResponse,
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
          totalGroups: 0,
          totalMembers: 0,
          totalActivePortfolio: 0,
          activeLoansCount: 0,
          totalSavingsCollected: 0,
          pendingApprovals: {
            totalCount: 0,
            totalAmount: 0,
            depositsCount: 0,
            loansCount: 0,
          },
        },
        districtDistribution: [],
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
      return [];
    }
  }

  async getGroupDetail(id: string): Promise<any> {
    try {
      return await this.request(`/groups/${id}`);
    } catch {
      const groups = await this.getGroups();
      const g = groups.find((grp) => grp.id === id);
      return {
        ...(g || { id, name: 'SHG Group' }),
        members: [],
        shapes: [],
        users: [],
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
          pendingCount: 0,
          approvedCount: 0,
          pendingAmount: 0,
          approvedAmount: 0,
        },
        shgs: [],
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

  // SHG Weekly Finance & Member Approvals
  async getShgWeeklyFinance(groupId: string): Promise<SHGWeeklyFinanceResponse> {
    return this.request(`/finance/weekly/${groupId}`);
  }

  async approveMemberWeekly(
    groupId: string,
    weekDate: string,
    memberId: string,
    action: 'approve' | 'reject' = 'approve',
  ) {
    return this.request('/finance/approve-member', {
      method: 'POST',
      body: JSON.stringify({ groupId, weekDate, memberId, action }),
    });
  }

  async approveWeekAll(groupId: string, weekDate: string, action: 'approve' | 'reject' = 'approve') {
    return this.request('/finance/approve-week', {
      method: 'POST',
      body: JSON.stringify({ groupId, weekDate, action }),
    });
  }

  async editMemberWeekly(
    groupId: string,
    weekDate: string,
    memberId: string,
    patch: {
      stamps?: number;
      depositAmount?: number;
      loanDisbursed?: number;
      repayment?: number;
      autoApprove?: boolean;
    },
  ) {
    return this.request('/finance/edit-member-weekly', {
      method: 'PATCH',
      body: JSON.stringify({ groupId, weekDate, memberId, ...patch }),
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
        summary: { totalCredit: 0, totalDebit: 0, netBalance: 0, totalEntries: 0 },
        entries: [],
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
