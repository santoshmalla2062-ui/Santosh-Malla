import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import { registerNewBusiness } from '../services/tenantStorage';
import { validateBackupJSON } from '../services/security';
import {
  calculateComparisonMetrics,
  calculatePaymentReconciliation,
  calculateProfitAndLoss,
  calculateReceivablesAging,
  generateDailyBusinessSummary,
  INITIAL_CHART_OF_ACCOUNTS
} from '../services/accounting';
import { computeReservationFolioMetrics, reconcileDailyClosing } from '../services/resortSecurity';
import { getNextInvoiceNumber, getNextKOTNumber } from '../services/storage';
import { BusinessType, Customer, GuestFolioItem, Order, Reservation } from '../types';

test('Clean Slate & Starter Business Registration: zero fake balances, reservations, or hotel payments', () => {
  localStorage.clear();

  const starterResort = registerNewBusiness({
    businessName: 'Everest Vista Hotel & Resort',
    businessType: 'RESORT' as BusinessType,
    phone: '9851234567',
    email: 'owner@everestvista.np',
    address: 'Pokhara-6, Lakeside',
    ownerId: 'owner-everest',
    ownerName: 'Dawa Sherpa',
    environment: 'production',
    templateType: 'starter'
  });

  // Starter keeps structural templates (menu/rooms) but ZERO financial or guest fake records
  assert.ok(starterResort.state.resortRooms.length > 0, 'Starter resort includes room structure');
  assert.strictEqual(starterResort.state.customers.length, 0, 'Starter business must not seed fake customers with dues');
  assert.strictEqual(starterResort.state.reservations.length, 0, 'Starter business must not seed fake reservations');
  assert.strictEqual(starterResort.state.guestProfiles.length, 0, 'Starter business must not seed fake guest profiles');
  assert.strictEqual(starterResort.state.guestFolioItems.length, 0, 'Starter business must not seed fake guest folio items');
  assert.strictEqual(starterResort.state.hotelPayments.length, 0, 'Starter business must not seed fake Rs. 67,272 hotelPayments');
  assert.strictEqual(starterResort.state.housekeepingTasks.length, 0, 'Starter business must not seed fake housekeeping tasks');
  assert.strictEqual(starterResort.state.maintenanceIssues.length, 0, 'Starter business must not seed fake maintenance issues');

  const nonZeroAccounts = (starterResort.state.accounts || []).filter(a => a.balance !== 0);
  assert.strictEqual(nonZeroAccounts.length, 0, 'Chart of Accounts must start with Rs. 0 balances');

  const cleanResort = registerNewBusiness({
    businessName: 'Mustang Boutique Lodge',
    businessType: 'RESORT' as BusinessType,
    phone: '9841223344',
    email: 'stay@mustanglodge.np',
    address: 'Jomsom, Mustang',
    ownerId: 'owner-mustang',
    ownerName: 'Karma Thakali',
    environment: 'production',
    templateType: 'clean_slate'
  });

  assert.strictEqual(cleanResort.state.guestFolioItems.length, 0, 'Clean slate resort must have empty guestFolioItems');
  assert.strictEqual(cleanResort.state.hotelPayments.length, 0, 'Clean slate resort must have empty hotelPayments');
  assert.strictEqual(cleanResort.state.resortServices.length, 0, 'Clean slate resort must have empty resortServices');
  assert.strictEqual(cleanResort.state.housekeepingTasks.length, 0, 'Clean slate resort must have empty housekeepingTasks');
  assert.strictEqual(cleanResort.state.maintenanceIssues.length, 0, 'Clean slate resort must have empty maintenanceIssues');
  assert.strictEqual(
    (cleanResort.state.accounts || []).reduce((s, a) => s + a.balance, 0),
    0,
    'Clean slate Chart of Accounts balance sum must be 0'
  );
  assert.strictEqual(
    INITIAL_CHART_OF_ACCOUNTS.reduce((s, a) => s + a.balance, 0),
    0,
    'System template accounts must default to 0'
  );
});

test('Backup Validation: preserves empty operational arrays without injecting demo data', () => {
  const cleanBackupPayload = {
    menuItems: [],
    tablesRooms: [],
    orders: [],
    inventoryItems: [],
    customers: [],
    reservations: [],
    guestProfiles: [],
    guestFolioItems: [],
    hotelPayments: [],
    roomTypes: [],
    resortRooms: [],
    resortServices: [],
    housekeepingTasks: [],
    maintenanceIssues: [],
    settings: {
      businessName: 'Zero Data Backup Cafe',
      currencySymbol: 'Rs.',
      vatRatePercent: 13,
      serviceChargePercent: 10
    }
  };

  const result = validateBackupJSON(cleanBackupPayload);
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.cleanState?.reservations?.length, 0);
  assert.strictEqual(result.cleanState?.hotelPayments?.length, 0);
  assert.strictEqual(result.cleanState?.guestFolioItems?.length, 0);
  assert.strictEqual(result.cleanState?.resortRooms?.length, 0);
});

test('Accounting Integrity: real period comparison, deterministic aging on creditBalance, and accurate reconciliation', () => {
  const now = new Date();
  const todayIso = now.toISOString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayIso = yesterday.toISOString();

  const orders: Order[] = [
    {
      id: 'ord-1',
      invoiceNo: 'INV-2026-1001',
      kotNo: 'KOT-001',
      tableRoomId: 't-1',
      tableRoomName: 'T-1',
      tableRoomType: 'table',
      orderType: 'dine_in',
      items: [{ id: 'i1', menuItemId: 'm1', code: 'M1', name: 'Momo', nepaliName: 'मम', price: 250, quantity: 4, category: 'snacks' }],
      subtotal: 1000,
      discountPercent: 0,
      discountAmount: 0,
      serviceChargeAmount: 100,
      vatAmount: 143,
      grandTotal: 1243,
      paidAmount: 743,
      dueAmount: 500,
      paymentMethod: 'split',
      paymentDetails: { cash: 300, fonepay: 443, credit: 500 },
      paymentStatus: 'partial',
      createdAt: todayIso,
      settledAt: todayIso,
      status: 'completed'
    },
    {
      id: 'ord-active',
      invoiceNo: 'INV-2026-1002',
      kotNo: 'KOT-002',
      tableRoomId: 't-2',
      tableRoomName: 'T-2',
      tableRoomType: 'table',
      orderType: 'dine_in',
      items: [{ id: 'i2', menuItemId: 'm1', code: 'M1', name: 'Momo', nepaliName: 'मम', price: 500, quantity: 1, category: 'snacks' }],
      subtotal: 500,
      discountPercent: 0,
      discountAmount: 0,
      serviceChargeAmount: 0,
      vatAmount: 0,
      grandTotal: 500,
      paidAmount: 0,
      dueAmount: 500,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      createdAt: todayIso,
      status: 'active'
    }
  ];

  // 1. Comparison metrics must NOT invent 0.88 * currentRevenue when yesterday had zero orders!
  const dayComparison = calculateComparisonMetrics(orders, [], [], 'day');
  assert.strictEqual(dayComparison.currentRevenue, 1243);
  assert.strictEqual(dayComparison.previousRevenue, 0, 'Previous period with 0 orders must return 0, never fake 88%');
  assert.strictEqual(dayComparison.previousOrdersCount, 0);

  // Add a real yesterday order -> comparison must reflect exact yesterday value
  const withYesterday = [
    ...orders,
    {
      ...orders[0],
      id: 'ord-yest',
      grandTotal: 500,
      subtotal: 500,
      serviceChargeAmount: 0,
      vatAmount: 0,
      paidAmount: 500,
      dueAmount: 0,
      paymentMethod: 'fonepay_qr' as const,
      paymentDetails: { fonepay: 500 },
      paymentStatus: 'paid' as const,
      createdAt: yesterdayIso,
      settledAt: yesterdayIso
    }
  ];
  const realComparison = calculateComparisonMetrics(withYesterday, [], [], 'day');
  assert.strictEqual(realComparison.currentRevenue, 1243);
  assert.strictEqual(realComparison.previousRevenue, 500);

  // 2. Payment reconciliation must reconcile split + fonepay_qr + credit properly
  const recs = calculatePaymentReconciliation(withYesterday, []);
  const cashRec = recs.find(r => r.method === 'cash');
  const fonepayRec = recs.find(r => r.method === 'fonepay');
  const creditRec = recs.find(r => r.method === 'credit');
  assert.strictEqual(cashRec?.recorded, 300);
  assert.strictEqual(fonepayRec?.recorded, 943); // 443 split + 500 fonepay_qr
  assert.strictEqual(creditRec?.recorded, 500);

  // 3. P&L excludes unpaid active tables and does not fabricate COGS when costPrice = 0
  const pl = calculateProfitAndLoss(orders, [], [], [], 'today', []);
  assert.strictEqual(pl.revenue.grossRevenue, 1000);
  assert.strictEqual(pl.cogs.totalCogs, 0);

  // 4. Receivables aging reads Customer.creditBalance and is deterministic across calls
  const oldDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const customers: Customer[] = [
    {
      id: 'c-1',
      name: 'Ramesh Adhikari',
      phone: '9801111111',
      customerType: 'regular',
      creditBalance: 2500,
      loyaltyPoints: 10,
      totalSpend: 5000,
      totalVisits: 4,
      createdAt: oldDate,
      lastVisit: oldDate
    }
  ];
  const aging1 = calculateReceivablesAging(customers, []);
  const aging2 = calculateReceivablesAging(customers, []);
  assert.strictEqual(aging1.aging.totalOutstanding, 2500);
  assert.strictEqual(aging1.aging.bucket31to60, 2500);
  assert.deepStrictEqual(aging1, aging2, 'Receivables aging must be strictly deterministic (no Math.random)');

  // 5. Daily summary uses real 0 openingCash fallback and split cash/digital/credit breakdown
  const todayPrefix = now.toISOString().split('T')[0];
  const summary = generateDailyBusinessSummary('biz-1', 'Test Cafe', todayPrefix, orders, [], [], [], customers, [], 'Rs.');
  assert.strictEqual(summary.metrics.openingCash, 0);
  assert.strictEqual(summary.metrics.cashSales, 300);
  assert.strictEqual(summary.metrics.digitalSales, 443);
  assert.strictEqual(summary.metrics.creditSales, 500);
});

test('POS charge_to_room Folio Posting: zero double-VAT when rolled into Guest Folio & Daily Closing', () => {
  // Simulate POS dining bill: subtotal 1000, SC 100 (taxable 1100), VAT 143 -> grandTotal 1243
  const posGrandTotal = 1243;
  const posVatAmount = 143;
  const preVatFolioAmount = Math.round((posGrandTotal - posVatAmount) * 100) / 100; // 1100

  const reservation: Reservation = {
    id: 'res-1',
    guestId: 'g-1',
    guestName: 'Sita Thapa',
    guestPhone: '9840000001',
    roomId: 'r-101',
    roomNumber: '101',
    roomTypeId: 'rt-1',
    roomTypeName: 'Deluxe Suite',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    nightsCount: 2,
    adults: 2,
    children: 0,
    roomRate: 5000,
    extraCharges: preVatFolioAmount,
    discountAmount: 0,
    taxAmount: 1300 + posVatAmount,
    totalAmount: 11300 + posGrandTotal,
    depositAmount: 0,
    paidAmount: 0,
    remainingAmount: 11300 + posGrandTotal,
    paymentMethod: 'cash',
    status: 'CHECKED_IN',
    bookingSource: 'Direct Walk-in',
    createdAt: '2026-11-20 12:00'
  };

  const folios: GuestFolioItem[] = [
    {
      id: 'fol-room',
      reservationId: 'res-1',
      roomId: 'r-101',
      roomNumber: '101',
      dateTime: '2026-11-20 12:00',
      description: 'Room Stay (2 Nights)',
      category: 'ROOM',
      quantity: 2,
      unitPrice: 5000,
      totalPrice: 10000,
      addedByStaff: 'Front Desk'
    },
    {
      id: 'fol-pos-1',
      reservationId: 'res-1',
      roomId: 'r-101',
      roomNumber: '101',
      dateTime: '2026-11-20 19:30',
      description: 'POS Dining Order #INV-2026-1001',
      category: 'RESTAURANT',
      quantity: 1,
      unitPrice: preVatFolioAmount,
      totalPrice: preVatFolioAmount,
      addedByStaff: 'Waiter',
      referenceId: 'ord-pos-1'
    }
  ];

  const metrics = computeReservationFolioMetrics(folios, [], reservation, { enableVat: true, vatRatePercent: 13 });
  // subtotal = 10000 + 1100 = 11100; 13% VAT = 1443 (= 1300 room VAT + 143 POS VAT); Grand Total = 12543
  assert.strictEqual(metrics.subtotal, 11100);
  assert.strictEqual(metrics.vatAmount, 1443);
  assert.strictEqual(metrics.grandTotal, 12543, 'Guest folio grand total must match Room (11300) + POS Dining (1243) without double VAT!');

  // Verify reconcileDailyClosing handles split POS order without counting credit as collected cash
  const closing = reconcileDailyClosing(
    '2026-11-20',
    folios,
    [],
    [
      {
        id: 'ord-pos-2',
        invoiceNo: 'INV-2026-1002',
        kotNo: 'KOT-002',
        tableRoomId: 't-1',
        tableRoomName: 'T-1',
        tableRoomType: 'table',
        orderType: 'dine_in',
        items: [],
        subtotal: 1000,
        discountPercent: 0,
        discountAmount: 0,
        serviceChargeAmount: 0,
        vatAmount: 130,
        grandTotal: 1130,
        paidAmount: 630,
        dueAmount: 500,
        paymentMethod: 'split',
        paymentDetails: { cash: 630, credit: 500 },
        paymentStatus: 'partial',
        createdAt: '2026-11-20 14:00',
        status: 'completed'
      }
    ],
    13
  );
  assert.strictEqual(closing.paymentsByMethod.cash, 630);
  assert.strictEqual(closing.paymentsByMethod.credit_khata, 500);
  assert.strictEqual(closing.totalPaymentsCollected, 630);
});

test('Sequence Isolation & Idempotency: previews never increment counters and tenants have separate sequences', () => {
  localStorage.clear();

  // Repeated preview calls (`persist = false`) must return the exact same next numbers
  const preview1 = getNextInvoiceNumber([], 'INV-', 'biz-clean-a', false);
  const preview2 = getNextInvoiceNumber([], 'INV-', 'biz-clean-a', false);
  const kotPreview1 = getNextKOTNumber([], 'KOT-', 'biz-clean-a', false);
  const kotPreview2 = getNextKOTNumber([], 'KOT-', 'biz-clean-a', false);

  assert.strictEqual(preview1, preview2);
  assert.strictEqual(kotPreview1, kotPreview2);
  assert.ok(preview1.endsWith('-1001'), 'New clean tenant starts at INV-YYYY-1001');
  assert.strictEqual(kotPreview1, 'KOT-001', 'New clean tenant starts at KOT-001');

  // Commit in Tenant A must NOT affect Tenant B
  getNextKOTNumber([], 'KOT-', 'biz-clean-a', true);
  getNextKOTNumber([], 'KOT-', 'biz-clean-a', true);
  const nextTenantA = getNextKOTNumber([], 'KOT-', 'biz-clean-a', false);
  const nextTenantB = getNextKOTNumber([], 'KOT-', 'biz-clean-b', false);

  assert.strictEqual(nextTenantA, 'KOT-003');
  assert.strictEqual(nextTenantB, 'KOT-001');
});
