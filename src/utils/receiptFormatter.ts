import { BusinessSettings, Order } from '../types';

export interface PaymentDisplayRow {
  label: string;
  amountText: string;
  bold?: boolean;
}

const PAYMENT_LABEL_MAP: Record<string, string> = {
  cash: 'Cash',
  esewa: 'eSewa',
  khalti: 'Khalti',
  fonepay_qr: 'Fonepay QR',
  qr: 'QR Code',
  card: 'Card',
  bank: 'Bank Transfer',
  credit_khata: 'Khata / Credit',
  charge_to_room: 'Room Folio',
  split: 'Split Payment'
};

export function getReceiptBillIdentifier(order: Order): string {
  if (order.invoiceNo) {
    const cleanNo = order.invoiceNo.replace(/^(INV-|BILL-)/i, '');
    return `bill-${cleanNo}`;
  }
  if (order.kotNo) {
    return `bill-${order.kotNo.replace(/^KOT-/i, '')}`;
  }
  return `bill-${order.id.slice(-4)}`;
}

export function getReceiptOrderTypeFormatted(order: Order): string {
  const typeLabel = (order.orderType || 'dine_in').toUpperCase().replace('_', '-');
  const tableOrGuest = (order.tableRoomName || order.customerName || 'COUNTER')
    .toUpperCase()
    .replace(/\s+/g, '');
  return `${typeLabel}#${tableOrGuest}`;
}

export function getReceiptAttribution(order: Order) {
  const paidAmount = order.paidAmount ?? order.grandTotal;
  const dueAmount = order.dueAmount ?? 0;

  const cashierName =
    order.cashierName ||
    order.paymentRecords?.[0]?.staffName ||
    order.waiterName ||
    'Counter Cashier';
  const serverName =
    order.waiterName && order.waiterName !== cashierName ? order.waiterName : undefined;
  const paymentRef = order.paymentReference || order.paymentRecords?.[0]?.referenceNo;
  const cashTenderedAmt = order.cashTendered ?? order.paymentRecords?.[0]?.cashTendered;
  const changeReturnedAmt =
    order.changeReturned ??
    order.paymentRecords?.[0]?.changeReturned ??
    (cashTenderedAmt !== undefined && cashTenderedAmt > paidAmount
      ? Math.round((cashTenderedAmt - paidAmount) * 100) / 100
      : 0);

  return {
    paidAmount,
    dueAmount,
    cashierName,
    serverName,
    paymentRef,
    cashTenderedAmt,
    changeReturnedAmt
  };
}

export function buildReceiptPaymentRows(
  order: Order,
  billType: 'estimate' | 'tax_invoice'
): PaymentDisplayRow[] {
  const {
    paidAmount,
    dueAmount,
    paymentRef,
    cashTenderedAmt,
    changeReturnedAmt
  } = getReceiptAttribution(order);

  const paymentMethodLabel =
    PAYMENT_LABEL_MAP[order.paymentMethod] || (order.paymentMethod || 'Cash').toUpperCase();

  const rows: PaymentDisplayRow[] = [];

  if (billType === 'estimate' && order.status !== 'completed') {
    rows.push({
      label: 'Payable Total',
      amountText: `Rs.${order.grandTotal.toFixed(2)}`,
      bold: true
    });
    return rows;
  }

  if (order.paymentMethod === 'split' && order.paymentDetails) {
    const pd = order.paymentDetails;
    const channelEntries: [string, number][] = [
      ['Cash', Number(pd.cash) || 0],
      ['Fonepay QR', Number(pd.fonepay) || 0],
      ['Card', Number(pd.card) || 0],
      ['eSewa', Number(pd.esewa) || 0],
      ['Khalti', Number(pd.khalti) || 0],
      ['Bank Transfer', Number(pd.bank) || 0],
      ['QR Payment', Number(pd.qr) || 0],
      ['Room Folio', Number(pd.charge_to_room) || 0]
    ];
    channelEntries.forEach(([label, amt]) => {
      if (amt > 0) {
        rows.push({ label, amountText: `Rs.${amt.toFixed(2)}` });
      }
    });
    if ((Number(pd.credit) || 0) > 0 || dueAmount > 0) {
      const creditDue = (Number(pd.credit) || 0) > 0 ? Number(pd.credit) : dueAmount;
      rows.push({
        label: 'Balance Due',
        amountText: `Rs.${creditDue.toFixed(2)}`,
        bold: true
      });
    }
    if (rows.length === 0) {
      rows.push({ label: 'Split Payment', amountText: `Rs.${paidAmount.toFixed(2)}` });
    }
  } else if (order.paymentMethod === 'cash') {
    rows.push({ label: 'Cash', amountText: `Rs.${paidAmount.toFixed(2)}` });
    if (cashTenderedAmt !== undefined && cashTenderedAmt > paidAmount) {
      rows.push({ label: 'Cash tendered', amountText: `Rs.${cashTenderedAmt.toFixed(2)}` });
      rows.push({
        label: 'Change returned',
        amountText: `Rs.${changeReturnedAmt.toFixed(2)}`,
        bold: true
      });
    } else {
      rows.push({ label: 'Cash received', amountText: `Rs.${paidAmount.toFixed(2)}` });
    }
    if (dueAmount > 0) {
      rows.push({ label: 'Balance Due', amountText: `Rs.${dueAmount.toFixed(2)}`, bold: true });
    }
  } else if (order.paymentMethod === 'credit_khata') {
    if (paidAmount > 0) {
      rows.push({ label: 'Paid Now', amountText: `Rs.${paidAmount.toFixed(2)}` });
    }
    rows.push({
      label: 'Khata / Credit Due',
      amountText: `Rs.${(dueAmount > 0 ? dueAmount : order.grandTotal).toFixed(2)}`,
      bold: true
    });
  } else {
    rows.push({ label: paymentMethodLabel, amountText: `Rs.${paidAmount.toFixed(2)}` });
    if (paymentRef) {
      rows.push({ label: 'Ref No.', amountText: paymentRef });
    }
    if (order.roomChargeDetails) {
      rows.push({
        label: 'Posted Folio',
        amountText: `Room ${order.roomChargeDetails.roomNumber}`
      });
    }
    if (dueAmount > 0) {
      rows.push({ label: 'Balance Due', amountText: `Rs.${dueAmount.toFixed(2)}`, bold: true });
    }
  }

  return rows;
}

export function getEffectiveServicePercent(order: Order, settings: BusinessSettings): number {
  return order.serviceChargeAmount > 0 && settings.enableServiceCharge
    ? settings.serviceChargePercent
    : 0;
}

export function formatPlainTextReceipt(params: {
  order: Order;
  settings: BusinessSettings;
  billType: 'estimate' | 'tax_invoice';
  displayDateStr: string;
}): string {
  const { order, settings, billType, displayDateStr } = params;
  const billIdentifier = getReceiptBillIdentifier(order);
  const orderTypeFormatted = getReceiptOrderTypeFormatted(order);
  const paymentDisplayRows = buildReceiptPaymentRows(order, billType);
  const { cashierName, serverName } = getReceiptAttribution(order);
  const effectiveServicePct = getEffectiveServicePercent(order, settings);

  const isEst = billType === 'estimate';
  const paymentBlock = paymentDisplayRows
    .map((r) => `${r.label.padEnd(38)}  ${r.amountText}`)
    .join('\n');

  return `
${' '.repeat(28)}${billIdentifier}
${(settings.businessName || 'NAULO HOSPITALITY').toUpperCase()}
${settings.address || 'Pulchowk, Lalitpur'}
Tel: ${settings.phone || '9861157870'}${!isEst && settings.panVatNumber ? `\nPAN: ${settings.panVatNumber}` : ''}

${isEst ? 'ESTIMATE\nNot a tax invoice' : 'TAX INVOICE\nOfficial Tax Invoice'}
--------------------------------------------------
Printed         ${displayDateStr}
Order           #${order.invoiceNo || order.kotNo || order.id.slice(0, 8)}${order.parentSplitOrderId ? ' (SPLIT BILL)' : ''}
Type            ${orderTypeFormatted}${order.guestCount ? `\nGuests          ${order.guestCount} PAX` : ''}${order.customerName ? `\nCustomer        ${order.customerName}` : ''}
--------------------------------------------------
SN  Item                      Rate   Qty    Amount
${order.items
  .map((item, idx) => {
    const sn = (idx + 1).toString().padEnd(3);
    const name = item.name.length > 22 ? item.name.slice(0, 22) : item.name.padEnd(22);
    const rate = `Rs.${item.price.toFixed(2)}`.padStart(10);
    const qty = item.quantity.toString().padStart(4);
    const amount = `Rs.${(item.price * item.quantity).toFixed(2)}`.padStart(11);
    return `${sn} ${name} ${rate} ${qty} ${amount}`;
  })
  .join('\n')}
--------------------------------------------------
Subtotal                                Rs.${order.subtotal.toFixed(2)}
${order.discountAmount > 0 ? `Discount (${(order.discountPercent || 0).toFixed(0)}%)                     -Rs.${order.discountAmount.toFixed(2)}\n` : ''}Service (${effectiveServicePct}%)                           Rs.${(order.serviceChargeAmount || 0).toFixed(2)}
${settings.enableVat && order.vatAmount > 0 ? `VAT (${settings.vatRatePercent}%)                                Rs.${order.vatAmount.toFixed(2)}\n` : ''}GRAND TOTAL                             Rs.${order.grandTotal.toFixed(2)}
--------------------------------------------------
${paymentBlock}
--------------------------------------------------
Cashier                                 ${cashierName}${serverName ? `\nServer                                  ${serverName}` : ''}

Thank you, please come again
Powered by Himalayan Breeze POS
`;
}
