import { Order, OrderItem, StaffRole } from '../types';

export type OrderLifecycleState = 
  | 'DRAFT'
  | 'CONFIRMED'
  | 'SENT_TO_KITCHEN'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'BILLED'
  | 'PAID'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'VOIDED';

// Valid forward state transitions
const VALID_TRANSITIONS: Record<OrderLifecycleState, OrderLifecycleState[]> = {
  DRAFT: ['CONFIRMED', 'SENT_TO_KITCHEN', 'CANCELLED'],
  CONFIRMED: ['SENT_TO_KITCHEN', 'PREPARING', 'CANCELLED'],
  SENT_TO_KITCHEN: ['PREPARING', 'READY', 'CANCELLED', 'VOIDED'],
  PREPARING: ['READY', 'SERVED', 'CANCELLED', 'VOIDED'],
  READY: ['SERVED', 'BILLED', 'CANCELLED', 'VOIDED'],
  SERVED: ['BILLED', 'PAID', 'VOIDED'],
  BILLED: ['PAID', 'SERVED', 'VOIDED'],
  PAID: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  VOIDED: []
};

/**
 * Validates whether an order status transition is allowed
 */
export function isValidLifecycleTransition(
  currentState: OrderLifecycleState,
  targetState: OrderLifecycleState,
  userRole?: StaffRole
): { isValid: boolean; error?: string } {
  // Same state is always a no-op / allowed
  if (currentState === targetState) {
    return { isValid: true };
  }

  // Super Admin and Owner can force void or cancel in exceptional circumstances
  if ((userRole === 'SUPER_ADMIN' || userRole === 'OWNER') && (targetState === 'VOIDED' || targetState === 'CANCELLED')) {
    return { isValid: true };
  }

  // Cannot transition from terminal states
  if (currentState === 'COMPLETED' || currentState === 'CANCELLED' || currentState === 'VOIDED') {
    return { 
      isValid: false, 
      error: `Cannot transition from terminal state ${currentState} to ${targetState}.` 
    };
  }

  const allowed = VALID_TRANSITIONS[currentState] || [];
  if (!allowed.includes(targetState)) {
    return {
      isValid: false,
      error: `Invalid order state transition from ${currentState} to ${targetState}. Allowed next steps: ${allowed.join(', ') || 'None'}.`
    };
  }

  return { isValid: true };
}

/**
 * Derives the current lifecycle state from legacy order fields
 */
export function deriveOrderLifecycleState(order: Partial<Order>): OrderLifecycleState {
  if (order.status === 'cancelled') {
    return 'CANCELLED';
  }
  if (order.status === 'completed' && order.paymentStatus === 'paid') {
    return 'COMPLETED';
  }
  if (order.paymentStatus === 'paid') {
    return 'PAID';
  }
  if (order.kotStatus === 'ready') {
    return 'READY';
  }
  if (order.kotStatus === 'preparing') {
    return 'PREPARING';
  }
  if (order.kotStatus === 'accepted' || order.kotStatus === 'sent_to_kitchen') {
    return 'SENT_TO_KITCHEN';
  }
  if (order.kotStatus === 'served') {
    return 'SERVED';
  }
  if (order.status === 'active' && order.items && order.items.length > 0) {
    return 'CONFIRMED';
  }
  return 'DRAFT';
}

/**
 * Compares two order snapshots to detect and audit item modifications after KOT dispatch
 */
export function detectOrderModifications(
  originalOrder: Order,
  updatedOrder: Order
): {
  hasModifications: boolean;
  addedItems: OrderItem[];
  removedItems: OrderItem[];
  quantityChanges: { itemName: string; oldQty: number; newQty: number }[];
  discountChanged: boolean;
  tableChanged: boolean;
} {
  const isPostKOT = !!originalOrder.kotStatus && originalOrder.kotStatus !== 'pending';
  if (!isPostKOT) {
    return {
      hasModifications: false,
      addedItems: [],
      removedItems: [],
      quantityChanges: [],
      discountChanged: false,
      tableChanged: false
    };
  }

  const oldMap = new Map<string, OrderItem>();
  originalOrder.items.forEach(i => oldMap.set(i.id || i.menuItemId, i));

  const newMap = new Map<string, OrderItem>();
  updatedOrder.items.forEach(i => newMap.set(i.id || i.menuItemId, i));

  const addedItems: OrderItem[] = [];
  const removedItems: OrderItem[] = [];
  const quantityChanges: { itemName: string; oldQty: number; newQty: number }[] = [];

  // Check new items
  updatedOrder.items.forEach(item => {
    const key = item.id || item.menuItemId;
    const old = oldMap.get(key);
    if (!old) {
      addedItems.push(item);
    } else if (old.quantity !== item.quantity) {
      quantityChanges.push({
        itemName: item.name,
        oldQty: old.quantity,
        newQty: item.quantity
      });
    }
  });

  // Check removed items
  originalOrder.items.forEach(item => {
    const key = item.id || item.menuItemId;
    if (!newMap.has(key)) {
      removedItems.push(item);
    }
  });

  const discountChanged = (originalOrder.discountPercent || 0) !== (updatedOrder.discountPercent || 0);
  const tableChanged = originalOrder.tableRoomId !== updatedOrder.tableRoomId;

  const hasModifications = addedItems.length > 0 || removedItems.length > 0 || quantityChanges.length > 0 || discountChanged || tableChanged;

  return {
    hasModifications,
    addedItems,
    removedItems,
    quantityChanges,
    discountChanged,
    tableChanged
  };
}
