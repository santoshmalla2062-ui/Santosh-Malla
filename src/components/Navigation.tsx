import React from 'react';
import { 
  LayoutDashboard,
  Receipt, 
  LayoutGrid, 
  Package, 
  Users, 
  BarChart3, 
  Settings,
  ChefHat,
  Banknote,
  Hotel,
  Building2
} from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';
import { AppModule, StaffRole } from '../types';
import { AppAction, hasPermission } from '../services/security';

export type ActiveTab = 'dashboard' | 'pos' | 'billing' | 'tables_rooms' | 'resort' | 'kds' | 'inventory' | 'customers' | 'day_closing' | 'reports' | 'settings' | 'business_admin';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  lang: Language;
  currentRole?: StaffRole;
  enabledModules?: AppModule[];
  occupiedTablesCount: number;
  occupiedRoomsCount?: number;
  lowStockCount: number;
  unpaidKhataCount: number;
  activeKOTCount: number;
  unpaidBillsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  lang,
  currentRole,
  enabledModules,
  occupiedTablesCount,
  occupiedRoomsCount = 0,
  lowStockCount,
  unpaidKhataCount,
  activeKOTCount,
  unpaidBillsCount = 0
}) => {
  const t = TRANSLATIONS[lang];

  const navItems: { id: ActiveTab; label: string; icon: any; badge: string | null; badgeColor?: string; requiredAction: AppAction }[] = [
    {
      id: 'tables_rooms',
      label: lang === 'ne' ? 'टेबलहरू (Tables)' : 'Tables',
      icon: LayoutGrid,
      badge: occupiedTablesCount > 0 ? `${occupiedTablesCount}` : null,
      badgeColor: 'text-amber-800 bg-amber-50',
      requiredAction: 'VIEW_TAB_TABLES'
    },
    {
      id: 'pos',
      label: lang === 'ne' ? 'अर्डर (Orders)' : 'Orders',
      icon: Receipt,
      badge: null,
      requiredAction: 'VIEW_TAB_POS'
    },
    {
      id: 'kds',
      label: lang === 'ne' ? 'भान्सा (Kitchen)' : 'Kitchen',
      icon: ChefHat,
      badge: activeKOTCount > 0 ? `${activeKOTCount}` : null,
      badgeColor: 'text-orange-700 bg-orange-50',
      requiredAction: 'VIEW_TAB_KDS'
    },
    {
      id: 'billing',
      label: lang === 'ne' ? 'बिलिङ (Billing)' : 'Billing',
      icon: Banknote,
      badge: unpaidBillsCount > 0 ? `${unpaidBillsCount}` : null,
      badgeColor: 'text-rose-700 bg-rose-50',
      requiredAction: 'VIEW_TAB_BILLING'
    },
    {
      id: 'dashboard',
      label: lang === 'ne' ? 'ड्यासबोर्ड' : 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      requiredAction: 'VIEW_TAB_DASHBOARD'
    },
    {
      id: 'resort',
      label: lang === 'ne' ? 'रुम तथा रिसोर्ट (Rooms)' : 'Hotel & Rooms',
      icon: Hotel,
      badge: occupiedRoomsCount > 0 ? `${occupiedRoomsCount} stay` : null,
      badgeColor: 'text-emerald-800 bg-emerald-50',
      requiredAction: 'VIEW_TAB_RESORT'
    },
    {
      id: 'inventory',
      label: t.inventory,
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount} alert` : null,
      badgeColor: 'text-rose-700 bg-rose-50',
      requiredAction: 'VIEW_TAB_INVENTORY'
    },
    {
      id: 'customers',
      label: t.customersKhata,
      icon: Users,
      badge: unpaidKhataCount > 0 ? `${unpaidKhataCount} khata` : null,
      badgeColor: 'text-indigo-700 bg-indigo-50',
      requiredAction: 'VIEW_TAB_CUSTOMERS'
    },
    {
      id: 'day_closing',
      label: lang === 'ne' ? 'डे-क्लोजिङ / खर्च' : 'Day Closing',
      icon: Banknote,
      badge: null,
      requiredAction: 'VIEW_TAB_DAY_CLOSING'
    },
    {
      id: 'reports',
      label: t.reports,
      icon: BarChart3,
      badge: null,
      requiredAction: 'VIEW_TAB_REPORTS'
    },
    {
      id: 'settings',
      label: t.settings,
      icon: Settings,
      badge: null,
      requiredAction: 'VIEW_TAB_SETTINGS'
    },
    {
      id: 'business_admin',
      label: lang === 'ne' ? 'व्यवसाय प्रशासन' : 'Business Admin',
      icon: Building2,
      badge: null,
      requiredAction: 'VIEW_TAB_BUSINESS_ADMIN'
    }
  ];

  // Filter tabs allowed by the role and enabled modules for this tenant
  const visibleNavItems = navItems.filter(item => {
    const isModuleEnabled = !enabledModules || enabledModules.includes(item.id) || (item.id === 'billing' && enabledModules.includes('pos'));
    if (!isModuleEnabled) return false;
    if (!currentRole) return true;
    return hasPermission(currentRole, item.requiredAction);
  });

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-4 overflow-x-auto scrollbar-none py-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${item.badgeColor} ml-0.5`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

