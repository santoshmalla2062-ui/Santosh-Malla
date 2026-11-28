import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import * as cloudSyncModule from '../services/cloudSyncService';
import {
  ALL_SYNC_CHANNELS,
  isMasterOwnerEmail,
  isMasterOwnerUser,
  isAppCreatorUser,
  redactProtectedEmail,
  canFreeSwitchRoles,
  getVisibleDemoPinRoles,
  isChannelPayloadMeaningful,
  canRoleReadChannel,
  canRoleWriteChannel,
  sanitizeForFirestore,
  extractChannelPayload,
  mergeChannelPayloadIntoAppState,
  buildSanitizedOrderDocPayload,
  enqueueSerializedDocWrite,
  buildCandidateBusinessDiscoveryOrder,
  getWorkspaceAccessDocId,
  DEFAULT_WORKSPACE_CANDIDATES
} from '../services/cloudSyncService';
import { formatFirebaseAuthError } from '../firebase';
import { getInitialAppState } from '../services/storage';
import { upsertSyncedCloudBusinesses, getRegisteredBusinesses, updateBusiness } from '../services/tenantStorage';
import { getCurrentSession, clearSession, hasPermission } from '../services/security';
import { AppState, Order } from '../types';

function makeBaseState(): AppState {
  const base = getInitialAppState();
  return {
    ...base,
    businessId: 'biz-himalayan-breeze',
    menuItems: [
      {
        id: 'mi-seed-1',
        code: 'CF-01',
        name: 'Himalayan Espresso',
        nepaliName: 'एस्प्रेसो',
        category: 'coffee',
        price: 150,
        costPrice: 40,
        isAvailable: true
      }
    ],
    tablesRooms: [
      {
        id: 'tr-seed-1',
        code: 'T-1',
        name: 'Table 1',
        nepaliName: 'टेबल १',
        capacity: 4,
        type: 'table',
        area: 'Main Hall',
        status: 'available'
      }
    ],
    settings: {
      ...base.settings,
      securitySettings: {
        sessionTimeoutMinutes: 60,
        requirePinForDiscounts: true,
        requirePinForVoidOrder: true,
        requirePinForDayClose: true,
        strictTenantDataIsolation: true,
        allowSuperAdminAuditInspect: true,
        ...(base.settings.securitySettings || {}),
        ownerControlLocked: true
      }
    }
  };
}

const TEST_MASTER_OWNER_EMAIL = Buffer.from('c2FtamhhbW5hbWFsbGEyMjQ0NEBnbWFpbC5jb20=', 'base64').toString('utf8');

test('Master Owner Verification: Strictly enforces verified Super Admin via hash without exposing plaintext email', () => {
  assert.strictEqual('MASTER_OWNER_EMAIL' in cloudSyncModule, false, 'Plaintext MASTER_OWNER_EMAIL must not be exported');
  assert.strictEqual('APP_CREATOR_EMAIL' in cloudSyncModule, false, 'Plaintext APP_CREATOR_EMAIL must not be exported');

  assert.strictEqual(
    isMasterOwnerEmail(TEST_MASTER_OWNER_EMAIL),
    true,
    'Exact Master Owner email should pass hash verification'
  );
  assert.strictEqual(
    isMasterOwnerUser({ email: `  ${TEST_MASTER_OWNER_EMAIL.toUpperCase()}  `, emailVerified: true }),
    true,
    'Case-insensitive verified Master Owner email should pass'
  );
  assert.strictEqual(
    isMasterOwnerUser({ email: TEST_MASTER_OWNER_EMAIL, emailVerified: false }),
    false,
    'Unverified Master Owner email must be rejected'
  );
  assert.strictEqual(
    isMasterOwnerUser({ email: 'waiter@gmail.com', emailVerified: true }),
    false,
    'Non-owner verified email must be rejected'
  );
  assert.strictEqual(isMasterOwnerUser(null), false);
  assert.strictEqual(redactProtectedEmail(TEST_MASTER_OWNER_EMAIL, 'Protected'), 'Protected');
  assert.strictEqual(redactProtectedEmail('staff@example.com', 'Protected'), 'staff@example.com');
});

test('Privilege Escalation Defense: Terminal locks role switching and hides Owner/demo PINs', () => {
  clearSession();
  assert.strictEqual(getCurrentSession(), null, 'Fresh terminal must not auto-login without authentication');

  // Strict lock active -> even PIN-logged-in OWNER cannot free-switch without Google Master Owner session
  assert.strictEqual(
    canFreeSwitchRoles({
      currentRole: 'OWNER',
      ownerControlLocked: true,
      isMasterOwnerGoogle: false,
      isBusinessOwnerGoogle: false
    }),
    false
  );

  // Verified Master Owner Google session CAN preview/switch roles seamlessly
  assert.strictEqual(
    canFreeSwitchRoles({
      currentRole: 'OWNER',
      ownerControlLocked: true,
      isMasterOwnerGoogle: true,
      isBusinessOwnerGoogle: false
    }),
    true
  );

  // Waiters & Kitchen never get free role switching even when lock is off or Master Owner Google session exists
  assert.strictEqual(
    canFreeSwitchRoles({
      currentRole: 'WAITER',
      ownerControlLocked: false,
      isMasterOwnerGoogle: false,
      isBusinessOwnerGoogle: false
    }),
    false
  );
  assert.strictEqual(
    canFreeSwitchRoles({
      currentRole: 'WAITER',
      ownerControlLocked: true,
      isMasterOwnerGoogle: true,
      isBusinessOwnerGoogle: false
    }),
    false
  );
  assert.strictEqual(
    canFreeSwitchRoles({
      currentRole: 'CASHIER',
      ownerControlLocked: true,
      isMasterOwnerGoogle: true,
      isBusinessOwnerGoogle: true
    }),
    false
  );

  // Demo PIN shortcuts must never be exposed in either locked or unlocked mode
  assert.deepStrictEqual(getVisibleDemoPinRoles(true), []);
  assert.deepStrictEqual(getVisibleDemoPinRoles(false), []);
});

test('Role Channel Isolation & Waiter/Kitchen RBAC Alignment', () => {
  // Master Owner can read and write all 6 sync channels
  for (const ch of ALL_SYNC_CHANNELS) {
    assert.strictEqual(canRoleReadChannel('OWNER', ch, true), true);
    assert.strictEqual(canRoleWriteChannel('OWNER', ch, true), true);
  }

  // WAITER: can read/write orders_live & menu_tables, DENIED finance_records, inventory_ledger, admin_controls
  assert.strictEqual(canRoleReadChannel('WAITER', 'orders_live', false), true);
  assert.strictEqual(canRoleWriteChannel('WAITER', 'orders_live', false), true);
  assert.strictEqual(canRoleReadChannel('WAITER', 'menu_tables', false), true);
  assert.strictEqual(canRoleReadChannel('WAITER', 'finance_records', false), false);
  assert.strictEqual(canRoleWriteChannel('WAITER', 'finance_records', false), false);
  assert.strictEqual(canRoleReadChannel('WAITER', 'admin_controls', false), false);
  assert.strictEqual(canRoleWriteChannel('WAITER', 'admin_controls', false), false);
  assert.strictEqual(hasPermission('WAITER', 'SETTLE_PAYMENT'), true);

  // KITCHEN: can read/write orders_live & inventory_ledger, read menu_tables, DENIED finance_records & admin_controls
  assert.strictEqual(canRoleReadChannel('KITCHEN', 'orders_live', false), true);
  assert.strictEqual(canRoleWriteChannel('KITCHEN', 'orders_live', false), true);
  assert.strictEqual(canRoleReadChannel('KITCHEN', 'inventory_ledger', false), true);
  assert.strictEqual(canRoleWriteChannel('KITCHEN', 'inventory_ledger', false), true);
  assert.strictEqual(canRoleReadChannel('KITCHEN', 'finance_records', false), false);
  assert.strictEqual(canRoleReadChannel('KITCHEN', 'admin_controls', false), false);
  assert.strictEqual(hasPermission('KITCHEN', 'VIEW_TAB_INVENTORY'), true);
});

test('Firestore Payload Sanitizer & Bounded Order Serialization', () => {
  const dirty = {
    a: 1,
    b: undefined,
    c: NaN,
    d: Infinity,
    nested: { ok: 'yes', dropMe: undefined, badNum: -Infinity },
    arr: [1, undefined, { x: NaN, y: 'clean' }]
  };
  const clean = sanitizeForFirestore(dirty);
  assert.deepStrictEqual(clean, {
    a: 1,
    c: 0,
    d: 0,
    nested: { ok: 'yes', badNum: 0 },
    arr: [1, { x: 0, y: 'clean' }]
  });

  const sampleOrder: Order = {
    id: 'ord-test-001',
    businessId: 'biz-himalayan-breeze',
    invoiceNo: 'INV-1001',
    kotNo: 'KOT-101',
    tableRoomId: 'T-01',
    tableRoomName: 'Table 1',
    tableRoomType: 'table',
    orderType: 'dine_in',
    status: 'active',
    kotStatus: 'sent_to_kitchen',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    subtotal: 500,
    discountPercent: 150, // intentionally out of bounds -> should clamp to 100
    discountAmount: 0,
    serviceChargeAmount: 50,
    vatAmount: 71.5,
    grandTotal: 621.5,
    paidAmount: 0,
    dueAmount: 621.5,
    guestCount: 999, // intentionally > 200 -> should clamp to 200
    items: [
      {
        id: 'oi-1',
        menuItemId: 'm-1',
        code: 'MOMO-01',
        name: 'Steamed Chicken Momo',
        nepaliName: 'बफ/चिकन म:म',
        price: 250,
        quantity: 2,
        category: 'fast_food',
        station: 'main_kitchen',
        kotStatus: 'sent_to_kitchen',
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
      } as any
    ],
    createdAt: new Date().toISOString()
  };

  const newDoc = buildSanitizedOrderDocPayload(sampleOrder, 'biz-himalayan-breeze', 'owner-1', 'staff-1', true);
  assert.strictEqual(newDoc.id, 'ord-test-001');
  assert.strictEqual(newDoc.discountPercent, 100);
  assert.strictEqual(newDoc.guestCount, 200);
  assert.strictEqual('imageUrl' in newDoc.items[0], false, 'Order items must strip inline imageUrl to prevent Firestore bloat');
  assert.ok('createdAt' in newDoc, 'New order doc must include serverTimestamp createdAt');
  assert.ok('updatedAt' in newDoc, 'New order doc must include serverTimestamp updatedAt');

  const updateDoc = buildSanitizedOrderDocPayload(sampleOrder, 'biz-himalayan-breeze', 'owner-1', 'staff-1', false);
  assert.equal('createdAt' in updateDoc, false, 'Order update doc must not resend createdAt');

  // Empty sync channel payloads must be skipped on bootstrap/push to avoid empty Firestore docs
  const emptyState = getInitialAppState();
  assert.strictEqual(
    isChannelPayloadMeaningful('orders_live', extractChannelPayload('orders_live', emptyState)),
    false
  );
  assert.strictEqual(
    isChannelPayloadMeaningful('resort_ops', extractChannelPayload('resort_ops', emptyState)),
    false
  );
  assert.strictEqual(
    isChannelPayloadMeaningful('inventory_ledger', extractChannelPayload('inventory_ledger', emptyState)),
    false
  );
  assert.strictEqual(
    isChannelPayloadMeaningful('menu_tables', extractChannelPayload('menu_tables', makeBaseState())),
    true
  );
});

test('Sync Channel Extraction & Round-Trip State Merge', () => {
  const baseState = makeBaseState();
  const payload = extractChannelPayload('menu_tables', baseState);
  assert.ok(Array.isArray(payload.menuItems) && payload.menuItems.length > 0);
  assert.ok(Array.isArray(payload.tablesRooms) && payload.tablesRooms.length > 0);

  const alteredMenu = [
    ...baseState.menuItems,
    {
      id: 'm-cloud-99',
      code: 'CLD-99',
      name: 'Cloud Butter Tea',
      nepaliName: 'सु चिया',
      category: 'tea' as const,
      price: 120,
      costPrice: 35,
      isAvailable: true
    }
  ];
  const merged = mergeChannelPayloadIntoAppState(baseState, 'menu_tables', {
    menuItems: alteredMenu,
    tablesRooms: baseState.tablesRooms
  });
  assert.strictEqual(merged.menuItems.some((m) => m.id === 'm-cloud-99'), true);

  // Manager can sync paymentMethodsConfig and panVatNumber via finance_records while admin_controls stays blocked
  assert.strictEqual(canRoleWriteChannel('MANAGER', 'finance_records', false), true);
  assert.strictEqual(canRoleWriteChannel('MANAGER', 'admin_controls', false), false);

  const alteredPaymentState: AppState = {
    ...baseState,
    settings: {
      ...baseState.settings,
      panVatNumber: '609876543',
      paymentMethodsConfig: [
        ...(baseState.settings.paymentMethodsConfig || []),
        {
          id: 'pm-ime-pay',
          name: 'IME Pay',
          type: 'custom',
          enabled: true,
          accountDetails: '9800001122'
        }
      ]
    }
  };
  const financePayload = extractChannelPayload('finance_records', alteredPaymentState);
  assert.strictEqual(financePayload.panVatNumber, '609876543');
  assert.ok(Array.isArray(financePayload.paymentMethodsConfig));
  assert.ok(financePayload.paymentMethodsConfig.some((pm: any) => pm.id === 'pm-ime-pay'));

  const mergedFinance = mergeChannelPayloadIntoAppState(baseState, 'finance_records', financePayload);
  assert.strictEqual(mergedFinance.settings.panVatNumber, '609876543');
  assert.ok(mergedFinance.settings.paymentMethodsConfig?.some((pm) => pm.id === 'pm-ime-pay'));
});

test('Order Cloud Sync Hardening: Serializes concurrent order writes & normalizes enums/nulls', async () => {
  const events: string[] = [];
  const docKey = 'businesses/biz-himalayan-breeze/orders/ord-race-test';

  // Two concurrent writes on the same order key must execute strictly in sequence (prevents concurrent setDoc overwriting createdAt)
  const p1 = enqueueSerializedDocWrite(docKey, async () => {
    events.push('write1:start');
    await new Promise((r) => setTimeout(r, 25));
    events.push('write1:end');
  });
  const p2 = enqueueSerializedDocWrite(docKey, async () => {
    events.push('write2:start');
    await new Promise((r) => setTimeout(r, 5));
    events.push('write2:end');
  });
  await Promise.all([p1, p2]);
  assert.deepStrictEqual(events, ['write1:start', 'write1:end', 'write2:start', 'write2:end']);

  // Rejected task must not poison subsequent serialized writes for the same order
  await assert.rejects(
    enqueueSerializedDocWrite(docKey, async () => {
      throw new Error('simulated transient failure');
    }),
    /simulated transient failure/
  );
  const recovered = await enqueueSerializedDocWrite(docKey, async () => 'recovered');
  assert.strictEqual(recovered, 'recovered');

  // Payment method normalization & null-key omission
  const dirtyOrder = {
    id: 'ord-norm-001',
    invoiceNo: 'INV-500',
    kotNo: 'KOT-50',
    tableRoomId: 'T-05',
    tableRoomName: 'Table 5',
    tableRoomType: 'table',
    orderType: 'dine_in',
    items: [null as any, { id: 'oi-1', menuItemId: 'm-1', code: 'C1', name: 'Tea', nepaliName: 'चिया', price: 50, quantity: 1, category: 'tea' }],
    subtotal: 50,
    discountPercent: 0,
    discountAmount: 0,
    serviceChargeAmount: 0,
    vatAmount: 0,
    grandTotal: 50,
    paidAmount: 50,
    dueAmount: 0,
    paymentMethod: 'bank_transfer' as any,
    paymentStatus: 'paid',
    customerPhone: null as any,
    specialInstructions: '   ',
    createdAt: new Date().toISOString(),
    status: 'completed'
  } as Order;

  const payload = buildSanitizedOrderDocPayload(dirtyOrder, 'biz-himalayan-breeze', 'owner-1', 'owner-1', false);
  assert.strictEqual(payload.paymentMethod, 'bank');
  assert.strictEqual(payload.items.length, 1);
  assert.equal('customerPhone' in payload, false, 'Null optional fields must be omitted');
  assert.equal('specialInstructions' in payload, false, 'Blank trimmed optional strings must be omitted');
  assert.equal('createdAt' in payload, false, 'Update payload must not resend createdAt');
});

test('App Creator Sync: SUPER_ADMIN verification, global role switching, and cloud tenant upsert', () => {
  assert.strictEqual(
    isAppCreatorUser({ email: TEST_MASTER_OWNER_EMAIL.toUpperCase(), emailVerified: true }),
    true
  );
  assert.strictEqual(
    isAppCreatorUser({ email: 'clientowner@gmail.com', emailVerified: true }),
    false
  );

  // App Creator logged in as SUPER_ADMIN with Google session can switch/preview any role freely
  assert.strictEqual(
    canFreeSwitchRoles({
      currentRole: 'SUPER_ADMIN',
      ownerControlLocked: true,
      isMasterOwnerGoogle: true,
      isBusinessOwnerGoogle: false
    }),
    true
  );

  // Ensure SUPER_ADMIN has full global channel & management permissions
  for (const ch of ALL_SYNC_CHANNELS) {
    assert.strictEqual(canRoleReadChannel('SUPER_ADMIN', ch, true), true);
    assert.strictEqual(canRoleWriteChannel('SUPER_ADMIN', ch, true), true);
  }
  assert.strictEqual(hasPermission('SUPER_ADMIN', 'MANAGE_ALL_BUSINESSES'), true);
  assert.strictEqual(hasPermission('SUPER_ADMIN', 'SWITCH_ANY_BUSINESS'), true);
  assert.strictEqual(hasPermission('SUPER_ADMIN', 'SUSPEND_ACTIVATE_BUSINESS'), true);
  assert.strictEqual(hasPermission('OWNER', 'MANAGE_ALL_BUSINESSES'), false);

  // Cloud tenant upsert merges new remote tenants & updates existing status/modules without losing local fields
  updateBusiness('biz-himalayan-breeze', {
    phone: '+977 9800000001',
    logo: '/pwa-192x192.png'
  });
  const initialCount = getRegisteredBusinesses().length;
  const mergedAfterFirst = upsertSyncedCloudBusinesses([
    {
      businessId: 'biz-himalayan-breeze',
      businessName: 'Himalayan Breeze Resort Cloud',
      status: 'SUSPENDED',
      enabledModules: ['pos', 'billing', 'settings']
    },
    {
      businessId: 'biz-remote-client-101',
      businessName: 'Everest View Tea House',
      nepaliBusinessName: 'सगरमाथा भ्यू चिया घर',
      businessType: 'CAFE',
      ownerEmail: 'everest@example.com',
      status: 'ACTIVE',
      enabledModules: ['pos', 'billing', 'kds']
    }
  ]);

  assert.strictEqual(mergedAfterFirst.length, initialCount + 1);
  const existingUpdated = mergedAfterFirst.find((b) => b.businessId === 'biz-himalayan-breeze');
  assert.ok(existingUpdated);
  assert.strictEqual(existingUpdated.status, 'SUSPENDED');
  assert.deepStrictEqual(existingUpdated.enabledModules, ['pos', 'billing', 'settings']);
  assert.strictEqual(existingUpdated.phone, '+977 9800000001', 'Local phone must be preserved');
  assert.strictEqual(existingUpdated.logo, '/pwa-192x192.png', 'Local logo must be preserved');

  const insertedCloud = mergedAfterFirst.find((b) => b.businessId === 'biz-remote-client-101');
  assert.ok(insertedCloud);
  assert.strictEqual(insertedCloud.businessName, 'Everest View Tea House');
  assert.strictEqual(insertedCloud.environment, 'production');

  // Re-upserting the same remote ID must NOT create duplicates
  const mergedAgain = upsertSyncedCloudBusinesses([
    {
      businessId: 'biz-remote-client-101',
      businessName: 'Everest View Tea House',
      status: 'ACTIVE'
    }
  ]);
  assert.strictEqual(
    mergedAgain.filter((b) => b.businessId === 'biz-remote-client-101').length,
    1
  );
});

test('Mobile Workspace Discovery & Firebase Auth Error Guidance', () => {
  const docId = getWorkspaceAccessDocId('biz-resort-01', 'inv-abc123');
  assert.strictEqual(docId, 'biz-resort-01__inv-abc123');
  assert.ok(docId.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(docId));

  const longId = getWorkspaceAccessDocId('biz-' + 'x'.repeat(100), 'inv-' + 'y'.repeat(100));
  assert.strictEqual(longId.length, 128);

  const discoveryOrder = buildCandidateBusinessDiscoveryOrder({
    preferredBusinessId: 'biz-himalayan-breeze',
    directoryBusinessIds: ['biz-manager-branch', '../bad-id', 'biz-himalayan-breeze'],
    memberGroupBusinessIds: ['biz-pokhara-lodge', 'biz-manager-branch'],
    inviteGroupBusinessIds: ['biz-invite-extra'],
    localCandidateBusinessIds: ['biz-local-other']
  });

  assert.strictEqual(discoveryOrder[0], 'biz-himalayan-breeze');
  assert.strictEqual(discoveryOrder[1], 'biz-manager-branch');
  assert.ok(discoveryOrder.includes('biz-invite-extra'));
  assert.ok(discoveryOrder.includes('biz-local-other'));
  assert.equal(discoveryOrder.includes('../bad-id'), false);
  for (const defBiz of DEFAULT_WORKSPACE_CANDIDATES) {
    assert.ok(discoveryOrder.includes(defBiz));
  }
  assert.strictEqual(new Set(discoveryOrder).size, discoveryOrder.length, 'Candidates must be deduplicated');

  const domainErrEn = formatFirebaseAuthError({ code: 'auth/unauthorized-domain' }, 'en');
  assert.ok(domainErrEn.includes('Authorized domains'));

  const webViewErrNe = formatFirebaseAuthError({ code: 'auth/operation-not-supported-in-this-environment' }, 'ne');
  assert.ok(webViewErrNe.includes('WebView'));

  const firstTimeEmailEn = formatFirebaseAuthError({ code: 'auth/invalid-credential' }, 'en');
  assert.ok(firstTimeEmailEn.includes('First-Time Email'));

  const alreadyInUseEn = formatFirebaseAuthError({ code: 'auth/email-already-in-use' }, 'en');
  assert.ok(alreadyInUseEn.includes('Sign In') && alreadyInUseEn.includes('Forgot Password'));

  const expiredLinkNe = formatFirebaseAuthError({ code: 'auth/expired-action-code' }, 'ne');
  assert.ok(expiredLinkNe.length > 10);
});


