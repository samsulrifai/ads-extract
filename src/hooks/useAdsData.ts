import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdsPerformance, KPIData } from '@/types';

export function useAdsData() {
  const [data, setData] = useState<AdsPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAdsData = useCallback(async (
    shopId: number,
    startDate: string,
    endDate: string,
    adsType?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('ads_performance')
        .select('*')
        .eq('shop_id', shopId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (adsType && adsType !== 'all') {
        query = query.eq('ads_type', adsType);
      }

      const { data: result, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setData(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ads data');
    } finally {
      setLoading(false);
    }
  }, []);

  const kpi: KPIData = data.reduce(
    (acc, item) => {
      acc.totalImpressions += item.impressions;
      acc.totalClicks += item.clicks;
      acc.totalSpend += Number(item.spend);
      acc.totalOrders += item.orders;
      acc.totalGMV += Number(item.gmv);
      return acc;
    },
    {
      totalImpressions: 0,
      totalClicks: 0,
      totalSpend: 0,
      totalOrders: 0,
      totalGMV: 0,
      ctr: 0,
      roas: 0,
      cpc: 0,
    } as KPIData
  );

  kpi.ctr = kpi.totalImpressions > 0 ? (kpi.totalClicks / kpi.totalImpressions) * 100 : 0;
  kpi.roas = kpi.totalSpend > 0 ? kpi.totalGMV / kpi.totalSpend : 0;
  kpi.cpc = kpi.totalClicks > 0 ? kpi.totalSpend / kpi.totalClicks : 0;

  // Aggregate data by date for charts
  const chartData = data.reduce((acc, item) => {
    const existing = acc.find((d) => d.date === item.date);
    if (existing) {
      existing.impressions += item.impressions;
      existing.clicks += item.clicks;
      existing.spend += Number(item.spend);
      existing.orders += item.orders;
      existing.gmv += Number(item.gmv);
    } else {
      acc.push({
        date: item.date,
        impressions: item.impressions,
        clicks: item.clicks,
        spend: Number(item.spend),
        orders: item.orders,
        gmv: Number(item.gmv),
      });
    }
    return acc;
  }, [] as Array<{ date: string; impressions: number; clicks: number; spend: number; orders: number; gmv: number }>);

  return { data, chartData, kpi, loading, error, fetchAdsData };
}
