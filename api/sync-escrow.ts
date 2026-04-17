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

    // Get orders that haven't been escrow-synced yet
    const { data: orders, error: dbError } = await supabaseAdmin
      .from('orders')
      .select('order_sn')
      .eq('shop_id', shopIdNum)
      .gte('create_time', `${start_date}T00:00:00`)
      .lte('create_time', `${end_date}T23:59:59`)
      .or('escrow_synced.is.null,escrow_synced.eq.false');

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

    // Fetch escrow details per order (with rate limiting)
    let synced = 0;
    const errors: string[] = [];

    for (const order of orders) {
      try {
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
              escrow_synced: true,
            })
            .eq('order_sn', order.order_sn);

          if (updateError) {
            errors.push(`Update ${order.order_sn}: ${updateError.message}`);
          } else {
            synced++;
          }
        }

        // Rate limit: 50ms between requests to avoid hitting Shopee limits
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (err: any) {
        errors.push(`${order.order_sn}: ${err.message}`);
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

  // Map Shopee response to our fields
  // The structure may differ by region; handle both formats
  const orderIncome = r.order_income || r;

  return {
    original_price: parseFloat(orderIncome.original_price || orderIncome.order_original_price || 0),
    seller_voucher: parseFloat(orderIncome.seller_voucher || orderIncome.voucher_from_seller || 0),
    shopee_voucher: parseFloat(orderIncome.shopee_voucher || orderIncome.voucher_from_shopee || 0),
    shipping_fee: parseFloat(
      orderIncome.actual_shipping_fee ||
      orderIncome.final_shipping_fee ||
      orderIncome.shipping_fee ||
      0
    ),
    commission_fee: parseFloat(orderIncome.commission_fee || orderIncome.shopee_commission || 0),
    service_fee: parseFloat(orderIncome.service_fee || 0),
    transaction_fee: parseFloat(orderIncome.transaction_fee || 0),
    escrow_amount: parseFloat(r.escrow_amount || orderIncome.escrow_amount || 0),
  };
}
