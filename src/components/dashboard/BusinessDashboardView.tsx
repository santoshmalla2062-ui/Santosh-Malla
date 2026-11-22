import React, { useMemo } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  Users, 
  AlertTriangle, 
  LayoutGrid, 
  Hotel, 
  Calendar, 
  ChefHat, 
  Package, 
  Receipt, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  Clock, 
  UtensilsCrossed, 
  Layers, 
  ShieldCheck, 
  Sparkles,
  ExternalLink,
  Plus
} from 'lucide-react';
import { 
  AppState, 
  BusinessSettings, 
  BusinessTenant, 
  Customer, 
  DayClosingRecord, 
  Expense, 
  InventoryItem, 
  MenuItem, 
  Order, 
  Reservation, 
  ResortRoom, 
  Session, 
  StaffRole, 
  TableRoom 
} from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { hasPermission } from '../../services/security';
import { computeTodayOrderAuditSummary } from '../../services/orderAudit';
import { TodayOperationsAuditPanel } from '../reports/TodayOperationsAuditPanel';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';

interface BusinessDashboardViewProps {
  appState: AppState;
  activeBusiness: BusinessTenant;
  currentSession: Session | null;
  lang: Language;
  onNavigateTab: (tab: any) => void;
  onOpenQuickPOS?: () => void;
  onSwitchRole?: (role: StaffRole) => void;
}

export const BusinessDashboardView: React.FC<BusinessDashboardViewProps> = ({
  appState,
  activeBusiness,
  currentSession,
  lang,
  onNavigateTab,
  onOpenQuickPOS,
  onSwitchRole
}) => {
  const t = TRANSLATIONS[lang];
  const settings = appState.settings;
  const role: StaffRole = currentSession?.role || 'WAITER';

  // Permission gates
  const canViewFinancials = hasPermission(role, 'VIEW_FINANCIAL_REPORTS') || role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'ACCOUNTANT';
  const canViewInventory = hasPermission(role, 'VIEW_TAB_INVENTORY') || role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'INVENTORY_STAFF';
  const canViewResort = hasPermission(role, 'VIEW_TAB_RESORT') || role === 'OWNER' || role === 'ADMIN' || role === 'RECEPTIONIST' || role === 'HOUSEKEEPING';
  const canViewPOS = hasPermission(role, 'VIEW_TAB_POS');
  const canViewKDS = hasPermission(role, 'VIEW_TAB_KDS');

  const todayStr = useMemo(() => new Date().toDateString(), []);
  const todayISODate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const todayAudit = useMemo(() => computeTodayOrderAuditSummary(appState.orders), [appState.orders]);

  // Today's non-cancelled orders (from todayAudit rows)
  const todayOrders = useMemo(() => {
    return todayAudit.rows.filter(r => !r.isTrueCancelled).map(r => r.order);
  }, [todayAudit]);

  // Financial aggregates for today
  const todaySales = todayAudit.completedRevenue;
  const todayPaid = todayAudit.cashTotal + todayAudit.onlineTotal;
  const todayCashSales = todayAudit.cashTotal;
  const todayDigitalSales = todayAudit.onlineTotal;
  const todayCreditSales = todayAudit.khataTotal;

  // Today's expenses
  const todayExpenses = useMemo(() => {
    return appState.expenses.filter(e => {
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && d.toDateString() === todayStr;
    });
  }, [appState.expenses, todayStr]);

  const todayExpenseTotal = useMemo(() => {
    return todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [todayExpenses]);

  // Estimated gross margin / profit for today based on recipe/costPrice
  const todayGrossProfit = useMemo(() => {
    let costSum = 0;
    let revenueSum = 0;
    todayOrders.forEach(o => {
      o.items.forEach(item => {
        const m = appState.menuItems.find(mi => mi.id === item.menuItemId);
        const cost = m?.costPrice || 0;
        costSum += cost * item.quantity;
        revenueSum += item.price * item.quantity;
      });
    });
    return {
      profit: revenueSum - costSum - todayExpenseTotal,
      marginPercent: revenueSum > 0 ? Math.round(((revenueSum - costSum) / revenueSum) * 100) : 0,
      hasCostData: costSum > 0
    };
  }, [todayOrders, appState.menuItems, todayExpenseTotal]);

  // Customer outstanding receivables
  const totalReceivables = useMemo(() => {
    return appState.customers.reduce((sum, c) => sum + Math.max(0, c.creditBalance || 0), 0);
  }, [appState.customers]);

  // Low stock inventory count & list
  const lowStockItems = useMemo(() => {
    return appState.inventoryItems.filter(i => i.currentStock <= i.minStockAlert);
  }, [appState.inventoryItems]);

  // Dining table occupancies
  const occupiedTables = useMemo(() => {
    return appState.tablesRooms.filter(t => t.type === 'table' && t.status === 'occupied');
  }, [appState.tablesRooms]);

  const totalDiningTables = useMemo(() => {
    return appState.tablesRooms.filter(t => t.type === 'table');
  }, [appState.tablesRooms]);

  // Resort occupancy & guest arrivals/departures
  const occupiedRooms = useMemo(() => {
    return (appState.resortRooms || []).filter(r => r.status === 'OCCUPIED');
  }, [appState.resortRooms]);

  const dirtyRooms = useMemo(() => {
    return (appState.resortRooms || []).filter(r => r.status === 'DIRTY' || r.status === 'CLEANING');
  }, [appState.resortRooms]);

  const todayCheckIns = useMemo(() => {
    return (appState.reservations || []).filter(r => r.checkInDate === todayISODate && r.status === 'CONFIRMED');
  }, [appState.reservations, todayISODate]);

  const todayCheckOuts = useMemo(() => {
    return (appState.reservations || []).filter(r => r.checkOutDate === todayISODate && r.status === 'CHECKED_IN');
  }, [appState.reservations, todayISODate]);

  // Active Kitchen tickets
  const activeKitchenTickets = useMemo(() => {
    return appState.orders.filter(o => o.status === 'active' && o.kotStatus !== 'served' && o.kotStatus !== 'expired' && o.kotStatus !== 'cancelled' && o.items.length > 0);
  }, [appState.orders]);

  const readyToServeTickets = useMemo(() => {
    return activeKitchenTickets.filter(o => o.kotStatus === 'ready');
  }, [activeKitchenTickets]);

  // Top 5 Selling Products
  const topSellingProducts = useMemo(() => {
    const map: Record<string, { name: string; nepaliName?: string; qty: number; revenue: number }> = {};
    appState.orders.filter(o => o.status !== 'cancelled').forEach(o => {
      o.items.forEach(i => {
        if (!map[i.menuItemId]) {
          map[i.menuItemId] = { name: i.name, nepaliName: i.nepaliName, qty: 0, revenue: 0 };
        }
        map[i.menuItemId].qty += i.quantity;
        map[i.menuItemId].revenue += i.price * i.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [appState.orders]);

  // 7-day revenue trend for chart
  const last7DaysChartData = useMemo(() => {
    const days: { label: string; dateStr: string; revenue: number; orders: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const weekday = d.toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-US', { weekday: 'short' });
      days.push({
        label: weekday,
        dateStr,
        revenue: 0,
        orders: 0
      });
    }

    appState.orders.forEach(o => {
      if (o.status === 'cancelled') return;
      const rawDate = o.settledAt || o.createdAt;
      if (!rawDate) return;
      const orderDateStr = new Date(rawDate).toISOString().split('T')[0];
      const found = days.find(d => d.dateStr === orderDateStr);
      if (found) {
        found.revenue += o.grandTotal;
        found.orders += 1;
      }
    });

    return days;
  }, [appState.orders, lang]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Assigned Role Workspace Strip (No multi-role switching clutter) */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
          <span className="text-xs sm:text-sm font-bold text-slate-900">
            {lang === 'ne' ? 'तपाईंको तोकिएको कार्यस्थल' : 'Assigned Workspace'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {lang === 'ne' ? 'तोकिएको पद:' : 'Assigned Role:'}
          </span>
          <span className="text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg bg-slate-900 text-white">
            {role}
          </span>
        </div>
      </div>

      {/* Role-Specific Primary Command Desk */}
      {(role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN') && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-indigo-800/70">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h2 className="text-base font-bold">
                  {role === 'SUPER_ADMIN'
                    ? (lang === 'ne' ? 'App Creator तथा Global SaaS ड्यासबोर्ड' : 'App Creator & Global Control Dashboard')
                    : (lang === 'ne' ? 'व्यापार मालिक / एडमिन कमान्ड ड्यासबोर्ड' : 'Owner & Admin Executive Dashboard')}
                </h2>
              </div>
              <p className="text-xs text-slate-300">
                {lang === 'ne'
                  ? `तपाईं ${role} भूमिकामा लग-इन हुनुहुन्छ। स्टाफ अनुमति, Gmail सिंक, कर रिपोर्ट र सम्पूर्ण सञ्चालन यहीँबाट नियन्त्रण गर्नुहोस्।`
                  : `Signed in as ${role}. Manage staff invitations, cloud device sync, tax reports, and full operations.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onNavigateTab('business_admin')}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                {lang === 'ne' ? 'Business Admin र Staff Invite' : 'Business Admin & Staff Invites'}
              </button>
              <button
                onClick={() => onNavigateTab('reports')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors border border-slate-700"
              >
                {lang === 'ne' ? 'वित्तीय रिपोर्ट' : 'Financial Reports'}
              </button>
            </div>
          </div>
        </div>
      )}

      {role === 'MANAGER' && (
        <div className="bg-gradient-to-r from-purple-950 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-purple-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-300" />
                <h2 className="text-base font-bold">
                  {lang === 'ne' ? 'म्यानेजर सञ्चालन ड्यासबोर्ड' : 'Manager Operations Dashboard'}
                </h2>
              </div>
              <p className="text-xs text-purple-200">
                {lang === 'ne'
                  ? 'दैनिक बिक्री, चालु टेबल/अर्डर, इन्भेन्टरी र दिन बन्द (Day Close) अनुगमन गर्नुहोस्।'
                  : 'Monitor live floor sales, active tickets, inventory thresholds, and daily closing.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('pos')}
                className="px-4 py-2 bg-purple-400 hover:bg-purple-300 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                {lang === 'ne' ? 'POS टर्मिनल खोल्नुहोस्' : 'Open POS Terminal'}
              </button>
              <button
                onClick={() => onNavigateTab('day_closing')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors border border-slate-700"
              >
                {lang === 'ne' ? 'Day Closing' : 'Day Closing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {role === 'WAITER' && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-blue-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍽️</span>
                <h2 className="text-base font-bold">Waiter Service Desk — Dining Tables & KOT</h2>
              </div>
              <p className="text-xs text-blue-200">
                You are signed in as <strong>Waiter</strong>. Take orders on tables, monitor kitchen status, and serve dishes.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('tables_rooms')}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Open Dining Tables ({occupiedTables.length} Occupied)
              </button>
              {readyToServeTickets.length > 0 && (
                <button
                  onClick={() => onNavigateTab('kds')}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  Serve Food ({readyToServeTickets.length} Ready!)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {role === 'KITCHEN' && (
        <div className="bg-gradient-to-r from-amber-950 to-orange-950 text-white rounded-2xl p-5 shadow-sm border border-amber-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">👨‍🍳</span>
                <h2 className="text-base font-bold">Kitchen Display Command — Chef & Cooking Board</h2>
              </div>
              <p className="text-xs text-amber-200">
                You are currently viewing as <strong>Kitchen Staff</strong>. View tickets in queue, cooking timers, and mark food ready.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('kds')}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Open Kitchen KDS ({activeKitchenTickets.length} Active Tickets)
            </button>
          </div>
        </div>
      )}

      {role === 'CASHIER' && (
        <div className="bg-gradient-to-r from-emerald-950 to-teal-950 text-white rounded-2xl p-5 shadow-sm border border-emerald-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <h2 className="text-base font-bold">Cashier Till & Billing Terminal</h2>
              </div>
              <p className="text-xs text-emerald-200">
                You are logged in as <strong>Cashier</strong>. Process bills, split tenders, accept Fonepay QR/Cash, and close the register.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('pos')}
                className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
              >
                Open POS Billing Terminal
              </button>
              <button
                onClick={() => onNavigateTab('day_closing')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors border border-slate-700"
              >
                Cash Register Closing
              </button>
            </div>
          </div>
        </div>
      )}

      {role === 'RECEPTIONIST' && (
        <div className="bg-gradient-to-r from-cyan-950 to-blue-950 text-white rounded-2xl p-5 shadow-sm border border-cyan-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛎️</span>
                <h2 className="text-base font-bold">Front Desk & Hotel Reservations</h2>
              </div>
              <p className="text-xs text-cyan-200">
                You are logged in as <strong>Receptionist</strong>. Manage guest arrivals, check-ins, check-outs, and room folios.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('resort')}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Open Hotel Front Desk ({todayCheckIns.length} Check-ins Today)
            </button>
          </div>
        </div>
      )}

      {role === 'HOUSEKEEPING' && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-sm border border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧹</span>
                <h2 className="text-base font-bold">Housekeeping & Room Turnover Board</h2>
              </div>
              <p className="text-xs text-slate-300">
                You are logged in as <strong>Housekeeping</strong>. View rooms requiring cleaning, inspect turnovers, and report repairs.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('resort')}
              className="px-4 py-2 bg-slate-100 hover:bg-white text-slate-900 text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Update Rooms ({dirtyRooms.length} Need Cleaning)
            </button>
          </div>
        </div>
      )}

      {role === 'INVENTORY_STAFF' && (
        <div className="bg-gradient-to-r from-teal-950 to-emerald-950 text-white rounded-2xl p-5 shadow-sm border border-teal-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <h2 className="text-base font-bold">Stockroom & Ingredients Console</h2>
              </div>
              <p className="text-xs text-teal-200">
                You are logged in as <strong>Inventory Staff</strong>. Log stock entries, replenish ingredients, and monitor critical thresholds.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="px-4 py-2 bg-teal-400 hover:bg-teal-300 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Open Inventory Management ({lowStockItems.length} Low Stock Alerts)
            </button>
          </div>
        </div>
      )}

      {role === 'ACCOUNTANT' && (
        <div className="bg-gradient-to-r from-indigo-950 to-purple-950 text-white rounded-2xl p-5 shadow-sm border border-indigo-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h2 className="text-base font-bold">Financial Audit & Bookkeeping Console</h2>
              </div>
              <p className="text-xs text-indigo-200">
                You are logged in as <strong>Accountant</strong>. Audit daily sales, review expense vouchers, inspect VAT/Service charges, and verify receivables.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('reports')}
              className="px-4 py-2 bg-indigo-400 hover:bg-indigo-300 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Open Financial Reports & Audit
            </button>
          </div>
        </div>
      )}

      {role === 'STAFF' && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-emerald-400" />
                <h2 className="text-base font-bold">
                  {lang === 'ne' ? 'स्टाफ सेवा ड्यासबोर्ड' : 'Staff Service Dashboard'}
                </h2>
              </div>
              <p className="text-xs text-slate-300">
                {lang === 'ne'
                  ? 'तपाईं स्टाफ भूमिकामा लग-इन हुनुहुन्छ। अर्डर लिन र बिलिङ सहायता गर्न तलको बटन थिच्नुहोस्।'
                  : 'Signed in as Staff. Open POS or Dining Orders to assist guests.'}
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('pos')}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              {lang === 'ne' ? 'POS अर्डर खोल्नुहोस्' : 'Open POS Orders'}
            </button>
          </div>
        </div>
      )}

      {/* Enterprise Workspace Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {activeBusiness.businessType.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                ID: {activeBusiness.businessId}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {lang === 'ne' && activeBusiness.nepaliBusinessName ? activeBusiness.nepaliBusinessName : activeBusiness.businessName}
            </h1>
            <p className="text-xs text-slate-300">
              {activeBusiness.tagline || 'Hospitality ERP Workspace'} · Signed in as <strong className="text-emerald-300">{currentSession?.name || 'Staff User'}</strong> ({role})
            </p>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="flex flex-wrap items-center gap-2">
            {canViewPOS && (
              <button
                onClick={() => onNavigateTab('pos')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-xs"
              >
                <Receipt className="h-4 w-4" />
                <span>{lang === 'ne' ? 'नयाँ अर्डर बिलिङ' : 'POS Terminal'}</span>
              </button>
            )}
            <button
              onClick={() => onNavigateTab('tables_rooms')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-700/80 hover:bg-slate-700 border border-slate-600 rounded-xl transition-all"
            >
              <LayoutGrid className="h-4 w-4 text-emerald-400" />
              <span>{lang === 'ne' ? 'टेबलहरू' : 'Tables'} ({occupiedTables.length}/{totalDiningTables.length})</span>
            </button>
            {canViewKDS && (
              <button
                onClick={() => onNavigateTab('kds')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-700/80 hover:bg-slate-700 border border-slate-600 rounded-xl transition-all"
              >
                <ChefHat className="h-4 w-4 text-amber-400" />
                <span>KDS ({activeKitchenTickets.length})</span>
              </button>
            )}
            {canViewResort && (
              <button
                onClick={() => onNavigateTab('resort')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-700/80 hover:bg-slate-700 border border-slate-600 rounded-xl transition-all"
              >
                <Hotel className="h-4 w-4 text-cyan-400" />
                <span>{lang === 'ne' ? 'रिसोर्ट कोठाहरू' : 'Hotel Rooms'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Role-Sensitive Operational Alerts Bar */}
      {(readyToServeTickets.length > 0 || lowStockItems.length > 0 || (canViewResort && dirtyRooms.length > 0)) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {readyToServeTickets.length > 0 && (
            <div 
              onClick={() => onNavigateTab('kds')}
              className="cursor-pointer bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between hover:bg-emerald-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    {lang === 'ne' ? 'खाना तयार भयो!' : 'Food Ready to Serve!'}
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    {readyToServeTickets.length} {lang === 'ne' ? 'अर्डर वेटर पर्खिरहेका छन्' : 'tickets ready in kitchen'}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-emerald-700" />
            </div>
          )}

          {lowStockItems.length > 0 && canViewInventory && (
            <div 
              onClick={() => onNavigateTab('inventory')}
              className="cursor-pointer bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between hover:bg-amber-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-950">
                    {lang === 'ne' ? 'न्यून मौज्दात चेतावनी' : 'Low Stock Alert'}
                  </p>
                  <p className="text-[11px] text-amber-800">
                    {lowStockItems.length} {lang === 'ne' ? 'सामग्रीहरू रि-अर्डर आवश्यक' : 'items need replenishment'}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-amber-800" />
            </div>
          )}

          {canViewResort && dirtyRooms.length > 0 && (
            <div 
              onClick={() => onNavigateTab('resort')}
              className="cursor-pointer bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between hover:bg-rose-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold">
                  <Hotel className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-950">
                    {lang === 'ne' ? 'कोठा सरसफाइ आवश्यक' : 'Rooms Need Cleaning'}
                  </p>
                  <p className="text-[11px] text-rose-800">
                    {dirtyRooms.length} {lang === 'ne' ? 'कोठाहरू खाली भएर सफा हुन बाँकी' : 'rooms require housekeeping'}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-rose-800" />
            </div>
          )}
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today's Gross Sales */}
        {canViewFinancials ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'आजको कुल बिक्री' : "Today's Gross Sales"}</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl font-black font-mono-num text-slate-900">
              {settings.currencySymbol} {todaySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500">
              {todayOrders.length} {lang === 'ne' ? 'अर्डरहरू सम्पन्न' : 'orders placed today'}
            </p>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'आजका अर्डरहरू' : "Today's Orders"}</span>
              <ShoppingBag className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-xl font-black font-mono-num text-slate-900">
              {todayOrders.length}
            </p>
            <p className="text-[11px] text-slate-500">
              {lang === 'ne' ? 'चालु सेवा अर्डरहरू' : 'Completed transactions'}
            </p>
          </div>
        )}

        {/* Cash vs Digital breakdown */}
        {canViewFinancials ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'नगद र डिजिटल सङ्कलन' : 'Cash vs Digital'}</span>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex items-baseline justify-between font-mono-num text-xs pt-1">
              <span className="text-slate-600">Cash:</span>
              <span className="font-bold text-slate-900">{settings.currencySymbol} {todayCashSales.toFixed(0)}</span>
            </div>
            <div className="flex items-baseline justify-between font-mono-num text-xs">
              <span className="text-slate-600">Digital:</span>
              <span className="font-bold text-emerald-700">{settings.currencySymbol} {todayDigitalSales.toFixed(0)}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'सक्रिय टेबलहरू' : 'Active Dining Tables'}</span>
              <LayoutGrid className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xl font-black font-mono-num text-slate-900">
              {occupiedTables.length} / {totalDiningTables.length}
            </p>
            <p className="text-[11px] text-slate-500">
              {totalDiningTables.length - occupiedTables.length} {lang === 'ne' ? 'टेबल खाली छन्' : 'tables available'}
            </p>
          </div>
        )}

        {/* Khata / Receivables */}
        {canViewFinancials ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'उधारो / खाता बाँकी' : 'Customer Khata Due'}</span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-xl font-black font-mono-num text-rose-700">
              {settings.currencySymbol} {totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500">
              {appState.customers.filter(c => c.creditBalance > 0).length} {lang === 'ne' ? 'ग्राहकहरूको खाता बक्यौता' : 'customers with dues'}
            </p>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'भान्छा KDS अर्डरहरू' : 'Kitchen Queue'}</span>
              <ChefHat className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xl font-black font-mono-num text-slate-900">
              {activeKitchenTickets.length}
            </p>
            <p className="text-[11px] text-slate-500">
              {readyToServeTickets.length} {lang === 'ne' ? 'तयार भइसकेका' : 'ready for serving'}
            </p>
          </div>
        )}

        {/* Expenses / Resort Occupancy */}
        {canViewFinancials ? (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'आजको कुल खर्च' : "Today's Expenses"}</span>
              <Banknote className="h-4 w-4 text-rose-600" />
            </div>
            <p className="text-xl font-black font-mono-num text-slate-900">
              {settings.currencySymbol} {todayExpenseTotal.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500">
              {todayExpenses.length} {lang === 'ne' ? 'खर्च भौचरहरू रेकर्ड' : 'vouchers logged'}
            </p>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>{lang === 'ne' ? 'कम मौज्दात' : 'Low Stock Items'}</span>
              <Package className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xl font-black font-mono-num text-slate-900">
              {lowStockItems.length}
            </p>
            <p className="text-[11px] text-slate-500">
              {lang === 'ne' ? 'स्टक रि-अर्डर अलर्ट' : 'items below minimum'}
            </p>
          </div>
        )}
      </div>

      {/* Today's Orders, Cash vs Online & Cancellations Ledger for Manager / Owner / Accountant */}
      {canViewFinancials && (
        <TodayOperationsAuditPanel
          orders={appState.orders}
          settings={settings}
          lang={lang}
        />
      )}

      {/* Middle Section: 7-Day Revenue Trend & Top Sellers (Owner, Admin, Manager, Accountant) */}
      {canViewFinancials && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend Line Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'ne' ? 'विगत ७ दिनको कारोबार रेखाचित्र' : '7-Day Revenue Trend'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ne' ? 'दैनिक बिक्री उतारचढाव' : 'Daily sales performance overview'}
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('reports')}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
              >
                <span>{lang === 'ne' ? 'पूर्ण रिपोर्ट हेर्नुहोस्' : 'Full Reports'}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last7DaysChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: '#64748b' }} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => `${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                  />
                  <Tooltip 
                    formatter={(val: any) => [`${settings.currencySymbol} ${Number(val).toLocaleString()}`, 'Sales']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#059669" 
                    strokeWidth={2.5} 
                    dot={{ fill: '#059669', r: 4 }} 
                    activeDot={{ r: 6, fill: '#10b981' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Selling Products */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              {lang === 'ne' ? 'सबैभन्दा बढी बिक्री हुने परिकारहरू' : 'Top Selling Products'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'ne' ? 'ग्राहकहरूको रोजाइमा परेका मुख्य मेनु' : 'Highest demand items by quantity'}
            </p>

            <div className="divide-y divide-slate-100 pt-1">
              {topSellingProducts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {lang === 'ne' ? 'अहिलेसम्म अर्डर डेटा उपलब्ध छैन।' : 'No sales records yet.'}
                </div>
              ) : (
                topSellingProducts.map((p, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">{p.name}</p>
                        {p.nepaliName && <p className="text-[10px] text-slate-500">{p.nepaliName}</p>}
                      </div>
                    </div>
                    <div className="text-right font-mono-num">
                      <span className="font-bold text-slate-900 block">{p.qty} sold</span>
                      <span className="text-[10px] text-slate-500">{settings.currencySymbol} {p.revenue.toFixed(0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Role-Specific Functional Modules Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Dining Tables Snapshot (Visible for Dining / POS / Management roles only) */}
        {(canViewPOS || role === 'WAITER' || role === 'MANAGER' || role === 'OWNER' || role === 'ADMIN' || role === 'SUPER_ADMIN') && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'डाइनिङ टेबलहरूको स्थिति' : 'Dining Tables Overview'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('tables_rooms')}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5"
            >
              <span>{lang === 'ne' ? 'व्यवस्थापन' : 'Manage'}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
            {totalDiningTables.slice(0, 8).map(table => {
              const isOccupied = table.status === 'occupied';
              return (
                <div
                  key={table.id}
                  onClick={() => onNavigateTab('tables_rooms')}
                  className={`cursor-pointer p-2 rounded-lg border text-center transition-all ${
                    isOccupied 
                      ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold' 
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs font-bold truncate">{table.name}</p>
                  <span className={`text-[10px] font-semibold block ${isOccupied ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {isOccupied ? (lang === 'ne' ? 'व्यस्त' : 'Occupied') : (lang === 'ne' ? 'खाली' : 'Free')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Resort & Hotel Snapshot (if resort enabled) */}
        {canViewResort && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hotel className="h-4 w-4 text-cyan-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'ne' ? 'होटल तथा रिसोर्ट कोठा स्थिति' : 'Hotel Rooms & Guests'}
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('resort')}
                className="text-xs font-semibold text-cyan-800 hover:text-cyan-950 flex items-center gap-0.5"
              >
                <span>{lang === 'ne' ? 'विस्तृत' : 'View'}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 font-semibold">
                <span className="text-slate-600">{lang === 'ne' ? 'कोठा अकुपेन्सी:' : 'Occupancy Rate:'}</span>
                <span className="text-slate-900 font-bold font-mono-num">
                  {occupiedRooms.length} / {(appState.resortRooms || []).length} rooms
                </span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 font-semibold">
                <span className="text-slate-600">{lang === 'ne' ? 'आजका आगमन (Check-in):' : 'Today Check-ins:'}</span>
                <span className="text-emerald-700 font-bold font-mono-num">{todayCheckIns.length} guests</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 font-semibold">
                <span className="text-slate-600">{lang === 'ne' ? 'आजका प्रस्थान (Check-out):' : 'Today Check-outs:'}</span>
                <span className="text-amber-700 font-bold font-mono-num">{todayCheckOuts.length} guests</span>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Stock Watch */}
        {canViewInventory && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'ne' ? 'सामग्री मौज्दात अवस्था' : 'Inventory Quick Watch'}
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('inventory')}
                className="text-xs font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-0.5"
              >
                <span>{lang === 'ne' ? 'इन्भेन्टरी' : 'Inventory'}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {lowStockItems.length === 0 ? (
                <div className="p-4 text-center text-slate-500 bg-emerald-50 rounded-lg border border-emerald-100 font-medium">
                  ✓ {lang === 'ne' ? 'सबै सामग्रीहरू पर्याप्त मौज्दातमा छन्।' : 'All raw ingredients are well stocked.'}
                </div>
              ) : (
                lowStockItems.slice(0, 3).map(item => (
                  <div key={item.id} className="p-2 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-amber-950">{item.name}</p>
                      <p className="text-[10px] text-amber-800">Alert threshold: {item.minStockAlert} {item.unit}</p>
                    </div>
                    <span className="font-mono-num font-black text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200">
                      {item.currentStock} {item.unit}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
