import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BadgeDollarSign,
  Truck,
  Receipt,
  Ticket,
  RefreshCw,
  Gift,
  CreditCard,
  HandCoins,
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

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
};

const formatCurrencyFull = (value: number) =>
  `Rp ${Math.round(value).toLocaleString('id-ID')}`;

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
  const { orders, loading, syncing, error, syncProgress, fetchFromDb, syncEscrow, computeKPI } = useEarnings();

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

  // Compute KPIs from filtered orders
  const kpi = useMemo(() => computeKPI(filteredOrders), [filteredOrders, computeKPI]);

  // Aggregate chart data by date
  const chartData = useMemo(() => {
    const byDate: Record<string, { date: string; pendapatan: number; pengeluaran: number }> = {};

    filteredOrders.forEach((o) => {
      const d = format(new Date(o.create_time), 'yyyy-MM-dd');
      if (!byDate[d]) byDate[d] = { date: d, pendapatan: 0, pengeluaran: 0 };

      const pendapatan = (o.original_price || 0) + (o.shopee_voucher || 0) + (o.seller_voucher || 0);
      const pengeluaran =
        (o.shipping_fee || 0) + (o.commission_fee || 0) + (o.service_fee || 0) + (o.transaction_fee || 0);

      byDate[d].pendapatan += pendapatan;
      byDate[d].pengeluaran += pengeluaran;
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Total Pendapatan */}
        <Card className="glass-card glass-card-hover gradient-border overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pendapatan
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500 mb-4">
              {formatCurrency(kpi.totalPendapatan)}
            </p>
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <BadgeDollarSign className="h-3.5 w-3.5" />
                  Sub Total Pesanan
                </span>
                <span className="font-medium">{formatCurrencyFull(kpi.totalOriginalPrice)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Ticket className="h-3.5 w-3.5" />
                  Voucher Shopee
                </span>
                <span className="font-medium">{formatCurrencyFull(kpi.totalShopeeVoucher)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Gift className="h-3.5 w-3.5" />
                  Voucher Seller
                </span>
                <span className="font-medium">{formatCurrencyFull(kpi.totalSellerVoucher)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Pengeluaran */}
        <Card className="glass-card glass-card-hover gradient-border overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pengeluaran
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500 mb-4">
              {formatCurrency(kpi.totalPengeluaran)}
            </p>
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  Biaya Pengiriman
                </span>
                <span className="font-medium">{formatCurrencyFull(kpi.totalShippingFee)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Receipt className="h-3.5 w-3.5" />
                  Biaya Admin & Layanan
                </span>
                <span className="font-medium">
                  {formatCurrencyFull(kpi.totalCommissionFee + kpi.totalServiceFee)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  Biaya Transaksi
                </span>
                <span className="font-medium">{formatCurrencyFull(kpi.totalTransactionFee)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Yang Dilepas (Net) */}
        <Card className="glass-card glass-card-hover gradient-border overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-2 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Yang Dilepas
              </CardTitle>
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <HandCoins className="h-5 w-5 text-cyan-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <p className={`text-3xl font-bold mb-4 ${kpi.totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
              {formatCurrency(kpi.totalNet)}
            </p>
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  Pendapatan
                </span>
                <span className="font-medium text-emerald-500">
                  +{formatCurrencyFull(kpi.totalPendapatan)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                  Pengeluaran
                </span>
                <span className="font-medium text-red-500">
                  -{formatCurrencyFull(kpi.totalPengeluaran)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
                <span className="text-muted-foreground text-xs">
                  {filteredOrders.length} pesanan
                </span>
                <span className="text-xs text-muted-foreground">
                  {filteredOrders.filter((o) => o.escrow_synced).length} sudah sync
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart - Pendapatan vs Pengeluaran */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Tren Harian
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || syncing ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Loading...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Belum ada data. Klik "Sync Penghasilan" untuk mengambil data.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Chart Legend */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                  Pendapatan
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                  Pengeluaran
                </span>
              </div>
              {/* Simple bar chart */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {chartData.map((d) => {
                  const max = Math.max(
                    ...chartData.map((c) => Math.max(c.pendapatan, c.pengeluaran)),
                    1
                  );
                  const pW = (d.pendapatan / max) * 100;
                  const eW = (d.pengeluaran / max) * 100;

                  return (
                    <div key={d.date} className="group">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20 shrink-0">
                          {format(new Date(d.date), 'dd MMM')}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div
                            className="h-4 rounded-sm bg-emerald-500/80 transition-all duration-500 flex items-center"
                            style={{ width: `${Math.max(pW, 2)}%` }}
                          >
                            <span className="text-[10px] text-white font-medium px-1.5 truncate">
                              {formatCurrency(d.pendapatan)}
                            </span>
                          </div>
                          <div
                            className="h-4 rounded-sm bg-red-500/80 transition-all duration-500 flex items-center"
                            style={{ width: `${Math.max(eW, 2)}%` }}
                          >
                            <span className="text-[10px] text-white font-medium px-1.5 truncate">
                              {formatCurrency(d.pengeluaran)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Table */}
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
          {loading || syncing ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Belum ada data pesanan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">
                      Order SN
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">
                      Tanggal
                    </th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">
                      Sub Total
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">
                      Voucher
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">
                      Biaya Kirim
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">
                      Admin & Fee
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const voucher = (order.shopee_voucher || 0) + (order.seller_voucher || 0);
                    const adminFee =
                      (order.commission_fee || 0) +
                      (order.service_fee || 0) +
                      (order.transaction_fee || 0);
                    const pendapatan = (order.original_price || 0) + voucher;
                    const net = pendapatan - (order.shipping_fee || 0) - adminFee;

                    return (
                      <tr
                        key={order.order_sn}
                        className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 px-2 font-mono text-xs">
                          {order.order_sn}
                          {!order.escrow_synced && (
                            <span className="ml-1 text-[10px] text-warning" title="Belum sync escrow">
                              ⏳
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">
                          {format(new Date(order.create_time), 'dd MMM yyyy')}
                        </td>
                        <td className="py-2.5 px-2">
                          <StatusBadge status={order.order_status} />
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs">
                          {formatCurrencyFull(order.original_price || 0)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs text-emerald-400">
                          {voucher > 0 ? `+${formatCurrencyFull(voucher)}` : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs text-red-400">
                          {order.shipping_fee ? `-${formatCurrencyFull(order.shipping_fee)}` : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs text-red-400">
                          {adminFee > 0 ? `-${formatCurrencyFull(adminFee)}` : '-'}
                        </td>
                        <td
                          className={`py-2.5 px-2 text-right text-xs font-semibold ${
                            net >= 0 ? 'text-cyan-400' : 'text-red-400'
                          }`}
                        >
                          {order.escrow_synced ? formatCurrencyFull(net) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="border-t-2 border-border bg-white/[0.02]">
                    <td colSpan={3} className="py-3 px-2 text-xs font-semibold">
                      TOTAL
                    </td>
                    <td className="py-3 px-2 text-right text-xs font-semibold">
                      {formatCurrencyFull(kpi.totalOriginalPrice)}
                    </td>
                    <td className="py-3 px-2 text-right text-xs font-semibold text-emerald-400">
                      +{formatCurrencyFull(kpi.totalShopeeVoucher + kpi.totalSellerVoucher)}
                    </td>
                    <td className="py-3 px-2 text-right text-xs font-semibold text-red-400">
                      -{formatCurrencyFull(kpi.totalShippingFee)}
                    </td>
                    <td className="py-3 px-2 text-right text-xs font-semibold text-red-400">
                      -
                      {formatCurrencyFull(
                        kpi.totalCommissionFee + kpi.totalServiceFee + kpi.totalTransactionFee
                      )}
                    </td>
                    <td
                      className={`py-3 px-2 text-right text-xs font-bold ${
                        kpi.totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'
                      }`}
                    >
                      {formatCurrencyFull(kpi.totalNet)}
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
