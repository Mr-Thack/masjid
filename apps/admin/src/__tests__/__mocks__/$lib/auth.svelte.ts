class AuthStore {
  admin = $state({ id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' });
  token = $state('test-token');
  loading = $state(false);

  get isAuthenticated() { return true; }

  async login() { return this.admin; }
  logout() { this.admin = null; this.token = null; }
  async checkAuth() { return true; }
}

export const auth = new AuthStore();
