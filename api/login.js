import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { send, method, readBody, cleanText } from './_lib/http.js';
import { createSession, setSession } from './_lib/auth.js';
const scrypt = promisify(scryptCallback);
async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  try {
    const body = readBody(req);
    const email = cleanText(body.email, 200).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) return send(res, 503, { ok: false, error: 'Admin credentials are not configured' });
    const validEmail = email === process.env.ADMIN_EMAIL.toLowerCase();
    const validPassword = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
    if (!validEmail || !validPassword) return send(res, 401, { ok: false, error: 'Email or password is incorrect' });
    setSession(res, createSession(email));
    send(res, 200, { ok: true, email });
  } catch { send(res, 500, { ok: false, error: 'Login failed' }); }
}
