import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getShopInfo } from './_lib/get-shop-info.js';
import { getShopToken } from './_lib/get-shop-token.js';

/**
 * POST /api/update-shop-name
 * Fetches the real shop name from Shopee API and updates it in Supabase.
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

    // Update in Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { error: dbError } = await supabase
      .from('shops')
      .update({ name: shopName })
      .eq('shopee_shop_id', shopIdNum);

    if (dbError) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ success: false, error: dbError.message, step: 'supabase_update' });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, shop_name: shopName });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ success: false, error: error.message });
  }
}
