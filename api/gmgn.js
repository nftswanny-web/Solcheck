const crypto = require('crypto');
const fetch = require('node-fetch');
const { applyCors, rateLimit } = require('./_utils');

function unixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function makeClientId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return [4, 2, 2, 2, 6].map((len) => crypto.randomBytes(len).toString('hex')).join('-');
}

module.exports = async (req, res) => {
  applyCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (rateLimit(req, res, 'gmgn', 60 * 1000, 15)) return;

  try {
    const mint = String(req.query.mint || '').trim();
    if (!mint) return res.status(400).json({ error: 'missing_mint' });
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
      return res.status(400).json({ error: 'invalid_mint' });
    }

    const apiKey = process.env.GMGN_API_KEY || process.env.GMGN_AGENT_API_KEY || '';
    const routeKey = process.env.GMGN_ROUTE_KEY || '';
    const baseUrl = process.env.GMGN_BASE_URL || 'https://openapi.gmgn.ai';
    const timestamp = unixSeconds();
    const clientId = makeClientId();
    const fullUrl = `${baseUrl}/v1/token/info?chain=sol&address=${encodeURIComponent(mint)}&timestamp=${timestamp}&client_id=${encodeURIComponent(clientId)}`;

    const headers = {
      'User-Agent': 'DLMMChecker/1.0 (+https://dlmmchecker.vercel.app)',
      'Accept': 'application/json, text/plain, */*',
      'X-APIKEY': apiKey || undefined,
      'x-api-key': apiKey || undefined,
      'x-route-key': routeKey || undefined,
      'Authorization': apiKey ? `Bearer ${apiKey}` : undefined,
    };

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      timeout: 25000,
      redirect: 'follow',
    });

    const text = await response.text();
    const debugHeaders = {
      'content-type': response.headers.get('content-type'),
      'server': response.headers.get('server'),
      'cf-ray': response.headers.get('cf-ray'),
      'cf-cache-status': response.headers.get('cf-cache-status'),
      'x-frame-options': response.headers.get('x-frame-options'),
    };

    try {
      const json = JSON.parse(text);
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'gmgn_upstream_error',
          upstream_status: response.status,
          headers: debugHeaders,
          request: {
            host: baseUrl,
            endpoint: '/v1/token/info',
            authMode: 'standard',
            method: 'GET',
            hasApiKey: Boolean(apiKey),
            hasRouteKey: Boolean(routeKey),
          },
          body: json,
        });
      }

      return res.status(response.status).json({
        ...json,
        __request: {
          host: baseUrl,
          endpoint: '/v1/token/info',
          authMode: 'standard',
          method: 'GET',
        },
      });
    } catch (e) {
      if (
        text.includes('cf-browser-verification') ||
        text.includes('challenge-platform') ||
        text.includes('Attention Required! | Cloudflare') ||
        text.includes('<title>Attention Required!') ||
        text.includes('<title>Just a moment...')
      ) {
        return res.status(403).json({
          error: 'cloudflare_challenge',
          upstream_status: response.status,
          headers: debugHeaders,
          request: {
            host: baseUrl,
            endpoint: '/v1/token/info',
            authMode: 'standard',
            method: 'GET',
            hasApiKey: Boolean(apiKey),
            hasRouteKey: Boolean(routeKey),
          },
          message: 'GMGN blocked the request with a Cloudflare challenge.',
          hint: 'This usually means the backend IP/environment is not yet accepted for this OpenAPI route.',
          body_preview: text.substring(0, 1000),
        });
      }

      return res.status(response.status).json({
        error: 'gmgn_non_json_response',
        upstream_status: response.status,
        headers: debugHeaders,
        request: {
          host: baseUrl,
          endpoint: '/v1/token/info',
          authMode: 'standard',
          method: 'GET',
          hasApiKey: Boolean(apiKey),
          hasRouteKey: Boolean(routeKey),
        },
        message: text.substring(0, 500),
        body_preview: text.substring(0, 1000),
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'proxy_error', message: err.message });
  }
};
