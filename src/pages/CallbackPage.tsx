import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { exchangeCode } from '@/lib/shopee-client';

export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const shopId = searchParams.get('shop_id');

    if (!code || !shopId) {
      setStatus('error');
      setMessage('Missing authorization code or shop ID from Shopee.');
      return;
    }

    const doExchange = async () => {
      try {
        const tokens = await exchangeCode(code, Number(shopId));
        setStatus('success');
        setMessage(`Shop ${tokens.shop_id} connected successfully!`);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    };

    doExchange();
  }, [searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <Card className="glass-card gradient-border max-w-md w-full mx-4">
        <CardContent className="py-12 text-center">
          {status === 'loading' && (
            <>
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h2 className="text-xl font-bold mb-2">Connecting your shop...</h2>
              <p className="text-sm text-muted-foreground">
                Exchanging authorization code for access tokens.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-xl font-bold mb-2">Shop Connected!</h2>
              <p className="text-sm text-muted-foreground mb-6">{message}</p>
              <Button
                onClick={() => navigate('/')}
                className="bg-primary text-primary-foreground"
              >
                Go to Dashboard
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
              <p className="text-sm text-muted-foreground mb-6">{message}</p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => navigate('/shops')}
                  className="border-border"
                >
                  Back to Shops
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-primary text-primary-foreground"
                >
                  Try Again
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
