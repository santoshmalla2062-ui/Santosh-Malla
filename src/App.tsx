import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, signInWithGooglePopup, signOutFirebase } from './firebase';
import { 
  AppState, 
  BusinessSettings, 
  BusinessTenant,
  Customer, 
  DayClosingRecord,
  Expense,
  InventoryItem, 
  InventoryLog, 
  KhataTransaction, 
  MenuItem, 
  Order, 
  OrderItem,
  OrderStatus,
  Session,
  StaffRole,
  StaffUser,
  TableRoom, 
  TableRoomStatus 
} from './types';
import { 
  getInitialAppState, 
  saveAppState, 
  exportBackupJSON, 
  INITIAL_MENU_ITEMS, 
  INITIAL_TABLES_ROOMS, 
  INITIAL_ORDERS, 
  INITIAL_INVENTORY, 
  INITIAL_LOGS, 
  INITIAL_CUSTOMERS, 
  INITIAL_KHATA, 
  INITIAL_EXPENSES,
  INITIAL_DAY_CLOSINGS,
  INITIAL_STAFF_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_ROOM_TYPES,
  INITIAL_RESORT_ROOMS,
  INITIAL_GUEST_PROFILES,
  INITIAL_RESERVATIONS,
  INITIAL_GUEST_FOLIOS,
  INITIAL_RESORT_SERVICES,
  INITIAL_HOUSEKEEPING_TASKS,
  INITIAL_MAINTENANCE_ISSUES,
  INITIAL_HOTEL_PAYMENTS,
  DEFAULT_SETTINGS 
} from './services/storage';
import { 
  acceptStaffInvitation,
  getRegisteredBusinesses, 
  getActiveBusinessId, 
  setActiveBusinessId, 
  loadTenantAppState, 
  saveTenantAppState, 
  updateBusiness,
  deleteBusiness,
  upsertSyncedCloudBusinesses,
  INITIAL_BUSINESS_TENANTS 
} from './services/tenantStorage';
import { 
  clearSession, 
  createAuditLog, 
  getCurrentSession, 
  hasPermission, 
  hashPinWithSalt,
  isSessionValid, 
  saveSession, 
  SESSION_STORAGE_KEY,
  validateBackupJSON, 
  validateExpense, 
  validateInventoryStock, 
  validateRoomCheckIn, 
  validateStockChange, 
  verifyFinancialCalculations 
} from './services/security';
import {
  ALL_SYNC_CHANNELS,
  CloudAccessResolution,
  SyncChannelId,
  backfillShardedSubcollections,
  bootstrapMasterOwnerWorkspace,
  canFreeSwitchRoles,
  canRoleWriteChannel,
  extractChannelPayload,
  fetchOlderShardedOrdersPage,
  isMasterOwnerUser,
  isValidFirestoreId,
  listAllCloudBusinessesForCreator,
  MASTER_OWNER_EMAIL,
  mergeChannelPayloadIntoAppState,
  pushSyncChannelToCloud,
  reserveAtomicSequenceNumber,
  resolveCloudMemberAccess,
  subscribeToBusinessCloudChannels,
  syncAuditLogToCloud,
  syncCreditNoteToCloud,
  syncJournalEntryToCloud,
  syncOrderDocumentToCloud,
  updateCloudBusinessPolicy
} from './services/cloudSyncService';
import {
  createCreditNoteFromOrder,
  formatBsIsoDate,
  getNepalFiscalYear,
  getNextCreditNoteNumber,
  submitCbmsInvoiceToEndpoint
} from './services/irdCompliance';
import {
  postCreditNoteJournal,
  postExpenseJournal,
  postKhataPaymentJournal,
  postOrderSettlementJournal
} from './services/generalLedger';
import { getHomeConfigForRole, isTabPermittedForRole } from './services/roleNavigation';
import { getUserPreferences } from './services/userPreferences';
import { Language } from './utils/translations';
import { isOrderKotExpired, nowIsoString } from './utils/timeUtils';
import {
  AppNotification,
  getConsolidatedNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from './services/notificationService';
import { resolveOrderItemRecipeIngredients } from './services/orderAudit';
import {
  subscribeToTenantSync,
  SyncEvent,
  isNetworkOnline,
  checkAndRegisterIdempotencyKey,
  resolveOrderMutationIdempotencyKey,
  validateOptimisticVersion,
  enqueueOfflineDraft,
  broadcastSyncEvent,
  flushOfflineQueue,
  clearSensitiveCachesOnLogout
} from './services/syncService';
import { ActiveTab, SidebarNavigation } from './components/SidebarNavigation';
import { Header } from './components/Header';
import { BusinessDashboardView } from './components/dashboard/BusinessDashboardView';
import { POSView } from './components/pos/POSView';
import { BillsView } from './components/pos/BillsView';
import { TableRoomView } from './components/tables/TableRoomView';
import { ResortMainView } from './components/resort/ResortMainView';
import { KitchenDisplayView } from './components/kds/KitchenDisplayView';
import { InventoryView } from './components/inventory/InventoryView';
import { CustomerView } from './components/customers/CustomerView';
import { DayClosingView } from './components/expenses/DayClosingView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { BusinessAdminView } from './components/admin/BusinessAdminView';
import { MobileBottomBar } from './components/common/MobileBottomBar';
import { QuickActionsModal } from './components/common/QuickActionsModal';
import { NotificationDrawerModal } from './components/common/NotificationDrawerModal';
import { OfflineIndicator } from './components/common/PWAInstallButton';
import { AppDownloadModal } from './components/common/AppDownloadModal';
import { MobileAccessQRModal } from './components/common/MobileAccessQRModal';
import { isDownloadRouteRequested } from './utils/distribution';
import { sanitizeBusinessLogoUrl } from './utils/imageUtils';
import { LoginModal } from './components/auth/LoginModal';
import { AuditLogModal } from './components/audit/AuditLogModal';
import { BusinessSwitcherModal } from './components/tenant/BusinessSwitcherModal';
import { RegisterBusinessModal } from './components/tenant/RegisterBusinessModal';
import { SuperAdminBusinessManagerModal } from './components/tenant/SuperAdminBusinessManagerModal';
import { BusinessSetupWizardModal } from './components/admin/BusinessSetupWizardModal';
import { SyncResilienceTestModal } from './components/admin/SyncResilienceTestModal';
import { ShieldAlert, X } from 'lucide-react';

export default function App() {
  // Multi-Business / Multi-Tenant State (honors ?biz=<businessId> invite deep link on fresh devices)
  const [businesses, setBusinesses] = useState<BusinessTenant[]>(() => {
    const initialList = getRegisteredBusinesses();
    if (typeof window !== 'undefined') {
      try {
        const bizParam = new URLSearchParams(window.location.search).get('biz')?.trim();
        if (bizParam && isValidFirestoreId(bizParam) && !initialList.some(b => b.businessId === bizParam)) {
          return upsertSyncedCloudBusinesses([{ businessId: bizParam, businessName: 'Cloud Workspace' }]);
        }
      } catch {
        // Ignore URL parsing issues
      }
    }
    return initialList;
  });
  const [activeBusinessId, setActiveBusinessIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const bizParam = new URLSearchParams(window.location.search).get('biz')?.trim();
        if (bizParam && isValidFirestoreId(bizParam)) {
          setActiveBusinessId(bizParam);
          return bizParam;
        }
      } catch {
        // Ignore URL parsing issues
      }
    }
    return getActiveBusinessId();
  });
  const [showBusinessSwitcherModal, setShowBusinessSwitcherModal] = useState<boolean>(false);
  const [showRegisterBusinessModal, setShowRegisterBusinessModal] = useState<boolean>(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState<boolean>(false);
  const [showSetupWizardModal, setShowSetupWizardModal] = useState<boolean>(false);

  const activeBusiness = businesses.find(b => b.businessId === activeBusinessId) || businesses[0] || INITIAL_BUSINESS_TENANTS[0];

  // Load state from local storage or defaults for the active enterprise
  const [appState, setAppState] = useState<AppState>(() => loadTenantAppState(activeBusinessId));
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const sess = getCurrentSession();
      if (sess?.role) {
        return getHomeConfigForRole(sess.role).defaultTab;
      }
    } catch {
      // fallback
    }
    return 'dashboard';
  });
  const [adminInitialTab, setAdminInitialTab] = useState<any>('dashboard');
  const [selectedTableForPOS, setSelectedTableForPOS] = useState<string>('tr-1');
  const [posNavigationNonce, setPosNavigationNonce] = useState<number>(0);
  const [pendingCheckoutOrderId, setPendingCheckoutOrderId] = useState<string | null>(null);
  const [pendingEditOrderId, setPendingEditOrderId] = useState<string | null>(null);
  const [pendingPosOrderType, setPendingPosOrderType] = useState<'dine_in' | 'takeaway' | 'delivery' | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [language, setLanguage] = useState<Language>(appState.settings.defaultLanguage || 'ne');

  // Foodmandu Sidebar Navigation State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('himalayan_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('himalayan_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Authentication & Session State — Do NOT auto-sign unauthenticated devices into OWNER!
  const [currentSession, setCurrentSession] = useState<Session | null>(() => {
    const existing = getCurrentSession();
    return existing || null;
  });

  const [showLoginModal, setShowLoginModal] = useState<boolean>(() => !getCurrentSession());
  const [showDownloadPortal, setShowDownloadPortal] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    isDownloadRouteRequested(window.location.search, window.location.pathname)
  );
  const [showMobileQRModal, setShowMobileQRModal] = useState<boolean>(false);
  const [showAuditLogModal, setShowAuditLogModal] = useState<boolean>(false);

  const handleCloseDownloadPortal = useCallback(() => {
    setShowDownloadPortal(false);
    if (
      typeof window !== 'undefined' &&
      isDownloadRouteRequested(window.location.search, window.location.pathname)
    ) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('download');
        const cleanedPath = url.pathname === '/download' ? '/' : url.pathname;
        const cleanedQuery = url.searchParams.toString();
        window.history.replaceState({}, '', `${cleanedPath}${cleanedQuery ? `?${cleanedQuery}` : ''}`);
      } catch {
        // Ignore history restriction in embedded environments
      }
    }
  }, []);
  const [showSyncTestModal, setShowSyncTestModal] = useState<boolean>(false);
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [showQuickActionsModal, setShowQuickActionsModal] = useState<boolean>(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);

  // Firebase Auth & Real-Time Firestore Multi-Device Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState<boolean>(false);
  const [cloudAccess, setCloudAccess] = useState<CloudAccessResolution | null>(null);
  const [cloudOwnerUid, setCloudOwnerUid] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'connected' | 'local' | 'error' | 'connecting'>('local');
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState<boolean>(false);
  const [cloudAuthError, setCloudAuthError] = useState<string | null>(null);

  const isApplyingRemoteSyncRef = useRef<boolean>(false);
  const canPushCloudChannelsRef = useRef<boolean>(false);
  const channelFingerprintRef = useRef<Partial<Record<SyncChannelId, string>>>({});
  const channelRevisionRef = useRef<Partial<Record<SyncChannelId, number>>>({});
  const cloudUnsubscribeRef = useRef<(() => void) | null>(null);
  const explicitGoogleSignInRef = useRef<boolean>(false);
  const oldestShardedOrderCursorRef = useRef<number | null>(null);
  const [hasMoreCloudOrders, setHasMoreCloudOrders] = useState<boolean>(false);
  const [isLoadingOlderCloudOrders, setIsLoadingOlderCloudOrders] = useState<boolean>(false);
  const cloudOrderIdsRef = useRef<Set<string>>(new Set());
  const cloudCreditNoteIdsRef = useRef<Set<string>>(new Set());
  const cloudJournalIdsRef = useRef<Set<string>>(new Set());
  const cloudAuditIdsRef = useRef<Set<string>>(new Set());
  const hasBackfilledBusinessRef = useRef<string | null>(null);
  const appStateRef = useRef<AppState>(appState);
  appStateRef.current = appState;
  const activeBusinessRef = useRef<BusinessTenant>(activeBusiness);
  activeBusinessRef.current = activeBusiness;

  const ownerControlLocked = appState.settings?.securitySettings?.ownerControlLocked !== false;
  const isMasterOwnerGoogle = useMemo(() => isMasterOwnerUser(firebaseUser), [firebaseUser]);
  const isBusinessOwnerGoogle = useMemo(
    () =>
      cloudAccess?.status === 'MASTER_OWNER' ||
      (cloudAccess?.status === 'AUTHORIZED' && cloudAccess.isBusinessOwner),
    [cloudAccess]
  );
  const isOwnerOrMaster = isMasterOwnerGoogle || isBusinessOwnerGoogle;
  const userCanFreeSwitchRoles = useMemo(
    () =>
      canFreeSwitchRoles({
        currentRole: currentSession?.role,
        ownerControlLocked,
        isMasterOwnerGoogle,
        isBusinessOwnerGoogle
      }),
    [currentSession?.role, ownerControlLocked, isMasterOwnerGoogle, isBusinessOwnerGoogle]
  );
  const [notifications, setNotifications] = useState<AppNotification[]>(() => 
    getConsolidatedNotifications(loadTenantAppState(activeBusinessId), activeBusinessId)
  );

  useEffect(() => {
    setNotifications(getConsolidatedNotifications(appState, activeBusinessId, currentSession?.role));
  }, [appState, activeBusinessId, currentSession?.role]);

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowQuickActionsModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const isCurrentTabPermitted = useMemo(() => {
    return isTabPermittedForRole(activeTab, currentSession?.role, activeBusiness.enabledModules);
  }, [activeTab, currentSession?.role, activeBusiness.enabledModules]);

  const handleTabChange = useCallback((newTab: ActiveTab) => {
    if (!currentSession) {
      setActiveTab(newTab);
      return;
    }
    const permitted = isTabPermittedForRole(newTab, currentSession.role, activeBusiness.enabledModules);
    if (!permitted) {
      setSecurityAlert(`Access Restricted: Your role "${currentSession.role}" does not have permission to access ${newTab}. Returned to authorized workspace.`);
      const home = getHomeConfigForRole(currentSession.role, activeBusiness.enabledModules);
      setActiveTab(home.defaultTab);
      return;
    }
    setActiveTab(newTab);
  }, [currentSession, activeBusiness.enabledModules]);

  // Sync state to local storage on changes (Debounced per tenant with partition guard)
  useEffect(() => {
    // Prevent saving if appState is undergoing tenant transition
    if (appState.businessId && appState.businessId !== activeBusiness.businessId) {
      return;
    }
    setIsSaved(false);
    const timer = setTimeout(() => {
      saveTenantAppState(activeBusiness.businessId, appState);
      setIsSaved(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [appState, activeBusiness.businessId]);

  // Periodic Session Expiry and Health Verification
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentSession && !isSessionValid(currentSession)) {
        clearSession();
        setCurrentSession(null);
        setSecurityAlert('Session has expired. Please sign in to resume operations.');
        setShowLoginModal(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [currentSession]);

  // Safe retention check: prevent active KOT orders from prematurely vanishing
  useEffect(() => {
    const checkKOTExpiry = () => {
      const now = Date.now();
      const MAX_KOT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

      setAppState(prev => {
        let hasExpired = false;
        const updatedOrders = prev.orders.map(order => {
          if (order.kotStatus !== 'expired' && isOrderKotExpired(order, now, MAX_KOT_RETENTION_MS)) {
            hasExpired = true;
            return {
              ...order,
              kotStatus: 'expired' as const,
              specialInstructions: order.specialInstructions
                ? (order.specialInstructions.includes('Auto-Expired')
                    ? order.specialInstructions
                    : `${order.specialInstructions} [KOT Stale: Unaccepted after 24 hrs]`)
                : '[KOT Stale: Unaccepted after 24 hrs]'
            };
          }
          return order;
        });

        if (!hasExpired) return prev;
        return {
          ...prev,
          orders: updatedOrders
        };
      });
    };

    checkKOTExpiry();
    const interval = setInterval(checkKOTExpiry, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Sound effects generator using Web Audio API
  const playChime = useCallback((type: 'success' | 'alert' | 'beep' = 'success') => {
    if (!appState.settings.enableSoundEffects) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // AudioContext policy
    }
  }, [appState.settings.enableSoundEffects]);

  // Immutable Audit Trail Logger
  const recordAudit = useCallback((
    action: string, 
    targetRecordId?: string, 
    details?: string, 
    severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'
  ) => {
    const actor = currentSession 
      ? { id: currentSession.staffId, name: currentSession.name, role: currentSession.role }
      : { id: 'unauthenticated', name: 'Anonymous Terminal', role: 'WAITER' as StaffRole };

    const entry = createAuditLog(actor, action, targetRecordId, details || '', severity, activeBusiness.businessId);
    setAppState(prev => ({
      ...prev,
      auditLogs: [entry, ...(prev.auditLogs || [])]
    }));
  }, [currentSession, activeBusiness.businessId]);

  const handleQuickSwitchRole = useCallback((newRole: StaffRole) => {
    if (!userCanFreeSwitchRoles) {
      recordAudit('UNAUTHORIZED_ROLE_SWITCH_BLOCKED', newRole, `Attempted role switch to ${newRole} while Owner Control Lock is active`, 'WARNING');
      setSecurityAlert('Owner Control Lock: Enter Owner PIN or Master Owner Google sign-in to switch roles.');
      setShowLoginModal(true);
      playChime('alert');
      return;
    }

    const existing = appState.staffUsers.find(u => u.role === newRole);
    const matchingStaff: StaffUser = existing || {
      id: `staff_${newRole.toLowerCase()}`,
      username: `${newRole.toLowerCase()}_user`,
      name: `${newRole.charAt(0) + newRole.slice(1).toLowerCase().replace(/_/g, ' ')} User`,
      role: newRole,
      businessId: activeBusiness.businessId,
      isActive: true,
      salt: 'seed',
      pinHash: '',
      createdAt: new Date().toISOString()
    };
    const newSession: Session = saveSession(matchingStaff, 120, activeBusiness.businessId);
    setCurrentSession(newSession);
    playChime('success');
    const home = getHomeConfigForRole(newRole, activeBusiness.enabledModules);
    setActiveTab(home.defaultTab);
    recordAudit('STAFF_ROLE_SWITCHED', matchingStaff.id, `Workspace switched to ${newRole} (Home: ${home.defaultTab})`, 'INFO');
  }, [userCanFreeSwitchRoles, appState.staffUsers, activeBusiness.businessId, activeBusiness.enabledModules, playChime, recordAudit]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsFirebaseAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Google Popup Sign-In Handler (Master Owner or Owner-Invited Staff)
  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleAuthLoading(true);
    setCloudAuthError(null);
    explicitGoogleSignInRef.current = true;
    try {
      await signInWithGooglePopup();
    } catch (err: any) {
      explicitGoogleSignInRef.current = false;
      const msg = err?.message || 'Google Sign-In failed or was cancelled.';
      setCloudAuthError(msg);
      setSecurityAlert(msg);
    } finally {
      setIsGoogleAuthLoading(false);
    }
  }, []);

  const handleGoogleSignOut = useCallback(async () => {
    if (cloudUnsubscribeRef.current) {
      cloudUnsubscribeRef.current();
      cloudUnsubscribeRef.current = null;
    }
    canPushCloudChannelsRef.current = false;
    setCloudAccess(null);
    setCloudOwnerUid(null);
    setCloudSyncStatus('local');
    await signOutFirebase();
    clearSession();
    setCurrentSession(null);
    setShowLoginModal(true);
  }, []);

  // Cloud Access Resolution, Workspace Bootstrap (read-first) & Real-Time Firestore Listeners
  useEffect(() => {
    let cancelled = false;
    let backfillTimer: ReturnType<typeof setTimeout> | null = null;

    if (cloudUnsubscribeRef.current) {
      cloudUnsubscribeRef.current();
      cloudUnsubscribeRef.current = null;
    }
    canPushCloudChannelsRef.current = false;
    channelFingerprintRef.current = {};
    oldestShardedOrderCursorRef.current = null;
    setHasMoreCloudOrders(false);
    cloudOrderIdsRef.current = new Set();
    cloudCreditNoteIdsRef.current = new Set();
    cloudJournalIdsRef.current = new Set();
    cloudAuditIdsRef.current = new Set();

    if (!isFirebaseAuthReady) return;
    if (!firebaseUser) {
      setCloudAccess(null);
      setCloudOwnerUid(null);
      setCloudSyncStatus('local');
      hasBackfilledBusinessRef.current = null;
      return;
    }

    const startCloudSync = async () => {
      setCloudSyncStatus('connecting');
      setCloudAuthError(null);
      try {
        const res = await resolveCloudMemberAccess(firebaseUser, activeBusiness.businessId);
        if (cancelled) return;

        if (res.status === 'REVOKED' || res.status === 'UNAUTHORIZED') {
          if (cloudUnsubscribeRef.current) {
            cloudUnsubscribeRef.current();
            cloudUnsubscribeRef.current = null;
          }
          setCloudAccess(res);
          setCloudOwnerUid(null);
          setCloudSyncStatus('error');
          setCloudAuthError(res.reason);
          setSecurityAlert(res.reason);
          await signOutFirebase();
          return;
        }

        let resolvedOwnerUid = res.ownerUid;
        let userIsOwnerOrMaster =
          res.status === 'MASTER_OWNER' || (res.status === 'AUTHORIZED' && res.isBusinessOwner);

        if (res.status === 'MASTER_OWNER') {
          const boot = await bootstrapMasterOwnerWorkspace(
            firebaseUser,
            activeBusinessRef.current,
            appStateRef.current
          );
          if (cancelled) return;
          resolvedOwnerUid = boot.ownerUid;

          // Seed merged remote channels into local state without triggering echo writes
          const channelEntries = Object.entries(boot.existingChannels) as [SyncChannelId, Record<string, any>][];
          if (channelEntries.length > 0) {
            isApplyingRemoteSyncRef.current = true;
            setAppState((prev) => {
              let merged = { ...prev };
              for (const [chId, chData] of channelEntries) {
                merged = mergeChannelPayloadIntoAppState(merged, chId, chData);
                const normalized = extractChannelPayload(chId, merged);
                channelFingerprintRef.current[chId] = JSON.stringify(normalized);
              }
              merged = {
                ...merged,
                settings: {
                  ...merged.settings,
                  businessName: boot.businessMeta.businessName || merged.settings.businessName,
                  nepaliBusinessName: boot.businessMeta.nepaliBusinessName || merged.settings.nepaliBusinessName,
                  currencySymbol: boot.businessMeta.currencySymbol || merged.settings.currencySymbol,
                  securitySettings: {
                    ...merged.settings.securitySettings,
                    sessionTimeoutMinutes: merged.settings.securitySettings?.sessionTimeoutMinutes || merged.settings.sessionTimeoutMinutes || 60,
                    requirePinForDiscounts: merged.settings.securitySettings?.requirePinForDiscounts ?? true,
                    requirePinForVoidOrder: merged.settings.securitySettings?.requirePinForVoidOrder ?? true,
                    requirePinForDayClose: merged.settings.securitySettings?.requirePinForDayClose ?? true,
                    strictTenantDataIsolation: merged.settings.securitySettings?.strictTenantDataIsolation ?? true,
                    allowSuperAdminAuditInspect: merged.settings.securitySettings?.allowSuperAdminAuditInspect ?? true,
                    ownerControlLocked: boot.businessMeta.ownerControlLocked !== false,
                    masterOwnerEmail: MASTER_OWNER_EMAIL
                  }
                }
              };
              return merged;
            });
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 300);
          } else {
            for (const chId of ALL_SYNC_CHANNELS) {
              const p = extractChannelPayload(chId, appStateRef.current);
              channelFingerprintRef.current[chId] = JSON.stringify(p);
            }
          }

          // Discover all cloud client workspaces for the App Creator
          listAllCloudBusinessesForCreator()
            .then((cloudBusinesses) => {
              if (cancelled || !cloudBusinesses || cloudBusinesses.length === 0) return;
              const merged = upsertSyncedCloudBusinesses(cloudBusinesses);
              setBusinesses(merged);
            })
            .catch((err) => console.warn('Cloud business directory sync warning:', err));

          // Hydrate verified App Creator session on fresh terminal or explicit Google Sign-In
          const activeSess = getCurrentSession();
          const forceOwnerSession = explicitGoogleSignInRef.current;
          explicitGoogleSignInRef.current = false;
          if (!activeSess || forceOwnerSession) {
            const creatorStaff: StaffUser = {
              id: firebaseUser.uid,
              username: res.email,
              name: firebaseUser.displayName || 'App Creator',
              nepaliName: 'एप क्रिएटर (App Creator)',
              role: 'SUPER_ADMIN',
              pinHash: '',
              salt: 'google-oauth',
              isActive: true,
              email: res.email,
              businessId: activeBusiness.businessId,
              createdAt: new Date().toISOString().split('T')[0]
            };
            const creatorSession = saveSession(creatorStaff, 120, activeBusiness.businessId);
            setCurrentSession(creatorSession);
            setShowLoginModal(false);
            setActiveTab('dashboard');
          }
        } else if (res.status === 'AUTHORIZED') {
          // Non-owner staff Google login MUST enforce exact Owner-approved role
          const staffUserObj: StaffUser = {
            id: firebaseUser.uid,
            username: res.email,
            name: res.name,
            nepaliName: res.name,
            role: res.role,
            pinHash: '',
            salt: 'google-oauth',
            isActive: true,
            email: res.email,
            businessId: activeBusiness.businessId,
            createdAt: new Date().toISOString().split('T')[0]
          };
          const enforcedSession = saveSession(staffUserObj, 120, activeBusiness.businessId);
          setCurrentSession(enforcedSession);
          setShowLoginModal(false);
          const home = getHomeConfigForRole(res.role, activeBusinessRef.current.enabledModules);
          setActiveTab(home.defaultTab);
        }

        setCloudAccess(res);
        setCloudOwnerUid(resolvedOwnerUid);

        // Attach real-time Firestore channel listeners
        const unsub = subscribeToBusinessCloudChannels({
          businessId: activeBusiness.businessId,
          userUid: firebaseUser.uid,
          effectiveRole: userIsOwnerOrMaster ? 'OWNER' : res.role,
          isOwnerOrMaster: userIsOwnerOrMaster,
          onChannelSnapshot: (channelId, data) => {
            isApplyingRemoteSyncRef.current = true;
            setAppState((prev) => {
              const merged = mergeChannelPayloadIntoAppState(prev, channelId, data);
              const normalized = extractChannelPayload(channelId, merged);
              channelFingerprintRef.current[channelId] = JSON.stringify(normalized);
              return merged;
            });
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
              canPushCloudChannelsRef.current = true;
            }, 300);
          },
          onBusinessMetaSnapshot: (meta) => {
            isApplyingRemoteSyncRef.current = true;
            if (
              meta.status !== undefined ||
              meta.enabledModules !== undefined ||
              meta.businessName !== undefined
            ) {
              const tenantPatch: Partial<BusinessTenant> = {};
              if (meta.status === 'ACTIVE' || meta.status === 'SUSPENDED') {
                tenantPatch.status = meta.status;
              }
              if (Array.isArray(meta.enabledModules) && meta.enabledModules.length > 0) {
                tenantPatch.enabledModules = meta.enabledModules;
              }
              if (meta.businessName) {
                tenantPatch.businessName = meta.businessName;
              }
              if (meta.nepaliBusinessName !== undefined) {
                tenantPatch.nepaliBusinessName = meta.nepaliBusinessName;
              }
              if (Object.keys(tenantPatch).length > 0) {
                const updatedTenant = updateBusiness(activeBusiness.businessId, tenantPatch);
                if (updatedTenant) {
                  setBusinesses(getRegisteredBusinesses());
                }
              }
            }
            setAppState((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                businessName: meta.businessName || prev.settings.businessName,
                nepaliBusinessName: meta.nepaliBusinessName || prev.settings.nepaliBusinessName,
                currencySymbol: meta.currencySymbol || prev.settings.currencySymbol,
                enableVat: meta.enableVat !== undefined ? meta.enableVat : prev.settings.enableVat,
                vatRatePercent: meta.vatRatePercent !== undefined ? meta.vatRatePercent : prev.settings.vatRatePercent,
                enableServiceCharge: meta.enableServiceCharge !== undefined ? meta.enableServiceCharge : prev.settings.enableServiceCharge,
                serviceChargePercent: meta.serviceChargePercent !== undefined ? meta.serviceChargePercent : prev.settings.serviceChargePercent,
                securitySettings: {
                  ...prev.settings.securitySettings,
                  sessionTimeoutMinutes: prev.settings.securitySettings?.sessionTimeoutMinutes || prev.settings.sessionTimeoutMinutes || 60,
                  requirePinForDiscounts: prev.settings.securitySettings?.requirePinForDiscounts ?? true,
                  requirePinForVoidOrder: prev.settings.securitySettings?.requirePinForVoidOrder ?? true,
                  requirePinForDayClose: prev.settings.securitySettings?.requirePinForDayClose ?? true,
                  strictTenantDataIsolation: prev.settings.securitySettings?.strictTenantDataIsolation ?? true,
                  allowSuperAdminAuditInspect: prev.settings.securitySettings?.allowSuperAdminAuditInspect ?? true,
                  ownerControlLocked: meta.ownerControlLocked !== false,
                  masterOwnerEmail: MASTER_OWNER_EMAIL
                }
              }
            }));
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 300);
          },
          onMemberSelfChanged: async (record) => {
            if (!record || !record.isActive) {
              // Revoke immediately — ALWAYS teardown listeners BEFORE signOutFirebase!
              if (cloudUnsubscribeRef.current) {
                cloudUnsubscribeRef.current();
                cloudUnsubscribeRef.current = null;
              }
              canPushCloudChannelsRef.current = false;
              setCloudAccess(null);
              setCloudOwnerUid(null);
              setCloudSyncStatus('error');
              await signOutFirebase();
              clearSession();
              setCurrentSession(null);
              setSecurityAlert('Device access revoked by Owner. Please contact the Owner.');
              setShowLoginModal(true);
              return;
            }
            // Live role update by Owner
            setCloudAccess((prev) =>
              prev && prev.status === 'AUTHORIZED' ? { ...prev, role: record.role } : prev
            );
            setCurrentSession((prevSess) => {
              if (!prevSess || prevSess.role === record.role) return prevSess;
              const updatedSess: Session = { ...prevSess, role: record.role };
              sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSess));
              const home = getHomeConfigForRole(record.role, activeBusinessRef.current.enabledModules);
              setActiveTab(home.defaultTab);
              setSecurityAlert(`Your role was updated to ${record.role} by the Owner.`);
              return updatedSess;
            });
          },
          onShardedOrdersSnapshot: (shardedOrders, meta) => {
            if (meta?.cloudOrderIds) {
              meta.cloudOrderIds.forEach((id) => cloudOrderIdsRef.current.add(id));
            }
            if (meta?.oldestTimestampMs !== undefined && meta.oldestTimestampMs !== null) {
              oldestShardedOrderCursorRef.current = meta.oldestTimestampMs;
              setHasMoreCloudOrders(shardedOrders.length >= 200);
            }
            isApplyingRemoteSyncRef.current = true;
            setAppState((prev) => mergeChannelPayloadIntoAppState(prev, 'orders_live', { orders: shardedOrders }));
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 250);
          },
          onShardedCreditNotesSnapshot: (shardedCns) => {
            shardedCns.forEach((cn) => cloudCreditNoteIdsRef.current.add(cn.id));
            isApplyingRemoteSyncRef.current = true;
            setAppState((prev) => {
              const map = new Map((prev.creditNotes || []).map(c => [c.id, c]));
              for (const cn of shardedCns) {
                map.set(cn.id, cn);
              }
              return {
                ...prev,
                creditNotes: Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
              };
            });
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 250);
          },
          onShardedJournalEntriesSnapshot: (shardedJournals) => {
            shardedJournals.forEach((je) => cloudJournalIdsRef.current.add(je.id));
            isApplyingRemoteSyncRef.current = true;
            setAppState((prev) => {
              const map = new Map((prev.journalEntries || []).map(j => [j.id, j]));
              for (const je of shardedJournals) {
                map.set(je.id, je);
              }
              return {
                ...prev,
                journalEntries: Array.from(map.values()).sort((a, b) =>
                  (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || '')
                )
              };
            });
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 250);
          },
          onShardedAuditLogsSnapshot: (shardedLogs) => {
            shardedLogs.forEach((log) => cloudAuditIdsRef.current.add(log.id));
            isApplyingRemoteSyncRef.current = true;
            setAppState((prev) => {
              const map = new Map((prev.auditLogs || []).map(l => [l.id, l]));
              for (const log of shardedLogs) {
                map.set(log.id, log);
              }
              return {
                ...prev,
                auditLogs: Array.from(map.values()).sort((a, b) =>
                  (b.timestamp || '').localeCompare(a.timestamp || '')
                )
              };
            });
            setTimeout(() => {
              isApplyingRemoteSyncRef.current = false;
            }, 250);
          }
        });

        cloudUnsubscribeRef.current = unsub;
        // Owner can immediately push new changes after bootstrap; staff wait for initial remote hydration
        setTimeout(() => {
          if (!cancelled) {
            canPushCloudChannelsRef.current = true;
          }
        }, userIsOwnerOrMaster ? 200 : 1000);

        // One-time idempotent startup backfill of legacy monolithic arrays into dedicated Firestore subcollections
        const resolvedRoleForBackfill: StaffRole = userIsOwnerOrMaster
          ? 'OWNER'
          : (res.status === 'AUTHORIZED' ? res.role : 'CASHIER');
        if (hasBackfilledBusinessRef.current !== activeBusiness.businessId) {
          backfillTimer = setTimeout(() => {
            if (cancelled) return;
            hasBackfilledBusinessRef.current = activeBusiness.businessId;
            backfillShardedSubcollections({
              businessId: activeBusiness.businessId,
              ownerUid: resolvedOwnerUid,
              userUid: firebaseUser.uid,
              effectiveRole: resolvedRoleForBackfill,
              isOwnerOrMaster: userIsOwnerOrMaster,
              state: appStateRef.current,
              knownCloudOrderIds: cloudOrderIdsRef.current,
              knownCloudCreditNoteIds: cloudCreditNoteIdsRef.current,
              knownCloudJournalIds: cloudJournalIdsRef.current,
              knownCloudAuditIds: cloudAuditIdsRef.current
            }).catch((err) => {
              console.warn('Sharded subcollection startup backfill warning:', err);
            });
          }, 1500);
        }

        setCloudSyncStatus('connected');
      } catch (err: any) {
        if (!cancelled) {
          setCloudSyncStatus('error');
          setCloudAuthError(err?.message || 'Could not establish cloud synchronization.');
        }
      }
    };

    startCloudSync();

    return () => {
      cancelled = true;
      if (backfillTimer) {
        clearTimeout(backfillTimer);
      }
      if (cloudUnsubscribeRef.current) {
        cloudUnsubscribeRef.current();
        cloudUnsubscribeRef.current = null;
      }
    };
  }, [isFirebaseAuthReady, firebaseUser, activeBusiness.businessId]);

  // Debounced role-gated outbound Firestore channel push (zero echo loops)
  useEffect(() => {
    if (cloudSyncStatus !== 'connected' || !firebaseUser || !cloudOwnerUid || !cloudAccess) return;
    if (isApplyingRemoteSyncRef.current || !canPushCloudChannelsRef.current) return;
    if (appState.businessId && appState.businessId !== activeBusiness.businessId) return;

    const effectiveRole: StaffRole =
      currentSession?.role ||
      (cloudAccess.status === 'AUTHORIZED' ? cloudAccess.role : 'OWNER');

    const timer = setTimeout(() => {
      if (isApplyingRemoteSyncRef.current || !canPushCloudChannelsRef.current) return;

      for (const channelId of ALL_SYNC_CHANNELS) {
        if (!canRoleWriteChannel(effectiveRole, channelId, isOwnerOrMaster)) {
          continue;
        }
        const payload = extractChannelPayload(channelId, appState);
        const fingerprint = JSON.stringify(payload);
        if (fingerprint === channelFingerprintRef.current[channelId]) {
          continue;
        }

        channelFingerprintRef.current[channelId] = fingerprint;
        const nextRev = (channelRevisionRef.current[channelId] || 1) + 1;
        channelRevisionRef.current[channelId] = nextRev;

        pushSyncChannelToCloud({
          businessId: activeBusiness.businessId,
          channelId,
          ownerUid: cloudOwnerUid,
          userUid: firebaseUser.uid,
          revision: nextRev,
          data: payload
        }).catch((err) => {
          console.error(`Cloud channel push failed (${channelId}):`, err);
        });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    appState,
    cloudSyncStatus,
    firebaseUser,
    cloudOwnerUid,
    cloudAccess,
    activeBusiness.businessId,
    currentSession?.role,
    isOwnerOrMaster
  ]);

  // Incrementally shard newly posted Journal Entries & Audit Logs into dedicated Firestore subcollections
  useEffect(() => {
    if (cloudSyncStatus !== 'connected' || !firebaseUser || !cloudOwnerUid || !cloudAccess) return;
    if (isApplyingRemoteSyncRef.current || !canPushCloudChannelsRef.current) return;
    if (appState.businessId && appState.businessId !== activeBusiness.businessId) return;

    const effectiveRole: StaffRole =
      currentSession?.role ||
      (cloudAccess.status === 'AUTHORIZED' ? cloudAccess.role : 'OWNER');

    if (canRoleWriteChannel(effectiveRole, 'finance_records', isOwnerOrMaster)) {
      const recentJournals = (appState.journalEntries || []).slice(0, 10);
      for (const je of recentJournals) {
        if (je?.id && !cloudJournalIdsRef.current.has(je.id) && Array.isArray(je.lines) && je.lines.length >= 2 && je.totalDebit > 0) {
          cloudJournalIdsRef.current.add(je.id);
          syncJournalEntryToCloud({
            entry: je,
            businessId: activeBusiness.businessId,
            ownerUid: cloudOwnerUid,
            userUid: firebaseUser.uid
          }).catch((err) => {
            console.warn('Sharded journal entry write warning:', err);
          });
        }
      }
    }

    const recentAudits = (appState.auditLogs || []).slice(0, 10);
    for (const log of recentAudits) {
      if (log?.id && !cloudAuditIdsRef.current.has(log.id)) {
        cloudAuditIdsRef.current.add(log.id);
        syncAuditLogToCloud({
          log,
          businessId: activeBusiness.businessId,
          ownerUid: cloudOwnerUid,
          userUid: firebaseUser.uid
        }).catch(() => {
          // handled silently inside syncAuditLogToCloud
        });
      }
    }
  }, [
    appState.journalEntries,
    appState.auditLogs,
    appState.businessId,
    cloudSyncStatus,
    firebaseUser,
    cloudOwnerUid,
    cloudAccess,
    activeBusiness.businessId,
    currentSession?.role,
    isOwnerOrMaster
  ]);

  // Helper to load older historical orders beyond the 250-order real-time sharded window
  const handleLoadOlderCloudOrders = useCallback(async (): Promise<number> => {
    if (
      cloudSyncStatus !== 'connected' ||
      !oldestShardedOrderCursorRef.current ||
      isLoadingOlderCloudOrders
    ) {
      return 0;
    }
    setIsLoadingOlderCloudOrders(true);
    try {
      const page = await fetchOlderShardedOrdersPage({
        businessId: activeBusiness.businessId,
        beforeTimestampMs: oldestShardedOrderCursorRef.current,
        pageSize: 100
      });
      if (page.nextCursorMs !== null) {
        oldestShardedOrderCursorRef.current = page.nextCursorMs;
      }
      setHasMoreCloudOrders(page.hasMore);
      if (page.orders.length > 0) {
        page.orders.forEach((o) => cloudOrderIdsRef.current.add(o.id));
        isApplyingRemoteSyncRef.current = true;
        setAppState((prev) => {
          const map = new Map(prev.orders.map((o) => [o.id, o]));
          for (const ord of page.orders) {
            if (!map.has(ord.id)) {
              map.set(ord.id, ord);
            }
          }
          const sorted = Array.from(map.values()).sort((a, b) => {
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (a.status !== 'active' && b.status === 'active') return 1;
            const tA = new Date(a.settledAt || a.createdAt || 0).getTime();
            const tB = new Date(b.settledAt || b.createdAt || 0).getTime();
            return tB - tA;
          });
          return { ...prev, orders: sorted };
        });
        setTimeout(() => {
          isApplyingRemoteSyncRef.current = false;
        }, 250);
      }
      return page.orders.length;
    } catch (err) {
      console.error('Failed to load older cloud orders:', err);
      return 0;
    } finally {
      setIsLoadingOlderCloudOrders(false);
    }
  }, [cloudSyncStatus, activeBusiness.businessId, isLoadingOlderCloudOrders]);

  // Helper to mirror individual fiscal Order tickets directly to /businesses/{id}/orders/{orderId}
  const mirrorOrderToCloud = useCallback(
    (order: Order) => {
      if (cloudSyncStatus !== 'connected' || !firebaseUser || !cloudOwnerUid || !cloudAccess) return;
      cloudOrderIdsRef.current.add(order.id);
      const effectiveRole: StaffRole =
        currentSession?.role ||
        (cloudAccess.status === 'AUTHORIZED' ? cloudAccess.role : 'OWNER');
      syncOrderDocumentToCloud({
        order,
        businessId: activeBusiness.businessId,
        ownerUid: cloudOwnerUid,
        userUid: firebaseUser.uid,
        effectiveRole,
        isOwnerOrMaster
      }).catch((err) => {
        console.error('Order cloud sync failed:', err);
      });
    },
    [cloudSyncStatus, firebaseUser, cloudOwnerUid, cloudAccess, currentSession?.role, activeBusiness.businessId, isOwnerOrMaster]
  );

  // Rotate Owner / Admin PIN directly from Owner Portal
  const handleChangeOwnerPin = useCallback(
    async (newPin: string) => {
      const changedAt = new Date().toISOString();
      const updatedStaff = await Promise.all(
        appState.staffUsers.map(async (u) => {
          if (u.role === 'OWNER' || u.role === 'ADMIN') {
            const newHash = await hashPinWithSalt(newPin, u.salt);
            return { ...u, pinHash: newHash, mustChangePin: false, lastPinChangedAt: changedAt };
          }
          return u;
        })
      );
      setAppState((prev) => ({
        ...prev,
        staffUsers: updatedStaff
      }));
    },
    [appState.staffUsers]
  );

  // Per-staff forced/voluntary PIN rotation handler (production PIN hardening)
  const handleRotateStaffPin = useCallback(
    async (staffId: string, newPin: string): Promise<StaffUser | null> => {
      const target = appState.staffUsers.find(u => u.id === staffId);
      if (!target) return null;
      const newHash = await hashPinWithSalt(newPin, target.salt);
      const updatedUser: StaffUser = {
        ...target,
        pinHash: newHash,
        mustChangePin: false,
        lastPinChangedAt: new Date().toISOString()
      };
      setAppState((prev) => ({
        ...prev,
        staffUsers: prev.staffUsers.map(u => (u.id === staffId ? updatedUser : u))
      }));
      recordAudit('STAFF_PIN_ROTATED', staffId, `PIN rotated for ${target.name} (${target.role})`, 'INFO');
      return updatedUser;
    },
    [appState.staffUsers]
  );

  // Multi-device atomic sequence reservation via Firestore runTransaction
  const handleReserveSequence = useCallback(
    async (counterType: 'invoice' | 'kot' | 'credit_note', prefix: string): Promise<string> => {
      const maxLocalSeq = (() => {
        if (counterType === 'credit_note') {
          let max = 0;
          for (const cn of appState.creditNotes || []) {
            const m = String(cn.creditNoteNo || '').match(/(\d+)$/);
            if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
          }
          return max;
        }
        let max = counterType === 'invoice' ? 1000 : 0;
        for (const o of appState.orders) {
          const raw = counterType === 'invoice' ? String(o.invoiceNo || o.invoiceNumber || '') : String(o.kotNo || '');
          const m = raw.match(/(\d+)$/);
          if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
        }
        return max;
      })();

      if (cloudSyncStatus === 'connected' && firebaseUser && cloudOwnerUid && isNetworkOnline()) {
        return reserveAtomicSequenceNumber({
          businessId: activeBusiness.businessId,
          ownerUid: cloudOwnerUid,
          userUid: firebaseUser.uid,
          counterType,
          prefix,
          seedFloorSeq: maxLocalSeq,
          fiscalYear: getNepalFiscalYear()
        });
      }

      if (counterType === 'credit_note') {
        return getNextCreditNoteNumber(appState.creditNotes || [], activeBusiness.businessId, true);
      }
      const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
      if (counterType === 'invoice') {
        return `${cleanPrefix}${new Date().getFullYear()}-${String(maxLocalSeq + 1).padStart(4, '0')}`;
      }
      return `${cleanPrefix}${String(maxLocalSeq + 1).padStart(3, '0')}`;
    },
    [appState.orders, appState.creditNotes, cloudSyncStatus, firebaseUser, cloudOwnerUid, activeBusiness.businessId]
  );

  // Real-Time Multi-Tenant Synchronization (cross-tab & cross-device)
  useEffect(() => {
    const unsubscribe = subscribeToTenantSync(activeBusiness.businessId, (event: SyncEvent) => {
      // Re-verify strictly that event matches active business
      if (event.businessId !== activeBusiness.businessId) return;

      if (event.eventType === 'ORDER_CREATED' || event.eventType === 'PAYMENT_COMPLETED') {
        const incomingOrder = event.payload as Order;
        setAppState(prev => {
          const idx = prev.orders.findIndex(o => o.id === incomingOrder.id);
          const nextOrders = idx >= 0
            ? prev.orders.map((o, i) => i === idx ? incomingOrder : o)
            : [incomingOrder, ...prev.orders];

          let nextTables = prev.tablesRooms;
          if (incomingOrder.tableRoomId) {
            nextTables = prev.tablesRooms.map(tr => {
              if (tr.id === incomingOrder.tableRoomId) {
                const isSettled = incomingOrder.status === 'completed';
                return {
                  ...tr,
                  status: isSettled ? ('available' as TableRoomStatus) : ('occupied' as TableRoomStatus),
                  currentOrderId: isSettled ? undefined : incomingOrder.id
                };
              }
              return tr;
            });
          }

          return {
            ...prev,
            orders: nextOrders,
            tablesRooms: nextTables
          };
        });
        playChime('beep');
      } else if (event.eventType === 'KOT_STATUS_UPDATED') {
        const { orderId, kotStatus } = event.payload;
        setAppState(prev => ({
          ...prev,
          orders: prev.orders.map(o => o.id === orderId ? { ...o, kotStatus } : o)
        }));
        playChime('beep');
      } else if (event.eventType === 'TABLE_STATUS_UPDATED') {
        const incomingTable = event.payload as TableRoom;
        setAppState(prev => ({
          ...prev,
          tablesRooms: prev.tablesRooms.map(tr => tr.id === incomingTable.id ? incomingTable : tr)
        }));
      } else if (event.eventType === 'RESERVATION_UPDATED') {
        const incomingRes = event.payload as any;
        setAppState(prev => ({
          ...prev,
          reservations: prev.reservations.map(r => r.id === incomingRes.id ? incomingRes : r)
        }));
      } else if (event.eventType === 'ROOM_STATUS_UPDATED') {
        const incomingRoom = event.payload as any;
        setAppState(prev => ({
          ...prev,
          resortRooms: prev.resortRooms.map(r => r.id === incomingRoom.id ? incomingRoom : r)
        }));
      } else if (event.eventType === 'INVENTORY_ADJUSTED') {
        const incomingInv = event.payload as InventoryItem;
        setAppState(prev => ({
          ...prev,
          inventoryItems: prev.inventoryItems.map(item => item.id === incomingInv.id ? incomingInv : item)
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeBusiness.businessId, playChime]);

  // Business Switcher Handler (Strict Data Partitioning & State Swap)
  const handleSwitchBusiness = (newBusinessId: string) => {
    if (newBusinessId === activeBusinessId) return;

    // 1. Immediately persist current tenant state
    saveTenantAppState(activeBusiness.businessId, appState);

    // 2. Set active business ID
    setActiveBusinessId(newBusinessId);
    setActiveBusinessIdState(newBusinessId);

    // 3. Load isolated tenant state
    const newState = loadTenantAppState(newBusinessId);
    setAppState(newState);

    // 4. Update language to business default if configured
    if (newState.settings?.defaultLanguage) {
      setLanguage(newState.settings.defaultLanguage);
    }

    // 5. Update session tenant association
    if (currentSession) {
      const updatedSess = { ...currentSession, businessId: newBusinessId };
      sessionStorage.setItem('himalayan_breeze_session_v1', JSON.stringify(updatedSess));
      setCurrentSession(updatedSess);
    }

    // 6. Ensure active tab is allowed in target business
    const targetBusiness = businesses.find(b => b.businessId === newBusinessId);
    const enabledMods = targetBusiness?.enabledModules || [];
    if (!isTabPermittedForRole(activeTab, currentSession?.role, enabledMods)) {
      setActiveTab('pos');
    }

    recordAudit('BUSINESS_WORKSPACE_SWITCHED', newBusinessId, `Switched context to enterprise: ${targetBusiness?.businessName || newBusinessId}`, 'INFO');
    playChime('beep');
  };

  // Register New Business Success Handler
  const handleRegisterBusinessSuccess = (newBusiness: BusinessTenant) => {
    const updated = getRegisteredBusinesses();
    setBusinesses(updated);
    handleSwitchBusiness(newBusiness.businessId);
    setSecurityAlert(`Success! New workspace for "${newBusiness.businessName}" is now active and ready.`);
    playChime('success');
  };

  // Refresh all cloud client businesses for the App Creator Hub
  const handleRefreshCreatorCloudBusinesses = async () => {
    if (!isMasterOwnerGoogle || cloudSyncStatus !== 'connected') {
      throw new Error(`Sign in with App Creator Google (${MASTER_OWNER_EMAIL}) first to sync all cloud businesses.`);
    }
    const cloudList = await listAllCloudBusinessesForCreator();
    const merged = upsertSyncedCloudBusinesses(cloudList);
    setBusinesses(merged);
    return cloudList.length;
  };

  // Business Profile / Modules / Status Update Handler
  const handleUpdateBusiness = (bizId: string, updates: Partial<BusinessTenant>) => {
    const cleanUpdates: Partial<BusinessTenant> =
      'logo' in updates
        ? { ...updates, logo: sanitizeBusinessLogoUrl(updates.logo) }
        : updates;
    const res = updateBusiness(bizId, cleanUpdates);
    if (res) {
      const refreshed = getRegisteredBusinesses();
      setBusinesses(refreshed);
      if (bizId === activeBusinessId) {
        setAppState(prev => {
          const nextSettings = {
            ...prev.settings,
            businessName: cleanUpdates.businessName !== undefined ? cleanUpdates.businessName.trim() : prev.settings.businessName,
            nepaliBusinessName: cleanUpdates.nepaliBusinessName !== undefined ? cleanUpdates.nepaliBusinessName.trim() : prev.settings.nepaliBusinessName,
            tagline: cleanUpdates.tagline !== undefined ? cleanUpdates.tagline.trim() : prev.settings.tagline,
            address: cleanUpdates.address !== undefined ? cleanUpdates.address.trim() : prev.settings.address,
            phone: cleanUpdates.phone !== undefined ? cleanUpdates.phone.trim() : prev.settings.phone,
            email: cleanUpdates.email !== undefined ? cleanUpdates.email.trim() : prev.settings.email,
            panVatNumber: cleanUpdates.panVatNumber !== undefined ? cleanUpdates.panVatNumber.trim() : prev.settings.panVatNumber,
            logoUrl: 'logo' in cleanUpdates ? cleanUpdates.logo : prev.settings.logoUrl
          };
          const nextState: AppState = {
            ...prev,
            settings: nextSettings
          };
          saveTenantAppState(bizId, nextState);
          return nextState;
        });
      }
      if (cloudSyncStatus === 'connected' && isOwnerOrMaster) {
        updateCloudBusinessPolicy({
          businessId: bizId,
          business: cleanUpdates
        }).catch((err) => console.error('Business cloud policy sync failed:', err));
      }
      recordAudit('BUSINESS_PROFILE_UPDATED', bizId, `Business details updated for ${res.businessName}`, 'INFO');
    }
  };

  // Delete Business Handler
  const handleDeleteBusiness = (bizId: string) => {
    if (businesses.length <= 1) {
      setSecurityAlert('Cannot delete the only existing business workspace.');
      return;
    }
    const success = deleteBusiness(bizId);
    if (success) {
      const refreshed = getRegisteredBusinesses();
      setBusinesses(refreshed);
      if (bizId === activeBusinessId) {
        handleSwitchBusiness(refreshed[0].businessId);
      }
      recordAudit('BUSINESS_DELETED', bizId, `Deleted business workspace ${bizId}`, 'WARNING');
      setSecurityAlert('Business workspace removed successfully.');
      playChime('success');
    }
  };

  // Derived counts for badges
  const lowStockCount = appState.inventoryItems.filter(i => i.currentStock <= i.minStockAlert).length;
  const occupiedTablesCount = appState.tablesRooms.filter(tr => tr.status === 'occupied').length;
  const unpaidKhataCount = appState.customers.filter(c => c.creditBalance > 0).length;
  const activeOrdersCount = appState.orders.filter(
    o => o.status === 'active' && o.kotStatus !== 'cancelled' && (o.items?.length || 0) > 0
  ).length;
  const activeKOTCount = appState.orders.filter(o => o.status === 'active' && o.kotStatus !== 'served' && o.kotStatus !== 'expired' && o.kotStatus !== 'cancelled').length;

  // POS Order Handlers (State-level Authorization & Financial Recalculation)
  const handleSaveOrder = (
    order: Order, 
    shouldSettle: boolean, 
    updatedTableRoomStatus?: string
  ): boolean => {
    const userRole = currentSession?.role;

    if (activeBusiness.status === 'SUSPENDED' && !isMasterOwnerGoogle) {
      setSecurityAlert(`Workspace Suspended: Billing is temporarily paused for "${activeBusiness.businessName}". Contact App Creator (${MASTER_OWNER_EMAIL}) to reactivate.`);
      playChime('alert');
      return false;
    }

    // 0. Safe Offline Check for sensitive financial operation
    const online = isNetworkOnline();
    if (shouldSettle && !online) {
      recordAudit('OFFLINE_SETTLEMENT_REJECTED', order.id, `Settlement blocked while offline for ${order.invoiceNo}`, 'WARNING');
      setSecurityAlert('Cannot settle payment or process checkout while offline. Payment reconciliation and fiscal compliance require server confirmation. You can save this order as a draft.');
      playChime('alert');
      return false;
    }

    // 1. Authorization check
    if (shouldSettle && (!userRole || !hasPermission(userRole, 'SETTLE_PAYMENT'))) {
      recordAudit('UNAUTHORIZED_SETTLEMENT_BLOCKED', order.id, `User with role "${userRole || 'GUEST'}" attempted to settle invoice ${order.invoiceNo}`, 'CRITICAL');
      setSecurityAlert('Security Enforcement: Your role does not have authorization to settle bill payments.');
      playChime('alert');
      return false;
    }

    const existingOrder = appState.orders.find(o => o.id === order.id);
    if (shouldSettle && existingOrder?.status === 'completed') {
      setSecurityAlert(`Order ${existingOrder.invoiceNo} has already been settled.`);
      playChime('alert');
      return false;
    }

    // 2. Financial recalculation verification (anti-client tampering)
    const isTakeaway = order.orderType === 'takeaway' || order.orderType === 'delivery';
    const existingOrderForTax = existingOrder;
    const isPrivilegedRole = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER';
    const waiveSC = isPrivilegedRole ? Boolean(order.waivedServiceCharge) : Boolean(existingOrderForTax?.waivedServiceCharge);
    const waiveVat = isPrivilegedRole ? Boolean(order.waivedVat) : Boolean(existingOrderForTax?.waivedVat);

    const verifiedFinancials = verifyFinancialCalculations(
      order.items,
      appState.menuItems,
      order.discountPercent || 0,
      isTakeaway || waiveSC,
      waiveSC ? false : appState.settings.enableServiceCharge,
      appState.settings.serviceChargePercent,
      waiveVat ? false : appState.settings.enableVat,
      appState.settings.vatRatePercent
    );

    if (!verifiedFinancials.isValid) {
      recordAudit('FINANCIAL_TAMPERING_DETECTED', order.id, `Rejected invalid calculations: ${verifiedFinancials.error}`, 'CRITICAL');
      setSecurityAlert(`Financial Verification Error: ${verifiedFinancials.error}`);
      playChime('alert');
      return false;
    }

    // 3. Pre-settlement inventory check (anti-negative stock, supporting both menuItem recipes & Recipe Studio definitions)
    if (shouldSettle) {
      const stockValidation = validateInventoryStock(order.items, appState.menuItems, appState.inventoryItems, appState.recipes);
      if (!stockValidation.hasSufficientStock) {
        const detail = stockValidation.shortages.map(s => `${s.itemName} (Short by ${s.requiredQty - s.currentStock} ${s.unit})`).join(', ');
        recordAudit('SETTLEMENT_PREVENTED_STOCK_SHORTAGE', order.id, `Ingredient shortage: ${detail}`, 'WARNING');
        setSecurityAlert(`Settlement rejected: Insufficient stock (${detail})`);
        playChime('alert');
        return false;
      }
    }

    // 4. Duplicate Prevention (Idempotency Engine, phase-scoped so draft/KOT keys never block settlement)
    const idempotencyKey = resolveOrderMutationIdempotencyKey(order, existingOrder, shouldSettle);
    const idempResult = checkAndRegisterIdempotencyKey(
      activeBusiness.businessId,
      idempotencyKey,
      shouldSettle ? 'SETTLE_PAYMENT' : 'SAVE_ORDER',
      { orderId: order.id, invoiceNo: order.invoiceNo }
    );
    if (idempResult.isDuplicate) {
      console.info(`[Idempotency] Intercepted duplicate order submission for key ${idempotencyKey}`);
      if (shouldSettle) {
        setSecurityAlert('Duplicate payment submission blocked. Please refresh Bills if this order was not settled.');
        playChime('alert');
      }
      return false;
    }

    // 5. Optimistic Concurrency Control (OCC)
    if (existingOrder) {
      const occResult = validateOptimisticVersion(existingOrder, order);
      if (!occResult.isValid) {
        setSecurityAlert(occResult.message || 'Concurrent edit conflict detected: Another user modified this order. Please refresh.');
        playChime('alert');
        return false;
      }
    }

    const nextVersion = (existingOrder?.version || 0) + 1;
    const syncStatus = !online ? 'local_draft' : 'server_confirmed';

    // 6. Clean verified order payload (preserve partial & Khata due balances cleanly; never wipe credit/partial due to 0)
    const settledTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const creditInDetails = Number(order.paymentDetails?.credit) || 0;
    const isCreditOrPartial =
      order.paymentMethod === 'credit_khata' ||
      order.paymentStatus === 'credit' ||
      order.paymentStatus === 'partial' ||
      creditInDetails > 0;
    const verifiedPaidAmount = shouldSettle
      ? isCreditOrPartial
        ? Math.min(verifiedFinancials.verifiedGrandTotal, Math.max(0, Math.round((Number(order.paidAmount) || 0) * 100) / 100))
        : verifiedFinancials.verifiedGrandTotal
      : Math.max(0, Math.round((Number(order.paidAmount) || 0) * 100) / 100);
    const verifiedDueAmount = Math.max(
      0,
      Math.round((verifiedFinancials.verifiedGrandTotal - verifiedPaidAmount) * 100) / 100
    );

    const trustedOrder: Order = {
      ...order,
      status: shouldSettle ? 'completed' : (order.status === 'cancelled' ? 'cancelled' : 'active'),
      lifecycleStatus: shouldSettle ? 'COMPLETED' : order.lifecycleStatus,
      settledAt: shouldSettle ? (order.settledAt || settledTimestamp) : order.settledAt,
      fiscalYear: shouldSettle ? (order.fiscalYear || getNepalFiscalYear()) : order.fiscalYear,
      bsDate: shouldSettle ? (order.bsDate || formatBsIsoDate()) : order.bsDate,
      kotStatus: order.kotStatus || (shouldSettle ? 'sent_to_kitchen' : 'pending'),
      kotSentAt: order.kotSentAt || (shouldSettle ? nowIsoString() : undefined),
      cashierName: shouldSettle ? (order.cashierName || currentSession?.name || order.paymentRecords?.[0]?.staffName) : order.cashierName,
      waivedServiceCharge: waiveSC,
      waivedVat: waiveVat,
      subtotal: verifiedFinancials.verifiedSubtotal,
      discountAmount: verifiedFinancials.verifiedDiscountAmount,
      serviceChargeAmount: verifiedFinancials.verifiedServiceCharge,
      vatAmount: verifiedFinancials.verifiedVat,
      grandTotal: verifiedFinancials.verifiedGrandTotal,
      paidAmount: verifiedPaidAmount,
      dueAmount: verifiedDueAmount,
      version: nextVersion,
      syncStatus,
      idempotencyKey,
      updatedAt: new Date().toISOString()
    };

    // If offline and saving draft, buffer in safe offline queue
    if (!online && !shouldSettle) {
      enqueueOfflineDraft(activeBusiness.businessId, 'CREATE_DRAFT_ORDER', trustedOrder, idempotencyKey);
    }

    setAppState(prev => {
      const existingIdx = prev.orders.findIndex(o => o.id === trustedOrder.id);
      let newOrders = [...prev.orders];
      if (existingIdx >= 0) {
        newOrders[existingIdx] = trustedOrder;
      } else {
        newOrders = [trustedOrder, ...prev.orders];
      }

      // Update / release table or room immediately upon settlement
      let updatedTables = prev.tablesRooms.map(tr => {
        if (tr.id === trustedOrder.tableRoomId || (shouldSettle && tr.currentOrderId === trustedOrder.id)) {
          return {
            ...tr,
            status: (updatedTableRoomStatus as TableRoomStatus) || (shouldSettle ? 'available' : 'occupied'),
            currentOrderId: shouldSettle ? undefined : trustedOrder.id
          };
        }
        return tr;
      });

      // Deduct inventory (strictly once upon settlement)
      let updatedInventory = [...prev.inventoryItems];
      let newLogs = [...prev.inventoryLogs];
      const existingOrder = prev.orders.find(o => o.id === trustedOrder.id);
      const isAlreadyDeducted = Boolean(existingOrder?.inventoryDeducted);

      if (shouldSettle && !isAlreadyDeducted) {
        trustedOrder.inventoryDeducted = true;
        trustedOrder.items.forEach(orderItem => {
          const menuItem = prev.menuItems.find(m => m.id === orderItem.menuItemId);
          const resolvedRecipe = resolveOrderItemRecipeIngredients(menuItem, prev.recipes);
          if (resolvedRecipe.length > 0) {
            resolvedRecipe.forEach(recipe => {
              const invIdx = updatedInventory.findIndex(i => i.id === recipe.inventoryItemId);
              if (invIdx >= 0) {
                const target = updatedInventory[invIdx];
                const deductQty = recipe.amount * orderItem.quantity;
                const newStock = Math.max(0, Math.round((target.currentStock - deductQty) * 1000) / 1000);
                
                updatedInventory[invIdx] = {
                  ...target,
                  currentStock: newStock,
                  lastUpdated: new Date().toISOString().split('T')[0]
                };

                newLogs.unshift({
                  id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 4),
                  inventoryItemId: target.id,
                  itemName: target.name,
                  logType: 'pos_sale_deduction',
                  quantityChanged: -deductQty,
                  unit: target.unit,
                  stockBefore: target.currentStock,
                  stockAfter: newStock,
                  date: new Date().toISOString().replace('T', ' ').substring(0, 16),
                  notes: `Sold ${orderItem.quantity}x ${orderItem.name} (${trustedOrder.invoiceNo})`
                });
              }
            });
          }
        });
      }

      // Update customer Khata if applicable (prevent duplicate Khata posting)
      let updatedCustomers = [...prev.customers];
      let updatedKhata = [...prev.khataTransactions];

      if (shouldSettle) {
        let customerId = trustedOrder.customerId;
        let customer = updatedCustomers.find(c => c.id === customerId);

        if (!customer && trustedOrder.customerName && trustedOrder.customerPhone) {
          const newCust: Customer = {
            id: 'c-' + Date.now(),
            name: trustedOrder.customerName,
            phone: trustedOrder.customerPhone,
            customerType: 'regular',
            creditBalance: 0,
            loyaltyPoints: 0,
            totalSpend: 0,
            totalVisits: 0,
            createdAt: new Date().toISOString().split('T')[0]
          };
          updatedCustomers.push(newCust);
          customer = newCust;
          customerId = newCust.id;
        }

        if (customer) {
          const custIdx = updatedCustomers.findIndex(c => c.id === customer.id);
          const pointsEarned = Math.floor(trustedOrder.grandTotal / 100);
          
          let addedCredit = 0;
          if (trustedOrder.paymentMethod === 'credit_khata') {
            addedCredit = trustedOrder.dueAmount > 0 ? trustedOrder.dueAmount : trustedOrder.grandTotal;
          } else if (trustedOrder.paymentDetails?.credit) {
            addedCredit = Number(trustedOrder.paymentDetails.credit) || 0;
          } else if (trustedOrder.dueAmount > 0) {
            addedCredit = trustedOrder.dueAmount;
          }

          const alreadyRecordedKhata = prev.khataTransactions.some(kt => kt.orderId === trustedOrder.id);
          if (addedCredit > 0 && !alreadyRecordedKhata) {
            const beforeBal = customer.creditBalance;
            const afterBal = beforeBal + addedCredit;
            updatedKhata.unshift({
              id: 'kt-' + Date.now(),
              customerId: customer.id,
              customerName: customer.name,
              type: 'credit_taken',
              amount: addedCredit,
              balanceBefore: beforeBal,
              balanceAfter: afterBal,
              orderId: trustedOrder.id,
              invoiceNo: trustedOrder.invoiceNo,
              date: new Date().toISOString().replace('T', ' ').substring(0, 16),
              notes: `Bill credit for order ${trustedOrder.invoiceNo}`
            });
            updatedCustomers[custIdx] = {
              ...customer,
              creditBalance: customer.creditBalance + addedCredit,
              loyaltyPoints: customer.loyaltyPoints + pointsEarned,
              totalSpend: customer.totalSpend + trustedOrder.grandTotal,
              totalVisits: customer.totalVisits + 1,
              lastVisit: new Date().toISOString().split('T')[0]
            };
          } else if (!alreadyRecordedKhata) {
            updatedCustomers[custIdx] = {
              ...customer,
              loyaltyPoints: customer.loyaltyPoints + pointsEarned,
              totalSpend: customer.totalSpend + trustedOrder.grandTotal,
              totalVisits: customer.totalVisits + 1,
              lastVisit: new Date().toISOString().split('T')[0]
            };
          }
        }
      }

      // Synchronize with Resort Folio if charged to room (idempotent: prevent duplicate charges)
      let updatedFolios = prev.guestFolioItems;
      let updatedReservations = prev.reservations;
      const alreadyPostedToFolio = prev.guestFolioItems.some(f => f.referenceId === trustedOrder.id);

      if (trustedOrder.paymentMethod === 'charge_to_room' && trustedOrder.roomChargeDetails && !alreadyPostedToFolio) {
        const rc = trustedOrder.roomChargeDetails;
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const isCafe = trustedOrder.items.some(i => 
          i.category === 'bakery' || i.category === 'coffee' || i.category === 'tea' || i.category === 'dessert'
        );
        // Post pre-VAT net POS charge (subtotal - discount + SC) so Guest Folio VAT computation does NOT double-charge 13% VAT
        const posVat = Number(trustedOrder.vatAmount) || 0;
        const preVatFolioAmount = Math.max(0, Math.round((trustedOrder.grandTotal - posVat) * 100) / 100);

        const newFolioItem = {
          id: 'fol-pos-' + Date.now(),
          reservationId: rc.reservationId,
          roomId: rc.resortRoomId,
          roomNumber: rc.roomNumber,
          dateTime: nowStr,
          description: `POS Dining Order #${trustedOrder.invoiceNo} (${trustedOrder.tableRoomName || 'Counter'}): ${trustedOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`,
          category: isCafe ? ('CAFE' as const) : ('RESTAURANT' as const),
          quantity: 1,
          unitPrice: preVatFolioAmount,
          totalPrice: preVatFolioAmount,
          addedByStaff: currentSession?.name || 'Dining Waiter',
          referenceId: trustedOrder.id
        };

        updatedFolios = [newFolioItem, ...prev.guestFolioItems];

        // Update reservation extra charges, taxAmount, and balance accurately without double-VAT
        updatedReservations = prev.reservations.map(res => {
          if (res.id !== rc.reservationId) return res;
          const newExtras = Math.round((res.extraCharges + preVatFolioAmount) * 100) / 100;
          const newTax = Math.round(((res.taxAmount || 0) + posVat) * 100) / 100;
          const newTotal = Math.round((res.totalAmount + trustedOrder.grandTotal) * 100) / 100;
          const newRemaining = Math.max(0, Math.round((newTotal - res.paidAmount) * 100) / 100);
          return {
            ...res,
            extraCharges: newExtras,
            taxAmount: newTax,
            totalAmount: newTotal,
            remainingAmount: newRemaining
          };
        });
      }

      const nextStatePreGl = {
        ...prev,
        orders: newOrders,
        tablesRooms: updatedTables,
        inventoryItems: updatedInventory,
        inventoryLogs: newLogs,
        customers: updatedCustomers,
        khataTransactions: updatedKhata,
        guestFolioItems: updatedFolios,
        reservations: updatedReservations
      };

      const glPatch = shouldSettle
        ? postOrderSettlementJournal(nextStatePreGl, trustedOrder, currentSession?.name || trustedOrder.cashierName || 'Cashier')
        : { journalEntries: prev.journalEntries, accounts: prev.accounts };

      return {
        ...nextStatePreGl,
        accounts: glPatch.accounts,
        journalEntries: glPatch.journalEntries
      };
    });

    if (shouldSettle) {
      if (trustedOrder.paymentMethod === 'charge_to_room' && trustedOrder.roomChargeDetails) {
        recordAudit('RESORT_FOLIO_ORDER_CHARGED', trustedOrder.roomChargeDetails.resortRoomId, `POS Order #${trustedOrder.invoiceNo} posted to Room ${trustedOrder.roomChargeDetails.roomNumber} folio (Rs. ${trustedOrder.grandTotal})`, 'INFO');
      } else {
        recordAudit('BILL_SETTLED', trustedOrder.id, `Settled ${trustedOrder.invoiceNo} via ${trustedOrder.paymentMethod} (Rs. ${trustedOrder.grandTotal})`, 'INFO');
      }
      playChime('success');

      if (appState.settings.irdSettings?.cbmsEnabled && online) {
        submitCbmsInvoiceToEndpoint(trustedOrder, appState.settings).then((cbmsRes) => {
          if (cbmsRes.synced) {
            const syncTime = new Date().toISOString();
            setAppState(prev => ({
              ...prev,
              orders: prev.orders.map(o => (o.id === trustedOrder.id ? { ...o, cbmsSynced: true, cbmsSyncTime: syncTime } : o))
            }));
          }
        }).catch(() => {});
      }
    }

    // 7. Broadcast live update across tenant & cloud channels if online
    if (online) {
      mirrorOrderToCloud(trustedOrder);
      broadcastSyncEvent(
        activeBusiness.businessId,
        shouldSettle ? 'PAYMENT_COMPLETED' : 'ORDER_CREATED',
        trustedOrder,
        {
          senderSessionId: currentSession?.staffId,
          senderName: currentSession?.name,
          version: trustedOrder.version,
          idempotencyKey: trustedOrder.idempotencyKey
        }
      );
    }
    return true;
  };

  // Atomic Item-Level Split Bill Settlement Handler
  const handleSettleSplitOrder = (
    parentOrderId: string,
    splitOrder: Order,
    remainingItems: OrderItem[]
  ): boolean => {
    const userRole = currentSession?.role;
    if (activeBusiness.status === 'SUSPENDED' && !isMasterOwnerGoogle) {
      setSecurityAlert(`Workspace Suspended: Billing is temporarily paused for "${activeBusiness.businessName}". Contact App Creator (${MASTER_OWNER_EMAIL}) to reactivate.`);
      playChime('alert');
      return false;
    }
    const online = isNetworkOnline();
    if (!online) {
      setSecurityAlert('Cannot settle split bill while offline. Financial reconciliation requires an active connection.');
      playChime('alert');
      return false;
    }
    if (!userRole || !hasPermission(userRole, 'SETTLE_PAYMENT')) {
      setSecurityAlert('Security Enforcement: Your role does not have authorization to settle bill payments.');
      playChime('alert');
      return false;
    }

    const isTakeawayOrDelivery = splitOrder.orderType === 'takeaway' || splitOrder.orderType === 'delivery';
    const waiveSC = Boolean(splitOrder.waivedServiceCharge);
    const waiveVat = Boolean(splitOrder.waivedVat);

    const splitVerified = verifyFinancialCalculations(
      splitOrder.items,
      appState.menuItems,
      splitOrder.discountPercent || 0,
      isTakeawayOrDelivery || waiveSC,
      waiveSC ? false : appState.settings.enableServiceCharge,
      appState.settings.serviceChargePercent,
      waiveVat ? false : appState.settings.enableVat,
      appState.settings.vatRatePercent
    );
    if (!splitVerified.isValid) {
      setSecurityAlert(`Split Bill Verification Error: ${splitVerified.error}`);
      playChime('alert');
      return false;
    }

    const stockValidation = validateInventoryStock(splitOrder.items, appState.menuItems, appState.inventoryItems, appState.recipes);
    if (!stockValidation.hasSufficientStock) {
      const detail = stockValidation.shortages.map(s => `${s.itemName} (Short by ${s.requiredQty - s.currentStock} ${s.unit})`).join(', ');
      setSecurityAlert(`Settlement rejected: Insufficient stock (${detail})`);
      playChime('alert');
      return false;
    }

    const nowStamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const finalizedSplitOrder: Order = {
      ...splitOrder,
      parentSplitOrderId: parentOrderId,
      status: 'completed',
      kotStatus: splitOrder.kotStatus || 'sent_to_kitchen',
      settledAt: splitOrder.settledAt || nowStamp,
      fiscalYear: splitOrder.fiscalYear || getNepalFiscalYear(),
      bsDate: splitOrder.bsDate || formatBsIsoDate(),
      cashierName: splitOrder.cashierName || currentSession?.name || splitOrder.paymentRecords?.[0]?.staffName,
      subtotal: splitVerified.verifiedSubtotal,
      discountAmount: splitVerified.verifiedDiscountAmount,
      serviceChargeAmount: splitVerified.verifiedServiceCharge,
      vatAmount: splitVerified.verifiedVat,
      grandTotal: splitVerified.verifiedGrandTotal,
      inventoryDeducted: true,
      syncStatus: 'server_confirmed',
      updatedAt: new Date().toISOString()
    };

    setAppState(prev => {
      const parentExisting = prev.orders.find(o => o.id === parentOrderId);
      let updatedOrders = [...prev.orders];

      if (remainingItems.length > 0) {
        const remTakeaway = parentExisting
          ? (parentExisting.orderType === 'takeaway' || parentExisting.orderType === 'delivery')
          : isTakeawayOrDelivery;
        const remWaiveSC = parentExisting ? Boolean(parentExisting.waivedServiceCharge) : waiveSC;
        const remWaiveVat = parentExisting ? Boolean(parentExisting.waivedVat) : waiveVat;
        const remVerified = verifyFinancialCalculations(
          remainingItems,
          prev.menuItems,
          parentExisting?.discountPercent || splitOrder.discountPercent || 0,
          remTakeaway || remWaiveSC,
          remWaiveSC ? false : prev.settings.enableServiceCharge,
          prev.settings.serviceChargePercent,
          remWaiveVat ? false : prev.settings.enableVat,
          prev.settings.vatRatePercent
        );

        if (parentExisting) {
          updatedOrders = updatedOrders.map(o =>
            o.id === parentOrderId
              ? {
                  ...o,
                  items: remainingItems,
                  subtotal: remVerified.verifiedSubtotal,
                  discountAmount: remVerified.verifiedDiscountAmount,
                  serviceChargeAmount: remVerified.verifiedServiceCharge,
                  vatAmount: remVerified.verifiedVat,
                  grandTotal: remVerified.verifiedGrandTotal,
                  dueAmount: remVerified.verifiedGrandTotal - (o.paidAmount || 0),
                  updatedAt: new Date().toISOString()
                }
              : o
          );
        }
      } else if (parentExisting) {
        updatedOrders = updatedOrders.map(o =>
          o.id === parentOrderId
            ? {
                ...o,
                status: 'cancelled' as OrderStatus,
                kotStatus: 'cancelled' as const,
                lifecycleStatus: 'COMPLETED' as const,
                voidReason: `Settled via split invoice ${finalizedSplitOrder.invoiceNo}`
              }
            : o
        );
      }

      updatedOrders = [finalizedSplitOrder, ...updatedOrders];

      const updatedTables = prev.tablesRooms.map(tr => {
        if (tr.id === finalizedSplitOrder.tableRoomId) {
          if (remainingItems.length > 0) {
            return {
              ...tr,
              status: 'occupied' as TableRoomStatus,
              currentOrderId: parentExisting ? parentExisting.id : tr.currentOrderId
            };
          }
          return {
            ...tr,
            status: 'available' as TableRoomStatus,
            currentOrderId: undefined
          };
        }
        return tr;
      });

      const updatedInventory = [...prev.inventoryItems];
      const newLogs = [...prev.inventoryLogs];
      finalizedSplitOrder.items.forEach(orderItem => {
        const menuItem = prev.menuItems.find(m => m.id === orderItem.menuItemId);
        const resolvedRecipe = resolveOrderItemRecipeIngredients(menuItem, prev.recipes);
        if (resolvedRecipe.length > 0) {
          resolvedRecipe.forEach(recipe => {
            const invIdx = updatedInventory.findIndex(i => i.id === recipe.inventoryItemId);
            if (invIdx >= 0) {
              const target = updatedInventory[invIdx];
              const deductQty = recipe.amount * orderItem.quantity;
              const newStock = Math.max(0, Math.round((target.currentStock - deductQty) * 1000) / 1000);
              updatedInventory[invIdx] = {
                ...target,
                currentStock: newStock,
                lastUpdated: new Date().toISOString().split('T')[0]
              };
              newLogs.unshift({
                id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 4),
                inventoryItemId: target.id,
                itemName: target.name,
                logType: 'pos_sale_deduction',
                quantityChanged: -deductQty,
                unit: target.unit,
                stockBefore: target.currentStock,
                stockAfter: newStock,
                date: nowStamp,
                notes: `Split Bill Sold ${orderItem.quantity}x ${orderItem.name} (${finalizedSplitOrder.invoiceNo})`
              });
            }
          });
        }
      });

      let updatedCustomers = [...prev.customers];
      let updatedKhata = [...prev.khataTransactions];
      let customer = updatedCustomers.find(c => c.id === finalizedSplitOrder.customerId);
      if (!customer && finalizedSplitOrder.customerName && finalizedSplitOrder.customerPhone) {
        const newCust: Customer = {
          id: 'c-' + Date.now(),
          name: finalizedSplitOrder.customerName,
          phone: finalizedSplitOrder.customerPhone,
          customerType: 'regular',
          creditBalance: 0,
          loyaltyPoints: 0,
          totalSpend: 0,
          totalVisits: 0,
          createdAt: new Date().toISOString().split('T')[0]
        };
        updatedCustomers.push(newCust);
        customer = newCust;
      }
      if (customer) {
        const custIdx = updatedCustomers.findIndex(c => c.id === customer!.id);
        const pointsEarned = Math.floor(finalizedSplitOrder.grandTotal / 100);
        const addedCredit =
          finalizedSplitOrder.paymentMethod === 'credit_khata'
            ? (finalizedSplitOrder.dueAmount > 0 ? finalizedSplitOrder.dueAmount : finalizedSplitOrder.grandTotal)
            : (Number(finalizedSplitOrder.paymentDetails?.credit) || finalizedSplitOrder.dueAmount || 0);

        if (addedCredit > 0) {
          const beforeBal = customer.creditBalance;
          const afterBal = beforeBal + addedCredit;
          updatedKhata.unshift({
            id: 'kt-' + Date.now(),
            customerId: customer.id,
            customerName: customer.name,
            type: 'credit_taken',
            amount: addedCredit,
            balanceBefore: beforeBal,
            balanceAfter: afterBal,
            orderId: finalizedSplitOrder.id,
            invoiceNo: finalizedSplitOrder.invoiceNo,
            date: nowStamp,
            notes: `Split bill credit for order ${finalizedSplitOrder.invoiceNo}`
          });
        }
        updatedCustomers[custIdx] = {
          ...customer,
          creditBalance: customer.creditBalance + addedCredit,
          loyaltyPoints: customer.loyaltyPoints + pointsEarned,
          totalSpend: customer.totalSpend + finalizedSplitOrder.grandTotal,
          totalVisits: customer.totalVisits + 1,
          lastVisit: new Date().toISOString().split('T')[0]
        };
      }

      let updatedFolios = prev.guestFolioItems;
      let updatedReservations = prev.reservations;
      const alreadySplitPosted = prev.guestFolioItems.some(f => f.referenceId === finalizedSplitOrder.id);
      if (finalizedSplitOrder.paymentMethod === 'charge_to_room' && finalizedSplitOrder.roomChargeDetails && !alreadySplitPosted) {
        const rc = finalizedSplitOrder.roomChargeDetails;
        const splitVat = Number(finalizedSplitOrder.vatAmount) || 0;
        const preVatSplitAmount = Math.max(0, Math.round((finalizedSplitOrder.grandTotal - splitVat) * 100) / 100);
        const newFolioItem = {
          id: 'fol-pos-' + Date.now(),
          reservationId: rc.reservationId,
          roomId: rc.resortRoomId,
          roomNumber: rc.roomNumber,
          dateTime: nowStamp,
          description: `POS Split Bill #${finalizedSplitOrder.invoiceNo}: ${finalizedSplitOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}`,
          category: 'RESTAURANT' as const,
          quantity: 1,
          unitPrice: preVatSplitAmount,
          totalPrice: preVatSplitAmount,
          addedByStaff: currentSession?.name || 'Counter Cashier',
          referenceId: finalizedSplitOrder.id
        };
        updatedFolios = [newFolioItem, ...prev.guestFolioItems];
        updatedReservations = prev.reservations.map(res => {
          if (res.id !== rc.reservationId) return res;
          const newExtras = Math.round((res.extraCharges + preVatSplitAmount) * 100) / 100;
          const newTax = Math.round(((res.taxAmount || 0) + splitVat) * 100) / 100;
          const newTotal = Math.round((res.totalAmount + finalizedSplitOrder.grandTotal) * 100) / 100;
          return {
            ...res,
            extraCharges: newExtras,
            taxAmount: newTax,
            totalAmount: newTotal,
            remainingAmount: Math.max(0, Math.round((newTotal - res.paidAmount) * 100) / 100)
          };
        });
      }

      const nextSplitPreGl = {
        ...prev,
        orders: updatedOrders,
        tablesRooms: updatedTables,
        inventoryItems: updatedInventory,
        inventoryLogs: newLogs,
        customers: updatedCustomers,
        khataTransactions: updatedKhata,
        guestFolioItems: updatedFolios,
        reservations: updatedReservations
      };
      const glPatch = postOrderSettlementJournal(
        nextSplitPreGl,
        finalizedSplitOrder,
        currentSession?.name || finalizedSplitOrder.cashierName || 'Cashier'
      );

      return {
        ...nextSplitPreGl,
        accounts: glPatch.accounts,
        journalEntries: glPatch.journalEntries
      };
    });

    mirrorOrderToCloud(finalizedSplitOrder);
    recordAudit(
      'SPLIT_BILL_SETTLED',
      finalizedSplitOrder.id,
      `Settled split bill ${finalizedSplitOrder.invoiceNo} (Rs. ${finalizedSplitOrder.grandTotal.toFixed(2)}) from parent order ${parentOrderId}`,
      'INFO'
    );
    playChime('success');
    return true;
  };

  // Safe Offline Queue Flush Handler
  const handleFlushOfflineQueue = useCallback(() => {
    const res = flushOfflineQueue(activeBusiness.businessId, (draftOrder: Order) => {
      handleSaveOrder(draftOrder, false, 'occupied');
      return { success: true };
    });
    if (res.processedCount > 0) {
      recordAudit('OFFLINE_QUEUE_FLUSHED', activeBusiness.businessId, `Synchronized ${res.processedCount} offline draft orders`, 'INFO');
      playChime('success');
    }
  }, [activeBusiness.businessId, recordAudit, playChime]);

  const handleKOTSent = (order: Order) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'SEND_KOT')) {
      recordAudit('UNAUTHORIZED_KOT_BLOCKED', order.id, 'Unauthorized KOT dispatch attempt', 'WARNING');
      setSecurityAlert('Permission Denied: Your staff role is not authorized to dispatch KOT tickets.');
      playChime('alert');
      return;
    }

    const nowStr = nowIsoString();
    setAppState(prev => {
      const exists = prev.orders.some(o => o.id === order.id);
      let updatedOrders: Order[];
      if (exists) {
        updatedOrders = prev.orders.map(o => o.id === order.id ? { 
          ...o, 
          ...order, 
          status: 'active',
          kotStatus: 'sent_to_kitchen', 
          kotSentAt: nowStr 
        } : o);
      } else {
        const newOrder: Order = {
          ...order,
          status: 'active',
          kotStatus: 'sent_to_kitchen',
          kotSentAt: nowStr
        };
        updatedOrders = [newOrder, ...prev.orders];
      }

      // Automatically update tableRoom status to occupied
      const updatedTables = prev.tablesRooms.map(tr => {
        if (tr.id === order.tableRoomId) {
          return {
            ...tr,
            status: 'occupied' as TableRoomStatus,
            currentOrderId: order.id
          };
        }
        return tr;
      });

      return {
        ...prev,
        orders: updatedOrders,
        tablesRooms: updatedTables
      };
    });

    recordAudit('KOT_DISPATCHED', order.id, `KOT ticket ${order.kotNo} sent for ${order.invoiceNo}`, 'INFO');
    playChime('alert');

    if (isNetworkOnline()) {
      mirrorOrderToCloud({
        ...order,
        status: 'active',
        kotStatus: 'sent_to_kitchen',
        kotSentAt: nowStr
      });
      broadcastSyncEvent(activeBusiness.businessId, 'KOT_STATUS_UPDATED', { orderId: order.id, kotStatus: 'sent_to_kitchen' }, {
        senderSessionId: currentSession?.staffId,
        senderName: currentSession?.name
      });
    }
  };

  const handleUpdateKOTStatus = (
    orderId: string, 
    kotStatus: 'sent_to_kitchen' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'expired',
    cancellationReason?: string
  ) => {
    const userRole = currentSession?.role;
    if (
      userRole !== 'OWNER' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'ADMIN' &&
      userRole !== 'MANAGER' &&
      userRole !== 'KITCHEN' &&
      userRole !== 'WAITER'
    ) {
      setSecurityAlert('Only Kitchen and Service staff can update live KDS order statuses.');
      return;
    }

    const nowStr = nowIsoString();
    const existingOrder = appState.orders.find(o => o.id === orderId);

    setAppState(prev => ({
      ...prev,
      orders: prev.orders.map(o => {
        if (o.id !== orderId) return o;
        const updates: Partial<Order> = { kotStatus };
        if (kotStatus === 'accepted') {
          updates.kotAcceptedAt = nowStr;
        } else if (kotStatus === 'preparing') {
          if (!o.kotAcceptedAt) updates.kotAcceptedAt = nowStr;
          updates.kotPreparingAt = nowStr;
        } else if (kotStatus === 'ready') {
          updates.kotReadyAt = nowStr;
        } else if (kotStatus === 'served') {
          updates.kotServedAt = nowStr;
        } else if (kotStatus === 'cancelled') {
          updates.voidReason = cancellationReason || 'Cancelled by Kitchen Staff';
          updates.voidedBy = currentSession?.name || userRole;
          updates.voidedAt = nowStr;
        } else if (kotStatus === 'sent_to_kitchen') {
          // Restore case
          updates.voidReason = undefined;
          updates.voidedBy = undefined;
          updates.voidedAt = undefined;
        }
        return { ...o, ...updates };
      })
    }));

    if (existingOrder) {
      mirrorOrderToCloud({ ...existingOrder, kotStatus });
    }
    recordAudit('KDS_STATUS_CHANGED', orderId, `KDS order status changed to ${kotStatus}${cancellationReason ? ` (${cancellationReason})` : ''}`, kotStatus === 'cancelled' ? 'WARNING' : 'INFO');
    playChime(kotStatus === 'ready' ? 'success' : kotStatus === 'cancelled' ? 'alert' : 'beep');

    if (isNetworkOnline()) {
      broadcastSyncEvent(activeBusiness.businessId, 'KOT_STATUS_UPDATED', { orderId, kotStatus, cancellationReason, updatedAt: nowStr }, {
        senderSessionId: currentSession?.staffId,
        senderName: currentSession?.name
      });
    }
  };

  const handleAddMenuItem = (item: MenuItem) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'MODIFY_PRICING')) {
      recordAudit('UNAUTHORIZED_MENU_CREATION_BLOCKED', item.id, 'Unauthorized menu addition attempt', 'CRITICAL');
      setSecurityAlert('Permission Denied: Only Manager and Admin can add or modify menu pricing.');
      playChime('alert');
      return;
    }

    setAppState(prev => ({
      ...prev,
      menuItems: [...prev.menuItems, item]
    }));
    recordAudit('MENU_ITEM_ADDED', item.id, `Added dish ${item.name} (Rs. ${item.price})`, 'INFO');
    playChime('success');
  };

  const handleUpdateMenuItem = (item: MenuItem) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'MODIFY_PRICING')) {
      recordAudit('UNAUTHORIZED_PRICING_MODIFICATION_BLOCKED', item.id, `Unauthorized price modification on ${item.name}`, 'CRITICAL');
      setSecurityAlert('Permission Denied: Only Manager and Admin can update dish prices.');
      playChime('alert');
      return;
    }

    setAppState(prev => ({
      ...prev,
      menuItems: prev.menuItems.map(m => m.id === item.id ? item : m)
    }));
    recordAudit('MENU_ITEM_UPDATED', item.id, `Updated price/details for ${item.name} (Rs. ${item.price})`, 'INFO');
    playChime('success');
  };

  const handleDeleteMenuItem = (itemId: string) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'MODIFY_PRICING')) {
      recordAudit('UNAUTHORIZED_MENU_DELETE_BLOCKED', itemId, 'Unauthorized menu deletion attempt', 'CRITICAL');
      setSecurityAlert('Permission Denied: Only Manager and Admin can delete menu items.');
      playChime('alert');
      return;
    }

    const item = appState.menuItems.find(m => m.id === itemId);
    setAppState(prev => ({
      ...prev,
      menuItems: prev.menuItems.filter(m => m.id !== itemId)
    }));
    recordAudit('MENU_ITEM_DELETED', itemId, `Deleted menu item ${item?.name || itemId}`, 'WARNING');
    playChime('success');
  };

  const handleShiftTableOrder = (fromTableId: string, toTableId: string) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'TRANSFER_TABLE')) {
      recordAudit('UNAUTHORIZED_TABLE_TRANSFER_BLOCKED', fromTableId, 'Transfer table permission denied', 'WARNING');
      setSecurityAlert('Permission Denied: You do not have permission to transfer active tables.');
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const toTable = prev.tablesRooms.find(tr => tr.id === toTableId);
      const toTableName = toTable?.name || 'Table';
      const toTableType = toTable?.type || 'table';

      const updatedOrders = prev.orders.map(o => {
        if (o.tableRoomId === fromTableId && o.status === 'active') {
          return {
            ...o,
            tableRoomId: toTableId,
            tableRoomName: toTableName,
            tableRoomType: toTableType
          };
        }
        return o;
      });

      const updatedTables = prev.tablesRooms.map(tr => {
        if (tr.id === fromTableId) {
          return { ...tr, status: 'available' as TableRoomStatus, currentOrderId: undefined };
        }
        if (tr.id === toTableId) {
          return { ...tr, status: 'occupied' as TableRoomStatus };
        }
        return tr;
      });

      return {
        ...prev,
        orders: updatedOrders,
        tablesRooms: updatedTables
      };
    });
    recordAudit('ORDER_TABLE_TRANSFERRED', fromTableId, `Active order shifted to ${toTableId}`, 'INFO');
    playChime('success');
  };

  const handleMergeTables = (sourceTableId: string, targetTableId: string) => {
    const userRole = currentSession?.role;
    if (
      !userRole ||
      (userRole !== 'OWNER' &&
        userRole !== 'SUPER_ADMIN' &&
        userRole !== 'ADMIN' &&
        userRole !== 'MANAGER' &&
        userRole !== 'CASHIER')
    ) {
      setSecurityAlert('Permission Denied: Only Manager, Cashier or Admin can merge active tables.');
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const sourceOrder = prev.orders.find(o => o.tableRoomId === sourceTableId && o.status === 'active');
      const targetOrder = prev.orders.find(o => o.tableRoomId === targetTableId && o.status === 'active');
      const targetTable = prev.tablesRooms.find(tr => tr.id === targetTableId);

      if (!sourceOrder) return prev;

      let updatedOrders = [...prev.orders];

      if (targetOrder) {
        const combinedItems = [...targetOrder.items, ...sourceOrder.items];
        const isTakeawayMerge = targetTable?.type === 'takeaway' || targetOrder.orderType === 'takeaway' || targetOrder.orderType === 'delivery';
        const waiveSC = Boolean(targetOrder.waivedServiceCharge);
        const waiveVat = Boolean(targetOrder.waivedVat);
        const verified = verifyFinancialCalculations(
          combinedItems,
          prev.menuItems,
          targetOrder.discountPercent || 0,
          isTakeawayMerge || waiveSC,
          waiveSC ? false : prev.settings.enableServiceCharge,
          prev.settings.serviceChargePercent,
          waiveVat ? false : prev.settings.enableVat,
          prev.settings.vatRatePercent
        );

        const newSubtotal = verified.isValid ? verified.verifiedSubtotal : combinedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const discountAmount = verified.isValid ? verified.verifiedDiscountAmount : Math.round(((newSubtotal * (targetOrder.discountPercent || 0)) / 100) * 100) / 100;
        const serviceCharge = verified.isValid ? verified.verifiedServiceCharge : 0;
        const vat = verified.isValid ? verified.verifiedVat : 0;
        const grandTotal = verified.isValid ? verified.verifiedGrandTotal : Math.round((newSubtotal - discountAmount + serviceCharge + vat) * 100) / 100;

        updatedOrders = updatedOrders.map(o => {
          if (o.id === targetOrder.id) {
            return {
              ...o,
              items: combinedItems,
              subtotal: newSubtotal,
              discountAmount,
              serviceChargeAmount: serviceCharge,
              vatAmount: vat,
              grandTotal,
              dueAmount: Math.max(0, Math.round((grandTotal - (o.paidAmount || 0)) * 100) / 100)
            };
          }
          if (o.id === sourceOrder.id) {
            return {
              ...o,
              status: 'cancelled' as OrderStatus,
              specialInstructions: `Merged into ${targetTable?.name || targetTableId} (${targetOrder.invoiceNo})`
            };
          }
          return o;
        });
      }

      const updatedTables = prev.tablesRooms.map(tr => {
        if (tr.id === sourceTableId) {
          return { ...tr, status: 'available' as TableRoomStatus, currentOrderId: undefined };
        }
        if (tr.id === targetTableId) {
          return { 
            ...tr, 
            status: 'occupied' as TableRoomStatus,
            mergedTableIds: [...(tr.mergedTableIds || []), sourceTableId]
          };
        }
        return tr;
      });

      return {
        ...prev,
        orders: updatedOrders,
        tablesRooms: updatedTables
      };
    });

    recordAudit('TABLES_MERGED', sourceTableId, `Merged Table ${sourceTableId} into Table ${targetTableId}`, 'INFO');
    playChime('success');
  };

  const handleAssignWaiter = (tableId: string, waiterId: string, waiterName: string) => {
    setAppState(prev => ({
      ...prev,
      tablesRooms: prev.tablesRooms.map(tr => 
        tr.id === tableId ? { ...tr, assignedWaiterId: waiterId, assignedWaiterName: waiterName } : tr
      ),
      orders: prev.orders.map(o => 
        o.tableRoomId === tableId && o.status === 'active' 
          ? { ...o, waiterId, waiterName } 
          : o
      )
    }));
    recordAudit('WAITER_ASSIGNED', tableId, `Assigned waiter ${waiterName} to table ${tableId}`, 'INFO');
  };

  // Admin Order Void / Cancellation Handler
  const handleVoidOrder = (orderId: string, reason: string) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'VOID_ORDER')) {
      recordAudit('UNAUTHORIZED_VOID_BLOCKED', orderId, `User with role ${userRole || 'GUEST'} attempted to void order ${orderId}`, 'CRITICAL');
      setSecurityAlert('Permission Denied: Only Manager, Admin or Owner can void active running orders.');
      playChime('alert');
      return;
    }

    const targetSnapshot = appState.orders.find(o => o.id === orderId);
    const wasSettledSnapshot = Boolean(
      targetSnapshot && (targetSnapshot.status === 'completed' || Boolean(targetSnapshot.settledAt))
    );
    const existingCnForOrder = (appState.creditNotes || []).find(c => c.originalOrderId === orderId);
    let generatedCreditNote = existingCnForOrder;
    if (wasSettledSnapshot && targetSnapshot && !existingCnForOrder) {
      const nextCnNo = getNextCreditNoteNumber(appState.creditNotes || [], activeBusiness.businessId, true);
      generatedCreditNote = createCreditNoteFromOrder(
        targetSnapshot,
        nextCnNo,
        reason,
        currentSession?.name || userRole,
        activeBusiness.businessId
      );
    }

    setAppState(prev => {
      const targetOrder = prev.orders.find(o => o.id === orderId);
      if (!targetOrder || targetOrder.status === 'cancelled') return prev;

      const isSettledTaxOrder = targetOrder.status === 'completed' || Boolean(targetOrder.settledAt);
      const alreadyHasCn = (prev.creditNotes || []).some(c => c.originalOrderId === orderId);
      let issuedCn = generatedCreditNote;
      if (isSettledTaxOrder && !alreadyHasCn && !issuedCn) {
        const cnNo = getNextCreditNoteNumber(prev.creditNotes || [], activeBusiness.businessId, true);
        issuedCn = createCreditNoteFromOrder(
          targetOrder,
          cnNo,
          reason,
          currentSession?.name || userRole,
          activeBusiness.businessId
        );
      }

      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const updatedOrders = prev.orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'cancelled' as OrderStatus,
            kotStatus: 'cancelled' as const,
            lifecycleStatus: 'VOIDED' as const,
            creditNoteNo: isSettledTaxOrder && issuedCn ? issuedCn.creditNoteNo : o.creditNoteNo,
            voidReason: reason,
            voidedBy: currentSession?.name || userRole,
            voidedAt: nowStr
          };
        }
        return o;
      });

      // Reverse deducted recipe ingredients if a settled order is voided
      let updatedInventory = [...prev.inventoryItems];
      let updatedInventoryLogs = [...prev.inventoryLogs];
      if (targetOrder.inventoryDeducted) {
        targetOrder.items.forEach(orderItem => {
          const menuItem = prev.menuItems.find(m => m.id === orderItem.menuItemId);
          const resolvedRecipe = resolveOrderItemRecipeIngredients(menuItem, prev.recipes);
          resolvedRecipe.forEach(recipe => {
            const invIdx = updatedInventory.findIndex(i => i.id === recipe.inventoryItemId);
            if (invIdx >= 0) {
              const target = updatedInventory[invIdx];
              const restoreQty = recipe.amount * orderItem.quantity;
              const newStock = Math.round((target.currentStock + restoreQty) * 1000) / 1000;
              updatedInventory[invIdx] = {
                ...target,
                currentStock: newStock,
                lastUpdated: new Date().toISOString().split('T')[0]
              };
              updatedInventoryLogs.unshift({
                id: 'log-void-' + Date.now() + Math.random().toString(36).substr(2, 4),
                inventoryItemId: target.id,
                itemName: target.name,
                logType: 'manual_adjustment',
                quantityChanged: restoreQty,
                unit: target.unit,
                stockBefore: target.currentStock,
                stockAfter: newStock,
                date: nowStr,
                notes: `Reversed stock on VOID of ${targetOrder.invoiceNo} (${reason})`
              });
            }
          });
        });
      }

      // Reverse any Khata debt added by this voided order
      let updatedCustomers = [...prev.customers];
      let updatedKhata = [...prev.khataTransactions];
      const khataEntry = prev.khataTransactions.find(kt => kt.orderId === orderId && kt.type === 'credit_taken');
      if (khataEntry) {
        const custIdx = updatedCustomers.findIndex(c => c.id === khataEntry.customerId);
        if (custIdx >= 0) {
          const cust = updatedCustomers[custIdx];
          const beforeBal = cust.creditBalance;
          const afterBal = Math.max(0, Math.round((beforeBal - khataEntry.amount) * 100) / 100);
          updatedCustomers[custIdx] = {
            ...cust,
            creditBalance: afterBal
          };
          updatedKhata.unshift({
            id: 'kt-void-' + Date.now(),
            customerId: cust.id,
            customerName: cust.name,
            type: 'payment_received',
            amount: khataEntry.amount,
            balanceBefore: beforeBal,
            balanceAfter: afterBal,
            orderId: targetOrder.id,
            invoiceNo: targetOrder.invoiceNo,
            date: nowStr,
            notes: `Reversed Khata credit due to voided order ${targetOrder.invoiceNo}`
          });
        }
      }

      // Reverse Guest Folio charge if voiding a room-charged order
      const matchingFolios = prev.guestFolioItems.filter(f => f.referenceId === orderId);
      let updatedFolios = prev.guestFolioItems;
      let updatedReservations = prev.reservations;
      if (matchingFolios.length > 0) {
        const removedFolioSubtotal = matchingFolios.reduce((s, f) => s + f.totalPrice, 0);
        const removedVat = Number(targetOrder.vatAmount) || 0;
        const removedGrand = Number(targetOrder.grandTotal) || removedFolioSubtotal;
        const resId = matchingFolios[0].reservationId;
        updatedFolios = prev.guestFolioItems.filter(f => f.referenceId !== orderId);
        updatedReservations = prev.reservations.map(res => {
          if (res.id !== resId) return res;
          const newExtras = Math.max(0, Math.round((res.extraCharges - removedFolioSubtotal) * 100) / 100);
          const newTax = Math.max(0, Math.round(((res.taxAmount || 0) - removedVat) * 100) / 100);
          const newTotal = Math.max(0, Math.round((res.totalAmount - removedGrand) * 100) / 100);
          return {
            ...res,
            extraCharges: newExtras,
            taxAmount: newTax,
            totalAmount: newTotal,
            remainingAmount: Math.max(0, Math.round((newTotal - res.paidAmount) * 100) / 100)
          };
        });
      }

      // Free the table associated with this order
      const updatedTables = prev.tablesRooms.map(tr => {
        if (tr.id === targetOrder.tableRoomId || tr.currentOrderId === orderId) {
          return {
            ...tr,
            status: 'available' as TableRoomStatus,
            currentOrderId: undefined
          };
        }
        return tr;
      });

      const updatedCreditNotes =
        isSettledTaxOrder && issuedCn && !alreadyHasCn
          ? [issuedCn, ...(prev.creditNotes || [])]
          : prev.creditNotes || [];

      const nextVoidPreGl = {
        ...prev,
        orders: updatedOrders,
        tablesRooms: updatedTables,
        inventoryItems: updatedInventory,
        inventoryLogs: updatedInventoryLogs,
        customers: updatedCustomers,
        khataTransactions: updatedKhata,
        guestFolioItems: updatedFolios,
        reservations: updatedReservations,
        creditNotes: updatedCreditNotes
      };

      const glPatch =
        isSettledTaxOrder && issuedCn && !alreadyHasCn
          ? postCreditNoteJournal(nextVoidPreGl, issuedCn, currentSession?.name || userRole)
          : { journalEntries: prev.journalEntries, accounts: prev.accounts };

      return {
        ...nextVoidPreGl,
        accounts: glPatch.accounts,
        journalEntries: glPatch.journalEntries
      };
    });

    if (targetSnapshot) {
      mirrorOrderToCloud({
        ...targetSnapshot,
        status: 'cancelled',
        creditNoteNo: generatedCreditNote?.creditNoteNo || targetSnapshot.creditNoteNo,
        voidReason: reason
      });
    }
    if (generatedCreditNote && cloudSyncStatus === 'connected' && firebaseUser && cloudOwnerUid && isNetworkOnline()) {
      syncCreditNoteToCloud({
        creditNote: generatedCreditNote,
        businessId: activeBusiness.businessId,
        ownerUid: cloudOwnerUid,
        userUid: firebaseUser.uid
      }).catch((err) => console.error('Credit Note cloud sync failed:', err));
    }
    recordAudit(
      generatedCreditNote ? 'CREDIT_NOTE_ISSUED' : 'ORDER_VOIDED_BY_ADMIN',
      orderId,
      generatedCreditNote
        ? `Issued Credit Note ${generatedCreditNote.creditNoteNo} for voided settled invoice ${targetSnapshot?.invoiceNo}. Reason: ${reason}`
        : `Order ${orderId} voided by ${currentSession?.name || userRole}. Reason: ${reason}`,
      'WARNING'
    );
    playChime('success');
  };

  // Admin Void Single Item Handler
  const handleVoidOrderItem = (orderId: string, itemIndex: number, reason: string) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'VOID_ORDER')) {
      setSecurityAlert('Permission Denied: Only Admin/Manager can remove items from placed orders.');
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const targetOrder = prev.orders.find(o => o.id === orderId);
      if (!targetOrder) return prev;

      const remainingItems = targetOrder.items.filter((_, idx) => idx !== itemIndex);
      const isTakeaway = targetOrder.orderType === 'takeaway' || targetOrder.orderType === 'delivery';
      const enableSC = (targetOrder.waivedServiceCharge || isTakeaway) ? false : prev.settings.enableServiceCharge;
      const enableVat = targetOrder.waivedVat ? false : prev.settings.enableVat;

      const verified = verifyFinancialCalculations(
        remainingItems,
        prev.menuItems,
        targetOrder.discountPercent || 0,
        isTakeaway || Boolean(targetOrder.waivedServiceCharge),
        enableSC,
        prev.settings.serviceChargePercent,
        enableVat,
        prev.settings.vatRatePercent
      );

      const updatedOrders = prev.orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            items: remainingItems,
            subtotal: verified.verifiedSubtotal,
            discountAmount: verified.verifiedDiscountAmount,
            serviceChargeAmount: verified.verifiedServiceCharge,
            vatAmount: verified.verifiedVat,
            grandTotal: verified.verifiedGrandTotal,
            dueAmount: verified.verifiedGrandTotal - (o.paidAmount || 0)
          };
        }
        return o;
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });

    recordAudit('ORDER_ITEM_VOIDED_BY_ADMIN', orderId, `Item index ${itemIndex} voided from order ${orderId}. Reason: ${reason}`, 'INFO');
    playChime('alert');
  };

  // Admin Discount & Tax Override Handler
  const handleAdminUpdatePricing = (orderId: string, update: { discountPercent?: number; waiveServiceCharge?: boolean; waiveVat?: boolean; notes?: string }) => {
    const userRole = currentSession?.role;
    if (!userRole || (userRole !== 'ADMIN' && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER')) {
      setSecurityAlert('Permission Denied: Only Admin and Manager can override pricing, discounts, and taxes.');
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const targetOrder = prev.orders.find(o => o.id === orderId);
      if (!targetOrder) return prev;

      const newDiscPct = update.discountPercent !== undefined ? update.discountPercent : (targetOrder.discountPercent || 0);
      const waiveSC = update.waiveServiceCharge !== undefined ? update.waiveServiceCharge : Boolean(targetOrder.waivedServiceCharge);
      const waiveVat = update.waiveVat !== undefined ? update.waiveVat : Boolean(targetOrder.waivedVat);
      const isTakeaway = targetOrder.orderType === 'takeaway' || targetOrder.orderType === 'delivery';

      const verified = verifyFinancialCalculations(
        targetOrder.items,
        prev.menuItems,
        newDiscPct,
        isTakeaway || waiveSC,
        waiveSC ? false : prev.settings.enableServiceCharge,
        prev.settings.serviceChargePercent,
        waiveVat ? false : prev.settings.enableVat,
        prev.settings.vatRatePercent
      );

      const updatedOrders = prev.orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            discountPercent: newDiscPct,
            waivedServiceCharge: waiveSC,
            waivedVat: waiveVat,
            customAdminDiscountReason: update.notes || o.customAdminDiscountReason,
            subtotal: verified.verifiedSubtotal,
            discountAmount: verified.verifiedDiscountAmount,
            serviceChargeAmount: verified.verifiedServiceCharge,
            vatAmount: verified.verifiedVat,
            grandTotal: verified.verifiedGrandTotal,
            dueAmount: verified.verifiedGrandTotal - (o.paidAmount || 0)
          };
        }
        return o;
      });

      return {
        ...prev,
        orders: updatedOrders
      };
    });

    recordAudit('ADMIN_PRICING_OVERRIDDEN', orderId, `Discount/tax adjusted on order ${orderId} by ${currentSession?.name}`, 'INFO');
    playChime('success');
  };

  // Admin Force Release Table Handler
  const handleForceReleaseTable = (tableId: string) => {
    const userRole = currentSession?.role;
    if (!userRole || (userRole !== 'ADMIN' && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER')) {
      setSecurityAlert('Permission Denied: Only Admin can force release occupied tables.');
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const table = prev.tablesRooms.find(t => t.id === tableId);
      const updatedTables = prev.tablesRooms.map(tr => 
        tr.id === tableId ? { ...tr, status: 'available' as TableRoomStatus, currentOrderId: undefined } : tr
      );

      const updatedOrders = prev.orders.map(o => {
        if (o.tableRoomId === tableId && o.status === 'active') {
          return {
            ...o,
            status: 'cancelled' as OrderStatus,
            kotStatus: 'cancelled' as const,
            voidReason: 'Table force released by administrator'
          };
        }
        return o;
      });

      return {
        ...prev,
        tablesRooms: updatedTables,
        orders: updatedOrders
      };
    });

    recordAudit('TABLE_FORCE_RELEASED', tableId, `Table ${tableId} force released to available by admin`, 'WARNING');
    playChime('success');
  };

  const handleAddExpense = (expense: Expense) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'RECORD_EXPENSE')) {
      recordAudit('UNAUTHORIZED_EXPENSE_RECORDING_BLOCKED', expense.id, 'Unauthorized expense addition attempt', 'CRITICAL');
      setSecurityAlert('Permission Denied: Your staff role cannot record business expenses.');
      playChime('alert');
      return;
    }

    const check = validateExpense(expense.title, expense.amount);
    if (!check.isValid) {
      setSecurityAlert(`Invalid Expense: ${check.error}`);
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const glPatch = postExpenseJournal(prev, expense, currentSession?.name || 'Manager');
      return {
        ...prev,
        expenses: [expense, ...(prev.expenses || [])],
        accounts: glPatch.accounts,
        journalEntries: glPatch.journalEntries
      };
    });
    recordAudit('EXPENSE_RECORDED', expense.id, `Recorded expense "${expense.title}" of Rs. ${expense.amount} (${expense.paymentMode})`, 'INFO');
    playChime('success');
  };

  const handleSaveDayClosing = (record: DayClosingRecord) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'PERFORM_DAY_CLOSE')) {
      recordAudit('UNAUTHORIZED_DAY_CLOSE_BLOCKED', record.id, 'Unauthorized day closing attempt', 'CRITICAL');
      setSecurityAlert('Permission Denied: Only Cashier, Accountant, Manager and Admin can execute day closings.');
      playChime('alert');
      return;
    }

    setAppState(prev => ({
      ...prev,
      dayClosings: [record, ...(prev.dayClosings || [])]
    }));
    recordAudit('DAY_CLOSING_FINALIZED', record.id, `Day Closing reconciled for ${record.date}. Expected: Rs. ${record.expectedCashInDrawer}, Actual: Rs. ${record.actualCashInDrawer}`, 'INFO');
    playChime('success');
  };

  const handleUpdateTableStatus = (
    id: string, 
    status: TableRoomStatus, 
    guestName?: string, 
    guestPhone?: string
  ) => {
    const userRole = currentSession?.role;
    const targetRoom = appState.tablesRooms.find(t => t.id === id);

    if (status === 'occupied') {
      if (!userRole || !hasPermission(userRole, 'CHECKIN_GUEST')) {
        recordAudit('UNAUTHORIZED_CHECKIN_BLOCKED', id, 'Unauthorized check-in attempt', 'WARNING');
        setSecurityAlert('Permission Denied: Only Receptionist, Manager, and Admin can check in guests.');
        playChime('alert');
        return;
      }
      if (targetRoom) {
        const check = validateRoomCheckIn(targetRoom, guestName || '');
        if (!check.isValid) {
          recordAudit('DOUBLE_BOOKING_PREVENTED', id, check.error || 'Double booking prohibited', 'WARNING');
          setSecurityAlert(check.error || 'Room is unavailable.');
          playChime('alert');
          return;
        }
      }
    }

    if (status === 'cleaning' || status === 'available') {
      if (!userRole || (!hasPermission(userRole, 'UPDATE_CLEANING_STATUS') && !hasPermission(userRole, 'CHECKOUT_GUEST'))) {
        setSecurityAlert('Permission Denied: You do not have housekeeping status permissions.');
        playChime('alert');
        return;
      }
    }

    setAppState(prev => ({
      ...prev,
      tablesRooms: prev.tablesRooms.map(tr => {
        if (tr.id === id) {
          return {
            ...tr,
            status,
            guestName: guestName !== undefined ? guestName : tr.guestName,
            guestPhone: guestPhone !== undefined ? guestPhone : tr.guestPhone,
            checkInTime: status === 'occupied' ? new Date().toISOString().replace('T', ' ').substring(0, 16) : tr.checkInTime
          };
        }
        return tr;
      })
    }));
    recordAudit('ROOM_TABLE_STATUS_CHANGED', id, `Status updated to ${status} for ${targetRoom?.name || id}`, 'INFO');
  };

  const handleSelectTableForPOS = (tableRoomId: string) => {
    setSelectedTableForPOS(tableRoomId);
    setPendingPosOrderType('dine_in');
    setPendingCheckoutOrderId(null);
    setPosNavigationNonce(prev => prev + 1);
    setActiveTab('pos');
  };

  const handleStartQuickOrderType = (type: 'takeaway' | 'delivery') => {
    setPendingPosOrderType(type);
    setPendingCheckoutOrderId(null);
    setPosNavigationNonce(prev => prev + 1);
    setActiveTab('pos');
  };

  const handleOpenCheckoutFromTables = (order: Order) => {
    setSelectedTableForPOS(order.tableRoomId);
    setPendingPosOrderType(order.orderType === 'takeaway' ? 'takeaway' : order.orderType === 'delivery' ? 'delivery' : 'dine_in');
    setPendingCheckoutOrderId(order.id);
    setPosNavigationNonce(prev => prev + 1);
    setActiveTab('pos');
  };

  const handleAddTableRoom = (newEntity: TableRoom) => {
    const userRole = currentSession?.role;
    if (
      userRole !== 'OWNER' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'ADMIN' &&
      userRole !== 'MANAGER'
    ) {
      setSecurityAlert('Only Owner, Manager and Admin can add new tables or rooms.');
      playChime('alert');
      return;
    }

    setAppState(prev => ({
      ...prev,
      tablesRooms: [...prev.tablesRooms, newEntity]
    }));
    recordAudit('SPACE_ENTITY_CREATED', newEntity.id, `Created ${newEntity.type} ${newEntity.name} (${newEntity.code})`, 'INFO');
  };

  const handleUpdateTableRoom = (updatedTable: TableRoom) => {
    const userRole = currentSession?.role;
    if (
      userRole !== 'OWNER' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'ADMIN' &&
      userRole !== 'MANAGER'
    ) {
      setSecurityAlert('Only Owner, Manager and Admin can edit tables or rooms.');
      playChime('alert');
      return;
    }

    setAppState(prev => ({
      ...prev,
      tablesRooms: prev.tablesRooms.map(tr =>
        tr.id === updatedTable.id
          ? { ...updatedTable, updatedAt: new Date().toISOString() }
          : tr
      )
    }));
    recordAudit('SPACE_ENTITY_UPDATED', updatedTable.id, `Updated ${updatedTable.type} ${updatedTable.name} (${updatedTable.code})`, 'INFO');
    playChime('success');
  };

  const handleDeleteTableRoom = (tableId: string) => {
    const userRole = currentSession?.role;
    if (
      userRole !== 'OWNER' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'ADMIN' &&
      userRole !== 'MANAGER'
    ) {
      setSecurityAlert('Only Owner, Manager and Admin can delete tables or rooms.');
      playChime('alert');
      return;
    }

    const activeOrder = appState.orders.find(o => o.tableRoomId === tableId && o.status === 'active');
    if (activeOrder) {
      setSecurityAlert(`Cannot delete table with active order (${activeOrder.invoiceNo}). Settle or void the bill first.`);
      playChime('alert');
      return;
    }

    const target = appState.tablesRooms.find(t => t.id === tableId);
    setAppState(prev => ({
      ...prev,
      tablesRooms: prev.tablesRooms.filter(tr => tr.id !== tableId)
    }));
    if (selectedTableForPOS === tableId) {
      setSelectedTableForPOS('');
    }
    recordAudit(
      'SPACE_ENTITY_DELETED',
      tableId,
      `Deleted ${target?.type || 'table'} ${target?.name || tableId} (${target?.code || ''})`,
      'WARNING'
    );
    playChime('success');
  };

  const handleUpdateTableAreas = (areas: string[], updatedTables?: TableRoom[]) => {
    const userRole = currentSession?.role;
    if (
      userRole !== 'OWNER' &&
      userRole !== 'SUPER_ADMIN' &&
      userRole !== 'ADMIN' &&
      userRole !== 'MANAGER'
    ) {
      setSecurityAlert('Only Owner, Manager and Admin can manage floor areas.');
      playChime('alert');
      return;
    }

    setAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        tableAreas: areas
      },
      tablesRooms: updatedTables || prev.tablesRooms
    }));
    recordAudit('FLOOR_AREAS_UPDATED', undefined, `Updated dining floor areas (${areas.join(', ') || 'None'})`, 'INFO');
    playChime('success');
  };

  const handleStockIn = (
    itemId: string, 
    quantity: number, 
    costPerUnit: number, 
    supplierName: string, 
    notes: string
  ) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'STOCK_IN_OUT')) {
      recordAudit('UNAUTHORIZED_STOCK_MUTATION_BLOCKED', itemId, 'Unauthorized stock in attempt', 'CRITICAL');
      setSecurityAlert('Permission Denied: You do not have stock-in authorization.');
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const idx = prev.inventoryItems.findIndex(i => i.id === itemId);
      if (idx === -1) return prev;
      const target = prev.inventoryItems[idx];

      const validation = validateStockChange(target.currentStock, quantity, false);
      if (!validation.isValid) return prev;

      const newStock = Math.round((target.currentStock + quantity) * 1000) / 1000;
      const updatedItem: InventoryItem = {
        ...target,
        currentStock: newStock,
        costPerUnit: costPerUnit || target.costPerUnit,
        supplierName: supplierName || target.supplierName,
        lastUpdated: new Date().toISOString().split('T')[0]
      };

      const updatedList = [...prev.inventoryItems];
      updatedList[idx] = updatedItem;

      const newLog: InventoryLog = {
        id: 'log-' + Date.now(),
        inventoryItemId: target.id,
        itemName: target.name,
        logType: 'restock_in',
        quantityChanged: quantity,
        unit: target.unit,
        stockBefore: target.currentStock,
        stockAfter: newStock,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: notes || `Restocked from ${supplierName || 'vendor'}`
      };

      return {
        ...prev,
        inventoryItems: updatedList,
        inventoryLogs: [newLog, ...prev.inventoryLogs]
      };
    });
    recordAudit('STOCK_IN_RECORDED', itemId, `Restocked +${quantity} units for ${itemId}`, 'INFO');
    playChime('success');
  };

  const handleStockOut = (
    itemId: string, 
    quantity: number, 
    reason: 'wastage_spoilage' | 'manual_adjustment', 
    notes: string
  ) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'STOCK_IN_OUT')) {
      recordAudit('UNAUTHORIZED_STOCK_MUTATION_BLOCKED', itemId, 'Unauthorized stock out attempt', 'CRITICAL');
      setSecurityAlert('Permission Denied: You do not have stock-out authorization.');
      playChime('alert');
      return;
    }

    setAppState(prev => {
      const idx = prev.inventoryItems.findIndex(i => i.id === itemId);
      if (idx === -1) return prev;
      const target = prev.inventoryItems[idx];

      const validation = validateStockChange(target.currentStock, quantity, true);
      if (!validation.isValid) return prev;

      const newStock = Math.max(0, Math.round((target.currentStock - quantity) * 1000) / 1000);
      const updatedItem: InventoryItem = {
        ...target,
        currentStock: newStock,
        lastUpdated: new Date().toISOString().split('T')[0]
      };

      const updatedList = [...prev.inventoryItems];
      updatedList[idx] = updatedItem;

      const newLog: InventoryLog = {
        id: 'log-' + Date.now(),
        inventoryItemId: target.id,
        itemName: target.name,
        logType: reason,
        quantityChanged: -quantity,
        unit: target.unit,
        stockBefore: target.currentStock,
        stockAfter: newStock,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: notes || 'Usage / Spoilage deduction'
      };

      return {
        ...prev,
        inventoryItems: updatedList,
        inventoryLogs: [newLog, ...prev.inventoryLogs]
      };
    });
    recordAudit('STOCK_OUT_RECORDED', itemId, `Deducted -${quantity} units (${reason})`, 'WARNING');
    playChime('alert');
  };

  const handleAddNewInventoryItem = (item: InventoryItem) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'STOCK_IN_OUT')) {
      setSecurityAlert('Permission Denied to add raw inventory materials.');
      playChime('alert');
      return;
    }

    setAppState(prev => ({
      ...prev,
      inventoryItems: [...prev.inventoryItems, item]
    }));
    recordAudit('INVENTORY_ITEM_CREATED', item.id, `Created inventory item ${item.name}`, 'INFO');
    playChime('success');
  };

  const handleAddCustomer = (customer: Customer) => {
    setAppState(prev => ({
      ...prev,
      customers: [customer, ...prev.customers]
    }));
    recordAudit('CUSTOMER_REGISTERED', customer.id, `Registered customer ${customer.name} (${customer.phone})`, 'INFO');
    playChime('success');
  };

  const handleRecordKhataPayment = (
    customerId: string, 
    amount: number, 
    paymentMode: 'cash' | 'fonepay_qr' | 'bank_transfer', 
    notes: string
  ) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'COLLECT_KHATA_PAYMENT')) {
      recordAudit('UNAUTHORIZED_KHATA_COLLECTION_BLOCKED', customerId, 'Khata collection permission denied', 'CRITICAL');
      setSecurityAlert('Permission Denied: Your staff role is not authorized to collect Khata payments.');
      playChime('alert');
      return;
    }

    if (amount <= 0 || !Number.isFinite(amount)) return;

    setAppState(prev => {
      const custIdx = prev.customers.findIndex(c => c.id === customerId);
      if (custIdx === -1) return prev;
      const cust = prev.customers[custIdx];
      const beforeBal = cust.creditBalance;
      const afterBal = Math.max(0, beforeBal - amount);

      const updatedCustomers = [...prev.customers];
      updatedCustomers[custIdx] = {
        ...cust,
        creditBalance: afterBal
      };

      const newTransaction: KhataTransaction = {
        id: 'kt-' + Date.now(),
        customerId: cust.id,
        customerName: cust.name,
        type: 'payment_received',
        amount,
        balanceBefore: beforeBal,
        balanceAfter: afterBal,
        paymentMode,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: notes || `Payment received via ${paymentMode}`
      };

      const glPatch = postKhataPaymentJournal(prev, newTransaction, currentSession?.name || 'Cashier');

      return {
        ...prev,
        customers: updatedCustomers,
        khataTransactions: [newTransaction, ...prev.khataTransactions],
        accounts: glPatch.accounts,
        journalEntries: glPatch.journalEntries
      };
    });
    recordAudit('KHATA_PAYMENT_COLLECTED', customerId, `Collected Rs. ${amount} via ${paymentMode} from ${customerId}`, 'INFO');
    playChime('success');
  };

  const handleAddKhataCredit = (customerId: string, amount: number, notes: string) => {
    const userRole = currentSession?.role;
    if (!userRole || !hasPermission(userRole, 'ADJUST_KHATA_CREDIT')) {
      recordAudit('UNAUTHORIZED_KHATA_ADJUSTMENT_BLOCKED', customerId, 'Khata credit manual addition attempt blocked', 'CRITICAL');
      setSecurityAlert('Permission Denied: Only authorized staff (Accountant, Manager, Admin) can manually adjust Khata credit.');
      playChime('alert');
      return;
    }

    if (amount <= 0 || !Number.isFinite(amount)) return;

    setAppState(prev => {
      const custIdx = prev.customers.findIndex(c => c.id === customerId);
      if (custIdx === -1) return prev;
      const cust = prev.customers[custIdx];
      const beforeBal = cust.creditBalance;
      const afterBal = beforeBal + amount;

      const updatedCustomers = [...prev.customers];
      updatedCustomers[custIdx] = {
        ...cust,
        creditBalance: afterBal
      };

      const newTransaction: KhataTransaction = {
        id: 'kt-' + Date.now(),
        customerId: cust.id,
        customerName: cust.name,
        type: 'credit_taken',
        amount,
        balanceBefore: beforeBal,
        balanceAfter: afterBal,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: notes || 'Manual credit added'
      };

      return {
        ...prev,
        customers: updatedCustomers,
        khataTransactions: [newTransaction, ...prev.khataTransactions]
      };
    });
    recordAudit('KHATA_CREDIT_MANUALLY_ADDED', customerId, `Manually added Rs. ${amount} credit to ${customerId}`, 'WARNING');
    playChime('alert');
  };

  const handleUpdateSettings = (newSettings: BusinessSettings) => {
    const userRole = currentSession?.role;
    if (userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      recordAudit('UNAUTHORIZED_CONFIG_MODIFICATION_BLOCKED', undefined, 'Non-admin attempted to update business profile/taxes', 'CRITICAL');
      setSecurityAlert('Permission Denied: Only Owner or Administrator can update establishment profiles or billing tax rates.');
      playChime('alert');
      return;
    }

    const cleanLogoUrl = 'logoUrl' in newSettings ? sanitizeBusinessLogoUrl(newSettings.logoUrl) : undefined;
    const sanitizedSettings: BusinessSettings =
      'logoUrl' in newSettings
        ? { ...newSettings, logoUrl: cleanLogoUrl }
        : newSettings;

    setAppState(prev => ({
      ...prev,
      settings: sanitizedSettings
    }));

    if ('logoUrl' in newSettings && activeBusiness && cleanLogoUrl !== activeBusiness.logo) {
      const updated = updateBusiness(activeBusiness.businessId, { logo: cleanLogoUrl });
      if (updated) {
        setBusinesses(getRegisteredBusinesses());
      }
    }

    if (cloudSyncStatus === 'connected' && isOwnerOrMaster) {
      updateCloudBusinessPolicy({
        businessId: activeBusiness.businessId,
        settings: sanitizedSettings,
        ownerControlLocked: sanitizedSettings.securitySettings?.ownerControlLocked
      }).catch((err) => console.error('Cloud settings sync failed:', err));
    }
    recordAudit('BUSINESS_SETTINGS_UPDATED', undefined, `Updated establishment profile and tax rates`, 'INFO');
  };

  const handleRestoreBackup = (importedState: AppState) => {
    const userRole = currentSession?.role;
    if (userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      recordAudit('UNAUTHORIZED_BACKUP_IMPORT_BLOCKED', undefined, 'Non-admin attempted to restore database backup', 'CRITICAL');
      setSecurityAlert('Permission Denied: Only Owner or Administrator can restore database backups.');
      playChime('alert');
      return;
    }

    const check = validateBackupJSON(importedState);
    if (!check.isValid || !check.cleanState) {
      recordAudit('TAMPERED_BACKUP_INJECTION_REJECTED', undefined, check.error || 'Corrupted payload rejected', 'CRITICAL');
      setSecurityAlert(check.error || 'Corrupted or tampered backup payload.');
      playChime('alert');
      return;
    }

    setAppState(check.cleanState);
    saveAppState(check.cleanState);
    recordAudit('DATABASE_BACKUP_RESTORED', undefined, `Successfully restored certified database backup`, 'WARNING');
    playChime('success');
  };

  const handleResetSampleData = () => {
    const userRole = currentSession?.role;
    if (userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      setSecurityAlert('Permission Denied: Only Owner or Administrator can reset data.');
      playChime('alert');
      return;
    }

    const freshState: AppState = {
      menuItems: INITIAL_MENU_ITEMS,
      tablesRooms: INITIAL_TABLES_ROOMS,
      orders: INITIAL_ORDERS,
      inventoryItems: INITIAL_INVENTORY,
      inventoryLogs: INITIAL_LOGS,
      customers: INITIAL_CUSTOMERS,
      khataTransactions: INITIAL_KHATA,
      expenses: INITIAL_EXPENSES,
      dayClosings: INITIAL_DAY_CLOSINGS,
      staffUsers: INITIAL_STAFF_USERS,
      auditLogs: [
        {
          id: 'audit-reset-' + Date.now(),
          staffId: currentSession?.staffId || 'admin',
          staffName: currentSession?.name || 'Administrator',
          role: currentSession?.role || 'OWNER',
          action: 'DEMO_DATA_RESET',
          details: 'Application database reset to initial secure state.',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          severity: 'WARNING'
        }
      ],
      settings: DEFAULT_SETTINGS,
      activeOrderId: 'ord-active-1',
      roomTypes: INITIAL_ROOM_TYPES,
      resortRooms: INITIAL_RESORT_ROOMS,
      guestProfiles: INITIAL_GUEST_PROFILES,
      reservations: INITIAL_RESERVATIONS,
      guestFolioItems: INITIAL_GUEST_FOLIOS,
      resortServices: INITIAL_RESORT_SERVICES,
      housekeepingTasks: INITIAL_HOUSEKEEPING_TASKS,
      maintenanceIssues: INITIAL_MAINTENANCE_ISSUES,
      hotelPayments: INITIAL_HOTEL_PAYMENTS
    };
    setAppState(freshState);
    saveAppState(freshState);
    playChime('success');
  };

  const handleUpdateStaffUsers = (users: StaffUser[]) => {
    const userRole = currentSession?.role;
    if (userRole !== 'ADMIN' && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'MANAGER') {
      setSecurityAlert('Permission Denied: Only Manager or Administrator can manage staff accounts.');
      return;
    }

    setAppState(prev => ({
      ...prev,
      staffUsers: users
    }));
    recordAudit('STAFF_ACCOUNTS_MUTATED', undefined, `Staff roster updated (${users.length} accounts)`, 'INFO');
  };

  const handleToggleSound = () => {
    setAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        enableSoundEffects: !prev.settings.enableSoundEffects
      }
    }));
  };

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900 selection:bg-orange-100 selection:text-orange-900 overflow-x-hidden">
      {/* Left Foodmandu Restro Vertical Dock Sidebar Navigation */}
      <SidebarNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        lang={language}
        currentRole={currentSession?.role}
        currentSession={currentSession}
        activeBusiness={activeBusiness}
        logoUrl={appState.settings.logoUrl}
        enabledModules={activeBusiness.enabledModules}
        occupiedTablesCount={occupiedTablesCount}
        occupiedRoomsCount={appState.resortRooms.filter(r => r.status === 'OCCUPIED').length}
        lowStockCount={lowStockCount}
        unpaidKhataCount={unpaidKhataCount}
        activeKOTCount={activeKOTCount}
        unpaidBillsCount={activeOrdersCount}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={() => {
          recordAudit('STAFF_LOGOUT', currentSession?.staffId, `Staff ${currentSession?.name} logged out`, 'INFO');
          clearSession();
          clearSensitiveCachesOnLogout();
          setCurrentSession(null);
          setShowLoginModal(true);
        }}
        onToggleSound={handleToggleSound}
        soundEnabled={appState.settings.enableSoundEffects ?? true}
        onBackupClick={() => exportBackupJSON(appState)}
        onOpenSuperAdmin={() => setShowSuperAdminModal(true)}
        onOpenBusinessSwitcher={() => setShowBusinessSwitcherModal(true)}
        onOpenMobileQR={() => setShowMobileQRModal(true)}
        isAppCreator={isMasterOwnerGoogle}
      />

      {/* Right Main Application Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <Header
          settings={appState.settings}
          lang={language}
          currentSession={currentSession}
          activeBusiness={activeBusiness}
          onOpenBusinessSwitcher={() => setShowBusinessSwitcherModal(true)}
          onOpenSuperAdmin={() => setShowSuperAdminModal(true)}
          onLanguageChange={setLanguage}
          onBackupClick={() => exportBackupJSON(appState)}
          onOpenLogin={() => setShowLoginModal(true)}
          onLogout={() => {
            recordAudit('STAFF_LOGOUT', currentSession?.staffId, `Staff ${currentSession?.name} logged out`, 'INFO');
            clearSession();
            clearSensitiveCachesOnLogout();
            setCurrentSession(null);
            setShowLoginModal(true);
          }}
          onOpenAuditLogs={() => setShowAuditLogModal(true)}
          onOpenSyncDetails={() => setShowSyncTestModal(true)}
          onFlushQueue={handleFlushOfflineQueue}
          lowStockCount={lowStockCount}
          activeOrdersCount={activeOrdersCount}
          isSaved={isSaved}
          onToggleSound={handleToggleSound}
          onToggleSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              setIsMobileSidebarOpen(prev => !prev);
            } else {
              handleToggleSidebar();
            }
          }}
          isSidebarCollapsed={isSidebarCollapsed}
          onOpenQuickActions={() => setShowQuickActionsModal(true)}
          onOpenNotifications={() => setShowNotificationsDrawer(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          onSwitchRole={handleQuickSwitchRole}
          canFreeSwitchRole={userCanFreeSwitchRoles}
          isMasterOwnerGoogle={isMasterOwnerGoogle}
          cloudSyncStatus={cloudSyncStatus}
          cloudUserEmail={firebaseUser?.email || null}
          onGoogleOwnerLogin={handleGoogleSignIn}
          ownerControlLocked={ownerControlLocked}
          onOpenMobileQR={() => setShowMobileQRModal(true)}
        />

        {/* Scrollable Main View Area */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {activeBusiness.status === 'SUSPENDED' && (
            <div className={`px-4 py-2.5 text-xs font-bold flex flex-wrap items-center justify-between gap-2 border-b ${
              isMasterOwnerGoogle
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-rose-600 border-rose-700 text-white'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  {isMasterOwnerGoogle
                    ? `App Creator Notice: Workspace "${activeBusiness.businessName}" is currently SUSPENDED for client billing (${activeBusiness.suspensionReason || 'Platform Hold'}).`
                    : `Workspace Suspended: ${activeBusiness.suspensionReason || 'Your SaaS subscription is paused.'} New orders & checkout are blocked. Contact App Creator: ${MASTER_OWNER_EMAIL}`}
                </span>
              </div>
              {isMasterOwnerGoogle && (
                <button
                  type="button"
                  onClick={() => setShowSuperAdminModal(true)}
                  className="px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800"
                >
                  Manage in Creator Hub
                </button>
              )}
            </div>
          )}
          {/* Security Enforcement Toast Banner (Overlay z-[70] so alerts are always visible above modals) */}
          {securityAlert && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-1.5rem)] max-w-lg animate-in fade-in">
              <div className="p-3.5 bg-rose-600 border border-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-between gap-3 shadow-2xl">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-white" />
                  <span>{securityAlert}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSecurityAlert(null)}
                  className="text-white/80 hover:text-white hover:bg-white/15 rounded p-1 shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

      {/* Main View Area */}
      <main className="flex-1 pb-24 md:pb-16">
        {!isCurrentTabPermitted && (
          <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-2xl border border-rose-200 shadow-2xs text-center">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {language === 'ne' ? 'पहुँच अनुमति छैन (Access Restricted)' : 'Access Restricted'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              {language === 'ne' 
                ? `तपाईंको भूमिका (${currentSession?.role || 'STAFF'}) लाई यो मोड्युल हेर्ने अधिकार प्रदान गरिएको छैन।` 
                : `Your staff role (${currentSession?.role || 'STAFF'}) is not authorized to access the "${activeTab}" module.`}
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  const home = getHomeConfigForRole(currentSession?.role, activeBusiness.enabledModules);
                  setActiveTab(home.defaultTab);
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors"
              >
                {language === 'ne' ? 'मेरो कार्यस्थल (Home) मा फर्कनुहोस्' : 'Return to My Workspace'}
              </button>
            </div>
          </div>
        )}
        {isCurrentTabPermitted && (
          <>
            {activeTab === 'dashboard' && (
              <BusinessDashboardView
                appState={appState}
                activeBusiness={activeBusiness}
                currentSession={currentSession}
                lang={language}
                onNavigateTab={handleTabChange}
                onOpenQuickPOS={() => handleTabChange('pos')}
                onSwitchRole={handleQuickSwitchRole}
              />
            )}

            {activeTab === 'pos' && (
              <POSView
                menuItems={appState.menuItems}
                tablesRooms={appState.tablesRooms}
                inventoryItems={appState.inventoryItems}
                customers={appState.customers}
                orders={appState.orders}
                settings={appState.settings}
                lang={language}
                currentSession={currentSession}
                initialSelectedTableId={selectedTableForPOS}
                navigationNonce={posNavigationNonce}
                initialCheckoutOrderId={pendingCheckoutOrderId}
                initialEditOrderId={pendingEditOrderId}
                initialOrderType={pendingPosOrderType}
                onClearPendingCheckout={() => setPendingCheckoutOrderId(null)}
                onClearPendingEditOrder={() => setPendingEditOrderId(null)}
                onClearPendingOrderType={() => setPendingPosOrderType(null)}
                onNavigateToTables={() => handleTabChange('tables_rooms')}
                onNavigateToBilling={() => handleTabChange('billing')}
                occupiedResortRooms={appState.resortRooms.filter(r => r.status === 'OCCUPIED')}
                onSaveOrder={handleSaveOrder}
                onSettleSplitOrder={handleSettleSplitOrder}
                onKOTSent={handleKOTSent}
                onAddMenuItem={handleAddMenuItem}
                onUpdateMenuItem={handleUpdateMenuItem}
                onDeleteMenuItem={handleDeleteMenuItem}
                onShiftTableOrder={handleShiftTableOrder}
                onPromptAuth={() => setShowLoginModal(true)}
                onMergeTables={handleMergeTables}
                onVoidOrder={handleVoidOrder}
                onVoidOrderItem={handleVoidOrderItem}
                onAdminUpdatePricing={handleAdminUpdatePricing}
                onForceReleaseTable={handleForceReleaseTable}
                onUpdateSettings={handleUpdateSettings}
                onReserveSequence={handleReserveSequence}
                staffUsers={appState.staffUsers}
                onUpdateStaffUsers={handleUpdateStaffUsers}
              />
            )}

            {activeTab === 'billing' && (
              <BillsView
                orders={appState.orders}
                tablesRooms={appState.tablesRooms}
                menuItems={appState.menuItems}
                inventoryItems={appState.inventoryItems}
                recipes={appState.recipes}
                customers={appState.customers}
                occupiedResortRooms={appState.resortRooms.filter(r => r.status === 'OCCUPIED')}
                settings={appState.settings}
                lang={language}
                currentSession={currentSession}
                onSaveOrder={handleSaveOrder}
                onOpenOrderInPOS={(tableRoomId, orderId) => {
                  setPendingCheckoutOrderId(null);
                  setPendingEditOrderId(orderId);
                  setSelectedTableForPOS(tableRoomId);
                  setPendingPosOrderType(null);
                  setPosNavigationNonce(prev => prev + 1);
                  setActiveTab('pos');
                }}
                onNavigateToTables={() => handleTabChange('tables_rooms')}
                onPromptAuth={() => setShowLoginModal(true)}
                onUpdateSettings={handleUpdateSettings}
              />
            )}

        {activeTab === 'tables_rooms' && (
          <TableRoomView
            tablesRooms={appState.tablesRooms}
            orders={appState.orders}
            settings={appState.settings}
            lang={language}
            currentSession={currentSession}
            onUpdateStatus={handleUpdateTableStatus}
            onSelectTableForPOS={handleSelectTableForPOS}
            onOpenCheckoutForOrder={handleOpenCheckoutFromTables}
            onStartQuickOrderType={handleStartQuickOrderType}
            onAddTableRoom={handleAddTableRoom}
            onUpdateTableRoom={handleUpdateTableRoom}
            onDeleteTableRoom={handleDeleteTableRoom}
            onUpdateTableAreas={handleUpdateTableAreas}
            onShiftTableOrder={handleShiftTableOrder}
            onMergeTables={handleMergeTables}
            onAssignWaiter={handleAssignWaiter}
            onNavigateToResort={() => setActiveTab('resort')}
            onVoidOrder={handleVoidOrder}
            onVoidOrderItem={handleVoidOrderItem}
            onAdminUpdatePricing={handleAdminUpdatePricing}
            onForceReleaseTable={handleForceReleaseTable}
          />
        )}

        {activeTab === 'resort' && (
          <ResortMainView
            appState={appState}
            activeBusiness={activeBusiness}
            settings={appState.settings}
            currentSession={currentSession}
            lang={language}
            onUpdateAppState={setAppState}
            recordAudit={recordAudit}
            playChime={playChime}
          />
        )}

        {activeTab === 'kds' && (
          <KitchenDisplayView
            orders={appState.orders}
            lang={language}
            businessName={activeBusiness.businessName}
            inventoryItems={appState.inventoryItems}
            onUpdateOrderStatus={handleUpdateKOTStatus}
            onRecordWaste={handleStockOut}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            inventoryItems={appState.inventoryItems}
            inventoryLogs={appState.inventoryLogs}
            stockMovements={appState.stockMovements}
            recipes={appState.recipes}
            suppliers={appState.suppliers}
            purchaseOrders={appState.purchaseOrders}
            menuItems={appState.menuItems}
            activeBusiness={activeBusiness}
            settings={appState.settings}
            lang={language}
            currentSession={currentSession}
            onStockIn={handleStockIn}
            onStockOut={handleStockOut}
            onAddNewItem={handleAddNewInventoryItem}
            onUpdateAppState={setAppState}
          />
        )}

        {activeTab === 'customers' && (
          <CustomerView
            customers={appState.customers}
            khataTransactions={appState.khataTransactions}
            settings={appState.settings}
            lang={language}
            currentSession={currentSession}
            onAddCustomer={handleAddCustomer}
            onRecordKhataPayment={handleRecordKhataPayment}
            onAddKhataCredit={handleAddKhataCredit}
          />
        )}

        {activeTab === 'day_closing' && (
          <DayClosingView
            expenses={appState.expenses || []}
            dayClosings={appState.dayClosings || []}
            orders={appState.orders}
            khataTransactions={appState.khataTransactions || []}
            hotelPayments={appState.hotelPayments || []}
            settings={appState.settings}
            lang={language}
            currentSession={currentSession}
            onAddExpense={handleAddExpense}
            onSaveDayClosing={handleSaveDayClosing}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            orders={appState.orders}
            settings={appState.settings}
            lang={language}
            appState={appState}
            activeBusiness={activeBusiness}
            currentSession={currentSession}
            onUpdateAppState={setAppState}
            recordAudit={recordAudit}
            hasMoreCloudOrders={hasMoreCloudOrders}
            isLoadingOlderCloudOrders={isLoadingOlderCloudOrders}
            onLoadOlderOrders={handleLoadOlderCloudOrders}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={appState.settings}
            appState={appState}
            lang={language}
            currentSession={currentSession}
            activeBusiness={activeBusiness}
            onUpdateBusiness={handleUpdateBusiness}
            onUpdateSettings={handleUpdateSettings}
            onRestoreBackup={handleRestoreBackup}
            onResetSampleData={handleResetSampleData}
            onUpdateStaffUsers={handleUpdateStaffUsers}
            onNavigateToBusinessAdmin={(tab) => {
              if (tab) setAdminInitialTab(tab);
              setActiveTab('business_admin');
            }}
            onOpenMobileQR={() => setShowMobileQRModal(true)}
            onOpenDownloadPortal={() => setShowDownloadPortal(true)}
          />
        )}

        {activeTab === 'business_admin' && (
          <BusinessAdminView
            business={activeBusiness}
            appState={appState}
            currentSession={currentSession}
            lang={language}
            onUpdateBusiness={handleUpdateBusiness}
            onUpdateAppState={setAppState}
            recordAudit={recordAudit}
            playChime={playChime}
            onOpenSetupWizard={() => setShowSetupWizardModal(true)}
            initialTab={adminInitialTab}
            firebaseUserEmail={firebaseUser?.email || null}
            isMasterOwnerVerified={isMasterOwnerGoogle}
            cloudSyncConnected={cloudSyncStatus === 'connected'}
            cloudOwnerUid={cloudOwnerUid}
            onGoogleOwnerConnect={handleGoogleSignIn}
            onGoogleSignOut={handleGoogleSignOut}
            onChangeOwnerPin={handleChangeOwnerPin}
            onOpenDownloadPortal={() => setShowDownloadPortal(true)}
          />
        )}
          </>
        )}
      </main>
        </div>
      </div>

      {/* Mobile Responsive Bottom Navigation Bar */}
      <MobileBottomBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        lang={language}
        occupiedTablesCount={occupiedTablesCount}
        activeKOTCount={activeKOTCount}
        unpaidBillsCount={activeOrdersCount}
        lowStockCount={lowStockCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        onOpenQuickSearch={() => setShowQuickActionsModal(true)}
        currentRole={currentSession?.role}
      />

      {/* Staff Authentication Modal */}
      <LoginModal
        isOpen={showLoginModal && !showDownloadPortal}
        staffUsers={appState.staffUsers}
        currentSession={currentSession}
        lang={language}
        isMandatory={!currentSession}
        ownerControlLocked={ownerControlLocked}
        cloudUserEmail={firebaseUser?.email || null}
        isGoogleAuthLoading={isGoogleAuthLoading}
        cloudAuthError={cloudAuthError}
        onGoogleSignIn={handleGoogleSignIn}
        onRotateStaffPin={handleRotateStaffPin}
        onAcceptInviteCode={async ({ inviteCode, username, fullName, pin }) => {
          saveTenantAppState(activeBusiness.businessId, appStateRef.current);
          const res = await acceptStaffInvitation(
            activeBusiness.businessId,
            inviteCode,
            username,
            fullName,
            pin
          );
          if (res.success && res.staffUser) {
            const normalizedCode = inviteCode.trim().toUpperCase();
            setAppState((prev) => ({
              ...prev,
              staffUsers: [...prev.staffUsers, res.staffUser!],
              staffInvitations: (prev.staffInvitations || []).map((inv) =>
                inv.inviteCode === normalizedCode ? { ...inv, status: 'ACCEPTED' as const } : inv
              )
            }));
            recordAudit(
              'STAFF_INVITATION_ACCEPTED',
              res.staffUser.id,
              `Staff ${res.staffUser.name} activated invite ${normalizedCode} (${res.staffUser.role})`,
              'INFO'
            );
          }
          return res;
        }}
        onOpenDownloadPortal={() => setShowDownloadPortal(true)}
        onOpenMobileQR={() => setShowMobileQRModal(true)}
        onLoginSuccess={(session) => {
          setCurrentSession(session);
          setShowLoginModal(false);
          setSecurityAlert(null);
          recordAudit('STAFF_AUTHENTICATED', session.staffId, `Logged in as ${session.name} (${session.role})`, 'INFO');
          playChime('success');
          const homeConfig = getHomeConfigForRole(session.role, activeBusiness.enabledModules);
          const userPrefs = getUserPreferences(session.staffId);
          if (userPrefs.defaultHomeTab && userPrefs.defaultHomeTab !== 'auto') {
            setActiveTab(userPrefs.defaultHomeTab);
          } else {
            setActiveTab(homeConfig.defaultTab);
          }
        }}
        onClose={() => {
          if (currentSession) setShowLoginModal(false);
        }}
      />

      {/* Security Audit Trail Logs Modal */}
      {showAuditLogModal && (
        <AuditLogModal
          auditLogs={appState.auditLogs || []}
          lang={language}
          onClose={() => setShowAuditLogModal(false)}
        />
      )}

      {/* Multi-Tenant Business Switcher Modal */}
      <BusinessSwitcherModal
        isOpen={showBusinessSwitcherModal}
        onClose={() => setShowBusinessSwitcherModal(false)}
        businesses={businesses}
        activeBusinessId={activeBusiness.businessId}
        onSelectBusiness={handleSwitchBusiness}
        onDeleteBusiness={handleDeleteBusiness}
        onUpdateBusiness={handleUpdateBusiness}
        onOpenRegister={() => setShowRegisterBusinessModal(true)}
        onOpenSuperAdmin={() => setShowSuperAdminModal(true)}
        currentRole={currentSession?.role}
        isAppCreator={isMasterOwnerGoogle}
      />

      {/* Business Registration / Onboarding Modal */}
      <RegisterBusinessModal
        isOpen={showRegisterBusinessModal}
        onClose={() => setShowRegisterBusinessModal(false)}
        onRegisterSuccess={handleRegisterBusinessSuccess}
        currentUser={currentSession ? { id: currentSession.staffId, name: currentSession.name, role: currentSession.role } : null}
      />

      {/* App Creator & SaaS Control Center Modal */}
      <SuperAdminBusinessManagerModal
        isOpen={showSuperAdminModal}
        onClose={() => setShowSuperAdminModal(false)}
        businesses={businesses}
        activeBusinessId={activeBusiness.businessId}
        onSelectBusiness={handleSwitchBusiness}
        onUpdateBusiness={handleUpdateBusiness}
        onOpenRegister={() => setShowRegisterBusinessModal(true)}
        currentRole={currentSession?.role}
        isAppCreator={isMasterOwnerGoogle}
        cloudSyncStatus={cloudSyncStatus}
        cloudUserEmail={firebaseUser?.email || null}
        onSyncCloudBusinesses={handleRefreshCreatorCloudBusinesses}
        onGoogleCreatorLogin={handleGoogleSignIn}
      />

      {/* Business Setup Wizard Modal */}
      <BusinessSetupWizardModal
        isOpen={showSetupWizardModal}
        onClose={() => setShowSetupWizardModal(false)}
        onSetupComplete={(newBiz) => {
          handleRegisterBusinessSuccess(newBiz);
          setShowSetupWizardModal(false);
        }}
        currentUser={currentSession ? { id: currentSession.staffId, name: currentSession.name, role: currentSession.role } : null}
      />

      {/* Real-Time Sync & Offline Resilience Suite Modal */}
      <SyncResilienceTestModal
        isOpen={showSyncTestModal}
        onClose={() => setShowSyncTestModal(false)}
        activeBusinessId={activeBusiness.businessId}
        appState={appState}
        onApplySyncOrder={(draft) => handleSaveOrder(draft, false, 'occupied')}
      />

      {/* Universal Smart Search & Quick Actions Modal */}
      <QuickActionsModal
        isOpen={showQuickActionsModal}
        onClose={() => setShowQuickActionsModal(false)}
        appState={appState}
        activeBusinessId={activeBusiness.businessId}
        lang={language}
        currentRole={currentSession?.role}
        onNavigateToTab={(tab) => {
          handleTabChange(tab);
          setShowQuickActionsModal(false);
        }}
        onOpenAuditLogs={() => {
          setShowAuditLogModal(true);
          setShowQuickActionsModal(false);
        }}
        onOpenSyncDetails={() => {
          setShowSyncTestModal(true);
          setShowQuickActionsModal(false);
        }}
        onOpenMobileQR={() => setShowMobileQRModal(true)}
      />
      <AppDownloadModal
        isOpen={showDownloadPortal}
        businessName={activeBusiness.businessName}
        tagline={appState.settings?.tagline}
        lang={language}
        androidApkUrl={appState.settings?.androidApkUrl}
        onLanguageChange={setLanguage}
        onContinueToApp={handleCloseDownloadPortal}
        isSignedInSession={!!currentSession}
      />
      <MobileAccessQRModal
        isOpen={showMobileQRModal}
        onClose={() => setShowMobileQRModal(false)}
        businessName={activeBusiness.businessName}
        lang={language}
        androidApkUrl={appState.settings?.androidApkUrl}
        onSaveAndroidApkUrl={(apkUrl) =>
          setAppState((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              androidApkUrl: apkUrl || undefined
            }
          }))
        }
        onOpenDownloadPortal={() => setShowDownloadPortal(true)}
      />
      <NotificationDrawerModal
        isOpen={showNotificationsDrawer}
        onClose={() => setShowNotificationsDrawer(false)}
        notifications={notifications}
        lang={language}
        onMarkAsRead={(id) => {
          markNotificationAsRead(activeBusiness.businessId, id, notifications);
          setNotifications(getConsolidatedNotifications(appState, activeBusiness.businessId, currentSession?.role));
        }}
        onMarkAllAsRead={() => {
          markAllNotificationsAsRead(activeBusiness.businessId, notifications);
          setNotifications(getConsolidatedNotifications(appState, activeBusiness.businessId, currentSession?.role));
        }}
        onNavigateTab={(tab) => handleTabChange(tab)}
      />
      <OfflineIndicator lang={language} />
    </div>
  );
}
