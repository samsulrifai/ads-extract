import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';
import { getShopToken } from './_lib/get-shop-token.js';

/**
 * POST /api/sync-escrow
 * Fetch escrow/financial details for orders from Shopee API.
 * Body: { shop_id, start_date, end_date }
 *
 * Calls /api/v2/payment/get_escrow_detail per order to get financial breakdown.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shop_id, start_date, end_date } = req.body;

    if (!shop_id || !start_date || !end_date) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(400).json({
        success: false,
        error: 'Missing shop_id, start_date, or end_date',
      });
    }

    const shopIdNum = Number(shop_id);

    // Get valid token
    const { access_token, error: tokenError } = await getShopToken(shopIdNum);
    if (tokenError || !access_token) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        synced: 0,
        error: tokenError || 'No valid token found.',
      });
    }

    // Get Supabase admin client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' });
    }
    const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Get orders that need escrow sync (not synced OR missing JSONB detail)
    const { data: orders, error: dbError } = await supabaseAdmin
      .from('orders')
      .select('order_sn')
      .eq('shop_id', shopIdNum)
      .gte('create_time', `${start_date}T00:00:00`)
      .lte('create_time', `${end_date}T23:59:59`)
      .or('escrow_synced.is.null,escrow_synced.eq.false,escrow_detail.is.null');

    if (dbError) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: `DB query error: ${dbError.message}` });
    }

    if (!orders || orders.length === 0) {
      // Return existing data even if nothing to sync
      const { data: allOrders } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('shop_id', shopIdNum)
        .gte('create_time', `${start_date}T00:00:00`)
        .lte('create_time', `${end_date}T23:59:59`)
        .order('create_time', { ascending: false });

      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: true,
        synced: 0,
        message: 'All orders already have escrow data.',
        records: allOrders || [],
      });
    }

    // Limit orders per sync to avoid Vercel timeout (max ~60s for Pro, ~10s for Hobby)
    const MAX_PER_SYNC = 50;
    const ordersToSync = orders.slice(0, MAX_PER_SYNC);

    // Fetch escrow details in parallel batches of 5
    let synced = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < ordersToSync.length; i += BATCH_SIZE) {
      const batch = ordersToSync.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (order) => {
          const escrowData = await fetchEscrowDetail(access_token, shopIdNum, order.order_sn);

          if (escrowData) {
            const { error: updateError } = await supabaseAdmin
              .from('orders')
              .update({
                original_price: escrowData.original_price || 0,
                seller_voucher: escrowData.seller_voucher || 0,
                shopee_voucher: escrowData.shopee_voucher || 0,
                shipping_fee: escrowData.shipping_fee || 0,
                commission_fee: escrowData.commission_fee || 0,
                service_fee: escrowData.service_fee || 0,
                transaction_fee: escrowData.transaction_fee || 0,
                escrow_amount: escrowData.escrow_amount || 0,
                escrow_detail: escrowData.raw,
                escrow_synced: true,
              })
              .eq('order_sn', order.order_sn);

            if (updateError) {
              throw new Error(`Update ${order.order_sn}: ${updateError.message}`);
            }
            return order.order_sn;
          }
          return null;
        })
      );

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          synced++;
        } else if (result.status === 'rejected') {
          errors.push(result.reason?.message || 'Unknown error');
        }
      });

      // Small delay between batches to be safe with rate limits
      if (i + BATCH_SIZE < ordersToSync.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Return all orders with updated data
    const { data: allOrders } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('shop_id', shopIdNum)
      .gte('create_time', `${start_date}T00:00:00`)
      .lte('create_time', `${end_date}T23:59:59`)
      .order('create_time', { ascending: false });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      synced,
      total_orders: orders.length,
      remaining: Math.max(0, orders.length - MAX_PER_SYNC),
      errors: errors.length > 0 ? errors : undefined,
      records: allOrders || [],
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function fetchEscrowDetail(
  accessToken: string,
  shopId: number,
  orderSn: string
): Promise<any | null> {
  const apiPath = '/api/v2/payment/get_escrow_detail';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = generateSign(apiPath, timestamp, accessToken, shopId);

  const queryParams = new URLSearchParams({
    partner_id: String(PARTNER_ID),
    timestamp: String(timestamp),
    sign,
    access_token: accessToken,
    shop_id: String(shopId),
    order_sn: orderSn,
  });

  const url = `${API_HOST}${apiPath}?${queryParams.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error && data.error !== '') {
    console.warn(`Escrow error for ${orderSn}: ${data.error} - ${data.message || ''}`);
    return null;
  }

  const r = data.response || {};
  const oi = r.order_income || r;

  // Parse known summary fields for column storage
  const parsed = {
    original_price: pf(oi.original_price || oi.order_original_price || oi.order_selling_price),
    seller_voucher: pf(oi.seller_voucher || oi.voucher_from_seller),
    shopee_voucher: pf(oi.shopee_voucher || oi.voucher_from_shopee),
    shipping_fee: pf(oi.actual_shipping_fee || oi.final_shipping_fee || oi.shipping_fee),
    commission_fee: pf(oi.commission_fee || oi.shopee_commission),
    service_fee: pf(oi.service_fee),
    transaction_fee: pf(oi.seller_transaction_fee || oi.transaction_fee),
    escrow_amount: pf(r.escrow_amount || oi.escrow_amount),
    // Store the FULL raw response for granular display on frontend
    raw: {
      escrow_amount: pf(r.escrow_amount || oi.escrow_amount),
      buyer_total_amount: pf(r.buyer_total_amount || oi.buyer_total_amount),
      // Revenue
      order_original_price: pf(oi.order_original_price || oi.original_price),
      order_selling_price: pf(oi.order_selling_price),
      order_discounted_price: pf(oi.order_discounted_price),
      seller_discount: pf(oi.seller_discount),
      shopee_discount: pf(oi.shopee_discount || oi.original_shopee_discount),
      // Vouchers
      voucher_from_seller: pf(oi.voucher_from_seller || oi.seller_voucher),
      voucher_from_shopee: pf(oi.voucher_from_shopee || oi.shopee_voucher),
      coin_used: pf(oi.coin_used || oi.coins),
      seller_coin_cash_back: pf(oi.seller_coin_cash_back),
      // Refund
      drc_adjustable_refund: pf(oi.drc_adjustable_refund),
      seller_return_refund: pf(oi.seller_return_refund),
      // Shipping
      buyer_paid_shipping_fee: pf(oi.buyer_paid_shipping_fee || oi.shipping_fee),
      actual_shipping_fee: pf(oi.actual_shipping_fee),
      final_shipping_fee: pf(oi.final_shipping_fee),
      shopee_shipping_rebate: pf(oi.shopee_shipping_rebate),
      shipping_fee_discount_from_3pl: pf(oi.shipping_fee_discount_from_3pl),
      reverse_shipping_fee: pf(oi.reverse_shipping_fee),
      // Fees
      commission_fee: pf(oi.commission_fee || oi.shopee_commission),
      service_fee: pf(oi.service_fee),
      seller_transaction_fee: pf(oi.seller_transaction_fee || oi.transaction_fee),
      campaign_fee: pf(oi.campaign_fee),
      seller_order_processing_fee: pf(oi.seller_order_processing_fee),
      escrow_tax: pf(oi.escrow_tax),
      fbs_fee: pf(oi.fbs_fee),
      ads_escrow_top_up_fee_or_technical_support_fee: pf(oi.ads_escrow_top_up_fee_or_technical_support_fee),
      // Protection
      shipping_seller_protection_fee_amount: pf(oi.shipping_seller_protection_fee_amount),
      delivery_seller_protection_fee_premium_amount: pf(oi.delivery_seller_protection_fee_premium_amount),
    },
  };

  return parsed;
}

function pf(val: any): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}
