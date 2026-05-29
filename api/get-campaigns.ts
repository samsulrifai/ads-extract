import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';
import { getShopToken } from './_lib/get-shop-token.js';

/**
 * POST /api/get-campaigns
 * Fetch all ads/campaigns from Shopee Ads API.
 * Token is fetched server-side from Supabase.
 *
 * Body: { shop_id: number }
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
    const { shop_id } = req.body;

    if (!shop_id) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ success: false, error: 'Missing shop_id' });
    }

    const shopIdNum = Number(shop_id);

    // Get valid token from Supabase (auto-refreshes if expired)
    const { access_token, error: tokenError } = await getShopToken(shopIdNum);
    if (tokenError || !access_token) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        campaigns: [],
        error: tokenError || 'No valid token found for this shop.',
      });
    }

    // Fetch all campaigns (paginated)
    const allCampaigns: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const apiPath = '/api/v2/ads/get_all_ads';
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateSign(apiPath, timestamp, access_token, shopIdNum);

      const queryParams = new URLSearchParams({
        partner_id: String(PARTNER_ID),
        timestamp: String(timestamp),
        sign,
        access_token,
        shop_id: String(shopIdNum),
        page: String(page),
        page_size: '50',
      });

      const url = `${API_HOST}${apiPath}?${queryParams.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error && data.error !== '') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({
          success: false,
          campaigns: [],
          error: `Shopee API: ${data.error}${data.message ? ' - ' + data.message : ''}`,
        });
      }

      const rawList = data.response?.ads_list || data.response?.entry_list || [];
      allCampaigns.push(...rawList);

      hasMore = rawList.length >= 50;
      page++;

      // Safety limit
      if (page > 10) break;
    }

    // Transform campaigns
    const campaigns = allCampaigns.map((item: any) => {
      const impressions = item.impression || item.impressions || 0;
      const clicks = item.click || item.clicks || 0;
      const spend = item.expense || item.cost || item.spend || 0;
      const gmv = item.direct_gmv || item.gmv || item.broad_gmv || 0;

      return {
        campaign_id: item.campaign_id || item.campaignid || item.id || 0,
        campaign_name: item.campaign_name || item.title || `Campaign ${item.campaign_id || 'Unknown'}`,
        campaign_type: item.campaign_type ?? item.type ?? 0,
        status: item.state || item.status || 'unknown',
        daily_budget: item.daily_budget || 0,
        total_budget: item.total_budget || 0,
        start_time: item.start_time || 0,
        end_time: item.end_time || 0,
        impressions,
        clicks,
        spend,
        orders: item.direct_order || item.orders || item.broad_order || 0,
        gmv,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        roas: spend > 0 ? gmv / spend : 0,
      };
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      campaigns,
      total: campaigns.length,
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
