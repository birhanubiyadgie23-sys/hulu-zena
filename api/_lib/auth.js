import { createHmac, timingSafeEqual } from 'node:crypto';
import { send } from './http.js';

const COOKIE = 'hz_admin';
const b64 = (value) => Buffer.from(value).toString('base64url');
const sign = (value) => createHmac('sha256', process.env.SESSION_SECRET || '').update(value).digest('base64url');

export function createSession(email) {
  const payload = b64(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 }));
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return `${payload}.${sign(payload)}`;
}
export function setSession(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`);
}
export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}
export function sessionEmail(req) {
  const raw = req.headers.cookie || '';
  const token = raw.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() && data.email === process.env.ADMIN_EMAIL.toLowerCase() ? data.email : null;
  } catch { return null; }
}
export function requireAdmin(req, res) {
  const email = sessionEmail(req);
  if (!email) { send(res, 401, { ok: false, error: 'Authentication required' }); return null; }
  return email;
}
