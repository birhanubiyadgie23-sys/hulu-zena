import { sqlClient, rawSqlClient } from './_lib/db.js';
import { isIP } from 'node:net';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { lookup } from 'node:dns/promises';
import { send, method, readBody, cleanText } from './_lib/http.js';
import { requireAdmin, clearSession } from './_lib/auth.js';
const scrypt = promisify(scryptCallback);
async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || '').split(String.fromCharCode(36));
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
async function validateFeedUrl(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname || url.hostname === 'localhost' || url.hostname.endsWith('.local')) return false;
  const blocked = (ip) => {
    const value = ip.toLowerCase();
    if (value.includes(':')) {
      if (value.startsWith('::ffff:')) return blocked(value.slice(7));
      return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
    }
    const parts = value.split('.').map(Number);
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || parts[0] >= 224 || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && (parts[1] === 168 || parts[1] === 0)) || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19));
  };
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return !blocked(hostname);
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every(item => !blocked(item.address));
  } catch { return false; }
}
export default async function handler(req, res) {
  // Public site profile is read-only; contact submissions are stored for the admin inbox.
  if (req.method === 'GET' && req.query?.public === '1') {
    try {
      const sql = rawSqlClient();
      const rows = await sql`SELECT key, value FROM app_settings WHERE key LIKE 'site_%'`;
      const profile = Object.fromEntries(rows.map(row => [row.key.replace(/^site_/, ''), row.value]));
      return send(res, 200, { ok: true, profile });
    } catch { return send(res, 200, { ok: true, profile: {} }); }
  }
  if (req.method === 'POST' && req.query?.contact === '1') {
    try {
      const body = readBody(req);
      const name = cleanText(body.name, 100);
      const email = cleanText(body.email, 200).toLowerCase();
      const message = cleanText(body.message, 3000);
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 8) {
        return send(res, 400, { ok: false, error: 'Please provide a name, valid email and a message of at least 8 characters.' });
      }
      const sql = sqlClient();
      await sql`INSERT INTO contact_messages (name, email, message) VALUES (${name}, ${email}, ${message})`;
      return send(res, 201, { ok: true });
    } catch { return send(res, 500, { ok: false, error: 'Message could not be saved. Please try again later.' }); }
  }
  if (req.method === 'POST' && req.url?.includes('logout')) { clearSession(res); return send(res, 200, { ok: true }); }
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return method(req, res, 'GET, POST, PATCH, DELETE');
  const email = requireAdmin(req, res); if (!email) return;
  try {
    const sql = sqlClient();
    if (req.method === 'GET') {
      const [sources, stats, runs, settings, messages] = await Promise.all([
        sql`SELECT id, name, feed_url, language, category, is_active, last_fetched_at, last_error FROM news_sources ORDER BY id`,
        sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_published)::int AS published FROM news_articles`,
        sql`SELECT id, started_at, finished_at, status, inserted_count, error_count FROM sync_runs ORDER BY id DESC LIMIT 8`,
        sql`SELECT key, value FROM app_settings WHERE key LIKE 'site_%'`,
        sql`SELECT id, name, email, message, created_at, is_read FROM contact_messages ORDER BY id DESC LIMIT 50`
      ]);
      const profile = Object.fromEntries(settings.map(row => [row.key.replace(/^site_/, ''), row.value]));
      return send(res, 200, { ok: true, email, sources, stats: stats[0], runs, profile, messages });
    }
    const body = readBody(req);
    if (req.method === 'POST' && req.query?.password === '1') {
      const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
      const newPassword = typeof body.new_password === 'string' ? body.new_password : '';
      const confirmPassword = typeof body.confirm_password === 'string' ? body.confirm_password : '';
      if (newPassword.length < 12) return send(res, 400, { ok: false, error: 'አዲሱ ፓስወርድ ቢያንስ 12 ቁምፊዎች መሆን አለበት።' });
      if (newPassword !== confirmPassword) return send(res, 400, { ok: false, error: 'አዲሱ ፓስወርድ እና ማረጋገጫው አይዛመዱም።' });
      const existing = await sql`SELECT value FROM app_settings WHERE key = 'admin_password_hash' LIMIT 1`;
      const currentHash = existing[0]?.value || process.env.ADMIN_PASSWORD_HASH || '';
      if (!(await verifyPassword(currentPassword, currentHash))) return send(res, 401, { ok: false, error: 'የአሁኑ ፓስወርድ ትክክል አይደለም።' });
      const salt = randomBytes(16).toString('hex');
      const hash = (await scrypt(newPassword, salt, 64)).toString('hex');
      const passwordHash = ['scrypt', salt, hash].join(String.fromCharCode(36));
      await sql`INSERT INTO app_settings (key, value) VALUES ('admin_password_hash', ${passwordHash}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      return send(res, 200, { ok: true, message: 'የአድሚን ፓስወርድ ተቀይሯል።' });
    }
    if (req.method === 'POST' && req.query?.profile === '1') {
      const fields = ['about_am', 'about_en', 'facebook', 'telegram', 'youtube', 'instagram', 'tiktok', 'contact_email'];
      for (const field of fields) {
        const value = cleanText(body[field], field.startsWith('about_') ? 2000 : 300);
        if (['facebook','telegram','youtube','instagram','tiktok'].includes(field) && value) {
          try { const url = new URL(value); if (url.protocol !== 'https:') return send(res, 400, { ok: false, error: 'Social links must use HTTPS.' }); }
          catch { return send(res, 400, { ok: false, error: 'Please enter valid social links.' }); }
        }
        await sql`INSERT INTO app_settings (key, value) VALUES (${'site_' + field}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      }
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST') {
      const name = cleanText(body.name, 100); const feedUrl = cleanText(body.feed_url, 500);
      if (!name || !(await validateFeedUrl(feedUrl))) return send(res, 400, { ok: false, error: 'A valid public HTTPS RSS feed URL is required' });
      const rows = await sql`INSERT INTO news_sources (name, feed_url, language, category) VALUES (${name}, ${feedUrl}, ${cleanText(body.language, 5) || 'am'}, ${cleanText(body.category, 30) || 'ethiopia'}) RETURNING id`;
      return send(res, 201, { ok: true, id: rows[0].id });
    }
    const id = Number(req.query?.id || body.id);
    if (!Number.isSafeInteger(id) || id < 1) return send(res, 400, { ok: false, error: 'Valid source id required' });
    if (req.method === 'PATCH') {
      await sql`UPDATE news_sources SET is_active = ${Boolean(body.is_active)} WHERE id = ${id}`;
      return send(res, 200, { ok: true });
    }
    await sql`DELETE FROM news_sources WHERE id = ${id}`;
    return send(res, 200, { ok: true });
  } catch (error) { send(res, 500, { ok: false, error: 'Admin request failed' }); }
}
