import React, { useEffect, useState } from 'react';
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
  Building2,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  Lock,
  Volume2,
  VolumeX,
  Download,
  Sliders,
  ShieldCheck,
  Menu,
  X,
  QrCode,
  LogOut
} from 'lucide-react';
import { Language, TRANSLATIONS } from '../utils/translations';
import { sanitizeBusinessLogoUrl } from '../utils/imageUtils';
import { AppModule, BusinessTenant, Session, StaffRole } from '../types';
import { AppAction, hasPermission } from '../services/security';

export type ActiveTab = 'dashboard' | 'pos' | 'billing' | 'tables_rooms' | 'resort' | 'kds' | 'inventory' | 'customers' | 'day_closing' | 'reports' | 'settings' | 'business_admin';

interface SidebarNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  lang: Language;
  currentRole?: StaffRole;
  currentSession: Session | null;
  activeBusiness?: BusinessTenant;
  logoUrl?: string;
  enabledModules?: AppModule[];
  occupiedTablesCount: number;
  occupiedRoomsCount?: number;
  lowStockCount: number;
  unpaidKhataCount: number;
  activeKOTCount: number;
  unpaidBillsCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onToggleSound?: () => void;
  soundEnabled?: boolean;
  onBackupClick?: () => void;
  onOpenSuperAdmin?: () => void;
  onOpenBusinessSwitcher?: () => void;
  onOpenMobileQR?: () => void;
  isAppCreator?: boolean;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  activeTab,
  onTabChange,
  lang,
  currentRole,
  currentSession,
  activeBusiness,
  logoUrl,
  enabledModules,
  occupiedTablesCount,
  occupiedRoomsCount = 0,
  lowStockCount,
  unpaidKhataCount,
  activeKOTCount,
  unpaidBillsCount = 0,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenLogin,
  onLogout,
  onToggleSound,
  soundEnabled,
  onBackupClick,
  onOpenSuperAdmin,
  onOpenBusinessSwitcher,
  onOpenMobileQR,
  isAppCreator = false
}) => {
  const t = TRANSLATIONS[lang];
  const resolvedLogo = sanitizeBusinessLogoUrl(logoUrl) || sanitizeBusinessLogoUrl(activeBusiness?.logo);
  const [logoLoadError, setLogoLoadError] = useState(false);

  useEffect(() => {
    setLogoLoadError(false);
  }, [resolvedLogo]);

  const monogram =
    (activeBusiness?.businessName || 'HB')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'HB';

  type NavDef = {
    id: ActiveTab;
    label: string;
    nepaliLabel: string;
    icon: any;
    badge: string | null;
    badgeColor?: string;
    requiredAction: AppAction;
    group: 'service' | 'operations';
  };

  const navItems: NavDef[] = [
    {
      id: 'tables_rooms',
      label: 'Tables',
      nepaliLabel: 'टेबलहरू (Tables)',
      icon: LayoutGrid,
      badge: occupiedTablesCount > 0 ? `${occupiedTablesCount}` : null,
      badgeColor: 'bg-amber-500 text-white',
      requiredAction: 'VIEW_TAB_TABLES',
      group: 'service'
    },
    {
      id: 'pos',
      label: 'Orders',
      nepaliLabel: 'अर्डर (Orders)',
      icon: Receipt,
      badge: null,
      requiredAction: 'VIEW_TAB_POS',
      group: 'service'
    },
    {
      id: 'kds',
      label: 'Kitchen',
      nepaliLabel: 'भान्सा (Kitchen)',
      icon: ChefHat,
      badge: activeKOTCount > 0 ? `${activeKOTCount}` : null,
      badgeColor: 'bg-orange-500 text-white',
      requiredAction: 'VIEW_TAB_KDS',
      group: 'service'
    },
    {
      id: 'billing',
      label: 'Billing',
      nepaliLabel: 'बिलिङ (Billing)',
      icon: Banknote,
      badge: unpaidBillsCount > 0 ? `${unpaidBillsCount}` : null,
      badgeColor: 'bg-rose-500 text-white',
      requiredAction: 'VIEW_TAB_BILLING',
      group: 'service'
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      nepaliLabel: 'ड्यासबोर्ड',
      icon: LayoutDashboard,
      badge: null,
      requiredAction: 'VIEW_TAB_DASHBOARD',
      group: 'operations'
    },
    {
      id: 'resort',
      label: 'Hotel & Resort',
      nepaliLabel: 'रुम तथा रिसोर्ट',
      icon: Hotel,
      badge: occupiedRoomsCount > 0 ? `${occupiedRoomsCount}` : null,
      badgeColor: 'bg-emerald-600 text-white',
      requiredAction: 'VIEW_TAB_RESORT',
      group: 'operations'
    },
    {
      id: 'inventory',
      label: 'Inventory & Stock',
      nepaliLabel: 'स्टक तथा सामग्री',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeColor: 'bg-rose-500 text-white',
      requiredAction: 'VIEW_TAB_INVENTORY',
      group: 'operations'
    },
    {
      id: 'customers',
      label: 'Customer Khata',
      nepaliLabel: 'ग्राहक तथा खाता',
      icon: Users,
      badge: unpaidKhataCount > 0 ? `${unpaidKhataCount}` : null,
      badgeColor: 'bg-indigo-600 text-white',
      requiredAction: 'VIEW_TAB_CUSTOMERS',
      group: 'operations'
    },
    {
      id: 'day_closing',
      label: 'Day Closing',
      nepaliLabel: 'डे-क्लोजिङ / खर्च',
      icon: Banknote,
      badge: null,
      requiredAction: 'VIEW_TAB_DAY_CLOSING',
      group: 'operations'
    },
    {
      id: 'reports',
      label: 'Reports',
      nepaliLabel: 'रिपोर्ट तथा विश्लेषण',
      icon: BarChart3,
      badge: null,
      requiredAction: 'VIEW_TAB_REPORTS',
      group: 'operations'
    },
    {
      id: 'business_admin',
      label: 'Business Admin',
      nepaliLabel: 'व्यवसाय प्रशासन',
      icon: Building2,
      badge: null,
      requiredAction: 'VIEW_TAB_BUSINESS_ADMIN',
      group: 'operations'
    },
    {
      id: 'settings',
      label: 'Settings',
      nepaliLabel: 'सेटिङ्स',
      icon: Settings,
      badge: null,
      requiredAction: 'VIEW_TAB_SETTINGS',
      group: 'operations'
    }
  ];

  const visibleNavItems = navItems.filter(item => {
    const isModuleEnabled = !enabledModules || enabledModules.includes(item.id) || (item.id === 'billing' && enabledModules.includes('pos'));
    if (!isModuleEnabled) return false;
    if (!currentRole) return true;
    return hasPermission(currentRole, item.requiredAction);
  });

  const serviceItems = visibleNavItems.filter(i => i.group === 'service');
  const operationalItems = visibleNavItems.filter(i => i.group === 'operations');

  const renderNavItem = (item: NavDef) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const displayLabel = lang === 'ne' ? item.nepaliLabel : item.label;

    return (
      <button
        key={item.id}
        onClick={() => {
          onTabChange(item.id);
          onCloseMobile();
        }}
        title={displayLabel}
        className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
          isActive
            ? 'bg-orange-50 text-orange-950 font-bold border border-orange-200 shadow-2xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 transition-colors ${
            isActive ? 'text-orange-600' : 'text-slate-500 group-hover:text-slate-800'
          }`} />
          {!isCollapsed && (
            <span className="truncate whitespace-nowrap">{displayLabel}</span>
          )}
        </div>

        {/* Badge Notification */}
        {item.badge && (
          <span className={`${isCollapsed ? 'absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-[9px]' : 'text-[10px] px-1.5 py-0.5'} rounded-full font-bold tabular-nums shadow-2xs ${item.badgeColor || 'bg-orange-500 text-white'}`}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between select-none">
      {/* Top Header / Branding */}
      <div>
        {/* Brand Lockup (Foodmandu Warm Accent Style) */}
        <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <button
            type="button"
            onClick={
              currentRole === 'SUPER_ADMIN' ||
              currentRole === 'OWNER' ||
              currentRole === 'ADMIN' ||
              currentRole === 'MANAGER'
                ? onOpenBusinessSwitcher
                : undefined
            }
            disabled={
              !(
                currentRole === 'SUPER_ADMIN' ||
                currentRole === 'OWNER' ||
                currentRole === 'ADMIN' ||
                currentRole === 'MANAGER'
              )
            }
            title={activeBusiness?.businessName || 'Himalayan Breeze'}
            className="flex items-center gap-2.5 text-left w-full overflow-hidden group disabled:cursor-default"
          >
            {/* Brand Logo Tile or Initials Monogram */}
            {resolvedLogo && !logoLoadError ? (
              <img
                src={resolvedLogo}
                alt={activeBusiness?.businessName || 'Business Logo'}
                onError={() => setLogoLoadError(true)}
                className="h-9 w-9 rounded-xl object-cover border border-slate-200 bg-white shadow-xs shrink-0 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="h-9 w-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <span className="text-base tracking-tighter">{monogram}</span>
              </div>
            )}
            
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-sm font-bold text-slate-900 truncate leading-tight group-hover:text-orange-600 transition-colors">
                  {lang === 'ne' && activeBusiness?.nepaliBusinessName ? activeBusiness.nepaliBusinessName : (activeBusiness?.businessName || 'Himalayan Breeze')}
                </h1>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  {activeBusiness?.businessType ? activeBusiness.businessType.replace(/_/g, ' ') : 'Restaurant & Bar'}
                </p>
              </div>
            )}
          </button>

          {/* Close button for mobile */}
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Staff Profile / Quick Identity Bar */}
        <div className={`p-3 border-b border-slate-200/60 ${isCollapsed ? 'text-center' : ''}`}>
          {currentSession ? (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {currentSession.name.charAt(0).toUpperCase()}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate leading-tight">{currentSession.name}</p>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-block leading-tight mt-0.5">
                      {currentSession.role}
                    </span>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <button
                  onClick={onLogout}
                  title={lang === 'ne' ? 'साइन आउट (Sign Out)' : 'Sign Out'}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className={`w-full py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs ${isCollapsed ? 'px-1' : 'px-3'}`}
            >
              <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              {!isCollapsed && <span>Sign In</span>}
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <div className="py-2 px-2 space-y-1 overflow-y-auto max-h-[calc(100vh-270px)] scrollbar-none">
          {serviceItems.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'ne' ? 'सेवा तथा बिलिङ' : 'Floor Service'}
                </p>
              )}
              {serviceItems.map(renderNavItem)}
            </div>
          )}

          {operationalItems.length > 0 && (
            <div className="pt-2 mt-2 border-t border-slate-100 space-y-1">
              {!isCollapsed && (
                <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {lang === 'ne' ? 'प्रशासन र भण्डार' : 'Management'}
                </p>
              )}
              {operationalItems.map(renderNavItem)}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Area: Controls, Quick Support & Collapse Toggle */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2">
        {/* Quick Support Phone (Foodmandu Style) */}
        {!isCollapsed && (
          <div className="p-2 bg-white rounded-lg border border-slate-200/80 text-[11px] text-slate-600 shadow-2xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-0.5">
              <PhoneCall className="h-3 w-3 text-orange-600 shrink-0" />
              <span>Quick Support</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {activeBusiness?.phone || '+977-061-465222 / 9856012345'}
            </p>
          </div>
        )}

        {/* Utility Icon Actions */}
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-1.5' : 'justify-between'} text-slate-500`}>
          <div className="flex items-center gap-1">
            {onOpenMobileQR && (
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  onOpenMobileQR();
                }}
                title={lang === 'ne' ? 'मोबाइल QR कोड देखाउनुहोस्' : 'Show Mobile Access QR Code'}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 text-slate-700 hover:text-slate-950 hover:bg-slate-200/70 rounded-lg transition-colors text-xs font-semibold"
              >
                <QrCode className="h-4 w-4 text-emerald-700 shrink-0" />
                {!isCollapsed && (
                  <span className="whitespace-nowrap">{lang === 'ne' ? 'मोबाइल QR' : 'Mobile QR'}</span>
                )}
              </button>
            )}
            {currentRole === 'SUPER_ADMIN' && onOpenSuperAdmin && (
              <button
                onClick={onOpenSuperAdmin}
                title="App Creator & SaaS Control Hub"
                className="p-1.5 text-purple-600 hover:text-purple-900 hover:bg-purple-100/60 rounded-lg transition-colors"
              >
                <Sliders className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Desktop Sidebar Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="hidden md:flex p-1.5 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:block bg-white border-r border-slate-200 shrink-0 transition-all duration-200 shadow-2xs z-20 ${
          isCollapsed ? 'w-16' : 'w-56 lg:w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-40 md:hidden animate-in fade-in"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 shadow-2xl z-50 md:hidden transform transition-transform duration-250 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
