import { useState, useCallback, useEffect } from 'react';
import { subDays } from 'date-fns';
import type { DateRange } from '@/types';

const STORAGE_KEY = 'ads-extract-filters';

interface StoredFilters {
  shopId?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

function loadFilters(): StoredFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return {};
}

function saveFilters(filters: StoredFilters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch { /* noop */ }
}

export function useFilterStore() {
  const stored = loadFilters();

  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: stored.dateFrom ? new Date(stored.dateFrom) : subDays(new Date(), 7),
    to: stored.dateTo ? new Date(stored.dateTo) : new Date(),
  }));

  const [statusFilter, setStatusFilter] = useState(stored.status || 'all');
  const [shopId, setShopId] = useState<number | undefined>(stored.shopId);

  // Persist whenever filters change
  useEffect(() => {
    saveFilters({
      shopId,
      dateFrom: dateRange.from?.toISOString(),
      dateTo: dateRange.to?.toISOString(),
      status: statusFilter,
    });
  }, [shopId, dateRange, statusFilter]);

  const updateDateRange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  const updateStatus = useCallback((status: string) => {
    setStatusFilter(status);
  }, []);

  const updateShopId = useCallback((id: number) => {
    setShopId(id);
  }, []);

  return {
    dateRange,
    setDateRange: updateDateRange,
    statusFilter,
    setStatusFilter: updateStatus,
    shopId,
    setShopId: updateShopId,
  };
}
