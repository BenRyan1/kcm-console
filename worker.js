export default {
  async fetch(request, env) {

    const ALLOWED_ORIGINS = [
      'https://keyscodesandmodes.com',
      'https://console.keyscodesandmodes.com',
      'https://mtp.keyscodesandmodes.com',
    ];
    const requestOrigin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(requestOrigin)
        ? requestOrigin
        : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    function sanitize(str, maxLen = 200) {
      if (typeof str !== 'string') return '';
      return str.trim().slice(0, maxLen)
        .replace(/[<>"'&]/g, c => ({
          '<':  '&lt;',
          '>':  '&gt;',
          '"':  '&quot;',
          "'":  '&#39;',
          '&':  '&amp;',
        }[c]));
    }

    // Added 2026-10-22 (security audit): compare secrets without an early
    // exit, and without leaking the length through the loop count.
    function safeEq(a, b) {
      a = String(a); b = String(b);
      let d = a.length ^ b.length;
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
      return d === 0;
    }

    // ── Signed session tokens ────────────────────────────────────────────
    // Added 2026-08-24. my-apps.html and every /apps/*.html page (via
    // js/kcm-app-gate.js) were already written to expect a signed
    // kcm_session_token from /api/verify-code, verified server-side by
    // POSTing it to /api/verify-session — but neither the signing nor the
    // /api/verify-session route was ever actually implemented here, so
    // every real premium unlock was silently failing closed. This closes
    // that gap. Token = base64url(JSON payload) + '.' + base64url(HMAC-
    // SHA256 signature of the payload, keyed by the SESSION_SIGNING_KEY
    // Worker secret). The payload itself (tier + expiry) is not secret —
    // only the signature proves it wasn't forged from devtools.
    const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

    function b64urlEncode(bytes) {
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function b64urlDecode(str) {
      const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
      const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
    async function hmacKey(secret) {
      return crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
    }
    async function signSession(payload, secret) {
      const payloadB64 = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
      const key = await hmacKey(secret);
      const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
      const sigB64 = b64urlEncode(new Uint8Array(sigBuf));
      return `${payloadB64}.${sigB64}`;
    }
    // Returns the verified payload ({tier, exp, ...}) or null — never
    // throws, so callers can treat any falsy return as "not premium."
    //
    // `revokedKV` (added 2026-08-24) is the REVOKED_SESSIONS KV binding.
    // A token can carry a valid, unexpired signature and still be denied
    // if its `cust` (Stripe customer ID) shows up there — that's how a
    // canceled subscription gets shut off before the 180-day token would
    // otherwise expire on its own. See /api/stripe-webhook below, which
    // is what writes to that store. Tokens with no `cust` (e.g. access-
    // code redemptions) skip this check entirely — there's no Stripe
    // subscription behind them to cancel.
    async function verifySession(token, secret, revokedKV) {
      if (typeof token !== 'string' || !secret) return null;
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [payloadB64, sigB64] = parts;
      let payload;
      try {
        payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
      } catch (e) {
        return null;
      }
      let expectedSigBuf;
      try {
        const key = await hmacKey(secret);
        expectedSigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
      } catch (e) {
        return null;
      }
      const expectedSigB64 = b64urlEncode(new Uint8Array(expectedSigBuf));
      // Fixed-length base64url HMAC output — safe to compare directly;
      // still walk the whole string rather than short-circuit-return.
      if (expectedSigB64.length !== sigB64.length) return null;
      let mismatch = 0;
      for (let i = 0; i < expectedSigB64.length; i++) {
        mismatch |= expectedSigB64.charCodeAt(i) ^ sigB64.charCodeAt(i);
      }
      if (mismatch !== 0) return null;
      if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
      if (!payload.tier) return null;
      // Added 2026-10-22 (security audit finding 3): revocation that also
      // reaches access-code, creator and one-time-payment tokens.
      //   tier:<tier>  cutoff time: tokens of that tier issued BEFORE it are dead
      //   ref:<ref>    cutoff time: same, for one creator's tokens
      //   pi:<id>      a refunded or disputed one-time payment
      // Tokens issued before this change have no iat, so they count as
      // issued at time 0 and any cutoff retires them.
      if (revokedKV) {
        try {
          const iat = typeof payload.iat === 'number' ? payload.iat : 0;
          const [tierCut, refCut, piHit] = await Promise.all([
            revokedKV.get('tier:' + payload.tier),
            payload.ref ? revokedKV.get('ref:' + payload.ref) : null,
            payload.pi ? revokedKV.get('pi:' + payload.pi) : null,
          ]);
          if (piHit) return null;
          if (tierCut && iat <= Number(tierCut)) return null;
          if (refCut && iat <= Number(refCut)) return null;
        } catch (e) { /* same availability trade-off as the cust check below */ }
      }
      if (payload.cust && revokedKV) {
        try {
          const revoked = await revokedKV.get(payload.cust);
          if (revoked) return null;
        } catch (e) {
          // KV outage shouldn't be an outright fail-open on a paid
          // feature, but it also shouldn't take the whole site down —
          // treat as not-revoked and let the signature/expiry checks
          // above stand as the primary gate.
        }
      }
      return payload;
    }

    // ── Brute-force protection for /api/verify-code (added 2026-08-27) ──
    // The 8 access codes are short, human-memorable strings handed out by
    // email, not long random tokens, and this endpoint previously had no
    // limit on attempts at all — scriptable to guess for free with zero
    // friction. This tracks FAILED attempts per client IP in the
    // RATE_LIMIT KV namespace with a sliding window; a correct code never
    // gets penalized, so a legit visitor who mistypes once or twice is
    // unaffected. Fails OPEN if the KV binding is missing/misconfigured
    // or a KV read/write errors — availability of code redemption matters
    // more than this secondary defense, and the primary defense (the
    // actual code values, server-side only) is unaffected either way.
    const RATE_LIMIT_MAX_ATTEMPTS = 8;
    const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
    async function checkRateLimit(ip, kv) {
      if (!kv || !ip) return { limited: false };
      try {
        const record = await kv.get(`verify-code:${ip}`, { type: 'json' });
        const now = Date.now();
        if (record && record.resetAt > now && record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
          return { limited: true, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
        }
      } catch (e) {
        // KV read failed — fail open, see header note above.
      }
      return { limited: false };
    }
    async function recordFailedAttempt(ip, kv) {
      if (!kv || !ip) return;
      try {
        const now = Date.now();
        const record = await kv.get(`verify-code:${ip}`, { type: 'json' });
        let count = 1;
        let resetAt = now + RATE_LIMIT_WINDOW_SECONDS * 1000;
        if (record && record.resetAt > now) {
          count = record.count + 1;
          resetAt = record.resetAt;
        }
        await kv.put(`verify-code:${ip}`, JSON.stringify({ count, resetAt }), {
          expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
        });
      } catch (e) {
        // KV write failed — fail open, see header note above.
      }
    }

    const url = new URL(request.url);

    // ── Creator attribution (added 2026-10-20) ──────────────────────────
    // Lets each creator/educator carry a public REF (used in links like
    // keyscodesandmodes.com/?ref=SARAH) and a separate PRIVATE access code
    // (their own free access). The public ref is never an access code.
    // Records live in KV (env.CREATORS if bound, else the RATE_LIMIT
    // namespace under distinct key prefixes):
    //   creator:<REF>  {name, created, access_code}
    //   acc:<CODE>     {ref}        (private access code -> ref)
    //   stats:<REF>    {visits, leads, signups, revenue_cents}
    //   cust:<custId>  {ref, start} (so renewals credit the same creator)
    // Counters are read-modify-write (not atomic): fine at this scale.
    const REF_RE = /^[A-Za-z0-9_-]{2,40}$/;
    const CREATOR_KV = env.CREATORS || env.RATE_LIMIT;
    const REV_SHARE_MS = (Number(env.REV_SHARE_MONTHS) || 12) * 30 * 24 * 60 * 60 * 1000;
    const normRef = (s) => (typeof s === 'string' && REF_RE.test(s.trim())) ? s.trim().toUpperCase() : '';
    const J = (obj, status = 200) => new Response(JSON.stringify(obj),
      { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    async function getCreator(ref) {
      if (!ref || !CREATOR_KV) return null;
      try { return await CREATOR_KV.get('creator:' + ref, { type: 'json' }); } catch (e) { return null; }
    }
    async function getStats(ref) {
      let s = null;
      try { s = await CREATOR_KV.get('stats:' + ref, { type: 'json' }); } catch (e) {}
      return Object.assign({ visits: 0, leads: 0, signups: 0, revenue_cents: 0 }, s || {});
    }
    async function bumpStats(ref, fn) {
      const s = await getStats(ref);
      fn(s);
      await CREATOR_KV.put('stats:' + ref, JSON.stringify(s));
    }
    // true the first time a key is seen (within ttl), false afterwards
    async function once(key, ttlSec = 400 * 86400) {
      const seen = await CREATOR_KV.get(key);
      if (seen) return false;
      await CREATOR_KV.put(key, '1', { expirationTtl: Math.max(60, ttlSec) });
      return true;
    }
    async function addRevenue(ref, id, cents) {
      if (!cents || cents < 0) return;
      if (await once('rev:' + id)) await bumpStats(ref, s => { s.revenue_cents += cents; });
    }
    // Called with a Stripe Checkout Session (client_reference_id = creator ref).
    async function recordCheckout(session) {
      if (!session || !CREATOR_KV) return;
      const ref = normRef(session.client_reference_id);
      if (!ref || !(await getCreator(ref))) return;
      if (await once('sale:' + session.id)) {
        await bumpStats(ref, s => { s.signups += 1; });
        if (session.customer) {
          await CREATOR_KV.put('cust:' + session.customer, JSON.stringify({ ref, start: Date.now() }),
            { expirationTtl: Math.ceil(REV_SHARE_MS / 1000) + 86400 });
        }
      }
      if (session.payment_status === 'paid') {
        await addRevenue(ref, session.invoice || session.id, session.amount_total || 0);
      }
    }
    function adminOK() {
      const k = request.headers.get('X-Admin-Key') || '';
      const s = env.ADMIN_KEY || '';
      if (!s || k.length !== s.length) return false;
      let d = 0;
      for (let i = 0; i < s.length; i++) d |= k.charCodeAt(i) ^ s.charCodeAt(i);
      return d === 0;
    }

    // Public: count a visit that arrived via ?ref=. Always answers ok so
    // it can't be used to discover which refs exist. Once per IP/ref/day.
    if (url.pathname === '/api/ref-hit') {
      try {
        const body = await request.json();
        const ref = normRef(body.ref);
        const ip = request.headers.get('CF-Connecting-IP') || 'x';
        const day = new Date().toISOString().slice(0, 10);
        if (ref && await getCreator(ref) && await once('hit:' + ref + ':' + ip + ':' + day, 90000)) {
          await bumpStats(ref, s => { s.visits += 1; });
        }
      } catch (e) {}
      return J({ ok: true });
    }

    // Admin only (X-Admin-Key header = ADMIN_KEY secret).
    if (url.pathname === '/api/creator-admin') {
      if (!adminOK()) return J({ ok: false, error: 'Unauthorized' }, 401);
      if (!CREATOR_KV) return J({ ok: false, error: 'No KV binding' }, 500);
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const action = body.action;

      if (action === 'create') {
        const name = sanitize(body.name || '', 80);
        if (!name) return J({ ok: false, error: 'name required' }, 422);
        const ref = normRef(body.ref) || name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 20);
        if (ref.length < 2) return J({ ok: false, error: 'ref too short' }, 422);
        if (await getCreator(ref)) return J({ ok: false, error: 'ref already exists' }, 409);
        const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        const rnd = crypto.getRandomValues(new Uint8Array(8));
        const tail = Array.from(rnd).map(b => alphabet[b % alphabet.length]).join('');
        const accessCode = ref.slice(0, 8) + '-' + tail;
        await CREATOR_KV.put('creator:' + ref, JSON.stringify({ name, created: Date.now(), access_code: accessCode }));
        await CREATOR_KV.put('acc:' + accessCode, JSON.stringify({ ref }));
        return J({
          ok: true, ref, name, access_code: accessCode,
          link: 'https://keyscodesandmodes.com/?ref=' + ref,
          mtp_link: 'https://mtp.keyscodesandmodes.com/?ref=' + ref,
        });
      }

      if (action === 'list') {
        const rows = [];
        let cursor;
        do {
          const page = await CREATOR_KV.list({ prefix: 'creator:', cursor });
          for (const k of page.keys) {
            const ref = k.name.slice('creator:'.length);
            const c = await getCreator(ref);
            const s = await getStats(ref);
            const pct = Number(env.REV_SHARE_PCT);
            rows.push({
              ref, name: c && c.name, access_code: c && c.access_code,
              visits: s.visits, leads: s.leads, paid_signups: s.signups,
              revenue_usd: Math.round(s.revenue_cents) / 100,
              ...(Number.isFinite(pct) && pct > 0 ? { share_owed_usd: Math.round(s.revenue_cents * pct / 100) / 100 } : {}),
            });
          }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
        return J({ ok: true, creators: rows });
      }

      // Stops the creator's free access but keeps their attribution history.
      if (action === 'revoke_access') {
        const ref = normRef(body.ref);
        const c = await getCreator(ref);
        if (!c) return J({ ok: false, error: 'not found' }, 404);
        await CREATOR_KV.delete('acc:' + c.access_code);
        // Added 2026-10-22: also retire tokens already issued to this creator.
        if (env.REVOKED_SESSIONS) {
          await env.REVOKED_SESSIONS.put('ref:' + ref, String(Date.now()),
            { expirationTtl: Math.ceil(SESSION_TTL_MS / 1000) });
        }
        return J({ ok: true, revoked: ref });
      }

      // Added 2026-10-22: after rotating a shared code (school, demo, press,
      // and so on), call this to retire every token of that tier issued
      // before now. People enter the new code and get a fresh token.
      if (action === 'revoke_tier') {
        const tier = typeof body.tier === 'string' ? body.tier.trim() : '';
        if (!/^[a-z_]{2,40}$/.test(tier)) return J({ ok: false, error: 'tier required' }, 422);
        if (!env.REVOKED_SESSIONS) return J({ ok: false, error: 'No KV binding' }, 500);
        await env.REVOKED_SESSIONS.put('tier:' + tier, String(Date.now()),
          { expirationTtl: Math.ceil(SESSION_TTL_MS / 1000) });
        return J({ ok: true, revoked_tier: tier });
      }

      return J({ ok: false, error: 'unknown action' }, 422);
    }

    if (url.pathname === '/api/verify-code') {
      let code = '';
      try {
        const body = await request.json();
        code = (body.code || '').trim();
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const clientIP = request.headers.get('CF-Connecting-IP') || '';
      const rl = await checkRateLimit(clientIP, env.RATE_LIMIT);
      if (rl.limited) {
        return new Response(JSON.stringify({ ok: false, error: 'Too many attempts — try again later' }),
          {
            status: 429,
            headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) },
          });
      }

      // Added 2026-07-12: named by tier (not just a flat Set) so callers
      // like access-code-entry.html can learn WHICH tier matched — for
      // showing the right tier name/description/redirect — without ever
      // holding the actual code strings client-side. The tier label is
      // not sensitive; only the code values are, and those stay server-
      // side as Worker secrets.
      const codesByTier = {
        premium: env.CODE_PREMIUM,
        founder: env.CODE_FOUNDER,
        beta:    env.CODE_BETA,
        press:   env.CODE_PRESS,
        friend:  env.CODE_FRIEND,
        demo:    env.CODE_DEMO,
        supt:    env.CODE_SUPT,
        yms:     env.CODE_YMS,
        // Added 2026-09-21 per privacy audit Finding 1: a code dedicated to
        // school pilots, kept separate from demo/friend codes so a class's
        // access can be revoked/rotated without affecting other audiences.
        school:  env.CODE_SCHOOL,
        focusrite: env.CODE_FOCUSRITE,
      };

      let matchedTier = null;
      if (code.length > 0) {
        for (const [tier, value] of Object.entries(codesByTier)) {
          if (value && safeEq(code, value)) { matchedTier = tier; break; }
        }
      }

      // Added 2026-10-20: creator access codes (private, per person) are
      // looked up in KV after the fixed tier codes. Case-insensitive.
      let creatorRef = null;
      if (matchedTier === null && code.length > 0 && code.length <= 60 && CREATOR_KV) {
        try {
          const acc = await CREATOR_KV.get('acc:' + code.toUpperCase(), { type: 'json' });
          if (acc && acc.ref && await getCreator(acc.ref)) {
            matchedTier = 'creator';
            creatorRef = acc.ref;
          }
        } catch (e) { /* KV hiccup: treat as no match */ }
      }

      if (matchedTier === null) {
        await recordFailedAttempt(clientIP, env.RATE_LIMIT);
      }

      // Added 2026-08-24: issue the signed session token that
      // access-code-entry.html, my-apps.html, and kcm-app-gate.js were
      // already written to expect back from this endpoint. Requires the
      // SESSION_SIGNING_KEY secret; if it isn't configured yet, tier is
      // still returned for backward-compatible display, just without a
      // token — callers already handle a missing token gracefully.
      let sessionToken = null;
      if (matchedTier !== null && env.SESSION_SIGNING_KEY) {
        sessionToken = await signSession(
          { tier: matchedTier, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS, ...(creatorRef ? { ref: creatorRef } : {}) },
          env.SESSION_SIGNING_KEY
        );
      }

      return new Response(JSON.stringify({ ok: matchedTier !== null, tier: matchedTier, token: sessionToken }),
        {
          status: matchedTier !== null ? 200 : 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
    }

    if (url.pathname === '/api/verify-session') {
      let token = '';
      try {
        const body = await request.json();
        token = body.token || '';
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (!env.SESSION_SIGNING_KEY) {
        // Fail closed, not open — a misconfigured secret should never
        // silently grant access.
        return new Response(JSON.stringify({ ok: false, error: 'Session verification not configured' }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const payload = await verifySession(token, env.SESSION_SIGNING_KEY, env.REVOKED_SESSIONS);
      return new Response(JSON.stringify({ ok: !!payload, tier: payload ? payload.tier : null }),
        {
          status: payload ? 200 : 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
    }

    // ── /api/verify-stripe-session — closes the pricing.html bypass ─────
    // Added 2026-08-24. pricing.html previously trusted a bare
    // "?success=true&tier=..." URL parameter to grant premium access —
    // anyone could type that URL by hand and unlock every app with no
    // payment at all. Stripe Payment Links now append the real, opaque,
    // Stripe-generated `session_id` ({CHECKOUT_SESSION_ID}) to the
    // success URL. This route takes that session_id, asks Stripe
    // directly (server-to-server, using the STRIPE_SECRET_KEY secret —
    // never exposed to the browser) whether that session is real and
    // actually paid, and only then issues a signed kcm_session_token —
    // the same token type /api/verify-code issues, so my-apps.html and
    // kcm-app-gate.js need no changes to trust it.
    if (url.pathname === '/api/verify-stripe-session') {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
      const requestedTier = typeof body.tier === 'string' ? body.tier.trim() : '';

      // Stripe Checkout Session IDs always look like cs_test_... or
      // cs_live_...  — reject anything else before ever calling Stripe.
      if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (!env.STRIPE_SECRET_KEY || !env.SESSION_SIGNING_KEY) {
        // Fail closed — a misconfigured secret should never silently
        // grant access.
        return new Response(JSON.stringify({ ok: false, error: 'Payment verification not configured' }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      let stripeRes;
      try {
        stripeRes = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand%5B%5D=line_items`,
          { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } }
        );
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Upstream request failed' }),
          { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (!stripeRes.ok) {
        // Includes the case where the session ID doesn't exist at all —
        // i.e. someone hand-typed or guessed a session_id.
        return new Response(JSON.stringify({ ok: false, error: 'Session not found' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const session = await stripeRes.json().catch(() => ({}));

      if (session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ ok: false, error: 'Payment not completed' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // Added 2026-10-22 (security audit finding 2): the session must be
      // complete and recent, and (once PRICE_TIERS is set) must be for a
      // product we sell. A success link is not meant to work for weeks.
      if (session.status !== 'complete') {
        return new Response(JSON.stringify({ ok: false, error: 'Payment not completed' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      const sessionAgeSec = Date.now() / 1000 - Number(session.created || 0);
      if (!Number.isFinite(sessionAgeSec) || sessionAgeSec > 3 * 86400) {
        return new Response(JSON.stringify({ ok: false, error: 'Session expired' }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      // PRICE_TIERS is a Worker variable holding JSON, for example
      //   {"price_123":"student_monthly","price_456":"founders_circle"}
      // When set, the tier comes from what was actually bought and the
      // client-supplied tier is ignored.
      let mappedTier = null;
      if (env.PRICE_TIERS) {
        let priceTierMap;
        try { priceTierMap = JSON.parse(env.PRICE_TIERS); } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'Tier mapping misconfigured' }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        const items = (session.line_items && Array.isArray(session.line_items.data)) ? session.line_items.data : [];
        for (const it of items) {
          const pid = it && it.price && it.price.id;
          if (pid && Object.prototype.hasOwnProperty.call(priceTierMap, pid)) { mappedTier = priceTierMap[pid]; break; }
        }
        if (!mappedTier) {
          return new Response(JSON.stringify({ ok: false, error: 'Unrecognized product' }),
            { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
      }

      // Added 2026-10-20: credit the creator whose ?ref= link brought this
      // buyer (Stripe returns it as client_reference_id). Never blocks access.
      try { await recordCheckout(session); } catch (e) { /* tracking only */ }

      // The tier label only decides which token/display name they get —
      // access itself is already gated on the payment_status check above.
      // Restricted to a known allow-list so it can't be used to inject
      // arbitrary values into the signed token payload.
      const VALID_TIERS = [
        'student_monthly', 'student_yearly',
        'professional_monthly', 'professional_yearly',
        'founders_circle',
      ];
      let tier;
      if (mappedTier) {
        if (!VALID_TIERS.includes(mappedTier)) {
          return new Response(JSON.stringify({ ok: false, error: 'Tier mapping misconfigured' }),
            { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
        }
        tier = mappedTier;
      } else {
        // Legacy behavior until PRICE_TIERS is configured.
        tier = VALID_TIERS.includes(requestedTier) ? requestedTier : 'professional_monthly';
      }

      // One paid session may mint a handful of tokens (a few devices), not
      // an unlimited number for anyone who is handed the success link.
      const REDEEM_MAX = 5;
      if (CREATOR_KV) {
        try {
          const rKey = 'redeem:' + session.id;
          const used = Number(await CREATOR_KV.get(rKey)) || 0;
          if (used >= REDEEM_MAX) {
            return new Response(JSON.stringify({ ok: false, error: 'Session already redeemed' }),
              { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
          }
          await CREATOR_KV.put(rKey, String(used + 1), { expirationTtl: 7 * 86400 });
        } catch (e) { /* KV hiccup: do not block a paying customer */ }
      }

      // Carrying the Stripe customer ID inside the token (not secret —
      // it's meaningless without the signature) is what lets
      // /api/stripe-webhook shut off access early if this person cancels,
      // instead of waiting out the full 180-day token lifetime.
      const sessionToken = await signSession(
        { tier, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS, cust: session.customer || null,
          pi: session.payment_intent || null },
        env.SESSION_SIGNING_KEY
      );

      return new Response(JSON.stringify({ ok: true, tier, token: sessionToken }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── /api/stripe-webhook — subscription canceled → revoke access ─────
    // Added 2026-08-24. The signed session token above is normally valid
    // for 180 days regardless of what happens to the subscription behind
    // it. This route is what Stripe calls the moment a subscription is
    // actually canceled (or a renewal payment fails outright), so access
    // can be cut off immediately instead of silently continuing until
    // the token's own expiry. Requires the STRIPE_WEBHOOK_SECRET Worker
    // secret (from the webhook endpoint's "Signing secret" in the Stripe
    // dashboard) to confirm the call really came from Stripe and wasn't
    // forged by a third party trying to revoke someone else's access.
    if (url.pathname === '/api/stripe-webhook') {
      if (!env.STRIPE_WEBHOOK_SECRET) {
        return new Response('Webhook not configured', { status: 500, headers: cors });
      }

      const rawBody = await request.text();
      const sigHeader = request.headers.get('Stripe-Signature') || '';
      const sigParts = {};
      sigHeader.split(',').forEach(part => {
        const eq = part.indexOf('=');
        if (eq > 0) sigParts[part.slice(0, eq)] = part.slice(eq + 1);
      });

      if (!sigParts.t || !sigParts.v1) {
        return new Response('Invalid signature header', { status: 400, headers: cors });
      }

      // Standard Stripe replay guard — reject anything claiming to be
      // more than 5 minutes old.
      const ageSeconds = Math.abs(Date.now() / 1000 - Number(sigParts.t));
      if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
        return new Response('Signature too old', { status: 400, headers: cors });
      }

      const key = await hmacKey(env.STRIPE_WEBHOOK_SECRET);
      const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${sigParts.t}.${rawBody}`));
      const expectedHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (expectedHex.length !== sigParts.v1.length) {
        return new Response('Signature mismatch', { status: 400, headers: cors });
      }
      let mismatch = 0;
      for (let i = 0; i < expectedHex.length; i++) {
        mismatch |= expectedHex.charCodeAt(i) ^ sigParts.v1.charCodeAt(i);
      }
      if (mismatch !== 0) {
        return new Response('Signature mismatch', { status: 400, headers: cors });
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch (e) {
        return new Response('Invalid JSON', { status: 400, headers: cors });
      }

      // subscription.deleted = the subscription is actually gone.
      // subscription.updated is also watched so a failed-renewal state
      // (unpaid / incomplete_expired) cuts access without waiting for
      // Stripe to fully delete the subscription later. Ordinary updates
      // (e.g. an upgrade) don't match these statuses, so they're ignored.
      if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
        const sub = event.data && event.data.object;
        const status = sub && sub.status;
        const customerId = sub && sub.customer;
        const shouldRevoke = event.type === 'customer.subscription.deleted'
          || status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired';

        if (customerId && shouldRevoke && env.REVOKED_SESSIONS) {
          await env.REVOKED_SESSIONS.put(String(customerId), String(Date.now()), {
            expirationTtl: Math.ceil(SESSION_TTL_MS / 1000),
          });
        }
      }

      // Added 2026-10-22 (security audit finding 2): a full refund or a
      // chargeback ends access. One-time payments are matched by payment
      // intent (stored in the token as `pi`), subscriptions by customer.
      // Needs the charge.refunded and charge.dispute.created events enabled
      // on the Stripe webhook endpoint.
      if ((event.type === 'charge.refunded' || event.type === 'charge.dispute.created') && env.REVOKED_SESSIONS) {
        const obj = event.data && event.data.object;
        const endsAccess = event.type === 'charge.dispute.created' || (obj && obj.refunded === true);
        if (obj && endsAccess) {
          const ttl = Math.ceil(SESSION_TTL_MS / 1000);
          const stamp = String(Date.now());
          if (obj.payment_intent) {
            await env.REVOKED_SESSIONS.put('pi:' + String(obj.payment_intent), stamp, { expirationTtl: ttl });
          }
          if (event.type === 'charge.refunded' && obj.customer) {
            await env.REVOKED_SESSIONS.put(String(obj.customer), stamp, { expirationTtl: ttl });
          }
        }
      }

      // Added 2026-10-20: creator attribution. Wrapped so a tracking
      // problem can never affect the revocation logic above.
      try {
        if (event.type === 'checkout.session.completed') {
          await recordCheckout(event.data && event.data.object);
        } else if (event.type === 'invoice.paid' && CREATOR_KV) {
          const inv = event.data && event.data.object;
          const map = inv && inv.customer
            ? await CREATOR_KV.get('cust:' + inv.customer, { type: 'json' }) : null;
          if (map && Date.now() - map.start < REV_SHARE_MS) {
            await addRevenue(map.ref, inv.id, inv.amount_paid || 0);
          }
        }
      } catch (e) { /* tracking only */ }

      return new Response(JSON.stringify({ received: true }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── /ai — secure proxy to the Anthropic Messages API ────────────────
    // Added 2026-06-28. Closes the open question at Claim H-1/H-2: the
    // AI Tutor, Song Builder, and Suno-Enhance features previously called
    // api.anthropic.com directly from the browser with no API key, which
    // cannot succeed. This route accepts a `messages` array (and optional
    // `max_tokens`) from the browser, injects the Anthropic API key from
    // the ANTHROPIC_API_KEY Worker secret (never sent to the client), and
    // forwards the request to Anthropic's API. The model is fixed here,
    // not client-supplied, so callers cannot request an arbitrary model.
    if (url.pathname === '/ai') {
      // ── AI HOLD (Oct 4, 2026) ── AI is OFF unless the Worker variable
      // AI_ENABLED is set to exactly "true". Nothing is sent to Anthropic
      // and nothing is billed while this is off. To turn back on later:
      // add AI_ENABLED=true in Cloudflare (Worker > Settings > Variables).
      if (env.AI_ENABLED !== 'true') {
        return new Response(JSON.stringify({ ok: false, paused: true, error: 'AI features are paused.' }),
          { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      if (!env.ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ ok: false, error: 'AI proxy not configured' }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // Added 2026-10-22 (security audit finding 5): the AI route needs a
      // valid signed session token (Authorization: Bearer <kcm_session_token>).
      // The AI calls in the apps must send it when AI is switched back on.
      const aiBearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const aiSession = await verifySession(aiBearer, env.SESSION_SIGNING_KEY, env.REVOKED_SESSIONS);
      if (!aiSession) {
        return J({ ok: false, error: 'Sign in required' }, 401);
      }

      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: '"messages" array is required' }),
          { status: 422, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      // Added 2026-10-22: cap request size and daily volume so a valid token
      // cannot be used to run up the Anthropic bill. Limits are adjustable
      // with the AI_DAILY_MAX (per IP) and AI_GLOBAL_DAILY_MAX variables.
      // Counters are best effort (KV is not atomic) and fail CLOSED, since
      // this route costs money.
      if (body.messages.length > 20 || JSON.stringify(body.messages).length > 20000) {
        return J({ ok: false, error: 'Request too large' }, 413);
      }
      if (CREATOR_KV) {
        try {
          const aiDay = new Date().toISOString().slice(0, 10);
          const ipKey = 'ai:' + aiDay + ':' + (request.headers.get('CF-Connecting-IP') || 'x');
          const allKey = 'ai:' + aiDay + ':all';
          const [ipN, allN] = await Promise.all([CREATOR_KV.get(ipKey), CREATOR_KV.get(allKey)]);
          if ((Number(ipN) || 0) >= (Number(env.AI_DAILY_MAX) || 40) ||
              (Number(allN) || 0) >= (Number(env.AI_GLOBAL_DAILY_MAX) || 2000)) {
            return J({ ok: false, error: 'Daily AI limit reached' }, 429);
          }
          await Promise.all([
            CREATOR_KV.put(ipKey, String((Number(ipN) || 0) + 1), { expirationTtl: 172800 }),
            CREATOR_KV.put(allKey, String((Number(allN) || 0) + 1), { expirationTtl: 172800 }),
          ]);
        } catch (e) {
          return J({ ok: false, error: 'AI temporarily unavailable' }, 503);
        }
      }

      // Optional system prompt, forwarded as Anthropic's separate `system` field
      // rather than folded into the first user message.
      const systemPrompt = typeof body.system === 'string' ? body.system.slice(0, 8000) : undefined;

      // Cap max_tokens server-side regardless of what the client requests,
      // so a compromised or buggy client can't run up an unbounded bill.
      // Ceiling raised to 4096 to accommodate the Song Builder's structured
      // multi-section JSON arrangement response (chords + melody per section).
      const requestedMaxTokens = Number(body.max_tokens);
      const maxTokens = Number.isFinite(requestedMaxTokens)
        ? Math.min(Math.max(requestedMaxTokens, 1), 4096)
        : 500;

      let anthropicResponse;
      try {
        anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
            max_tokens: maxTokens,
            ...(systemPrompt ? { system: systemPrompt } : {}),
            messages: body.messages,
          }),
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Upstream request failed' }),
          { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
      }

      const data = await anthropicResponse.json().catch(() => ({}));

      if (!anthropicResponse.ok) {
        // Forward Anthropic's status/detail for debugging, but never log
        // or echo the API key itself (it was never in this response body).
        return new Response(
          JSON.stringify({ ok: false, error: 'AI request failed', anthropic_status: anthropicResponse.status }),
          { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ ok: true, content: data.content }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // ── Newsletter signup ───────────────────────────────────────────────
    // Hardened 2026-10-22 (security audit finding 1). Before this, ANY POST
    // that did not match a route above fell through to this code, and the
    // caller could pick any MailerLite group.
    const SUBSCRIBE_PATHS = ['/api/subscribe', '/subscribe', '/'];
    if (!SUBSCRIBE_PATHS.includes(url.pathname)) {
      return J({ ok: false, error: 'Not found' }, 404);
    }
    if (!env.MAILERLITE_API_KEY) {
      return J({ ok: false, error: 'Signup not configured' }, 500);
    }

    const DEFAULT_GROUP = '179228643447276862';
    // Groups a signup form may choose. Anything else lands in the default
    // group. Add more IDs (comma separated) in the ALLOWED_GROUPS variable.
    const ALLOWED_GROUPS = new Set([
      DEFAULT_GROUP,
      '147630778924778065', // KCM Console Users (gate.html)
      '188921594406503949', // KCM Console Users (per deploy notes)
      '183424819298043087', // Superintendents (superintendent.html)
      ...String(env.ALLOWED_GROUPS || '').split(',').map(g => g.trim()).filter(g => /^\d+$/.test(g)),
    ]);

    // Per-IP limit: 30 signup attempts per hour. Best effort (KV is not
    // atomic) and fails open, since signups matter more than this defense.
    const SUBSCRIBE_MAX_PER_HOUR = 30;
    const subIp = request.headers.get('CF-Connecting-IP') || '';
    if (env.RATE_LIMIT && subIp) {
      try {
        const key = 'subscribe:' + subIp;
        const now = Date.now();
        const rec = await env.RATE_LIMIT.get(key, { type: 'json' });
        let count = 1;
        let resetAt = now + 3600 * 1000;
        if (rec && rec.resetAt > now) { count = rec.count + 1; resetAt = rec.resetAt; }
        if (count > SUBSCRIBE_MAX_PER_HOUR) {
          return new Response(JSON.stringify({ ok: false, error: 'Too many requests, try again later' }),
            { status: 429, headers: { ...cors, 'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil((resetAt - now) / 1000)) } });
        }
        await env.RATE_LIMIT.put(key, JSON.stringify({ count, resetAt }),
          { expirationTtl: Math.max(60, Math.ceil((resetAt - now) / 1000)) });
      } catch (e) { /* KV hiccup: fail open */ }
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return J({ ok: false, error: 'Invalid JSON' }, 400);
    }
    if (!body || typeof body !== 'object') return J({ ok: false, error: 'Invalid JSON' }, 400);

    // Cloudflare Turnstile. OFF until the TURNSTILE_SECRET variable is set;
    // once set, every signup form must send the widget's token as
    // "turnstile_token" (or "cf-turnstile-response"), and this fails closed.
    if (env.TURNSTILE_SECRET) {
      const tsToken = typeof body.turnstile_token === 'string' ? body.turnstile_token
        : (typeof body['cf-turnstile-response'] === 'string' ? body['cf-turnstile-response'] : '');
      let tsOK = false;
      if (tsToken && tsToken.length <= 2048) {
        try {
          const form = new FormData();
          form.append('secret', env.TURNSTILE_SECRET);
          form.append('response', tsToken);
          if (subIp) form.append('remoteip', subIp);
          const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
          const tsData = await tsRes.json().catch(() => ({}));
          tsOK = tsData.success === true;
        } catch (e) { tsOK = false; }
      }
      if (!tsOK) return J({ ok: false, error: 'Verification failed' }, 403);
    }

    const email = sanitize((typeof body.email === 'string' ? body.email : '').toLowerCase(), 100);
    const fieldsName = (body.fields && typeof body.fields === 'object' && typeof body.fields.name === 'string') ? body.fields.name : '';
    const subscriberName = sanitize((typeof body.name === 'string' ? body.name : '') || fieldsName, 100);
    let groupId = DEFAULT_GROUP;
    const requestedGroup = typeof body.group === 'string' ? body.group
      : (Array.isArray(body.groups) && typeof body.groups[0] === 'string' ? body.groups[0] : '');
    if (ALLOWED_GROUPS.has(requestedGroup)) groupId = requestedGroup;
    let signupSource = 'tuner-landing';
    if (typeof body.signup_source === 'string') {
      signupSource = sanitize(body.signup_source, 60);
    }
    const leadRef = normRef(body.ref);
    if (leadRef) signupSource = sanitize(signupSource + '|ref:' + leadRef, 80);

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRe.test(email)) {
      return J({ ok: false, error: 'Invalid email' }, 422);
    }

    let mlResponse;
    try {
      mlResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Accept':        'application/json',
          'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
        },
        body: JSON.stringify({
          email:  email,
          fields: { signup_source: signupSource, ...(subscriberName ? { name: subscriberName } : {}) },
          groups: [groupId],
          status: 'active',
        }),
      });
    } catch (e) {
      return J({ ok: false, error: 'Upstream request failed' }, 502);
    }

    if (mlResponse.ok || mlResponse.status === 409) {
      try {
        if (leadRef && await getCreator(leadRef) && await once('lead:' + email + ':' + leadRef)) {
          await bumpStats(leadRef, s => { s.leads += 1; });
        }
      } catch (e) { /* tracking only */ }
      return J({ ok: true });
    }

    // MailerLite's own error text is no longer passed back to the browser.
    return J({ ok: false, ml_status: mlResponse.status });
  }
};
