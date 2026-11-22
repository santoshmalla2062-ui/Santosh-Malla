import { 
  AppState,
  CustomerReceivable,
  Expense,
  GuestFolioItem,
  InventoryCategory,
  InventoryItem,
  InventoryUnit,
  MenuItem,
  Order,
  ProductRecipe,
  PurchaseOrder,
  RecipeIngredient,
  StockMovement,
  StockMovementType,
  Supplier,
  SupplierPayable,
  SupplierPaymentRecord
} from '../types';

/**
 * Unit conversion helper (e.g. g to kg, ml to ltr)
 */
export function convertUnitQuantity(
  qty: number,
  fromUnit: InventoryUnit,
  toUnit: InventoryUnit
): { convertedQty: number; isValid: boolean; error?: string } {
  if (fromUnit === toUnit) {
    return { convertedQty: qty, isValid: true };
  }

  // Weight conversions: kg <-> g
  if (fromUnit === 'g' && toUnit === 'kg') {
    return { convertedQty: qty / 1000, isValid: true };
  }
  if (fromUnit === 'kg' && toUnit === 'g') {
    return { convertedQty: qty * 1000, isValid: true };
  }

  // Volume conversions: ml <-> ltr
  if (fromUnit === 'ml' && toUnit === 'ltr') {
    return { convertedQty: qty / 1000, isValid: true };
  }
  if (fromUnit === 'ltr' && toUnit === 'ml') {
    return { convertedQty: qty * 1000, isValid: true };
  }

  // Quantity conversions: dozen <-> pcs
  if (fromUnit === 'dozen' && toUnit === 'pcs') {
    return { convertedQty: qty * 12, isValid: true };
  }
  if (fromUnit === 'pcs' && toUnit === 'dozen') {
    return { convertedQty: qty / 12, isValid: true };
  }

  return {
    convertedQty: qty,
    isValid: false,
    error: `Cannot automatically convert between incompatible units [${fromUnit}] and [${toUnit}].`
  };
}

/**
 * Validates stock deduction to prevent unauthorized negative inventory
 */
export function validateStockDeduction(
  item: InventoryItem,
  requestedDeduction: number,
  allowNegativeStock: boolean = false
): { isValid: boolean; error?: string } {
  if (requestedDeduction <= 0) {
    return { isValid: false, error: 'Deduction quantity must be strictly greater than zero.' };
  }

  if (!allowNegativeStock && requestedDeduction > item.currentStock) {
    return {
      isValid: false,
      error: `Insufficient stock for [${item.name}]. Current inventory is ${item.currentStock} ${item.unit}, but attempted deduction is ${requestedDeduction} ${item.unit}. Negative inventory is disabled.`
    };
  }

  return { isValid: true };
}

/**
 * Deducts stock for a completed order using recipes (Idempotent - never deducts twice)
 */
export function processOrderRecipeDeductions(
  order: Order,
  inventoryItems: InventoryItem[],
  recipes: ProductRecipe[] = [],
  menuItems: MenuItem[] = [],
  userId: string = 'system',
  userName: string = 'POS System',
  allowNegativeStock: boolean = false
): {
  success: boolean;
  updatedOrder: Order;
  updatedInventory: InventoryItem[];
  movements: StockMovement[];
  error?: string;
} {
  // Idempotency: if already deducted, do not deduct again!
  if (order.inventoryDeducted) {
    return {
      success: true,
      updatedOrder: order,
      updatedInventory: inventoryItems,
      movements: []
    };
  }

  const updatedInventory = [...inventoryItems];
  const movements: StockMovement[] = [];
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  for (const item of order.items) {
    // Check if recipe exists in recipes array or in menuItem.inventoryRecipe
    const matchedRecipe = recipes.find(r => r.menuItemId === item.menuItemId && r.isActive);
    const matchedMenu = menuItems.find(m => m.id === item.menuItemId);

    let ingredientList: Array<{ itemId: string; qty: number; unit: InventoryUnit }> = [];

    if (matchedRecipe && matchedRecipe.ingredients.length > 0) {
      ingredientList = matchedRecipe.ingredients.map(ing => ({
        itemId: ing.inventoryItemId,
        qty: ing.quantity * item.quantity,
        unit: ing.unit
      }));
    } else if (matchedMenu?.inventoryRecipe && matchedMenu.inventoryRecipe.length > 0) {
      ingredientList = matchedMenu.inventoryRecipe.map(ing => ({
        itemId: ing.inventoryItemId,
        qty: ing.amount * item.quantity,
        unit: (ing.unit as InventoryUnit) || 'pcs'
      }));
    }

    // Process deduction for each ingredient
    for (const ing of ingredientList) {
      const invIdx = updatedInventory.findIndex(i => i.id === ing.itemId);
      if (invIdx >= 0) {
        const invItem = updatedInventory[invIdx];
        
        // Convert unit if necessary
        const conv = convertUnitQuantity(ing.qty, ing.unit, invItem.unit);
        const deductQty = conv.convertedQty;

        const validation = validateStockDeduction(invItem, deductQty, allowNegativeStock);
        if (!validation.isValid && !allowNegativeStock) {
          return {
            success: false,
            updatedOrder: order,
            updatedInventory: inventoryItems,
            movements: [],
            error: validation.error
          };
        }

        const prevStock = invItem.currentStock;
        const newStock = Math.max(0, Math.round((prevStock - deductQty) * 1000) / 1000);

        updatedInventory[invIdx] = {
          ...invItem,
          currentStock: newStock,
          lastUpdated: nowStr
        };

        const movement: StockMovement = {
          id: 'sm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          businessId: order.businessId || invItem.businessId || 'biz-default',
          inventoryItemId: invItem.id,
          itemName: invItem.name,
          movementType: 'SALE_CONSUMPTION',
          quantity: deductQty,
          unit: invItem.unit,
          previousStock: prevStock,
          newStock: newStock,
          costPerUnit: invItem.averageCost || invItem.costPerUnit,
          totalCost: Math.round(deductQty * (invItem.averageCost || invItem.costPerUnit) * 100) / 100,
          reason: `POS Sale Consumption: ${item.quantity}x ${item.name} (Invoice #${order.invoiceNumber || order.id})`,
          referenceTransactionId: order.id,
          userId,
          userName,
          dateTime: nowStr
        };

        movements.push(movement);
      }
    }
  }

  const updatedOrder: Order = {
    ...order,
    inventoryDeducted: true
  };

  return {
    success: true,
    updatedOrder,
    updatedInventory,
    movements
  };
}

/**
 * Restores recipe stock if an order with inventoryDeducted === true is cancelled or voided
 */
export function restoreOrderRecipeDeductions(
  order: Order,
  inventoryItems: InventoryItem[],
  recipes: ProductRecipe[] = [],
  menuItems: MenuItem[] = [],
  userId: string = 'system',
  userName: string = 'POS System',
  reason: string = 'Order Cancelled / Voided'
): {
  success: boolean;
  updatedOrder: Order;
  updatedInventory: InventoryItem[];
  movements: StockMovement[];
} {
  // If not previously deducted, nothing to restore
  if (!order.inventoryDeducted) {
    return {
      success: true,
      updatedOrder: order,
      updatedInventory: inventoryItems,
      movements: []
    };
  }

  const updatedInventory = [...inventoryItems];
  const movements: StockMovement[] = [];
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  for (const item of order.items) {
    const matchedRecipe = recipes.find(r => r.menuItemId === item.menuItemId && r.isActive);
    const matchedMenu = menuItems.find(m => m.id === item.menuItemId);

    let ingredientList: Array<{ itemId: string; qty: number; unit: InventoryUnit }> = [];

    if (matchedRecipe && matchedRecipe.ingredients.length > 0) {
      ingredientList = matchedRecipe.ingredients.map(ing => ({
        itemId: ing.inventoryItemId,
        qty: ing.quantity * item.quantity,
        unit: ing.unit
      }));
    } else if (matchedMenu?.inventoryRecipe && matchedMenu.inventoryRecipe.length > 0) {
      ingredientList = matchedMenu.inventoryRecipe.map(ing => ({
        itemId: ing.inventoryItemId,
        qty: ing.amount * item.quantity,
        unit: (ing.unit as InventoryUnit) || 'pcs'
      }));
    }

    for (const ing of ingredientList) {
      const invIdx = updatedInventory.findIndex(i => i.id === ing.itemId);
      if (invIdx >= 0) {
        const invItem = updatedInventory[invIdx];
        const conv = convertUnitQuantity(ing.qty, ing.unit, invItem.unit);
        const restoreQty = conv.convertedQty;

        const prevStock = invItem.currentStock;
        const newStock = Math.round((prevStock + restoreQty) * 1000) / 1000;

        updatedInventory[invIdx] = {
          ...invItem,
          currentStock: newStock,
          lastUpdated: nowStr
        };

        const movement: StockMovement = {
          id: 'sm-rev-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          businessId: order.businessId || invItem.businessId || 'biz-default',
          inventoryItemId: invItem.id,
          itemName: invItem.name,
          movementType: 'RETURN',
          quantity: restoreQty,
          unit: invItem.unit,
          previousStock: prevStock,
          newStock: newStock,
          costPerUnit: invItem.averageCost || invItem.costPerUnit,
          totalCost: Math.round(restoreQty * (invItem.averageCost || invItem.costPerUnit) * 100) / 100,
          reason: `Stock Restored (${reason}): ${item.quantity}x ${item.name} (Order #${order.id})`,
          referenceTransactionId: order.id,
          userId,
          userName,
          dateTime: nowStr
        };

        movements.push(movement);
      }
    }
  }

  const updatedOrder: Order = {
    ...order,
    inventoryDeducted: false
  };

  return {
    success: true,
    updatedOrder,
    updatedInventory,
    movements
  };
}

/**
 * Calculates Recipe Costing & Gross Margin
 */
export function calculateRecipeCosting(
  ingredients: RecipeIngredient[],
  sellingPrice: number,
  inventoryItems: InventoryItem[]
): {
  estimatedCost: number;
  sellingPrice: number;
  grossMargin: number;
  marginPercent: number;
  detailedIngredients: RecipeIngredient[];
} {
  let estimatedCost = 0;

  const detailedIngredients = ingredients.map(ing => {
    const item = inventoryItems.find(i => i.id === ing.inventoryItemId);
    const unitCost = item?.averageCost || item?.costPerUnit || ing.costPerUnit || 0;
    
    // Check unit conversion if ingredient unit differs from inventory unit
    let convertedQty = ing.quantity;
    if (item && item.unit !== ing.unit) {
      const conv = convertUnitQuantity(ing.quantity, ing.unit, item.unit);
      if (conv.isValid) convertedQty = conv.convertedQty;
    }

    const itemTotalCost = Math.round(convertedQty * unitCost * 100) / 100;
    estimatedCost += itemTotalCost;

    return {
      ...ing,
      costPerUnit: unitCost,
      totalCost: itemTotalCost
    };
  });

  estimatedCost = Math.round(estimatedCost * 100) / 100;
  const grossMargin = Math.round((sellingPrice - estimatedCost) * 100) / 100;
  const marginPercent = sellingPrice > 0 
    ? Math.round(((grossMargin / sellingPrice) * 100) * 10) / 10 
    : 0;

  return {
    estimatedCost,
    sellingPrice,
    grossMargin,
    marginPercent,
    detailedIngredients
  };
}

/**
 * Goods Received Workflow: Idempotent & Partial Receiving with Weighted Average Costing
 */
export function processGoodsReceived(
  po: PurchaseOrder,
  receivedItems: Array<{ inventoryItemId: string; quantityToReceive: number; unitPrice?: number }>,
  inventoryItems: InventoryItem[],
  userId: string,
  userName: string,
  deliveryNotes?: string
): {
  updatedPO: PurchaseOrder;
  updatedInventory: InventoryItem[];
  movements: StockMovement[];
  payableCreated?: SupplierPayable;
  totalReceivedValue: number;
} {
  const updatedInventory = [...inventoryItems];
  const movements: StockMovement[] = [];
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  let totalReceivedValue = 0;

  const updatedPOItems = po.items.map(poItem => {
    const recv = receivedItems.find(r => r.inventoryItemId === poItem.inventoryItemId);
    if (!recv || recv.quantityToReceive <= 0) return poItem;

    const newReceivedQty = Math.min(poItem.quantityOrdered, poItem.quantityReceived + recv.quantityToReceive);
    const actualReceivedThisBatch = newReceivedQty - poItem.quantityReceived;

    if (actualReceivedThisBatch > 0) {
      const unitPrice = recv.unitPrice || poItem.unitPrice;
      const batchValue = actualReceivedThisBatch * unitPrice;
      totalReceivedValue += batchValue;

      // Update inventory item stock and recalculate weighted average cost
      const invIdx = updatedInventory.findIndex(i => i.id === poItem.inventoryItemId);
      if (invIdx >= 0) {
        const item = updatedInventory[invIdx];
        const prevStock = item.currentStock;
        const prevAvgCost = item.averageCost || item.costPerUnit;
        const newStock = Math.round((prevStock + actualReceivedThisBatch) * 1000) / 1000;

        // Weighted Average Cost formula:
        // (prevStock * prevAvgCost + receivedQty * unitPrice) / (prevStock + receivedQty)
        const newAvgCost = newStock > 0
          ? Math.round(((prevStock * prevAvgCost + actualReceivedThisBatch * unitPrice) / newStock) * 100) / 100
          : unitPrice;

        updatedInventory[invIdx] = {
          ...item,
          currentStock: newStock,
          averageCost: newAvgCost,
          costPerUnit: unitPrice,
          lastUpdated: nowStr
        };

        const movement: StockMovement = {
          id: 'sm-grn-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          businessId: po.businessId,
          inventoryItemId: item.id,
          itemName: item.name,
          movementType: 'PURCHASE',
          quantity: actualReceivedThisBatch,
          unit: item.unit,
          previousStock: prevStock,
          newStock: newStock,
          costPerUnit: unitPrice,
          totalCost: Math.round(batchValue * 100) / 100,
          reason: `Goods Received: PO #${po.poNumber} (${po.supplierName})`,
          referenceTransactionId: po.id,
          userId,
          userName,
          dateTime: nowStr,
          notes: deliveryNotes
        };

        movements.push(movement);
      }
    }

    return {
      ...poItem,
      quantityReceived: newReceivedQty
    };
  });

  // Calculate new PO Status
  const allFulfilled = updatedPOItems.every(i => i.quantityReceived >= i.quantityOrdered);
  const anyReceived = updatedPOItems.some(i => i.quantityReceived > 0);
  const newStatus = allFulfilled ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;

  const updatedPO: PurchaseOrder = {
    ...po,
    items: updatedPOItems,
    status: newStatus,
    receivedDate: nowStr
  };

  // Create or update Supplier Payable
  let payableCreated: SupplierPayable | undefined = undefined;
  if (totalReceivedValue > 0) {
    payableCreated = {
      id: 'sp-' + Date.now(),
      businessId: po.businessId,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      purchaseOrderId: po.id,
      billNumber: `BILL-${po.poNumber}`,
      billDate: nowStr.split(' ')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], // Net 15
      totalAmount: Math.round(totalReceivedValue * 100) / 100,
      paidAmount: 0,
      remainingBalance: Math.round(totalReceivedValue * 100) / 100,
      status: 'UNPAID',
      notes: `Payable generated for Goods Received against PO #${po.poNumber}`
    };
  }

  return {
    updatedPO,
    updatedInventory,
    movements,
    payableCreated,
    totalReceivedValue
  };
}

/**
 * Calculates Executive Finance Dashboard Metrics
 */
export interface FinanceDashboardMetrics {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  estimatedGrossProfit: number;
  grossProfitMarginPercent: number;
  totalReceivables: number;
  totalPayables: number;
  inventoryValuation: number;
  cashInDrawer: number;
  netCashFlow: number;
}

export function calculateFinanceDashboardMetrics(
  appState: AppState,
  dateFilter: 'today' | 'week' | 'month' | 'all' = 'all'
): FinanceDashboardMetrics {
  const todayStr = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  // 1. Sales Calculation (Orders + Hotel Folio room revenue)
  const filteredOrders = appState.orders.filter(o => {
    if (o.status === 'cancelled') return false;
    const date = o.createdAt.split(' ')[0];
    if (dateFilter === 'today') return date === todayStr;
    if (dateFilter === 'week') return date >= weekAgo;
    if (dateFilter === 'month') return date >= monthAgo;
    return true;
  });

  const orderSales = filteredOrders.reduce((s, o) => s + (o.paymentMethod !== 'charge_to_room' ? o.grandTotal : 0), 0);

  const filteredFolios = (appState.guestFolioItems || []).filter(f => {
    const date = f.dateTime.split(' ')[0];
    if (dateFilter === 'today') return date === todayStr;
    if (dateFilter === 'week') return date >= weekAgo;
    if (dateFilter === 'month') return date >= monthAgo;
    return true;
  });

  const folioSales = filteredFolios.reduce((s, f) => s + f.totalPrice, 0);
  const totalSales = Math.round((orderSales + folioSales) * 100) / 100;

  // 2. Purchases
  const filteredPOs = (appState.purchaseOrders || []).filter(po => {
    if (po.status === 'CANCELLED') return false;
    const date = po.orderDate.split(' ')[0];
    if (dateFilter === 'today') return date === todayStr;
    if (dateFilter === 'week') return date >= weekAgo;
    if (dateFilter === 'month') return date >= monthAgo;
    return true;
  });

  const totalPurchases = Math.round(filteredPOs.reduce((s, po) => s + po.grandTotal, 0) * 100) / 100;

  // 3. Operational Expenses
  const filteredExpenses = (appState.expenses || []).filter(e => {
    if (e.approvalStatus === 'REJECTED') return false;
    const date = e.date.split(' ')[0];
    if (dateFilter === 'today') return date === todayStr;
    if (dateFilter === 'week') return date >= weekAgo;
    if (dateFilter === 'month') return date >= monthAgo;
    return true;
  });

  const totalExpenses = Math.round(filteredExpenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  // 4. Estimated Gross Profit & Margin
  const estimatedGrossProfit = Math.round((totalSales - totalPurchases - totalExpenses) * 100) / 100;
  const grossProfitMarginPercent = totalSales > 0
    ? Math.round(((estimatedGrossProfit / totalSales) * 100) * 10) / 10
    : 0;

  // 5. Receivables (Customer Credit / Khata + Guest Folio Dues)
  const khataDue = appState.customers.reduce((s, c) => s + Math.max(0, c.creditBalance), 0);
  const registeredReceivables = (appState.receivables || []).reduce((s, r) => s + r.balanceDue, 0);
  const totalReceivables = Math.round((khataDue + registeredReceivables) * 100) / 100;

  // 6. Payables (Supplier balances)
  const totalPayables = Math.round(
    (appState.supplierPayables || []).reduce((s, p) => s + p.remainingBalance, 0) * 100
  ) / 100;

  // 7. Inventory Valuation (Weighted Average Cost)
  const inventoryValuation = Math.round(
    appState.inventoryItems.reduce((s, item) => s + (item.currentStock * (item.averageCost || item.costPerUnit)), 0) * 100
  ) / 100;

  // 8. Cash in Drawer
  const cashSales = filteredOrders.reduce((sum, o) => {
    if (o.paymentMethod === 'cash') {
      return sum + (o.paidAmount !== undefined ? Number(o.paidAmount) || 0 : o.grandTotal);
    }
    if (o.paymentMethod === 'split' && o.paymentDetails?.cash) {
      return sum + (Number(o.paymentDetails.cash) || 0);
    }
    return sum;
  }, 0);

  const cashExpenses = filteredExpenses.reduce((sum, e) => {
    return e.paymentMode === 'cash' ? sum + e.amount : sum;
  }, 0);

  const latestDayClose = (appState.dayClosings || [])[0];
  const openingCash = latestDayClose ? (latestDayClose.actualCashInDrawer ?? latestDayClose.openingCash ?? 0) : 0;
  const cashInDrawer = Math.max(0, Math.round((openingCash + cashSales - cashExpenses) * 100) / 100);

  // 9. Net Cash Flow
  const netCashFlow = Math.round((totalSales - totalExpenses) * 100) / 100;

  return {
    totalSales,
    totalPurchases,
    totalExpenses,
    estimatedGrossProfit,
    grossProfitMarginPercent,
    totalReceivables,
    totalPayables,
    inventoryValuation,
    cashInDrawer,
    netCashFlow
  };
}

/**
 * Physical Stock Audit & Variance Calculation
 */
export function recordStockAuditAdjustment(
  item: InventoryItem,
  physicalCount: number,
  userId: string,
  userName: string,
  reason: string = 'Physical Stock Audit'
): {
  updatedItem: InventoryItem;
  movement: StockMovement;
  variance: number;
} {
  const prevStock = item.currentStock;
  const variance = Math.round((physicalCount - prevStock) * 1000) / 1000;
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const updatedItem: InventoryItem = {
    ...item,
    currentStock: physicalCount,
    lastUpdated: nowStr
  };

  const movementType: StockMovementType = variance < 0 ? 'WASTAGE' : 'ADJUSTMENT';

  const movement: StockMovement = {
    id: 'sm-aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    businessId: item.businessId || 'biz-default',
    inventoryItemId: item.id,
    itemName: item.name,
    movementType,
    quantity: Math.abs(variance),
    unit: item.unit,
    previousStock: prevStock,
    newStock: physicalCount,
    costPerUnit: item.averageCost || item.costPerUnit,
    totalCost: Math.round(Math.abs(variance) * (item.averageCost || item.costPerUnit) * 100) / 100,
    reason: `${reason} (Variance: ${variance > 0 ? '+' : ''}${variance} ${item.unit})`,
    userId,
    userName,
    dateTime: nowStr
  };

  return {
    updatedItem,
    movement,
    variance
  };
}

/**
 * Stock Transfer between Storage Locations
 */
export function recordStockTransfer(
  item: InventoryItem,
  transferQty: number,
  fromLocation: string,
  toLocation: string,
  userId: string,
  userName: string,
  reason: string = 'Internal Location Transfer'
): {
  movement: StockMovement;
  error?: string;
} {
  if (fromLocation === toLocation) {
    return { movement: {} as StockMovement, error: 'Source and destination locations cannot be identical.' };
  }

  if (transferQty <= 0 || transferQty > item.currentStock) {
    return { movement: {} as StockMovement, error: `Invalid transfer quantity. Current stock is ${item.currentStock} ${item.unit}.` };
  }

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const movement: StockMovement = {
    id: 'sm-trf-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    businessId: item.businessId || 'biz-default',
    inventoryItemId: item.id,
    itemName: item.name,
    movementType: 'TRANSFER',
    quantity: transferQty,
    unit: item.unit,
    previousStock: item.currentStock,
    newStock: item.currentStock, // total business stock unchanged
    costPerUnit: item.averageCost || item.costPerUnit,
    totalCost: Math.round(transferQty * (item.averageCost || item.costPerUnit) * 100) / 100,
    reason: `${reason}: Transferred from ${fromLocation} to ${toLocation}`,
    fromLocation,
    toLocation,
    userId,
    userName,
    dateTime: nowStr
  };

  return { movement };
}
