import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';

/**
 * POST /api/sync-ads-data
 * Fetch ads daily performance from Shopee using get_all_cpc_ads_daily_performance.
 *
 * Body: {
 *   access_token: string,
 *   shop_id: number,
 *   start_date: string,  // YYYY-MM-DD
 *   end_date: string,    // YYYY-MM-DD
 * }
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
    const { access_token, shop_id, start_date, end_date } = req.body;

    if (!access_token || !shop_id || !start_date || !end_date) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({
        success: false,
        error: 'Missing access_token, shop_id, start_date, or end_date',
      });
    }

    const startTime = Math.floor(new Date(start_date + 'T00:00:00').getTime() / 1000);
    const endTime = Math.floor(new Date(end_date + 'T23:59:59').getTime() / 1000);
    const shopIdNum = Number(shop_id);

    // Call the correct endpoint with retry for rate limits
    const result = await callWithRetry(
      '/api/v2/ads/get_all_cpc_ads_daily_performance',
      access_token,
      shopIdNum,
      { start_time: startTime, end_time: endTime }
    );

    if (!result.success) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        records_synced: 0,
        error: result.error,
      });
    }

    const records = transformResponse(result.data?.response, shopIdNum, start_date);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      records,
      records_synced: records.length,
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ success: false, error: error.message });
  }
}

/** Call Shopee API with automatic retry on rate limit (max 3 attempts) */
async function callWithRetry(
  apiPath: string,
  accessToken: string,
  shopId: number,
  body: Record<string, any>,
  maxRetries = 3
): Promise<{ success: boolean; data?: any; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp, accessToken, shopId);

    const queryParams = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      sign,
      access_token: accessToken,
      shop_id: String(shopId),
    });

    const url = `${API_HOST}${apiPath}?${queryParams.toString()}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      // No error or empty error = success
      if (!data.error || data.error === '') {
        return { success: true, data };
      }

      // Rate limited — wait and retry
      if (data.error.includes('rate_limit')) {
        const waitMs = (attempt + 1) * 2000; // 2s, 4s, 6s
        await sleep(waitMs);
        continue;
      }

      // Other error — don't retry
      return { success: false, error: `${data.error}: ${data.message || data.msg || ''}` };
    } catch (err: any) {
      if (attempt === maxRetries - 1) {
        return { success: false, error: err.message };
      }
      await sleep(1000);
    }
  }

  return { success: false, error: 'Max retries exceeded due to rate limiting. Please try again in a minute.' };
}

/** Transform Shopee daily performance response into flat records */
function transformResponse(response: any, shopId: number, fallbackDate: string): any[] {
  if (!response) return [];

  const records: any[] = [];

  // Response can be an array or an object with nested data
  const dailyData = Array.isArray(response)
    ? response
    : response.daily || response.data || response.entry_list || [response];

  if (Array.isArray(dailyData)) {
    for (const day of dailyData) {
      // Skip if it looks like an empty aggregate object
      if (!day || typeof day !== 'object') continue;

      records.push({
        shop_id: shopId,
        date: day.date || timestampToDate(day.timestamp || day.start_time) || fallbackDate,
        ads_type: day.campaign_type || day.type || 'cpc',
        impressions: day.impression || day.impressions || 0,
        clicks: day.clicks || day.click || 0,
        spend: normalizeAmount(day.expense || day.cost || day.spend || 0),
        orders: day.direct_order || day.orders || day.order || day.broad_order || 0,
        gmv: normalizeAmount(day.direct_gmv || day.gmv || day.broad_gmv || 0),
      });
    }
  }

  return records;
}

function timestampToDate(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts * 1000).toISOString().split('T')[0];
}

function normalizeAmount(value: number): number {
  if (value > 1_000_000) return value / 100000;
  if (value > 10_000) return value / 100;
  return value;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
