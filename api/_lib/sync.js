import Parser from 'rss-parser';
import { createHash } from 'node:crypto';
import { sqlClient } from './db.js';

const parser = new Parser({ timeout: 12000, headers: { 'User-Agent': 'HuluZenaNewsBot/1.0 (+RSS reader; contact site administrator)' } });
const safeUrl = (value) => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; }
  catch { return null; }
};
const plain = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 650);
const fingerprint = (title) => createHash('sha256').update(plain(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')).digest('hex');

export async function syncFeeds() {
  const sql = sqlClient();
  const sources = await sql`SELECT * FROM news_sources WHERE is_active = TRUE ORDER BY id`;
  const feedResults = await Promise.all(sources.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.feed_url);
      const items = (feed.items || []).slice(0, 30).map((item) => {
        const title = plain(item.title);
        const url = safeUrl(item.link || item.guid);
        if (!title || !url) return null;
        const published = item.isoDate || item.pubDate || null;
        return {
          sourceId: source.id,
          sourceName: source.name,
          title,
          summary: plain(item.contentSnippet || item.summary || item.content || item.description || ''),
          url,
          category: source.category,
          language: source.language,
          published: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null,
          fingerprint: fingerprint(title)
        };
      }).filter(Boolean);
      return { source, items, error: null };
    } catch (error) {
      return { source, items: [], error: String(error?.message || 'Feed error').slice(0, 300) };
    }
  }));

  const candidates = [];
  const seen = new Set();
  let errors = 0;
  const details = feedResults.map(({ source, items, error }) => {
    if (error) errors++;
    for (const item of items) {
      if (seen.has(item.fingerprint)) continue;
      seen.add(item.fingerprint);
      candidates.push(item);
    }
    return { sourceId: source.id, source: source.name, inserted: 0, status: error ? 'error' : 'ok', ...(error ? { error } : {}) };
  });

  // Limit concurrent database requests to keep the serverless function predictable.
  for (let offset = 0; offset < candidates.length; offset += 10) {
    const batch = candidates.slice(offset, offset + 10);
    const outcomes = await Promise.all(batch.map(async (item) => {
      try {
        const result = await sql`
          INSERT INTO news_articles (source_id, title, summary, original_url, image_url, category, language, published_at, fingerprint)
          SELECT ${item.sourceId}, ${item.title}, ${item.summary}, ${item.url}, NULL, ${item.category}, ${item.language}, ${item.published}, ${item.fingerprint}
          WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE fingerprint = ${item.fingerprint} AND fetched_at > NOW() - INTERVAL '48 hours')
          ON CONFLICT (original_url) DO NOTHING RETURNING id`;
        return { item, inserted: result.length > 0, error: null };
      } catch (error) {
        return { item, inserted: false, error: String(error?.message || 'Database insert failed').slice(0, 200) };
      }
    }));
    for (const outcome of outcomes) {
      const detail = details.find((entry) => entry.sourceId === outcome.item.sourceId);
      if (outcome.inserted) detail.inserted++;
      if (outcome.error) { errors++; detail.status = 'error'; detail.error = outcome.error; }
    }
  }

  await Promise.all(feedResults.map(async ({ source, error }) => {
    await sql`UPDATE news_sources SET last_fetched_at = NOW(), last_error = ${error} WHERE id = ${source.id}`;
  }));
  const inserted = details.reduce((sum, entry) => sum + entry.inserted, 0);
  return { inserted, errors, details: details.map(({ sourceId, ...detail }) => detail) };
}
