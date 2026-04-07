const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: 'Missing ?query=' });

    const apiKey = process.env.JUP_API_KEY || '';
    const endpoints = [
      {
        url: 'https://api.jup.ag/tokens/v2/search?query=' + encodeURIComponent(query),
        headers: apiKey ? { 'x-api-key': apiKey } : {},
      },
      {
        url: 'https://lite-api.jup.ag/tokens/v2/search?query=' + encodeURIComponent(query),
        headers: {},
      },
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            'Accept': 'application/json',
            ...endpoint.headers,
          },
          timeout: 20000,
        });

        if (!response.ok) {
          lastError = 'HTTP ' + response.status;
          continue;
        }

        const data = await response.json();
        return res.status(200).json(data);
      } catch (err) {
        lastError = err.message;
      }
    }

    return res.status(502).json({ error: 'jupiter_proxy_error', message: lastError || 'Unknown Jupiter error' });
  } catch (err) {
    return res.status(500).json({ error: 'jupiter_proxy_error', message: err.message });
  }
};
