import React, { useState, useMemo } from 'react';
import { 
  X, 
  UtensilsCrossed, 
  ShoppingBag, 
  Truck, 
  Search, 
  Clock, 
  User, 
  Receipt, 
  CreditCard, 
  Printer, 
  ArrowRightLeft, 
  Merge, 
  Split, 
  Trash2, 
  ShieldAlert, 
  Percent, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  DollarSign,
  Coffee,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List
} from 'lucide-react';
import { BusinessSettings, Order, OrderItem, Session, StaffRole, TableRoom } from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { hasPermission } from '../../services/security';
import { formatElapsedTime, getElapsedMinutes } from '../../utils/timeUtils';

interface ActiveOrdersModalProps {
  orders: Order[];
  tablesRooms: TableRoom[];
  settings: BusinessSettings;
  lang: Language;
  currentSession: Session | null;
  onClose: () => void;
  onSelectOrderForPOS: (tableRoomId: string, orderId: string) => void;
  onOpenSettleModal: (order: Order) => void;
  onPrintEstimate: (order: Order) => void;
  onShiftTableOrder?: (fromTableId: string, toTableId: string) => void;
  onMergeTables?: (sourceTableId: string, targetTableId: string) => void;
  onVoidOrder?: (orderId: string, reason: string) => void;
  onVoidOrderItem?: (orderId: string, itemIndex: number, reason: string) => void;
  onAdminUpdatePricing?: (orderId: string, update: { discountPercent?: number; waiveServiceCharge?: boolean; waiveVat?: boolean; notes?: string }) => void;
  onForceReleaseTable?: (tableId: string) => void;
  onSplitOrder?: (order: Order) => void;
  embedded?: boolean;
}

export const ActiveOrdersModal: React.FC<ActiveOrdersModalProps> = ({
  orders,
  tablesRooms,
  settings,
  lang,
  currentSession,
  onClose,
  onSelectOrderForPOS,
  onOpenSettleModal,
  onPrintEstimate,
  onShiftTableOrder,
  onMergeTables,
  onVoidOrder,
  onVoidOrderItem,
  onAdminUpdatePricing,
  onForceReleaseTable,
  onSplitOrder,
  embedded = false
}) => {
  const t = TRANSLATIONS[lang];
  const userRole = currentSession?.role;
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER';

  // Filters matching Kitchen View tabs
  const [filterType, setFilterType] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery' | 'waiting_for_bill' | 'settled_today' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Admin Actions State
  const [voidTargetOrder, setVoidTargetOrder] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState('Customer cancelled / अर्डर रद्द');
  const [customReasonText, setCustomReasonText] = useState('');

  const [voidItemTarget, setVoidItemTarget] = useState<{ order: Order; itemIndex: number; item: OrderItem } | null>(null);
  const [voidItemReason, setVoidItemReason] = useState('Kitchen mistake / गल्ती प्रविष्टि');

  const [transferTarget, setTransferTarget] = useState<Order | null>(null);
  const [destTableId, setDestTableId] = useState('');

  const [mergeTarget, setMergeTarget] = useState<Order | null>(null);
  const [mergeTargetTableId, setMergeTargetTableId] = useState('');

  const [pricingTargetOrder, setPricingTargetOrder] = useState<Order | null>(null);
  const [adminDiscountPct, setAdminDiscountPct] = useState<number>(0);
  const [adminWaiveSC, setAdminWaiveSC] = useState<boolean>(false);
  const [adminWaiveVat, setAdminWaiveVat] = useState<boolean>(false);
  const [adminPricingNote, setAdminPricingNote] = useState<string>('');

  // Active running orders (exclude settled, voided, and empty orders)
  const activeOrders = useMemo(() => {
    return orders.filter(
      o => o.status === 'active' && o.kotStatus !== 'cancelled' && (o.items?.length || 0) > 0
    );
  }, [orders]);

  const settledTodayOrders = useMemo(() => {
    return orders.filter(o => o.status === 'completed');
  }, [orders]);

  const cancelledOrders = useMemo(() => {
    return orders.filter(o => o.status === 'cancelled');
  }, [orders]);

  const dineInOrders = useMemo(() => activeOrders.filter(o => o.orderType === 'dine_in'), [activeOrders]);
  const takeawayOrders = useMemo(() => activeOrders.filter(o => o.orderType === 'takeaway'), [activeOrders]);
  const deliveryOrders = useMemo(() => activeOrders.filter(o => o.orderType === 'delivery'), [activeOrders]);

  const waitingForBillCount = useMemo(() => {
    return tablesRooms.filter(tr => tr.status === 'waiting_for_bill').length;
  }, [tablesRooms]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let baseList: Order[] = [];
    if (filterType === 'settled_today') {
      baseList = settledTodayOrders;
    } else if (filterType === 'cancelled') {
      baseList = cancelledOrders;
    } else {
      baseList = activeOrders.filter(order => {
        if (filterType === 'dine_in' && order.orderType !== 'dine_in') return false;
        if (filterType === 'takeaway' && order.orderType !== 'takeaway') return false;
        if (filterType === 'delivery' && order.orderType !== 'delivery') return false;
        if (filterType === 'waiting_for_bill') {
          const table = tablesRooms.find(tr => tr.id === order.tableRoomId);
          if (table?.status !== 'waiting_for_bill') return false;
        }
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return baseList.filter(order => {
        const matchesInvoice = (order.invoiceNo || '').toLowerCase().includes(q);
        const matchesKot = (order.kotNo || '').toLowerCase().includes(q);
        const matchesTable = (order.tableRoomName || '').toLowerCase().includes(q);
        const matchesCustomer = (order.customerName || '').toLowerCase().includes(q);
        const matchesWaiter = (order.waiterName || '').toLowerCase().includes(q);
        const matchesItem = order.items.some(i => i.name.toLowerCase().includes(q) || (i.nepaliName || '').toLowerCase().includes(q));
        return matchesInvoice || matchesKot || matchesTable || matchesCustomer || matchesWaiter || matchesItem;
      });
    }

    return baseList;
  }, [activeOrders, settledTodayOrders, cancelledOrders, filterType, searchQuery, tablesRooms]);

  // Aggregate stats
  const totalActiveRevenue = useMemo(() => {
    return activeOrders.reduce((sum, o) => sum + o.grandTotal, 0);
  }, [activeOrders]);

  // Collection totals by payment channel for Settled Today ledger
  const settledCollections = useMemo(() => {
    const summary = {
      cash: 0,
      fonepay: 0,
      card: 0,
      wallets: 0,
      bank: 0,
      creditOrRoom: 0,
      total: 0
    };

    settledTodayOrders.forEach((o) => {
      summary.total += o.grandTotal || 0;
      if (o.paymentMethod === 'split' && o.paymentDetails) {
        const pd = o.paymentDetails;
        summary.cash += Number(pd.cash) || 0;
        summary.fonepay += (Number(pd.fonepay) || 0) + (Number(pd.qr) || 0);
        summary.card += Number(pd.card) || 0;
        summary.wallets += (Number(pd.esewa) || 0) + (Number(pd.khalti) || 0);
        summary.bank += Number(pd.bank) || 0;
        summary.creditOrRoom += (Number(pd.credit) || 0) + (Number(pd.charge_to_room) || 0);
      } else {
        const paid = o.paidAmount ?? o.grandTotal ?? 0;
        const due = o.dueAmount ?? 0;
        if (o.paymentMethod === 'cash') summary.cash += paid;
        else if (o.paymentMethod === 'fonepay_qr' || o.paymentMethod === 'qr') summary.fonepay += paid;
        else if (o.paymentMethod === 'card') summary.card += paid;
        else if (o.paymentMethod === 'esewa' || o.paymentMethod === 'khalti') summary.wallets += paid;
        else if (o.paymentMethod === 'bank') summary.bank += paid;
        else if (o.paymentMethod === 'charge_to_room') summary.creditOrRoom += paid;
        else if (o.paymentMethod === 'credit_khata') summary.creditOrRoom += due > 0 ? due : (o.grandTotal || 0);

        if (o.paymentMethod !== 'credit_khata' && due > 0) {
          summary.creditOrRoom += due;
        }
      }
    });

    return summary;
  }, [settledTodayOrders]);

  const getTimeElapsedMinutes = (createdAt: string) => {
    return getElapsedMinutes(createdAt);
  };

  const handleConfirmVoidOrder = () => {
    if (!voidTargetOrder || !onVoidOrder) return;
    const finalReason = voidReason === 'Other / अन्य' ? (customReasonText.trim() || 'Admin cancelled order') : voidReason;
    onVoidOrder(voidTargetOrder.id, finalReason);
    setVoidTargetOrder(null);
    setCustomReasonText('');
  };

  const handleConfirmVoidItem = () => {
    if (!voidItemTarget || !onVoidOrderItem) return;
    onVoidOrderItem(voidItemTarget.order.id, voidItemTarget.itemIndex, voidItemReason);
    setVoidItemTarget(null);
  };

  const handleConfirmTransfer = () => {
    if (!transferTarget || !destTableId || !onShiftTableOrder) return;
    onShiftTableOrder(transferTarget.tableRoomId, destTableId);
    setTransferTarget(null);
    setDestTableId('');
  };

  const handleConfirmMerge = () => {
    if (!mergeTarget || !mergeTargetTableId || !onMergeTables) return;
    onMergeTables(mergeTarget.tableRoomId, mergeTargetTableId);
    setMergeTarget(null);
    setMergeTargetTableId('');
  };

  const handleOpenPricingModal = (order: Order) => {
    setPricingTargetOrder(order);
    setAdminDiscountPct(order.discountPercent || 0);
    setAdminWaiveSC(Boolean(order.waivedServiceCharge));
    setAdminWaiveVat(Boolean(order.waivedVat));
    setAdminPricingNote(order.customAdminDiscountReason || '');
  };

  const handleSaveAdminPricing = () => {
    if (!pricingTargetOrder || !onAdminUpdatePricing) return;
    onAdminUpdatePricing(pricingTargetOrder.id, {
      discountPercent: adminDiscountPct,
      waiveServiceCharge: adminWaiveSC,
      waiveVat: adminWaiveVat,
      notes: adminPricingNote.trim()
    });
    setPricingTargetOrder(null);
  };

  const modalContent = (
    <>
      <div className={`bg-white rounded-2xl ${
        embedded 
          ? 'border border-slate-200 shadow-xs w-full flex flex-col overflow-hidden min-h-[600px]' 
          : 'shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150'
      }`}>
      
      {/* Header Bar */}
      <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black shadow-sm">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                {lang === 'ne' ? 'बिलिङ सेक्सन (Billing Hub)' : 'Billing View'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono-num">
                {activeOrders.length} {lang === 'ne' ? 'सक्रिय' : 'Active'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {settings.businessName || 'Himalayan Breeze'} • {lang === 'ne' ? 'सक्रिय बिल, भुक्तानी तथा रसिद व्यवस्थापन' : 'Live table bills, payment settlement & receipt printing'}
            </p>
          </div>
        </div>

        {embedded ? (
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors shadow-2xs"
          >
            <UtensilsCrossed className="h-3.5 w-3.5 text-amber-400" />
            <span>{lang === 'ne' ? '← मेनु तथा नयाँ अर्डर' : '← Menu & Order'}</span>
          </button>
        ) : (
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Live Metrics Row */}
      <div className="bg-slate-800/90 text-white px-5 py-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">{lang === 'ne' ? 'सक्रिय बिल:' : 'Active Bills:'}</span>
          <span className="font-bold font-mono-num text-amber-300 text-sm">{activeOrders.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">{lang === 'ne' ? 'चालु रकम:' : 'Running Total:'}</span>
          <span className="font-bold font-mono-num text-emerald-300 text-sm">
            {settings.currencySymbol} {totalActiveRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">{lang === 'ne' ? 'बिल माग्दै:' : 'Waiting Bill:'}</span>
          <span className="font-bold font-mono-num text-rose-300 text-sm">{waitingForBillCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">{lang === 'ne' ? 'सम्पन्न (आज):' : 'Settled Today:'}</span>
          <span className="font-bold font-mono-num text-cyan-300 text-sm">{settledTodayOrders.length}</span>
        </div>
      </div>

      {/* Filters & Search Toolbar - Matching Kitchen Tabs */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {lang === 'ne' ? 'सबै बिल' : 'All Bills'} ({activeOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('dine_in')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterType === 'dine_in'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5 text-amber-500" />
            <span>Dine-In ({dineInOrders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('takeaway')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterType === 'takeaway'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5 text-orange-500" />
            <span>Takeaway ({takeawayOrders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('delivery')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterType === 'delivery'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Truck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Delivery ({deliveryOrders.length})</span>
          </button>
          {waitingForBillCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('waiting_for_bill')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                filterType === 'waiting_for_bill'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{lang === 'ne' ? 'बिल माग्दै' : 'Waiting Bill'} ({waitingForBillCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilterType('settled_today')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterType === 'settled_today'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{lang === 'ne' ? 'चुक्ता भएका' : 'Paid Today'} ({settledTodayOrders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('cancelled')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              filterType === 'cancelled'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <X className="h-3.5 w-3.5 text-rose-500" />
            <span>{lang === 'ne' ? 'खारेज' : 'Cancelled'} ({cancelledOrders.length})</span>
          </button>
        </div>

        {/* Search Bar & View Mode Toggle */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={lang === 'ne' ? 'टेबल, बिल वा परिकार खोज्नुहोस्...' : 'Search table, bill, item...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex bg-white p-0.5 rounded-lg border border-slate-300 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Grid"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="List"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

        {/* Scrollable Active Orders Grid or List */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-100/70 space-y-4">
          {filterType === 'settled_today' && settledTodayOrders.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {lang === 'ne' ? 'भुक्तानी च्यानल अनुसार आजको संकलन' : "Today's Collection by Channel"}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {settledTodayOrders.length} {lang === 'ne' ? 'सम्पन्न बिलहरू' : 'settled invoices'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    {lang === 'ne' ? 'कुल संकलन' : 'Total Billed'}
                  </span>
                  <span className="text-base font-black font-mono-num text-emerald-800">
                    {settings.currencySymbol} {settledCollections.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Cash</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {settings.currencySymbol} {settledCollections.cash.toFixed(0)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-red-50/70 border border-red-200">
                  <span className="text-[10px] font-bold text-red-700 uppercase block">Fonepay / QR</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {settings.currencySymbol} {settledCollections.fonepay.toFixed(0)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Card / POS</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {settings.currencySymbol} {settledCollections.card.toFixed(0)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-purple-50/70 border border-purple-200">
                  <span className="text-[10px] font-bold text-purple-700 uppercase block">eSewa / Khalti</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {settings.currencySymbol} {settledCollections.wallets.toFixed(0)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-cyan-50/70 border border-cyan-200">
                  <span className="text-[10px] font-bold text-cyan-800 uppercase block">Bank</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {settings.currencySymbol} {settledCollections.bank.toFixed(0)}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Khata / Room</span>
                  <span className="font-mono-num font-black text-slate-900">
                    {settings.currencySymbol} {settledCollections.creditOrRoom.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <UtensilsCrossed className="h-7 w-7" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                {lang === 'ne' ? 'कुनै चालु अर्डर फेला परेन' : 'No Active Running Orders Found'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery 
                  ? (lang === 'ne' ? 'तपाईंको खोजी सर्त अनुसार कुनै अर्डर भेटिएन।' : 'No orders matched your search keyword.') 
                  : (lang === 'ne' ? 'अहिले सबै टेबल खाली छन्। नयाँ अर्डर सुरु गर्न मेनुबाट परिकार थप्नुहोस्।' : 'All tables are free. Start a new order from the POS Menu.')}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            /* ======================================================== */
            /* 1. HIGH-CONTRAST CARD GRID VIEW                          */
            /* ======================================================== */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map((order) => {
                const minutes = getTimeElapsedMinutes(order.createdAt);
                const table = tablesRooms.find(tr => tr.id === order.tableRoomId);
                const isWaitingForBill = table?.status === 'waiting_for_bill';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-2xl border transition-all shadow-sm flex flex-col justify-between overflow-hidden hover:shadow-md ${
                      order.status === 'cancelled'
                        ? 'border-rose-200 opacity-80'
                        : order.status === 'completed'
                        ? 'border-emerald-200'
                        : isWaitingForBill
                        ? 'border-rose-400 ring-2 ring-rose-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* 1. Destination & Status Header - High Contrast like Kitchen View */}
                    <div className="p-3.5 bg-slate-900 text-white space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base font-black tracking-tight text-white flex items-center gap-1.5 truncate">
                            {order.orderType === 'dine_in' && <UtensilsCrossed className="h-4 w-4 text-amber-400 shrink-0" />}
                            {order.orderType === 'takeaway' && <ShoppingBag className="h-4 w-4 text-orange-400 shrink-0" />}
                            {order.orderType === 'delivery' && <Truck className="h-4 w-4 text-emerald-400 shrink-0" />}
                            <span className="truncate">{order.tableRoomName || (order.orderType === 'takeaway' ? 'Takeaway' : 'Counter')}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            order.orderType === 'takeaway' 
                              ? 'bg-orange-500 text-white shadow-2xs' 
                              : order.orderType === 'delivery'
                              ? 'bg-emerald-500 text-slate-950 font-black'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {order.orderType === 'takeaway' ? 'Takeaway' : order.orderType === 'delivery' ? 'Delivery' : 'Dine-In'}
                          </span>
                        </div>

                        {/* Elapsed Time Indicator */}
                        <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md tabular-nums shrink-0 whitespace-nowrap ${
                          order.status === 'completed'
                            ? 'bg-emerald-900/40 text-emerald-200 border border-emerald-700/60'
                            : order.status === 'cancelled'
                            ? 'bg-rose-900/40 text-rose-200 border border-rose-700/60'
                            : minutes >= 30
                            ? 'bg-rose-600 text-white'
                            : minutes >= 15
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-200 border border-slate-700'
                        }`}>
                          <Clock className="h-3 w-3" />
                          <span>
                            {order.status === 'completed'
                              ? 'Paid'
                              : order.status === 'cancelled'
                              ? 'Void'
                              : formatElapsedTime(order.kotSentAt || order.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Secondary Ticket Info */}
                      <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num font-bold text-amber-300">
                            {order.invoiceNo}
                          </span>
                          <span className="font-mono-num font-semibold text-slate-400">
                            KOT: #{order.kotNo}
                          </span>
                        </div>
                        {order.waiterName && (
                          <span className="flex items-center gap-1 text-slate-400 text-[10px] truncate max-w-[120px]">
                            <User className="h-3 w-3 text-slate-500 shrink-0" />
                            <span className="truncate">{order.waiterName.split(' ')[0]}</span>
                          </span>
                        )}
                        {order.customerName && (
                          <span className="font-bold text-slate-300 text-[10px] truncate max-w-[110px]">
                            👤 {order.customerName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 2. Items Preview List */}
                    <div className="p-3.5 space-y-2 text-xs flex-1 min-h-[130px] bg-white">
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {order.items.map((item, idx) => (
                          <div key={item.id || idx} className="flex items-start justify-between text-xs py-1 border-b border-slate-100 last:border-0 gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="font-mono-num font-black text-slate-900 text-[11px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 shrink-0">
                                {item.quantity}x
                              </span>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs leading-tight truncate">
                                  {item.name}
                                </p>
                                {item.notes && (
                                  <p className="text-[10px] text-amber-700 italic truncate mt-0.5 font-medium">
                                    • {item.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="font-mono-num font-bold text-slate-800 text-xs shrink-0">
                              {settings.currencySymbol} {(item.price * item.quantity).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 3. Financial Breakdown Box - Clean and Structured */}
                      <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <div className="flex justify-between items-center text-[11px] text-slate-600">
                          <span>Subtotal ({order.items.reduce((s, i) => s + i.quantity, 0)} items):</span>
                          <span className="font-mono-num font-semibold text-slate-800">
                            {settings.currencySymbol} {order.subtotal.toFixed(2)}
                          </span>
                        </div>
                        {order.discountAmount > 0 && (
                          <div className="flex justify-between items-center text-[11px] text-rose-600 font-bold">
                            <span>Discount ({order.discountPercent || 0}%):</span>
                            <span className="font-mono-num">
                              -{settings.currencySymbol} {order.discountAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {order.serviceChargeAmount > 0 && (
                          <div className="flex justify-between items-center text-[11px] text-slate-600">
                            <span>Service Charge (10%):</span>
                            <span className="font-mono-num font-semibold text-slate-800">
                              {settings.currencySymbol} {order.serviceChargeAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {order.vatAmount > 0 && (
                          <div className="flex justify-between items-center text-[11px] text-slate-600">
                            <span>VAT (13%):</span>
                            <span className="font-mono-num font-semibold text-slate-800">
                              {settings.currencySymbol} {order.vatAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="pt-1.5 border-t border-slate-200 flex justify-between items-baseline">
                          <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                            {lang === 'ne' ? 'कुल रकम:' : 'Total Bill:'}
                          </span>
                          <span className="text-base font-black font-mono-num text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {settings.currencySymbol} {order.grandTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 4. Card Actions Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2">
                      {order.status === 'completed' ? (
                        <div className="space-y-2">
                          <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50 space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                <span>
                                  {order.dueAmount > 0 && (order.paidAmount || 0) === 0
                                    ? 'Khata Due'
                                    : order.dueAmount > 0
                                    ? 'Partial Paid'
                                    : 'Paid'}{' '}
                                  • {order.paymentMethod?.replace(/_/g, ' ').toUpperCase() || 'CASH'}
                                </span>
                              </span>
                              <span className="font-mono-num text-[11px] text-slate-600">{order.settledAt || 'Paid'}</span>
                            </div>
                            {order.paymentMethod === 'split' && order.paymentDetails && (
                              <p className="text-[10px] font-mono-num text-emerald-900/80">
                                {Object.entries(order.paymentDetails)
                                  .filter(([, amt]) => Number(amt) > 0)
                                  .map(([k, amt]) => `${k.toUpperCase()}: ${settings.currencySymbol}${Number(amt).toFixed(0)}`)
                                  .join(' · ')}
                              </p>
                            )}
                            {order.dueAmount > 0 && (
                              <p className="text-[10px] font-mono-num font-bold text-amber-800">
                                Due Balance: {settings.currencySymbol} {order.dueAmount.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onPrintEstimate(order)}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-600" />
                            <span>{lang === 'ne' ? 'रसिद पुनः प्रिन्ट (Reprint)' : 'Reprint Tax Receipt'}</span>
                          </button>
                        </div>
                      ) : order.status === 'cancelled' ? (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                            <span>Cancelled / Voided Bill</span>
                          </div>
                          <p className="text-[11px] text-rose-800">
                            Reason: {order.voidReason || 'Order Voided'}
                          </p>
                          {order.voidedBy && (
                            <p className="text-[10px] text-slate-500">By: {order.voidedBy} • {order.voidedAt || ''}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenSettleModal(order)}
                              className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors shadow-2xs"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>{lang === 'ne' ? 'भुक्तानी चुक्ता' : 'Pay & Settle'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onPrintEstimate(order)}
                              className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                              title="Print Bill Slip for Customer (80mm)"
                            >
                              <Printer className="h-3.5 w-3.5 text-slate-700" />
                              <span>{lang === 'ne' ? 'बिल प्रिन्ट' : 'Print Bill'}</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectOrderForPOS(order.tableRoomId, order.id);
                                onClose();
                              }}
                              className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-orange-600 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
                            >
                              <Receipt className="h-3 w-3 text-orange-600" />
                              <span>{lang === 'ne' ? '+ परिकार थप्नुहोस् (POS)' : '+ Add Items / POS'}</span>
                            </button>

                            {order.orderType === 'dine_in' && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTransferTarget(order);
                                    setDestTableId('');
                                  }}
                                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-semibold transition-colors"
                                  title="Transfer / Shift table"
                                >
                                  <ArrowRightLeft className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMergeTarget(order);
                                    setMergeTargetTableId('');
                                  }}
                                  className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[10px] font-semibold transition-colors"
                                  title="Merge table"
                                >
                                  <Merge className="h-3 w-3" />
                                </button>
                              </div>
                            )}

                            {onSplitOrder && order.items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => onSplitOrder(order)}
                                className="p-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold transition-colors flex items-center gap-1"
                                title={lang === 'ne' ? 'बिल विभाजन (Split Bill)' : 'Split Bill by Item or Guest'}
                              >
                                <Split className="h-3 w-3" />
                                <span>{lang === 'ne' ? 'बिल बाँड्ने' : 'Split'}</span>
                              </button>
                            )}

                            {isAdminOrManager && (
                              <button
                                type="button"
                                onClick={() => handleOpenPricingModal(order)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-md text-[10px] font-bold transition-colors"
                                title="Admin Discount Override"
                              >
                                <Percent className="h-3 w-3 text-amber-700" />
                              </button>
                            )}

                            {/* Cancel button matching the video */}
                            <button
                              type="button"
                              onClick={() => {
                                setVoidTargetOrder(order);
                                setVoidReason('Customer cancelled / अर्डर रद्द');
                                setCustomReasonText('');
                              }}
                              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline px-1 py-1 transition-colors"
                            >
                              {lang === 'ne' ? 'रद्द (Cancel)' : 'Cancel Bill'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ======================================================== */
            /* 2. COMPACT TABLE ROW LIST VIEW                           */
            /* ======================================================== */
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const minutes = getTimeElapsedMinutes(order.createdAt);
                const isExpanded = expandedOrderId === order.id;
                const table = tablesRooms.find(tr => tr.id === order.tableRoomId);
                const isWaitingForBill = table?.status === 'waiting_for_bill';

                return (
                  <div
                    key={order.id}
                    className={`bg-white rounded-xl border transition-all shadow-xs overflow-hidden ${
                      isWaitingForBill 
                        ? 'border-rose-400 ring-2 ring-rose-200' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Order Card Header */}
                    <div className="p-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Badge / Type */}
                        <span className="font-mono-num font-black text-sm bg-slate-900 text-white px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1.5">
                          {order.orderType === 'dine_in' && <UtensilsCrossed className="h-3.5 w-3.5 text-amber-400" />}
                          {order.orderType === 'takeaway' && <ShoppingBag className="h-3.5 w-3.5 text-indigo-400" />}
                          {order.orderType === 'delivery' && <Truck className="h-3.5 w-3.5 text-emerald-400" />}
                          <span>{order.tableRoomName || 'Counter'}</span>
                        </span>

                        {/* Invoice & KOT tags */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono-num font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-300">
                            {order.invoiceNo}
                          </span>
                          <span className="font-mono-num font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                            KOT: {order.kotNo}
                          </span>
                        </div>

                        {/* Elapsed Time */}
                        <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          minutes > 30 ? 'bg-rose-100 text-rose-800' : minutes > 15 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          <Clock className="h-3 w-3" />
                          <span>{minutes} {lang === 'ne' ? 'मिनेट अगाडि' : 'mins ago'}</span>
                        </div>

                        {/* Waiter */}
                        {order.waiterName && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                            <User className="h-3 w-3 text-slate-400" />
                            <span>{order.waiterName}</span>
                          </div>
                        )}

                        {/* Customer if exists */}
                        {order.customerName && (
                          <span className="text-[11px] font-bold text-slate-700">
                            👤 {order.customerName}
                          </span>
                        )}
                      </div>

                      {/* Grand Total & Expand Toggle */}
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t.grandTotal}</p>
                          <p className="text-base sm:text-lg font-black font-mono-num text-emerald-800">
                            {settings.currencySymbol} {order.grandTotal.toFixed(2)}
                          </p>
                        </div>

                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                          title={isExpanded ? 'Collapse order' : 'Expand item details'}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Order Items Preview / Expanded List */}
                    <div className="p-3.5 space-y-2 text-xs">
                      {/* Compact preview when collapsed */}
                      {!isExpanded ? (
                        <div className="flex items-center justify-between text-slate-600 flex-wrap gap-2">
                          <p className="truncate max-w-xl font-medium">
                            <strong>{order.items.reduce((s, i) => s + i.quantity, 0)} {lang === 'ne' ? 'परिकार:' : 'items:'}</strong>{' '}
                            {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </p>
                          <button
                            onClick={() => setExpandedOrderId(order.id)}
                            className="text-indigo-600 hover:underline font-bold text-[11px]"
                          >
                            {lang === 'ne' ? 'विवरण हेर्नुहोस् →' : 'View breakdown →'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3 animate-in fade-in">
                          {/* Table of items */}
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/40">
                            <div className="grid grid-cols-12 px-3 py-1.5 bg-slate-100 font-bold text-slate-700 text-[11px]">
                              <span className="col-span-5">Item</span>
                              <span className="col-span-2 text-center">Qty</span>
                              <span className="col-span-2 text-right">Price</span>
                              <span className="col-span-2 text-right">Total</span>
                              <span className="col-span-1 text-center">Action</span>
                            </div>
                            {order.items.map((item, idx) => (
                              <div key={item.id || idx} className="grid grid-cols-12 px-3 py-2 items-center text-xs">
                                <div className="col-span-5 pr-1">
                                  <p className="font-extrabold text-slate-900 leading-tight">{item.name}</p>
                                  {item.nepaliName && <p className="text-[10px] text-slate-500">{item.nepaliName}</p>}
                                  {item.selectedVariant && (
                                    <span className="text-[9px] text-indigo-700 font-bold block">Size: {item.selectedVariant.name}</span>
                                  )}
                                  {item.notes && (
                                    <span className="text-[9px] text-amber-800 italic block">Note: {item.notes}</span>
                                  )}
                                </div>
                                <span className="col-span-2 text-center font-bold font-mono-num text-slate-800">{item.quantity}</span>
                                <span className="col-span-2 text-right font-mono-num text-slate-600">{item.price.toFixed(0)}</span>
                                <span className="col-span-2 text-right font-black font-mono-num text-slate-900">
                                  {(item.price * item.quantity).toFixed(0)}
                                </span>
                                <div className="col-span-1 text-center">
                                  {isAdminOrManager && order.items.length > 1 && (
                                    <button
                                      onClick={() => setVoidItemTarget({ order, itemIndex: idx, item })}
                                      className="p-1 text-rose-500 hover:text-white hover:bg-rose-600 rounded transition-colors"
                                      title="Void / Delete item (Admin)"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Financial summary breakdown */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono-num text-xs">
                            <div>
                              <span className="text-slate-500 text-[10px] block uppercase">Subtotal</span>
                              <span className="font-bold text-slate-800">{settings.currencySymbol} {order.subtotal.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block uppercase">Discount</span>
                              <span className="font-bold text-rose-700">
                                {order.discountAmount > 0 ? `-${settings.currencySymbol} ${order.discountAmount.toFixed(2)} (${order.discountPercent}%)` : 'None'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block uppercase">SC / VAT</span>
                              <span className="font-bold text-slate-700">
                                {settings.currencySymbol} {((order.serviceChargeAmount || 0) + (order.vatAmount || 0)).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block uppercase">Grand Total</span>
                              <span className="font-black text-emerald-800">{settings.currencySymbol} {order.grandTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons Toolbar */}
                      {order.status === 'completed' ? (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>
                              Paid • {order.paymentMethod?.replace(/_/g, ' ').toUpperCase() || 'CASH'}
                            </span>
                            {order.dueAmount > 0 && (
                              <span className="font-mono-num text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                                Due {settings.currencySymbol}{order.dueAmount.toFixed(0)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onPrintEstimate(order)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-600" />
                            <span>{lang === 'ne' ? 'रसिद पुनः प्रिन्ट' : 'Reprint Tax Receipt'}</span>
                          </button>
                        </div>
                      ) : order.status === 'cancelled' ? (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-rose-800">
                          <span className="font-bold">Void Reason: {order.voidReason || 'Order Voided'}</span>
                          {order.voidedBy && (
                            <span className="text-[11px] text-slate-500">By {order.voidedBy}</span>
                          )}
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          {/* Left: General Billing Actions */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              onClick={() => {
                                onSelectOrderForPOS(order.tableRoomId, order.id);
                                onClose();
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                            >
                              <Receipt className="h-3.5 w-3.5 text-amber-400" />
                              <span>{lang === 'ne' ? 'बिलिङमा खोल्नुहोस्' : 'Open in POS'}</span>
                            </button>

                            <button
                              onClick={() => {
                                onOpenSettleModal(order);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>{lang === 'ne' ? 'भुक्तानी चुक्ता' : 'Pay & Settle'}</span>
                            </button>

                            {onSplitOrder && order.items.length > 0 && (
                              <button
                                type="button"
                                onClick={() => onSplitOrder(order)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition-colors"
                              >
                                <Split className="h-3.5 w-3.5" />
                                <span>{lang === 'ne' ? 'बिल बाँड्ने' : 'Split Bill'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => onPrintEstimate(order)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
                              title="Print Estimate Slip for Customer"
                            >
                              <Printer className="h-3.5 w-3.5 text-slate-500" />
                              <span>{lang === 'ne' ? 'कच्चा बिल स्लिप' : 'Estimate Slip'}</span>
                            </button>

                            {order.orderType === 'dine_in' && (
                              <>
                                <button
                                  onClick={() => {
                                    setTransferTarget(order);
                                    setDestTableId('');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
                                  title="Transfer order to another table"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Transfer</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setMergeTarget(order);
                                    setMergeTargetTableId('');
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
                                  title="Merge with another table bill"
                                >
                                  <Merge className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Merge</span>
                                </button>
                              </>
                            )}
                          </div>

                          {/* Right: ADMIN CONTROL ACTIONS */}
                          {isAdminOrManager && (
                            <div className="flex items-center gap-1.5 bg-amber-50 p-1 rounded-lg border border-amber-200">
                              <button
                                onClick={() => handleOpenPricingModal(order)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-[11px] font-bold transition-colors"
                                title="Admin Discount & Tax Override"
                              >
                                <Percent className="h-3 w-3 text-amber-700" />
                                <span>{lang === 'ne' ? 'विशेष छुट/कर' : 'Admin Discount'}</span>
                              </button>

                              <button
                                onClick={() => {
                                  setVoidTargetOrder(order);
                                  setVoidReason('Customer cancelled / अर्डर रद्द');
                                  setCustomReasonText('');
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-[11px] font-bold transition-colors shadow-2xs"
                                title="Void or Cancel this active order (Admin Only)"
                              >
                                <ShieldAlert className="h-3 w-3" />
                                <span>{lang === 'ne' ? 'अर्डर खारेज (Void)' : 'Void Order'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold">
              {lang === 'ne' ? 'सबै चालु अर्डरहरू वास्तविक समयमा अद्यावधिक हुन्छन्।' : 'All running orders auto-sync live in real-time.'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
          >
            {lang === 'ne' ? 'बन्द गर्नुहोस्' : 'Close Hub'}
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ADMIN VOID ORDER CONFIRMATION MODAL                      */}
      {/* ======================================================== */}
      {voidTargetOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-300 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {lang === 'ne' ? 'अर्डर खारेज (Void Active Order)' : 'Admin Void Order'}
                  </h3>
                  <p className="text-[11px] text-rose-800 font-mono-num font-semibold">
                    {voidTargetOrder.invoiceNo} · {voidTargetOrder.tableRoomName} ({settings.currencySymbol} {voidTargetOrder.grandTotal.toFixed(2)})
                  </p>
                </div>
              </div>
              <button onClick={() => setVoidTargetOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  {lang === 'ne' 
                    ? 'चेतावनी: यो अर्डर स्थायी रूपमा रद्द हुनेछ र टेबल खाली (Available) हुनेछ। यो कार्य अडिट लगमा दर्ता हुनेछ।' 
                    : 'Warning: This active order will be cancelled and table freed. This action is permanently logged to the system audit trail.'}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  {lang === 'ne' ? 'खारेज गर्नुको कारण (Reason for Void):' : 'Reason for Cancellation:'}
                </label>
                <select
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white"
                >
                  <option value="Customer cancelled / अर्डर रद्द">Customer cancelled / ग्राहकले रद्द गरे</option>
                  <option value="Mistake entry / गल्तीले थपिएको">Mistake entry / गल्ती प्रविष्टि</option>
                  <option value="Kitchen unavailable / किचेनमा परिकार अभाव">Kitchen item unavailable / सामग्री अभाव</option>
                  <option value="Customer walked out / ग्राहक निस्किए">Customer walked out / ग्राहक बिल नतिरी हिँडे</option>
                  <option value="Test order / परीक्षण अर्डर">Test order / टेस्ट अर्डर</option>
                  <option value="Other / अन्य">Other / अन्य विशेष कारण</option>
                </select>
              </div>

              {voidReason === 'Other / अन्य' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">विस्तृत कारण लेख्नुहोस्:</label>
                  <textarea
                    rows={2}
                    placeholder="Specific reason for cancelling order..."
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setVoidTargetOrder(null)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                {lang === 'ne' ? 'रद्द नगर्नुहोस्' : 'Keep Order'}
              </button>
              <button
                onClick={handleConfirmVoidOrder}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
              >
                {lang === 'ne' ? 'हो, अर्डर खारेज गर्नुहोस्' : 'Confirm Void Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADMIN VOID SINGLE ITEM MODAL                             */}
      {/* ======================================================== */}
      {voidItemTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-rose-300 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                {lang === 'ne' ? 'परिकार खारेज (Void Item)' : 'Void Order Item'}
              </h3>
              <button onClick={() => setVoidItemTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="p-2.5 bg-slate-100 rounded-lg text-slate-800">
                <p className="font-extrabold text-sm">{voidItemTarget.item.name}</p>
                <p className="text-[11px] text-slate-600">
                  {voidItemTarget.item.quantity} x {settings.currencySymbol} {voidItemTarget.item.price} = {settings.currencySymbol} {(voidItemTarget.item.quantity * voidItemTarget.item.price).toFixed(0)}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">कारण (Reason):</label>
                <select
                  value={voidItemReason}
                  onChange={(e) => setVoidItemReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Customer changed mind / ग्राहकले रद्द गरे">Customer changed mind / ग्राहकले रद्द गरे</option>
                  <option value="Kitchen mistake / गल्ती प्रविष्टि">Mistake entry / गल्ती प्रविष्टि</option>
                  <option value="Quality issue / गुणस्तर समस्या">Quality issue / गुणस्तर समस्या</option>
                  <option value="Out of stock / स्टक सकियो">Out of stock / सामग्री सकियो</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button onClick={() => setVoidItemTarget(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-bold">
                Cancel
              </button>
              <button onClick={handleConfirmVoidItem} className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold">
                Void Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADMIN PRICING & TAX OVERRIDE MODAL                       */}
      {/* ======================================================== */}
      {pricingTargetOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-300 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-amber-700" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {lang === 'ne' ? 'एडमिन विशेष छुट तथा कर समायोजन' : 'Admin Special Discount & Tax Waive'}
                </h3>
              </div>
              <button onClick={() => setPricingTargetOrder(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>{pricingTargetOrder.tableRoomName} · {pricingTargetOrder.invoiceNo}</span>
                  <span className="font-mono-num text-emerald-800">{settings.currencySymbol} {pricingTargetOrder.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  {lang === 'ne' ? 'विशेष छुट प्रतिशत (%):' : 'Special Discount (%):'}
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[0, 10, 15, 20, 50].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAdminDiscountPct(pct)}
                      className={`py-1.5 rounded-lg font-bold border transition-colors ${
                        adminDiscountPct === pct
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={adminDiscountPct}
                  onChange={(e) => setAdminDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono-num font-bold"
                  placeholder="Custom % (e.g. 25)"
                />
              </div>

              {/* Waive SC & VAT Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer">
                  <span className="font-bold text-slate-800">
                    {lang === 'ne' ? '१०% सर्भिस चार्ज मिनाहा (Waive 10% SC)' : 'Waive 10% Service Charge'}
                  </span>
                  <input
                    type="checkbox"
                    checked={adminWaiveSC}
                    onChange={(e) => setAdminWaiveSC(e.target.checked)}
                    className="h-4 w-4 rounded text-slate-900 focus:ring-0"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer">
                  <span className="font-bold text-slate-800">
                    {lang === 'ne' ? '१३% भ्याट मिनाहा (Waive 13% VAT)' : 'Waive 13% VAT'}
                  </span>
                  <input
                    type="checkbox"
                    checked={adminWaiveVat}
                    onChange={(e) => setAdminWaiveVat(e.target.checked)}
                    className="h-4 w-4 rounded text-slate-900 focus:ring-0"
                  />
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  {lang === 'ne' ? 'एडमिन नोट / कारण (Admin Reason):' : 'Admin Reason / Note:'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP guest discount / Proprietor comp"
                  value={adminPricingNote}
                  onChange={(e) => setAdminPricingNote(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setPricingTargetOrder(null)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdminPricing}
                className="px-4 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
              >
                Save Pricing Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TRANSFER TABLE MODAL                                     */}
      {/* ======================================================== */}
      {transferTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Transfer {transferTarget.tableRoomName}
              </h3>
              <button onClick={() => setTransferTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">Select free available table to shift active order:</p>
              <select
                value={destTableId}
                onChange={(e) => setDestTableId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="">-- Choose Free Table --</option>
                {tablesRooms
                  .filter(t => t.id !== transferTarget.tableRoomId && t.status === 'available')
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code} - {t.name} (Free)
                    </option>
                  ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button onClick={() => setTransferTarget(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-bold">
                Cancel
              </button>
              <button
                disabled={!destTableId}
                onClick={handleConfirmTransfer}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold disabled:opacity-40"
              >
                Shift Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MERGE TABLE MODAL                                        */}
      {/* ======================================================== */}
      {mergeTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Merge {mergeTarget.tableRoomName} with Table
              </h3>
              <button onClick={() => setMergeTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">Choose master target table to combine bills:</p>
              <select
                value={mergeTargetTableId}
                onChange={(e) => setMergeTargetTableId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold"
              >
                <option value="">-- Choose Master Table --</option>
                {tablesRooms
                  .filter(t => t.id !== mergeTarget.tableRoomId && orders.some(o => o.tableRoomId === t.id && o.status === 'active'))
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.code} - {t.name} (Running Bill)
                    </option>
                  ))}
              </select>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button onClick={() => setMergeTarget(null)} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-bold">
                Cancel
              </button>
              <button
                disabled={!mergeTargetTableId}
                onClick={handleConfirmMerge}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold disabled:opacity-40"
              >
                Merge Tables
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="w-full animate-in fade-in duration-150">{modalContent}</div>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      {modalContent}
    </div>
  );
};
