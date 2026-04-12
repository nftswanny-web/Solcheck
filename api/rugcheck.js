const fetch = require('node-fetch');

const RUGCHECK_KEY = process.env.RUGCHECK_API_KEY || '';

async function fetchJson(url) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0',
  };
  if (RUGCHECK_KEY) {
    headers['Authorization'] = 'Bearer ' + RUGCHECK_KEY;
  }
  const response = await fetch(url, {
    headers,
    timeout: 20000,
  });
  const data = await response.json().catch(() => null);
  return { response, data };
}

/**
 * Normalise RugCheck raw score to 0-100.
 *
 * The raw "score" from the API is a cumulative sum of risk points:
 *   - 0        = no risks found  → 0 /100
 *   - ~300     = minor issues    → ~15/100
 *   - ~2000    = moderate        → ~50/100
 *   - ~5000    = high risk       → ~75/100
 *   - 10000+   = extreme risk    → 90-100/100
 *
 * We use a logarithmic curve so low scores spread out nicely
 * and very high scores converge toward 100.
 */
function normaliseScore(raw) {
  if (raw == null || raw < 0) return null;
  if (raw === 0) return 0;
  // log curve: score100 = 100 * log10(1 + raw) / log10(1 + 20000)
  // 20000 chosen as practical max (TRUMP token = 18715)
  const max = 20000;
  const score100 = 100 * Math.log10(1 + raw) / Math.log10(1 + max);
  return Math.round(Math.min(score100, 100) * 10) / 10; // 1 decimal
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

      // ── SCORE NORMALISATION ────────────────────────────────────
      //
      // API fields:
      //   score             → raw cumulative risk points (0 … 20000+)
      //   score_normalised  → 0-100 (may or may not exist)
      //
      // Strategy:
      //   1. If score_normalised exists → use it directly
      //   2. Otherwise               → compute from raw via log curve
      //
      // The frontend reads "score" and shows it as X / 100.

      const rawScore = report?.score ?? summary?.score ?? null;
      const normScore = report?.score_normalised ?? summary?.score_normalised ?? null;

      merged.score_raw = rawScore;

      if (normScore != null) {
        merged.score = normScore;
      } else {
        merged.score = normaliseScore(rawScore);
      }

      merged.score_normalised = merged.score;
      // ── END SCORE NORMALISATION ────────────────────────────────

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
