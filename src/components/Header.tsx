import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Download, 
  Volume2, 
  VolumeX, 
  AlertTriangle,
  Lock,
  History,
  ChevronDown,
  Sliders,
  Menu,
  Search,
  Bell,
  QrCode,
  LogOut,
  ArrowRightLeft
} from 'lucide-react';
import { BusinessSettings, BusinessTenant, Session, StaffRole } from '../types';
import { Language, TRANSLATIONS } from '../utils/translations';
import { sanitizeBusinessLogoUrl } from '../utils/imageUtils';
import { SyncStatusBadge } from './common/SyncStatusBadge';
import { PWAInstallButton } from './common/PWAInstallButton';

interface HeaderProps {
  settings: BusinessSettings;
  lang: Language;
  currentSession: Session | null;
  activeBusiness?: BusinessTenant;
  onOpenBusinessSwitcher?: () => void;
  onOpenSuperAdmin?: () => void;
  onLanguageChange: (lang: Language) => void;
  onBackupClick: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenAuditLogs?: () => void;
  onOpenSyncDetails?: () => void;
  onFlushQueue?: () => void;
  lowStockCount: number;
  activeOrdersCount: number;
  isSaved: boolean;
  onToggleSound: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onOpenQuickActions?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onSwitchRole?: (role: StaffRole) => void;
  canFreeSwitchRole?: boolean;
  isMasterOwnerGoogle?: boolean;
  cloudSyncStatus?: 'connected' | 'local' | 'error' | 'connecting';
  cloudUserEmail?: string | null;
  onGoogleOwnerLogin?: () => void;
  ownerControlLocked?: boolean;
  onOpenMobileQR?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  lang,
  currentSession,
  activeBusiness,
  onOpenBusinessSwitcher,
  onOpenSuperAdmin,
  onLanguageChange,
  onBackupClick,
  onOpenLogin,
  onLogout,
  onOpenAuditLogs,
  onOpenSyncDetails,
  onFlushQueue,
  lowStockCount,
  activeOrdersCount,
  onToggleSound,
  onToggleSidebar,
  isSidebarCollapsed,
  onOpenQuickActions,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onSwitchRole,
  canFreeSwitchRole = false,
  isMasterOwnerGoogle = false,
  cloudSyncStatus = 'local',
  cloudUserEmail = null,
  onGoogleOwnerLogin,
  ownerControlLocked = true,
  onOpenMobileQR
}) => {
  const t = TRANSLATIONS[lang];
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const resolvedLogo = sanitizeBusinessLogoUrl(settings.logoUrl) || sanitizeBusinessLogoUrl(activeBusiness?.logo);
  const [logoLoadError, setLogoLoadError] = useState(false);

  useEffect(() => {
    setLogoLoadError(false);
  }, [resolvedLogo]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const currentDate = new Date().toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const roleBadgeStyle: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-900 border-purple-300 font-extrabold',
    OWNER: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
    ADMIN: 'bg-rose-50 text-rose-800 border-rose-300',
    MANAGER: 'bg-purple-50 text-purple-800 border-purple-300',
    CASHIER: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    WAITER: 'bg-blue-50 text-blue-800 border-blue-300',
    KITCHEN: 'bg-amber-50 text-amber-800 border-amber-300',
    RECEPTIONIST: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    HOUSEKEEPING: 'bg-slate-100 text-slate-800 border-slate-300',
    ACCOUNTANT: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    INVENTORY_STAFF: 'bg-amber-100 text-amber-900 border-amber-300'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Sidebar Toggle & Foodmandu-Style Restaurant Switcher */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title="Toggle Sidebar Navigation"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 shadow-2xs"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}

            {/* Foodmandu-Style Restaurant Selector Dropdown Button */}
            <button
              onClick={onOpenBusinessSwitcher}
              title="Click to switch restaurant / business branch"
              className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-300/80 bg-white hover:bg-slate-50 text-slate-800 transition-all shadow-2xs group"
            >
              {resolvedLogo && !logoLoadError ? (
                <img
                  src={resolvedLogo}
                  alt={settings.businessName || 'Business Logo'}
                  onError={() => setLogoLoadError(true)}
                  className="h-7 w-7 rounded-lg object-cover border border-slate-200 bg-white shrink-0 shadow-2xs"
                />
              ) : (
                <div className="h-7 w-7 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  <Building2 className="h-4 w-4" />
                </div>
              )}
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-orange-600 transition-colors truncate max-w-[120px] sm:max-w-[220px]">
                    {lang === 'ne' && settings.nepaliBusinessName ? settings.nepaliBusinessName : settings.businessName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                </div>
              </div>
            </button>

            {/* Smart Search & Quick Actions Palette Button */}
            {onOpenQuickActions && (
              <>
                <button
                  type="button"
                  onClick={onOpenQuickActions}
                  title="Search records or execute quick action (Ctrl+K)"
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors text-xs font-semibold shadow-2xs group"
                >
                  <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-orange-600 transition-colors" />
                  <span className="text-slate-600">{lang === 'ne' ? 'खोज्नुहोस्...' : 'Quick Search...'}</span>
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono font-bold text-slate-400 shadow-2xs">
                    Ctrl+K
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={onOpenQuickActions}
                  title={lang === 'ne' ? 'खोज्नुहोस्' : 'Quick Search'}
                  className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80"
                >
                  <Search className="h-4 w-4 text-slate-600" />
                </button>
              </>
            )}
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {onOpenMobileQR && (
              <button
                type="button"
                onClick={onOpenMobileQR}
                title={lang === 'ne' ? 'मोबाइल पहुँच र डाउनलोड QR कोड देखाउनुहोस्' : 'Show Mobile Access & Download QR Code'}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <QrCode className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span className="hidden sm:inline">{lang === 'ne' ? 'मोबाइल QR' : 'Mobile QR'}</span>
              </button>
            )}
            <PWAInstallButton lang={lang} compact />
            {/* Cloud Account / Master Owner Verification Pill */}
            <button
              type="button"
              onClick={() => {
                if (!cloudUserEmail && onGoogleOwnerLogin) {
                  onGoogleOwnerLogin();
                } else {
                  onOpenLogin();
                }
              }}
              title={cloudUserEmail ? `Cloud Connected: ${cloudUserEmail}` : 'Connect Google account for Mobile ↔ Laptop Cloud Sync'}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                cloudSyncStatus === 'connected'
                  ? isMasterOwnerGoogle
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : cloudSyncStatus === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                cloudSyncStatus === 'connected'
                  ? isMasterOwnerGoogle ? 'bg-amber-500' : 'bg-emerald-500'
                  : cloudSyncStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : cloudSyncStatus === 'error'
                  ? 'bg-rose-500'
                  : 'bg-slate-400'
              }`} />
              <span>
                {cloudSyncStatus === 'connected'
                  ? (isMasterOwnerGoogle ? (lang === 'ne' ? 'App Creator Sync' : 'App Creator Sync') : (lang === 'ne' ? 'Cloud Sync' : 'Cloud Sync'))
                  : cloudSyncStatus === 'connecting'
                  ? 'Connecting...'
                  : (lang === 'ne' ? 'Google Sync जोड्नुहोस्' : 'Connect Cloud')}
              </span>
            </button>

            {/* Smart Notifications Bell Button */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                title="Notifications & Smart Alerts"
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200/80"
              >
                <Bell className="h-4 w-4 text-slate-600" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-orange-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Quick status indicators */}
            <div className="hidden lg:flex items-center gap-3 text-xs text-slate-600 border-r border-slate-200 pr-3">
              <div>
                <span className="text-slate-400 font-normal">{lang === 'ne' ? 'चालु अर्डर:' : 'Active:'} </span>
                <span className="font-semibold text-slate-800 font-mono-num">{activeOrdersCount}</span>
              </div>
              {lowStockCount > 0 && (
                <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>{lowStockCount} {lang === 'ne' ? 'कम स्टक' : 'Low Stock'}</span>
                </div>
              )}
            </div>

            {/* Staff Role Badge & Quick Switcher Dropdown */}
            {currentSession ? (
              <div className="relative flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                <div className="text-left hidden sm:block px-1">
                  <span className="text-[10px] text-slate-500 block leading-none">
                    {isMasterOwnerGoogle ? 'App Creator:' : 'Signed in:'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[100px]">{currentSession.name}</span>
                </div>
                
                {/* Interactive Role Switcher ONLY for Verified Master Owner; strict static role badge for assigned staff */}
                {canFreeSwitchRole ? (
                  <button
                    type="button"
                    onClick={() => setShowRoleMenu(!showRoleMenu)}
                    title="Switch preview role / workspace"
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border transition-all hover:brightness-95 cursor-pointer shadow-2xs ${roleBadgeStyle[currentSession.role] || 'bg-slate-100 text-slate-800'}`}
                  >
                    <span>{currentSession.role}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                ) : (
                  <span
                    title={lang === 'ne' ? 'Admin द्वारा तोकिएको भूमिका' : 'Role assigned by Admin'}
                    className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${roleBadgeStyle[currentSession.role] || 'bg-slate-100 text-slate-800'}`}
                  >
                    {ownerControlLocked && <Lock className="h-2.5 w-2.5 opacity-75" />}
                    <span>{currentSession.role}</span>
                  </span>
                )}

                {/* Role Switcher Popover Menu — Only rendered for verified Owner */}
                {canFreeSwitchRole && showRoleMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900 flex items-center justify-between">
                        <span>{lang === 'ne' ? 'कर्मचारी भूमिका प्रीभ्यू' : isMasterOwnerGoogle ? 'Creator Role Switcher' : 'Owner Role Preview'}</span>
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {lang === 'ne'
                          ? 'प्रमाणित पहुँच: जुनसुकै भूमिका प्रीभ्यू गर्नुहोस्'
                          : isMasterOwnerGoogle
                          ? 'Verified App Creator: control SaaS hub or preview any staff role'
                          : 'Verified Owner: preview any staff workspace'}
                      </p>
                    </div>

                    <div className="py-1 max-h-72 overflow-y-auto space-y-0.5">
                      {[
                        ...(isMasterOwnerGoogle
                          ? [{ role: 'SUPER_ADMIN' as StaffRole, title: 'App Creator (Global)', desc: 'All Businesses, Cloud Sync & SaaS Plans', icon: '🛡️' }]
                          : []),
                        { role: 'OWNER' as StaffRole, title: 'Owner / Admin', desc: 'Control Center & Business Overview', icon: '👑' },
                        { role: 'MANAGER' as StaffRole, title: 'Manager', desc: 'Operations Dashboard, Sales & Staff', icon: '👔' },
                        { role: 'CASHIER' as StaffRole, title: 'Cashier', desc: 'POS Terminal, Invoices & Closing', icon: '💳' },
                        { role: 'WAITER' as StaffRole, title: 'Waiter', desc: 'Dining Tables & Live KOT Taking', icon: '🍽️' },
                        { role: 'KITCHEN' as StaffRole, title: 'Kitchen Staff', desc: 'Kitchen Display System (KDS)', icon: '👨‍🍳' },
                        { role: 'RECEPTIONIST' as StaffRole, title: 'Receptionist', desc: 'Front Desk & Guest Reservations', icon: '🛎️' },
                        { role: 'HOUSEKEEPING' as StaffRole, title: 'Housekeeping', desc: 'Room Cleaning & Maintenance', icon: '🧹' },
                        { role: 'INVENTORY_STAFF' as StaffRole, title: 'Inventory Staff', desc: 'Raw Stock & Recipe Ingredients', icon: '📦' },
                        { role: 'ACCOUNTANT' as StaffRole, title: 'Accountant', desc: 'Financial Reports & Receivables', icon: '📊' }
                      ].map((item) => {
                        const isActive = currentSession.role === item.role;
                        return (
                          <button
                            key={item.role}
                            type="button"
                            onClick={() => {
                              setShowRoleMenu(false);
                              if (onSwitchRole) onSwitchRole(item.role);
                            }}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors ${
                              isActive 
                                ? 'bg-orange-50 border border-orange-200 text-orange-950 font-bold' 
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{item.icon}</span>
                              <div>
                                <p className="text-xs font-bold leading-tight flex items-center gap-1.5">
                                  <span>{item.title}</span>
                                  {isActive && <span className="text-[9px] bg-orange-600 text-white px-1.5 py-0.2 rounded-full font-bold">Active</span>}
                                </p>
                                <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{item.desc}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">{item.role}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between px-1 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRoleMenu(false);
                          onOpenLogin();
                        }}
                        className="text-[11px] text-slate-700 hover:text-slate-950 font-semibold p-1 hover:underline"
                      >
                        {lang === 'ne' ? 'अर्को खाता लग-इन...' : 'Switch account...'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRoleMenu(false)}
                        className="text-[11px] text-slate-400 hover:text-slate-700 p-1"
                      >
                        {lang === 'ne' ? 'बन्द' : 'Close'}
                      </button>
                    </div>
                  </div>
                )}

                {(currentSession.role === 'ADMIN' || currentSession.role === 'MANAGER' || currentSession.role === 'SUPER_ADMIN' || currentSession.role === 'OWNER') && onOpenAuditLogs && (
                  <button
                    onClick={onOpenAuditLogs}
                    title="View System Security Audit Logs"
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                  >
                    <History className="h-4 w-4" />
                  </button>
                )}

                {(currentSession.role === 'SUPER_ADMIN' || isMasterOwnerGoogle) && onOpenSuperAdmin && (
                  <button
                    onClick={onOpenSuperAdmin}
                    title="App Creator & SaaS Control Hub"
                    className="p-1.5 text-purple-700 hover:text-purple-900 hover:bg-purple-100 rounded transition-colors"
                  >
                    <Sliders className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenLogin}
                  title={lang === 'ne' ? 'अर्को खातामा लग-इन (रद्द गर्न मिल्ने)' : 'Switch user account'}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  title={lang === 'ne' ? 'लग-आउट (Sign Out)' : 'Sign Out / Lock Terminal'}
                  className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
              >
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Staff Sign In</span>
              </button>
            )}

            {/* Real-Time Sync & Offline Connection Indicator */}
            <SyncStatusBadge
              businessId={activeBusiness?.businessId || 'biz-himalayan-breeze'}
              lang={lang}
              onOpenSyncDetails={onOpenSyncDetails}
              onFlushQueue={onFlushQueue}
            />

            {/* Sound Toggle */}
            <button
              onClick={onToggleSound}
              title={settings.enableSoundEffects ? 'Mute sound' : 'Enable sound'}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {settings.enableSoundEffects ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {/* Backup Button */}
            <button
              onClick={onBackupClick}
              title={lang === 'ne' ? 'कम्प्युटरमा डेटा ब्याकअप सुरक्षित गर्नुहोस्' : 'Download Complete Data Backup'}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span>{lang === 'ne' ? 'ब्याकअप' : 'Backup'}</span>
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => onLanguageChange('ne')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  lang === 'ne' 
                    ? 'bg-white text-emerald-800 font-semibold shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                नेपाली
              </button>
              <button
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  lang === 'en' 
                    ? 'bg-white text-emerald-800 font-semibold shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
