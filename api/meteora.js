const fetch = require('node-fetch');
const { applyCors, rateLimit } = require('./_utils');

module.exports = async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (rateLimit(req, res, 'meteora', 60 * 1000, 30)) return;

  try {
    const path = req.query.path || '/pools';
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
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'meteora_proxy_error', message: err.message });
  }
};
