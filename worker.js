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

      const validCodes = new Set([
        env.CODE_PREMIUM,
        env.CODE_FOUNDER,
        env.CODE_BETA,
        env.CODE_PRESS,
        env.CODE_FRIEND,
        env.CODE_DEMO,
        env.CODE_SUPT,
        env.CODE_YMS,
      ]);

      const valid = code.length > 0 && validCodes.has(code);

      return new Response(JSON.stringify({ ok: valid }),
        {
          status: valid ? 200 : 401,
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

      // Cap max_tokens server-side regardless of what the client requests,
      // so a compromised or buggy client can't run up an unbounded bill.
      const requestedMaxTokens = Number(body.max_tokens);
      const maxTokens = Number.isFinite(requestedMaxTokens)
        ? Math.min(Math.max(requestedMaxTokens, 1), 1024)
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

    let email = '';
    try {
      const body = await request.json();
      email = sanitize((body.email || '').toLowerCase(), 100);
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
        fields: { signup_source: 'tuner-landing' },
        groups: ['179228643447276862'],
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
