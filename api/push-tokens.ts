import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/push-tokens
 * Push localStorage tokens to Supabase so other devices can use them.
 * Called automatically by the frontend when localStorage has tokens.
 * 
 * Body: { shop_id, access_token, refresh_token, expire_in }
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
    const { shop_id, access_token, refresh_token, expire_in } = req.body;

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
    const timestamp = Math.floor(Date.now() / 1000);
    const expiredAt = new Date((timestamp + (expire_in || 14400)) * 1000).toISOString();

    const { error: dbError } = await supabase.from('shops').upsert({
      shopee_shop_id: Number(shop_id),
      name: `Shop ${shop_id}`,
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
