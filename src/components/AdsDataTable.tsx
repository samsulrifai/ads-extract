import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdsPerformance } from '@/types';
import { format, parseISO } from 'date-fns';

interface AdsDataTableProps {
  data: AdsPerformance[];
  loading: boolean;
}

const adsTypeBadgeVariant = (type: string) => {
  switch (type) {
    case 'search':
      return 'bg-chart-1/15 text-chart-1 border-chart-1/30';
    case 'discovery':
      return 'bg-chart-2/15 text-chart-2 border-chart-2/30';
    case 'video':
      return 'bg-chart-3/15 text-chart-3 border-chart-3/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('id-ID').format(value);
};

export default function AdsDataTable({ data, loading }: AdsDataTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">No data yet</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Select a date range and click "Sync Data" to pull your Shopee ads performance.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30 hover:bg-secondary/30">
            <TableHead className="text-xs font-semibold text-muted-foreground">Date</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Type</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Impressions</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Clicks</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">CTR</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Spend</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Orders</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">GMV</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">ROAS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => {
            const ctr = row.impressions > 0 ? ((row.clicks / row.impressions) * 100).toFixed(2) : '0.00';
            const roas = Number(row.spend) > 0 ? (Number(row.gmv) / Number(row.spend)).toFixed(2) : '–';
            return (
              <TableRow
                key={row.id || index}
                className="hover:bg-secondary/20 transition-colors duration-150"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <TableCell className="text-sm font-medium">
                  {format(parseISO(row.date), 'dd MMM yyyy')}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[11px] capitalize ${adsTypeBadgeVariant(row.ads_type)}`}
                  >
                    {row.ads_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(row.impressions)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(row.clicks)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {ctr}%
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatCurrency(Number(row.spend))}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(row.orders)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium text-accent">
                  {formatCurrency(Number(row.gmv))}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-semibold">
                  {roas}x
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
