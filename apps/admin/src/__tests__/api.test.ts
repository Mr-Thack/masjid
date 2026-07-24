import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('api client', () => {
  const mockToken = 'test-jwt-token';

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('$lib/auth.svelte', () => ({
      auth: {
        token: mockToken,
        admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
        logout: vi.fn(),
      },
    }));
  });

  async function getApi() {
    const mod = await import('$lib/api');
    return mod.api;
  }

  it('getProfile() calls correct URL with auth header', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ name: 'Test Masjid' }),
    } as Response);

    const api = await getApi();
    await api.getProfile('m1');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: undefined,
    });
  });

  it('updateProfile() sends PUT with body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.updateProfile('m1', { name: 'Updated' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ name: 'Updated' }),
    });
  });

  it('getPrayerRules() returns parsed data', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rules: [{ id: 'r1', prayer: 'fajr' }] }),
    } as Response);

    const api = await getApi();
    const result = await api.getPrayerRules('m1');
    expect(result).toEqual({ rules: [{ id: 'r1', prayer: 'fajr' }] });
  });

  it('createPrayerRule() sends POST with body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'r1' }),
    } as Response);

    const api = await getApi();
    await api.createPrayerRule('m1', { prayer: 'fajr', condition: {} });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/prayer/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ prayer: 'fajr', condition: {} }),
    });
  });

  it('deletePrayerRule() sends DELETE', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.deletePrayerRule('m1', 'r1');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/prayer/rules/r1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: undefined,
    });
  });

  it('reorderPrayerRules() sends PUT with order array', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.reorderPrayerRules('m1', ['r2', 'r1', 'r3']);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/prayer/rules/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ order: ['r2', 'r1', 'r3'] }),
    });
  });

  it('getJumuah() returns parsed sessions', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sessions: [{ id: 'j1', label: 'English' }] }),
    } as Response);

    const api = await getApi();
    const result = await api.getJumuah('m1');
    expect(result).toEqual({ sessions: [{ id: 'j1', label: 'English' }] });
  });

  it('createJumuah() sends POST with data', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'j1' }),
    } as Response);

    const api = await getApi();
    await api.createJumuah('m1', { label: 'English', time: '13:30' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/jumuah', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ label: 'English', time: '13:30' }),
    });
  });

  it('deleteJumuah() sends DELETE', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.deleteJumuah('m1', 'j1');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/jumuah/j1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: undefined,
    });
  });

  it('getAnnouncements() returns parsed list', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ announcements: [{ id: 'ann1', title: 'Hello' }] }),
    } as Response);

    const api = await getApi();
    const result = await api.getAnnouncements('m1');
    expect(result).toEqual({ announcements: [{ id: 'ann1', title: 'Hello' }] });
  });

  it('createAnnouncement() sends POST with title and content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'ann1' }),
    } as Response);

    const api = await getApi();
    await api.createAnnouncement('m1', { title: 'Test', content: 'Body' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ title: 'Test', content: 'Body' }),
    });
  });

  it('agentChat() sends POST with message', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Done', diff: null }),
    } as Response);

    const api = await getApi();
    await api.agentChat('m1', { message: 'hello' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ message: 'hello' }),
    });
  });

  it('agentConfirm() sends POST with branch_id', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.agentConfirm('m1', 'br1');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/agent/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ branch_id: 'br1' }),
    });
  });

  it('agentCancel() sends POST with branch_id', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.agentCancel('m1', 'br1');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/agent/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ branch_id: 'br1' }),
    });
  });

  it('calls logout on 401 response', async () => {
    const mockLogout = vi.fn();
    vi.resetModules();
    vi.doMock('$lib/auth.svelte', () => ({
      auth: {
        token: mockToken,
        admin: { id: 'a1', email: 'admin@test.org', display_name: 'Admin', masjid_id: 'm1' },
        logout: mockLogout,
      },
    }));

    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    } as Response);

    const mod = await import('$lib/api');
    await expect(mod.api.getProfile('m1')).rejects.toThrow('Session expired');
    expect(mockLogout).toHaveBeenCalled();
  });

  it('getPrayerConfig() calls correct URL', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ calculation_method: 2 }),
    } as Response);

    const api = await getApi();
    await api.getPrayerConfig('m1');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/prayer', expect.any(Object));
  });

  it('updatePrayerConfig() sends PATCH with data', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.updatePrayerConfig('m1', { calculation_method: 3 });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/prayer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ calculation_method: 3 }),
    });
  });

  it('getDomains() calls correct URL', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ domain: null }),
    } as Response);

    const api = await getApi();
    const result = await api.getDomains('m1');
    expect(result).toEqual({ domain: null });
  });

  it('changePassword() sends PUT with passwords', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.changePassword('m1', { current_password: 'old', new_password: 'new123456' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/admin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ current_password: 'old', new_password: 'new123456' }),
    });
  });

  it('getBranches() calls correct URL', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ branches: [] }),
    } as Response);

    const api = await getApi();
    const result = await api.getBranches('m1');
    expect(result).toEqual({ branches: [] });
  });

  it('updateJumuah() sends PUT with partial data', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.updateJumuah('m1', 'j1', { label: 'Updated' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/jumuah/j1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: JSON.stringify({ label: 'Updated' }),
    });
  });

  it('pinAnnouncement() sends PUT to pin endpoint', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    const api = await getApi();
    await api.pinAnnouncement('m1', 'ann-slug');

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/admin/masjids/m1/announcements/ann-slug/pin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mockToken}` },
      body: undefined,
    });
  });

  it('throws on non-OK response that is not 401', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Server error' }),
    } as Response);

    const api = await getApi();
    await expect(api.getProfile('m1')).rejects.toThrow('Server error');
  });

  it('throws generic error when error response is not JSON', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    } as Response);

    const api = await getApi();
    await expect(api.getProfile('m1')).rejects.toThrow('HTTP 502');
  });
});
