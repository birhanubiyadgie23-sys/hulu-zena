import { sqlClient } from './_lib/db.js';
import { send, method } from './_lib/http.js';
export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  try {
    const sql = sqlClient();
    const category = typeof req.query?.category === 'string' ? req.query.category.slice(0, 30) : 'all';
    const limit = Math.min(60, Math.max(1, Number.parseInt(req.query?.limit || '30', 10) || 30));
    const language = ['am', 'en'].includes(req.query?.language) ? req.query.language : 'all';
    const rows = await sql`SELECT a.id, a.title, a.summary, a.original_url, a.image_url, a.category, a.language, a.published_at, a.fetched_at, s.name AS source_name FROM news_articles a LEFT JOIN news_sources s ON s.id = a.source_id WHERE a.is_published = TRUE AND (${category} = 'all' OR a.category = ${category}) AND (${language} = 'all' OR a.language = ${language}) ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT ${limit}`;
    send(res, 200, { ok: true, articles: rows });
  } catch (error) { send(res, 500, { ok: false, error: 'News service unavailable' }); }
}
