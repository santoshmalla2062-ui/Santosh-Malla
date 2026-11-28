import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Volume2,
  VolumeX,
  Lock,
  History,
  ChevronDown,
  Sliders,
  Menu,
  Search,
  Bell,
  LogOut,
  ArrowRightLeft,
  Check
} from 'lucide-react';
import { BusinessSettings, BusinessTenant, Session, StaffRole } from '../types';
import { Language } from '../utils/translations';
import { sanitizeBusinessLogoUrl } from '../utils/imageUtils';

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
  canSwitchBusiness?: boolean;
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
  onToggleSound,
  onToggleSidebar,
  onOpenQuickActions,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onSwitchRole,
  canFreeSwitchRole = false,
  isMasterOwnerGoogle = false,
  cloudSyncStatus = 'local',
  ownerControlLocked = true,
  canSwitchBusiness = false
}) => {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showRoleList, setShowRoleList] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const resolvedLogo =
    sanitizeBusinessLogoUrl(settings.logoUrl) || sanitizeBusinessLogoUrl(activeBusiness?.logo);
  const [logoLoadError, setLogoLoadError] = useState(false);

  useEffect(() => {
    setLogoLoadError(false);
  }, [resolvedLogo]);

  useEffect(() => {
    if (!showAccountMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
        setShowRoleList(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAccountMenu(false);
        setShowRoleList(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [showAccountMenu]);

  const canSwitchBranch = Boolean(
    onOpenBusinessSwitcher &&
    (currentSession?.role === 'SUPER_ADMIN' || canSwitchBusiness)
  );

  const canViewAuditLogs =
    currentSession?.role === 'ADMIN' ||
    currentSession?.role === 'MANAGER' ||
    currentSession?.role === 'SUPER_ADMIN' ||
    currentSession?.role === 'OWNER';

  const displayInitial = (currentSession?.name || 'U').trim().charAt(0).toUpperCase();

  const roleBadgeStyle: Record<string, string> = {
    SUPER_ADMIN: 'bg-slate-900 text-white',
    OWNER: 'bg-amber-100 text-amber-900',
    ADMIN: 'bg-rose-100 text-rose-900',
    MANAGER: 'bg-purple-100 text-purple-900',
    CASHIER: 'bg-emerald-100 text-emerald-900',
    WAITER: 'bg-blue-100 text-blue-900',
    KITCHEN: 'bg-amber-100 text-amber-900',
    RECEPTIONIST: 'bg-cyan-100 text-cyan-900',
    HOUSEKEEPING: 'bg-slate-200 text-slate-800',
    ACCOUNTANT: 'bg-indigo-100 text-indigo-900',
    INVENTORY_STAFF: 'bg-amber-100 text-amber-900'
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-3">
          {/* Left: Sidebar Toggle & Clean Business Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                aria-label="Toggle Sidebar Navigation"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 shrink-0"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={canSwitchBranch ? onOpenBusinessSwitcher : undefined}
              disabled={!canSwitchBranch}
              title={
                canSwitchBranch
                  ? lang === 'ne'
                    ? 'शाखा / व्यवसाय परिवर्तन गर्नुहोस्'
                    : 'Switch business branch'
                  : settings.businessName
              }
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100/80 disabled:hover:bg-transparent disabled:cursor-default text-slate-900 transition-colors min-w-0 group"
            >
              {resolvedLogo && !logoLoadError ? (
                <img
                  src={resolvedLogo}
                  alt={settings.businessName || 'Business Logo'}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoLoadError(true)}
                  className="h-7 w-7 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                />
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
                  alt={settings.businessName || 'CAFE HOST'}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-lg object-cover border border-slate-200 bg-slate-900 shrink-0"
                />
              )}
              <span className="font-bold text-xs sm:text-sm text-slate-900 truncate max-w-[160px] sm:max-w-[260px]">
                {lang === 'ne' && settings.nepaliBusinessName
                  ? settings.nepaliBusinessName
                  : settings.businessName}
              </span>
              {canSwitchBranch && (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
              )}
            </button>
          </div>

          {/* Right: Bell Notifications, Language Switcher, Compact Account Menu */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                aria-label={lang === 'ne' ? 'सूचनाहरू' : 'Notifications'}
                title={lang === 'ne' ? 'सूचना तथा अलर्टहरू' : 'Notifications & Smart Alerts'}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 bg-orange-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => onLanguageChange('ne')}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                  lang === 'ne'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                नेपाली
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                  lang === 'en'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
            </div>

            {currentSession ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu((prev) => !prev);
                    setShowRoleList(false);
                  }}
                  aria-expanded={showAccountMenu}
                  aria-label="Account Menu"
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                >
                  <span className="h-7 w-7 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {displayInitial}
                  </span>
                  <div className="hidden sm:block text-left leading-tight">
                    <span className="text-xs font-bold text-slate-900 block max-w-[110px] truncate">
                      {currentSession.name}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block">
                      {currentSession.role}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </button>

                {showAccountMenu && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* User Identity Summary */}
                    <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {currentSession.name}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              cloudSyncStatus === 'connected'
                                ? 'bg-emerald-500'
                                : cloudSyncStatus === 'connecting'
                                ? 'bg-amber-400'
                                : cloudSyncStatus === 'error'
                                ? 'bg-rose-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span>
                            {cloudSyncStatus === 'connected'
                              ? lang === 'ne'
                                ? 'क्लाउड सिङ्क सक्रिय'
                                : 'Cloud Sync Active'
                              : lang === 'ne'
                              ? 'लोकल मोड'
                              : 'Local Mode'}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 inline-flex items-center gap-1 ${
                          roleBadgeStyle[currentSession.role] || 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {!canFreeSwitchRole && ownerControlLocked && (
                          <Lock className="h-2.5 w-2.5 opacity-70" />
                        )}
                        <span>{currentSession.role}</span>
                      </span>
                    </div>

                    <div className="py-1 space-y-0.5 text-xs">
                      {canFreeSwitchRole && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowRoleList((prev) => !prev)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-800 font-semibold transition-colors"
                          >
                            <span>
                              {lang === 'ne' ? 'रोल प्रीभ्यू बदल्नुहोस्' : 'Switch Role Preview'}
                            </span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                                showRoleList ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {showRoleList && (
                            <div className="mx-1 mb-1 p-1 bg-slate-50 border border-slate-200 rounded-xl max-h-52 overflow-y-auto space-y-0.5">
                              {[
                                ...(isMasterOwnerGoogle
                                  ? [{ role: 'SUPER_ADMIN' as StaffRole, label: 'App Creator (Global)' }]
                                  : []),
                                { role: 'OWNER' as StaffRole, label: 'Owner / Admin' },
                                { role: 'MANAGER' as StaffRole, label: 'Manager' },
                                { role: 'CASHIER' as StaffRole, label: 'Cashier' },
                                { role: 'WAITER' as StaffRole, label: 'Waiter' },
                                { role: 'KITCHEN' as StaffRole, label: 'Kitchen (KDS)' },
                                { role: 'RECEPTIONIST' as StaffRole, label: 'Receptionist' },
                                { role: 'HOUSEKEEPING' as StaffRole, label: 'Housekeeping' },
                                { role: 'INVENTORY_STAFF' as StaffRole, label: 'Inventory Staff' },
                                { role: 'ACCOUNTANT' as StaffRole, label: 'Accountant' }
                              ].map((item) => {
                                const isActive = currentSession.role === item.role;
                                return (
                                  <button
                                    key={item.role}
                                    type="button"
                                    onClick={() => {
                                      setShowAccountMenu(false);
                                      setShowRoleList(false);
                                      if (onSwitchRole) onSwitchRole(item.role);
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                                      isActive
                                        ? 'bg-emerald-700 text-white'
                                        : 'text-slate-700 hover:bg-white'
                                    }`}
                                  >
                                    <span>{item.label}</span>
                                    {isActive && <Check className="h-3 w-3" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {onOpenQuickActions && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAccountMenu(false);
                            onOpenQuickActions();
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Search className="h-3.5 w-3.5 text-slate-500" />
                            <span>{lang === 'ne' ? 'खोज्नुहोस्' : 'Quick Search'}</span>
                          </span>
                          <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 border border-slate-200 rounded font-mono text-slate-500">
                            Ctrl+K
                          </kbd>
                        </button>
                      )}

                      {currentSession.role === 'SUPER_ADMIN' && onOpenSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAccountMenu(false);
                            onOpenSuperAdmin();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                        >
                          <Sliders className="h-3.5 w-3.5 text-purple-600" />
                          <span>{lang === 'ne' ? 'क्रिएटर हब' : 'App Creator Hub'}</span>
                        </button>
                      )}

                      {canViewAuditLogs && onOpenAuditLogs && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAccountMenu(false);
                            onOpenAuditLogs();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                        >
                          <History className="h-3.5 w-3.5 text-slate-500" />
                          <span>{lang === 'ne' ? 'अडिट लगहरू' : 'Security Audit Logs'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onToggleSound();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {settings.enableSoundEffects ? (
                            <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          <span>{lang === 'ne' ? 'ध्वनि अलर्ट' : 'Sound Effects'}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {settings.enableSoundEffects ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountMenu(false);
                          onBackupClick();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>{lang === 'ne' ? 'डेटा ब्याकअप' : 'Export Backup'}</span>
                      </button>
                    </div>

                    <div className="pt-1.5 mt-1 border-t border-slate-100 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountMenu(false);
                          onOpenLogin();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
                        <span>{lang === 'ne' ? 'अर्को खाता लग-इन' : 'Switch Account'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-700 font-semibold transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>{lang === 'ne' ? 'लग-आउट (Sign Out)' : 'Sign Out'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
              >
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>{lang === 'ne' ? 'साइन इन' : 'Sign In'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
