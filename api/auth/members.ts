import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default async function handler(req: any, res: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
     return res.status(401).json({ error: 'Unauthorized: Missing auth header' });
  }

  // DELETE a member
  if (req.method === 'DELETE') {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      // Delete user from auth.users (which cascades to members table)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;
      
      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('Delete user error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // PATCH a member (update role or shops)
  if (req.method === 'PATCH') {
    const { userId, role, assigned_shop_ids } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const updates: any = {};
      if (role) updates.role = role;
      if (assigned_shop_ids !== undefined) updates.assigned_shop_ids = assigned_shop_ids;

      const { data, error } = await supabaseAdmin
        .from('members')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      
      return res.status(200).json({ success: true, member: data });
    } catch (error: any) {
      console.error('Update member error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
