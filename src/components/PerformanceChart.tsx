import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ChartDataPoint {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  gmv: number;
}

interface PerformanceChartProps {
  data: ChartDataPoint[];
  loading: boolean;
}

type MetricKey = 'spend' | 'gmv' | 'impressions' | 'clicks' | 'orders';

const metricConfig: Record<MetricKey, { label: string; color: string; format: (v: number) => string }> = {
  spend: {
    label: 'Spend',
    color: 'oklch(0.65 0.25 270)',
    format: (v) => `Rp ${(v / 1000).toFixed(0)}K`,
  },
  gmv: {
    label: 'GMV',
    color: 'oklch(0.75 0.18 165)',
    format: (v) => `Rp ${(v / 1000).toFixed(0)}K`,
  },
  impressions: {
    label: 'Impressions',
    color: 'oklch(0.70 0.20 50)',
    format: (v) => v.toLocaleString('id-ID'),
  },
  clicks: {
    label: 'Clicks',
    color: 'oklch(0.65 0.22 330)',
    format: (v) => v.toLocaleString('id-ID'),
  },
  orders: {
    label: 'Orders',
    color: 'oklch(0.70 0.15 200)',
    format: (v) => v.toLocaleString('id-ID'),
  },
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload || !label) return null;

  return (
    <div className="glass-card rounded-lg px-4 py-3 shadow-xl border border-border">
      <p className="text-xs text-muted-foreground mb-2 font-medium">
        {format(parseISO(label), 'dd MMM yyyy')}
      </p>
      {payload.map((entry, i) => {
        const key = entry.dataKey as MetricKey;
        const config = metricConfig[key];
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{config?.label || key}:</span>
            <span className="font-semibold text-foreground">
              {config?.format(entry.value) || entry.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function PerformanceChart({ data, loading }: PerformanceChartProps) {
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(['spend', 'gmv']);

  if (loading) {
    return (
      <div className="h-[320px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading chart...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No chart data available</p>
      </div>
    );
  }


  return (
    <div>
      <Tabs defaultValue="spend" className="mb-4">
        <TabsList className="bg-secondary/50 h-8">
          {(Object.keys(metricConfig) as MetricKey[]).map((key) => (
            <TabsTrigger
              key={key}
              value={key}
              className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary h-6 px-3"
              onClick={() => {
                setActiveMetrics([key]);
              }}
            >
              {metricConfig[key].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <defs>
            {(Object.keys(metricConfig) as MetricKey[]).map((key) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={metricConfig[key].color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={metricConfig[key].color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(0.25 0.02 260)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
            stroke="oklch(0.45 0.02 260)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="oklch(0.45 0.02 260)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => {
              if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
              if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
              return v;
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {activeMetrics.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={metricConfig[key].color}
              fill={`url(#gradient-${key})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
