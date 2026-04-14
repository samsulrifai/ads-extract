import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SyncButtonProps {
  onClick: () => void;
  loading: boolean;
  disabled?: boolean;
  className?: string;
}

export default function SyncButton({
  onClick,
  loading,
  disabled,
  className,
}: SyncButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'relative h-10 px-6 font-semibold',
        'bg-primary hover:bg-primary/90 text-primary-foreground',
        'shadow-lg shadow-primary/25 hover:shadow-primary/40',
        'transition-all duration-300',
        loading && 'pr-10',
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync Data
        </>
      )}
    </Button>
  );
}
