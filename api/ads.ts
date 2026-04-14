import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';

/**
 * POST /api/ads
 * Proxy Shopee Ads API calls. Frontend sends the access_token it stored,
 * this function adds the HMAC signature (using the secret Partner Key)
 * and forwards the request to Shopee.
 *
 * Body: {
 *   access_token: string,
 *   shop_id: number,
 *   api_path: string,         // e.g. "/api/v2/ads/get_all_ads"
 *   method?: "GET" | "POST",  // default GET
 *   params?: object,          // extra query params
 *   body?: object,            // POST body
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      access_token,
      shop_id,
      api_path,
      method = 'GET',
      params: extraParams = {},
      body: requestBody,
    } = req.body;

    if (!access_token || !shop_id || !api_path) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: 'Missing access_token, shop_id, or api_path' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(api_path, timestamp, access_token, Number(shop_id));

    const queryParams = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      sign,
      access_token,
      shop_id: String(shop_id),
      ...extraParams,
    });

    const url = `${API_HOST}${api_path}?${queryParams.toString()}`;

    let response: Response;
    if (method.toUpperCase() === 'GET') {
      response = await fetch(url);
    } else {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody || {}),
      });
    }

    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
