import { LayoutDashboard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your Shopee business performance.
        </p>
      </div>

      {/* Coming Soon Placeholder */}
      <Card className="glass-card">
        <CardContent className="py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Dashboard overview sedang dalam pengembangan. Gunakan tab <strong>Ads</strong> untuk melihat performa iklan Shopee.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
