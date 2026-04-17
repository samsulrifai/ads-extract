import { useCallback, useEffect, useRef, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BadgeDollarSign,
  Truck,
  Receipt,
  Ticket,
  RefreshCw,
  CreditCard,
  Wallet,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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
import { useFilterStore } from '@/hooks/useFilterStore';

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
};

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
  const { dateRange, setDateRange, statusFilter, setStatusFilter, shopId, setShopId } = useFilterStore();

  const { shops, selectedShop, selectShop } = useShops();
  const { orders, loading, syncing, error, syncProgress, fetchFromDb, syncEscrow, computeDetail } = useEarnings();

  // Restore shop from stored filter
  useEffect(() => {
    if (shopId && shops.length > 0 && selectedShop?.shopee_shop_id !== shopId) {
      selectShop(shopId);
    }
  }, [shopId, shops, selectedShop, selectShop]);

  const handleSelectShop = useCallback((id: number) => {
    selectShop(id);
    setShopId(id);
  }, [selectShop, setShopId]);

  const lastLoadKey = useRef('');

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

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'released') return orders.filter((o) => o.order_status === 'COMPLETED');
    if (statusFilter === 'pending') return orders.filter((o) => o.order_status !== 'COMPLETED' && o.order_status !== 'CANCELLED' && o.order_status !== 'IN_CANCEL');
    if (statusFilter === 'all') return orders;
    return orders.filter((o) => o.order_status === statusFilter);
  }, [orders, statusFilter]);

  const d = useMemo(() => computeDetail(filteredOrders), [filteredOrders, computeDetail]);

  const chartData = useMemo(() => {
    const byDate: Record<string, { date: string; pendapatan: number; pengeluaran: number }> = {};
    filteredOrders.forEach((o) => {
      const dt = format(new Date(o.create_time), 'yyyy-MM-dd');
      if (!byDate[dt]) byDate[dt] = { date: dt, pendapatan: 0, pengeluaran: 0 };
      const detail = (o as any).escrow_detail;
      if (detail) {
        const origPrice = detail.order_original_price || detail.order_selling_price || 0;
        byDate[dt].pendapatan += origPrice;
        byDate[dt].pengeluaran += (detail.commission_fee || 0) + (detail.service_fee || 0) +
          (detail.seller_transaction_fee || 0) + (detail.actual_shipping_fee || 0);
      }
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set(orders.map((o) => o.order_status));
    return ORDER_STATUSES.filter((s) => s.value === 'all' || statuses.has(s.value));
  }, [orders]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Penghasilan</h1>
        <p className="text-sm text-muted-foreground mt-1">Ringkasan keuangan dari pesanan Shopee Anda.</p>
      </div>

      {/* Controls */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            {shops.length > 0 && (
              <Select value={selectedShop?.shopee_shop_id?.toString()} onValueChange={(val) => handleSelectShop(Number(val))}>
                <SelectTrigger className="w-full lg:w-[200px] h-10 bg-secondary/50 border-border">
                  <SelectValue placeholder="Pilih toko" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={shop.shopee_shop_id.toString()}>{shop.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            <div className="flex gap-2 ml-auto">
              <button onClick={handleSync} disabled={!selectedShop || syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-all">
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Penghasilan'}
              </button>
            </div>
          </div>
          {syncProgress && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-primary/10 text-primary border border-primary/20">⟳ {syncProgress}</div>
          )}
          {error && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-destructive/10 text-destructive border border-destructive/20">✗ {error}</div>
          )}
          {shops.length === 0 && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-warning/10 text-warning border border-warning/20">⚠ Belum ada toko. Hubungkan toko di halaman <strong>Shops</strong>.</div>
          )}
        </CardContent>
      </Card>

      {/* Tab Filter: Sudah Dilepas vs Belum Dilepas */}
      <Tabs 
        value={['all', 'released', 'pending'].includes(statusFilter) ? statusFilter : 'all'} 
        onValueChange={setStatusFilter} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 bg-secondary/50 h-11 p-1 mb-0 rounded-xl border border-border/50">
          <TabsTrigger value="all" className="rounded-lg text-xs lg:text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">
            Semua Pesanan
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg text-xs lg:text-sm data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-500 data-[state=active]:shadow-sm">
            Belum Dilepas (Proses)
          </TabsTrigger>
          <TabsTrigger value="released" className="rounded-lg text-xs lg:text-sm data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-500 data-[state=active]:shadow-sm">
            Sudah Dilepas (Selesai)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Total Pendapatan */}
        <Card className="glass-card glass-card-hover gradient-border overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-500 mb-4">{formatCurrency(d.totalPendapatan)}</p>
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><BadgeDollarSign className="h-3.5 w-3.5" />Subtotal Pesanan</span>
                <span className="font-medium">Rp {formatAmount(d.subtotalPesanan)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><Ticket className="h-3.5 w-3.5" />Voucher & Subsidi</span>
                <span className="font-medium text-red-400">-Rp {formatAmount(d.totalVoucher)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Pengeluaran */}
        <Card className="glass-card glass-card-hover gradient-border overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Pengeluaran</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500 mb-4">{formatCurrency(d.totalPengeluaran)}</p>
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><Truck className="h-3.5 w-3.5" />Biaya Pengiriman</span>
                <span className="font-medium">Rp {formatAmount(d.totalBiayaPengiriman)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><Receipt className="h-3.5 w-3.5" />Biaya Admin & Layanan</span>
                <span className="font-medium">Rp {formatAmount(d.totalBiayaAdmin)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><CreditCard className="h-3.5 w-3.5" />Biaya Transaksi</span>
                <span className="font-medium">Rp {formatAmount(d.seller_transaction_fee)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Yang Dilepas */}
        <Card className="glass-card glass-card-hover gradient-border overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-2 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Yang Dilepas</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <HandCoins className="h-5 w-5 text-cyan-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <p className={`text-3xl font-bold mb-4 ${d.totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
              {formatCurrency(d.totalNet)}
            </p>
            <div className="space-y-2.5 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />Pendapatan</span>
                <span className="font-medium text-emerald-500">+Rp {formatAmount(d.totalPendapatan)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><ArrowDownRight className="h-3.5 w-3.5 text-red-500" />Pengeluaran</span>
                <span className="font-medium text-red-500">-Rp {formatAmount(d.totalPengeluaran)}</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
                <span className="text-muted-foreground text-xs">{filteredOrders.length} pesanan</span>
                <span className="text-xs text-muted-foreground">{filteredOrders.filter((o) => o.escrow_synced).length} sudah sync</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />Tren Harian
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || syncing ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />Loading...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
              Belum ada data. Sync Orders lalu Sync Penghasilan.
            </div>
          ) : (
            <div className="h-[300px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPendapatan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.25 0.02 260)" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), 'dd MMM')} 
                    stroke="oklch(0.45 0.02 260)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                  />
                  <YAxis 
                    stroke="oklch(0.45 0.02 260)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      if (val >= 1000000) return `${(val / 1000000).toFixed(0)}M`;
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
                      return val;
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                    labelStyle={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: any) => [`Rp ${formatAmount(Number(value))}`, undefined]}
                    labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')}
                  />
                  <Area type="monotone" name="Pendapatan" dataKey="pendapatan" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPendapatan)" />
                  <Area type="monotone" name="Pengeluaran" dataKey="pengeluaran" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorPengeluaran)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ringkasan Penghasilan - Detail Breakdown */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          {filteredOrders.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-orange-500 to-orange-600">
                  <th className="text-left py-3 px-4 text-white font-semibold text-sm" colSpan={2}>Ringkasan Penghasilan</th>
                  <th className="text-right py-3 px-4 text-white font-semibold text-sm">Rp</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="1. Total Pendapatan" value={d.totalPendapatan} />
                <SubSectionHeader label="Subtotal Pesanan" value={d.subtotalPesanan} />
                <DetailRow label="Harga Asli Produk" value={d.order_original_price || d.order_selling_price} />
                <DetailRow label="Total Diskon Produk" value={-(d.seller_discount + d.shopee_discount)} />
                <DetailRow label="Jumlah Pengembalian Dana ke Pembeli" value={-(d.drc_adjustable_refund + d.seller_return_refund)} />

                <SubSectionHeader label="Voucher & Subsidi Shopee" value={-d.totalVoucher} />
                <DetailRow label="Diskon Produk dari Shopee" value={-d.shopee_discount} />
                <DetailRow label="Voucher disponsori oleh Penjual" value={-d.voucher_from_seller} />
                <DetailRow label="Voucher dari Shopee" value={-d.voucher_from_shopee} />
                <DetailRow label="Cashback Koin disponsori Penjual" value={-d.seller_coin_cash_back} />
                <DetailRow label="Koin yang Digunakan Pembeli" value={-d.coin_used} />

                <SectionHeader label="2. Total Pengeluaran" value={-d.totalPengeluaran} isExpense />
                <SubSectionHeader label="Total Biaya Pengiriman" value={-d.totalBiayaPengiriman} />
                <DetailRow label="Ongkir Dibayar Pembeli" value={d.buyer_paid_shipping_fee} />
                <DetailRow label="Gratis Ongkir dari Shopee" value={d.shopee_shipping_rebate} />
                <DetailRow label="Diskon Ongkir Ditanggung Jasa Kirim" value={d.shipping_fee_discount_from_3pl} />
                <DetailRow label="Ongkir Diteruskan oleh Shopee ke Jasa Kirim" value={-d.actual_shipping_fee} />
                <DetailRow label="Ongkos Kirim Pengembalian Barang" value={-d.reverse_shipping_fee} />

                <SubSectionHeader label="Biaya Admin & Layanan" value={-d.totalBiayaAdmin} />
                <DetailRow label="Biaya Komisi" value={-d.commission_fee} />
                <DetailRow label="Biaya Layanan" value={-d.service_fee} />
                <DetailRow label="Biaya Transaksi" value={-d.seller_transaction_fee} />
                <DetailRow label="Biaya Proses Pesanan" value={-d.seller_order_processing_fee} />
                <DetailRow label="Biaya Kampanye" value={-d.campaign_fee} />
                <DetailRow label="Biaya Administrasi (PPN)" value={-d.escrow_tax} />
                <DetailRow label="Biaya FBS" value={-d.fbs_fee} />
                <DetailRow label="Biaya Isi Saldo Otomatis" value={-d.ads_fee} />

                <tr className="bg-gradient-to-r from-cyan-500/10 to-transparent border-t-2 border-cyan-500/30">
                  <td colSpan={2} className="py-3.5 px-4"><span className="text-sm font-bold text-cyan-400">3. Total yang Dilepas</span></td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`text-base font-bold ${d.totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{formatAmount(d.totalNet)}</span>
                  </td>
                </tr>
                <tr className="border-t border-border/30">
                  <td colSpan={3} className="py-3 px-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{filteredOrders.length} pesanan</span>
                      <span>{filteredOrders.filter((o) => o.escrow_synced).length} / {filteredOrders.length} sudah sync escrow</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Per-Order Detail Table */}
      {filteredOrders.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />Detail Per Pesanan
              </CardTitle>
              <span className="text-xs text-muted-foreground">{filteredOrders.length} pesanan</span>
            </div>
          </CardHeader>
          <CardContent>
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
                    const det = (order as any).escrow_detail;
                    const pendapatan = det ? (det.order_original_price || det.order_selling_price || 0) : 0;
                    const pengeluaran = det ? ((det.commission_fee || 0) + (det.service_fee || 0) + (det.seller_transaction_fee || 0) + (det.actual_shipping_fee || 0)) : 0;
                    const net = det ? (det.escrow_amount || (pendapatan - pengeluaran)) : 0;

                    return (
                      <tr key={order.order_sn} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-2 font-mono text-xs">
                          {order.order_sn}
                          {!order.escrow_synced && <span className="ml-1 text-[10px] text-warning" title="Belum sync">⏳</span>}
                        </td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">{format(new Date(order.create_time), 'dd MMM yyyy')}</td>
                        <td className="py-2.5 px-2"><StatusBadge status={order.order_status} /></td>
                        <td className="py-2.5 px-2 text-right text-xs text-emerald-400">{order.escrow_synced ? formatAmount(pendapatan) : '-'}</td>
                        <td className="py-2.5 px-2 text-right text-xs text-red-400">{order.escrow_synced ? `-${formatAmount(pengeluaran)}` : '-'}</td>
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
                    <td className="py-3 px-2 text-right text-xs font-bold text-emerald-400">{formatAmount(d.totalPendapatan)}</td>
                    <td className="py-3 px-2 text-right text-xs font-bold text-red-400">-{formatAmount(d.totalPengeluaran)}</td>
                    <td className={`py-3 px-2 text-right text-xs font-bold ${d.totalNet >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{formatAmount(d.totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ===== Ringkasan Row Components ===== */
function SectionHeader({ label, value, isExpense }: { label: string; value: number; isExpense?: boolean }) {
  return (
    <tr className={`border-t-2 ${isExpense ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
      <td colSpan={2} className="py-3 px-4">
        <span className={`text-sm font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>{label}</span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`text-sm font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>{formatAmount(value)}</span>
      </td>
    </tr>
  );
}

function SubSectionHeader({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-border/30 bg-white/[0.02]">
      <td colSpan={2} className="py-2.5 px-4 pl-6"><span className="text-sm font-semibold text-foreground/80">{label}</span></td>
      <td className="py-2.5 px-4 text-right"><span className="text-sm font-semibold text-foreground/80">{formatAmount(value)}</span></td>
    </tr>
  );
}

function DetailRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-t border-border/20 hover:bg-white/[0.01] transition-colors">
      <td colSpan={2} className="py-2 px-4 pl-10"><span className="text-sm text-muted-foreground">{label}</span></td>
      <td className="py-2 px-4 text-right"><span className="text-sm text-muted-foreground">{formatAmount(value)}</span></td>
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
