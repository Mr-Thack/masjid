import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Import from actual source files
// ---------------------------------------------------------------------------
import { hashPassword, verifyPassword } from '$lib/server/auth/password';
import { signAccessToken, verifyAccessToken } from '$lib/server/auth/jwt';

// ---------------------------------------------------------------------------
// Test secret (must be the same for sign + verify)
// ---------------------------------------------------------------------------
const TEST_SECRET = 'test-secret-key-for-jwt-signing-min-32-chars!!';

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------
describe('password hashing', () => {
  describe('hashPassword', () => {
    it('produces a string output', async () => {
      const hash = await hashPassword('mySecret123');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('produces different hashes for the same password (salt)', async () => {
      const hash1 = await hashPassword('mySecret123');
      const hash2 = await hashPassword('mySecret123');
      expect(hash1).not.toBe(hash2);
    });

    it('handles short passwords', async () => {
      const hash = await hashPassword('ab');
      expect(typeof hash).toBe('string');
    });

    it('handles long passwords', async () => {
      const longPassword = 'a'.repeat(128);
      const hash = await hashPassword(longPassword);
      expect(typeof hash).toBe('string');
    });

    it('handles special characters in password', async () => {
      const hash = await hashPassword('p@$$w0rd!@#$%^&*()');
      expect(typeof hash).toBe('string');
    });

    it('handles unicode characters in password', async () => {
      const hash = await hashPassword('مرحبا123!');
      expect(typeof hash).toBe('string');
    });
  });

  describe('verifyPassword', () => {
    it('returns true for correct password', async () => {
      const hash = await hashPassword('mySecret123');
      const result = await verifyPassword('mySecret123', hash);
      expect(result).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await hashPassword('mySecret123');
      const result = await verifyPassword('wrongPassword', hash);
      expect(result).toBe(false);
    });

    it('returns false for correct password with different case', async () => {
      const hash = await hashPassword('mySecret123');
      const result = await verifyPassword('MySecret123', hash);
      expect(result).toBe(false);
    });

    it('returns false for empty password', async () => {
      const hash = await hashPassword('mySecret123');
      const result = await verifyPassword('', hash);
      expect(result).toBe(false);
    });

    it('handles multiple sequential verifications', async () => {
      const hash = await hashPassword('testPassword');
      expect(await verifyPassword('testPassword', hash)).toBe(true);
      expect(await verifyPassword('testPassword', hash)).toBe(true);
      expect(await verifyPassword('wrong', hash)).toBe(false);
    });

    it('different hashes verify correctly for same password', async () => {
      const hash1 = await hashPassword('samePassword');
      const hash2 = await hashPassword('samePassword');

      expect(await verifyPassword('samePassword', hash1)).toBe(true);
      expect(await verifyPassword('samePassword', hash2)).toBe(true);
      // Using one hash as plaintext should not verify against the other hash
      expect(await verifyPassword(hash1, hash2)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
describe('JWT', () => {
  const testPayload = {
    sub: 'admin-abc-123',
    masjid_id: 'masjid-xyz-789',
  };

  describe('signAccessToken', () => {
    it('returns a string token', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);
    });

    it('returns JWT with three dot-separated parts', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('produces different tokens with different payloads', async () => {
      const token1 = await signAccessToken({ sub: 'admin-a', masjid_id: 'masjid-1' }, TEST_SECRET);
      const token2 = await signAccessToken({ sub: 'admin-b', masjid_id: 'masjid-2' }, TEST_SECRET);
      expect(token1).not.toBe(token2);
    });

    it('produces different tokens for same payload at different times', async () => {
      const token1 = await signAccessToken(testPayload, TEST_SECRET);
      await new Promise((r) => setTimeout(r, 1100));
      const token2 = await signAccessToken(testPayload, TEST_SECRET);
      expect(token1).not.toBe(token2);
    });

    it('includes sub and masjid_id in payload', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const payload = await verifyAccessToken(token, TEST_SECRET);
      expect(payload.sub).toBe('admin-abc-123');
      expect(payload.masjid_id).toBe('masjid-xyz-789');
    });
  });

  describe('verifyAccessToken', () => {
    it('returns correct payload for valid token', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const payload = await verifyAccessToken(token, TEST_SECRET);
      expect(payload.sub).toBe('admin-abc-123');
      expect(payload.masjid_id).toBe('masjid-xyz-789');
    });

    it('returns payload with expected claims (sub, masjid_id)', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const payload = await verifyAccessToken(token, TEST_SECRET);
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('masjid_id');
      expect(typeof payload.sub).toBe('string');
      expect(typeof payload.masjid_id).toBe('string');
    });

    it('throws on invalid/tampered token', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const tampered = token.slice(0, -5) + 'XXXXX';
      await expect(verifyAccessToken(tampered, TEST_SECRET)).rejects.toThrow();
    });

    it('throws on completely malformed token', async () => {
      await expect(verifyAccessToken('not-a-jwt-token', TEST_SECRET)).rejects.toThrow();
    });

    it('throws on empty token', async () => {
      await expect(verifyAccessToken('', TEST_SECRET)).rejects.toThrow();
    });

    it('throws on token signed with wrong secret', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      await expect(verifyAccessToken(token, 'wrong-secret-key-for-testing-!!!!')).rejects.toThrow();
    });

    it('accepts token from same signer', async () => {
      const token1 = await signAccessToken(testPayload, TEST_SECRET);
      const token2 = await signAccessToken(testPayload, TEST_SECRET);

      const payload1 = await verifyAccessToken(token1, TEST_SECRET);
      const payload2 = await verifyAccessToken(token2, TEST_SECRET);

      expect(payload1.sub).toBe(payload2.sub);
      expect(payload1.masjid_id).toBe(payload2.masjid_id);
    });
  });

  describe('token claims', () => {
    it('token has exp claim', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const payload = await verifyAccessToken(token, TEST_SECRET);
      expect(payload).toHaveProperty('exp');
      expect(typeof (payload as any).exp).toBe('number');
    });

    it('token has iat claim', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const payload = await verifyAccessToken(token, TEST_SECRET);
      expect(payload).toHaveProperty('iat');
      expect(typeof (payload as any).iat).toBe('number');
    });

    it('exp is after iat', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const payload = await verifyAccessToken(token, TEST_SECRET) as any;
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('iss is masjid-platform', async () => {
      const token = await signAccessToken(testPayload, TEST_SECRET);
      const payload = await verifyAccessToken(token, TEST_SECRET) as any;
      // The issuer is verified by jose, so presence means it matches 'masjid-platform'
      expect(payload.iss).toBe('masjid-platform');
    });
  });

  describe('round-trip with real-world data', () => {
    it('handles UUID-style identifiers in claims', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const payload = { sub: uuid, masjid_id: uuid };
      const token = await signAccessToken(payload, TEST_SECRET);
      const verified = await verifyAccessToken(token, TEST_SECRET);
      expect(verified.sub).toBe(uuid);
      expect(verified.masjid_id).toBe(uuid);
    });

    it('handles sequential sign/verify for multiple masjids', async () => {
      const ids = ['masjid-a', 'masjid-b', 'masjid-c'];
      for (const id of ids) {
        const token = await signAccessToken({ sub: `admin-${id}`, masjid_id: id }, TEST_SECRET);
        const payload = await verifyAccessToken(token, TEST_SECRET);
        expect(payload.masjid_id).toBe(id);
      }
    });
  });
});