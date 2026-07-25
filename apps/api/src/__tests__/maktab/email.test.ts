import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendParentConfirmation } from '../../lib/server/maktab/email';
import type { MaktabConfig } from '../../lib/server/maktab/types';

const ENV: MaktabConfig = {
  BREVO_API_KEY: 'brevo-key',
  SENDER_EMAIL: 'noreply@masjid.org',
  SENDER_NAME: 'Masjid Maktab',
  FORWARD_TO_EMAIL: 'info@masjid.org',
  LOGGING_EMAIL: 'log@masjid.org',
  BOT_NAME: 'masjid-api',
};

const REGISTRATION = {
  father: { name: 'Ali Baba', email: 'ali@example.com', phone: '+14155551001' },
  mother: { name: 'Fatima Baba', email: 'fatima@example.com', phone: '+14155551002' },
  address_line1: '456 Oak Ave',
  city: 'Decatur',
  state: 'GA',
  postal_code: '30030',
  country: 'US',
  children: [
    { name: 'Hasan', dob: '2014-02-14', sex: 'male' },
    { name: 'Husayn', dob: '2016-08-22', sex: 'male' },
  ],
};

const TERM_INFO = {
  name: 'Fall 2026',
  length_months: 4,
  monthly_cost_cents: 16000,
};

describe('sendParentConfirmation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips when BREVO_API_KEY is not configured', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendParentConfirmation(REGISTRATION, TERM_INFO, {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('BREVO_API_KEY'));
    warnSpy.mockRestore();
  });

  it('sends email successfully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: 'msg-1' }), { status: 200 })));

    await expect(sendParentConfirmation(REGISTRATION, TERM_INFO, ENV)).resolves.toBeUndefined();

    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>;
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('brevo-key');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.sender.email).toBe('noreply@masjid.org');
    expect(body.subject).toContain('Maktab Registration');
    expect(body.to).toHaveLength(2);
    expect(body.to[0].email).toBe('ali@example.com');
    expect(body.to[1].email).toBe('fatima@example.com');
  });

  it('includes BCC when LOGGING_EMAIL is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(REGISTRATION, TERM_INFO, ENV);

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.bcc).toHaveLength(1);
    expect(body.bcc[0].email).toBe('log@masjid.org');
  });

  it('skips BCC when LOGGING_EMAIL is not set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(REGISTRATION, TERM_INFO, { ...ENV, LOGGING_EMAIL: undefined });

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.bcc).toBeUndefined();
  });

  it('skips when no parent email is provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sendParentConfirmation(
      { ...REGISTRATION, father: { name: 'Ali', email: undefined as any }, mother: undefined },
      TERM_INFO,
      ENV,
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No parent email'));
    warnSpy.mockRestore();
  });

  it('handles father-only registration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(
      { ...REGISTRATION, mother: undefined },
      TERM_INFO,
      ENV,
    );

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.to).toHaveLength(1);
    expect(body.to[0].email).toBe('ali@example.com');
  });

  it('handles mother-only registration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(
      { ...REGISTRATION, father: undefined },
      TERM_INFO,
      { ...ENV, FORWARD_TO_EMAIL: 'info@masjid.org' },
    );

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.to[0].email).toBe('fatima@example.com');
  });

  it('throws on Brevo API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })));

    await expect(sendParentConfirmation(REGISTRATION, TERM_INFO, ENV)).rejects.toThrow('Brevo API error: 401');
  });

  it('generates HTML content with student table', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation({ ...REGISTRATION, mother: undefined }, TERM_INFO, ENV);

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.htmlContent).toContain('Hasan');
    expect(body.htmlContent).toContain('Husayn');
    expect(body.htmlContent).toContain('$160.00');
    expect(body.htmlContent).toContain('$640.00');
    expect(body.htmlContent).toContain('Barakallahu Feekum');
    expect(body.htmlContent).toContain('No refunds');
  });

  it('generates plain text content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(REGISTRATION, TERM_INFO, ENV);

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.textContent).toContain('Hasan');
    expect(body.textContent).toContain('$160.00');
    expect(body.textContent).toContain('Barakallahu Feekum');
  });

  it('greets both parents by first name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(REGISTRATION, TERM_INFO, ENV);

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.htmlContent).toContain('Ali and Fatima');
    expect(body.textContent).toContain('Ali and Fatima');
  });

  it('greets single parent by first name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(
      { ...REGISTRATION, mother: undefined },
      TERM_INFO,
      ENV,
    );

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.htmlContent).toContain('Dear Ali,');
    expect(body.textContent).toContain('Dear Ali,');
  });

  it('falls back to "Parent/Guardian" when no parent names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(
      { ...REGISTRATION, father: undefined, mother: { name: undefined, email: 'mom@test.com', phone: '+14155551002' } },
      TERM_INFO,
      ENV,
    );

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.htmlContent).toContain('Parent/Guardian');
  });

  it('correctly creates total cost from monthly * length', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation(REGISTRATION, { name: 'Short', length_months: 2, monthly_cost_cents: 7500 }, ENV);

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.htmlContent).toContain('$150.00');
  });

  it('escapes HTML in child names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));

    await sendParentConfirmation({
      ...REGISTRATION,
      mother: undefined,
      children: [{ name: '<script>alert("xss")</script>', dob: '2014-01-01', sex: 'male' }],
    }, TERM_INFO, ENV);

    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.htmlContent).not.toContain('<script>');
    expect(body.htmlContent).toContain('&lt;script&gt;');
  });
});