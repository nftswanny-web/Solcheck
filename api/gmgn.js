const fetch = require('node-fetch');
const { applyCors, rateLimit } = require('./_utils');

const ALLOWED_GET_PATHS = [
  /^\/api\/v1\/token_info\/sol\/[1-9A-HJ-NP-Za-km-z]{32,44}$/i,
  /^\/defi\/quotation\/v1\/tokens\/sol\/[1-9A-HJ-NP-Za-km-z]{32,44}$/i,
  /^\/defi\/quotation\/v1\/tokens\/top_traders\/sol\/[1-9A-HJ-NP-Za-km-z]{32,44}\?orderby=profit&direction=desc$/i,
];

const ALLOWED_POST_PATHS = [
  /^\/api\/v1\/multi_window_token_info(\?.*)?$/i,
  /^\/api\/v1\/mutil_window_token_info(\?.*)?$/i,
];

function isAllowedPath(method, path) {
  const patterns = method === 'POST' ? ALLOWED_POST_PATHS : ALLOWED_GET_PATHS;
  return patterns.some((pattern) => pattern.test(path));
}

module.exports = async (req, res) => {
  applyCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (rateLimit(req, res, 'gmgn', 60 * 1000, 15)) return;

  try {
    const source = req.query;
    const path = source.path;
    if (!path) return res.status(400).json({ error: 'Missing ?path=' });
    const method = 'GET';
    if (!isAllowedPath(method, path)) {
      return res.status(403).json({ error: 'path_not_allowed', message: 'This GMGN route is not allowed.' });
    }

    const apiKey = process.env.GMGN_API_KEY || process.env.GMGN_AGENT_API_KEY || '';
    const routeKey = process.env.GMGN_ROUTE_KEY || apiKey;
    const body = undefined;
    const fullUrl = 'https://gmgn.ai' + path;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Referer': 'https://gmgn.ai/sol/token/' + ((body && Array.isArray(body.addresses) && body.addresses[0]) || path.split('/').pop() || ''),
      'Origin': 'https://gmgn.ai',
      'Cookie': apiKey ? 'gmgn_api_token=' + apiKey + '; _ga=GA1.1.123456789.1700000000' : '_ga=GA1.1.123456789.1700000000',
      'X-APIKEY': apiKey || undefined,
      'x-route-key': routeKey || undefined,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-CH-UA': '"Chromium";v="131", "Google Chrome";v="131"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"macOS"',
      'Priority': 'u=1, i',
    };
    if (method !== 'GET') headers['Content-Type'] = 'application/json';

    const response = await fetch(fullUrl, {
      method,
      headers,
      body: method === 'GET' || body == null ? undefined : JSON.stringify(body),
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

    // Try parse as JSON
    try {
      const json = JSON.parse(text);
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'gmgn_upstream_error',
          upstream_status: response.status,
          headers: debugHeaders,
          body: json,
        });
      }
      res.status(response.status).json(json);
    } catch(e) {
      // If Cloudflare HTML challenge, return specific error
      if (
        text.includes('cf-browser-verification') ||
        text.includes('challenge-platform') ||
        text.includes('Attention Required! | Cloudflare') ||
        text.includes('<title>Attention Required!')
      ) {
        res.status(403).json({
          error: 'cloudflare_challenge',
          upstream_status: response.status,
          headers: debugHeaders,
          message: 'GMGN blocked the request with a Cloudflare challenge.',
          hint: 'Use a valid GMGN route/API key with server-side access or an approved GMGN Agent integration.',
          body_preview: text.substring(0, 1000),
        });
      } else {
        res.status(response.status).json({
          error: 'gmgn_non_json_response',
          status: response.status,
          headers: debugHeaders,
          message: text.substring(0, 500),
          body_preview: text.substring(0, 1000),
        });
      }
    }
  } catch (err) {
    res.status(500).json({ error: 'proxy_error', message: err.message });
  }
};
