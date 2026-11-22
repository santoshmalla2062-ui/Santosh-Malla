/**
 * Real-Time Synchronization, Safe Offline Resilience & Idempotency Service
 * 
 * Provides:
 * 1. Multi-Tenant Isolated Real-Time BroadcastChannel Event Bus
 * 2. 5-State Connection & Synchronization Engine (online, connecting, offline, sync_pending, sync_failed)
 * 3. Safe Offline Queue (permits local draft orders, blocks sensitive offline financial transactions)
 * 4. Idempotency Key Registry (prevents repeated clicks, network retries & duplicate KOT/invoice generation)
 * 5. Optimistic Concurrency Control (OCC) for concurrent edits & conflict detection
 * 6. Atomic Inventory & Room Double-Booking Race Condition Guard
 */

import { Order, TableRoom, InventoryItem, Reservation, MenuItem } from '../types';

export type SyncConnectionState = 'online' | 'connecting' | 'offline' | 'sync_pending' | 'sync_failed';

export type SyncEventType = 
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'KOT_STATUS_UPDATED'
  | 'TABLE_STATUS_UPDATED'
  | 'PAYMENT_COMPLETED'
  | 'ROOM_STATUS_UPDATED'
  | 'RESERVATION_UPDATED'
  | 'INVENTORY_ADJUSTED'
  | 'OFFLINE_QUEUE_SYNCED'
  | 'CONCURRENT_EDIT_ALERT'
  | 'SYNC_PING';

export interface SyncEvent<T = any> {
  eventId: string;
  businessId: string;
  senderDeviceId: string;
  senderSessionId?: string;
  senderName?: string;
  eventType: SyncEventType;
  timestamp: string;
  version?: number;
  idempotencyKey?: string;
  payload: T;
}

export interface ConnectionStatusInfo {
  state: SyncConnectionState;
  isOnline: boolean;
  isSimulatedOffline: boolean;
  lastSyncTime: string | null;
  pendingQueueCount: number;
  errorMessage?: string;
}

export interface OfflineQueueItem {
  queueId: string;
  businessId: string;
  operationType: 'CREATE_DRAFT_ORDER' | 'UPDATE_ORDER_NOTES' | 'UPDATE_TABLE_DRAFT';
  payload: any;
  createdAt: string;
  attempts: number;
  idempotencyKey: string;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  error?: string;
}

export interface IdempotencyRecord {
  key: string;
  businessId: string;
  actionType: string;
  timestamp: string;
  resultSummary?: string;
  orderId?: string;
  invoiceNo?: string;
}

// In-memory singletons
let currentDeviceId: string | null = null;
let isSimulatedOffline = false;
let lastSyncTimestamp: string | null = null;
let currentSyncState: SyncConnectionState = 'online';
let lastSyncErrorMessage: string | undefined = undefined;

const connectionListeners = new Set<(status: ConnectionStatusInfo) => void>();
const processedEventIds = new Set<string>();

/**
 * Returns a stable unique identifier for the current client device/tab instance
 */
export function getDeviceId(): string {
  if (currentDeviceId) return currentDeviceId;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const existing = window.sessionStorage.getItem('himalayan_device_id');
    if (existing) {
      currentDeviceId = existing;
      return existing;
    }
    const newId = 'dev-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
    try {
      window.sessionStorage.setItem('himalayan_device_id', newId);
    } catch {
      // ignore
    }
    currentDeviceId = newId;
    return newId;
  }
  currentDeviceId = 'dev-node-' + Math.random().toString(36).substring(2, 9);
  return currentDeviceId;
}

/**
 * Check if current runtime is online (accounting for simulated offline testing)
 */
export function isNetworkOnline(): boolean {
  if (isSimulatedOffline) return false;
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Set simulated offline mode for interactive UI and automated test scenarios
 */
export function setSimulatedOffline(offline: boolean, businessId?: string): void {
  isSimulatedOffline = offline;
  computeAndNotifyConnectionStatus(businessId);
}

export function isOfflineSimulated(): boolean {
  return isSimulatedOffline;
}

export function getLastSyncTime(): string | null {
  return lastSyncTimestamp;
}

export function recordSuccessfulSync(): void {
  lastSyncTimestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  lastSyncErrorMessage = undefined;
}

/**
 * Computes current 5-state connection status
 */
export function computeConnectionStatus(businessId?: string): ConnectionStatusInfo {
  const online = isNetworkOnline();
  const queueCount = businessId ? getOfflineQueue(businessId).filter(i => i.status === 'pending' || i.status === 'syncing').length : 0;

  let state: SyncConnectionState = 'online';
  if (!online) {
    state = 'offline';
  } else if (lastSyncErrorMessage) {
    state = 'sync_failed';
  } else if (queueCount > 0) {
    state = 'sync_pending';
  } else {
    state = 'online';
  }

  currentSyncState = state;

  return {
    state,
    isOnline: online,
    isSimulatedOffline,
    lastSyncTime: lastSyncTimestamp,
    pendingQueueCount: queueCount,
    errorMessage: lastSyncErrorMessage
  };
}

export function subscribeConnectionStatus(listener: (status: ConnectionStatusInfo) => void, businessId?: string): () => void {
  connectionListeners.add(listener);
  listener(computeConnectionStatus(businessId));
  return () => {
    connectionListeners.delete(listener);
  };
}

export function notifyConnectionStatusChange(businessId?: string): void {
  computeAndNotifyConnectionStatus(businessId);
}

function computeAndNotifyConnectionStatus(businessId?: string): void {
  const status = computeConnectionStatus(businessId);
  connectionListeners.forEach(listener => {
    try {
      listener(status);
    } catch (err) {
      console.error('Error notifying connection listener:', err);
    }
  });
}

// -------------------------------------------------------------
// Real-Time BroadcastChannel Multi-Tenant Subscription Engine
// -------------------------------------------------------------

const activeChannels = new Map<string, BroadcastChannel>();

/**
 * Obtains or creates a tenant-scoped BroadcastChannel
 */
function getTenantBroadcastChannel(businessId: string): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channelName = `himalayan_sync_${businessId}`;
  let channel = activeChannels.get(channelName);
  if (!channel) {
    channel = new BroadcastChannel(channelName);
    if (typeof (channel as any).unref === 'function') {
      (channel as any).unref();
    }
    activeChannels.set(channelName, channel);
  }
  return channel;
}

export function closeAllTenantChannels(): void {
  activeChannels.forEach(ch => {
    try {
      ch.close();
    } catch {
      // ignore
    }
  });
  activeChannels.clear();
}

/**
 * Broadcasts an event to all authorized subscribers of this business
 */
export function broadcastSyncEvent<T = any>(
  businessId: string,
  eventType: SyncEventType,
  payload: T,
  options: {
    senderSessionId?: string;
    senderName?: string;
    version?: number;
    idempotencyKey?: string;
  } = {}
): SyncEvent<T> {
  const eventId = 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
  const event: SyncEvent<T> = {
    eventId,
    businessId,
    senderDeviceId: getDeviceId(),
    senderSessionId: options.senderSessionId,
    senderName: options.senderName,
    eventType,
    timestamp: new Date().toISOString(),
    version: options.version,
    idempotencyKey: options.idempotencyKey,
    payload
  };

  // Mark our own event as processed so we don't duplicate on self
  processedEventIds.add(eventId);

  const channel = getTenantBroadcastChannel(businessId);
  if (channel) {
    try {
      channel.postMessage(event);
      recordSuccessfulSync();
      notifyConnectionStatusChange(businessId);
    } catch (err) {
      console.warn('[SyncService] Failed to post message to BroadcastChannel:', err);
    }
  }

  return event;
}

/**
 * Subscribes to real-time events strictly scoped to the authorized business tenant.
 * Returns an unsubscription teardown function.
 */
export function subscribeToTenantSync(
  businessId: string,
  onEvent: (event: SyncEvent) => void
): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }

  const channelName = `himalayan_sync_${businessId}`;
  let channel = activeChannels.get(channelName);
  if (!channel) {
    channel = new BroadcastChannel(channelName);
    activeChannels.set(channelName, channel);
  }

  const messageHandler = (ev: MessageEvent) => {
    const raw = ev.data as SyncEvent;
    if (!raw || typeof raw !== 'object') return;

    // 1. STRICT MULTI-TENANT ISOLATION: Reject if businessId does not match
    if (raw.businessId !== businessId) {
      console.warn(`[SyncService Security] Rejected cross-tenant event from "${raw.businessId}" on channel "${businessId}".`);
      return;
    }

    // 2. DUPLICATE DELIVERY PREVENTION: Deduplicate by eventId
    if (processedEventIds.has(raw.eventId)) {
      return;
    }
    processedEventIds.add(raw.eventId);
    if (processedEventIds.size > 2000) {
      // Trim cache to prevent memory leak
      const arr = Array.from(processedEventIds);
      arr.slice(0, 1000).forEach(id => processedEventIds.delete(id));
    }

    // 3. Ignore self-echoed events if from same device ID
    if (raw.senderDeviceId === getDeviceId()) {
      return;
    }

    recordSuccessfulSync();
    notifyConnectionStatusChange(businessId);

    try {
      onEvent(raw);
    } catch (err) {
      console.error(`[SyncService] Error handling event ${raw.eventType}:`, err);
    }
  };

  channel.addEventListener('message', messageHandler);

  return () => {
    if (channel) {
      channel.removeEventListener('message', messageHandler);
      // Clean up channel if no longer needed
      if (activeChannels.get(channelName) === channel) {
        channel.close();
        activeChannels.delete(channelName);
      }
    }
  };
}

// -------------------------------------------------------------
// Safe Offline Queue & Sensitive Operation Protection
// -------------------------------------------------------------

const OFFLINE_QUEUE_PREFIX = 'himalayan_offline_queue_';

/**
 * Retrieves the offline queue for a business
 */
export function getOfflineQueue(businessId: string): OfflineQueueItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_PREFIX + businessId);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves the offline queue for a business
 */
function saveOfflineQueue(businessId: string, queue: OfflineQueueItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(OFFLINE_QUEUE_PREFIX + businessId, JSON.stringify(queue));
    notifyConnectionStatusChange(businessId);
  } catch (err) {
    console.error('Failed to save offline queue:', err);
  }
}

/**
 * Verifies if an operation is safe for offline queuing.
 * Sensitive financial transactions (settlement, refunds, inventory adjustment, room check-in) MUST NOT be executed offline.
 */
export function validateSafeOfflineOperation(
  actionType: 'CREATE_DRAFT_ORDER' | 'SETTLE_PAYMENT' | 'REFUND_PAYMENT' | 'ROOM_CHECKIN' | 'INVENTORY_ADJUSTMENT' | 'UPDATE_ORDER_NOTES'
): { isSafe: boolean; reason?: string } {
  if (actionType === 'SETTLE_PAYMENT') {
    return {
      isSafe: false,
      reason: 'Bill settlement and financial payments cannot be processed offline. Payment reconciliation and fiscal compliance require server confirmation.'
    };
  }
  if (actionType === 'REFUND_PAYMENT') {
    return {
      isSafe: false,
      reason: 'Payment refunds cannot be issued offline. Authoritative database transaction verification is required.'
    };
  }
  if (actionType === 'ROOM_CHECKIN') {
    return {
      isSafe: false,
      reason: 'Room check-in and folio assignment cannot be completed offline to prevent overlapping double-bookings.'
    };
  }
  if (actionType === 'INVENTORY_ADJUSTMENT') {
    return {
      isSafe: false,
      reason: 'Manual stock intake and valuation adjustments cannot be performed offline.'
    };
  }

  // Safe candidates: Draft orders and unsubmitted notes
  return { isSafe: true };
}

/**
 * Enqueues a safe draft operation when operating in offline mode.
 * Rejects sensitive operations immediately.
 */
export function enqueueOfflineDraft(
  businessId: string,
  operationType: OfflineQueueItem['operationType'],
  payload: any,
  idempotencyKey: string
): { success: boolean; queueItem?: OfflineQueueItem; error?: string } {
  // Validate safety
  const safety = validateSafeOfflineOperation(operationType as any);
  if (!safety.isSafe) {
    return { success: false, error: safety.reason };
  }

  const queue = getOfflineQueue(businessId);
  
  // Check if idempotency key already queued
  const existing = queue.find(q => q.idempotencyKey === idempotencyKey);
  if (existing) {
    return { success: true, queueItem: existing };
  }

  const queueItem: OfflineQueueItem = {
    queueId: 'q-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
    businessId,
    operationType,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    idempotencyKey,
    status: 'pending'
  };

  queue.push(queueItem);
  saveOfflineQueue(businessId, queue);

  return { success: true, queueItem };
}

/**
 * Flushes the offline queue once network connectivity is restored.
 */
export function flushOfflineQueue(
  businessId: string,
  applyDraftOrderCallback: (draftOrder: Order) => { success: boolean; error?: string }
): { processedCount: number; errors: string[] } {
  if (!isNetworkOnline()) {
    return { processedCount: 0, errors: ['Cannot flush offline queue while still disconnected.'] };
  }

  const queue = getOfflineQueue(businessId);
  if (queue.length === 0) {
    return { processedCount: 0, errors: [] };
  }

  let processedCount = 0;
  const errors: string[] = [];
  const remainingQueue: OfflineQueueItem[] = [];

  for (const item of queue) {
    if (item.status === 'pending' || item.status === 'failed') {
      try {
        if (item.operationType === 'CREATE_DRAFT_ORDER') {
          const draftOrder = { ...item.payload } as Order;
          // Mark as pending sync to server confirmed
          draftOrder.syncStatus = 'server_confirmed';
          const result = applyDraftOrderCallback(draftOrder);
          if (result.success) {
            processedCount++;
            // Broadcast server confirmed order to other devices
            broadcastSyncEvent(businessId, 'ORDER_CREATED', draftOrder, {
              idempotencyKey: item.idempotencyKey,
              version: (draftOrder.version || 0) + 1
            });
          } else {
            item.status = 'failed';
            item.error = result.error || 'Conflict applying draft order';
            item.attempts++;
            errors.push(item.error);
            remainingQueue.push(item);
          }
        }
      } catch (err: any) {
        item.status = 'failed';
        const errMsg = err?.message || 'Error syncing draft';
        item.error = errMsg;
        item.attempts++;
        errors.push(errMsg);
        remainingQueue.push(item);
      }
    } else {
      remainingQueue.push(item);
    }
  }

  saveOfflineQueue(businessId, remainingQueue);

  if (processedCount > 0) {
    recordSuccessfulSync();
  }
  if (errors.length > 0) {
    lastSyncErrorMessage = errors[0];
  } else {
    lastSyncErrorMessage = undefined;
  }

  notifyConnectionStatusChange(businessId);
  return { processedCount, errors };
}

// -------------------------------------------------------------
// Idempotency Registry & Duplicate Prevention Engine
// -------------------------------------------------------------

const IDEMPOTENCY_PREFIX = 'himalayan_idempotency_';

export function getIdempotencyRegistry(businessId: string): Record<string, IdempotencyRecord> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(IDEMPOTENCY_PREFIX + businessId);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveIdempotencyRegistry(businessId: string, registry: Record<string, IdempotencyRecord>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(IDEMPOTENCY_PREFIX + businessId, JSON.stringify(registry));
  } catch (err) {
    console.error('Failed to save idempotency registry:', err);
  }
}

/**
 * Checks if an operation with the given idempotency key was already executed.
 * If not executed, registers it atomically.
 */
export function checkAndRegisterIdempotencyKey(
  businessId: string,
  key: string,
  actionType: string,
  details?: { orderId?: string; invoiceNo?: string; summary?: string }
): { isDuplicate: boolean; existingRecord?: IdempotencyRecord } {
  if (!key || key.trim() === '') {
    return { isDuplicate: false };
  }

  const registry = getIdempotencyRegistry(businessId);
  const existing = registry[key];

  if (existing) {
    // Key was already executed! Protect against duplicate actions
    return { isDuplicate: true, existingRecord: existing };
  }

  // Register new key
  registry[key] = {
    key,
    businessId,
    actionType,
    timestamp: new Date().toISOString(),
    orderId: details?.orderId,
    invoiceNo: details?.invoiceNo,
    resultSummary: details?.summary
  };

  // Limit registry size to recent 1000 items to conserve storage
  const keys = Object.keys(registry);
  if (keys.length > 1000 && keys[0]) {
    delete registry[keys[0]];
  }

  saveIdempotencyRegistry(businessId, registry);
  return { isDuplicate: false };
}

/**
 * Resolves a phase-scoped idempotency key for order mutations (save/KOT vs settle).
 * Prevents a previously saved draft/KOT idempotencyKey carried on an existing Order
 * from falsely tripping duplicate detection when editing or settling that order later.
 */
export function resolveOrderMutationIdempotencyKey(
  submittedOrder: Pick<Order, 'id' | 'idempotencyKey' | 'updatedAt' | 'settledAt' | 'createdAt'>,
  existingOrder: Pick<Order, 'id' | 'idempotencyKey' | 'version' | 'status'> | undefined,
  shouldSettle: boolean
): string {
  const actionPhase = shouldSettle ? 'settle' : 'save';
  const submittedKey = submittedOrder.idempotencyKey?.trim();

  if (submittedKey) {
    const isReusedExistingKey = Boolean(existingOrder?.idempotencyKey && submittedKey === existingOrder.idempotencyKey);
    const isDraftKeyOnSettlement =
      shouldSettle &&
      existingOrder?.status !== 'completed' &&
      /^idemp-(?:kot|confirm|.*-save)-/i.test(submittedKey);

    if (!isReusedExistingKey && !isDraftKeyOnSettlement) {
      return submittedKey;
    }
  }

  const nextVer = (existingOrder?.version || 0) + 1;
  const ts =
    (shouldSettle ? submittedOrder.settledAt : undefined) ||
    submittedOrder.updatedAt ||
    submittedOrder.createdAt ||
    Date.now();
  return `idemp-${submittedOrder.id}-${actionPhase}-v${nextVer}-${ts}`;
}

// -------------------------------------------------------------
// Optimistic Concurrency Control (OCC) & Conflict Resolution
// -------------------------------------------------------------

export interface ConcurrencyCheckResult<T> {
  isValid: boolean;
  conflictType?: 'STALE_VERSION' | 'INSUFFICIENT_STOCK' | 'OVERLAPPING_RESERVATION';
  message?: string;
  serverVersion?: number;
  submittedVersion?: number;
}

/**
 * Validates version monotonicity for optimistic concurrency control.
 * Prevents silent overwriting when another staff member modified the record.
 */
export function validateOptimisticVersion<T extends { id: string; version?: number; updatedAt?: string }>(
  currentRecord: T | undefined,
  submittedRecord: T
): ConcurrencyCheckResult<T> {
  if (!currentRecord) {
    return { isValid: true };
  }

  const currentVer = currentRecord.version ?? 1;
  const submittedVer = submittedRecord.version ?? 1;

  if (currentVer > submittedVer) {
    return {
      isValid: false,
      conflictType: 'STALE_VERSION',
      serverVersion: currentVer,
      submittedVersion: submittedVer,
      message: `Conflict detected: Record "${submittedRecord.id}" was modified by another user (Server version v${currentVer}, your version v${submittedVer}). Refresh your view before saving.`
    };
  }

  return { isValid: true };
}

/**
 * Pre-validates atomic inventory availability across concurrent orders
 * to prevent two terminals selling the last inventory item simultaneously.
 */
export function validateAtomicStockDeduction(
  orderItems: Order['items'],
  menuItems: MenuItem[],
  currentInventory: InventoryItem[]
): { hasSufficientStock: boolean; conflictedItemNames: string[] } {
  const shortages: string[] = [];

  for (const oItem of orderItems) {
    const menuItem = menuItems.find(m => m.id === oItem.menuItemId);
    if (menuItem?.inventoryRecipe && menuItem.inventoryRecipe.length > 0) {
      for (const recipe of menuItem.inventoryRecipe) {
        const invItem = currentInventory.find(i => i.id === recipe.inventoryItemId);
        if (invItem) {
          const required = recipe.amount * oItem.quantity;
          if (invItem.currentStock < required) {
            shortages.push(`${invItem.name} (Available: ${invItem.currentStock} ${invItem.unit}, Needed: ${required} ${invItem.unit})`);
          }
        }
      }
    }
  }

  return {
    hasSufficientStock: shortages.length === 0,
    conflictedItemNames: shortages
  };
}

/**
 * Pre-validates room reservation concurrency to prevent double-booking
 */
export function validateReservationConcurrency(
  targetRoomId: string,
  checkInDate: string,
  checkOutDate: string,
  existingReservations: Reservation[],
  excludeReservationId?: string
): { hasConflict: boolean; conflictingReservation?: Reservation } {
  const targetCheckIn = new Date(checkInDate).getTime();
  const targetCheckOut = new Date(checkOutDate).getTime();

  for (const res of existingReservations) {
    if (excludeReservationId && res.id === excludeReservationId) continue;
    if (res.roomId !== targetRoomId) continue;
    if (res.status === 'CANCELLED' || res.status === 'CHECKED_OUT') continue;

    const resCheckIn = new Date(res.checkInDate).getTime();
    const resCheckOut = new Date(res.checkOutDate).getTime();

    // Overlapping condition: (StartA < EndB) and (EndA > StartB)
    if (targetCheckIn < resCheckOut && targetCheckOut > resCheckIn) {
      return {
        hasConflict: true,
        conflictingReservation: res
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Clears sensitive session-specific caches upon user logout
 */
export function clearSensitiveCachesOnLogout(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage) {
      window.sessionStorage.removeItem('himalayan_session');
      window.sessionStorage.removeItem('himalayan_device_id');
    }
  } catch (err) {
    console.error('Error clearing session cache:', err);
  }
}
