import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';

/**
 * POST /api/refresh-token
 * Refresh an expired access_token using a refresh_token.
 *
 * Body: { refresh_token: string, shop_id: number }
 * Returns: { success, access_token, refresh_token, expire_in, shop_id }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { refresh_token, shop_id } = req.body;

    if (!refresh_token || !shop_id) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: 'Missing refresh_token or shop_id' });
    }

    const apiPath = '/api/v2/auth/access_token/get';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp);

    const params = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      sign,
    });

    const response = await fetch(`${API_HOST}${apiPath}?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token,
        partner_id: PARTNER_ID,
        shop_id: Number(shop_id),
      }),
    });

    const data = await response.json();

    if (data.error) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ success: false, error: data.error, message: data.message });
    }

    // Also update tokens in Supabase so other devices can access them
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const expiredAt = new Date((timestamp + data.expire_in) * 1000).toISOString();

        await supabase.from('shops').update({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expired_at: expiredAt,
          updated_at: new Date().toISOString(),
        }).eq('shopee_shop_id', Number(shop_id));
      }
    } catch (dbErr) {
      console.error('Failed to update tokens in Supabase:', dbErr);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expire_in: data.expire_in,
      shop_id: Number(shop_id),
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: error.message });
  }
}
