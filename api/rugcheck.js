const fetch = require('node-fetch');

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    timeout: 20000,
  });

  const data = await response.json().catch(() => null);
  return { response, data };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const mint = req.query.mint;
    if (!mint) return res.status(400).json({ error: 'Missing ?mint=' });

    const base = 'https://api.rugcheck.xyz/v1/tokens/' + encodeURIComponent(mint);
    const attempts = [
      { label: 'report', url: base + '/report' },
      { label: 'summary', url: base + '/report/summary' },
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        const { response, data } = await fetchJson(attempt.url);
        if (!response.ok) {
          lastError = {
            step: attempt.label,
            status: response.status,
            message: data?.message || data?.error || ('HTTP ' + response.status),
            body: data,
          };
          continue;
        }

        const payload = data && typeof data === 'object' ? { ...data } : {};
        payload.__source = attempt.label;
        return res.status(200).json(payload);
      } catch (err) {
        lastError = {
          step: attempt.label,
          message: err.message,
        };
      }
    }

    return res.status(502).json({
      error: 'rugcheck_upstream_error',
      message: lastError?.message || 'Unknown RugCheck error',
      step: lastError?.step || null,
      upstream_status: lastError?.status || null,
      body: lastError?.body || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'rugcheck_proxy_error', message: err.message });
  }
};
