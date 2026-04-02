const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
