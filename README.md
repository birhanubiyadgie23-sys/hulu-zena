# HULU ZENA — ሁሉ ዜና

A bilingual Amharic/English news aggregation starter built for Vercel Functions and Neon PostgreSQL. The build step copies the public website into `dist/`; Vercel API routes remain under `api/`.

## Included
- Responsive public news homepage and category filters.
- RSS ingestion with URL deduplication and source attribution.
- Admin login using scrypt password hashes and signed, HTTP-only session cookies.
- Amharic/English interface toggle and feed-language filter.
- Admin dashboard to add, pause, and remove RSS sources; manually trigger synchronization.
- Admin article moderation to hide or republish collected items.
- Daily Vercel Cron endpoint protected by `CRON_SECRET`.
- PostgreSQL schema, indexes, run history, security headers, dynamic sitemap, and setup documentation.

## Requirements
- Node.js 20+
- A Neon PostgreSQL database
- A Vercel project

## Setup
1. Create a new, separate GitHub repository for HULU ZENA. Do not place these files in the EthiopiaJobs repository.
2. Create a Neon database and run the complete contents of `schema.sql` in the Neon SQL Editor.
3. Copy `.env.example` values into Vercel Project Settings → Environment Variables.
4. Generate an admin password hash locally:
   ```bash
   npm install
   npm run hash-password -- "YOUR-UNIQUE-PASSWORD-AT-LEAST-12-CHARS"
   ```
   Put the complete printed `scrypt$...` value into `ADMIN_PASSWORD_HASH`. Set `ADMIN_EMAIL` to the chosen admin email. Use different random values for `SESSION_SECRET` and `CRON_SECRET` (32+ characters each).
5. Set `SITE_URL` to the final HTTPS site origin (for example, the deployed Vercel URL) so `/sitemap.xml` can be generated.
6. Install dependencies with `npm install`, then run `npm test` and `npm run build`.
7. Preview locally with `npm run dev`.
8. Deploy to Vercel after environment variables are configured.

## Default RSS sources
`schema.sql` seeds two VOA Amharic RSS feeds (Ethiopia and World), five VOA English feeds, and English-language world feeds from Deutsche Welle, Al Jazeera, The Guardian, and NPR. The no-database fallback uses the same international sources and the Fana Amharic feed. Feed availability can change, so monitor each source's sync status. The ingestion stores headlines, short feed-provided summaries, source names, source links, dates, and available thumbnails; it does not scrape or republish full articles. Duplicate titles are suppressed across feeds for a 48-hour window. The language switch filters Amharic and English source items; it does not machine-translate articles. The Amharic feed currently includes VOA and Fana Media Corporation; continue verifying feed freshness and source terms. Review each publisher's RSS and reuse terms before public or commercial use; keep clear attribution and link readers to the original report.

## Automation note
The included Vercel cron is daily at 02:30 UTC. On the Vercel Hobby plan, daily schedules are the supported cadence and may start within the scheduled hour. For more frequent refreshes, use a plan or scheduler that supports the desired interval. Hobby usage is intended for personal, non-commercial projects; review current Vercel plan terms before using this for a commercial publication.

## Important production checklist
- Add only RSS/API sources whose terms permit this kind of aggregation.
- Verify source ownership and category mapping before publication.
- Use original article links and visible source attribution.
- Add an editorial review workflow before publishing sensitive or disputed claims.
- Configure database backups/retention in Neon and periodically export a backup.
- Configure a custom domain, privacy notice, and contact page before public launch.
- Consider a licensed translation/summarization provider only after its cost and terms are reviewed. This starter does not invent or machine-translate full article content.

## API routes
- `GET /api/news?category=all&language=all&limit=30`
- `GET /sitemap.xml` (requires `SITE_URL`)
- `POST /api/login`
- `GET /api/admin` (authenticated)
- `POST /api/admin` (add source; authenticated)
- `PATCH /api/admin?id=ID` (toggle source active state; authenticated)
- `DELETE /api/admin?id=ID` (remove source; authenticated)
- `GET /api/admin-articles` and `PATCH /api/admin-articles?id=ID` (authenticated moderation)
- `POST /api/sync` (authenticated manual sync)
- `GET /api/cron-sync` (requires `Authorization: Bearer <CRON_SECRET>`)

## Current scope / limitations
This is a code-checked project foundation, not a launched or fully verified news service. Feed availability, hosting plan suitability, database connection, credentials, source permissions, and scheduled execution must be verified in the actual deployment. Automatic AI rewriting, translation, image licensing, user comments, and email newsletters are not included.
