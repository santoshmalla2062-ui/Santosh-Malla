import React, { useState } from 'react';
import { NumberInput } from '../common/NumberInput';
import { 
  Building, 
  UtensilsCrossed, 
  Hotel, 
  CheckCircle, 
  Clock, 
  User, 
  Phone, 
  Plus, 
  Sparkles, 
  DoorOpen, 
  X,
  CreditCard,
  ArrowRightLeft,
  Merge,
  Split,
  Eye,
  AlertCircle,
  Wrench,
  Receipt,
  UserCheck,
  Edit2,
  Trash2,
  Printer,
  ShieldAlert,
  Search,
  MoreHorizontal,
  ShoppingBag,
  Truck,
  ArrowRight,
  Check,
  SlidersHorizontal,
  QrCode
} from 'lucide-react';
import { BusinessSettings, Order, Session, TableRoom, TableRoomStatus, TableRoomType } from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { hasPermission, validateRoomCheckIn } from '../../services/security';
import { formatElapsedTime } from '../../utils/timeUtils';
import {
  addBusinessArea,
  deriveBusinessTableAreas,
  removeBusinessArea,
  renameBusinessArea,
  resolveTableArea
} from '../../services/tableAreas';
import { ReceiptModal } from '../pos/ReceiptModal';
import { ActiveOrdersModal } from '../pos/ActiveOrdersModal';

interface TableRoomViewProps {
  tablesRooms: TableRoom[];
  orders: Order[];
  settings: BusinessSettings;
  lang: Language;
  currentSession?: Session | null;
  onUpdateStatus: (id: string, status: TableRoomStatus, guestName?: string, guestPhone?: string) => void;
  onSelectTableForPOS: (tableRoomId: string) => void;
  onOpenCheckoutForOrder?: (order: Order) => void;
  onStartQuickOrderType?: (type: 'takeaway' | 'delivery') => void;
  onAddTableRoom: (newEntity: TableRoom) => void;
  onUpdateTableRoom?: (updatedTable: TableRoom) => void;
  onDeleteTableRoom?: (tableId: string) => void;
  onUpdateTableAreas?: (areas: string[], updatedTables?: TableRoom[]) => void;
  onShiftTableOrder?: (fromTableId: string, toTableId: string) => void;
  onMergeTables?: (sourceTableId: string, targetTableId: string) => void;
  onAssignWaiter?: (tableId: string, waiterId: string, waiterName: string) => void;
  onNavigateToResort?: () => void;
  onVoidOrder?: (orderId: string, reason: string) => void;
  onVoidOrderItem?: (orderId: string, itemIndex: number, reason: string) => void;
  onAdminUpdatePricing?: (orderId: string, update: { discountPercent?: number; waiveServiceCharge?: boolean; waiveVat?: boolean; notes?: string }) => void;
  onForceReleaseTable?: (tableId: string) => void;
  onOpenDigitalMenuQR?: () => void;
}

export const TableRoomView: React.FC<TableRoomViewProps> = ({
  tablesRooms,
  orders,
  settings,
  lang,
  currentSession,
  onUpdateStatus,
  onSelectTableForPOS,
  onOpenCheckoutForOrder,
  onStartQuickOrderType,
  onAddTableRoom,
  onUpdateTableRoom,
  onDeleteTableRoom,
  onUpdateTableAreas,
  onShiftTableOrder,
  onMergeTables,
  onAssignWaiter,
  onNavigateToResort,
  onVoidOrder,
  onVoidOrderItem,
  onAdminUpdatePricing,
  onForceReleaseTable,
  onOpenDigitalMenuQR
}) => {
  const t = TRANSLATIONS[lang];
  const userRole = currentSession?.role;
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER';
  const [printEstimateOrder, setPrintEstimateOrder] = useState<Order | null>(null);
  const [showActiveOrdersModal, setShowActiveOrdersModal] = useState(false);

  // Dynamic customizable business floor areas
  const availableAreas = React.useMemo(
    () => deriveBusinessTableAreas(tablesRooms, settings.tableAreas),
    [tablesRooms, settings.tableAreas]
  );

  // Filter dining tables cleanly
  const [diningSectionFilter, setDiningSectionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<TableRoomStatus | 'all'>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  // Area Management Modal state
  const [showManageAreasModal, setShowManageAreasModal] = useState(false);
  const [newAreaInput, setNewAreaInput] = useState('');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [renamingAreaTarget, setRenamingAreaTarget] = useState<string | null>(null);
  const [renameAreaValue, setRenameAreaValue] = useState('');
  const [confirmDeleteAreaName, setConfirmDeleteAreaName] = useState<string | null>(null);

  // Clean Table Action Sheet state (secondary operations tucked out of cards)
  const [actionSheetTable, setActionSheetTable] = useState<TableRoom | null>(null);
  const [confirmForceFreeId, setConfirmForceFreeId] = useState<string | null>(null);
  const [confirmSheetDeleteId, setConfirmSheetDeleteId] = useState<string | null>(null);
  const [sheetActionError, setSheetActionError] = useState<string | null>(null);
  const [voidModalTarget, setVoidModalTarget] = useState<Order | null>(null);
  const [voidModalReason, setVoidModalReason] = useState('Customer cancelled / अर्डर रद्द');

  // Check-in modal
  const [checkInModalTarget, setCheckInModalTarget] = useState<TableRoom | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [nightsCount, setNightsCount] = useState(1);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  // Add new table or room modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newNepaliName, setNewNepaliName] = useState('');
  const [newType, setNewType] = useState<TableRoomType>('table');
  const [newArea, setNewArea] = useState<string>('');
  const [newCustomArea, setNewCustomArea] = useState<string>('');
  const [newCapacity, setNewCapacity] = useState(4);
  const [newRate, setNewRate] = useState(3500);

  // View Active Order Modal
  const [viewOrderTarget, setViewOrderTarget] = useState<{ table: TableRoom; order: Order } | null>(null);

  // Transfer Table Modal
  const [transferTarget, setTransferTarget] = useState<TableRoom | null>(null);
  const [destinationTableId, setDestinationTableId] = useState<string>('');

  // Merge Tables Modal
  const [mergeTarget, setMergeTarget] = useState<TableRoom | null>(null);
  const [mergeIntoTableId, setMergeIntoTableId] = useState<string>('');

  // Split Bill Modal
  const [splitBillTarget, setSplitBillTarget] = useState<{ table: TableRoom; order: Order } | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);

  // Assign Waiter Modal
  const [assignWaiterTarget, setAssignWaiterTarget] = useState<TableRoom | null>(null);
  const [selectedWaiterName, setSelectedWaiterName] = useState<string>('');

  // Available Waiter options
  const defaultWaiters = [
    { id: 'w-1', name: 'Bikash Tamang (Senior Waiter)' },
    { id: 'w-2', name: 'Pooja Sharma (Cafe Server)' },
    { id: 'w-3', name: 'Sunil Gurung (Terrace Waiter)' },
    { id: 'w-4', name: 'Aashish Thapa (Captain)' }
  ];

  // Edit Table Modal
  const [editingTableTarget, setEditingTableTarget] = useState<TableRoom | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editNepaliName, setEditNepaliName] = useState('');
  const [editCapacity, setEditCapacity] = useState(4);
  const [editType, setEditType] = useState<TableRoomType>('table');
  const [editArea, setEditArea] = useState('');
  const [editCustomArea, setEditCustomArea] = useState('');
  const [editRate, setEditRate] = useState(3500);
  const [editStatus, setEditStatus] = useState<TableRoomStatus>('available');
  const [editTableError, setEditTableError] = useState<string | null>(null);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState(false);

  const handleStartEditTable = (table: TableRoom) => {
    setEditingTableTarget(table);
    setEditCode(table.code);
    setEditName(table.name);
    setEditNepaliName(table.nepaliName || '');
    setEditCapacity(table.capacity || 4);
    setEditType(table.type || 'table');
    setEditArea(resolveTableArea(table));
    setEditCustomArea('');
    setEditRate(table.ratePerNight || 3500);
    setEditStatus(table.status);
    setEditTableError(null);
    setConfirmDeleteTable(false);
  };

  const handleSaveEditTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTableTarget || !editName.trim() || !editCode.trim()) return;
    const resolvedArea = editArea === '__custom__' ? editCustomArea.trim() : editArea.trim();
    if (resolvedArea && !availableAreas.some(a => a.toLowerCase() === resolvedArea.toLowerCase())) {
      const added = addBusinessArea(availableAreas, resolvedArea);
      if (!added.error) {
        onUpdateTableAreas?.(added.areas);
      }
    }
    const updated: TableRoom = {
      ...editingTableTarget,
      code: editCode.trim(),
      name: editName.trim(),
      nepaliName: editNepaliName.trim() || editName.trim(),
      area: resolvedArea || undefined,
      capacity: Number(editCapacity) || 4,
      type: editType,
      ratePerNight: (editType === 'room' || editType === 'cottage') ? Number(editRate) : undefined,
      status: editStatus
    };
    onUpdateTableRoom?.(updated);
    setEditingTableTarget(null);
  };

  const handleDeleteTable = (tableId: string) => {
    const table = tablesRooms.find(t => t.id === tableId);
    if (!table) return;
    const activeOrder = orders.find(o => o.tableRoomId === tableId && o.status === 'active');
    if (activeOrder) {
      setEditTableError(lang === 'ne' ? 'सक्रिय अर्डर भएको टेबल मेटाउन सकिँदैन।' : 'Cannot delete table with an active running order.');
      setConfirmDeleteTable(false);
      return;
    }
    if (!confirmDeleteTable) {
      setEditTableError(null);
      setConfirmDeleteTable(true);
      return;
    }
    setEditTableError(null);
    setConfirmDeleteTable(false);
    onDeleteTableRoom?.(tableId);
    setEditingTableTarget(null);
  };

  // Isolate dining tables (exclude rooms/cottages to keep table and room management separate)
  const diningTables = tablesRooms.filter(item => item.type === 'table' || item.type === 'takeaway');

  const activeDiningOrders = orders.filter(
    o => o.status === 'active' && o.kotStatus !== 'cancelled'
  );

  const filteredList = diningTables.filter(item => {
    const activeOrder = activeDiningOrders.find(o => o.tableRoomId === item.id);
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    const nameLower = (item.name + ' ' + (item.nepaliName || '')).toLowerCase();
    const resolvedArea = resolveTableArea(item);
    if (diningSectionFilter !== 'all' && resolvedArea.toLowerCase() !== diningSectionFilter.toLowerCase()) {
      return false;
    }
    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.toLowerCase();
      const matchCode = item.code.toLowerCase().includes(q);
      const matchName = nameLower.includes(q);
      const matchArea = resolvedArea.toLowerCase().includes(q);
      const matchWaiter = (item.assignedWaiterName || activeOrder?.waiterName || '').toLowerCase().includes(q);
      const matchGuest = (item.guestName || activeOrder?.customerName || '').toLowerCase().includes(q);
      if (!matchCode && !matchName && !matchArea && !matchWaiter && !matchGuest) return false;
    }
    return true;
  });

  const getStatusCardStyle = (status: TableRoomStatus, hasActiveOrder: boolean) => {
    if (status === 'waiting_for_bill') {
      return 'border-rose-300 bg-rose-50/40 text-slate-900';
    }
    if (status === 'occupied' || hasActiveOrder) {
      return 'border-amber-300 bg-amber-50/35 text-slate-900';
    }
    switch (status) {
      case 'available':
        return 'border-slate-200 bg-white hover:border-emerald-400 text-slate-900';
      case 'reserved':
        return 'border-indigo-200 bg-indigo-50/30 text-slate-900';
      case 'cleaning':
        return 'border-purple-200 bg-purple-50/30 text-slate-900';
      case 'out_of_service':
        return 'border-slate-300 bg-slate-100/70 text-slate-600 border-dashed';
      default:
        return 'border-slate-200 bg-white text-slate-900';
    }
  };

  const getStatusDot = (status: TableRoomStatus) => {
    switch (status) {
      case 'available': return 'bg-emerald-500';
      case 'occupied': return 'bg-amber-500';
      case 'reserved': return 'bg-indigo-500';
      case 'waiting_for_bill': return 'bg-rose-500';
      case 'cleaning': return 'bg-purple-500';
      case 'out_of_service': return 'bg-slate-400';
    }
  };

  const getStatusLabel = (status: TableRoomStatus) => {
    switch (status) {
      case 'available': return lang === 'ne' ? 'खाली' : 'Available';
      case 'occupied': return lang === 'ne' ? 'व्यस्त' : 'Occupied';
      case 'reserved': return lang === 'ne' ? 'रिजर्भ' : 'Reserved';
      case 'waiting_for_bill': return lang === 'ne' ? 'बिल माग्दै' : 'Bill Ready';
      case 'cleaning': return lang === 'ne' ? 'सफाई हुँदै' : 'Cleaning';
      case 'out_of_service': return lang === 'ne' ? 'बन्द' : 'Out of Service';
    }
  };

  const formatTableElapsed = (createdAt?: string) => {
    if (!createdAt) return 'Just now';
    return formatElapsedTime(createdAt);
  };

  const handleOpenCheckIn = (item: TableRoom) => {
    setCheckInModalTarget(item);
    setCheckInError(null);
    setGuestName('');
    setGuestPhone('');
    setGuestAddress('');
    setNightsCount(1);
  };

  const handleConfirmCheckIn = () => {
    if (!checkInModalTarget) return;
    const validation = validateRoomCheckIn(checkInModalTarget, guestName);
    if (!validation.isValid) {
      setCheckInError(validation.error || 'Invalid check-in details');
      return;
    }
    onUpdateStatus(checkInModalTarget.id, 'occupied', guestName.trim(), guestPhone.trim());
    setCheckInModalTarget(null);
    setCheckInError(null);
  };

  const handleConfirmTransfer = () => {
    if (!transferTarget || !destinationTableId || !onShiftTableOrder) return;
    onShiftTableOrder(transferTarget.id, destinationTableId);
    setTransferTarget(null);
    setDestinationTableId('');
  };

  const handleConfirmMerge = () => {
    if (!mergeTarget || !mergeIntoTableId || !onMergeTables) return;
    onMergeTables(mergeTarget.id, mergeIntoTableId);
    setMergeTarget(null);
    setMergeIntoTableId('');
  };

  const handleConfirmAssignWaiter = () => {
    if (!assignWaiterTarget || !selectedWaiterName || !onAssignWaiter) return;
    const waiter = defaultWaiters.find(w => w.name === selectedWaiterName);
    onAssignWaiter(assignWaiterTarget.id, waiter?.id || 'w-custom', selectedWaiterName);
    setAssignWaiterTarget(null);
  };

  const handleCreateNewEntity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    const pickedArea = newArea === '__custom__' ? newCustomArea.trim() : newArea.trim();
    const resolvedArea = pickedArea || (diningSectionFilter !== 'all' ? diningSectionFilter : availableAreas[0] || 'Main Hall');

    if (newType === 'table' && resolvedArea && !availableAreas.some(a => a.toLowerCase() === resolvedArea.toLowerCase())) {
      const added = addBusinessArea(availableAreas, resolvedArea);
      if (!added.error) {
        onUpdateTableAreas?.(added.areas);
      }
    }

    const newEntity: TableRoom = {
      id: 'tr-' + Date.now(),
      code: newCode.trim(),
      name: newName.trim(),
      nepaliName: newNepaliName.trim() || newName.trim(),
      type: newType,
      area: newType === 'table' ? resolvedArea : undefined,
      capacity: newCapacity,
      status: 'available',
      ratePerNight: (newType === 'room' || newType === 'cottage') ? newRate : undefined
    };

    onAddTableRoom(newEntity);
    setShowAddModal(false);
    setNewCode('');
    setNewName('');
    setNewNepaliName('');
    setNewCustomArea('');
  };

  const availableCount = diningTables.filter(t => t.status === 'available').length;
  const occupiedCount = diningTables.filter(t => t.status === 'occupied' || activeDiningOrders.some(o => o.tableRoomId === t.id)).length;
  const waitingBillCount = diningTables.filter(t => t.status === 'waiting_for_bill').length;
  const reservedCount = diningTables.filter(t => t.status === 'reserved').length;

  const selectedTable = diningTables.find(t => t.id === selectedTableId) || null;
  const selectedTableOrder = selectedTable ? activeDiningOrders.find(o => o.tableRoomId === selectedTable.id) : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-36 md:pb-24 space-y-4">
      {/* 3 Quick Service Mode Selector Cards (Dine in / Takeaway / Delivery) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
          }}
          className="text-left p-3 sm:p-3.5 rounded-2xl border-2 border-orange-500 bg-orange-50/45 shadow-2xs transition-all flex items-center gap-2.5 min-h-[58px]"
        >
          <div className="h-9 w-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate">
              {lang === 'ne' ? 'डाइन-इन' : 'Dine in'}
            </p>
            <p className="text-[11px] font-semibold text-orange-700 tabular-nums truncate">
              {availableCount} {lang === 'ne' ? 'खाली' : 'free'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStartQuickOrderType?.('takeaway')}
          className="text-left p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-orange-400 hover:bg-orange-50/25 shadow-2xs transition-all flex items-center gap-2.5 min-h-[58px]"
        >
          <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
              {lang === 'ne' ? 'टेकअवे' : 'Takeaway'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {lang === 'ne' ? 'प्याकिङ अर्डर' : 'Counter pickup'}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStartQuickOrderType?.('delivery')}
          className="text-left p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-orange-400 hover:bg-orange-50/25 shadow-2xs transition-all flex items-center gap-2.5 min-h-[58px]"
        >
          <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
              {lang === 'ne' ? 'डेलिभरी' : 'Delivery'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {lang === 'ne' ? 'घर पठाउने' : 'Dispatch rider'}
            </p>
          </div>
        </button>
      </div>

      {/* Clean Header Bar: Tables + Live Bills + Add Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {lang === 'ne' ? 'टेबल छान्नुहोस्' : 'Tables'}
              </h2>
              {onNavigateToResort && (
                <button
                  type="button"
                  onClick={onNavigateToResort}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap"
                >
                  <Hotel className="h-3.5 w-3.5" />
                  <span>{lang === 'ne' ? 'रिसोर्ट कोठाहरू →' : 'Rooms & Resort →'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'ne'
                ? 'टेबल छान्नुहोस् र तलको Select Table बटनमा थिच्नुहोस् (वा दोहोरो ट्याप गर्नुहोस्)'
                : 'Tap to highlight a table or double-tap to start ordering immediately'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenDigitalMenuQR && (
              <button
                type="button"
                onClick={onOpenDigitalMenuQR}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors whitespace-nowrap min-h-[40px]"
                title={lang === 'ne' ? 'टेबल QR डिजिटल मेनु' : 'Table QR Digital Menu'}
              >
                <QrCode className="h-3.5 w-3.5 text-slate-700" />
                <span>{lang === 'ne' ? 'QR मेनु' : 'QR Menu'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowActiveOrdersModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded-xl transition-colors whitespace-nowrap min-h-[40px]"
            >
              <Receipt className="h-3.5 w-3.5" />
              <span className="tabular-nums">
                {lang === 'ne' ? `चालु बिल (${activeDiningOrders.length})` : `Live Bills (${activeDiningOrders.length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewArea(diningSectionFilter !== 'all' ? diningSectionFilter : (availableAreas[0] || 'Main Hall'));
                setNewCustomArea('');
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors whitespace-nowrap min-h-[40px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{lang === 'ne' ? 'नयाँ टेबल' : 'Add Table'}</span>
            </button>
          </div>
        </div>

        {/* Search + Dynamic Business Floor Areas Filter & Manage Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              placeholder={lang === 'ne' ? 'टेबल, एरिया वा वेटर खोज्नुहोस्...' : 'Search table, area, guest, waiter...'}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
            {tableSearchQuery && (
              <button
                type="button"
                onClick={() => setTableSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            <button
              type="button"
              onClick={() => setDiningSectionFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                diningSectionFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {lang === 'ne' ? 'सबै एरिया' : 'All Areas'}
            </button>
            {availableAreas.map((areaName) => (
              <button
                key={areaName}
                type="button"
                onClick={() => setDiningSectionFilter(areaName)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  diningSectionFilter.toLowerCase() === areaName.toLowerCase()
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {areaName}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAreaError(null);
                setNewAreaInput('');
                setRenamingAreaTarget(null);
                setConfirmDeleteAreaName(null);
                setShowManageAreasModal(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 border border-dashed border-slate-300 text-slate-700 hover:border-slate-900 hover:bg-slate-50 transition-colors"
              title={lang === 'ne' ? 'एरिया थप्नुहोस्, परिवर्तन गर्नुहोस् वा हटाउनुहोस्' : 'Add, rename, or remove floor areas'}
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>{lang === 'ne' ? 'एरिया व्यवस्थापन' : 'Manage Areas'}</span>
            </button>
          </div>
        </div>

        {/* Clean Typographic Status Filter Strip (Zero Pill Clutter) */}
        <div className="flex items-center gap-3 sm:gap-5 overflow-x-auto scrollbar-none text-xs pt-1 text-slate-600">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`whitespace-nowrap pb-1 border-b-2 transition-colors tabular-nums ${
              statusFilter === 'all' ? 'border-slate-900 text-slate-900 font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            {lang === 'ne' ? `सबै ${diningTables.length}` : `All ${diningTables.length}`}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('available')}
            className={`whitespace-nowrap pb-1 border-b-2 transition-colors flex items-center gap-1.5 tabular-nums ${
              statusFilter === 'available' ? 'border-emerald-600 text-emerald-800 font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span>{lang === 'ne' ? `खाली ${availableCount}` : `Available ${availableCount}`}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('occupied')}
            className={`whitespace-nowrap pb-1 border-b-2 transition-colors flex items-center gap-1.5 tabular-nums ${
              statusFilter === 'occupied' ? 'border-amber-600 text-amber-900 font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
            <span>{lang === 'ne' ? `व्यस्त ${occupiedCount}` : `Occupied ${occupiedCount}`}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('waiting_for_bill')}
            className={`whitespace-nowrap pb-1 border-b-2 transition-colors flex items-center gap-1.5 tabular-nums ${
              statusFilter === 'waiting_for_bill' ? 'border-rose-600 text-rose-800 font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <span>{lang === 'ne' ? `बिल माग्दै ${waitingBillCount}` : `Waiting Bill ${waitingBillCount}`}</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('reserved')}
            className={`whitespace-nowrap pb-1 border-b-2 transition-colors flex items-center gap-1.5 tabular-nums ${
              statusFilter === 'reserved' ? 'border-indigo-600 text-indigo-800 font-bold' : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
            <span>{lang === 'ne' ? `रिजर्भ ${reservedCount}` : `Reserved ${reservedCount}`}</span>
          </button>
        </div>
      </div>

      {/* Uncluttered Hospitality Table Cards */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">
            {lang === 'ne' ? 'कुनै टेबल भेटिएन' : 'No tables match your filter'}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setDiningSectionFilter('all');
              setTableSearchQuery('');
            }}
            className="text-xs font-bold text-emerald-700 hover:underline"
          >
            {lang === 'ne' ? 'फिल्टर हटाउनुहोस्' : 'Reset filters'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredList.map((item) => {
            const isResort = item.type === 'room' || item.type === 'cottage';
            const activeOrder = activeDiningOrders.find(o => o.tableRoomId === item.id);
            const isSelected = selectedTableId === item.id;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedTableId(prev => prev === item.id ? null : item.id)}
                onDoubleClick={() => onSelectTableForPOS(item.id)}
                className={`rounded-2xl border p-3.5 sm:p-4 transition-all flex flex-col justify-between gap-2.5 shadow-2xs cursor-pointer select-none ${
                  isSelected
                    ? 'border-orange-500 ring-2 ring-orange-500/25 bg-orange-50/25 text-slate-900'
                    : getStatusCardStyle(item.status, Boolean(activeOrder))
                }`}
              >
                {/* Top Meta Line + Selection Check / Overflow Button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono-num font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                        {item.code}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                        <span className={`h-2 w-2 rounded-full ${getStatusDot(item.status)} shrink-0`} />
                        <span>{getStatusLabel(item.status)}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && (
                        <span className="h-5 w-5 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmForceFreeId(null);
                          setConfirmSheetDeleteId(null);
                          setSheetActionError(null);
                          setActionSheetTable(item);
                        }}
                        className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title={lang === 'ne' ? 'थप विकल्पहरू' : 'Table options'}
                        aria-label={`Table actions for ${item.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Table Name & Seat / Area Metadata */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-snug truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 truncate tabular-nums">
                      {activeOrder?.customerName || item.guestName
                        ? `${activeOrder?.customerName || item.guestName} · ${item.capacity} seats`
                        : `${item.capacity} ${lang === 'ne' ? 'सिट' : item.capacity === 1 ? 'seat' : 'seats'} · ${resolveTableArea(item)}`}
                    </p>
                  </div>

                  {/* Clean Live Order Status Strip OR Available Prompt */}
                  {activeOrder ? (
                    <div className="pt-2 border-t border-black/5 flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-600 truncate tabular-nums">
                        {activeOrder.items.reduce((s, i) => s + i.quantity, 0)} items · {formatTableElapsed(activeOrder.kotSentAt || activeOrder.createdAt)}
                      </span>
                      <span className="font-mono-num font-black text-sm sm:text-base text-slate-950 shrink-0 tabular-nums">
                        {settings.currencySymbol} {activeOrder.grandTotal.toFixed(0)}
                      </span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{lang === 'ne' ? 'अर्डरको लागि तयार' : 'Tap to select'}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Clean 1-Row Primary Actions */}
                <div className="flex items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                  {activeOrder ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectTableForPOS(item.id)}
                        className="flex-1 min-h-[38px] px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        {lang === 'ne' ? 'थप्नुहोस्' : 'Order'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenCheckoutForOrder) {
                            onOpenCheckoutForOrder(activeOrder);
                          } else {
                            setViewOrderTarget({ table: item, order: activeOrder });
                          }
                        }}
                        className="flex-1 min-h-[38px] px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                      >
                        {lang === 'ne' ? 'बिल' : 'Bill'}
                      </button>
                    </>
                  ) : item.status === 'available' && isResort ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCheckIn(item)}
                      className="w-full min-h-[38px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      {t.checkIn}
                    </button>
                  ) : item.status === 'cleaning' ? (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(item.id, 'available')}
                      className="w-full min-h-[38px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      {lang === 'ne' ? 'सफा भयो — खाली गर्नुहोस्' : 'Mark Ready'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectTableForPOS(item.id)}
                      className="w-full min-h-[38px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      {lang === 'ne' ? 'अर्डर लिनुहोस्' : 'Take Order'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Table Selection Bar */}
      {selectedTable && (
        <div className="fixed bottom-[4.15rem] md:bottom-4 inset-x-3 sm:inset-x-6 lg:left-72 z-30 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-3.5 py-2.5 shadow-xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-150">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-black text-slate-900 truncate tabular-nums">
              {selectedTable.code} · {selectedTable.name}
            </p>
            <p className="text-[11px] font-medium text-slate-500 truncate tabular-nums">
              {selectedTable.capacity} {lang === 'ne' ? 'सिट' : selectedTable.capacity === 1 ? 'seat' : 'seats'}
              {selectedTableOrder ? ` · Open ${settings.currencySymbol} ${selectedTableOrder.grandTotal.toFixed(0)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedTableId(null)}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold whitespace-nowrap"
            >
              {lang === 'ne' ? 'हटाउनुहोस्' : 'Clear'}
            </button>
            {selectedTableOrder && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenCheckoutForOrder) {
                    onOpenCheckoutForOrder(selectedTableOrder);
                  } else {
                    setViewOrderTarget({ table: selectedTable, order: selectedTableOrder });
                  }
                }}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold whitespace-nowrap"
              >
                {lang === 'ne' ? 'बिल' : 'Bill'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectTableForPOS(selectedTable.id)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black whitespace-nowrap shadow-xs inline-flex items-center gap-1.5"
            >
              <span>{selectedTableOrder ? (lang === 'ne' ? 'अर्डर खोल्नुहोस्' : 'Open Order') : (lang === 'ne' ? 'टेबल छान्नुहोस्' : 'Select Table')}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* TABLE ACTION OVERFLOW MODAL SHEET */}
      {actionSheetTable && (() => {
        const sheetOrder = activeDiningOrders.find(o => o.tableRoomId === actionSheetTable.id);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4"
            onClick={() => setActionSheetTable(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {actionSheetTable.code} · {actionSheetTable.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {getStatusLabel(actionSheetTable.status)}
                    {sheetOrder ? ` · ${sheetOrder.invoiceNo} (${settings.currencySymbol}${sheetOrder.grandTotal.toFixed(0)})` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActionSheetTable(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs max-h-[75vh] overflow-y-auto">
                {sheetOrder && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {lang === 'ne' ? 'अर्डर र बिल कार्य' : 'Active Order Actions'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ord = sheetOrder;
                          setActionSheetTable(null);
                          if (onOpenCheckoutForOrder) onOpenCheckoutForOrder(ord);
                          else setViewOrderTarget({ table: actionSheetTable, order: ord });
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold border border-emerald-200"
                      >
                        <CreditCard className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span>{lang === 'ne' ? 'बिल चुक्ता' : 'Settle Bill'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const ord = sheetOrder;
                          setActionSheetTable(null);
                          setPrintEstimateOrder(ord);
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold border border-amber-200"
                      >
                        <Printer className="h-4 w-4 text-amber-700 shrink-0" />
                        <span>{lang === 'ne' ? 'कच्चा बिल' : 'Estimate Slip'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const tbl = actionSheetTable;
                          setActionSheetTable(null);
                          setTransferTarget(tbl);
                          setDestinationTableId('');
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
                      >
                        <ArrowRightLeft className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>{lang === 'ne' ? 'टेबल सार्नुहोस्' : 'Transfer'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const tbl = actionSheetTable;
                          setActionSheetTable(null);
                          setMergeTarget(tbl);
                          setMergeIntoTableId('');
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
                      >
                        <Merge className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>{lang === 'ne' ? 'मर्ज गर्नुहोस्' : 'Merge'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const tbl = actionSheetTable;
                          const ord = sheetOrder;
                          setActionSheetTable(null);
                          setSplitBillTarget({ table: tbl, order: ord });
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
                      >
                        <Split className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>{lang === 'ne' ? 'बिल बाँड्ने' : 'Split Bill'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const tbl = actionSheetTable;
                          const ord = sheetOrder;
                          setActionSheetTable(null);
                          setViewOrderTarget({ table: tbl, order: ord });
                        }}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
                      >
                        <Eye className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>{lang === 'ne' ? 'विवरण हेर्नुहोस्' : 'View Items'}</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {lang === 'ne' ? 'व्यवस्थापन र स्थिति' : 'Table Status & Assignment'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const tbl = actionSheetTable;
                        setActionSheetTable(null);
                        setAssignWaiterTarget(tbl);
                        setSelectedWaiterName(tbl.assignedWaiterName || defaultWaiters[0].name);
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
                    >
                      <UserCheck className="h-4 w-4 text-slate-500 shrink-0" />
                      <span className="truncate">{actionSheetTable.assignedWaiterName ? actionSheetTable.assignedWaiterName.split(' (')[0] : 'Assign Waiter'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const tbl = actionSheetTable;
                        setActionSheetTable(null);
                        handleStartEditTable(tbl);
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold border border-slate-200"
                    >
                      <Edit2 className="h-4 w-4 text-slate-500 shrink-0" />
                      <span>{lang === 'ne' ? 'टेबल सम्पादन' : 'Edit Table'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {actionSheetTable.status !== 'available' && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateStatus(actionSheetTable.id, 'available');
                          setActionSheetTable(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200"
                      >
                        Mark Free
                      </button>
                    )}
                    {actionSheetTable.status !== 'reserved' && !sheetOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateStatus(actionSheetTable.id, 'reserved');
                          setActionSheetTable(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold border border-indigo-200"
                      >
                        Reserve
                      </button>
                    )}
                    {actionSheetTable.status !== 'cleaning' && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateStatus(actionSheetTable.id, 'cleaning');
                          setActionSheetTable(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold border border-purple-200"
                      >
                        Cleaning
                      </button>
                    )}
                    {actionSheetTable.status !== 'waiting_for_bill' && sheetOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateStatus(actionSheetTable.id, 'waiting_for_bill');
                          setActionSheetTable(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold border border-rose-200"
                      >
                        Mark Bill Ready
                      </button>
                    )}
                    {actionSheetTable.status !== 'out_of_service' && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateStatus(actionSheetTable.id, 'out_of_service');
                          setActionSheetTable(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200"
                      >
                        Out of Service
                      </button>
                    )}
                  </div>
                </div>

                {(isAdminOrManager && (sheetOrder || actionSheetTable.status !== 'available')) && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                    {sheetOrder && onVoidOrder && (
                      <button
                        type="button"
                        onClick={() => {
                          const ord = sheetOrder;
                          setActionSheetTable(null);
                          setVoidModalTarget(ord);
                          setVoidModalReason('Customer cancelled / अर्डर रद्द');
                        }}
                        className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200"
                      >
                        {lang === 'ne' ? 'अर्डर रद्द (Void)' : 'Void Order'}
                      </button>
                    )}
                    {onForceReleaseTable && actionSheetTable.status !== 'available' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmForceFreeId === actionSheetTable.id) {
                            onForceReleaseTable(actionSheetTable.id);
                            setConfirmForceFreeId(null);
                            setActionSheetTable(null);
                          } else {
                            setConfirmForceFreeId(actionSheetTable.id);
                          }
                        }}
                        className={`px-3 py-2 rounded-lg font-bold border transition-colors ${
                          confirmForceFreeId === actionSheetTable.id
                            ? 'bg-rose-600 text-white border-rose-700'
                            : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                        }`}
                      >
                        {confirmForceFreeId === actionSheetTable.id
                          ? (lang === 'ne' ? 'पक्का खाली गर्ने?' : 'Tap again to Force Free')
                          : (lang === 'ne' ? 'जबरजस्ती खाली (Force Free)' : 'Force Free Table')}
                      </button>
                    )}
                  </div>
                )}

                {/* Direct Delete Table Action inside Action Sheet */}
                {onDeleteTableRoom && (
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    {sheetActionError && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold text-[11px] flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{sheetActionError}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (sheetOrder) {
                          setSheetActionError(
                            lang === 'ne'
                              ? 'सक्रिय अर्डर भएको टेबल मेटाउन पहिले बिल चुक्ता वा रद्द गर्नुहोस्।'
                              : 'Settle or void the active order before deleting this table.'
                          );
                          return;
                        }
                        if (confirmSheetDeleteId === actionSheetTable.id) {
                          const targetId = actionSheetTable.id;
                          setConfirmSheetDeleteId(null);
                          setSheetActionError(null);
                          setActionSheetTable(null);
                          if (selectedTableId === targetId) {
                            setSelectedTableId(null);
                          }
                          onDeleteTableRoom(targetId);
                        } else {
                          setSheetActionError(null);
                          setConfirmSheetDeleteId(actionSheetTable.id);
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold border transition-colors ${
                        sheetOrder
                          ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                          : confirmSheetDeleteId === actionSheetTable.id
                            ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                            : 'bg-rose-50/70 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      <span>
                        {confirmSheetDeleteId === actionSheetTable.id
                          ? (lang === 'ne' ? 'पक्का मेटाउने हो? फेरि थिच्नुहोस्' : 'Tap again to Confirm Delete')
                          : (lang === 'ne' ? 'यो टेबल हटाउनुहोस् (Delete Table)' : 'Delete Table')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* CLEAN VOID ORDER REASON MODAL (replaces native prompt) */}
      {voidModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-rose-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'ne' ? 'अर्डर रद्द गर्नुहोस्' : 'Void Active Order'}
              </h3>
              <button type="button" onClick={() => setVoidModalTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-slate-600 font-semibold">
                {voidModalTarget.tableRoomName} · {voidModalTarget.invoiceNo} ({settings.currencySymbol}{voidModalTarget.grandTotal.toFixed(0)})
              </p>
              <select
                value={voidModalReason}
                onChange={(e) => setVoidModalReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
              >
                <option value="Customer cancelled / अर्डर रद्द">Customer cancelled / ग्राहकले रद्द गरे</option>
                <option value="Mistake entry / गल्ती प्रविष्टि">Mistake entry / गल्ती प्रविष्टि</option>
                <option value="Kitchen unavailable / सामग्री अभाव">Kitchen unavailable / सामग्री अभाव</option>
              </select>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVoidModalTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onVoidOrder?.(voidModalTarget.id, voidModalReason);
                  setVoidModalTarget(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ORDER MODAL */}
      {viewOrderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {viewOrderTarget.table.name} · {viewOrderTarget.order.invoiceNo}
                </h3>
                <p className="text-xs text-slate-500">
                  KOT Ticket: <span className="font-mono-num font-bold">{viewOrderTarget.order.kotNo}</span> · Status: {viewOrderTarget.order.kotStatus === 'expired' ? 'Expired (1h Unaccepted)' : (viewOrderTarget.order.kotStatus || 'sent_to_kitchen')}
                </p>
              </div>
              <button
                onClick={() => setViewOrderTarget(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto text-xs">
              <div className="divide-y divide-slate-100">
                {viewOrderTarget.order.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                      {item.nepaliName && <p className="text-slate-500 text-[11px]">{item.nepaliName}</p>}
                      {item.notes && <p className="text-amber-800 text-[10px] italic">Note: {item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-mono-num font-bold text-slate-800">
                          {item.quantity} x {item.price.toFixed(0)} = {settings.currencySymbol} {(item.quantity * item.price).toFixed(0)}
                        </span>
                      </div>
                      {isAdminOrManager && onVoidOrderItem && (
                        <button
                          type="button"
                          onClick={() => {
                            const reason = prompt(lang === 'ne' ? `"${item.name}" खारेज (Void) गर्नुको कारण लेख्नुहोस्:` : `Enter reason for voiding "${item.name}":`);
                            if (reason) {
                              onVoidOrderItem(viewOrderTarget.order.id, idx, reason);
                              const remaining = viewOrderTarget.order.items.filter((_, i) => i !== idx);
                              if (remaining.length === 0) {
                                setViewOrderTarget(null);
                              } else {
                                setViewOrderTarget({
                                  ...viewOrderTarget,
                                  order: { ...viewOrderTarget.order, items: remaining }
                                });
                              }
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Admin: Void item from running bill"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Summary */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 font-mono-num text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{settings.currencySymbol} {viewOrderTarget.order.subtotal.toFixed(2)}</span>
                </div>
                {viewOrderTarget.order.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Discount:</span>
                    <span>- {settings.currencySymbol} {viewOrderTarget.order.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {viewOrderTarget.order.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service Charge:</span>
                    <span>{settings.currencySymbol} {viewOrderTarget.order.serviceChargeAmount.toFixed(2)}</span>
                  </div>
                )}
                {viewOrderTarget.order.vatAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT:</span>
                    <span>{settings.currencySymbol} {viewOrderTarget.order.vatAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-300">
                  <span>Grand Total:</span>
                  <span className="text-emerald-800">{settings.currencySymbol} {viewOrderTarget.order.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintEstimateOrder(viewOrderTarget.order)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors"
                  title="Print customer estimate slip before payment"
                >
                  <Printer className="h-3.5 w-3.5 text-amber-700" />
                  <span>{lang === 'ne' ? 'कच्चा बिल स्लिप' : 'Estimate Slip'}</span>
                </button>

                {isAdminOrManager && onVoidOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      const reason = prompt(lang === 'ne' ? 'अर्डर खारेज गर्नुको कारण लेख्नुहोस्:' : 'Enter reason for cancelling/voiding this order:');
                      if (reason) {
                        onVoidOrder(viewOrderTarget.order.id, reason);
                        setViewOrderTarget(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs"
                    title="Void this active order (Admin Only)"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>{lang === 'ne' ? 'अर्डर खारेज (Void)' : 'Void Order'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewOrderTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const tableId = viewOrderTarget.table.id;
                    setViewOrderTarget(null);
                    onSelectTableForPOS(tableId);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs"
                >
                  {lang === 'ne' ? 'बिलिङमा खोल्नुहोस्' : 'Open in POS & Settle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER TABLE MODAL */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                Transfer Active Order from {transferTarget.name}
              </h3>
              <button onClick={() => setTransferTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Select an unoccupied available table to move the running order and all items:
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Destination Table:</label>
                <select
                  value={destinationTableId}
                  onChange={(e) => setDestinationTableId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                >
                  <option value="">-- Choose Target Table --</option>
                  {tablesRooms
                    .filter(t => t.id !== transferTarget.id && t.status === 'available')
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.code} - {t.name} ({t.capacity} seats)
                      </option>
                    ))}
                </select>
              </div>

              {tablesRooms.filter(t => t.id !== transferTarget.id && t.status === 'available').length === 0 && (
                <p className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
                  No available tables currently free to transfer to. Please free or clean a table first.
                </p>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setTransferTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!destinationTableId}
                onClick={handleConfirmTransfer}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MERGE TABLES MODAL */}
      {mergeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                Merge Table {mergeTarget.name} into Another Table
              </h3>
              <button onClick={() => setMergeTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Select another active dining table to combine items, subtotal, and tax into a single master bill:
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Master Target Table:</label>
                <select
                  value={mergeIntoTableId}
                  onChange={(e) => setMergeIntoTableId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                >
                  <option value="">-- Choose Master Table --</option>
                  {tablesRooms
                    .filter(t => t.id !== mergeTarget.id && orders.some(o => o.tableRoomId === t.id && o.status === 'active'))
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.code} - {t.name} (Running order)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setMergeTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!mergeIntoTableId}
                onClick={handleConfirmMerge}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg disabled:opacity-40"
              >
                Merge Bills
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SPLIT BILL MODAL */}
      {splitBillTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                Split Bill Calculator · {splitBillTarget.table.name}
              </h3>
              <button onClick={() => setSplitBillTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center font-mono-num">
                <span className="font-bold text-emerald-950">Total Bill:</span>
                <span className="text-lg font-black text-emerald-900">
                  {settings.currencySymbol} {splitBillTarget.order.grandTotal.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Number of Guests / Splits:</label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSplitCount(cnt)}
                      className={`py-2 rounded-lg font-bold text-center border transition-colors ${
                        splitCount === cnt
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {cnt} Ways
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-1 font-mono-num">
                <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">Per Person Share</p>
                <p className="text-2xl font-black text-slate-900">
                  {settings.currencySymbol} {(splitBillTarget.order.grandTotal / splitCount).toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-500">Each of {splitCount} guests pays this amount</p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSplitBillTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const tableId = splitBillTarget.table.id;
                  setSplitBillTarget(null);
                  onSelectTableForPOS(tableId);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Go to POS Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN WAITER MODAL */}
      {assignWaiterTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                Assign Waiter · {assignWaiterTarget.name}
              </h3>
              <button onClick={() => setAssignWaiterTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Select Service Staff:</label>
                <div className="space-y-1.5">
                  {defaultWaiters.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelectedWaiterName(w.name)}
                      className={`w-full p-2.5 rounded-lg border text-left font-semibold text-xs transition-colors flex items-center justify-between ${
                        selectedWaiterName === w.name
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{w.name}</span>
                      {selectedWaiterName === w.name && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setAssignWaiterTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignWaiter}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Check-in Modal */}
      {checkInModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <Hotel className="h-5 w-5 text-emerald-800" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'ne' ? 'रिसोर्ट पाहुना चेक-इन दर्ता' : 'Guest Check-In Registration'}
                </h3>
              </div>
              <button
                onClick={() => setCheckInModalTarget(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between">
                <div>
                  <span className="text-slate-500 block">{lang === 'ne' ? 'कोठा / कटेज:' : 'Room / Cottage:'}</span>
                  <span className="font-bold text-slate-900 text-sm">{checkInModalTarget.name} ({checkInModalTarget.code})</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">{lang === 'ne' ? 'दर:' : 'Tariff:'}</span>
                  <span className="font-bold text-emerald-800 font-mono-num text-sm">
                    {settings.currencySymbol} {checkInModalTarget.ratePerNight?.toLocaleString()} / night
                  </span>
                </div>
              </div>

              {checkInError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-lg flex items-center gap-2">
                  <X className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{checkInError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'पाहुनाको पूरा नाम *' : 'Guest Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Karki"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'सम्पर्क नम्बर (मोबाइल) *' : 'Phone Number *'}
                </label>
                <input
                  type="tel"
                  placeholder="98XXXXXXXX"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'बसाइ (रात संख्या):' : 'Nights of Stay:'}
                  </label>
                  <NumberInput
                    min={1}
                    integer
                    emptyValue={1}
                    value={nightsCount}
                    onValueChange={(val) => setNightsCount(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'अनुमानित कुल कोठा भाडा:' : 'Estimated Room Total:'}
                  </label>
                  <div className="px-3 py-2 bg-slate-100 rounded-lg font-bold font-mono-num text-slate-900">
                    {settings.currencySymbol} {((checkInModalTarget.ratePerNight || 0) * nightsCount).toLocaleString()}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'ठेगाना / परिचयपत्र विवरण (वैकल्पिक)' : 'Address / National ID / Passport'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kathmandu / Pokhara"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCheckInModalTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                {lang === 'ne' ? 'रद्द' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!guestName.trim()}
                onClick={handleConfirmCheckIn}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-40 transition-colors shadow-2xs"
              >
                {lang === 'ne' ? 'चेक-इन सम्पन्न गर्नुहोस्' : 'Confirm Check-In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE BUSINESS AREAS MODAL (Add / Rename / Delete Floor Areas) */}
      {showManageAreasModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => setShowManageAreasModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'ne' ? 'टेबल एरिया / क्षेत्र व्यवस्थापन' : 'Manage Floor Areas'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {lang === 'ne'
                    ? 'आफ्नो रेस्टुरेन्ट अनुसार एरिया थप्नुहोस्, सच्याउनुहोस् वा हटाउनुहोस्'
                    : 'Add, rename, or remove areas to match your venue layout'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManageAreasModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = addBusinessArea(availableAreas, newAreaInput);
                  if (res.error) {
                    setAreaError(res.error);
                    return;
                  }
                  setAreaError(null);
                  setNewAreaInput('');
                  onUpdateTableAreas?.(res.areas);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={newAreaInput}
                  onChange={(e) => {
                    setNewAreaInput(e.target.value);
                    if (areaError) setAreaError(null);
                  }}
                  placeholder={lang === 'ne' ? 'नयाँ एरिया (उदा. VIP Hall, Rooftop)...' : 'New area (e.g. Ground Floor, VIP Hall)...'}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl whitespace-nowrap"
                >
                  {lang === 'ne' ? 'थप्नुहोस्' : '+ Add Area'}
                </button>
              </form>

              {areaError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-semibold flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{areaError}</span>
                </div>
              )}

              <div className="space-y-2">
                {availableAreas.length === 0 ? (
                  <p className="text-center py-4 text-slate-400">
                    {lang === 'ne'
                      ? 'अहिले कुनै एरिया सेट गरिएको छैन। माथि नयाँ एरिया थप्नुहोस्।'
                      : 'No floor areas configured yet. Add your first area above.'}
                  </p>
                ) : (
                  availableAreas.map((areaName) => {
                    const countInArea = diningTables.filter(
                      (tbl) => resolveTableArea(tbl).toLowerCase() === areaName.toLowerCase()
                    ).length;
                    const isRenaming = renamingAreaTarget === areaName;
                    const isConfirmingDel = confirmDeleteAreaName === areaName;

                    return (
                      <div
                        key={areaName}
                        className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2"
                      >
                        {isRenaming ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameAreaValue}
                              onChange={(e) => setRenameAreaValue(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const res = renameBusinessArea(availableAreas, tablesRooms, areaName, renameAreaValue);
                                if (res.error) {
                                  setAreaError(res.error);
                                  return;
                                }
                                setAreaError(null);
                                if (diningSectionFilter.toLowerCase() === areaName.toLowerCase()) {
                                  setDiningSectionFilter(renameAreaValue.trim());
                                }
                                setRenamingAreaTarget(null);
                                onUpdateTableAreas?.(res.areas, res.tables);
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingAreaTarget(null);
                                setAreaError(null);
                              }}
                              className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded-lg font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{areaName}</p>
                              <p className="text-[11px] text-slate-500">
                                {countInArea} {countInArea === 1 ? 'table' : 'tables'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingAreaTarget(areaName);
                                  setRenameAreaValue(areaName);
                                  setConfirmDeleteAreaName(null);
                                  setAreaError(null);
                                }}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg border border-transparent hover:border-slate-200"
                                title={lang === 'ne' ? 'एरिया नाम परिवर्तन' : 'Rename area'}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isConfirmingDel) {
                                    const res = removeBusinessArea(availableAreas, tablesRooms, areaName);
                                    if (diningSectionFilter.toLowerCase() === areaName.toLowerCase()) {
                                      setDiningSectionFilter('all');
                                    }
                                    setConfirmDeleteAreaName(null);
                                    onUpdateTableAreas?.(res.areas, res.tables);
                                  } else {
                                    setConfirmDeleteAreaName(areaName);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1 ${
                                  isConfirmingDel
                                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                                    : 'text-rose-600 hover:bg-rose-50'
                                }`}
                                title={lang === 'ne' ? 'एरिया हटाउनुहोस्' : 'Remove area'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {isConfirmingDel && (
                                  <span className="text-[11px]">
                                    {countInArea > 0 ? `Remove & move ${countInArea}` : 'Confirm?'}
                                  </span>
                                )}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Space / Table / Room Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'ne' ? 'नयाँ टेबल वा कोठा थप्नुहोस्' : 'Add New Table or Room'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewEntity} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'प्रकार (Type):' : 'Space Type:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['table', 'room', 'cottage'] as TableRoomType[]).map((tType) => (
                    <button
                      key={tType}
                      type="button"
                      onClick={() => setNewType(tType)}
                      className={`p-2 rounded border text-center font-bold capitalize transition-colors ${newType === tType ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
                    >
                      {tType}
                    </button>
                  ))}
                </div>
              </div>

              {newType === 'table' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'एरिया / क्षेत्र (Area):' : 'Floor Area / Zone:'}
                  </label>
                  <select
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    {availableAreas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                    {!availableAreas.some(a => a.toLowerCase() === 'main hall') && (
                      <option value="Main Hall">Main Hall</option>
                    )}
                    <option value="__custom__">+ Type New Custom Area...</option>
                  </select>
                  {newArea === '__custom__' && (
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ground Floor, VIP Cabin..."
                      value={newCustomArea}
                      onChange={(e) => setNewCustomArea(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'कोड (उदा. T-07, RM-104):' : 'Code:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="T-07"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'क्षमता (Capacity):' : 'Capacity:'}
                  </label>
                  <NumberInput
                    min={1}
                    integer
                    value={newCapacity}
                    onValueChange={(val) => setNewCapacity(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'नाम (Name in English):' : 'Name:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 7"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'नेपाली नाम (Nepali Name):' : 'Nepali Name:'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. टेबल ७"
                  value={newNepaliName}
                  onChange={(e) => setNewNepaliName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {(newType === 'room' || newType === 'cottage') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'प्रति रात दर (रू.):' : 'Nightly Rate (Rs.):'}
                  </label>
                  <NumberInput
                    min={0}
                    value={newRate}
                    onValueChange={(val) => setNewRate(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  {lang === 'ne' ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {lang === 'ne' ? 'थप्नुहोस्' : 'Create Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT TABLE MODAL */}
      {editingTableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">
                {lang === 'ne' ? 'टेबल / कोठा विवरण सम्पादन' : 'Edit Table / Room Space'}
              </h4>
              <button onClick={() => setEditingTableTarget(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTable} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'प्रकार (Type):' : 'Space Type:'}
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as TableRoomType)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                  >
                    <option value="table">Dining Table (डाइनिङ टेबल)</option>
                    <option value="cottage">Garden Cottage (कटेज)</option>
                    <option value="room">Resort Room (रिसोर्ट कोठा)</option>
                    <option value="takeaway">Counter / Takeaway</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'टेबल कोड (Code):' : 'Table/Room Code:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'नाम (English Name):' : 'Space Name:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'क्षमता (Seats):' : 'Capacity (Seats):'}
                  </label>
                  <NumberInput
                    min={1}
                    max={50}
                    integer
                    value={editCapacity}
                    onValueChange={(val) => setEditCapacity(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'नेपाली नाम (Nepali Name):' : 'Nepali Name:'}
                </label>
                <input
                  type="text"
                  value={editNepaliName}
                  onChange={(e) => setEditNepaliName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {editType === 'table' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'एरिया / क्षेत्र (Area):' : 'Floor Area / Zone:'}
                  </label>
                  <select
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                  >
                    {availableAreas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                    {editArea && editArea !== '__custom__' && !availableAreas.some(a => a.toLowerCase() === editArea.toLowerCase()) && (
                      <option value={editArea}>{editArea}</option>
                    )}
                    <option value="__custom__">+ Type New Custom Area...</option>
                  </select>
                  {editArea === '__custom__' && (
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ground Floor, VIP Cabin..."
                      value={editCustomArea}
                      onChange={(e) => setEditCustomArea(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'स्थिति (Status):' : 'Table Status:'}
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TableRoomStatus)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                >
                  <option value="available">Available (खाली)</option>
                  <option value="occupied">Occupied (व्यस्त)</option>
                  <option value="reserved">Reserved (रिजर्भ)</option>
                  <option value="waiting_for_bill">Waiting for Bill (बिल माग्दै)</option>
                  <option value="cleaning">Cleaning (सफाई हुँदै)</option>
                  <option value="out_of_service">Out of Service (मर्मतमा / बन्द)</option>
                </select>
              </div>

              {(editType === 'room' || editType === 'cottage') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'प्रति रात दर (रू.):' : 'Nightly Rate (Rs.):'}
                  </label>
                  <NumberInput
                    min={0}
                    value={editRate}
                    onValueChange={(val) => setEditRate(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              )}

              {editTableError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] font-semibold text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{editTableError}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteTable(editingTableTarget.id)}
                  className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-bold border rounded-lg transition-colors ${
                    confirmDeleteTable
                      ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                      : 'text-rose-700 hover:bg-rose-50 border-rose-200'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>
                    {confirmDeleteTable
                      ? (lang === 'ne' ? 'पक्का मेटाउने हो?' : 'Confirm Delete?')
                      : (lang === 'ne' ? 'हटाउनुहोस्' : 'Delete Table')}
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTableTarget(null);
                      setEditTableError(null);
                      setConfirmDeleteTable(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                  >
                    {lang === 'ne' ? 'रद्द' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    {lang === 'ne' ? 'सेभ गर्नुहोस्' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Estimate Bill Slip Modal */}
      {printEstimateOrder && (
        <ReceiptModal
          order={printEstimateOrder}
          settings={settings}
          lang={lang}
          isEstimate={true}
          onClose={() => setPrintEstimateOrder(null)}
        />
      )}

      {/* Active Running Orders Hub Modal */}
      {showActiveOrdersModal && (
        <ActiveOrdersModal
          orders={orders}
          tablesRooms={tablesRooms}
          settings={settings}
          lang={lang}
          currentSession={currentSession || null}
          onClose={() => setShowActiveOrdersModal(false)}
          onSelectOrderForPOS={(tableRoomId, orderId) => {
            setShowActiveOrdersModal(false);
            onSelectTableForPOS(tableRoomId);
          }}
          onOpenSettleModal={(order) => {
            setShowActiveOrdersModal(false);
            if (onOpenCheckoutForOrder) {
              onOpenCheckoutForOrder(order);
            } else if (order.tableRoomId) {
              onSelectTableForPOS(order.tableRoomId);
            }
          }}
          onPrintEstimate={(order) => {
            setPrintEstimateOrder(order);
          }}
          onShiftTableOrder={onShiftTableOrder}
          onMergeTables={onMergeTables}
          onVoidOrder={onVoidOrder}
          onVoidOrderItem={onVoidOrderItem}
          onAdminUpdatePricing={onAdminUpdatePricing}
          onForceReleaseTable={onForceReleaseTable}
        />
      )}
    </div>
  );
};
