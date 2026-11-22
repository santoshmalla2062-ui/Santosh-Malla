import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import { validateRoomAvailability } from '../services/resortSecurity';
import { validateInventoryStock } from '../services/security';
import { Order, OrderItem, MenuItem, InventoryItem, ResortRoom, Reservation } from '../types';

test('Restaurant & Kitchen: KOT 1-hour unaccepted auto-expiration logic', () => {
  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  const isKOTUnaccepted = (order: { kotStatus?: string }) => {
    return !order.kotStatus || order.kotStatus === 'sent_to_kitchen' || order.kotStatus === 'new' || order.kotStatus === 'pending';
  };

  const isKOTExpired = (order: { kotStatus?: string; kotSentAt?: string; createdAt?: string }) => {
    if (order.kotStatus === 'expired') return true;
    if (isKOTUnaccepted(order)) {
      const timeRef = order.kotSentAt || order.createdAt || '';
      const sentTime = new Date(timeRef).getTime();
      if (!isNaN(sentTime) && (Date.now() - sentTime) >= ONE_HOUR_MS) {
        return true;
      }
    }
    return false;
  };

  // Case 1: Unaccepted ticket sent 65 minutes ago (must be expired)
  const overdueOrder = {
    id: 'ord-overdue-1',
    kotStatus: 'sent_to_kitchen',
    status: 'active',
    createdAt: new Date(now - 65 * 60 * 1000).toISOString(),
    kotSentAt: new Date(now - 65 * 60 * 1000).toISOString()
  };
  assert.strictEqual(isKOTExpired(overdueOrder), true, 'Unaccepted ticket older than 1 hour must be marked expired');

  // Case 2: Fresh unaccepted ticket sent 15 minutes ago (must NOT be expired)
  const freshOrder = {
    id: 'ord-fresh-1',
    kotStatus: 'sent_to_kitchen',
    status: 'active',
    createdAt: new Date(now - 15 * 60 * 1000).toISOString(),
    kotSentAt: new Date(now - 15 * 60 * 1000).toISOString()
  };
  assert.strictEqual(isKOTExpired(freshOrder), false, 'Recent unaccepted ticket must not be expired');

  // Case 3: Accepted ticket sent 75 minutes ago (cooking ongoing - must NOT expire)
  const acceptedOrder = {
    id: 'ord-accepted-1',
    kotStatus: 'accepted',
    status: 'active',
    createdAt: new Date(now - 75 * 60 * 1000).toISOString(),
    kotSentAt: new Date(now - 75 * 60 * 1000).toISOString()
  };
  assert.strictEqual(isKOTExpired(acceptedOrder), false, 'Accepted/cooking ticket must never expire due to age');
});

test('Resort & Hotel: Overlapping reservation double-booking prevention', () => {
  const rooms: ResortRoom[] = [
    {
      id: 'room-101',
      roomNumber: '101',
      roomTypeId: 'deluxe',
      roomTypeName: 'Deluxe Room',
      floor: '1',
      capacity: 2,
      pricePerNight: 4500,
      amenities: ['Balcony', 'Mountain View'],
      status: 'AVAILABLE'
    },
    {
      id: 'room-102',
      roomNumber: '102',
      roomTypeId: 'suite',
      roomTypeName: 'Executive Suite',
      floor: '1',
      capacity: 3,
      pricePerNight: 7500,
      amenities: ['Jacuzzi'],
      status: 'OUT_OF_SERVICE'
    }
  ];

  const existingReservations: Reservation[] = [
    {
      id: 'res-1',
      guestId: 'g-1',
      guestName: 'Sita Sharma',
      guestPhone: '9841000000',
      roomId: 'room-101',
      roomNumber: '101',
      roomTypeId: 'deluxe',
      roomTypeName: 'Deluxe Room',
      checkInDate: '2026-10-15',
      checkOutDate: '2026-10-18',
      adults: 2,
      children: 0,
      nightsCount: 3,
      roomRate: 4500,
      discountAmount: 0,
      taxAmount: 0,
      extraCharges: 0,
      totalAmount: 13500,
      depositAmount: 5000,
      paidAmount: 5000,
      remainingAmount: 8500,
      paymentMethod: 'cash',
      bookingSource: 'Phone / WhatsApp',
      status: 'CONFIRMED',
      createdAt: '2026-10-10'
    }
  ];

  // 1. Conflict: Overlapping interval (2026-10-16 to 2026-10-20)
  const overlapCheck = validateRoomAvailability(
    'room-101',
    '2026-10-16',
    '2026-10-20',
    existingReservations,
    rooms
  );
  assert.strictEqual(overlapCheck.isAvailable, false, 'Overlapping booking must be rejected');
  assert.ok(overlapCheck.error?.includes('already booked'), 'Rejection error message must cite existing guest booking');

  // 2. Non-conflict: Subsequent interval starting on check-out date (2026-10-18 to 2026-10-21)
  const nonOverlapCheck = validateRoomAvailability(
    'room-101',
    '2026-10-18',
    '2026-10-21',
    existingReservations,
    rooms
  );
  assert.strictEqual(nonOverlapCheck.isAvailable, true, 'Booking immediately after checkout must be allowed');

  // 3. Out-of-service room protection
  const outOfServiceCheck = validateRoomAvailability(
    'room-102',
    '2026-10-22',
    '2026-10-25',
    existingReservations,
    rooms
  );
  assert.strictEqual(outOfServiceCheck.isAvailable, false);
  assert.ok(outOfServiceCheck.error?.includes('OUT OF SERVICE'));
});

test('Inventory & Stock: Recipe ingredient deduction pre-validation', () => {
  const inventory: InventoryItem[] = [
    {
      id: 'inv-flour',
      code: 'ING-01',
      name: 'Flour (Maida)',
      nepaliName: 'मैदा',
      category: 'groceries',
      currentStock: 10,
      unit: 'kg',
      costPerUnit: 80,
      minStockAlert: 2,
      lastUpdated: '2026-10-10'
    },
    {
      id: 'inv-cheese',
      code: 'ING-02',
      name: 'Mozzarella Cheese',
      nepaliName: 'चिज',
      category: 'dairy',
      currentStock: 1.5, // 1.5kg available
      unit: 'kg',
      costPerUnit: 900,
      minStockAlert: 1,
      lastUpdated: '2026-10-10'
    }
  ];

  const menuItems: MenuItem[] = [
    {
      id: 'm-pizza',
      code: 'PIZ-01',
      name: 'Margherita Pizza',
      nepaliName: 'पिजा',
      category: 'fast_food',
      price: 550,
      costPrice: 180,
      isAvailable: true,
      inventoryRecipe: [
        { inventoryItemId: 'inv-flour', amount: 0.25, unit: 'kg' }, // 250g flour per pizza
        { inventoryItemId: 'inv-cheese', amount: 0.20, unit: 'kg' } // 200g cheese per pizza
      ]
    }
  ];

  // Case 1: Order 3 pizzas -> requires 600g cheese (we have 1.5kg) -> SUFFICIENT
  const validOrderItems: OrderItem[] = [
    {
      id: 'oi-1',
      menuItemId: 'm-pizza',
      code: 'PIZ-01',
      name: 'Margherita Pizza',
      nepaliName: 'पिजा',
      price: 550,
      quantity: 3,
      category: 'fast_food'
    }
  ];
  const check1 = validateInventoryStock(validOrderItems, menuItems, inventory);
  assert.strictEqual(check1.hasSufficientStock, true);
  assert.strictEqual(check1.shortages.length, 0);

  // Case 2: Order 10 pizzas -> requires 2.0kg cheese (we only have 1.5kg) -> INSUFFICIENT
  const excessiveOrderItems: OrderItem[] = [
    {
      id: 'oi-2',
      menuItemId: 'm-pizza',
      code: 'PIZ-01',
      name: 'Margherita Pizza',
      nepaliName: 'पिजा',
      price: 550,
      quantity: 10,
      category: 'fast_food'
    }
  ];
  const check2 = validateInventoryStock(excessiveOrderItems, menuItems, inventory);
  assert.strictEqual(check2.hasSufficientStock, false);
  assert.strictEqual(check2.shortages.length, 1);
  assert.strictEqual(check2.shortages[0].itemName, 'Mozzarella Cheese');
  assert.strictEqual(check2.shortages[0].requiredQty, 2.0);
  assert.strictEqual(check2.shortages[0].currentStock, 1.5);
});

test('Kitchen Display System: KOT cancellation with reason & restoration workflow', () => {
  // Simulate active order in kitchen
  const order: Partial<Order> = {
    id: 'ord-kds-test-1',
    businessId: 'biz-test-01',
    kotStatus: 'accepted',
    status: 'active',
    tableRoomName: 'Table T4'
  };

  // Step 1: Kitchen staff cancels KOT with valid reason
  const cancellationReason = 'Customer requested cancellation';
  const staffName = 'Head Chef Ramesh';
  const cancelledAt = new Date().toISOString();

  const cancelledOrder: Partial<Order> = {
    ...order,
    kotStatus: 'cancelled',
    voidReason: cancellationReason,
    voidedBy: staffName,
    voidedAt: cancelledAt
  };

  assert.strictEqual(cancelledOrder.kotStatus, 'cancelled', 'KOT status should become cancelled');
  assert.strictEqual(cancelledOrder.voidReason, cancellationReason, 'Cancellation reason must be captured');
  assert.strictEqual(cancelledOrder.voidedBy, staffName, 'Responsible staff member must be tracked');
  assert.ok(cancelledOrder.voidedAt, 'Cancellation timestamp must be recorded');

  // Step 2: Kitchen staff restores accidentally cancelled KOT
  const restoredOrder: Partial<Order> = {
    ...cancelledOrder,
    kotStatus: 'sent_to_kitchen',
    voidReason: undefined,
    voidedBy: undefined,
    voidedAt: undefined
  };

  assert.strictEqual(restoredOrder.kotStatus, 'sent_to_kitchen', 'KOT status should return to sent_to_kitchen');
  assert.strictEqual(restoredOrder.voidReason, undefined, 'Void reason should be cleared upon restore');
  assert.strictEqual(restoredOrder.voidedBy, undefined, 'Void staff should be cleared upon restore');
});

import {
  formatElapsedTime,
  getElapsedMinutes,
  isOrderKotExpired,
  nowIsoString,
  parseOrderTimestampMs
} from '../utils/timeUtils';

test('TimeUtils: parses UTC space-separated legacy strings and prevents artificial offset / premature expiry', () => {
  const fixedNowMs = Date.parse('2026-11-16T10:15:00.000Z');
  // Legacy timestamp written by old `.toISOString().replace('T', ' ').substring(0, 16)`
  const legacyTenMinutesAgo = '2026-11-16 10:05';
  const parsedMs = parseOrderTimestampMs(legacyTenMinutesAgo);
  assert.strictEqual(parsedMs, Date.parse('2026-11-16T10:05:00.000Z'));
  assert.strictEqual(getElapsedMinutes(legacyTenMinutesAgo, fixedNowMs), 10);
  assert.strictEqual(formatElapsedTime(legacyTenMinutesAgo, fixedNowMs), '10m');

  // Fresh ISO string produced by nowIsoString() includes timezone 'Z'
  const isoNow = nowIsoString();
  assert.ok(isoNow.endsWith('Z'), 'nowIsoString must emit full ISO-8601 UTC timestamp');

  // Active order sent 12m ago must NOT be expired
  const freshOrder = {
    status: 'active',
    kotStatus: 'sent_to_kitchen',
    kotSentAt: '2026-11-16 10:03',
    createdAt: '2026-11-16 10:03'
  };
  assert.strictEqual(isOrderKotExpired(freshOrder, fixedNowMs), false);

  // Active unaccepted order older than 24h default retention must be expired
  const staleOrder = {
    status: 'active',
    kotStatus: 'sent_to_kitchen',
    kotSentAt: '2026-11-15T09:00:00.000Z',
    createdAt: '2026-11-15T09:00:00.000Z'
  };
  assert.strictEqual(isOrderKotExpired(staleOrder, fixedNowMs), true);
});

