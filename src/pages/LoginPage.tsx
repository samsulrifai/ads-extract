import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Rocket, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  if (!authLoading && user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      if (data.user) {
        navigate('/');
      }
    } catch (error: any) {
      console.error('Error logging in:', error);
      setError(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 shadow-lg shadow-primary/20 mb-4">
            <Rocket className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient">
            Antigravity
          </h1>
          <p className="text-muted-foreground mt-2">
            Shopee Ads Extractor & Orders Sync
          </p>
        </div>

        <Card className="glass-panel animate-slide-up bg-card/60 backdrop-blur-xl border-white/10 shadow-2xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Enter your email and password to continue.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/15 text-destructive text-sm px-4 py-3 rounded-md border border-destructive/20 break-words">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/20 border-white/10 focus-visible:ring-primary/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground ml-1" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/20 border-white/10 focus-visible:ring-primary/50"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 mt-2">
              <Button
                type="submit"
                className="w-full font-semibold transition-all shadow-lg hover:shadow-primary/25"
                disabled={loading || authLoading}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Log In'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Access is by invitation only. Contact your administrator if you need an account.
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
