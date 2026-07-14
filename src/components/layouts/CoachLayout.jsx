import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { LayoutDashboard, Calendar, LogOut, Menu, Briefcase } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/coach' },
  { label: 'My Sessions', icon: Calendar, href: '/coach/sessions' },
];

function SidebarNav({ user, location, onLinkClick, onSignOut }) {
  const isActive = (href) => location.pathname === href || (href !== '/coach' && location.pathname.startsWith(href + '/'));

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Briefcase size={18} className="text-foreground" />
          </div>
          <div>
            <p className="text-foreground font-bold text-sm">Coach Portal</p>
            <p className="text-primary text-xs">Premier Performance GK</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'bg-primary text-foreground' : 'text-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs font-bold">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-foreground text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-muted-foreground text-xs">Coach</p>
          </div>
        </div>
        <button onClick={onSignOut} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function CoachLayout({ children }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => { signOut(); navigate('/signin'); };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar fixed inset-y-0 left-0 z-30 print:hidden">
        <SidebarNav user={user} location={location} onLinkClick={() => {}} onSignOut={handleSignOut} />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="lg:hidden w-72 max-w-[85vw] bg-sidebar border-sidebar-border p-0 flex flex-col gap-0"
        >
          <SidebarNav user={user} location={location} onLinkClick={() => setSidebarOpen(false)} onSignOut={handleSignOut} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 lg:ml-64 print:ml-0 flex flex-col min-h-screen">
        <header className="lg:hidden print:hidden bg-sidebar px-4 py-3 flex items-center justify-between sticky top-0 z-30 border-b border-border">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-primary" />
            <span className="text-foreground font-semibold text-sm">Coach Portal</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-foreground hover:text-foreground p-1">
            <Menu size={22} />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
