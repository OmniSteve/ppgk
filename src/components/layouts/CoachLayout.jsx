import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Calendar, LogOut, Menu, X, Briefcase } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/coach' },
  { label: 'My Sessions', icon: Calendar, href: '/coach/sessions' },
];

function SidebarNav({ user, location, onLinkClick, onSignOut }) {
  const isActive = (href) => location.pathname === href || (href !== '/coach' && location.pathname.startsWith(href + '/'));

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center">
            <Briefcase size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Coach Portal</p>
            <p className="text-[#2563EB] text-xs">Premier Performance GK</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'bg-[#2563EB] text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#2563EB]/20 flex items-center justify-center">
            <span className="text-[#2563EB] text-xs font-bold">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-slate-400 text-xs">Coach</p>
          </div>
        </div>
        <button onClick={onSignOut} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-all">
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
    <div className="min-h-screen bg-[#0F172A] flex">
      <aside className="hidden lg:flex flex-col w-64 bg-[#0D1B2A] fixed inset-y-0 left-0 z-30">
        <SidebarNav user={user} location={location} onLinkClick={() => {}} onSignOut={handleSignOut} />
      </aside>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-72 bg-[#0D1B2A]">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
            <SidebarNav user={user} location={location} onLinkClick={() => setSidebarOpen(false)} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="lg:hidden bg-[#0D1B2A] px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-[#2563EB]" />
            <span className="text-white font-semibold text-sm">Coach Portal</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-white p-1">
            <Menu size={22} />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}