import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { PARTNER_ID, API_HOST, generateSign, corsHeaders } from './_lib/shopee.js';

/**
 * POST /api/shopee-callback
 * Exchange Shopee authorization code for access_token + refresh_token.
 * Also upserts the shop record into Supabase.
 *
 * Body: { code: string, shop_id: number }
 * Returns: { success: true, access_token, refresh_token, expire_in, shop_id }
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
    const { code, shop_id } = req.body;

    if (!code || !shop_id) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ error: 'Missing code or shop_id' });
    }

    const apiPath = '/api/v2/auth/token/get';
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
        code,
        partner_id: PARTNER_ID,
        shop_id: Number(shop_id),
      }),
    });

    const data = await response.json();

    if (data.error) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({
        success: false,
        error: data.error,
        message: data.message || '',
      });
    }

    // Persist shop + tokens to Supabase (best-effort, don't block response)
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const expiredAt = new Date((timestamp + data.expire_in) * 1000).toISOString();

        await supabase.from('shops').upsert(
          {
            shopee_shop_id: Number(shop_id),
            name: `Shop ${shop_id}`,
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expired_at: expiredAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shopee_shop_id' }
        );
      }
    } catch (dbErr) {
      // Log but don't fail the response — localStorage is the primary store
      console.error('Failed to persist shop to Supabase:', dbErr);
    }

    // Return tokens to frontend (will be stored in localStorage)
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
