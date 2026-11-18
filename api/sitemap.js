export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end('Method not allowed');
  }
  let base = '';
  try { const configured = new URL(process.env.SITE_URL || ''); if (configured.protocol === 'https:') base = configured.origin; } catch {}
  if (!base) {
    res.statusCode = 503;
    return res.end('SITE_URL must be configured');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>`);
}
