import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  Layers, 
  CreditCard, 
  Receipt, 
  Percent, 
  History, 
  Sparkles, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag, 
  AlertTriangle, 
  Hotel, 
  ChefHat, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  Lock, 
  Mail, 
  Phone, 
  MapPin, 
  KeyRound, 
  UserPlus, 
  PauseCircle, 
  Play, 
  FileText, 
  Printer, 
  Eye, 
  CheckCircle2, 
  SlidersHorizontal,
  ExternalLink,
  ShieldAlert,
  Bell,
  Volume2,
  RefreshCw,
  UtensilsCrossed,
  Zap,
  Globe,
  Upload,
  QrCode,
  ChevronDown,
  ChevronRight,
  Copy,
  Share2
} from 'lucide-react';
import {
  buildAppDownloadUrl,
  resolveDefaultPublicAppUrl
} from '../../utils/distribution';
import {
  compressBusinessLogoImageFile,
  compressPaymentQrImageFile,
  sanitizeBusinessLogoUrl,
  sanitizePaymentQrDataUrl
} from '../../utils/imageUtils';
import { WebsiteLinkKitCard } from '../common/WebsiteLinkKitCard';
import { MenuManagerModal } from '../menu/MenuManagerModal';
import { 
  AppState, 
  BusinessSettings, 
  BusinessTenant, 
  BusinessType, 
  PaymentMethodConfig, 
  ReceiptSettings, 
  Session, 
  StaffRole, 
  StaffUser,
  StaffInvitation,
  AppModule,
  NotificationSettings,
  SecuritySettings
} from '../../types';
import { ALL_APP_MODULES, DEFAULT_PAYMENT_METHODS, DEFAULT_RECEIPT_SETTINGS } from '../../services/tenantStorage';
import { createStaffAccount, hasPermission, hashPinWithSalt, getDefaultRolePermissions, validateProductionPin, AppAction } from '../../services/security';
import {
  MASTER_OWNER_EMAIL,
  CloudStaffInvite,
  CloudMemberRecord,
  listCloudInvites,
  listCloudMembers,
  createCloudStaffInvite,
  revokeCloudStaffInvite,
  updateCloudMemberAccess,
  updateCloudBusinessPolicy
} from '../../services/cloudSyncService';
import { InviteStaffModal } from './InviteStaffModal';
import { BusinessDataIsolationTestModal } from './BusinessDataIsolationTestModal';
import { HospitalityWorkflowTestModal } from './HospitalityWorkflowTestModal';
import { SyncResilienceTestModal } from './SyncResilienceTestModal';
import { computeTodayOrderAuditSummary } from '../../services/orderAudit';
import { TodayOperationsAuditPanel } from '../reports/TodayOperationsAuditPanel';

interface BusinessAdminViewProps {
  business: BusinessTenant;
  appState: AppState;
  currentSession: Session | null;
  lang: 'en' | 'ne';
  onUpdateBusiness: (businessId: string, updates: Partial<BusinessTenant>) => void;
  onUpdateAppState: React.Dispatch<React.SetStateAction<AppState>>;
  recordAudit: (action: string, targetId?: string, details?: string, severity?: 'INFO' | 'WARNING' | 'CRITICAL') => void;
  playChime: (type?: 'success' | 'alert' | 'beep') => void;
  onOpenSetupWizard?: () => void;
  initialTab?: AdminTab;
  firebaseUserEmail?: string | null;
  isMasterOwnerVerified?: boolean;
  cloudSyncConnected?: boolean;
  cloudOwnerUid?: string | null;
  onGoogleOwnerConnect?: () => Promise<void> | void;
  onGoogleSignOut?: () => Promise<void> | void;
  onChangeOwnerPin?: (newPin: string) => Promise<void>;
  onOpenDownloadPortal?: () => void;
}

type AdminTab = 
  | 'dashboard' 
  | 'profile' 
  | 'staff' 
  | 'roles' 
  | 'modules' 
  | 'payments' 
  | 'receipt' 
  | 'taxes' 
  | 'notifications'
  | 'security'
  | 'audit'
  | 'isolation';

export const BusinessAdminView: React.FC<BusinessAdminViewProps> = ({
  business,
  appState,
  currentSession,
  lang,
  onUpdateBusiness,
  onUpdateAppState,
  recordAudit,
  playChime,
  onOpenSetupWizard,
  initialTab,
  firebaseUserEmail = null,
  isMasterOwnerVerified = false,
  cloudSyncConnected = false,
  cloudOwnerUid = null,
  onGoogleOwnerConnect,
  onGoogleSignOut,
  onChangeOwnerPin,
  onOpenDownloadPortal
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab || 'dashboard');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showAdminMenuManager, setShowAdminMenuManager] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    businessName: business.businessName,
    nepaliBusinessName: business.nepaliBusinessName || '',
    tagline: business.tagline || '',
    phone: business.phone,
    email: business.email,
    address: business.address,
    panVatNumber: business.panVatNumber || '',
    logo: business.logo || '',
    businessType: business.businessType
  });

  // Sync profile form when business prop updates
  useEffect(() => {
    setProfileForm({
      businessName: business.businessName,
      nepaliBusinessName: business.nepaliBusinessName || '',
      tagline: business.tagline || '',
      phone: business.phone,
      email: business.email,
      address: business.address,
      panVatNumber: business.panVatNumber || '',
      logo: business.logo || '',
      businessType: business.businessType
    });
    setLogoUploadError(null);
  }, [
    business.businessId,
    business.businessName,
    business.nepaliBusinessName,
    business.tagline,
    business.phone,
    business.email,
    business.address,
    business.panVatNumber,
    business.logo,
    business.businessType
  ]);

  // Staff Management State
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('ALL');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showIsolationTestModal, setShowIsolationTestModal] = useState(false);
  const [showWorkflowTestModal, setShowWorkflowTestModal] = useState(false);
  const [showSyncTestModal, setShowSyncTestModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [uploadingQrPaymentId, setUploadingQrPaymentId] = useState<string | null>(null);
  const [paymentQrError, setPaymentQrError] = useState<string | null>(null);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // New staff form
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('WAITER');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  // Reset PIN modal
  const [resetPinStaff, setResetPinStaff] = useState<StaffUser | null>(null);
  const [newResetPin, setNewResetPin] = useState('');

  // Custom Payment Method modal
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [newPaymentName, setNewPaymentName] = useState('');
  const [newPaymentType, setNewPaymentType] = useState<PaymentMethodConfig['type']>('custom');
  const [newPaymentDetails, setNewPaymentDetails] = useState('');
  const [newPaymentInstructions, setNewPaymentInstructions] = useState('');

  // Receipt Settings State
  const receiptConfig: ReceiptSettings = appState.settings?.receiptSettings || {
    ...DEFAULT_RECEIPT_SETTINGS,
    receiptTitle: business.businessName
  };
  const [receiptForm, setReceiptForm] = useState<ReceiptSettings>(receiptConfig);

  // Payment Methods State
  const paymentMethods: PaymentMethodConfig[] = appState.settings?.paymentMethodsConfig || DEFAULT_PAYMENT_METHODS;
  const [paymentsList, setPaymentsList] = useState<PaymentMethodConfig[]>(paymentMethods);

  useEffect(() => {
    setPaymentsList(appState.settings?.paymentMethodsConfig || DEFAULT_PAYMENT_METHODS);
  }, [appState.settings?.paymentMethodsConfig]);

  // Tax and Currency Settings State
  const [vatEnabled, setVatEnabled] = useState(appState.settings?.enableVat ?? true);
  const [vatRate, setVatRate] = useState(appState.settings?.vatRatePercent ?? 13);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(appState.settings?.enableServiceCharge ?? true);
  const [serviceChargeRate, setServiceChargeRate] = useState(appState.settings?.serviceChargePercent ?? 10);
  const [currency, setCurrency] = useState(appState.settings?.currencySymbol || 'Rs.');

  // Notifications Settings State
  const [notificationForm, setNotificationForm] = useState<NotificationSettings>(() => {
    return appState.settings?.notificationSettings || {
      enableSoundAlerts: appState.settings?.enableSoundEffects ?? true,
      enableOrderChime: true,
      enableLowStockAlert: true,
      lowStockThresholdEmail: business.email || 'inventory@himalayanbreeze.com',
      enableDailyCloseAlert: true,
      dailyCloseReportEmail: business.email || 'accounts@himalayanbreeze.com'
    };
  });

  // Security Settings State
  const [securityForm, setSecurityForm] = useState<SecuritySettings>(() => {
    const existing = appState.settings?.securitySettings;
    return {
      sessionTimeoutMinutes: existing?.sessionTimeoutMinutes || appState.settings?.sessionTimeoutMinutes || 60,
      requirePinForDiscounts: existing?.requirePinForDiscounts ?? true,
      requirePinForVoidOrder: existing?.requirePinForVoidOrder ?? true,
      requirePinForDayClose: existing?.requirePinForDayClose ?? true,
      strictTenantDataIsolation: existing?.strictTenantDataIsolation ?? true,
      allowSuperAdminAuditInspect: existing?.allowSuperAdminAuditInspect ?? true,
      ownerControlLocked: existing?.ownerControlLocked !== false,
      masterOwnerEmail: existing?.masterOwnerEmail || MASTER_OWNER_EMAIL
    };
  });

  useEffect(() => {
    const existing = appState.settings?.securitySettings;
    if (existing) {
      setSecurityForm(prev => ({
        ...prev,
        ...existing,
        ownerControlLocked: existing.ownerControlLocked !== false,
        masterOwnerEmail: existing.masterOwnerEmail || MASTER_OWNER_EMAIL
      }));
    }
  }, [appState.settings?.securitySettings]);

  // Owner PIN Change & Multi-Device Cloud Staff Access Control State
  const [ownerNewPin, setOwnerNewPin] = useState('');
  const [ownerConfirmPin, setOwnerConfirmPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const [cloudInvites, setCloudInvites] = useState<CloudStaffInvite[]>([]);
  const [cloudMembers, setCloudMembers] = useState<CloudMemberRecord[]>([]);
  const [isLoadingCloudAccess, setIsLoadingCloudAccess] = useState(false);
  const [cloudAccessError, setCloudAccessError] = useState<string | null>(null);
  const [cloudInviteEmail, setCloudInviteEmail] = useState('');
  const [cloudInviteName, setCloudInviteName] = useState('');
  const [cloudInviteRole, setCloudInviteRole] = useState<StaffRole>('WAITER');
  const [isSendingCloudInvite, setIsSendingCloudInvite] = useState(false);
  const [lastCreatedCloudInvite, setLastCreatedCloudInvite] = useState<{ email: string; staffName: string; role: StaffRole } | null>(null);
  const [copiedInviteKey, setCopiedInviteKey] = useState<string | null>(null);

  const isOwnerOrAdmin =
    isMasterOwnerVerified ||
    currentSession?.role === 'OWNER' ||
    currentSession?.role === 'SUPER_ADMIN' ||
    currentSession?.role === 'ADMIN';

  const refreshCloudAccessLists = async () => {
    if (!cloudSyncConnected || !isOwnerOrAdmin) return;
    setIsLoadingCloudAccess(true);
    setCloudAccessError(null);
    try {
      const [invites, members] = await Promise.all([
        listCloudInvites(business.businessId),
        listCloudMembers(business.businessId)
      ]);
      setCloudInvites(invites);
      setCloudMembers(members);
    } catch (err: any) {
      setCloudAccessError(err?.message || 'Could not load cloud mobile device access list.');
    } finally {
      setIsLoadingCloudAccess(false);
    }
  };

  useEffect(() => {
    if ((activeTab === 'security' || activeTab === 'staff') && cloudSyncConnected && isOwnerOrAdmin) {
      refreshCloudAccessLists();
    }
  }, [activeTab, cloudSyncConnected, business.businessId, isOwnerOrAdmin]);

  // Custom Roles Permissions Matrix State
  const [customRolesPermissions, setCustomRolesPermissions] = useState<Record<string, string[]>>(() => {
    return appState.settings?.customRolePermissions || {};
  });

  // Roles Matrix Catalog
  const defaultRoles: StaffRole[] = [
    'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 
    'RECEPTIONIST', 'HOUSEKEEPING', 'ACCOUNTANT', 'INVENTORY_STAFF', 'STAFF'
  ];

  // -------------------------------------------------------------
  // CALCULATED EXECUTIVE METRICS FOR DASHBOARD
  // -------------------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0];

  const todayAudit = useMemo(() => {
    return computeTodayOrderAuditSummary(appState.orders);
  }, [appState.orders]);

  const todayOrders = useMemo(() => todayAudit.rows.map(r => r.order), [todayAudit]);
  const todaySales = todayAudit.completedRevenue;

  const activeOrdersCount = useMemo(() => {
    return appState.orders.filter(o => o.status === 'active' && o.kotStatus !== 'cancelled' && (o.items?.length || 0) > 0).length;
  }, [appState.orders]);

  const todayExpenses = useMemo(() => {
    return (appState.expenses || [])
      .filter(e => e.date && e.date.startsWith(todayStr))
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [appState.expenses, todayStr]);

  const totalOutstandingCredit = useMemo(() => {
    return appState.customers.reduce((sum, c) => sum + (c.creditBalance > 0 ? c.creditBalance : 0), 0);
  }, [appState.customers]);

  const lowStockCount = useMemo(() => {
    return appState.inventoryItems.filter(i => i.currentStock <= i.minStockAlert).length;
  }, [appState.inventoryItems]);

  const occupiedTables = useMemo(() => {
    return appState.tablesRooms.filter(t => t.status === 'occupied').length;
  }, [appState.tablesRooms]);

  // Resort-specific stats
  const isResortOrHotel = business.businessType.includes('RESORT') || business.businessType.includes('HOTEL');
  const occupiedRooms = useMemo(() => {
    return appState.resortRooms.filter(r => r.status === 'OCCUPIED').length;
  }, [appState.resortRooms]);

  const availableRooms = useMemo(() => {
    return appState.resortRooms.filter(r => r.status === 'AVAILABLE').length;
  }, [appState.resortRooms]);

  const todayCheckIns = useMemo(() => {
    return appState.reservations.filter(r => r.checkInDate === todayStr && r.status !== 'CANCELLED').length;
  }, [appState.reservations, todayStr]);

  const todayCheckOuts = useMemo(() => {
    return appState.reservations.filter(r => r.checkOutDate === todayStr && r.status === 'CHECKED_IN').length;
  }, [appState.reservations, todayStr]);

  const upcomingReservations = useMemo(() => {
    return (appState.reservations || []).filter(r => r.checkInDate > todayStr && r.status === 'CONFIRMED').length;
  }, [appState.reservations, todayStr]);

  const kitchenOrdersCount = useMemo(() => {
    return (appState.orders || []).filter(o => o.status === 'active' && o.kotStatus !== 'expired' && o.kotStatus !== 'cancelled' && o.items?.some(i => i.kotStatus !== 'served')).length;
  }, [appState.orders]);

  const pendingBillsCount = useMemo(() => {
    return (appState.orders || []).filter(o => o.status === 'active' && o.kotStatus !== 'cancelled' && (o.items?.length || 0) > 0).length;
  }, [appState.orders]);

  const totalRevenue = useMemo(() => {
    return (appState.orders || [])
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  }, [appState.orders]);

  // Business-scoped staff users
  const businessStaffUsers = useMemo(() => {
    return appState.staffUsers.filter(u => {
      // Must either have u.businessId === business.businessId OR default match if not set
      if (u.businessId) return u.businessId === business.businessId;
      return business.businessId === 'biz-himalayan-breeze';
    });
  }, [appState.staffUsers, business.businessId]);

  const filteredStaff = useMemo(() => {
    return businessStaffUsers.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(staffSearch.toLowerCase()) || 
                          s.username.toLowerCase().includes(staffSearch.toLowerCase());
      const matchRole = staffRoleFilter === 'ALL' || s.role === staffRoleFilter;
      return matchSearch && matchRole;
    });
  }, [businessStaffUsers, staffSearch, staffRoleFilter]);

  // Business-scoped Audit Logs
  const businessAuditLogs = useMemo(() => {
    return (appState.auditLogs || []).filter(a => {
      if (a.businessId) return a.businessId === business.businessId;
      return business.businessId === 'biz-himalayan-breeze';
    });
  }, [appState.auditLogs, business.businessId]);

  // -------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------
  const showBanner = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploadError(null);
    setIsUploadingLogo(true);
    try {
      const compressed = await compressBusinessLogoImageFile(file, 256);
      setProfileForm(prev => ({ ...prev, logo: compressed }));
    } catch (err: any) {
      setLogoUploadError(err?.message || 'Could not process logo image.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBusinessName = profileForm.businessName.trim();
    if (!trimmedBusinessName) {
      showBanner('Business Name cannot be empty.');
      return;
    }

    const rawLogo = profileForm.logo.trim();
    const cleanLogo = sanitizeBusinessLogoUrl(rawLogo);
    if (rawLogo && !cleanLogo) {
      setLogoUploadError('Invalid logo URL. Upload a PNG/JPG/WebP file or use a valid https:// URL.');
      return;
    }
    setLogoUploadError(null);

    const updatedPayload = {
      ...profileForm,
      businessName: trimmedBusinessName,
      nepaliBusinessName: profileForm.nepaliBusinessName.trim() || undefined,
      tagline: profileForm.tagline.trim() || undefined,
      phone: profileForm.phone.trim(),
      email: profileForm.email.trim(),
      address: profileForm.address.trim(),
      panVatNumber: profileForm.panVatNumber.trim() || undefined,
      logo: cleanLogo
    };

    // Update business tenant record immediately
    onUpdateBusiness(business.businessId, updatedPayload);

    // Synchronize current app state settings
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        businessName: trimmedBusinessName,
        nepaliBusinessName: profileForm.nepaliBusinessName.trim() || prev.settings.nepaliBusinessName,
        tagline: profileForm.tagline.trim() || prev.settings.tagline,
        phone: profileForm.phone.trim() || prev.settings.phone,
        email: profileForm.email.trim() || prev.settings.email,
        address: profileForm.address.trim() || prev.settings.address,
        panVatNumber: profileForm.panVatNumber.trim() || prev.settings.panVatNumber,
        logoUrl: cleanLogo
      }
    }));

    recordAudit('BUSINESS_PROFILE_UPDATED', business.businessId, `Updated profile settings for ${trimmedBusinessName}`);
    playChime('success');
    showBanner(`Business Profile updated successfully for "${trimmedBusinessName}"!`);
  };

  const handleToggleModule = (mod: AppModule) => {
    if (mod === 'pos' || mod === 'settings' || mod === 'business_admin') return;
    const current = business.enabledModules;
    const next = current.includes(mod) ? current.filter(m => m !== mod) : [...current, mod];
    onUpdateBusiness(business.businessId, { enabledModules: next });
    recordAudit('MODULE_TOGGLED', mod, `Module ${mod} set to ${next.includes(mod) ? 'ENABLED' : 'DISABLED'}`);
    playChime('beep');
    showBanner(`Module ${mod} updated!`);
  };

  const handleToggleStaffStatus = (staff: StaffUser) => {
    const updatedUsers = appState.staffUsers.map(u => 
      u.id === staff.id ? { ...u, isActive: !u.isActive } : u
    );
    onUpdateAppState(prev => ({ ...prev, staffUsers: updatedUsers }));
    recordAudit('STAFF_STATUS_TOGGLED', staff.id, `Staff ${staff.name} is now ${!staff.isActive ? 'Active' : 'Disabled'}`);
    playChime('beep');
    showBanner(`Staff account ${staff.name} status updated.`);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffUsername.trim() || !newStaffName.trim() || !newStaffPin.trim()) {
      return;
    }

    const pinCheck = await validateProductionPin(newStaffPin.trim(), appState.staffUsers);
    if (!pinCheck.isValid) {
      showBanner(pinCheck.error || 'Weak or duplicate PIN is not allowed.');
      return;
    }

    try {
      const created = await createStaffAccount(
        newStaffUsername.trim(),
        newStaffName.trim(),
        newStaffName.trim(),
        newStaffRole,
        newStaffPin.trim()
      );
      created.businessId = business.businessId;
      created.email = newStaffEmail.trim() || undefined;
      created.phone = newStaffPhone.trim() || undefined;
      created.mustChangePin = false;
      created.lastPinChangedAt = new Date().toISOString();

      onUpdateAppState(prev => ({
        ...prev,
        staffUsers: [...prev.staffUsers, created]
      }));

      recordAudit('STAFF_ACCOUNT_CREATED', created.id, `Created staff ${created.name} (${created.role}) strictly for ${business.businessName}`);
      playChime('success');
      setShowAddStaffModal(false);
      setNewStaffUsername('');
      setNewStaffName('');
      setNewStaffPin('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      showBanner(`Staff ${created.name} added to roster.`);
    } catch (err: any) {
      showBanner(err?.message || 'Failed to create staff account');
    }
  };

  const handleSavePayments = () => {
    const sanitizedList = paymentsList.map(pm => ({
      ...pm,
      qrImageDataUrl: sanitizePaymentQrDataUrl(pm.qrImageDataUrl)
    }));
    setPaymentsList(sanitizedList);
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        paymentMethodsConfig: sanitizedList
      }
    }));
    recordAudit('PAYMENT_METHODS_CONFIGURED', business.businessId, `Configured ${sanitizedList.filter(p => p.enabled).length} payment methods`);
    playChime('success');
    showBanner(lang === 'ne' ? 'भुक्तानी माध्यम र QR विवरण सुरक्षित गरियो!' : 'Payment configuration & QR images saved!');
  };

  const handlePaymentQrUpload = async (paymentId: string, file?: File) => {
    if (!file) return;
    setPaymentQrError(null);
    setUploadingQrPaymentId(paymentId);
    try {
      const compressedDataUrl = await compressPaymentQrImageFile(file);
      const updated = paymentsList.map(pm =>
        pm.id === paymentId ? { ...pm, qrImageDataUrl: compressedDataUrl, enabled: true } : pm
      );
      setPaymentsList(updated);
      onUpdateAppState(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          paymentMethodsConfig: updated
        }
      }));
      recordAudit('PAYMENT_QR_UPLOADED', paymentId, `Uploaded Scan-to-Pay QR photo for ${paymentId}`);
      playChime('success');
      showBanner(lang === 'ne' ? 'भुक्तानी QR फोटो अपलोड भई सिंक भयो!' : 'Payment QR photo uploaded and synced to checkout!');
    } catch (err: any) {
      setPaymentQrError(err?.message || 'Failed to process QR image.');
    } finally {
      setUploadingQrPaymentId(null);
    }
  };

  const handleRemovePaymentQr = (paymentId: string) => {
    const updated = paymentsList.map(pm =>
      pm.id === paymentId ? { ...pm, qrImageDataUrl: undefined } : pm
    );
    setPaymentsList(updated);
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        paymentMethodsConfig: updated
      }
    }));
    recordAudit('PAYMENT_QR_REMOVED', paymentId, `Removed Scan-to-Pay QR photo for ${paymentId}`);
    showBanner(lang === 'ne' ? 'भुक्तानी QR फोटो हटाइयो।' : 'Payment QR photo removed.');
  };

  const handleSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        receiptSettings: receiptForm
      }
    }));
    recordAudit('RECEIPT_SETTINGS_SAVED', business.businessId, `Updated invoice prefix to ${receiptForm.invoicePrefix}`);
    playChime('success');
    showBanner('Receipt layout settings saved!');
  };

  const handleSaveTaxes = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        currencySymbol: currency,
        enableVat: vatEnabled,
        vatRatePercent: vatRate,
        enableServiceCharge: serviceChargeEnabled,
        serviceChargePercent: serviceChargeRate
      }
    }));
    recordAudit('TAX_CONFIG_MUTATED', business.businessId, `VAT: ${vatEnabled ? vatRate + '%' : 'Off'}, Service Charge: ${serviceChargeEnabled ? serviceChargeRate + '%' : 'Off'}`);
    playChime('success');
    showBanner('Tax & charge policies saved!');
  };

  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        enableSoundEffects: notificationForm.enableSoundAlerts,
        notificationSettings: notificationForm
      }
    }));
    recordAudit('NOTIFICATIONS_CONFIG_SAVED', business.businessId, `Notification policies updated for ${business.businessName}`);
    playChime('success');
    showBanner('Notification preferences saved!');
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextSecurity: SecuritySettings = {
      ...securityForm,
      ownerControlLocked: securityForm.ownerControlLocked !== false,
      masterOwnerEmail: MASTER_OWNER_EMAIL
    };
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        sessionTimeoutMinutes: nextSecurity.sessionTimeoutMinutes,
        securitySettings: nextSecurity
      }
    }));
    if (cloudSyncConnected && isOwnerOrAdmin) {
      try {
        await updateCloudBusinessPolicy({
          businessId: business.businessId,
          ownerControlLocked: nextSecurity.ownerControlLocked
        });
      } catch (err: any) {
        setCloudAccessError(err?.message || 'Saved locally, but could not push Owner Lock policy to cloud.');
      }
    }
    recordAudit('SECURITY_CONFIG_SAVED', business.businessId, `Session timeout: ${nextSecurity.sessionTimeoutMinutes}m, OwnerLock: ${nextSecurity.ownerControlLocked}`);
    playChime('success');
    showBanner('Security & Owner Control policies saved!');
  };

  const handleUpdateOwnerMasterPin = async () => {
    setPinChangeMsg(null);
    const trimmedPin = ownerNewPin.trim();
    if (!/^\d{4,6}$/.test(trimmedPin)) {
      setPinChangeMsg({ type: 'error', text: lang === 'ne' ? 'PIN ४ देखि ६ अंकको नम्बर हुनुपर्छ।' : 'PIN must be 4 to 6 numeric digits.' });
      return;
    }
    if (trimmedPin !== ownerConfirmPin.trim()) {
      setPinChangeMsg({ type: 'error', text: lang === 'ne' ? 'दुवै PIN मिलेनन्।' : 'Confirmation PIN does not match.' });
      return;
    }
    const pinCheck = await validateProductionPin(
      trimmedPin,
      appState.staffUsers.filter(u => u.role !== 'OWNER' && u.role !== 'ADMIN')
    );
    if (!pinCheck.isValid) {
      setPinChangeMsg({ type: 'error', text: pinCheck.error || 'Weak or duplicate PIN is not allowed.' });
      return;
    }
    setIsUpdatingPin(true);
    try {
      if (onChangeOwnerPin) {
        await onChangeOwnerPin(trimmedPin);
      } else {
        const changedAt = new Date().toISOString();
        const updatedStaff = await Promise.all(
          appState.staffUsers.map(async (u) => {
            if (u.role === 'OWNER' || u.role === 'ADMIN') {
              const newHash = await hashPinWithSalt(trimmedPin, u.salt);
              return { ...u, pinHash: newHash, mustChangePin: false, lastPinChangedAt: changedAt };
            }
            return u;
          })
        );
        onUpdateAppState(prev => ({ ...prev, staffUsers: updatedStaff }));
      }
      recordAudit('OWNER_PIN_CHANGED', business.businessId, 'Owner & Admin master PIN rotated securely', 'WARNING');
      playChime('success');
      setOwnerNewPin('');
      setOwnerConfirmPin('');
      setPinChangeMsg({
        type: 'success',
        text: lang === 'ne' ? 'Owner Master PIN सफलतापूर्वक परिवर्तन भयो!' : 'Owner & Admin Master PIN updated securely!'
      });
    } catch (err: any) {
      setPinChangeMsg({ type: 'error', text: err?.message || 'Failed to update Owner PIN.' });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleSendCloudInvite = async () => {
    if (!cloudOwnerUid) {
      setCloudAccessError(
        lang === 'ne'
          ? `कृपया पहिले ${MASTER_OWNER_EMAIL} बाट Google लग-इन गर्नुहोस्।`
          : `Please sign in with Google (${MASTER_OWNER_EMAIL}) first to invite staff devices.`
      );
      return;
    }
    const targetEmail = cloudInviteEmail.trim();
    const targetName = cloudInviteName.trim();
    const targetRole = cloudInviteRole;
    setCloudAccessError(null);
    setIsSendingCloudInvite(true);
    try {
      await createCloudStaffInvite({
        businessId: business.businessId,
        ownerUid: cloudOwnerUid,
        email: targetEmail,
        staffName: targetName,
        role: targetRole
      });
      recordAudit('CLOUD_STAFF_INVITED', targetEmail, `Invited ${targetEmail} with role ${targetRole}`);
      playChime('success');
      setLastCreatedCloudInvite({ email: targetEmail, staffName: targetName || targetEmail, role: targetRole });
      setCloudInviteEmail('');
      setCloudInviteName('');
      await refreshCloudAccessLists();
      showBanner(
        lang === 'ne'
          ? `${targetEmail} (${targetRole}) Cloud मा अनुमोदित भयो — अब तलको मेसेज/लिंक WhatsApp बाट पठाउनुहोस्।`
          : `Gmail authorized in Cloud for ${targetEmail} (${targetRole}) — share the install link below with your staff.`
      );
    } catch (err: any) {
      setCloudAccessError(err?.message || 'Could not create cloud invite.');
    } finally {
      setIsSendingCloudInvite(false);
    }
  };

  const buildStaffInviteShareText = (staffName: string, email: string, role: StaffRole): string => {
    const publicOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const appInstallUrl = buildAppDownloadUrl(resolveDefaultPublicAppUrl(publicOrigin), business.businessId);
    if (lang === 'ne') {
      return `नमस्ते ${staffName || email},\n"${business.businessName}" POS एपमा तपाईंलाई ${role} भूमिका दिइएको छ।\n\n१) यो लिंक Chrome/Safari मा खोलेर मोबाइलमा एप Install गर्नुहोस्:\n${appInstallUrl}\n\n२) एप खोलेर "Continue with Google" थिच्नुहोस् र यही Gmail बाट लग-इन गर्नुहोस्:\n${email}`;
    }
    return `Hi ${staffName || email},\nYou have been granted ${role} access to "${business.businessName}".\n\n1) Open this link in Chrome/Safari to install the app on your mobile:\n${appInstallUrl}\n\n2) Open the app, tap "Continue with Google", and sign in with:\n${email}`;
  };

  const handleCopyStaffInviteShare = async (key: string, staffName: string, email: string, role: StaffRole) => {
    const text = buildStaffInviteShareText(staffName, email, role);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInviteKey(key);
      setTimeout(() => setCopiedInviteKey(null), 2500);
      showBanner(lang === 'ne' ? 'स्टाफ निमन्त्रणा मेसेज र एप लिंक कपी भयो!' : 'Staff invite message & app link copied!');
    } catch {
      setCloudAccessError(lang === 'ne' ? 'मेसेज कपी गर्न सकिएन — माथिको Download लिंक सेयर गर्नुहोस्।' : 'Could not copy to clipboard.');
    }
  };

  const handleShareStaffInviteNative = async (staffName: string, email: string, role: StaffRole) => {
    const text = buildStaffInviteShareText(staffName, email, role);
    const publicOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const appInstallUrl = buildAppDownloadUrl(resolveDefaultPublicAppUrl(publicOrigin), business.businessId);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${business.businessName} — Staff Access (${role})`,
          text,
          url: appInstallUrl
        });
        return;
      } catch {
        // User cancelled native share sheet
      }
    }
    await handleCopyStaffInviteShare(`share-${email}`, staffName, email, role);
  };

  const handleRevokeCloudInvite = async (inviteId: string) => {
    setCloudAccessError(null);
    try {
      await revokeCloudStaffInvite(business.businessId, inviteId);
      recordAudit('CLOUD_INVITE_REVOKED', inviteId, 'Revoked pending staff invite', 'WARNING');
      playChime('beep');
      await refreshCloudAccessLists();
    } catch (err: any) {
      setCloudAccessError(err?.message || 'Failed to revoke invite.');
    }
  };

  const handleToggleCloudMemberActive = async (member: CloudMemberRecord) => {
    setCloudAccessError(null);
    try {
      await updateCloudMemberAccess({
        businessId: business.businessId,
        memberUid: member.uid,
        updates: { isActive: !member.isActive }
      });
      recordAudit(
        'CLOUD_MEMBER_STATUS_CHANGED',
        member.uid,
        `${member.email} set to ${!member.isActive ? 'ACTIVE' : 'REVOKED'}`,
        !member.isActive ? 'INFO' : 'WARNING'
      );
      playChime('beep');
      await refreshCloudAccessLists();
    } catch (err: any) {
      setCloudAccessError(err?.message || 'Failed to update device status.');
    }
  };

  const handleUpdateCloudMemberRole = async (member: CloudMemberRecord, nextRole: StaffRole) => {
    setCloudAccessError(null);
    try {
      await updateCloudMemberAccess({
        businessId: business.businessId,
        memberUid: member.uid,
        updates: { role: nextRole }
      });
      recordAudit('CLOUD_MEMBER_ROLE_CHANGED', member.uid, `${member.email} role changed to ${nextRole}`, 'INFO');
      playChime('success');
      await refreshCloudAccessLists();
    } catch (err: any) {
      setCloudAccessError(err?.message || 'Failed to update staff role.');
    }
  };

  const handleToggleRoleAction = (role: StaffRole, action: AppAction) => {
    if (role === 'SUPER_ADMIN' || role === 'OWNER') return;
    const currentActions = customRolesPermissions[role] 
      ? [...customRolesPermissions[role]]
      : getDefaultRolePermissions(role);

    const nextActions = currentActions.includes(action)
      ? currentActions.filter(a => a !== action)
      : [...currentActions, action];

    setCustomRolesPermissions(prev => ({
      ...prev,
      [role]: nextActions
    }));
  };

  const handleSaveRolePermissions = () => {
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        customRolePermissions: customRolesPermissions
      }
    }));
    recordAudit('ROLE_PERMISSIONS_MUTATED', business.businessId, `Customized role permissions matrix saved for ${business.businessName}`);
    playChime('success');
    showBanner('Role permissions matrix saved successfully!');
  };

  const handleResetRolePermissions = () => {
    setCustomRolesPermissions({});
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        customRolePermissions: {}
      }
    }));
    recordAudit('ROLE_PERMISSIONS_RESET', business.businessId, `Role permissions reset to default baseline`);
    playChime('beep');
    showBanner('Permissions reset to system defaults!');
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPinStaff || newResetPin.length < 4) return;
    const pinCheck = await validateProductionPin(newResetPin.trim(), appState.staffUsers, { excludeStaffId: resetPinStaff.id });
    if (!pinCheck.isValid) {
      showBanner(pinCheck.error || 'Weak or duplicate PIN is not allowed.');
      return;
    }
    try {
      const newHash = await hashPinWithSalt(newResetPin.trim(), resetPinStaff.salt);
      const changedAt = new Date().toISOString();
      const updated = appState.staffUsers.map(s =>
        s.id === resetPinStaff.id
          ? { ...s, pinHash: newHash, mustChangePin: false, lastPinChangedAt: changedAt }
          : s
      );
      onUpdateAppState(prev => ({ ...prev, staffUsers: updated }));
      recordAudit('STAFF_PIN_RESET', resetPinStaff.id, `PIN updated for ${resetPinStaff.name}`);
      playChime('success');
      setResetPinStaff(null);
      setNewResetPin('');
      showBanner(`Security PIN reset for ${resetPinStaff.name}.`);
    } catch {
      showBanner('Error updating PIN');
    }
  };

  const handleEditStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    const updated = appState.staffUsers.map(s => s.id === editingStaff.id ? editingStaff : s);
    onUpdateAppState(prev => ({ ...prev, staffUsers: updated }));
    recordAudit('STAFF_PROFILE_UPDATED', editingStaff.id, `Updated details for ${editingStaff.name}`);
    playChime('success');
    setEditingStaff(null);
    showBanner(`Staff ${editingStaff.name} profile updated.`);
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPaymentName.trim()) return;
    const newPm: PaymentMethodConfig = {
      id: 'pm-custom-' + Date.now().toString(36),
      name: newPaymentName.trim(),
      type: newPaymentType,
      enabled: true,
      accountDetails: newPaymentDetails.trim() || undefined,
      instructions: newPaymentInstructions.trim() || undefined
    };
    const nextList = [...paymentsList, newPm];
    setPaymentsList(nextList);
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        paymentMethodsConfig: nextList
      }
    }));
    recordAudit('PAYMENT_METHOD_ADDED', newPm.id, `Added payment method ${newPm.name} (${newPm.type})`);
    playChime('success');
    setShowAddPaymentModal(false);
    setNewPaymentName('');
    setNewPaymentDetails('');
    setNewPaymentInstructions('');
    showBanner(`Payment method ${newPm.name} added.`);
  };

  const handleRemovePaymentMethod = (id: string) => {
    const nextList = paymentsList.filter(p => p.id !== id);
    setPaymentsList(nextList);
    onUpdateAppState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        paymentMethodsConfig: nextList
      }
    }));
    recordAudit('PAYMENT_METHOD_REMOVED', id, `Removed payment method ${id}`);
    playChime('beep');
    showBanner('Payment method removed.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <Building2 className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {business.businessName}
              </h1>
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {business.businessType.replace(/_/g, ' ')}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Owner Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Enterprise ID: <span className="font-mono text-slate-700 font-semibold">{business.businessId}</span> · Owner: <span className="font-semibold text-slate-800">{business.ownerName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200 shadow-2xs"
          >
            <QrCode className="h-4 w-4 text-emerald-600" />
            <span>{lang === 'ne' ? 'भुक्तानी QR सेटअप' : 'Payment QRs'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200 shadow-2xs"
          >
            <Globe className="h-4 w-4 text-indigo-600" />
            <span>{lang === 'ne' ? 'वेबसाइट Download लिंक' : 'Website Download Link'}</span>
          </button>

          {onOpenSetupWizard && (
            <button
              onClick={onOpenSetupWizard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Setup Wizard</span>
            </button>
          )}
        </div>
      </div>

      {/* Save Success Banner Notification */}
      {saveMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Main Admin Tab Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
          { id: 'profile', label: 'Business Profile', icon: Building2 },
          { id: 'staff', label: 'Users & Staff', icon: Users },
          { id: 'roles', label: 'Roles & Permissions', icon: Lock },
          { id: 'modules', label: 'Modules Control', icon: Layers },
          { id: 'payments', label: 'Payment Methods', icon: CreditCard },
          { id: 'receipt', label: 'Receipt Settings', icon: Receipt },
          { id: 'taxes', label: 'Tax & Charges', icon: Percent },
          { id: 'notifications', label: 'Notifications', icon: Bell },
          { id: 'security', label: 'Security & Access', icon: ShieldCheck },
          { id: 'audit', label: 'Audit Trail', icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT: 1. EXECUTIVE DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Today's Sales</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 font-mono-num tabular-nums">{currency} {todaySales.toLocaleString()}</span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1 tabular-nums">
                Cash: {currency} {todayAudit.cashTotal.toLocaleString()} · Online: {currency} {todayAudit.onlineTotal.toLocaleString()}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Today's Orders</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 font-mono-num tabular-nums">{todayAudit.totalOrdersCount}</span>
                <span className="text-xs font-semibold text-emerald-700 font-mono-num tabular-nums">({activeOrdersCount} unpaid)</span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1 tabular-nums">
                {todayAudit.completedCount} completed · {todayAudit.cancelledCount} cancelled
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Cancelled Today</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-bold font-mono-num tabular-nums ${todayAudit.cancelledCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                  {todayAudit.cancelledCount}
                </span>
                <span className="text-xs text-slate-500 font-mono-num tabular-nums">
                  ({currency} {todayAudit.cancelledAmount.toLocaleString()})
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Voided orders today</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Today's Expenses</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-rose-700 font-mono-num tabular-nums">{currency} {todayExpenses.toLocaleString()}</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Petty cash recorded</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Outstanding Customer Khata</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-amber-700 font-mono-num tabular-nums">{currency} {totalOutstandingCredit.toLocaleString()}</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Due credit balance</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Low Stock Alerts</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-bold font-mono-num tabular-nums ${lowStockCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {lowStockCount}
                </span>
                <span className="text-xs text-slate-500">items</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Below minimum threshold</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Total Lifetime Revenue</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-emerald-700 font-mono-num tabular-nums">{currency} {totalRevenue.toLocaleString()}</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">All settled transactions</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Active Staff</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900 font-mono-num">
                  {businessStaffUsers.filter(u => u.isActive).length}
                </span>
                <span className="text-xs text-slate-500 font-mono-num">/ {businessStaffUsers.length}</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Isolated to {business.businessName}</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium">Pending Bills</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-indigo-700 font-mono-num">{pendingBillsCount}</span>
                <span className="text-xs text-slate-500">open</span>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">Awaiting customer payment</span>
            </div>
          </div>

          {/* Live Today Operations Audit: Ordered Dishes, Cash vs Online Split & Cancellations */}
          <TodayOperationsAuditPanel
            orders={appState.orders}
            settings={appState.settings}
            lang={lang}
          />

          {/* Domain Specific Section (Resort / Restaurant / Cafe) */}
          {isResortOrHotel && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hotel className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900">Resort & Accommodation Overview</h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">Live Room State</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <span className="text-slate-500 block">Available Rooms</span>
                  <span className="text-lg font-bold text-emerald-800 font-mono-num">{availableRooms}</span>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-slate-500 block">Occupied Rooms</span>
                  <span className="text-lg font-bold text-amber-800 font-mono-num">{occupiedRooms}</span>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <span className="text-slate-500 block">Today's Check-ins</span>
                  <span className="text-lg font-bold text-blue-800 font-mono-num">{todayCheckIns}</span>
                </div>
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl">
                  <span className="text-slate-500 block">Today's Check-outs</span>
                  <span className="text-lg font-bold text-purple-800 font-mono-num">{todayCheckOuts}</span>
                </div>
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                  <span className="text-slate-500 block">Upcoming Bookings</span>
                  <span className="text-lg font-bold text-indigo-800 font-mono-num">{upcomingReservations}</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 block">Total Capacity</span>
                  <span className="text-lg font-bold text-slate-800 font-mono-num">{appState.resortRooms.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* Restaurant / Cafe Floor State */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Dining Tables Busy</span>
                <span className="text-xs font-mono-num font-bold text-slate-900">{occupiedTables} of {appState.tablesRooms.length}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-2 rounded-full" 
                  style={{ width: `${appState.tablesRooms.length ? (occupiedTables / appState.tablesRooms.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Open Orders</span>
                <span className="text-xs font-mono-num font-bold text-emerald-700">{activeOrdersCount} on floor</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Active tables currently dining
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Kitchen KOTs</span>
                <span className={`text-xs font-bold font-mono-num ${kitchenOrdersCount > 0 ? 'text-orange-600' : 'text-slate-700'}`}>
                  {kitchenOrdersCount} cooking
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pending items on kitchen display
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Pending Bills</span>
                <span className="text-xs font-mono-num font-bold text-indigo-700">{pendingBillsCount} unbilled</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Ready for checkout & payment
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Menu Dishes</span>
                </span>
                <span className="text-xs font-mono-num font-bold text-emerald-700">
                  {appState.menuItems.length} items
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <p className="text-[11px] text-slate-500">
                  {appState.menuItems.filter(i => i.isOffer).length} on promo offer
                </p>
                <button
                  type="button"
                  onClick={() => setShowAdminMenuManager(true)}
                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                >
                  Manage Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. BUSINESS PROFILE */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Business Profile & Identity</h2>
              <p className="text-xs text-slate-500">General settings, legal names, contact numbers and tax registration</p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
            >
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Save Changes</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Name (English) *</label>
              <input 
                type="text" 
                required
                value={profileForm.businessName}
                onChange={e => setProfileForm({ ...profileForm, businessName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nepali Business Name</label>
              <input 
                type="text" 
                value={profileForm.nepaliBusinessName}
                onChange={e => setProfileForm({ ...profileForm, nepaliBusinessName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Contact Phone *</label>
              <input 
                type="text" 
                required
                value={profileForm.phone}
                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Email Address *</label>
              <input 
                type="email" 
                required
                value={profileForm.email}
                onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Physical Address *</label>
              <input 
                type="text" 
                required
                value={profileForm.address}
                onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">PAN / VAT Registration Number</label>
              <input 
                type="text" 
                value={profileForm.panVatNumber}
                onChange={e => setProfileForm({ ...profileForm, panVatNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block font-semibold text-slate-700">Business Logo (Header, Switcher & Bills)</label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="h-14 w-14 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {sanitizeBusinessLogoUrl(profileForm.logo) ? (
                    <img
                      src={sanitizeBusinessLogoUrl(profileForm.logo)}
                      alt={profileForm.businessName || 'Logo'}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <Building2 className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isUploadingLogo ? 'Compressing...' : 'Upload Logo Photo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>
                    {profileForm.logo && (
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUploadError(null);
                          setProfileForm(prev => ({ ...prev, logo: '' }));
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                  {profileForm.logo.startsWith('data:') ? (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      ✓ Uploaded logo photo ready — click "Save Profile" to apply.
                    </p>
                  ) : (
                    <input
                      type="url"
                      value={profileForm.logo}
                      onChange={e => {
                        setLogoUploadError(null);
                        setProfileForm({ ...profileForm, logo: e.target.value });
                      }}
                      placeholder="Or paste https://... logo URL"
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-slate-900"
                    />
                  )}
                  {logoUploadError && (
                    <p className="text-[11px] font-semibold text-rose-600">{logoUploadError}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Tagline or Brand Description</label>
              <input 
                type="text" 
                value={profileForm.tagline}
                onChange={e => setProfileForm({ ...profileForm, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: 3. STAFF & USER MANAGEMENT */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Staff & Users Roster</h2>
                <span className="text-xs text-slate-500 font-semibold">({businessStaffUsers.length} total)</span>
              </div>
              <p className="text-xs text-slate-500">Every staff member is cryptographically isolated and belongs strictly to {business.businessName}</p>
            </div>

            <div className="flex items-center gap-2">
              {isOwnerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors shadow-2xs"
                >
                  <Globe className="h-4 w-4" />
                  <span>{lang === 'ne' ? 'मोबाइल Gmail सिंक नियन्त्रण' : 'Mobile Gmail Sync'}</span>
                </button>
              )}
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors shadow-2xs"
              >
                <UserPlus className="h-4 w-4" />
                <span>Invite Staff</span>
              </button>

              <button
                onClick={() => setShowAddStaffModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>Add Staff Member</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Search staff name or username..."
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
              />
            </div>

            <select
              value={staffRoleFilter}
              onChange={e => setStaffRoleFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium text-slate-700"
            >
              <option value="ALL">All Roles</option>
              {defaultRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Staff Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Name / Username</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredStaff.map(staff => (
                  <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{staff.name}</span>
                          {staff.mustChangePin && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              Default PIN
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                          <span>@{staff.username}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400">{staff.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {staff.role}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-500">
                      <span>{staff.phone || staff.email || '—'}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
                        staff.isActive 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${staff.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {staff.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingStaff(staff)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Edit staff profile"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { setResetPinStaff(staff); setNewResetPin(''); }}
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Reset security PIN"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStaffStatus(staff)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            staff.isActive 
                              ? 'text-rose-600 hover:bg-rose-50' 
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={staff.isActive ? 'Disable terminal access' : 'Activate staff'}
                        >
                          {staff.isActive ? <PauseCircle className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 4. ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Role-Based Access Control (RBAC) Matrix</h2>
              <p className="text-xs text-slate-500">
                Configure module and action permissions per business role for {business.businessName}. Frontend hiding is never relied upon as security.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetRolePermissions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSaveRolePermissions}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
              >
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Save Permissions</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs min-w-[780px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">POS Billing</th>
                  <th className="py-2.5 px-3 text-center">Kitchen KDS</th>
                  <th className="py-2.5 px-3 text-center">Tables / Floor</th>
                  <th className="py-2.5 px-3 text-center">Resort & Rooms</th>
                  <th className="py-2.5 px-3 text-center">Inventory</th>
                  <th className="py-2.5 px-3 text-center">Khata & CRM</th>
                  <th className="py-2.5 px-3 text-center">Day Close</th>
                  <th className="py-2.5 px-3 text-center">Reports</th>
                  <th className="py-2.5 px-3 text-center">Admin Portal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {defaultRoles.map(role => {
                  const isRoleSuper = role === 'SUPER_ADMIN' || role === 'OWNER';
                  const checkAction = (action: AppAction) => {
                    if (role === 'SUPER_ADMIN') return true;
                    if (customRolesPermissions[role]) {
                      return customRolesPermissions[role].includes(action);
                    }
                    return hasPermission(role, action);
                  };

                  const roleLabelMap: Record<StaffRole, string> = {
                    SUPER_ADMIN: 'SUPER ADMIN',
                    OWNER: 'BUSINESS OWNER',
                    ADMIN: 'BUSINESS ADMIN',
                    MANAGER: 'MANAGER',
                    CASHIER: 'CASHIER',
                    WAITER: 'WAITER',
                    KITCHEN: 'KITCHEN STAFF',
                    RECEPTIONIST: 'RECEPTIONIST',
                    HOUSEKEEPING: 'HOUSEKEEPING',
                    ACCOUNTANT: 'ACCOUNTANT',
                    INVENTORY_STAFF: 'INVENTORY STAFF',
                    STAFF: 'STAFF'
                  };

                  return (
                    <tr key={role} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{roleLabelMap[role] || role}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{role}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_POS')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_POS')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_KDS')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_KDS')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_TABLES')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_TABLES')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_RESORT')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_RESORT')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_INVENTORY')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_INVENTORY')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_CUSTOMERS')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_CUSTOMERS')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_DAY_CLOSING')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_DAY_CLOSING')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_REPORTS')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_REPORTS')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={checkAction('VIEW_TAB_BUSINESS_ADMIN')}
                          disabled={isRoleSuper}
                          onChange={() => handleToggleRoleAction(role, 'VIEW_TAB_BUSINESS_ADMIN')}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 5. MODULES CONTROL */}
      {activeTab === 'modules' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Business Module Control</h2>
            <p className="text-xs text-slate-500">
              Enable or disable feature sets for {business.businessName}. Disabled modules are cleanly removed from navigation and blocked from access without deleting data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_APP_MODULES.map(mod => {
              const isEnabled = business.enabledModules.includes(mod);
              const isCore = mod === 'pos' || mod === 'settings' || mod === 'business_admin';

              return (
                <div
                  key={mod}
                  onClick={() => !isCore && handleToggleModule(mod)}
                  className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                    isCore 
                      ? 'bg-slate-50 border-slate-200 opacity-90 cursor-default' 
                      : isEnabled 
                      ? 'border-emerald-500 bg-emerald-50/50 cursor-pointer shadow-2xs' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 capitalize">
                      {mod.replace(/_/g, ' ')} {isCore && <span className="text-[10px] text-slate-400 font-normal">(Core Module)</span>}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {isEnabled ? 'Active in navigation & terminal' : 'Disabled for this enterprise'}
                    </span>
                  </div>

                  <input 
                    type="checkbox"
                    checked={isEnabled}
                    disabled={isCore}
                    onChange={() => handleToggleModule(mod)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 6. PAYMENT METHODS */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Configured Payment Methods</h2>
              <p className="text-xs text-slate-500">Configure supported payment channels for {business.businessName} (Cash, Card, QR, Wallets, etc.)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddPaymentModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200"
              >
                <Plus className="h-4 w-4" />
                <span>Add Payment Method</span>
              </button>
              <button
                type="button"
                onClick={handleSavePayments}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
              >
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Save Methods</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Credential Security Notice:</span>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Sensitive API keys and payment gateway secrets are never stored in client code. Configured payment methods here provide merchant identifiers and instructions for cashiers and customer receipts.
              </p>
            </div>
          </div>

          {paymentQrError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center justify-between gap-2">
              <span>{paymentQrError}</span>
              <button
                type="button"
                onClick={() => setPaymentQrError(null)}
                className="text-rose-600 hover:text-rose-800 p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-3">
            {paymentsList.map((pm, idx) => {
              const supportsQrPhoto =
                pm.type === 'fonepay_qr' ||
                pm.type === 'esewa' ||
                pm.type === 'khalti' ||
                pm.type === 'bank_transfer' ||
                pm.type === 'custom';
              const isUploading = uploadingQrPaymentId === pm.id;

              return (
                <div
                  key={pm.id}
                  className="p-4 border border-slate-200 rounded-xl space-y-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={pm.enabled}
                        onChange={() => {
                          const updated = [...paymentsList];
                          updated[idx].enabled = !updated[idx].enabled;
                          setPaymentsList(updated);
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-slate-900">{pm.name}</h4>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {pm.type}
                          </span>
                          {pm.qrImageDataUrl && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              QR Ready
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          {pm.instructions || 'Standard payment settlement'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
                      <input
                        type="text"
                        placeholder="Merchant / Account Details (A/C, QR ID, etc.)"
                        value={pm.accountDetails || ''}
                        onChange={e => {
                          const updated = [...paymentsList];
                          updated[idx].accountDetails = e.target.value;
                          setPaymentsList(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-900 bg-white"
                      />
                      {pm.id.startsWith('pm-custom') && (
                        <button
                          type="button"
                          onClick={() => handleRemovePaymentMethod(pm.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                          title="Delete payment method"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {supportsQrPhoto && (
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        {pm.qrImageDataUrl ? (
                          <img
                            src={pm.qrImageDataUrl}
                            alt={`${pm.name} QR`}
                            referrerPolicy="no-referrer"
                            className="h-14 w-14 rounded-lg border border-slate-300 bg-white p-1 object-contain shrink-0"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                            <QrCode className="h-6 w-6" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">
                            {pm.qrImageDataUrl
                              ? lang === 'ne'
                                ? 'ग्राहकले स्क्यान गर्ने QR फोटो सेभ छ'
                                : 'Scan-to-Pay QR Photo Active in Checkout'
                              : lang === 'ne'
                              ? 'पसलको भुक्तानी QR फोटो अपलोड गर्नुहोस्'
                              : 'Upload Merchant QR Photo for Checkout'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {lang === 'ne'
                              ? 'PNG/JPG अपलोड गर्दा साइज स्वतः घटाएर सबै डिभाइसमा सिंक हुन्छ।'
                              : 'Shown automatically on POS Checkout screen when staff selects this method.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold cursor-pointer transition-colors">
                          <Upload className="h-3.5 w-3.5 text-emerald-400" />
                          <span>
                            {isUploading
                              ? lang === 'ne'
                                ? 'प्रोसेसिङ...'
                                : 'Processing...'
                              : pm.qrImageDataUrl
                              ? lang === 'ne'
                                ? 'QR फेर्नुहोस्'
                                : 'Replace QR'
                              : lang === 'ne'
                              ? 'QR अपलोड'
                              : 'Upload QR Photo'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={isUploading}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              void handlePaymentQrUpload(pm.id, file);
                            }}
                          />
                        </label>

                        {pm.qrImageDataUrl && (
                          <button
                            type="button"
                            onClick={() => handleRemovePaymentQr(pm.id)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                          >
                            {lang === 'ne' ? 'हटाउनुहोस्' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 7. RECEIPT SETTINGS */}
      {activeTab === 'receipt' && (
        <form onSubmit={handleSaveReceipt} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Receipt & Invoice Template</h2>
              <p className="text-xs text-slate-500">Every printed receipt automatically prints {business.businessName}'s identity</p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
            >
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Save Layout</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Title Heading</label>
                <input 
                  type="text" 
                  value={receiptForm.receiptTitle || ''}
                  onChange={e => setReceiptForm({ ...receiptForm, receiptTitle: e.target.value })}
                  placeholder={business.businessName}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
                  <input 
                    type="text" 
                    value={receiptForm.invoicePrefix || 'INV-'}
                    onChange={e => setReceiptForm({ ...receiptForm, invoicePrefix: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">KOT Ticket Prefix</label>
                  <input 
                    type="text" 
                    value={receiptForm.kotPrefix || 'KOT-'}
                    onChange={e => setReceiptForm({ ...receiptForm, kotPrefix: e.target.value })}
                    placeholder="KOT-"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Footer Message</label>
                <textarea 
                  rows={2}
                  value={receiptForm.footerMessage}
                  onChange={e => setReceiptForm({ ...receiptForm, footerMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Print Business Logo on Receipt</span>
                  <input 
                    type="checkbox"
                    checked={receiptForm.showLogo}
                    onChange={e => setReceiptForm({ ...receiptForm, showLogo: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Print PAN / VAT Number</span>
                  <input 
                    type="checkbox"
                    checked={receiptForm.showPanVat}
                    onChange={e => setReceiptForm({ ...receiptForm, showPanVat: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Show Tax & Service Charge Breakdown</span>
                  <input 
                    type="checkbox"
                    checked={receiptForm.showTaxBreakdown}
                    onChange={e => setReceiptForm({ ...receiptForm, showTaxBreakdown: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Print Fonepay Settlement QR Code</span>
                  <input 
                    type="checkbox"
                    checked={receiptForm.showQrCode}
                    onChange={e => setReceiptForm({ ...receiptForm, showQrCode: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Live Receipt Preview */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 font-mono text-[11px] max-w-xs mx-auto shadow-inner text-slate-800">
              <div className="text-center border-b border-dashed border-slate-300 pb-2">
                {receiptForm.showLogo && sanitizeBusinessLogoUrl(appState.settings?.logoUrl) && (
                  <div className="flex justify-center mb-1.5">
                    <img
                      src={sanitizeBusinessLogoUrl(appState.settings?.logoUrl)}
                      alt={business.businessName}
                      className="max-h-12 max-w-[120px] w-auto h-auto object-contain grayscale contrast-125"
                    />
                  </div>
                )}
                <p className="font-bold text-sm uppercase">{receiptForm.receiptTitle || business.businessName}</p>
                <p className="text-[10px] text-slate-500">{business.address}</p>
                <p className="text-[10px] text-slate-500">{business.phone}</p>
                {receiptForm.showPanVat && business.panVatNumber && (
                  <p className="text-[10px] font-bold">PAN: {business.panVatNumber}</p>
                )}
              </div>

              <div className="text-[10px] space-y-0.5 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Bill: {receiptForm.invoicePrefix}0042</span>
                  <span>{new Date().toISOString().split('T')[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span>Table: T-3 (Dine In)</span>
                  <span>Cashier: Admin</span>
                </div>
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>1x Himalayan Espresso</span>
                  <span>Rs. 180.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1x Butter Croissant</span>
                  <span>Rs. 220.00</span>
                </div>
              </div>

              <div className="space-y-0.5 text-right border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>Rs. 400.00</span>
                </div>
                {receiptForm.showTaxBreakdown && (
                  <>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Service (10%):</span>
                      <span>Rs. 40.00</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>VAT (13%):</span>
                      <span>Rs. 57.20</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold text-xs pt-1">
                  <span>TOTAL:</span>
                  <span>Rs. 497.20</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                <p>{receiptForm.footerMessage}</p>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: 8. TAXES & CHARGES */}
      {activeTab === 'taxes' && (
        <form onSubmit={handleSaveTaxes} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Tax & Charges Policy</h2>
              <p className="text-xs text-slate-500">Configure legal VAT and hospitality service charge percentage rates for {business.businessName}</p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
            >
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Save Tax Rates</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800">Value Added Tax (VAT)</label>
                <input 
                  type="checkbox"
                  checked={vatEnabled}
                  onChange={e => setVatEnabled(e.target.checked)}
                  className="rounded text-emerald-600"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={vatRate}
                  onChange={e => setVatRate(parseFloat(e.target.value) || 0)}
                  disabled={!vatEnabled}
                  className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono-num font-bold"
                />
                <span className="text-slate-500">% VAT Applied</span>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800">Service Charge</label>
                <input 
                  type="checkbox"
                  checked={serviceChargeEnabled}
                  onChange={e => setServiceChargeEnabled(e.target.checked)}
                  className="rounded text-emerald-600"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input 
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={serviceChargeRate}
                  onChange={e => setServiceChargeRate(parseFloat(e.target.value) || 0)}
                  disabled={!serviceChargeEnabled}
                  className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono-num font-bold"
                />
                <span className="text-slate-500">% Service Charge</span>
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl space-y-2">
              <label className="font-bold text-slate-800 block">Currency Display Symbol</label>
              <input 
                type="text"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
              />
              <span className="text-[11px] text-slate-500 block">Used across POS, Room Folio and Bills</span>
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: 9. NOTIFICATIONS & ALERTS */}
      {activeTab === 'notifications' && (
        <form onSubmit={handleSaveNotifications} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Notifications & Alerts Policies</h2>
              <p className="text-xs text-slate-500">Configure sound effects, terminal chimes, kitchen bells, and automated alert emails for {business.businessName}</p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
            >
              <Check className="h-4 w-4 text-emerald-400" />
              <span>Save Preferences</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Terminal Sound Effects</h4>
                  <p className="text-slate-500 text-[11px]">Play audio chimes on successful order placement, payment collection, and error alerts</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationForm.enableSoundAlerts}
                  onChange={e => setNotificationForm({ ...notificationForm, enableSoundAlerts: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900">Kitchen KOT Bell Chime</h4>
                  <p className="text-slate-500 text-[11px]">Audible chime when a new food order ticket is transmitted to kitchen KDS</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationForm.enableOrderChime}
                  onChange={e => setNotificationForm({ ...notificationForm, enableOrderChime: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Low Stock Inventory Warnings</h4>
                  <p className="text-slate-500 text-[11px]">Alert floor managers when stock drops below safety re-order threshold</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationForm.enableLowStockAlert}
                  onChange={e => setNotificationForm({ ...notificationForm, enableLowStockAlert: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>

              {notificationForm.enableLowStockAlert && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="block font-semibold text-slate-700 mb-1">Inventory Alert Dispatch Email</label>
                  <input
                    type="email"
                    value={notificationForm.lowStockThresholdEmail || ''}
                    onChange={e => setNotificationForm({ ...notificationForm, lowStockThresholdEmail: e.target.value })}
                    placeholder={business.email || 'inventory@himalayanbreeze.com'}
                    className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">End-of-Day Closing Summary</h4>
                  <p className="text-slate-500 text-[11px]">Automatically dispatch comprehensive financial closing sheet to accountant or owner</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationForm.enableDailyCloseAlert}
                  onChange={e => setNotificationForm({ ...notificationForm, enableDailyCloseAlert: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
              </div>

              {notificationForm.enableDailyCloseAlert && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="block font-semibold text-slate-700 mb-1">Finance & Audit Email</label>
                  <input
                    type="email"
                    value={notificationForm.dailyCloseReportEmail || ''}
                    onChange={e => setNotificationForm({ ...notificationForm, dailyCloseReportEmail: e.target.value })}
                    placeholder={business.email || 'accounts@himalayanbreeze.com'}
                    className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              )}
            </div>
          </div>
        </form>
      )}

      {/* TAB CONTENT: 10. SECURITY, OWNER LOCK & CLOUD SYNC */}
      {activeTab === 'security' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <form onSubmit={handleSaveSecurity} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Owner Control Lock & Security Policies</h2>
                <p className="text-xs text-slate-500">
                  Lock role switching on staff terminals and configure mandatory PIN authorizations
                </p>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
              >
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Save Policies</span>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Strict Owner Control Lock Toggle */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between flex-wrap gap-4">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-700" />
                    <h4 className="font-bold text-amber-950">
                      App Creator & Owner Control Lock ({MASTER_OWNER_EMAIL})
                    </h4>
                  </div>
                  <p className="text-amber-900 text-[11px] mt-1 leading-relaxed">
                    {lang === 'ne'
                      ? 'सक्रिय हुँदा कर्मचारीको मोबाइल र काउन्टरबाट सिधै भूमिका (Role) बदल्न र डेमो पिन हेर्न मिल्दैन। App Creator Google लग-इन वा Owner PIN बाट मात्र भूमिका बदल्न र स्टाफ थप्न/हटाउन सकिन्छ।'
                      : 'When ON (Recommended), counter and mobile terminals cannot switch roles freely or view demo PIN shortcuts. Only the verified App Creator Google login or Owner PIN holds control.'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-amber-300 shadow-2xs">
                  <input
                    type="checkbox"
                    checked={securityForm.ownerControlLocked !== false}
                    onChange={e => setSecurityForm({ ...securityForm, ownerControlLocked: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-bold text-slate-900">
                    {securityForm.ownerControlLocked !== false ? 'LOCKED (Creator/Owner)' : 'Unlocked (Demo)'}
                  </span>
                </label>
              </div>

              {/* Terminal Auto Lock */}
              <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-bold text-slate-900">Terminal Session Auto-Lock</h4>
                  <p className="text-slate-500 text-[11px]">Automatically lock POS billing counter after inactivity to prevent unauthorized access</p>
                </div>
                <select
                  value={securityForm.sessionTimeoutMinutes}
                  onChange={e => setSecurityForm({ ...securityForm, sessionTimeoutMinutes: parseInt(e.target.value) || 60 })}
                  className="px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-800 focus:ring-1 focus:ring-slate-900"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={120}>120 Minutes</option>
                </select>
              </div>

              {/* Mandatory PIN Requirements */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-900">Supervisor PIN Authorizations</h4>
                <p className="text-slate-500 text-[11px]">Require authorized Manager or Admin PIN verification for high-risk operations</p>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-medium">Require PIN to apply custom bill discounts</span>
                    <input
                      type="checkbox"
                      checked={securityForm.requirePinForDiscounts}
                      onChange={e => setSecurityForm({ ...securityForm, requirePinForDiscounts: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-medium">Require PIN to void submitted order items</span>
                    <input
                      type="checkbox"
                      checked={securityForm.requirePinForVoidOrder}
                      onChange={e => setSecurityForm({ ...securityForm, requirePinForVoidOrder: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-800 font-medium">Require PIN to finalize End-of-Day cash closing</span>
                    <input
                      type="checkbox"
                      checked={securityForm.requirePinForDayClose}
                      onChange={e => setSecurityForm({ ...securityForm, requirePinForDayClose: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Card 2: Cloud Sync Connection & Owner PIN Rotation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
            {/* Cloud Connection Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Mobile ↔ Laptop Cloud Sync</h3>
                    <p className="text-[11px] text-slate-500">Live Firestore synchronization & App Creator anchor</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  cloudSyncConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {cloudSyncConnected ? 'Connected' : 'Local Only'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">App Creator Account:</span>
                  <span className="font-mono font-bold text-slate-900">{MASTER_OWNER_EMAIL}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Signed-in Google Email:</span>
                  <span className="font-mono font-semibold text-emerald-800">{firebaseUserEmail || 'Not signed in'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {onGoogleOwnerConnect && (
                  <button
                    type="button"
                    onClick={() => onGoogleOwnerConnect()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-2xs transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{firebaseUserEmail ? 'Switch Google Account' : 'Connect Google Owner Account'}</span>
                  </button>
                )}
                {firebaseUserEmail && onGoogleSignOut && (
                  <button
                    type="button"
                    onClick={() => onGoogleSignOut()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-200 transition-colors"
                  >
                    <span>Disconnect Google</span>
                  </button>
                )}
              </div>
            </div>

            {/* Direct Change Owner / Admin Master PIN Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <KeyRound className="h-4 w-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Change Owner Master PIN</h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'ne' ? 'डिफल्ट PIN तुरुन्त परिवर्तन गरी गोप्य राख्नुहोस्' : 'Update your confidential Owner & Admin terminal unlock PIN'}
                  </p>
                </div>
              </div>

              {pinChangeMsg && (
                <div className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
                  pinChangeMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{pinChangeMsg.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">New Owner PIN (4–6 digits)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={ownerNewPin}
                    onChange={e => setOwnerNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center tracking-widest text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={ownerConfirmPin}
                    onChange={e => setOwnerConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center tracking-widest text-sm"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!isOwnerOrAdmin || isUpdatingPin}
                onClick={handleUpdateOwnerMasterPin}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl shadow-2xs transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5 text-amber-300" />
                <span>{isUpdatingPin ? 'Updating PIN...' : 'Update Owner PIN'}</span>
              </button>
            </div>
          </div>

          {/* Card 3: Mobile & Tablet Staff Gmail Access Control */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Mobile & Staff Cloud Device Access</h3>
                <p className="text-xs text-slate-500">
                  Approve employee Gmails for phone/tablet access, assign their exact role, or revoke access anytime
                </p>
              </div>
              <button
                type="button"
                disabled={!cloudSyncConnected || isLoadingCloudAccess}
                onClick={refreshCloudAccessLists}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCloudAccess ? 'animate-spin' : ''}`} />
                <span>Refresh Devices</span>
              </button>
            </div>

            {cloudAccessError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{cloudAccessError}</span>
              </div>
            )}

            {/* Website Download Link, HTML Button & QR Distribution Kit */}
            <WebsiteLinkKitCard
              businessName={business.businessName}
              lang={lang}
              onPreviewDownloadPage={onOpenDownloadPortal}
            />

            {!cloudSyncConnected || !cloudOwnerUid ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <p className="text-slate-600">
                  {lang === 'ne'
                    ? `स्टाफ मोबाइल थप्न वा हटाउन पहिले App Creator / Owner बाट Google लग-इन गर्नुहोस्।`
                    : `Sign in with Google (App Creator / Owner) above to authorize or revoke staff mobile devices.`}
                </p>
                {onGoogleOwnerConnect && (
                  <button
                    type="button"
                    onClick={() => onGoogleOwnerConnect()}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow-2xs"
                  >
                    {lang === 'ne' ? 'Google बाट लग-इन गर्नुहोस्' : 'Sign In with Google'}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Invite Form */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Staff Name *</label>
                    <input
                      type="text"
                      value={cloudInviteName}
                      onChange={e => setCloudInviteName(e.target.value)}
                      placeholder="e.g. Sita Waiter"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Staff Gmail *</label>
                    <input
                      type="email"
                      value={cloudInviteEmail}
                      onChange={e => setCloudInviteEmail(e.target.value)}
                      placeholder="staff@gmail.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                    <select
                      value={cloudInviteRole}
                      onChange={e => setCloudInviteRole(e.target.value as StaffRole)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold"
                    >
                      {defaultRoles
                        .filter(r => r !== 'OWNER' && r !== 'SUPER_ADMIN')
                        .map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={isSendingCloudInvite}
                    onClick={handleSendCloudInvite}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-xl shadow-2xs inline-flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="h-4 w-4 text-emerald-400" />
                    <span>{isSendingCloudInvite ? 'Approving...' : 'Authorize Gmail'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-950 leading-relaxed">
                  <strong>{lang === 'ne' ? 'जानकारी — Invitation कहाँ जान्छ?' : 'Note — How Invite Delivery Works:'}</strong>{' '}
                  {lang === 'ne'
                    ? 'Authorize Gmail थिच्दा स्टाफको Gmail मा स्वतः इमेल जाँदैन — यो अनुमति Firestore Cloud मा सुरक्षित हुन्छ। स्टाफलाई तलको "Copy Link" वा WhatsApp बाट App लिंक पठाउनुहोस्; स्टाफले आफ्नो मोबाइलमा App खोलेर त्यही Gmail बाट "Continue with Google" थिचेपछि स्वतः त्यही Role मा लग-इन हुन्छ।'
                    : 'Clicking Authorize Gmail saves pre-approval directly in Firestore Cloud (no auto-email is sent to Gmail). Share the App Install Link below via WhatsApp/SMS — when the staff member opens the app on their phone and signs in with that Gmail, they automatically activate into their assigned role.'}
                </div>

                {lastCreatedCloudInvite && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-bold text-emerald-950 text-xs">
                        {lang === 'ne'
                          ? `${lastCreatedCloudInvite.staffName} (${lastCreatedCloudInvite.email}) अनुमोदित भयो!`
                          : `Authorized ${lastCreatedCloudInvite.staffName} (${lastCreatedCloudInvite.email})!`}
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        {lang === 'ne'
                          ? `अब स्टाफलाई मोबाइलमा App Install लिंक र Google लग-इन निर्देशन पठाउनुहोस् (Role: ${lastCreatedCloudInvite.role})।`
                          : `Copy or share the mobile install link + Gmail login instructions below (Role: ${lastCreatedCloudInvite.role}).`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyStaffInviteShare(
                            'latest',
                            lastCreatedCloudInvite.staffName,
                            lastCreatedCloudInvite.email,
                            lastCreatedCloudInvite.role
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] shadow-2xs"
                      >
                        {copiedInviteKey === 'latest' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedInviteKey === 'latest' ? (lang === 'ne' ? 'कपी भयो!' : 'Copied!') : (lang === 'ne' ? 'मेसेज र लिंक कपी' : 'Copy Invite Message')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleShareStaffInviteNative(
                            lastCreatedCloudInvite.staffName,
                            lastCreatedCloudInvite.email,
                            lastCreatedCloudInvite.role
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px]"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>{lang === 'ne' ? 'सेयर गर्नुहोस्' : 'Share'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Authorized Members Table */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800">Active & Verified Mobile/Desktop Users ({cloudMembers.length})</h4>
                  {cloudMembers.length === 0 ? (
                    <p className="text-slate-400 italic py-2">No additional cloud staff members have activated yet.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Staff Name</th>
                            <th className="py-2 px-3">Gmail</th>
                            <th className="py-2 px-3">Assigned Role</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Control</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cloudMembers.map(m => (
                            <tr key={m.uid}>
                              <td className="py-2.5 px-3 font-bold text-slate-900">{m.name}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{m.email}</td>
                              <td className="py-2.5 px-3">
                                <select
                                  value={m.role}
                                  disabled={m.role === 'OWNER'}
                                  onChange={e => handleUpdateCloudMemberRole(m, e.target.value as StaffRole)}
                                  className="px-2 py-1 border border-slate-200 rounded-lg bg-white font-semibold"
                                >
                                  {defaultRoles
                                    .filter(r => r === m.role || (r !== 'OWNER' && r !== 'SUPER_ADMIN'))
                                    .map(r => (
                                      <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  m.isActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}>
                                  {m.isActive ? 'Active' : 'Revoked'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {m.role !== 'OWNER' && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCloudMemberActive(m)}
                                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                                      m.isActive
                                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    }`}
                                  >
                                    {m.isActive ? 'Revoke Device' : 'Re-Activate'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Invites Table */}
                {cloudInvites.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800">Issued Gmail Invitations ({cloudInvites.length})</h4>
                    <div className="border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">Name</th>
                            <th className="py-2 px-3">Gmail</th>
                            <th className="py-2 px-3">Role</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cloudInvites.map(inv => (
                            <tr key={inv.inviteId}>
                              <td className="py-2 px-3 font-semibold text-slate-900">{inv.staffName}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">{inv.email}</td>
                              <td className="py-2 px-3 font-bold">{inv.role}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  inv.status === 'ACTIVE'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : inv.status === 'PENDING'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  {inv.status !== 'REVOKED' && (
                                    <button
                                      type="button"
                                      onClick={() => void handleCopyStaffInviteShare(inv.inviteId, inv.staffName, inv.email, inv.role)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                                    >
                                      {copiedInviteKey === inv.inviteId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                      <span>{copiedInviteKey === inv.inviteId ? (lang === 'ne' ? 'कपी भयो' : 'Copied') : (lang === 'ne' ? 'लिंक कपी' : 'Copy Link')}</span>
                                    </button>
                                  )}
                                  {inv.status === 'PENDING' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeCloudInvite(inv.inviteId)}
                                      className="px-2.5 py-1 rounded-lg font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                                    >
                                      Revoke Invite
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Data Isolation & Collapsible System Diagnostics */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <h4 className="font-bold text-emerald-950">Multi-Tenant Data Isolation Active</h4>
                  <p className="text-emerald-800 text-[11px]">
                    Enterprise partition: <span className="font-mono font-bold">{business.businessId}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100/60 text-emerald-900 border border-emerald-300 text-xs font-bold transition-colors"
              >
                {showDiagnostics ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span>{lang === 'ne' ? 'सिस्टम डायग्नोस्टिक जाँच' : 'Developer Diagnostics'}</span>
              </button>
            </div>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              All POS records, dining tables, inventory items, resort reservations, guest profiles, khata ledgers, and financial reports are partitioned strictly under <span className="font-semibold">{business.businessName}</span>. Cross-tenant leakage is prevented at storage and Firestore security rule levels.
            </p>

            {showDiagnostics && (
              <div className="pt-3 border-t border-emerald-200/80 flex items-center flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowIsolationTestModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Verify Data Isolation</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowWorkflowTestModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Verify Workflows</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSyncTestModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Verify Real-Time & Sync</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 11. AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Business Security & Audit Trail</h2>
            <p className="text-xs text-slate-500">Immutable chronological log of operations performed strictly within {business.businessName}</p>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">Staff Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {businessAuditLogs.slice(0, 50).map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {log.staffName} ({log.role})
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700 font-semibold">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        log.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        log.severity === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Add Staff Account ({business.businessName})</h3>
              <button onClick={() => setShowAddStaffModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. roshan_waiter"
                  value={newStaffUsername}
                  onChange={e => setNewStaffUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Roshan Shrestha"
                  value={newStaffName}
                  onChange={e => setNewStaffName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={newStaffRole}
                  onChange={e => setNewStaffRole(e.target.value as StaffRole)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  {defaultRoles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Terminal Security PIN (4-Digits) *</label>
                <input 
                  type="password"
                  maxLength={6}
                  required
                  placeholder="****"
                  value={newStaffPin}
                  onChange={e => setNewStaffPin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center tracking-widest text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input 
                    type="email"
                    placeholder="Optional"
                    value={newStaffEmail}
                    onChange={e => setNewStaffEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input 
                    type="text"
                    placeholder="Optional"
                    value={newStaffPhone}
                    onChange={e => setNewStaffPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs"
                >
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">Edit Staff Member ({editingStaff.name})</h3>
              <button onClick={() => setEditingStaff(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditStaffSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username (Immutable)</label>
                <input 
                  type="text"
                  disabled
                  value={editingStaff.username}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input 
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nepali Name (नेपाली नाम)</label>
                <input 
                  type="text"
                  placeholder="जस्तै: राम श्रेष्ठ"
                  value={editingStaff.nepaliName || ''}
                  onChange={e => setEditingStaff({ ...editingStaff, nepaliName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role *</label>
                <select
                  value={editingStaff.role}
                  onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value as StaffRole })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white font-semibold text-slate-800"
                >
                  {defaultRoles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input 
                    type="email"
                    value={editingStaff.email || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input 
                    type="text"
                    value={editingStaff.phone || ''}
                    onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Security PIN Modal */}
      {resetPinStaff && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Reset Terminal PIN</h3>
              </div>
              <button onClick={() => setResetPinStaff(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Set a new 4-digit security PIN for <span className="font-bold text-slate-800">{resetPinStaff.name}</span>. The PIN is salted and hashed cryptographically.
            </p>

            <form onSubmit={handleResetPinSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New 4-Digit Security PIN *</label>
                <input 
                  type="password"
                  maxLength={6}
                  required
                  placeholder="****"
                  value={newResetPin}
                  onChange={e => setNewResetPin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-center tracking-widest text-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetPinStaff(null)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Custom Payment Method Modal */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Add Payment Method</h3>
              </div>
              <button onClick={() => setShowAddPaymentModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddPaymentMethod} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Method Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. IME Pay, Prabhu Bank QR, Nabil Swipe"
                  value={newPaymentName}
                  onChange={e => setNewPaymentName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Channel Type *</label>
                <select
                  value={newPaymentType}
                  onChange={e => setNewPaymentType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="custom">Custom Payment Channel</option>
                  <option value="esewa">eSewa Mobile Wallet</option>
                  <option value="khalti">Khalti Digital Wallet</option>
                  <option value="fonepay_qr">Fonepay / Inter-bank QR</option>
                  <option value="card">Card / Contactless Terminal</option>
                  <option value="bank_transfer">Direct Bank Transfer</option>
                  <option value="cash">Cash Tender</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account or Merchant ID</label>
                <input 
                  type="text"
                  placeholder="e.g. Wallet ID: 9801234567 or A/C 0192837482"
                  value={newPaymentDetails}
                  onChange={e => setNewPaymentDetails(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Instructions for Cashier / Receipt</label>
                <input 
                  type="text"
                  placeholder="e.g. Scan QR code on counter stand and verify transaction ID"
                  value={newPaymentInstructions}
                  onChange={e => setNewPaymentInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs"
                >
                  Add Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Invitation Modal */}
      <InviteStaffModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        businessId={business.businessId}
        businessName={business.businessName}
        currentStaff={{ id: currentSession?.staffId || 'admin', name: currentSession?.name || 'Admin' }}
        onInvitationCreated={(invite) => {
          onUpdateAppState(prev => ({
            ...prev,
            staffInvitations: [
              invite,
              ...(prev.staffInvitations || []).filter(existing => existing.id !== invite.id)
            ]
          }));
          recordAudit('STAFF_INVITATION_CREATED', invite.id, `Invited ${invite.emailOrPhone} as ${invite.role}`);
          showBanner(`Invitation created for ${invite.emailOrPhone}`);
        }}
        onStaffActivated={(staff) => {
          onUpdateAppState(prev => ({
            ...prev,
            staffUsers: [...prev.staffUsers, staff]
          }));
          recordAudit('STAFF_INVITATION_ACCEPTED', staff.id, `Staff ${staff.name} accepted invitation for ${business.businessName}`);
          showBanner(`Staff member ${staff.name} is now active.`);
        }}
      />

      {/* Multi-Tenant Data Isolation Test Runner Modal */}
      <BusinessDataIsolationTestModal
        isOpen={showIsolationTestModal}
        onClose={() => setShowIsolationTestModal(false)}
        currentRole={currentSession?.role}
      />

      {/* End-to-End Hospitality Workflows Test Runner Modal */}
      <HospitalityWorkflowTestModal
        isOpen={showWorkflowTestModal}
        onClose={() => setShowWorkflowTestModal(false)}
        activeBusiness={business}
        appState={appState}
        currentSession={currentSession}
      />

      {/* Real-Time Sync & Offline Resilience Test Runner Modal */}
      <SyncResilienceTestModal
        isOpen={showSyncTestModal}
        onClose={() => setShowSyncTestModal(false)}
        activeBusinessId={business.businessId}
        appState={appState}
      />

      {/* Menu Dishes Manager Modal */}
      {showAdminMenuManager && (
        <MenuManagerModal
          menuItems={appState.menuItems}
          inventoryItems={appState.inventoryItems}
          settings={appState.settings}
          lang={lang}
          onAddMenuItem={(newItem) => {
            onUpdateAppState(prev => ({
              ...prev,
              menuItems: [...prev.menuItems, newItem]
            }));
            recordAudit('MENU_ITEM_ADDED', newItem.id, `Added dish ${newItem.name} (Rs. ${newItem.price})`, 'INFO');
            playChime('success');
          }}
          onUpdateMenuItem={(updatedItem) => {
            onUpdateAppState(prev => ({
              ...prev,
              menuItems: prev.menuItems.map(m => m.id === updatedItem.id ? updatedItem : m)
            }));
            recordAudit('MENU_ITEM_UPDATED', updatedItem.id, `Updated dish ${updatedItem.name} (Rs. ${updatedItem.price})`, 'INFO');
            playChime('success');
          }}
          onDeleteMenuItem={(delId) => {
            onUpdateAppState(prev => ({
              ...prev,
              menuItems: prev.menuItems.filter(m => m.id !== delId)
            }));
            recordAudit('MENU_ITEM_DELETED', delId, `Deleted dish ${delId}`, 'WARNING');
            playChime('success');
          }}
          onClose={() => setShowAdminMenuManager(false)}
        />
      )}
    </div>
  );
};
