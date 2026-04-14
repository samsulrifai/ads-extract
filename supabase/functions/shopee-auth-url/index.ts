// Supabase Edge Function: Generate Shopee OAuth Authorization URL
// Deno runtime

const SHOPEE_API_BASE = 'https://partner.shopeemobile.com';
const API_PATH = '/api/v2/shop/auth_partner';

async function generateSign(partnerId: number, partnerKey: string, apiPath: string, timestamp: number): Promise<string> {
  const baseStr = `${partnerId}${apiPath}${timestamp}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(partnerKey);
  const messageData = encoder.encode(baseStr);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const partnerId = Number(Deno.env.get('SHOPEE_PARTNER_ID'));
    const partnerKey = Deno.env.get('SHOPEE_PARTNER_KEY') || '';
    const redirectUrl = Deno.env.get('SHOPEE_REDIRECT_URL') || 'http://localhost:5173/callback';

    if (!partnerId || !partnerKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SHOPEE_PARTNER_ID or SHOPEE_PARTNER_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const sign = await generateSign(partnerId, partnerKey, API_PATH, timestamp);

    const authUrl = `${SHOPEE_API_BASE}${API_PATH}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${encodeURIComponent(redirectUrl)}`;

    return new Response(
      JSON.stringify({ auth_url: authUrl }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
