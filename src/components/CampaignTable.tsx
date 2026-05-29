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
import type { Campaign } from '@/hooks/useCampaigns';
import { getCampaignTypeLabel } from '@/hooks/useCampaigns';

interface CampaignTableProps {
  campaigns: Campaign[];
  loading: boolean;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
};

const formatNumber = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('id-ID');
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  ongoing: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  normal: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  paused: { label: 'Paused', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  ended: { label: 'Ended', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  schedule: { label: 'Scheduled', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  unknown: { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-secondary border-border' },
};

const typeConfig: Record<number, { color: string; bg: string }> = {
  0: { color: 'text-chart-1', bg: 'bg-chart-1/15 border-chart-1/30' },
  1: { color: 'text-chart-2', bg: 'bg-chart-2/15 border-chart-2/30' },
  2: { color: 'text-chart-3', bg: 'bg-chart-3/15 border-chart-3/30' },
};

export default function CampaignTable({ campaigns, loading }: CampaignTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">No campaigns found</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Klik "Load Campaigns" untuk mengambil daftar campaign dari Shopee Ads.
        </p>
      </div>
    );
  }

  // Sort: active first, then by spend desc
  const sorted = [...campaigns].sort((a, b) => {
    const statusOrder = (s: string) => s === 'ongoing' || s === 'normal' ? 0 : s === 'paused' ? 1 : 2;
    const diff = statusOrder(a.status) - statusOrder(b.status);
    if (diff !== 0) return diff;
    return b.spend - a.spend;
  });

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/30 hover:bg-secondary/30">
            <TableHead className="text-xs font-semibold text-muted-foreground">Campaign</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Type</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs font-semibold text-muted-foreground text-right">Budget/Day</TableHead>
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
          {sorted.map((campaign, index) => {
            const status = statusConfig[campaign.status] || statusConfig.unknown;
            const type = typeConfig[campaign.campaign_type] || typeConfig[0];

            return (
              <TableRow
                key={campaign.campaign_id || index}
                className="hover:bg-secondary/20 transition-colors duration-150"
              >
                <TableCell className="max-w-[200px]">
                  <div className="truncate text-sm font-medium" title={campaign.campaign_name}>
                    {campaign.campaign_name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    ID: {campaign.campaign_id}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[11px] ${type.color} ${type.bg}`}>
                    {getCampaignTypeLabel(campaign.campaign_type)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[11px] ${status.color} ${status.bg}`}>
                    <div className={`h-1.5 w-1.5 rounded-full mr-1.5 ${campaign.status === 'ongoing' || campaign.status === 'normal' ? 'bg-emerald-400 animate-pulse' : campaign.status === 'paused' ? 'bg-amber-400' : 'bg-red-400'}`} />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {campaign.daily_budget > 0 ? formatCurrency(campaign.daily_budget) : '–'}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(campaign.impressions)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(campaign.clicks)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {campaign.ctr.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatCurrency(campaign.spend)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {formatNumber(campaign.orders)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium text-accent">
                  {formatCurrency(campaign.gmv)}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-semibold">
                  <span className={campaign.roas >= 3 ? 'text-emerald-400' : campaign.roas >= 1 ? 'text-amber-400' : 'text-red-400'}>
                    {campaign.roas > 0 ? `${campaign.roas.toFixed(2)}x` : '–'}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
