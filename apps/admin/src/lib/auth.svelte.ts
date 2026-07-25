interface AdminRecord {
  id: string;
  email: string;
  display_name: string | null;
  masjid_id: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

class AuthStore {
  admin = $state<AdminRecord | null>(null);
  token = $state<string | null>(null);
  loading = $state(true);

  get isAuthenticated(): boolean {
    return !!(this.admin && this.token);
  }

  async register(data: {
    slug: string;
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    calculation_method: number;
    admin_email: string;
    admin_password: string;
    admin_display_name?: string;
  }): Promise<AdminRecord> {
    const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Registration failed' }));
      throw new Error(err.message || 'Registration failed');
    }

    const result = await res.json();
    this.token = result.token;
    this.admin = {
      id: result.admin.id,
      email: result.admin.email,
      display_name: result.admin.display_name ?? null,
      masjid_id: result.admin.masjid_id,
    };
    localStorage.setItem('admin_token', result.token);
    localStorage.setItem('admin_user', JSON.stringify(this.admin));
    return this.admin;
  }

  async login(email: string, password: string): Promise<AdminRecord> {
    const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(err.message || 'Invalid email or password');
    }

    const data = await res.json();
    this.token = data.token;
    this.admin = {
      id: data.admin.id,
      email: data.admin.email,
      display_name: data.admin.display_name ?? null,
      masjid_id: data.admin.masjid_id,
    };
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(this.admin));
    return this.admin;
  }

  logout() {
    this.admin = null;
    this.token = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  }

  async checkAuth(): Promise<boolean> {
    this.loading = true;
    try {
      const stored = localStorage.getItem('admin_token');
      const userStr = localStorage.getItem('admin_user');

      if (!stored || !userStr) {
        this.loading = false;
        return false;
      }

      this.token = stored;
      this.admin = JSON.parse(userStr);

      const res = await fetch(`${API_BASE}/api/v1/admin/masjids/${this.admin!.masjid_id}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!res.ok) {
        this.logout();
        this.loading = false;
        return false;
      }

      this.loading = false;
      return true;
    } catch {
      this.logout();
      this.loading = false;
      return false;
    }
  }
}

export const auth = new AuthStore();
