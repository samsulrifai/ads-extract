import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Order } from '@/types';

interface OrdersChartsProps {
  orders: Order[];
}

const COLORS = [
  'oklch(0.70 0.20 270)',  // purple
  'oklch(0.75 0.18 165)',  // teal
  'oklch(0.70 0.20 50)',   // orange
  'oklch(0.65 0.22 330)',  // pink
  'oklch(0.70 0.15 200)',  // blue
  'oklch(0.65 0.20 120)',  // green
  'oklch(0.60 0.18 30)',   // warm brown
  'oklch(0.72 0.16 250)',  // indigo
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg px-3 py-2 shadow-xl border border-border text-sm">
      <span className="text-foreground font-medium">{payload[0].name}</span>
      <span className="text-muted-foreground ml-2">{payload[0].value} pesanan</span>
    </div>
  );
};

const renderCustomLabel = ({ percent }: any) => {
  if (percent < 0.05) return null;
  return `${(percent * 100).toFixed(0)}%`;
};

export default function OrdersCharts({ orders }: OrdersChartsProps) {
  // 1. Payment method distribution
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const key = o.payment_method || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  // 2. Return/Cancel status distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const status = o.order_status?.toUpperCase() || 'UNKNOWN';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  // 3. Return/Cancel by carrier
  const carrierReturnData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders
      .filter((o) => {
        const s = o.order_status?.toUpperCase();
        return s === 'CANCELLED' || s === 'IN_CANCEL' || s === 'RETURN_REFUND' || s === 'RETURNED';
      })
      .forEach((o) => {
        const key = o.shipping_carrier || 'Unknown';
        counts[key] = (counts[key] || 0) + 1;
      });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [orders]);

  if (orders.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Payment Method */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Jenis Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paymentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                  style={{ fontSize: 11, fill: 'white' }}
                >
                  {paymentData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              Tidak ada data
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Status */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Status Pesanan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                  style={{ fontSize: 11, fill: 'white' }}
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              Tidak ada data
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return/Cancel by Carrier */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Return/Cancel per Kurir
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carrierReturnData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={carrierReturnData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                  style={{ fontSize: 11, fill: 'white' }}
                >
                  {carrierReturnData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">
              Belum ada return/cancel
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
