import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Plus,
  Receipt,
  Search,
  UtensilsCrossed,
  X
} from 'lucide-react';
import {
  BusinessSettings,
  Customer,
  InventoryItem,
  MenuItem,
  Order,
  PaymentMethod,
  PaymentRecord,
  ProductRecipe,
  ResortRoom,
  Session,
  TableRoom
} from '../../types';
import { Language } from '../../utils/translations';
import { hasPermission, validateInventoryStock } from '../../services/security';
import { classifyOrderPayment } from '../../services/orderAudit';
import { isNetworkOnline } from '../../services/syncService';
import { formatElapsedTime, nowIsoString, parseOrderTimestampMs } from '../../utils/timeUtils';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptModal } from './ReceiptModal';

interface BillsViewProps {
  orders: Order[];
  tablesRooms: TableRoom[];
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  recipes?: ProductRecipe[];
  customers: Customer[];
  occupiedResortRooms?: ResortRoom[];
  settings: BusinessSettings;
  lang: Language;
  currentSession: Session | null;
  onSaveOrder: (order: Order, shouldSettle: boolean, updatedTableRoomStatus?: string) => boolean;
  onOpenOrderInPOS: (tableRoomId: string, orderId: string) => void;
  onNavigateToTables: () => void;
  onPromptAuth?: () => void;
  onUpdateSettings?: (newSettings: BusinessSettings) => void;
}

export const BillsView: React.FC<BillsViewProps> = ({
  orders,
  tablesRooms,
  menuItems,
  inventoryItems,
  recipes = [],
  customers,
  occupiedResortRooms = [],
  settings,
  lang,
  currentSession,
  onSaveOrder,
  onOpenOrderInPOS,
  onNavigateToTables,
  onPromptAuth,
  onUpdateSettings
}) => {
  const [filterMode, setFilterMode] = useState<'unpaid' | 'paid'>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<{ order: Order; isEstimate?: boolean } | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userRole = currentSession?.role;
  const canSettlePayment = userRole ? hasPermission(userRole, 'SETTLE_PAYMENT') : false;

  const openUnpaidBills = useMemo(() => {
    return orders
      .filter((o) => o.status === 'active' && o.kotStatus !== 'cancelled' && (o.items?.length || 0) > 0)
      .sort((a, b) => {
        const msA = parseOrderTimestampMs(a.kotSentAt || a.createdAt) || 0;
        const msB = parseOrderTimestampMs(b.kotSentAt || b.createdAt) || 0;
        return msB - msA;
      });
  }, [orders]);

  const settledBills = useMemo(() => {
    return orders
      .filter((o) => o.status === 'completed')
      .sort((a, b) => {
        const msA = parseOrderTimestampMs(a.settledAt || a.createdAt) || 0;
        const msB = parseOrderTimestampMs(b.settledAt || b.createdAt) || 0;
        return msB - msA;
      })
      .slice(0, 60);
  }, [orders]);

  const displayedBills = useMemo(() => {
    const source = filterMode === 'unpaid' ? openUnpaidBills : settledBills;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase();
    return source.filter((order) => {
      const table = tablesRooms.find((t) => t.id === order.tableRoomId);
      const label = `${table?.code || ''} ${order.tableRoomName || ''} ${order.invoiceNo || ''} ${order.customerName || ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [filterMode, openUnpaidBills, settledBills, searchQuery, tablesRooms]);

  const totalUnpaidAmount = useMemo(
    () => openUnpaidBills.reduce((sum, o) => sum + (o.dueAmount > 0 ? o.dueAmount : o.grandTotal), 0),
    [openUnpaidBills]
  );

  const showToast = (text: string, type: 'success' | 'error') => {
    setFeedbackToast({ text, type });
    window.setTimeout(() => setFeedbackToast(null), 4500);
  };

  const handleOpenBillCheckout = (order: Order) => {
    if (!currentSession) {
      onPromptAuth?.();
      return;
    }
    if (!canSettlePayment) {
      showToast(
        lang === 'ne'
          ? 'तपाईंको भूमिकालाई बिल भुक्तानी स्वीकार गर्ने अनुमति छैन।'
          : 'Your staff role does not have permission to settle payments.',
        'error'
      );
      return;
    }
    if (!isNetworkOnline()) {
      showToast(
        lang === 'ne'
          ? 'अफलाइन मोडमा बिल चुक्ता गर्न मिल्दैन। इन्टरनेट जडान जाँच गर्नुहोस्।'
          : 'Cannot settle payment while offline. Check your connection first.',
        'error'
      );
      return;
    }
    const stockCheck = validateInventoryStock(order.items, menuItems, inventoryItems, recipes);
    if (!stockCheck.hasSufficientStock) {
      const detail = stockCheck.shortages
        .map((s) => `${s.itemName} (${s.currentStock}/${s.requiredQty} ${s.unit})`)
        .join(', ');
      showToast(
        lang === 'ne' ? `स्टक अपर्याप्त: ${detail}` : `Insufficient stock: ${detail}`,
        'error'
      );
      return;
    }
    setCheckoutOrder(order);
  };

  const handleConfirmSettlement = (
    paymentMethod: PaymentMethod,
    paymentDetails: Record<string, number>,
    customerId?: string,
    customerName?: string,
    customerPhone?: string,
    paidAmount?: number,
    dueAmount?: number,
    paymentRecord?: PaymentRecord,
    roomChargeDetails?: {
      resortRoomId: string;
      roomNumber: string;
      guestName: string;
      reservationId: string;
    }
  ) => {
    if (!checkoutOrder) return;
    const settledNow = nowIsoString();
    const finalizedOrder: Order = {
      ...checkoutOrder,
      paymentMethod,
      paymentDetails,
      paidAmount: paidAmount ?? checkoutOrder.grandTotal,
      dueAmount: dueAmount ?? 0,
      paymentStatus:
        dueAmount && dueAmount > 0
          ? paidAmount && paidAmount > 0
            ? 'partial'
            : 'credit'
          : 'paid',
      paymentRecords: paymentRecord ? [paymentRecord] : checkoutOrder.paymentRecords || [],
      customerId: customerId || checkoutOrder.customerId,
      customerName: customerName || checkoutOrder.customerName,
      customerPhone: customerPhone || checkoutOrder.customerPhone,
      roomChargeDetails,
      cashTendered: paymentRecord?.cashTendered,
      changeReturned: paymentRecord?.changeReturned,
      paymentReference: paymentRecord?.referenceNo,
      cashierName: currentSession?.name || paymentRecord?.staffName,
      settledAt: settledNow,
      updatedAt: settledNow,
      idempotencyKey: `idemp-${checkoutOrder.id}-settle-${paymentRecord?.id || Date.now()}`,
      status: 'completed'
    };

    const saved = onSaveOrder(finalizedOrder, true, 'available');
    if (!saved) {
      showToast(
        lang === 'ne'
          ? 'बिल भुक्तानी सुरक्षित हुन सकेन। कृपया चेतावनी सन्देश वा स्टक/सिङ्क जाँच गर्नुहोस्।'
          : 'Could not complete settlement. Please review the alert banner and retry.',
        'error'
      );
      return;
    }

    setCheckoutOrder(null);
    setReceiptOrder({ order: finalizedOrder, isEstimate: false });
    showToast(
      lang === 'ne'
        ? `${finalizedOrder.tableRoomName || finalizedOrder.invoiceNo} को बिल भुक्तानी भयो!`
        : `Bill settled for ${finalizedOrder.tableRoomName || finalizedOrder.invoiceNo}!`,
      'success'
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-36 md:pb-24 space-y-4">
      {feedbackToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md">
          <div
            className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 shadow-lg ${
              feedbackToast.type === 'error'
                ? 'bg-rose-600 border-rose-700 text-white'
                : 'bg-emerald-700 border-emerald-800 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{feedbackToast.text}</span>
            </div>
            <button type="button" onClick={() => setFeedbackToast(null)} className="p-1 rounded hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Clean Bills Header (Matching Video Walkthrough) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {lang === 'ne' ? 'बिलहरू (Bills)' : 'Bills'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 tabular-nums">
              {filterMode === 'unpaid'
                ? lang === 'ne'
                  ? `${openUnpaidBills.length} नतिरेको खुला बिल · जम्मा ${settings.currencySymbol} ${totalUnpaidAmount.toFixed(2)}`
                  : `${openUnpaidBills.length} open bills · ${settings.currencySymbol} ${totalUnpaidAmount.toFixed(2)}`
                : lang === 'ne'
                ? `${settledBills.length} भुक्तानी भइसकेका बिल`
                : `${settledBills.length} settled bills`}
            </p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setFilterMode('unpaid')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap tabular-nums ${
                filterMode === 'unpaid'
                  ? 'bg-white text-orange-600 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ne' ? `बाँकी (${openUnpaidBills.length})` : `Unpaid (${openUnpaidBills.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('paid')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap tabular-nums ${
                filterMode === 'paid'
                  ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ne' ? 'तिरेको' : 'Settled'}
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ne' ? 'टेबल, बिल नम्बर वा ग्राहक खोज्नुहोस्...' : 'Search table, bill #, or guest...'}
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-orange-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bills List */}
      {displayedBills.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {filterMode === 'unpaid'
                ? lang === 'ne'
                  ? 'कुनै नतिरेको बिल छैन'
                  : 'No open unpaid bills'
                : lang === 'ne'
                ? 'कुनै भुक्तानी भएको बिल भेटिएन'
                : 'No settled bills found'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {filterMode === 'unpaid'
                ? lang === 'ne'
                  ? 'टेबलबाट अर्डर कन्फर्म गरेपछि बिल यहाँ Unpaid को रूपमा देखिनेछ।'
                  : 'Confirm an order on a table to see its unpaid bill here.'
                : lang === 'ne'
                ? 'आज चुक्ता भएका रसिदहरू यहाँ देखिनेछन्।'
                : 'Completed payments and receipts appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedBills.map((order) => {
            const matchedTable = tablesRooms.find((t) => t.id === order.tableRoomId);
            const displayTitle =
              order.orderType === 'dine_in'
                ? matchedTable?.code || order.tableRoomName || order.invoiceNo
                : order.orderType === 'takeaway'
                ? `Takeaway · ${order.customerName || order.invoiceNo}`
                : `Delivery · ${order.customerName || order.invoiceNo}`;
            const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
            const elapsed = formatElapsedTime(order.kotSentAt || order.createdAt);
            const isOpen = order.status === 'active';

            return (
              <div
                key={order.id}
                onClick={() => {
                  if (isOpen) {
                    handleOpenBillCheckout(order);
                  } else {
                    setReceiptOrder({ order, isEstimate: false });
                  }
                }}
                className="bg-white rounded-2xl border border-slate-200 hover:border-orange-400 p-4 shadow-2xs transition-all cursor-pointer active:scale-[0.995]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                        {displayTitle}
                      </h3>
                      {matchedTable?.name && matchedTable.code !== matchedTable.name && order.orderType === 'dine_in' && (
                        <span className="text-xs text-slate-500 truncate hidden sm:inline">
                          {matchedTable.name}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 truncate tabular-nums">
                      {isOpen
                        ? lang === 'ne'
                          ? `खुला अर्डर · ${itemCount} परिकार · ${elapsed}`
                          : `Open order · ${itemCount} item${itemCount === 1 ? '' : 's'} · ${elapsed}`
                        : `${order.invoiceNo} · ${
                            lang === 'ne'
                              ? classifyOrderPayment(order).channelLabelNe
                              : classifyOrderPayment(order).channelLabel
                          }`}
                    </p>

                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{lang === 'ne' ? 'नतिरेको (Unpaid)' : 'Unpaid'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                          <span>
                            {order.paymentStatus === 'credit'
                              ? 'Khata Credit'
                              : classifyOrderPayment(order).channelLabel}
                          </span>
                        </span>
                      )}

                      {order.kotNo && (
                        <span className="text-[11px] font-mono-num text-slate-500">
                          {order.kotNo}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-base sm:text-lg font-black font-mono-num text-slate-950 tabular-nums whitespace-nowrap">
                        {settings.currencySymbol} {order.grandTotal.toFixed(2)}
                      </p>
                      {isOpen && (
                        <div className="flex items-center justify-end gap-1.5 mt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenOrderInPOS(order.tableRoomId, order.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors whitespace-nowrap"
                          >
                            <Plus className="h-3 w-3" />
                            <span>{lang === 'ne' ? 'थप्नुहोस्' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReceiptOrder({ order, isEstimate: true });
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors whitespace-nowrap"
                          >
                            <Receipt className="h-3 w-3" />
                            <span>{lang === 'ne' ? 'स्लिप' : 'Slip'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fixed Bottom "Back to tables" Bar (Matches Video Navigation Flow) */}
      <div className="fixed bottom-[3.9rem] md:bottom-4 inset-x-0 z-30 px-3 sm:px-6 pointer-events-none">
        <div className="max-w-4xl mx-auto flex justify-center sm:justify-end pointer-events-auto">
          <button
            type="button"
            onClick={onNavigateToTables}
            className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-2xl shadow-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4 text-slate-700" />
            <span>{lang === 'ne' ? 'टेबलमा फर्कनुहोस्' : 'Back to tables'}</span>
          </button>
        </div>
      </div>

      {/* Checkout Settlement Modal */}
      {checkoutOrder && (
        <CheckoutModal
          order={checkoutOrder}
          customers={customers}
          settings={settings}
          lang={lang}
          currentSession={currentSession}
          occupiedRooms={occupiedResortRooms}
          onConfirmSettlement={handleConfirmSettlement}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setCheckoutOrder(null)}
        />
      )}

      {/* Official Receipt / Estimate Slip Modal */}
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder.order}
          settings={settings}
          lang={lang}
          isEstimate={receiptOrder.isEstimate}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
};
