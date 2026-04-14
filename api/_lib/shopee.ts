import crypto from 'crypto';

const PARTNER_ID = Number(process.env.SHOPEE_PARTNER_ID);
const PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || '';
const API_HOST = process.env.SHOPEE_API_HOST || 'https://partner.shopeemobile.com';
const REDIRECT_URL = process.env.SHOPEE_REDIRECT_URL || 'https://ads-extract.vercel.app/callback';

export { PARTNER_ID, PARTNER_KEY, API_HOST, REDIRECT_URL };

/**
 * Generate HMAC-SHA256 signature for Shopee API.
 *
 * Public API (auth): base = partner_id + api_path + timestamp
 * Shop API (ads):    base = partner_id + api_path + timestamp + access_token + shop_id
 */
export function generateSign(
  apiPath: string,
  timestamp: number,
  accessToken?: string,
  shopId?: number
): string {
  let baseString = `${PARTNER_ID}${apiPath}${timestamp}`;
  if (accessToken) baseString += accessToken;
  if (shopId) baseString += String(shopId);

  return crypto
    .createHmac('sha256', PARTNER_KEY)
    .update(baseString)
    .digest('hex');
}

/** CORS headers for all API responses */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
