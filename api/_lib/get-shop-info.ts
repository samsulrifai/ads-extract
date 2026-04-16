import { API_HOST, PARTNER_ID, generateSign } from './shopee.js';

/**
 * Get the real shop name from Shopee API.
 * Tries get_shop_info first, then get_profile as fallback.
 */
export async function getShopInfo(shopId: number, accessToken: string): Promise<string | null> {
  // Try v2/shop/get_shop_info
  try {
    const apiPath = '/api/v2/shop/get_shop_info';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      access_token: accessToken,
      shop_id: String(shopId),
      sign,
    });

    const response = await fetch(`${API_HOST}${apiPath}?${params.toString()}`);
    const data = await response.json();

    console.log('[getShopInfo] get_shop_info response:', JSON.stringify(data));

    if (!data.error && data.response) {
      // Try multiple possible field names
      const name = data.response.shop_name || data.response.name || data.response.shop_username;
      if (name) return name;
    }
  } catch (error) {
    console.error('[getShopInfo] get_shop_info failed:', error);
  }

  // Fallback: try v2/shop/get_profile
  try {
    const apiPath = '/api/v2/shop/get_profile';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp, accessToken, shopId);

    const params = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      access_token: accessToken,
      shop_id: String(shopId),
      sign,
    });

    const response = await fetch(`${API_HOST}${apiPath}?${params.toString()}`);
    const data = await response.json();

    console.log('[getShopInfo] get_profile response:', JSON.stringify(data));

    if (!data.error && data.response) {
      const name = data.response.shop_name || data.response.name || data.response.shop_username;
      if (name) return name;
    }
  } catch (error) {
    console.error('[getShopInfo] get_profile failed:', error);
  }

  return null;
}
