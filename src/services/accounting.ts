import { 
  ChartAccount, 
  Customer, 
  Expense, 
  GuestFolioItem, 
  InventoryItem, 
  MenuItem, 
  Order, 
  PaymentReconciliationRecord, 
  ProductRecipe, 
  Reservation, 
  ResortRoom, 
  Supplier, 
  SupplierPayable, 
  CustomerReceivable 
} from '../types';

import { classifyOrderPayment } from './orderAudit';

export const INITIAL_CHART_OF_ACCOUNTS: ChartAccount[] = [
  { id: 'acc-1010', code: '1010', name: 'Cash on Hand (Till / Drawer)', nepaliName: 'काउन्टर नगद (क्यास)', category: 'ASSET', subcategory: 'Current Asset', balance: 0, isSystem: true },
  { id: 'acc-1020', code: '1020', name: 'Bank Account', nepaliName: 'बैंक खाता', category: 'ASSET', subcategory: 'Current Asset', balance: 0, isSystem: true },
  { id: 'acc-1030', code: '1030', name: 'Fonepay / QR Settlement Cleared', nepaliName: 'फोनपे / क्युआर खाता', category: 'ASSET', subcategory: 'Current Asset', balance: 0, isSystem: true },
  { id: 'acc-1040', code: '1040', name: 'Accounts Receivable (Customer Khata)', nepaliName: 'ग्राहक बक्यौता (उधारो)', category: 'ASSET', subcategory: 'Current Asset', balance: 0, isSystem: true },
  { id: 'acc-1045', code: '1045', name: 'Guest Room Folio Receivable', nepaliName: 'अतिथि कोठा बक्यौता (Folio AR)', category: 'ASSET', subcategory: 'Current Asset', balance: 0, isSystem: true },
  { id: 'acc-1050', code: '1050', name: 'Food & Beverage Inventory Stock', nepaliName: 'खाद्य तथा पेय मौज्दात', category: 'ASSET', subcategory: 'Inventory', balance: 0, isSystem: true },
  { id: 'acc-2010', code: '2010', name: 'Accounts Payable (Vendor / Suppliers)', nepaliName: 'आपूर्तिकर्ता तिर्नुपर्ने', category: 'LIABILITY', subcategory: 'Current Liability', balance: 0, isSystem: true },
  { id: 'acc-2020', code: '2020', name: 'Output VAT (13%) Payable to IRD', nepaliName: 'मूल्य अभिवृद्धि कर (भ्याट)', category: 'LIABILITY', subcategory: 'Tax Liability', balance: 0, isSystem: true },
  { id: 'acc-3010', code: '3010', name: "Owner's Initial Capital Investment", nepaliName: 'मालिकको लगानी पुँजी', category: 'EQUITY', subcategory: 'Equity', balance: 0, isSystem: true },
  { id: 'acc-4010', code: '4010', name: 'Food & Restaurant Dining Sales', nepaliName: 'रेस्टुरेन्ट खाना बिक्री', category: 'REVENUE', subcategory: 'Operating Revenue', balance: 0, isSystem: true },
  { id: 'acc-4020', code: '4020', name: 'Bar, Cafe & Beverages Sales', nepaliName: 'बार तथा पेय बिक्री', category: 'REVENUE', subcategory: 'Operating Revenue', balance: 0, isSystem: true },
  { id: 'acc-4030', code: '4030', name: 'Resort Room Booking Lodging Revenue', nepaliName: 'कोठा भाडा आम्दानी', category: 'REVENUE', subcategory: 'Operating Revenue', balance: 0, isSystem: true },
  { id: 'acc-4040', code: '4040', name: 'Hospitality Service Charge Revenue', nepaliName: 'सेवा शुल्क आम्दानी', category: 'REVENUE', subcategory: 'Operating Revenue', balance: 0, isSystem: true },
  { id: 'acc-4090', code: '4090', name: 'Sales Returns & Credit Notes', nepaliName: 'बिक्री फिर्ता / क्रेडिट नोट', category: 'REVENUE', subcategory: 'Contra Revenue', balance: 0, isSystem: true },
  { id: 'acc-5010', code: '5010', name: 'Cost of Goods Sold (Raw Food Ingredients)', nepaliName: 'कच्चा पदार्थ लागत (COGS)', category: 'EXPENSE', subcategory: 'COGS', balance: 0, isSystem: true },
  { id: 'acc-6010', code: '6010', name: 'Kitchen & Service Staff Salaries', nepaliName: 'कर्मचारी तलब तथा ज्याला', category: 'EXPENSE', subcategory: 'Operating Expense', balance: 0, isSystem: true },
  { id: 'acc-6020', code: '6020', name: 'Premises Rent & Lease', nepaliName: 'घरभाडा खर्च', category: 'EXPENSE', subcategory: 'Operating Expense', balance: 0, isSystem: true },
  { id: 'acc-6030', code: '6030', name: 'Electricity, Water & Utilities', nepaliName: 'विद्युत तथा खानेपानी', category: 'EXPENSE', subcategory: 'Utilities', balance: 0, isSystem: true },
  { id: 'acc-6040', code: '6040', name: 'LPG Cooking Gas Cylinders', nepaliName: 'खाना पकाउने ग्यास', category: 'EXPENSE', subcategory: 'Fuel', balance: 0, isSystem: true },
  { id: 'acc-6050', code: '6050', name: 'General Operating & Kitchen Supplies Expense', nepaliName: 'सामान्य सञ्चालन तथा मर्मत खर्च', category: 'EXPENSE', subcategory: 'Operating Expense', balance: 0, isSystem: true }
];

export function createCleanChartOfAccounts(businessId: string): ChartAccount[] {
  return INITIAL_CHART_OF_ACCOUNTS.map(acc => ({ ...acc, businessId, balance: 0 }));
}

export function ensureDefaultChartAccounts(existingAccounts: ChartAccount[] | undefined, businessId: string): ChartAccount[] {
  const existing = existingAccounts && existingAccounts.length > 0 ? [...existingAccounts] : createCleanChartOfAccounts(businessId);
  const byCode = new Set(existing.map(a => a.code));
  for (const def of INITIAL_CHART_OF_ACCOUNTS) {
    if (!byCode.has(def.code)) {
      existing.push({ ...def, businessId, balance: 0 });
    }
  }
  return existing.sort((a, b) => a.code.localeCompare(b.code));
}

function roundMoney(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function isWithinTimeframe(dateRaw: string | undefined, timeframe: string, now: Date = new Date()): boolean {
  if (!dateRaw) return timeframe === 'all';
  const d = new Date(dateRaw);
  if (isNaN(d.getTime())) return timeframe === 'all';

  if (timeframe === 'today') {
    return d.toDateString() === now.toDateString();
  }
  if (timeframe === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return d.toDateString() === y.toDateString();
  }
  if (timeframe === '7days' || timeframe === 'week') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return d.getTime() >= start.getTime() && d.getTime() <= now.getTime();
  }
  if (timeframe === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (timeframe === 'prev_month') {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
  }
  if (timeframe === 'year') {
    return d.getFullYear() === now.getFullYear();
  }
  return true;
}

export function calculateProfitAndLoss(
  orders: Order[],
  expenses: Expense[],
  inventory: InventoryItem[],
  recipes: ProductRecipe[],
  timeframe: string,
  menuItems: MenuItem[] = []
) {
  const now = new Date();
  // Only count completed (settled) orders in official P&L revenue (exclude cancelled & unsettled open tables)
  const filteredOrders = orders.filter(o => {
    if (o.status !== 'completed') return false;
    return isWithinTimeframe(o.settledAt || o.createdAt, timeframe, now);
  });

  const filteredExpenses = expenses.filter(e => isWithinTimeframe(e.date, timeframe, now));

  const invCostMap = new Map<string, number>();
  for (const inv of inventory || []) {
    invCostMap.set(inv.id, Number(inv.averageCost || inv.costPerUnit) || 0);
  }
  const recipeMap = new Map<string, ProductRecipe>();
  for (const r of recipes || []) {
    recipeMap.set(r.menuItemId, r);
  }
  const menuCostMap = new Map<string, number>();
  for (const m of menuItems || []) {
    if (typeof m.costPrice === 'number' && m.costPrice > 0) {
      menuCostMap.set(m.id, m.costPrice);
    }
  }

  let foodSales = 0;
  let beverageSales = 0;
  let roomRevenue = 0;
  let roomService = 0;
  let otherServices = 0;
  let discountsGiven = 0;
  let grossRevenue = 0;
  let foodCost = 0;
  let beverageCost = 0;

  for (const o of filteredOrders) {
    grossRevenue += Number(o.subtotal) || Number(o.grandTotal) || 0;
    discountsGiven += Number(o.discountAmount) || 0;
    for (const item of o.items) {
      const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
      const isBev =
        item.category === 'coffee' ||
        item.category === 'tea' ||
        item.category === 'cold_drinks' ||
        item.category === 'mocktails' ||
        item.category === 'cafe_beverages' ||
        item.category === 'bar_spirits';

      if (isBev) {
        beverageSales += itemTotal;
      } else if (item.category === 'resort_rooms') {
        roomRevenue += itemTotal;
      } else {
        foodSales += itemTotal;
      }

      // Compute true COGS per unit from Recipe Studio BOM first, then menuItem.costPrice (0 if uncosted — never fabricate fake ratios)
      let unitCost = 0;
      const recipe = recipeMap.get(item.menuItemId);
      if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
        unitCost = recipe.ingredients.reduce((sum, ing) => {
          return sum + (Number(ing.quantity) || 0) * (invCostMap.get(ing.inventoryItemId) || 0);
        }, 0);
      } else if (menuCostMap.has(item.menuItemId)) {
        unitCost = menuCostMap.get(item.menuItemId) || 0;
      }

      const itemCost = unitCost * (Number(item.quantity) || 0);
      if (isBev) beverageCost += itemCost;
      else if (item.category !== 'resort_rooms') foodCost += itemCost;
    }
  }

  grossRevenue = roundMoney(grossRevenue);
  discountsGiven = roundMoney(discountsGiven);
  foodSales = roundMoney(foodSales);
  beverageSales = roundMoney(beverageSales);
  roomRevenue = roundMoney(roomRevenue);
  foodCost = roundMoney(foodCost);
  beverageCost = roundMoney(beverageCost);

  const netSalesRevenue = roundMoney(Math.max(0, grossRevenue - discountsGiven));
  const totalCogs = roundMoney(foodCost + beverageCost);
  const grossProfit = roundMoney(netSalesRevenue - totalCogs);
  const grossMarginPercent = netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;

  let salaryWages = 0;
  let rent = 0;
  let utilities = 0;
  let gasFuel = 0;
  let maintenance = 0;
  let laundry = 0;
  let supplies = 0;
  let marketing = 0;
  let internet = 0;
  let otherExpenses = 0;

  for (const e of filteredExpenses) {
    const amt = Number(e.amount) || 0;
    const cat = (e.category || '').toLowerCase();
    if (cat.includes('salary') || cat.includes('wage')) salaryWages += amt;
    else if (cat.includes('rent')) rent += amt;
    else if (cat.includes('util') || cat.includes('elec') || cat.includes('water')) utilities += amt;
    else if (cat.includes('gas') || cat.includes('fuel')) gasFuel += amt;
    else if (cat.includes('maint') || cat.includes('repair')) maintenance += amt;
    else if (cat.includes('laundry')) laundry += amt;
    else if (cat.includes('suppl')) supplies += amt;
    else if (cat.includes('market') || cat.includes('ad')) marketing += amt;
    else if (cat.includes('internet') || cat.includes('soft')) internet += amt;
    else otherExpenses += amt;
  }

  const totalOperatingExpenses = roundMoney(
    salaryWages + rent + utilities + gasFuel + maintenance + laundry + supplies + marketing + internet + otherExpenses
  );
  const netOperatingProfit = roundMoney(grossProfit - totalOperatingExpenses);
  const netMarginPercent = netSalesRevenue > 0 ? (netOperatingProfit / netSalesRevenue) * 100 : 0;

  return {
    revenue: {
      foodSales,
      beverageSales,
      roomRevenue,
      roomService,
      otherServices,
      discountsGiven,
      netSalesRevenue,
      grossRevenue
    },
    cogs: {
      foodCost,
      beverageCost,
      totalCogs
    },
    grossProfit,
    grossMarginPercent,
    operatingExpenses: {
      salaryWages: roundMoney(salaryWages),
      rent: roundMoney(rent),
      utilities: roundMoney(utilities),
      gasFuel: roundMoney(gasFuel),
      maintenance: roundMoney(maintenance),
      laundry: roundMoney(laundry),
      supplies: roundMoney(supplies),
      marketing: roundMoney(marketing),
      internet: roundMoney(internet),
      otherExpenses: roundMoney(otherExpenses),
      totalOperatingExpenses
    },
    netOperatingProfit,
    netMarginPercent
  };
}

export function calculateBalanceSummary(
  accounts: ChartAccount[],
  _orders: Order[],
  _expenses: Expense[],
  _inventory: InventoryItem[],
  _customers: Customer[],
  _payables: SupplierPayable[]
) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const acc of accounts) {
    if (acc.category === 'ASSET') totalAssets += acc.balance;
    else if (acc.category === 'LIABILITY') totalLiabilities += acc.balance;
    else if (acc.category === 'EQUITY') totalEquity += acc.balance;
  }

  totalAssets = roundMoney(totalAssets);
  totalLiabilities = roundMoney(totalLiabilities);
  totalEquity = roundMoney(totalEquity);

  const netWorth = roundMoney(totalAssets - totalLiabilities);
  const workingCapital = netWorth;
  const currentRatio = totalLiabilities > 0 ? totalAssets / totalLiabilities : (totalAssets > 0 ? 1 : 0);
  const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : 0;

  return {
    totalAssets,
    totalLiabilities,
    totalEquity,
    assets: { totalAssets },
    liabilities: { totalLiabilities },
    equity: { totalEquity },
    netWorth,
    workingCapital,
    currentRatio,
    debtToEquity,
    assetAccounts: accounts.filter(a => a.category === 'ASSET'),
    liabilityAccounts: accounts.filter(a => a.category === 'LIABILITY'),
    equityAccounts: accounts.filter(a => a.category === 'EQUITY')
  };
}

export function calculatePaymentReconciliation(
  orders: Order[],
  reconciliations: PaymentReconciliationRecord[]
) {
  const settledOrders = orders.filter(o => o.status === 'completed');

  const totals: Record<string, number> = {
    cash: 0,
    fonepay: 0,
    esewa: 0,
    khalti: 0,
    card: 0,
    credit: 0
  };

  for (const o of settledOrders) {
    const p = classifyOrderPayment(o);
    totals.cash += p.cash;
    totals.fonepay += p.fonepayQr;
    totals.esewa += p.esewa;
    totals.khalti += p.khalti;
    totals.card += p.card + p.bank;
    totals.credit += p.khataCredit;
  }

  const channels: { method: string; name: string; nepaliName: string }[] = [
    { method: 'cash', name: 'Cash Counter Drawer', nepaliName: 'काउन्टर नगद (क्यास)' },
    { method: 'fonepay', name: 'Fonepay / Dynamic QR', nepaliName: 'फोनपे / क्युआर' },
    { method: 'esewa', name: 'eSewa Mobile Wallet', nepaliName: 'ईसेवा वालेट' },
    { method: 'khalti', name: 'Khalti Mobile Wallet', nepaliName: 'खल्ती वालेट' },
    { method: 'card', name: 'POS Bank Card & Transfer', nepaliName: 'बैंक कार्ड / ट्रान्सफर' },
    { method: 'credit', name: 'Customer Khata Credit', nepaliName: 'ग्राहक उधारो खाता' }
  ];

  return channels.map(ch => {
    const recorded = roundMoney(totals[ch.method] || 0);

    const rec = reconciliations.find(r => {
      const rm = (r.paymentMethod || '').toLowerCase();
      if (ch.method === 'fonepay') return rm === 'fonepay' || rm === 'fonepay_qr' || rm === 'qr';
      if (ch.method === 'credit') return rm === 'credit' || rm === 'credit_khata';
      return rm === ch.method;
    });
    const actual = rec ? roundMoney(rec.actualAmount) : recorded;
    const diff = roundMoney(actual - recorded);
    const status = Math.abs(diff) < 0.01 ? 'MATCHED' : (diff < 0 ? 'SHORT' : 'OVER');

    return {
      method: ch.method,
      name: ch.name,
      nepaliName: ch.nepaliName,
      recorded,
      actual,
      diff,
      discrepancy: diff,
      status
    };
  });
}

function computeDeterministicDaysOverdue(dueDate?: string, fallbackDate?: string, referenceNow: Date = new Date()): number {
  const target = dueDate || fallbackDate;
  if (!target) return 0;
  const d = new Date(target);
  if (isNaN(d.getTime())) return 0;
  const diffDays = Math.floor((referenceNow.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

export function calculateReceivablesAging(
  customers: Customer[],
  receivables: CustomerReceivable[]
) {
  let bucket0to30 = 0;
  let bucket31to60 = 0;
  let bucket61to90 = 0;
  let bucket90Plus = 0;
  let totalOutstanding = 0;

  const now = new Date();
  const customerStatements = customers
    .map(c => ({
      customer: c,
      balance: Number(c.creditBalance ?? (c as any).khataBalance ?? (c as any).balance ?? 0)
    }))
    .filter(item => item.balance > 0)
    .map(({ customer: c, balance }) => {
      const cleanBalance = roundMoney(balance);
      totalOutstanding += cleanBalance;
      const rec = receivables.find(r => r.customerId === c.id);
      const daysOverdue = typeof (rec as any)?.daysOverdue === 'number'
        ? Math.max(0, (rec as any).daysOverdue)
        : computeDeterministicDaysOverdue(rec?.dueDate, rec?.createdAt || c.lastVisit || c.createdAt, now);

      let bucket = '0-30 Days';
      if (daysOverdue > 90) {
        bucket = '90+ Days';
        bucket90Plus += cleanBalance;
      } else if (daysOverdue > 60) {
        bucket = '61-90 Days';
        bucket61to90 += cleanBalance;
      } else if (daysOverdue > 30) {
        bucket = '31-60 Days';
        bucket31to60 += cleanBalance;
      } else {
        bucket0to30 += cleanBalance;
      }

      return {
        customerId: c.id,
        customerName: c.name,
        phone: c.phone || 'N/A',
        balance: cleanBalance,
        daysOverdue,
        bucket
      };
    });

  return {
    aging: {
      totalOutstanding: roundMoney(totalOutstanding),
      bucket0to30: roundMoney(bucket0to30),
      bucket31to60: roundMoney(bucket31to60),
      bucket61to90: roundMoney(bucket61to90),
      bucket90Plus: roundMoney(bucket90Plus)
    },
    customerStatements
  };
}

export function calculatePayablesAging(
  suppliers: Supplier[],
  payables: SupplierPayable[]
) {
  let bucket0to30 = 0;
  let bucket31to60 = 0;
  let bucket61to90 = 0;
  let bucket90Plus = 0;
  let totalOutstanding = 0;

  const now = new Date();
  const supplierStatements: Array<{
    supplierId: string;
    supplierName: string;
    balance: number;
    daysOverdue: number;
    bucket: string;
  }> = [];

  // Aggregate from SupplierPayable documents (primary source of truth) and any legacy supplier.payableBalance
  const bySupplier = new Map<string, { name: string; balance: number; oldestDate?: string }>();
  for (const s of suppliers) {
    const legacyBal = Number((s as any).payableBalance || 0);
    if (legacyBal > 0) {
      bySupplier.set(s.id, { name: s.name, balance: legacyBal });
    }
  }
  for (const p of payables || []) {
    if (p.remainingBalance > 0 && p.status !== 'PAID') {
      const existing = bySupplier.get(p.supplierId);
      const dueOrBill = p.dueDate || p.billDate;
      if (existing) {
        existing.balance = roundMoney(existing.balance + p.remainingBalance);
        if (dueOrBill && (!existing.oldestDate || dueOrBill < existing.oldestDate)) {
          existing.oldestDate = dueOrBill;
        }
      } else {
        bySupplier.set(p.supplierId, {
          name: p.supplierName,
          balance: roundMoney(p.remainingBalance),
          oldestDate: dueOrBill
        });
      }
    }
  }

  for (const [supplierId, info] of bySupplier.entries()) {
    const cleanBalance = roundMoney(info.balance);
    totalOutstanding += cleanBalance;
    const daysOverdue = computeDeterministicDaysOverdue(info.oldestDate, undefined, now);

    let bucket = '0-30 Days';
    if (daysOverdue > 90) {
      bucket = '90+ Days';
      bucket90Plus += cleanBalance;
    } else if (daysOverdue > 60) {
      bucket = '61-90 Days';
      bucket61to90 += cleanBalance;
    } else if (daysOverdue > 30) {
      bucket = '31-60 Days';
      bucket31to60 += cleanBalance;
    } else {
      bucket0to30 += cleanBalance;
    }

    supplierStatements.push({
      supplierId,
      supplierName: info.name,
      balance: cleanBalance,
      daysOverdue,
      bucket
    });
  }

  return {
    aging: {
      totalOutstanding: roundMoney(totalOutstanding),
      bucket0to30: roundMoney(bucket0to30),
      bucket31to60: roundMoney(bucket31to60),
      bucket61to90: roundMoney(bucket61to90),
      bucket90Plus: roundMoney(bucket90Plus)
    },
    supplierStatements
  };
}

export function calculateComparisonMetrics(
  orders: Order[],
  expenses: Expense[],
  _reservations: Reservation[],
  comparisonMode: string
) {
  const now = new Date();
  const validOrders = orders.filter(o => o.status === 'completed');

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(now);
  const oneDayMs = 24 * 60 * 60 * 1000;

  let curStart = todayStart;
  let curEnd = now.getTime() + oneDayMs;
  let prevStart = todayStart - oneDayMs;
  let prevEnd = todayStart;

  if (comparisonMode === 'week') {
    curStart = todayStart - 6 * oneDayMs;
    prevStart = curStart - 7 * oneDayMs;
    prevEnd = curStart;
  } else if (comparisonMode === 'month') {
    curStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    prevEnd = curStart;
  } else if (comparisonMode === 'year') {
    curStart = new Date(now.getFullYear(), 0, 1).getTime();
    prevStart = new Date(now.getFullYear() - 1, 0, 1).getTime();
    prevEnd = curStart;
  }

  const inRange = (raw: string | undefined, startMs: number, endMs: number) => {
    if (!raw) return false;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) && ms >= startMs && ms < endMs;
  };

  const currentOrders = validOrders.filter(o => inRange(o.settledAt || o.createdAt, curStart, curEnd));
  const previousOrders = validOrders.filter(o => inRange(o.settledAt || o.createdAt, prevStart, prevEnd));

  const currentExpenses = expenses.filter(e => inRange(e.date, curStart, curEnd));
  const previousExpenses = expenses.filter(e => inRange(e.date, prevStart, prevEnd));

  const currentRevenue = roundMoney(currentOrders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0));
  const previousRevenue = roundMoney(previousOrders.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0));

  const currentExp = roundMoney(currentExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const previousExp = roundMoney(previousExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));

  const currentProfit = roundMoney(currentRevenue - currentExp);
  const previousProfit = roundMoney(previousRevenue - previousExp);

  const currentOrdersCount = currentOrders.length;
  const previousOrdersCount = previousOrders.length;

  const revenueChangePct = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  const expensesChangePct = previousExp > 0 ? ((currentExp - previousExp) / previousExp) * 100 : 0;
  const profitChangePct = previousProfit !== 0 ? ((currentProfit - previousProfit) / Math.abs(previousProfit)) * 100 : 0;
  const ordersChangePct = previousOrdersCount > 0 ? ((currentOrdersCount - previousOrdersCount) / previousOrdersCount) * 100 : 0;

  return {
    mode: comparisonMode,
    currentRevenue,
    previousRevenue,
    revenueChangePct,
    currentOrdersCount,
    previousOrdersCount,
    ordersChangePct,
    currentExp,
    previousExp,
    expensesChangePct,
    currentProfit,
    previousProfit,
    profitChangePct
  };
}

export function calculateProductMargins(
  menuItems: MenuItem[],
  recipes: ProductRecipe[],
  inventory: InventoryItem[]
) {
  const invCostMap = new Map<string, number>();
  for (const inv of inventory || []) {
    invCostMap.set(inv.id, Number(inv.averageCost || inv.costPerUnit) || 0);
  }
  const recipeMap = new Map<string, ProductRecipe>();
  for (const r of recipes || []) {
    recipeMap.set(r.menuItemId, r);
  }

  return menuItems.map(item => {
    const sellingPrice = Number(item.price) || 0;
    const recipe = recipeMap.get(item.id);
    let recipeCost = 0;
    if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
      recipeCost = recipe.ingredients.reduce((sum, ing) => {
        return sum + (Number(ing.quantity) || 0) * (invCostMap.get(ing.inventoryItemId) || 0);
      }, 0);
    }
    const estimatedCost = roundMoney(recipeCost > 0 ? recipeCost : (Number(item.costPrice) || 0));
    const grossMargin = roundMoney(sellingPrice - estimatedCost);
    const marginPercent = sellingPrice > 0 ? (grossMargin / sellingPrice) * 100 : 0;
    const isHighMargin = marginPercent >= 60;

    return {
      itemId: item.id,
      name: item.name,
      nepaliName: item.nepaliName,
      category: item.category,
      sellingPrice,
      estimatedCost,
      grossMargin,
      marginPercent,
      isHighMargin
    };
  });
}

export function calculateResortProfitability(
  rooms: ResortRoom[],
  reservations: Reservation[],
  folioItems: GuestFolioItem[]
) {
  const activeReservations = reservations.filter(r => r.status !== 'CANCELLED');
  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
  const occupancyPercent = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
  const roomRevenue = roundMoney(activeReservations.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0));
  const adr = occupiedRooms > 0 ? roundMoney(roomRevenue / occupiedRooms) : 0;
  const revpar = totalRooms > 0 ? roundMoney(roomRevenue / totalRooms) : 0;
  const roomDiningRevenue = roundMoney(
    folioItems
      .filter(f => f.category === 'RESTAURANT' || f.category === 'CAFE')
      .reduce((s, f) => s + (Number(f.totalPrice) || 0), 0)
  );

  return {
    totalRooms,
    occupiedRooms,
    occupancyPercent,
    roomRevenue,
    adr,
    revpar,
    roomDiningRevenue,
    totalNights: activeReservations.length,
    roomsList: rooms
  };
}

export function generateDailyBusinessSummary(
  businessId: string,
  businessName: string,
  date: string,
  orders: Order[],
  expenses: Expense[],
  dayClosings: any[],
  _reservations: Reservation[],
  _customers: Customer[],
  _payables: SupplierPayable[],
  _currency: string
) {
  const dayOrders = orders.filter(o => o.status === 'completed' && (o.settledAt || o.createdAt).startsWith(date));
  const totalGrossSales = roundMoney(dayOrders.reduce((sum, o) => sum + (Number(o.grandTotal) || 0), 0));
  const dayExpenses = expenses.filter(e => (e.date || '').startsWith(date));
  const totalExpenses = roundMoney(dayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  const closingRecord = dayClosings.find(c => (c.date || c.closingTime || '').startsWith(date));

  let cashSales = 0;
  let digitalSales = 0;
  let creditSales = 0;
  let totalVAT = 0;
  let totalServiceCharge = 0;

  for (const o of dayOrders) {
    const p = classifyOrderPayment(o);
    cashSales += p.cash;
    digitalSales += p.onlineTotal;
    creditSales += p.khataCredit;

    totalVAT += Number(o.vatAmount) || 0;
    totalServiceCharge += Number(o.serviceChargeAmount) || 0;
  }

  cashSales = roundMoney(cashSales);
  digitalSales = roundMoney(digitalSales);
  creditSales = roundMoney(creditSales);
  totalVAT = roundMoney(totalVAT);
  totalServiceCharge = roundMoney(totalServiceCharge);

  const estimatedDailyProfit = roundMoney(totalGrossSales - totalExpenses);
  const openingCash = closingRecord?.openingCash ?? dayClosings[0]?.actualCashInDrawer ?? 0;

  // Top 5 dishes
  const dishCounts: Record<string, { qty: number; revenue: number }> = {};
  for (const o of dayOrders) {
    for (const item of o.items) {
      if (!dishCounts[item.name]) {
        dishCounts[item.name] = { qty: 0, revenue: 0 };
      }
      dishCounts[item.name].qty += item.quantity;
      dishCounts[item.name].revenue += item.price * item.quantity;
    }
  }

  const topSellingDishes = Object.entries(dishCounts)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5)
    .map(([name, stat]) => ({ name, qty: stat.qty, revenue: roundMoney(stat.revenue) }));

  return {
    businessId,
    businessName,
    date,
    metrics: {
      totalOrders: dayOrders.length,
      totalGrossSales,
      totalExpenses,
      estimatedDailyProfit,
      openingCash,
      cashSales,
      digitalSales,
      creditSales,
      totalVAT,
      totalServiceCharge,
      cashDiscrepancy: closingRecord?.discrepancy ?? closingRecord?.variance ?? 0
    },
    topSellingDishes
  };
}

export function exportFinancialCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
