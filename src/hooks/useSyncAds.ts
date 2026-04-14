import { useState } from 'react';
import { functionsUrl } from '@/lib/supabase';
import type { SyncRequest, SyncResponse } from '@/types';

export function useSyncAds() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncAds = async (request: SyncRequest): Promise<SyncResponse> => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${functionsUrl}/sync-ads-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(request),
      });

      const data: SyncResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Sync failed');
      }

      setResult(data);
      return data;
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
