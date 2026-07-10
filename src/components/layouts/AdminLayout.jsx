import React, { useState, Component } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard, Users, UserCheck, Dumbbell, MapPin, Tag,
  Package, BookOpen, ClipboardList, CreditCard, Bell, BarChart2,
  FileText, Settings, LogOut, Menu, X, Shield, Calendar
} from 'lucide-react';

const navGroups = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/admin' }],
  },
  {
    label: 'People',
    items: [
      { label: 'Users', icon: Users, href: '/admin/clients' },
      { label: 'Players', icon: UserCheck, href: '/admin/players' },
      { label: 'Coaches', icon: Dumbbell, href: '/admin/coaches' },
    ],
  },
  {
    label: 'Sessions',
    items: [
      { label: 'Sessions', icon: Calendar, href: '/admin/sessions' },
      { label: 'Locations', icon: MapPin, href: '/admin/locations' },
      { label: 'Session Types', icon: Tag, href: '/admin/session-types' },
    ],
  },
  {
    label: 'Bookings & Finance',
    items: [
      { label: 'Bookings', icon: BookOpen, href: '/admin/bookings' },
      { label: 'Packages', icon: Package, href: '/admin/packages' },
      { label: 'Payments', icon: CreditCard, href: '/admin/payments' },
      { label: 'Credits', icon: CreditCard, href: '/admin/credits' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Attendance', icon: ClipboardList, href: '/admin/attendance' },
      { label: 'Notifications', icon: Bell, href: '/admin/notifications' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Reports', icon: BarChart2, href: '/admin/reports' },
      { label: 'Audit Log', icon: FileText, href: '/admin/audit' },
    ],
  },
  {
    label: 'System',
    items: [{ label: 'Settings', icon: Settings, href: '/admin/settings' }],
  },
];

function SidebarNav({ user, location, onLinkClick, onSignOut }) {
  const isActive = (href) =>
    location.pathname === href || (href !== '/admin' && location.pathname.startsWith(href + '/'));

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Shield size={16} className="text-foreground" />
          </div>
          <div>
            <p className="text-foreground font-bold text-sm leading-tight">Admin Panel</p>
            <p className="text-primary text-xs">Premier Performance GK</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider px-3 mb-1">{group.label}</p>
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onLinkClick}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                    active ? 'bg-primary text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <Link to="/dashboard" onClick={onLinkClick} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <LayoutDashboard size={14} />
          Client View
        </Link>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
        >
          <LogOut size={14} />
          Sign Out
        </button>
        <div className="flex items-center gap-2 px-3 pt-2 border-t border-sidebar-border">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-foreground text-xs font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-muted-foreground text-[10px]">Administrator</p>
          </div>
        </div>
      </div>
    </div>
  );
}

class AdminErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-destructive font-semibold">Page crashed: {this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })} className="text-primary text-sm hover:underline">Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminLayout({ children = <Outlet /> }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = () => {
    signOut();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-sidebar fixed inset-y-0 left-0 z-30 border-r border-sidebar-border print:hidden">
        <SidebarNav user={user} location={location} onLinkClick={() => {}} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-64 bg-sidebar">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10">
              <X size={20} />
            </button>
            <SidebarNav user={user} location={location} onLinkClick={() => setSidebarOpen(false)} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-56 print:ml-0 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden print:hidden bg-sidebar px-4 py-3 flex items-center justify-between sticky top-0 z-30 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-primary" />
            <span className="text-foreground font-semibold text-sm">Admin Panel</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground p-1">
            <Menu size={22} />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <AdminErrorBoundary>
            {children}
          </AdminErrorBoundary>
        </main>
      </div>
    </div>
  );
}
