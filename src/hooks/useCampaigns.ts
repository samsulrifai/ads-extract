import { useState, useCallback } from 'react';

export interface Campaign {
  campaign_id: number;
  campaign_name: string;
  campaign_type: number;
  status: string;
  daily_budget: number;
  total_budget: number;
  start_time: number;
  end_time: number;
  // Performance
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  gmv: number;
  ctr: number;
  roas: number;
}

const CAMPAIGN_TYPE_MAP: Record<number, string> = {
  0: 'Manual CPC',
  1: 'Auto CPC',
  2: 'CPA',
};

export function getCampaignTypeLabel(type: number): string {
  return CAMPAIGN_TYPE_MAP[type] || `Type ${type}`;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async (shopId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/get-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: shopId }),
      });

      // Handle non-OK responses
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text.substring(0, 200)}`);
      }

      // Safely parse JSON
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Server returned empty response. Coba restart dev server.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server. Pastikan API endpoint tersedia.');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch campaigns');
      }

      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { campaigns, loading, error, fetchCampaigns };
}
