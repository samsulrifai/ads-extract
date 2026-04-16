import { API_HOST, PARTNER_ID, generateSign } from './shopee.js';

export async function getShopInfo(shopId: number, accessToken: string): Promise<string | null> {
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

    if (!data.error && data.response && data.response.shop_name) {
      return data.response.shop_name as string;
    }
    return null;
  } catch (error) {
    console.error('Failed to get shop info from Shopee:', error);
    return null;
  }
}
