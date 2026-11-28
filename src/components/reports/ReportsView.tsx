import React, { useState, useMemo } from 'react';
import { NumberInput } from '../common/NumberInput';
import { sanitizeNumericDraft } from '../../utils/numberInput';
import { 
  BarChart3, 
  TrendingUp, 
  Receipt, 
  CreditCard, 
  Download, 
  Calendar, 
  Eye, 
  DollarSign, 
  Percent, 
  Sparkles,
  Banknote,
  QrCode,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  X,
  FileText,
  Lock,
  Unlock,
  Printer,
  Scale,
  Building,
  Hotel,
  ShieldCheck,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Layers,
  ChevronRight
} from 'lucide-react';
import { 
  AppState,
  BusinessSettings, 
  BusinessTenant,
  ChartAccount,
  FinancialPeriod,
  JournalEntry,
  CreditNoteRecord,
  Order, 
  PaymentMethod,
  PaymentReconciliationRecord,
  PurchaseOrder,
  Session 
} from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { exportSalesCSV } from '../../services/storage';
import { 
  calculateProfitAndLoss,
  calculateBalanceSummary,
  calculatePaymentReconciliation,
  calculateReceivablesAging,
  calculatePayablesAging,
  calculateComparisonMetrics,
  calculateProductMargins,
  calculateResortProfitability,
  generateDailyBusinessSummary,
  exportFinancialCSV,
  INITIAL_CHART_OF_ACCOUNTS
} from '../../services/accounting';
import {
  buildSalesVatRegisterRows,
  buildPurchaseVatRegisterRows,
  summarizeSalesVatRegister,
  exportAnnex5SalesCSV,
  exportAnnex5PurchaseCSV,
  buildCbmsBatchPayload,
  getNepalFiscalYear
} from '../../services/irdCompliance';
import {
  calculateTrialBalance,
  postOpeningBalanceJournal
} from '../../services/generalLedger';
import { ReceiptModal } from '../pos/ReceiptModal';
import { TodayOperationsAuditPanel } from './TodayOperationsAuditPanel';
import { classifyOrderPayment, isInternalArchivalOrder, summarizeOrderDishes } from '../../services/orderAudit';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

type FinanceSubTab = 
  | 'sales_analytics' 
  | 'profit_loss' 
  | 'reconciliation' 
  | 'chart_of_accounts' 
  | 'ird_vat'
  | 'receivables_payables' 
  | 'comparisons' 
  | 'profitability' 
  | 'daily_summary' 
  | 'period_control';

interface ReportsViewProps {
  orders: Order[];
  settings: BusinessSettings;
  lang: Language;
  appState?: AppState;
  activeBusiness?: BusinessTenant;
  currentSession?: Session | null;
  onUpdateAppState?: React.Dispatch<React.SetStateAction<AppState>>;
  recordAudit?: (action: string, targetId?: string, details?: string, severity?: 'INFO' | 'WARNING' | 'CRITICAL') => void;
  hasMoreCloudOrders?: boolean;
  isLoadingOlderCloudOrders?: boolean;
  onLoadOlderOrders?: () => Promise<number>;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  orders,
  settings,
  lang,
  appState,
  activeBusiness,
  currentSession,
  onUpdateAppState,
  recordAudit,
  hasMoreCloudOrders = false,
  isLoadingOlderCloudOrders = false,
  onLoadOlderOrders
}) => {
  const t = TRANSLATIONS[lang];
  const [activeSubTab, setActiveSubTab] = useState<FinanceSubTab>('sales_analytics');
  const [timeframe, setTimeframe] = useState<'today' | '7days' | 'month' | 'all'>('month');
  const [plTimeframe, setPlTimeframe] = useState<'today' | 'yesterday' | '7days' | 'month' | 'prev_month' | 'year'>('month');
  const [comparisonMode, setComparisonMode] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // Modals & Detailed Views
  const [viewReceiptOrder, setViewReceiptOrder] = useState<Order | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [showReconcileModal, setShowReconcileModal] = useState<boolean>(false);
  const [reconcileTargetMethod, setReconcileTargetMethod] = useState<PaymentMethod>('cash');
  const [reconcileActualAmount, setReconcileActualAmount] = useState<number>(0);
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [periodLockError, setPeriodLockError] = useState<string | null>(null);

  // Daily Summary Date Picker
  const [dailySummaryDate, setDailySummaryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // New Chart of Account form
  const [newAccCode, setNewAccCode] = useState<string>('');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccNepaliName, setNewAccNepaliName] = useState<string>('');
  const [newAccCategory, setNewAccCategory] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('EXPENSE');
  const [newAccSubcategory, setNewAccSubcategory] = useState<string>('other_expenses');
  const [newAccBalance, setNewAccBalance] = useState<number>(0);

  // IRD VAT Register & General Ledger State
  const [vatMonthFilter, setVatMonthFilter] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [vatRegisterMode, setVatRegisterMode] = useState<'sales' | 'purchase'>('sales');
  const [journalFilterType, setJournalFilterType] = useState<
    'ALL' | 'POS_SALE' | 'CREDIT_NOTE' | 'EXPENSE' | 'KHATA_COLLECTION' | 'HOTEL_PAYMENT' | 'OPENING_BALANCE'
  >('ALL');
  const [showOpeningBalanceModal, setShowOpeningBalanceModal] = useState<boolean>(false);
  const [openingAccountCode, setOpeningAccountCode] = useState<string>('1010');
  const [openingAmount, setOpeningAmount] = useState<string>('');
  const [openingMemo, setOpeningMemo] = useState<string>('Owner Initial Cash / Bank Capital');

  // Table search & filters in Sales Analytics
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');

  // Safe entity extraction from appState
  const safeExpenses = useMemo(() => appState?.expenses || [], [appState?.expenses]);
  const safeInventory = useMemo(() => appState?.inventoryItems || [], [appState?.inventoryItems]);
  const safeRecipes = useMemo(() => appState?.recipes || [], [appState?.recipes]);
  const safeCustomers = useMemo(() => appState?.customers || [], [appState?.customers]);
  const safeSuppliers = useMemo(() => appState?.suppliers || [], [appState?.suppliers]);
  const safePayables = useMemo(() => appState?.supplierPayables || [], [appState?.supplierPayables]);
  const safeReceivables = useMemo(() => appState?.receivables || [], [appState?.receivables]);
  const safeDayClosings = useMemo(() => appState?.dayClosings || [], [appState?.dayClosings]);
  const safeReservations = useMemo(() => appState?.reservations || [], [appState?.reservations]);
  const safeRooms = useMemo(() => appState?.resortRooms || [], [appState?.resortRooms]);
  const safeFolioItems = useMemo(() => appState?.guestFolioItems || [], [appState?.guestFolioItems]);
  const safeMenuItems = useMemo(() => appState?.menuItems || [], [appState?.menuItems]);
  const safeCreditNotes: CreditNoteRecord[] = useMemo(() => appState?.creditNotes || [], [appState?.creditNotes]);
  const safePurchaseOrders: PurchaseOrder[] = useMemo(() => appState?.purchaseOrders || [], [appState?.purchaseOrders]);
  const safeJournalEntries: JournalEntry[] = useMemo(() => appState?.journalEntries || [], [appState?.journalEntries]);
  const safeAccounts: ChartAccount[] = useMemo(
    () => (appState?.accounts && appState.accounts.length > 0 ? appState.accounts : INITIAL_CHART_OF_ACCOUNTS),
    [appState?.accounts]
  );
  const safeReconciliations: PaymentReconciliationRecord[] = useMemo(() => appState?.paymentReconciliations || [], [appState?.paymentReconciliations]);
  const safePeriods: FinancialPeriod[] = useMemo(() => appState?.financialPeriods || [
    {
      id: 'p-current',
      businessId: activeBusiness?.businessId || 'default',
      periodName: `Fiscal Year ${new Date().getFullYear()}`,
      startDate: `${new Date().getFullYear()}-01-01`,
      endDate: `${new Date().getFullYear()}-12-31`,
      status: 'OPEN'
    }
  ], [appState?.financialPeriods, activeBusiness?.businessId]);

  // Currency label
  const currency = settings.currencySymbol || 'Rs.';

  // 1. FILTERED ORDERS FOR SALES ANALYTICS
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter(o => {
      if (timeframe === 'all') return true;
      const orderDate = new Date(o.createdAt);
      if (isNaN(orderDate.getTime())) return true;

      if (timeframe === 'today') {
        return orderDate.toDateString() === now.toDateString();
      }
      if (timeframe === '7days') {
        const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      if (timeframe === 'month') {
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [orders, timeframe]);

  const nonCancelledOrders = useMemo(() => {
    return filteredOrders.filter(o => o.status !== 'cancelled');
  }, [filteredOrders]);

  const totalRevenue = nonCancelledOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalPaid = nonCancelledOrders.reduce((sum, o) => sum + (o.paidAmount !== undefined ? o.paidAmount : (o.paymentStatus === 'paid' ? o.grandTotal : 0)), 0);
  const totalDue = nonCancelledOrders.reduce((sum, o) => sum + (o.dueAmount !== undefined ? o.dueAmount : (o.paymentStatus === 'credit' ? o.grandTotal : 0)), 0);
  const totalVat = nonCancelledOrders.reduce((sum, o) => sum + o.vatAmount, 0);
  const totalServiceCharge = nonCancelledOrders.reduce((sum, o) => sum + o.serviceChargeAmount, 0);
  const avgOrderValue = nonCancelledOrders.length > 0 ? totalRevenue / nonCancelledOrders.length : 0;

  // Payment Breakdown (accurate across split, partial, credit_khata, digital & room charges)
  const paymentBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {
      cash: 0,
      fonepay_qr: 0,
      esewa: 0,
      khalti: 0,
      card: 0,
      bank: 0,
      credit_khata: 0,
      charge_to_room: 0
    };

    nonCancelledOrders.forEach(o => {
      if (o.status === 'active') return;
      const p = classifyOrderPayment(o);
      breakdown.cash += p.cash;
      breakdown.fonepay_qr += p.fonepayQr;
      breakdown.esewa += p.esewa;
      breakdown.khalti += p.khalti;
      breakdown.card += p.card;
      breakdown.bank += p.bank;
      breakdown.credit_khata += p.khataCredit;
      breakdown.charge_to_room += p.roomCharge;
    });

    Object.keys(breakdown).forEach(k => {
      breakdown[k] = Math.round(breakdown[k] * 100) / 100;
    });

    return breakdown;
  }, [nonCancelledOrders]);

  const cashSales = paymentBreakdown.cash;
  const digitalSales = Math.round(
    (paymentBreakdown.fonepay_qr + paymentBreakdown.esewa + paymentBreakdown.khalti + paymentBreakdown.card + paymentBreakdown.bank) * 100
  ) / 100;

  // Sales by Category
  const categorySales = useMemo(() => {
    const map: Record<string, { qty: number; revenue: number }> = {};
    nonCancelledOrders.forEach(o => {
      o.items.forEach(item => {
        const cat = item.category || 'other';
        if (!map[cat]) {
          map[cat] = { qty: 0, revenue: 0 };
        }
        map[cat].qty += item.quantity;
        map[cat].revenue += item.price * item.quantity;
      });
    });

    return Object.entries(map).map(([category, data]) => ({
      category,
      qty: data.qty,
      revenue: data.revenue,
      percentOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);
  }, [nonCancelledOrders, totalRevenue]);

  // Top Selling Items (exclude cancelled orders)
  const topSellingItems = useMemo(() => {
    const itemMap: Record<string, { name: string; nepaliName?: string; qty: number; revenue: number }> = {};
    nonCancelledOrders.forEach(o => {
      o.items.forEach(item => {
        if (!itemMap[item.menuItemId]) {
          itemMap[item.menuItemId] = {
            name: item.name,
            nepaliName: item.nepaliName,
            qty: 0,
            revenue: 0
          };
        }
        itemMap[item.menuItemId].qty += item.quantity;
        itemMap[item.menuItemId].revenue += item.price * item.quantity;
      });
    });

    return Object.values(itemMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
  }, [nonCancelledOrders]);

  // 7-Day Daily Gross Revenue for Recharts
  const last7DaysRevenueData = useMemo(() => {
    const days: { dateStr: string; label: string; revenue: number; ordersCount: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });

      const dayRevenue = orders
        .filter(o => o.status !== 'cancelled' && (o.settledAt || o.createdAt).startsWith(dateStr))
        .reduce((sum, o) => sum + o.grandTotal, 0);

      const dayCount = orders
        .filter(o => o.status !== 'cancelled' && (o.settledAt || o.createdAt).startsWith(dateStr))
        .length;

      days.push({
        dateStr,
        label,
        revenue: dayRevenue,
        ordersCount: dayCount
      });
    }

    return days;
  }, [orders]);

  // Table Search and Filter in Sales tab
  const searchedOrders = useMemo(() => {
    return filteredOrders.filter(o => {
      if (isInternalArchivalOrder(o)) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (paymentStatusFilter !== 'all' && o.paymentStatus !== paymentStatusFilter) return false;
      if (paymentMethodFilter !== 'all' && o.paymentMethod !== paymentMethodFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInvoice = (o.invoiceNo || o.invoiceNumber || '').toLowerCase().includes(q);
        const matchesKot = (o.kotNo || '').toLowerCase().includes(q);
        const matchesCustomer = (o.customerName || '').toLowerCase().includes(q);
        const matchesTable = (o.tableRoomName || '').toLowerCase().includes(q);
        const matchesWaiter = (o.waiterName || '').toLowerCase().includes(q);
        const matchesDishes = summarizeOrderDishes(o).toLowerCase().includes(q);
        if (!matchesInvoice && !matchesKot && !matchesCustomer && !matchesTable && !matchesWaiter && !matchesDishes) {
          return false;
        }
      }
      return true;
    });
  }, [filteredOrders, statusFilter, paymentStatusFilter, paymentMethodFilter, searchQuery]);

  // 2. PROFIT & LOSS CALCULATIONS
  const plResult = useMemo(() => {
    return calculateProfitAndLoss(orders, safeExpenses, safeInventory, safeRecipes, plTimeframe, safeMenuItems);
  }, [orders, safeExpenses, safeInventory, safeRecipes, plTimeframe, safeMenuItems]);

  // 3. BALANCE SUMMARY
  const balanceSummary = useMemo(() => {
    return calculateBalanceSummary(safeAccounts, orders, safeExpenses, safeInventory, safeCustomers, safePayables);
  }, [safeAccounts, orders, safeExpenses, safeInventory, safeCustomers, safePayables]);

  // 4. RECONCILIATIONS
  const reconciliationsList = useMemo(() => {
    return calculatePaymentReconciliation(orders, safeReconciliations);
  }, [orders, safeReconciliations]);

  // 5. AGING SUMMARIES
  const receivablesData = useMemo(() => {
    return calculateReceivablesAging(safeCustomers, safeReceivables);
  }, [safeCustomers, safeReceivables]);

  const payablesData = useMemo(() => {
    return calculatePayablesAging(safeSuppliers, safePayables);
  }, [safeSuppliers, safePayables]);

  // 6. PERIOD COMPARISONS
  const comparisonResult = useMemo(() => {
    return calculateComparisonMetrics(orders, safeExpenses, safeReservations, comparisonMode);
  }, [orders, safeExpenses, safeReservations, comparisonMode]);

  // 7. PRODUCT MARGINS & RESORT PERFORMANCE
  const productMargins = useMemo(() => {
    return calculateProductMargins(safeMenuItems, safeRecipes, safeInventory);
  }, [safeMenuItems, safeRecipes, safeInventory]);

  const resortPerformance = useMemo(() => {
    return calculateResortProfitability(safeRooms, safeReservations, safeFolioItems);
  }, [safeRooms, safeReservations, safeFolioItems]);

  // 8. DAILY BUSINESS SUMMARY
  const dailySummary = useMemo(() => {
    return generateDailyBusinessSummary(
      activeBusiness?.businessId || 'default',
      activeBusiness?.businessName || settings.businessName || 'Himalayan Breeze',
      dailySummaryDate,
      orders,
      safeExpenses,
      safeDayClosings,
      safeReservations,
      safeCustomers,
      safePayables,
      currency
    );
  }, [activeBusiness, settings, dailySummaryDate, orders, safeExpenses, safeDayClosings, safeReservations, safeCustomers, safePayables, currency]);

  // 9. NEPAL IRD ANNEX-5 VAT REGISTERS & DOUBLE-ENTRY TRIAL BALANCE
  const activeMonthPrefix = vatMonthFilter === 'ALL' ? undefined : vatMonthFilter;
  const salesVatRows = useMemo(
    () => buildSalesVatRegisterRows(orders, safeCreditNotes, activeMonthPrefix),
    [orders, safeCreditNotes, activeMonthPrefix]
  );
  const vatSummary = useMemo(() => summarizeSalesVatRegister(salesVatRows), [salesVatRows]);
  const purchaseVatRows = useMemo(
    () => buildPurchaseVatRegisterRows(safePurchaseOrders, safeExpenses, activeMonthPrefix),
    [safePurchaseOrders, safeExpenses, activeMonthPrefix]
  );
  const purchaseVatTotal = useMemo(
    () => purchaseVatRows.reduce((s, r) => s + r.vatPaid, 0),
    [purchaseVatRows]
  );
  const trialBalance = useMemo(
    () => calculateTrialBalance(safeAccounts, safeJournalEntries),
    [safeAccounts, safeJournalEntries]
  );
  const filteredJournalEntries = useMemo(() => {
    if (journalFilterType === 'ALL') return safeJournalEntries;
    return safeJournalEntries.filter(je => je.referenceType === journalFilterType);
  }, [safeJournalEntries, journalFilterType]);

  // HANDLER: Save Reconciled Amount
  const handleSaveReconciliation = () => {
    const existing = safeReconciliations.find(r => r.paymentMethod === reconcileTargetMethod);
    const recorded = reconciliationsList.find(r => r.method === reconcileTargetMethod)?.recorded || 0;
    const diff = reconcileActualAmount - recorded;
    const status = diff === 0 ? 'MATCHED' : (diff < 0 ? 'SHORT' : 'OVER');

    const updatedRecord: PaymentReconciliationRecord = {
      id: existing?.id || `rec-${reconcileTargetMethod}-${Date.now()}`,
      businessId: activeBusiness?.businessId || 'default',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: reconcileTargetMethod,
      expectedAmount: recorded,
      recordedAmount: recorded,
      actualAmount: reconcileActualAmount,
      discrepancy: diff,
      status: 'RECONCILED',
      reconciledByName: currentSession?.name || 'Cashier / Admin',
      reconciledAt: new Date().toISOString(),
      notes: reconcileNotes.trim() || undefined
    };

    if (onUpdateAppState) {
      onUpdateAppState(prev => ({
        ...prev,
        paymentReconciliations: [
          ...(prev.paymentReconciliations || []).filter(r => r.paymentMethod !== reconcileTargetMethod),
          updatedRecord
        ]
      }));
    }

    recordAudit?.('PAYMENT_RECONCILED', reconcileTargetMethod, `Reconciled ${reconcileTargetMethod}: Recorded Rs.${recorded}, Actual Rs.${reconcileActualAmount}, Diff: Rs.${diff}`, 'INFO');
    setShowReconcileModal(false);
  };

  // HANDLER: Add Custom Chart Account
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccName.trim()) return;

    const newAcc: ChartAccount = {
      id: `acc-${newAccCode.trim()}`,
      code: newAccCode.trim(),
      name: newAccName.trim(),
      nepaliName: newAccNepaliName.trim() || newAccName.trim(),
      category: newAccCategory,
      subcategory: newAccSubcategory as any,
      balance: Number(newAccBalance) || 0,
      isSystem: false,
      businessId: activeBusiness?.businessId
    };

    if (onUpdateAppState) {
      onUpdateAppState(prev => ({
        ...prev,
        accounts: [...(prev.accounts || INITIAL_CHART_OF_ACCOUNTS), newAcc]
      }));
    }

    recordAudit?.('CHART_ACCOUNT_CREATED', newAcc.code, `Created account ${newAcc.code} - ${newAcc.name}`, 'INFO');
    setShowAddAccountModal(false);
    setNewAccCode('');
    setNewAccName('');
    setNewAccNepaliName('');
  };

  // HANDLER: Lock Financial Period
  const handleTogglePeriodLock = (periodId: string) => {
    if (currentSession?.role !== 'ADMIN' && currentSession?.role !== 'OWNER' && currentSession?.role !== 'SUPER_ADMIN') {
      setPeriodLockError(lang === 'ne' ? 'वित्तीय अवधि बन्द वा लक गर्न एडमिन अनुमति चाहिन्छ।' : 'Admin role required to lock or close financial periods.');
      return;
    }
    setPeriodLockError(null);

    if (onUpdateAppState) {
      onUpdateAppState(prev => {
        const updated = (prev.financialPeriods || safePeriods).map(p => {
          if (p.id === periodId) {
            const nextStatus = p.status === 'LOCKED' ? 'OPEN' : 'LOCKED';
            recordAudit?.('FINANCIAL_PERIOD_LOCK_TOGGLED', p.id, `Period ${p.periodName} status changed to ${nextStatus}`, 'WARNING');
            return {
              ...p,
              status: nextStatus as any,
              closedByName: currentSession?.name,
              closedAt: new Date().toISOString()
            };
          }
          return p;
        });
        return { ...prev, financialPeriods: updated };
      });
    }
  };

  // HANDLER: Post Opening Capital / Opening Balance Journal Entry
  const handlePostOpeningBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(openingAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;

    if (onUpdateAppState && appState) {
      onUpdateAppState(prev => {
        const posted = postOpeningBalanceJournal(
          prev,
          openingAccountCode,
          amt,
          currentSession?.name || 'Owner',
          openingMemo.trim() || 'Opening Balance Capital Injection'
        );
        return {
          ...prev,
          accounts: posted.accounts,
          journalEntries: posted.journalEntries
        };
      });
    }

    recordAudit?.(
      'OPENING_BALANCE_POSTED',
      openingAccountCode,
      `Posted Opening Capital Rs.${amt.toFixed(2)} to account ${openingAccountCode}`,
      'INFO'
    );
    setShowOpeningBalanceModal(false);
    setOpeningAmount('');
  };

  // HANDLER: Download CBMS Batch JSON Payload
  const handleDownloadCbmsJson = () => {
    const payload = buildCbmsBatchPayload(salesVatRows, settings);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(settings.businessName || 'Business').replace(/[^a-zA-Z0-9]+/g, '_')}_CBMS_Batch_${vatMonthFilter}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordAudit?.('CBMS_BATCH_EXPORTED', vatMonthFilter, `Exported ${salesVatRows.length} records for IRD CBMS upload`, 'INFO');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Main Banner & Suite Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
              <Scale className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {lang === 'ne' ? 'वित्तीय व्यवस्थापन तथा व्यापार विश्लेषण' : 'Advanced Finance, Accounting & Business Intelligence'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne'
              ? `${activeBusiness?.businessName || 'Himalayan Breeze'} को लागि वास्तविक नाफा-नोक्सान, लेखा चार्ट, बैंक मिलान र बक्यौता हिसाब`
              : `Strictly multi-tenant isolated accounting, P&L statements, multi-channel reconciliation, and ledger analytics for ${activeBusiness?.businessName || 'Business'}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>{lang === 'ne' ? 'प्रिन्ट' : 'Print View'}</span>
          </button>
          <button
            onClick={() => exportSalesCSV(filteredOrders, currency)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-amber-400" />
            <span>{lang === 'ne' ? 'बिक्री CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Suite Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        <button
          onClick={() => setActiveSubTab('sales_analytics')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'sales_analytics'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>{lang === 'ne' ? 'बिक्री विश्लेषण' : 'Sales Analytics'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('profit_loss')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'profit_loss'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <span>{lang === 'ne' ? 'नाफा-नोक्सान (P&L)' : 'Profit & Loss'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('reconciliation')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'reconciliation'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale className="h-4 w-4 text-indigo-600" />
          <span>{lang === 'ne' ? 'भुक्तानी मिलान' : 'Payment Reconciliation'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('chart_of_accounts')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'chart_of_accounts'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span>{lang === 'ne' ? 'लेखा चार्ट र जर्नल' : 'Chart of Accounts & GL'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ird_vat')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'ird_vat'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>{lang === 'ne' ? 'IRD बिक्री/खरिद खाता (Annex-5)' : 'IRD VAT / Annex-5'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('receivables_payables')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'receivables_payables'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CreditCard className="h-4 w-4 text-amber-600" />
          <span>{lang === 'ne' ? 'बक्यौता तथा हिसाब' : 'Receivables & Payables'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('comparisons')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'comparisons'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="h-4 w-4 text-purple-600" />
          <span>{lang === 'ne' ? 'अवधि तुलना' : 'Comparisons'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('profitability')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'profitability'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Flame className="h-4 w-4 text-rose-600" />
          <span>{lang === 'ne' ? 'परिकार तथा रुम नाफा' : 'Product & Room Profit'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('daily_summary')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'daily_summary'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4 text-teal-600" />
          <span>{lang === 'ne' ? 'दैनिक सारांश' : 'Daily Summary'}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('period_control')}
          className={`px-3.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'period_control'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock className="h-4 w-4 text-slate-600" />
          <span>{lang === 'ne' ? 'अवधि लक' : 'Period Lock'}</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 1. SALES ANALYTICS & POS REPORTS TAB                      */}
      {/* ========================================================= */}
      {activeSubTab === 'sales_analytics' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs font-bold text-slate-700">
              {lang === 'ne' ? 'समय अवधि चयन:' : 'Select Sales Period:'}
            </span>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setTimeframe('today')}
                className={`px-3 py-1.5 rounded-md transition-colors ${timeframe === 'today' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {lang === 'ne' ? 'आज (Today)' : "Today's Sales"}
              </button>
              <button
                onClick={() => setTimeframe('7days')}
                className={`px-3 py-1.5 rounded-md transition-colors ${timeframe === '7days' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeframe('month')}
                className={`px-3 py-1.5 rounded-md transition-colors ${timeframe === 'month' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                This Month
              </button>
              <button
                onClick={() => setTimeframe('all')}
                className={`px-3 py-1.5 rounded-md transition-colors ${timeframe === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                All Records
              </button>
            </div>
            {hasMoreCloudOrders && onLoadOlderOrders && (
              <button
                type="button"
                disabled={isLoadingOlderCloudOrders}
                onClick={() => void onLoadOlderOrders()}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold transition-colors disabled:opacity-60 flex items-center gap-1.5"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{isLoadingOlderCloudOrders ? 'Loading Cloud History...' : 'Load Older Cloud Bills'}</span>
              </button>
            )}
          </div>

          {/* Live Today Operations Audit: Ordered Dishes, Cash vs Online Split & Cancellations */}
          <TodayOperationsAuditPanel
            orders={orders}
            settings={settings}
            lang={lang}
          />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {lang === 'ne' ? 'कुल बिक्री (Gross Revenue)' : 'Gross Revenue'}
              </span>
              <p className="text-2xl font-black text-slate-900 font-mono-num mt-2">
                {currency} {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {filteredOrders.length} {lang === 'ne' ? 'अर्डरहरू' : 'orders processed'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {lang === 'ne' ? 'नगद बिक्री (Cash Collections)' : 'Cash Collections'}
              </span>
              <p className="text-2xl font-black text-emerald-800 font-mono-num mt-2">
                {currency} {cashSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {totalRevenue > 0 ? ((cashSales / totalRevenue) * 100).toFixed(1) : 0}% of gross revenue
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {lang === 'ne' ? 'डिजिटल भुक्तानी (Fonepay/Cards)' : 'Digital Collections'}
              </span>
              <p className="text-2xl font-black text-indigo-800 font-mono-num mt-2">
                {currency} {digitalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {totalRevenue > 0 ? ((digitalSales / totalRevenue) * 100).toFixed(1) : 0}% digital share
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {lang === 'ne' ? 'बक्यौता / उधारो (Pending Khata)' : 'Khata / Credit Sales'}
              </span>
              <p className="text-2xl font-black text-amber-700 font-mono-num mt-2">
                {currency} {totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Avg Ticket: {currency} {avgOrderValue.toFixed(0)}
              </p>
            </div>
          </div>

          {/* 7-Day Revenue Trend Recharts Line Chart */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'ne' ? '७ दिने दैनिक आम्दानी ग्राफ' : '7-Day Revenue Trend (Recharts)'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ne' ? 'पछिल्लो एक हप्ताको दैनिक बिक्री विवरण' : 'Daily gross collections in Nepali Rupees'}
                </p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last7DaysRevenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `Rs.${(val / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: any) => [`${currency} ${Number(value).toLocaleString()}`, 'Daily Revenue']}
                    labelStyle={{ fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category & Top Selling Dishes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'क्याटेगोरी अनुसार बिक्री' : 'Sales by Category'}
              </h3>
              <div className="space-y-2">
                {categorySales.map(c => (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="capitalize">{c.category.replace('_', ' ')}</span>
                      <span className="font-mono-num">{currency} {c.revenue.toLocaleString()} ({c.percentOfTotal.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${Math.min(100, c.percentOfTotal)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'सबैभन्दा धेरै बिक्ने परिकारहरू (Top Dishes)' : 'Top Selling Dishes'}
              </h3>
              <div className="space-y-2">
                {topSellingItems.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded bg-slate-900 text-white font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        {item.nepaliName && <span className="text-[10px] text-slate-500">{item.nepaliName}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono-num text-slate-900">{item.qty} pcs</span>
                      <span className="text-[10px] text-slate-500 block font-mono-num">{currency} {item.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Searchable Order History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={lang === 'ne' ? 'इनभ्वाइस, KOT वा टेबल खोज्नुहोस्...' : 'Search invoice, KOT or table...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="all">{lang === 'ne' ? 'सबै अवस्था' : 'All Order Status'}</option>
                  <option value="completed">{lang === 'ne' ? 'सम्पन्न (Completed)' : 'Completed'}</option>
                  <option value="active">{lang === 'ne' ? 'खुला / बाँकी (Unpaid)' : 'Active / Unpaid'}</option>
                  <option value="cancelled">{lang === 'ne' ? 'रद्द (Cancelled)' : 'Cancelled'}</option>
                </select>

                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="all">All Payment Modes</option>
                  <option value="cash">Cash Only</option>
                  <option value="fonepay_qr">Fonepay QR</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank</option>
                  <option value="split">Split Pay</option>
                  <option value="credit_khata">Credit Khata</option>
                </select>

                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value="all">All Settlement Status</option>
                  <option value="paid">Paid Only</option>
                  <option value="partial">Partial</option>
                  <option value="credit">Unpaid Credit</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Invoice / KOT</th>
                    <th className="py-2.5 px-3">Table / Mode</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Dishes Ordered</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    <th className="py-2.5 px-3">Cash / Online & Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchedOrders.slice(0, 60).map((o) => {
                    const payment = classifyOrderPayment(o);
                    const dishes = summarizeOrderDishes(o);
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono-num font-bold text-slate-900">
                          {o.invoiceNo || o.invoiceNumber || 'INV-0000'}
                          {o.kotNo && <span className="block text-[10px] font-normal text-slate-500">{o.kotNo}</span>}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {o.tableRoomName || o.orderType}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono-num tabular-nums">
                          {o.createdAt?.substring(0, 16)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 max-w-xs">
                          <span className="line-clamp-2" title={dishes}>{dishes}</span>
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono-num tabular-nums font-bold ${o.status === 'cancelled' ? 'text-rose-700 line-through' : 'text-slate-900'}`}>
                          {currency} {o.grandTotal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          {o.status === 'cancelled' ? (
                            <div>
                              <span className="inline-block font-bold text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                                CANCELLED
                              </span>
                              {o.voidReason && <span className="block text-[10px] text-rose-700 mt-0.5">{o.voidReason}</span>}
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold text-[11px] text-slate-800 block">
                                {lang === 'ne' ? payment.channelLabelNe : payment.channelLabel}
                              </span>
                              <span className={`block text-[10px] font-bold ${o.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {o.status === 'active' ? 'Unpaid / Active' : o.paymentStatus}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => setViewReceiptOrder(o)}
                            className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 rounded text-slate-800 transition-colors"
                          >
                            View Bill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {searchedOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No orders matched your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. PROFIT & LOSS (P&L) STATEMENT TAB                      */}
      {/* ========================================================= */}
      {activeSubTab === 'profit_loss' && (
        <div className="space-y-6">
          {/* Header & Date Range Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'नाफा-नोक्सान हिसाब विवरण (Profit & Loss Statement)' : 'Official Profit & Loss Statement'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'ne' ? 'आम्दानी, कच्चा पदार्थ लागत (COGS) र सञ्चालन खर्चको वास्तविक हिसाब' : 'Real-time sales, recipe cost of goods sold, and operating expenditure'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  onClick={() => setPlTimeframe('today')}
                  className={`px-2.5 py-1 rounded transition-colors ${plTimeframe === 'today' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
                >
                  Today
                </button>
                <button
                  onClick={() => setPlTimeframe('7days')}
                  className={`px-2.5 py-1 rounded transition-colors ${plTimeframe === '7days' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setPlTimeframe('month')}
                  className={`px-2.5 py-1 rounded transition-colors ${plTimeframe === 'month' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
                >
                  This Month
                </button>
                <button
                  onClick={() => setPlTimeframe('prev_month')}
                  className={`px-2.5 py-1 rounded transition-colors ${plTimeframe === 'prev_month' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
                >
                  Last Month
                </button>
                <button
                  onClick={() => setPlTimeframe('year')}
                  className={`px-2.5 py-1 rounded transition-colors ${plTimeframe === 'year' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
                >
                  This Year
                </button>
              </div>

              <button
                onClick={() => {
                  const headers = ['Financial Category', 'Line Item', 'Amount (Rs.)'];
                  const rows = [
                    ['Revenue', 'Food Sales', plResult.revenue.foodSales],
                    ['Revenue', 'Beverage Sales', plResult.revenue.beverageSales],
                    ['Revenue', 'Room Lodging', plResult.revenue.roomRevenue],
                    ['Revenue', 'Room Service Dining', plResult.revenue.roomService],
                    ['Revenue', 'Other Services', plResult.revenue.otherServices],
                    ['Revenue', 'Less Discounts', -plResult.revenue.discountsGiven],
                    ['Revenue', 'Net Sales Revenue', plResult.revenue.netSalesRevenue],
                    ['COGS', 'Kitchen Food Cost', plResult.cogs.foodCost],
                    ['COGS', 'Bar & Beverage Cost', plResult.cogs.beverageCost],
                    ['COGS', 'Total Cost of Goods Sold', plResult.cogs.totalCogs],
                    ['Gross Profit', 'Gross Operating Profit', plResult.grossProfit],
                    ['Operating Expenses', 'Salaries & Staff Pool', plResult.operatingExpenses.salaryWages],
                    ['Operating Expenses', 'Rent & Lease', plResult.operatingExpenses.rent],
                    ['Operating Expenses', 'Utilities (Electricity/Water)', plResult.operatingExpenses.utilities],
                    ['Operating Expenses', 'Cooking Gas & Fuel', plResult.operatingExpenses.gasFuel],
                    ['Operating Expenses', 'Repairs & Maintenance', plResult.operatingExpenses.maintenance],
                    ['Operating Expenses', 'Laundry & Cleaning', plResult.operatingExpenses.laundry],
                    ['Operating Expenses', 'Consumable Supplies', plResult.operatingExpenses.supplies],
                    ['Operating Expenses', 'Marketing & Events', plResult.operatingExpenses.marketing],
                    ['Operating Expenses', 'Internet & Software', plResult.operatingExpenses.internet],
                    ['Operating Expenses', 'Other Expenses', plResult.operatingExpenses.otherExpenses],
                    ['Operating Expenses', 'Total Operating Expenses', plResult.operatingExpenses.totalOperatingExpenses],
                    ['Net Profit', 'Net Operating Profit', plResult.netOperatingProfit]
                  ];
                  exportFinancialCSV(`Profit_Loss_Statement_${plTimeframe}`, headers, rows);
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-amber-400" />
                <span>Export P&L</span>
              </button>
            </div>
          </div>

          {/* Three Summary Highlight Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Net Sales Revenue</span>
              <p className="text-2xl font-black text-slate-900 font-mono-num mt-2">
                {currency} {plResult.revenue.netSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-slate-400 mt-1 block">Gross minus discounts</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Gross Profit</span>
              <p className="text-2xl font-black text-emerald-800 font-mono-num mt-2">
                {currency} {plResult.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-xs font-bold text-emerald-700 mt-1 block font-mono-num">
                Margin: {plResult.grossMarginPercent.toFixed(1)}%
              </span>
            </div>

            <div className={`p-5 rounded-2xl border shadow-2xs ${plResult.netOperatingProfit >= 0 ? 'bg-white border-slate-200' : 'bg-rose-50/50 border-rose-200'}`}>
              <span className="text-xs font-semibold text-slate-500 uppercase">Net Operating Profit</span>
              <p className={`text-2xl font-black font-mono-num mt-2 ${plResult.netOperatingProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                {currency} {plResult.netOperatingProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className={`text-xs font-bold mt-1 block font-mono-num ${plResult.netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                Net Margin: {plResult.netMarginPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Structured Financial Statement Document */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
            {/* 1. REVENUE SECTION */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">
                  1. Operating Revenue (सञ्चालन आम्दानी)
                </h3>
                <span className="font-mono-num font-extrabold text-slate-900 text-sm">
                  {currency} {plResult.revenue.netSalesRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs pt-2">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Restaurant Food Sales</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.revenue.foodSales.toLocaleString()}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Bar, Cafe & Beverages Sales</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.revenue.beverageSales.toLocaleString()}</span>
                </div>
                {plResult.revenue.roomRevenue > 0 && (
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-600">Hotel & Cottage Lodging Revenue</span>
                    <span className="font-mono-num font-semibold">{currency} {plResult.revenue.roomRevenue.toLocaleString()}</span>
                  </div>
                )}
                {plResult.revenue.roomService > 0 && (
                  <div className="py-2 flex justify-between">
                    <span className="text-slate-600">In-Room Dining Service</span>
                    <span className="font-mono-num font-semibold">{currency} {plResult.revenue.roomService.toLocaleString()}</span>
                  </div>
                )}
                {plResult.revenue.discountsGiven > 0 && (
                  <div className="py-2 flex justify-between text-rose-700">
                    <span>Less: Promotional & Staff Discounts</span>
                    <span className="font-mono-num font-semibold">-{currency} {plResult.revenue.discountsGiven.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. COST OF GOODS SOLD (COGS) */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">
                  2. Cost of Goods Sold / COGS (कच्चा पदार्थ लागत)
                </h3>
                <span className="font-mono-num font-extrabold text-rose-700 text-sm">
                  -{currency} {plResult.cogs.totalCogs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs pt-2">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Kitchen Ingredients & Food Cost (BOM)</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.cogs.foodCost.toLocaleString()}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Beverage, Coffee & Liquor Cost</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.cogs.beverageCost.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* GROSS PROFIT HIGHLIGHT ROW */}
            <div className="p-3 bg-emerald-50 rounded-xl flex items-center justify-between border border-emerald-200">
              <span className="font-black text-sm text-emerald-950">
                = GROSS PROFIT (सकल नाफा)
              </span>
              <span className="font-mono-num font-black text-base text-emerald-950">
                {currency} {plResult.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* 3. OPERATING EXPENSES */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wide">
                  3. Operating Expenses (सञ्चालन खर्चहरू)
                </h3>
                <span className="font-mono-num font-extrabold text-rose-700 text-sm">
                  -{currency} {plResult.operatingExpenses.totalOperatingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs pt-2">
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Staff Salaries & Wages:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.salaryWages.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Property Rent & Lease:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.rent.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Utilities (Electricity/Water):</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.utilities.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Cooking Gas & Generator Fuel:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.gasFuel.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Repairs & Maintenance:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.maintenance.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Laundry & Linen Cleaning:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.laundry.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Dining & Kitchen Supplies:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.supplies.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Marketing & Advertising:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.marketing.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Internet & POS Subscriptions:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.internet.toLocaleString()}</span>
                </div>
                <div className="py-1 flex justify-between border-b border-slate-100">
                  <span className="text-slate-600">Miscellaneous Petty Expenses:</span>
                  <span className="font-mono-num font-semibold">{currency} {plResult.operatingExpenses.otherExpenses.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* NET PROFIT BOTTOM HIGHLIGHT */}
            <div className={`p-4 rounded-xl flex items-center justify-between border ${plResult.netOperatingProfit >= 0 ? 'bg-slate-900 text-white border-slate-800' : 'bg-rose-900 text-white border-rose-800'}`}>
              <div>
                <span className="font-black text-sm uppercase block tracking-wide">
                  = NET OPERATING PROFIT (खुद सञ्चालन नाफा)
                </span>
                <span className="text-xs text-slate-300">
                  Gross Profit minus all recorded operating overheads
                </span>
              </div>
              <span className="font-mono-num font-black text-xl text-amber-300">
                {currency} {plResult.netOperatingProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MULTI-CHANNEL PAYMENT RECONCILIATION TAB               */}
      {/* ========================================================= */}
      {activeSubTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'बहु-च्यानल भुक्तानी मिलान (Payment Channel Reconciliation)' : 'Multi-Channel Payment Reconciliation'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'ne' ? 'काउन्टर नगद, फोनपे QR, ईसेवा, खल्ती र बैंक खाताको हिसाब मिलान' : 'Auditing POS recorded totals against cashier counted drawer and merchant settlement statements'}
              </p>
            </div>

            <button
              onClick={() => {
                setReconcileTargetMethod('cash');
                const item = reconciliationsList.find(r => r.method === 'cash');
                setReconcileActualAmount(item?.actual || 0);
                setReconcileNotes('');
                setShowReconcileModal(true);
              }}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Scale className="h-4 w-4 text-amber-400" />
              <span>{lang === 'ne' ? '+ नयाँ मिलान प्रविष्टि' : '+ Reconcile Channel'}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-4">Channel / Method</th>
                    <th className="py-3 px-4 text-right">POS Recorded</th>
                    <th className="py-3 px-4 text-right">Actual Counted / Settled</th>
                    <th className="py-3 px-4 text-right">Variance / Difference</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reconciliationsList.map(item => (
                    <tr key={item.method} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] text-slate-500">{item.nepaliName}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-900">
                        {currency} {item.recorded.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-bold text-slate-800">
                        {currency} {item.actual.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono-num font-extrabold ${item.discrepancy === 0 ? 'text-emerald-700' : (item.discrepancy < 0 ? 'text-rose-700' : 'text-amber-700')}`}>
                        {item.discrepancy > 0 ? `+${currency} ${item.discrepancy.toLocaleString()}` : (item.discrepancy < 0 ? `-${currency} ${Math.abs(item.discrepancy).toLocaleString()}` : 'Rs. 0.00')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          item.status === 'MATCHED'
                            ? 'bg-emerald-100 text-emerald-900'
                            : item.status === 'SHORT'
                            ? 'bg-rose-100 text-rose-900'
                            : item.status === 'OVER'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-indigo-100 text-indigo-900'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setReconcileTargetMethod(item.method as any);
                            setReconcileActualAmount(item.actual);
                            setReconcileNotes('');
                            setShowReconcileModal(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 rounded text-slate-800 transition-colors"
                        >
                          Audit & Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CHART OF ACCOUNTS & BALANCE SUMMARY TAB                */}
      {/* ========================================================= */}
      {activeSubTab === 'chart_of_accounts' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'लेखा चार्ट तथा वासलात सारांश (Chart of Accounts & Balance Sheet)' : 'Chart of Accounts & Balance Sheet Summary'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'ne' ? 'सम्पत्ति, दायित्व, पुँजी र नाफाको वासलात ढाँचा' : 'Complete dual-entry accounting accounts tailored for Cafe, Restaurant & Resort'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onUpdateAppState && (
                <button
                  type="button"
                  onClick={() => setShowOpeningBalanceModal(true)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Banknote className="h-4 w-4" />
                  <span>{lang === 'ne' ? 'सुरुवाती पुँजी / ब्यालेन्स' : 'Post Opening Capital'}</span>
                </button>
              )}
              <button
                onClick={() => setShowAddAccountModal(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="h-4 w-4 text-amber-400" />
                <span>{lang === 'ne' ? '+ नयाँ खाता थप्नुहोस्' : '+ Add Custom Account'}</span>
              </button>
            </div>
          </div>

          {/* Balance Sheet Equation Verification Banner */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <span className="text-xs text-emerald-800 font-bold block uppercase">Total Assets (कुल सम्पत्ति)</span>
              <span className="text-xl font-black font-mono-num text-emerald-950 mt-1 block">
                {currency} {balanceSummary.assets.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
              <span className="text-xs text-amber-800 font-bold block uppercase">Total Liabilities (कुल दायित्व)</span>
              <span className="text-xl font-black font-mono-num text-amber-950 mt-1 block">
                {currency} {balanceSummary.liabilities.totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <span className="text-xs text-indigo-800 font-bold block uppercase">Total Equity (लगानी तथा सञ्चित नाफा)</span>
              <span className="text-xl font-black font-mono-num text-indigo-950 mt-1 block">
                {currency} {balanceSummary.equity.totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Full Chart of Accounts Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                Full Chart of Accounts Directory
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {safeAccounts.length} standard & custom accounts active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Account Name</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Subcategory</th>
                    <th className="py-2.5 px-4 text-right">Balance / Val</th>
                    <th className="py-2.5 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {safeAccounts.map(acc => (
                    <tr key={acc.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono-num font-extrabold text-slate-900">
                        {acc.code}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-slate-900 block">{acc.name}</span>
                        <span className="text-[10px] text-slate-500">{acc.nepaliName}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          acc.category === 'ASSET'
                            ? 'bg-emerald-100 text-emerald-900'
                            : acc.category === 'LIABILITY'
                            ? 'bg-amber-100 text-amber-900'
                            : acc.category === 'EQUITY'
                            ? 'bg-indigo-100 text-indigo-900'
                            : acc.category === 'REVENUE'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-rose-100 text-rose-900'
                        }`}>
                          {acc.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 capitalize">
                        {(acc.subcategory || '').replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-bold text-slate-900">
                        {currency} {acc.balance.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {acc.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Double-Entry Trial Balance Verification Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  Trial Balance Verification (Live Double-Entry DR = CR)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Auto-posted from POS Settlements, Credit Notes, Expenses, Khata Collections & Room Payments
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wide ${
                  trialBalance.isBalanced
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-rose-100 text-rose-900 border border-rose-200'
                }`}
              >
                {trialBalance.isBalanced ? 'BALANCED · DR = CR' : 'UNBALANCED VARIANCE DETECTED'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Code</th>
                    <th className="py-2.5 px-4">Account</th>
                    <th className="py-2.5 px-4 text-right">Debit Turnover</th>
                    <th className="py-2.5 px-4 text-right">Credit Turnover</th>
                    <th className="py-2.5 px-4 text-right">Ending DR</th>
                    <th className="py-2.5 px-4 text-right">Ending CR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trialBalance.rows
                    .filter(r => r.debitTurnover > 0 || r.creditTurnover > 0)
                    .map(row => (
                      <tr key={row.accountCode} className="hover:bg-slate-50/70">
                        <td className="py-2 px-4 font-mono-num font-bold text-slate-800">{row.accountCode}</td>
                        <td className="py-2 px-4 font-medium text-slate-900">{row.accountName}</td>
                        <td className="py-2 px-4 text-right font-mono-num text-slate-700">
                          {currency} {row.debitTurnover.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num text-slate-700">
                          {currency} {row.creditTurnover.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-bold text-emerald-800">
                          {row.endingDebitBalance > 0 ? `${currency} ${row.endingDebitBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-2 px-4 text-right font-mono-num font-bold text-indigo-800">
                          {row.endingCreditBalance > 0 ? `${currency} ${row.endingCreditBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                  {trialBalance.rows.every(r => r.debitTurnover === 0 && r.creditTurnover === 0) && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                        No automated journal postings recorded yet. Settle a bill, add an expense, or post Opening Capital above.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-900">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-4 uppercase text-[11px]">Trial Balance Totals</td>
                    <td className="py-2.5 px-4 text-right font-mono-num">
                      {currency} {trialBalance.totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num">
                      {currency} {trialBalance.totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-emerald-900">
                      {currency} {trialBalance.totalEndingDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-indigo-900">
                      {currency} {trialBalance.totalEndingCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* General Ledger Journal Entries Feed */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  General Ledger Journal Feed ({filteredJournalEntries.length} Entries)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Immutable double-entry vouchers with BS/AD dates and balanced account splits
                </p>
              </div>
              <select
                value={journalFilterType}
                onChange={(e) => setJournalFilterType(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Journal Sources</option>
                <option value="POS_SALE">POS Sales Settlements</option>
                <option value="CREDIT_NOTE">Credit Notes / Reversals</option>
                <option value="EXPENSE">Operating Expenses</option>
                <option value="KHATA_COLLECTION">Khata Collections</option>
                <option value="HOTEL_PAYMENT">Resort Room Payments</option>
                <option value="OPENING_BALANCE">Opening Capital</option>
              </select>
            </div>

            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {filteredJournalEntries.slice(0, 60).map(je => (
                <div key={je.id} className="p-4 hover:bg-slate-50/70 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {je.entryNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-bold">
                        {je.referenceType}
                      </span>
                      <span className="font-bold text-slate-800">{je.description}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      {je.date} {je.bsDate ? `(${je.bsDate} BS)` : ''} · {je.createdByName}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2 border-l-2 border-emerald-300">
                    {je.lines.map((line, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded text-[11px]">
                        <span className="font-medium text-slate-700">
                          <span className="font-mono-num font-bold text-slate-900 mr-1.5">{line.accountCode}</span>
                          {line.accountName}
                        </span>
                        <span className={`font-mono-num font-bold ${line.debit > 0 ? 'text-emerald-700' : 'text-indigo-700'}`}>
                          {line.debit > 0
                            ? `DR ${currency} ${line.debit.toFixed(2)}`
                            : `CR ${currency} ${line.credit.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredJournalEntries.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  No journal entries matching the selected filter.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4B. NEPAL IRD ANNEX-5 VAT REGISTER & CBMS COMPLIANCE TAB  */}
      {/* ========================================================= */}
      {activeSubTab === 'ird_vat' && (
        <div className="space-y-6">
          {/* Header & Export Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  {lang === 'ne'
                    ? 'नेपाल आन्तरिक राजस्व विभाग (IRD) बिक्री तथा खरिद खाता — Annex-5'
                    : 'Nepal IRD Annex-5 VAT Registers (Bikri / Kharid Khata) & CBMS Sync'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                FY {settings.irdSettings?.fiscalYearLabel || getNepalFiscalYear()} · Seller PAN/VAT:{' '}
                <span className="font-mono-num font-bold text-slate-800">{settings.panVatNumber || 'Not Configured'}</span>
                {settings.irdSettings?.cbmsEnabled && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    CBMS Live Bridge Active
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={vatMonthFilter === 'ALL' ? '' : vatMonthFilter}
                onChange={(e) => setVatMonthFilter(e.target.value || 'ALL')}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
              <button
                type="button"
                onClick={() =>
                  setVatMonthFilter(vatMonthFilter === 'ALL' ? new Date().toISOString().slice(0, 7) : 'ALL')
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                  vatMonthFilter === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {vatMonthFilter === 'ALL' ? 'Showing All Months' : 'All Months'}
              </button>

              <button
                type="button"
                onClick={() =>
                  exportAnnex5SalesCSV(
                    salesVatRows,
                    settings.businessName || 'Business',
                    settings.panVatNumber || 'NA',
                    vatMonthFilter
                  )
                }
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Annex-5 Sales CSV</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportAnnex5PurchaseCSV(
                    purchaseVatRows,
                    settings.businessName || 'Business',
                    settings.panVatNumber || 'NA',
                    vatMonthFilter
                  )
                }
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Annex-5 Purchase CSV</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCbmsJson}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span>CBMS JSON Batch</span>
              </button>

              {hasMoreCloudOrders && onLoadOlderOrders && (
                <button
                  type="button"
                  disabled={isLoadingOlderCloudOrders}
                  onClick={() => void onLoadOlderOrders()}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{isLoadingOlderCloudOrders ? 'Loading...' : 'Load Older Cloud Bills'}</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 VAT Return KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Net Taxable Sales ({vatSummary.invoiceCount} Bills)</span>
              <p className="text-xl font-black font-mono-num text-slate-900 mt-1">
                {currency} {vatSummary.netTaxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-slate-400">
                Exempt: {currency} {vatSummary.netExempt.toFixed(2)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase">Net Output VAT (13%)</span>
              <p className="text-xl font-black font-mono-num text-emerald-900 mt-1">
                {currency} {vatSummary.netVatPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-emerald-600">
                Gross VAT {currency} {vatSummary.grossVat.toFixed(2)} - CN {currency} {vatSummary.returnedVat.toFixed(2)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase">Credit Notes Reversed ({vatSummary.creditNoteCount})</span>
              <p className="text-xl font-black font-mono-num text-rose-900 mt-1">
                {currency} {vatSummary.returnedTaxable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-rose-500">
                VAT Reversed: {currency} {vatSummary.returnedVat.toFixed(2)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-2xs">
              <span className="text-[11px] font-bold text-indigo-700 uppercase">Input VAT Paid (Kharid Khata)</span>
              <p className="text-xl font-black font-mono-num text-indigo-900 mt-1">
                {currency} {purchaseVatTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-indigo-600">
                Net VAT Payable: {currency} {(vatSummary.netVatPayable - purchaseVatTotal).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Toggle Sales vs Purchase Register */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVatRegisterMode('sales')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    vatRegisterMode === 'sales'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Bikri Khata (Sales & Credit Notes · {salesVatRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setVatRegisterMode('purchase')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    vatRegisterMode === 'purchase'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Kharid Khata (Purchases & Expenses · {purchaseVatRows.length})
                </button>
              </div>
              <span className="text-[11px] text-slate-500">
                Settled Tax Invoices remain immutable; voided bills generate negative Credit Note rows.
              </span>
            </div>

            {vatRegisterMode === 'sales' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Miti (BS)</th>
                      <th className="py-2.5 px-3">Date (AD)</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Invoice / CN No</th>
                      <th className="py-2.5 px-3">Buyer & PAN</th>
                      <th className="py-2.5 px-3 text-right">Exempt</th>
                      <th className="py-2.5 px-3 text-right">Taxable</th>
                      <th className="py-2.5 px-3 text-right">VAT (13%)</th>
                      <th className="py-2.5 px-3 text-right">Grand Total</th>
                      <th className="py-2.5 px-3 text-center">CBMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesVatRows.map(row => (
                      <tr
                        key={row.id}
                        className={row.entryType === 'CREDIT_NOTE' ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/70'}
                      >
                        <td className="py-2 px-3 font-mono-num text-slate-700">{row.bsDate}</td>
                        <td className="py-2 px-3 font-mono-num text-slate-500">{row.adDate}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              row.entryType === 'CREDIT_NOTE'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {row.entryType === 'CREDIT_NOTE' ? 'CREDIT NOTE' : 'TAX INV'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono-num font-bold text-slate-900">
                          {row.documentNo}
                          {row.referenceInvoiceNo && (
                            <span className="block text-[10px] font-normal text-rose-700">
                              Ref: {row.referenceInvoiceNo}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-medium text-slate-900 block">{row.buyerName}</span>
                          {row.buyerPan && <span className="text-[10px] font-mono-num text-slate-500">PAN: {row.buyerPan}</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num">{row.exemptSales.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-medium">{row.taxableSales.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-emerald-800">{row.vatAmount.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-black text-slate-900">{row.grandTotal.toFixed(2)}</td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.cbmsSynced ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {row.cbmsSynced ? 'SYNCED' : 'LOCAL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {salesVatRows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No settled Tax Invoices or Credit Notes found for {vatMonthFilter}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Miti (BS)</th>
                      <th className="py-2.5 px-3">Date (AD)</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Bill / PO No</th>
                      <th className="py-2.5 px-3">Supplier / Payee</th>
                      <th className="py-2.5 px-3 text-right">Exempt</th>
                      <th className="py-2.5 px-3 text-right">Taxable</th>
                      <th className="py-2.5 px-3 text-right">VAT Paid</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseVatRows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono-num text-slate-700">{row.bsDate}</td>
                        <td className="py-2 px-3 font-mono-num text-slate-500">{row.adDate}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {row.source}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono-num font-bold text-slate-900">{row.billNumber}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{row.supplierName}</td>
                        <td className="py-2 px-3 text-right font-mono-num">{row.exemptPurchase.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono-num">{row.taxablePurchase.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-indigo-800">{row.vatPaid.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-mono-num font-black text-slate-900">{row.totalAmount.toFixed(2)}</td>
                      </tr>
                    ))}
                    {purchaseVatRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No Purchase Orders or Expenses found for {vatMonthFilter}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. RECEIVABLES & PAYABLES AGING TAB                       */}
      {/* ========================================================= */}
      {activeSubTab === 'receivables_payables' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accounts Receivable (Customer Khata) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Accounts Receivable (ग्राहक बक्यौता खाता)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total: {currency} {receivablesData.aging.totalOutstanding.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const headers = ['Customer', 'Phone', 'Days Overdue', 'Aging Bucket', 'Balance Due'];
                    const rows = receivablesData.customerStatements.map(c => [c.customerName, c.phone, c.daysOverdue, c.bucket, c.balance]);
                    exportFinancialCSV('Customer_Receivables_Aging', headers, rows);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
                >
                  Export Aging
                </button>
              </div>

              {/* 4 Aging Buckets */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">0-30 Days</span>
                  <span className="font-bold font-mono-num text-slate-900">{currency} {receivablesData.aging.bucket0to30.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] text-amber-800 block">31-60 Days</span>
                  <span className="font-bold font-mono-num text-amber-900">{currency} {receivablesData.aging.bucket31to60.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <span className="text-[10px] text-orange-800 block">61-90 Days</span>
                  <span className="font-bold font-mono-num text-orange-900">{currency} {receivablesData.aging.bucket61to90.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-[10px] text-rose-800 block">90+ Days</span>
                  <span className="font-bold font-mono-num text-rose-900">{currency} {receivablesData.aging.bucket90Plus.toLocaleString()}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs max-h-80 overflow-y-auto">
                {receivablesData.customerStatements.map(c => (
                  <div key={c.customerId} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{c.customerName}</span>
                      <span className="text-[10px] text-slate-500">{c.phone} • {c.daysOverdue} days</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-num font-bold text-amber-900 block">{currency} {c.balance.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{c.bucket}</span>
                    </div>
                  </div>
                ))}
                {receivablesData.customerStatements.length === 0 && (
                  <p className="text-center py-6 text-slate-400">No overdue receivables.</p>
                )}
              </div>
            </div>

            {/* Accounts Payable (Suppliers) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Accounts Payable (आपूर्तिकर्ता तिर्नुपर्ने)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total: {currency} {payablesData.aging.totalOutstanding.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const headers = ['Supplier', 'Days Overdue', 'Aging Bucket', 'Amount Payable'];
                    const rows = payablesData.supplierStatements.map(s => [s.supplierName, s.daysOverdue, s.bucket, s.balance]);
                    exportFinancialCSV('Supplier_Payables_Aging', headers, rows);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
                >
                  Export Aging
                </button>
              </div>

              {/* 4 Aging Buckets */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-500 block">0-30 Days</span>
                  <span className="font-bold font-mono-num text-slate-900">{currency} {payablesData.aging.bucket0to30.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] text-amber-800 block">31-60 Days</span>
                  <span className="font-bold font-mono-num text-amber-900">{currency} {payablesData.aging.bucket31to60.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <span className="text-[10px] text-orange-800 block">61-90 Days</span>
                  <span className="font-bold font-mono-num text-orange-900">{currency} {payablesData.aging.bucket61to90.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-[10px] text-rose-800 block">90+ Days</span>
                  <span className="font-bold font-mono-num text-rose-900">{currency} {payablesData.aging.bucket90Plus.toLocaleString()}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs max-h-80 overflow-y-auto">
                {payablesData.supplierStatements.map(s => (
                  <div key={s.supplierId} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">{s.supplierName}</span>
                      <span className="text-[10px] text-slate-500">{s.daysOverdue} days past due</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-num font-bold text-rose-900 block">{currency} {s.balance.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{s.bucket}</span>
                    </div>
                  </div>
                ))}
                {payablesData.supplierStatements.length === 0 && (
                  <p className="text-center py-6 text-slate-400">All supplier payables cleared.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. PERIOD-OVER-PERIOD COMPARISONS TAB                     */}
      {/* ========================================================= */}
      {activeSubTab === 'comparisons' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'समय अवधि कार्यसम्पादन तुलना (Period-over-Period Performance)' : 'Period-over-Period Performance Comparison'}
              </h2>
              <p className="text-xs text-slate-500">
                Compare today vs yesterday, this week vs last week, or this month vs last month
              </p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setComparisonMode('day')}
                className={`px-3 py-1.5 rounded transition-colors ${comparisonMode === 'day' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
              >
                Today vs Yesterday
              </button>
              <button
                onClick={() => setComparisonMode('week')}
                className={`px-3 py-1.5 rounded transition-colors ${comparisonMode === 'week' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
              >
                This Week vs Last Week
              </button>
              <button
                onClick={() => setComparisonMode('month')}
                className={`px-3 py-1.5 rounded transition-colors ${comparisonMode === 'month' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
              >
                This Month vs Last Month
              </button>
              <button
                onClick={() => setComparisonMode('year')}
                className={`px-3 py-1.5 rounded transition-colors ${comparisonMode === 'year' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
              >
                This Year vs Last Year
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue comparison */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Gross Revenue</span>
              <p className="text-xl font-black font-mono-num text-slate-900 mt-2">
                {currency} {comparisonResult.currentRevenue.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-bold">
                {comparisonResult.revenueChangePct >= 0 ? (
                  <span className="text-emerald-700 flex items-center">
                    <ArrowUpRight className="h-4 w-4" />
                    +{comparisonResult.revenueChangePct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center">
                    <ArrowDownRight className="h-4 w-4" />
                    {comparisonResult.revenueChangePct.toFixed(1)}%
                  </span>
                )}
                <span className="text-slate-400 font-normal">vs prev ({currency} {comparisonResult.previousRevenue.toLocaleString()})</span>
              </div>
            </div>

            {/* Orders count comparison */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Total Orders</span>
              <p className="text-xl font-black font-mono-num text-slate-900 mt-2">
                {comparisonResult.currentOrdersCount} bills
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-bold">
                {comparisonResult.ordersChangePct >= 0 ? (
                  <span className="text-emerald-700 flex items-center">
                    <ArrowUpRight className="h-4 w-4" />
                    +{comparisonResult.ordersChangePct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center">
                    <ArrowDownRight className="h-4 w-4" />
                    {comparisonResult.ordersChangePct.toFixed(1)}%
                  </span>
                )}
                <span className="text-slate-400 font-normal">vs prev ({comparisonResult.previousOrdersCount})</span>
              </div>
            </div>

            {/* Expenses comparison */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Expenses</span>
              <p className="text-xl font-black font-mono-num text-rose-700 mt-2">
                {currency} {comparisonResult.currentExp.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-bold">
                {comparisonResult.expensesChangePct <= 0 ? (
                  <span className="text-emerald-700 flex items-center">
                    <ArrowDownRight className="h-4 w-4" />
                    {comparisonResult.expensesChangePct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center">
                    <ArrowUpRight className="h-4 w-4" />
                    +{comparisonResult.expensesChangePct.toFixed(1)}%
                  </span>
                )}
                <span className="text-slate-400 font-normal">vs prev ({currency} {comparisonResult.previousExp.toLocaleString()})</span>
              </div>
            </div>

            {/* Net Profit comparison */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase">Operating Margin</span>
              <p className={`text-xl font-black font-mono-num mt-2 ${comparisonResult.currentProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                {currency} {comparisonResult.currentProfit.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-bold">
                {comparisonResult.profitChangePct >= 0 ? (
                  <span className="text-emerald-700 flex items-center">
                    <ArrowUpRight className="h-4 w-4" />
                    +{comparisonResult.profitChangePct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center">
                    <ArrowDownRight className="h-4 w-4" />
                    {comparisonResult.profitChangePct.toFixed(1)}%
                  </span>
                )}
                <span className="text-slate-400 font-normal">vs prev ({currency} {comparisonResult.previousProfit.toLocaleString()})</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. DISH & ROOM PROFITABILITY TAB (MENU ENGINEERING & ADR) */}
      {/* ========================================================= */}
      {activeSubTab === 'profitability' && (
        <div className="space-y-6">
          {/* Resort Hotel Metrics if room module is active */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-extrabold text-sm text-slate-900">
                Hotel & Resort Lodging Key Performance Indicators (ADR / RevPAR)
              </h3>
              <span className="text-xs text-slate-500">
                {resortPerformance.occupiedRooms} / {resortPerformance.totalRooms} rooms currently occupied ({resortPerformance.occupancyPercent.toFixed(1)}%)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 block">Total Room Revenue</span>
                <span className="text-lg font-black font-mono-num text-slate-900 mt-1 block">
                  {currency} {resortPerformance.roomRevenue.toLocaleString()}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 block">Average Daily Rate (ADR)</span>
                <span className="text-lg font-black font-mono-num text-emerald-800 mt-1 block">
                  {currency} {resortPerformance.adr.toFixed(0)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 block">RevPAR (Per Available Room)</span>
                <span className="text-lg font-black font-mono-num text-indigo-800 mt-1 block">
                  {currency} {resortPerformance.revpar.toFixed(0)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 block">In-Room Dining F&B</span>
                <span className="text-lg font-black font-mono-num text-amber-800 mt-1 block">
                  {currency} {resortPerformance.roomDiningRevenue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Engineering Margins Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Menu Engineering & Culinary Gross Margin Matrix
                </h3>
                <p className="text-[11px] text-slate-500">
                  Calculated against standard recipe Bill of Materials (BOM) & inventory cost
                </p>
              </div>
              <button
                onClick={() => {
                  const headers = ['Dish Name', 'Category', 'Selling Price', 'Estimated Cost', 'Gross Margin', 'Margin %'];
                  const rows = productMargins.map(p => [p.name, p.category, p.sellingPrice, p.estimatedCost, p.grossMargin, p.marginPercent.toFixed(1)]);
                  exportFinancialCSV('Product_Profitability_Margins', headers, rows);
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Download className="h-3 w-3 text-amber-400" />
                <span>Export Margins</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Dish / Product</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Selling Price</th>
                    <th className="py-2.5 px-4 text-right">Estimated Cost</th>
                    <th className="py-2.5 px-4 text-right">Gross Margin (Rs.)</th>
                    <th className="py-2.5 px-4 text-right">Margin %</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productMargins.map(p => (
                    <tr key={p.itemId} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4">
                        <span className="font-bold text-slate-900 block">{p.name}</span>
                        {p.nepaliName && <span className="text-[10px] text-slate-500">{p.nepaliName}</span>}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 capitalize">
                        {p.category.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-bold">
                        {currency} {p.sellingPrice.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num text-slate-600">
                        {currency} {p.estimatedCost.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-bold text-emerald-800">
                        {currency} {p.grossMargin.toFixed(0)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-num font-extrabold text-slate-900">
                        {p.marginPercent.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${p.isHighMargin ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>
                          {p.isHighMargin ? 'High Margin ★' : 'Standard'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. DAILY BUSINESS SUMMARY TAB (AUDIT RECAP)               */}
      {/* ========================================================= */}
      {activeSubTab === 'daily_summary' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">Audit Date:</span>
              <input
                type="date"
                value={dailySummaryDate}
                onChange={(e) => setDailySummaryDate(e.target.value)}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Daily Audit Sheet</span>
              </button>
            </div>
          </div>

          {/* Printable Daily Recap Paper Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6 print:border-none print:shadow-none max-w-3xl mx-auto">
            <div className="text-center pb-4 border-b border-slate-200 space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {dailySummary.businessName}
              </h2>
              <p className="text-xs font-bold text-slate-600">
                DAILY EXECUTIVE AUDIT & CLOSING SUMMARY
              </p>
              <p className="text-xs text-slate-400 font-mono-num">
                Audit Date: {dailySummary.date} • Printed: {new Date().toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Total Orders</span>
                <span className="font-black text-base font-mono-num text-slate-900 mt-0.5 block">{dailySummary.metrics.totalOrders}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Gross Sales</span>
                <span className="font-black text-base font-mono-num text-slate-900 mt-0.5 block">{currency} {dailySummary.metrics.totalGrossSales.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Total Expenses</span>
                <span className="font-black text-base font-mono-num text-rose-700 mt-0.5 block">{currency} {dailySummary.metrics.totalExpenses.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block">Daily Net Profit</span>
                <span className="font-black text-base font-mono-num text-emerald-800 mt-0.5 block">{currency} {dailySummary.metrics.estimatedDailyProfit.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100 border-t border-b border-slate-200 py-3">
              <div className="flex justify-between py-1">
                <span className="text-slate-600 font-medium">Opening Cash In Drawer:</span>
                <span className="font-mono-num font-bold">{currency} {dailySummary.metrics.openingCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600 font-medium">+ Cash Sales Today:</span>
                <span className="font-mono-num font-bold text-emerald-800">+{currency} {dailySummary.metrics.cashSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600 font-medium">+ Digital Collections (Fonepay/Wallets/Cards):</span>
                <span className="font-mono-num font-bold text-indigo-800">+{currency} {dailySummary.metrics.digitalSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600 font-medium">+ Credit Khata Sales (Due):</span>
                <span className="font-mono-num font-bold text-amber-800">+{currency} {dailySummary.metrics.creditSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600 font-medium">- Petty Cash Expenses:</span>
                <span className="font-mono-num font-bold text-rose-700">-{currency} {dailySummary.metrics.totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 font-bold">
                <span>Government VAT Collected (13%):</span>
                <span className="font-mono-num">{currency} {dailySummary.metrics.totalVAT.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 font-bold">
                <span>Hospitality Service Charge Collected (10%):</span>
                <span className="font-mono-num">{currency} {dailySummary.metrics.totalServiceCharge.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 font-black bg-slate-50 p-2 rounded">
                <span>Drawer Closing Cash Variance:</span>
                <span className={`font-mono-num ${dailySummary.metrics.cashDiscrepancy === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {currency} {dailySummary.metrics.cashDiscrepancy.toLocaleString()}
                </span>
              </div>
            </div>

            {dailySummary.topSellingDishes.length > 0 && (
              <div>
                <span className="font-extrabold text-xs uppercase text-slate-800 block mb-2">
                  Top 5 Dishes Sold On This Date:
                </span>
                <div className="space-y-1 text-xs">
                  {dailySummary.topSellingDishes.map((d, i) => (
                    <div key={d.name} className="flex justify-between text-slate-700">
                      <span>{i + 1}. {d.name} ({d.qty} qty)</span>
                      <span className="font-mono-num font-semibold">{currency} {d.revenue.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. FINANCIAL PERIOD CONTROL TAB                           */}
      {/* ========================================================= */}
      {activeSubTab === 'period_control' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'वित्तीय अवधि नियन्त्रण तथा लक (Financial Period Lock)' : 'Financial Period Control & Security Locking'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'ne' ? 'बन्द भएका महिना वा वर्षका अर्डर तथा खर्चमा हेरफेर रोक्न वित्तीय अवधि लक गर्नुहोस्' : 'Lock closed fiscal periods to prevent historical record alteration and unauthorized tampering'}
              </p>
            </div>

            {periodLockError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs font-bold text-rose-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{periodLockError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPeriodLockError(null)}
                  className="text-rose-500 hover:text-rose-800"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {safePeriods.map(p => (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50/70">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{p.periodName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${p.status === 'LOCKED' ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'}`}>
                        {p.status}
                      </span>
                    </div>
                    <span className="text-slate-500 block">
                      Range: {p.startDate} to {p.endDate}
                    </span>
                    {p.closedByName && (
                      <span className="text-[10px] text-slate-400 block">
                        Closed by {p.closedByName} at {p.closedAt?.substring(0, 16)}
                      </span>
                    )}
                  </div>

                  <div>
                    <button
                      onClick={() => handleTogglePeriodLock(p.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs ${
                        p.status === 'LOCKED'
                          ? 'bg-amber-100 text-amber-950 hover:bg-amber-200'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {p.status === 'LOCKED' ? (
                        <>
                          <Unlock className="h-3.5 w-3.5" />
                          <span>Unlock Period</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                          <span>Lock Period</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Bill Receipt */}
      {viewReceiptOrder && (
        <ReceiptModal
          order={viewReceiptOrder}
          settings={settings}
          lang={lang}
          onClose={() => setViewReceiptOrder(null)}
        />
      )}

      {/* MODAL: Reconcile Payment Channel */}
      {showReconcileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-extrabold text-sm text-slate-900">
                Audit & Reconcile {reconcileTargetMethod.toUpperCase()}
              </h3>
              <button onClick={() => setShowReconcileModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Actual Verified Amount (Rs.):</label>
                <NumberInput
                  min={0}
                  value={reconcileActualAmount}
                  onValueChange={(val) => setReconcileActualAmount(val)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold font-mono-num focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Reconciliation Notes / Bank Ref:</label>
                <textarea
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  placeholder="e.g. Bank statement checked, petty cash discrepancy noted..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowReconcileModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReconciliation}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Confirm Reconciliation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Custom Account */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form onSubmit={handleAddAccount} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-extrabold text-sm text-slate-900">
                Add Custom Chart of Account
              </h3>
              <button type="button" onClick={() => setShowAddAccountModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Account Code:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5140"
                    value={newAccCode}
                    onChange={(e) => setNewAccCode(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Category:</label>
                  <select
                    value={newAccCategory}
                    onChange={(e) => setNewAccCategory(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="ASSET">ASSET (सम्पत्ति)</option>
                    <option value="LIABILITY">LIABILITY (दायित्व)</option>
                    <option value="EQUITY">EQUITY (पुँजी)</option>
                    <option value="REVENUE">REVENUE (आम्दानी)</option>
                    <option value="EXPENSE">EXPENSE (खर्च)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Account Name (English):</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generator Maintenance"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Account Name (Nepali):</label>
                <input
                  type="text"
                  placeholder="उदा. जेनेरेटर मर्मत खर्च"
                  value={newAccNepaliName}
                  onChange={(e) => setNewAccNepaliName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Initial Opening Balance (Rs.):</label>
                <NumberInput
                  allowNegative
                  value={newAccBalance}
                  onValueChange={(val) => setNewAccBalance(val)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Save Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Post Opening Balance / Capital Injection */}
      {showOpeningBalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form onSubmit={handlePostOpeningBalance} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-extrabold text-sm text-slate-900">
                Post Opening Capital / Balance (DR Asset / CR 3010)
              </h3>
              <button type="button" onClick={() => setShowOpeningBalanceModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Target Asset Account:</label>
                <select
                  value={openingAccountCode}
                  onChange={(e) => setOpeningAccountCode(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold"
                >
                  {safeAccounts
                    .filter(a => a.category === 'ASSET')
                    .map(a => (
                      <option key={a.code} value={a.code}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Opening Amount ({currency}):</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(sanitizeNumericDraft(e.target.value))}
                  placeholder="e.g. 50000"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-mono-num font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Journal Narration / Memo:</label>
                <input
                  type="text"
                  value={openingMemo}
                  onChange={(e) => setOpeningMemo(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowOpeningBalanceModal(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
              >
                Post Balanced Journal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
