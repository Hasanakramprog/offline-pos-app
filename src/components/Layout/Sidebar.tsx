import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Package, BarChart2,
  Users, Settings, LogOut, Store, Receipt, CreditCard,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useLang } from '../../i18n/LangContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { settings } = useSettingsStore();
  const navigate = useNavigate();
  const { t } = useLang();

  const handleLogout = () => { logout(); navigate('/login'); };

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canManage = isAdmin || isManager;

  // Labels re-read from t() on every render → update instantly when lang changes
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

  return (
    <aside className="w-56 flex-shrink-0 bg-pos-surface border-e border-pos-border flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-pos-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-pos-primary flex items-center justify-center">
            <Store size={20} className="text-pos-bg" />
          </div>
          <div>
            <p className="font-bold text-sm capitalize">{settings.store_name}</p>
            <p className="text-xs text-pos-muted">{t('pos_system')}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
               ${isActive
                ? 'bg-pos-primary text-pos-bg'
                : 'text-pos-muted hover:text-pos-text hover:bg-pos-border/50'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-pos-border">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium truncate">{user?.full_name}</p>
          <p className="text-xs text-pos-muted capitalize">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm
                     text-pos-danger hover:bg-pos-danger/10 transition-colors"
        >
          <LogOut size={18} />
          {t('sign_out')}
        </button>
      </div>
    </aside>
  );
};
