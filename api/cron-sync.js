import { run } from './sync.js';
import { send, method } from './_lib/http.js';
export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  const secret = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return send(res, 401, { ok: false, error: 'Unauthorized' });
  await run(res);
}
