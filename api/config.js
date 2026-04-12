const { applyCors, rateLimit } = require('./_utils');

module.exports = async (req, res) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  if (rateLimit(req, res, 'config', 60 * 1000, 60)) return;

  return res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    supportWallet: 'GqXVKZwcQpLHowb2Q7TRdvhw8DBUDVFzTAbVTPfjMxxc',
    xUrl: 'https://x.com/SwannyDeFi',
    brand: 'DLMM CHECKER by SwannyDeFi',
  });
};
