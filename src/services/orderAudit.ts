import { InventoryDeduction, MenuItem, Order, ProductRecipe } from '../types';
import { parseOrderTimestampMs } from '../utils/timeUtils';

export type OrderChannelCategory = 'cash' | 'online' | 'split' | 'khata' | 'room_charge' | 'unpaid';

export interface OrderPaymentBreakdown {
  cash: number;
  fonepayQr: number;
  esewa: number;
  khalti: number;
  card: number;
  bank: number;
  onlineTotal: number;
  khataCredit: number;
  roomCharge: number;
  channelCategory: OrderChannelCategory;
  channelLabel: string;
  channelLabelNe: string;
}

export interface TodayOrderAuditRow {
  order: Order;
  timestampMs: number;
  dishesSummary: string;
  itemsCount: number;
  payment: OrderPaymentBreakdown;
  isTrueCancelled: boolean;
}

export interface TodayOrderAuditSummary {
  totalOrdersCount: number;
  completedCount: number;
  unpaidCount: number;
  cancelledCount: number;
  completedRevenue: number;
  unpaidAmount: number;
  cancelledAmount: number;
  cashTotal: number;
  onlineTotal: number;
  fonepayQrTotal: number;
  esewaTotal: number;
  khaltiTotal: number;
  cardTotal: number;
  bankTotal: number;
  khataTotal: number;
  roomChargeTotal: number;
  rows: TodayOrderAuditRow[];
}

export function isSameLocalCalendarDay(timestampMs: number, referenceDate: Date = new Date()): boolean {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;
  const d = new Date(timestampMs);
  return (
    d.getFullYear() === referenceDate.getFullYear() &&
    d.getMonth() === referenceDate.getMonth() &&
    d.getDate() === referenceDate.getDate()
  );
}

export function getPrimaryOrderTimestampMs(order: Order): number {
  return (
    parseOrderTimestampMs(order.settledAt || order.voidedAt || order.createdAt || order.updatedAt) || 0
  );
}

export function isOrderFromLocalDate(order: Order, referenceDate: Date = new Date()): boolean {
  const candidates = [order.settledAt, order.voidedAt, order.createdAt, order.updatedAt];
  for (const raw of candidates) {
    const ms = parseOrderTimestampMs(raw);
    if (ms && isSameLocalCalendarDay(ms, referenceDate)) {
      return true;
    }
  }
  return false;
}

/**
 * Splits or table-merges mark replaced parent placeholders as status='cancelled' with
 * system notes ("Merged into ..." or "Settled via split invoice ...").
 * Those are internal state consolidations, NOT lost/voided customer orders.
 */
export function isInternalArchivalOrder(order: Order): boolean {
  if (order.status !== 'cancelled') return false;
  const reason = (order.voidReason || '').trim().toLowerCase();
  const note = (order.specialInstructions || '').trim().toLowerCase();
  return (
    reason.startsWith('settled via split invoice') ||
    reason.startsWith('merged into') ||
    note.startsWith('merged into')
  );
}

export function summarizeOrderDishes(order: Order): string {
  if (!order.items || order.items.length === 0) return '—';
  return order.items
    .map((item) => `${item.quantity}× ${item.name}`)
    .join(', ');
}

export function classifyOrderPayment(order: Order): OrderPaymentBreakdown {
  const empty: OrderPaymentBreakdown = {
    cash: 0,
    fonepayQr: 0,
    esewa: 0,
    khalti: 0,
    card: 0,
    bank: 0,
    onlineTotal: 0,
    khataCredit: 0,
    roomCharge: 0,
    channelCategory: 'unpaid',
    channelLabel: 'Unpaid',
    channelLabelNe: 'बाँकी (Unpaid)'
  };

  if (order.status === 'active') {
    return empty;
  }

  if (order.status === 'cancelled') {
    return {
      ...empty,
      channelCategory: 'unpaid',
      channelLabel: 'Cancelled',
      channelLabelNe: 'रद्द'
    };
  }

  const grand = Number(order.grandTotal) || 0;
  const paid = order.paidAmount !== undefined ? Number(order.paidAmount) || 0 : (order.paymentStatus === 'paid' ? grand : 0);
  const due = order.dueAmount !== undefined ? Number(order.dueAmount) || 0 : (order.paymentStatus === 'credit' ? grand : 0);

  let cash = 0;
  let fonepayQr = 0;
  let esewa = 0;
  let khalti = 0;
  let card = 0;
  let bank = 0;
  let khataCredit = 0;
  let roomCharge = 0;

  if (order.paymentMethod === 'split' && order.paymentDetails) {
    const pd = order.paymentDetails;
    cash = Number(pd.cash) || 0;
    fonepayQr = (Number(pd.fonepay) || 0) + (Number(pd.qr) || 0);
    esewa = Number(pd.esewa) || 0;
    khalti = Number(pd.khalti) || 0;
    card = Number(pd.card) || 0;
    bank = Number(pd.bank) || 0;
    khataCredit = Number(pd.credit) || 0;
    roomCharge = Number(pd.charge_to_room) || 0;
  } else {
    const method = (order.paymentMethod || 'cash').toLowerCase();
    const settledVal = paid > 0 ? paid : grand;

    switch (method) {
      case 'cash':
        cash = settledVal;
        break;
      case 'fonepay_qr':
      case 'fonepay':
      case 'qr':
        fonepayQr = settledVal;
        break;
      case 'esewa':
        esewa = settledVal;
        break;
      case 'khalti':
        khalti = settledVal;
        break;
      case 'card':
        card = settledVal;
        break;
      case 'bank':
      case 'bank_transfer':
        bank = settledVal;
        break;
      case 'credit_khata':
      case 'credit':
        khataCredit = due > 0 ? due : grand;
        break;
      case 'charge_to_room':
        roomCharge = grand;
        break;
      default:
        cash = settledVal;
        break;
    }

    // Account for any remaining due balance on partial cash/online payments
    if (method !== 'credit_khata' && method !== 'credit' && method !== 'charge_to_room' && due > 0) {
      khataCredit += due;
    }
  }

  const onlineTotal = fonepayQr + esewa + khalti + card + bank;

  let channelCategory: OrderChannelCategory = 'cash';
  let channelLabel = 'Cash';
  let channelLabelNe = 'नगद (Cash)';

  const hasCash = cash > 0;
  const hasOnline = onlineTotal > 0;
  const hasKhata = khataCredit > 0;
  const hasRoom = roomCharge > 0;

  if (order.paymentMethod === 'split' || (hasCash && hasOnline) || (hasCash && hasKhata) || (hasOnline && hasKhata)) {
    channelCategory = 'split';
    if (hasCash && hasOnline && hasKhata) {
      channelLabel = 'Split (Cash + Online + Khata)';
      channelLabelNe = 'मिश्रित (नगद + अनलाइन + खाता)';
    } else if (hasCash && hasOnline) {
      channelLabel = 'Split (Cash + Online)';
      channelLabelNe = 'मिश्रित (नगद + अनलाइन)';
    } else if (hasOnline && hasKhata) {
      channelLabel = 'Split (Online + Khata)';
      channelLabelNe = 'मिश्रित (अनलाइन + खाता)';
    } else {
      channelLabel = 'Split Payment';
      channelLabelNe = 'मिश्रित भुक्तानी';
    }
  } else if (hasRoom) {
    channelCategory = 'room_charge';
    channelLabel = 'Room Folio';
    channelLabelNe = 'कोठा बिलमा';
  } else if (hasKhata && !hasCash && !hasOnline) {
    channelCategory = 'khata';
    channelLabel = 'Khata / Credit';
    channelLabelNe = 'उधारो / खाता';
  } else if (hasOnline) {
    channelCategory = 'online';
    const parts: string[] = [];
    if (fonepayQr > 0) parts.push('Fonepay QR');
    if (esewa > 0) parts.push('eSewa');
    if (khalti > 0) parts.push('Khalti');
    if (card > 0) parts.push('Card');
    if (bank > 0) parts.push('Bank');
    const subLabel = parts.length > 0 ? parts.join(' + ') : 'Digital';
    channelLabel = `Online · ${subLabel}`;
    channelLabelNe = `अनलाइन · ${subLabel}`;
  } else if (hasCash) {
    channelCategory = 'cash';
    channelLabel = 'Cash';
    channelLabelNe = 'नगद (Cash)';
  }

  return {
    cash,
    fonepayQr,
    esewa,
    khalti,
    card,
    bank,
    onlineTotal,
    khataCredit,
    roomCharge,
    channelCategory,
    channelLabel,
    channelLabelNe
  };
}

export function computeTodayOrderAuditSummary(
  orders: Order[],
  referenceDate: Date = new Date()
): TodayOrderAuditSummary {
  const rows: TodayOrderAuditRow[] = [];

  let completedCount = 0;
  let unpaidCount = 0;
  let cancelledCount = 0;
  let completedRevenue = 0;
  let unpaidAmount = 0;
  let cancelledAmount = 0;

  let cashTotal = 0;
  let fonepayQrTotal = 0;
  let esewaTotal = 0;
  let khaltiTotal = 0;
  let cardTotal = 0;
  let bankTotal = 0;
  let khataTotal = 0;
  let roomChargeTotal = 0;

  for (const order of orders) {
    if (!isOrderFromLocalDate(order, referenceDate)) continue;
    if (isInternalArchivalOrder(order)) continue;

    const isVoidedKot = order.kotStatus === 'cancelled';
    const isTrueCancelled = order.status === 'cancelled' || (order.status === 'active' && isVoidedKot);
    const payment = classifyOrderPayment(
      isTrueCancelled && order.status === 'active' ? { ...order, status: 'cancelled' } : order
    );
    const itemsCount = (order.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const timestampMs = getPrimaryOrderTimestampMs(order);

    rows.push({
      order,
      timestampMs,
      dishesSummary: summarizeOrderDishes(order),
      itemsCount,
      payment,
      isTrueCancelled
    });

    if (isTrueCancelled) {
      cancelledCount += 1;
      cancelledAmount += Number(order.grandTotal) || 0;
    } else if (order.status === 'completed') {
      completedCount += 1;
      completedRevenue += Number(order.grandTotal) || 0;
      cashTotal += payment.cash;
      fonepayQrTotal += payment.fonepayQr;
      esewaTotal += payment.esewa;
      khaltiTotal += payment.khalti;
      cardTotal += payment.card;
      bankTotal += payment.bank;
      khataTotal += payment.khataCredit;
      roomChargeTotal += payment.roomCharge;
    } else if (order.status === 'active') {
      unpaidCount += 1;
      unpaidAmount += Number(order.dueAmount > 0 ? order.dueAmount : order.grandTotal) || 0;
    }
  }

  rows.sort((a, b) => b.timestampMs - a.timestampMs);

  const onlineTotal = fonepayQrTotal + esewaTotal + khaltiTotal + cardTotal + bankTotal;

  return {
    totalOrdersCount: rows.length,
    completedCount,
    unpaidCount,
    cancelledCount,
    completedRevenue: Math.round(completedRevenue * 100) / 100,
    unpaidAmount: Math.round(unpaidAmount * 100) / 100,
    cancelledAmount: Math.round(cancelledAmount * 100) / 100,
    cashTotal: Math.round(cashTotal * 100) / 100,
    onlineTotal: Math.round(onlineTotal * 100) / 100,
    fonepayQrTotal: Math.round(fonepayQrTotal * 100) / 100,
    esewaTotal: Math.round(esewaTotal * 100) / 100,
    khaltiTotal: Math.round(khaltiTotal * 100) / 100,
    cardTotal: Math.round(cardTotal * 100) / 100,
    bankTotal: Math.round(bankTotal * 100) / 100,
    khataTotal: Math.round(khataTotal * 100) / 100,
    roomChargeTotal: Math.round(roomChargeTotal * 100) / 100,
    rows
  };
}

/**
 * Resolves recipe ingredients for a menu item seamlessly from either
 * `menuItem.inventoryRecipe` or `appState.recipes`.
 */
export function resolveOrderItemRecipeIngredients(
  menuItem: MenuItem | undefined,
  recipes?: ProductRecipe[]
): InventoryDeduction[] {
  if (!menuItem) return [];
  if (menuItem.inventoryRecipe && menuItem.inventoryRecipe.length > 0) {
    return menuItem.inventoryRecipe;
  }
  if (!recipes || recipes.length === 0) return [];
  const linked = recipes.find((r) => r.menuItemId === menuItem.id && r.isActive !== false);
  if (!linked || !linked.ingredients || linked.ingredients.length === 0) return [];
  return linked.ingredients.map((ing) => ({
    inventoryItemId: ing.inventoryItemId,
    amount: ing.quantity,
    unit: ing.unit
  }));
}
