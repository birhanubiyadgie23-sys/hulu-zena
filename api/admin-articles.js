import { randomUUID, createHash } from 'node:crypto';
import { sqlClient } from './_lib/db.js';
import { send, method, readBody, cleanText } from './_lib/http.js';
import { requireAdmin } from './_lib/auth.js';

const categories = new Set(['ethiopia', 'world', 'politics', 'business', 'technology', 'sports', 'economy']);
function safeImage(value) {
  if (!value) return null;
  try { const u = new URL(value); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
}
function validate(body) {
  const title = cleanText(body.title, 250);
  const content = String(body.content || '').trim().slice(0, 30000);
  const category = categories.has(body.category) ? body.category : 'ethiopia';
  const language = body.language === 'en' ? 'en' : 'am';
  const image = body.image_url ? safeImage(cleanText(body.image_url, 1000)) : null;
  if (!title || content.length < 30) return { error: 'የዜና ርዕስና ቢያንስ 30 ፊደል ያለው ይዘት ያስፈልጋል።' };
  if (body.image_url && !image) return { error: 'የምስል አድራሻ HTTPS መሆን አለበት።' };
  return { title, content, category, language, image, published: body.is_published !== false };
}
export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return method(req, res, 'GET, POST, PATCH');
  if (!requireAdmin(req, res)) return;
  try {
    const sql = sqlClient();
    if (req.method === 'GET') {
      if (req.query?.id) {
        const id = Number(req.query.id);
        if (!Number.isSafeInteger(id) || id < 1) return send(res, 400, { ok: false, error: 'Valid article id required' });
        const rows = await sql`SELECT id, title, summary, source_content, source_name, image_url, category, language, is_published, published_at, original_url FROM news_articles WHERE id = ${id} LIMIT 1`;
        if (!rows.length) return send(res, 404, { ok: false, error: 'ዜናው አልተገኘም።' });
        return send(res, 200, { ok: true, article: rows[0] });
      }
      const articles = await sql`SELECT id, title, source_name, image_url, category, language, is_published, published_at, original_url FROM news_articles ORDER BY fetched_at DESC, id DESC`;
      return send(res, 200, { ok: true, articles, total: articles.length });
    }
    const body = readBody(req);
    if (req.method === 'POST') {
      const v = validate(body);
      if (v.error) return send(res, 400, { ok: false, error: v.error });
      const unique = randomUUID();
      const internalUrl = 'https://hulu-zena.vercel.app/editorial/' + unique;
      const fingerprint = createHash('sha256').update(unique).digest('hex');
      const rows = await sql`INSERT INTO news_articles
        (title, summary, source_content, summary_status, source_name, original_url, image_url, category, language, published_at, is_published, fingerprint)
        VALUES (${v.title}, ${v.content}, ${v.content}, 'ready', 'HULU ZENA', ${internalUrl}, ${v.image}, ${v.category}, ${v.language}, NOW(), ${v.published}, ${fingerprint})
        RETURNING id`;
      return send(res, 201, { ok: true, id: rows[0].id });
    }
    const id = Number(req.query?.id);
    if (!Number.isSafeInteger(id) || id < 1) return send(res, 400, { ok: false, error: 'Valid article id required' });
    if (Object.hasOwn(body, 'title')) {
      const v = validate(body);
      if (v.error) return send(res, 400, { ok: false, error: v.error });
      await sql`UPDATE news_articles SET title=${v.title}, summary=${v.content}, source_content=${v.content}, summary_status='ready', image_url=${v.image}, category=${v.category}, language=${v.language}, is_published=${v.published}, published_at=COALESCE(published_at,NOW()) WHERE id=${id}`;
    } else {
      await sql`UPDATE news_articles SET is_published = ${Boolean(body.is_published)} WHERE id = ${id}`;
    }
    return send(res, 200, { ok: true });
  } catch (error) {
    console.error('[api/admin-articles] request failed:', error?.message || error);
    send(res, 500, { ok: false, error: 'የዜና አስተዳደር ጥያቄው አልተሳካም።' });
  }
}
