import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { PARTNER_ID, API_HOST, generateSign } from './_lib/shopee.js';
import { getShopToken } from './_lib/get-shop-token.js';

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

    // Get valid token from Supabase (auto-refreshes if expired)
    const { access_token, error: tokenError } = await getShopToken(shopIdNum);
    if (tokenError || !access_token) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({
        success: false,
        records_synced: 0,
        error: tokenError || 'No valid token found for this shop.',
      });
    }

    const startTime = Math.floor(new Date(start_date + 'T00:00:00').getTime() / 1000);
    const endTime = Math.floor(new Date(end_date + 'T23:59:59').getTime() / 1000);

    // 1. Get Order SN List
    const { orderSns, error: listError } = await fetchOrderList(access_token, shopIdNum, startTime, endTime);
    if (listError) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ success: false, records_synced: 0, error: `Get Order List: ${listError}` });
    }

    if (orderSns.length === 0) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ success: true, records: [], records_synced: 0 });
    }

    // 2. Get Order Details (in chunks of 50)
    const records = [];
    for (let i = 0; i < orderSns.length; i += 50) {
      const chunk = orderSns.slice(i, i + 50);
      const { data, error: detailError } = await fetchOrderDetails(access_token, shopIdNum, chunk);
      
      if (detailError) {
        console.warn(`Detail Error: ${detailError}`);
        continue;
      }

      if (data && data.response && data.response.order_list) {
        const transformed = data.response.order_list.map((order: any) => {
          const items = order.item_list || [];
          const productNames = items.map((item: any) => item.item_name || '').filter(Boolean).join(', ');
          const skus = items.map((item: any) => item.model_sku || item.item_sku || '').filter(Boolean).join(', ');

          return {
            order_sn: order.order_sn,
            shop_id: shopIdNum,
            create_time: new Date(order.create_time * 1000).toISOString(),
            order_status: order.order_status,
            total_amount: order.total_amount,
            shipping_carrier: order.shipping_carrier || '-',
            payment_method: order.payment_method || '-',
            item_count: items.length,
            product_name: productNames || '-',
            sku: skus || '-',
          };
        });
        records.push(...transformed);
      }
    }

    // Save to Supabase using Admin API to bypass RLS
    if (records.length > 0) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      if (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('Supabase credentials missing in env.');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ success: false, error: 'Missing SUPABASE_SERVICE_ROLE_KEY.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

      const { error: dbError } = await supabaseAdmin
        .from('orders')
        .upsert(records, { onConflict: 'order_sn' });

      if (dbError) {
        console.error('Failed to save orders to database:', dbError);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ success: false, error: `Database Save Error: ${dbError.message || JSON.stringify(dbError)}` });
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      success: true,
      records,
      records_synced: records.length,
    });
  } catch (error: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function fetchOrderList(accessToken: string, shopId: number, startTime: number, endTime: number): Promise<{ orderSns: string[], error?: string }> {
  try {
    const apiPath = '/api/v2/order/get_order_list';
    let cursor = '';
    let more = true;
    const orderSns: string[] = [];

    while (more && orderSns.length < 500) {
      const timestamp = Math.floor(Date.now() / 1000);
      const sign = generateSign(apiPath, timestamp, accessToken, shopId);

      const queryParams = new URLSearchParams({
        partner_id: String(PARTNER_ID),
        timestamp: String(timestamp),
        sign,
        access_token: accessToken,
        shop_id: String(shopId),
        time_range_field: 'create_time',
        time_from: String(startTime),
        time_to: String(endTime),
        page_size: '100',
        cursor,
      });

      const url = `${API_HOST}${apiPath}?${queryParams.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error && data.error !== '') {
        return { orderSns: [], error: `${data.error}: ${data.message || ''}` };
      }

      const list = data.response?.order_list || [];
      orderSns.push(...list.map((o: any) => o.order_sn));

      more = data.response?.more;
      cursor = data.response?.next_cursor || '';
      
      if (!cursor) break;
    }

    return { orderSns };
  } catch (e: any) {
    return { orderSns: [], error: e.message };
  }
}

async function fetchOrderDetails(accessToken: string, shopId: number, orderSns: string[]) {
  try {
    const apiPath = '/api/v2/order/get_order_detail';
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = generateSign(apiPath, timestamp, accessToken, shopId);

    const snListStr = orderSns.join(',');
    const optionalFields = 'total_amount,payment_method,shipping_carrier,item_list';

    const queryParams = new URLSearchParams({
      partner_id: String(PARTNER_ID),
      timestamp: String(timestamp),
      sign,
      access_token: accessToken,
      shop_id: String(shopId),
      order_sn_list: snListStr,
      response_optional_fields: optionalFields,
    });

    const url = `${API_HOST}${apiPath}?${queryParams.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error && data.error !== '') {
      return { data: null, error: `${data.error}: ${data.message || ''}` };
    }

    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}
