interface AdminRecord {
  id: string;
  email: string;
  display_name: string | null;
  masjid_id: string;
}

class AuthStore {
  admin = $state<AdminRecord | null>(null);
  token = $state<string | null>(null);
  loading = $state(true);

  get isAuthenticated(): boolean {
    return !!(this.admin && this.token);
  }

  async login(email: string, password: string): Promise<AdminRecord> {
    const res = await fetch('/api/v1/auth/login', {
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

      const res = await fetch(`/api/v1/admin/masjids/${this.admin!.masjid_id}`, {
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
