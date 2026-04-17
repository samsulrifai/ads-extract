import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Order, EarningsKPI, SyncRequest } from '@/types';

const API_BASE = import.meta.env.DEV ? '' : '';

const emptyKPI: EarningsKPI = {
  totalOriginalPrice: 0,
  totalSellerVoucher: 0,
  totalShopeeVoucher: 0,
  totalPendapatan: 0,
  totalShippingFee: 0,
  totalCommissionFee: 0,
  totalServiceFee: 0,
  totalTransactionFee: 0,
  totalPengeluaran: 0,
  totalNet: 0,
};

export function useEarnings() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState('');

  // Fetch orders with escrow data from Supabase
  const fetchFromDb = useCallback(async (params: SyncRequest) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', params.shop_id)
        .gte('create_time', `${params.start_date}T00:00:00`)
        .lte('create_time', `${params.end_date}T23:59:59`)
        .order('create_time', { ascending: false });

      if (dbError) throw dbError;
      setOrders((data as Order[]) || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch earnings data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync escrow data from Shopee API (auto-continues if there are remaining orders)
  const syncEscrow = useCallback(async (params: SyncRequest) => {
    setSyncing(true);
    setError(null);
    let totalSynced = 0;
    let batch = 1;

    try {
      let hasMore = true;

      while (hasMore) {
        setSyncProgress(`Batch ${batch}: Syncing financial data...`);

        const response = await fetch(`${API_BASE}/api/sync-escrow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Sync failed');
        }

        totalSynced += result.synced || 0;

        if (result.records) {
          setOrders(result.records as Order[]);
        }

        const remaining = result.remaining || 0;
        setSyncProgress(
          `Batch ${batch}: ${result.synced} synced. Total: ${totalSynced}.${remaining > 0 ? ` Remaining: ${remaining}...` : ''}`
        );

        hasMore = remaining > 0;
        batch++;

        // Small delay between batches
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setSyncProgress(`✓ Selesai! ${totalSynced} pesanan berhasil disync.`);
      setTimeout(() => setSyncProgress(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to sync escrow data');
    } finally {
      setSyncing(false);
    }
  }, []);

  // Compute KPIs from filtered orders
  const computeKPI = useCallback((filteredOrders: Order[]): EarningsKPI => {
    if (filteredOrders.length === 0) return emptyKPI;

    const totalOriginalPrice = filteredOrders.reduce((sum, o) => sum + (o.original_price || 0), 0);
    const totalSellerVoucher = filteredOrders.reduce((sum, o) => sum + (o.seller_voucher || 0), 0);
    const totalShopeeVoucher = filteredOrders.reduce((sum, o) => sum + (o.shopee_voucher || 0), 0);
    const totalShippingFee = filteredOrders.reduce((sum, o) => sum + (o.shipping_fee || 0), 0);
    const totalCommissionFee = filteredOrders.reduce((sum, o) => sum + (o.commission_fee || 0), 0);
    const totalServiceFee = filteredOrders.reduce((sum, o) => sum + (o.service_fee || 0), 0);
    const totalTransactionFee = filteredOrders.reduce((sum, o) => sum + (o.transaction_fee || 0), 0);

    const totalPendapatan = totalOriginalPrice + totalShopeeVoucher + totalSellerVoucher;
    const totalPengeluaran = totalShippingFee + totalCommissionFee + totalServiceFee + totalTransactionFee;
    const totalNet = totalPendapatan - totalPengeluaran;

    return {
      totalOriginalPrice,
      totalSellerVoucher,
      totalShopeeVoucher,
      totalPendapatan,
      totalShippingFee,
      totalCommissionFee,
      totalServiceFee,
      totalTransactionFee,
      totalPengeluaran,
      totalNet,
    };
  }, []);

  return {
    orders,
    loading,
    syncing,
    error,
    syncProgress,
    fetchFromDb,
    syncEscrow,
    computeKPI,
  };
}
