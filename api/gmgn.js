const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const gmgnPath = req.query.path;
    if (!gmgnPath) return res.status(400).json({ error: 'Missing ?path=' });

    const gmgnUrl = 'https://gmgn.ai' + gmgnPath;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://gmgn.ai/',
      'Origin': 'https://gmgn.ai',
    };

    const apiKey = req.query.apikey || req.headers['x-apikey'];
    if (apiKey) headers['X-APIKEY'] = apiKey;

    const response = await fetch(gmgnUrl, { headers, timeout: 20000 });
    const ct = response.headers.get('content-type') || '';

    if (ct.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
};
