const fetch = require('node-fetch');
const { applyCors, rateLimit, getCachedValue, setCachedValue } = require('./_utils');

const ALLOWED_PATHS = [
  /^\/pair\/all$/i,
  /^\/pools\?page=\d+&page_size=\d+&query=[^&]+$/i,
];

function isAllowedPath(path) {
  return ALLOWED_PATHS.some((pattern) => pattern.test(path));
}

module.exports = async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (rateLimit(req, res, 'meteora', 60 * 1000, 30)) return;

  try {
    const path = req.query.path || '/pools';
    if (!isAllowedPath(path)) {
      return res.status(403).json({
        error: 'path_not_allowed',
        message: 'This Meteora route is not allowed.',
      });
    }
    const cacheKey = `meteora:${path}`;
    const cached = getCachedValue(cacheKey);
    if (cached) return res.status(200).json(cached);
    const baseUrl = path.startsWith('/pair/') ? 'https://dlmm-api.meteora.ag' : 'https://dlmm.datapi.meteora.ag';
    const fullUrl = baseUrl + path;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Meteora API returned ' + response.status });
    }

    const data = await response.json();
    setCachedValue(cacheKey, data, 60 * 1000);
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'meteora_proxy_error', message: err.message });
  }
};
