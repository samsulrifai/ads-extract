import { useState, useCallback } from 'react';
import { loadTokens, refreshTokens, isTokenExpired } from '@/lib/shopee-client';
import type { Order, SyncOrdersResponse } from '@/types';

export interface SyncOrdersRequest {
  shop_id: number;
  start_date: string;
  end_date: string;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async (request: SyncOrdersRequest): Promise<SyncOrdersResponse> => {
    setSyncing(true);
    setError(null);

    try {
      let tokens = loadTokens();
      if (!tokens) {
        throw new Error('Not connected. Please authorize your shop first.');
      }

      if (isTokenExpired(tokens)) {
        tokens = await refreshTokens();
      }

      const response = await fetch('/api/sync-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: tokens.access_token,
          shop_id: request.shop_id,
          start_date: request.start_date,
          end_date: request.end_date,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to sync orders');
      }

      const syncResult: SyncOrdersResponse = {
        success: true,
        records_synced: data.records_synced || 0,
        records: data.records || [],
      };

      setOrders(syncResult.records || []);
      return syncResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      return { success: false, records_synced: 0, error: message };
    } finally {
      setSyncing(false);
    }
  }, []);

  return { orders, setOrders, fetchOrders, syncing, error };
}
