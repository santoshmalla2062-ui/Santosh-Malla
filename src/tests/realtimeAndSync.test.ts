import './testEnv';
import test from 'node:test';
import assert from 'node:assert/strict';

import { 
  broadcastSyncEvent, 
  subscribeToTenantSync, 
  setSimulatedOffline, 
  isOfflineSimulated,
  isNetworkOnline,
  computeConnectionStatus,
  enqueueOfflineDraft, 
  getOfflineQueue,
  flushOfflineQueue, 
  validateSafeOfflineOperation, 
  checkAndRegisterIdempotencyKey, 
  validateOptimisticVersion, 
  validateAtomicStockDeduction, 
  validateReservationConcurrency, 
  clearSensitiveCachesOnLogout,
  closeAllTenantChannels,
  SyncEvent
} from '../services/syncService';
import { Order, MenuItem, InventoryItem, Reservation } from '../types';

test('Real-Time Sync: Multi-Tenant Scoped Channel Isolation', async () => {
  const tenantA = 'biz-tenant-alpha-' + Date.now();
  const tenantB = 'biz-tenant-beta-' + Date.now();

  let tenantBReceivedCount = 0;
  let tenantAReceivedCount = 0;

  // Subscribe tenant B
  const unsubB = subscribeToTenantSync(tenantB, () => {
    tenantBReceivedCount++;
  });

  // Subscribe tenant A
  const unsubA = subscribeToTenantSync(tenantA, () => {
    tenantAReceivedCount++;
  });

  // Broadcast event on Tenant A
  broadcastSyncEvent(tenantA, 'ORDER_CREATED', {
    orderId: 'ord-alpha-1',
    amount: 500
  });

  // Small delay for microtask event dispatch
  await new Promise(resolve => setTimeout(resolve, 30));

  unsubA();
  unsubB();

  // Tenant B must NEVER receive events from Tenant A
  assert.equal(tenantBReceivedCount, 0, 'Tenant B must receive 0 messages from Tenant A channel');
});

test('Real-Time Sync: Subscription Lifecycle and Clean Unmount', async () => {
  const tenant = 'biz-lifecycle-' + Date.now();
  let received = false;

  const unsubscribe = subscribeToTenantSync(tenant, () => {
    received = true;
  });

  // Unsubscribe immediately
  unsubscribe();

  // Broadcast after unsubscribe
  broadcastSyncEvent(tenant, 'SYNC_PING', { ping: true });
  await new Promise(resolve => setTimeout(resolve, 30));

  assert.equal(received, false, 'Unsubscribed listener must not receive messages');
});

test('Offline Resilience: 5-State Connection Machine Transitions', () => {
  const bizId = 'biz-conn-test-' + Date.now();

  // 1. Initial online
  setSimulatedOffline(false, bizId);
  const status1 = computeConnectionStatus(bizId);
  assert.equal(status1.state, 'online');
  assert.equal(status1.isOnline, true);

  // 2. Simulated offline
  setSimulatedOffline(true, bizId);
  const status2 = computeConnectionStatus(bizId);
  assert.equal(status2.state, 'offline');
  assert.equal(status2.isOnline, false);

  // 3. Queue pending drafts while online
  setSimulatedOffline(false, bizId);
  enqueueOfflineDraft(bizId, 'CREATE_DRAFT_ORDER', { id: 'ord-draft-1' }, 'idemp-test-draft-1');
  const status3 = computeConnectionStatus(bizId);
  assert.equal(status3.state, 'sync_pending');
  assert.equal(status3.pendingQueueCount, 1);

  // Clean up
  setSimulatedOffline(false, bizId);
});

test('Safe Offline Behavior: Draft Orders Queued, Sensitive Transactions Blocked', () => {
  const bizId = 'biz-safe-offline-' + Date.now();

  // 1. Safe draft order is allowed
  const safeOrder = validateSafeOfflineOperation('CREATE_DRAFT_ORDER');
  assert.equal(safeOrder.isSafe, true);

  const draftResult = enqueueOfflineDraft(
    bizId,
    'CREATE_DRAFT_ORDER',
    { id: 'draft-order-101', total: 450 },
    'key-draft-101'
  );
  assert.equal(draftResult.success, true);
  assert.ok(draftResult.queueItem);

  // 2. Sensitive financial payment settlement MUST BE BLOCKED offline
  const paymentCheck = validateSafeOfflineOperation('SETTLE_PAYMENT');
  assert.equal(paymentCheck.isSafe, false);
  assert.ok(paymentCheck.reason?.includes('settlement'));

  // 3. Refund MUST BE BLOCKED offline
  const refundCheck = validateSafeOfflineOperation('REFUND_PAYMENT');
  assert.equal(refundCheck.isSafe, false);

  // 4. Room check-in allocation MUST BE BLOCKED offline
  const checkinCheck = validateSafeOfflineOperation('ROOM_CHECKIN');
  assert.equal(checkinCheck.isSafe, false);

  // 5. Stock manual adjustment MUST BE BLOCKED offline
  const stockCheck = validateSafeOfflineOperation('INVENTORY_ADJUSTMENT');
  assert.equal(stockCheck.isSafe, false);
});

test('Offline Queue Flush: Replay Drafts and Promote to Confirmed on Reconnect', () => {
  const bizId = 'biz-flush-test-' + Date.now();
  setSimulatedOffline(false, bizId);

  const testDraftOrder: Order = {
    id: 'ord-flush-1',
    invoiceNo: 'INV-F1',
    kotNo: 'KOT-F1',
    tableRoomId: 'tr-1',
    tableRoomName: 'Table 1',
    tableRoomType: 'table',
    orderType: 'dine_in',
    items: [],
    subtotal: 200,
    discountPercent: 0,
    discountAmount: 0,
    serviceChargeAmount: 20,
    vatAmount: 28.6,
    grandTotal: 248.6,
    paidAmount: 0,
    dueAmount: 248.6,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    status: 'active',
    syncStatus: 'local_draft',
    createdAt: new Date().toISOString()
  };

  enqueueOfflineDraft(bizId, 'CREATE_DRAFT_ORDER', testDraftOrder, 'idemp-flush-01');
  const queueBefore = getOfflineQueue(bizId);
  assert.equal(queueBefore.length, 1);

  let committedOrder: Order | null = null;
  const flushRes = flushOfflineQueue(bizId, draft => {
    committedOrder = draft;
    return { success: true };
  });

  assert.equal(flushRes.processedCount, 1);
  assert.equal(flushRes.errors.length, 0);
  assert.ok(committedOrder);
  assert.equal((committedOrder as Order).syncStatus, 'server_confirmed');

  const queueAfter = getOfflineQueue(bizId);
  assert.equal(queueAfter.length, 0, 'Processed queue items should be cleared');
});

test('Duplicate Prevention: Idempotency Key Dedup for Repeated Clicks & Retries', () => {
  const bizId = 'biz-idemp-' + Date.now();
  const testKey = 'idem-unique-key-xyz-' + Date.now();

  // First execution
  const first = checkAndRegisterIdempotencyKey(bizId, testKey, 'SETTLE_PAYMENT', {
    orderId: 'ord-100',
    invoiceNo: 'INV-100',
    summary: 'Paid Rs 1200 via Cash'
  });
  assert.equal(first.isDuplicate, false);

  // Repeated click / network retry with same key
  const second = checkAndRegisterIdempotencyKey(bizId, testKey, 'SETTLE_PAYMENT', {
    orderId: 'ord-100',
    invoiceNo: 'INV-100'
  });
  assert.equal(second.isDuplicate, true);
  assert.equal(second.existingRecord?.invoiceNo, 'INV-100');
  assert.equal(second.existingRecord?.resultSummary, 'Paid Rs 1200 via Cash');
});

test('Optimistic Concurrency Control (OCC): Stale Version Conflict Rejection', () => {
  const serverOrder = {
    id: 'ord-version-test',
    version: 3,
    updatedAt: '2026-10-13T10:15:00Z',
    tableRoomId: 'tr-5'
  };

  const staleClientOrder = {
    id: 'ord-version-test',
    version: 2, // Outdated version from another station
    updatedAt: '2026-10-13T10:10:00Z',
    tableRoomId: 'tr-5'
  };

  const check = validateOptimisticVersion(serverOrder, staleClientOrder);
  assert.equal(check.isValid, false);
  assert.equal(check.conflictType, 'STALE_VERSION');
  assert.equal(check.serverVersion, 3);
  assert.equal(check.submittedVersion, 2);
  assert.ok(check.message?.includes('modified by another user'));

  // Fresh edit with matching or higher version
  const freshClientOrder = {
    id: 'ord-version-test',
    version: 3,
    updatedAt: '2026-10-13T10:15:00Z',
    tableRoomId: 'tr-5'
  };
  const freshCheck = validateOptimisticVersion(serverOrder, freshClientOrder);
  assert.equal(freshCheck.isValid, true);
});

test('Concurrent Inventory: Atomic Stock Deduction Race Condition Guard', () => {
  const mockInventory: InventoryItem[] = [
    {
      id: 'inv-espresso-beans',
      code: 'INV-EB1',
      name: 'Organic Himalayan Coffee Beans (kg)',
      nepaliName: 'कफी दाना',
      category: 'coffee_tea',
      currentStock: 0.05, // Only 50g left!
      unit: 'kg',
      minStockAlert: 1,
      costPerUnit: 1200,
      lastUpdated: '2026-10-13'
    }
  ];

  const mockMenu: MenuItem[] = [
    {
      id: 'mi-espresso-dbl',
      code: 'CF-02',
      name: 'Double Espresso Shot',
      nepaliName: 'डबल एस्प्रेसो',
      price: 180,
      costPrice: 60,
      isAvailable: true,
      category: 'coffee',
      inventoryRecipe: [
        { inventoryItemId: 'inv-espresso-beans', amount: 0.02, unit: 'kg' } // 20g per shot
      ]
    }
  ];

  // Terminal A orders 2 shots (needs 40g, available 50g -> OK)
  const orderA = [
    {
      id: 'item-a',
      menuItemId: 'mi-espresso-dbl',
      code: 'CF-02',
      name: 'Double Espresso Shot',
      nepaliName: 'डबल एस्प्रेसो',
      price: 180,
      quantity: 2,
      category: 'coffee' as const
    }
  ];
  const checkA = validateAtomicStockDeduction(orderA, mockMenu, mockInventory);
  assert.equal(checkA.hasSufficientStock, true);

  // Terminal B attempts 4 shots simultaneously (needs 80g > 50g -> REJECT)
  const orderB = [
    {
      id: 'item-b',
      menuItemId: 'mi-espresso-dbl',
      code: 'CF-02',
      name: 'Double Espresso Shot',
      nepaliName: 'डबल एस्प्रेसो',
      price: 180,
      quantity: 4,
      category: 'coffee' as const
    }
  ];
  const checkB = validateAtomicStockDeduction(orderB, mockMenu, mockInventory);
  assert.equal(checkB.hasSufficientStock, false);
  assert.equal(checkB.conflictedItemNames.length, 1);
  assert.ok(checkB.conflictedItemNames[0].includes('Organic Himalayan Coffee Beans'));
});

test('Resort Room Concurrency: Prevent Overlapping Double Bookings', () => {
  const existingReservations: Reservation[] = [
    {
      id: 'res-concurr-1',
      guestId: 'g-101',
      guestName: 'Anil Gurung',
      guestPhone: '9841234567',
      roomId: 'room-suite-201',
      roomNumber: '201',
      roomTypeId: 'suite',
      roomTypeName: 'Executive Suite',
      checkInDate: '2026-10-20',
      checkOutDate: '2026-10-25',
      adults: 2,
      children: 1,
      nightsCount: 5,
      roomRate: 8000,
      discountAmount: 0,
      taxAmount: 0,
      extraCharges: 0,
      totalAmount: 40000,
      depositAmount: 10000,
      paidAmount: 10000,
      remainingAmount: 30000,
      paymentMethod: 'card',
      bookingSource: 'Direct Walk-in',
      status: 'CONFIRMED',
      createdAt: '2026-10-13'
    }
  ];

  // Overlapping request: 2026-10-22 to 2026-10-24
  const conflict = validateReservationConcurrency(
    'room-suite-201',
    '2026-10-22',
    '2026-10-24',
    existingReservations
  );
  assert.equal(conflict.hasConflict, true);
  assert.equal(conflict.conflictingReservation?.id, 'res-concurr-1');

  // Non-overlapping: Starts on check-out date 2026-10-25
  const allowed = validateReservationConcurrency(
    'room-suite-201',
    '2026-10-25',
    '2026-10-28',
    existingReservations
  );
  assert.equal(allowed.hasConflict, false);
});

test('Cache & LocalStorage Security: Logout Teardown and Business Isolation', () => {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem('himalayan_session', 'secret-session-token');
    window.sessionStorage.setItem('himalayan_device_id', 'dev-1234');

    clearSensitiveCachesOnLogout();

    assert.equal(window.sessionStorage.getItem('himalayan_session'), null);
    assert.equal(window.sessionStorage.getItem('himalayan_device_id'), null);
  }
  closeAllTenantChannels();
});
