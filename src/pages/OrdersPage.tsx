import { useState, useCallback, useEffect, useRef } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';
import { ShoppingBag as _ShoppingBag, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DateRangePicker from '@/components/DateRangePicker';
import OrdersDataTable from '@/components/OrdersDataTable';
import { useShops } from '@/hooks/useShops';
import { useOrders } from '@/hooks/useOrders';
import type { DateRange } from '@/types';

export default function OrdersPage() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const { shops, selectedShop } = useShops();
  const { orders, fetchOrders, syncing, error } = useOrders();

  const lastSyncKey = useRef('');

  const performSync = useCallback(async () => {
    if (!selectedShop || !dateRange.from || !dateRange.to || syncing) return;

    await fetchOrders({
      shop_id: selectedShop.shopee_shop_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
    });
  }, [selectedShop, dateRange, syncing, fetchOrders]);

  // Auto-sync when shop is connected and date range changes
  useEffect(() => {
    if (!selectedShop || !dateRange.from || !dateRange.to) return;

    const days = differenceInDays(dateRange.to, dateRange.from);
    if (days > 30) return;

    const syncKey = `${selectedShop.shopee_shop_id}-${format(dateRange.from, 'yyyy-MM-dd')}-${format(dateRange.to, 'yyyy-MM-dd')}`;
    if (lastSyncKey.current === syncKey) return;

    lastSyncKey.current = syncKey;
    performSync();
  }, [selectedShop, dateRange, performSync]);

  const handleManualSync = useCallback(() => {
    lastSyncKey.current = '';
    performSync();
  }, [performSync]);

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

      {/* Orders Table */}
      <OrdersDataTable orders={orders} loading={syncing} />
    </div>
  );
}
