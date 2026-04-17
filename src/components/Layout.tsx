import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Megaphone,
  ShoppingBag,
  Menu,
  X,
  Rocket,
  Users,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

const commonNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ads', icon: Megaphone, label: 'Ads' },
  { to: '/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/shops', icon: Store, label: 'Shops' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [...commonNavItems];
  if (isAdmin) {
    navItems.push({ to: '/members', icon: Users, label: 'Team Members' });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col
          bg-sidebar border-r border-sidebar-border
          transform transition-transform duration-300 ease-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gradient">
              Antigravity
            </h1>
            <p className="text-[11px] text-muted-foreground -mt-0.5">
              Shopee Ads Extractor
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200
                ${
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User & Footer Area */}
        <div className="p-4 mt-auto">
          {user && (
            <div className="glass-card rounded-xl p-3 mb-3 border border-white/5 bg-white/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate text-foreground">
                    {user.email}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {profile?.role || 'Member'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs h-8 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
              >
                <LogOut className="h-3 w-3 mr-2" />
                Logout
              </Button>
            </div>
          )}
          
          <div className="glass-card rounded-xl p-3 border border-white/5">
            <p className="text-xs text-muted-foreground flex justify-between items-center">
              <span>Region:</span> 
              <span className="text-foreground font-medium flex items-center gap-1">
                ID 🇮🇩
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 flex justify-between items-center">
              <span>DB:</span>
              <span className="text-accent font-medium flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Cloud
              </span>
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile only) */}
        <header className="lg:hidden flex items-center gap-4 border-b border-border px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <UserIcon className="h-4 w-4 text-primary" />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

