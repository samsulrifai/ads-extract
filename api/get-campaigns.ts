import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/get-campaigns
 * Fetch campaign performance summary from Supabase ads_performance table.
 * Groups data by ads_type to show performance per campaign type.
 *
 * Body: { shop_id: number, start_date?: string, end_date?: string }
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
    const { shop_id, start_date, end_date } = req.body;

    if (!shop_id) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({ success: false, error: 'Missing shop_id' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: 'Missing Supabase credentials' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query ads_performance grouped by ads_type
    let query = supabase
      .from('ads_performance')
      .select('*')
      .eq('shop_id', Number(shop_id))
      .order('date', { ascending: false });

    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
    }

    const { data, error: dbError } = await query;

    if (dbError) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        campaigns: [],
        error: `Database error: ${dbError.message}`,
      });
    }

    if (!data || data.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        campaigns: [],
        total: 0,
      });
    }

    // Aggregate by ads_type
    const typeMap = new Map<string, {
      ads_type: string;
      impressions: number;
      clicks: number;
      spend: number;
      orders: number;
      gmv: number;
      days: number;
      latest_date: string;
      earliest_date: string;
    }>();

    for (const row of data) {
      const type = row.ads_type || 'unknown';
      const existing = typeMap.get(type) || {
        ads_type: type,
        impressions: 0,
        clicks: 0,
        spend: 0,
        orders: 0,
        gmv: 0,
        days: 0,
        latest_date: '',
        earliest_date: '',
      };

      existing.impressions += row.impressions || 0;
      existing.clicks += row.clicks || 0;
      existing.spend += Number(row.spend) || 0;
      existing.orders += row.orders || 0;
      existing.gmv += Number(row.gmv) || 0;
      existing.days += 1;

      if (!existing.latest_date || row.date > existing.latest_date) {
        existing.latest_date = row.date;
      }
      if (!existing.earliest_date || row.date < existing.earliest_date) {
        existing.earliest_date = row.date;
      }

      typeMap.set(type, existing);
    }

    // Build campaign list
    const campaigns = [...typeMap.values()].map((item) => {
      const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
      const roas = item.spend > 0 ? item.gmv / item.spend : 0;
      const avgDailySpend = item.days > 0 ? item.spend / item.days : 0;

      return {
        campaign_id: item.ads_type,
        campaign_name: formatCampaignName(item.ads_type),
        campaign_type: item.ads_type,
        status: 'ongoing',
        daily_budget: avgDailySpend,
        total_budget: item.spend,
        impressions: item.impressions,
        clicks: item.clicks,
        spend: item.spend,
        orders: item.orders,
        gmv: item.gmv,
        ctr,
        roas,
        days: item.days,
        latest_date: item.latest_date,
        earliest_date: item.earliest_date,
      };
    }).sort((a, b) => b.spend - a.spend);

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

function formatCampaignName(adsType: string): string {
  const nameMap: Record<string, string> = {
    search: 'Search Ads (Iklan Pencarian)',
    discovery: 'Discovery Ads (Iklan Produk Serupa)',
    video: 'Video Ads (Iklan Video)',
    cpc: 'CPC Ads',
    cpa: 'CPA Ads',
  };
  return nameMap[adsType] || `${adsType.charAt(0).toUpperCase()}${adsType.slice(1)} Ads`;
}
