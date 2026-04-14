import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadTokens } from '@/lib/shopee-client';
import type { Shop } from '@/types';

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      let shopList: Shop[] = data || [];

      // Fallback: if Supabase has no shops, check localStorage tokens
      // This handles the case where OAuth callback saved tokens to localStorage
      // but they haven't been persisted to Supabase yet
      if (shopList.length === 0) {
        const localTokens = loadTokens();
        if (localTokens) {
          shopList = [
            {
              id: `local-${localTokens.shop_id}`,
              shopee_shop_id: localTokens.shop_id,
              name: `Shop ${localTokens.shop_id}`,
              access_token: localTokens.access_token,
              refresh_token: localTokens.refresh_token,
              expired_at: new Date(
                (localTokens.saved_at + localTokens.expire_in) * 1000
              ).toISOString(),
              created_at: new Date(localTokens.saved_at * 1000).toISOString(),
              updated_at: new Date(localTokens.saved_at * 1000).toISOString(),
            },
          ];
        }
      }

      setShops(shopList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch shops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const selectedShop = shops.length > 0 ? shops[0] : null;

  return { shops, loading, error, refetch: fetchShops, selectedShop };
}
