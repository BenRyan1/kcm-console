export default {
  async fetch(request, env) {

    const ALLOWED_ORIGINS = [
      'https://keyscodesandmodes.com',
      'https://console.keyscodesandmodes.com',
    ];
    const requestOrigin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(requestOrigin)
        ? requestOrigin
        : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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
    async function verifySession(token, secret) {
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
      return payload;
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/verify-code') {
      let code = '';
      try {
        const body = await request.json();
        code = (body.code || '').trim();
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }),
          { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
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
      };

      let matchedTier = null;
      if (code.length > 0) {
        for (const [tier, value] of Object.entries(codesByTier)) {
          if (value && code === value) { matchedTier = tier; break; }
        }
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
          { tier: matchedTier, exp: Date.now() + SESSION_TTL_MS },
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

      const payload = await verifySession(token, env.SESSION_SIGNING_KEY);
      return new Response(JSON.stringify({ ok: !!payload, tier: payload ? payload.tier : null }),
        {
          status: payload ? 200 : 401,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
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
      if (!env.ANTHROPIC_API_KEY) {
        return new Response(JSON.stringify({ ok: false, error: 'AI proxy not configured' }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
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
          JSON.stringify({ ok: false, error: 'AI request failed', anthropic_status: anthropicResponse.status, detail: data }),
          { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ ok: true, content: data.content }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    let email        = '';
    let subscriberName = '';
    // Defaults preserve the original tuner-landing behavior for any
    // existing caller that doesn't send group/signup_source.
    let groupId      = '179228643447276862';
    let signupSource = 'tuner-landing';
    try {
      const body = await request.json();
      email          = sanitize((body.email || '').toLowerCase(), 100);
      subscriberName = sanitize(body.name || '', 100);
      // Group IDs are plain MailerLite list identifiers, not secrets —
      // safe to accept from the client, but validated as numeric-only
      // so this can't be abused to inject arbitrary fields.
      if (typeof body.group === 'string' && /^\d+$/.test(body.group)) {
        groupId = body.group;
      }
      if (typeof body.signup_source === 'string') {
        signupSource = sanitize(body.signup_source, 60);
      }
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRe.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }),
        { status: 422, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const mlResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
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

    const mlBody = await mlResponse.json().catch(() => ({}));

    if (mlResponse.ok || mlResponse.status === 409) {
      return new Response(JSON.stringify({ ok: true }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ ok: false, ml_status: mlResponse.status, ml_error: mlBody }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
};
