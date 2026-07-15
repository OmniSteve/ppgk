import React, { useState, useEffect, useMemo, Component } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import CollapsibleNavGroup from './CollapsibleNavGroup';
import {
  LayoutDashboard, Users, UserCheck, Dumbbell, MapPin, Tag,
  Package, BookOpen, ClipboardList, CreditCard, Bell, BarChart2,
  FileText, Settings, LogOut, Menu, Shield, Calendar,
  ShoppingBag, Layers, ClipboardCheck, Boxes
} from 'lucide-react';

// Persists which sidebar categories are expanded, per browser tab. Reset
// naturally when the session ends because sessionStorage (not localStorage)
// is per-tab and clears on tab/browser close.
const SIDEBAR_GROUPS_KEY = 'ppgk-admin-sidebar-groups';

const navGroups = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/admin' }],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { label: 'Users', icon: Users, href: '/admin/clients' },
      { label: 'Players', icon: UserCheck, href: '/admin/players' },
      { label: 'Coaches', icon: Dumbbell, href: '/admin/coaches' },
    ],
  },
  {
    id: 'sessions',
    label: 'Sessions',
    items: [
      { label: 'Sessions', icon: Calendar, href: '/admin/sessions' },
      { label: 'Locations', icon: MapPin, href: '/admin/locations' },
      { label: 'Session Types', icon: Tag, href: '/admin/session-types' },
    ],
  },
  {
    id: 'bookings-finance',
    label: 'Bookings & Finance',
    items: [
      { label: 'Bookings', icon: BookOpen, href: '/admin/bookings' },
      { label: 'Packages', icon: Package, href: '/admin/packages' },
      { label: 'Payments', icon: CreditCard, href: '/admin/payments' },
      { label: 'Credits', icon: CreditCard, href: '/admin/credits' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { label: 'Attendance', icon: ClipboardList, href: '/admin/attendance' },
      { label: 'Notifications', icon: Bell, href: '/admin/notifications' },
    ],
  },
  {
    id: 'store',
    label: 'Store',
    items: [
      { label: 'Products', icon: ShoppingBag, href: '/admin/store/products' },
      { label: 'Categories', icon: Layers, href: '/admin/store/categories' },
      { label: 'Orders', icon: ClipboardCheck, href: '/admin/store/orders' },
      { label: 'Inventory', icon: Boxes, href: '/admin/store/inventory' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { label: 'Reports', icon: BarChart2, href: '/admin/reports' },
      { label: 'Audit Log', icon: FileText, href: '/admin/audit' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [{ label: 'Settings', icon: Settings, href: '/admin/settings' }],
  },
];

function isNavItemActive(pathname, href) {
  return pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'));
}

/** Which group (if any) owns the currently active route. */
function findActiveGroupId(pathname) {
  const group = navGroups.find((g) => g.items.some((item) => isNavItemActive(pathname, item.href)));
  return group?.id ?? null;
}

function loadStoredGroups() {
  try {
    const raw = sessionStorage.getItem(SIDEBAR_GROUPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function SidebarNav({ user, location, openGroups, onOpenGroupsChange, onLinkClick, onSignOut }) {
  const isActive = (href) => isNavItemActive(location.pathname, href);

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Shield size={16} className="text-foreground" />
          </div>
          <div>
            <p className="text-foreground font-bold text-sm leading-tight">Admin Panel</p>
            <p className="text-primary text-xs">PPGK</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto">
        <AccordionPrimitive.Root
          type="multiple"
          value={openGroups}
          onValueChange={onOpenGroupsChange}
          className="p-3 space-y-1"
        >
          {navGroups.map((group) => (
            <CollapsibleNavGroup key={group.id} group={group} isActive={isActive} onLinkClick={onLinkClick} />
          ))}
        </AccordionPrimitive.Root>
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

  // Shared between the desktop <aside> and the mobile <Sheet> — both render
  // a SidebarNav, and lifting the state here keeps them in sync instead of
  // each holding its own copy.
  const [openGroups, setOpenGroups] = useState(loadStoredGroups);
  const activeGroupId = useMemo(() => findActiveGroupId(location.pathname), [location.pathname]);

  // Auto-expand the group containing the active route. Keyed on the active
  // GROUP (not the raw pathname), so navigating between sibling routes in
  // an already-open group doesn't re-run this — a manual collapse sticks
  // until the route actually moves to a different group.
  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups((prev) => (prev.includes(activeGroupId) ? prev : [...prev, activeGroupId]));
  }, [activeGroupId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      // sessionStorage unavailable (e.g. private browsing) — state stays in-memory only
    }
  }, [openGroups]);

  const handleSignOut = () => {
    signOut();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 bg-sidebar fixed inset-y-0 left-0 z-30 border-r border-sidebar-border print:hidden">
        <SidebarNav
          user={user}
          location={location}
          openGroups={openGroups}
          onOpenGroupsChange={setOpenGroups}
          onLinkClick={() => {}}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="lg:hidden w-64 max-w-[85vw] bg-sidebar border-sidebar-border p-0 flex flex-col gap-0"
        >
          <SidebarNav
            user={user}
            location={location}
            openGroups={openGroups}
            onOpenGroupsChange={setOpenGroups}
            onLinkClick={() => setSidebarOpen(false)}
            onSignOut={handleSignOut}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 lg:ml-56 print:ml-0 flex flex-col min-h-screen">
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
