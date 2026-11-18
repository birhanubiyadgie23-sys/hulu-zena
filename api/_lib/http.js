export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
export function method(req, res, allowed) {
  if (req.method !== allowed) {
    res.setHeader('Allow', allowed);
    send(res, 405, { ok: false, error: 'Method not allowed' });
    return false;
  }
  return true;
}
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}
export function cleanText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
