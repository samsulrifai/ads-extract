import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Order, SyncRequest } from '@/types';

const API_BASE = import.meta.env.DEV ? '' : '';


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

  // Aggregate all escrow_detail fields from JSONB
  const computeDetail = useCallback((filteredOrders: Order[]) => {
    const sum = (key: string) =>
      filteredOrders.reduce((acc, o) => {
        const detail = (o as any).escrow_detail;
        return acc + (detail?.[key] || 0);
      }, 0);

    // 1. Total Pendapatan
    const order_original_price = sum('order_original_price');
    const order_selling_price = sum('order_selling_price');
    const order_discounted_price = sum('order_discounted_price');
    const seller_discount = sum('seller_discount');
    const shopee_discount = sum('shopee_discount');
    const drc_adjustable_refund = sum('drc_adjustable_refund');
    const seller_return_refund = sum('seller_return_refund');

    const voucher_from_shopee = sum('voucher_from_shopee');
    const voucher_from_seller = sum('voucher_from_seller');
    const coin_used = sum('coin_used');
    const seller_coin_cash_back = sum('seller_coin_cash_back');

    const subtotalPesanan = order_original_price || order_selling_price;
    const totalDiskon = seller_discount + shopee_discount;
    const totalRefund = drc_adjustable_refund + seller_return_refund;
    const subtotalNet = subtotalPesanan - totalDiskon - totalRefund;

    const totalVoucher = voucher_from_shopee + voucher_from_seller + coin_used + seller_coin_cash_back;
    const totalPendapatan = subtotalNet - totalVoucher;

    // 2. Total Pengeluaran
    const buyer_paid_shipping_fee = sum('buyer_paid_shipping_fee');
    const actual_shipping_fee = sum('actual_shipping_fee');
    const final_shipping_fee = sum('final_shipping_fee');
    const shopee_shipping_rebate = sum('shopee_shipping_rebate');
    const shipping_fee_discount_from_3pl = sum('shipping_fee_discount_from_3pl');
    const reverse_shipping_fee = sum('reverse_shipping_fee');

    const totalBiayaPengiriman = 
      buyer_paid_shipping_fee - actual_shipping_fee + shopee_shipping_rebate +
      shipping_fee_discount_from_3pl - reverse_shipping_fee;

    const commission_fee = sum('commission_fee');
    const service_fee = sum('service_fee');
    const seller_transaction_fee = sum('seller_transaction_fee');
    const campaign_fee = sum('campaign_fee');
    const seller_order_processing_fee = sum('seller_order_processing_fee');
    const escrow_tax = sum('escrow_tax');
    const fbs_fee = sum('fbs_fee');
    const ads_fee = sum('ads_escrow_top_up_fee_or_technical_support_fee');

    const totalBiayaAdmin = 
      commission_fee + service_fee + seller_transaction_fee + 
      campaign_fee + seller_order_processing_fee + escrow_tax + fbs_fee + ads_fee;

    const totalPengeluaran = totalBiayaPengiriman + totalBiayaAdmin;

    // 3. Total Yang Dilepas
    const escrow_amount = sum('escrow_amount');
    const totalNet = escrow_amount || (totalPendapatan - totalPengeluaran);

    return {
      // Revenue
      order_original_price,
      order_selling_price,
      order_discounted_price,
      seller_discount,
      shopee_discount,
      drc_adjustable_refund,
      seller_return_refund,
      subtotalPesanan: subtotalNet,
      // Vouchers
      voucher_from_shopee,
      voucher_from_seller,
      coin_used,
      seller_coin_cash_back,
      totalVoucher,
      // Totals
      totalPendapatan,
      // Shipping
      buyer_paid_shipping_fee,
      actual_shipping_fee,
      final_shipping_fee,
      shopee_shipping_rebate,
      shipping_fee_discount_from_3pl,
      reverse_shipping_fee,
      totalBiayaPengiriman,
      // Admin & Fees
      commission_fee,
      service_fee,
      seller_transaction_fee,
      campaign_fee,
      seller_order_processing_fee,
      escrow_tax,
      fbs_fee,
      ads_fee,
      totalBiayaAdmin,
      // Final
      totalPengeluaran,
      escrow_amount,
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
    computeDetail,
  };
}
