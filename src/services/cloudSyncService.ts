import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  Unsubscribe,
  where,
  writeBatch
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AppModule,
  AppState,
  AuditLogEntry,
  BusinessSettings,
  BusinessTenant,
  BusinessType,
  CreditNoteRecord,
  JournalEntry,
  Order,
  StaffRole
} from '../types';

export const MAX_SYNC_CHANNEL_BYTES = 550_000;

export const MASTER_OWNER_EMAIL = 'samjhamnamalla22444@gmail.com';
export const APP_CREATOR_EMAIL = MASTER_OWNER_EMAIL;

export type SyncChannelId =
  | 'orders_live'
  | 'menu_tables'
  | 'inventory_ledger'
  | 'finance_records'
  | 'resort_ops'
  | 'admin_controls';

export const ALL_SYNC_CHANNELS: SyncChannelId[] = [
  'orders_live',
  'menu_tables',
  'inventory_ledger',
  'finance_records',
  'resort_ops',
  'admin_controls'
];

export interface CloudWorkspaceMeta {
  businessId: string;
  businessName: string;
  nepaliBusinessName?: string;
  tagline?: string;
  businessType?: BusinessType;
  ownerUid: string;
  ownerEmail: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  enabledModules: AppModule[];
  currencySymbol: string;
  enableVat?: boolean;
  vatRatePercent?: number;
  enableServiceCharge?: boolean;
  serviceChargePercent?: number;
  fonepayMerchantName?: string;
  ownerControlLocked: boolean;
}

export interface CloudStaffInvite {
  inviteId: string;
  businessId: string;
  ownerUid: string;
  email: string;
  staffName: string;
  role: StaffRole;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
}

export interface CloudMemberRecord {
  uid: string;
  businessId: string;
  ownerUid: string;
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  inviteId?: string;
}

export type CloudAccessResolution =
  | {
      status: 'MASTER_OWNER';
      role: 'SUPER_ADMIN' | 'OWNER';
      ownerUid: string;
      email: string;
      name: string;
      ownerControlLocked: boolean;
    }
  | {
      status: 'AUTHORIZED';
      role: StaffRole;
      ownerUid: string;
      email: string;
      name: string;
      isBusinessOwner: boolean;
    }
  | {
      status: 'REVOKED';
      role: StaffRole;
      email: string;
      reason: string;
    }
  | {
      status: 'UNAUTHORIZED';
      email: string;
      reason: string;
    };

export function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && id.length >= 2 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}

export function isMasterOwnerUser(
  user?: { email?: string | null; emailVerified?: boolean | null } | null
): boolean {
  if (!user) return false;
  return Boolean(user.emailVerified && normalizeEmail(user.email) === MASTER_OWNER_EMAIL);
}

export const isAppCreatorUser = isMasterOwnerUser;

/**
 * Determines if the current terminal/user can freely switch to another role
 * without entering the Owner's PIN or signing in as Master Owner.
 */
export function canFreeSwitchRoles(params: {
  currentRole?: StaffRole;
  ownerControlLocked?: boolean;
  isMasterOwnerGoogle?: boolean;
  isBusinessOwnerGoogle?: boolean;
}): boolean {
  if (params.isMasterOwnerGoogle || params.isBusinessOwnerGoogle) {
    return true;
  }
  const locked = params.ownerControlLocked !== false; // strict default: true
  if (locked) {
    return false;
  }
  return (
    params.currentRole === 'OWNER' ||
    params.currentRole === 'ADMIN' ||
    params.currentRole === 'SUPER_ADMIN'
  );
}

/**
 * Determines whether the LoginModal should allow displaying unprivileged demo PIN shortcuts.
 * Never exposes OWNER, ADMIN, or SUPER_ADMIN PINs under any circumstances.
 */
export function getVisibleDemoPinRoles(ownerControlLocked: boolean): { role: StaffRole; pin: string; label: string }[] {
  if (ownerControlLocked) {
    return [];
  }
  return [
    { role: 'MANAGER', pin: '1234', label: 'Manager' },
    { role: 'CASHIER', pin: '2233', label: 'Cashier' },
    { role: 'WAITER', pin: '3344', label: 'Waiter' },
    { role: 'KITCHEN', pin: '4455', label: 'Kitchen' },
    { role: 'HOUSEKEEPING', pin: '6677', label: 'Housekeeping' }
  ];
}

export function canRoleReadChannel(
  role: StaffRole | undefined,
  channelId: SyncChannelId,
  isOwnerOrMaster: boolean
): boolean {
  if (isOwnerOrMaster) return true;
  if (!role) return false;
  switch (channelId) {
    case 'orders_live':
      return ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'RECEPTIONIST', 'STAFF'].includes(role);
    case 'menu_tables':
      return ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'RECEPTIONIST', 'HOUSEKEEPING', 'STAFF'].includes(role);
    case 'inventory_ledger':
      return ['ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_STAFF', 'ACCOUNTANT'].includes(role);
    case 'finance_records':
      return ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'RECEPTIONIST'].includes(role);
    case 'resort_ops':
      return ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'CASHIER'].includes(role);
    case 'admin_controls':
      return false;
    default:
      return false;
  }
}

export function canRoleWriteChannel(
  role: StaffRole | undefined,
  channelId: SyncChannelId,
  isOwnerOrMaster: boolean
): boolean {
  if (isOwnerOrMaster) return true;
  if (!role) return false;
  switch (channelId) {
    case 'orders_live':
      return ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'RECEPTIONIST'].includes(role);
    case 'menu_tables':
      return ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'RECEPTIONIST', 'HOUSEKEEPING'].includes(role);
    case 'inventory_ledger':
      return ['ADMIN', 'MANAGER', 'KITCHEN', 'INVENTORY_STAFF'].includes(role);
    case 'finance_records':
      return ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'RECEPTIONIST'].includes(role);
    case 'resort_ops':
      return ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'].includes(role);
    case 'admin_controls':
      return false;
    default:
      return false;
  }
}

/**
 * Recursively strips `undefined` and non-finite numbers so Firestore writes never fail
 * on JS optional properties while keeping Firestore FieldValue / Timestamp sentinels intact.
 */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    // Preserve Timestamp, Date, FieldValue sentinels (e.g. serverTimestamp())
    return value;
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, val] of Object.entries(value as Record<string, any>)) {
    if (val === undefined) continue;
    cleanObj[key] = sanitizeForFirestore(val);
  }
  return cleanObj as T;
}

function truncateStr(val: string | undefined, maxLen: number): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

const VALID_ORDER_TYPES = new Set(['dine_in', 'takeaway', 'delivery', 'room_service', 'room_stay']);
const VALID_ORDER_STATUSES = new Set(['active', 'completed', 'cancelled']);
const VALID_KOT_STATUSES = new Set([
  'pending',
  'new',
  'accepted',
  'preparing',
  'ready',
  'served',
  'cancelled',
  'sent_to_kitchen',
  'expired'
]);
const VALID_PAYMENT_METHODS = new Set([
  'cash',
  'esewa',
  'khalti',
  'card',
  'bank',
  'qr',
  'fonepay_qr',
  'credit_khata',
  'charge_to_room',
  'split'
]);
const VALID_PAYMENT_STATUSES = new Set(['paid', 'pending', 'credit', 'partial']);

function normalizePaymentMethodForCloud(method: unknown): string {
  const raw = typeof method === 'string' ? method.trim().toLowerCase() : 'cash';
  if (raw === 'bank_transfer') return 'bank';
  if (raw === 'fonepay') return 'fonepay_qr';
  if (raw === 'credit') return 'credit_khata';
  return VALID_PAYMENT_METHODS.has(raw) ? raw : 'cash';
}

function omitNullishKeys(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    out[key] = val;
  }
  return out;
}

const docWriteQueues = new Map<string, Promise<unknown>>();

export async function enqueueSerializedDocWrite<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = docWriteQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  docWriteQueues.set(key, next);
  try {
    return await next;
  } finally {
    if (docWriteQueues.get(key) === next) {
      docWriteQueues.delete(key);
    }
  }
}

/**
 * Deterministic UTF-8 byte estimator safe across browser and Node environments.
 */
export function estimateUtf8ByteSize(value: unknown): number {
  const json = JSON.stringify(value) || '';
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return unescape(encodeURIComponent(json)).length;
}

/**
 * Fits an array within a strict serialized byte ceiling using binary search + tail trimming.
 */
export function fitArrayWithinByteBudget<T>(items: T[], maxBytes: number): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (maxBytes <= 32) return [];
  if (estimateUtf8ByteSize(items) <= maxBytes) return items;

  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const slice = items.slice(0, mid);
    if (estimateUtf8ByteSize(slice) <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return items.slice(0, lo);
}

/**
 * Enforces a hard <550 KB ceiling on any syncChannels payload document by progressively trimming
 * non-critical/historical arrays before writing to Firestore.
 */
function enforceChannelPayloadByteBudget(
  payload: Record<string, any>,
  trimPriorityKeys: string[],
  maxBytes: number = MAX_SYNC_CHANNEL_BYTES
): Record<string, any> {
  if (estimateUtf8ByteSize(payload) <= maxBytes) return payload;
  const mutable: Record<string, any> = { ...payload };

  for (const key of trimPriorityKeys) {
    const current = mutable[key];
    if (!Array.isArray(current) || current.length === 0) continue;
    const overhead = estimateUtf8ByteSize({ ...mutable, [key]: [] });
    const availableForKey = Math.max(0, maxBytes - overhead - 512);
    mutable[key] = fitArrayWithinByteBudget(current, availableForKey);
    if (estimateUtf8ByteSize(mutable) <= maxBytes) {
      return mutable;
    }
  }

  return mutable;
}

function mergeArrayById<T extends { id: string }>(
  existing: T[] = [],
  incoming: T[] = [],
  sortKey?: (item: T) => string
): T[] {
  const byId = new Map<string, T>();
  for (const item of existing) {
    if (item?.id) byId.set(item.id, item);
  }
  for (const item of incoming) {
    if (item?.id) byId.set(item.id, item);
  }
  const merged = Array.from(byId.values());
  if (sortKey) {
    merged.sort((a, b) => (sortKey(b) || '').localeCompare(sortKey(a) || ''));
  }
  return merged;
}

/**
 * Builds a bounded, byte-budgeted blueprint-compliant payload for /syncChannels/{channelId}.data.
 */
export function extractChannelPayload(channelId: SyncChannelId, state: AppState): Record<string, any> {
  switch (channelId) {
    case 'orders_live': {
      // Keep syncChannels/orders_live strictly bounded (<450 KB) to prevent 1 MB Firestore limit errors.
      // Full & historical orders are sharded individually in /businesses/{businessId}/orders/{orderId}.
      const activeOrders = (state.orders || []).filter((o) => o.status === 'active').slice(0, 120);
      const recentArchivedOrders = (state.orders || []).filter((o) => o.status !== 'active').slice(0, 50);

      // Fit active orders first, then allocate remaining byte budget to recent archived window
      const maxOrdersBytes = 420_000;
      const fittedActive = fitArrayWithinByteBudget(activeOrders, maxOrdersBytes);
      const usedBytes = estimateUtf8ByteSize(fittedActive);
      const remainingBudget = Math.max(0, maxOrdersBytes - usedBytes - 512);
      const fittedArchived = fitArrayWithinByteBudget(recentArchivedOrders, remainingBudget);

      return sanitizeForFirestore({
        orders: [...fittedActive, ...fittedArchived],
        activeOrderId: state.activeOrderId || null
      });
    }
    case 'menu_tables': {
      const payload = sanitizeForFirestore({
        menuItems: (state.menuItems || []).slice(0, 400),
        tablesRooms: (state.tablesRooms || []).slice(0, 200)
      });
      return enforceChannelPayloadByteBudget(payload, ['menuItems', 'tablesRooms']);
    }
    case 'inventory_ledger': {
      const payload = sanitizeForFirestore({
        inventoryItems: (state.inventoryItems || []).slice(0, 400),
        inventoryLogs: (state.inventoryLogs || []).slice(0, 150),
        stockMovements: (state.stockMovements || []).slice(0, 150),
        recipes: (state.recipes || []).slice(0, 300),
        suppliers: (state.suppliers || []).slice(0, 150),
        purchaseOrders: (state.purchaseOrders || []).slice(0, 100)
      });
      return enforceChannelPayloadByteBudget(payload, [
        'inventoryLogs',
        'stockMovements',
        'purchaseOrders',
        'recipes',
        'inventoryItems'
      ]);
    }
    case 'finance_records': {
      // Full JournalEntries & CreditNotes are sharded into dedicated subcollections (/journalEntries & /creditNotes);
      // keep only compact recent tails in finance_records and enforce strict < 550 KB ceiling.
      const payload = sanitizeForFirestore({
        customers: (state.customers || []).slice(0, 400),
        khataTransactions: (state.khataTransactions || []).slice(0, 200),
        expenses: (state.expenses || []).slice(0, 200),
        dayClosings: (state.dayClosings || []).slice(0, 100),
        receivables: (state.receivables || []).slice(0, 150),
        supplierPayables: (state.supplierPayables || []).slice(0, 150),
        supplierPayments: (state.supplierPayments || []).slice(0, 150),
        cashRegisters: (state.cashRegisters || []).slice(0, 80),
        accounts: (state.accounts || []).slice(0, 100),
        journalEntries: (state.journalEntries || []).slice(0, 25),
        creditNotes: (state.creditNotes || []).slice(0, 25)
      });
      return enforceChannelPayloadByteBudget(payload, [
        'journalEntries',
        'creditNotes',
        'khataTransactions',
        'supplierPayments',
        'receivables',
        'supplierPayables',
        'expenses',
        'dayClosings',
        'cashRegisters',
        'customers'
      ]);
    }
    case 'resort_ops': {
      const payload = sanitizeForFirestore({
        roomTypes: (state.roomTypes || []).slice(0, 80),
        resortRooms: (state.resortRooms || []).slice(0, 150),
        guestProfiles: (state.guestProfiles || []).slice(0, 250),
        reservations: (state.reservations || []).slice(0, 200),
        guestFolioItems: (state.guestFolioItems || []).slice(0, 250),
        resortServices: (state.resortServices || []).slice(0, 100),
        housekeepingTasks: (state.housekeepingTasks || []).slice(0, 150),
        maintenanceIssues: (state.maintenanceIssues || []).slice(0, 120),
        hotelPayments: (state.hotelPayments || []).slice(0, 200),
        nightAudits: (state.nightAudits || []).slice(0, 60)
      });
      return enforceChannelPayloadByteBudget(payload, [
        'nightAudits',
        'maintenanceIssues',
        'housekeepingTasks',
        'guestFolioItems',
        'hotelPayments',
        'guestProfiles',
        'reservations'
      ]);
    }
    case 'admin_controls': {
      // Full AuditLogs are sharded into /businesses/{businessId}/auditLogs/{logId};
      // keep only recent 30 audit tail + enforce strict byte budget.
      const payload = sanitizeForFirestore({
        settings: state.settings,
        staffUsers: (state.staffUsers || []).slice(0, 150),
        auditLogs: (state.auditLogs || []).slice(0, 30),
        staffInvitations: (state.staffInvitations || []).slice(0, 100)
      });
      return enforceChannelPayloadByteBudget(payload, ['auditLogs', 'staffInvitations']);
    }
  }
}

/**
 * Merges incoming bounded live orders window with existing historical orders without dropping archived history.
 */
export function mergeBoundedOrdersWithExisting(existingOrders: Order[] = [], incomingLiveWindow: Order[] = []): Order[] {
  const byId = new Map<string, Order>();
  const incomingIds = new Set(incomingLiveWindow.map((o) => o.id));

  // Preserve historical non-active orders not present in the bounded live window
  for (const prev of existingOrders) {
    if (prev.status !== 'active' && !incomingIds.has(prev.id)) {
      byId.set(prev.id, prev);
    }
  }
  // Authoritative live window takes precedence for active orders and latest archived orders
  for (const inc of incomingLiveWindow) {
    byId.set(inc.id, inc);
  }

  return Array.from(byId.values()).sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    const tA = new Date(a.settledAt || a.createdAt || 0).getTime();
    const tB = new Date(b.settledAt || b.createdAt || 0).getTime();
    return tB - tA;
  });
}

export function mergeChannelPayloadIntoAppState(
  prev: AppState,
  channelId: SyncChannelId,
  data: Record<string, any>
): AppState {
  if (!data || typeof data !== 'object') return prev;
  switch (channelId) {
    case 'orders_live':
      return {
        ...prev,
        orders: Array.isArray(data.orders) ? mergeBoundedOrdersWithExisting(prev.orders, data.orders) : prev.orders,
        activeOrderId: typeof data.activeOrderId === 'string' ? data.activeOrderId : prev.activeOrderId
      };
    case 'menu_tables':
      return {
        ...prev,
        menuItems: Array.isArray(data.menuItems) ? data.menuItems : prev.menuItems,
        tablesRooms: Array.isArray(data.tablesRooms) ? data.tablesRooms : prev.tablesRooms
      };
    case 'inventory_ledger':
      return {
        ...prev,
        inventoryItems: Array.isArray(data.inventoryItems) ? data.inventoryItems : prev.inventoryItems,
        inventoryLogs: Array.isArray(data.inventoryLogs) ? data.inventoryLogs : prev.inventoryLogs,
        stockMovements: Array.isArray(data.stockMovements) ? data.stockMovements : prev.stockMovements,
        recipes: Array.isArray(data.recipes) ? data.recipes : prev.recipes,
        suppliers: Array.isArray(data.suppliers) ? data.suppliers : prev.suppliers,
        purchaseOrders: Array.isArray(data.purchaseOrders) ? data.purchaseOrders : prev.purchaseOrders
      };
    case 'finance_records':
      return {
        ...prev,
        customers: Array.isArray(data.customers) ? data.customers : prev.customers,
        khataTransactions: Array.isArray(data.khataTransactions) ? data.khataTransactions : prev.khataTransactions,
        expenses: Array.isArray(data.expenses) ? data.expenses : prev.expenses,
        dayClosings: Array.isArray(data.dayClosings) ? data.dayClosings : prev.dayClosings,
        receivables: Array.isArray(data.receivables) ? data.receivables : prev.receivables,
        supplierPayables: Array.isArray(data.supplierPayables) ? data.supplierPayables : prev.supplierPayables,
        supplierPayments: Array.isArray(data.supplierPayments) ? data.supplierPayments : prev.supplierPayments,
        cashRegisters: Array.isArray(data.cashRegisters) ? data.cashRegisters : prev.cashRegisters,
        accounts: Array.isArray(data.accounts) && data.accounts.length > 0 ? data.accounts : prev.accounts,
        // Union merge preserves full subcollection history beyond compact syncChannel tail
        journalEntries: Array.isArray(data.journalEntries)
          ? mergeArrayById(prev.journalEntries || [], data.journalEntries, (j) => j.createdAt || j.date || '')
          : prev.journalEntries,
        creditNotes: Array.isArray(data.creditNotes)
          ? mergeArrayById(prev.creditNotes || [], data.creditNotes, (c) => c.createdAt || '')
          : prev.creditNotes
      };
    case 'resort_ops':
      return {
        ...prev,
        roomTypes: Array.isArray(data.roomTypes) ? data.roomTypes : prev.roomTypes,
        resortRooms: Array.isArray(data.resortRooms) ? data.resortRooms : prev.resortRooms,
        guestProfiles: Array.isArray(data.guestProfiles) ? data.guestProfiles : prev.guestProfiles,
        reservations: Array.isArray(data.reservations) ? data.reservations : prev.reservations,
        guestFolioItems: Array.isArray(data.guestFolioItems) ? data.guestFolioItems : prev.guestFolioItems,
        resortServices: Array.isArray(data.resortServices) ? data.resortServices : prev.resortServices,
        housekeepingTasks: Array.isArray(data.housekeepingTasks) ? data.housekeepingTasks : prev.housekeepingTasks,
        maintenanceIssues: Array.isArray(data.maintenanceIssues) ? data.maintenanceIssues : prev.maintenanceIssues,
        hotelPayments: Array.isArray(data.hotelPayments) ? data.hotelPayments : prev.hotelPayments,
        nightAudits: Array.isArray(data.nightAudits) ? data.nightAudits : prev.nightAudits
      };
    case 'admin_controls':
      return {
        ...prev,
        settings: data.settings && typeof data.settings === 'object' ? { ...prev.settings, ...data.settings } : prev.settings,
        staffUsers: Array.isArray(data.staffUsers) ? data.staffUsers : prev.staffUsers,
        auditLogs: Array.isArray(data.auditLogs)
          ? mergeArrayById(prev.auditLogs || [], data.auditLogs, (a) => a.timestamp || '')
          : prev.auditLogs,
        staffInvitations: Array.isArray(data.staffInvitations) ? data.staffInvitations : prev.staffInvitations
      };
  }
}

export function buildSanitizedOrderDocPayload(
  order: Order,
  businessId: string,
  ownerUid: string,
  createdByUid: string,
  isNew: boolean
): Record<string, any> {
  const safeOrderType =
    typeof order.orderType === 'string' && VALID_ORDER_TYPES.has(order.orderType)
      ? order.orderType
      : 'dine_in';
  const safeStatus =
    typeof order.status === 'string' && VALID_ORDER_STATUSES.has(order.status)
      ? order.status
      : 'active';
  const safePaymentStatus =
    typeof order.paymentStatus === 'string' && VALID_PAYMENT_STATUSES.has(order.paymentStatus)
      ? order.paymentStatus
      : 'pending';
  const safeItems = (Array.isArray(order.items) ? order.items : [])
    .filter((item) => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .slice(0, 100);

  const clean: Record<string, any> = {
    id: order.id,
    businessId,
    ownerUid,
    createdByUid,
    invoiceNo: truncateStr(order.invoiceNo || order.id, 64) || order.id.slice(0, 64),
    orderType: safeOrderType,
    status: safeStatus,
    paymentMethod: normalizePaymentMethodForCloud(order.paymentMethod),
    paymentStatus: safePaymentStatus,
    grandTotal: Math.max(0, Number.isFinite(order.grandTotal) ? order.grandTotal : 0),
    items: sanitizeForFirestore(safeItems),
    updatedAt: serverTimestamp()
  };

  if (isNew) {
    clean.createdAt = serverTimestamp();
  }
  const kotNo = truncateStr(order.kotNo, 64);
  if (kotNo) clean.kotNo = kotNo;
  const tableRoomId = truncateStr(order.tableRoomId, 64);
  if (tableRoomId) clean.tableRoomId = tableRoomId;
  const tableRoomName = truncateStr(order.tableRoomName, 120);
  if (tableRoomName) clean.tableRoomName = tableRoomName;
  if (typeof order.kotStatus === 'string' && VALID_KOT_STATUSES.has(order.kotStatus)) {
    clean.kotStatus = order.kotStatus;
  }
  if (Number.isFinite(order.subtotal)) clean.subtotal = Math.max(0, order.subtotal);
  if (Number.isFinite(order.discountPercent)) {
    clean.discountPercent = Math.min(100, Math.max(0, order.discountPercent));
  }
  if (Number.isFinite(order.discountAmount)) clean.discountAmount = Math.max(0, order.discountAmount);
  if (Number.isFinite(order.serviceChargeAmount)) {
    clean.serviceChargeAmount = Math.max(0, order.serviceChargeAmount);
  }
  if (Number.isFinite(order.vatAmount)) clean.vatAmount = Math.max(0, order.vatAmount);
  if (Number.isFinite(order.paidAmount)) clean.paidAmount = Math.max(0, order.paidAmount);
  if (Number.isFinite(order.dueAmount)) clean.dueAmount = Math.max(0, order.dueAmount);
  if (order.paymentDetails && typeof order.paymentDetails === 'object' && !Array.isArray(order.paymentDetails)) {
    clean.paymentDetails = sanitizeForFirestore(order.paymentDetails);
  }
  if (Number.isFinite(order.cashTendered)) clean.cashTendered = Math.max(0, order.cashTendered!);
  if (Number.isFinite(order.changeReturned)) clean.changeReturned = Math.max(0, order.changeReturned!);
  const paymentReference = truncateStr(order.paymentReference, 120);
  if (paymentReference) clean.paymentReference = paymentReference;
  if (Number.isFinite(order.guestCount)) {
    clean.guestCount = Math.min(200, Math.max(0, Math.round(order.guestCount!)));
  }
  if (order.parentSplitOrderId && isValidFirestoreId(order.parentSplitOrderId)) {
    clean.parentSplitOrderId = order.parentSplitOrderId;
  }
  const cashierName = truncateStr(order.cashierName, 120);
  if (cashierName) clean.cashierName = cashierName;
  const waiterName = truncateStr(order.waiterName, 120);
  if (waiterName) clean.waiterName = waiterName;
  const customerId = truncateStr(order.customerId, 128);
  if (customerId) clean.customerId = customerId;
  const customerName = truncateStr(order.customerName, 120);
  if (customerName) clean.customerName = customerName;
  const customerPhone = truncateStr(order.customerPhone, 40);
  if (customerPhone) clean.customerPhone = customerPhone;
  const specialInstructions = truncateStr(order.specialInstructions, 300);
  if (specialInstructions) clean.specialInstructions = specialInstructions;
  if (typeof order.waivedServiceCharge === 'boolean') clean.waivedServiceCharge = order.waivedServiceCharge;
  if (typeof order.waivedVat === 'boolean') clean.waivedVat = order.waivedVat;
  const settledAt = truncateStr(order.settledAt, 64);
  if (settledAt) clean.settledAt = settledAt;
  const fiscalYear = truncateStr(order.fiscalYear, 20);
  if (fiscalYear) clean.fiscalYear = fiscalYear;
  const bsDate = truncateStr(order.bsDate, 20);
  if (bsDate) clean.bsDate = bsDate;
  const buyerPan = truncateStr(order.buyerPan, 32);
  if (buyerPan) clean.buyerPan = buyerPan;
  if (typeof order.taxInvoicePrinted === 'boolean') clean.taxInvoicePrinted = order.taxInvoicePrinted;
  const creditNoteNo = truncateStr(order.creditNoteNo, 64);
  if (creditNoteNo) clean.creditNoteNo = creditNoteNo;
  if (typeof order.cbmsSynced === 'boolean') clean.cbmsSynced = order.cbmsSynced;

  return omitNullishKeys(sanitizeForFirestore(clean));
}

/**
 * Bootstraps Master Owner (/admins/{uid} & /businesses/{businessId}) safely.
 * Returns the cloud business metadata (read-first so second Owner device never clobbers cloud!).
 */
export async function bootstrapMasterOwnerWorkspace(
  user: User,
  business: BusinessTenant,
  localState: AppState
): Promise<{
  ownerUid: string;
  businessMeta: CloudWorkspaceMeta;
  existingChannels: Partial<Record<SyncChannelId, Record<string, any>>>;
}> {
  if (!user.emailVerified) {
    throw new Error('Google email must be verified before enabling Master Owner cloud control.');
  }

  // 1. Ensure /admins/{uid} exists when Master Owner is authenticated
  if (isMasterOwnerUser(user)) {
    const adminPath = `admins/${user.uid}`;
    const adminRef = doc(db, 'admins', user.uid);
    try {
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          userId: user.uid,
          email: normalizeEmail(user.email),
          role: 'SUPER_ADMIN',
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    }
  }

  // 2. Read existing /businesses/{businessId} FIRST (create only if absent)
  const bizPath = `businesses/${business.businessId}`;
  const bizRef = doc(db, 'businesses', business.businessId);
  let businessMeta: CloudWorkspaceMeta;

  try {
    const bizSnap = await getDoc(bizRef);
    if (bizSnap.exists()) {
      const raw = bizSnap.data();
      businessMeta = {
        businessId: raw.businessId,
        businessName: raw.businessName,
        nepaliBusinessName: raw.nepaliBusinessName,
        tagline: raw.tagline,
        businessType: raw.businessType,
        ownerUid: raw.ownerUid,
        ownerEmail: raw.ownerEmail,
        status: raw.status,
        enabledModules: raw.enabledModules || [],
        currencySymbol: raw.currencySymbol || 'Rs.',
        enableVat: raw.enableVat,
        vatRatePercent: raw.vatRatePercent,
        enableServiceCharge: raw.enableServiceCharge,
        serviceChargePercent: raw.serviceChargePercent,
        fonepayMerchantName: raw.fonepayMerchantName,
        ownerControlLocked: raw.ownerControlLocked !== false
      };
    } else {
      const ownerControlLocked = localState.settings?.securitySettings?.ownerControlLocked !== false;
      const newMeta: Record<string, any> = sanitizeForFirestore({
        businessId: business.businessId,
        businessName: truncateStr(business.businessName || localState.settings.businessName, 160) || 'Himalayan Breeze POS',
        nepaliBusinessName: truncateStr(business.nepaliBusinessName || localState.settings.nepaliBusinessName, 160),
        tagline: truncateStr(business.tagline || localState.settings.tagline, 240),
        businessType: business.businessType || 'CAFE_RESTAURANT_RESORT',
        ownerUid: user.uid,
        ownerEmail: normalizeEmail(user.email),
        status: business.status || 'ACTIVE',
        enabledModules: (business.enabledModules || []).slice(0, 12),
        currencySymbol: truncateStr(localState.settings.currencySymbol || business.currencySymbol || 'Rs.', 10) || 'Rs.',
        enableVat: Boolean(localState.settings.enableVat),
        vatRatePercent: Math.min(50, Math.max(0, Number(localState.settings.vatRatePercent ?? 13))),
        enableServiceCharge: Boolean(localState.settings.enableServiceCharge),
        serviceChargePercent: Math.min(50, Math.max(0, Number(localState.settings.serviceChargePercent ?? 10))),
        fonepayMerchantName: truncateStr(localState.settings.fonepayMerchantName, 120),
        ownerControlLocked,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(bizRef, newMeta);
      businessMeta = {
        businessId: newMeta.businessId,
        businessName: newMeta.businessName,
        nepaliBusinessName: newMeta.nepaliBusinessName,
        tagline: newMeta.tagline,
        businessType: newMeta.businessType,
        ownerUid: user.uid,
        ownerEmail: normalizeEmail(user.email),
        status: newMeta.status,
        enabledModules: newMeta.enabledModules,
        currencySymbol: newMeta.currencySymbol,
        enableVat: newMeta.enableVat,
        vatRatePercent: newMeta.vatRatePercent,
        enableServiceCharge: newMeta.enableServiceCharge,
        serviceChargePercent: newMeta.serviceChargePercent,
        fonepayMerchantName: newMeta.fonepayMerchantName,
        ownerControlLocked
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, bizPath);
  }

  // 3. Read existing syncChannels first; only seed missing channels!
  const existingChannels: Partial<Record<SyncChannelId, Record<string, any>>> = {};
  for (const channelId of ALL_SYNC_CHANNELS) {
    const channelPath = `businesses/${business.businessId}/syncChannels/${channelId}`;
    const channelRef = doc(db, 'businesses', business.businessId, 'syncChannels', channelId);
    try {
      const snap = await getDoc(channelRef);
      if (snap.exists()) {
        const docData = snap.data();
        if (docData?.data && typeof docData.data === 'object') {
          existingChannels[channelId] = docData.data;
        }
      } else {
        const payload = extractChannelPayload(channelId, localState);
        await setDoc(channelRef, {
          channelId,
          businessId: business.businessId,
          ownerUid: businessMeta.ownerUid,
          updatedByUid: user.uid,
          revision: 1,
          data: payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, channelPath);
    }
  }

  return {
    ownerUid: businessMeta.ownerUid,
    businessMeta,
    existingChannels
  };
}

/**
 * Resolves Firebase Cloud access for any signed-in Google user (Master Owner, Business Owner,
 * active member, or claiming an owner-issued PENDING invite atomically).
 */
export async function resolveCloudMemberAccess(
  user: User,
  businessId: string
): Promise<CloudAccessResolution> {
  const email = normalizeEmail(user.email);

  if (!user.emailVerified || !email) {
    return {
      status: 'UNAUTHORIZED',
      email,
      reason: 'Google account email must be verified.'
    };
  }

  if (isMasterOwnerUser(user)) {
    return {
      status: 'MASTER_OWNER',
      role: 'SUPER_ADMIN',
      ownerUid: user.uid,
      email,
      name: user.displayName || 'App Creator',
      ownerControlLocked: true
    };
  }

  // 1. Check existing membership doc first (get allowed strictly for request.auth.uid == memberUid)
  const memberPath = `businesses/${businessId}/members/${user.uid}`;
  const memberRef = doc(db, 'businesses', businessId, 'members', user.uid);
  try {
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const data = memberSnap.data() as CloudMemberRecord;
      if (!data.isActive) {
        return {
          status: 'REVOKED',
          role: data.role,
          email,
          reason: `Device access for ${email} has been revoked by Owner.`
        };
      }
      return {
        status: 'AUTHORIZED',
        role: data.role,
        ownerUid: data.ownerUid,
        email,
        name: data.name || user.displayName || email,
        isBusinessOwner: data.ownerUid === user.uid
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, memberPath);
  }

  // 2. Check owner-issued PENDING invite matching this verified email
  const invitesPath = `businesses/${businessId}/invites`;
  let matchingInvite: CloudStaffInvite | null = null;
  try {
    const invitesQuery = query(
      collection(db, 'businesses', businessId, 'invites'),
      where('email', '==', email)
    );
    const snap = await getDocs(invitesQuery);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as CloudStaffInvite;
      if (data.status === 'PENDING' && !matchingInvite) {
        matchingInvite = data;
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, invitesPath);
  }

  if (!matchingInvite) {
    return {
      status: 'UNAUTHORIZED',
      email,
      reason: `This Gmail (${email}) is not authorized. Ask the Owner (${MASTER_OWNER_EMAIL}) to invite your email from Business Admin.`
    };
  }

  const invite = matchingInvite as CloudStaffInvite;

  // 3. Atomically activate invite + create member record (enforced by Firestore getAfter rule)
  try {
    const batch = writeBatch(db);
    const inviteRef = doc(db, 'businesses', businessId, 'invites', invite.inviteId);
    batch.update(inviteRef, {
      status: 'ACTIVE',
      updatedAt: serverTimestamp()
    });
    batch.set(memberRef, {
      uid: user.uid,
      businessId,
      ownerUid: invite.ownerUid,
      email,
      name: truncateStr(invite.staffName || user.displayName || email, 120) || 'Staff Member',
      role: invite.role,
      isActive: true,
      inviteId: invite.inviteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }

  return {
    status: 'AUTHORIZED',
    role: invite.role,
    ownerUid: invite.ownerUid,
    email,
    name: invite.staffName || user.displayName || email,
    isBusinessOwner: false
  };
}

export async function pushSyncChannelToCloud(params: {
  businessId: string;
  channelId: SyncChannelId;
  ownerUid: string;
  userUid: string;
  revision: number;
  data: Record<string, any>;
}): Promise<void> {
  const channelPath = `businesses/${params.businessId}/syncChannels/${params.channelId}`;
  return enqueueSerializedDocWrite(channelPath, async () => {
    const channelRef = doc(db, 'businesses', params.businessId, 'syncChannels', params.channelId);

    try {
      const cleanData = sanitizeForFirestore(params.data);
      const existingSnap = await getDoc(channelRef);
      if (existingSnap.exists()) {
        await updateDoc(channelRef, {
          data: cleanData,
          revision: Math.max(1, params.revision),
          updatedByUid: params.userUid,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(channelRef, {
          channelId: params.channelId,
          businessId: params.businessId,
          ownerUid: params.ownerUid,
          updatedByUid: params.userUid,
          revision: Math.max(1, params.revision),
          data: cleanData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, channelPath);
    }
  });
}

export async function syncOrderDocumentToCloud(params: {
  order: Order;
  businessId: string;
  ownerUid: string;
  userUid: string;
  effectiveRole: StaffRole;
  isOwnerOrMaster: boolean;
}): Promise<void> {
  if (!isValidFirestoreId(params.order.id) || !isValidFirestoreId(params.businessId)) {
    return;
  }

  const orderPath = `businesses/${params.businessId}/orders/${params.order.id}`;
  return enqueueSerializedDocWrite(orderPath, async () => {
    const orderRef = doc(db, 'businesses', params.businessId, 'orders', params.order.id);

    try {
      const snap = await getDoc(orderRef);
      if (!snap.exists()) {
        const payload = buildSanitizedOrderDocPayload(
          params.order,
          params.businessId,
          params.ownerUid,
          params.userUid,
          true
        );
        await setDoc(orderRef, payload);
        return;
      }

      const existingDoc = snap.data();
      if (!params.isOwnerOrMaster && existingDoc.status !== 'active') {
        // Non-owners cannot mutate completed/cancelled terminal orders in Firestore rules
        return;
      }

      if (params.effectiveRole === 'KITCHEN' && !params.isOwnerOrMaster) {
        const safeKot =
          typeof params.order.kotStatus === 'string' && VALID_KOT_STATUSES.has(params.order.kotStatus)
            ? params.order.kotStatus
            : 'preparing';
        await updateDoc(orderRef, {
          kotStatus: safeKot,
          updatedAt: serverTimestamp()
        });
        return;
      }

      const fullUpdate = buildSanitizedOrderDocPayload(
        params.order,
        params.businessId,
        params.ownerUid,
        params.userUid,
        false
      );
      // Do not resend immutable keys in partial update payload
      delete fullUpdate.id;
      delete fullUpdate.businessId;
      delete fullUpdate.ownerUid;
      delete fullUpdate.createdByUid;
      delete fullUpdate.createdAt;

      if (params.effectiveRole === 'WAITER' && !params.isOwnerOrMaster) {
        const waiterUpdate: Record<string, any> = omitNullishKeys(
          sanitizeForFirestore({
            items: fullUpdate.items,
            subtotal: fullUpdate.subtotal,
            discountAmount: fullUpdate.discountAmount,
            serviceChargeAmount: fullUpdate.serviceChargeAmount,
            vatAmount: fullUpdate.vatAmount,
            grandTotal: fullUpdate.grandTotal,
            paidAmount: fullUpdate.paidAmount,
            dueAmount: fullUpdate.dueAmount,
            paymentMethod: fullUpdate.paymentMethod,
            paymentStatus: fullUpdate.paymentStatus,
            paymentDetails: fullUpdate.paymentDetails,
            cashTendered: fullUpdate.cashTendered,
            changeReturned: fullUpdate.changeReturned,
            paymentReference: fullUpdate.paymentReference,
            cashierName: fullUpdate.cashierName,
            customerId: fullUpdate.customerId,
            customerName: fullUpdate.customerName,
            customerPhone: fullUpdate.customerPhone,
            kotNo: fullUpdate.kotNo,
            kotStatus: fullUpdate.kotStatus,
            specialInstructions: fullUpdate.specialInstructions,
            guestCount: fullUpdate.guestCount,
            tableRoomId: fullUpdate.tableRoomId,
            tableRoomName: fullUpdate.tableRoomName,
            status: fullUpdate.status === 'cancelled' ? existingDoc.status : fullUpdate.status,
            settledAt: fullUpdate.settledAt,
            updatedAt: serverTimestamp()
          })
        );
        await updateDoc(orderRef, waiterUpdate);
        return;
      }

      if (
        (params.effectiveRole === 'CASHIER' || params.effectiveRole === 'RECEPTIONIST') &&
        !params.isOwnerOrMaster
      ) {
        const cashierUpdate: Record<string, any> = omitNullishKeys(
          sanitizeForFirestore({
            items: fullUpdate.items,
            subtotal: fullUpdate.subtotal,
            discountPercent: fullUpdate.discountPercent,
            discountAmount: fullUpdate.discountAmount,
            serviceChargeAmount: fullUpdate.serviceChargeAmount,
            vatAmount: fullUpdate.vatAmount,
            grandTotal: fullUpdate.grandTotal,
            paidAmount: fullUpdate.paidAmount,
            dueAmount: fullUpdate.dueAmount,
            paymentMethod: fullUpdate.paymentMethod,
            paymentStatus: fullUpdate.paymentStatus,
            paymentDetails: fullUpdate.paymentDetails,
            cashTendered: fullUpdate.cashTendered,
            changeReturned: fullUpdate.changeReturned,
            paymentReference: fullUpdate.paymentReference,
            cashierName: fullUpdate.cashierName,
            customerId: fullUpdate.customerId,
            customerName: fullUpdate.customerName,
            customerPhone: fullUpdate.customerPhone,
            kotNo: fullUpdate.kotNo,
            kotStatus: fullUpdate.kotStatus,
            specialInstructions: fullUpdate.specialInstructions,
            guestCount: fullUpdate.guestCount,
            tableRoomId: fullUpdate.tableRoomId,
            tableRoomName: fullUpdate.tableRoomName,
            status: fullUpdate.status === 'cancelled' ? existingDoc.status : fullUpdate.status,
            settledAt: fullUpdate.settledAt,
            updatedAt: serverTimestamp()
          })
        );
        await updateDoc(orderRef, cashierUpdate);
        return;
      }

      if (
        (params.effectiveRole === 'ADMIN' || params.effectiveRole === 'MANAGER') &&
        !params.isOwnerOrMaster
      ) {
        const supervisorUpdate: Record<string, any> = omitNullishKeys(
          sanitizeForFirestore({
            items: fullUpdate.items,
            subtotal: fullUpdate.subtotal,
            discountPercent: fullUpdate.discountPercent,
            discountAmount: fullUpdate.discountAmount,
            serviceChargeAmount: fullUpdate.serviceChargeAmount,
            vatAmount: fullUpdate.vatAmount,
            grandTotal: fullUpdate.grandTotal,
            paidAmount: fullUpdate.paidAmount,
            dueAmount: fullUpdate.dueAmount,
            paymentMethod: fullUpdate.paymentMethod,
            paymentStatus: fullUpdate.paymentStatus,
            paymentDetails: fullUpdate.paymentDetails,
            cashTendered: fullUpdate.cashTendered,
            changeReturned: fullUpdate.changeReturned,
            paymentReference: fullUpdate.paymentReference,
            cashierName: fullUpdate.cashierName,
            customerId: fullUpdate.customerId,
            customerName: fullUpdate.customerName,
            customerPhone: fullUpdate.customerPhone,
            kotNo: fullUpdate.kotNo,
            kotStatus: fullUpdate.kotStatus,
            specialInstructions: fullUpdate.specialInstructions,
            guestCount: fullUpdate.guestCount,
            tableRoomId: fullUpdate.tableRoomId,
            tableRoomName: fullUpdate.tableRoomName,
            status: fullUpdate.status,
            settledAt: fullUpdate.settledAt,
            waivedServiceCharge: fullUpdate.waivedServiceCharge,
            waivedVat: fullUpdate.waivedVat,
            updatedAt: serverTimestamp()
          })
        );
        await updateDoc(orderRef, supervisorUpdate);
        return;
      }

      await updateDoc(orderRef, fullUpdate);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, orderPath);
    }
  });
}

export async function updateCloudBusinessPolicy(params: {
  businessId: string;
  business?: Partial<BusinessTenant>;
  settings?: Partial<BusinessSettings>;
  ownerControlLocked?: boolean;
}): Promise<void> {
  const bizPath = `businesses/${params.businessId}`;
  const bizRef = doc(db, 'businesses', params.businessId);
  try {
    const snap = await getDoc(bizRef);
    if (!snap.exists()) return;

    const patch: Record<string, any> = {
      updatedAt: serverTimestamp()
    };

    if (params.business?.businessName !== undefined) {
      patch.businessName = truncateStr(params.business.businessName, 160) || snap.data().businessName;
    }
    if (params.business?.nepaliBusinessName !== undefined) {
      patch.nepaliBusinessName = truncateStr(params.business.nepaliBusinessName, 160) || '';
    }
    if (params.business?.tagline !== undefined) {
      patch.tagline = truncateStr(params.business.tagline, 240) || '';
    }
    if (params.business?.businessType !== undefined) {
      patch.businessType = params.business.businessType;
    }
    if (params.business?.status !== undefined) {
      patch.status = params.business.status;
    }
    if (params.business?.enabledModules !== undefined) {
      patch.enabledModules = params.business.enabledModules.slice(0, 12);
    }
    if (params.settings?.currencySymbol !== undefined) {
      patch.currencySymbol = truncateStr(params.settings.currencySymbol, 10) || 'Rs.';
    }
    if (params.settings?.enableVat !== undefined) {
      patch.enableVat = Boolean(params.settings.enableVat);
    }
    if (params.settings?.vatRatePercent !== undefined) {
      patch.vatRatePercent = Math.min(50, Math.max(0, Number(params.settings.vatRatePercent)));
    }
    if (params.settings?.enableServiceCharge !== undefined) {
      patch.enableServiceCharge = Boolean(params.settings.enableServiceCharge);
    }
    if (params.settings?.serviceChargePercent !== undefined) {
      patch.serviceChargePercent = Math.min(50, Math.max(0, Number(params.settings.serviceChargePercent)));
    }
    if (params.settings?.fonepayMerchantName !== undefined) {
      patch.fonepayMerchantName = truncateStr(params.settings.fonepayMerchantName, 120) || '';
    }
    if (params.ownerControlLocked !== undefined) {
      patch.ownerControlLocked = Boolean(params.ownerControlLocked);
    }

    await updateDoc(bizRef, sanitizeForFirestore(patch));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, bizPath);
  }
}

/**
 * Lists all registered cloud tenant workspaces from Firestore (/businesses).
 * Permitted strictly when the verified App Creator (samjhamnamalla22444@gmail.com) is signed in.
 */
export async function listAllCloudBusinessesForCreator(): Promise<CloudWorkspaceMeta[]> {
  const path = 'businesses';
  try {
    const snap = await getDocs(collection(db, 'businesses'));
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, any>;
      return {
        businessId: raw.businessId || d.id,
        businessName: raw.businessName || d.id,
        nepaliBusinessName: raw.nepaliBusinessName,
        tagline: raw.tagline,
        businessType: raw.businessType,
        ownerUid: raw.ownerUid || '',
        ownerEmail: raw.ownerEmail || '',
        status: raw.status === 'SUSPENDED' || raw.status === 'INACTIVE' ? raw.status : 'ACTIVE',
        enabledModules: Array.isArray(raw.enabledModules) ? raw.enabledModules : [],
        currencySymbol: raw.currencySymbol || 'Rs.',
        enableVat: raw.enableVat,
        vatRatePercent: raw.vatRatePercent,
        enableServiceCharge: raw.enableServiceCharge,
        serviceChargePercent: raw.serviceChargePercent,
        fonepayMerchantName: raw.fonepayMerchantName,
        ownerControlLocked: raw.ownerControlLocked !== false
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listCloudInvites(businessId: string): Promise<CloudStaffInvite[]> {
  const path = `businesses/${businessId}/invites`;
  try {
    const snap = await getDocs(collection(db, 'businesses', businessId, 'invites'));
    return snap.docs.map((d) => d.data() as CloudStaffInvite);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listCloudMembers(businessId: string): Promise<CloudMemberRecord[]> {
  const path = `businesses/${businessId}/members`;
  try {
    const snap = await getDocs(collection(db, 'businesses', businessId, 'members'));
    return snap.docs.map((d) => d.data() as CloudMemberRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createCloudStaffInvite(params: {
  businessId: string;
  ownerUid: string;
  email: string;
  staffName: string;
  role: StaffRole;
}): Promise<CloudStaffInvite> {
  const cleanEmail = normalizeEmail(params.email);
  if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5 || cleanEmail.length > 128) {
    throw new Error('Please enter a valid employee Gmail address.');
  }
  const cleanName = truncateStr(params.staffName, 120);
  if (!cleanName) {
    throw new Error('Staff member name is required.');
  }
  if (params.role === 'OWNER' || params.role === 'SUPER_ADMIN') {
    throw new Error('Cannot issue OWNER or SUPER_ADMIN invites. Master Owner stays locked to you.');
  }

  const inviteId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `businesses/${params.businessId}/invites/${inviteId}`;
  const docPayload: CloudStaffInvite = {
    inviteId,
    businessId: params.businessId,
    ownerUid: params.ownerUid,
    email: cleanEmail,
    staffName: cleanName,
    role: params.role,
    status: 'PENDING'
  };

  try {
    await setDoc(doc(db, 'businesses', params.businessId, 'invites', inviteId), {
      ...docPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeCloudStaffInvite(businessId: string, inviteId: string): Promise<void> {
  const path = `businesses/${businessId}/invites/${inviteId}`;
  try {
    await updateDoc(doc(db, 'businesses', businessId, 'invites', inviteId), {
      status: 'REVOKED',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCloudMemberAccess(params: {
  businessId: string;
  memberUid: string;
  updates: { isActive?: boolean; role?: StaffRole; name?: string };
}): Promise<void> {
  if (params.updates.role === 'OWNER' || params.updates.role === 'SUPER_ADMIN') {
    throw new Error('Cannot escalate staff member to OWNER role.');
  }
  const path = `businesses/${params.businessId}/members/${params.memberUid}`;
  try {
    const patch: Record<string, any> = { updatedAt: serverTimestamp() };
    if (params.updates.isActive !== undefined) patch.isActive = Boolean(params.updates.isActive);
    if (params.updates.role !== undefined) patch.role = params.updates.role;
    if (params.updates.name !== undefined) {
      patch.name = truncateStr(params.updates.name, 120) || 'Staff';
    }
    await updateDoc(doc(db, 'businesses', params.businessId, 'members', params.memberUid), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Reserves an atomic monotonic sequence number across multi-device cashiers using a Firestore Transaction.
 * Prevents duplicate INV / KOT / CN numbers when two terminals settle bills simultaneously.
 */
export async function reserveAtomicSequenceNumber(params: {
  businessId: string;
  ownerUid: string;
  userUid: string;
  counterType: 'invoice' | 'kot' | 'credit_note';
  prefix: string;
  seedFloorSeq?: number;
  fiscalYear?: string;
}): Promise<string> {
  const { businessId, ownerUid, userUid, counterType, prefix } = params;
  const yearTag = String(new Date().getFullYear());
  const defaultFloor = counterType === 'invoice' ? 1000 : 0;
  const seedFloor = Math.max(defaultFloor, Math.floor(params.seedFloorSeq || 0));

  const formatSeq = (seq: number) => {
    const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
    if (counterType === 'invoice' || counterType === 'credit_note') {
      return `${cleanPrefix}${yearTag}-${String(seq).padStart(4, '0')}`;
    }
    return `${cleanPrefix}${String(seq).padStart(3, '0')}`;
  };

  if (!isValidFirestoreId(businessId) || !userUid || !ownerUid) {
    return formatSeq(seedFloor + 1);
  }

  const counterPath = `businesses/${businessId}/counters/${counterType}`;
  const counterRef = doc(db, 'businesses', businessId, 'counters', counterType);

  try {
    const reservedSeq = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      if (!snap.exists()) {
        const nextSeq = seedFloor + 1;
        tx.set(counterRef, {
          counterId: counterType,
          businessId,
          ownerUid,
          updatedByUid: userUid,
          prefix: prefix.slice(0, 20),
          fiscalYear: params.fiscalYear || yearTag,
          currentSeq: nextSeq,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        return nextSeq;
      }

      const existing = snap.data();
      const prevSeq = Math.max(Number(existing.currentSeq) || 0, seedFloor);
      const nextSeq = prevSeq + 1;
      tx.update(counterRef, {
        currentSeq: nextSeq,
        updatedByUid: userUid,
        updatedAt: serverTimestamp()
      });
      return nextSeq;
    });

    return formatSeq(reservedSeq);
  } catch (error) {
    console.warn(`[AtomicCounter] Transaction fallback for ${counterPath}:`, error);
    return formatSeq(seedFloor + 1);
  }
}

/**
 * Persists an immutable Credit Note into /businesses/{businessId}/creditNotes/{creditNoteId}.
 */
export async function syncCreditNoteToCloud(params: {
  creditNote: CreditNoteRecord;
  businessId: string;
  ownerUid: string;
  userUid: string;
}): Promise<void> {
  const { creditNote, businessId, ownerUid, userUid } = params;
  if (!isValidFirestoreId(creditNote.id) || !isValidFirestoreId(businessId)) return;

  const cnPath = `businesses/${businessId}/creditNotes/${creditNote.id}`;
  return enqueueSerializedDocWrite(cnPath, async () => {
    const cnRef = doc(db, 'businesses', businessId, 'creditNotes', creditNote.id);
    try {
      const snap = await getDoc(cnRef);
      if (snap.exists()) return; // Immutable once created
      await setDoc(cnRef, sanitizeForFirestore({
        creditNoteId: creditNote.id,
        businessId,
        ownerUid,
        createdByUid: userUid,
        creditNoteNo: truncateStr(creditNote.creditNoteNo, 64) || creditNote.id,
        originalOrderId: creditNote.originalOrderId,
        originalInvoiceNo: truncateStr(creditNote.originalInvoiceNo, 64) || creditNote.originalOrderId,
        fiscalYear: truncateStr(creditNote.fiscalYear, 20) || '',
        bsDate: truncateStr(creditNote.bsDate, 20) || '',
        adDate: truncateStr(creditNote.adDate, 20) || '',
        reason: truncateStr(creditNote.reason, 240) || 'Order Returned',
        subtotal: Math.max(0, Number(creditNote.subtotal) || 0),
        discountAmount: Math.max(0, Number(creditNote.discountAmount) || 0),
        serviceChargeAmount: Math.max(0, Number(creditNote.serviceChargeAmount) || 0),
        vatAmount: Math.max(0, Number(creditNote.vatAmount) || 0),
        grandTotal: Math.max(0, Number(creditNote.grandTotal) || 0),
        paymentMethod: truncateStr(String(creditNote.paymentMethod || 'cash'), 32) || 'cash',
        buyerName: truncateStr(creditNote.buyerName, 120) || 'Walk-in Guest',
        buyerPan: truncateStr(creditNote.buyerPan, 32) || '',
        issuedByName: truncateStr(creditNote.issuedByName, 120) || 'Manager',
        items: (creditNote.items || []).slice(0, 100),
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, cnPath);
    }
  });
}

const VALID_JOURNAL_REF_TYPES = new Set([
  'POS_SALE',
  'CREDIT_NOTE',
  'EXPENSE',
  'KHATA_COLLECTION',
  'HOTEL_PAYMENT',
  'OPENING_BALANCE',
  'ADJUSTMENT'
]);

export function buildSanitizedJournalEntryPayload(
  entry: JournalEntry,
  businessId: string,
  ownerUid: string,
  createdByUid: string
): Record<string, any> {
  const safeRefType = VALID_JOURNAL_REF_TYPES.has(entry.referenceType) ? entry.referenceType : 'ADJUSTMENT';
  const safeLines = (Array.isArray(entry.lines) ? entry.lines : [])
    .filter((l) => Boolean(l && typeof l === 'object' && !Array.isArray(l)))
    .slice(0, 30);

  return omitNullishKeys(
    sanitizeForFirestore({
      id: entry.id,
      businessId,
      ownerUid,
      createdByUid,
      entryNumber: truncateStr(entry.entryNumber || entry.id, 40) || 'JE-00001',
      date: truncateStr(entry.date, 32),
      bsDate: truncateStr(entry.bsDate, 20),
      referenceType: safeRefType,
      referenceId: truncateStr(entry.referenceId, 128),
      referenceNo: truncateStr(entry.referenceNo, 64),
      description: truncateStr(entry.description, 240),
      lines: safeLines,
      totalDebit: Math.max(0.01, Number.isFinite(entry.totalDebit) ? entry.totalDebit : 0.01),
      totalCredit: Math.max(0.01, Number.isFinite(entry.totalCredit) ? entry.totalCredit : 0.01),
      createdByName: truncateStr(entry.createdByName, 120) || 'Staff',
      createdAt: serverTimestamp()
    })
  );
}

export async function syncJournalEntryToCloud(params: {
  entry: JournalEntry;
  businessId: string;
  ownerUid: string;
  userUid: string;
}): Promise<void> {
  const { entry, businessId, ownerUid, userUid } = params;
  if (!isValidFirestoreId(entry.id) || !isValidFirestoreId(businessId)) return;
  if ((entry.lines || []).length < 2 || (entry.totalDebit || 0) <= 0) return;

  const jePath = `businesses/${businessId}/journalEntries/${entry.id}`;
  return enqueueSerializedDocWrite(jePath, async () => {
    const jeRef = doc(db, 'businesses', businessId, 'journalEntries', entry.id);
    try {
      const snap = await getDoc(jeRef);
      if (snap.exists()) return; // Immutable double-entry voucher
      await setDoc(jeRef, buildSanitizedJournalEntryPayload(entry, businessId, ownerUid, userUid));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, jePath);
    }
  });
}

const VALID_AUDIT_SEVERITIES = new Set(['INFO', 'WARNING', 'CRITICAL']);

export function buildSanitizedAuditLogPayload(
  log: AuditLogEntry,
  businessId: string,
  ownerUid: string,
  createdByUid: string
): Record<string, any> {
  const safeSeverity = VALID_AUDIT_SEVERITIES.has(log.severity) ? log.severity : 'INFO';
  return omitNullishKeys(
    sanitizeForFirestore({
      id: log.id,
      businessId,
      ownerUid,
      createdByUid,
      staffId: truncateStr(log.staffId || createdByUid, 128) || createdByUid,
      staffName: truncateStr(log.staffName, 120) || 'Staff',
      role: truncateStr(String(log.role || 'STAFF'), 32) || 'STAFF',
      action: truncateStr(log.action || 'EVENT', 80) || 'EVENT',
      targetRecordId: truncateStr(log.targetRecordId, 128),
      details: truncateStr(log.details, 400),
      severity: safeSeverity,
      timestamp: truncateStr(log.timestamp, 32),
      createdAt: serverTimestamp()
    })
  );
}

export async function syncAuditLogToCloud(params: {
  log: AuditLogEntry;
  businessId: string;
  ownerUid: string;
  userUid: string;
}): Promise<void> {
  const { log, businessId, ownerUid, userUid } = params;
  if (!isValidFirestoreId(log.id) || !isValidFirestoreId(businessId)) return;

  const logPath = `businesses/${businessId}/auditLogs/${log.id}`;
  return enqueueSerializedDocWrite(logPath, async () => {
    const logRef = doc(db, 'businesses', businessId, 'auditLogs', log.id);
    try {
      const snap = await getDoc(logRef);
      if (snap.exists()) return;
      await setDoc(logRef, buildSanitizedAuditLogPayload(log, businessId, ownerUid, userUid));
    } catch (error) {
      console.warn(`[CloudSync] Sharded audit log write warning for ${logPath}:`, error);
    }
  });
}

function hydrateOrderDoc(id: string, data: Record<string, any>): Order {
  const orderType = typeof data.orderType === 'string' ? data.orderType : 'dine_in';
  return {
    ...data,
    id: data.id || id,
    tableRoomType:
      data.tableRoomType || (orderType === 'room_service' || orderType === 'room_stay' ? 'room' : 'table'),
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt
  } as Order;
}

/**
 * Fetches older historical orders beyond the real-time live window using cursor pagination.
 */
export async function fetchOlderShardedOrdersPage(params: {
  businessId: string;
  beforeTimestampMs: number;
  pageSize?: number;
}): Promise<{ orders: Order[]; hasMore: boolean; nextCursorMs: number | null }> {
  const pageSize = Math.min(200, Math.max(10, params.pageSize || 100));
  const ordersPath = `businesses/${params.businessId}/orders`;
  try {
    const q = query(
      collection(db, 'businesses', params.businessId, 'orders'),
      orderBy('updatedAt', 'desc'),
      startAfter(Timestamp.fromMillis(params.beforeTimestampMs)),
      limit(pageSize + 1)
    );
    const snap = await getDocs(q);
    const hasMore = snap.docs.length > pageSize;
    const sliced = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const orders = sliced.map((d) => hydrateOrderDoc(d.id, d.data() as Record<string, any>));
    const lastDocData = sliced[sliced.length - 1]?.data();
    const nextCursorMs =
      lastDocData?.updatedAt instanceof Timestamp ? lastDocData.updatedAt.toMillis() : null;
    return { orders, hasMore, nextCursorMs };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ordersPath);
  }
}

/**
 * Idempotently backfills existing orders, credit notes, journal entries, and audit logs
 * into dedicated Firestore subcollections so legacy monolithic channel workspaces split safely.
 */
export async function backfillShardedSubcollections(params: {
  businessId: string;
  ownerUid: string;
  userUid: string;
  effectiveRole: StaffRole;
  isOwnerOrMaster: boolean;
  state: AppState;
  knownCloudOrderIds?: Set<string>;
  knownCloudCreditNoteIds?: Set<string>;
  knownCloudJournalIds?: Set<string>;
  knownCloudAuditIds?: Set<string>;
}): Promise<{ migratedOrders: number; migratedCreditNotes: number; migratedJournals: number; migratedAudits: number }> {
  const { businessId, ownerUid, userUid, effectiveRole, isOwnerOrMaster, state } = params;
  if (!isValidFirestoreId(businessId) || !ownerUid || !userUid) {
    return { migratedOrders: 0, migratedCreditNotes: 0, migratedJournals: 0, migratedAudits: 0 };
  }

  let migratedOrders = 0;
  let migratedCreditNotes = 0;
  let migratedJournals = 0;
  let migratedAudits = 0;

  // 1. Backfill orders not yet confirmed in /orders subcollection (cap 150 per startup pass)
  if (canRoleReadChannel(effectiveRole, 'orders_live', isOwnerOrMaster)) {
    const candidateOrders = (state.orders || []).filter(
      (o) => isValidFirestoreId(o.id) && !params.knownCloudOrderIds?.has(o.id)
    ).slice(0, 150);

    for (const order of candidateOrders) {
      await syncOrderDocumentToCloud({
        order,
        businessId,
        ownerUid,
        userUid,
        effectiveRole,
        isOwnerOrMaster
      });
      params.knownCloudOrderIds?.add(order.id);
      migratedOrders += 1;
    }
  }

  // 2. Backfill Credit Notes & Journal Entries when user can write finance_records
  if (canRoleWriteChannel(effectiveRole, 'finance_records', isOwnerOrMaster)) {
    if (isOwnerOrMaster || effectiveRole === 'ADMIN' || effectiveRole === 'MANAGER') {
      const candidateCns = (state.creditNotes || []).filter(
        (cn) => isValidFirestoreId(cn.id) && !params.knownCloudCreditNoteIds?.has(cn.id)
      ).slice(0, 100);
      for (const cn of candidateCns) {
        await syncCreditNoteToCloud({ creditNote: cn, businessId, ownerUid, userUid });
        params.knownCloudCreditNoteIds?.add(cn.id);
        migratedCreditNotes += 1;
      }
    }

    const candidateJournals = (state.journalEntries || []).filter(
      (je) =>
        isValidFirestoreId(je.id) &&
        !params.knownCloudJournalIds?.has(je.id) &&
        Array.isArray(je.lines) &&
        je.lines.length >= 2 &&
        je.totalDebit > 0
    ).slice(0, 150);
    for (const je of candidateJournals) {
      await syncJournalEntryToCloud({ entry: je, businessId, ownerUid, userUid });
      params.knownCloudJournalIds?.add(je.id);
      migratedJournals += 1;
    }
  }

  // 3. Backfill Audit Logs (recent 100) into /auditLogs subcollection
  const candidateAudits = (state.auditLogs || []).filter(
    (log) => isValidFirestoreId(log.id) && !params.knownCloudAuditIds?.has(log.id)
  ).slice(0, 100);
  for (const log of candidateAudits) {
    await syncAuditLogToCloud({ log, businessId, ownerUid, userUid });
    params.knownCloudAuditIds?.add(log.id);
    migratedAudits += 1;
  }

  return { migratedOrders, migratedCreditNotes, migratedJournals, migratedAudits };
}

export interface CloudSubscriptionsOptions {
  businessId: string;
  userUid: string;
  effectiveRole: StaffRole;
  isOwnerOrMaster: boolean;
  onChannelSnapshot: (channelId: SyncChannelId, data: Record<string, any>, updatedByUid: string, updatedAtMs: number) => void;
  onBusinessMetaSnapshot: (meta: Partial<CloudWorkspaceMeta>) => void;
  onMemberSelfChanged?: (record: CloudMemberRecord | null) => void;
  onShardedOrdersSnapshot?: (orders: Order[], meta?: { oldestTimestampMs: number | null; cloudOrderIds: Set<string> }) => void;
  onShardedCreditNotesSnapshot?: (creditNotes: CreditNoteRecord[]) => void;
  onShardedJournalEntriesSnapshot?: (entries: JournalEntry[]) => void;
  onShardedAuditLogsSnapshot?: (logs: AuditLogEntry[]) => void;
}

export function subscribeToBusinessCloudChannels(opts: CloudSubscriptionsOptions): () => void {
  const unsubscribers: Unsubscribe[] = [];

  // 1. Subscribe to allowed syncChannels
  for (const channelId of ALL_SYNC_CHANNELS) {
    if (!canRoleReadChannel(opts.effectiveRole, channelId, opts.isOwnerOrMaster)) {
      continue;
    }
    const channelPath = `businesses/${opts.businessId}/syncChannels/${channelId}`;
    const channelRef = doc(db, 'businesses', opts.businessId, 'syncChannels', channelId);

    const unsub = onSnapshot(
      channelRef,
      (snap) => {
        if (!snap.exists()) return;
        const docData = snap.data();
        if (!docData?.data || typeof docData.data !== 'object') return;
        const ts = docData.updatedAt instanceof Timestamp ? docData.updatedAt.toMillis() : Date.now();
        opts.onChannelSnapshot(channelId, docData.data, docData.updatedByUid || '', ts);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, channelPath);
      }
    );
    unsubscribers.push(unsub);
  }

  // 2. Subscribe to /businesses/{businessId} metadata (ownerControlLocked, modules, tax rates)
  const bizPath = `businesses/${opts.businessId}`;
  const bizUnsub = onSnapshot(
    doc(db, 'businesses', opts.businessId),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      opts.onBusinessMetaSnapshot({
        businessName: d.businessName,
        nepaliBusinessName: d.nepaliBusinessName,
        tagline: d.tagline,
        businessType: d.businessType,
        status: d.status,
        enabledModules: d.enabledModules,
        currencySymbol: d.currencySymbol,
        enableVat: d.enableVat,
        vatRatePercent: d.vatRatePercent,
        enableServiceCharge: d.enableServiceCharge,
        serviceChargePercent: d.serviceChargePercent,
        fonepayMerchantName: d.fonepayMerchantName,
        ownerControlLocked: d.ownerControlLocked !== false
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, bizPath);
    }
  );
  unsubscribers.push(bizUnsub);

  // 3. Subscribe to sharded /businesses/{businessId}/orders subcollection:
  //    Combine an active floor query (where status == active) + ordered recent window (orderBy updatedAt desc, limit 250)
  //    so all active tables stay live while avoiding arbitrary ID ordering and keeping reads bounded.
  if (opts.onShardedOrdersSnapshot && canRoleReadChannel(opts.effectiveRole, 'orders_live', opts.isOwnerOrMaster)) {
    const ordersPath = `businesses/${opts.businessId}/orders`;
    const activeOrdersMap = new Map<string, Order>();
    const recentOrdersMap = new Map<string, Order>();
    let oldestRecentMs: number | null = null;

    const emitMergedShardedOrders = () => {
      const merged = new Map<string, Order>(recentOrdersMap);
      activeOrdersMap.forEach((ord, id) => merged.set(id, ord));
      if (merged.size === 0) return;
      const list = Array.from(merged.values()).sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        const tA = new Date(a.settledAt || a.createdAt || 0).getTime();
        const tB = new Date(b.settledAt || b.createdAt || 0).getTime();
        return tB - tA;
      });
      opts.onShardedOrdersSnapshot?.(list, {
        oldestTimestampMs: oldestRecentMs,
        cloudOrderIds: new Set(merged.keys())
      });
    };

    const recentQ = query(
      collection(db, 'businesses', opts.businessId, 'orders'),
      orderBy('updatedAt', 'desc'),
      limit(250)
    );
    const recentUnsub = onSnapshot(
      recentQ,
      (snap) => {
        recentOrdersMap.clear();
        let minTs: number | null = null;
        for (const d of snap.docs) {
          const raw = d.data() as Record<string, any>;
          recentOrdersMap.set(d.id, hydrateOrderDoc(d.id, raw));
          if (raw.updatedAt instanceof Timestamp) {
            const ms = raw.updatedAt.toMillis();
            if (minTs === null || ms < minTs) minTs = ms;
          }
        }
        oldestRecentMs = minTs;
        emitMergedShardedOrders();
      },
      (error) => {
        console.warn(`[CloudSync] Sharded recent orders read warning for ${ordersPath}:`, error);
      }
    );
    unsubscribers.push(recentUnsub);

    const activeQ = query(
      collection(db, 'businesses', opts.businessId, 'orders'),
      where('status', '==', 'active'),
      limit(120)
    );
    const activeUnsub = onSnapshot(
      activeQ,
      (snap) => {
        activeOrdersMap.clear();
        for (const d of snap.docs) {
          activeOrdersMap.set(d.id, hydrateOrderDoc(d.id, d.data() as Record<string, any>));
        }
        emitMergedShardedOrders();
      },
      (error) => {
        console.warn(`[CloudSync] Sharded active orders read warning for ${ordersPath}:`, error);
      }
    );
    unsubscribers.push(activeUnsub);
  }

  // 4. Subscribe to /businesses/{businessId}/creditNotes for fiscal IRD register sync
  if (opts.onShardedCreditNotesSnapshot && canRoleReadChannel(opts.effectiveRole, 'finance_records', opts.isOwnerOrMaster)) {
    const cnQ = query(
      collection(db, 'businesses', opts.businessId, 'creditNotes'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const cnUnsub = onSnapshot(
      cnQ,
      (snap) => {
        const notes: CreditNoteRecord[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            id: data.creditNoteId || d.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString())
          } as CreditNoteRecord;
        });
        if (notes.length > 0) {
          opts.onShardedCreditNotesSnapshot?.(notes);
        }
      },
      (error) => {
        console.warn('[CloudSync] Sharded creditNotes read warning:', error);
      }
    );
    unsubscribers.push(cnUnsub);
  }

  // 5. Subscribe to /businesses/{businessId}/journalEntries for Double-Entry General Ledger sync
  if (opts.onShardedJournalEntriesSnapshot && canRoleReadChannel(opts.effectiveRole, 'finance_records', opts.isOwnerOrMaster)) {
    const jeQ = query(
      collection(db, 'businesses', opts.businessId, 'journalEntries'),
      orderBy('createdAt', 'desc'),
      limit(250)
    );
    const jeUnsub = onSnapshot(
      jeQ,
      (snap) => {
        const entries: JournalEntry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            id: data.id || d.id,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString())
          } as JournalEntry;
        });
        if (entries.length > 0) {
          opts.onShardedJournalEntriesSnapshot?.(entries);
        }
      },
      (error) => {
        console.warn('[CloudSync] Sharded journalEntries read warning:', error);
      }
    );
    unsubscribers.push(jeUnsub);
  }

  // 6. Subscribe to /businesses/{businessId}/auditLogs for Admin/Manager/Accountant inspection
  if (
    opts.onShardedAuditLogsSnapshot &&
    (opts.isOwnerOrMaster || ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(opts.effectiveRole))
  ) {
    const auditQ = query(
      collection(db, 'businesses', opts.businessId, 'auditLogs'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const auditUnsub = onSnapshot(
      auditQ,
      (snap) => {
        const logs: AuditLogEntry[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            ...data,
            id: data.id || d.id,
            timestamp:
              data.timestamp ||
              (data.createdAt instanceof Timestamp
                ? data.createdAt.toDate().toISOString().replace('T', ' ').substring(0, 19)
                : '')
          } as AuditLogEntry;
        });
        if (logs.length > 0) {
          opts.onShardedAuditLogsSnapshot?.(logs);
        }
      },
      (error) => {
        console.warn('[CloudSync] Sharded auditLogs read warning:', error);
      }
    );
    unsubscribers.push(auditUnsub);
  }

  // 7. For staff members, watch their own /members/{uid} doc for instant remote revocation / role change
  if (!opts.isOwnerOrMaster && opts.onMemberSelfChanged) {
    const memberPath = `businesses/${opts.businessId}/members/${opts.userUid}`;
    const memUnsub = onSnapshot(
      doc(db, 'businesses', opts.businessId, 'members', opts.userUid),
      (snap) => {
        if (!snap.exists()) {
          opts.onMemberSelfChanged?.(null);
          return;
        }
        opts.onMemberSelfChanged?.(snap.data() as CloudMemberRecord);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, memberPath);
      }
    );
    unsubscribers.push(memUnsub);
  }

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {
        // ignore teardown errors
      }
    });
  };
}
