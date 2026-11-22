import { BusinessSettings, MenuItem, Order, OrderItem } from '../types';
import { FinancialVerificationResult, verifyFinancialCalculations } from '../services/security';

/**
 * Splits a monetary amount into `guests` equal shares down to the exact paisa (0.01).
 * The sum of the returned array is guaranteed to equal `Math.round(totalAmount * 100) / 100`.
 */
export function splitAmountEqually(totalAmount: number, guests: number): number[] {
  const safeGuests = Math.max(1, Math.floor(guests));
  const cleanTotal = Math.max(0, Number(totalAmount) || 0);
  const totalPaisa = Math.round(cleanTotal * 100);
  const basePaisa = Math.floor(totalPaisa / safeGuests);
  const remainderPaisa = totalPaisa - basePaisa * safeGuests;

  const shares: number[] = [];
  for (let i = 0; i < safeGuests; i++) {
    const sharePaisa = basePaisa + (i < remainderPaisa ? 1 : 0);
    shares.push(sharePaisa / 100);
  }
  return shares;
}

export interface ItemSplitResult {
  splitOrder: Order | null;
  splitItems: OrderItem[];
  remainingItems: OrderItem[];
  splitSummary: FinancialVerificationResult;
  remainingSummary: FinancialVerificationResult;
}

/**
 * Carves selected item quantities out of an active Order into a separate billable sub-order
 * while recalculating exact Nepal SC / VAT / discount totals for both the split bill and
 * the remaining items on the table.
 */
export function carveItemsForSplitBill(
  order: Order,
  selectedQuantities: Record<string, number>,
  menuItems: MenuItem[],
  settings: BusinessSettings,
  splitInvoiceNo: string
): ItemSplitResult {
  const splitItems: OrderItem[] = [];
  const remainingItems: OrderItem[] = [];

  for (const item of order.items) {
    const requested = Math.max(0, Math.min(item.quantity, Math.floor(selectedQuantities[item.id] || 0)));
    if (requested > 0) {
      splitItems.push({
        ...item,
        id: `${item.id}-sp`,
        quantity: requested
      });
    }
    const left = item.quantity - requested;
    if (left > 0) {
      remainingItems.push({
        ...item,
        quantity: left
      });
    }
  }

  const isTakeawayOrDelivery = order.orderType === 'takeaway' || order.orderType === 'delivery';
  const enableSC = settings.enableServiceCharge && !isTakeawayOrDelivery && !order.waivedServiceCharge;
  const enableVat = settings.enableVat && !order.waivedVat;

  const splitSummary = verifyFinancialCalculations(
    splitItems,
    menuItems,
    order.discountPercent || 0,
    isTakeawayOrDelivery || Boolean(order.waivedServiceCharge),
    enableSC,
    settings.serviceChargePercent,
    enableVat,
    settings.vatRatePercent
  );

  const remainingSummary = verifyFinancialCalculations(
    remainingItems,
    menuItems,
    order.discountPercent || 0,
    isTakeawayOrDelivery || Boolean(order.waivedServiceCharge),
    enableSC,
    settings.serviceChargePercent,
    enableVat,
    settings.vatRatePercent
  );

  const splitOrder: Order | null = splitItems.length > 0 && splitSummary.isValid
    ? {
        ...order,
        id: `ord-split-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        invoiceNo: splitInvoiceNo,
        invoiceNumber: splitInvoiceNo,
        parentSplitOrderId: order.id,
        items: splitItems,
        subtotal: splitSummary.verifiedSubtotal,
        discountAmount: splitSummary.verifiedDiscountAmount,
        serviceChargeAmount: splitSummary.verifiedServiceCharge,
        vatAmount: splitSummary.verifiedVat,
        grandTotal: splitSummary.verifiedGrandTotal,
        paidAmount: 0,
        dueAmount: splitSummary.verifiedGrandTotal,
        paymentStatus: 'pending',
        status: 'active',
        settledAt: undefined,
        paymentRecords: [],
        inventoryDeducted: false
      }
    : null;

  return {
    splitOrder,
    splitItems,
    remainingItems,
    splitSummary,
    remainingSummary
  };
}
