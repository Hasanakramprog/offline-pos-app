'use client';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getPortalUser, logoutPortal, type PortalUser } from '@/lib/auth';
import {
  LayoutDashboard, BarChart2, Package, Receipt, Users,
  LogOut, ShoppingCart, Wifi, WifiOff, Cloud, Menu, X,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',           label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/reports',   label: 'Reports',    icon: BarChart2 },
  { href: '/dashboard/expenses',  label: 'Expenses',   icon: Receipt },
  { href: '/dashboard/debts',     label: 'Debts',      icon: Users },
  { href: '/dashboard/products',  label: 'Products',   icon: Package },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<PortalUser | null>(null);
  const [online, setOnline] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getPortalUser();
    if (!u) { router.replace('/login'); return; }
    setUser(u);
    setOnline(navigator.onLine);
    const up   = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [router]);

  const handleLogout = () => { logoutPortal(); router.replace('/login'); };

  if (!user) return null; // waiting for auth check

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      {/* ── Mobile Sidebar Overlay ────────────────────────────────── */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transform transition-transform duration-200 ease-in-out md:relative md:w-56 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Mobile Close Button */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">MiniMarket</p>
              <p className="text-[10px] text-gray-400 leading-tight">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all
                  ${active
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          {/* Sync status dot */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400">
            {online
              ? <><Wifi size={12} className="text-emerald-400" /><span>Connected</span></>
              : <><WifiOff size={12} className="text-red-400" /><span>Offline</span></>}
            <Cloud size={12} className="ml-auto text-indigo-400" />
          </div>
          {/* User */}
          <div className="px-3 py-1">
            <p className="text-xs font-medium text-white truncate">{user.full_name}</p>
            <p className="text-[10px] text-gray-500 capitalize">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ShoppingCart size={16} className="text-white" />
            </div>
            <p className="text-sm font-bold">MiniMarket Admin</p>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-400 hover:text-white p-1"
          >
            <Menu size={24} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
