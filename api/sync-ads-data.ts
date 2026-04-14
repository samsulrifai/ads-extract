import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';

/**
 * POST /api/sync-ads-data
 * Fetch ads daily performance from Shopee.
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

    const apiPath = '/api/v2/ads/get_all_cpc_ads_daily_performance';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp, access_token, shopIdNum);

    const queryParams = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      sign,
      access_token,
      shop_id: String(shopIdNum),
    });

    const url = `${API_HOST}${apiPath}?${queryParams.toString()}`;
    const requestBody = { start_time: startTime, end_time: endTime };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    // Return full debug info so we can diagnose issues
    const debug = {
      partner_id: PARTNER_ID,
      api_host: API_HOST,
      api_path: apiPath,
      shop_id: shopIdNum,
      start_time: startTime,
      end_time: endTime,
      start_date,
      end_date,
      http_status: response.status,
      shopee_error: data.error || null,
      shopee_message: data.message || data.msg || null,
      shopee_request_id: data.request_id || null,
      has_response: !!data.response,
      response_keys: data.response ? Object.keys(data.response) : [],
    };

    // Check for error
    if (data.error && data.error !== '') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        records_synced: 0,
        error: `${data.error}${data.message ? ': ' + data.message : ''}`,
        debug,
        raw_response: data,
      });
    }

    // Transform response
    const records = transformResponse(data.response, shopIdNum, start_date);

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: records.length > 0,
      records,
      records_synced: records.length,
      debug,
      ...(records.length === 0 ? {
        error: 'No performance data found for the selected period.',
        raw_response: data,
      } : {}),
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
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
