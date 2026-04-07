const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const mint = req.query.mint;
    if (!mint) return res.status(400).json({ error: 'Missing ?mint=' });

    const apiKey = process.env.BUBBLEMAPS_API_KEY || '';
    if (!apiKey) {
      return res.status(200).json({
        available: false,
        reason: 'missing_api_key',
      });
    }

    const url = `https://api.bubblemaps.io/maps/solana/${encodeURIComponent(mint)}?use_magic_nodes=true&return_nodes=true&return_clusters=true&return_decentralization_score=true`;
    const response = await fetch(url, {
      headers: {
        'X-ApiKey': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      timeout: 30000,
    });

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = null;
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'bubblemaps_upstream_error',
        status: response.status,
        message: data?.message || text.slice(0, 300),
      });
    }

    const clusters = Array.isArray(data?.clusters) ? data.clusters : [];
    const topHolders = Array.isArray(data?.nodes?.top_holders) ? data.nodes.top_holders : [];
    const magicNodes = Array.isArray(data?.nodes?.magic_nodes) ? data.nodes.magic_nodes : [];

    const largestClusterShare = clusters.reduce((max, cluster) => Math.max(max, Number(cluster?.share) || 0), 0);
    const bundledShare = clusters
      .filter((cluster) => Number(cluster?.holder_count) > 1)
      .reduce((sum, cluster) => sum + (Number(cluster?.share) || 0), 0);
    const shownHolderShare = topHolders
      .filter((holder) => holder?.is_shown_on_map)
      .reduce((sum, holder) => sum + (Number(holder?.holder_data?.share) || 0), 0);
    const suspiciousShare = topHolders
      .filter((holder) => {
        const details = holder?.address_details || {};
        return details.is_contract || details.is_supernode || details.inward_relations > 20 || details.outward_relations > 20;
      })
      .reduce((sum, holder) => sum + (Number(holder?.holder_data?.share) || 0), 0);

    return res.status(200).json({
      available: true,
      source: 'bubblemaps',
      decentralizationScore: data?.decentralization_score ?? null,
      clusterCount: clusters.length,
      largestClusterShare,
      bundledShare,
      shownHolderShare,
      suspiciousShare,
      magicNodeCount: magicNodes.length,
      cexShare: data?.metadata?.identified_supply?.share_in_cexs ?? null,
      dexShare: data?.metadata?.identified_supply?.share_in_dexs ?? null,
      otherContractsShare: data?.metadata?.identified_supply?.share_in_other_contracts ?? null,
      raw: {
        metadata: data?.metadata || null,
        clusters,
        top_holders: topHolders.slice(0, 20),
        magic_nodes: magicNodes.slice(0, 20),
      },
    });
  } catch (err) {
    return res.status(500).json({
      error: 'bubblemaps_proxy_error',
      message: err.message,
    });
  }
};
