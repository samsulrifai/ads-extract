import { useEffect, useState } from 'react';
import { Trash2, UserPlus, Shield, User as UserIcon, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { neon } from '@/lib/neon';
import { useAuth, type MemberProfile, type UserRole } from '@/contexts/AuthContext';

export default function MembersPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Invite State
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await neon.from('members').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setMembers(data as MemberProfile[]);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError('');

    try {
      // Create the account with Neon Auth's Admin API (caller needs the Neon Auth
      // "admin" role), then add the member row. Neon Auth has no email invites,
      // so the admin sets a temporary password and shares it with the user.
      const email = inviteEmail.trim().toLowerCase();
      const { data, error } = await neon.auth.getBetterAuthInstance().admin.createUser({
        email,
        password: invitePassword,
        name: email.split('@')[0],
      });
      if (error) throw new Error(error.message || 'Failed to create user');

      const { error: memberError } = await neon.from('members').upsert(
        { user_id: data.user.id, email, role: inviteRole },
        { onConflict: 'email' }
      );
      if (memberError) throw memberError;

      setIsInviteOpen(false);
      setInviteEmail('');
      setInvitePassword('');
      setInviteRole('member');
      fetchMembers(); // refresh
    } catch (error: any) {
      setInviteError(error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDelete = async (member: MemberProfile) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    try {
      // Members that never logged in after the migration have no Neon Auth account yet
      if (member.user_id) {
        const { error } = await neon.auth.getBetterAuthInstance().admin.removeUser({ userId: member.user_id });
        if (error) throw new Error(error.message || 'Failed to delete user');
      }

      const { error: memberError } = await neon.from('members').delete().eq('id', member.id);
      if (memberError) throw memberError;
      
      setMembers(members.filter(m => m.id !== member.id));
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage access and roles for your team.
          </p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>Invite new member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4 mt-4">
              {inviteError && (
                <div className="bg-destructive/15 text-destructive text-sm px-4 py-3 rounded-md border border-destructive/20">
                  {inviteError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email address</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="bg-black/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Temporary password</label>
                <Input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="bg-black/20"
                  minLength={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Share this password with the member so they can log in.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as UserRole)}>
                  <SelectTrigger className="bg-black/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Admins have full access. Members can only view assigned shops.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Member
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Members List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="py-8 flex justify-center">
               <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground flex items-center gap-2">
                            {member.email}
                            {member.user_id === user?.id && (
                              <Badge variant="secondary" className="text-[10px] h-4">You</Badge>
                            )}
                            {!member.user_id && (
                              <Badge variant="outline" className="text-[10px] h-4" title="No Neon Auth account linked yet">
                                Pending
                              </Badge>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`font-normal ${
                          member.role === 'admin' 
                            ? 'border-primary/50 text-primary bg-primary/10' 
                            : 'border-white/20 text-muted-foreground'
                        }`}>
                          {member.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {member.role === 'member' && <UserIcon className="h-3 w-3 mr-1" />}
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(member)}
                          disabled={member.user_id === user?.id} // Cannot delete self
                          title="Remove user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        No members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
