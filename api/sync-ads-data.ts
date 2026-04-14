import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';

/**
 * POST /api/sync-ads-data
 * Fetch ads performance data from Shopee API for a date range.
 * Uses the access_token + shop_id from the request body (sent from localStorage on client).
 *
 * Body: {
 *   access_token: string,
 *   shop_id: number,
 *   start_date: string,  // YYYY-MM-DD
 *   end_date: string,    // YYYY-MM-DD
 * }
 * Returns: { success: true, records: [...], records_synced: number }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
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

    // Convert dates to Unix timestamps
    const startTime = Math.floor(new Date(start_date + 'T00:00:00').getTime() / 1000);
    const endTime = Math.floor(new Date(end_date + 'T23:59:59').getTime() / 1000);

    const allRecords: any[] = [];
    const errors: string[] = [];

    // Try multiple endpoints — Shopee has different APIs for different ad types
    const endpoints = [
      '/api/v2/ads/get_all_cpc_ads_daily_performance',
      '/api/v2/ads/get_all_cpc_ads_hourly_performance',
    ];

    // 1. Try daily performance first
    const dailyResult = await callShopeeApi(
      endpoints[0],
      access_token,
      Number(shop_id),
      { start_time: startTime, end_time: endTime }
    );

    if (dailyResult.success && dailyResult.data?.response) {
      const records = transformDailyPerformance(dailyResult.data.response, Number(shop_id));
      allRecords.push(...records);
    } else if (dailyResult.error) {
      errors.push(`daily: ${dailyResult.error}`);
    }

    // 2. If daily didn't work, try getting campaign list + individual performance
    if (allRecords.length === 0) {
      const campaignResult = await fetchViaCampaigns(
        access_token,
        Number(shop_id),
        startTime,
        endTime
      );
      if (campaignResult.records.length > 0) {
        allRecords.push(...campaignResult.records);
      } else if (campaignResult.error) {
        errors.push(`campaigns: ${campaignResult.error}`);
      }
    }

    // 3. Last resort: try get_shop_total_performance for aggregated data
    if (allRecords.length === 0) {
      const totalResult = await callShopeeApi(
        '/api/v2/ads/get_shop_total_performance',
        access_token,
        Number(shop_id),
        { start_time: startTime, end_time: endTime }
      );

      if (totalResult.success && totalResult.data?.response) {
        const r = totalResult.data.response;
        allRecords.push({
          shop_id: Number(shop_id),
          date: start_date,
          ads_type: 'all',
          impressions: r.impression || r.impressions || 0,
          clicks: r.clicks || r.click || 0,
          spend: normalizeAmount(r.expense || r.cost || r.spend || 0),
          orders: r.direct_order || r.orders || r.order || 0,
          gmv: normalizeAmount(r.direct_gmv || r.gmv || r.broad_gmv || 0),
        });
      } else if (totalResult.error) {
        errors.push(`total: ${totalResult.error}`);
      }
    }

    // If we still have no data, return a descriptive error
    if (allRecords.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        records_synced: 0,
        error: errors.length > 0
          ? `Shopee API errors: ${errors.join('; ')}`
          : 'No performance data found for the selected period.',
        debug: { endpoints_tried: errors },
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      records: allRecords,
      records_synced: allRecords.length,
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Generic helper to call any Shopee API endpoint.
 */
async function callShopeeApi(
  apiPath: string,
  accessToken: string,
  shopId: number,
  body?: Record<string, any>,
  method: 'GET' | 'POST' = 'POST'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
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

    let response: Response;
    if (method === 'GET') {
      response = await fetch(url);
    } else {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
    }

    const data = await response.json();

    // Shopee returns error as a string field; empty string = no error
    if (data.error && data.error !== '') {
      return { success: false, error: `${data.error}: ${data.message || data.msg || ''}` };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Try to get performance via campaign list → campaign daily performance
 */
async function fetchViaCampaigns(
  accessToken: string,
  shopId: number,
  startTime: number,
  endTime: number
): Promise<{ records: any[]; error?: string }> {
  // Get list of all ads/campaigns
  const listResult = await callShopeeApi(
    '/api/v2/ads/get_all_ads',
    accessToken,
    shopId,
    undefined,
    'GET'
  );

  if (!listResult.success || !listResult.data?.response) {
    return { records: [], error: listResult.error };
  }

  const campaigns = listResult.data.response?.ads_list || listResult.data.response || [];
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return { records: [], error: 'No campaigns found' };
  }

  const records: any[] = [];

  // Get performance for each campaign (limit to first 10 to avoid rate limits)
  for (const campaign of campaigns.slice(0, 10)) {
    const campaignId = campaign.campaign_id || campaign.ads_id;
    if (!campaignId) continue;

    const perfResult = await callShopeeApi(
      '/api/v2/ads/get_product_campaign_daily_performance',
      accessToken,
      shopId,
      {
        campaign_id: campaignId,
        start_time: startTime,
        end_time: endTime,
      }
    );

    if (perfResult.success && perfResult.data?.response) {
      const daily = perfResult.data.response?.daily || perfResult.data.response || [];
      if (Array.isArray(daily)) {
        for (const day of daily) {
          records.push({
            shop_id: shopId,
            date: day.date || timestampToDate(day.timestamp),
            ads_type: campaign.campaign_type || campaign.ads_type || 'search',
            impressions: day.impression || day.impressions || 0,
            clicks: day.clicks || day.click || 0,
            spend: normalizeAmount(day.expense || day.cost || day.spend || 0),
            orders: day.direct_order || day.orders || day.order || 0,
            gmv: normalizeAmount(day.direct_gmv || day.gmv || 0),
          });
        }
      }
    }
  }

  return { records };
}

/**
 * Transform the daily performance API response into flat records.
 */
function transformDailyPerformance(response: any, shopId: number): any[] {
  const records: any[] = [];

  // Response could be an array or have a nested structure
  const dailyData = Array.isArray(response)
    ? response
    : response.daily || response.data || [];

  if (Array.isArray(dailyData)) {
    for (const day of dailyData) {
      records.push({
        shop_id: shopId,
        date: day.date || timestampToDate(day.timestamp),
        ads_type: day.campaign_type || day.ads_type || 'all',
        impressions: day.impression || day.impressions || 0,
        clicks: day.clicks || day.click || 0,
        spend: normalizeAmount(day.expense || day.cost || day.spend || 0),
        orders: day.direct_order || day.orders || day.order || 0,
        gmv: normalizeAmount(day.direct_gmv || day.gmv || day.broad_gmv || 0),
      });
    }
  }

  return records;
}

/** Convert Unix timestamp to YYYY-MM-DD */
function timestampToDate(ts: number | undefined): string {
  if (!ts) return new Date().toISOString().split('T')[0];
  return new Date(ts * 1000).toISOString().split('T')[0];
}

/** Normalize Shopee micro-currency amounts (they often return in cents or micro-units) */
function normalizeAmount(value: number): number {
  // Shopee sometimes returns amounts in micro-currency (÷100000) or cents (÷100)
  // If the value seems too large, normalize it
  if (value > 1_000_000) return value / 100000;
  if (value > 10_000) return value / 100;
  return value;
}
