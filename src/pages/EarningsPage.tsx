import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';
import {
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DateRangePicker from '@/components/DateRangePicker';
import { useShops } from '@/hooks/useShops';
import { useEarnings } from '@/hooks/useEarnings';
import type { DateRange } from '@/types';

/** Format number as Rp with full digits, handles negative */
const formatAmount = (value: number) => {
  const abs = Math.abs(Math.round(value));
  const formatted = abs.toLocaleString('id-ID');
  if (value < 0) return `-${formatted}`;
  return formatted;
};

const ORDER_STATUSES = [
  { value: 'all', label: 'Semua Status' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'READY_TO_SHIP', label: 'Ready to Ship' },
  { value: 'IN_CANCEL', label: 'In Cancel' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PROCESSED', label: 'Processed' },
];

export default function EarningsPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [statusFilter, setStatusFilter] = useState('all');

  const { shops, selectedShop, selectShop } = useShops();
  const { orders, loading, syncing, error, syncProgress, fetchFromDb, syncEscrow, computeDetail } = useEarnings();

  const lastLoadKey = useRef('');

  // Auto-load from DB
  useEffect(() => {
    if (!selectedShop || !dateRange.from || !dateRange.to) return;

    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days > 60) return;

    const loadKey = `${selectedShop.shopee_shop_id}-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (lastLoadKey.current === loadKey) return;
    lastLoadKey.current = loadKey;

    fetchFromDb({
      shop_id: selectedShop.shopee_shop_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });
  }, [selectedShop, dateRange, fetchFromDb]);

  const handleSync = useCallback(async () => {
    if (!selectedShop || !dateRange.from || !dateRange.to) return;
    lastLoadKey.current = '';
    await syncEscrow({
      shop_id: selectedShop.shopee_shop_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });
  }, [selectedShop, dateRange, syncEscrow]);

  // Filter orders by status
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((o) => o.order_status === statusFilter);
  }, [orders, statusFilter]);

  // Compute detailed breakdown from filtered orders
  const d = useMemo(() => computeDetail(filteredOrders), [filteredOrders, computeDetail]);


  // Get unique statuses from data
  const availableStatuses = useMemo(() => {
    const statuses = new Set(orders.map((o) => o.order_status));
    return ORDER_STATUSES.filter((s) => s.value === 'all' || statuses.has(s.value));
  }, [orders]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Penghasilan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ringkasan keuangan dari pesanan Shopee Anda.
        </p>
      </div>

      {/* Controls Bar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            {shops.length > 0 && (
              <Select
                value={selectedShop?.shopee_shop_id?.toString()}
                onValueChange={(val) => selectShop(Number(val))}
              >
                <SelectTrigger className="w-full lg:w-[200px] h-10 bg-secondary/50 border-border">
                  <SelectValue placeholder="Pilih toko" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.shopee_shop_id.toString()}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[160px] h-10 bg-secondary/50 border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {availableStatuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleSync}
                disabled={!selectedShop || syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  bg-primary text-primary-foreground hover:bg-primary/90
                  disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Penghasilan'}
              </button>
            </div>
          </div>

          {/* Sync progress */}
          {syncProgress && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-primary/10 text-primary border border-primary/20">
              ⟳ {syncProgress}
            </div>
          )}

          {error && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-destructive/10 text-destructive border border-destructive/20">
              ✗ {error}
            </div>
          )}

          {shops.length === 0 && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-warning/10 text-warning border border-warning/20">
              ⚠ Belum ada toko. Hubungkan toko di halaman <strong>Shops</strong>.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ringkasan Penghasilan - Shopee Style */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          {loading || syncing ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Belum ada data. Sync Orders terlebih dahulu, lalu Sync Penghasilan.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-orange-500 to-orange-600">
                  <th className="text-left py-3 px-4 text-white font-semibold text-sm" colSpan={2}>
                    Ringkasan Penghasilan
                  </th>
                  <th className="text-right py-3 px-4 text-white font-semibold text-sm">
                    Rp
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* ===== 1. TOTAL PENDAPATAN ===== */}
                <SectionHeader label="1. Total Pendapatan" value={d.totalPendapatan} />

                {/* Subtotal Pesanan */}
                <SubSectionHeader label="Subtotal Pesanan" value={d.subtotalPesanan} />
                <DetailRow label="Harga Asli Produk" value={d.order_original_price || d.order_selling_price} indent={2} />
                <DetailRow label="Total Diskon Produk" value={-d.seller_discount - d.shopee_discount} indent={2} />
                <DetailRow label="Jumlah Pengembalian Dana ke Pembeli" value={-d.drc_adjustable_refund - d.seller_return_refund} indent={2} />

                {/* Voucher & Subsidi Shopee */}
                <SubSectionHeader label="Voucher & Subsidi Shopee" value={-d.totalVoucher} />
                <DetailRow label="Diskon Produk dari Shopee" value={-d.shopee_discount} indent={2} />
                <DetailRow label="Voucher disponsori oleh Penjual" value={-d.voucher_from_seller} indent={2} />
                <DetailRow label="Voucher dari Shopee" value={-d.voucher_from_shopee} indent={2} />
                <DetailRow label="Cashback Koin disponsori Penjual" value={-d.seller_coin_cash_back} indent={2} />
                <DetailRow label="Koin yang Digunakan Pembeli" value={-d.coin_used} indent={2} />

                {/* ===== 2. TOTAL PENGELUARAN ===== */}
                <SectionHeader label="2. Total Pengeluaran" value={-d.totalPengeluaran} isExpense />

                {/* Total Biaya Pengiriman */}
                <SubSectionHeader label="Total Biaya Pengiriman" value={-d.totalBiayaPengiriman} />
                <DetailRow label="Ongkir Dibayar Pembeli" value={d.buyer_paid_shipping_fee} indent={2} />
                <DetailRow label="Gratis Ongkir dari Shopee" value={d.shopee_shipping_rebate} indent={2} />
                <DetailRow label="Diskon Ongkir Ditanggung Jasa Kirim" value={d.shipping_fee_discount_from_3pl} indent={2} />
                <DetailRow label="Ongkir yang Diteruskan oleh Shopee ke Jasa Kirim" value={-d.actual_shipping_fee} indent={2} />
                <DetailRow label="Ongkos Kirim Pengembalian Barang" value={-d.reverse_shipping_fee} indent={2} />

                {/* Biaya Admin & Layanan */}
                <SubSectionHeader label="Biaya Admin & Layanan" value={-d.totalBiayaAdmin} />
                <DetailRow label="Biaya Komisi" value={-d.commission_fee} indent={2} />
                <DetailRow label="Biaya Layanan" value={-d.service_fee} indent={2} />
                <DetailRow label="Biaya Transaksi" value={-d.seller_transaction_fee} indent={2} />
                <DetailRow label="Biaya Proses Pesanan" value={-d.seller_order_processing_fee} indent={2} />
                <DetailRow label="Biaya Kampanye" value={-d.campaign_fee} indent={2} />
                <DetailRow label="Biaya Administrasi (PPN)" value={-d.escrow_tax} indent={2} />
                <DetailRow label="Biaya FBS" value={-d.fbs_fee} indent={2} />
                <DetailRow label="Biaya Isi Saldo Otomatis" value={-d.ads_fee} indent={2} />

                {/* ===== 3. TOTAL YANG DILEPAS ===== */}
                <tr className="bg-gradient-to-r from-cyan-500/10 to-transparent border-t-2 border-cyan-500/30">
                  <td colSpan={2} className="py-3.5 px-4">
                    <span className="text-sm font-bold text-cyan-400">3. Total yang Dilepas</span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`text-base font-bold ${d.totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                      {formatAmount(d.totalNet)}
                    </span>
                  </td>
                </tr>

                {/* ===== SUMMARY FOOTER ===== */}
                <tr className="border-t border-border/30">
                  <td colSpan={3} className="py-3 px-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{filteredOrders.length} pesanan</span>
                      <span>
                        {filteredOrders.filter((o) => o.escrow_synced).length} / {filteredOrders.length} sudah sync escrow
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Detail Per Pesanan Table */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Detail Per Pesanan
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {filteredOrders.length} pesanan
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Order SN</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Tanggal</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">Pendapatan</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">Pengeluaran</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">Dilepas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const voucher = (order.shopee_voucher || 0) + (order.seller_voucher || 0);
                    const adminFee = (order.commission_fee || 0) + (order.service_fee || 0) + (order.transaction_fee || 0);
                    const pendapatan = (order.original_price || 0) + voucher;
                    const pengeluaran = (order.shipping_fee || 0) + adminFee;
                    const net = pendapatan - pengeluaran;

                    return (
                      <tr key={order.order_sn} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-2 font-mono text-xs">
                          {order.order_sn}
                          {!order.escrow_synced && <span className="ml-1 text-[10px] text-warning" title="Belum sync">⏳</span>}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">
                          {format(new Date(order.create_time), 'dd MMM yyyy')}
                        </td>
                        <td className="py-2.5 px-2"><StatusBadge status={order.order_status} /></td>
                        <td className="py-2.5 px-2 text-right text-xs text-emerald-400">
                          {order.escrow_synced ? formatAmount(pendapatan) : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs text-red-400">
                          {order.escrow_synced ? formatAmount(-pengeluaran) : '-'}
                        </td>
                        <td className={`py-2.5 px-2 text-right text-xs font-semibold ${net >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                          {order.escrow_synced ? formatAmount(net) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-white/[0.02]">
                    <td colSpan={3} className="py-3 px-2 text-xs font-semibold">TOTAL</td>
                    <td className="py-3 px-2 text-right text-xs font-bold text-emerald-400">
                      {formatAmount(d.totalPendapatan)}
                    </td>
                    <td className="py-3 px-2 text-right text-xs font-bold text-red-400">
                      {formatAmount(-d.totalPengeluaran)}
                    </td>
                    <td className={`py-3 px-2 text-right text-xs font-bold ${d.totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                      {formatAmount(d.totalNet)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ===== Shopee-style Breakdown Row Components ===== */

function SectionHeader({ label, value, isExpense }: { label: string; value: number; isExpense?: boolean }) {
  return (
    <tr className={`border-t-2 ${isExpense ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
      <td colSpan={2} className="py-3 px-4">
        <span className={`text-sm font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
          {label}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`text-sm font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
          {formatAmount(value)}
        </span>
      </td>
    </tr>
  );
}

function SubSectionHeader({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-border/30 bg-white/[0.02]">
      <td colSpan={2} className="py-2.5 px-4 pl-6">
        <span className="text-sm font-semibold text-foreground/80">{label}</span>
      </td>
      <td className="py-2.5 px-4 text-right">
        <span className="text-sm font-semibold text-foreground/80">{formatAmount(value)}</span>
      </td>
    </tr>
  );
}

function DetailRow({ label, value, indent = 1 }: { label: string; value: number; indent?: number }) {
  const pl = indent === 2 ? 'pl-10' : 'pl-6';
  return (
    <tr className="border-t border-border/20 hover:bg-white/[0.01] transition-colors">
      <td colSpan={2} className={`py-2 px-4 ${pl}`}>
        <span className="text-sm text-muted-foreground">{label}</span>
      </td>
      <td className="py-2 px-4 text-right">
        <span className="text-sm text-muted-foreground">{formatAmount(value)}</span>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string }> = {
    COMPLETED: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    SHIPPED: { color: 'text-blue-400', bg: 'bg-blue-500/10' },
    READY_TO_SHIP: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
    IN_CANCEL: { color: 'text-orange-400', bg: 'bg-orange-500/10' },
    CANCELLED: { color: 'text-red-400', bg: 'bg-red-500/10' },
    UNPAID: { color: 'text-gray-400', bg: 'bg-gray-500/10' },
    PROCESSED: { color: 'text-purple-400', bg: 'bg-purple-500/10' },
  };

  const c = config[status] || { color: 'text-muted-foreground', bg: 'bg-secondary' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.color} ${c.bg}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
