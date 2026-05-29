import { useCallback, useEffect, useRef, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  HandCoins,
  ShoppingCart,
  Truck,
  Receipt,
  CreditCard,
  Megaphone,
  DollarSign,
  Wallet,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
  MousePointerClick,
  Target,
  AlertTriangle,
  Clock,
  Link2Off,
  Package,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,

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
import { useAdsData } from '@/hooks/useAdsData';
import { useOrders } from '@/hooks/useOrders';
import { useFilterStore } from '@/hooks/useFilterStore';

/* ===== Formatters ===== */
const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}B`;
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

const formatNumber = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('id-ID');
};

/* ===== Platform Colors & Config ===== */
const PLATFORMS = {
  shopee: { name: 'Shopee', color: '#f97316', emoji: '🟠', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  meta:   { name: 'Meta Ads', color: '#3b82f6', emoji: '🔵', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  lazada: { name: 'Lazada', color: '#8b5cf6', emoji: '🟣', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  tiktok: { name: 'TikTok Shop', color: '#171717', emoji: '⬛', bg: 'bg-neutral-500/10', text: 'text-neutral-300', border: 'border-neutral-500/20' },
} as const;

const EXPENSE_COLORS = ['#f97316', '#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b', '#64748b', '#ef4444'];

const PLATFORM_CHART_COLORS = [PLATFORMS.shopee.color, PLATFORMS.meta.color, PLATFORMS.lazada.color, '#e5e5e5'];

export default function DashboardPage() {
  const { dateRange, setDateRange, shopId, setShopId } = useFilterStore();
  const { shops, selectedShop, selectShop } = useShops();
  const { orders: earningsOrders, loading: earningsLoading, fetchFromDb, computeDetail } = useEarnings();
  const { kpi: adsKpi, fetchAdsFromDb, loadingDb: adsLoading } = useAdsData();
  const { orders: allOrders, fetchOrders, loadingDb: ordersLoading } = useOrders();

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

  // Auto-load data when shop/date changes
  useEffect(() => {
    if (!selectedShop || !dateRange.from || !dateRange.to) return;
    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days > 60) return;
    const loadKey = `dashboard-${selectedShop.shopee_shop_id}-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (lastLoadKey.current === loadKey) return;
    lastLoadKey.current = loadKey;

    const params = {
      shop_id: selectedShop.shopee_shop_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
    };
    fetchFromDb(params);
    fetchAdsFromDb(params);
    fetchOrders(params);
  }, [selectedShop, dateRange, fetchFromDb, fetchAdsFromDb, fetchOrders]);

  const d = useMemo(() => computeDetail(earningsOrders), [earningsOrders, computeDetail]);

  // ===== Section 1: Cross-platform KPIs =====
  const totalRevenue = d.totalPendapatan;
  const totalAdSpend = adsKpi.totalSpend;
  const totalOrders = allOrders.length;
  const overallROAS = totalAdSpend > 0 ? adsKpi.totalGMV / totalAdSpend : 0;
  const totalNetProfit = d.totalNet;
  const totalImpressions = adsKpi.totalImpressions;
  const totalClicks = adsKpi.totalClicks;

  // ===== Section 3: Revenue vs Ad Spend chart data =====
  const revenueVsAdSpendChart = useMemo(() => {
    const byDate: Record<string, { date: string; shopee_revenue: number; shopee_adspend: number }> = {};

    earningsOrders.forEach((o) => {
      const dt = format(new Date(o.create_time), 'yyyy-MM-dd');
      if (!byDate[dt]) byDate[dt] = { date: dt, shopee_revenue: 0, shopee_adspend: 0 };
      const detail = (o as any).escrow_detail;
      if (detail) {
        byDate[dt].shopee_revenue += detail.order_original_price || detail.order_selling_price || 0;
      }
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [earningsOrders]);

  // ===== Section 4: Platform Revenue Distribution =====
  const platformRevenue = useMemo(() => {
    const items = [
      { name: 'Shopee', value: d.totalPendapatan, color: PLATFORMS.shopee.color },
      { name: 'Meta Ads', value: 0, color: PLATFORMS.meta.color },
      { name: 'Lazada', value: 0, color: PLATFORMS.lazada.color },
      { name: 'TikTok', value: 0, color: PLATFORMS.tiktok.color },
    ].filter(item => item.value > 0);
    return items;
  }, [d.totalPendapatan]);

  // ===== Section 5: Top Products/SKU =====
  const topProducts = useMemo(() => {
    const map = new Map<string, { productName: string; sku: string; totalOrders: number; totalRevenue: number }>();
    allOrders.forEach((order) => {
      const sku = order.sku || '(Tanpa SKU)';
      const existing = map.get(sku) || { productName: order.product_name, sku, totalOrders: 0, totalRevenue: 0 };
      existing.totalOrders += 1;
      existing.totalRevenue += order.total_amount || 0;
      if (!existing.productName) existing.productName = order.product_name;
      map.set(sku, existing);
    });
    return [...map.values()]
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10);
  }, [allOrders]);

  // ===== Section 6: Alerts =====
  const alerts = useMemo(() => {
    const items: { type: 'warning' | 'error' | 'success' | 'info'; message: string; icon: typeof AlertTriangle }[] = [];

    if (shops.length === 0) {
      items.push({ type: 'warning', message: 'Belum ada toko terhubung. Hubungkan di halaman Shops.', icon: Link2Off });
    }

    // Sync status
    const synced = earningsOrders.filter(o => o.escrow_synced).length;
    const unsynced = earningsOrders.length - synced;
    if (unsynced > 0) {
      items.push({ type: 'info', message: `${unsynced} orders belum sync escrow. Buka halaman Earnings untuk sync.`, icon: Clock });
    }

    // Return orders
    const returOrders = allOrders.filter(o => ['CANCELLED', 'IN_CANCEL'].includes(o.order_status));
    if (returOrders.length > 0) {
      items.push({ type: 'warning', message: `${returOrders.length} orders dibatalkan / retur dalam periode ini.`, icon: AlertTriangle });
    }

    return items;
  }, [shops, earningsOrders, allOrders]);

  // ===== Expense breakdown for donut chart =====
  const expenseBreakdown = useMemo(() => {
    return [
      { name: 'Shipping', value: Math.abs(d.totalBiayaPengiriman) },
      { name: 'Commission', value: d.commission_fee },
      { name: 'Service Fee', value: d.service_fee },
      { name: 'Transaction', value: d.seller_transaction_fee },
      { name: 'Campaign', value: d.campaign_fee },
      { name: 'Others', value: d.seller_order_processing_fee + d.escrow_tax + d.fbs_fee },
      { name: 'Ads Top-up', value: d.ads_fee },
    ].filter(item => item.value > 0);
  }, [d]);

  const isLoading = earningsLoading || adsLoading || ordersLoading;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview performa bisnis dari semua platform.
        </p>
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
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading data...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== SECTION 6: Alerts & Activity ===== */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => {
            const Icon = alert.icon;
            const colorMap = {
              error: 'bg-red-500/10 text-red-400 border-red-500/20',
              warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            };
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm animate-slide-up ${colorMap[alert.type]}`} style={{ animationDelay: `${i * 50}ms` }}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{alert.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== SECTION 1: Overview KPI Cards (Cross-Platform) ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPICard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={<TrendingUp className="h-5 w-5" />} iconColor="text-emerald-500" iconBg="bg-emerald-500/10" valueColor="text-emerald-400" delay={0} />
        <KPICard title="Total Orders" value={formatNumber(totalOrders)} icon={<ShoppingCart className="h-5 w-5" />} iconColor="text-violet-500" iconBg="bg-violet-500/10" delay={50} />
        <KPICard title="Ad Spend" value={formatCurrency(totalAdSpend)} icon={<Megaphone className="h-5 w-5" />} iconColor="text-orange-500" iconBg="bg-orange-500/10" valueColor="text-orange-400" delay={100} />
        <KPICard title="ROAS" value={overallROAS > 0 ? `${overallROAS.toFixed(2)}x` : '-'} icon={<Target className="h-5 w-5" />} iconColor="text-cyan-500" iconBg="bg-cyan-500/10" valueColor={overallROAS >= 3 ? 'text-emerald-400' : overallROAS >= 1 ? 'text-amber-400' : 'text-red-400'} delay={150} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPICard title="Total Expenses" value={formatCurrency(d.totalPengeluaran)} icon={<TrendingDown className="h-5 w-5" />} iconColor="text-red-500" iconBg="bg-red-500/10" valueColor="text-red-400" delay={200} />
        <KPICard title="Net Profit" value={formatCurrency(totalNetProfit)} icon={<HandCoins className="h-5 w-5" />} iconColor="text-cyan-500" iconBg="bg-cyan-500/10" valueColor={totalNetProfit >= 0 ? 'text-cyan-400' : 'text-red-400'} delay={250} />
        <KPICard title="Impressions" value={formatNumber(totalImpressions)} icon={<Eye className="h-5 w-5" />} iconColor="text-blue-500" iconBg="bg-blue-500/10" delay={300} />
        <KPICard title="Clicks" value={formatNumber(totalClicks)} icon={<MousePointerClick className="h-5 w-5" />} iconColor="text-pink-500" iconBg="bg-pink-500/10" delay={350} />
      </div>

      {/* ===== SECTION 2: Platform Breakdown Cards ===== */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Platform Performance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Shopee - Active */}
          <PlatformCard
            platform={PLATFORMS.shopee}
            revenue={d.totalPendapatan}
            adSpend={adsKpi.totalSpend}
            roas={adsKpi.roas}
            orders={allOrders.length}
            active
          />
          {/* Meta - Coming Soon */}
          <PlatformCard platform={PLATFORMS.meta} revenue={0} adSpend={0} roas={0} orders={0} />
          {/* Lazada - Coming Soon */}
          <PlatformCard platform={PLATFORMS.lazada} revenue={0} adSpend={0} roas={0} orders={0} />
          {/* TikTok - Coming Soon */}
          <PlatformCard platform={PLATFORMS.tiktok} revenue={0} adSpend={0} roas={0} orders={0} />
        </div>
      </div>

      {/* ===== SECTION 3 & 4: Charts Row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Ad Spend Chart */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Daily Trend: Revenue vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading...
              </div>
            ) : revenueVsAdSpendChart.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                Belum ada data. Sync terlebih dahulu.
              </div>
            ) : (
              <div className="h-[280px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueVsAdSpendChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(0.25 0.02 260)" />
                    <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'dd MMM')} stroke="oklch(0.45 0.02 260)" fontSize={11} tickLine={false} axisLine={false} minTickGap={20} />
                    <YAxis stroke="oklch(0.45 0.02 260)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => { if (val >= 1000000) return `${(val / 1000000).toFixed(0)}M`; if (val >= 1000) return `${(val / 1000).toFixed(0)}K`; return val; }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                      labelStyle={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}
                      formatter={(value: any) => [`Rp ${formatAmount(Number(value))}`, undefined]}
                      labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy')}
                    />
                    <Area type="monotone" name="Shopee Revenue" dataKey="shopee_revenue" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#dashRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Revenue Distribution - Donut Chart */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" /> Revenue Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformRevenue.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-sm text-muted-foreground">
                <PieChartIcon className="h-12 w-12 mb-3 opacity-20" />
                Belum ada data.
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformRevenue}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {platformRevenue.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || PLATFORM_CHART_COLORS[index]} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: any) => [`Rp ${formatAmount(Number(value))}`, undefined]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Expense Breakdown Row ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut: Rincian Biaya */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-red-400" /> Expense Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No expense data available.
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseBreakdown} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                      {expenseBreakdown.map((_entry, index) => (
                        <Cell key={`expense-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }} formatter={(value: any) => [`Rp ${formatAmount(Number(value))}`, undefined]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Pengeluaran Table */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-red-400" /> Expense Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              <ExpenseRow icon={<Truck className="h-4 w-4" />} label="Shipping Fee" value={d.totalBiayaPengiriman} color="text-orange-400" />
              <ExpenseRow icon={<Receipt className="h-4 w-4" />} label="Commission Fee" value={d.commission_fee} color="text-violet-400" />
              <ExpenseRow icon={<CreditCard className="h-4 w-4" />} label="Service Fee" value={d.service_fee} color="text-cyan-400" />
              <ExpenseRow icon={<DollarSign className="h-4 w-4" />} label="Transaction Fee" value={d.seller_transaction_fee} color="text-pink-400" />
              <ExpenseRow icon={<Megaphone className="h-4 w-4" />} label="Campaign Fee" value={d.campaign_fee} color="text-amber-400" />
              <ExpenseRow icon={<Wallet className="h-4 w-4" />} label="Order Processing" value={d.seller_order_processing_fee} color="text-slate-400" />
              <ExpenseRow icon={<Receipt className="h-4 w-4" />} label="PPN / Tax" value={d.escrow_tax} color="text-slate-400" />
              <ExpenseRow icon={<Package className="h-4 w-4" />} label="FBS Fee" value={d.fbs_fee} color="text-slate-400" />
              <ExpenseRow icon={<Megaphone className="h-4 w-4" />} label="Ads Top-up" value={d.ads_fee} color="text-red-400" />
              {/* Total */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
                <span className="text-sm font-bold text-red-400">Total Expenses</span>
                <span className="text-sm font-bold text-red-400">Rp {formatAmount(d.totalPengeluaran)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== SECTION 5: Top Performing Products ===== */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Top Products
            </CardTitle>
            <span className="text-xs text-muted-foreground">Top 10</span>
          </div>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No order data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Product</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">SKU</th>
                    <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Platform</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">Orders</th>
                    <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, i) => (
                    <tr key={product.sku} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 px-2 text-sm max-w-[200px] truncate" title={product.productName}>
                        {product.productName || '-'}
                      </td>
                      <td className="py-2.5 px-2 text-xs font-mono text-muted-foreground">{product.sku}</td>
                      <td className="py-2.5 px-2">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/10 text-orange-400">
                          🟠 Shopee
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-sm font-semibold">{product.totalOrders}</td>
                      <td className="py-2.5 px-2 text-right text-sm font-semibold text-emerald-400">{formatCurrency(product.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ===== Sub-Components ===== */

function KPICard({ title, value, icon, iconColor, iconBg, valueColor, delay = 0 }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
  delay?: number;
}) {
  return (
    <Card className="glass-card glass-card-hover gradient-border overflow-hidden animate-slide-up" style={{ animationDelay: `${delay}ms` }}>
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className={`text-2xl lg:text-3xl font-bold tracking-tight ${valueColor || ''}`}>{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlatformCard({ platform, revenue, adSpend, roas, orders, active }: {
  platform: typeof PLATFORMS[keyof typeof PLATFORMS];
  revenue: number;
  adSpend: number;
  roas: number;
  orders: number;
  active?: boolean;
}) {
  return (
    <Card className={`glass-card overflow-hidden transition-all duration-300 ${active ? 'glass-card-hover gradient-border' : 'opacity-50'}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{platform.emoji}</span>
          <span className={`text-sm font-semibold ${platform.text}`}>{platform.name}</span>
          {!active && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Coming Soon</span>
          )}
          {active && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Active</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
            <p className="text-sm font-bold">{active ? formatCurrency(revenue) : '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ad Spend</p>
            <p className="text-sm font-bold">{active ? formatCurrency(adSpend) : '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ROAS</p>
            <p className={`text-sm font-bold ${active ? (roas >= 3 ? 'text-emerald-400' : roas >= 1 ? 'text-amber-400' : 'text-red-400') : ''}`}>{active && roas > 0 ? `${roas.toFixed(2)}x` : '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Orders</p>
            <p className="text-sm font-bold">{active ? orders.toLocaleString('id-ID') : '-'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpenseRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  if (value === 0) return null;
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3">
        <div className={color}>{icon}</div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium">Rp {formatAmount(Math.abs(value))}</span>
    </div>
  );
}
