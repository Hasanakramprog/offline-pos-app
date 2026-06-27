import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart2,
  Users, Settings, LogOut, Store, Receipt, CreditCard, Clock,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLang } from '../../i18n/LangContext';

const COLLAPSED_KEY = 'pos_sidebar_collapsed';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const { t, lang, isRTL } = useLang();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // ── Live clock ────────────────────────────────────────────
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dayStr  = now.toLocaleDateString(locale, { weekday: 'long' });
  const dateStr = now.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canManage = isAdmin || isManager;

  const navItems = [
    { to: '/dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, show: true          },
    { to: '/checkout',  label: t('nav_checkout'),  icon: ShoppingCart,    show: true          },
    { to: '/inventory', label: t('nav_inventory'), icon: Package,         show: true          },
    { to: '/reports',   label: t('nav_reports'),   icon: BarChart2,       show: true          },
    { to: '/expenses',  label: t('nav_expenses'),  icon: Receipt,         show: canManage     },
    { to: '/debts',     label: t('nav_debts'),     icon: CreditCard,      show: canManage     },
    { to: '/users',     label: t('nav_users'),     icon: Users,           show: isAdmin       },
    { to: '/settings',  label: t('nav_settings'),  icon: Settings,        show: true          },
  ];

  const visibleItems = navItems.filter(item => item.show);

  // Collapse chevron direction depends on RTL
  const CollapseIcon = collapsed
    ? (isRTL ? ChevronsLeft : ChevronsRight)
    : (isRTL ? ChevronsRight : ChevronsLeft);

  return (
    <aside
      className={`flex-shrink-0 bg-pos-surface border-e border-pos-border flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden
        ${collapsed ? 'w-[68px]' : 'w-56'}`}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-pos-border">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-9 h-9 rounded-lg bg-pos-primary flex items-center justify-center flex-shrink-0">
            <Store size={20} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm capitalize truncate">{settings.store_name}</p>
              <p className="text-xs text-pos-muted">{t('pos_system')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to} to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.97]
               ${collapsed ? 'justify-center w-full px-0 py-2.5' : 'gap-3 px-3 py-2.5'}
               ${isActive
                ? 'bg-pos-primary text-white shadow-md shadow-pos-primary/25'
                : 'text-pos-muted hover:text-pos-text hover:bg-pos-border/50'}`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Clock & Date */}
      <div className="px-2 pb-2">
        {collapsed ? (
          <div className="rounded-xl bg-pos-bg border border-pos-border py-2 text-center" title={`${dayStr} — ${dateStr}`}>
            <Clock size={14} className="text-pos-primary mx-auto mb-0.5" />
            <p className="text-[10px] font-bold font-mono text-pos-text leading-tight">
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-pos-bg border border-pos-border px-3 py-2.5 text-center space-y-0.5">
            <div className="flex items-center justify-center gap-1.5">
              <Clock size={13} className="text-pos-primary" />
              <span className="text-sm font-bold font-mono tracking-wide text-pos-text">{timeStr}</span>
            </div>
            <p className="text-xs font-medium text-pos-primary">{dayStr}</p>
            <p className="text-[11px] text-pos-muted">{dateStr}</p>
          </div>
        )}
      </div>

      {/* User + Logout */}
      <div className="p-2 border-t border-pos-border">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-pos-muted capitalize">{user?.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? t('sign_out') : undefined}
          className={`flex items-center w-full rounded-lg text-sm text-pos-danger hover:bg-pos-danger/10 transition-colors
            ${collapsed ? 'justify-center py-2.5 px-0' : 'gap-3 px-3 py-2.5'}`}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && t('sign_out')}
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-pos-border">
        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex items-center w-full rounded-lg text-sm text-pos-muted hover:text-pos-text hover:bg-pos-border/50 transition-all duration-200
            ${collapsed ? 'justify-center py-2.5 px-0' : 'gap-3 px-3 py-2.5'}`}
        >
          <CollapseIcon size={18} className="flex-shrink-0" />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};
