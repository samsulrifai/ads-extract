import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PARTNER_ID, API_HOST, REDIRECT_URL, generateSign, corsHeaders } from './_lib/shopee.js';

/**
 * GET /api/auth-url
 * Generate Shopee OAuth authorization URL with valid signature.
 * Frontend calls this, then redirects user to the returned URL.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }

  try {
    if (!PARTNER_ID || !process.env.SHOPEE_PARTNER_KEY) {
      return res.status(500).json({ error: 'Server misconfigured: missing Shopee credentials' });
    }

    const apiPath = '/api/v2/shop/auth_partner';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp);

    const params = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      sign,
      redirect: REDIRECT_URL,
    });

    const authUrl = `${API_HOST}${apiPath}?${params.toString()}`;

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ auth_url: authUrl });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
