import Parser from 'rss-parser';
import { sqlClient } from './_lib/db.js';
import { send, method } from './_lib/http.js';
import { getImageUrl, getCategory } from './_lib/news-utils.js';

const parser = new Parser({
  timeout: 6000,
  headers: { 'User-Agent': 'HuluZenaNewsBot/1.0 (+RSS reader)' },
  customFields: { item: ['media:content', 'media:thumbnail', 'content:encoded', 'itunes:image'] }
});

const fallbackCache = new Map();
const FALLBACK_CACHE_MS = 60_000;
const INGEST_MAX_AGE_MS = 60 * 60 * 1000;

async function parseFeedWithRetry(url) {
  return parser.parseURL(url);
}

const FALLBACK_SOURCES = [
  { name: 'VOA Amharic - Ethiopia', url: 'https://amharic.voanews.com/api/ztbgtl-vomx-tpekvbv', language: 'am', category: 'ethiopia' },
  { name: 'VOA Amharic - World', url: 'https://amharic.voanews.com/api/ziibql-vomx-tpemgqqo', language: 'am', category: 'world' },
  { name: 'Fana Media Corporation - Amharic', url: 'https://www.fanamc.com/feed/', language: 'am', category: 'ethiopia' },
  { name: 'VOA English - Africa', url: 'https://www.voanews.com/api/z-botl-vomx-tpertmq', language: 'en', category: 'world' },
  { name: 'VOA English - United States', url: 'https://www.voanews.com/api/zqboml-vomx-tpeivmy', language: 'en', category: 'world' },
  { name: 'VOA English - Economy and Business', url: 'https://www.voanews.com/api/zyboql-vomx-tpetvmi', language: 'en', category: 'economy' },
  { name: 'VOA English - Technology', url: 'https://www.voanews.com/api/zyritl-vomx-tpettmq', language: 'en', category: 'technology' },
  { name: 'VOA English - International Edition', url: 'https://www.voanews.com/api/zumgqol-vomx-tpeg--qi', language: 'en', category: 'world' },
  { name: 'Deutsche Welle - English', url: 'https://rss.dw.com/xml/rss-en-all', language: 'en', category: 'world' },
  { name: 'Al Jazeera - English', url: 'https://www.aljazeera.com/xml/rss/all.xml', language: 'en', category: 'world' },
  { name: 'The Guardian - World', url: 'https://www.theguardian.com/world/rss', language: 'en', category: 'world' },
  { name: 'NPR - World', url: 'https://feeds.npr.org/1004/rss.xml', language: 'en', category: 'world' }
];

function plain(value, max = 650) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, Math.min(max, 220));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function sendCached(res, data, cacheControl) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.end(JSON.stringify(data));
}

async function readFallbackFeeds({ category, language, limit }) {
  const cacheKey = `${category}:${language}`;
  const cached = fallbackCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < FALLBACK_CACHE_MS) return cached.articles.slice(0, limit);

  const groups = await Promise.all(FALLBACK_SOURCES
    .filter((source) => language === 'all' || source.language === language)
    .map(async (source) => {
      try {
        const feed = await parseFeedWithRetry(source.url);
        return (feed.items || []).slice(0, 25).map((item) => {
          const title = plain(item.title, 250);
          const originalUrl = safeUrl(item.link || item.guid || '');
          if (!title || !originalUrl) return null;
          const dateValue = item.isoDate || item.pubDate || null;
          const publishedAt = dateValue && !Number.isNaN(Date.parse(dateValue))
            ? new Date(dateValue).toISOString()
            : null;
          return {
            id: originalUrl,
            title,
            summary: plain(item.contentSnippet || item.summary || item.content || item.description || '', 500),
            original_url: originalUrl,
            image_url: getImageUrl(item),
            category: getCategory(item, source.category),
            language: source.language,
            published_at: publishedAt,
            fetched_at: new Date().toISOString(),
            source_name: source.name
          };
        }).filter(Boolean);
      } catch {
        return [];
      }
    }));

  const unique = new Map();
  for (const article of groups.flat()) {
    if (!unique.has(article.original_url)) unique.set(article.original_url, article);
  }

  // Only display stories published within the last hour.
  const articles = [...unique.values()]
    .filter((article) => category === 'all' || article.category === category)
    .filter((article) => article.published_at && Date.parse(article.published_at) >= Date.now() - INGEST_MAX_AGE_MS && Date.parse(article.published_at) <= Date.now() + 5 * 60_000)
    .sort((a, b) => Date.parse(b.published_at || b.fetched_at) - Date.parse(a.published_at || a.fetched_at));
  if (articles.length) fallbackCache.set(cacheKey, { cachedAt: Date.now(), articles });
  return articles.slice(0, limit);
}

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;

  const category = typeof req.query?.category === 'string' ? req.query.category.slice(0, 30) : 'all';
  const limit = Math.min(60, Math.max(1, Number.parseInt(req.query?.limit || '30', 10) || 30));
  const language = ['am', 'en'].includes(req.query?.language) ? req.query.language : 'all';

  // Prefer stored stories so successfully imported articles remain visible for ten days.
  if (process.env.DATABASE_URL) {
    try {
      const sql = sqlClient();
      if (req.query?.id) {
        const id = Number(req.query.id);
        if (!Number.isSafeInteger(id) || id < 1) return send(res, 400, { ok: false, error: 'Invalid article id' });
        const rows = await sql`SELECT a.id, a.title, a.summary, a.original_url, a.image_url, a.category, a.language, a.published_at, a.fetched_at, s.name AS source_name FROM news_articles a LEFT JOIN news_sources s ON s.id = a.source_id WHERE a.id = ${id} AND a.is_published = TRUE LIMIT 1`;
        if (!rows.length) return send(res, 404, { ok: false, error: 'Article not found' });
        const related = await sql`SELECT id, title, image_url, category, published_at FROM news_articles WHERE is_published = TRUE AND category = ${rows[0].category} AND id <> ${id} ORDER BY published_at DESC LIMIT 4`;
        return sendCached(res, { ok: true, article: rows[0], related }, 's-maxage=60, stale-while-revalidate=60');
      }
      const rows = await sql`SELECT a.id, a.title, a.summary, a.original_url, a.image_url, a.category, a.language, a.published_at, a.fetched_at, s.name AS source_name FROM news_articles a LEFT JOIN news_sources s ON s.id = a.source_id WHERE a.is_published = TRUE AND (${category} = 'all' OR a.category = ${category}) AND (${language} = 'all' OR a.language = ${language}) AND COALESCE(a.published_at, a.fetched_at) >= NOW() - INTERVAL '10 days' ORDER BY COALESCE(a.published_at, a.fetched_at) DESC LIMIT ${limit}`;
      return sendCached(res, { ok: true, articles: rows, mode: 'database' }, 's-maxage=60, stale-while-revalidate=60');
    } catch {
      // If the database is temporarily unavailable, serve only newly published RSS items.
    }
  }

  try {
    const articles = await readFallbackFeeds({ category, language, limit });
    return sendCached(res, { ok: true, articles, mode: 'live-rss' }, 's-maxage=60, stale-while-revalidate=60');
  } catch {
    return send(res, 503, { ok: false, error: 'News feeds are temporarily unavailable' });
  }
}
