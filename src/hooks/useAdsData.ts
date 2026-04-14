import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { loadTokens, refreshTokens, isTokenExpired } from '@/lib/shopee-client';
import type { AdsPerformance, KPIData, SyncResponse } from '@/types';

export interface SyncAdsRequest {
  shop_id: number;
  start_date: string;
  end_date: string;
  access_token: string;
}

export function useAdsData() {
  const [data, setData] = useState<AdsPerformance[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch ads data directly from Supabase Database (very fast, no Shopee API hit)
  const fetchAdsFromDb = useCallback(async (request: SyncAdsRequest) => {
    setLoadingDb(true);
    setError(null);
    try {
      const { data: records, error: dbError } = await supabase
        .from('ads_performance')
        .select('*')
        .eq('shop_id', request.shop_id)
        .gte('date', request.start_date)
        .lte('date', request.end_date)
        .order('date', { ascending: true });

      if (dbError) throw dbError;

      setData(records as AdsPerformance[]);
      return records;
    } catch (err: any) {
      setError(err.message || 'Failed to load ads from database');
      return [];
    } finally {
      setLoadingDb(false);
    }
  }, []);

  // Force sync from Shopee API, and refresh DB
  const performSync = useCallback(async (request: SyncAdsRequest): Promise<SyncResponse> => {
    setSyncing(true);
    setError(null);

    try {
      if (!request.access_token) {
        throw new Error('Not connected or missing access token.');
      }

      const response = await fetch('/api/sync-ads-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: request.access_token,
          shop_id: request.shop_id,
          start_date: request.start_date,
          end_date: request.end_date,
        }),
      });

      const resultData = await response.json();

      if (!response.ok || !resultData.success) {
        throw new Error(resultData.error || resultData.message || 'Sync failed');
      }

      // After successful sync, refresh database local view
      await fetchAdsFromDb(request);

      return {
        success: true,
        records_synced: resultData.records_synced || 0,
        records: resultData.records || [],
      };
    } catch (err: any) {
      const message = err.message || 'Sync failed';
      setError(message);
      return { success: false, records_synced: 0, error: message };
    } finally {
      setSyncing(false);
    }
  }, [fetchAdsFromDb]);

  const kpi: KPIData = useMemo(() => {
    const calculated = data.reduce(
      (acc, item) => {
        acc.totalImpressions += item.impressions;
        acc.totalClicks += item.clicks;
        acc.totalSpend += Number(item.spend);
        acc.totalOrders += item.orders;
        acc.totalGMV += Number(item.gmv);
        return acc;
      },
      { totalImpressions: 0, totalClicks: 0, totalSpend: 0, totalOrders: 0, totalGMV: 0, ctr: 0, roas: 0, cpc: 0 } as KPIData
    );

    calculated.ctr = calculated.totalImpressions > 0 ? (calculated.totalClicks / calculated.totalImpressions) * 100 : 0;
    calculated.roas = calculated.totalSpend > 0 ? calculated.totalGMV / calculated.totalSpend : 0;
    calculated.cpc = calculated.totalClicks > 0 ? calculated.totalSpend / calculated.totalClicks : 0;
    
    return calculated;
  }, [data]);

  // Aggregate data by date for charts
  const chartData = useMemo(() => {
    return data.reduce((acc, item) => {
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
  }, [data]);

  return { data, chartData, kpi, fetchAdsFromDb, performSync, loadingDb, syncing, error };
}
