import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import {
  buildCbmsBatchPayload,
  buildPurchaseVatRegisterRows,
  buildSalesVatRegisterRows,
  createCreditNoteFromOrder,
  getNepalFiscalYear,
  getNextCreditNoteNumber,
  summarizeSalesVatRegister
} from '../services/irdCompliance';
import {
  calculateTrialBalance,
  postCreditNoteJournal,
  postExpenseJournal,
  postHotelPaymentJournal,
  postKhataPaymentJournal,
  postOpeningBalanceJournal,
  postOrderSettlementJournal
} from '../services/generalLedger';
import {
  buildCashDrawerKickBytes,
  buildEscPosKotBytes,
  buildEscPosReceiptBytes
} from '../services/escposPrinter';
import { createStaffAccount, isKnownWeakPin, validateProductionPin } from '../services/security';
import {
  MAX_SYNC_CHANNEL_BYTES,
  buildSanitizedAuditLogPayload,
  buildSanitizedJournalEntryPayload,
  estimateUtf8ByteSize,
  extractChannelPayload,
  mergeBoundedOrdersWithExisting,
  mergeChannelPayloadIntoAppState
} from '../services/cloudSyncService';
import {
  addBusinessArea,
  deriveBusinessTableAreas,
  removeBusinessArea,
  renameBusinessArea,
  resolveTableArea
} from '../services/tableAreas';
import {
  checkAndRegisterIdempotencyKey,
  resolveOrderMutationIdempotencyKey
} from '../services/syncService';
import {
  DEFAULT_QUICK_CASH_NOTES,
  addCustomQuickCashNote,
  buildQuickCashOptionsForPayable,
  loadQuickCashNotes,
  removeQuickCashNote,
  saveQuickCashNotes
} from '../services/quickCashNotes';
import { INITIAL_CHART_OF_ACCOUNTS } from '../services/accounting';
import {
  AppState,
  AuditLogEntry,
  BusinessSettings,
  CreditNoteRecord,
  Customer,
  Expense,
  HotelPaymentRecord,
  JournalEntry,
  KhataTransaction,
  Order,
  PurchaseOrder,
  TableRoom
} from '../types';

const baseSettings: BusinessSettings = {
  businessName: 'Himalayan Breeze Resort',
  tagline: 'Mountain Dining & Stay',
  nepaliBusinessName: 'हिमालयन ब्रिज रिसोर्ट',
  address: 'Nagarkot, Bhaktapur',
  phone: '9841000000',
  email: 'info@himalayanbreeze.com.np',
  panVatNumber: '601234567',
  currencySymbol: 'Rs.',
  enableVat: true,
  vatRatePercent: 13,
  enableServiceCharge: true,
  serviceChargePercent: 10,
  receiptFooterMessage: 'Thank you for visiting!',
  enableSoundEffects: false,
  defaultLanguage: 'en',
  fonepayMerchantName: 'Himalayan Breeze',
  sessionTimeoutMinutes: 60,
  receiptSettings: {
    showLogo: true,
    showPanVat: true,
    showCustomerDetails: true,
    showTaxBreakdown: true,
    showQrCode: true,
    invoicePrefix: 'INV-',
    footerMessage: 'Thank you for visiting!',
    printWidth: '80mm'
  },
  irdSettings: {
    fiscalYearLabel: '2083/84',
    cbmsEnabled: false,
    cbmsUsername: 'himalayan_cbms',
    strictTaxInvoiceLock: true
  }
};

function makeCleanState(): AppState {
  return {
    businessId: 'biz-test',
    menuItems: [],
    tablesRooms: [],
    orders: [],
    creditNotes: [],
    accounts: INITIAL_CHART_OF_ACCOUNTS.map(a => ({ ...a, balance: 0 })),
    journalEntries: [],
    inventoryItems: [],
    inventoryLogs: [],
    customers: [],
    khataTransactions: [],
    expenses: [],
    dayClosings: [],
    staffUsers: [],
    auditLogs: [],
    settings: baseSettings,
    roomTypes: [],
    resortRooms: [],
    guestProfiles: [],
    reservations: [],
    guestFolioItems: [],
    resortServices: [],
    housekeepingTasks: [],
    maintenanceIssues: [],
    hotelPayments: []
  };
}

function makeSampleOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-100',
    businessId: 'biz-test',
    invoiceNo: 'INV-1001',
    kotNo: 'KOT-01',
    orderType: 'dine_in',
    tableRoomId: 't-1',
    tableRoomName: 'Table 1',
    tableRoomType: 'table',
    status: 'completed',
    kotStatus: 'served',
    items: [
      {
        id: 'oi-1',
        menuItemId: 'm-1',
        code: 'THL-01',
        name: 'Chicken Thali',
        nepaliName: 'चिकेन थाली',
        category: 'snacks',
        price: 500,
        quantity: 2,
        kotStatus: 'served'
      },
      {
        id: 'oi-2',
        menuItemId: 'm-2',
        code: 'COF-01',
        name: 'Espresso',
        nepaliName: 'एस्प्रेसो',
        category: 'coffee',
        price: 200,
        quantity: 1,
        kotStatus: 'served'
      }
    ],
    subtotal: 1200,
    discountPercent: 0,
    discountAmount: 0,
    serviceChargeAmount: 120,
    vatAmount: 171.6,
    grandTotal: 1491.6,
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    paidAmount: 1491.6,
    dueAmount: 0,
    createdAt: '2026-08-01T10:00:00.000Z',
    settledAt: '2026-08-01T10:30:00.000Z',
    customerName: 'Ram Bahadur',
    buyerPan: '304567890',
    ...overrides
  };
}

test('IRD Annex-5 Sales & Purchase Registers + Credit Note Reversal Math', () => {
  localStorage.clear();

  const fyAug = getNepalFiscalYear(new Date('2026-08-01T00:00:00.000Z'));
  assert.match(fyAug, /^208\d\/\d{2}$/);

  const order1 = makeSampleOrder();
  const cnNo1 = getNextCreditNoteNumber([], 'biz-test', true, new Date('2026-08-02T00:00:00.000Z'));
  assert.match(cnNo1, /^CN-208\d-0001$/);
  const cnNo2 = getNextCreditNoteNumber([], 'biz-test', false, new Date('2026-08-02T00:00:00.000Z'));
  assert.match(cnNo2, /^CN-208\d-0002$/);

  const voidedOrder1: Order = { ...order1, status: 'cancelled', creditNoteNo: cnNo1 };
  const cn1 = createCreditNoteFromOrder(
    order1,
    cnNo1,
    'Customer changed order after billing',
    'Manager Sita',
    'biz-test',
    new Date('2026-08-02T11:00:00.000Z')
  );

  const draftCancelled = makeSampleOrder({
    id: 'ord-draft',
    invoiceNo: 'DRAFT-99',
    status: 'cancelled',
    settledAt: undefined
  });

  const rows = buildSalesVatRegisterRows([voidedOrder1, draftCancelled], [cn1], '2026-08');
  assert.equal(rows.length, 2, 'Should contain immutable Tax Invoice + offsetting Credit Note');
  assert.equal(rows[0].entryType, 'INVOICE');
  assert.equal(rows[1].entryType, 'CREDIT_NOTE');
  assert.equal(rows[1].referenceInvoiceNo, 'INV-1001');

  const summary = summarizeSalesVatRegister(rows);
  assert.equal(summary.invoiceCount, 1);
  assert.equal(summary.creditNoteCount, 1);
  assert.equal(summary.netTaxable, 0, 'Returned taxable amount cancels original taxable sale');
  assert.equal(summary.netVatPayable, 0, 'Returned VAT cancels original Output VAT');
  assert.equal(summary.netTotalSales, 0);

  const po: PurchaseOrder = {
    id: 'po-1',
    businessId: 'biz-test',
    poNumber: 'PO-2026-01',
    supplierId: 'sup-1',
    supplierName: 'Pokhara Dairy Suppliers',
    orderDate: '2026-08-03',
    receivedDate: '2026-08-03',
    status: 'RECEIVED',
    items: [],
    subtotal: 10000,
    discountTotal: 0,
    taxTotal: 1300,
    grandTotal: 11300,
    paidAmount: 11300,
    createdByName: 'Admin'
  };
  const exp: Expense = {
    id: 'exp-1',
    title: 'LPG Cylinder Refill',
    category: 'gas_fuel',
    amount: 1900,
    date: '2026-08-04',
    submittedBy: 'Manager',
    paymentMode: 'cash'
  };
  const purchaseRows = buildPurchaseVatRegisterRows([po], [exp], '2026-08');
  assert.equal(purchaseRows.length, 2);
  assert.equal(purchaseRows[0].vatPaid, 1300);
  assert.equal(purchaseRows[0].taxablePurchase, 10000);
  assert.equal(purchaseRows[1].exemptPurchase, 1900);

  const cbmsBatch = buildCbmsBatchPayload(rows, baseSettings);
  assert.equal(cbmsBatch.sellerPan, '601234567');
  assert.equal(cbmsBatch.recordCount, 2);
  assert.equal(cbmsBatch.records[1].is_credit_note, true);
});

test('Double-Entry General Ledger maintains DR === CR across all hospitality & accounting events', () => {
  let state = makeCleanState();

  // 1. Opening Capital Injection: Cash Rs. 50,000
  let res = postOpeningBalanceJournal(state, '1010', 50000, 'Owner', 'Initial Drawer Float');
  state = { ...state, ...res };

  // 2. POS Settlement (Split: Cash 1000 + Fonepay 491.60)
  const splitOrder = makeSampleOrder({
    paymentMethod: 'split',
    paymentDetails: { cash: 1000, fonepay: 491.6 }
  });
  res = postOrderSettlementJournal(state, splitOrder, 'Cashier Ram');
  state = { ...state, ...res };

  // Duplicate idempotency check
  const resDup = postOrderSettlementJournal(state, splitOrder, 'Cashier Ram');
  assert.equal(resDup.journalEntries.length, state.journalEntries?.length);

  // 3. POS Khata Credit Sale
  const khataOrder = makeSampleOrder({
    id: 'ord-khata',
    invoiceNo: 'INV-1002',
    paymentMethod: 'credit_khata',
    paymentStatus: 'credit',
    paidAmount: 0,
    dueAmount: 1491.6,
    vatAmount: 171.6,
    serviceChargeAmount: 120,
    grandTotal: 1491.6
  });
  res = postOrderSettlementJournal(state, khataOrder, 'Cashier Ram');
  state = { ...state, ...res };

  // 4. Credit Note Reversal on khataOrder
  const cn = createCreditNoteFromOrder(khataOrder, 'CN-2083-0001', 'Billing error', 'Manager', 'biz-test');
  res = postCreditNoteJournal(state, cn, 'Manager');
  state = { ...state, ...res };

  // 5. Khata Collection
  const khataTx: KhataTransaction = {
    id: 'ktx-1',
    customerId: 'cust-1',
    customerName: 'Ram Bahadur',
    type: 'payment_received',
    amount: 500,
    balanceBefore: 1491.6,
    balanceAfter: 991.6,
    paymentMode: 'fonepay_qr',
    date: '2026-08-02T12:00:00.000Z',
    notes: 'Cashier settlement'
  };
  res = postKhataPaymentJournal(state, khataTx, 'Cashier');
  state = { ...state, ...res };

  // 6. Operating Expense
  const expense: Expense = {
    id: 'exp-gl-1',
    title: 'Monthly Electricity Bill',
    category: 'utilities',
    amount: 3200,
    date: '2026-08-03',
    submittedBy: 'Accountant',
    paymentMode: 'bank_transfer'
  };
  res = postExpenseJournal(state, expense, 'Accountant');
  state = { ...state, ...res };

  // 7. Resort Room Payment
  const hotelPay: HotelPaymentRecord = {
    id: 'hp-1',
    reservationId: 'res-1',
    guestName: 'Sita Sharma',
    roomNumber: '101',
    amount: 4500,
    method: 'card',
    status: 'completed',
    dateTime: '2026-08-04T09:00:00.000Z',
    staffName: 'Receptionist'
  };
  res = postHotelPaymentJournal(state, hotelPay, 'Receptionist');
  state = { ...state, ...res };

  assert.equal(state.journalEntries?.length, 7);
  for (const je of state.journalEntries!) {
    assert.equal(je.totalDebit, je.totalCredit, `Entry ${je.entryNumber} must have DR === CR`);
    assert.ok(je.totalDebit > 0);
  }

  const trial = calculateTrialBalance(state.accounts || [], state.journalEntries || []);
  assert.equal(trial.isBalanced, true, 'Trial balance must strictly balance across all 7 events');
  assert.equal(trial.totalDebits, trial.totalCredits);
  assert.equal(trial.totalEndingDebit, trial.totalEndingCredit);

  // Verify specific live Chart of Accounts balances updated properly
  const cashAcc = state.accounts?.find(a => a.code === '1010');
  assert.equal(cashAcc?.balance, 51000);
  const vatPayableAcc = state.accounts?.find(a => a.code === '2020');
  assert.equal(vatPayableAcc?.balance, 171.6);
});

test('ESC/POS Thermal Printer & RJ11 Cash Drawer Binary Stream Generator', () => {
  const order = makeSampleOrder();

  const kickBytes = buildCashDrawerKickBytes(0);
  assert.deepEqual(Array.from(kickBytes), [0x1b, 0x70, 0x00, 0x19, 0xfa]);

  const receiptBytes = buildEscPosReceiptBytes(order, baseSettings, {
    width: '80mm',
    kickDrawer: true,
    drawerPin: 1
  });
  assert.equal(receiptBytes[0], 0x1b);
  assert.equal(receiptBytes[1], 0x40);
  const receiptArr = Array.from(receiptBytes);
  const cutIndex = receiptArr.findIndex(
    (_, idx) =>
      receiptArr[idx] === 0x1d &&
      receiptArr[idx + 1] === 0x56 &&
      receiptArr[idx + 2] === 0x42 &&
      receiptArr[idx + 3] === 0x03
  );
  assert.ok(cutIndex > 20, 'Receipt byte stream must include ESC/POS partial cut sequence');
  assert.deepEqual(receiptArr.slice(-5), [0x1b, 0x70, 0x01, 0x19, 0xfa]);

  const kotBytes = buildEscPosKotBytes(order, baseSettings, { width: '58mm' });
  assert.equal(kotBytes[0], 0x1b);
  assert.equal(kotBytes[1], 0x40);
  assert.ok(kotBytes.length > 40);
});

test('Production PIN Hardening blocks weak/default/duplicate PINs and accepts strong unique PINs', async () => {
  assert.equal(isKnownWeakPin('7788'), true);
  assert.equal(isKnownWeakPin('1234'), true);
  assert.equal(isKnownWeakPin('4321'), true);
  assert.equal(isKnownWeakPin('0000'), true);
  assert.equal(isKnownWeakPin('55555'), true);
  assert.equal(isKnownWeakPin('8392'), false);

  const staff1 = await createStaffAccount('ram', 'Ram', 'राम', 'CASHIER', '8392');

  const weakRes = await validateProductionPin('7788', [staff1]);
  assert.equal(weakRes.isValid, false);

  const dupRes = await validateProductionPin('8392', [staff1]);
  assert.equal(dupRes.isValid, false, 'Must reject PIN already assigned to another active staff member');

  const selfUpdateRes = await validateProductionPin('8392', [staff1], { excludeStaffId: staff1.id });
  assert.equal(selfUpdateRes.isValid, true, 'Should allow keeping own strong PIN when excludeStaffId matches');

  const strongNewRes = await validateProductionPin('5924', [staff1]);
  assert.equal(strongNewRes.isValid, true);
});

test('Multi-Device Firestore Scaling keeps orders_live bounded < 1 MB and retains historical orders', () => {
  const manyOrders: Order[] = [];
  for (let i = 0; i < 500; i++) {
    manyOrders.push(
      makeSampleOrder({
        id: `ord-${i}`,
        invoiceNo: `INV-${1000 + i}`,
        status: i < 10 ? 'active' : 'completed'
      })
    );
  }

  const state: AppState = { ...makeCleanState(), orders: manyOrders, activeOrderId: 'ord-0' };
  const payload = extractChannelPayload('orders_live', state);

  assert.ok(Array.isArray(payload.orders));
  assert.equal(payload.orders.length, 60, '10 active + max 50 recent archived in bounded orders_live doc');
  const serializedSizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  assert.ok(serializedSizeBytes < 200_000, `Expected bounded payload << 1MB, got ${serializedSizeBytes} bytes`);

  const merged = mergeBoundedOrdersWithExisting(manyOrders, payload.orders);
  assert.equal(merged.length, 500, 'Historical orders stored in /orders/{orderId} must not be wiped');
});

test('Sharded orders_live payload enforces <= 550 KB budget even with 120 huge active orders', () => {
  const heavyItems = Array.from({ length: 60 }, (_, idx) => ({
    id: `item-${idx}`,
    menuItemId: `menu-${idx}`,
    code: `C-${idx}`,
    name: `Himalayan Signature Platter Course #${idx} with Extra Spices & Chutney`,
    nepaliName: `स्पेसल परिकार ${idx}`,
    category: 'snacks' as const,
    price: 450 + idx,
    quantity: 2,
    kotStatus: 'served' as const,
    notes: 'Extra spicy, no garlic, serve sizzling hot on cast iron platter'
  }));

  const hugeOrders: Order[] = Array.from({ length: 120 }, (_, i) =>
    makeSampleOrder({
      id: `huge-ord-${i}`,
      invoiceNo: `INV-9${String(i).padStart(3, '0')}`,
      status: 'active',
      items: heavyItems
    })
  );

  const rawBytes = estimateUtf8ByteSize({ orders: hugeOrders });
  assert.ok(rawBytes > 1_048_576, `Test fixture should exceed 1MB raw (${rawBytes} bytes)`);

  const state: AppState = { ...makeCleanState(), orders: hugeOrders, activeOrderId: 'huge-ord-0' };
  const payload = extractChannelPayload('orders_live', state);
  const compressedBytes = estimateUtf8ByteSize(payload);

  assert.ok(
    compressedBytes <= MAX_SYNC_CHANNEL_BYTES,
    `orders_live payload (${compressedBytes} bytes) must fit strictly under ${MAX_SYNC_CHANNEL_BYTES} bytes`
  );
  assert.ok(payload.orders.length > 0 && payload.orders.length < 120, 'Should trim active orders to fit byte ceiling');
});

test('Sharded finance_records & admin_controls obey < 550 KB budget and union-merge subcollection history', () => {
  const largeDescription = 'D'.repeat(230);
  const journalEntries: JournalEntry[] = Array.from({ length: 300 }, (_, i) => ({
    id: `je-${i}`,
    businessId: 'biz-test',
    entryNumber: `JE-${String(i + 1).padStart(5, '0')}`,
    date: '2026-08-10',
    bsDate: '2083-04-25',
    referenceType: 'POS_SALE',
    referenceId: `ord-${i}`,
    referenceNo: `INV-${2000 + i}`,
    description: `${largeDescription} #${i}`,
    lines: [
      { accountId: 'acc-1010', accountCode: '1010', accountName: 'Cash in Hand', debit: 1500, credit: 0, memo: 'Cash sale receipt' },
      { accountId: 'acc-4010', accountCode: '4010', accountName: 'Food & Beverage Sales', debit: 0, credit: 1327.43, memo: 'Net revenue' },
      { accountId: 'acc-2020', accountCode: '2020', accountName: 'VAT Payable (13%)', debit: 0, credit: 172.57, memo: 'Output VAT' }
    ],
    totalDebit: 1500,
    totalCredit: 1500,
    createdByName: 'Cashier Sita',
    createdAt: `2026-08-10T10:${String(i % 60).padStart(2, '0')}:00.000Z`
  }));

  const creditNotes: CreditNoteRecord[] = Array.from({ length: 200 }, (_, i) => ({
    id: `cn-${i}`,
    businessId: 'biz-test',
    creditNoteNo: `CN-2083-${String(i + 1).padStart(4, '0')}`,
    originalOrderId: `ord-${i}`,
    originalInvoiceNo: `INV-${2000 + i}`,
    fiscalYear: '2083/84',
    bsDate: '2083-04-25',
    adDate: '2026-08-10',
    reason: 'Returned item after preparation quality check',
    subtotal: 1200,
    discountAmount: 0,
    serviceChargeAmount: 120,
    vatAmount: 171.6,
    grandTotal: 1491.6,
    paymentMethod: 'cash',
    buyerName: `Guest Customer #${i}`,
    buyerPan: '304567890',
    issuedByName: 'Manager Hari',
    createdAt: `2026-08-10T11:${String(i % 60).padStart(2, '0')}:00.000Z`,
    items: Array.from({ length: 12 }, (_, k) => ({
      id: `oi-${k}`,
      menuItemId: `m-${k}`,
      code: `D-${k}`,
      name: `Returned Dish #${k} with Full Sides & Beverage`,
      nepaliName: `परिकार ${k}`,
      category: 'snacks' as const,
      price: 100,
      quantity: 1,
      kotStatus: 'served' as const
    }))
  }));

  const customers: Customer[] = Array.from({ length: 400 }, (_, i) => ({
    id: `cust-${i}`,
    name: `Regular Customer With Long Hospitality Profile Name #${i}`,
    phone: `984100${String(i).padStart(4, '0')}`,
    customerType: 'regular',
    creditBalance: i * 100,
    loyaltyPoints: i * 10,
    totalSpend: i * 500,
    totalVisits: 1 + (i % 10),
    createdAt: '2026-08-01',
    notes: 'Frequent corporate dining account holder with monthly settlement billing ' + 'X'.repeat(200)
  }));

  const expenses: Expense[] = Array.from({ length: 300 }, (_, i) => ({
    id: `exp-${i}`,
    title: `Kitchen Produce & Utility Procurement Batch #${i} - ${'Y'.repeat(120)}`,
    category: 'supplies',
    amount: 2500 + i,
    date: '2026-08-10',
    submittedBy: 'Manager',
    paymentMode: 'cash'
  }));

  const auditLogs: AuditLogEntry[] = Array.from({ length: 250 }, (_, i) => ({
    id: `aud-${i}`,
    timestamp: `2026-08-10 12:${String(i % 60).padStart(2, '0')}:00`,
    staffId: 'staff-1',
    staffName: 'Manager Hari',
    role: 'MANAGER',
    action: 'BILL_SETTLED',
    targetRecordId: `ord-${i}`,
    details: `Audit trail record #${i}: ${'Z'.repeat(300)}`,
    severity: 'INFO'
  }));

  const state: AppState = {
    ...makeCleanState(),
    customers,
    expenses,
    journalEntries,
    creditNotes,
    auditLogs
  };

  const financePayload = extractChannelPayload('finance_records', state);
  const adminPayload = extractChannelPayload('admin_controls', state);

  assert.ok(
    estimateUtf8ByteSize(financePayload) <= MAX_SYNC_CHANNEL_BYTES,
    `finance_records must stay <= ${MAX_SYNC_CHANNEL_BYTES} bytes`
  );
  assert.ok(
    estimateUtf8ByteSize(adminPayload) <= MAX_SYNC_CHANNEL_BYTES,
    `admin_controls must stay <= ${MAX_SYNC_CHANNEL_BYTES} bytes`
  );
  assert.ok((financePayload.journalEntries || []).length <= 25, 'journalEntries tail in syncChannel capped at 25');
  assert.ok((financePayload.creditNotes || []).length <= 25, 'creditNotes tail in syncChannel capped at 25');
  assert.ok((adminPayload.auditLogs || []).length <= 30, 'auditLogs tail in syncChannel capped at 30');

  // Verify union-merge preserves already-hydrated subcollection records beyond slimmed syncChannel tails
  const mergedFinanceState = mergeChannelPayloadIntoAppState(state, 'finance_records', financePayload);
  const mergedAdminState = mergeChannelPayloadIntoAppState(mergedFinanceState, 'admin_controls', adminPayload);
  assert.equal(mergedAdminState.journalEntries?.length, 300, 'Must preserve all 300 hydrated sharded journal entries');
  assert.equal(mergedAdminState.creditNotes?.length, 200, 'Must preserve all 200 hydrated sharded credit notes');
  assert.equal(mergedAdminState.auditLogs?.length, 250, 'Must preserve all 250 hydrated sharded audit logs');
});

test('Sharded JournalEntry & AuditLog sanitizers enforce schema bounds and clamping', () => {
  const dirtyJournal: JournalEntry = {
    id: 'je-dirty-1',
    businessId: 'biz-test',
    entryNumber: 'E'.repeat(100),
    date: '2026-08-12T10:00:00.000Z',
    bsDate: '2083-04-27',
    referenceType: 'INVALID_REF_TYPE' as any,
    referenceId: 'R'.repeat(200),
    referenceNo: 'N'.repeat(120),
    description: 'D'.repeat(400),
    lines: Array.from({ length: 40 }, (_, i) => ({
      accountId: `acc-${1000 + i}`,
      accountCode: `${1000 + i}`,
      accountName: 'Test Account',
      debit: i === 0 ? 100 : 0,
      credit: i === 1 ? 100 : 0
    })),
    totalDebit: -50,
    totalCredit: 0,
    createdByName: 'A'.repeat(200),
    createdAt: '2026-08-12T10:00:00.000Z'
  };

  const sanitizedJe = buildSanitizedJournalEntryPayload(dirtyJournal, 'biz-test', 'owner-1', 'user-1');
  assert.equal(sanitizedJe.referenceType, 'ADJUSTMENT', 'Invalid referenceType should normalize to ADJUSTMENT');
  assert.equal(sanitizedJe.lines.length, 30, 'Lines array must be clamped to max 30');
  assert.equal(sanitizedJe.entryNumber.length, 40);
  assert.equal(sanitizedJe.description.length, 240);
  assert.equal(sanitizedJe.totalDebit, 0.01);
  assert.equal(sanitizedJe.totalCredit, 0.01);

  const dirtyAudit: AuditLogEntry = {
    id: 'aud-dirty-1',
    timestamp: 'T'.repeat(80),
    staffId: 'S'.repeat(200),
    staffName: 'N'.repeat(200),
    role: 'OWNER' as any,
    action: 'X'.repeat(150),
    targetRecordId: 'T'.repeat(200),
    details: 'Z'.repeat(600),
    severity: 'BOGUS' as any
  };

  const sanitizedAudit = buildSanitizedAuditLogPayload(dirtyAudit, 'biz-test', 'owner-1', 'user-1');
  assert.equal(sanitizedAudit.severity, 'INFO', 'Unknown severity should normalize to INFO');
  assert.equal(sanitizedAudit.action.length, 80);
  assert.equal(sanitizedAudit.details.length, 400);
  assert.equal(sanitizedAudit.staffName.length, 120);
  assert.equal(sanitizedAudit.timestamp.length, 32);
});

test('Dynamic Floor Areas eliminate hardcoded fake areas and support Add, Rename, and Remove with table reassignment', () => {
  const sampleTables: TableRoom[] = [
    { id: 't-1', code: 'T-01', name: 'Table 1 (Indoor Cafe)', nepaliName: 'टेबल १', type: 'table', capacity: 2, status: 'available' },
    { id: 't-2', code: 'T-02', name: 'Table 2', nepaliName: 'टेबल २', type: 'table', area: 'Counter Zone', capacity: 4, status: 'available' },
    { id: 'rm-1', code: 'RM-101', name: 'Suite 101', nepaliName: 'सुइट १०१', type: 'room', capacity: 2, status: 'available', ratePerNight: 4500 }
  ];

  // Derived strictly from existing dining tables (no hardcoded Lakeside/Terrace/Garden)
  const initialDerived = deriveBusinessTableAreas(sampleTables, undefined);
  assert.deepEqual(initialDerived, ['Indoor Cafe', 'Counter Zone']);
  assert.equal(resolveTableArea(sampleTables[0]), 'Indoor Cafe');
  assert.equal(resolveTableArea(sampleTables[1]), 'Counter Zone');

  // Add new custom area + reject duplicate case-insensitively
  const added = addBusinessArea(initialDerived, 'First Floor');
  assert.equal(added.error, undefined);
  assert.deepEqual(added.areas, ['Indoor Cafe', 'Counter Zone', 'First Floor']);
  const dupAttempt = addBusinessArea(added.areas, 'first floor');
  assert.ok(dupAttempt.error, 'Should reject duplicate floor area');

  // Rename an area -> updates both area list and matching dining tables
  const renamed = renameBusinessArea(added.areas, sampleTables, 'Counter Zone', 'VIP Lounge');
  assert.equal(renamed.error, undefined);
  assert.deepEqual(renamed.areas, ['Indoor Cafe', 'VIP Lounge', 'First Floor']);
  assert.equal(renamed.tables[1].area, 'VIP Lounge');
  assert.equal(renamed.tables[2].area, undefined, 'Resort rooms must remain untouched');

  // Remove an area -> reassigns affected tables cleanly so removed area cannot ghost back from table name
  const removed = removeBusinessArea(renamed.areas, renamed.tables, 'Indoor Cafe');
  assert.deepEqual(removed.areas, ['VIP Lounge', 'First Floor']);
  assert.equal(resolveTableArea(removed.tables[0]), 'VIP Lounge');
});

test('Order settlement after KOT/Confirm draft never collides with prior draft idempotencyKey while blocking duplicate settlements', () => {
  localStorage.clear();
  const bizId = 'biz-settle-regression';

  const savedDraftOrder: Order = makeSampleOrder({
    id: 'ord-t06',
    status: 'active',
    paymentStatus: 'pending',
    paidAmount: 0,
    dueAmount: 621.5,
    grandTotal: 621.5,
    settledAt: undefined,
    version: 1,
    updatedAt: '2026-11-20T18:40:00.000Z',
    idempotencyKey: 'idemp-confirm-ord-t06-1763664000000'
  });

  // 1. Register initial draft/KOT save idempotency key
  const draftKey = resolveOrderMutationIdempotencyKey(savedDraftOrder, undefined, false);
  assert.equal(draftKey, savedDraftOrder.idempotencyKey);
  const draftReg = checkAndRegisterIdempotencyKey(bizId, draftKey, 'SAVE_ORDER', {
    orderId: savedDraftOrder.id,
    invoiceNo: savedDraftOrder.invoiceNo
  });
  assert.equal(draftReg.isDuplicate, false);

  // 2. Simulate BillsView settling by spreading existing checkoutOrder (which still carries draft key if caller didn't override)
  const inheritedSettleOrder: Order = {
    ...savedDraftOrder,
    status: 'completed',
    paymentStatus: 'paid',
    settledAt: '2026-11-20T18:45:00.000Z',
    updatedAt: '2026-11-20T18:45:00.000Z'
  };
  const resolvedSettleKey = resolveOrderMutationIdempotencyKey(inheritedSettleOrder, savedDraftOrder, true);
  assert.notEqual(
    resolvedSettleKey,
    draftKey,
    'Settlement must NEVER reuse the active draft/KOT idempotency key'
  );
  const settleReg = checkAndRegisterIdempotencyKey(bizId, resolvedSettleKey, 'SETTLE_PAYMENT', {
    orderId: savedDraftOrder.id,
    invoiceNo: savedDraftOrder.invoiceNo
  });
  assert.equal(settleReg.isDuplicate, false, 'Settlement of active KOT order must succeed cleanly');

  // 3. Explicit fresh settle key works once, and double-click with the same settle key IS caught as duplicate
  const explicitSettleOrder: Order = {
    ...savedDraftOrder,
    status: 'completed',
    settledAt: '2026-11-20T18:46:00.000Z',
    idempotencyKey: 'idemp-ord-t06-settle-pay-999'
  };
  const explicitKey = resolveOrderMutationIdempotencyKey(explicitSettleOrder, savedDraftOrder, true);
  assert.equal(explicitKey, 'idemp-ord-t06-settle-pay-999');
  assert.equal(checkAndRegisterIdempotencyKey(bizId, explicitKey, 'SETTLE_PAYMENT').isDuplicate, false);
  assert.equal(
    checkAndRegisterIdempotencyKey(bizId, explicitKey, 'SETTLE_PAYMENT').isDuplicate,
    true,
    'Repeated double-click with same payment settle key must be blocked'
  );
});

test('Quick Cash Notes support user-defined custom amounts, removal, and per-business persistence', () => {
  localStorage.clear();
  const bizId = 'biz-custom-notes';

  const initial = loadQuickCashNotes(bizId, undefined);
  assert.deepEqual(initial, [...DEFAULT_QUICK_CASH_NOTES]);

  const invalidRes = addCustomQuickCashNote(initial, '-50');
  assert.ok(invalidRes.error, 'Rejects non-positive note amount');

  const addedRes = addCustomQuickCashNote(initial, '750');
  assert.equal(addedRes.error, undefined);
  assert.equal(addedRes.added, 750);
  assert.ok(addedRes.notes.includes(750));

  const removed = removeQuickCashNote(addedRes.notes, 1500);
  assert.equal(removed.includes(1500), false);

  saveQuickCashNotes(removed, bizId);
  const reloaded = loadQuickCashNotes(bizId, undefined);
  assert.deepEqual(reloaded, removed);

  const visibleFor62150 = buildQuickCashOptionsForPayable(621.5, reloaded);
  assert.equal(visibleFor62150[0], 621.5, 'Starts with exact payable');
  assert.equal(visibleFor62150[1], 622, 'Includes next whole rupee for fractional paisa');
  assert.ok(visibleFor62150.includes(750), 'Includes user-added 750 note');
  assert.equal(visibleFor62150.includes(1500), false, 'Excludes removed 1500 note');
});


