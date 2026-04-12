module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    supportWallet: 'GqXVKZwcQpLHowb2Q7TRdvhw8DBUDVFzTAbVTPfjMxxc',
    xUrl: 'https://x.com/SwannyDeFi',
    brand: 'DLMM CHECKER by SwannyDeFi',
  });
};
