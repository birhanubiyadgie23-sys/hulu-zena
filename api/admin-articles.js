import { sqlClient } from './_lib/db.js';
import { send, method, readBody } from './_lib/http.js';
import { requireAdmin } from './_lib/auth.js';
export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) return method(req, res, 'GET, PATCH');
  if (!requireAdmin(req, res)) return;
  try {
    const sql = sqlClient();
    if (req.method === 'GET') {
      const articles = await sql`SELECT id, title, category, language, is_published, published_at, original_url FROM news_articles ORDER BY fetched_at DESC LIMIT 35`;
      return send(res, 200, { ok: true, articles });
    }
    const id = Number(req.query?.id);
    if (!Number.isSafeInteger(id) || id < 1) return send(res, 400, { ok: false, error: 'Valid article id required' });
    const body = readBody(req);
    await sql`UPDATE news_articles SET is_published = ${Boolean(body.is_published)} WHERE id = ${id}`;
    return send(res, 200, { ok: true });
  } catch { send(res, 500, { ok: false, error: 'Article management failed' }); }
}
