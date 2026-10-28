import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js';

// Neon Auth + Data API client. SupabaseAuthAdapter keeps the supabase-js style
// API (auth.signInWithPassword, auth.onAuthStateChange, .from().select(), ...).
export const neon = createClient({
  auth: {
    adapter: SupabaseAuthAdapter(),
    url: import.meta.env.VITE_NEON_AUTH_URL,
  },
  dataApi: {
    url: import.meta.env.VITE_NEON_DATA_API_URL,
  },
});
