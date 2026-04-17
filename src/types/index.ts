export interface Shop {
  id: string;
  shopee_shop_id: number;
  name: string;
  access_token: string | null;
  refresh_token: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AdsType = 'search' | 'discovery' | 'video';

export interface AdsPerformance {
  id: string;
  shop_id: number;
  date: string;
  ads_type: AdsType;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  gmv: number;
  created_at: string;
}

export interface SyncRequest {
  shop_id: number;
  start_date: string;
  end_date: string;
}

export interface SyncResponse {
  success: boolean;
  records_synced: number;
  records?: AdsPerformance[];
  message?: string;
  error?: string;
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface KPIData {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalOrders: number;
  totalGMV: number;
  ctr: number;
  roas: number;
  cpc: number;
}

export interface Order {
  order_sn: string;
  create_time: string; // ISO string or timestamp
  order_status: string;
  total_amount: number;
  shipping_carrier: string;
  payment_method: string;
  item_count: number;
  product_name: string;
  sku: string;
  // Escrow financial fields
  original_price: number;
  seller_voucher: number;
  shopee_voucher: number;
  shipping_fee: number;
  commission_fee: number;
  service_fee: number;
  transaction_fee: number;
  escrow_amount: number;
  escrow_synced: boolean;
}

export interface EarningsKPI {
  // Pendapatan
  totalOriginalPrice: number;
  totalSellerVoucher: number;
  totalShopeeVoucher: number;
  totalPendapatan: number;
  // Pengeluaran
  totalShippingFee: number;
  totalCommissionFee: number;
  totalServiceFee: number;
  totalTransactionFee: number;
  totalPengeluaran: number;
  // Net
  totalNet: number;
}

export interface SyncOrdersResponse {
  success: boolean;
  records_synced: number;
  records?: Order[];
  message?: string;
  error?: string;
}
