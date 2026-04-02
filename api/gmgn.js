const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const target = req.query.target; // 'gmgn' or 'meteora'
    const path = req.query.path;
    if (!path) return res.status(400).json({ error: 'Missing ?path=' });

    let baseUrl, headers;

    if (target === 'meteora') {
      baseUrl = 'https://dlmm-api.meteora.ag';
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      };
    } else {
      // GMGN
      baseUrl = 'https://gmgn.ai';
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://gmgn.ai/',
        'Origin': 'https://gmgn.ai',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-CH-UA': '"Google Chrome";v="131", "Chromium";v="131"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
      };
      const apiKey = req.query.apikey || req.headers['x-apikey'];
      if (apiKey) headers['Cookie'] = 'gmgn_api_key=' + apiKey;
      if (apiKey) headers['X-APIKEY'] = apiKey;
    }

    const fullUrl = baseUrl + path;
    const response = await fetch(fullUrl, { headers, timeout: 20000 });
    const ct = response.headers.get('content-type') || '';

    // Forward the response
    if (ct.includes('json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      // Check if it's actually JSON despite content-type
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch(e) {
        res.status(response.status).send(text);
      }
    }
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
};
