import postgres from 'postgres';

let client;
let query;
let schemaReady;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS news_sources (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    feed_url TEXT NOT NULL UNIQUE,
    language TEXT NOT NULL DEFAULT 'am',
    category TEXT NOT NULL DEFAULT 'ethiopia',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_fetched_at TIMESTAMPTZ,
    last_error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS news_articles (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT REFERENCES news_sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    original_url TEXT NOT NULL UNIQUE,
    image_url TEXT,
    category TEXT NOT NULL DEFAULT 'ethiopia',
    language TEXT NOT NULL DEFAULT 'am',
    published_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    fingerprint TEXT NOT NULL
  )`,
  `ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source_content TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS summary_status TEXT NOT NULL DEFAULT 'pending'`,
  'CREATE INDEX IF NOT EXISTS news_articles_published_date_idx ON news_articles(is_published, published_at DESC)',
  'CREATE INDEX IF NOT EXISTS news_articles_category_idx ON news_articles(category, published_at DESC)',
  'CREATE INDEX IF NOT EXISTS news_articles_fingerprint_idx ON news_articles(fingerprint)',
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT FALSE
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    inserted_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '[]'::jsonb
  )`,
  `INSERT INTO news_sources (name, feed_url, language, category)
   VALUES
    ('VOA Amharic - Ethiopia', 'https://amharic.voanews.com/api/ztbgtl-vomx-tpekvbv', 'am', 'ethiopia'),
    ('VOA Amharic - World', 'https://amharic.voanews.com/api/ziibql-vomx-tpemgqqo', 'am', 'world'),
    ('Fana Media Corporation - Amharic', 'https://www.fanamc.com/feed/', 'am', 'ethiopia'),
    ('VOA English - Africa', 'https://www.voanews.com/api/z-botl-vomx-tpertmq', 'en', 'world'),
    ('VOA English - United States', 'https://www.voanews.com/api/zqboml-vomx-tpeivmy', 'en', 'world'),
    ('VOA English - Economy and Business', 'https://www.voanews.com/api/zyboql-vomx-tpetvmi', 'en', 'economy'),
    ('VOA English - Technology', 'https://www.voanews.com/api/zyritl-vomx-tpettmq', 'en', 'technology'),
    ('VOA English - International Edition', 'https://www.voanews.com/api/zumgqol-vomx-tpeg--qi', 'en', 'world'),
    ('Deutsche Welle - English', 'https://rss.dw.com/xml/rss-en-all', 'en', 'world'),
    ('Al Jazeera - English', 'https://www.aljazeera.com/xml/rss/all.xml', 'en', 'world'),
    ('The Guardian - World', 'https://www.theguardian.com/world/rss', 'en', 'world'),
    ('NPR - World', 'https://feeds.npr.org/1004/rss.xml', 'en', 'world')
   ON CONFLICT (feed_url) DO NOTHING`
];

async function initializeSchema(db) {
  // Create independent tables together, then indexes, then seed sources.
  await Promise.all([0, 1, 7, 8, 9].map((index) => db.unsafe(schemaStatements[index])));
  await Promise.all([2, 3, 4, 5, 6].map((index) => db.unsafe(schemaStatements[index])));
  await db.unsafe(schemaStatements[10]);
}

function getClient() {
  const connectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_POOLED or DATABASE_URL is not configured');
  if (!client) {
    client = postgres(connectionString, {
      max: 3,
      idle_timeout: 10,
      connect_timeout: 5,
      query_timeout: 8000,
      prepare: false
    });
  }
  return client;
}

// Direct reads skip cold-start schema DDL. Use only for routes that read existing tables.
export function rawSqlClient() {
  return getClient();
}

export function sqlClient() {
  const db = getClient();
  if (!query) {
    query = async (strings, ...values) => {
      if (!schemaReady) {
        schemaReady = initializeSchema(db).catch((error) => {
          schemaReady = null;
          throw error;
        });
      }
      await schemaReady;
      return db(strings, ...values);
    };
  }
  return query;
}
