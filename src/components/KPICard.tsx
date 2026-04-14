import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  accentColor?: string;
  delay?: number;
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon,
  accentColor = 'primary',
  delay = 0,
}: KPICardProps) {
  return (
    <Card
      className={cn(
        'glass-card glass-card-hover gradient-border',
        'transition-all duration-300 cursor-default animate-slide-up',
        'overflow-hidden'
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            <p className="text-2xl lg:text-3xl font-bold tracking-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              `bg-${accentColor}/10 text-${accentColor}`
            )}
            style={{
              backgroundColor: `oklch(0.65 0.25 270 / 10%)`,
              color: `oklch(0.65 0.25 270)`,
            }}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
