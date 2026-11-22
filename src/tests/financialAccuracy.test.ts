import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import { validatePaymentSettlement, verifyFinancialCalculations } from '../services/security';
import { BusinessSettings, MenuItem, Order, OrderItem } from '../types';
import { carveItemsForSplitBill, splitAmountEqually } from '../utils/splitBilling';

const masterMenuItems: MenuItem[] = [
  {
    id: 'm-momo',
    code: 'MOM-01',
    name: 'Steamed Chicken Momo',
    nepaliName: 'चिकेन मम',
    category: 'snacks',
    price: 250,
    costPrice: 85,
    isAvailable: true
  },
  {
    id: 'm-pizza',
    code: 'PIZ-01',
    name: 'Woodfire Pizza',
    nepaliName: 'पिजा',
    category: 'fast_food',
    price: 600,
    costPrice: 200,
    isAvailable: true,
    variants: [
      { name: 'Regular (8")', price: 600 },
      { name: 'Large (12")', price: 850 }
    ],
    addOns: [
      { name: 'Extra Mozzarella', price: 120 }
    ]
  },
  {
    id: 'm-offer-latte',
    code: 'CAF-02',
    name: 'Vanilla Latte',
    nepaliName: 'भेनिला लात्ते',
    category: 'coffee',
    price: 320,
    costPrice: 90,
    isAvailable: true,
    isOffer: true,
    offerPrice: 260,
    discountPercent: 19,
    offerLabel: '19% OFF'
  }
];

const testSettings: BusinessSettings = {
  businessName: 'Himalayan Breeze Cafe',
  tagline: 'Coffee & Kitchen',
  nepaliBusinessName: 'हिमालयन ब्रिज क्याफे',
  address: 'Thamel, Kathmandu',
  phone: '9800000000',
  email: 'info@example.com',
  panVatNumber: '601234567',
  currencySymbol: 'Rs.',
  enableVat: true,
  vatRatePercent: 13,
  enableServiceCharge: true,
  serviceChargePercent: 10,
  receiptFooterMessage: 'Thank you, please come again',
  enableSoundEffects: false,
  defaultLanguage: 'en',
  fonepayMerchantName: 'Himalayan Breeze',
  sessionTimeoutMinutes: 60
};

test('Financial Calculations: Standard Dine-In with Discount, Service Charge (10%) and VAT (13%)', () => {
  const items: OrderItem[] = [
    {
      id: 'i-1',
      menuItemId: 'm-momo',
      code: 'MOM-01',
      name: 'Steamed Chicken Momo',
      nepaliName: 'चिकेन मम',
      price: 250,
      quantity: 2, // 250 * 2 = 500
      category: 'snacks'
    },
    {
      id: 'i-2',
      menuItemId: 'm-pizza',
      code: 'PIZ-01',
      name: 'Woodfire Pizza',
      nepaliName: 'पिजा',
      price: 600,
      quantity: 1, // 600 * 1 = 600
      category: 'fast_food'
    }
  ];

  // Total Subtotal = 500 + 600 = 1100
  // Discount = 10% of 1100 = 110. Taxable = 990
  // SC (10%) = 10% of 990 = 99. Base for VAT = 990 + 99 = 1089
  // VAT (13%) = 13% of 1089 = 141.57. Grand Total = 1089 + 141.57 = 1230.57
  const result = verifyFinancialCalculations(
    items,
    masterMenuItems,
    10,    // 10% discount
    false, // dine-in (not takeaway)
    true,  // enable SC
    10,    // 10% SC
    true,  // enable VAT
    13     // 13% VAT
  );

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.verifiedSubtotal, 1100);
  assert.strictEqual(result.verifiedDiscountAmount, 110);
  assert.strictEqual(result.verifiedServiceCharge, 99);
  assert.strictEqual(result.verifiedVat, 141.57);
  assert.strictEqual(result.verifiedGrandTotal, 1230.57);
});

test('Financial Calculations: Takeaway Order exempts Service Charge', () => {
  const items: OrderItem[] = [
    {
      id: 'i-1',
      menuItemId: 'm-momo',
      code: 'MOM-01',
      name: 'Steamed Chicken Momo',
      nepaliName: 'चिकेन मम',
      price: 250,
      quantity: 2, // 500
      category: 'snacks'
    }
  ];

  // Subtotal = 500. Discount = 0.
  // Takeaway = true -> SC must be 0!
  // VAT = 13% of 500 = 65.
  // Grand Total = 500 + 65 = 565.
  const result = verifyFinancialCalculations(
    items,
    masterMenuItems,
    0,
    true, // isTakeaway = true
    true, // SC enabled in settings
    10,
    true, // VAT enabled
    13
  );

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.verifiedSubtotal, 500);
  assert.strictEqual(result.verifiedServiceCharge, 0, 'Service charge must be 0 on takeaway orders');
  assert.strictEqual(result.verifiedVat, 65);
  assert.strictEqual(result.verifiedGrandTotal, 565);
});

test('Financial Calculations: Promotional Offer pricing and Variants calculation', () => {
  const items: OrderItem[] = [
    {
      id: 'i-offer',
      menuItemId: 'm-offer-latte',
      code: 'CAF-02',
      name: 'Vanilla Latte',
      nepaliName: 'भेनिला लात्ते',
      price: 260, // offer price applied
      quantity: 2,
      category: 'coffee'
    },
    {
      id: 'i-pizza-large',
      menuItemId: 'm-pizza',
      code: 'PIZ-01',
      name: 'Woodfire Pizza',
      nepaliName: 'पिजा',
      price: 970,
      quantity: 1,
      selectedVariant: { name: 'Large (12")', price: 850 },
      selectedAddOns: [{ name: 'Extra Mozzarella', price: 120 }],
      category: 'fast_food'
    }
  ];

  // Latte on offer: 260 * 2 = 520 (regular was 320 * 2 = 640)
  // Pizza large (850) + Addon (120) = 970 * 1 = 970
  // Subtotal = 520 + 970 = 1490
  const result = verifyFinancialCalculations(
    items,
    masterMenuItems,
    0,
    true, // takeaway
    false,
    0,
    false,
    0
  );

  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.verifiedSubtotal, 1490);
  assert.strictEqual(result.verifiedGrandTotal, 1490);
});

test('Financial Calculations: Negative quantity and corrupt input validation', () => {
  const badItems: OrderItem[] = [
    {
      id: 'i-bad',
      menuItemId: 'm-momo',
      code: 'MOM-01',
      name: 'Steamed Chicken Momo',
      nepaliName: 'चिकेन मम',
      price: 250,
      quantity: -3, // Negative quantity
      category: 'snacks'
    }
  ];

  const result = verifyFinancialCalculations(badItems, masterMenuItems, 0, false, true, 10, true, 13);
  assert.strictEqual(result.isValid, false);
  assert.ok(result.error?.includes('Invalid quantity'), 'Negative quantity must be rejected');
});

test('Payment Settlement: Multi-channel Split Pay across Cash, Digital Wallets, Bank and Khata', () => {
  const validSplit = validatePaymentSettlement(
    'split',
    {
      cash: 300,
      fonepay: 250.57,
      card: 200,
      esewa: 150,
      khalti: 100,
      bank: 130,
      credit: 100
    },
    1230.57,
    'cust-1'
  );
  assert.strictEqual(validSplit.isValid, true);

  const mismatchedSplit = validatePaymentSettlement(
    'split',
    {
      cash: 500,
      fonepay: 500
    },
    1230.57
  );
  assert.strictEqual(mismatchedSplit.isValid, false);
  assert.ok(mismatchedSplit.error?.includes('does not match bill total'));

  const negativeChannelSplit = validatePaymentSettlement(
    'split',
    {
      cash: 1300,
      esewa: -69.43
    },
    1230.57
  );
  assert.strictEqual(negativeChannelSplit.isValid, false);
  assert.ok(negativeChannelSplit.error?.includes('cannot be negative'));
});

test('Split Billing: Paisa-exact Equal Guests division never drifts', () => {
  const threeWay = splitAmountEqually(100, 3);
  assert.deepStrictEqual(threeWay, [33.34, 33.33, 33.33]);
  assert.strictEqual(
    Math.round(threeWay.reduce((a, b) => a + b, 0) * 100) / 100,
    100
  );

  const fourWayOdd = splitAmountEqually(1230.57, 4);
  assert.deepStrictEqual(fourWayOdd, [307.65, 307.64, 307.64, 307.64]);
  assert.strictEqual(
    Math.round(fourWayOdd.reduce((a, b) => a + b, 0) * 100) / 100,
    1230.57
  );

  const singleGuest = splitAmountEqually(555.5, 1);
  assert.deepStrictEqual(singleGuest, [555.5]);

  const zeroFloorGuard = splitAmountEqually(100, 0);
  assert.deepStrictEqual(zeroFloorGuard, [100]);
});

test('Split Billing: carveItemsForSplitBill separates items and recalculates Nepal SC/VAT & discounts cleanly', () => {
  const parentOrder: Order = {
    id: 'ord-parent-1',
    invoiceNo: 'INV-1001',
    kotNo: 'KOT-201',
    tableRoomId: 'tr-1',
    tableRoomName: 'Table 1',
    tableRoomType: 'table',
    orderType: 'dine_in',
    items: [
      {
        id: 'ci-1',
        menuItemId: 'm-momo',
        code: 'MOM-01',
        name: 'Steamed Chicken Momo',
        nepaliName: 'चिकेन मम',
        price: 250,
        quantity: 2, // 500
        category: 'snacks'
      },
      {
        id: 'ci-2',
        menuItemId: 'm-pizza',
        code: 'PIZ-01',
        name: 'Woodfire Pizza',
        nepaliName: 'पिजा',
        price: 600,
        quantity: 1, // 600
        category: 'fast_food'
      }
    ],
    subtotal: 1100,
    discountPercent: 10,
    discountAmount: 110,
    serviceChargeAmount: 99,
    vatAmount: 141.57,
    grandTotal: 1230.57,
    paidAmount: 0,
    dueAmount: 1230.57,
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    createdAt: '2026-11-09 12:10',
    status: 'active'
  };

  // Carve 1 plate of Momo (250) out into a separate split invoice
  const result = carveItemsForSplitBill(
    parentOrder,
    { 'ci-1': 1, 'ci-2': 0 },
    masterMenuItems,
    testSettings,
    'INV-1002'
  );

  assert.ok(result.splitOrder, 'splitOrder must be created');
  assert.strictEqual(result.splitOrder!.invoiceNo, 'INV-1002');
  assert.strictEqual(result.splitOrder!.parentSplitOrderId, 'ord-parent-1');
  assert.strictEqual(result.splitItems.length, 1);
  assert.strictEqual(result.splitItems[0].quantity, 1);

  // Split calculation for Rs. 250: 10% disc = 25 -> taxable 225 -> SC 22.50 -> base 247.50 -> VAT 32.17 -> 279.67
  assert.strictEqual(result.splitSummary.verifiedSubtotal, 250);
  assert.strictEqual(result.splitSummary.verifiedDiscountAmount, 25);
  assert.strictEqual(result.splitSummary.verifiedServiceCharge, 22.5);
  assert.strictEqual(result.splitSummary.verifiedVat, 32.17);
  assert.strictEqual(result.splitSummary.verifiedGrandTotal, 279.67);

  // Remaining items: 1x Momo (250) + 1x Pizza (600) = 850 subtotal
  assert.strictEqual(result.remainingItems.length, 2);
  assert.strictEqual(result.remainingSummary.verifiedSubtotal, 850);

  // Delivery order carve must keep Service Charge = 0
  const deliveryOrder: Order = { ...parentOrder, id: 'ord-del-1', orderType: 'delivery', serviceChargeAmount: 0 };
  const deliverySplit = carveItemsForSplitBill(
    deliveryOrder,
    { 'ci-1': 1 },
    masterMenuItems,
    testSettings,
    'INV-1003'
  );
  assert.strictEqual(deliverySplit.splitSummary.verifiedServiceCharge, 0);
});
