 const fetch = require('node-fetch');

function normalizePercent(value) {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/[^\d.]+/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMetric(html, labels) {
  const normalized = html.replace(/\s+/g, ' ');
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`${escaped}\\s*</[^>]+>\\s*<[^>]+>\\s*([\\d.,]+)%`, 'i'),
      new RegExp(`${escaped}[^\\d%]{0,80}([\\d.,]+)%`, 'i'),
      new RegExp(`"label"\\s*:\\s*"${escaped}"[^\\d%]{0,120}"value"\\s*:\\s*"([\\d.,]+)%"`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      const value = normalizePercent(match?.[1]);
      if (value != null) return value;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const pool = req.query.pool;
    if (!pool) return res.status(400).json({ error: 'Missing ?pool=' });

    const url = `https://www.geckoterminal.com/solana/pools/${encodeURIComponent(pool)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 20000,
    });

    const html = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'geckoterminal_upstream_error',
        status: response.status,
        message: html.slice(0, 300),
      });
    }

    const bundledBuyPct = extractMetric(html, ['Bundled Buy %', 'Bundled Buy']);
    const airdropPct = extractMetric(html, ['Airdrop %', 'Airdrop']);

    return res.status(200).json({
      ok: true,
      source: 'geckoterminal',
      pool,
      bundledBuyPct,
      airdropPct,
      found: bundledBuyPct != null || airdropPct != null,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'geckoterminal_proxy_error',
      message: err.message,
    });
  }
};
