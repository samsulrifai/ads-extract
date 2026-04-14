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
    const startTime = Math.floor(new Date(start_date).getTime() / 1000);
    const endTime = Math.floor(new Date(end_date + 'T23:59:59').getTime() / 1000);

    // Call Shopee Ads API — get daily performance
    const apiPath = '/api/v2/ads/get_shop_daily_performance';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp, access_token, Number(shop_id));

    const queryParams = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      sign,
      access_token,
      shop_id: String(shop_id),
    });

    const response = await fetch(`${API_HOST}${apiPath}?${queryParams.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: startTime,
        end_time: endTime,
      }),
    });

    const data = await response.json();

    if (data.error || data.error !== undefined && data.error !== '') {
      res.setHeader('Access-Control-Allow-Origin', '*');

      // If the daily performance endpoint doesn't exist, try total performance
      if (data.error === 'error_not_found' || data.error === 'error_param') {
        return await fetchTotalPerformance(req, res, {
          access_token,
          shop_id,
          startTime,
          endTime,
        });
      }

      return res.status(400).json({
        success: false,
        error: data.error,
        message: data.message || data.msg || '',
      });
    }

    // Transform Shopee response into records
    const records = transformShopeeResponse(data, Number(shop_id), start_date, end_date);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      records,
      records_synced: records.length,
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/** Fallback: fetch total shop performance */
async function fetchTotalPerformance(
  req: VercelRequest,
  res: VercelResponse,
  opts: { access_token: string; shop_id: number; startTime: number; endTime: number }
) {
  const apiPath = '/api/v2/ads/get_shop_total_performance';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(apiPath, timestamp, opts.access_token, Number(opts.shop_id));

  const queryParams = new URLSearchParams({
    partner_id: String(PARTNER_ID),
    timestamp: String(timestamp),
    sign,
    access_token: opts.access_token,
    shop_id: String(opts.shop_id),
  });

  const response = await fetch(`${API_HOST}${apiPath}?${queryParams.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_time: opts.startTime,
      end_time: opts.endTime,
    }),
  });

  const data = await response.json();

  if (data.error) {
    return res.status(400).json({
      success: false,
      error: data.error,
      message: data.message || data.msg || '',
    });
  }

  // Create a single record from total performance
  const record = {
    shop_id: opts.shop_id,
    date: new Date(opts.startTime * 1000).toISOString().split('T')[0],
    ads_type: 'all',
    impressions: data.response?.impression || 0,
    clicks: data.response?.clicks || 0,
    spend: (data.response?.expense || 0) / 100000, // Shopee returns in microcurrency
    orders: data.response?.direct_order || 0,
    gmv: (data.response?.direct_gmv || 0) / 100000,
  };

  return res.status(200).json({
    success: true,
    records: [record],
    records_synced: 1,
  });
}

/** Transform Shopee daily performance response into flat records */
function transformShopeeResponse(data: any, shopId: number, startDate: string, endDate: string) {
  const records: any[] = [];

  // Shopee may return data in response.daily or response array
  const dailyData = data.response?.daily || data.response || [];

  if (Array.isArray(dailyData)) {
    for (const day of dailyData) {
      const date = day.date || new Date((day.timestamp || 0) * 1000).toISOString().split('T')[0];
      records.push({
        shop_id: shopId,
        date,
        ads_type: day.campaign_type || 'all',
        impressions: day.impression || 0,
        clicks: day.clicks || day.click || 0,
        spend: (day.expense || day.cost || 0) / 100000,
        orders: day.direct_order || day.order || 0,
        gmv: (day.direct_gmv || day.gmv || 0) / 100000,
      });
    }
  }

  return records;
}
