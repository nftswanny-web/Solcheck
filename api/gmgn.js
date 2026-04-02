const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const path = req.query.path;
    if (!path) return res.status(400).json({ error: 'Missing ?path=' });

    const apiKey = req.query.apikey || '';
    const routeKey = req.query.routeKey || apiKey;
    const fullUrl = 'https://gmgn.ai' + path;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Referer': 'https://gmgn.ai/sol/token/' + (path.split('/').pop() || ''),
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
      },
      timeout: 25000,
      redirect: 'follow',
    });

    const text = await response.text();

    // Try parse as JSON
    try {
      const json = JSON.parse(text);
      res.status(response.status).json(json);
    } catch(e) {
      // If Cloudflare HTML challenge, return specific error
      if (text.includes('cf-browser-verification') || text.includes('challenge-platform')) {
        res.status(403).json({
          error: 'cloudflare_challenge',
          message: 'GMGN blocked the request with a Cloudflare challenge.',
          hint: 'Use a valid GMGN route/API key with server-side access or an approved GMGN Agent integration.',
        });
      } else {
        res.status(response.status).send(text.substring(0, 500));
      }
    }
  } catch (err) {
    res.status(500).json({ error: 'proxy_error', message: err.message });
  }
};
