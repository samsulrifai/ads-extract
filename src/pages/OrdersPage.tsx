import { useCallback, useEffect, useRef } from 'react';
import { format, differenceInDays } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DateRangePicker from '@/components/DateRangePicker';
import OrdersCharts from '@/components/OrdersCharts';
import OrdersDataTable from '@/components/OrdersDataTable';
import { useShops } from '@/hooks/useShops';
import { useOrders } from '@/hooks/useOrders';
import { useFilterStore } from '@/hooks/useFilterStore';

export default function OrdersPage() {
  const { dateRange, setDateRange, shopId, setShopId } = useFilterStore();

  const { shops, selectedShop, selectShop } = useShops();

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

  const lastSyncKey = useRef('');

  const { orders, fetchOrders: loadFromDb, performSync: syncFromApi, syncing, loadingDb, error } = useOrders();

  const performSync = useCallback(async () => {
    if (!selectedShop || !dateRange.from || !dateRange.to || syncing) return;

    await loadFromDb({
      shop_id: selectedShop.shopee_shop_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });
  }, [selectedShop, dateRange, syncing, loadFromDb]);

  // Auto-load from DB when shop is connected and date range changes
  useEffect(() => {
    if (!selectedShop || !dateRange.from || !dateRange.to) return;

    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days > 30) return;

    const syncKey = `${selectedShop.shopee_shop_id}-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (lastSyncKey.current === syncKey) return;

    lastSyncKey.current = syncKey;
    performSync(); // Which now calls loadFromDb
  }, [selectedShop, dateRange, performSync]);

  const handleManualSync = useCallback(async () => {
    if (!selectedShop || !dateRange.from || !dateRange.to || syncing) return;
    
    await syncFromApi({
      shop_id: selectedShop.shopee_shop_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });
  }, [selectedShop, dateRange, syncing, syncFromApi]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lihat dan export data pesanan Shopee Anda.
        </p>
      </div>

      {/* Controls Bar */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            {/* Shop Selector */}
            {shops.length > 0 && (
              <Select
                value={selectedShop?.shopee_shop_id?.toString()}
                onValueChange={(val) => handleSelectShop(Number(val))}
              >
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

            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleManualSync}
                disabled={!selectedShop || syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  bg-primary text-primary-foreground hover:bg-primary/90
                  disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Orders'}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 px-4 py-2.5 rounded-lg text-sm bg-destructive/10 text-destructive border border-destructive/20">
              ✗ {error}
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

      {/* Pie Charts */}
      <OrdersCharts orders={orders} />

      {/* Orders Table */}
      <OrdersDataTable orders={orders} loading={syncing || loadingDb} />
    </div>
  );
}
