const fetch = require('node-fetch');

function extractJupiterTokenFromHtml(html, mint) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">\s*([\s\S]*?)<\/script>/i);
  if (!match) return null;
  const payload = JSON.parse(match[1]);
  const queries = payload?.props?.pageProps?.dehydratedState?.queries;
  if (!Array.isArray(queries)) return null;

  for (const query of queries) {
    const key = query?.queryKey;
    const data = query?.state?.data;
    if (!data) continue;
    if (Array.isArray(key) && key.includes(mint)) return data;
    if (data?.id === mint) return data;
  }

  return null;
}

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
        type: 'json',
      },
      {
        url: 'https://lite-api.jup.ag/tokens/v2/search?query=' + encodeURIComponent(query),
        headers: {},
        type: 'json',
      },
      {
        url: 'https://jup.ag/tokens/' + encodeURIComponent(query),
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'text/html',
        },
        type: 'html',
      },
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            'Accept': endpoint.type === 'html' ? 'text/html' : 'application/json',
            ...endpoint.headers,
          },
          timeout: 20000,
        });

        if (!response.ok) {
          lastError = 'HTTP ' + response.status;
          continue;
        }

        if (endpoint.type === 'html') {
          const html = await response.text();
          const data = extractJupiterTokenFromHtml(html, query);
          if (data) return res.status(200).json(data);
          lastError = 'Could not extract token data from Jupiter HTML';
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
