import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/push-tokens
 * Push localStorage tokens to Supabase so other devices can use them.
 * Only updates if the local token is newer than what's already in the database.
 * 
 * Body: { shop_id, access_token, refresh_token, expire_in, saved_at? }
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
    const { shop_id, access_token, refresh_token, expire_in, saved_at } = req.body;

    if (!shop_id || !access_token || !refresh_token) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ success: false, error: 'Missing shop_id, access_token, or refresh_token' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the server already has a newer token
    const { data: existingShop } = await supabase
      .from('shops')
      .select('updated_at')
      .eq('shopee_shop_id', Number(shop_id))
      .single();

    if (existingShop && saved_at) {
      const localSavedAt = new Date(saved_at * 1000);
      const serverUpdatedAt = new Date(existingShop.updated_at);

      if (serverUpdatedAt > localSavedAt) {
        console.log(
          `[push-tokens] Skipping push for shop ${shop_id}: ` +
          `server token (${serverUpdatedAt.toISOString()}) is newer than local (${localSavedAt.toISOString()})`
        );
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({
          success: true,
          skipped: true,
          reason: 'Server token is newer than local token',
        });
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const expiredAt = new Date((timestamp + (expire_in || 14400)) * 1000).toISOString();

    let shopName = `Shop ${shop_id}`;
    
    // Attempt to get the actual shop_name from Shopee if the token is valid
    try {
      const { getShopInfo } = await import('./_lib/get-shop-info.js');
      const actualName = await getShopInfo(Number(shop_id), access_token);
      if (actualName) {
        shopName = actualName;
      }
    } catch (err) {
      console.warn('Could not fetch actual shop name:', err);
    }

    const { error: dbError } = await supabase.from('shops').upsert({
      shopee_shop_id: Number(shop_id),
      name: shopName,
      access_token,
      refresh_token,
      expired_at: expiredAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'shopee_shop_id' });

    if (dbError) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: dbError.message });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ success: true, message: 'Tokens synced to database' });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ success: false, error: error.message });
  }
}
