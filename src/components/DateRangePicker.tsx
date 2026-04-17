import { useState } from 'react';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
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

const PRESETS = [
  { label: 'Hari Ini', getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Kemarin', getRange: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: '1 Minggu Terakhir', getRange: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: '1 Bulan Terakhir', getRange: () => ({ from: startOfDay(subMonths(new Date(), 1)), to: endOfDay(new Date()) }) },
  { label: '3 Bulan Terakhir', getRange: () => ({ from: startOfDay(subMonths(new Date(), 3)), to: endOfDay(new Date()) }) },
];

export default function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handlePreset = (getRange: () => DateRange) => {
    const range = getRange();
    onDateRangeChange(range);
    setTimeout(() => setOpen(false), 200);
  };

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
      <PopoverContent
        className="w-auto p-0 border-border bg-card"
        align="start"
        sideOffset={4}
      >
        <div className="flex">
          {/* Preset Sidebar */}
          <div className="border-r border-border p-2 min-w-[150px] flex flex-col gap-0.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset.getRange)}
                className="text-left text-sm px-3 py-2 rounded-md
                  hover:bg-primary/10 hover:text-primary
                  text-muted-foreground transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          {/* Calendar */}
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
        </div>
      </PopoverContent>
    </Popover>
  );
}
