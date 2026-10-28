import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSql } from './_lib/db.js';
import { getShopInfo } from './_lib/get-shop-info.js';
import { getShopToken } from './_lib/get-shop-token.js';

/**
 * POST /api/update-shop-name
 * Fetches the real shop name from Shopee API and updates it in the database.
 * 
 * Body: { shop_id: number }
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

    // Get a valid access token
    const { access_token, error: tokenError } = await getShopToken(shopIdNum);
    if (tokenError || !access_token) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        error: tokenError || 'No valid token',
        step: 'getShopToken',
      });
    }

    // Fetch real shop name from Shopee
    const shopName = await getShopInfo(shopIdNum, access_token);
    if (!shopName) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        error: 'Could not fetch shop name from Shopee API. Check Vercel logs for details.',
        step: 'getShopInfo',
        shop_id: shopIdNum,
      });
    }

    // Update in database
    if (!process.env.DATABASE_URL) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: 'Missing DATABASE_URL' });
    }

    try {
      await getSql()`UPDATE shops SET name = ${shopName} WHERE shopee_shop_id = ${shopIdNum}`;
    } catch (dbError: any) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ success: false, error: dbError.message, step: 'db_update' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, shop_name: shopName });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ success: false, error: error.message });
  }
}
