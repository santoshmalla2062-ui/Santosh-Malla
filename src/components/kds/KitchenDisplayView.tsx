import React, { useState, useEffect } from 'react';
import { NumberInput } from '../common/NumberInput';
import { 
  ChefHat, 
  Clock, 
  CheckCircle2, 
  Flame, 
  AlertCircle, 
  Check, 
  RotateCcw, 
  Layers, 
  Utensils, 
  Coffee, 
  Cake, 
  Printer, 
  X, 
  Trash2, 
  Ban, 
  Sparkles, 
  CheckSquare, 
  Square, 
  Search,
  Radio,
  FileText
} from 'lucide-react';
import { KitchenStation, Order, InventoryItem } from '../../types';
import { Language } from '../../utils/translations';
import { formatReceiptNepaliDate } from '../../utils/nepaliCalendar';
import { formatElapsedTime, getElapsedMinutes } from '../../utils/timeUtils';

interface KitchenDisplayViewProps {
  orders: Order[];
  lang: Language;
  businessName?: string;
  inventoryItems?: InventoryItem[];
  onUpdateOrderStatus: (
    orderId: string, 
    kotStatus: 'sent_to_kitchen' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'expired',
    cancellationReason?: string
  ) => void;
  onRecordWaste?: (
    itemId: string, 
    quantity: number, 
    reason: 'wastage_spoilage' | 'manual_adjustment', 
    notes: string
  ) => void;
}

export type KDSTab = 'todo' | 'in_progress' | 'completed' | 'cancelled' | 'expired';

export const KitchenDisplayView: React.FC<KitchenDisplayViewProps> = ({
  orders,
  lang,
  businessName = 'Naulo Hospitality',
  inventoryItems = [],
  onUpdateOrderStatus,
  onRecordWaste
}) => {
  // Tabs matching Naulo Hospitality / Dine Track KDS in the video
  const [activeTab, setActiveTab] = useState<KDSTab>('todo');
  const [selectedStation, setSelectedStation] = useState<KitchenStation | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [checkedItemIds, setCheckedItemIds] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);

  // Cancellation Modal State
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState<string>('Customer requested cancellation');
  const [cancelCustomReason, setCancelCustomReason] = useState<string>('');
  const [isWasteAlsoRecorded, setIsWasteAlsoRecorded] = useState<boolean>(false);

  // Waste Recording Modal State (from "Record waste" button in video)
  const [showWasteModal, setShowWasteModal] = useState<boolean>(false);
  const [selectedWasteItemId, setSelectedWasteItemId] = useState<string>('');
  const [wasteQty, setWasteQty] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState<string>('Burnt / Spoiled during preparation');

  // KOT Print Modal State (from printer icon on each card)
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Refresh timers every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Helper: check if order is unaccepted
  const isKOTUnaccepted = (order: Order) => {
    return !order.kotStatus || order.kotStatus === 'sent_to_kitchen' || order.kotStatus === 'new' || order.kotStatus === 'pending';
  };

  // Helper: check if order is marked expired
  const isKOTExpired = (order: Order) => {
    return order.kotStatus === 'expired';
  };

  // Filter orders by station and search
  const filteredOrders = orders.filter(order => {
    // Station filter
    if (selectedStation !== 'all') {
      const matchesStation = order.items.some(item => {
        const cat = (item.category || '').toLowerCase();
        const stn = ((item as any).station || '').toLowerCase();
        if (selectedStation === 'main_kitchen') {
          return stn === 'main_kitchen' || !item.category || [
            'food', 'mains', 'appetizers', 'nepali', 'nepali_food', 'continental', 
            'snacks', 'fast_food', 'dining_food'
          ].includes(cat);
        }
        if (selectedStation === 'coffee_bar') {
          return stn === 'coffee_bar' || [
            'beverage', 'drinks', 'coffee', 'tea', 'cafe_beverages', 'cold_drinks', 
            'mocktails', 'bar_spirits', 'beer', 'wine', 'cocktails'
          ].includes(cat);
        }
        if (selectedStation === 'bakery') {
          return stn === 'bakery' || [
            'dessert', 'bakery', 'pastry', 'bakery_snacks'
          ].includes(cat);
        }
        return true;
      });
      if (!matchesStation) return false;
    }

    // Search query filter (search by table, KOT no, or item name)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTable = (order.tableRoomName || '').toLowerCase().includes(q);
      const matchKot = (order.kotNo || '').toLowerCase().includes(q);
      const matchItems = order.items.some(i => i.name.toLowerCase().includes(q));
      if (!matchTable && !matchKot && !matchItems) return false;
    }

    return true;
  });

  // Calculate live counts matching the video tabs: To do, In progress, Completed, Cancelled
  const todoOrders = filteredOrders.filter(o => 
    o.kotStatus !== 'cancelled' && 
    o.status !== 'cancelled' && 
    o.kotStatus !== 'expired' && 
    (isKOTUnaccepted(o) || o.kotStatus === 'accepted')
  );
  const inProgressOrders = filteredOrders.filter(o => 
    o.kotStatus === 'preparing' && 
    o.status !== 'cancelled'
  );
  const completedOrders = filteredOrders.filter(o => 
    (o.kotStatus === 'ready' || o.kotStatus === 'served') &&
    o.status !== 'cancelled'
  );
  const cancelledOrders = filteredOrders.filter(o => 
    o.kotStatus === 'cancelled' || o.status === 'cancelled'
  );
  const expiredOrders = filteredOrders.filter(o => 
    o.kotStatus === 'expired'
  );

  // Current tab orders
  const currentTabOrders = (() => {
    switch (activeTab) {
      case 'todo':
        return todoOrders;
      case 'in_progress':
        return inProgressOrders;
      case 'completed':
        return completedOrders;
      case 'cancelled':
        return cancelledOrders;
      case 'expired':
        return expiredOrders;
      default:
        return todoOrders;
    }
  })();

  // Relative elapsed time uses timezone-safe timeUtils parser
  const formatElapsed = (dateString: string) => formatElapsedTime(dateString);

  // Toggle item preparation strike-through
  const toggleItemChecked = (itemId: string) => {
    setCheckedItemIds(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Confirm KOT Cancellation
  const handleConfirmCancel = () => {
    if (!cancellingOrder) return;
    const finalReason = cancelReasonPreset === 'Other / Custom Reason' && cancelCustomReason.trim()
      ? cancelCustomReason.trim()
      : cancelReasonPreset;

    // Update order status to cancelled
    onUpdateOrderStatus(cancellingOrder.id, 'cancelled', finalReason);

    // Optionally record as kitchen waste
    if (isWasteAlsoRecorded && onRecordWaste && inventoryItems.length > 0) {
      // Find matching ingredient or log waste for first available
      cancellingOrder.items.forEach(item => {
        const matchedInv = inventoryItems.find(i => 
          i.name.toLowerCase().includes(item.name.toLowerCase()) || 
          item.name.toLowerCase().includes(i.name.toLowerCase())
        );
        if (matchedInv) {
          onRecordWaste(matchedInv.id, item.quantity, 'wastage_spoilage', `Cancelled Order #${cancellingOrder.kotNo || cancellingOrder.id}: ${finalReason}`);
        }
      });
    }

    setCancellingOrder(null);
    setCancelCustomReason('');
    setIsWasteAlsoRecorded(false);
  };

  // Restore Cancelled Order back to To-Do
  const handleRestoreOrder = (orderId: string) => {
    onUpdateOrderStatus(orderId, 'sent_to_kitchen');
  };

  // Submit Waste Modal
  const handleSaveWasteEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWasteItemId || !onRecordWaste) return;
    const item = inventoryItems.find(i => i.id === selectedWasteItemId);
    if (!item) return;
    onRecordWaste(selectedWasteItemId, wasteQty, 'wastage_spoilage', wasteReason);
    setShowWasteModal(false);
    setSelectedWasteItemId('');
    setWasteQty(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 space-y-4 font-sans select-none">
      
      {/* Top Main Kitchen Header Bar matching Video */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: System Title & Business Subtitle */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black shadow-xs">
            <ChefHat className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Kitchen View</h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                Live
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {businessName} · Kitchen Display System (KDS)
            </p>
          </div>
        </div>

        {/* Right Controls: Record Waste, Station filter, Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search table, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 w-36 sm:w-44 transition-all"
            />
          </div>

          {/* Record Waste Button (Directly from video!) */}
          {onRecordWaste && (
            <button
              onClick={() => setShowWasteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors"
              title="Record kitchen waste / food spoilage"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-600" />
              <span>Record waste</span>
            </button>
          )}

          {/* Station Filter Pills */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setSelectedStation('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedStation === 'all'
                  ? 'bg-white text-orange-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedStation('main_kitchen')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedStation === 'main_kitchen'
                  ? 'bg-white text-orange-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kitchen
            </button>
            <button
              onClick={() => setSelectedStation('coffee_bar')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedStation === 'coffee_bar'
                  ? 'bg-white text-orange-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setSelectedStation('bakery')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                selectedStation === 'bakery'
                  ? 'bg-white text-orange-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bakery
            </button>
          </div>
        </div>
      </div>

      {/* 4 Main Tabs matching Video: To do, In progress, Completed, Cancelled */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {/* 1. To do */}
        <button
          onClick={() => setActiveTab('todo')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'todo'
              ? 'bg-orange-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>To do</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'todo' ? 'bg-white text-orange-600' : 'bg-slate-100 text-slate-700'
          }`}>
            {todoOrders.length}
          </span>
        </button>

        {/* 2. In progress */}
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'in_progress'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>In progress</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'in_progress' ? 'bg-white text-amber-700' : 'bg-slate-100 text-slate-700'
          }`}>
            {inProgressOrders.length}
          </span>
        </button>

        {/* 3. Completed */}
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <span>Completed</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'completed' ? 'bg-white text-emerald-700' : 'bg-slate-100 text-slate-700'
          }`}>
            {completedOrders.length}
          </span>
        </button>

        {/* 4. Cancelled (The user's core request!) */}
        <button
          onClick={() => setActiveTab('cancelled')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'cancelled'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
          }`}
        >
          <span>Cancelled</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'cancelled' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-800'
          }`}>
            {cancelledOrders.length}
          </span>
        </button>

        {/* 5. Expired (Auto-expired after 1 hr unaccepted) */}
        {expiredOrders.length > 0 && (
          <button
            onClick={() => setActiveTab('expired')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === 'expired'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Expired ({expiredOrders.length})</span>
          </button>
        )}
      </div>

      {/* Grid of KOT Cards matching Video (3 Columns Responsive) */}
      {currentTabOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
            {activeTab === 'cancelled' ? <Ban className="h-8 w-8 text-rose-400" /> : <ChefHat className="h-8 w-8 text-slate-400" />}
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {activeTab === 'todo' && 'No pending orders in To do'}
            {activeTab === 'in_progress' && 'No orders currently in progress'}
            {activeTab === 'completed' && 'No completed orders yet'}
            {activeTab === 'cancelled' && 'No cancelled kitchen tickets'}
            {activeTab === 'expired' && 'No expired kitchen tickets'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'todo' && 'Orders sent from POS or Waiters will instantly appear here with chimes.'}
            {activeTab === 'cancelled' && 'Orders cancelled from kitchen will be archived here with cancellation audit reasons.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentTabOrders.map((order, orderIndex) => {
            const isTakeaway = order.orderType === 'takeaway' || order.orderType === 'delivery';
            const ticketTs = order.kotSentAt || order.createdAt;
            const elapsedTimeStr = formatElapsed(ticketTs);
            const elapsedMins = getElapsedMinutes(ticketTs);
            const isCancelledTab = activeTab === 'cancelled' || order.kotStatus === 'cancelled';
            const isInProgressTab = activeTab === 'in_progress' || order.kotStatus === 'preparing';

            // Clean table / destination name
            const destinationDisplay = (() => {
              if (order.tableRoomName) {
                // If takeaway e.g. "TAKEAWAY#FOODMANDU"
                if (isTakeaway && !order.tableRoomName.toUpperCase().includes('TAKEAWAY')) {
                  return `TAKEAWAY#${order.tableRoomName.toUpperCase().replace(/\s+/g, '')}`;
                }
                return order.tableRoomName.toUpperCase();
              }
              if (order.customerName) {
                return `${isTakeaway ? 'TAKEAWAY#' : ''}${order.customerName.toUpperCase().replace(/\s+/g, '')}`;
              }
              return isTakeaway ? 'TAKEAWAY#COUNTER' : 'COUNTER';
            })();

            // Clean KOT ticket identifier
            const kotTicketLabel = (() => {
              if (order.kotNo) {
                return `${order.kotNo} #${orderIndex + 1}`;
              }
              return `KOT 1 #${order.id.slice(-4)}`;
            })();

            return (
              <div 
                key={order.id}
                className={`bg-white rounded-2xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isCancelledTab 
                    ? 'border-rose-200 bg-rose-50/20' 
                    : isInProgressTab 
                    ? 'border-amber-300 ring-1 ring-amber-400/20' 
                    : 'border-slate-200'
                }`}
              >
                {/* Card Header matching Video */}
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {/* Destination / Table Name */}
                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                        {destinationDisplay}
                      </h3>
                      {/* KOT # & Takeaway badge */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-semibold text-slate-500 font-mono">
                          {kotTicketLabel}
                        </span>
                        {isTakeaway && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
                            Takeaway
                          </span>
                        )}
                        {order.kotPriority === 'urgent' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            URGENT
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Age / Elapsed Time Indicator */}
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold tabular-nums border shrink-0 whitespace-nowrap ${
                      elapsedMins >= 30
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : elapsedMins >= 15
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      <Clock className="h-3 w-3" />
                      <span>{elapsedTimeStr}</span>
                    </div>
                  </div>
                </div>

                {/* Card Items List matching Video */}
                <div className="p-4 flex-1 space-y-2">
                  <div className="space-y-1.5 divide-y divide-slate-100">
                    {order.items.map((item, itemIdx) => {
                      const itemKey = `${order.id}-${item.id || itemIdx}`;
                      const isItemChecked = !!checkedItemIds[itemKey];

                      return (
                        <div 
                          key={itemKey}
                          onClick={() => toggleItemChecked(itemKey)}
                          className={`pt-1.5 flex items-start gap-2.5 cursor-pointer group select-none transition-colors ${
                            isItemChecked ? 'opacity-40' : ''
                          }`}
                        >
                          <button
                            type="button"
                            className="mt-0.5 text-slate-400 group-hover:text-slate-600 shrink-0"
                          >
                            {isItemChecked ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-300" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-black text-slate-900 shrink-0">
                                {item.quantity}
                              </span>
                              <span className={`text-xs font-semibold text-slate-900 leading-tight ${
                                isItemChecked ? 'line-through text-slate-400' : ''
                              }`}>
                                {item.name}
                              </span>
                            </div>
                            {item.selectedVariant && (
                              <p className="text-[10px] text-slate-500 pl-5">
                                Size: {item.selectedVariant.name}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-[10px] font-bold text-amber-800 italic pl-5 mt-0.5">
                                * {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Special Order Instructions */}
                  {order.specialInstructions && (
                    <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
                      Note: {order.specialInstructions}
                    </div>
                  )}

                  {/* Cancelled Information Badge (if in Cancelled Tab) */}
                  {isCancelledTab && (
                    <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-rose-800 font-bold">
                        <Ban className="h-3.5 w-3.5" />
                        <span>Cancelled from Kitchen</span>
                      </div>
                      <p className="text-[11px] text-rose-900 font-semibold">
                        Reason: {order.voidReason || 'Cancelled by staff'}
                      </p>
                      {order.voidedAt && (
                        <p className="text-[10px] text-slate-500">
                          Cancelled at: {order.voidedAt} {order.voidedBy ? `by ${order.voidedBy}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Footer matching Video: Start, All ready, Print icon, Cancel link */}
                <div className="p-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl">
                  {isCancelledTab ? (
                    /* Cancelled Tab Actions: Restore */
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-rose-700 font-semibold">Archived Ticket</span>
                      <button
                        onClick={() => handleRestoreOrder(order.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
                        <span>Restore KOT</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Top Action Row: Start, All ready, Print */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* Start / Preparing Button */}
                          {order.kotStatus !== 'preparing' && order.kotStatus !== 'ready' && (
                            <button
                              onClick={() => onUpdateOrderStatus(order.id, 'preparing')}
                              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                            >
                              Start
                            </button>
                          )}

                          {/* If already preparing, show Ready button */}
                          {order.kotStatus === 'preparing' && (
                            <button
                              onClick={() => onUpdateOrderStatus(order.id, 'ready')}
                              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                            >
                              Ready
                            </button>
                          )}

                          {/* All ready Button */}
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'ready')}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 active:scale-95 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-all"
                          >
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>All ready</span>
                          </button>
                        </div>

                        {/* Print KOT Slip Icon Button matching Video at 00:09 */}
                        <button
                          onClick={() => setPrintingOrder(order)}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 bg-white border border-slate-300 rounded-xl transition-colors shadow-2xs"
                          title="Print / Reprint KOT Ticket"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Bottom Cancel Link/Button (Under Start button, exactly like the video at 00:06) */}
                      <div className="pt-2 text-left">
                        <button
                          onClick={() => setCancellingOrder(order)}
                          className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors p-0.5 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* KOT CANCELLATION MODAL (The user's core requested system) */}
      {/* ========================================================= */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                <h3 className="font-bold text-sm">Cancel Kitchen Order (KOT)</h3>
              </div>
              <button
                onClick={() => setCancellingOrder(null)}
                className="p-1 text-rose-100 hover:text-white rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Order Context */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-900">
                  <span>Destination: {cancellingOrder.tableRoomName || 'Counter'}</span>
                  <span className="font-mono text-slate-500">{cancellingOrder.kotNo}</span>
                </div>
                <div className="text-xs text-slate-600 pt-1 border-t border-slate-200">
                  Items: {cancellingOrder.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                </div>
              </div>

              {/* Cancellation Reason Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Select Reason for Cancellation:
                </label>
                <div className="space-y-1.5">
                  {[
                    'Customer requested cancellation',
                    'Out of ingredients / Item finished',
                    'Mistakenly punched / Duplicate KOT',
                    'Kitchen delay / Unable to prepare',
                    'Spoiled / Burnt ingredients',
                    'Other / Custom Reason'
                  ].map((reason) => (
                    <label 
                      key={reason}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        cancelReasonPreset === reason 
                          ? 'bg-rose-50 border-rose-300 text-rose-950 font-bold' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="cancel_reason"
                        value={reason}
                        checked={cancelReasonPreset === reason}
                        onChange={(e) => setCancelReasonPreset(e.target.value)}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>

                {cancelReasonPreset === 'Other / Custom Reason' && (
                  <textarea
                    rows={2}
                    placeholder="Enter custom cancellation reason..."
                    value={cancelCustomReason}
                    onChange={(e) => setCancelCustomReason(e.target.value)}
                    className="w-full mt-2 p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                )}
              </div>

              {/* Record Waste Checkbox */}
              {onRecordWaste && (
                <label className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isWasteAlsoRecorded}
                    onChange={(e) => setIsWasteAlsoRecorded(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold text-amber-950 block">Record as Kitchen Waste / Spoilage</span>
                    <span className="text-[11px] text-amber-800">
                      If food was already prepped or ingredients consumed, automatically log stock wastage.
                    </span>
                  </div>
                </label>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs"
              >
                Confirm Cancel KOT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RECORD WASTE MODAL (From "Record waste" in top header) */}
      {/* ========================================================= */}
      {showWasteModal && onRecordWaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-sm">Record Kitchen Food Waste</h3>
              </div>
              <button
                onClick={() => setShowWasteModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWasteEntry} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Select Wasted Raw Ingredient:
                </label>
                <select
                  value={selectedWasteItemId}
                  onChange={(e) => setSelectedWasteItemId(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">-- Choose inventory item --</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (In Stock: {item.currentStock} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Wasted Quantity:
                </label>
                <NumberInput
                  min={0.1}
                  emptyValue={1}
                  value={wasteQty}
                  onValueChange={(val) => setWasteQty(val)}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Wastage Reason:
                </label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Burnt / Spoiled during preparation">Burnt / Spoiled during preparation</option>
                  <option value="Expired ingredient discarded">Expired ingredient discarded</option>
                  <option value="Cancelled customer order leftover">Cancelled customer order leftover</option>
                  <option value="Dropped / Contaminated accident">Dropped / Contaminated accident</option>
                  <option value="Quality testing / Tasting portion">Quality testing / Tasting portion</option>
                </select>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 -mx-5 -mb-5 mt-4">
                <button
                  type="button"
                  onClick={() => setShowWasteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors shadow-xs"
                >
                  Save Waste Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* KOT PRINT MODAL (Direct thermal slip matching video 00:12) */}
      {/* ========================================================= */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-300">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between print:hidden">
              <span className="text-xs font-bold text-slate-800">Print Kitchen Ticket (KOT)</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1"
                >
                  <Printer className="h-3 w-3" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setPrintingOrder(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Thermal Print Area */}
            <div id="printable-receipt" className="p-5 font-mono text-xs bg-white text-black selection:bg-slate-200">
              <div className="text-center pb-2">
                <h2 className="text-lg font-black tracking-widest uppercase">KOT</h2>
                <p className="text-xs font-bold uppercase">{businessName}</p>
                <p className="text-[10px] text-slate-600 italic">REPRINT</p>
              </div>

              <div className="border-b border-dashed border-black my-1.5" />

              <div className="space-y-0.5 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>KOT No: {printingOrder.kotNo || 'KOT-1'}</span>
                  <span>Order: #{printingOrder.invoiceNo || printingOrder.id.slice(0, 6)}</span>
                </div>
                <div className="flex justify-between font-black text-sm">
                  <span>Table: {printingOrder.tableRoomName || 'Counter'}</span>
                  <span className="uppercase text-xs">{printingOrder.orderType}</span>
                </div>
                <div className="text-[10px] text-slate-700">
                  {formatReceiptNepaliDate(printingOrder.kotSentAt || printingOrder.createdAt)}
                </div>
                {printingOrder.waiterName && (
                  <div className="text-[10px] text-slate-800">
                    Waiter: {printingOrder.waiterName}
                  </div>
                )}
              </div>

              <div className="border-b border-dashed border-black my-1.5" />

              <div className="grid grid-cols-12 font-bold text-[11px] pb-1">
                <span className="col-span-2">SN</span>
                <span className="col-span-8">ITEM</span>
                <span className="col-span-2 text-right">QTY</span>
              </div>

              <div className="space-y-1 text-[11px]">
                {printingOrder.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-start py-0.5">
                    <span className="col-span-2 text-slate-600">{idx + 1}</span>
                    <div className="col-span-8 pr-1">
                      <p className="font-bold text-black uppercase leading-tight">{item.name}</p>
                      {item.selectedVariant && (
                        <p className="text-[10px] text-slate-600">({item.selectedVariant.name})</p>
                      )}
                      {item.notes && (
                        <p className="text-[10px] font-bold italic text-slate-700">*{item.notes}</p>
                      )}
                    </div>
                    <span className="col-span-2 text-right font-black text-black text-sm">
                      {item.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-black my-2" />

              <div className="flex justify-between font-black text-xs">
                <span>Total Items:</span>
                <span>{printingOrder.items.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>

              {printingOrder.specialInstructions && (
                <div className="mt-2 pt-1 border-t border-dotted border-slate-400 text-[10px] italic">
                  Note: {printingOrder.specialInstructions}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 print:hidden">
              <button
                onClick={() => setPrintingOrder(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
