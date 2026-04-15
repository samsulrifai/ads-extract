import { createClient } from '@supabase/supabase-js';
import { PARTNER_ID, API_HOST, generateSign } from './shopee.js';

/**
 * Get a valid access_token for a shop from Supabase.
 * Auto-refreshes if the token is expired.
 */
export async function getShopToken(shopId: number): Promise<{ access_token: string; error?: string }> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { access_token: '', error: 'Missing Supabase credentials in environment' };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get shop from database
  const { data: shop, error: dbError } = await supabase
    .from('shops')
    .select('access_token, refresh_token, expired_at')
    .eq('shopee_shop_id', shopId)
    .single();

  if (dbError || !shop) {
    return { access_token: '', error: `Shop ${shopId} not found in database. Please authorize first.` };
  }

  if (!shop.refresh_token) {
    return { access_token: '', error: 'No refresh token found. Please re-authorize the shop.' };
  }

  // Check if token is still valid (with 5 min buffer)
  const now = new Date();
  const expiry = shop.expired_at ? new Date(shop.expired_at) : new Date(0);
  const isExpired = now.getTime() > expiry.getTime() - 5 * 60 * 1000;

  if (shop.access_token && !isExpired) {
    return { access_token: shop.access_token };
  }

  // Token expired — refresh it
  console.log(`[getShopToken] Token expired for shop ${shopId}, refreshing...`);

  try {
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
        refresh_token: shop.refresh_token,
        partner_id: PARTNER_ID,
        shop_id: shopId,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { access_token: '', error: `Token refresh failed: ${data.error}. Please re-authorize the shop.` };
    }

    // Save new tokens to Supabase
    const newExpiredAt = new Date((timestamp + data.expire_in) * 1000).toISOString();
    await supabase.from('shops').update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expired_at: newExpiredAt,
      updated_at: new Date().toISOString(),
    }).eq('shopee_shop_id', shopId);

    console.log(`[getShopToken] Token refreshed successfully for shop ${shopId}`);
    return { access_token: data.access_token };
  } catch (err: any) {
    return { access_token: '', error: `Token refresh error: ${err.message}` };
  }
}
