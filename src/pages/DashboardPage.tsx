import { useState, useCallback, useEffect, useRef } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';
import {
  Eye,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Target,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DateRangePicker from '@/components/DateRangePicker';
import SyncButton from '@/components/SyncButton';
import AdsDataTable from '@/components/AdsDataTable';
import PerformanceChart from '@/components/PerformanceChart';
import KPICard from '@/components/KPICard';
import { useShops } from '@/hooks/useShops';
import { useAdsData } from '@/hooks/useAdsData';
import { useSyncAds } from '@/hooks/useSyncAds';
import type { DateRange } from '@/types';

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
  return `Rp ${value.toFixed(0)}`;
};

const formatNumber = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('id-ID');
};

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [adsTypeFilter, setAdsTypeFilter] = useState('all');
  const [showLongRangeWarning, setShowLongRangeWarning] = useState(false);

  const { shops, selectedShop } = useShops();
  const { data, chartData, kpi, loading: dataLoading, setAdsData } = useAdsData();
  const { syncAds, syncing, result, error: syncError } = useSyncAds();

  // Guard to prevent duplicate auto-sync calls
  const lastSyncKey = useRef('');

  const performSync = useCallback(async () => {
    if (!selectedShop || !dateRange.from || !dateRange.to || syncing) return;

    const result = await syncAds({
      shop_id: selectedShop.shopee_shop_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });

    if (result.success && result.records) {
      setAdsData(result.records);
    }
  }, [selectedShop, dateRange, syncing, syncAds, setAdsData]);

  // Auto-sync when shop is connected and date range changes
  useEffect(() => {
    if (!selectedShop || !dateRange.from || !dateRange.to) return;

    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days > 30) return; // Skip auto-sync for long ranges

    // Create a unique key for this sync request to avoid duplicates
    const syncKey = `${selectedShop.shopee_shop_id}-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (lastSyncKey.current === syncKey) return;

    lastSyncKey.current = syncKey;
    performSync();
  }, [selectedShop, dateRange, performSync]);

  const handleSync = useCallback(() => {
    if (!selectedShop || !dateRange.from || !dateRange.to) return;

    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days > 30) {
      setShowLongRangeWarning(true);
      return;
    }

    // Reset guard so manual sync always works
    lastSyncKey.current = '';
    performSync();
  }, [selectedShop, dateRange, performSync]);

  const canSync = selectedShop && dateRange.from && dateRange.to;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your Shopee ads performance and extract data.
        </p>
      </div>

      {/* Controls Bar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            {/* Shop Selector */}
            {shops.length > 0 && (
              <Select defaultValue={selectedShop?.shopee_shop_id?.toString()}>
                <SelectTrigger className="w-full lg:w-[200px] h-10 bg-secondary/50 border-border">
                  <SelectValue placeholder="Select shop" />
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

            {/* Date Range */}
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {/* Ads Type Filter */}
            <Select value={adsTypeFilter} onValueChange={setAdsTypeFilter}>
              <SelectTrigger className="w-full lg:w-[140px] h-10 bg-secondary/50 border-border">
                <SelectValue placeholder="Ads Type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="search">Search</SelectItem>
                <SelectItem value="discovery">Discovery</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2 ml-auto">
              <SyncButton
                onClick={handleSync}
                loading={syncing}
                disabled={!canSync}
              />
            </div>
          </div>

          {/* Sync Status */}
          {(result || syncError) && (
            <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm ${
              result?.success
                ? 'bg-success/10 text-success border border-success/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {result?.success
                ? `✓ Successfully synced ${result.records_synced} records`
                : `✗ ${syncError || 'Sync failed'}`}
            </div>
          )}

          {/* No shop warning */}
          {shops.length === 0 && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-warning/10 text-warning border border-warning/20">
              ⚠ No shops connected. Go to the <strong>Shops</strong> page to connect your Shopee store.
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPICard
          title="Total Spend"
          value={formatCurrency(kpi.totalSpend)}
          icon={<DollarSign className="h-5 w-5" />}
          delay={0}
        />
        <KPICard
          title="Total GMV"
          value={formatCurrency(kpi.totalGMV)}
          subtitle={`ROAS: ${kpi.roas.toFixed(2)}x`}
          icon={<TrendingUp className="h-5 w-5" />}
          delay={50}
        />
        <KPICard
          title="Impressions"
          value={formatNumber(kpi.totalImpressions)}
          subtitle={`CTR: ${kpi.ctr.toFixed(2)}%`}
          icon={<Eye className="h-5 w-5" />}
          delay={100}
        />
        <KPICard
          title="Orders"
          value={formatNumber(kpi.totalOrders)}
          subtitle={`CPC: ${formatCurrency(kpi.cpc)}`}
          icon={<ShoppingCart className="h-5 w-5" />}
          delay={150}
        />
      </div>

      {/* Chart */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceChart data={chartData} loading={dataLoading} />
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Daily Breakdown
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {data.length} records
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <AdsDataTable data={data} loading={dataLoading} />
        </CardContent>
      </Card>


      {/* Long Range Warning Dialog */}
      <AlertDialog open={showLongRangeWarning} onOpenChange={setShowLongRangeWarning}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              Long Date Range Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              You've selected more than 30 days. This may take a long time and could
              hit Shopee's API rate limit. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground"
              onClick={performSync}
            >
              Proceed Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
