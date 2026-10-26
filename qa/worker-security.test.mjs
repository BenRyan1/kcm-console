// Local security regression tests for worker.js (no network, mock KV and fetch).
// Added 2026-10-22 after the security audit.
// Run:  node qa/worker-security.test.mjs [path/to/worker.js]
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const target = resolve(process.argv[2] || join(here, '..', 'worker.js'));
const tmp = join(tmpdir(), `kcm-worker-under-test-${process.pid}.mjs`);
writeFileSync(tmp, readFileSync(target));
const worker = (await import(pathToFileURL(tmp).href)).default;
try { unlinkSync(tmp); } catch (e) {}

// ---- mocks ------------------------------------------------------------
class KV {
  constructor() { this.m = new Map(); }
  async get(k, o) { const v = this.m.get(k); if (v === undefined) return null; return o && o.type === 'json' ? JSON.parse(v) : v; }
  async put(k, v) { this.m.set(k, String(v)); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = '' } = {}) { return { keys: [...this.m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true }; }
}
let calls, mock;
function resetMock() {
  calls = [];
  mock = { ml: { status: 200, body: {} }, ts: { success: true }, anthropic: { status: 200, body: { content: [{ type: 'text', text: 'hi' }] } }, stripe: {} };
}
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  calls.push({ url: u, init });
  const R = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (u.includes('connect.mailerlite.com')) return R(mock.ml.status, mock.ml.body);
  if (u.includes('challenges.cloudflare.com')) return R(200, mock.ts);
  if (u.includes('api.anthropic.com')) return R(mock.anthropic.status, mock.anthropic.body);
  const m = u.match(/api\.stripe\.com\/v1\/checkout\/sessions\/([^?]+)/);
  if (m) { const s = mock.stripe[decodeURIComponent(m[1])]; return s ? R(200, s) : R(404, { error: 'nope' }); }
  return R(500, { error: 'unmocked ' + u });
};
const env0 = () => ({
  RATE_LIMIT: new KV(), REVOKED_SESSIONS: new KV(), SESSION_SIGNING_KEY: 'test-signing-key',
  MAILERLITE_API_KEY: 'ml-test', CODE_SCHOOL: 'SCHOOLCODE-123', CODE_DEMO: 'demo-code-xyz',
  ADMIN_KEY: 'admin-test-key', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test',
  ANTHROPIC_API_KEY: 'sk-ant-test', AI_ENABLED: 'true',
});
async function call(env, path, body, { headers = {}, ip = '203.0.113.7', method = 'POST' } = {}) {
  const req = new Request('https://keyscodesandmodes.com' + path, {
    method, body: method === 'POST' ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, Origin: 'https://keyscodesandmodes.com', ...headers },
  });
  const res = await worker.fetch(req, env);
  let json = null; try { json = await res.clone().json(); } catch (e) {}
  return { status: res.status, json, text: await res.text() };
}
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(secret, data, hex = false) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  return hex ? [...sig].map(b => b.toString(16).padStart(2, '0')).join('') : b64u(sig);
}
async function mintToken(payload) {
  const p = b64u(new TextEncoder().encode(JSON.stringify(payload)));
  return `${p}.${await hmac('test-signing-key', p)}`;
}
const decode = (tok) => JSON.parse(atob(tok.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
const admin = (env, body) => call(env, '/api/creator-admin', body, { headers: { 'X-Admin-Key': 'admin-test-key' } });
const verifySession = (env, token) => call(env, '/api/verify-session', { token });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const stripeSession = (over = {}) => ({
  id: 'cs_test_ok1', payment_status: 'paid', status: 'complete', created: Math.floor(Date.now() / 1000),
  customer: 'cus_1', payment_intent: null, amount_total: 1000,
  line_items: { data: [{ price: { id: 'price_student' } }] }, ...over,
});
async function webhook(env, event) {
  const body = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  const v1 = await hmac('whsec_test', `${t}.${body}`, true);
  const res = await worker.fetch(new Request('https://keyscodesandmodes.com/api/stripe-webhook',
    { method: 'POST', body, headers: { 'Stripe-Signature': `t=${t},v1=${v1}`, Origin: 'https://keyscodesandmodes.com' } }), env);
  return res.status;
}

// ---- harness ----------------------------------------------------------
const results = [];
async function test(name, fn) {
  resetMock();
  try { const ok = await fn(); results.push([name, ok === true, ok === true ? '' : String(ok)]); }
  catch (e) { results.push([name, false, 'threw: ' + e.message]); }
}
const mlCalls = () => calls.filter(c => c.url.includes('mailerlite'));
const mlBody = () => JSON.parse(mlCalls().at(-1).init.body);
const DEFAULT = '179228643447276862';

// ---- finding 1: subscribe ---------------------------------------------
await test('F1 stray path is 404 and never reaches MailerLite', async () => {
  const r = await call(env0(), '/api/anything', { email: 'a@b.co' });
  return r.status === 404 && mlCalls().length === 0 || `status ${r.status}, ML calls ${mlCalls().length}`;
});
await test('F1 unknown MailerLite group is replaced by the default group', async () => {
  await call(env0(), '/api/subscribe', { email: 'a@b.co', group: '999999999' });
  return mlBody().groups[0] === DEFAULT || `groups ${mlBody().groups}`;
});
await test('F1 allowed group still honored (Superintendents)', async () => {
  await call(env0(), '/api/subscribe', { email: 'a@b.co', group: '183424819298043087' });
  return mlBody().groups[0] === '183424819298043087' || `groups ${mlBody().groups}`;
});
await test('F1 superintendent.html request shape (path "/", groups[], fields.name)', async () => {
  const r = await call(env0(), '/', { email: 'p@d.org', fields: { name: 'Pat Lee' }, groups: ['183424819298043087'] });
  const b = mlBody();
  return (r.status === 200 && b.groups[0] === '183424819298043087' && b.fields.name === 'Pat Lee') || JSON.stringify(b);
});
await test('F1 normal Console gate signup still works', async () => {
  const r = await call(env0(), '/api/subscribe', { email: 'kid@school.org', name: 'Kid', group: '147630778924778065', signup_source: 'console-gate' });
  return (r.status === 200 && r.json.ok === true) || `status ${r.status}`;
});
await test('F1 per-IP rate limit (31st signup in an hour gets 429)', async () => {
  const env = env0(); let last;
  for (let i = 0; i < 31; i++) last = await call(env, '/api/subscribe', { email: `u${i}@x.co` });
  return last.status === 429 || `31st status ${last.status}`;
});
await test('F1 MailerLite error text is not echoed to the browser', async () => {
  mock.ml = { status: 422, body: { message: 'INTERNAL-DETAIL' } };
  const r = await call(env0(), '/api/subscribe', { email: 'a@b.co' });
  return !r.text.includes('INTERNAL-DETAIL') || 'error body leaked';
});
await test('F1 Turnstile enforced when TURNSTILE_SECRET is set', async () => {
  const env = { ...env0(), TURNSTILE_SECRET: 'ts-secret' };
  const no = await call(env, '/api/subscribe', { email: 'a@b.co' });
  const yes = await call(env, '/api/subscribe', { email: 'a@b.co', turnstile_token: 'tok' });
  mock.ts = { success: false };
  const bad = await call(env, '/api/subscribe', { email: 'a@b.co', turnstile_token: 'tok' });
  return (no.status === 403 && yes.status === 200 && bad.status === 403) || `${no.status}/${yes.status}/${bad.status}`;
});

// ---- finding 2: Stripe verification -----------------------------------
const redeem = (env, id = 'cs_test_ok1', tier) => call(env, '/api/verify-stripe-session', { session_id: id, tier });
await test('F2 tier comes from the price bought, not from the client', async () => {
  const env = { ...env0(), PRICE_TIERS: JSON.stringify({ price_student: 'student_monthly' }) };
  mock.stripe.cs_test_ok1 = stripeSession();
  const r = await redeem(env, 'cs_test_ok1', 'founders_circle');
  return (r.status === 200 && r.json.tier === 'student_monthly' && decode(r.json.token).tier === 'student_monthly') || JSON.stringify(r.json);
});
await test('F2 session for an unknown price is rejected', async () => {
  const env = { ...env0(), PRICE_TIERS: JSON.stringify({ price_other: 'student_monthly' }) };
  mock.stripe.cs_test_ok1 = stripeSession();
  const r = await redeem(env);
  return r.status === 403 || `status ${r.status}`;
});
await test('F2 one paid session cannot mint unlimited tokens (cap 5)', async () => {
  const env = env0(); mock.stripe.cs_test_ok1 = stripeSession(); let last;
  for (let i = 0; i < 6; i++) last = await redeem(env);
  return last.status === 401 || `6th status ${last.status}`;
});
await test('F2 old session (10 days) is rejected', async () => {
  mock.stripe.cs_test_ok1 = stripeSession({ created: Math.floor(Date.now() / 1000) - 10 * 86400 });
  const r = await redeem(env0());
  return r.status === 401 || `status ${r.status}`;
});
await test('F2 full refund revokes a one-time-payment token (payment intent)', async () => {
  const env = env0(); mock.stripe.cs_test_ok1 = stripeSession({ customer: null, payment_intent: 'pi_1' });
  const r = await redeem(env);
  const before = (await verifySession(env, r.json.token)).status;
  const wh = await webhook(env, { type: 'charge.refunded', data: { object: { refunded: true, payment_intent: 'pi_1', customer: null } } });
  const after = (await verifySession(env, r.json.token)).status;
  return (before === 200 && wh === 200 && after === 401) || `${before}/${wh}/${after}`;
});
await test('F2 chargeback revokes the token', async () => {
  const env = env0(); mock.stripe.cs_test_ok1 = stripeSession({ customer: null, payment_intent: 'pi_2' });
  const r = await redeem(env);
  await webhook(env, { type: 'charge.dispute.created', data: { object: { payment_intent: 'pi_2' } } });
  return (await verifySession(env, r.json.token)).status === 401 || 'still valid after dispute';
});
await test('F2 partial refund does NOT revoke', async () => {
  const env = env0(); mock.stripe.cs_test_ok1 = stripeSession({ customer: null, payment_intent: 'pi_3' });
  const r = await redeem(env);
  await webhook(env, { type: 'charge.refunded', data: { object: { refunded: false, payment_intent: 'pi_3' } } });
  return (await verifySession(env, r.json.token)).status === 200 || 'revoked on partial refund';
});

// ---- finding 3: revocation of code and creator tokens -----------------
await test('F3 revoking a creator ends tokens already issued to them', async () => {
  const env = env0();
  const c = await admin(env, { action: 'create', name: 'Sarah', ref: 'SARAH' });
  const t = await call(env, '/api/verify-code', { code: c.json.access_code });
  const before = (await verifySession(env, t.json.token)).status;
  await admin(env, { action: 'revoke_access', ref: 'SARAH' });
  const after = (await verifySession(env, t.json.token)).status;
  return (before === 200 && after === 401) || `${before}/${after}`;
});
await test('F3 revoke_tier retires old school tokens; a fresh code entry works', async () => {
  const env = env0();
  const t1 = await call(env, '/api/verify-code', { code: 'SCHOOLCODE-123' });
  await sleep(5);
  const rv = await admin(env, { action: 'revoke_tier', tier: 'school' });
  await sleep(5);
  const old = (await verifySession(env, t1.json.token)).status;
  const t2 = await call(env, '/api/verify-code', { code: 'SCHOOLCODE-123' });
  const fresh = (await verifySession(env, t2.json.token)).status;
  return (rv.status === 200 && old === 401 && fresh === 200) || `${rv.status}/${old}/${fresh}`;
});
await test('F3 revoke_tier needs the admin key', async () => {
  const r = await call(env0(), '/api/creator-admin', { action: 'revoke_tier', tier: 'school' });
  return r.status === 401 || `status ${r.status}`;
});
await test('compat: tokens issued before this change (no iat) still verify', async () => {
  const tok = await mintToken({ tier: 'school', exp: Date.now() + 86400000 });
  return (await verifySession(env0(), tok)).status === 200 || 'old token rejected';
});
await test('compat: right code gets 200 + token, wrong code gets 401', async () => {
  const env = env0();
  const ok = await call(env, '/api/verify-code', { code: 'SCHOOLCODE-123' });
  const bad = await call(env, '/api/verify-code', { code: 'nope' });
  return (ok.status === 200 && ok.json.tier === 'school' && !!ok.json.token && bad.status === 401) || `${ok.status}/${bad.status}`;
});

// ---- finding 5: AI proxy ----------------------------------------------
const goodToken = async () => (await call(env0(), '/api/verify-code', { code: 'SCHOOLCODE-123' })).json.token;
const ai = (env, body, token) => call(env, '/ai', body, token ? { headers: { Authorization: 'Bearer ' + token } } : {});
const msgs = [{ role: 'user', content: 'hello' }];
await test('F5 AI stays paused when AI_ENABLED is not "true"', async () => {
  const r = await ai({ ...env0(), AI_ENABLED: 'false' }, { messages: msgs });
  return r.status === 503 || `status ${r.status}`;
});
await test('F5 AI rejects callers with no session token', async () => {
  const r = await ai(env0(), { messages: msgs });
  return (r.status === 401 && !calls.some(c => c.url.includes('anthropic'))) || `status ${r.status}`;
});
await test('F5 AI works with a valid session token', async () => {
  const r = await ai(env0(), { messages: msgs }, await goodToken());
  return (r.status === 200 && r.json.ok === true) || `status ${r.status}`;
});
await test('F5 AI rejects oversized requests', async () => {
  const r = await ai(env0(), { messages: [{ role: 'user', content: 'x'.repeat(30000) }] }, await goodToken());
  return r.status === 413 || `status ${r.status}`;
});
await test('F5 AI daily cap per IP', async () => {
  const env = { ...env0(), AI_DAILY_MAX: '2' }; const tok = await goodToken(); let last;
  for (let i = 0; i < 3; i++) last = await ai(env, { messages: msgs }, tok);
  return last.status === 429 || `3rd status ${last.status}`;
});
await test('F5 AI upstream error details are not forwarded', async () => {
  mock.anthropic = { status: 400, body: { error: { message: 'UPSTREAM-SECRET-DETAIL' } } };
  const r = await ai(env0(), { messages: msgs }, await goodToken());
  return !r.text.includes('UPSTREAM-SECRET-DETAIL') || 'detail leaked';
});

// ---- report -----------------------------------------------------------
let fail = 0;
for (const [name, ok, why] of results) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '   <- ' + why}`); if (!ok) fail++; }
console.log(`\n${results.length - fail}/${results.length} passed  (${target})`);
// Note: until PRICE_TIERS is set in Cloudflare, /api/verify-stripe-session still honors the client's tier.
process.exit(fail ? 1 : 0);
