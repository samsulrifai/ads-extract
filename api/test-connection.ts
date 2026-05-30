import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getShopToken, isTokenError } from './_lib/get-shop-token.js';
import { getShopInfo } from './_lib/get-shop-info.js';

/**
 * POST /api/test-connection
 * Test whether a shop's token is actually valid by calling Shopee API.
 * Uses getShopToken (auto-refreshes if expired) then calls get_shop_info.
 *
 * Body: { shop_id: number }
 * Returns: { success, shop_name?, token_status, needs_reauth? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
