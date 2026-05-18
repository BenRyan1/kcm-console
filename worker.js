export default {
  async fetch(request, env) {

    const cors = {
      'Access-Control-Allow-Origin': 'https://keyscodesandmodes.com',
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

    // ── Sanitize helper ──────────────────────────────────────
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
    // ────────────────────────────────────────────────────────

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
