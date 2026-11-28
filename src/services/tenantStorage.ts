import { 
  AppState, 
  AppModule, 
  BusinessStatus, 
  BusinessTenant, 
  BusinessType, 
  StaffRole, 
  StaffUser,
  StaffInvitation,
  PaymentMethodConfig,
  ReceiptSettings,
  UserBusinessMembership,
  BusinessSettings,
  MenuItem,
  TableRoom,
  InventoryItem,
  Customer
} from '../types';
import { 
  getInitialAppState, 
  getCleanStarterState,
  scrubLegacyDemoData,
  INITIAL_MENU_ITEMS, 
  CLEAN_TABLES_ROOMS,
  CLEAN_INVENTORY,
  INITIAL_STAFF_USERS, 
  INITIAL_ROOM_TYPES, 
  CLEAN_RESORT_ROOMS,
  INITIAL_RESORT_SERVICES, 
  DEFAULT_SETTINGS,
  STORAGE_KEY
} from './storage';
import { createStaffAccount } from './security';
import { createCleanChartOfAccounts, ensureDefaultChartAccounts } from './accounting';
import { isMasterOwnerEmail, redactProtectedEmail } from './cloudSyncService';
import { sanitizeBusinessLogoUrl } from '../utils/imageUtils';

export const BUSINESSES_REGISTRY_KEY = 'hb_businesses_registry_v1';
export const MEMBERSHIPS_REGISTRY_KEY = 'hb_memberships_registry_v1';
export const ACTIVE_BUSINESS_ID_KEY = 'hb_active_business_id';
export const TENANT_STORAGE_PREFIX = 'hb_tenant_data_';
export const OWNER_BUSINESS_CLAIM_KEY = 'hb_owner_created_business_map_v1';

export const ALL_APP_MODULES: AppModule[] = [
  'pos', 
  'billing',
  'tables_rooms', 
  'resort', 
  'kds', 
  'inventory', 
  'customers', 
  'day_closing', 
  'reports', 
  'settings',
  'business_admin'
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'pm-cash', name: 'Cash', enabled: true, type: 'cash', instructions: 'Physical cash drawer payment' },
  { id: 'pm-card', name: 'Credit / Debit Card', enabled: true, type: 'card', instructions: 'POS swipe / contactless card terminal' },
  { id: 'pm-fonepay', name: 'Fonepay QR', enabled: true, type: 'fonepay_qr', accountDetails: 'Merchant Dynamic QR' },
  { id: 'pm-bank', name: 'Bank Transfer', enabled: true, type: 'bank_transfer', accountDetails: 'A/C: 019283749281' },
  { id: 'pm-esewa', name: 'eSewa Mobile Wallet', enabled: true, type: 'esewa', accountDetails: 'eSewa ID: 9841234567' },
  { id: 'pm-khalti', name: 'Khalti Wallet', enabled: true, type: 'khalti', accountDetails: 'Khalti ID: 9856012345' },
  { id: 'pm-room', name: 'Charge to Room', enabled: true, type: 'charge_to_room', instructions: 'Charge bill to active guest room folio' }
];

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  receiptTitle: '',
  headerSubtitle: '',
  showLogo: true,
  showPanVat: true,
  showCustomerDetails: true,
  showTaxBreakdown: true,
  showQrCode: true,
  invoicePrefix: 'INV-',
  footerMessage: 'Thank you for your business! Please visit us again.',
  printWidth: '80mm'
};

export const DEFAULT_MODULES_BY_TYPE: Record<BusinessType, AppModule[]> = {
  CAFE: ['pos', 'billing', 'tables_rooms', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
  RESTAURANT: ['pos', 'billing', 'tables_rooms', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
  RESORT: ['pos', 'billing', 'tables_rooms', 'resort', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
  HOTEL: ['pos', 'billing', 'tables_rooms', 'resort', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
  CAFE_RESTAURANT: ['pos', 'billing', 'tables_rooms', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
  RESTAURANT_RESORT: ['pos', 'billing', 'tables_rooms', 'resort', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
  CAFE_RESTAURANT_RESORT: ['pos', 'billing', 'tables_rooms', 'resort', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
  OTHER: ['pos', 'billing', 'tables_rooms', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin']
};

export const INITIAL_BUSINESS_TENANTS: BusinessTenant[] = [
  {
    businessId: 'biz-himalayan-breeze',
    businessName: 'CAFE HOST',
    nepaliBusinessName: 'CAFE HOST',
    tagline: 'Hospitality & POS Management',
    businessType: 'CAFE_RESTAURANT_RESORT',
    ownerId: 'staff-admin-sys',
    ownerName: 'Owner',
    logo: undefined,
    phone: '',
    email: '',
    address: '',
    panVatNumber: '',
    status: 'ACTIVE',
    enabledModules: ['pos', 'billing', 'tables_rooms', 'resort', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
    currencySymbol: 'Rs.',
    environment: 'production',
    templateType: 'clean_slate',
    createdAt: '2026-09-01',
    updatedAt: '2026-10-02'
  }
];

export const INITIAL_MEMBERSHIPS: UserBusinessMembership[] = [
  {
    id: 'mem-super-1',
    userId: 'staff-super-admin',
    businessId: 'biz-himalayan-breeze',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-09-01'
  },
  {
    id: 'mem-hb-admin',
    userId: 'staff-admin-sys',
    businessId: 'biz-himalayan-breeze',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-09-01'
  }
];

const DELETED_BUSINESSES_KEY = 'himalayan_breeze_deleted_biz_v1';

export function getDeletedBusinessIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_BUSINESSES_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function deleteBusiness(businessId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const current = getRegisteredBusinesses();
    const updated = current.filter(b => b.businessId !== businessId);
    saveRegisteredBusinesses(updated);
    const deleted = getDeletedBusinessIds();
    deleted.add(businessId);
    localStorage.setItem(DELETED_BUSINESSES_KEY, JSON.stringify(Array.from(deleted)));
    return true;
  } catch (e) {
    console.error('Failed to delete business', e);
    return false;
  }
}

export function getRegisteredBusinesses(): BusinessTenant[] {
  if (typeof window === 'undefined') return INITIAL_BUSINESS_TENANTS;
  const deletedIds = getDeletedBusinessIds();
  try {
    const raw = localStorage.getItem(BUSINESSES_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Filter out any explicitly deleted businesses and scrub protected super admin email
        const filtered = parsed
          .filter((b: any) => !deletedIds.has(b.businessId))
          .map((b: BusinessTenant) => ({
            ...b,
            ownerName: isMasterOwnerEmail(b.ownerName) ? 'Client Owner' : b.ownerName,
            email: redactProtectedEmail(b.email, '')
          }));
        return filtered.length > 0 ? filtered : [INITIAL_BUSINESS_TENANTS[0]];
      }
    }
  } catch (e) {
    console.error('Failed to read businesses registry', e);
  }
  
  // Seed initial registry (excluding any deleted)
  const initialFiltered = INITIAL_BUSINESS_TENANTS.filter(b => !deletedIds.has(b.businessId));
  try {
    localStorage.setItem(BUSINESSES_REGISTRY_KEY, JSON.stringify(initialFiltered));
  } catch {
    // ignore
  }
  return initialFiltered.length > 0 ? initialFiltered : [INITIAL_BUSINESS_TENANTS[0]];
}

export function saveRegisteredBusinesses(businesses: BusinessTenant[]) {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = businesses.map((b) => ({
      ...b,
      ownerName: isMasterOwnerEmail(b.ownerName) ? 'Client Owner' : b.ownerName,
      email: redactProtectedEmail(b.email, '')
    }));
    localStorage.setItem(BUSINESSES_REGISTRY_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('Failed to save businesses registry', e);
  }
}

export function getMemberships(): UserBusinessMembership[] {
  if (typeof window === 'undefined') return INITIAL_MEMBERSHIPS;
  try {
    const raw = localStorage.getItem(MEMBERSHIPS_REGISTRY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to read memberships registry', e);
  }
  return INITIAL_MEMBERSHIPS;
}

export function saveMemberships(memberships: UserBusinessMembership[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MEMBERSHIPS_REGISTRY_KEY, JSON.stringify(memberships));
  } catch (e) {
    console.error('Failed to save memberships registry', e);
  }
}

export function getActiveBusinessId(): string {
  if (typeof window === 'undefined') return 'biz-himalayan-breeze';
  try {
    const stored = localStorage.getItem(ACTIVE_BUSINESS_ID_KEY);
    if (stored) return stored;
  } catch {
    // ignore
  }
  return 'biz-himalayan-breeze';
}

export function setActiveBusinessId(businessId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_BUSINESS_ID_KEY, businessId);
  } catch (e) {
    console.error('Failed to set active business ID', e);
  }
}

export function getActiveBusiness(): BusinessTenant {
  const businesses = getRegisteredBusinesses();
  const activeId = getActiveBusinessId();
  const found = businesses.find(b => b.businessId === activeId);
  if (found) return found;
  return businesses[0] || INITIAL_BUSINESS_TENANTS[0];
}

function getOwnerBusinessClaimMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OWNER_BUSINESS_CLAIM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function recordOwnerBusinessClaim(ownerId: string, businessId: string, email?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const map = getOwnerBusinessClaimMap();
    if (ownerId) {
      map[`uid:${ownerId.trim()}`] = businessId;
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail && !isMasterOwnerEmail(cleanEmail)) {
      map[`email:${cleanEmail}`] = businessId;
    }
    localStorage.setItem(OWNER_BUSINESS_CLAIM_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota
  }
}

export function getOwnedBusinessesForUser(
  userId?: string | null,
  email?: string | null,
  currentBusinessId?: string | null
): BusinessTenant[] {
  const allBusinesses = getRegisteredBusinesses();
  const memberships = getMemberships();
  const ownedIds = new Set<string>();
  const cleanUserId = (userId || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (cleanUserId) {
    allBusinesses.forEach((b) => {
      if (b.ownerId === cleanUserId) {
        ownedIds.add(b.businessId);
      }
    });
    memberships.forEach((m) => {
      if (m.userId === cleanUserId && m.role === 'OWNER' && m.status === 'ACTIVE') {
        ownedIds.add(m.businessId);
      }
    });
  }

  const claimMap = getOwnerBusinessClaimMap();
  if (cleanUserId && claimMap[`uid:${cleanUserId}`]) {
    ownedIds.add(claimMap[`uid:${cleanUserId}`]);
  }
  if (cleanEmail && !isMasterOwnerEmail(cleanEmail) && claimMap[`email:${cleanEmail}`]) {
    ownedIds.add(claimMap[`email:${cleanEmail}`]);
  }

  // If currently inside a custom/production business workspace (not starter demo), treat it as an already-established business
  if (currentBusinessId) {
    const activeBiz = allBusinesses.find((b) => b.businessId === currentBusinessId);
    if (activeBiz && (activeBiz.environment === 'production' || activeBiz.businessId !== 'biz-himalayan-breeze')) {
      ownedIds.add(activeBiz.businessId);
    }
  }

  return allBusinesses.filter((b) => ownedIds.has(b.businessId));
}

export function canActorCreateBusiness(actor?: {
  id?: string | null;
  role?: StaffRole;
  email?: string | null;
  isAppCreator?: boolean;
  businessId?: string | null;
} | null): { allowed: boolean; reason?: string; existingBusiness?: BusinessTenant } {
  if (actor?.isAppCreator) {
    return { allowed: true };
  }
  if (actor?.role === 'SUPER_ADMIN' && (!actor.email || isMasterOwnerEmail(actor.email))) {
    return { allowed: true };
  }
  if (actor?.role && actor.role !== 'OWNER' && actor.role !== 'SUPER_ADMIN') {
    return {
      allowed: false,
      reason: 'Staff accounts cannot create separate business workspaces. Only a new business owner or App Creator can register a business.'
    };
  }

  const owned = getOwnedBusinessesForUser(actor?.id, actor?.email, actor?.businessId);
  if (owned.length >= 1) {
    return {
      allowed: false,
      existingBusiness: owned[0],
      reason: `Single-Business Policy: Your account already owns "${owned[0].businessName}". Creating a second business is not allowed.`
    };
  }

  return { allowed: true };
}

/**
 * Returns list of businesses that a user has permission to access.
 * If user role is SUPER_ADMIN, they have access to all registered businesses.
 * Ordinary users (including OWNER/ADMIN/MANAGER/staff) only see their own authorized business.
 */
export function getBusinessesForUser(
  userId: string,
  role?: StaffRole,
  sessionBusinessId?: string
): BusinessTenant[] {
  const allBusinesses = getRegisteredBusinesses();
  if (role === 'SUPER_ADMIN') {
    return allBusinesses;
  }

  const memberships = getMemberships();
  const userMemberships = memberships.filter(
    (m) => m.userId === userId && m.status === 'ACTIVE'
  );
  const allowedIds = new Set<string>(userMemberships.map((m) => m.businessId));

  // If user is owner/creator of a business
  allBusinesses.forEach((b) => {
    if (b.ownerId === userId) {
      allowedIds.add(b.businessId);
    }
  });

  if (sessionBusinessId && allBusinesses.some((b) => b.businessId === sessionBusinessId)) {
    allowedIds.add(sessionBusinessId);
  }

  // Strictly isolate: if no explicit membership matched, fall back ONLY to active business (never leak foreign tenants)
  if (allowedIds.size === 0) {
    const activeId = getActiveBusinessId();
    if (allBusinesses.some((b) => b.businessId === activeId)) {
      allowedIds.add(activeId);
    } else if (allBusinesses[0]) {
      allowedIds.add(allBusinesses[0].businessId);
    }
  }

  return allBusinesses.filter((b) => allowedIds.has(b.businessId));
}

export function canUserAccessBusiness(
  user: { id: string; role?: StaffRole; businessId?: string },
  businessId: string
): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.businessId && user.businessId === businessId) return true;

  const allBusinesses = getRegisteredBusinesses();
  const targetBiz = allBusinesses.find((b) => b.businessId === businessId);
  if (targetBiz && targetBiz.ownerId === user.id) return true;

  const memberships = getMemberships();
  return memberships.some(
    (m) => m.userId === user.id && m.businessId === businessId && m.status === 'ACTIVE'
  );
}

function ensureTenantDefaults(state: AppState, businessId: string): AppState {
  if (!state.settings) state.settings = { ...DEFAULT_SETTINGS, businessId };
  if (!state.settings.hotelCheckInTime) state.settings.hotelCheckInTime = '14:00';
  if (!state.settings.hotelCheckOutTime) state.settings.hotelCheckOutTime = '12:00';
  if (!state.settings.paymentMethodsConfig || state.settings.paymentMethodsConfig.length === 0) {
    state.settings.paymentMethodsConfig = DEFAULT_PAYMENT_METHODS;
  }
  if (!state.settings.receiptSettings) {
    state.settings.receiptSettings = { ...DEFAULT_RECEIPT_SETTINGS, receiptTitle: state.settings.businessName };
  }
  if (!state.staffInvitations) {
    state.staffInvitations = [];
  }
  if (!state.roomTypes) state.roomTypes = [];
  if (!state.resortRooms) state.resortRooms = [];
  if (!state.guestProfiles) state.guestProfiles = [];
  if (!state.reservations) state.reservations = [];
  if (!state.guestFolioItems) state.guestFolioItems = [];
  if (!state.resortServices) state.resortServices = [];
  if (!state.housekeepingTasks) state.housekeepingTasks = [];
  if (!state.maintenanceIssues) state.maintenanceIssues = [];
  if (!state.hotelPayments) state.hotelPayments = [];
  if (!state.nightAudits) state.nightAudits = [];
  if (!state.stockMovements) state.stockMovements = [];
  if (!state.recipes) state.recipes = [];
  if (!state.suppliers) state.suppliers = [];
  if (!state.purchaseOrders) state.purchaseOrders = [];
  if (!state.supplierPayables) state.supplierPayables = [];
  if (!state.supplierPayments) state.supplierPayments = [];
  if (!state.receivables) state.receivables = [];
  if (!state.settings.printerSettings) {
    state.settings.printerSettings = {
      connectionType: 'browser',
      paperWidth: state.settings.receiptSettings?.printWidth === '58mm' ? '58mm' : '80mm',
      baudRate: 9600,
      bridgeUrl: 'http://127.0.0.1:9100/print',
      autoPrintReceipt: false,
      autoPrintKot: false,
      autoOpenCashDrawerOnCash: true,
      drawerKickPin: 0
    };
  }
  if (!state.settings.irdSettings) {
    state.settings.irdSettings = {
      cbmsEnabled: false,
      strictTaxInvoiceLock: true
    };
  }
  if (!state.cashRegisters) state.cashRegisters = [];
  if (!state.accounts || state.accounts.length === 0) {
    state.accounts = createCleanChartOfAccounts(businessId);
  } else {
    state.accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  }
  if (!state.journalEntries) state.journalEntries = [];
  if (!state.creditNotes) state.creditNotes = [];
  if (!state.paymentReconciliations) state.paymentReconciliations = [];
  if (!state.financialPeriods) {
    const currentYear = new Date().getFullYear();
    state.financialPeriods = [
      {
        id: `period-${currentYear}-01`,
        businessId,
        periodName: `Fiscal Q1 ${currentYear}`,
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-03-31`,
        status: 'OPEN'
      }
    ];
  }
  if (state.settings?.securitySettings && 'masterOwnerEmail' in state.settings.securitySettings) {
    const { masterOwnerEmail: _dropped, ...restSec } = state.settings.securitySettings;
    state.settings.securitySettings = restSec;
  }
  if (Array.isArray(state.staffUsers)) {
    state.staffUsers = state.staffUsers.map((s) =>
      s.role === 'SUPER_ADMIN' || isMasterOwnerEmail(s.email) || isMasterOwnerEmail(s.username)
        ? { ...s, username: isMasterOwnerEmail(s.username) ? 'superadmin' : s.username, email: undefined }
        : s
    );
  }
  return { ...state, businessId };
}

/**
 * Loads isolated AppState for a specific businessId.
 */
export function loadTenantAppState(businessId: string): AppState {
  if (typeof window === 'undefined') {
    return ensureTenantDefaults(getInitialAppState(), businessId);
  }

  // 1. If Himalayan Breeze and legacy STORAGE_KEY exists, migrate or load it
  if (businessId === 'biz-himalayan-breeze') {
    const tenantKey = TENANT_STORAGE_PREFIX + businessId;
    const scrubFlagKey = 'hb_demo_scrubbed_v1_' + businessId;
    const alreadyScrubbed = localStorage.getItem(scrubFlagKey) === '1';

    const finalizeHB = (rawState: AppState): AppState => {
      const defaulted = ensureTenantDefaults(rawState, businessId);
      if (alreadyScrubbed) return defaulted;
      const { state: scrubbed, changed } = scrubLegacyDemoData(defaulted);
      try {
        localStorage.setItem(scrubFlagKey, '1');
        if (changed) {
          localStorage.setItem(tenantKey, JSON.stringify(scrubbed));
        }
      } catch {
        // ignore storage restrictions
      }
      return scrubbed;
    };

    const rawTenant = localStorage.getItem(tenantKey);
    if (rawTenant) {
      try {
        const parsed = JSON.parse(rawTenant);
        return finalizeHB(parsed);
      } catch {
        // fallback
      }
    }

    // Try legacy key
    const rawLegacy = localStorage.getItem(STORAGE_KEY);
    if (rawLegacy) {
      try {
        const parsedLegacy = JSON.parse(rawLegacy);
        parsedLegacy.businessId = businessId;
        const cleaned = finalizeHB(parsedLegacy);
        try {
          localStorage.setItem(tenantKey, JSON.stringify(cleaned));
        } catch {
          // ignore
        }
        return cleaned;
      } catch {
        // fallback
      }
    }

    const initialHB = ensureTenantDefaults(getCleanStarterState(), businessId);
    initialHB.businessId = businessId;
    try {
      localStorage.setItem(tenantKey, JSON.stringify(initialHB));
      localStorage.setItem(scrubFlagKey, '1');
    } catch {
      // ignore
    }
    return initialHB;
  }

  // 2. For other businesses, load from tenant storage
  const tenantKey = TENANT_STORAGE_PREFIX + businessId;
  const scrubFlagKey = 'hb_demo_scrubbed_v1_' + businessId;
  const raw = localStorage.getItem(tenantKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.menuItems) {
        const defaulted = ensureTenantDefaults(parsed, businessId);
        if (localStorage.getItem(scrubFlagKey) !== '1') {
          const { state: scrubbed, changed } = scrubLegacyDemoData(defaulted);
          try {
            localStorage.setItem(scrubFlagKey, '1');
            if (changed) localStorage.setItem(tenantKey, JSON.stringify(scrubbed));
          } catch {
            // ignore
          }
          return scrubbed;
        }
        return defaulted;
      }
    } catch {
      // fallback to generated template
    }
  }

  // 3. Generate initial state for this business (starter only when explicitly requested)
  const business = getRegisteredBusinesses().find(b => b.businessId === businessId);
  let starter: AppState;
  if (business?.templateType === 'starter') {
    starter = createStarterStateForBusinessType(business);
  } else {
    const cleanSettings: BusinessSettings = {
      ...DEFAULT_SETTINGS,
      businessId,
      businessName: business?.businessName || DEFAULT_SETTINGS.businessName,
      nepaliBusinessName: business?.nepaliBusinessName || business?.businessName || DEFAULT_SETTINGS.nepaliBusinessName,
      tagline: business?.tagline || DEFAULT_SETTINGS.tagline,
      address: business?.address || '',
      phone: business?.phone || '',
      email: business?.email || '',
      panVatNumber: business?.panVatNumber || '',
      currencySymbol: business?.currencySymbol || 'Rs.',
      fonepayMerchantName: business?.businessName || ''
    };
    starter = {
      ...getCleanStarterState(cleanSettings),
      businessId,
      accounts: createCleanChartOfAccounts(businessId)
    };
  }

  const defaultedStarter = ensureTenantDefaults(starter, businessId);
  try {
    localStorage.setItem(tenantKey, JSON.stringify(defaultedStarter));
  } catch {
    // ignore
  }

  return defaultedStarter;
}

/**
 * Creates and registers a new staff invitation for a specific business
 */
export function createStaffInvitation(
  businessId: string,
  businessName: string,
  emailOrPhone: string,
  role: StaffRole,
  inviter: { id: string; name: string },
  permissions?: string[]
): StaffInvitation {
  const code = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const invitation: StaffInvitation = {
    id: 'invite-' + Date.now().toString(36),
    businessId,
    businessName,
    emailOrPhone: emailOrPhone.trim(),
    role,
    permissions,
    invitedByName: inviter.name,
    invitedByStaffId: inviter.id,
    createdAt: new Date().toISOString().split('T')[0],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'PENDING',
    inviteCode: code
  };

  const state = loadTenantAppState(businessId);
  state.staffInvitations = [invitation, ...(state.staffInvitations || [])];
  saveTenantAppState(businessId, state);

  return invitation;
}

/**
 * Accepts a staff invitation, creating a new StaffUser associated with that business
 */
export async function acceptStaffInvitation(
  businessId: string,
  inviteCode: string,
  username: string,
  fullName: string,
  pin: string
): Promise<{ success: boolean; error?: string; staffUser?: StaffUser }> {
  const state = loadTenantAppState(businessId);
  const invitations = state.staffInvitations || [];
  const invite = invitations.find(i => i.inviteCode === inviteCode.trim().toUpperCase() && i.businessId === businessId);

  if (!invite) {
    return { success: false, error: 'Invalid invitation code or invitation not found for this business.' };
  }

  if (invite.status !== 'PENDING') {
    return { success: false, error: `This invitation is already ${invite.status.toLowerCase()}.` };
  }

  // Create staff user account
  const newStaff = await createStaffAccount(username, fullName, fullName, invite.role, pin);
  newStaff.businessId = businessId;
  newStaff.email = invite.emailOrPhone.includes('@') ? invite.emailOrPhone : undefined;
  newStaff.phone = !invite.emailOrPhone.includes('@') ? invite.emailOrPhone : undefined;
  newStaff.permissions = invite.permissions;

  // Update invite status
  invite.status = 'ACCEPTED';

  // Save to tenant state
  state.staffUsers = [...state.staffUsers, newStaff];
  state.staffInvitations = invitations;
  saveTenantAppState(businessId, state);

  // Record membership
  const memberships = getMemberships();
  memberships.push({
    id: 'mem-' + Date.now().toString(36),
    userId: newStaff.id,
    businessId,
    role: invite.role,
    status: 'ACTIVE',
    createdAt: new Date().toISOString().split('T')[0]
  });
  saveMemberships(memberships);

  return { success: true, staffUser: newStaff };
}

/**
 * Revokes a pending staff invitation
 */
export function revokeStaffInvitation(businessId: string, invitationId: string): boolean {
  const state = loadTenantAppState(businessId);
  const invitations = state.staffInvitations || [];
  const invite = invitations.find(i => i.id === invitationId && i.businessId === businessId);
  if (!invite) return false;

  invite.status = 'REVOKED';
  state.staffInvitations = invitations;
  saveTenantAppState(businessId, state);
  return true;
}

/**
 * Saves isolated AppState for a specific businessId.
 */
export function saveTenantAppState(businessId: string, state: AppState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Multi-tenant partition integrity guard: Prevent cross-tenant state overwrites
    if (state.businessId && state.businessId !== businessId) {
      console.warn(`[Multi-Tenant Security] Rejected state save: State belongs to tenant "${state.businessId}" but target partition is "${businessId}".`);
      return false;
    }

    const tenantKey = TENANT_STORAGE_PREFIX + businessId;
    const sanitizedSecurity = state.settings?.securitySettings
      ? (() => {
          const { masterOwnerEmail: _dropped, ...restSec } = state.settings.securitySettings;
          return restSec;
        })()
      : state.settings?.securitySettings;
    const cleanState: AppState = {
      ...state,
      businessId,
      settings: state.settings ? { ...state.settings, securitySettings: sanitizedSecurity } : state.settings,
      staffUsers: Array.isArray(state.staffUsers)
        ? state.staffUsers.map((s) =>
            s.role === 'SUPER_ADMIN' || isMasterOwnerEmail(s.email) || isMasterOwnerEmail(s.username)
              ? { ...s, username: isMasterOwnerEmail(s.username) ? 'superadmin' : s.username, email: undefined }
              : s
          )
        : state.staffUsers
    };
    localStorage.setItem(tenantKey, JSON.stringify(cleanState));
    
    // Also sync to legacy key if it is default business for backward compatibility
    if (businessId === 'biz-himalayan-breeze') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanState));
    }
    return true;
  } catch (err) {
    console.error(`Failed to save state for tenant ${businessId}:`, err);
    return false;
  }
}

/**
 * Registers a brand-new business tenant, generates isolated initial data,
 * and records user membership.
 */
export function registerNewBusiness(input: {
  businessName: string;
  nepaliBusinessName?: string;
  tagline?: string;
  businessType: BusinessType;
  phone: string;
  email: string;
  address: string;
  panVatNumber?: string;
  ownerId: string;
  ownerName: string;
  logo?: string;
  enabledModules?: AppModule[];
  environment?: 'production' | 'demo';
  templateType?: 'starter' | 'clean_slate';
  enforceSingleBusinessCap?: boolean;
  actorRole?: StaffRole;
  isMasterOwner?: boolean;
}): { business: BusinessTenant; state: AppState } {
  if (input.enforceSingleBusinessCap && !input.isMasterOwner) {
    const eligibility = canActorCreateBusiness({
      id: input.ownerId,
      role: input.actorRole || 'OWNER',
      email: input.email,
      isAppCreator: input.isMasterOwner
    });
    if (!eligibility.allowed) {
      throw new Error(eligibility.reason || 'Only one business workspace is allowed per account.');
    }
  }

  const businesses = getRegisteredBusinesses();
  const duplicate = businesses.find(b => b.businessName.toLowerCase().trim() === input.businessName.toLowerCase().trim());
  if (duplicate) {
    throw new Error(`A business workspace named "${input.businessName.trim()}" is already registered. Please provide a unique business name or branch title.`);
  }

  const businessId = 'biz-' + input.businessType.toLowerCase() + '-' + Date.now().toString(36);
  const now = new Date().toISOString().split('T')[0];

  const enabledModules = input.enabledModules && input.enabledModules.length > 0 
    ? input.enabledModules 
    : DEFAULT_MODULES_BY_TYPE[input.businessType] || ALL_APP_MODULES;

  const templateType = input.templateType || 'clean_slate';
  const environment = input.environment || 'production';

  const newBusiness: BusinessTenant = {
    businessId,
    businessName: input.businessName.trim(),
    nepaliBusinessName: input.nepaliBusinessName?.trim(),
    tagline: input.tagline?.trim() || `${input.businessName} - Hospitality & POS`,
    businessType: input.businessType,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    logo: sanitizeBusinessLogoUrl(input.logo),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    panVatNumber: input.panVatNumber?.trim() || '',
    status: 'ACTIVE',
    enabledModules,
    currencySymbol: 'Rs.',
    environment,
    templateType,
    createdAt: now,
    updatedAt: now
  };

  // 1. Add to business registry
  businesses.push(newBusiness);
  saveRegisteredBusinesses(businesses);

  // 2. Add owner membership
  const memberships = getMemberships();
  memberships.push({
    id: 'mem-' + Date.now().toString(36),
    userId: input.ownerId,
    businessId,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: now
  });
  saveMemberships(memberships);

  // 3. Create isolated initial state
  const initialState = createStarterStateForBusinessType(newBusiness);
  if (templateType === 'clean_slate') {
    initialState.menuItems = [];
    initialState.tablesRooms = [];
    initialState.inventoryItems = [];
    initialState.inventoryLogs = [];
    initialState.customers = [];
    initialState.orders = [];
    initialState.expenses = [];
    initialState.dayClosings = [];
    initialState.khataTransactions = [];
    initialState.roomTypes = [];
    initialState.resortRooms = [];
    initialState.guestProfiles = [];
    initialState.reservations = [];
    initialState.guestFolioItems = [];
    initialState.resortServices = [];
    initialState.housekeepingTasks = [];
    initialState.maintenanceIssues = [];
    initialState.hotelPayments = [];
    initialState.recipes = [];
    initialState.suppliers = [];
    initialState.purchaseOrders = [];
    initialState.supplierPayables = [];
    initialState.supplierPayments = [];
    initialState.receivables = [];
    initialState.accounts = createCleanChartOfAccounts(businessId);
  }
  saveTenantAppState(businessId, initialState);

  // 4. Record single-business owner claim (for non-Master accounts) and set as active business
  if (!input.isMasterOwner) {
    recordOwnerBusinessClaim(input.ownerId, businessId, input.email);
  }
  setActiveBusinessId(businessId);

  return { business: newBusiness, state: initialState };
}

/**
 * Updates business details and settings
 */
export function updateBusiness(businessId: string, updates: Partial<BusinessTenant>): BusinessTenant | null {
  const businesses = getRegisteredBusinesses();
  const index = businesses.findIndex(b => b.businessId === businessId);
  if (index === -1) return null;

  const cleanedBusinessName = updates.businessName !== undefined ? updates.businessName.trim() : undefined;
  if (cleanedBusinessName === '') {
    throw new Error('Business Name cannot be empty.');
  }

  const updated: BusinessTenant = {
    ...businesses[index],
    ...updates,
    ...(cleanedBusinessName ? { businessName: cleanedBusinessName } : {}),
    updatedAt: new Date().toISOString().split('T')[0]
  };

  businesses[index] = updated;
  saveRegisteredBusinesses(businesses);

  // Also update BusinessSettings in that tenant's state if name or address changed
  const state = loadTenantAppState(businessId);
  if (state && state.settings) {
    let settingsChanged = false;
    if (cleanedBusinessName) {
      state.settings.businessName = cleanedBusinessName;
      settingsChanged = true;
    }
    if (updates.nepaliBusinessName) {
      state.settings.nepaliBusinessName = updates.nepaliBusinessName;
      settingsChanged = true;
    }
    if (updates.address) {
      state.settings.address = updates.address;
      settingsChanged = true;
    }
    if (updates.phone) {
      state.settings.phone = updates.phone;
      settingsChanged = true;
    }
    if (updates.panVatNumber) {
      state.settings.panVatNumber = updates.panVatNumber;
      settingsChanged = true;
    }
    if (settingsChanged) {
      saveTenantAppState(businessId, state);
    }
  }

  return updated;
}

/**
 * Activates or suspends a business
 */
export function setBusinessStatus(businessId: string, status: BusinessStatus): BusinessTenant | null {
  return updateBusiness(businessId, { status });
}

/**
 * Creates custom starter template data tailored to business type
 */
export function createStarterStateForBusinessType(business: BusinessTenant): AppState {
  const businessSettings: BusinessSettings = {
    businessId: business.businessId,
    businessName: business.businessName,
    nepaliBusinessName: business.nepaliBusinessName || business.businessName,
    tagline: business.tagline || 'Hospitality & POS Management',
    address: business.address,
    phone: business.phone,
    email: business.email,
    panVatNumber: business.panVatNumber || '',
    currencySymbol: business.currencySymbol || 'Rs.',
    enableVat: true,
    vatRatePercent: 13,
    enableServiceCharge: business.businessType.includes('RESORT') || business.businessType.includes('HOTEL'),
    serviceChargePercent: 10,
    receiptFooterMessage: 'Thank you for choosing ' + business.businessName + '! Visit again.',
    enableSoundEffects: true,
    defaultLanguage: 'en',
    fonepayMerchantName: business.businessName,
    sessionTimeoutMinutes: 120
  };

  if (business.businessId === 'biz-annapurna-coffee') {
    // Cafe-specific template data
    const cafeMenuItems: MenuItem[] = [
      {
        id: 'cm-1',
        code: 'CF-101',
        name: 'Himalayan Single-Origin Espresso',
        nepaliName: 'सिङ्गल ओरिजिन एस्प्रेसो',
        category: 'coffee',
        price: 180,
        costPrice: 40,
        isAvailable: true,
        preparationTimeMinutes: 3,
        station: 'coffee_bar',
        description: 'Locally grown organic Arabica beans from Nuwakot, medium dark roast.'
      },
      {
        id: 'cm-2',
        code: 'CF-102',
        name: 'Flat White with Oat Milk',
        nepaliName: 'फ्ल्याट ह्वाइट (ओट मिल्क)',
        category: 'coffee',
        price: 280,
        costPrice: 85,
        isAvailable: true,
        preparationTimeMinutes: 4,
        station: 'coffee_bar'
      },
      {
        id: 'cm-3',
        code: 'CF-103',
        name: 'Kyoto Style Cold Brew',
        nepaliName: 'क्योतो कोल्ड ब्रू',
        category: 'cold_drinks',
        price: 260,
        costPrice: 60,
        isAvailable: true,
        preparationTimeMinutes: 2,
        station: 'coffee_bar'
      },
      {
        id: 'cm-4',
        code: 'BK-101',
        name: 'Butter Croissant',
        nepaliName: 'बटर क्रोइसाँ',
        category: 'bakery',
        price: 220,
        costPrice: 70,
        isAvailable: true,
        preparationTimeMinutes: 2,
        station: 'bakery'
      },
      {
        id: 'cm-5',
        code: 'BK-102',
        name: 'Warm Belgian Chocolate Brownie',
        nepaliName: 'चकलेट ब्राउनी',
        category: 'dessert',
        price: 320,
        costPrice: 90,
        isAvailable: true,
        preparationTimeMinutes: 3,
        station: 'bakery'
      },
      {
        id: 'cm-6',
        code: 'SN-101',
        name: 'Avocado & Sourdough Toast',
        nepaliName: 'एभोकाडो टोस्ट',
        category: 'snacks',
        price: 450,
        costPrice: 140,
        isAvailable: true,
        preparationTimeMinutes: 7,
        station: 'main_kitchen'
      }
    ];

    const cafeTables: TableRoom[] = [
      { id: 'tb-c1', code: 'T-1', name: 'Window Bar 1', nepaliName: 'झ्याल छेउ १', type: 'table', capacity: 2, status: 'available' },
      { id: 'tb-c2', code: 'T-2', name: 'Window Bar 2', nepaliName: 'झ्याल छेउ २', type: 'table', capacity: 2, status: 'available' },
      { id: 'tb-c3', code: 'T-3', name: 'Garden Lounge 3', nepaliName: 'बगैंचा लाउन्ज ३', type: 'table', capacity: 4, status: 'available' },
      { id: 'tb-c4', code: 'T-4', name: 'Garden Lounge 4', nepaliName: 'बगैंचा लाउन्ज ४', type: 'table', capacity: 4, status: 'available' },
      { id: 'tb-c5', code: 'T-5', name: 'Community Table 5', nepaliName: 'ठूलो टेबल ५', type: 'table', capacity: 8, status: 'available' }
    ];

    const cafeInventory: InventoryItem[] = [
      {
        id: 'ci-1',
        code: 'INV-CF-01',
        name: 'Arabica Green & Roasted Beans',
        nepaliName: 'कफीको गेडा',
        category: 'coffee_tea',
        currentStock: 24,
        unit: 'kg',
        minStockAlert: 8,
        costPerUnit: 1200,
        supplierName: 'Nuwakot Organic Estate',
        lastUpdated: '2026-10-01'
      },
      {
        id: 'ci-2',
        code: 'INV-MK-02',
        name: 'Full Cream Organic Dairy Milk',
        nepaliName: 'दूध',
        category: 'dairy',
        currentStock: 45,
        unit: 'ltr',
        minStockAlert: 15,
        costPerUnit: 110,
        supplierName: 'Pokhara Dairy Cooperative',
        lastUpdated: '2026-10-02'
      }
    ];

    return {
      businessId: business.businessId,
      menuItems: cafeMenuItems,
      tablesRooms: cafeTables,
      orders: [],
      inventoryItems: cafeInventory,
      inventoryLogs: [],
      customers: [],
      khataTransactions: [],
      expenses: [],
      dayClosings: [],
      staffUsers: INITIAL_STAFF_USERS,
      auditLogs: [],
      settings: businessSettings,
      roomTypes: [],
      resortRooms: [],
      guestProfiles: [],
      reservations: [],
      guestFolioItems: [],
      resortServices: [],
      housekeepingTasks: [],
      maintenanceIssues: [],
      hotelPayments: []
    };
  }

  if (business.businessId === 'biz-phewa-dining') {
    // Restaurant-specific template data
    const dineMenuItems: MenuItem[] = [
      {
        id: 'dm-1',
        code: 'TH-201',
        name: 'Authentic Thakali Set (Mutton)',
        nepaliName: 'खाँटी थकाली खाना सेट (खसी)',
        category: 'nepali_food',
        price: 750,
        costPrice: 280,
        isAvailable: true,
        preparationTimeMinutes: 12,
        station: 'main_kitchen',
        description: 'Jimbu tempered Mustang black lentils, Gundruk sadeko, Rayo saag, Timbur chutney, Mutton curry, and Basmati rice.'
      },
      {
        id: 'dm-2',
        code: 'FF-202',
        name: 'Phewa Lake Fresh Whole Trout Grilled',
        nepaliName: 'फेवा ट्राउट माछा ग्रिल्ड',
        category: 'continental',
        price: 1100,
        costPrice: 450,
        isAvailable: true,
        preparationTimeMinutes: 18,
        station: 'main_kitchen'
      },
      {
        id: 'dm-3',
        code: 'BR-203',
        name: 'Hyderabadi Dum Mutton Biryani',
        nepaliName: 'दम मटन बिर्यानी',
        category: 'nepali_food',
        price: 680,
        costPrice: 260,
        isAvailable: true,
        preparationTimeMinutes: 15,
        station: 'main_kitchen'
      },
      {
        id: 'dm-4',
        code: 'SN-204',
        name: 'Crispy Butter Garlic Naan with Paneer Butter Masala',
        nepaliName: 'बटर नान र पनिर मसला',
        category: 'fast_food',
        price: 490,
        costPrice: 170,
        isAvailable: true,
        preparationTimeMinutes: 10,
        station: 'main_kitchen'
      }
    ];

    const dineTables: TableRoom[] = [
      { id: 'dt-1', code: 'D-1', name: 'Lakeside Deck 1', nepaliName: 'लेकसाइड डेक १', type: 'table', capacity: 4, status: 'available' },
      { id: 'dt-2', code: 'D-2', name: 'Lakeside Deck 2', nepaliName: 'लेकसाइड डेक २', type: 'table', capacity: 4, status: 'available' },
      { id: 'dt-3', code: 'D-3', name: 'Private VIP Cabin', nepaliName: 'भि-आइ-पी क्याबिन', type: 'cottage', capacity: 8, status: 'available' },
      { id: 'dt-4', code: 'D-4', name: 'Main Dining Hall 1', nepaliName: 'डाइनिङ हल १', type: 'table', capacity: 6, status: 'available' },
      { id: 'dt-5', code: 'D-5', name: 'Main Dining Hall 2', nepaliName: 'डाइनिङ हल २', type: 'table', capacity: 6, status: 'available' }
    ];

    return {
      businessId: business.businessId,
      menuItems: dineMenuItems,
      tablesRooms: dineTables,
      orders: [],
      inventoryItems: CLEAN_INVENTORY.slice(0, 5),
      inventoryLogs: [],
      customers: [],
      khataTransactions: [],
      expenses: [],
      dayClosings: [],
      staffUsers: INITIAL_STAFF_USERS,
      auditLogs: [],
      settings: businessSettings,
      roomTypes: [],
      resortRooms: [],
      guestProfiles: [],
      reservations: [],
      guestFolioItems: [],
      resortServices: [],
      housekeepingTasks: [],
      maintenanceIssues: [],
      hotelPayments: []
    };
  }

  // Default / Resort / Combined Starter Template:
  // Includes ONLY structural starter catalog (menu, clean tables, healthy stock SKUs, room types, available rooms, service catalog)
  // Zero fake financial balances, zero fake customers/Khata dues, zero fake reservations/folios/hotelPayments!
  const hasResort = business.enabledModules.includes('resort');

  return {
    businessId: business.businessId,
    menuItems: INITIAL_MENU_ITEMS,
    tablesRooms: CLEAN_TABLES_ROOMS,
    orders: [],
    inventoryItems: CLEAN_INVENTORY,
    inventoryLogs: [],
    customers: [],
    khataTransactions: [],
    expenses: [],
    dayClosings: [],
    staffUsers: INITIAL_STAFF_USERS,
    auditLogs: [],
    settings: businessSettings,
    accounts: createCleanChartOfAccounts(business.businessId),
    roomTypes: hasResort ? INITIAL_ROOM_TYPES : [],
    resortRooms: hasResort ? CLEAN_RESORT_ROOMS : [],
    guestProfiles: [],
    reservations: [],
    guestFolioItems: [],
    resortServices: hasResort ? INITIAL_RESORT_SERVICES : [],
    housekeepingTasks: [],
    maintenanceIssues: [],
    hotelPayments: []
  };
}

export interface CloudTenantMetaSummary {
  businessId: string;
  businessName: string;
  nepaliBusinessName?: string;
  tagline?: string;
  businessType?: BusinessType;
  ownerUid?: string;
  ownerEmail?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  enabledModules?: AppModule[];
  currencySymbol?: string;
}

/**
 * Merges cloud-registered client businesses discovered by the App Creator
 * into the local tenant registry without duplicating IDs or wiping local details.
 */
export function upsertSyncedCloudBusinesses(cloudList: CloudTenantMetaSummary[]): BusinessTenant[] {
  const existing = getRegisteredBusinesses();
  const byId = new Map<string, BusinessTenant>(existing.map((b) => [b.businessId, b]));
  const today = new Date().toISOString().split('T')[0];

  for (const meta of cloudList) {
    if (!meta?.businessId) continue;
    const prev = byId.get(meta.businessId);
    const nextStatus = meta.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    const fallbackType: BusinessType = meta.businessType || 'CAFE_RESTAURANT';
    const nextModules =
      Array.isArray(meta.enabledModules) && meta.enabledModules.length > 0
        ? meta.enabledModules
        : prev?.enabledModules || DEFAULT_MODULES_BY_TYPE[fallbackType] || ALL_APP_MODULES;

    const safeOwnerEmail = redactProtectedEmail(meta.ownerEmail, '');

    if (prev) {
      byId.set(meta.businessId, {
        ...prev,
        businessName: meta.businessName || prev.businessName,
        nepaliBusinessName: meta.nepaliBusinessName ?? prev.nepaliBusinessName,
        tagline: meta.tagline ?? prev.tagline,
        businessType: meta.businessType || prev.businessType,
        status: nextStatus,
        enabledModules: nextModules,
        currencySymbol: meta.currencySymbol || prev.currencySymbol,
        ownerName: isMasterOwnerEmail(prev.ownerName) ? 'Client Owner' : prev.ownerName,
        email: redactProtectedEmail(prev.email, '') || safeOwnerEmail || '',
        updatedAt: today
      });
    } else {
      byId.set(meta.businessId, {
        businessId: meta.businessId,
        businessName: meta.businessName || meta.businessId,
        nepaliBusinessName: meta.nepaliBusinessName,
        tagline: meta.tagline || 'Cloud-Synced Client Workspace',
        businessType: fallbackType,
        ownerId: meta.ownerUid || 'cloud-owner',
        ownerName: safeOwnerEmail || 'Client Owner',
        phone: '',
        email: safeOwnerEmail,
        address: 'Cloud Tenant',
        panVatNumber: '',
        status: nextStatus,
        enabledModules: nextModules,
        currencySymbol: meta.currencySymbol || 'Rs.',
        environment: 'production',
        templateType: 'clean_slate',
        createdAt: today,
        updatedAt: today
      });
    }
  }

  const merged = Array.from(byId.values());
  saveRegisteredBusinesses(merged);
  return merged;
}

