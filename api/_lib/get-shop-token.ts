import { createClient } from '@supabase/supabase-js';
import { PARTNER_ID, API_HOST, generateSign } from './shopee.js';

interface GetShopTokenOptions {
  /** Force refresh even if the token hasn't expired according to DB */
  forceRefresh?: boolean;
}

/**
 * Get a valid access_token for a shop from Supabase.
 * Auto-refreshes if the token is expired.
 *
 * Handles race conditions: if two requests try to refresh simultaneously,
 * the second one will re-read from DB after a failed refresh attempt
 * (since the first request may have already saved a new token).
 *
 * @param forceRefresh - Force refresh even if token looks valid in DB.
 *   Use this when Shopee API rejects a token that hasn't expired yet.
 */
export async function getShopToken(
  shopId: number,
  options: GetShopTokenOptions = {}
): Promise<{ access_token: string; error?: string }> {
  const { forceRefresh = false } = options;

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

  if (shop.access_token && !isExpired && !forceRefresh) {
    return { access_token: shop.access_token };
  }

  // Token expired or force refresh requested
  const reason = forceRefresh ? 'force refresh (token rejected by Shopee)' : 'token expired';
  console.log(`[getShopToken] Refreshing token for shop ${shopId}: ${reason}`);

  const refreshResult = await refreshAccessToken(shopId, shop.refresh_token, supabase);

  if (refreshResult.access_token) {
    return { access_token: refreshResult.access_token };
  }

  // Refresh failed — this might be a race condition.
  // Another request may have already refreshed the token, invalidating
  // the old refresh_token we just tried. Re-read from DB and check.
  console.log(
    `[getShopToken] Refresh failed for shop ${shopId}: ${refreshResult.error}. ` +
    `Retrying by re-reading from DB (possible race condition)...`
  );

  // Small delay to let the other request finish writing
  await sleep(500);

  const { data: freshShop, error: freshDbError } = await supabase
    .from('shops')
    .select('access_token, refresh_token, expired_at')
    .eq('shopee_shop_id', shopId)
    .single();

  if (freshDbError || !freshShop) {
    return { access_token: '', error: refreshResult.error };
  }

  // Check if someone else already refreshed — the token in DB should be different now
  const freshExpiry = freshShop.expired_at ? new Date(freshShop.expired_at) : new Date(0);
  const freshIsExpired = new Date().getTime() > freshExpiry.getTime() - 5 * 60 * 1000;

  if (freshShop.access_token && !freshIsExpired && freshShop.access_token !== shop.access_token) {
    console.log(`[getShopToken] Found a valid token from DB (refreshed by another request) for shop ${shopId}`);
    return { access_token: freshShop.access_token };
  }

  // DB token is also expired, and it's a different refresh_token — try once more
  if (freshShop.refresh_token && freshShop.refresh_token !== shop.refresh_token) {
    console.log(`[getShopToken] Found a new refresh_token in DB for shop ${shopId}, retrying refresh...`);
    const retryResult = await refreshAccessToken(shopId, freshShop.refresh_token, supabase);
    if (retryResult.access_token) {
      return { access_token: retryResult.access_token };
    }
    return { access_token: '', error: `Token refresh failed after retry: ${retryResult.error}. Please re-authorize the shop.` };
  }

  // All attempts failed
  return {
    access_token: '',
    error: `Token refresh failed for shop ${shopId}: ${refreshResult.error}. Please re-authorize the shop.`,
  };
}

/**
 * Check if a Shopee API error indicates an invalid/expired token.
 * Use this to decide whether to force-refresh and retry.
 */
export function isTokenError(shopeeError: string | undefined | null): boolean {
  if (!shopeeError) return false;
  const lower = shopeeError.toLowerCase();
  return (
    lower.includes('invalid_access_token') ||
    lower.includes('invalid_acceess_token') || // Shopee typo in their API
    lower.includes('access_token_expired') ||
    lower.includes('token') && lower.includes('invalid')
  );
}

/**
 * Call Shopee API to refresh the access token and save the new tokens to DB.
 */
async function refreshAccessToken(
  shopId: number,
  refreshToken: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ access_token: string; error?: string }> {
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
        refresh_token: refreshToken,
        partner_id: PARTNER_ID,
        shop_id: shopId,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(
        `[refreshAccessToken] Shopee API error for shop ${shopId}: ` +
        `error=${data.error}, message=${data.message || 'N/A'}`
      );
      return { access_token: '', error: `${data.error}: ${data.message || 'Token refresh rejected by Shopee'}` };
    }

    if (!data.access_token || !data.refresh_token) {
      console.error(`[refreshAccessToken] Missing tokens in response for shop ${shopId}:`, data);
      return { access_token: '', error: 'Shopee returned empty tokens' };
    }

    // Save new tokens to Supabase
    const newExpiredAt = new Date((timestamp + data.expire_in) * 1000).toISOString();
    const { error: updateError } = await supabase.from('shops').update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expired_at: newExpiredAt,
      updated_at: new Date().toISOString(),
    }).eq('shopee_shop_id', shopId);

    if (updateError) {
      console.error(`[refreshAccessToken] Failed to save new tokens to DB for shop ${shopId}:`, updateError);
      // Still return the token — it's valid even if DB save failed
    }

    console.log(`[refreshAccessToken] Token refreshed successfully for shop ${shopId}`);
    return { access_token: data.access_token };
  } catch (err: any) {
    console.error(`[refreshAccessToken] Exception for shop ${shopId}:`, err);
    return { access_token: '', error: `Token refresh error: ${err.message}` };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
