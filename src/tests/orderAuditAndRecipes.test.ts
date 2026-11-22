import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import {
  classifyOrderPayment,
  computeTodayOrderAuditSummary,
  isInternalArchivalOrder,
  resolveOrderItemRecipeIngredients,
  summarizeOrderDishes
} from '../services/orderAudit';
import { validateInventoryStock } from '../services/security';
import { InventoryItem, MenuItem, Order, OrderItem, ProductRecipe } from '../types';

function makeOrderItem(id: string, name: string, price: number, quantity: number): OrderItem {
  return {
    id,
    menuItemId: id,
    code: id.toUpperCase(),
    name,
    nepaliName: name,
    price,
    quantity,
    category: 'snacks'
  };
}

function makeOrder(partial: Partial<Order> & { id: string }): Order {
  return {
    invoiceNo: `INV-${partial.id}`,
    kotNo: `KOT-${partial.id}`,
    tableRoomId: 'tr-1',
    tableRoomName: 'Table 1',
    tableRoomType: 'table',
    orderType: 'dine_in',
    items: [makeOrderItem('m-1', 'Chicken Momo', 250, 2)],
    subtotal: 500,
    discountPercent: 0,
    discountAmount: 0,
    serviceChargeAmount: 0,
    vatAmount: 0,
    grandTotal: 500,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    paidAmount: 500,
    dueAmount: 0,
    status: 'completed',
    createdAt: '2026-11-17 10:15',
    ...partial
  };
}

test('OrderAudit: Today summary accurately separates Cash, Online sub-channels, Split, Unpaid, and true Cancelled orders', () => {
  const refDate = new Date(2026, 10, 17, 15, 0, 0); // 2026-11-17 local calendar day
  const yesterday = '2026-11-16 21:00';
  const todayMorning = '2026-11-17 09:30';
  const todayIso = new Date(2026, 10, 17, 13, 45, 0).toISOString();

  const orders: Order[] = [
    // 1. Cash order today
    makeOrder({
      id: 'ord-cash',
      paymentMethod: 'cash',
      grandTotal: 600,
      paidAmount: 600,
      items: [makeOrderItem('m-1', 'Chicken Momo', 250, 2), makeOrderItem('m-2', 'Milk Tea', 100, 1)],
      createdAt: todayMorning,
      settledAt: '2026-11-17 09:50'
    }),
    // 2. Online Fonepay QR today
    makeOrder({
      id: 'ord-qr',
      paymentMethod: 'fonepay_qr',
      grandTotal: 850,
      paidAmount: 850,
      settledAt: todayIso
    }),
    // 3. Split (Cash + eSewa + Khata) today
    makeOrder({
      id: 'ord-split',
      paymentMethod: 'split',
      paymentStatus: 'partial',
      grandTotal: 1000,
      paidAmount: 700,
      dueAmount: 300,
      paymentDetails: { cash: 400, esewa: 300, credit: 300 },
      settledAt: '2026-11-17 14:10'
    }),
    // 4. Open unpaid active order today
    makeOrder({
      id: 'ord-active',
      status: 'active',
      paymentStatus: 'pending',
      paidAmount: 0,
      dueAmount: 450,
      grandTotal: 450,
      createdAt: '2026-11-17 14:55',
      settledAt: undefined
    }),
    // 5. True voided order today
    makeOrder({
      id: 'ord-void',
      status: 'cancelled',
      kotStatus: 'cancelled',
      grandTotal: 320,
      voidReason: 'Guest walked out before kitchen started',
      voidedBy: 'Manager Sita',
      voidedAt: '2026-11-17 12:20',
      settledAt: undefined
    }),
    // 6. Active KOT marked cancelled (should count as cancelled, NOT unpaid)
    makeOrder({
      id: 'ord-kot-void',
      status: 'active',
      kotStatus: 'cancelled',
      grandTotal: 180,
      voidReason: 'Duplicate KOT',
      createdAt: '2026-11-17 12:30',
      settledAt: undefined
    }),
    // 7. Internal split archival placeholder (MUST be ignored in cancelled/revenue metrics)
    makeOrder({
      id: 'ord-archival-split',
      status: 'cancelled',
      grandTotal: 900,
      voidReason: 'Settled via split invoice INV-SPLIT-9',
      createdAt: '2026-11-17 11:00',
      settledAt: undefined
    }),
    // 8. Yesterday order (MUST be excluded from today)
    makeOrder({
      id: 'ord-yesterday',
      paymentMethod: 'esewa',
      grandTotal: 1200,
      createdAt: yesterday,
      settledAt: yesterday
    })
  ];

  const summary = computeTodayOrderAuditSummary(orders, refDate);

  assert.equal(summary.totalOrdersCount, 6, 'Should include 6 today non-archival orders');
  assert.equal(summary.completedCount, 3);
  assert.equal(summary.unpaidCount, 1);
  assert.equal(summary.cancelledCount, 2);

  assert.equal(summary.completedRevenue, 2450);
  assert.equal(summary.unpaidAmount, 450);
  assert.equal(summary.cancelledAmount, 500);

  assert.equal(summary.cashTotal, 1000, '600 full cash + 400 split cash');
  assert.equal(summary.onlineTotal, 1150, '850 fonepay QR + 300 split esewa');
  assert.equal(summary.fonepayQrTotal, 850);
  assert.equal(summary.esewaTotal, 300);
  assert.equal(summary.khataTotal, 300);

  const cashRow = summary.rows.find((r) => r.order.id === 'ord-cash');
  assert.ok(cashRow);
  assert.equal(cashRow.dishesSummary, '2× Chicken Momo, 1× Milk Tea');
  assert.equal(summarizeOrderDishes(cashRow.order), '2× Chicken Momo, 1× Milk Tea');

  assert.equal(isInternalArchivalOrder(orders[6]), true);
  assert.equal(isInternalArchivalOrder(orders[4]), false);

  const onlineBreak = classifyOrderPayment(orders[1]);
  assert.equal(onlineBreak.channelCategory, 'online');
  assert.equal(onlineBreak.channelLabel, 'Online · Fonepay QR');
});

test('Recipes & Inventory: Resolves Recipe Studio ProductRecipe definitions during pre-settlement stock validation', () => {
  const menuItems: MenuItem[] = [
    {
      id: 'menu-thukpa',
      code: 'THK-01',
      name: 'Chicken Thukpa',
      nepaliName: 'थुक्पा',
      category: 'nepali_food',
      price: 280,
      costPrice: 110,
      isAvailable: true
      // intentionally no inline inventoryRecipe; linked via ProductRecipe below
    }
  ];

  const recipes: ProductRecipe[] = [
    {
      id: 'rec-1',
      businessId: 'biz-default',
      menuItemId: 'menu-thukpa',
      menuItemName: 'Chicken Thukpa',
      estimatedIngredientCost: 95,
      sellingPrice: 280,
      grossMargin: 185,
      marginPercent: 66.1,
      isActive: true,
      updatedAt: '2026-11-17',
      ingredients: [
        { inventoryItemId: 'inv-noodles', itemName: 'Noodles', quantity: 0.2, unit: 'kg' },
        { inventoryItemId: 'inv-chicken', itemName: 'Chicken Breast', quantity: 0.15, unit: 'kg' }
      ]
    }
  ];

  const resolved = resolveOrderItemRecipeIngredients(menuItems[0], recipes);
  assert.equal(resolved.length, 2);
  assert.deepEqual(resolved[0], { inventoryItemId: 'inv-noodles', amount: 0.2, unit: 'kg' });

  const insufficientInventory: InventoryItem[] = [
    {
      id: 'inv-noodles',
      code: 'INV-NDL',
      name: 'Noodles',
      nepaliName: 'चाउमिन',
      category: 'groceries',
      unit: 'kg',
      currentStock: 10,
      minStockAlert: 2,
      costPerUnit: 120,
      lastUpdated: '2026-11-17'
    },
    {
      id: 'inv-chicken',
      code: 'INV-CHK',
      name: 'Chicken Breast',
      nepaliName: 'कुखुराको मासु',
      category: 'meat_poultry',
      unit: 'kg',
      currentStock: 0.25,
      minStockAlert: 1,
      costPerUnit: 450,
      lastUpdated: '2026-11-17'
    }
  ];

  // Ordering 2 bowls needs 0.30 kg chicken, only 0.25 kg available -> must reject shortage
  const failCheck = validateInventoryStock(
    [makeOrderItem('menu-thukpa', 'Chicken Thukpa', 280, 2)],
    menuItems,
    insufficientInventory,
    recipes
  );
  assert.equal(failCheck.hasSufficientStock, false);
  assert.equal(failCheck.shortages.length, 1);
  assert.equal(failCheck.shortages[0].itemName, 'Chicken Breast');

  // Ordering 1 bowl needs 0.15 kg chicken <= 0.25 kg -> must pass
  const passCheck = validateInventoryStock(
    [makeOrderItem('menu-thukpa', 'Chicken Thukpa', 280, 1)],
    menuItems,
    insufficientInventory,
    recipes
  );
  assert.equal(passCheck.hasSufficientStock, true);
});
