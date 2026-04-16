import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadTokens } from '@/lib/shopee-client';
import type { Shop } from '@/types';

/**
 * Build a synthetic Shop object from localStorage tokens.
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

/**
 * Push localStorage tokens to Supabase so other devices can use them.
 */
async function pushTokensToSupabase(): Promise<void> {
  const tokens = loadTokens();
  if (!tokens) return;

  try {
    const res = await fetch('/api/push-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: tokens.shop_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expire_in: tokens.expire_in,
      }),
    });
    const data = await res.json();
    if (data.success) {
      console.log('[useShops] Tokens pushed to Supabase successfully');
    }
  } catch (err) {
    console.warn('[useShops] Failed to push tokens to Supabase:', err);
  }
}

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    setError(null);

    // If localStorage has tokens, push them to Supabase first
    await pushTokensToSupabase();

    let shopList: Shop[] = [];

    // Try Supabase
    try {
      const { data, error: fetchError } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchError && data && data.length > 0) {
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
      console.warn('Supabase query failed, falling back to localStorage');
    }

    // Fallback: if Supabase returned nothing, check localStorage
    if (shopList.length === 0) {
      const localShop = getShopFromLocalStorage();
      if (localShop) {
        shopList = [localShop];
      }
    }

    setShops(shopList);

    // Auto-select first shop if none selected yet
    if (shopList.length > 0 && !selectedShopId) {
      setSelectedShopId(shopList[0].shopee_shop_id);
    }

    setLoading(false);

    // Auto-update shop names that are still default "Shop XXXX"
    for (const shop of shopList) {
      if (shop.name && /^Shop \d+$/.test(shop.name)) {
        try {
          const res = await fetch('/api/update-shop-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shop_id: shop.shopee_shop_id }),
          });
          const data = await res.json();
          if (data.success && data.shop_name) {
            setShops(prev => prev.map(s =>
              s.shopee_shop_id === shop.shopee_shop_id
                ? { ...s, name: data.shop_name }
                : s
            ));
          }
        } catch {
          // silently ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const selectShop = useCallback((shopId: number) => {
    setSelectedShopId(shopId);
  }, []);

  const selectedShop = shops.find(s => s.shopee_shop_id === selectedShopId) || (shops.length > 0 ? shops[0] : null);

  return { shops, loading, error, refetch: fetchShops, selectedShop, selectShop };
}
