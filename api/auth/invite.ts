import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with the service role key to bypass RLS and allow admin actions
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Very basic authorization wrapper (in a real app, verify the user's JWT block)
  // For simplicity, we just expect the client to have handled their own auth,
  // but to prevent abuse, you should verify the JWT auth header here.
  const authHeader = req.headers.authorization;
  if (!authHeader) {
     return res.status(401).json({ error: 'Unauthorized: Missing auth header' });
  }

  const { email, role } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // 1. Send invite email via Supabase Admin API
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (error) {
      console.error('Supabase invite error:', error);
      return res.status(500).json({ error: error.message });
    }

    // 2. The database trigger (`handle_new_user`) will automatically insert the member profile.
    // However, it creates it with the default role ('member').
    // If the invited user should be an 'admin', we need to update it.
    if (data.user && role === 'admin') {
       // Allow a moment for the trigger to fire
       await new Promise(resolve => setTimeout(resolve, 500));
       
       const { error: updateError } = await supabaseAdmin
        .from('members')
        .update({ role: 'admin' })
        .eq('user_id', data.user.id);
        
       if (updateError) {
         console.error('Failed to update role to admin:', updateError);
       }
    }

    return res.status(200).json({ success: true, user: data.user });
  } catch (error: any) {
    console.error('General invite error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
