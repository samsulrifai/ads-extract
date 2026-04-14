import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
      setShops(data || []);
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
