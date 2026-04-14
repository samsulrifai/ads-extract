/**
 * Shopee API client for frontend.
 * Handles token storage in localStorage and API calls via Vercel serverless functions.
 */

const TOKEN_KEY = 'shopee_tokens';

export interface ShopeeTokens {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  shop_id: number;
  saved_at: number; // Unix timestamp when saved
}

// ── Token Storage ──

export function saveTokens(data: Omit<ShopeeTokens, 'saved_at'>): ShopeeTokens {
  const tokens: ShopeeTokens = {
    ...data,
    saved_at: Math.floor(Date.now() / 1000),
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  return tokens;
}

export function loadTokens(): ShopeeTokens | null {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isTokenExpired(tokens: ShopeeTokens): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now > tokens.saved_at + tokens.expire_in - 300; // 5 min buffer
}

export function isConnected(): boolean {
  const tokens = loadTokens();
  return tokens !== null;
}

// ── API Helpers ──

/** Get the Shopee authorization URL (calls our Vercel API) */
export async function getAuthUrl(): Promise<string> {
  const res = await fetch('/api/auth-url');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.auth_url;
}

/** Exchange auth code for tokens (called from CallbackPage) */
export async function exchangeCode(code: string, shopId: number): Promise<ShopeeTokens> {
  const res = await fetch('/api/shopee-callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, shop_id: shopId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Token exchange failed');
  return saveTokens(data);
}

/** Refresh the access token */
export async function refreshTokens(): Promise<ShopeeTokens> {
  const current = loadTokens();
  if (!current) throw new Error('No tokens to refresh');

  const res = await fetch('/api/refresh-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: current.refresh_token,
      shop_id: current.shop_id,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Token refresh failed');
  return saveTokens(data);
}

/** Get valid tokens, auto-refresh if expired */
async function getValidTokens(): Promise<ShopeeTokens> {
  let tokens = loadTokens();
  if (!tokens) throw new Error('Not connected. Please authorize first.');

  if (isTokenExpired(tokens)) {
    tokens = await refreshTokens();
  }

  return tokens;
}

/**
 * Call Shopee Ads API via our Vercel proxy.
 * Automatically handles token refresh.
 */
export async function shopeeApiCall(
  apiPath: string,
  method: 'GET' | 'POST' = 'GET',
  params?: Record<string, string | number>,
  body?: Record<string, unknown>
): Promise<any> {
  const tokens = await getValidTokens();

  const res = await fetch('/api/ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: tokens.access_token,
      shop_id: tokens.shop_id,
      api_path: apiPath,
      method,
      params,
      body,
    }),
  });

  return res.json();
}

// ── Ads API Convenience Functions ──

export async function getAllAds(page = 0, pageSize = 20) {
  return shopeeApiCall('/api/v2/ads/get_all_ads', 'GET', { page, page_size: pageSize });
}

export async function getShopPerformance(startTime?: number, endTime?: number) {
  const now = Math.floor(Date.now() / 1000);
  return shopeeApiCall(
    '/api/v2/ads/get_shop_total_performance',
    'POST',
    undefined,
    {
      start_time: startTime || now - 7 * 24 * 3600,
      end_time: endTime || now,
    }
  );
}

export async function getCampaignDailyPerformance(
  campaignId: number,
  startTime?: number,
  endTime?: number
) {
  const now = Math.floor(Date.now() / 1000);
  return shopeeApiCall(
    '/api/v2/ads/get_campaign_daily_performance',
    'POST',
    undefined,
    {
      campaign_id: campaignId,
      start_time: startTime || now - 7 * 24 * 3600,
      end_time: endTime || now,
    }
  );
}
