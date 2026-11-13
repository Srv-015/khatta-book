import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'khata_token';
const key = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is missing. Add it to .env.local, then restart npm run dev.');
  return new TextEncoder().encode(secret);
};

export const sign = (uid) =>
  new SignJWT({ uid }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(key());

export async function verify(token) {
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.uid || null;
  } catch {
    return null;
  }
}
