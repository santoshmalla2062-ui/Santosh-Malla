import {
  AppState,
  ChartAccount,
  CreditNoteRecord,
  Expense,
  HotelPaymentRecord,
  JournalEntry,
  JournalLine,
  KhataTransaction,
  Order
} from '../types';
import { ensureDefaultChartAccounts } from './accounting';
import { classifyOrderPayment } from './orderAudit';
import { formatBsIsoDate } from './irdCompliance';

function roundMoney(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function nextJournalEntryNumber(existing: JournalEntry[] = []): string {
  let maxSeq = 0;
  for (const je of existing) {
    const m = String(je.entryNumber || '').match(/(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `JE-${String(maxSeq + 1).padStart(5, '0')}`;
}

function lookupAccount(accounts: ChartAccount[], code: string, fallbackName: string): ChartAccount {
  return (
    accounts.find(a => a.code === code) || {
      id: `acc-${code}`,
      code,
      name: fallbackName,
      category: code.startsWith('1')
        ? 'ASSET'
        : code.startsWith('2')
        ? 'LIABILITY'
        : code.startsWith('3')
        ? 'EQUITY'
        : code.startsWith('4')
        ? 'REVENUE'
        : 'EXPENSE',
      balance: 0,
      isSystem: true
    }
  );
}

/**
 * Normal-balance account update rule:
 * - ASSET & EXPENSE increase on Debit, decrease on Credit.
 * - LIABILITY, EQUITY & REVENUE increase on Credit, decrease on Debit.
 */
function applyJournalLinesToAccounts(accounts: ChartAccount[], lines: JournalLine[]): ChartAccount[] {
  const deltaByCode = new Map<string, number>();
  for (const line of lines) {
    deltaByCode.set(line.accountCode, roundMoney((deltaByCode.get(line.accountCode) || 0) + (line.debit - line.credit)));
  }

  return accounts.map(acc => {
    const netDebitDelta = deltaByCode.get(acc.code);
    if (netDebitDelta === undefined || netDebitDelta === 0) return acc;
    const isDebitNormal = acc.category === 'ASSET' || acc.category === 'EXPENSE';
    const signedChange = isDebitNormal ? netDebitDelta : -netDebitDelta;
    return {
      ...acc,
      balance: roundMoney((Number(acc.balance) || 0) + signedChange)
    };
  });
}

function hasDuplicateJournal(
  entries: JournalEntry[] | undefined,
  referenceType: JournalEntry['referenceType'],
  referenceId: string
): boolean {
  if (!entries || !referenceId) return false;
  return entries.some(e => e.referenceType === referenceType && e.referenceId === referenceId);
}

function commitBalancedJournal(
  state: AppState,
  draft: Omit<JournalEntry, 'entryNumber' | 'totalDebit' | 'totalCredit'>
): { journalEntries: JournalEntry[]; accounts: ChartAccount[] } {
  const businessId = state.businessId || 'default';
  const accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  const existingEntries = state.journalEntries || [];

  if (hasDuplicateJournal(existingEntries, draft.referenceType, draft.referenceId)) {
    return { journalEntries: existingEntries, accounts };
  }

  const cleanLines = draft.lines.filter(l => roundMoney(l.debit) > 0 || roundMoney(l.credit) > 0);
  if (cleanLines.length < 2) {
    return { journalEntries: existingEntries, accounts };
  }

  let totalDebit = roundMoney(cleanLines.reduce((s, l) => s + roundMoney(l.debit), 0));
  let totalCredit = roundMoney(cleanLines.reduce((s, l) => s + roundMoney(l.credit), 0));

  // Strictly absorb any 0.01–0.05 rounding variance so DR === CR to the exact paisa
  const diff = roundMoney(totalDebit - totalCredit);
  if (Math.abs(diff) > 0 && Math.abs(diff) <= 1) {
    const lastCreditIdx = [...cleanLines].reverse().findIndex(l => l.credit > 0);
    if (lastCreditIdx >= 0) {
      const targetIdx = cleanLines.length - 1 - lastCreditIdx;
      cleanLines[targetIdx] = {
        ...cleanLines[targetIdx],
        credit: roundMoney(cleanLines[targetIdx].credit + diff)
      };
      totalCredit = roundMoney(cleanLines.reduce((s, l) => s + roundMoney(l.credit), 0));
    }
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01 || totalDebit <= 0) {
    return { journalEntries: existingEntries, accounts };
  }

  const entry: JournalEntry = {
    ...draft,
    entryNumber: nextJournalEntryNumber(existingEntries),
    lines: cleanLines,
    totalDebit,
    totalCredit
  };

  const updatedAccounts = applyJournalLinesToAccounts(accounts, cleanLines);
  return {
    journalEntries: [entry, ...existingEntries],
    accounts: updatedAccounts
  };
}

function resolvePaymentAssetAccountCode(method?: string): { code: string; name: string } {
  const m = String(method || 'cash').toLowerCase();
  if (m === 'bank' || m === 'bank_transfer' || m === 'card' || m === 'cheque') {
    return { code: '1020', name: 'Bank Account' };
  }
  if (m === 'fonepay_qr' || m === 'fonepay' || m === 'esewa' || m === 'khalti' || m === 'qr') {
    return { code: '1030', name: 'Fonepay / QR Settlement Cleared' };
  }
  if (m === 'credit_khata' || m === 'credit') {
    return { code: '1040', name: 'Accounts Receivable (Customer Khata)' };
  }
  if (m === 'charge_to_room') {
    return { code: '1045', name: 'Guest Room Folio Receivable' };
  }
  return { code: '1010', name: 'Cash on Hand (Till / Drawer)' };
}

/**
 * Posts balanced Double-Entry Journal for a completed POS Order (supports split, khata credit, room charge, digital & cash).
 */
export function postOrderSettlementJournal(
  state: AppState,
  order: Order,
  actorName: string = 'Cashier'
): { journalEntries: JournalEntry[]; accounts: ChartAccount[] } {
  const businessId = state.businessId || 'default';
  const accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  if (order.status !== 'completed' || (Number(order.grandTotal) || 0) <= 0) {
    return { journalEntries: state.journalEntries || [], accounts };
  }

  const lines: JournalLine[] = [];
  const p = classifyOrderPayment(order);

  const pushDebit = (code: string, amount: number, memo?: string) => {
    const amt = roundMoney(amount);
    if (amt <= 0) return;
    const acc = lookupAccount(accounts, code, code);
    lines.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      debit: amt,
      credit: 0,
      memo
    });
  };

  const pushCredit = (code: string, amount: number, memo?: string) => {
    const amt = roundMoney(amount);
    if (amt <= 0) return;
    const acc = lookupAccount(accounts, code, code);
    lines.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      debit: 0,
      credit: amt,
      memo
    });
  };

  pushDebit('1010', p.cash, `Cash received ${order.invoiceNo}`);
  pushDebit('1030', p.fonepayQr + p.esewa + p.khalti, `Digital Wallet/QR ${order.invoiceNo}`);
  pushDebit('1020', p.card + p.bank, `Card/Bank settlement ${order.invoiceNo}`);
  pushDebit('1040', p.khataCredit, `Customer Khata credit ${order.invoiceNo}`);
  pushDebit('1045', p.roomCharge, `Room Folio transfer ${order.invoiceNo}`);

  // If classification had any gap vs grandTotal, route to primary payment method so debits equal grandTotal
  const classifiedDebit = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
  const debitResidual = roundMoney((order.grandTotal || 0) - classifiedDebit);
  if (Math.abs(debitResidual) > 0.01) {
    const primaryAcc = resolvePaymentAssetAccountCode(order.paymentMethod);
    pushDebit(primaryAcc.code, debitResidual, `Balance settlement ${order.invoiceNo}`);
  }

  // Revenue split between Food (4010) and Beverage (4020)
  let rawFood = 0;
  let rawBev = 0;
  for (const item of order.items || []) {
    const amt = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    const cat = String(item.category || '').toLowerCase();
    if (cat === 'coffee' || cat === 'tea' || cat === 'cold_drinks' || cat === 'mocktails' || cat === 'cafe_beverages') {
      rawBev += amt;
    } else {
      rawFood += amt;
    }
  }
  const vatAmt = roundMoney(order.vatAmount || 0);
  const scAmt = roundMoney(order.serviceChargeAmount || 0);
  const netProductSales = roundMoney((order.grandTotal || 0) - vatAmt - scAmt);
  const totalRaw = rawFood + rawBev;

  if (netProductSales > 0) {
    if (totalRaw > 0 && rawBev > 0 && rawFood > 0) {
      const bevShare = roundMoney((netProductSales * rawBev) / totalRaw);
      const foodShare = roundMoney(netProductSales - bevShare);
      pushCredit('4010', foodShare, `Food Sales ${order.invoiceNo}`);
      pushCredit('4020', bevShare, `Beverage Sales ${order.invoiceNo}`);
    } else if (rawBev > 0 && rawFood === 0) {
      pushCredit('4020', netProductSales, `Beverage Sales ${order.invoiceNo}`);
    } else {
      pushCredit('4010', netProductSales, `Food Sales ${order.invoiceNo}`);
    }
  }

  pushCredit('4040', scAmt, `Service Charge ${order.invoiceNo}`);
  pushCredit('2020', vatAmt, `Output VAT 13% ${order.invoiceNo}`);

  const dateStr = (order.settledAt || order.createdAt || new Date().toISOString()).split('T')[0];
  return commitBalancedJournal(state, {
    id: `je-sale-${order.id}`,
    businessId,
    date: dateStr,
    bsDate: order.bsDate || formatBsIsoDate(new Date(dateStr)),
    referenceType: 'POS_SALE',
    referenceId: order.id,
    referenceNo: order.invoiceNo,
    description: `POS Bill Settled: ${order.invoiceNo} (${order.tableRoomName})`,
    lines,
    createdByName: actorName || order.cashierName || 'Cashier',
    createdAt: new Date().toISOString()
  });
}

/**
 * Posts balanced Reversal Journal Entry when a settled Tax Invoice is voided via a Credit Note.
 */
export function postCreditNoteJournal(
  state: AppState,
  cn: CreditNoteRecord,
  actorName: string = 'Manager'
): { journalEntries: JournalEntry[]; accounts: ChartAccount[] } {
  const businessId = state.businessId || 'default';
  const accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  if ((Number(cn.grandTotal) || 0) <= 0) {
    return { journalEntries: state.journalEntries || [], accounts };
  }

  const vatAmt = roundMoney(cn.vatAmount || 0);
  const scAmt = roundMoney(cn.serviceChargeAmount || 0);
  const netSalesReturn = roundMoney((cn.grandTotal || 0) - vatAmt - scAmt);

  const lines: JournalLine[] = [];
  if (netSalesReturn > 0) {
    const acc4090 = lookupAccount(accounts, '4090', 'Sales Returns & Credit Notes');
    lines.push({
      accountId: acc4090.id,
      accountCode: acc4090.code,
      accountName: acc4090.name,
      debit: netSalesReturn,
      credit: 0,
      memo: `Sales return ${cn.creditNoteNo} (${cn.originalInvoiceNo})`
    });
  }
  if (scAmt > 0) {
    const acc4040 = lookupAccount(accounts, '4040', 'Hospitality Service Charge Revenue');
    lines.push({
      accountId: acc4040.id,
      accountCode: acc4040.code,
      accountName: acc4040.name,
      debit: scAmt,
      credit: 0,
      memo: `Service charge reversal ${cn.creditNoteNo}`
    });
  }
  if (vatAmt > 0) {
    const acc2020 = lookupAccount(accounts, '2020', 'Output VAT (13%) Payable to IRD');
    lines.push({
      accountId: acc2020.id,
      accountCode: acc2020.code,
      accountName: acc2020.name,
      debit: vatAmt,
      credit: 0,
      memo: `Output VAT reversal ${cn.creditNoteNo}`
    });
  }

  const refundTarget = resolvePaymentAssetAccountCode(String(cn.paymentMethod || 'cash'));
  const accAsset = lookupAccount(accounts, refundTarget.code, refundTarget.name);
  lines.push({
    accountId: accAsset.id,
    accountCode: accAsset.code,
    accountName: accAsset.name,
    debit: 0,
    credit: roundMoney(cn.grandTotal),
    memo: `Refund / Reversal ${cn.creditNoteNo}`
  });

  return commitBalancedJournal(state, {
    id: `je-cn-${cn.id}`,
    businessId,
    date: cn.adDate || new Date().toISOString().split('T')[0],
    bsDate: cn.bsDate,
    referenceType: 'CREDIT_NOTE',
    referenceId: cn.id,
    referenceNo: cn.creditNoteNo,
    description: `Credit Note Issued: ${cn.creditNoteNo} vs ${cn.originalInvoiceNo} (${cn.reason})`,
    lines,
    createdByName: actorName || cn.issuedByName,
    createdAt: new Date().toISOString()
  });
}

/**
 * Posts balanced Double-Entry Journal for Customer Khata payment collection (DR Asset / CR 1040 Khata AR).
 */
export function postKhataPaymentJournal(
  state: AppState,
  tx: KhataTransaction,
  actorName: string = 'Cashier'
): { journalEntries: JournalEntry[]; accounts: ChartAccount[] } {
  const businessId = state.businessId || 'default';
  const accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  if (tx.type !== 'payment_received' || (Number(tx.amount) || 0) <= 0) {
    return { journalEntries: state.journalEntries || [], accounts };
  }

  const assetTarget = resolvePaymentAssetAccountCode(tx.paymentMode || 'cash');
  const assetAcc = lookupAccount(accounts, assetTarget.code, assetTarget.name);
  const arAcc = lookupAccount(accounts, '1040', 'Accounts Receivable (Customer Khata)');
  const amt = roundMoney(tx.amount);

  return commitBalancedJournal(state, {
    id: `je-khata-${tx.id}`,
    businessId,
    date: (tx.date || new Date().toISOString()).substring(0, 10),
    bsDate: formatBsIsoDate(new Date()),
    referenceType: 'KHATA_COLLECTION',
    referenceId: tx.id,
    referenceNo: tx.invoiceNo || tx.id,
    description: `Khata Collection from ${tx.customerName}`,
    lines: [
      { accountId: assetAcc.id, accountCode: assetAcc.code, accountName: assetAcc.name, debit: amt, credit: 0 },
      { accountId: arAcc.id, accountCode: arAcc.code, accountName: arAcc.name, debit: 0, credit: amt }
    ],
    createdByName: actorName,
    createdAt: new Date().toISOString()
  });
}

/**
 * Posts balanced Double-Entry Journal for Operating Expenses (DR 6xxx Expense / CR Cash or Digital Asset).
 */
export function postExpenseJournal(
  state: AppState,
  expense: Expense,
  actorName: string = 'Manager'
): { journalEntries: JournalEntry[]; accounts: ChartAccount[] } {
  const businessId = state.businessId || 'default';
  const accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  const amt = roundMoney(expense.amount || 0);
  if (amt <= 0) {
    return { journalEntries: state.journalEntries || [], accounts };
  }

  const expCode =
    expense.category === 'salary' || expense.category === 'staff_advance'
      ? '6010'
      : expense.category === 'rent'
      ? '6020'
      : expense.category === 'utilities'
      ? '6030'
      : expense.category === 'gas_fuel'
      ? '6040'
      : '6050';

  const expAcc = lookupAccount(accounts, expCode, 'Operating Expense');
  const payTarget = resolvePaymentAssetAccountCode(expense.paymentMode || 'cash');
  const payAcc = lookupAccount(accounts, payTarget.code, payTarget.name);

  return commitBalancedJournal(state, {
    id: `je-exp-${expense.id}`,
    businessId,
    date: (expense.date || new Date().toISOString()).substring(0, 10),
    bsDate: formatBsIsoDate(new Date()),
    referenceType: 'EXPENSE',
    referenceId: expense.id,
    referenceNo: expense.billNumber || expense.id,
    description: `Expense: ${expense.title} (${expense.category})`,
    lines: [
      { accountId: expAcc.id, accountCode: expAcc.code, accountName: expAcc.name, debit: amt, credit: 0 },
      { accountId: payAcc.id, accountCode: payAcc.code, accountName: payAcc.name, debit: 0, credit: amt }
    ],
    createdByName: actorName || expense.submittedBy || 'Manager',
    createdAt: new Date().toISOString()
  });
}

/**
 * Posts balanced Double-Entry Journal for Resort Room / Advance / Checkout payment receipts.
 */
export function postHotelPaymentJournal(
  state: AppState,
  payment: HotelPaymentRecord,
  actorName: string = 'Front Desk'
): { journalEntries: JournalEntry[]; accounts: ChartAccount[] } {
  const businessId = state.businessId || 'default';
  const accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  const amt = roundMoney(payment.amount || 0);
  if (amt <= 0 || payment.status === 'refunded') {
    return { journalEntries: state.journalEntries || [], accounts };
  }

  const payTarget = resolvePaymentAssetAccountCode(payment.method || 'cash');
  const payAcc = lookupAccount(accounts, payTarget.code, payTarget.name);
  const roomRevAcc = lookupAccount(accounts, '4030', 'Resort Room Booking Lodging Revenue');

  return commitBalancedJournal(state, {
    id: `je-hotel-${payment.id}`,
    businessId,
    date: (payment.dateTime || new Date().toISOString()).substring(0, 10),
    bsDate: formatBsIsoDate(new Date()),
    referenceType: 'HOTEL_PAYMENT',
    referenceId: payment.id,
    referenceNo: payment.roomNumber,
    description: `Room Payment: Room ${payment.roomNumber} (${payment.guestName})`,
    lines: [
      { accountId: payAcc.id, accountCode: payAcc.code, accountName: payAcc.name, debit: amt, credit: 0 },
      { accountId: roomRevAcc.id, accountCode: roomRevAcc.code, accountName: roomRevAcc.name, debit: 0, credit: amt }
    ],
    createdByName: actorName || payment.staffName || 'Front Desk',
    createdAt: new Date().toISOString()
  });
}

/**
 * Owner Opening Capital / Opening Balance Journal Entry (DR Asset / CR 3010 Owner's Capital).
 */
export function postOpeningBalanceJournal(
  state: AppState,
  targetAccountCode: string,
  amount: number,
  actorName: string = 'Owner',
  memo: string = 'Opening Balance Capital Injection'
): { journalEntries: JournalEntry[]; accounts: ChartAccount[] } {
  const businessId = state.businessId || 'default';
  const accounts = ensureDefaultChartAccounts(state.accounts, businessId);
  const amt = roundMoney(amount);
  if (amt <= 0) {
    return { journalEntries: state.journalEntries || [], accounts };
  }

  const targetAcc = lookupAccount(accounts, targetAccountCode, targetAccountCode);
  const capAcc = lookupAccount(accounts, '3010', "Owner's Initial Capital Investment");

  return commitBalancedJournal(state, {
    id: `je-open-${targetAccountCode}-${Date.now()}`,
    businessId,
    date: new Date().toISOString().split('T')[0],
    bsDate: formatBsIsoDate(new Date()),
    referenceType: 'OPENING_BALANCE',
    referenceId: `open-${targetAccountCode}-${Date.now()}`,
    referenceNo: 'OPENING',
    description: `${memo} (${targetAcc.name})`,
    lines: [
      { accountId: targetAcc.id, accountCode: targetAcc.code, accountName: targetAcc.name, debit: amt, credit: 0 },
      { accountId: capAcc.id, accountCode: capAcc.code, accountName: capAcc.name, debit: 0, credit: amt }
    ],
    createdByName: actorName,
    createdAt: new Date().toISOString()
  });
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  category: ChartAccount['category'];
  debitTurnover: number;
  creditTurnover: number;
  endingDebitBalance: number;
  endingCreditBalance: number;
}

export function calculateTrialBalance(
  accounts: ChartAccount[],
  journalEntries: JournalEntry[] = []
) {
  const debitByCode = new Map<string, number>();
  const creditByCode = new Map<string, number>();

  for (const je of journalEntries) {
    for (const line of je.lines || []) {
      debitByCode.set(line.accountCode, roundMoney((debitByCode.get(line.accountCode) || 0) + (line.debit || 0)));
      creditByCode.set(line.accountCode, roundMoney((creditByCode.get(line.accountCode) || 0) + (line.credit || 0)));
    }
  }

  const rows: TrialBalanceRow[] = accounts.map(acc => {
    const dr = debitByCode.get(acc.code) || 0;
    const cr = creditByCode.get(acc.code) || 0;
    const isDebitNormal = acc.category === 'ASSET' || acc.category === 'EXPENSE';
    const net = isDebitNormal ? roundMoney(dr - cr) : roundMoney(cr - dr);

    let endingDebitBalance = 0;
    let endingCreditBalance = 0;
    if (isDebitNormal) {
      if (net >= 0) endingDebitBalance = net;
      else endingCreditBalance = Math.abs(net);
    } else {
      if (net >= 0) endingCreditBalance = net;
      else endingDebitBalance = Math.abs(net);
    }

    return {
      accountCode: acc.code,
      accountName: acc.name,
      category: acc.category,
      debitTurnover: dr,
      creditTurnover: cr,
      endingDebitBalance,
      endingCreditBalance
    };
  });

  const totalDebits = roundMoney(rows.reduce((s, r) => s + r.debitTurnover, 0));
  const totalCredits = roundMoney(rows.reduce((s, r) => s + r.creditTurnover, 0));
  const totalEndingDebit = roundMoney(rows.reduce((s, r) => s + r.endingDebitBalance, 0));
  const totalEndingCredit = roundMoney(rows.reduce((s, r) => s + r.endingCreditBalance, 0));

  return {
    rows,
    totalDebits,
    totalCredits,
    totalEndingDebit,
    totalEndingCredit,
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.02 && Math.abs(totalEndingDebit - totalEndingCredit) < 0.02
  };
}
