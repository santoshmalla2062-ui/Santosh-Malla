import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReceiptNepaliDate, getBikramSambatDate } from '../utils/nepaliCalendar';
import {
  buildReceiptPaymentRows,
  buildWhatsAppBillUrl,
  formatPlainTextReceipt,
  normalizeWhatsAppPhone
} from '../utils/receiptFormatter';
import { BusinessSettings, Order } from '../types';

const sampleSettings: BusinessSettings = {
  businessName: 'Naulo Hospitality',
  tagline: 'Fine Dining & Cafe',
  nepaliBusinessName: 'नौलो हस्पिटालिटी',
  address: 'Pulchowk, Lalitpur',
  phone: '9861157870',
  email: 'info@naulo.example',
  panVatNumber: '601234567',
  currencySymbol: 'Rs.',
  enableVat: true,
  vatRatePercent: 13,
  enableServiceCharge: true,
  serviceChargePercent: 10,
  receiptFooterMessage: 'Thank you, please come again',
  enableSoundEffects: false,
  defaultLanguage: 'en',
  fonepayMerchantName: 'Naulo QR',
  sessionTimeoutMinutes: 60
};

const baseOrder: Order = {
  id: 'ord-r-1',
  invoiceNo: 'INV-1042',
  kotNo: 'KOT-311',
  tableRoomId: 'tr-5',
  tableRoomName: 'Table 5',
  tableRoomType: 'table',
  orderType: 'dine_in',
  guestCount: 4,
  cashierName: 'Sita Cash',
  waiterName: 'Rohan Server',
  items: [
    {
      id: 'it-1',
      menuItemId: 'm-1',
      code: 'M1',
      name: 'Chicken Momo',
      nepaliName: 'चिकेन मम',
      price: 250,
      quantity: 2,
      category: 'snacks'
    }
  ],
  subtotal: 500,
  discountPercent: 0,
  discountAmount: 0,
  serviceChargeAmount: 50,
  vatAmount: 71.5,
  grandTotal: 621.5,
  paidAmount: 621.5,
  dueAmount: 0,
  paymentMethod: 'cash',
  paymentStatus: 'paid',
  createdAt: '2026-11-09 12:15',
  settledAt: '2026-11-09 12:18',
  status: 'completed'
};

test('Receipt Formatting: Exact Bikram Sambat date calculation matching photo', () => {
  // Test reference date: Nov 9, 2026 12:18 PM => 2083 Kartik 23, 12:18 PM
  const testDate = new Date('2026-11-09T12:18:00');
  const formatted = formatReceiptNepaliDate(testDate);

  assert.equal(formatted, '2083 Kartik 23, 12:18 PM');

  const bs = getBikramSambatDate(testDate);
  assert.equal(bs.year, 2083);
  assert.equal(bs.monthNameEn, 'Kartik');
  assert.equal(bs.day, 23);
  assert.equal(bs.timeString, '12:18 PM');
});

test('Receipt Formatting: AM/PM hour formatting', () => {
  const morningDate = new Date('2026-11-09T09:05:00');
  const morningBs = getBikramSambatDate(morningDate);
  assert.equal(morningBs.timeString, '9:05 AM');

  const eveningDate = new Date('2026-11-09T20:45:00');
  const eveningBs = getBikramSambatDate(eveningDate);
  assert.equal(eveningBs.timeString, '8:45 PM');
});

test('Receipt Formatting: Bill Print Format is 100% English Only with zero Devanagari', () => {
  const devanagariRegex = /[\u0900-\u097F]/;
  const displayDateStr = formatReceiptNepaliDate(new Date('2026-11-09T12:18:00'));
  assert.equal(devanagariRegex.test(displayDateStr), false, 'Receipt date must use English/Latin script');

  const splitOrder: Order = {
    ...baseOrder,
    parentSplitOrderId: 'ord-parent-1',
    paymentMethod: 'split',
    paidAmount: 500,
    dueAmount: 121.5,
    paymentDetails: {
      cash: 200,
      fonepay: 150,
      esewa: 150,
      credit: 121.5
    },
    customerName: 'Aarav Shrestha'
  };

  const fullReceiptText = formatPlainTextReceipt({
    order: splitOrder,
    settings: sampleSettings,
    billType: 'tax_invoice',
    displayDateStr
  });

  assert.equal(devanagariRegex.test(fullReceiptText), false, 'Printed receipt must never contain Devanagari characters');
  assert.ok(fullReceiptText.includes('TAX INVOICE'));
  assert.ok(fullReceiptText.includes('(SPLIT BILL)'));
  assert.ok(fullReceiptText.includes('4 PAX'));
  assert.ok(fullReceiptText.includes('Fonepay QR'));
  assert.ok(fullReceiptText.includes('eSewa'));
  assert.ok(fullReceiptText.includes('Balance Due'));
  assert.ok(!fullReceiptText.includes('Cash received'), 'Split bill must not emit bogus Cash received');
  assert.ok(fullReceiptText.includes('Cashier') && fullReceiptText.includes('Sita Cash'));
  assert.ok(fullReceiptText.includes('Server') && fullReceiptText.includes('Rohan Server'));
});

test('Receipt Formatting: Payment rows distinguish Cash Change, Fonepay Ref, Khata Due and Estimate Slip', () => {
  const devanagariRegex = /[\u0900-\u097F]/;

  // 1. Cash with tendered > payable shows Cash tendered & Change returned
  const cashTenderOrder: Order = {
    ...baseOrder,
    paymentMethod: 'cash',
    cashTendered: 1000,
    changeReturned: 378.5
  };
  const cashRows = buildReceiptPaymentRows(cashTenderOrder, 'tax_invoice');
  assert.deepStrictEqual(cashRows.map((r) => r.label), ['Cash', 'Cash tendered', 'Change returned']);

  // 2. Digital Fonepay QR with Reference No never shows "Cash received"
  const qrOrder: Order = {
    ...baseOrder,
    paymentMethod: 'fonepay_qr',
    paymentReference: 'FP-88341'
  };
  const qrRows = buildReceiptPaymentRows(qrOrder, 'tax_invoice');
  assert.deepStrictEqual(qrRows.map((r) => r.label), ['Fonepay QR', 'Ref No.']);
  assert.equal(qrRows[1].amountText, 'FP-88341');

  // 3. Khata Credit bill
  const khataOrder: Order = {
    ...baseOrder,
    paymentMethod: 'credit_khata',
    paidAmount: 0,
    dueAmount: 621.5
  };
  const khataRows = buildReceiptPaymentRows(khataOrder, 'tax_invoice');
  assert.deepStrictEqual(khataRows.map((r) => r.label), ['Khata / Credit Due']);

  // 4. Open Estimate slip
  const openOrder: Order = { ...baseOrder, status: 'active' };
  const estRows = buildReceiptPaymentRows(openOrder, 'estimate');
  assert.deepStrictEqual(estRows.map((r) => r.label), ['Payable Total']);

  for (const row of [...cashRows, ...qrRows, ...khataRows, ...estRows]) {
    assert.equal(devanagariRegex.test(row.label), false);
    assert.equal(devanagariRegex.test(row.amountText), false);
  }
});

test('Receipt Formatting: WhatsApp bill share normalizes Nepali numbers and encodes full bill summary', () => {
  assert.equal(normalizeWhatsAppPhone('9841234567'), '9779841234567');
  assert.equal(normalizeWhatsAppPhone('+977 980-1234567'), '9779801234567');
  assert.equal(normalizeWhatsAppPhone(''), '');

  const waUrl = buildWhatsAppBillUrl({
    order: { ...baseOrder, customerPhone: '9841234567', customerName: 'Ramesh' },
    settings: sampleSettings,
    billType: 'tax_invoice',
    displayDateStr: '2083-07-23 12:18 PM'
  });

  assert.ok(waUrl.startsWith('https://wa.me/9779841234567?text='));
  const decodedMsg = decodeURIComponent(waUrl.split('?text=')[1]);
  assert.ok(decodedMsg.includes('*Naulo Hospitality*'));
  assert.ok(decodedMsg.includes('TAX INVOICE'));
  assert.ok(decodedMsg.includes('*GRAND TOTAL: Rs.621.50*'));

  const genericWaUrl = buildWhatsAppBillUrl({
    order: { ...baseOrder, customerPhone: undefined },
    settings: sampleSettings,
    billType: 'estimate',
    displayDateStr: '2083-07-23 12:18 PM'
  });
  assert.ok(genericWaUrl.startsWith('https://wa.me/?text='));
});



