import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/types';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

export default function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal min-w-[260px] h-10',
            'border-border bg-secondary/50 hover:bg-secondary',
            !dateRange.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
          {dateRange.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, 'dd MMM yyyy')} –{' '}
                {format(dateRange.to, 'dd MMM yyyy')}
              </>
            ) : (
              format(dateRange.from, 'dd MMM yyyy')
            )
          ) : (
            <span>Select date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-border bg-card" align="start">
        <Calendar
          mode="range"
          defaultMonth={dateRange.from}
          selected={{
            from: dateRange.from,
            to: dateRange.to,
          }}
          onSelect={(range) => {
            onDateRangeChange({
              from: range?.from,
              to: range?.to,
            });
            if (range?.from && range?.to) {
              setTimeout(() => setOpen(false), 300);
            }
          }}
          numberOfMonths={2}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  );
}
