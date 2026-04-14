import { useState } from 'react';
import {
  Store,
  Plus,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Clock,
  Link2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getAuthUrl, clearTokens } from '@/lib/shopee-client';
import { useShops } from '@/hooks/useShops';
import { supabase } from '@/lib/supabase';
import type { Shop } from '@/types';

export default function ShopsPage() {
  const [connectLoading, setConnectLoading] = useState(false);
  const { shops, fetchShops, loading } = useShops();

  const handleConnectShop = async () => {
    setConnectLoading(true);
    try {
      const authUrl = await getAuthUrl();
      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to get auth URL:', err);
      setConnectLoading(false);
    }
  };

  const handleDisconnect = async (shop: Shop) => {
    try {
      await supabase.from('shops').delete().eq('shopee_shop_id', shop.shopee_shop_id);
      clearTokens();
      await fetchShops();
    } catch (err) {
      console.error('Failed to disconnect shop', err);
    }
  };

  const getTokenStatus = (s: Shop) => {
    if (!s.expired_at) return { label: 'No Token', variant: 'secondary' as const, icon: Clock };
    if (new Date() > new Date(s.expired_at)) {
      return { label: 'Token Expired', variant: 'secondary' as const, icon: Clock };
    }
    return { label: 'Connected', variant: 'default' as const, icon: CheckCircle2 };
  };

  const formatExpiry = (s: Shop) => {
    if (!s.expired_at) return 'N/A';
    return new Date(s.expired_at).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSavedAt = (s: Shop) => {
    if (!s.updated_at) return 'N/A';
    return new Date(s.updated_at).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shops</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your connected Shopee stores.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40"
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect Shop
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Connect Shopee Store
              </DialogTitle>
              <DialogDescription>
                You'll be redirected to Shopee to authorize access to your store's
                advertising data. This uses OAuth 2.0 and is secure.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="glass-card rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">What we'll access:</p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    Shop advertising performance data
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    Daily ads metrics (impressions, clicks, spend, GMV)
                  </li>
                </ul>
              </div>
              <div className="glass-card rounded-lg p-4">
                <p className="text-xs text-muted-foreground">
                  <strong>Region:</strong> Indonesia 🇮🇩
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>API:</strong> partner.shopeemobile.com
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleConnectShop}
                disabled={connectLoading}
                className="w-full bg-primary text-primary-foreground"
              >
                {connectLoading ? (
                  'Redirecting...'
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Authorize with Shopee
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
             <div className="text-sm text-muted-foreground">Loading shops...</div>
          </CardContent>
        </Card>
      ) : shops.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Store className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No shops connected</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connect your first Shopee store to start extracting ads data.
              Click the "Connect Shop" button above to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map(shop => {
            const status = getTokenStatus(shop);
            const StatusIcon = status.icon;
            return (
              <Card key={shop.id} className="glass-card glass-card-hover gradient-border animate-slide-up overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{shop.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ID: {shop.shopee_shop_id}
                        </p>
                      </div>
                    </div>
                    <Badge variant={status.variant} className="text-[10px] gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 mb-4">
                    <p className="text-xs text-muted-foreground">
                      Token expires:{' '}
                      <span className="text-foreground">{formatExpiry(shop)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Connected:{' '}
                      <span className="text-foreground">{formatSavedAt(shop)}</span>
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Disconnect
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect this shop?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the shop and clear its tokens. You can reconnect later through OAuth.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white"
                          onClick={() => handleDisconnect(shop)}
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
