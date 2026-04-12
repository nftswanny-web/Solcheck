const fetch = require('node-fetch');

async function fetchJson(url) {
  const apiKey = process.env.RUGCHECK_API_KEY || process.env.RUGCHECK_API || process.env.RUGCHECK_KEY || '';
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      ...(apiKey ? { 'X-API-KEY': apiKey, 'Authorization': 'Bearer ' + apiKey } : {}),
    },
    timeout: 20000,
  });

  const data = await response.json().catch(() => null);
  return { response, data };
}

function clampScore(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const numeric = Number(value);
  if (numeric < 0) return null;
  return Math.max(0, Math.min(100, numeric));
}

function toRiskArray(payload) {
  if (Array.isArray(payload?.risks)) return payload.risks;
  if (Array.isArray(payload?.warnings)) {
    return payload.warnings.map((warning) => ({
      name: warning?.title || warning?.name || 'Warning',
      description: warning?.message || warning?.description || '',
      level: warning?.severity || warning?.level || 'warn',
      score: warning?.score || 0,
    }));
  }
  if (Array.isArray(payload?.scams)) {
    return payload.scams.map((scam) => ({
      name: scam?.type || scam?.name || 'Scam',
      description: scam?.message || scam?.description || '',
      level: 'danger',
      score: scam?.score || 0,
    }));
  }
  return [];
}

function pickTokenMeta(payload) {
  return payload?.tokenMeta
    || payload?.fileMeta
    || payload?.metadata
    || payload?.token?.metadata
    || null;
}

function normalizeScore(merged) {
  const trustScoreValue = merged?.trustScore?.value ?? merged?.trustScore?.score ?? null;
  const normalizedScore = clampScore(
    merged?.score_normalised
    ?? merged?.score_normalized
    ?? trustScoreValue
  );

  if (normalizedScore != null) return normalizedScore;

  const rawScore = merged?.score;
  if (rawScore == null) return null;
  const numeric = Number(rawScore);
  if (!Number.isFinite(numeric) || numeric < 0) return null;

  // Older RugCheck payloads often exposed a larger raw score; map that back onto a 0-100 display scale.
  if (numeric > 100) return clampScore(numeric / 100);
  return clampScore(numeric);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const mint = req.query.mint;
    if (!mint) return res.status(400).json({ error: 'Missing ?mint=' });

    const encodedMint = encodeURIComponent(mint);
    const base = 'https://api.rugcheck.xyz/v1/tokens/' + encodedMint;
    const attempts = [
      { label: 'scan', url: 'https://api.rugcheck.xyz/tokens/scan/solana/' + encodedMint + '?includeDexScreenerData=true&includeSignificantEvents=true' },
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

    const scan = settled.find((item) => item.label === 'scan' && item.ok)?.data || null;
    const report = settled.find((item) => item.label === 'report' && item.ok)?.data || null;
    const summary = settled.find((item) => item.label === 'summary' && item.ok)?.data || null;

    if (scan || report || summary) {
      const merged = {
        ...(scan && typeof scan === 'object' ? scan : {}),
        ...(summary && typeof summary === 'object' ? summary : {}),
        ...(report && typeof report === 'object' ? report : {}),
      };

      if (!Array.isArray(merged.risks)) {
        merged.risks = toRiskArray(report) || toRiskArray(summary) || toRiskArray(scan);
      }

      merged.tokenMeta = pickTokenMeta(merged) || pickTokenMeta(report) || pickTokenMeta(summary) || pickTokenMeta(scan);

      if (!merged.token) {
        merged.token = {};
      }

      if (merged.freezeAuthority == null && Object.prototype.hasOwnProperty.call(merged.token, 'freezeAuthority')) {
        merged.freezeAuthority = merged.token.freezeAuthority;
      }

      if (merged.mintAuthority == null && Object.prototype.hasOwnProperty.call(merged.token, 'mintAuthority')) {
        merged.mintAuthority = merged.token.mintAuthority;
      }

      merged.score = normalizeScore(merged);
      merged.score_normalised = merged.score;
      merged.score_normalized = merged.score;

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
