import {
  BusinessSettings,
  CreditNoteRecord,
  Expense,
  Order,
  PurchaseOrder
} from '../types';
import { getBikramSambatDate } from '../utils/nepaliCalendar';
import { exportFinancialCSV } from './accounting';

const CN_COUNTER_PREFIX = 'hb_credit_note_seq_v1_';

function roundMoney(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/**
 * Returns Nepal Fiscal Year label (Shrawan–Ashadh), e.g., "2083/84".
 */
export function getNepalFiscalYear(date: Date = new Date()): string {
  const safeDate = isNaN(date.getTime()) ? new Date() : date;
  const bs = getBikramSambatDate(safeDate);
  // Shrawan is BS month 4 (1-based: Baisakh=1, Jestha=2, Ashadh=3, Shrawan=4)
  const startYear = bs.month >= 4 ? bs.year : bs.year - 1;
  const endTwoDigits = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${endTwoDigits}`;
}

export function formatBsIsoDate(date: Date = new Date()): string {
  const safeDate = isNaN(date.getTime()) ? new Date() : date;
  const bs = getBikramSambatDate(safeDate);
  const mm = String(bs.month).padStart(2, '0');
  const dd = String(bs.day).padStart(2, '0');
  return `${bs.year}-${mm}-${dd}`;
}

/**
 * Computes next sequential Credit Note number (e.g. CN-2083-0001) scoped per tenant.
 */
export function getNextCreditNoteNumber(
  existingCreditNotes: CreditNoteRecord[] = [],
  businessId?: string,
  persist: boolean = false,
  date: Date = new Date()
): string {
  const bs = getBikramSambatDate(date);
  const yearTag = String(bs.year);
  const prefix = `CN-${yearTag}-`;

  let maxSeq = 0;
  for (const cn of existingCreditNotes) {
    if (businessId && cn.businessId && cn.businessId !== businessId) continue;
    const raw = String(cn.creditNoteNo || '');
    const m = raw.match(/(\d+)$/);
    if (m) {
      const parsed = parseInt(m[1], 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  let storedSeq = 0;
  const storageKey = `${CN_COUNTER_PREFIX}${businessId || 'default'}`;
  if (typeof window !== 'undefined') {
    try {
      const rawStored = localStorage.getItem(storageKey);
      if (rawStored) {
        storedSeq = parseInt(rawStored, 10) || 0;
      }
    } catch {
      // ignore localStorage read issues
    }
  }

  const nextSeq = Math.max(maxSeq, storedSeq) + 1;

  if (persist && typeof window !== 'undefined') {
    try {
      localStorage.setItem(storageKey, String(nextSeq));
    } catch {
      // ignore quota error
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Builds an immutable IRD Annex-5 Credit Note record when a settled Tax Invoice is voided/returned.
 */
export function createCreditNoteFromOrder(
  order: Order,
  creditNoteNo: string,
  reason: string,
  issuedByName: string,
  businessId: string,
  now: Date = new Date()
): CreditNoteRecord {
  const fiscalYear = order.fiscalYear || getNepalFiscalYear(now);
  const bsDate = formatBsIsoDate(now);
  const adDate = now.toISOString().split('T')[0];

  return {
    id: `cn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    businessId,
    creditNoteNo,
    originalOrderId: order.id,
    originalInvoiceNo: order.invoiceNo || order.id,
    fiscalYear,
    bsDate,
    adDate,
    reason: reason.trim() || 'Customer Return / Order Voided',
    subtotal: roundMoney(order.subtotal || 0),
    discountAmount: roundMoney(order.discountAmount || 0),
    serviceChargeAmount: roundMoney(order.serviceChargeAmount || 0),
    vatAmount: roundMoney(order.vatAmount || 0),
    grandTotal: roundMoney(order.grandTotal || 0),
    paymentMethod: order.paymentMethod || 'cash',
    buyerName: order.customerName || 'Walk-in Guest',
    buyerPan: order.buyerPan || '',
    issuedByName: issuedByName || 'Manager',
    items: (order.items || []).map(i => ({ ...i })),
    cbmsSynced: false,
    createdAt: now.toISOString()
  };
}

export interface SalesVatRegisterRow {
  id: string;
  entryType: 'INVOICE' | 'CREDIT_NOTE';
  adDate: string;
  bsDate: string;
  fiscalYear: string;
  documentNo: string;
  referenceInvoiceNo?: string;
  buyerName: string;
  buyerPan: string;
  totalSales: number;
  exemptSales: number;
  taxableSales: number;
  vatAmount: number;
  serviceCharge: number;
  grandTotal: number;
  paymentMethod: string;
  reason?: string;
  cbmsSynced: boolean;
}

/**
 * Builds Annex-5 Sales VAT Register (Bikri Khata) rows.
 * Includes settled Tax Invoices (plus invoices subsequently reversed via Credit Note)
 * AND offsetting negative Credit Note rows so both Gross and Net VAT match IRD rules.
 */
export function buildSalesVatRegisterRows(
  orders: Order[],
  creditNotes: CreditNoteRecord[] = [],
  monthPrefixAd?: string
): SalesVatRegisterRow[] {
  const rows: SalesVatRegisterRow[] = [];
  const cnByOrderId = new Map<string, CreditNoteRecord>();
  for (const cn of creditNotes) {
    cnByOrderId.set(cn.originalOrderId, cn);
  }

  for (const order of orders) {
    // Include completed orders, OR voided orders that had a Credit Note issued after settlement
    const linkedCn = cnByOrderId.get(order.id);
    const isSettledTaxDoc = order.status === 'completed' || Boolean(linkedCn) || Boolean(order.settledAt);
    if (!isSettledTaxDoc) continue;
    // Skip pure draft/never-settled cancellations with no invoice history
    if (order.status === 'cancelled' && !linkedCn && !order.settledAt) continue;

    const refDateStr = order.settledAt || order.createdAt;
    const adDate = (refDateStr || '').substring(0, 10);
    if (monthPrefixAd && !adDate.startsWith(monthPrefixAd)) continue;

    const dateObj = new Date(refDateStr);
    const bsDate = order.bsDate || formatBsIsoDate(dateObj);
    const fiscalYear = order.fiscalYear || getNepalFiscalYear(dateObj);

    const vatAmt = roundMoney(order.vatAmount || 0);
    const scAmt = roundMoney(order.serviceChargeAmount || 0);
    const netBeforeVat = roundMoney((order.subtotal || 0) - (order.discountAmount || 0) + scAmt);
    const taxableSales = vatAmt > 0 ? netBeforeVat : 0;
    const exemptSales = vatAmt > 0 ? 0 : netBeforeVat;

    rows.push({
      id: `sv-${order.id}`,
      entryType: 'INVOICE',
      adDate,
      bsDate,
      fiscalYear,
      documentNo: order.invoiceNo || order.id,
      buyerName: order.customerName || 'Walk-in Customer',
      buyerPan: order.buyerPan || '',
      totalSales: netBeforeVat,
      exemptSales,
      taxableSales,
      vatAmount: vatAmt,
      serviceCharge: scAmt,
      grandTotal: roundMoney(order.grandTotal || 0),
      paymentMethod: order.paymentMethod || 'cash',
      cbmsSynced: Boolean(order.cbmsSynced)
    });
  }

  for (const cn of creditNotes) {
    const adDate = (cn.adDate || cn.createdAt || '').substring(0, 10);
    if (monthPrefixAd && !adDate.startsWith(monthPrefixAd)) continue;

    const vatAmt = roundMoney(cn.vatAmount || 0);
    const scAmt = roundMoney(cn.serviceChargeAmount || 0);
    const netBeforeVat = roundMoney((cn.subtotal || 0) - (cn.discountAmount || 0) + scAmt);
    const taxableSales = vatAmt > 0 ? -netBeforeVat : 0;
    const exemptSales = vatAmt > 0 ? 0 : -netBeforeVat;

    rows.push({
      id: `sv-${cn.id}`,
      entryType: 'CREDIT_NOTE',
      adDate,
      bsDate: cn.bsDate,
      fiscalYear: cn.fiscalYear,
      documentNo: cn.creditNoteNo,
      referenceInvoiceNo: cn.originalInvoiceNo,
      buyerName: cn.buyerName || 'Walk-in Customer',
      buyerPan: cn.buyerPan || '',
      totalSales: -netBeforeVat,
      exemptSales,
      taxableSales,
      vatAmount: -vatAmt,
      serviceCharge: -scAmt,
      grandTotal: -roundMoney(cn.grandTotal || 0),
      paymentMethod: String(cn.paymentMethod || 'cash'),
      reason: cn.reason,
      cbmsSynced: Boolean(cn.cbmsSynced)
    });
  }

  return rows.sort((a, b) => a.adDate.localeCompare(b.adDate) || a.documentNo.localeCompare(b.documentNo));
}

export interface PurchaseVatRegisterRow {
  id: string;
  source: 'PURCHASE_ORDER' | 'EXPENSE';
  adDate: string;
  bsDate: string;
  billNumber: string;
  supplierName: string;
  supplierPan: string;
  taxablePurchase: number;
  exemptPurchase: number;
  vatPaid: number;
  totalAmount: number;
}

/**
 * Builds Annex-5 Purchase VAT Register (Kharid Khata) rows from received POs and recorded Expenses.
 */
export function buildPurchaseVatRegisterRows(
  purchaseOrders: PurchaseOrder[] = [],
  expenses: Expense[] = [],
  monthPrefixAd?: string
): PurchaseVatRegisterRow[] {
  const rows: PurchaseVatRegisterRow[] = [];

  for (const po of purchaseOrders) {
    if (po.status === 'CANCELLED') continue;
    const rawDate = po.receivedDate || po.orderDate;
    const adDate = (rawDate || '').substring(0, 10);
    if (monthPrefixAd && !adDate.startsWith(monthPrefixAd)) continue;

    const d = new Date(rawDate);
    const vatPaid = roundMoney(po.taxTotal || 0);
    const base = roundMoney((po.subtotal || 0) - (po.discountTotal || 0));

    rows.push({
      id: `pv-po-${po.id}`,
      source: 'PURCHASE_ORDER',
      adDate,
      bsDate: formatBsIsoDate(d),
      billNumber: po.poNumber || po.id,
      supplierName: po.supplierName || 'Vendor',
      supplierPan: '',
      taxablePurchase: vatPaid > 0 ? base : 0,
      exemptPurchase: vatPaid > 0 ? 0 : base,
      vatPaid,
      totalAmount: roundMoney(po.grandTotal || 0)
    });
  }

  for (const exp of expenses) {
    const adDate = (exp.date || '').substring(0, 10);
    if (monthPrefixAd && !adDate.startsWith(monthPrefixAd)) continue;

    const d = new Date(exp.date);
    const total = roundMoney(exp.amount || 0);

    rows.push({
      id: `pv-exp-${exp.id}`,
      source: 'EXPENSE',
      adDate,
      bsDate: formatBsIsoDate(d),
      billNumber: exp.billNumber || exp.id,
      supplierName: exp.title,
      supplierPan: '',
      taxablePurchase: 0,
      exemptPurchase: total,
      vatPaid: 0,
      totalAmount: total
    });
  }

  return rows.sort((a, b) => a.adDate.localeCompare(b.adDate));
}

export function summarizeSalesVatRegister(rows: SalesVatRegisterRow[]) {
  return rows.reduce(
    (acc, r) => {
      if (r.entryType === 'INVOICE') {
        acc.invoiceCount += 1;
        acc.grossTaxable += r.taxableSales;
        acc.grossVat += r.vatAmount;
      } else {
        acc.creditNoteCount += 1;
        acc.returnedTaxable += Math.abs(r.taxableSales);
        acc.returnedVat += Math.abs(r.vatAmount);
      }
      acc.netExempt = roundMoney(acc.netExempt + r.exemptSales);
      acc.netTaxable = roundMoney(acc.netTaxable + r.taxableSales);
      acc.netVatPayable = roundMoney(acc.netVatPayable + r.vatAmount);
      acc.netTotalSales = roundMoney(acc.netTotalSales + r.grandTotal);
      return acc;
    },
    {
      invoiceCount: 0,
      creditNoteCount: 0,
      grossTaxable: 0,
      grossVat: 0,
      returnedTaxable: 0,
      returnedVat: 0,
      netExempt: 0,
      netTaxable: 0,
      netVatPayable: 0,
      netTotalSales: 0
    }
  );
}

export function exportAnnex5SalesCSV(
  rows: SalesVatRegisterRow[],
  businessName: string,
  panVatNumber: string,
  periodLabel: string
) {
  const headers = [
    'Miti (BS)',
    'Date (AD)',
    'Fiscal Year',
    'Doc Type',
    'Invoice / CN No',
    'Ref Invoice No',
    'Buyer Name',
    'Buyer PAN',
    'Total Sales (Excl VAT)',
    'Exempt Sales',
    'Taxable Sales',
    'VAT (13%)',
    'Grand Total',
    'CBMS Synced'
  ];

  const data = rows.map(r => [
    r.bsDate,
    r.adDate,
    r.fiscalYear,
    r.entryType,
    r.documentNo,
    r.referenceInvoiceNo || '',
    r.buyerName,
    r.buyerPan,
    r.totalSales.toFixed(2),
    r.exemptSales.toFixed(2),
    r.taxableSales.toFixed(2),
    r.vatAmount.toFixed(2),
    r.grandTotal.toFixed(2),
    r.cbmsSynced ? 'YES' : 'PENDING'
  ]);

  const safeSlug = `${businessName.replace(/[^a-zA-Z0-9]+/g, '_')}_PAN_${panVatNumber || 'NA'}_Annex5_BikriKhata_${periodLabel}`;
  exportFinancialCSV(safeSlug, headers, data);
}

export function exportAnnex5PurchaseCSV(
  rows: PurchaseVatRegisterRow[],
  businessName: string,
  panVatNumber: string,
  periodLabel: string
) {
  const headers = [
    'Miti (BS)',
    'Date (AD)',
    'Source',
    'Bill / PO Number',
    'Supplier / Payee',
    'Supplier PAN',
    'Taxable Purchase',
    'Non-VAT / Exempt Purchase',
    'VAT Paid',
    'Total Purchase'
  ];

  const data = rows.map(r => [
    r.bsDate,
    r.adDate,
    r.source,
    r.billNumber,
    r.supplierName,
    r.supplierPan,
    r.taxablePurchase.toFixed(2),
    r.exemptPurchase.toFixed(2),
    r.vatPaid.toFixed(2),
    r.totalAmount.toFixed(2)
  ]);

  const safeSlug = `${businessName.replace(/[^a-zA-Z0-9]+/g, '_')}_PAN_${panVatNumber || 'NA'}_Annex5_KharidKhata_${periodLabel}`;
  exportFinancialCSV(safeSlug, headers, data);
}

export function buildCbmsBatchPayload(
  rows: SalesVatRegisterRow[],
  settings: BusinessSettings
) {
  return {
    sellerPan: settings.panVatNumber || '',
    sellerName: settings.businessName,
    fiscalYear: settings.irdSettings?.fiscalYearLabel || getNepalFiscalYear(),
    username: settings.irdSettings?.cbmsUsername || '',
    exportedAt: new Date().toISOString(),
    recordCount: rows.length,
    records: rows.map(r => ({
      fiscal_year: r.fiscalYear,
      invoice_number: r.documentNo,
      reference_invoice_number: r.referenceInvoiceNo || null,
      invoice_date: r.bsDate,
      invoice_date_ad: r.adDate,
      customer_name: r.buyerName,
      customer_pan: r.buyerPan,
      total_sales: r.grandTotal,
      taxable_sales: r.taxableSales,
      vat: r.vatAmount,
      tax_exempted_sales: r.exemptSales,
      is_realtime: false,
      datetimeclient: new Date().toISOString(),
      is_credit_note: r.entryType === 'CREDIT_NOTE'
    }))
  };
}

export async function submitCbmsInvoiceToEndpoint(
  order: Order,
  settings: BusinessSettings
): Promise<{ synced: boolean; message: string }> {
  const endpoint = settings.irdSettings?.cbmsEndpoint?.trim();
  if (!settings.irdSettings?.cbmsEnabled || !endpoint) {
    return { synced: false, message: 'CBMS real-time endpoint not configured (queued locally).' };
  }

  try {
    const payload = buildCbmsBatchPayload(buildSalesVatRegisterRows([order], []), settings);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.records[0])
    });
    if (!res.ok) {
      return { synced: false, message: `CBMS HTTP ${res.status}` };
    }
    return { synced: true, message: 'CBMS real-time sync accepted.' };
  } catch (err: any) {
    return { synced: false, message: err?.message || 'CBMS endpoint unreachable (stored offline).' };
  }
}
