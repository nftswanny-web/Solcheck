const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const source = req.method === 'POST' ? (req.body || {}) : req.query;
    const path = source.path;
    if (!path) return res.status(400).json({ error: 'Missing ?path=' });

    const apiKey = source.apikey || '';
    const routeKey = source.routeKey || apiKey;
    const method = (source.method || 'GET').toUpperCase();
    const body = source.body;
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
      if (text.includes('cf-browser-verification') || text.includes('challenge-platform')) {
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
