import { useState, useCallback } from 'react';

import { supabase } from '@/lib/supabase';
import type { Order, SyncOrdersResponse } from '@/types';

export interface SyncOrdersRequest {
  shop_id: number;
  start_date: string;
  end_date: string;
  access_token?: string | null;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch orders directly from Supabase Database (very fast, no Shopee API hit)
  const fetchOrders = useCallback(async (request: SyncOrdersRequest) => {
    setLoadingDb(true);
    setError(null);
    try {
      // Shopee times are end of day vs start of day, but we can do a simple range
      // create_time is timestamp. To ensure we get the full range, append times:
      const startDateTime = `${request.start_date}T00:00:00Z`;
      const endDateTime = `${request.end_date}T23:59:59Z`;

      const { data, error: dbError } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', request.shop_id)
        .gte('create_time', startDateTime)
        .lte('create_time', endDateTime)
        .order('create_time', { ascending: false });

      if (dbError) throw dbError;

      setOrders(data as Order[]);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to load from database');
      return [];
    } finally {
      setLoadingDb(false);
    }
  }, []);

  // Force sync from Shopee API, and refresh DB
  const performSync = useCallback(async (request: SyncOrdersRequest): Promise<SyncOrdersResponse> => {
    setSyncing(true);
    setError(null);

    try {
      if (!request.access_token) {
        throw new Error('Not connected or missing access token.');
      }

      // We could ideally check expiration here, but refresh logic might require the refresh_token too.
      // For now, let's keep it simple and assume the backend or a separate process refreshes it, 
      // or we pass the token directly to the backend.
      const response = await fetch('/api/sync-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: request.access_token,
          shop_id: request.shop_id,
          start_date: request.start_date,
          end_date: request.end_date,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to sync orders');
      }

      // After a successful sync API call, re-fetch from database to get fresh records
      await fetchOrders(request);

      return {
        success: true,
        records_synced: data.records_synced || 0,
        records: data.records || [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      return { success: false, records_synced: 0, error: message };
    } finally {
      setSyncing(false);
    }
  }, [fetchOrders]);

  return { orders, setOrders, fetchOrders, performSync, syncing, loadingDb, error };
}
