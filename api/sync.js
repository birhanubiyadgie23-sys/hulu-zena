import { sqlClient } from './_lib/db.js';
import { syncFeeds } from './_lib/sync.js';
import { send, method } from './_lib/http.js';
import { requireAdmin } from './_lib/auth.js';
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!requireAdmin(req, res)) return;
  await run(res);
}
export async function run(res) {
  let runId;
  try {
    const sql = sqlClient();
    const row = await sql`INSERT INTO sync_runs DEFAULT VALUES RETURNING id`;
    runId = row[0].id;
    const result = await syncFeeds();
    await sql`UPDATE sync_runs SET finished_at = NOW(), status = ${result.errors ? 'completed_with_errors' : 'completed'}, inserted_count = ${result.inserted}, error_count = ${result.errors}, details = ${JSON.stringify(result.details)}::jsonb WHERE id = ${runId}`;
    send(res, 200, { ok: true, ...result });
  } catch (error) {
    if (runId) { try { await sqlClient()`UPDATE sync_runs SET finished_at = NOW(), status = 'failed' WHERE id = ${runId}`; } catch {} }
    send(res, 500, { ok: false, error: 'Synchronization failed' });
  }
}
