import { BusinessSettings, Order, PrinterSettings } from '../types';
import { formatReceiptNepaliDate } from '../utils/nepaliCalendar';
import {
  buildReceiptPaymentRows,
  getEffectiveServicePercent,
  getReceiptAttribution,
  getReceiptBillIdentifier,
  getReceiptOrderTypeFormatted
} from '../utils/receiptFormatter';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function encodeAscii(str: string): number[] {
  const normalized = (str || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' ');
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    bytes.push(normalized.charCodeAt(i) & 0x7f);
  }
  return bytes;
}

function line(text: string): number[] {
  return [...encodeAscii(text), LF];
}

function padTwoCol(left: string, right: string, width: number): string {
  const r = right.slice(0, width);
  const maxLeft = Math.max(1, width - r.length - 1);
  const l = left.slice(0, maxLeft);
  const spaces = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(spaces) + r;
}

function divider(width: number, char: string = '-'): string {
  return char.repeat(width);
}

/**
 * Generates RJ11 Cash Drawer Kick ESC/POS pulse (`ESC p pin t1 t2`).
 */
export function buildCashDrawerKickBytes(pin: 0 | 1 = 0): Uint8Array {
  return new Uint8Array([ESC, 0x70, pin, 0x19, 0xfa]);
}

/**
 * Generates native ESC/POS QR Code bytes (`GS ( k`).
 */
function buildEscPosQrBytes(payload: string): number[] {
  if (!payload) return [];
  const data = encodeAscii(payload);
  const len = data.length + 3;
  const pL = len & 0xff;
  const pH = (len >> 8) & 0xff;
  return [
    // Model 2
    GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0,
    // Module size 4
    GS, 0x28, 0x6b, 3, 0, 49, 67, 4,
    // Error correction M (49)
    GS, 0x28, 0x6b, 3, 0, 49, 69, 49,
    // Store data
    GS, 0x28, 0x6b, pL, pH, 49, 80, 48, ...data,
    // Print QR
    GS, 0x28, 0x6b, 3, 0, 49, 81, 48,
    LF
  ];
}

/**
 * Generates true binary ESC/POS receipt stream for 58mm (32-col) or 80mm (48-col) thermal printers.
 */
export function buildEscPosReceiptBytes(
  order: Order,
  settings: BusinessSettings,
  options?: {
    width?: '58mm' | '80mm';
    isEstimate?: boolean;
    kickDrawer?: boolean;
    drawerPin?: 0 | 1;
  }
): Uint8Array {
  const widthMode = options?.width || settings.printerSettings?.paperWidth || (settings.receiptSettings?.printWidth === '58mm' ? '58mm' : '80mm');
  const cols = widthMode === '58mm' ? 32 : 48;
  const billType = options?.isEstimate ? 'estimate' : 'tax_invoice';
  const billId = getReceiptBillIdentifier(order);
  const { cashierName, serverName } = getReceiptAttribution(order);
  const effectiveServicePct = getEffectiveServicePercent(order, settings);
  const paymentRows = buildReceiptPaymentRows(order, billType);
  const dateObj = order.settledAt || order.createdAt ? new Date(order.settledAt || order.createdAt) : new Date();
  const displayDate = formatReceiptNepaliDate(dateObj);

  const out: number[] = [];
  // Initialize ESC @
  out.push(ESC, 0x40);
  // Center Align + Bold Business Header
  out.push(ESC, 0x61, 1);
  out.push(ESC, 0x45, 1);
  out.push(GS, 0x21, 0x01); // Double height
  out.push(...line((settings.businessName || 'NAULO HOSPITALITY').toUpperCase()));
  out.push(GS, 0x21, 0x00); // Normal
  out.push(ESC, 0x45, 0);

  if (settings.address) out.push(...line(settings.address));
  if (settings.phone) out.push(...line(`Tel: ${settings.phone}`));
  if (billType === 'tax_invoice' && settings.panVatNumber) {
    out.push(ESC, 0x45, 1);
    out.push(...line(`PAN/VAT: ${settings.panVatNumber}`));
    out.push(ESC, 0x45, 0);
  }
  out.push(LF);
  out.push(ESC, 0x45, 1);
  out.push(...line(billType === 'estimate' ? '*** ESTIMATE ***' : '*** TAX INVOICE ***'));
  out.push(ESC, 0x45, 0);
  out.push(...line(billType === 'estimate' ? 'Not a tax invoice' : 'Official IRD Tax Invoice'));

  // Left Align metadata
  out.push(ESC, 0x61, 0);
  out.push(...line(divider(cols, '-')));
  out.push(...line(padTwoCol('Bill #', `#${order.invoiceNo || billId}`, cols)));
  out.push(...line(padTwoCol('Date', displayDate, cols)));
  out.push(...line(padTwoCol('Type', getReceiptOrderTypeFormatted(order), cols)));
  if (order.customerName) out.push(...line(padTwoCol('Buyer', order.customerName, cols)));
  if (order.buyerPan) out.push(...line(padTwoCol('Buyer PAN', order.buyerPan, cols)));
  out.push(...line(divider(cols, '-')));

  // Item header
  out.push(ESC, 0x45, 1);
  out.push(...line(padTwoCol('Item x Qty', 'Amount', cols)));
  out.push(ESC, 0x45, 0);

  for (const item of order.items || []) {
    const lineAmt = (item.price * item.quantity).toFixed(2);
    const label = `${item.name} x${item.quantity}`;
    out.push(...line(padTwoCol(label, `Rs.${lineAmt}`, cols)));
  }

  out.push(...line(divider(cols, '-')));
  out.push(...line(padTwoCol('Subtotal', `Rs.${(order.subtotal || 0).toFixed(2)}`, cols)));
  if (order.discountAmount > 0) {
    out.push(...line(padTwoCol(`Discount (${(order.discountPercent || 0).toFixed(0)}%)`, `-Rs.${order.discountAmount.toFixed(2)}`, cols)));
  }
  out.push(...line(padTwoCol(`Service (${effectiveServicePct}%)`, `Rs.${(order.serviceChargeAmount || 0).toFixed(2)}`, cols)));
  if (settings.enableVat && order.vatAmount > 0) {
    out.push(...line(padTwoCol(`VAT (${settings.vatRatePercent}%)`, `Rs.${order.vatAmount.toFixed(2)}`, cols)));
  }

  out.push(ESC, 0x45, 1);
  out.push(GS, 0x21, 0x01);
  out.push(...line(padTwoCol('GRAND TOTAL', `Rs.${(order.grandTotal || 0).toFixed(2)}`, cols)));
  out.push(GS, 0x21, 0x00);
  out.push(ESC, 0x45, 0);

  out.push(...line(divider(cols, '-')));
  for (const row of paymentRows) {
    out.push(...line(padTwoCol(row.label, row.amountText, cols)));
  }
  out.push(...line(divider(cols, '-')));
  out.push(...line(padTwoCol('Cashier', cashierName, cols)));
  if (serverName) out.push(...line(padTwoCol('Server', serverName, cols)));

  // Footer & optional QR
  out.push(ESC, 0x61, 1);
  if (settings.receiptSettings?.showQrCode && billType === 'tax_invoice') {
    const qrPayload = `INV:${order.invoiceNo}|PAN:${settings.panVatNumber || ''}|AMT:${order.grandTotal.toFixed(2)}`;
    out.push(...buildEscPosQrBytes(qrPayload));
  }
  out.push(...line(settings.receiptFooterMessage || 'Thank you, please come again'));
  out.push(LF, LF, LF);

  // Feed and Partial Cut GS V 66 3
  out.push(GS, 0x56, 0x42, 0x03);

  // Optional Cash Drawer Kick
  if (options?.kickDrawer) {
    out.push(...buildCashDrawerKickBytes(options.drawerPin ?? settings.printerSettings?.drawerKickPin ?? 0));
  }

  return new Uint8Array(out);
}

/**
 * Generates true binary ESC/POS Kitchen Order Ticket (KOT) stream.
 */
export function buildEscPosKotBytes(
  order: Order,
  settings: BusinessSettings,
  options?: { width?: '58mm' | '80mm' }
): Uint8Array {
  const widthMode = options?.width || settings.printerSettings?.paperWidth || '80mm';
  const cols = widthMode === '58mm' ? 32 : 48;
  const dateObj = order.createdAt ? new Date(order.createdAt) : new Date();
  const displayDate = formatReceiptNepaliDate(dateObj);

  const out: number[] = [];
  out.push(ESC, 0x40);
  out.push(ESC, 0x61, 1);
  out.push(ESC, 0x45, 1);
  out.push(GS, 0x21, 0x11);
  out.push(...line(`KOT ${order.kotNo || ''}`));
  out.push(GS, 0x21, 0x00);
  out.push(...line(order.tableRoomName || order.orderType));
  out.push(ESC, 0x45, 0);
  out.push(ESC, 0x61, 0);
  out.push(...line(divider(cols, '=')));
  out.push(...line(padTwoCol('Time', displayDate, cols)));
  if (order.waiterName) out.push(...line(padTwoCol('Server', order.waiterName, cols)));
  out.push(...line(divider(cols, '-')));

  out.push(ESC, 0x45, 1);
  for (const item of order.items || []) {
    out.push(GS, 0x21, 0x01);
    out.push(...line(`${item.quantity}x  ${item.name}`));
    out.push(GS, 0x21, 0x00);
    if (item.notes) {
      out.push(...line(`   * NOTE: ${item.notes}`));
    }
  }
  out.push(ESC, 0x45, 0);
  out.push(...line(divider(cols, '=')));
  out.push(LF, LF, LF);
  out.push(GS, 0x56, 0x42, 0x03);
  return new Uint8Array(out);
}

export interface EscPosDispatchResult {
  ok: boolean;
  transport: PrinterSettings['connectionType'];
  fallbackToBrowserPrint?: boolean;
  message: string;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

/**
 * Sends raw ESC/POS bytes to configured hardware bridge (Web Serial, WebUSB, or Local Print Bridge HTTP).
 */
export async function sendEscPosToHardware(
  bytes: Uint8Array,
  printerSettings?: PrinterSettings
): Promise<EscPosDispatchResult> {
  const mode = printerSettings?.connectionType || 'browser';

  if (mode === 'browser') {
    return {
      ok: false,
      transport: 'browser',
      fallbackToBrowserPrint: true,
      message: 'Browser print mode active — configure Serial/USB/Bridge in Settings > Receipt & Print for direct ESC/POS.'
    };
  }

  if (mode === 'web_serial') {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!nav?.serial) {
      return {
        ok: false,
        transport: 'web_serial',
        fallbackToBrowserPrint: true,
        message: 'Web Serial API is not supported in this browser (use Chrome/Edge desktop or Network Bridge).'
      };
    }

    try {
      const existingPorts = await nav.serial.getPorts();
      const port = existingPorts[0] || (await nav.serial.requestPort());
      await port.open({ baudRate: printerSettings?.baudRate || 9600 });
      const writer = port.writable.getWriter();
      try {
        await writer.write(bytes);
      } finally {
        writer.releaseLock();
        await port.close();
      }
      return { ok: true, transport: 'web_serial', message: 'Sent directly via Web Serial ESC/POS.' };
    } catch (err: any) {
      return {
        ok: false,
        transport: 'web_serial',
        fallbackToBrowserPrint: true,
        message: err?.message || 'Serial thermal printer write cancelled or failed.'
      };
    }
  }

  if (mode === 'web_usb') {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!nav?.usb) {
      return {
        ok: false,
        transport: 'web_usb',
        fallbackToBrowserPrint: true,
        message: 'WebUSB API is not supported in this browser.'
      };
    }

    try {
      const devices = await nav.usb.getDevices();
      const device = devices[0] || (await nav.usb.requestDevice({ filters: [] }));
      await device.open();
      if (!device.configuration) {
        await device.selectConfiguration(1);
      }
      const iface = device.configuration.interfaces[0];
      await device.claimInterface(iface.interfaceNumber);
      const outEp = iface.alternate.endpoints.find((e: any) => e.direction === 'out');
      if (!outEp) throw new Error('USB printer OUT endpoint not found.');
      await device.transferOut(outEp.endpointNumber, bytes);
      await device.close();
      return { ok: true, transport: 'web_usb', message: 'Sent directly via WebUSB ESC/POS.' };
    } catch (err: any) {
      return {
        ok: false,
        transport: 'web_usb',
        fallbackToBrowserPrint: true,
        message: err?.message || 'WebUSB thermal printer write cancelled or failed.'
      };
    }
  }

  // Local Network / POS Daemon HTTP Bridge (e.g. QZ/Node ESC-POS bridge on 127.0.0.1:9100/print)
  const bridgeUrl = printerSettings?.bridgeUrl || 'http://127.0.0.1:9100/print';
  try {
    const res = await fetch(bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataBase64: uint8ToBase64(bytes),
        paperWidth: printerSettings?.paperWidth || '80mm',
        bytes: Array.from(bytes)
      })
    });
    if (!res.ok) {
      throw new Error(`Print bridge HTTP ${res.status}`);
    }
    return { ok: true, transport: 'network_bridge', message: `Printed via local bridge (${bridgeUrl}).` };
  } catch (err: any) {
    return {
      ok: false,
      transport: 'network_bridge',
      fallbackToBrowserPrint: true,
      message: err?.message || `Unable to reach thermal bridge at ${bridgeUrl}`
    };
  }
}

export async function openCashDrawerHardware(printerSettings?: PrinterSettings): Promise<EscPosDispatchResult> {
  const bytes = buildCashDrawerKickBytes(printerSettings?.drawerKickPin ?? 0);
  return sendEscPosToHardware(bytes, printerSettings);
}
