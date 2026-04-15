import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadTokens } from '@/lib/shopee-client';
import type { Shop } from '@/types';

/**
 * Build a synthetic Shop object from localStorage tokens.
 * Used as fallback when Supabase is unavailable or empty.
 */
function getShopFromLocalStorage(): Shop | null {
  const tokens = loadTokens();
  if (!tokens) return null;

  return {
    id: `local-${tokens.shop_id}`,
    shopee_shop_id: tokens.shop_id,
    name: `Shop ${tokens.shop_id}`,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expired_at: new Date(
      (tokens.saved_at + tokens.expire_in) * 1000
    ).toISOString(),
    created_at: new Date(tokens.saved_at * 1000).toISOString(),
    updated_at: new Date(tokens.saved_at * 1000).toISOString(),
  };
}

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError(null);

    let shopList: Shop[] = [];

    // Try Supabase first
    try {
      const { data, error: fetchError } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchError && data && data.length > 0) {
        // Merge fresh tokens from localStorage into Supabase shop data
        // (token refresh only updates localStorage, not Supabase)
        const localTokens = loadTokens();
        shopList = data.map((shop: Shop) => {
          if (localTokens && shop.shopee_shop_id === localTokens.shop_id) {
            return {
              ...shop,
              access_token: localTokens.access_token,
              refresh_token: localTokens.refresh_token,
            };
          }
          return shop;
        });
      }
    } catch {
      // Supabase unreachable (e.g. localhost in production) — continue to fallback
      console.warn('Supabase query failed, falling back to localStorage');
    }

    // Fallback: if Supabase returned nothing, check localStorage tokens
    if (shopList.length === 0) {
      const localShop = getShopFromLocalStorage();
      if (localShop) {
        shopList = [localShop];
      }
    }

    setShops(shopList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const selectedShop = shops.length > 0 ? shops[0] : null;

  return { shops, loading, error, refetch: fetchShops, selectedShop };
}
