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

// Distinct, high-contrast colors
const COLORS = [
  '#6366f1', // indigo
  '#22d3ee', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#10b981', // emerald
  '#a1a1aa', // gray for "Lainnya"
];

/** Take top 5 entries, group rest as "Lainnya" */
function topFiveWithOther(data: { name: string; value: number }[]) {
  if (data.length <= 5) return data;
  const top5 = data.slice(0, 5);
  const otherValue = data.slice(5).reduce((sum, d) => sum + d.value, 0);
  if (otherValue > 0) {
    top5.push({ name: 'Lainnya', value: otherValue });
  }
  return top5;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg px-3 py-2 shadow-xl border border-border text-sm">
      <span className="text-foreground font-medium">{payload[0].name}</span>
      <span className="text-muted-foreground ml-2">{payload[0].value} pesanan</span>
    </div>
  );
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function OrdersCharts({ orders }: OrdersChartsProps) {
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const key = o.payment_method || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return topFiveWithOther(sorted);
  }, [orders]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const status = o.order_status?.toUpperCase() || 'UNKNOWN';
      counts[status] = (counts[status] || 0) + 1;
    });
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return topFiveWithOther(sorted);
  }, [orders]);

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
    const sorted = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return topFiveWithOther(sorted);
  }, [orders]);

  if (orders.length === 0) return null;

  const renderPie = (data: { name: string; value: number }[], emptyMsg: string) => {
    if (data.length === 0) {
      return (
        <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
          {emptyMsg}
        </div>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
            layout="horizontal"
            align="center"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="glass-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Jenis Pembayaran
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {renderPie(paymentData, 'Tidak ada data')}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Status Pesanan
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {renderPie(statusData, 'Tidak ada data')}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Return/Cancel per Kurir
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {renderPie(carrierReturnData, 'Belum ada return/cancel')}
        </CardContent>
      </Card>
    </div>
  );
}
