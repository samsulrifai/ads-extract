import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUpDown, AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import type { Order } from '@/types';

interface ReturPerSKUProps {
  orders: Order[];
}

interface SKUStats {
  sku: string;
  productName: string;
  totalOrders: number;
  returOrders: number;
  returPercentage: number;
}

const RETURN_STATUSES = ['CANCELLED', 'IN_CANCEL', 'RETURN_REFUND', 'RETURNED'];

// Gradient color scale: low retur = green, high retur = red
function getReturColor(percentage: number): string {
  if (percentage >= 30) return '#ef4444'; // red-500
  if (percentage >= 20) return '#f97316'; // orange-500
  if (percentage >= 10) return '#eab308'; // yellow-500
  if (percentage >= 5) return '#22d3ee';  // cyan-400
  return '#10b981'; // emerald-500
}

function getReturBadge(percentage: number) {
  if (percentage >= 20) {
    return (
      <Badge variant="outline" className="border-0 bg-red-500/10 text-red-400 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Tinggi
      </Badge>
    );
  }
  if (percentage >= 10) {
    return (
      <Badge variant="outline" className="border-0 bg-orange-500/10 text-orange-400 gap-1">
        <TrendingDown className="h-3 w-3" />
        Sedang
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-0 bg-emerald-500/10 text-emerald-400 gap-1">
      <CheckCircle2 className="h-3 w-3" />
      Rendah
    </Badge>
  );
}

type SortField = 'returPercentage' | 'totalOrders' | 'returOrders' | 'sku';
type SortDir = 'asc' | 'desc';

const CustomBarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as SKUStats;
  return (
    <div className="glass-card rounded-lg px-4 py-3 shadow-xl border border-border text-sm space-y-1">
      <div className="font-semibold text-foreground">{d.sku}</div>
      <div className="text-muted-foreground text-xs truncate max-w-[200px]">{d.productName}</div>
      <div className="flex items-center gap-3 mt-1">
        <span className="text-muted-foreground">Total: <span className="text-foreground font-medium">{d.totalOrders}</span></span>
        <span className="text-muted-foreground">Retur: <span className="text-red-400 font-medium">{d.returOrders}</span></span>
        <span className="text-muted-foreground">%: <span className="text-foreground font-bold">{d.returPercentage.toFixed(1)}%</span></span>
      </div>
    </div>
  );
};

export default function ReturPerSKU({ orders }: ReturPerSKUProps) {
  const [sortField, setSortField] = useState<SortField>('returPercentage');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [chartLimit, setChartLimit] = useState<number>(10);

  const skuStats = useMemo(() => {
    const map = new Map<string, { productName: string; total: number; retur: number }>();

    orders.forEach((order) => {
      const sku = order.sku || '(Tanpa SKU)';
      const existing = map.get(sku) || { productName: order.product_name, total: 0, retur: 0 };
      existing.total += 1;
      if (RETURN_STATUSES.includes(order.order_status?.toUpperCase())) {
        existing.retur += 1;
      }
      // Keep the product name from the latest occurrence
      if (!existing.productName) existing.productName = order.product_name;
      map.set(sku, existing);
    });

    const stats: SKUStats[] = [];
    map.forEach((val, sku) => {
      stats.push({
        sku,
        productName: val.productName,
        totalOrders: val.total,
        returOrders: val.retur,
        returPercentage: val.total > 0 ? (val.retur / val.total) * 100 : 0,
      });
    });

    return stats;
  }, [orders]);

  const sortedStats = useMemo(() => {
    return [...skuStats].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'sku') {
        cmp = a.sku.localeCompare(b.sku);
      } else {
        cmp = a[sortField] - b[sortField];
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [skuStats, sortField, sortDir]);

  // Chart: top N by retur percentage (only those with returOrders > 0)
  const chartData = useMemo(() => {
    return [...skuStats]
      .filter((s) => s.returOrders > 0)
      .sort((a, b) => b.returPercentage - a.returPercentage)
      .slice(0, chartLimit);
  }, [skuStats, chartLimit]);

  // Summary KPIs
  const summary = useMemo(() => {
    const totalOrders = orders.length;
    const totalRetur = orders.filter((o) =>
      RETURN_STATUSES.includes(o.order_status?.toUpperCase())
    ).length;
    const overallPercentage = totalOrders > 0 ? (totalRetur / totalOrders) * 100 : 0;
    const skuWithRetur = skuStats.filter((s) => s.returOrders > 0).length;
    return { totalOrders, totalRetur, overallPercentage, skuWithRetur, totalSKU: skuStats.length };
  }, [orders, skuStats]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (orders.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total SKU</p>
            <p className="text-2xl font-bold mt-1">{summary.totalSKU}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">SKU Ada Retur</p>
            <p className="text-2xl font-bold mt-1 text-orange-400">{summary.skuWithRetur}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Retur</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{summary.totalRetur}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">% Retur Keseluruhan</p>
            <p className="text-2xl font-bold mt-1" style={{ color: getReturColor(summary.overallPercentage) }}>
              {summary.overallPercentage.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Top SKU dengan Retur Tertinggi
            </CardTitle>
            <Select value={String(chartLimit)} onValueChange={(v) => setChartLimit(Number(v))}>
              <SelectTrigger className="w-[90px] h-8 bg-secondary/50 border-border text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="5">Top 5</SelectItem>
                <SelectItem value="10">Top 10</SelectItem>
                <SelectItem value="20">Top 20</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36 + 40)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  type="number"
                  domain={[0, (max: number) => Math.min(100, Math.ceil(max * 1.1))]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <YAxis
                  type="category"
                  dataKey="sku"
                  width={120}
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="returPercentage" radius={[0, 4, 4, 0]} maxBarSize={24}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={getReturColor(entry.returPercentage)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Detail Retur per SKU
            <Badge variant="secondary" className="ml-2">
              {skuStats.length} SKU
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-muted-foreground">
                  <tr>
                    <th
                      className="px-4 py-3 font-medium cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort('sku')}
                    >
                      <span className="inline-flex items-center gap-1">
                        SKU
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="px-4 py-3 font-medium">Nama Produk</th>
                    <th
                      className="px-4 py-3 font-medium text-right cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort('totalOrders')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Total Order
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 font-medium text-right cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort('returOrders')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        Retur
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 font-medium text-right cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => toggleSort('returPercentage')}
                    >
                      <span className="inline-flex items-center gap-1 justify-end">
                        % Retur
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="px-4 py-3 font-medium text-center">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sortedStats.length > 0 ? (
                    sortedStats.map((stat) => (
                      <tr key={stat.sku} className="hover:bg-white/5 group transition-colors">
                        <td className="px-4 py-3 font-medium">{stat.sku}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={stat.productName}>
                          {stat.productName}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{stat.totalOrders}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-400">
                          {stat.returOrders}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-bold" style={{ color: getReturColor(stat.returPercentage) }}>
                            {stat.returPercentage.toFixed(1)}%
                          </span>
                          {/* Mini progress bar */}
                          <div className="mt-1 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, stat.returPercentage)}%`,
                                backgroundColor: getReturColor(stat.returPercentage),
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getReturBadge(stat.returPercentage)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Belum ada data pesanan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
