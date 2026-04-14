import { useState } from 'react';
import { loadTokens, refreshTokens, isTokenExpired } from '@/lib/shopee-client';
import type { SyncResponse } from '@/types';

export interface SyncAdsRequest {
  shop_id: number;
  start_date: string;
  end_date: string;
}

export function useSyncAds() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncAds = async (request: SyncAdsRequest): Promise<SyncResponse> => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      // Get access token from localStorage, auto-refresh if expired
      let tokens = loadTokens();
      if (!tokens) {
        throw new Error('Not connected. Please authorize your shop first.');
      }

      if (isTokenExpired(tokens)) {
        tokens = await refreshTokens();
      }

      const response = await fetch('/api/sync-ads-data', {
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

      // Log full response for debugging
      console.log('[SyncAds] Full API response:', JSON.stringify(data, null, 2));

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Sync failed');
      }

      const syncResult: SyncResponse = {
        success: true,
        records_synced: data.records_synced || 0,
        records: data.records || [],
      };

      setResult(syncResult);
      return syncResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      return { success: false, records_synced: 0, error: message };
    } finally {
      setSyncing(false);
    }
  };

  return { syncAds, syncing, result, error };
}
