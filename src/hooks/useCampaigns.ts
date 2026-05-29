import { useState, useCallback } from 'react';

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
  campaign_type: string;
  status: string;
  daily_budget: number;
  total_budget: number;
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  gmv: number;
  ctr: number;
  roas: number;
  days: number;
  latest_date: string;
  earliest_date: string;
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async (params: {
    shop_id: number;
    start_date?: string;
    end_date?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/get-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      // Handle non-OK responses
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text.substring(0, 200)}`);
      }

      // Safely parse JSON
      const text = await response.text();
      if (!text || text.trim().length === 0) {
        throw new Error('Server returned empty response.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server.');
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
