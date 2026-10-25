/**
 * API client for SHG+ PWA
 * Connects PWA to the backend API (/v1/*) with automatic token management,
 * offline fallback capability, and error translation.
 */

function getApiBase() {
  const envUrl = (import.meta.env?.VITE_API_URL || '').trim();
  if (envUrl) {
    const cleaned = envUrl.replace(/\/+$/, '');
    return cleaned.endsWith('/v1') ? cleaned : `${cleaned}/v1`;
  }
  return 'http://localhost:8787/v1';
}

const API_BASE = getApiBase();

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('pwa_access_token');
    this.refreshToken = localStorage.getItem('pwa_refresh_token');
    const userRaw = localStorage.getItem('pwa_user');
    try {
      this.user = userRaw ? JSON.parse(userRaw) : null;
    } catch {
      this.user = null;
    }
  }

  setSession(session) {
    if (session) {
      this.token = session.accessToken;
      this.refreshToken = session.refreshToken || this.refreshToken;
      this.user = session.user || this.user;
      localStorage.setItem('pwa_access_token', this.token);
      if (session.refreshToken) localStorage.setItem('pwa_refresh_token', session.refreshToken);
      if (session.user) localStorage.setItem('pwa_user', JSON.stringify(session.user));
      localStorage.setItem('lakshi_auth', 'true');
    } else {
      this.token = null;
      this.refreshToken = null;
      this.user = null;
      localStorage.removeItem('pwa_access_token');
      localStorage.removeItem('pwa_refresh_token');
      localStorage.removeItem('pwa_user');
      localStorage.setItem('lakshi_auth', 'false');
    }
  }

  getUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration & refresh
    if (res.status === 401 && this.refreshToken && path !== '/auth/login' && path !== '/auth/refresh') {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        headers.set('Authorization', `Bearer ${this.token}`);
        const retryRes = await fetch(url, { ...options, headers });
        if (retryRes.ok) {
          const json = await retryRes.json();
          return json.data;
        }
      }
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const message = errorData.error?.message || `Request failed with status ${res.status}`;
      const code = errorData.error?.code || 'API_ERROR';
      const err = new Error(message);
      err.code = code;
      err.status = res.status;
      err.details = errorData.error?.details;
      throw err;
    }

    const json = await res.json();
    return json.data;
  }

  async tryRefreshToken() {
    if (!this.refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (res.ok) {
        const json = await res.json();
        this.setSession(json.data);
        return true;
      }
    } catch (e) {
      console.warn('[PWA API] Token refresh failed:', e);
    }
    return false;
  }

  // -------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    this.setSession(data);
    return data;
  }

  async logout() {
    try {
      if (this.token && this.refreshToken) {
        await this.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        }).catch(() => null);
      }
    } finally {
      this.setSession(null);
    }
  }

  async getMe() {
    return this.request('/auth/me');
  }

  // -------------------------------------------------------------
  // Offline Full Store Snapshot & Master Data
  // -------------------------------------------------------------

  async getSnapshot() {
    return this.request('/snapshot');
  }

  async getDashboard() {
    return this.request('/dashboard');
  }

  async getGroup() {
    return this.request('/group');
  }

  async getShapes() {
    return this.request('/group/shapes');
  }

  async getMembers() {
    return this.request('/members');
  }

  // -------------------------------------------------------------
  // Financial Operations
  // -------------------------------------------------------------

  /**
   * Records a meeting's member savings deposits.
   * items: array of { memberId, stamps }
   */
  async createDeposit({ date, note, items, clientId }) {
    return this.request('/deposits', {
      method: 'POST',
      body: JSON.stringify({
        date,
        note,
        items,
        clientId,
      }),
    });
  }

  /**
   * Disburses a loan using shape stamps.
   * stamps: array of { shape: 'sun' | 'star' | ... }
   */
  async createLoan({ memberId, date, stamps, clientId }) {
    return this.request('/loans', {
      method: 'POST',
      body: JSON.stringify({
        memberId,
        date,
        stamps,
        clientId,
      }),
    });
  }

  /**
   * Previews a loan repayment (interest first waterfall calculation).
   */
  async previewRepayment({ loanId, memberId, date, stamps }) {
    return this.request('/repayments/preview', {
      method: 'POST',
      body: JSON.stringify({
        loanId,
        memberId,
        date,
        stamps,
      }),
    });
  }

  /**
   * Records a loan repayment using 2% shape stamps.
   */
  async createRepayment({ loanId, memberId, date, stamps, clientId }) {
    return this.request('/repayments', {
      method: 'POST',
      body: JSON.stringify({
        loanId,
        memberId,
        date,
        stamps,
        clientId,
      }),
    });
  }
}

export const api = new ApiClient();
