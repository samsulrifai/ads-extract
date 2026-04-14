import { useState, useCallback } from 'react';
import type { AdsPerformance, KPIData } from '@/types';

export function useAdsData() {
  const [data, setData] = useState<AdsPerformance[]>([]);
  const [loading] = useState(false);

  /**
   * Set ads data directly from sync result (no Supabase query needed).
   */
  const setAdsData = useCallback((records: AdsPerformance[]) => {
    setData(records);
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

  return { data, chartData, kpi, loading, setAdsData };
}
