import { sqlClient } from './_lib/db.js';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { send, method, readBody, cleanText } from './_lib/http.js';
import { requireAdmin, clearSession } from './_lib/auth.js';
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
  if (req.method === 'POST' && req.url?.includes('logout')) { clearSession(res); return send(res, 200, { ok: true }); }
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return method(req, res, 'GET, POST, PATCH, DELETE');
  const email = requireAdmin(req, res); if (!email) return;
  try {
    const sql = sqlClient();
    if (req.method === 'GET') {
      const [sources, stats, runs] = await Promise.all([
        sql`SELECT id, name, feed_url, language, category, is_active, last_fetched_at, last_error FROM news_sources ORDER BY id`,
        sql`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_published)::int AS published FROM news_articles`,
        sql`SELECT id, started_at, finished_at, status, inserted_count, error_count FROM sync_runs ORDER BY id DESC LIMIT 8`
      ]);
      return send(res, 200, { ok: true, email, sources, stats: stats[0], runs });
    }
    const body = readBody(req);
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
