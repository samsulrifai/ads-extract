import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { loadTokens, saveTokens } from '@/lib/shopee-client';
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

/**
 * Check if a shop's token is expired based on expired_at field.
 */
function isShopTokenExpired(shop: Shop): boolean {
  if (!shop.expired_at) return true;
  const now = new Date();
  const expiry = new Date(shop.expired_at);
  // 5 minute buffer
  return now.getTime() > expiry.getTime() - 5 * 60 * 1000;
}

/**
 * Try to refresh tokens for a shop via the API, update both Supabase and localStorage.
 */
async function tryRefreshShopToken(shop: Shop): Promise<Shop> {
  if (!shop.refresh_token) return shop;

  try {
    const res = await fetch('/api/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: shop.refresh_token,
        shop_id: shop.shopee_shop_id,
      }),
    });
    const data = await res.json();

    if (data.success) {
      // Save to localStorage so this device also has fresh tokens
      saveTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expire_in: data.expire_in,
        shop_id: data.shop_id,
      });

      return {
        ...shop,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expired_at: new Date(
          (Math.floor(Date.now() / 1000) + data.expire_in) * 1000
        ).toISOString(),
      };
    }
  } catch (err) {
    console.warn('Token refresh failed:', err);
  }

  return shop;
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
        const localTokens = loadTokens();

        shopList = data.map((shop: Shop) => {
          // If localStorage has fresher tokens for this shop, use those
          if (localTokens && shop.shopee_shop_id === localTokens.shop_id) {
            return {
              ...shop,
              access_token: localTokens.access_token,
              refresh_token: localTokens.refresh_token,
            };
          }
          // Otherwise use whatever Supabase has (works on other devices)
          return shop;
        });
      }
    } catch {
      console.warn('Supabase query failed, falling back to localStorage');
    }

    // Fallback: if Supabase returned nothing, check localStorage tokens
    if (shopList.length === 0) {
      const localShop = getShopFromLocalStorage();
      if (localShop) {
        shopList = [localShop];
      }
    }

    // Auto-refresh expired or missing tokens (handles new device scenario)
    const refreshedList: Shop[] = [];
    for (const shop of shopList) {
      const needsRefresh = !shop.access_token || isShopTokenExpired(shop);
      if (needsRefresh && shop.refresh_token) {
        console.log('[useShops] Token missing or expired, attempting refresh for shop', shop.shopee_shop_id);
        const refreshed = await tryRefreshShopToken(shop);
        refreshedList.push(refreshed);
      } else {
        refreshedList.push(shop);
      }
    }

    setShops(refreshedList);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const selectedShop = shops.length > 0 ? shops[0] : null;

  return { shops, loading, error, refetch: fetchShops, selectedShop };
}
