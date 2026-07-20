import { SignJWT, jwtVerify } from 'jose';

export interface JwtPayload {
  sub: string;
  masjid_id: string;
}

const ISSUER = 'masjid-platform';
const EXPIRATION = '30 days';

export async function signAccessToken(
  payload: JwtPayload,
  secret: string,
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return new SignJWT({ sub: payload.sub, masjid_id: payload.masjid_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(secretKey);
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  const secretKey = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify<JwtPayload>(token, secretKey, {
    issuer: ISSUER,
  });
  return payload;
}