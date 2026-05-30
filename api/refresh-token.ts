import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';
import { getShopToken } from './_lib/get-shop-token.js';
import { getShopInfo } from './_lib/get-shop-info.js';

/**
 * POST /api/refresh-token
 * Multi-purpose token management endpoint.
 *
 * Actions (via body.action):
 * - "refresh" (default): Refresh an expired access_token using a refresh_token.
 *   Body: { shop_id, refresh_token }
 *
 * - "test": Test if a shop's token is valid by calling Shopee API.
 *   Body: { shop_id, action: "test" }
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

  const action = req.body?.action || 'refresh';

  if (action === 'test') {
    return handleTestConnection(req, res);
  }

  return handleRefreshToken(req, res);
}

/**
 * Test whether a shop's token is actually valid by calling Shopee API.
 */
async function handleTestConnection(req: VercelRequest, res: VercelResponse) {
  try {
    const { shop_id } = req.body;

    if (!shop_id) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ success: false, error: 'Missing shop_id' });
    }

    const shopIdNum = Number(shop_id);

    // Step 1: Get a valid token (auto-refreshes if expired)
    const { access_token, error: tokenError } = await getShopToken(shopIdNum);
    if (tokenError || !access_token) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        token_status: 'invalid',
        error: tokenError || 'No valid token found.',
        needs_reauth: true,
      });
    }

    // Step 2: Call Shopee API to verify the token actually works
    const shopName = await getShopInfo(shopIdNum, access_token);

    if (shopName) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        token_status: 'valid',
        shop_name: shopName,
      });
    }

    // getShopInfo returned null — token might be invalid at Shopee side
    // Try force refresh and test again
    console.log(`[test-connection] First attempt failed for shop ${shopIdNum}, trying force refresh...`);
    const { access_token: freshToken, error: refreshError } = await getShopToken(shopIdNum, { forceRefresh: true });

    if (refreshError || !freshToken) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        token_status: 'invalid',
        error: refreshError || 'Token refresh failed.',
        needs_reauth: true,
      });
    }

    const retryName = await getShopInfo(shopIdNum, freshToken);

    if (retryName) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        token_status: 'valid',
        shop_name: retryName,
        refreshed: true,
      });
    }

    // Even after refresh, API call failed
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: false,
      token_status: 'invalid',
      error: 'Token appears valid but Shopee API returned no data. The shop may need re-authorization.',
      needs_reauth: true,
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Refresh an expired access_token using a refresh_token.
 */
async function handleRefreshToken(req: VercelRequest, res: VercelResponse) {
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
