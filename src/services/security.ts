import { 
  AppState, 
  AuditLogEntry, 
  InventoryItem, 
  MenuItem, 
  Order, 
  OrderItem, 
  PaymentMethod,
  ProductRecipe,
  Session, 
  StaffRole, 
  StaffUser,
  TableRoom 
} from '../types';
import { resolveOrderItemRecipeIngredients } from './orderAudit';

export const SESSION_STORAGE_KEY = 'himalayan_breeze_session_v1';

// Web Crypto SHA-256 Salting & Hashing
export async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin + 'hb_pos_secure_pepper_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pre-generated salted hashes for default staff (pins: admin=7788, manager=1234, cashier=2233, waiter=3344, kitchen=4455, reception=5566, housekeeping=6677, accountant=8899)
// Note: We compute them dynamically on seed if missing to guarantee cryptographic match
export async function createStaffAccount(
  username: string, 
  name: string, 
  nepaliName: string, 
  role: StaffRole, 
  pin: string,
  email?: string,
  phone?: string,
  businessId?: string
): Promise<StaffUser> {
  const salt = generateSalt();
  const pinHash = await hashPinWithSalt(pin, salt);
  return {
    id: 'staff-' + role.toLowerCase() + '-' + Date.now(),
    username: username.toLowerCase().trim(),
    name,
    nepaliName,
    role,
    pinHash,
    salt,
    isActive: true,
    email,
    phone,
    businessId,
    createdAt: new Date().toISOString().split('T')[0]
  };
}

export const INITIAL_STAFF_SEEDS: { username: string; name: string; nepaliName: string; role: StaffRole; defaultPin: string }[] = [
  { username: 'owner', name: 'Business Proprietor / Owner', nepaliName: 'व्यवसाय मालिक (Owner)', role: 'OWNER', defaultPin: '7788' },
  { username: 'admin', name: 'General Manager', nepaliName: 'प्रमुख व्यवस्थापक (Admin)', role: 'ADMIN', defaultPin: '7788' },
  { username: 'manager', name: 'Resort & F&B Manager', nepaliName: 'रिसोर्ट म्यानेजर (Manager)', role: 'MANAGER', defaultPin: '1234' },
  { username: 'cashier', name: 'Main Counter Cashier', nepaliName: 'काउन्टर क्यासियर (Cashier)', role: 'CASHIER', defaultPin: '2233' },
  { username: 'waiter', name: 'Dining Service Staff', nepaliName: 'डाइनिङ वेटर (Waiter)', role: 'WAITER', defaultPin: '3344' },
  { username: 'kitchen', name: 'Head Chef & Kitchen', nepaliName: 'किचेन सेफ (Kitchen)', role: 'KITCHEN', defaultPin: '4455' },
  { username: 'housekeeping', name: 'Housekeeping & Cleaning', nepaliName: 'हाउसकिपिङ (Housekeeping)', role: 'HOUSEKEEPING', defaultPin: '6677' },
  { username: 'superadmin', name: 'System Super Admin', nepaliName: 'सिस्टम सुपर एडमिन', role: 'SUPER_ADMIN', defaultPin: '9900' },
];

export const KNOWN_WEAK_DEFAULT_PINS = [
  '0000',
  '1111',
  '1234',
  '2222',
  '2233',
  '3333',
  '3344',
  '4321',
  '4444',
  '4455',
  '5555',
  '5566',
  '6666',
  '6677',
  '7777',
  '7788',
  '8888',
  '8899',
  '9900',
  '9999'
] as const;

export function isKnownWeakPin(pin: string): boolean {
  const clean = String(pin || '').trim();
  if (!/^\d{4,8}$/.test(clean)) return true;
  if ((KNOWN_WEAK_DEFAULT_PINS as readonly string[]).includes(clean)) return true;
  // All same digit (e.g. 00000)
  if (/^(\d)\1+$/.test(clean)) return true;
  // Sequential ascending/descending (e.g. 12345, 9876)
  let asc = true;
  let desc = true;
  for (let i = 1; i < clean.length; i++) {
    const diff = clean.charCodeAt(i) - clean.charCodeAt(i - 1);
    if (diff !== 1) asc = false;
    if (diff !== -1) desc = false;
  }
  return asc || desc;
}

/**
 * Validates a staff PIN for production commercial use:
 * - Requires 4–8 numeric digits
 * - Blocks factory default demo PINs (7788, 1234, 2233, etc.), repeated/sequential digits when enforced
 * - Prevents duplicate PIN reuse across multiple staff members in the same workspace
 */
export async function validateProductionPin(
  pin: string,
  existingStaff: StaffUser[] = [],
  options?: { excludeStaffId?: string; enforceStrongPin?: boolean }
): Promise<{ isValid: boolean; error?: string }> {
  const clean = String(pin || '').trim();
  if (!/^\d{4,8}$/.test(clean)) {
    return { isValid: false, error: 'PIN must be 4 to 8 numeric digits.' };
  }

  const enforceStrong = options?.enforceStrongPin !== false;
  if (enforceStrong && isKnownWeakPin(clean)) {
    return {
      isValid: false,
      error: 'Factory default or sequential/repeated PINs (e.g., 7788, 1234, 0000) are blocked in production. Pick a unique PIN.'
    };
  }

  for (const member of existingStaff) {
    if (!member.isActive) continue;
    if (options?.excludeStaffId && member.id === options.excludeStaffId) continue;
    if (!member.pinHash || !member.salt) continue;
    const matched = (await hashPinWithSalt(clean, member.salt)) === member.pinHash;
    if (matched) {
      return {
        isValid: false,
        error: `This PIN is already assigned to another staff member (${member.name}). Each employee must have a unique PIN.`
      };
    }
  }

  return { isValid: true };
}

export async function generateInitialStaffList(): Promise<StaffUser[]> {
  const list: StaffUser[] = [];
  for (const s of INITIAL_STAFF_SEEDS) {
    const user = await createStaffAccount(s.username, s.name, s.nepaliName, s.role, s.defaultPin);
    list.push({ ...user, mustChangePin: true });
  }
  return list;
}

// Session Management
export function getCurrentSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: Session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(user: StaffUser, timeoutMinutes: number = 60, businessId?: string): Session {
  const token = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  const session: Session = {
    token,
    staffId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    businessId: businessId || user.businessId,
    expiresAt: Date.now() + (timeoutMinutes * 60 * 1000)
  };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

// Role-Based Access Control (RBAC) Permission Matrix
export type AppAction =
  | 'VIEW_TAB_DASHBOARD'
  | 'VIEW_TAB_POS'
  | 'VIEW_TAB_BILLING'
  | 'VIEW_TAB_TABLES'
  | 'VIEW_TAB_KDS'
  | 'VIEW_TAB_INVENTORY'
  | 'VIEW_TAB_CUSTOMERS'
  | 'VIEW_TAB_DAY_CLOSING'
  | 'VIEW_TAB_REPORTS'
  | 'VIEW_TAB_SETTINGS'
  | 'VIEW_TAB_RESORT'
  | 'MANAGE_RESERVATIONS'
  | 'MANAGE_ROOMS'
  | 'MANAGE_GUEST_FOLIO'
  | 'MANAGE_HOUSEKEEPING'
  | 'MANAGE_MAINTENANCE'
  | 'CHARGE_ROOM'
  | 'SETTLE_PAYMENT'
  | 'SEND_KOT'
  | 'MODIFY_PRICING'
  | 'APPLY_DISCOUNT'
  | 'VOID_ORDER'
  | 'TRANSFER_TABLE'
  | 'CHECKIN_GUEST'
  | 'CHECKOUT_GUEST'
  | 'UPDATE_CLEANING_STATUS'
  | 'STOCK_IN_OUT'
  | 'ADJUST_KHATA_CREDIT'
  | 'COLLECT_KHATA_PAYMENT'
  | 'RECORD_EXPENSE'
  | 'PERFORM_DAY_CLOSE'
  | 'VIEW_FINANCIAL_REPORTS'
  | 'EXPORT_DATA'
  | 'IMPORT_BACKUP'
  | 'MANAGE_STAFF'
  | 'MODIFY_TAX_CONFIG'
  | 'MANAGE_ALL_BUSINESSES'
  | 'SWITCH_ANY_BUSINESS'
  | 'CREATE_BUSINESS'
  | 'EDIT_BUSINESS_DETAILS'
  | 'SUSPEND_ACTIVATE_BUSINESS'
  | 'MANAGE_BUSINESS_MODULES'
  | 'VIEW_TAB_BUSINESS_ADMIN'
  | 'MANAGE_BUSINESS_PROFILE'
  | 'MANAGE_BUSINESS_STAFF'
  | 'INVITE_STAFF'
  | 'MANAGE_ROLES_PERMISSIONS'
  | 'MANAGE_PAYMENT_METHODS'
  | 'MANAGE_RECEIPT_SETTINGS'
  | 'VIEW_BUSINESS_AUDIT';

const ROLE_PERMISSIONS: Record<StaffRole, Set<AppAction>> = {
  SUPER_ADMIN: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING', 'VIEW_TAB_TABLES', 'VIEW_TAB_KDS', 'VIEW_TAB_INVENTORY', 
    'VIEW_TAB_CUSTOMERS', 'VIEW_TAB_DAY_CLOSING', 'VIEW_TAB_REPORTS', 'VIEW_TAB_SETTINGS',
    'VIEW_TAB_RESORT', 'MANAGE_RESERVATIONS', 'MANAGE_ROOMS', 'MANAGE_GUEST_FOLIO',
    'MANAGE_HOUSEKEEPING', 'MANAGE_MAINTENANCE', 'CHARGE_ROOM',
    'SETTLE_PAYMENT', 'SEND_KOT', 'MODIFY_PRICING', 'APPLY_DISCOUNT', 'VOID_ORDER', 
    'TRANSFER_TABLE', 'CHECKIN_GUEST', 'CHECKOUT_GUEST', 'UPDATE_CLEANING_STATUS', 
    'STOCK_IN_OUT', 'ADJUST_KHATA_CREDIT', 'COLLECT_KHATA_PAYMENT', 'RECORD_EXPENSE', 
    'PERFORM_DAY_CLOSE', 'VIEW_FINANCIAL_REPORTS', 'EXPORT_DATA', 'IMPORT_BACKUP', 
    'MANAGE_STAFF', 'MODIFY_TAX_CONFIG',
    'MANAGE_ALL_BUSINESSES', 'SWITCH_ANY_BUSINESS', 'CREATE_BUSINESS', 
    'EDIT_BUSINESS_DETAILS', 'SUSPEND_ACTIVATE_BUSINESS', 'MANAGE_BUSINESS_MODULES',
    'VIEW_TAB_BUSINESS_ADMIN', 'MANAGE_BUSINESS_PROFILE', 'MANAGE_BUSINESS_STAFF',
    'INVITE_STAFF', 'MANAGE_ROLES_PERMISSIONS', 'MANAGE_PAYMENT_METHODS',
    'MANAGE_RECEIPT_SETTINGS', 'VIEW_BUSINESS_AUDIT'
  ]),
  OWNER: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING', 'VIEW_TAB_TABLES', 'VIEW_TAB_KDS', 'VIEW_TAB_INVENTORY', 
    'VIEW_TAB_CUSTOMERS', 'VIEW_TAB_DAY_CLOSING', 'VIEW_TAB_REPORTS', 'VIEW_TAB_SETTINGS',
    'VIEW_TAB_RESORT', 'MANAGE_RESERVATIONS', 'MANAGE_ROOMS', 'MANAGE_GUEST_FOLIO',
    'MANAGE_HOUSEKEEPING', 'MANAGE_MAINTENANCE', 'CHARGE_ROOM',
    'SETTLE_PAYMENT', 'SEND_KOT', 'MODIFY_PRICING', 'APPLY_DISCOUNT', 'VOID_ORDER', 
    'TRANSFER_TABLE', 'CHECKIN_GUEST', 'CHECKOUT_GUEST', 'UPDATE_CLEANING_STATUS', 
    'STOCK_IN_OUT', 'ADJUST_KHATA_CREDIT', 'COLLECT_KHATA_PAYMENT', 'RECORD_EXPENSE', 
    'PERFORM_DAY_CLOSE', 'VIEW_FINANCIAL_REPORTS', 'EXPORT_DATA', 'IMPORT_BACKUP', 
    'MANAGE_STAFF', 'MODIFY_TAX_CONFIG',
    'CREATE_BUSINESS', 'EDIT_BUSINESS_DETAILS', 'MANAGE_BUSINESS_MODULES',
    'VIEW_TAB_BUSINESS_ADMIN', 'MANAGE_BUSINESS_PROFILE', 'MANAGE_BUSINESS_STAFF',
    'INVITE_STAFF', 'MANAGE_ROLES_PERMISSIONS', 'MANAGE_PAYMENT_METHODS',
    'MANAGE_RECEIPT_SETTINGS', 'VIEW_BUSINESS_AUDIT'
  ]),
  ADMIN: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING', 'VIEW_TAB_TABLES', 'VIEW_TAB_KDS', 'VIEW_TAB_INVENTORY', 
    'VIEW_TAB_CUSTOMERS', 'VIEW_TAB_DAY_CLOSING', 'VIEW_TAB_REPORTS', 'VIEW_TAB_SETTINGS',
    'VIEW_TAB_RESORT', 'MANAGE_RESERVATIONS', 'MANAGE_ROOMS', 'MANAGE_GUEST_FOLIO',
    'MANAGE_HOUSEKEEPING', 'MANAGE_MAINTENANCE', 'CHARGE_ROOM',
    'SETTLE_PAYMENT', 'SEND_KOT', 'MODIFY_PRICING', 'APPLY_DISCOUNT', 'VOID_ORDER', 
    'TRANSFER_TABLE', 'CHECKIN_GUEST', 'CHECKOUT_GUEST', 'UPDATE_CLEANING_STATUS', 
    'STOCK_IN_OUT', 'ADJUST_KHATA_CREDIT', 'COLLECT_KHATA_PAYMENT', 'RECORD_EXPENSE', 
    'PERFORM_DAY_CLOSE', 'VIEW_FINANCIAL_REPORTS', 'EXPORT_DATA', 'IMPORT_BACKUP', 
    'MANAGE_STAFF', 'MODIFY_TAX_CONFIG',
    'EDIT_BUSINESS_DETAILS', 'MANAGE_BUSINESS_MODULES',
    'VIEW_TAB_BUSINESS_ADMIN', 'MANAGE_BUSINESS_PROFILE', 'MANAGE_BUSINESS_STAFF',
    'INVITE_STAFF', 'MANAGE_ROLES_PERMISSIONS', 'MANAGE_PAYMENT_METHODS',
    'MANAGE_RECEIPT_SETTINGS', 'VIEW_BUSINESS_AUDIT'
  ]),
  MANAGER: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING', 'VIEW_TAB_TABLES', 'VIEW_TAB_KDS', 'VIEW_TAB_INVENTORY', 
    'VIEW_TAB_CUSTOMERS', 'VIEW_TAB_DAY_CLOSING', 'VIEW_TAB_REPORTS', 'VIEW_TAB_SETTINGS',
    'VIEW_TAB_RESORT', 'MANAGE_RESERVATIONS', 'MANAGE_ROOMS', 'MANAGE_GUEST_FOLIO',
    'MANAGE_HOUSEKEEPING', 'MANAGE_MAINTENANCE', 'CHARGE_ROOM',
    'SETTLE_PAYMENT', 'SEND_KOT', 'MODIFY_PRICING', 'APPLY_DISCOUNT', 'VOID_ORDER', 
    'TRANSFER_TABLE', 'CHECKIN_GUEST', 'CHECKOUT_GUEST', 'UPDATE_CLEANING_STATUS', 
    'STOCK_IN_OUT', 'ADJUST_KHATA_CREDIT', 'COLLECT_KHATA_PAYMENT', 'RECORD_EXPENSE', 
    'PERFORM_DAY_CLOSE', 'VIEW_FINANCIAL_REPORTS', 'EXPORT_DATA',
    'MODIFY_TAX_CONFIG', 'MANAGE_PAYMENT_METHODS',
    'MANAGE_STAFF', 'MANAGE_BUSINESS_STAFF', 'INVITE_STAFF',
    'VIEW_TAB_BUSINESS_ADMIN', 'VIEW_BUSINESS_AUDIT'
  ]),
  CASHIER: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING', 'VIEW_TAB_TABLES', 'VIEW_TAB_CUSTOMERS', 'VIEW_TAB_DAY_CLOSING',
    'SETTLE_PAYMENT', 'SEND_KOT', 'APPLY_DISCOUNT', 'TRANSFER_TABLE', 'CHARGE_ROOM',
    'COLLECT_KHATA_PAYMENT', 'RECORD_EXPENSE', 'PERFORM_DAY_CLOSE'
  ]),
  WAITER: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING', 'VIEW_TAB_TABLES', 'VIEW_TAB_KDS',
    'SETTLE_PAYMENT', 'SEND_KOT', 'TRANSFER_TABLE', 'CHARGE_ROOM'
  ]),
  KITCHEN: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_KDS', 'VIEW_TAB_INVENTORY', 'STOCK_IN_OUT'
  ]),
  RECEPTIONIST: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_RESORT', 'VIEW_TAB_TABLES', 'VIEW_TAB_CUSTOMERS', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING',
    'MANAGE_RESERVATIONS', 'MANAGE_ROOMS', 'MANAGE_GUEST_FOLIO', 'CHARGE_ROOM',
    'CHECKIN_GUEST', 'CHECKOUT_GUEST', 'UPDATE_CLEANING_STATUS', 
    'SETTLE_PAYMENT', 'SEND_KOT', 'TRANSFER_TABLE'
  ]),
  HOUSEKEEPING: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_RESORT', 'VIEW_TAB_TABLES',
    'MANAGE_HOUSEKEEPING', 'MANAGE_MAINTENANCE',
    'UPDATE_CLEANING_STATUS'
  ]),
  ACCOUNTANT: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_RESORT', 'VIEW_TAB_BILLING', 'VIEW_TAB_CUSTOMERS', 'VIEW_TAB_DAY_CLOSING', 'VIEW_TAB_REPORTS', 'VIEW_TAB_INVENTORY',
    'MANAGE_GUEST_FOLIO', 'ADJUST_KHATA_CREDIT', 'COLLECT_KHATA_PAYMENT', 'RECORD_EXPENSE', 'PERFORM_DAY_CLOSE', 
    'VIEW_FINANCIAL_REPORTS', 'EXPORT_DATA'
  ]),
  INVENTORY_STAFF: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_INVENTORY', 'STOCK_IN_OUT'
  ]),
  STAFF: new Set([
    'VIEW_TAB_DASHBOARD', 'VIEW_TAB_POS', 'VIEW_TAB_BILLING', 'SEND_KOT'
  ])
};

export const SUBORDINATE_STAFF_ROLES: readonly StaffRole[] = [
  'CASHIER',
  'WAITER',
  'KITCHEN',
  'RECEPTIONIST',
  'HOUSEKEEPING',
  'ACCOUNTANT',
  'INVENTORY_STAFF',
  'STAFF'
] as const;

export function isOwnerOrAdminRole(role?: StaffRole): boolean {
  return role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN';
}

export function canActorManageStaff(actorRole?: StaffRole): boolean {
  return (
    actorRole === 'SUPER_ADMIN' ||
    actorRole === 'OWNER' ||
    actorRole === 'ADMIN' ||
    actorRole === 'MANAGER'
  );
}

/**
 * Hierarchical role assignment matrix:
 * - SUPER_ADMIN / OWNER / ADMIN / MANAGER: can assign ADMIN, MANAGER, and all subordinate floor/back-office staff roles.
 * - Cannot assign OWNER or SUPER_ADMIN to prevent workspace takeover.
 * - All other roles: cannot assign any roles.
 */
export function getAssignableRolesForActor(actorRole?: StaffRole): StaffRole[] {
  if (
    actorRole === 'SUPER_ADMIN' ||
    actorRole === 'OWNER' ||
    actorRole === 'ADMIN' ||
    actorRole === 'MANAGER'
  ) {
    return ['ADMIN', 'MANAGER', ...SUBORDINATE_STAFF_ROLES];
  }
  return [];
}

/**
 * Checks whether an actor can view, edit, disable, remove, or reset PIN on an existing staff/user account.
 * Grants MANAGER the same workspace staff/user control as SUPER_ADMIN/OWNER/ADMIN while keeping SUPER_ADMIN protected.
 */
export function canActorManageStaffMember(
  actorRole: StaffRole | undefined,
  existingTargetRole: StaffRole
): boolean {
  if (!actorRole || !canActorManageStaff(actorRole)) return false;
  return existingTargetRole !== 'SUPER_ADMIN';
}

/**
 * Enforces both target-account authority and non-escalation when assigning a role.
 * Preserving an existing non-SUPER_ADMIN role (e.g., saving profile/PIN changes on OWNER) is permitted for managers/admins,
 * while promoting any account to OWNER or SUPER_ADMIN remains blocked.
 */
export function canActorAssignRole(
  actorRole: StaffRole | undefined,
  targetRole: StaffRole,
  existingTargetRole?: StaffRole
): boolean {
  if (!actorRole || !canActorManageStaff(actorRole)) return false;
  if (existingTargetRole && !canActorManageStaffMember(actorRole, existingTargetRole)) {
    return false;
  }
  if (existingTargetRole && existingTargetRole === targetRole) {
    return true;
  }
  return getAssignableRolesForActor(actorRole).includes(targetRole);
}

export function getDefaultRolePermissions(role: StaffRole): AppAction[] {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? Array.from(permissions) : [];
}

export function hasPermission(
  role: StaffRole, 
  action: AppAction, 
  userCustomPermissions?: string[],
  roleCustomPermissions?: Record<string, string[]>
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (userCustomPermissions && userCustomPermissions.includes(action)) return true;
  if (roleCustomPermissions && roleCustomPermissions[role]) {
    return roleCustomPermissions[role].includes(action);
  }
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.has(action) : false;
}

// Immutable Audit Log Creator
export function createAuditLog(
  staffUser: { id: string; name: string; role: StaffRole; businessId?: string },
  action: string,
  targetRecordId: string | undefined,
  details: string,
  severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO',
  businessId?: string
): AuditLogEntry {
  return {
    id: 'audit-' + Date.now() + Math.random().toString(36).substring(2, 6),
    businessId: businessId || staffUser.businessId,
    staffId: staffUser.id,
    staffName: staffUser.name,
    role: staffUser.role,
    action,
    targetRecordId,
    details,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    severity
  };
}

// Server-Style Financial Recalculation & Validation
export interface FinancialVerificationResult {
  isValid: boolean;
  error?: string;
  verifiedSubtotal: number;
  verifiedDiscountAmount: number;
  verifiedServiceCharge: number;
  verifiedVat: number;
  verifiedGrandTotal: number;
}

export function verifyFinancialCalculations(
  items: OrderItem[],
  menuItems: MenuItem[],
  discountPercent: number,
  isTakeaway: boolean,
  enableServiceCharge: boolean,
  serviceChargePercent: number,
  enableVat: boolean,
  vatRatePercent: number
): FinancialVerificationResult {
  if (!items || items.length === 0) {
    return {
      isValid: false,
      error: 'Order has no items.',
      verifiedSubtotal: 0,
      verifiedDiscountAmount: 0,
      verifiedServiceCharge: 0,
      verifiedVat: 0,
      verifiedGrandTotal: 0
    };
  }

  // Verify and recalculate item totals using trusted master prices
  let verifiedSubtotal = 0;
  for (const item of items) {
    if (item.quantity <= 0 || !Number.isFinite(item.quantity)) {
      return {
        isValid: false,
        error: `Invalid quantity for item ${item.name}`,
        verifiedSubtotal: 0,
        verifiedDiscountAmount: 0,
        verifiedServiceCharge: 0,
        verifiedVat: 0,
        verifiedGrandTotal: 0
      };
    }

    const masterItem = menuItems.find(m => m.id === item.menuItemId);
    let itemBasePrice = (masterItem?.isOffer && masterItem.offerPrice && !item.selectedVariant)
      ? masterItem.offerPrice
      : (masterItem ? masterItem.price : item.price);
    if (item.selectedVariant) {
      if (masterItem?.variants) {
        const matched = masterItem.variants.find(v => v.name === item.selectedVariant?.name);
        if (matched) itemBasePrice = matched.price;
        else if (item.selectedVariant.price > 0) itemBasePrice = item.selectedVariant.price;
      } else if (item.selectedVariant.price > 0) {
        itemBasePrice = item.selectedVariant.price;
      }
    }

    let addOnsTotal = 0;
    if (item.selectedAddOns && item.selectedAddOns.length > 0) {
      item.selectedAddOns.forEach(ao => {
        if (ao.price && ao.price > 0) {
          addOnsTotal += ao.price;
        }
      });
    }

    const trustedPrice = itemBasePrice + addOnsTotal;
    if (trustedPrice < 0 || !Number.isFinite(trustedPrice)) {
      return {
        isValid: false,
        error: `Invalid price for item ${item.name}`,
        verifiedSubtotal: 0,
        verifiedDiscountAmount: 0,
        verifiedServiceCharge: 0,
        verifiedVat: 0,
        verifiedGrandTotal: 0
      };
    }

    verifiedSubtotal += trustedPrice * item.quantity;
  }

  // Cap discount between 0 and 100%
  const cleanDiscountPct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const verifiedDiscountAmount = Math.round(((verifiedSubtotal * cleanDiscountPct) / 100) * 100) / 100;
  const taxableAmount = Math.max(0, verifiedSubtotal - verifiedDiscountAmount);

  // Service Charge (Exempt on Takeaway)
  const verifiedServiceCharge = (enableServiceCharge && !isTakeaway)
    ? Math.round(((taxableAmount * Math.max(0, serviceChargePercent)) / 100) * 100) / 100
    : 0;

  // VAT Calculation
  const baseForVat = taxableAmount + verifiedServiceCharge;
  const verifiedVat = enableVat
    ? Math.round(((baseForVat * Math.max(0, vatRatePercent)) / 100) * 100) / 100
    : 0;

  const verifiedGrandTotal = Math.round((baseForVat + verifiedVat) * 100) / 100;

  return {
    isValid: true,
    verifiedSubtotal,
    verifiedDiscountAmount,
    verifiedServiceCharge,
    verifiedVat,
    verifiedGrandTotal
  };
}

// Inventory Stock Depletion Pre-Validation
export interface StockValidationResult {
  hasSufficientStock: boolean;
  shortages: { itemName: string; requiredQty: number; currentStock: number; unit: string }[];
}

export function validateInventoryStock(
  orderItems: OrderItem[],
  menuItems: MenuItem[],
  inventoryItems: InventoryItem[],
  recipes?: ProductRecipe[]
): StockValidationResult {
  const shortages: { itemName: string; requiredQty: number; currentStock: number; unit: string }[] = [];
  const requiredStockMap: Record<string, number> = {};

  for (const item of orderItems) {
    const menuItem = menuItems.find(m => m.id === item.menuItemId);
    const ingredients = resolveOrderItemRecipeIngredients(menuItem, recipes);
    for (const recipe of ingredients) {
      const totalNeeded = recipe.amount * item.quantity;
      requiredStockMap[recipe.inventoryItemId] = (requiredStockMap[recipe.inventoryItemId] || 0) + totalNeeded;
    }
  }

  for (const [invId, requiredQty] of Object.entries(requiredStockMap)) {
    const inv = inventoryItems.find(i => i.id === invId);
    if (inv && inv.currentStock < requiredQty) {
      shortages.push({
        itemName: inv.name,
        requiredQty: Math.round(requiredQty * 100) / 100,
        currentStock: inv.currentStock,
        unit: inv.unit
      });
    }
  }

  return {
    hasSufficientStock: shortages.length === 0,
    shortages
  };
}

// Session Validity Checker
export function isSessionValid(session: Session | null): boolean {
  if (!session || !session.token || !session.role) return false;
  if (Date.now() > session.expiresAt) return false;
  return true;
}

// Payment Settlement Validation (Anti-Tampering / Valid Split Totals)
export type SplitPaymentDetails = {
  cash?: number;
  fonepay?: number;
  card?: number;
  esewa?: number;
  khalti?: number;
  bank?: number;
  qr?: number;
  credit?: number;
  charge_to_room?: number;
};

export function validatePaymentSettlement(
  method: PaymentMethod,
  details: SplitPaymentDetails | number,
  expectedTotal: number,
  customerCreditId?: string,
  roomId?: string
): { isValid: boolean; error?: string } {
  if (typeof details === 'number' && details < 0) {
    return { isValid: false, error: 'Payment amount cannot be negative.' };
  }
  if (expectedTotal <= 0) {
    return { isValid: false, error: 'Total amount must be greater than zero.' };
  }
  if (!Number.isFinite(expectedTotal)) {
    return { isValid: false, error: 'Invalid financial total.' };
  }

  if (method === 'charge_to_room' && !roomId) {
    return { isValid: false, error: 'Room service charge requires an active occupied room.' };
  }

  if (method === 'split' && typeof details === 'object' && details !== null) {
    const channelValues = [
      Number(details.cash) || 0,
      Number(details.fonepay) || 0,
      Number(details.card) || 0,
      Number(details.esewa) || 0,
      Number(details.khalti) || 0,
      Number(details.bank) || 0,
      Number(details.qr) || 0,
      Number(details.credit) || 0,
      Number(details.charge_to_room) || 0
    ];

    if (channelValues.some(val => !Number.isFinite(val) || val < 0)) {
      return { isValid: false, error: 'Split payment amounts cannot be negative.' };
    }

    const sum = Math.round(channelValues.reduce((acc, v) => acc + v, 0) * 100) / 100;
    const target = Math.round(expectedTotal * 100) / 100;
    if (Math.abs(sum - target) > 0.01) {
      return { 
        isValid: false, 
        error: `Split sum (Rs. ${sum.toFixed(2)}) does not match bill total (Rs. ${target.toFixed(2)}).` 
      };
    }
  }
  return { isValid: true };
}

// Room Check-in Validation (Prevents Double Booking)
export function validateRoomCheckIn(
  tableRoom: TableRoom,
  guestName: string
): { isValid: boolean; error?: string } {
  if (!guestName || !guestName.trim()) {
    return { isValid: false, error: 'Guest name is mandatory for room reservation/check-in.' };
  }
  if (tableRoom.status === 'occupied') {
    return { isValid: false, error: `${tableRoom.name} is already occupied. Double-booking is strictly prohibited.` };
  }
  if (tableRoom.status === 'cleaning') {
    return { isValid: false, error: `${tableRoom.name} is currently under housekeeping/cleaning. Please wait until room is ready.` };
  }
  return { isValid: true };
}

// Customer Input Validation
export function validateCustomerInput(
  name: string,
  phone: string,
  initialCredit: number
): { isValid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Customer name is required.' };
  }
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Customer phone number is required.' };
  }
  if (initialCredit < 0 || !Number.isFinite(initialCredit)) {
    return { isValid: false, error: 'Initial credit balance cannot be negative.' };
  }
  return { isValid: true };
}

// Expense Input Validation
export function validateExpense(
  title: string,
  amount: number
): { isValid: boolean; error?: string } {
  if (!title || !title.trim()) {
    return { isValid: false, error: 'Expense description/title is required.' };
  }
  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return { isValid: false, error: 'Expense amount must be a positive number.' };
  }
  return { isValid: true };
}

// Stock Change Input Validation (Prevents Negative Stock)
export function validateStockChange(
  currentStock: number,
  quantityChange: number,
  isDeduction: boolean
): { isValid: boolean; error?: string } {
  if (quantityChange <= 0 || !Number.isFinite(quantityChange)) {
    return { isValid: false, error: 'Quantity must be a positive number.' };
  }
  if (isDeduction && currentStock - quantityChange < 0) {
    return { 
      isValid: false, 
      error: `Insufficient stock! Current stock is ${currentStock}, cannot deduct ${quantityChange}.` 
    };
  }
  return { isValid: true };
}

// Backup JSON Structural Validation (Anti-Malicious Payload Injection)
export function validateBackupJSON(rawJson: unknown): { isValid: boolean; error?: string; cleanState?: AppState } {
  if (!rawJson || typeof rawJson !== 'object') {
    return { isValid: false, error: 'File does not contain a valid JSON object.' };
  }

  const candidate = rawJson as Record<string, any>;

  // Check required core collections
  const requiredArrays = ['menuItems', 'tablesRooms', 'orders', 'inventoryItems', 'customers'];
  for (const key of requiredArrays) {
    if (!Array.isArray(candidate[key])) {
      return { isValid: false, error: `Corrupted backup: missing or invalid array "${key}".` };
    }
  }

  // Check settings object
  if (!candidate.settings || typeof candidate.settings !== 'object') {
    return { isValid: false, error: 'Corrupted backup: missing business settings.' };
  }

  // Sanitize numeric fields to prevent NaN or Infinity injections
  const sanitizedOrders = candidate.orders.filter((o: any) => 
    o && typeof o === 'object' && typeof o.id === 'string' && Number.isFinite(o.grandTotal)
  );

  const sanitizedInventory = candidate.inventoryItems.filter((i: any) => 
    i && typeof i === 'object' && typeof i.id === 'string' && Number.isFinite(i.currentStock)
  );

  // Sanitize staff users (must have pinHash and salt, no plain passwords allowed)
  const sanitizedStaff = Array.isArray(candidate.staffUsers) 
    ? candidate.staffUsers.filter((s: any) => s && typeof s.pinHash === 'string' && typeof s.salt === 'string')
    : [];

  const cleanState: AppState = {
    menuItems: candidate.menuItems,
    tablesRooms: candidate.tablesRooms,
    orders: sanitizedOrders,
    inventoryItems: sanitizedInventory,
    inventoryLogs: Array.isArray(candidate.inventoryLogs) ? candidate.inventoryLogs : [],
    customers: candidate.customers,
    khataTransactions: Array.isArray(candidate.khataTransactions) ? candidate.khataTransactions : [],
    expenses: Array.isArray(candidate.expenses) ? candidate.expenses : [],
    dayClosings: Array.isArray(candidate.dayClosings) ? candidate.dayClosings : [],
    staffUsers: sanitizedStaff,
    auditLogs: Array.isArray(candidate.auditLogs) ? candidate.auditLogs : [],
    settings: candidate.settings,
    activeOrderId: candidate.activeOrderId,
    roomTypes: Array.isArray(candidate.roomTypes) ? candidate.roomTypes : [],
    resortRooms: Array.isArray(candidate.resortRooms) ? candidate.resortRooms : [],
    guestProfiles: Array.isArray(candidate.guestProfiles) ? candidate.guestProfiles : [],
    reservations: Array.isArray(candidate.reservations) ? candidate.reservations : [],
    guestFolioItems: Array.isArray(candidate.guestFolioItems) ? candidate.guestFolioItems : [],
    resortServices: Array.isArray(candidate.resortServices) ? candidate.resortServices : [],
    housekeepingTasks: Array.isArray(candidate.housekeepingTasks) ? candidate.housekeepingTasks : [],
    maintenanceIssues: Array.isArray(candidate.maintenanceIssues) ? candidate.maintenanceIssues : [],
    hotelPayments: Array.isArray(candidate.hotelPayments) ? candidate.hotelPayments : [],
    staffInvitations: Array.isArray(candidate.staffInvitations) ? candidate.staffInvitations : []
  };

  return { isValid: true, cleanState };
}

