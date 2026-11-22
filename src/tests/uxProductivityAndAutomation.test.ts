import './testEnv';
import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getHomeConfigForRole, 
  isTabPermittedForRole 
} from '../services/roleNavigation';
import { 
  getUserPreferences, 
  saveUserPreferences, 
  toggleFavoriteItem 
} from '../services/userPreferences';
import { 
  generateSmartNotifications, 
  getConsolidatedNotifications, 
  getStoredNotifications, 
  saveStoredNotifications,
  AppNotification 
} from '../services/notificationService';
import { AppState, StaffRole, Order, InventoryItem, Reservation } from '../types';
import { getInitialAppState } from '../services/storage';

test('Phase 14: Role-Based Home Screens & Permissions Matrix', () => {
  // Test every single major staff role has its designated home screen
  const ownerConfig = getHomeConfigForRole('OWNER');
  assert.equal(ownerConfig.defaultTab, 'business_admin');

  const adminConfig = getHomeConfigForRole('ADMIN');
  assert.equal(adminConfig.defaultTab, 'business_admin');

  const managerConfig = getHomeConfigForRole('MANAGER');
  assert.equal(managerConfig.defaultTab, 'dashboard');

  const cashierConfig = getHomeConfigForRole('CASHIER');
  assert.equal(cashierConfig.defaultTab, 'pos');

  const waiterConfig = getHomeConfigForRole('WAITER');
  assert.equal(waiterConfig.defaultTab, 'tables_rooms');

  const kitchenConfig = getHomeConfigForRole('KITCHEN');
  assert.equal(kitchenConfig.defaultTab, 'kds');

  const receptionistConfig = getHomeConfigForRole('RECEPTIONIST', ['resort', 'pos']);
  assert.equal(receptionistConfig.defaultTab, 'resort');

  const housekeepingConfig = getHomeConfigForRole('HOUSEKEEPING', ['resort']);
  assert.equal(housekeepingConfig.defaultTab, 'resort');

  const inventoryConfig = getHomeConfigForRole('INVENTORY_STAFF', ['inventory', 'pos']);
  assert.equal(inventoryConfig.defaultTab, 'inventory');

  const accountantConfig = getHomeConfigForRole('ACCOUNTANT');
  assert.equal(accountantConfig.defaultTab, 'day_closing');

  // Strict backend security permission enforcement
  assert.equal(isTabPermittedForRole('pos', 'CASHIER'), true);
  assert.equal(isTabPermittedForRole('business_admin', 'CASHIER'), false);

  assert.equal(isTabPermittedForRole('tables_rooms', 'WAITER'), true);
  assert.equal(isTabPermittedForRole('reports', 'WAITER'), false);
  assert.equal(isTabPermittedForRole('settings', 'WAITER'), false);

  assert.equal(isTabPermittedForRole('kds', 'KITCHEN'), true);
  assert.equal(isTabPermittedForRole('inventory', 'KITCHEN'), true);
  assert.equal(isTabPermittedForRole('day_closing', 'KITCHEN'), false);

  assert.equal(isTabPermittedForRole('inventory', 'INVENTORY_STAFF'), true);
  assert.equal(isTabPermittedForRole('reports', 'INVENTORY_STAFF'), false);

  // Fast-service hospitality workflow tabs: Tables -> Orders -> Kitchen -> Billing
  assert.equal(isTabPermittedForRole('billing', 'CASHIER', ['pos', 'tables_rooms', 'kds']), true);
  assert.equal(isTabPermittedForRole('billing', 'WAITER', ['pos', 'tables_rooms', 'kds']), true);
  assert.equal(isTabPermittedForRole('billing', 'OWNER', ['pos', 'billing']), true);
  assert.equal(isTabPermittedForRole('billing', 'KITCHEN', ['pos', 'billing', 'kds']), false);
  assert.equal(isTabPermittedForRole('billing', 'HOUSEKEEPING', ['resort', 'billing']), false);
});

test('Phase 14: User Personal Preferences Isolation', () => {
  const staffA = 'staff-waiter-101';
  const staffB = 'staff-cashier-202';

  // Initially default
  const prefsA = getUserPreferences(staffA);
  assert.equal(prefsA.soundEnabled, true);
  assert.equal(prefsA.defaultHomeTab, 'auto');
  assert.deepEqual(prefsA.favoriteItemIds, []);

  // Update staff A
  saveUserPreferences({
    ...prefsA,
    soundEnabled: false,
    defaultHomeTab: 'tables_rooms',
    compactMode: true
  });

  // Verify staff A updated
  const updatedA = getUserPreferences(staffA);
  assert.equal(updatedA.soundEnabled, false);
  assert.equal(updatedA.defaultHomeTab, 'tables_rooms');
  assert.equal(updatedA.compactMode, true);

  // Verify staff B was NOT affected (isolation)
  const prefsB = getUserPreferences(staffB);
  assert.equal(prefsB.soundEnabled, true);
  assert.equal(prefsB.defaultHomeTab, 'auto');

  // Toggle favorite items
  toggleFavoriteItem(staffA, 'item-momo-veg');
  const favA = getUserPreferences(staffA);
  assert.ok(favA.favoriteItemIds.includes('item-momo-veg'));

  toggleFavoriteItem(staffA, 'item-momo-veg');
  const unfavA = getUserPreferences(staffA);
  assert.equal(unfavA.favoriteItemIds.includes('item-momo-veg'), false);
});

test('Phase 14: Smart Automation & Automated Alerts Generation', () => {
  const baseState = getInitialAppState();
  const testBizId = 'biz-himalayan-automation-test';

  // 1. Test Low Stock alert triggers
  const stateWithLowStock: AppState = {
    ...baseState,
    inventoryItems: [
      {
        id: 'inv-1',
        name: 'Arabica Coffee Beans',
        nepaliName: 'कफी दाना',
        code: 'CB-01',
        category: 'coffee_tea',
        currentStock: 1.5,
        unit: 'kg',
        minStockAlert: 5.0,
        costPerUnit: 1200,
        lastUpdated: new Date().toISOString()
      }
    ]
  };

  const notifications = generateSmartNotifications(stateWithLowStock, testBizId);
  const stockAlert = notifications.find(n => n.category === 'INVENTORY');
  assert.ok(stockAlert, 'Low stock notification must be automatically generated');
  assert.equal(stockAlert.severity, 'warning');
  assert.equal(stockAlert.targetTab, 'inventory');

  // 2. Test Kitchen Ready alert triggers
  const stateWithReadyOrder: AppState = {
    ...baseState,
    orders: [
      {
        id: 'ord-ready-1',
        invoiceNo: 'INV-101',
        kotNo: 'KOT-05',
        tableRoomId: 'tr-1',
        tableRoomName: 'Table T-1',
        tableRoomType: 'table',
        orderType: 'dine_in',
        items: [],
        subtotal: 500,
        discountPercent: 0,
        discountAmount: 0,
        serviceChargeAmount: 0,
        vatAmount: 0,
        grandTotal: 500,
        paidAmount: 0,
        dueAmount: 500,
        status: 'active',
        kotStatus: 'ready',
        kotSentAt: new Date().toISOString(),
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        createdAt: new Date().toISOString()
      }
    ]
  };

  const kdsNotifications = generateSmartNotifications(stateWithReadyOrder, testBizId);
  const kitchenAlert = kdsNotifications.find(n => n.category === 'KITCHEN' && n.title.includes('Ready to Serve'));
  assert.ok(kitchenAlert, 'Kitchen ready alert must be automatically generated');
  assert.equal(kitchenAlert.severity, 'success');
  assert.equal(kitchenAlert.targetTab, 'kds');
});

test('Phase 14: Multi-Tenant Notifications Scoping & Role-Based Filtering', () => {
  const baseState = getInitialAppState();
  const biz1 = 'tenant-pokhara-cafe';
  const biz2 = 'tenant-kathmandu-rooftop';

  // Save stored notification for Biz 1
  const notification1: AppNotification = {
    id: 'notif-biz1-manual',
    businessId: biz1,
    category: 'FINANCE',
    title: 'Audit completed',
    message: 'Monthly tax return filed',
    timestamp: new Date().toISOString(),
    isRead: false,
    severity: 'info'
  };
  saveStoredNotifications(biz1, [notification1]);

  // Biz 2 must not see Biz 1's notifications
  const biz2Stored = getStoredNotifications(biz2);
  assert.equal(biz2Stored.length, 0, 'Tenant isolation: Biz 2 must have 0 notifications from Biz 1');

  // Role filtering: Waiter should only see KITCHEN notifications, not FINANCE or INVENTORY
  const waiterNotifications = getConsolidatedNotifications(baseState, biz1, 'WAITER');
  waiterNotifications.forEach(n => {
    assert.ok(n.category === 'KITCHEN' || n.category === 'SYSTEM', `Waiter should not receive ${n.category}`);
  });
});

test('Phase 15: Invitation Code Activation & Role-Based Dashboard Routing', async () => {
  const { createStaffInvitation, acceptStaffInvitation } = await import('../services/tenantStorage');
  const bizId = 'biz-invite-role-routing-test';

  // 1. Owner invites a Waiter and a Cashier
  const waiterInvite = createStaffInvitation(
    bizId,
    'Himalayan Breeze Cafe',
    'waiter@breeze.com',
    'WAITER',
    { id: 'owner-1', name: 'Owner' }
  );
  assert.ok(waiterInvite.inviteCode.startsWith('INV-'));
  assert.equal(waiterInvite.role, 'WAITER');

  const cashierInvite = createStaffInvitation(
    bizId,
    'Himalayan Breeze Cafe',
    'cashier@breeze.com',
    'CASHIER',
    { id: 'owner-1', name: 'Owner' }
  );
  assert.equal(cashierInvite.role, 'CASHIER');

  // 2. Waiter accepts invitation via LoginModal flow -> routes to Waiter home (tables_rooms)
  const waiterRes = await acceptStaffInvitation(bizId, waiterInvite.inviteCode, 'sita.waiter', 'Sita Gurung', '4829');
  assert.equal(waiterRes.success, true);
  assert.ok(waiterRes.staffUser);
  assert.equal(waiterRes.staffUser.role, 'WAITER');
  assert.equal(getHomeConfigForRole(waiterRes.staffUser.role, ['pos', 'tables_rooms', 'kds']).defaultTab, 'tables_rooms');
  assert.equal(isTabPermittedForRole('tables_rooms', waiterRes.staffUser.role), true);
  assert.equal(isTabPermittedForRole('business_admin', waiterRes.staffUser.role), false);
  assert.equal(isTabPermittedForRole('settings', waiterRes.staffUser.role), false);

  // 3. Reuse of already-accepted invitation code must fail cleanly
  const replayRes = await acceptStaffInvitation(bizId, waiterInvite.inviteCode, 'hacker', 'Fake User', '9182');
  assert.equal(replayRes.success, false);

  // 4. Cashier accepts invitation -> routes directly to POS Cashier Desk
  const cashierRes = await acceptStaffInvitation(bizId, cashierInvite.inviteCode, 'ram.cashier', 'Ram Thapa', '7391');
  assert.equal(cashierRes.success, true);
  assert.ok(cashierRes.staffUser);
  assert.equal(cashierRes.staffUser.role, 'CASHIER');
  assert.equal(getHomeConfigForRole(cashierRes.staffUser.role, ['pos', 'tables_rooms', 'kds']).defaultTab, 'pos');
  assert.equal(isTabPermittedForRole('pos', cashierRes.staffUser.role), true);
  assert.equal(isTabPermittedForRole('business_admin', cashierRes.staffUser.role), false);
});

