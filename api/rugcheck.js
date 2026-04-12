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

    const settled = await Promise.all(attempts.map(async (attempt) => {
      try {
        const { response, data } = await fetchJson(attempt.url);
        return {
          label: attempt.label,
          ok: response.ok,
          status: response.status,
          data,
          message: data?.message || data?.error || (response.ok ? null : ('HTTP ' + response.status)),
        };
      } catch (err) {
        return {
          label: attempt.label,
          ok: false,
          status: null,
          data: null,
          message: err.message,
        };
      }
    }));

    const report = settled.find((item) => item.label === 'report' && item.ok)?.data || null;
    const summary = settled.find((item) => item.label === 'summary' && item.ok)?.data || null;

    if (report || summary) {
      const merged = {
        ...(summary && typeof summary === 'object' ? summary : {}),
        ...(report && typeof report === 'object' ? report : {}),
      };

      if (!Array.isArray(merged.risks)) {
        merged.risks = Array.isArray(report?.risks) ? report.risks : Array.isArray(summary?.risks) ? summary.risks : [];
      }

      if (!merged.tokenMeta && report?.fileMeta) {
        merged.tokenMeta = report.fileMeta;
      }

      if (!merged.token) {
        merged.token = {};
      }

      if (merged.freezeAuthority == null && Object.prototype.hasOwnProperty.call(merged.token, 'freezeAuthority')) {
        merged.freezeAuthority = merged.token.freezeAuthority;
      }

      if (merged.mintAuthority == null && Object.prototype.hasOwnProperty.call(merged.token, 'mintAuthority')) {
        merged.mintAuthority = merged.token.mintAuthority;
      }

      if (merged.score == null && merged.score_normalised != null) {
        merged.score = merged.score_normalised;
      }

      merged.__sources = settled.filter((item) => item.ok).map((item) => item.label);
      return res.status(200).json(merged);
    }

    const lastError = settled.find((item) => item.message) || null;

    return res.status(502).json({
      error: 'rugcheck_upstream_error',
      message: lastError?.message || 'Unknown RugCheck error',
      step: lastError?.label || null,
      upstream_status: lastError?.status || null,
      body: lastError?.body || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'rugcheck_proxy_error', message: err.message });
  }
};
