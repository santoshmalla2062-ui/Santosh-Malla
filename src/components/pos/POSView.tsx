import React, { useState, useMemo, useEffect, useRef } from 'react';
import { NumberInput } from '../common/NumberInput';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  UtensilsCrossed, 
  CreditCard, 
  FileText, 
  RotateCcw, 
  Coffee, 
  Hotel, 
  Wine, 
  Cake, 
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  X,
  Truck,
  ShoppingBag,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowRightLeft,
  LayoutGrid,
  List,
  Receipt,
  ArrowRight,
  Printer,
  ShieldAlert,
  Split,
  Merge,
  Clock,
  Edit3,
  Percent,
  Coins,
  Eye,
  Volume2,
  VolumeX,
  Zap,
  Check,
  Banknote,
  QrCode,
  BookOpen,
  Edit2,
  UserCheck,
  Star,
  Bookmark,
  PauseCircle,
  PlayCircle,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  MoreHorizontal
} from 'lucide-react';
import { soundFX } from '../../utils/soundEffects';
import { nowIsoString } from '../../utils/timeUtils';
import { getUserPreferences, toggleFavoriteItem } from '../../services/userPreferences';
import { getMenuItemImageUrl } from '../../utils/menuImages';
import { getItemNoteConfig, toggleNoteChip, isChipActive } from '../../utils/itemNotes';
import { 
  BusinessSettings, 
  Customer, 
  DeliveryDetails,
  InventoryItem, 
  ItemAddOn,
  ItemCategory, 
  ItemVariant,
  MenuItem, 
  Order, 
  OrderItem, 
  PaymentMethod, 
  PaymentRecord, 
  ResortRoom,
  Session,
  TableRoom,
  StaffUser
} from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptModal } from './ReceiptModal';
import { KOTModal } from './KOTModal';
import { MenuManagerModal } from '../menu/MenuManagerModal';
import { ActiveOrdersModal } from './ActiveOrdersModal';
import { SplitBillModal } from './SplitBillModal';
import { TaxSettingsModal } from './TaxSettingsModal';
import { hasPermission, validateInventoryStock, verifyFinancialCalculations } from '../../services/security';
import { isNetworkOnline } from '../../services/syncService';
import { getNextKOTNumber, getNextInvoiceNumber } from '../../services/storage';
import { buildEscPosReceiptBytes, openCashDrawerHardware, sendEscPosToHardware } from '../../services/escposPrinter';
import { formatBsIsoDate, getNepalFiscalYear } from '../../services/irdCompliance';

interface POSViewProps {
  menuItems: MenuItem[];
  tablesRooms: TableRoom[];
  inventoryItems: InventoryItem[];
  customers: Customer[];
  orders: Order[];
  settings: BusinessSettings;
  lang: Language;
  currentSession: Session | null;
  initialSelectedTableId?: string;
  navigationNonce?: number;
  initialCheckoutOrderId?: string | null;
  initialEditOrderId?: string | null;
  initialOrderType?: 'dine_in' | 'takeaway' | 'delivery' | null;
  onClearPendingCheckout?: () => void;
  onClearPendingEditOrder?: () => void;
  onClearPendingOrderType?: () => void;
  onNavigateToTables?: () => void;
  onNavigateToBilling?: () => void;
  occupiedResortRooms?: ResortRoom[];
  onSaveOrder: (order: Order, shouldSettle: boolean, updatedTableRoomStatus?: string) => boolean;
  onKOTSent: (order: Order) => void;
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem?: (itemId: string) => void;
  onShiftTableOrder: (fromTableId: string, toTableId: string) => void;
  onPromptAuth?: () => void;
  onMergeTables?: (sourceTableId: string, targetTableId: string) => void;
  onVoidOrder?: (orderId: string, reason: string) => void;
  onVoidOrderItem?: (orderId: string, itemIndex: number, reason: string) => void;
  onAdminUpdatePricing?: (orderId: string, update: { discountPercent?: number; waiveServiceCharge?: boolean; waiveVat?: boolean; notes?: string }) => void;
  onForceReleaseTable?: (tableId: string) => void;
  onSettleSplitOrder?: (parentOrderId: string, splitOrder: Order, remainingItems: OrderItem[]) => boolean;
  onUpdateSettings?: (newSettings: BusinessSettings) => void;
  onReserveSequence?: (counterType: 'invoice' | 'kot' | 'credit_note', prefix: string) => Promise<string>;
  staffUsers?: StaffUser[];
  onUpdateStaffUsers?: (users: StaffUser[]) => void;
}

export const POSView: React.FC<POSViewProps> = ({
  menuItems,
  tablesRooms,
  inventoryItems,
  customers,
  orders,
  settings,
  lang,
  currentSession,
  initialSelectedTableId,
  navigationNonce,
  initialCheckoutOrderId,
  initialEditOrderId,
  initialOrderType,
  onClearPendingCheckout,
  onClearPendingEditOrder,
  onClearPendingOrderType,
  onNavigateToTables,
  onNavigateToBilling,
  occupiedResortRooms = [],
  onSaveOrder,
  onKOTSent,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onShiftTableOrder,
  onPromptAuth,
  onMergeTables,
  onVoidOrder,
  onVoidOrderItem,
  onAdminUpdatePricing,
  onForceReleaseTable,
  onSettleSplitOrder,
  onUpdateSettings,
  onReserveSequence,
  staffUsers = [],
  onUpdateStaffUsers
}) => {
  const t = TRANSLATIONS[lang];

  // RBAC permissions strictly derived from verified session
  const userRole = currentSession?.role;
  const canSettlePayment = userRole ? hasPermission(userRole, 'SETTLE_PAYMENT') : false;
  const canModifyPricing = userRole ? hasPermission(userRole, 'MODIFY_PRICING') : false;
  const canApplyDiscount = userRole ? hasPermission(userRole, 'APPLY_DISCOUNT') : false;
  const canSendKOT = userRole ? hasPermission(userRole, 'SEND_KOT') : false;
  const canModifyTaxConfig = userRole
    ? hasPermission(userRole, 'MODIFY_TAX_CONFIG', undefined, settings.customRolePermissions)
    : false;

  // Order Type state: Dine-in, Takeaway, Delivery
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');

  // Category filter & search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuViewMode, setMenuViewMode] = useState<'photos' | 'compact'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'compact' : 'photos'
  );
  const [mobilePOSTab, setMobilePOSTab] = useState<'menu' | 'cart'>('menu');
  const [showMobileOrderSummary, setShowMobileOrderSummary] = useState(true);
  const [showMobileMoreSheet, setShowMobileMoreSheet] = useState(false);

  // Dining tables only (keeps resort hotel rooms separate)
  const diningTables = useMemo(() => {
    const onlyTables = tablesRooms.filter(tr => tr.type === 'table' || !tr.type);
    return onlyTables.length > 0 ? onlyTables : tablesRooms;
  }, [tablesRooms]);

  // Selected Table/Room
  const [selectedTableRoomId, setSelectedTableRoomId] = useState<string>(
    initialSelectedTableId || diningTables[0]?.id || 'tr-1'
  );

  // Waiter assignment from actual business staff roster
  const availableWaiters = useMemo(() => {
    const fromStaff = staffUsers
      .filter(s => s.isActive && (s.role === 'WAITER' || s.role === 'STAFF' || s.role === 'CASHIER' || s.role === 'MANAGER' || s.role === 'ADMIN' || s.role === 'OWNER'))
      .map(s => s.nepaliName ? `${s.name} (${s.nepaliName})` : s.name);
    return fromStaff.length > 0 ? fromStaff : [
      'Bikash Tamang (Waiter)',
      'Pooja Sharma (Cafe Server)',
      'Sunil Gurung (Terrace Waiter)',
      'Aashish Thapa (Captain)'
    ];
  }, [staffUsers]);

  const [selectedWaiter, setSelectedWaiter] = useState<string>(availableWaiters[0] || 'Waiter');

  useEffect(() => {
    if (!availableWaiters.includes(selectedWaiter) && availableWaiters.length > 0) {
      setSelectedWaiter(availableWaiters[0]);
    }
  }, [availableWaiters]);

  // Modal to manage / edit waiter names right from POS
  const [showWaiterManageModal, setShowWaiterManageModal] = useState(false);
  const [editingStaffTarget, setEditingStaffTarget] = useState<StaffUser | null>(null);
  const [newQuickWaiterName, setNewQuickWaiterName] = useState('');
  const [newQuickWaiterNepali, setNewQuickWaiterNepali] = useState('');

  // Delivery details
  const [deliveryCustName, setDeliveryCustName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Takeaway customer details (optional)
  const [takeawayCustName, setTakeawayCustName] = useState('');
  const [takeawayPhone, setTakeawayPhone] = useState('');

  // Cart Items
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Discount & notes
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [specialNote, setSpecialNote] = useState<string>('');
  const [kotPriority, setKotPriority] = useState<'normal' | 'urgent' | 'vip'>('normal');

  // Notifications / feedback banner with automatic dismiss
  const [statusBanner, setStatusBanner] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = window.setTimeout(() => {
      setStatusBanner(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [statusBanner]);

  // Variant / Add-on Customization Modal target
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [chosenVariant, setChosenVariant] = useState<ItemVariant | undefined>(undefined);
  const [chosenAddOns, setChosenAddOns] = useState<ItemAddOn[]>([]);
  const [chosenItemNote, setChosenItemNote] = useState<string>('');

  // Modals state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showHeldDraftsModal, setShowHeldDraftsModal] = useState(false);
  const [heldDrafts, setHeldDrafts] = useState<any[]>(() => {
    try {
      const key = `himalayan_held_drafts_${initialSelectedTableId || 'default'}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // POS Keyboard Shortcuts (F2: Search, Esc: Clear search)
  useEffect(() => {
    const handlePOSShortcuts = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const searchInput = document.getElementById('pos-search-input') as HTMLInputElement;
        searchInput?.focus();
        searchInput?.select();
      } else if (e.key === 'Escape') {
        if (searchQuery) setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handlePOSShortcuts);
    return () => window.removeEventListener('keydown', handlePOSShortcuts);
  }, [searchQuery]);

  const handleHoldDraftOrder = () => {
    if (cartItems.length === 0) return;
    const draft = {
      id: 'draft-' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      tableName: selectedTableRoom?.name || 'Walk-in',
      tableId: selectedTableRoomId,
      orderType,
      items: cartItems,
      discountPercent,
      specialNote,
      customerName: takeawayCustName || deliveryCustName || selectedTableRoom?.name || 'Walk-in Guest'
    };
    const updated = [draft, ...heldDrafts].slice(0, 10);
    setHeldDrafts(updated);
    try {
      const key = `himalayan_held_drafts_${initialSelectedTableId || 'default'}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    setCartItems([]);
    setStatusBanner({
      text: lang === 'ne' ? 'अर्डर ड्राफ्टमा सुरक्षित गरियो! अर्को ग्राहकको अर्डर लिन सकिन्छ।' : 'Order held in Drafts. Table ready for next guest.',
      type: 'info'
    });
  };

  const handleResumeDraftOrder = (draft: any) => {
    setCartItems(draft.items);
    if (draft.orderType) setOrderType(draft.orderType);
    if (draft.discountPercent) setDiscountPercent(draft.discountPercent);
    if (draft.specialNote) setSpecialNote(draft.specialNote);
    const remaining = heldDrafts.filter(d => d.id !== draft.id);
    setHeldDrafts(remaining);
    try {
      const key = `himalayan_held_drafts_${initialSelectedTableId || 'default'}`;
      localStorage.setItem(key, JSON.stringify(remaining));
    } catch {}
    setShowHeldDraftsModal(false);
    setStatusBanner({
      text: lang === 'ne' ? 'ड्राफ्ट अर्डर पुनः लोड गरियो।' : 'Held draft order resumed into cart.',
      type: 'success'
    });
  };
  const [showKOTModal, setShowKOTModal] = useState(false);
  const [showMenuManagerModal, setShowMenuManagerModal] = useState(false);
  const [menuEditingItem, setMenuEditingItem] = useState<MenuItem | null>(null);
  const [showShiftTableModal, setShowShiftTableModal] = useState(false);
  const [showActiveOrdersModal, setShowActiveOrdersModal] = useState(false);
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [estimateOrderTarget, setEstimateOrderTarget] = useState<Order | null>(null);
  const [showAdminPricingModal, setShowAdminPricingModal] = useState(false);
  const [showTaxSettingsModal, setShowTaxSettingsModal] = useState(false);
  const [adminCustomDiscountPct, setAdminCustomDiscountPct] = useState<number>(0);
  const [adminWaiveSC, setAdminWaiveSC] = useState<boolean>(false);
  const [adminWaiveVat, setAdminWaiveVat] = useState<boolean>(false);
  const [adminPricingNote, setAdminPricingNote] = useState<string>('');
  const [targetShiftTableId, setTargetShiftTableId] = useState<string>('');
  const [settledOrderForReceipt, setSettledOrderForReceipt] = useState<Order | null>(null);
  const [lastDispatchedKOT, setLastDispatchedKOT] = useState<Order | null>(null);
  const [columnSplit, setColumnSplit] = useState<'balanced' | 'menu_focus' | 'cart_focus'>('balanced');

  // Screen mode: Take order from menu vs Embedded Active Orders Command Center
  const [posScreenMode, setPosScreenMode] = useState<'pos_menu' | 'active_orders_hub'>('pos_menu');

  // Item Price Override by Admin
  const [editingItemPriceIdx, setEditingItemPriceIdx] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<number>(0);
  const [expandedNoteItemId, setExpandedNoteItemId] = useState<string | null>(null);

  // Guest PAX & Split Bill Modal state
  const [guestCount, setGuestCount] = useState<number>(2);
  const [showSplitBillModal, setShowSplitBillModal] = useState<boolean>(false);
  const [splitTargetOrder, setSplitTargetOrder] = useState<Order | null>(null);
  const [splitCheckoutContext, setSplitCheckoutContext] = useState<{
    parentOrder: Order;
    splitOrder: Order;
    remainingItems: OrderItem[];
  } | null>(null);

  // Merge Bill Modal
  const [showMergeModal, setShowMergeModal] = useState<boolean>(false);
  const [selectedMergeTargetTableId, setSelectedMergeTargetTableId] = useState<string>('');

  // In-App Void modal state in POS
  const [voidTargetOrderIdInPOS, setVoidTargetOrderIdInPOS] = useState<string | null>(null);
  const [voidReasonInPOS, setVoidReasonInPOS] = useState<string>('Customer cancelled / अर्डर रद्द');
  const [customVoidReasonInPOS, setCustomVoidReasonInPOS] = useState<string>('');

  // Active orders metrics
  const isAdminOrManager = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER';
  const activeOrders = useMemo(() => orders.filter(o => o.status === 'active'), [orders]);
  const totalActiveRevenue = useMemo(() => activeOrders.reduce((s, o) => s + o.grandTotal, 0), [activeOrders]);

  // Audio mute state
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // Floor Table Quick Strip state
  const [showTableBar, setShowTableBar] = useState<boolean>(true);
  const [tableBarFilter, setTableBarFilter] = useState<'all' | 'occupied' | 'available' | 'waiting'>('all');

  // Discount mode: Percentage vs Flat Nepali Rupee (रु) amount
  const [discountMode, setDiscountMode] = useState<'percent' | 'flat'>('percent');
  const [flatDiscountAmount, setFlatDiscountAmount] = useState<number>(0);

  // Quick cash tender helper in cart
  const [cartCashTender, setCartCashTender] = useState<number>(0);

  const lastLoadedTableIdRef = useRef<string | null>(null);
  const lastHandledNonceRef = useRef<number>(-1);

  // Sync navigation intents from parent ONLY once per navigationNonce so later order mutations never snap table selection back
  useEffect(() => {
    const nonce = navigationNonce ?? 0;
    if (lastHandledNonceRef.current === nonce) return;
    lastHandledNonceRef.current = nonce;

    if (initialCheckoutOrderId) {
      const checkoutTarget = orders.find(o => o.id === initialCheckoutOrderId);
      onClearPendingCheckout?.();
      onClearPendingEditOrder?.();
      onClearPendingOrderType?.();
      if (checkoutTarget) {
        setPosScreenMode('pos_menu');
        handleOpenSettleModalForOrder(checkoutTarget);
        return;
      }
    }

    if (initialEditOrderId) {
      const editTarget = orders.find(o => o.id === initialEditOrderId);
      onClearPendingEditOrder?.();
      onClearPendingOrderType?.();
      if (editTarget) {
        setPosScreenMode('pos_menu');
        const nextType = editTarget.orderType === 'takeaway' || editTarget.orderType === 'delivery'
          ? editTarget.orderType
          : 'dine_in';
        setOrderType(nextType);
        if (nextType === 'dine_in' && editTarget.tableRoomId) {
          setSelectedTableRoomId(editTarget.tableRoomId);
          lastLoadedTableIdRef.current = editTarget.tableRoomId;
        }
        setCurrentOrderId(editTarget.id);
        setCartItems(editTarget.items.map(item => ({
          ...item,
          kotStatus: item.kotStatus || 'sent_to_kitchen'
        })));
        setDiscountPercent(editTarget.discountPercent || 0);
        setFlatDiscountAmount(0);
        setAdminCustomDiscountPct(editTarget.customAdminDiscount || 0);
        setAdminWaiveSC(Boolean(editTarget.waivedServiceCharge));
        setAdminWaiveVat(Boolean(editTarget.waivedVat));
        setAdminPricingNote(editTarget.customAdminDiscountReason || '');
        setGuestCount(editTarget.guestCount || 2);
        setSpecialNote(editTarget.specialInstructions || '');
        if (editTarget.waiterName) setSelectedWaiter(editTarget.waiterName);
        if (nextType === 'takeaway') {
          setTakeawayCustName(editTarget.customerName || '');
          setTakeawayPhone(editTarget.customerPhone || '');
        } else if (nextType === 'delivery') {
          setDeliveryCustName(editTarget.customerName || '');
          setDeliveryPhone(editTarget.customerPhone || '');
          setDeliveryAddress(editTarget.deliveryDetails?.address || '');
          setDeliveryNotes(editTarget.deliveryDetails?.deliveryNotes || '');
        }
        setShowMobileOrderSummary(true);
        setMobilePOSTab('menu');
        return;
      }
    }

    if (initialOrderType === 'takeaway' || initialOrderType === 'delivery') {
      setPosScreenMode('pos_menu');
      setOrderType(initialOrderType);
      setCurrentOrderId(null);
      setCartItems([]);
      setDiscountPercent(0);
      setFlatDiscountAmount(0);
      setAdminCustomDiscountPct(0);
      setAdminWaiveSC(false);
      setAdminWaiveVat(false);
      setAdminPricingNote('');
      setCartCashTender(0);
      setSpecialNote('');
      setMobilePOSTab('menu');
      onClearPendingOrderType?.();
      return;
    }

    if (initialOrderType === 'dine_in') {
      onClearPendingOrderType?.();
    }

    if (initialSelectedTableId) {
      setPosScreenMode('pos_menu');
      setOrderType('dine_in');
      setSelectedTableRoomId(initialSelectedTableId);
      lastLoadedTableIdRef.current = initialSelectedTableId;
      const activeOrderForTable = orders.find(o => o.tableRoomId === initialSelectedTableId && o.status === 'active');
      if (activeOrderForTable) {
        setCartItems(activeOrderForTable.items.map(item => ({
          ...item,
          kotStatus: item.kotStatus || 'sent_to_kitchen'
        })));
        setCurrentOrderId(activeOrderForTable.id);
        setDiscountPercent(activeOrderForTable.discountPercent || 0);
        setFlatDiscountAmount(0);
        setAdminCustomDiscountPct(activeOrderForTable.customAdminDiscount || 0);
        setAdminWaiveSC(Boolean(activeOrderForTable.waivedServiceCharge));
        setAdminWaiveVat(Boolean(activeOrderForTable.waivedVat));
        setAdminPricingNote(activeOrderForTable.customAdminDiscountReason || '');
        setGuestCount(activeOrderForTable.guestCount || 2);
        setSpecialNote(activeOrderForTable.specialInstructions || '');
        if (activeOrderForTable.waiterName) {
          setSelectedWaiter(activeOrderForTable.waiterName);
        }
        setShowMobileOrderSummary(true);
        setMobilePOSTab('menu');
      } else {
        setCartItems([]);
        setCurrentOrderId(null);
        setDiscountPercent(0);
        setFlatDiscountAmount(0);
        setAdminCustomDiscountPct(0);
        setAdminWaiveSC(false);
        setAdminWaiveVat(false);
        setAdminPricingNote('');
        setCartCashTender(0);
        setGuestCount(2);
        setSpecialNote('');
        setShowMobileOrderSummary(false);
        setMobilePOSTab('menu');
      }
    }
  }, [navigationNonce, initialSelectedTableId, initialOrderType, initialCheckoutOrderId, initialEditOrderId]);

  // Function to initialize a clean next order for another table or customer
  const handleStartNewOrder = () => {
    if (orderType === 'dine_in') {
      const nextAvail = diningTables.find(t => t.status === 'available' && t.id !== selectedTableRoomId);
      if (nextAvail) {
        setSelectedTableRoomId(nextAvail.id);
        lastLoadedTableIdRef.current = nextAvail.id;
      } else {
        lastLoadedTableIdRef.current = selectedTableRoomId;
      }
    }
    setCartItems([]);
    setCurrentOrderId(null);
    setDiscountPercent(0);
    setFlatDiscountAmount(0);
    setAdminCustomDiscountPct(0);
    setAdminWaiveSC(false);
    setAdminWaiveVat(false);
    setAdminPricingNote('');
    setCartCashTender(0);
    setGuestCount(2);
    setSpecialNote('');
    setTakeawayCustName('');
    setTakeawayPhone('');
    setDeliveryCustName('');
    setDeliveryPhone('');
    setStatusBanner({
      text: lang === 'ne' 
        ? 'नयाँ अर्डर सुरु भयो। अब परिकार छान्नुहोस्।' 
        : 'New clean order started. Select table or dishes.',
      type: 'info'
    });
  };

  // Auto-load table's running order when switching tables
  useEffect(() => {
    if (orderType === 'dine_in') {
      if (lastLoadedTableIdRef.current !== selectedTableRoomId) {
        lastLoadedTableIdRef.current = selectedTableRoomId;
        const activeOrderForTable = orders.find(o => o.tableRoomId === selectedTableRoomId && o.status === 'active');
        if (activeOrderForTable) {
          setCartItems(activeOrderForTable.items.map(item => ({
            ...item,
            kotStatus: item.kotStatus || 'sent_to_kitchen'
          })));
          setCurrentOrderId(activeOrderForTable.id);
          setDiscountPercent(activeOrderForTable.discountPercent || 0);
          setFlatDiscountAmount(0);
          setAdminCustomDiscountPct(activeOrderForTable.customAdminDiscount || 0);
          setAdminWaiveSC(Boolean(activeOrderForTable.waivedServiceCharge));
          setAdminWaiveVat(Boolean(activeOrderForTable.waivedVat));
          setAdminPricingNote(activeOrderForTable.customAdminDiscountReason || '');
          setGuestCount(activeOrderForTable.guestCount || 2);
          setSpecialNote(activeOrderForTable.specialInstructions || '');
          if (activeOrderForTable.waiterName) {
            setSelectedWaiter(activeOrderForTable.waiterName);
          }
        } else {
          setCartItems([]);
          setCurrentOrderId(null);
          setDiscountPercent(0);
          setFlatDiscountAmount(0);
          setAdminCustomDiscountPct(0);
          setAdminWaiveSC(false);
          setAdminWaiveVat(false);
          setAdminPricingNote('');
          setCartCashTender(0);
          setGuestCount(2);
          setSpecialNote('');
        }
      }
    }
  }, [selectedTableRoomId, orders, orderType]);

  const selectedTableRoom = tablesRooms.find(tr => tr.id === selectedTableRoomId) || tablesRooms[0];

  // Financial Calculations verified server-side
  const isTakeawayOrDelivery = orderType === 'takeaway' || orderType === 'delivery';
  
  const rawSubtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cartItems]);

  const computedPercentFromFlat = (rawSubtotal > 0 && flatDiscountAmount > 0)
    ? Math.min(100, Math.max(0, (flatDiscountAmount / rawSubtotal) * 100))
    : 0;

  const effectiveDiscount = canApplyDiscount 
    ? (adminCustomDiscountPct > 0 
        ? adminCustomDiscountPct 
        : (discountMode === 'flat' ? computedPercentFromFlat : discountPercent)) 
    : 0;

  const enableSC = settings.enableServiceCharge && !isTakeawayOrDelivery && !adminWaiveSC;
  const enableVatCalculations = settings.enableVat && !adminWaiveVat;

  const verifiedFinancials = verifyFinancialCalculations(
    cartItems,
    menuItems,
    effectiveDiscount,
    isTakeawayOrDelivery || adminWaiveSC,
    enableSC,
    settings.serviceChargePercent,
    enableVatCalculations,
    settings.vatRatePercent
  );

  const subtotal = verifiedFinancials.verifiedSubtotal;
  const discountAmount = verifiedFinancials.verifiedDiscountAmount;
  const serviceChargeAmount = verifiedFinancials.verifiedServiceCharge;
  const vatAmount = verifiedFinancials.verifiedVat;
  const grandTotal = verifiedFinancials.verifiedGrandTotal;

  // Add item directly or trigger customization modal if variants/add-ons exist
  const handleItemClick = (item: MenuItem) => {
    if ((item.variants && item.variants.length > 0) || (item.addOns && item.addOns.length > 0)) {
      setCustomizingItem(item);
      setChosenVariant(item.variants ? item.variants[0] : undefined);
      setChosenAddOns([]);
      setChosenItemNote('');
    } else {
      handleAddToCart(item);
    }
  };

  const handleAddToCart = (item: MenuItem, variant?: ItemVariant, addOnsList?: ItemAddOn[], initialNote?: string) => {
    soundFX.play('add');
    const regularBasePrice = variant ? variant.price : item.price;
    const isPromoOffer = !!(item.isOffer && item.offerPrice && !variant);
    const effectiveBasePrice = isPromoOffer ? item.offerPrice! : regularBasePrice;
    const addOnsTotal = (addOnsList || []).reduce((sum, a) => sum + a.price, 0);
    const finalPrice = effectiveBasePrice + addOnsTotal;

    setCartItems(prev => {
      // Find matching item with identical variant & add-ons & note
      const existing = prev.find(i => 
        i.menuItemId === item.id && 
        i.selectedVariant?.name === variant?.name &&
        JSON.stringify(i.selectedAddOns?.map(a => a.name) || []) === JSON.stringify((addOnsList || []).map(a => a.name)) &&
        (i.notes || '') === (initialNote || '')
      );

      if (existing) {
        return prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }

      const newItem: OrderItem = {
        id: 'ci-' + Date.now() + Math.random().toString(36).substr(2, 4),
        menuItemId: item.id,
        code: item.code,
        name: item.name,
        nepaliName: item.nepaliName,
        price: finalPrice,
        originalPrice: isPromoOffer ? (regularBasePrice + addOnsTotal) : undefined,
        isOffer: item.isOffer,
        offerLabel: item.offerLabel,
        quantity: 1,
        category: item.category,
        station: item.station || 'main_kitchen',
        selectedVariant: variant,
        selectedAddOns: addOnsList && addOnsList.length > 0 ? addOnsList : undefined,
        notes: initialNote || undefined,
        kotStatus: 'pending'
      };

      return [...prev, newItem];
    });
  };

  const handleConfirmCustomization = () => {
    if (!customizingItem) return;
    handleAddToCart(customizingItem, chosenVariant, chosenAddOns, chosenItemNote.trim() || undefined);
    setCustomizingItem(null);
    setChosenVariant(undefined);
    setChosenAddOns([]);
    setChosenItemNote('');
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    setCartItems(prev => {
      const target = prev[index];
      if (!target) return prev;
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        if (target.kotStatus === 'sent_to_kitchen' && !isAdminOrManager) {
          setStatusBanner({
            text: lang === 'ne' 
              ? 'यो परिकार किचेनमा पठाइसकिएको छ। रद्द गर्न एडमिन वा म्यानेजरको अनुमति चाहिन्छ।' 
              : 'This item is already sent to the kitchen. Admin/Manager permission required to void.',
            type: 'error'
          });
          return prev;
        }
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((item, i) => i === index ? { ...item, quantity: newQty } : item);
    });
  };

  const handleDecrementMenuItem = (menuItemId: string) => {
    const revPendingIdx = [...cartItems]
      .reverse()
      .findIndex(i => i.menuItemId === menuItemId && i.kotStatus !== 'sent_to_kitchen');
    if (revPendingIdx >= 0) {
      soundFX.play('remove');
      handleUpdateQuantity(cartItems.length - 1 - revPendingIdx, -1);
      return;
    }
    const revAnyIdx = [...cartItems]
      .reverse()
      .findIndex(i => i.menuItemId === menuItemId);
    if (revAnyIdx >= 0) {
      soundFX.play('remove');
      handleUpdateQuantity(cartItems.length - 1 - revAnyIdx, -1);
    }
  };

  const handleRemoveItem = (index: number) => {
    const target = cartItems[index];
    if (target?.kotStatus === 'sent_to_kitchen') {
      if (!isAdminOrManager) {
        setStatusBanner({
          text: lang === 'ne' 
            ? 'यो परिकार किचेनमा पठाइसकिएको छ। अर्डरबाट हटाउन एडमिन वा म्यानेजरको अनुमति चाहिन्छ।' 
            : 'This item was already sent to kitchen. Only Admin or Manager can void kitchen items.',
          type: 'error'
        });
        return;
      }
      if (currentOrderId && onVoidOrderItem) {
        onVoidOrderItem(currentOrderId, index, lang === 'ne' ? 'अधिकृत कर्मचारीद्वारा खारेज' : 'Voided by authorized manager');
      }
    }
    soundFX.play('remove');
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItemNote = (index: number, note: string) => {
    setCartItems(prev => prev.map((item, i) => i === index ? { ...item, notes: note } : item));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setCurrentOrderId(null);
    setDiscountPercent(0);
    setFlatDiscountAmount(0);
    setAdminCustomDiscountPct(0);
    setAdminWaiveSC(false);
    setAdminWaiveVat(false);
    setAdminPricingNote('');
    setCartCashTender(0);
    setGuestCount(2);
    setSpecialNote('');
    setStatusBanner({
      text: lang === 'ne' ? 'कार्ट खाली गरियो।' : 'Cart cleared.',
      type: 'info'
    });
  };

  // Track quantities of each menu item currently in cart for quick visual badges
  const cartQtyByMenuItem = useMemo(() => {
    const counts: Record<string, number> = {};
    cartItems.forEach((ci) => {
      counts[ci.menuItemId] = (counts[ci.menuItemId] || 0) + ci.quantity;
    });
    return counts;
  }, [cartItems]);

  // Active running order on the currently selected table (if any)
  const activeOrderForTable = useMemo(() => {
    if (orderType === 'dine_in') {
      return orders.find(o => o.tableRoomId === selectedTableRoomId && o.status === 'active');
    }
    return null;
  }, [orders, selectedTableRoomId, orderType]);

  // Compute next sequential KOT and Invoice numbers based on existing tenant orders (pure preview: persist=false)
  const nextSequentialKOT = useMemo(() => {
    return getNextKOTNumber(orders, settings.receiptSettings?.kotPrefix || 'KOT-', settings.businessId, false);
  }, [orders, settings.receiptSettings?.kotPrefix, settings.businessId]);

  const nextSequentialInvoice = useMemo(() => {
    return getNextInvoiceNumber(orders, settings.receiptSettings?.invoicePrefix || 'INV-', settings.businessId, false);
  }, [orders, settings.receiptSettings?.invoicePrefix, settings.businessId]);

  // Persist exact computed discount % (including flat rupee & admin overrides)
  const persistedDiscountPercent = Math.round(effectiveDiscount * 10000) / 10000;

  const activeOrMatchedOrder =
    (currentOrderId ? orders.find(o => o.id === currentOrderId) : undefined) || activeOrderForTable;

  // Generate Current Order Object with sequential serial numbers
  const currentOrderObject: Order = {
    id: currentOrderId || activeOrderForTable?.id || ('ord-' + Date.now()),
    invoiceNo: activeOrMatchedOrder?.invoiceNo || nextSequentialInvoice,
    kotNo: activeOrMatchedOrder?.kotNo || nextSequentialKOT,
    tableRoomId: orderType === 'dine_in' ? (selectedTableRoom?.id || 'tr-1') : (orderType === 'takeaway' ? 'tr-tk' : 'tr-del'),
    tableRoomName: orderType === 'dine_in' ? (selectedTableRoom?.name || 'Table 1') : (orderType === 'takeaway' ? 'Takeaway Counter' : `Delivery (${deliveryCustName || 'Pending'})`),
    tableRoomType: orderType === 'dine_in' ? (selectedTableRoom?.type || 'table') : 'takeaway',
    orderType: orderType === 'dine_in' ? 'dine_in' : orderType === 'takeaway' ? 'takeaway' : 'delivery',
    items: cartItems,
    subtotal,
    discountPercent: persistedDiscountPercent,
    discountAmount,
    serviceChargeAmount,
    vatAmount,
    grandTotal,
    paidAmount: 0,
    dueAmount: grandTotal,
    paymentMethod: selectedPaymentMethod,
    paymentStatus: 'pending',
    waiterName: orderType === 'dine_in' ? selectedWaiter : undefined,
    cashierName: currentSession?.name,
    guestCount: orderType === 'dine_in' ? guestCount : undefined,
    customerName: orderType === 'delivery' ? deliveryCustName : (orderType === 'takeaway' ? takeawayCustName : undefined),
    customerPhone: orderType === 'delivery' ? deliveryPhone : (orderType === 'takeaway' ? takeawayPhone : undefined),
    deliveryDetails: orderType === 'delivery' ? {
      customerName: deliveryCustName,
      phone: deliveryPhone,
      address: deliveryAddress,
      deliveryNotes: deliveryNotes
    } : undefined,
    createdAt: activeOrMatchedOrder?.createdAt || nowIsoString(),
    version: activeOrMatchedOrder?.version,
    status: 'active',
    kotPriority,
    specialInstructions: specialNote,
    waivedServiceCharge: adminWaiveSC,
    waivedVat: adminWaiveVat,
    customAdminDiscount: adminCustomDiscountPct > 0 ? adminCustomDiscountPct : undefined,
    customAdminDiscountReason: adminPricingNote || undefined
  };

  // Handle KOT Dispatch with sequential / atomic serial ticket numbers
  const handleDispatchKOT = async () => {
    if (cartItems.length === 0) {
      setStatusBanner({
        text: lang === 'ne' 
          ? 'कार्ट खाली छ। कृपया पहिला अर्डरका लागि परिकार छान्नुहोस्।' 
          : 'Cart is empty. Please select menu items first.',
        type: 'info'
      });
      return;
    }
    if (!currentSession) {
      onPromptAuth?.();
      return;
    }
    if (!canSendKOT) {
      setStatusBanner({
        text: lang === 'ne' 
          ? 'तपाईंको भूमिकालाई किचेन KDS मा अर्डर पठाउने अनुमति छैन।' 
          : 'Permission denied: Your staff role is not authorized to dispatch KOT tickets.',
        type: 'error'
      });
      return;
    }

    const pendingItems = cartItems.filter(i => i.kotStatus !== 'sent_to_kitchen');
    if (pendingItems.length === 0 && currentOrderId) {
      setShowKOTModal(true);
      setStatusBanner({
        text: lang === 'ne' 
          ? 'यी सबै परिकार पहिले नै किचेनमा पठाइसकिएको छ। KOT पर्ची पुनः प्रिन्ट गर्न सकिन्छ वा नयाँ परिकार थप्न सकिन्छ।' 
          : 'All items already sent to kitchen. You can reprint ticket or add new dishes.',
        type: 'info'
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const kotPrefix = settings.receiptSettings?.kotPrefix || 'KOT-';
    const invPrefix = settings.receiptSettings?.invoicePrefix || 'INV-';

    // Consecutive serial KOT / Invoice number (atomic transaction when cloud-connected)
    const nextSerialKOT = onReserveSequence
      ? await onReserveSequence('kot', kotPrefix)
      : getNextKOTNumber(orders, kotPrefix, settings.businessId, true);
    const committedInvoiceNo =
      activeOrderForTable?.invoiceNo ||
      (onReserveSequence
        ? await onReserveSequence('invoice', invPrefix)
        : currentOrderObject.invoiceNo || getNextInvoiceNumber(orders, invPrefix, settings.businessId, true));

    // Mark all items as sent in this dispatch
    const updatedItems = cartItems.map(item => ({
      ...item,
      kotStatus: 'sent_to_kitchen' as const
    }));

    const orderIdToUse = currentOrderId || activeOrderForTable?.id || ('ord-' + Date.now());

    const trustedKOTOrder: Order = {
      ...currentOrderObject,
      id: orderIdToUse,
      invoiceNo: committedInvoiceNo,
      items: updatedItems,
      kotNo: currentOrderId ? nextSerialKOT : (currentOrderObject.kotNo || nextSerialKOT),
      status: 'active',
      kotStatus: 'sent_to_kitchen',
      kotSentAt: nowIso,
      updatedAt: nowIso,
      idempotencyKey: `idemp-kot-${orderIdToUse}-${Date.now()}`
    };

    // 1. Save and persist order across system
    const kotSaved = onSaveOrder(trustedKOTOrder, false, 'occupied');
    if (!kotSaved) return;
    // 2. Dispatch to live Kitchen KDS
    onKOTSent(trustedKOTOrder);
    soundFX.play('kot');

    setCartItems(updatedItems);
    setCurrentOrderId(trustedKOTOrder.id);
    setLastDispatchedKOT(trustedKOTOrder);
    setShowKOTModal(true);

    setStatusBanner({
      text: lang === 'ne' 
        ? `${trustedKOTOrder.tableRoomName} को लागि क्रमिक पर्ची (${trustedKOTOrder.kotNo}) किचेनमा पठाइयो! अब अर्को अर्डर लिन सक्नुहुन्छ।` 
        : `Sequential ticket ${trustedKOTOrder.kotNo} sent to kitchen for ${trustedKOTOrder.tableRoomName}! You can now take the next order.`,
      type: 'success'
    });
  };

  // Fast Non-Blocking Confirm Order -> dispatches to Kitchen KDS and saves Open Unpaid Bill without blocking KOT popup
  const handleConfirmOrder = async () => {
    if (cartItems.length === 0) {
      setStatusBanner({
        text: lang === 'ne'
          ? 'कार्ट खाली छ। कृपया पहिला अर्डरका लागि परिकार छान्नुहोस्।'
          : 'Add dishes from the menu before confirming the order.',
        type: 'info'
      });
      return;
    }
    if (!currentSession) {
      onPromptAuth?.();
      return;
    }
    if (!canSendKOT) {
      setStatusBanner({
        text: lang === 'ne'
          ? 'तपाईंको भूमिकालाई अर्डर पठाउने अनुमति छैन।'
          : 'Permission denied: Your staff role is not authorized to confirm orders.',
        type: 'error'
      });
      return;
    }

    const pendingItems = cartItems.filter(i => i.kotStatus !== 'sent_to_kitchen');
    if (pendingItems.length === 0 && currentOrderId) {
      onSaveOrder({ ...currentOrderObject, id: currentOrderId, updatedAt: new Date().toISOString() }, false, 'occupied');
      if (onNavigateToBilling) {
        onNavigateToBilling();
      } else {
        setMobilePOSTab('cart');
      }
      return;
    }

    const nowIso = new Date().toISOString();
    const kotPrefix = settings.receiptSettings?.kotPrefix || 'KOT-';
    const invPrefix = settings.receiptSettings?.invoicePrefix || 'INV-';
    const nextSerialKOT = onReserveSequence
      ? await onReserveSequence('kot', kotPrefix)
      : getNextKOTNumber(orders, kotPrefix, settings.businessId, true);
    const committedInvoiceNo =
      activeOrderForTable?.invoiceNo ||
      (onReserveSequence
        ? await onReserveSequence('invoice', invPrefix)
        : currentOrderObject.invoiceNo || getNextInvoiceNumber(orders, invPrefix, settings.businessId, true));
    const updatedItems = cartItems.map(item => ({
      ...item,
      kotStatus: 'sent_to_kitchen' as const
    }));
    const orderIdToUse = currentOrderId || activeOrderForTable?.id || ('ord-' + Date.now());

    const confirmedOrder: Order = {
      ...currentOrderObject,
      id: orderIdToUse,
      invoiceNo: committedInvoiceNo,
      items: updatedItems,
      kotNo: currentOrderId ? nextSerialKOT : (currentOrderObject.kotNo || nextSerialKOT),
      status: 'active',
      kotStatus: 'sent_to_kitchen',
      kotSentAt: nowIso,
      updatedAt: nowIso,
      idempotencyKey: `idemp-confirm-${orderIdToUse}-${Date.now()}`
    };

    const confirmedSaved = onSaveOrder(confirmedOrder, false, 'occupied');
    if (!confirmedSaved) return;
    onKOTSent(confirmedOrder);
    soundFX.play('kot');

    setCartItems(updatedItems);
    setCurrentOrderId(confirmedOrder.id);
    setLastDispatchedKOT(confirmedOrder);
    setShowKOTModal(false);

    setStatusBanner({
      text: lang === 'ne'
        ? `अर्डर पुष्टि भई किचेन र अनपेड बिलिङमा सुरक्षित गरियो (${confirmedOrder.kotNo})।`
        : `Order confirmed & sent to kitchen · Saved as Unpaid Bill (${confirmedOrder.kotNo})`,
      type: 'success'
    });
  };

  // Handle Final Payment Settlement (supports both full bill and item-level split bill)
  const handleConfirmSettlement = async (
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
    const settlementCashTendered = paymentRecord?.cashTendered;
    const settlementChangeReturned = paymentRecord?.changeReturned;
    const settlementRef = paymentRecord?.referenceNo;
    const settlementCashier = currentSession?.name || paymentRecord?.staffName;
    const invPrefix = settings.receiptSettings?.invoicePrefix || 'INV-';
    const fiscalYearNow = getNepalFiscalYear();
    const bsDateNow = formatBsIsoDate();

    const triggerHardwareOnSettle = (settledOrd: Order) => {
      const pSet = settings.printerSettings;
      if (!pSet || pSet.connectionType === 'browser') return;
      const hasCash = paymentMethod === 'cash' || (Number(paymentDetails?.cash) || 0) > 0;
      if (pSet.autoPrintReceipt) {
        const bytes = buildEscPosReceiptBytes(settledOrd, settings, {
          width: pSet.paperWidth,
          kickDrawer: hasCash && pSet.autoOpenCashDrawerOnCash
        });
        sendEscPosToHardware(bytes, pSet).catch(() => {});
      } else if (hasCash && pSet.autoOpenCashDrawerOnCash) {
        openCashDrawerHardware(pSet).catch(() => {});
      }
    };

    if (splitCheckoutContext) {
      const baseSplit = splitCheckoutContext.splitOrder;
      const atomicSplitInvoiceNo = onReserveSequence
        ? await onReserveSequence('invoice', invPrefix)
        : baseSplit.invoiceNo;
      const finalizedSplitOrder: Order = {
        ...baseSplit,
        invoiceNo: atomicSplitInvoiceNo,
        fiscalYear: fiscalYearNow,
        bsDate: bsDateNow,
        paymentMethod,
        paymentDetails,
        paidAmount: paidAmount ?? baseSplit.grandTotal,
        dueAmount: dueAmount ?? 0,
        paymentStatus: (dueAmount && dueAmount > 0) ? (paidAmount && paidAmount > 0 ? 'partial' : 'credit') : 'paid',
        paymentRecords: paymentRecord ? [paymentRecord] : [],
        customerId,
        customerName: customerName || baseSplit.customerName,
        customerPhone: customerPhone || baseSplit.customerPhone,
        roomChargeDetails,
        cashTendered: settlementCashTendered,
        changeReturned: settlementChangeReturned,
        paymentReference: settlementRef,
        cashierName: settlementCashier,
        settledAt: nowIsoString(),
        status: 'completed'
      };
      triggerHardwareOnSettle(finalizedSplitOrder);

      const parentOrder = splitCheckoutContext.parentOrder;
      const remainingItems = splitCheckoutContext.remainingItems;
      const parentExistsInStore = orders.some(o => o.id === parentOrder.id);

      let splitSaved = true;
      if (parentExistsInStore && onSettleSplitOrder) {
        splitSaved = onSettleSplitOrder(parentOrder.id, finalizedSplitOrder, remainingItems);
      } else if (remainingItems.length > 0) {
        const isRemTakeaway = parentOrder.orderType === 'takeaway' || parentOrder.orderType === 'delivery';
        const remEnableSC = settings.enableServiceCharge && !isRemTakeaway && !parentOrder.waivedServiceCharge;
        const remEnableVat = settings.enableVat && !parentOrder.waivedVat;
        const remCalc = verifyFinancialCalculations(
          remainingItems,
          menuItems,
          parentOrder.discountPercent || 0,
          isRemTakeaway || Boolean(parentOrder.waivedServiceCharge),
          remEnableSC,
          settings.serviceChargePercent,
          remEnableVat,
          settings.vatRatePercent
        );
        const remainingOrder: Order = {
          ...parentOrder,
          items: remainingItems,
          subtotal: remCalc.verifiedSubtotal,
          discountAmount: remCalc.verifiedDiscountAmount,
          serviceChargeAmount: remCalc.verifiedServiceCharge,
          vatAmount: remCalc.verifiedVat,
          grandTotal: remCalc.verifiedGrandTotal,
          dueAmount: remCalc.verifiedGrandTotal
        };
        onSaveOrder(remainingOrder, false, 'occupied');
        if (onSettleSplitOrder) {
          splitSaved = onSettleSplitOrder(remainingOrder.id, finalizedSplitOrder, remainingItems);
        } else {
          splitSaved = onSaveOrder(finalizedSplitOrder, true, 'occupied');
        }
        if (splitSaved && parentOrder.id === currentOrderObject.id) {
          setCurrentOrderId(remainingOrder.id);
        }
      } else {
        splitSaved = onSaveOrder(finalizedSplitOrder, true, 'available');
      }

      if (!splitSaved) {
        setStatusBanner({
          text: lang === 'ne'
            ? 'स्प्लिट बिल भुक्तानी सम्पन्न हुन सकेन। कृपया माथिको चेतावनी सन्देश जाँच गर्नुहोस्।'
            : 'Split bill settlement could not be completed. Please review the alert banner.',
          type: 'error'
        });
        return;
      }

      triggerHardwareOnSettle(finalizedSplitOrder);
      setSettledOrderForReceipt(finalizedSplitOrder);
      soundFX.play('pay');
      setShowCheckoutModal(false);
      setSplitCheckoutContext(null);
      setShowReceiptModal(true);

      if (
        parentOrder.id === currentOrderObject.id ||
        (orderType === 'dine_in' && parentOrder.tableRoomId === selectedTableRoomId)
      ) {
        if (remainingItems.length > 0) {
          setCartItems(remainingItems);
          setCartCashTender(0);
          setStatusBanner({
            text: lang === 'ne'
              ? `आंशिक बिल चुक्ता भयो (${finalizedSplitOrder.invoiceNo})। बाँकी परिकार टेबलमै सक्रिय छन्।`
              : `Split invoice ${finalizedSplitOrder.invoiceNo} settled! Remaining items stay active on table.`,
            type: 'success'
          });
        } else {
          setCartItems([]);
          setCurrentOrderId(null);
          setDiscountPercent(0);
          setFlatDiscountAmount(0);
          setSpecialNote('');
          setGuestCount(2);
          setCartCashTender(0);
          setAdminWaiveSC(false);
          setAdminWaiveVat(false);
          setAdminCustomDiscountPct(0);
          setAdminPricingNote('');
          setSelectedPaymentMethod('cash');
          setStatusBanner({
            text: lang === 'ne' ? 'सबै परिकार चुक्ता भई टेबल खाली गरियो।' : 'All items settled and table freed.',
            type: 'success'
          });
        }
      } else {
        setStatusBanner({
          text: lang === 'ne'
            ? `स्प्लिट बिल ${finalizedSplitOrder.invoiceNo} चुक्ता भयो।`
            : `Split invoice ${finalizedSplitOrder.invoiceNo} settled.`,
          type: 'success'
        });
      }
      return;
    }

    const committedFinalInvoiceNo =
      activeOrderForTable?.invoiceNo ||
      (onReserveSequence && !currentOrderId
        ? await onReserveSequence('invoice', invPrefix)
        : currentOrderObject.invoiceNo);

    const settledNow = nowIsoString();
    const finalizedOrder: Order = {
      ...currentOrderObject,
      invoiceNo: committedFinalInvoiceNo,
      fiscalYear: fiscalYearNow,
      bsDate: bsDateNow,
      paymentMethod,
      paymentDetails,
      paidAmount: paidAmount ?? currentOrderObject.grandTotal,
      dueAmount: dueAmount ?? 0,
      paymentStatus: (dueAmount && dueAmount > 0) ? (paidAmount && paidAmount > 0 ? 'partial' : 'credit') : 'paid',
      paymentRecords: paymentRecord ? [paymentRecord] : [],
      customerId,
      customerName: customerName || currentOrderObject.customerName,
      customerPhone: customerPhone || currentOrderObject.customerPhone,
      roomChargeDetails,
      cashTendered: settlementCashTendered,
      changeReturned: settlementChangeReturned,
      paymentReference: settlementRef,
      cashierName: settlementCashier,
      settledAt: settledNow,
      updatedAt: settledNow,
      idempotencyKey: `idemp-${currentOrderObject.id}-settle-${paymentRecord?.id || Date.now()}`,
      status: 'completed'
    };

    const settledSaved = onSaveOrder(finalizedOrder, true, 'available');
    if (!settledSaved) {
      setStatusBanner({
        text: lang === 'ne'
          ? 'बिल भुक्तानी सम्पन्न हुन सकेन। कृपया माथिको चेतावनी सन्देश जाँच गर्नुहोस्।'
          : 'Bill settlement could not be completed. Please review the alert banner.',
        type: 'error'
      });
      return;
    }

    triggerHardwareOnSettle(finalizedOrder);
    setSettledOrderForReceipt(finalizedOrder);
    soundFX.play('pay');
    setShowCheckoutModal(false);
    setShowReceiptModal(true);
    setCartItems([]);
    setCurrentOrderId(null);
    setDiscountPercent(0);
    setFlatDiscountAmount(0);
    setCartCashTender(0);
    setGuestCount(2);
    setSpecialNote('');
    setTakeawayCustName('');
    setTakeawayPhone('');
    setDeliveryCustName('');
    setDeliveryPhone('');
    setDeliveryAddress('');
    setDeliveryNotes('');
    setAdminWaiveSC(false);
    setAdminWaiveVat(false);
    setAdminCustomDiscountPct(0);
    setAdminPricingNote('');
    setSelectedPaymentMethod('cash');
    setStatusBanner({
      text: lang === 'ne' ? 'बिल भुक्तानी सम्पन्न भयो र टेबल खाली गरियो।' : 'Bill settled and table freed.',
      type: 'success'
    });
  };

  // Restore and prepare an active order for full settlement in CheckoutModal
  const handleOpenSettleModalForOrder = (order: Order, overrideMethod?: PaymentMethod) => {
    setSplitCheckoutContext(null);
    setCurrentOrderId(order.id);
    setCartItems(order.items);
    setDiscountPercent(order.discountPercent || 0);
    setFlatDiscountAmount(0);
    setGuestCount(order.guestCount || 2);
    setSpecialNote(order.specialInstructions || '');
    if (order.waiterName) setSelectedWaiter(order.waiterName);
    if (overrideMethod) {
      setSelectedPaymentMethod(overrideMethod);
    } else if (order.paymentMethod) {
      setSelectedPaymentMethod(order.paymentMethod);
    }
    setAdminCustomDiscountPct(order.customAdminDiscount || 0);
    setAdminWaiveSC(Boolean(order.waivedServiceCharge));
    setAdminWaiveVat(Boolean(order.waivedVat));
    setAdminPricingNote(order.customAdminDiscountReason || '');

    if (order.orderType === 'dine_in') {
      setOrderType('dine_in');
      setSelectedTableRoomId(order.tableRoomId);
    } else if (order.orderType === 'takeaway') {
      setOrderType('takeaway');
      setTakeawayCustName(order.customerName || '');
      setTakeawayPhone(order.customerPhone || '');
    } else if (order.orderType === 'delivery') {
      setOrderType('delivery');
      setDeliveryCustName(order.customerName || '');
      setDeliveryPhone(order.customerPhone || '');
      if (order.deliveryDetails) {
        setDeliveryAddress(order.deliveryDetails.address || '');
        setDeliveryNotes(order.deliveryDetails.deliveryNotes || '');
      }
    } else {
      setOrderType('dine_in');
      setSelectedTableRoomId(order.tableRoomId);
    }
    setShowCheckoutModal(true);
  };

  // All 10 Categories
  const categories: { id: string; label: string; icon: any }[] = [
    { id: 'favorites', label: lang === 'ne' ? 'मनपर्ने (Favorites)' : 'Favorites', icon: Star },
    { id: 'all', label: 'All Items', icon: UtensilsCrossed },
    { id: 'coffee', label: 'Coffee', icon: Coffee },
    { id: 'tea', label: 'Tea', icon: Coffee },
    { id: 'cold_drinks', label: 'Cold Drinks', icon: Wine },
    { id: 'mocktails', label: 'Mocktails', icon: Wine },
    { id: 'snacks', label: 'Snacks', icon: UtensilsCrossed },
    { id: 'fast_food', label: 'Fast Food', icon: UtensilsCrossed },
    { id: 'nepali_food', label: 'Nepali Food', icon: UtensilsCrossed },
    { id: 'continental', label: 'Continental', icon: UtensilsCrossed },
    { id: 'bakery', label: 'Bakery', icon: Cake },
    { id: 'dessert', label: 'Dessert', icon: Cake }
  ];

  const filteredMenuItems = useMemo(() => {
    return menuItems.filter(item => {
      let matchesCat = true;
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'favorites') {
          const userPrefs = getUserPreferences(currentSession?.staffId);
          matchesCat = userPrefs.favoriteItemIds.includes(item.id) || (userPrefs.favoriteItemIds.length === 0 && item.price > 120);
        } else
        if (selectedCategory === 'coffee') {
          matchesCat = item.category === 'coffee' || item.category === 'cafe_beverages';
        } else if (selectedCategory === 'tea') {
          matchesCat = item.category === 'tea' || (item.category === 'cafe_beverages' && item.name.toLowerCase().includes('tea'));
        } else if (selectedCategory === 'snacks') {
          matchesCat = item.category === 'snacks' || item.category === 'bakery_snacks';
        } else if (selectedCategory === 'nepali_food') {
          matchesCat = item.category === 'nepali_food' || item.category === 'dining_food';
        } else if (selectedCategory === 'dessert') {
          matchesCat = item.category === 'dessert' || item.category === 'desserts';
        } else {
          matchesCat = item.category === selectedCategory;
        }
      }

      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.nepaliName && item.nepaliName.includes(searchQuery)) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      {/* Top-Center Floating Confirmation Toast (unmistakable across mobile & desktop) */}
      {statusBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <div className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 shadow-lg ${
            statusBanner.type === 'error'
              ? 'bg-rose-600 border-rose-700 text-white'
              : statusBanner.type === 'success'
              ? 'bg-emerald-700 border-emerald-800 text-white'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              {statusBanner.type === 'error' ? (
                <AlertCircle className="h-4 w-4 text-rose-100 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-200 shrink-0" />
              )}
              <span className="leading-snug">{statusBanner.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="p-1 rounded-md hover:bg-white/15 shrink-0"
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* POS Top Mode Switcher Bar (Desktop / Tablet) */}
      <div className="hidden lg:flex bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs mb-4 items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-bold w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setPosScreenMode('pos_menu')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              posScreenMode === 'pos_menu'
                ? 'bg-slate-900 text-white shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coffee className="h-4 w-4 text-emerald-400" />
            <span>{lang === 'ne' ? '१. मेनु तथा नयाँ अर्डर' : '1. Order & Menu POS'}</span>
            {cartItems.length > 0 && (
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {cartItems.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPosScreenMode('active_orders_hub')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg transition-all ${
              posScreenMode === 'active_orders_hub'
                ? 'bg-amber-400 text-slate-950 shadow-xs font-black'
                : 'text-slate-700 hover:text-slate-900 font-extrabold'
            }`}
          >
            <Receipt className="h-4 w-4 text-slate-950" />
            <span>{lang === 'ne' ? '२. चालु अर्डर तथा बिलिङ हब' : '2. Active Orders & Live Bills'}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
              posScreenMode === 'active_orders_hub' ? 'bg-slate-900 text-white' : 'bg-amber-400 text-slate-950'
            }`}>
              {activeOrders.length}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
          {canModifyTaxConfig && onUpdateSettings && (
            <button
              type="button"
              onClick={() => setShowTaxSettingsModal(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-bold transition-all ${
                settings.enableVat || settings.enableServiceCharge
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title={lang === 'ne' ? 'भ्याट र सर्भिस चार्ज On/Off वा दर सेटिङ' : 'Configure or toggle VAT & Service Charge'}
            >
              <Percent className="h-3.5 w-3.5 text-amber-700" />
              <span>
                {settings.enableVat || settings.enableServiceCharge
                  ? `${settings.enableVat ? `VAT ${settings.vatRatePercent}%` : 'VAT Off'} · ${settings.enableServiceCharge ? `SC ${settings.serviceChargePercent}%` : 'SC Off'}`
                  : (lang === 'ne' ? 'कर: बन्द (Tax Off)' : 'Tax: Off')}
              </span>
            </button>
          )}

          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextState = !soundMuted;
              setSoundMuted(nextState);
              soundFX.setEnabled(!nextState);
            }}
            className={`p-2 rounded-lg border transition-all ${
              soundMuted 
                ? 'text-slate-400 bg-slate-100 border-slate-300 hover:text-slate-600' 
                : 'text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
            }`}
            title={soundMuted ? (lang === 'ne' ? 'आवाज चालु गर्नुहोस्' : 'Unmute POS sound') : (lang === 'ne' ? 'आवाज बन्द गर्नुहोस्' : 'Mute POS sound')}
          >
            {soundMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-emerald-700" />}
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-slate-500">{lang === 'ne' ? 'चालु रकम:' : 'Live Revenue:'}</span>
            <span className="font-mono-num font-black text-emerald-800 text-xs sm:text-sm">
              {settings.currencySymbol} {totalActiveRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          <button
            type="button"
            onClick={handleStartNewOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs shrink-0"
            title={lang === 'ne' ? 'नयाँ सफा अर्डर सुरु गर्नुहोस्' : 'Start Fresh Clean Order'}
          >
            <Plus className="h-3.5 w-3.5 text-amber-400" />
            <span>{lang === 'ne' ? 'नयाँ अर्डर' : 'New Order'}</span>
          </button>
        </div>
      </div>

      {posScreenMode === 'active_orders_hub' ? (
        <ActiveOrdersModal
          orders={orders}
          tablesRooms={tablesRooms}
          settings={settings}
          lang={lang}
          currentSession={currentSession}
          embedded={true}
          onClose={() => setPosScreenMode('pos_menu')}
          onSelectOrderForPOS={(tableRoomId, orderId) => {
            const ord = orders.find(o => o.id === orderId);
            if (ord) {
              if (ord.orderType === 'dine_in') {
                setOrderType('dine_in');
                setSelectedTableRoomId(tableRoomId);
              } else if (ord.orderType === 'takeaway') {
                setOrderType('takeaway');
              } else if (ord.orderType === 'delivery') {
                setOrderType('delivery');
              } else {
                setOrderType('dine_in');
              }
              setCurrentOrderId(orderId);
              setCartItems(ord.items);
              setDiscountPercent(ord.discountPercent || 0);
              setFlatDiscountAmount(0);
              setGuestCount(ord.guestCount || 2);
              setSpecialNote(ord.specialInstructions || '');
              if (ord.waiterName) setSelectedWaiter(ord.waiterName);
              setPosScreenMode('pos_menu');
              setMobilePOSTab('cart');
            }
          }}
          onOpenSettleModal={(order) => {
            handleOpenSettleModalForOrder(order);
          }}
          onSplitOrder={(order) => {
            setPosScreenMode('pos_menu');
            setSplitTargetOrder(order);
            setShowSplitBillModal(true);
          }}
          onPrintEstimate={(order) => {
            setEstimateOrderTarget(order);
            setShowEstimateModal(true);
          }}
          onShiftTableOrder={onShiftTableOrder}
          onMergeTables={onMergeTables}
          onVoidOrder={onVoidOrder}
          onVoidOrderItem={onVoidOrderItem}
          onAdminUpdatePricing={onAdminUpdatePricing}
          onForceReleaseTable={onForceReleaseTable}
        />
      ) : (
        <>
          {/* Clean Mobile Context Header (< lg screens): Back | Table + Open/Guest | Transfer, Bills, More */}
          <div className="lg:hidden bg-white border border-slate-200 rounded-2xl px-3 py-2.5 mb-2.5 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {onNavigateToTables && (
                <button
                  type="button"
                  onClick={onNavigateToTables}
                  className="h-10 w-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center shrink-0"
                  aria-label="Back to Tables"
                  title={lang === 'ne' ? 'टेबलमा फर्कनुहोस्' : 'Back to Tables'}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}

              <div className="min-w-0 flex-1">
                {orderType === 'dine_in' ? (
                  <select
                    value={selectedTableRoomId}
                    onChange={(e) => {
                      soundFX.play('tap');
                      setSelectedTableRoomId(e.target.value);
                    }}
                    aria-label="Select Dining Table"
                    className="max-w-full bg-transparent text-sm font-black text-slate-900 truncate focus:outline-hidden pr-1"
                  >
                    {diningTables.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.code} · {tr.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm font-black text-slate-900 truncate">
                    {orderType === 'takeaway' ? <ShoppingBag className="h-4 w-4 text-orange-600 shrink-0" /> : <Truck className="h-4 w-4 text-orange-600 shrink-0" />}
                    <span>{orderType === 'takeaway' ? (lang === 'ne' ? 'टेकअवे' : 'Takeaway') : (lang === 'ne' ? 'डेलिभरी' : 'Delivery')}</span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 truncate tabular-nums">
                  <span className={currentOrderId ? 'text-orange-600 font-bold' : 'text-emerald-700 font-bold'}>
                    {currentOrderId ? (lang === 'ne' ? 'खुल्ला बिल' : 'Open') : (lang === 'ne' ? 'नयाँ अर्डर' : 'New')}
                  </span>
                  {orderType === 'dine_in' && (
                    <>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => setGuestCount(g => (g >= 8 ? 1 : g + 1))}
                        className="hover:text-slate-900 underline decoration-dotted"
                        title="Tap to adjust guest count"
                      >
                        {guestCount} {guestCount === 1 ? 'guest' : 'guests'}
                      </button>
                    </>
                  )}
                  <span>·</span>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as 'dine_in' | 'takeaway' | 'delivery')}
                    aria-label="Order Type"
                    className="bg-transparent text-slate-600 font-semibold focus:outline-hidden"
                  >
                    <option value="dine_in">Dine-in</option>
                    <option value="takeaway">Takeaway</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {orderType === 'dine_in' && (
                <button
                  type="button"
                  onClick={() => {
                    setTargetShiftTableId('');
                    setShowShiftTableModal(true);
                  }}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                  title={lang === 'ne' ? 'टेबल सार्नुहोस्' : 'Transfer table'}
                  aria-label="Transfer table"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onNavigateToBilling) {
                    onNavigateToBilling();
                  } else {
                    setShowActiveOrdersModal(true);
                  }
                }}
                className="relative h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                title={lang === 'ne' ? 'अनपेड बिलहरू' : 'Open Bills'}
                aria-label="Open Bills"
              >
                <Receipt className="h-4 w-4" />
                {activeOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center tabular-nums">
                    {activeOrders.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowMobileMoreSheet(true)}
                className="h-10 w-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                aria-label="More POS options"
                title={lang === 'ne' ? 'थप विकल्प' : 'More options'}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Interactive Floor Table Strip: Desktop & Tablet quick switcher */}
          {orderType === 'dine_in' && (
            <div className="hidden lg:block bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 mb-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-950">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-amber-700" />
                  </div>
                  <div>
                    <span className="font-extrabold text-xs text-slate-900">
                      {lang === 'ne' ? 'डाइन-इन टेबल अवस्था (Live Floor Tables):' : 'Dining Floor Tables:'}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-1.5 hidden sm:inline">
                      {lang === 'ne' ? 'सिधै टेबल छान्नुहोस् वा अर्डर हेर्नुहोस्' : 'Tap any table to switch or view running bill'}
                    </span>
                  </div>
                </div>

                {/* Filter Pills & Toggle */}
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setTableBarFilter('all')}
                      className={`px-2 py-0.5 rounded transition-all ${
                        tableBarFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lang === 'ne' ? `सबै (${diningTables.length})` : `All (${diningTables.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableBarFilter('occupied')}
                      className={`px-2 py-0.5 rounded transition-all ${
                        tableBarFilter === 'occupied' ? 'bg-amber-400 text-slate-950 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lang === 'ne' ? `व्यस्त (${activeOrders.filter(o => o.orderType === 'dine_in').length})` : `Running (${activeOrders.filter(o => o.orderType === 'dine_in').length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableBarFilter('available')}
                      className={`px-2 py-0.5 rounded transition-all ${
                        tableBarFilter === 'available' ? 'bg-emerald-600 text-white shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lang === 'ne' ? `खाली (${diningTables.filter(t => t.status === 'available').length})` : `Free (${diningTables.filter(t => t.status === 'available').length})`}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTableBar(!showTableBar)}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded border border-slate-200 bg-slate-50"
                  >
                    {showTableBar ? (lang === 'ne' ? 'लुकाउनुहोस् ▲' : 'Collapse ▲') : (lang === 'ne' ? 'देखाउनुहोस् ▼' : 'Expand ▼')}
                  </button>
                </div>
              </div>

              {showTableBar && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  {diningTables
                    .filter(table => {
                      if (tableBarFilter === 'occupied') {
                        return table.status === 'occupied' || table.status === 'waiting_for_bill';
                      }
                      if (tableBarFilter === 'available') {
                        return table.status === 'available';
                      }
                      return true;
                    })
                    .map(table => {
                      const isSelected = selectedTableRoomId === table.id;
                      const activeTableOrder = orders.find(o => o.tableRoomId === table.id && o.status === 'active');
                      const isWaitingBill = table.status === 'waiting_for_bill';
                      const isOccupied = table.status === 'occupied' || !!activeTableOrder;

                      return (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => {
                            soundFX.play('tap');
                            setSelectedTableRoomId(table.id);
                          }}
                          className={`shrink-0 px-3 py-2 rounded-xl text-left border transition-all relative ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-400/80'
                              : isWaitingBill
                              ? 'bg-rose-50 border-rose-300 text-rose-950 hover:bg-rose-100'
                              : isOccupied
                              ? 'bg-amber-50/90 border-amber-300 text-amber-950 hover:bg-amber-100 hover:border-amber-400'
                              : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-xs truncate max-w-[100px] flex items-center gap-1">
                              {isSelected && <span className="text-amber-400">✓</span>}
                              <span>{table.name}</span>
                            </span>
                            <span className={`h-2 w-2 rounded-full shrink-0 ${
                              isWaitingBill ? 'bg-rose-600' : isOccupied ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                            {activeTableOrder ? (
                              <span className={`font-mono-num font-black ${isSelected ? 'text-amber-300' : 'text-emerald-800'}`}>
                                {settings.currencySymbol} {activeTableOrder.grandTotal.toFixed(0)}
                              </span>
                            ) : (
                              <span className={`font-semibold ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                                {table.capacity} {lang === 'ne' ? 'खाली' : 'Free'}
                              </span>
                            )}
                            {isWaitingBill && (
                              <span className="font-bold text-rose-700 bg-rose-100 px-1 rounded text-[9px]">
                                Bill
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Mobile Screen POS Switcher: Menu vs Cart */}
          <div className="lg:hidden flex items-center bg-slate-200/90 p-1 rounded-xl gap-1 text-xs font-bold mb-3 shadow-2xs">
            <button
              type="button"
              onClick={() => setMobilePOSTab('menu')}
              className={'flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ' + (mobilePOSTab === 'menu' ? 'bg-white text-orange-600 shadow-2xs font-black' : 'text-slate-600')}
            >
              <UtensilsCrossed className="h-4 w-4" />
              <span>{lang === 'ne' ? 'मेनु परिकार' : 'Menu Catalog'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                {filteredMenuItems.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobilePOSTab('cart')}
              className={'flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 relative ' + (mobilePOSTab === 'cart' ? 'bg-white text-orange-600 shadow-2xs font-black' : 'text-slate-600')}
            >
              <Receipt className="h-4 w-4" />
              <span>{lang === 'ne' ? 'चालु बिल' : 'Order Cart'}</span>
              {cartItems.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-orange-600 text-white">
                  {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>

          <div className="grid grid-cols-12 gap-2 sm:gap-3 lg:gap-4 items-start">
        {/* LEFT COLUMN: Menu Categories & Items - Responsive Side-by-Side */}
        <div className={`space-y-3 pb-36 lg:pb-8 ${mobilePOSTab === 'cart' ? 'hidden lg:block' : 'block'} ${
          columnSplit === 'balanced' 
            ? 'col-span-12 lg:col-span-7 xl:col-span-8' 
            : columnSplit === 'menu_focus'
            ? 'col-span-12 lg:col-span-8 xl:col-span-9'
            : 'col-span-12 lg:col-span-5 xl:col-span-5'
        }`}>
          {/* Search & Category Filter Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="pos-search-input"
                  type="text"
                  placeholder={t.searchMenu}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* High-visibility Active Orders Button */}
              <button
                type="button"
                onClick={() => setShowActiveOrdersModal(true)}
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg whitespace-nowrap shrink-0 border border-amber-500 transition-all shadow-xs ring-2 ring-amber-400/20"
                title="View all live running orders and active table bills"
              >
                <Receipt className="h-4 w-4 text-slate-950" />
                <span>{lang === 'ne' ? `⚡ चालु अर्डर (${activeOrders.length})` : `⚡ Active Bills (${activeOrders.length})`}</span>
                {activeOrders.length > 0 && (
                  <span className="font-mono-num font-black text-[11px] bg-slate-900 text-white px-1.5 py-0.2 rounded">
                    {settings.currencySymbol} {totalActiveRevenue.toFixed(0)}
                  </span>
                )}
              </button>
            </div>

            {/* Row 1: Category Segmented Buttons + View Mode / Manage Menu */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 flex-1 min-w-0">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-2xs font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setMenuViewMode('photos')}
                    className={`p-1.5 rounded-md transition-colors ${
                      menuViewMode === 'photos'
                        ? 'bg-white shadow-2xs text-emerald-800 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={lang === 'ne' ? 'फोटो सहित ग्रिड भ्यू' : 'Photo Grid View'}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuViewMode('compact')}
                    className={`p-1.5 rounded-md transition-colors ${
                      menuViewMode === 'compact'
                        ? 'bg-white shadow-2xs text-emerald-800 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title={lang === 'ne' ? 'कम्प्याक्ट सूची भ्यू' : 'Compact List View'}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMenuManagerModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-950 bg-emerald-100/90 hover:bg-emerald-200 rounded-lg whitespace-nowrap shrink-0 border border-emerald-300 transition-colors shadow-2xs"
                  title="Admin: Edit menu items, prices, names and photos"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-800" />
                  <span className="hidden sm:inline">{lang === 'ne' ? 'मेनु सम्पादन' : 'Manage Menu'}</span>
                </button>
              </div>
            </div>

            {/* Row 2: Popular Fast-Order Quick Picks */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none">
              <span className="text-[10px] font-black uppercase text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg shrink-0 flex items-center gap-1">
                <Zap className="h-3 w-3 fill-orange-500" />
                <span>{lang === 'ne' ? 'द्रुत अर्डर' : 'Quick Picks'}</span>
              </span>
              {menuItems.filter(i => i.isAvailable !== false).slice(0, 6).map(item => (
                <button
                  key={'quick-' + item.id}
                  type="button"
                  onClick={() => {
                    soundFX.play('add');
                    handleItemClick(item);
                  }}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-lg text-slate-800 transition-colors active:scale-95"
                  title={'Add 1x ' + item.name}
                >
                  <span className="truncate max-w-[120px]">{lang === 'ne' && item.nepaliName ? item.nepaliName : item.name}</span>
                  <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100/70 px-1 rounded font-mono-num">
                    {settings.currencySymbol}{item.price}
                  </span>
                  <span className="text-emerald-600 font-black">+</span>
                </button>
              ))}
            </div>
          </div>

          {/* Always-Visible Mobile "On this order" Live Staging Card (< lg) */}
          <div className="lg:hidden bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
              <button
                type="button"
                onClick={() => setShowMobileOrderSummary(prev => !prev)}
                className="flex items-center gap-2 min-w-0 text-left flex-1"
              >
                <span className="text-xs font-black text-slate-900 truncate">
                  {lang === 'ne' ? 'यो अर्डरमा' : 'On this order'}
                </span>
                {cartItems.length > 0 && (
                  <span className="font-mono-num text-[11px] font-bold text-slate-500 tabular-nums">
                    ({cartItems.reduce((s, i) => s + i.quantity, 0)} · {settings.currencySymbol} {grandTotal.toFixed(0)})
                  </span>
                )}
                {cartItems.length > 0 && (
                  showMobileOrderSummary ? (
                    <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  )
                )}
              </button>

              {(cartItems.length > 0 || currentOrderId) && (
                <button
                  type="button"
                  onClick={() => {
                    const ordId = currentOrderId || activeOrderForTable?.id;
                    if (ordId && isAdminOrManager) {
                      setVoidTargetOrderIdInPOS(ordId);
                      setVoidReasonInPOS('Customer cancelled / अर्डर रद्द');
                      setCustomVoidReasonInPOS('');
                    } else if (!currentOrderId) {
                      handleClearCart();
                    } else {
                      setStatusBanner({
                        text: lang === 'ne'
                          ? 'पठाइसकिएको अर्डर रद्द गर्न एडमिन/म्यानेजर चाहिन्छ।'
                          : 'Confirmed orders require Manager permission to void.',
                        type: 'error'
                      });
                    }
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 whitespace-nowrap shrink-0"
                >
                  {lang === 'ne' ? 'अर्डर रद्द' : 'Cancel order'}
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-slate-500">
                {lang === 'ne'
                  ? 'अहिले खाली छ — तलको मेनुबाट परिकार थप्नुहोस्।'
                  : 'Nothing yet — add dishes from the menu below.'}
              </div>
            ) : showMobileOrderSummary ? (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto px-3.5 py-1">
                {cartItems.map((item, idx) => {
                  const noteCfg = getItemNoteConfig(item);
                  const isNoteOpen = expandedNoteItemId === item.id;
                  return (
                    <div key={`${item.id}-${idx}`} className="py-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 truncate">{item.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                              item.kotStatus === 'sent_to_kitchen'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-orange-50 text-orange-700'
                            }`}>
                              {item.kotStatus === 'sent_to_kitchen' ? 'Sent' : 'New'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono-num text-slate-500 tabular-nums">
                            {settings.currencySymbol} {(item.price * item.quantity).toFixed(0)}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(idx, -1)}
                              className="h-7 w-7 flex items-center justify-center rounded-md bg-white text-slate-900 font-bold"
                              aria-label={`Decrease ${item.name}`}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center font-black font-mono-num text-xs tabular-nums">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(idx, 1)}
                              className="h-7 w-7 flex items-center justify-center rounded-md bg-white text-slate-900 font-bold"
                              aria-label={`Increase ${item.name}`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedNoteItemId(prev => prev === item.id ? null : item.id)}
                            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
                              item.notes || isNoteOpen
                                ? 'bg-orange-50 border-orange-300 text-orange-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900'
                            }`}
                            title={lang === 'ne' ? 'नोट थप्नुहोस्' : 'Add item note'}
                            aria-label={`Note for ${item.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {isNoteOpen && (
                        <div className="pt-1 space-y-1">
                          <input
                            type="text"
                            placeholder={noteCfg.placeholder}
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                            className="text-xs w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-hidden text-slate-800"
                          />
                          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-[10px]">
                            {noteCfg.chips.map((chip) => {
                              const active = isChipActive(item.notes, chip.val);
                              return (
                                <button
                                  key={chip.label}
                                  type="button"
                                  onClick={() => {
                                    handleUpdateItemNote(idx, toggleNoteChip(item.notes, chip.val));
                                    soundFX.play('tap');
                                  }}
                                  className={`shrink-0 px-2 py-0.5 rounded border ${
                                    active
                                      ? 'bg-slate-900 text-white border-slate-900 font-bold'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {chip.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Results Count Header */}
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-slate-500 tabular-nums">
            <span>
              {lang === 'ne'
                ? `${filteredMenuItems.length} परिकार उपलब्ध`
                : `${filteredMenuItems.length} result${filteredMenuItems.length === 1 ? '' : 's'} available`}
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-orange-600 hover:underline font-bold"
              >
                {lang === 'ne' ? 'सबै हेर्नुहोस्' : 'Clear filter'}
              </button>
            )}
          </div>

          {/* Menu Items Grid */}
          <div className={menuViewMode === 'photos' 
            ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5"
            : "grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2.5"
          }>
            {filteredMenuItems.map((item) => {
              const hasOptions = (item.variants && item.variants.length > 0) || (item.addOns && item.addOns.length > 0);
              const imageUrl = getMenuItemImageUrl(item);
              const inCartQty = cartQtyByMenuItem[item.id] || 0;

              if (menuViewMode === 'photos') {
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`bg-white rounded-xl border overflow-hidden hover:border-emerald-600 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group active:scale-[0.99] relative ${
                      inCartQty > 0 ? 'border-emerald-600 ring-1 ring-emerald-500/30' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Photo Thumbnail */}
                      <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                        <img 
                          src={imageUrl} 
                          alt={item.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <span className="absolute top-2 left-2 font-mono-num font-bold text-[10px] text-white bg-slate-950/80 backdrop-blur-xs px-2 py-0.5 rounded shadow-xs">
                          {item.code}
                        </span>

                        {inCartQty > 0 && (
                          <span className="absolute bottom-2 left-2 font-mono-num font-black text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded shadow-xs">
                            {inCartQty}x
                          </span>
                        )}

                        {/* Offer Badge if on offer */}
                        {item.isOffer && item.offerPrice ? (
                          <span className="absolute top-2 right-2 font-black text-[9px] uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-md flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 inline" />
                            <span>{item.offerLabel || `${item.discountPercent || Math.round((1 - item.offerPrice / item.price) * 100)}% OFF`}</span>
                          </span>
                        ) : null}

                        {/* Price Badge */}
                        <div className="absolute bottom-2 right-2 font-mono-num flex items-center gap-1 bg-slate-950/90 backdrop-blur-xs px-2.5 py-0.5 rounded-md shadow-xs">
                          {item.isOffer && item.offerPrice ? (
                            <>
                              <span className="line-through text-slate-400 text-[10px] font-bold">
                                {settings.currencySymbol}{item.price}
                              </span>
                              <span className="font-black text-xs text-amber-300">
                                {settings.currencySymbol}{item.offerPrice}
                              </span>
                            </>
                          ) : (
                            <span className="font-black text-xs text-emerald-400">
                              {settings.currencySymbol} {item.price}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-3">
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-emerald-800 transition-colors line-clamp-1 flex-1">
                            {item.name}
                          </h4>
                          {isAdminOrManager && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuEditingItem(item);
                                setShowMenuManagerModal(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-emerald-800 hover:bg-slate-100 transition-colors shrink-0"
                              title={lang === 'ne' ? 'एडमिन: यो परिकार सम्पादन गर्नुहोस्' : 'Admin: Edit this dish'}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {item.nepaliName && (
                          <p className="text-xs text-slate-500 font-normal mt-0.5 line-clamp-1">
                            {item.nepaliName}
                          </p>
                        )}
                        {item.description && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {item.category.replace(/_/g, ' ')}
                      </span>
                      {inCartQty > 0 && !hasOptions ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center bg-emerald-50 border border-emerald-300 rounded-lg p-0.5 shrink-0"
                        >
                          <button
                            type="button"
                            onClick={() => handleDecrementMenuItem(item.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-md bg-white text-slate-900 hover:bg-rose-50 hover:text-rose-700 font-bold"
                            aria-label={`Decrease ${item.name}`}
                          >
                            <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                          <span className="w-6 text-center font-mono-num font-black text-xs text-emerald-900 tabular-nums">
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleItemClick(item)}
                            className="h-7 w-7 flex items-center justify-center rounded-md bg-emerald-700 text-white hover:bg-emerald-800 font-bold"
                            aria-label={`Increase ${item.name}`}
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick(item);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap"
                        >
                          {hasOptions ? <Layers className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          <span>{hasOptions ? 'Options' : (lang === 'ne' ? 'थप्नुहोस्' : 'Add')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // Compact Fast-Service 2-Column Mode (matches mobile quick-add card UX)
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`bg-white rounded-2xl border p-3 hover:border-orange-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2.5 group active:scale-[0.99] relative ${
                    inCartQty > 0 ? 'border-orange-500 ring-1 ring-orange-500/20 bg-orange-50/20' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <img 
                      src={imageUrl} 
                      alt={item.name}
                      className="hidden sm:block h-11 w-11 rounded-lg object-cover shrink-0 bg-slate-100 border border-slate-200"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 group-hover:text-orange-700 transition-colors">
                          {item.name}
                        </h4>
                        {isAdminOrManager && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuEditingItem(item);
                              setShowMenuManagerModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-900 rounded-md shrink-0"
                            title={lang === 'ne' ? 'एडमिन सम्पादन' : 'Admin: Edit dish'}
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5 capitalize">
                        {lang === 'ne' && item.nepaliName ? item.nepaliName : item.category.replace(/_/g, ' ')}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {item.isOffer && item.offerPrice ? (
                          <>
                            <span className="line-through text-slate-400 text-[10px] font-mono-num">
                              {settings.currencySymbol}{item.price}
                            </span>
                            <span className="font-mono-num font-black text-xs sm:text-sm text-rose-700 tabular-nums">
                              {settings.currencySymbol} {item.offerPrice}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono-num font-black text-xs sm:text-sm text-slate-950 tabular-nums">
                            {settings.currencySymbol} {item.price}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {inCartQty > 0 && !hasOptions ? (
                      <>
                        <div className="inline-flex items-center bg-white border border-orange-300 rounded-xl p-0.5 flex-1 justify-between">
                          <button
                            type="button"
                            onClick={() => handleDecrementMenuItem(item.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-900 hover:bg-rose-50 hover:text-rose-700 font-bold"
                            aria-label={`Decrease ${item.name}`}
                          >
                            <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                          <span className="px-1 text-center font-mono-num font-black text-xs text-slate-900 tabular-nums">
                            {inCartQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleItemClick(item)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-orange-500 text-white hover:bg-orange-600 font-bold"
                            aria-label={`Increase ${item.name}`}
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const targetCi = cartItems.find(ci => ci.menuItemId === item.id);
                            if (targetCi) {
                              setExpandedNoteItemId(targetCi.id);
                              setShowMobileOrderSummary(true);
                            }
                          }}
                          className="h-9 w-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"
                          title={lang === 'ne' ? 'नोट थप्नुहोस्' : 'Edit item note'}
                          aria-label={`Edit note for ${item.name}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        {hasOptions ? <Layers className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        <span>{hasOptions ? 'Options' : (lang === 'ne' ? 'थप्नुहोस्' : 'Add')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMenuItems.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
              कुनै परिकार भेटिएन (No menu items match your search)
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Order / Bill Cart Panel - Unconstrained scroll on Mobile, Sticky on Desktop */}
        <div className={`lg:sticky lg:top-3 z-10 flex flex-col lg:h-[calc(100vh-4.75rem)] lg:min-h-[520px] lg:max-h-[calc(100vh-4.75rem)] pb-24 lg:pb-0 ${mobilePOSTab === 'menu' ? 'hidden lg:flex' : 'flex'} ${
          columnSplit === 'balanced' 
            ? 'col-span-12 lg:col-span-5 xl:col-span-4' 
            : columnSplit === 'menu_focus'
            ? 'col-span-12 lg:col-span-4 xl:col-span-3'
            : 'col-span-12 lg:col-span-7 xl:col-span-7'
        }`}>
          <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden flex flex-col lg:h-full min-h-0">
            {/* Tier 1: Billing Cart Header Bar - Desktop */}
            <div className="hidden lg:flex bg-slate-900 text-white px-3 py-2 items-center justify-between border-b border-slate-800 text-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 rounded bg-amber-400 text-slate-950 font-black shrink-0">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-xs text-white leading-tight flex items-center gap-1">
                    <span className="truncate">{lang === 'ne' ? 'बिलिङ सेक्सन' : 'Live Billing'}</span>
                    {cartItems.length > 0 && (
                      <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                        {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
                      </span>
                    )}
                  </h3>
                  <p className="text-[9px] text-slate-400 truncate">
                    {lang === 'ne' ? 'चालू अर्डर र भुक्तानी' : 'Active Bill & Settle'}
                  </p>
                </div>
              </div>

              {/* Quick Split Ratio / Expand Toggle */}
              <button
                type="button"
                onClick={() => setColumnSplit(prev => prev === 'cart_focus' ? 'balanced' : 'cart_focus')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold border border-slate-700 transition-colors shrink-0"
                title="Toggle column size"
              >
                {columnSplit === 'cart_focus' ? '50:50' : (lang === 'ne' ? 'ठूलो' : 'Expand')}
              </button>
            </div>

            {/* Quick Switcher for Running Active Orders (Desktop) */}
            {activeOrders.length > 0 && (
              <div className="hidden lg:flex px-2.5 py-1.5 bg-slate-800 border-b border-slate-700 items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px] shrink-0">
                <span className="text-amber-400 font-extrabold shrink-0 text-[10px] uppercase flex items-center gap-0.5">
                  <span>⚡</span>
                  <span>{lang === 'ne' ? 'चालु:' : 'Live:'}</span>
                </span>
                {activeOrders.map(ao => {
                  const isSelected = (currentOrderId === ao.id) || (orderType === 'dine_in' && selectedTableRoomId === ao.tableRoomId);
                  return (
                    <button
                      key={ao.id}
                      type="button"
                      onClick={() => {
                        if (ao.orderType === 'dine_in') {
                          setOrderType('dine_in');
                          setSelectedTableRoomId(ao.tableRoomId);
                        } else if (ao.orderType === 'takeaway') {
                          setOrderType('takeaway');
                        } else if (ao.orderType === 'delivery') {
                          setOrderType('delivery');
                        } else {
                          setOrderType('dine_in');
                        }
                        setCurrentOrderId(ao.id);
                        setCartItems(ao.items);
                        setDiscountPercent(ao.discountPercent || 0);
                        setFlatDiscountAmount(0);
                        setGuestCount(ao.guestCount || 2);
                        setSpecialNote(ao.specialInstructions || '');
                        if (ao.waiterName) setSelectedWaiter(ao.waiterName);
                      }}
                      className={`shrink-0 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 shadow-2xs font-black'
                          : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      }`}
                    >
                      <span className="truncate max-w-[85px]">{ao.tableRoomName || ao.invoiceNo}</span>
                      <span className="font-mono-num text-[10px] font-bold opacity-85">
                        {settings.currencySymbol}{ao.grandTotal.toFixed(0)}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowActiveOrdersModal(true)}
                  className="shrink-0 px-2 py-0.5 rounded-md font-bold bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 border border-amber-400/40 text-[10px]"
                >
                  {lang === 'ne' ? 'सबै (' + activeOrders.length + ') →' : 'All (' + activeOrders.length + ') →'}
                </button>
              </div>
            )}

            {/* Compact Order Type Selector (Desktop - mobile uses top context bar) */}
            <div className="hidden lg:flex p-2 bg-slate-900 text-white border-b border-slate-800 items-center justify-between shrink-0">
              <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setOrderType('dine_in')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    orderType === 'dine_in' ? 'bg-amber-400 text-slate-950 shadow-2xs font-extrabold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <UtensilsCrossed className="h-3 w-3" />
                  <span>Dine-In</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('takeaway')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    orderType === 'takeaway' ? 'bg-amber-400 text-slate-950 shadow-2xs font-extrabold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ShoppingBag className="h-3 w-3" />
                  <span>Takeaway</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    orderType === 'delivery' ? 'bg-amber-400 text-slate-950 shadow-2xs font-extrabold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Truck className="h-3 w-3" />
                  <span>Delivery</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleStartNewOrder}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors shadow-2xs"
                title={lang === 'ne' ? 'नयाँ अर्डर सुरु गर्नुहोस्' : 'Start Fresh Order'}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{lang === 'ne' ? '+ नयाँ' : '+ New'}</span>
              </button>
            </div>

            {/* Compact Context Header: Table, Waiter, PAX and Order Metadata */}
            <div className="p-2 border-b border-slate-200 bg-slate-50 text-xs shrink-0 space-y-1.5">
              {orderType === 'dine_in' && (
                <>
                  <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Table</label>
                      <select
                        value={selectedTableRoomId}
                        onChange={(e) => setSelectedTableRoomId(e.target.value)}
                        className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded px-1.5 py-1 focus:ring-1 focus:ring-emerald-500"
                      >
                        {diningTables.map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.name} {tr.status === 'occupied' ? '• Busy' : '• Free'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          {lang === 'ne' ? 'वेटर' : 'Waiter'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowWaiterManageModal(true)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 hover:underline"
                          title="Edit or Add Waiter Name"
                        >
                          <Edit2 className="h-2.5 w-2.5" />
                          <span>{lang === 'ne' ? 'नाम' : 'Edit'}</span>
                        </button>
                      </div>
                      <select
                        value={selectedWaiter}
                        onChange={(e) => setSelectedWaiter(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-500"
                      >
                        {availableWaiters.map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 uppercase">
                        <Users className="h-2.5 w-2.5" />
                        <span>PAX</span>
                      </label>
                      <select
                        value={guestCount}
                        onChange={(e) => setGuestCount(Number(e.target.value) || 2)}
                        className="w-full text-xs font-mono-num font-bold text-slate-900 bg-white border border-slate-300 rounded px-1 py-1 focus:ring-1 focus:ring-emerald-500"
                        title="Guests at table (PAX)"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5 border-t border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap font-mono-num">
                      <span className="font-bold text-slate-800">{currentOrderObject.invoiceNo}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-amber-800">{currentOrderObject.kotNo}</span>
                      {currentOrderId && (
                        <span className="font-sans text-[10px] font-bold text-emerald-700">
                          · Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500">Pri:</span>
                      <select
                        value={kotPriority}
                        onChange={(e) => setKotPriority(e.target.value as any)}
                        className="text-[10px] font-bold bg-white border border-slate-300 rounded px-1 py-0.5 uppercase"
                      >
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                        <option value="vip">VIP</option>
                      </select>
                    </div>
                  </div>

                  {/* Table Operations Toolbar: Shift, Merge, Split, Admin Overrides (Desktop - accessible in More sheet on mobile) */}
                  <div className="hidden lg:flex items-center gap-1 pt-1.5 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetShiftTableId('');
                        setShowShiftTableModal(true);
                      }}
                      className="flex-1 py-1 px-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 transition-colors shadow-2xs"
                      title="Transfer table order to another table"
                    >
                      <ArrowRightLeft className="h-3 w-3 text-indigo-600" />
                      <span>{lang === 'ne' ? 'सार्ने' : 'Shift'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMergeTargetTableId('');
                        setShowMergeModal(true);
                      }}
                      className="flex-1 py-1 px-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 transition-colors shadow-2xs"
                      title="Merge with another active table bill"
                    >
                      <Merge className="h-3 w-3 text-amber-600" />
                      <span>{lang === 'ne' ? 'मर्ज' : 'Merge'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={cartItems.length === 0}
                      onClick={() => {
                        setSplitTargetOrder(null);
                        setShowSplitBillModal(true);
                      }}
                      className="flex-1 py-1 px-1.5 bg-white hover:bg-emerald-50 border border-slate-300 rounded text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1 transition-colors shadow-2xs disabled:opacity-40"
                      title="Split bill by Item, Equal PAX, or Custom Amount"
                    >
                      <Split className="h-3 w-3 text-emerald-600" />
                      <span>{lang === 'ne' ? 'टुक्राउने' : 'Split'}</span>
                    </button>

                    {isAdminOrManager && (
                      <button
                        type="button"
                        onClick={() => setShowAdminPricingModal(true)}
                        className={`py-1 px-2 rounded text-[10px] font-bold flex items-center gap-1 transition-colors shadow-2xs ${
                          adminCustomDiscountPct > 0 || adminWaiveSC || adminWaiveVat
                            ? 'bg-indigo-700 text-white shadow-xs'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}
                        title="Admin Pricing Override: Custom Discount, Waive SC / VAT"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        <span>Admin</span>
                      </button>
                    )}
                  </div>
                </>
              )}

              {orderType === 'takeaway' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Customer Name:</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh"
                      value={takeawayCustName}
                      onChange={(e) => setTakeawayCustName(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Phone:</label>
                    <input
                      type="tel"
                      placeholder="98XXXXXXXX"
                      value={takeawayPhone}
                      onChange={(e) => setTakeawayPhone(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono-num"
                    />
                  </div>
                </div>
              )}

              {orderType === 'delivery' && (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Customer Name *"
                      value={deliveryCustName}
                      onChange={(e) => setDeliveryCustName(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="Phone *"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono-num"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Delivery Destination Address *"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                  />
                </div>
              )}
            </div>

            {/* Tier 2: Scrollable Center - Cart Items & Modifiers (Smooth independent scrolling) */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-2 sm:p-2.5 bg-slate-100/70 scrollbar-thin">
              {cartItems.length === 0 ? (
                <div className="h-full min-h-[140px] flex flex-col items-center justify-center py-6 text-center text-slate-400">
                  <UtensilsCrossed className="h-7 w-7 stroke-1 mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">{t.emptyCart}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.selectItems}</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById('pos-search-input')?.focus()}
                    className="mt-2.5 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-bold shadow-xs flex items-center gap-1"
                  >
                    <Coffee className="h-3 w-3 text-emerald-400" />
                    <span>{lang === 'ne' ? '🍽️ मेनु खोज्नुहोस्' : '🍽️ Browse Menu'}</span>
                  </button>
                </div>
              ) : (
                cartItems.map((item, idx) => (
                  <div 
                    key={item.id} 
                    className="p-2 sm:p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5 transition-all hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="h-4 w-4 rounded-full bg-slate-900 text-white font-mono-num font-bold text-[9px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-extrabold text-slate-950 leading-tight truncate">
                            {item.name}
                          </p>
                          {item.kotStatus === 'sent_to_kitchen' ? (
                            <span className="text-[8px] sm:text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1 py-0.2 rounded shrink-0">
                              ✓ {lang === 'ne' ? 'पठाइयो' : 'Sent'}
                            </span>
                          ) : (
                            <span className="text-[8px] sm:text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded shrink-0">
                              ★ {lang === 'ne' ? 'नयाँ' : 'New'}
                            </span>
                          )}
                          {item.isOffer && (
                            <span className="text-[8px] sm:text-[9px] font-bold text-rose-800 bg-rose-100 border border-rose-300 px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5">
                              <span>🏷️</span>
                              <span>{item.offerLabel || 'Offer'}</span>
                            </span>
                          )}
                        </div>
                        {item.nepaliName && item.nepaliName !== item.name && (
                          <p className="text-[10px] sm:text-[11px] font-medium text-slate-600 pl-5 truncate">{item.nepaliName}</p>
                        )}
                        {item.selectedVariant && (
                          <p className="text-[10px] text-indigo-700 font-bold pl-5 truncate">
                            Size: {item.selectedVariant.name}
                          </p>
                        )}
                        {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                          <p className="text-[10px] text-slate-600 pl-5 truncate">
                            + {item.selectedAddOns.map(a => a.name).join(', ')}
                          </p>
                        )}
                        {editingItemPriceIdx === idx ? (
                          <div className="flex items-center gap-1 pl-5 pt-1">
                            <span className="text-[10px] font-bold text-slate-500">{settings.currencySymbol}</span>
                            <NumberInput
                              min={0}
                              value={tempPriceValue}
                              onValueChange={(val) => setTempPriceValue(val)}
                              className="w-16 px-1 py-0.5 text-xs font-bold font-mono border border-indigo-400 rounded bg-white text-slate-900"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setCartItems(prev => prev.map((it, i) => i === idx ? { ...it, price: Math.max(0, tempPriceValue) } : it));
                                setEditingItemPriceIdx(null);
                              }}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-2xs"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemPriceIdx(null)}
                              className="px-1.5 py-0.5 text-slate-500 hover:text-slate-800 text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pl-5 pt-0.5">
                            <p className="text-xs font-mono-num font-bold">
                              {item.originalPrice && item.originalPrice > item.price ? (
                                <>
                                  <span className="line-through text-slate-400 text-[10px] mr-1">
                                    {settings.currencySymbol}{item.originalPrice}
                                  </span>
                                  <span className="text-rose-700 font-black">
                                    {settings.currencySymbol}{item.price}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-800">
                                  {settings.currencySymbol} {item.price}
                                </span>
                              )}
                            </p>
                            {isAdminOrManager && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemPriceIdx(idx);
                                  setTempPriceValue(item.price);
                                }}
                                className="text-[9px] text-indigo-600 hover:text-indigo-800 hover:underline font-bold flex items-center gap-0.5"
                                title="Admin: Override unit price"
                              >
                                <Edit3 className="h-2.5 w-2.5" />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity Controls - Compact High Contrast */}
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 shadow-2xs shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, -1)}
                          className="h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-900 font-bold transition-colors shadow-2xs"
                          title="Decrease quantity"
                        >
                          <Minus className="h-3 w-3 stroke-[2.5]" />
                        </button>
                        <span className="w-5 sm:w-6 text-center text-xs font-black font-mono-num text-slate-950">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, 1)}
                          className="h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-900 font-bold transition-colors shadow-2xs"
                          title="Increase quantity"
                        >
                          <Plus className="h-3 w-3 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Subtotal, Note Toggle & Delete Action */}
                      <div className="text-right pl-1 flex flex-col items-end justify-between min-h-[46px] shrink-0 gap-1">
                        <p className="text-xs font-black font-mono-num text-emerald-800">
                          {settings.currencySymbol} {(item.price * item.quantity).toFixed(0)}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setExpandedNoteItemId(prev => prev === item.id ? null : item.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                              item.notes || expandedNoteItemId === item.id
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                            title="Add kitchen / bar preparation note"
                          >
                            {item.notes ? 'Note ✓' : '+ Note'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-rose-600 hover:text-white hover:bg-rose-600 rounded-md transition-colors border border-rose-200 hover:border-rose-600 shadow-2xs"
                            title="Delete / Remove item"
                          >
                            <Trash2 className="h-3 w-3 stroke-[2.2]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {item.notes && expandedNoteItemId !== item.id && (
                      <button
                        type="button"
                        onClick={() => setExpandedNoteItemId(item.id)}
                        className="text-left w-full pl-5 text-[10px] text-amber-800 italic truncate hover:underline"
                      >
                        • {item.notes}
                      </button>
                    )}

                    {/* Collapsible Quick Kitchen / Bar Instruction Input & Preset Modifier Chips */}
                    {expandedNoteItemId === item.id && (() => {
                      const noteCfg = getItemNoteConfig(item);
                      return (
                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              placeholder={noteCfg.placeholder}
                              value={item.notes || ''}
                              onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                              className="text-[10px] sm:text-[11px] w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 focus:bg-white focus:outline-hidden text-slate-800 font-medium"
                            />
                          </div>
                          <div className="flex items-center gap-1 overflow-x-auto pl-3 scrollbar-none text-[8px] sm:text-[9px]">
                            {noteCfg.chips.map((chip) => {
                              const active = isChipActive(item.notes, chip.val);
                              return (
                                <button
                                  key={chip.label}
                                  type="button"
                                  onClick={() => {
                                    const nextNote = toggleNoteChip(item.notes, chip.val);
                                    handleUpdateItemNote(idx, nextNote);
                                    soundFX.play('tap');
                                  }}
                                  className={`shrink-0 px-1.5 py-0.5 rounded border transition-colors ${
                                    active
                                      ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 font-medium'
                                  }`}
                                  title={`Toggle: ${chip.val}`}
                                >
                                  {chip.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))
              )}

              {/* Discount Selector & Admin Override in Scrollable Area */}
              <div className="space-y-1.5 bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-bold text-xs">{t.discount}:</span>
                    {/* Toggle % vs Flat रु */}
                    <div className="flex bg-slate-100 p-0.5 rounded border border-slate-300 text-[9px] font-black">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountMode('percent');
                          soundFX.play('tap');
                        }}
                        className={`px-1.5 py-0.5 rounded transition-all ${discountMode === 'percent' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600'}`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountMode('flat');
                          soundFX.play('tap');
                        }}
                        className={`px-1.5 py-0.5 rounded transition-all ${discountMode === 'flat' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600'}`}
                      >
                        रु Flat
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {discountMode === 'percent' ? (
                      [0, 5, 10, 15, 20].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setDiscountPercent(pct);
                            setFlatDiscountAmount(0);
                            setAdminCustomDiscountPct(0);
                            soundFX.play('tap');
                          }}
                          className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded border transition-colors ${
                            discountPercent === pct && adminCustomDiscountPct === 0
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))
                    ) : (
                      <>
                        {[0, 20, 50, 100].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setFlatDiscountAmount(amt);
                              setDiscountPercent(0);
                              setAdminCustomDiscountPct(0);
                              soundFX.play('tap');
                            }}
                            className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded border transition-colors ${
                              flatDiscountAmount === amt && adminCustomDiscountPct === 0
                                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {settings.currencySymbol}{amt}
                          </button>
                        ))}
                        <NumberInput
                          min={0}
                          blankWhenZero
                          placeholder="Custom"
                          value={flatDiscountAmount}
                          onValueChange={(val) => {
                            setFlatDiscountAmount(Math.max(0, val));
                            setDiscountPercent(0);
                          }}
                          className="w-14 px-1 py-0.5 text-[10px] font-bold border border-slate-300 rounded text-right font-mono"
                        />
                      </>
                    )}

                    {/* Quick Round Off Button */}
                    {rawSubtotal > 10 && (
                      <button
                        type="button"
                        onClick={() => {
                          const remainder = Math.round(grandTotal) % 10;
                          if (remainder > 0) {
                            setDiscountMode('flat');
                            setFlatDiscountAmount(prev => prev + remainder);
                            soundFX.play('tap');
                          }
                        }}
                        className="px-1.5 py-0.5 text-[9px] font-black bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded shadow-2xs"
                        title={lang === 'ne' ? 'नगद सजिलोको लागि निकटतम १० मा राउन्ड गर्नुहोस्' : 'Round off bill to nearest 10 NPR'}
                      >
                        {lang === 'ne' ? 'राउन्ड अफ' : 'Round'}
                      </button>
                    )}

                    {isAdminOrManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountPercent(100);
                          setAdminCustomDiscountPct(100);
                          setAdminPricingNote('100% Complimentary Food (निःशुल्क)');
                          soundFX.play('tap');
                        }}
                        className={`px-1.5 py-0.5 text-[9px] font-black rounded border transition-colors ${
                          adminCustomDiscountPct === 100
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Admin: 100% Complimentary Food"
                      >
                        {lang === 'ne' ? 'निःशुल्क' : 'Free'}
                      </button>
                    )}

                    {isAdminOrManager && (
                      <button
                        type="button"
                        onClick={() => setShowAdminPricingModal(true)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-colors flex items-center gap-0.5 ${
                          adminCustomDiscountPct > 0 || adminWaiveSC || adminWaiveVat
                            ? 'bg-indigo-700 text-white border-indigo-700 shadow-xs'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                        }`}
                        title="Admin Billing Override"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        <span>{adminCustomDiscountPct > 0 ? `${adminCustomDiscountPct}%` : 'Admin'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-[11px] text-rose-700 font-bold pt-1 border-t border-slate-100">
                    <span>
                      {lang === 'ne' ? 'लागू भएको छुट:' : 'Discount Applied:'}
                      {discountMode === 'percent' ? ` (${effectiveDiscount.toFixed(1)}%)` : ''}
                    </span>
                    <span className="font-mono-num font-black">-{settings.currencySymbol} {discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Admin Active Overrides Status Pill */}
              {(adminCustomDiscountPct > 0 || adminWaiveSC || adminWaiveVat) && (
                <div className="flex items-center justify-between p-1 px-2 bg-indigo-50 border border-indigo-200 rounded text-[10px] text-indigo-950 font-bold">
                  <div className="flex items-center gap-1 truncate">
                    <ShieldAlert className="h-3 w-3 text-indigo-600 shrink-0" />
                    <span className="truncate">
                      {lang === 'ne' ? 'एडमिन ओभरराइड:' : 'Admin Override:'}{' '}
                      {adminCustomDiscountPct > 0 ? `${adminCustomDiscountPct}% ` : ''}
                      {adminWaiveSC ? '• SC शून्य ' : ''}
                      {adminWaiveVat ? '• VAT शून्य' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminCustomDiscountPct(0);
                      setAdminWaiveSC(false);
                      setAdminWaiveVat(false);
                    }}
                    className="text-rose-600 hover:underline shrink-0 ml-1 text-[9px]"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Quick Cash Tender Calculator in Scrollable Area */}
              {cartItems.length > 0 && (
                <div className="p-2 bg-slate-100 rounded-xl border border-slate-200/90 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-700 font-bold flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                      <span>{lang === 'ne' ? 'नगद फिर्ता क्यालकुलेटर:' : 'Cash Tender:'}</span>
                    </span>
                    {cartCashTender > 0 && (
                      <span className={`font-mono-num font-black ${cartCashTender >= grandTotal ? 'text-emerald-800' : 'text-rose-700'}`}>
                        {cartCashTender >= grandTotal 
                          ? `${lang === 'ne' ? 'फिर्ता:' : 'Change:'} ${settings.currencySymbol}${(cartCashTender - grandTotal).toFixed(0)}` 
                          : `${lang === 'ne' ? 'बाँकी:' : 'Due:'} ${settings.currencySymbol}${(grandTotal - cartCashTender).toFixed(0)}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setCartCashTender(Math.ceil(grandTotal));
                        soundFX.play('tap');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        cartCashTender === Math.ceil(grandTotal) ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Exact ({settings.currencySymbol}{Math.ceil(grandTotal)})
                    </button>
                    {[500, 1000, 2000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setCartCashTender(amt);
                          soundFX.play('tap');
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          cartCashTender === amt ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {settings.currencySymbol}{amt}
                      </button>
                    ))}
                    {cartCashTender > 0 && (
                      <button
                        type="button"
                        onClick={() => setCartCashTender(0)}
                        className="text-[9px] text-slate-400 hover:text-slate-700 ml-auto"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tier 3: Pinned Bottom Actions & Financials - ALWAYS 100% VISIBLE ON ALL SCREEN SIZES */}
            <div className="shrink-0 bg-white border-t border-slate-200 p-2 sm:p-2.5 space-y-1.5 shadow-md">
              {/* Calculations Summary Line */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-slate-600 text-[11px] sm:text-xs">
                  <span className="font-medium">{t.subtotal}:</span>
                  <span className="font-mono-num font-bold text-slate-900">{settings.currencySymbol} {subtotal.toFixed(2)}</span>
                </div>

                {((settings.enableServiceCharge && !isTakeawayOrDelivery) || settings.enableVat || (canModifyTaxConfig && onUpdateSettings)) && (
                  <div className="flex justify-between items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 pt-0.5 border-t border-slate-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {settings.enableServiceCharge && !isTakeawayOrDelivery ? (
                        <span>SC ({enableSC ? settings.serviceChargePercent : 0}%): <strong className="font-mono-num text-slate-700">{settings.currencySymbol}{serviceChargeAmount.toFixed(1)}</strong></span>
                      ) : null}
                      {settings.enableVat ? (
                        <span>VAT ({enableVatCalculations ? settings.vatRatePercent : 0}%): <strong className="font-mono-num text-slate-700">{settings.currencySymbol}{vatAmount.toFixed(1)}</strong></span>
                      ) : null}
                      {!settings.enableVat && (!settings.enableServiceCharge || isTakeawayOrDelivery) && (
                        <span className="text-slate-400">{lang === 'ne' ? 'कर / शुल्क बन्द छ' : 'VAT & SC Off'}</span>
                      )}
                    </div>
                    {canModifyTaxConfig && onUpdateSettings && (
                      <button
                        type="button"
                        onClick={() => setShowTaxSettingsModal(true)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[10px] shrink-0 transition-colors"
                        title={lang === 'ne' ? 'भ्याट / सर्भिस चार्ज On/Off वा परिवर्तन गर्नुहोस्' : 'Toggle or change VAT / Service Charge'}
                      >
                        <Percent className="h-2.5 w-2.5" />
                        <span>{lang === 'ne' ? 'कर सेटिङ' : 'Tax On/Off'}</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
                  <span className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-wider">{t.grandTotal}:</span>
                  <span className="text-base sm:text-lg font-black font-mono-num text-emerald-800">
                    {settings.currencySymbol} {grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons: KOT & Hold */}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleDispatchKOT}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold rounded-lg transition-colors shadow-2xs ${
                    cartItems.length === 0 
                      ? 'bg-amber-100 text-amber-700 border border-amber-200 opacity-60 cursor-not-allowed'
                      : !cartItems.some(i => i.kotStatus !== 'sent_to_kitchen')
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700'
                      : 'bg-amber-400 hover:bg-amber-500 text-amber-950 border border-amber-500'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {cartItems.length === 0
                      ? (lang === 'ne' ? 'KOT किचेन' : 'Send KOT')
                      : cartItems.some(i => i.kotStatus !== 'sent_to_kitchen')
                      ? (currentOrderId 
                          ? (lang === 'ne' 
                              ? `KOT (${cartItems.filter(i => i.kotStatus !== 'sent_to_kitchen').length} नयाँ)` 
                              : `Next KOT (${cartItems.filter(i => i.kotStatus !== 'sent_to_kitchen').length})`) 
                          : t.saveKOT)
                      : (lang === 'ne' ? 'पठाइयो (KOT)' : 'All Sent')
                    }
                  </span>
                </button>

                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => {
                    onSaveOrder(currentOrderObject, false, 'occupied');
                    setStatusBanner({
                      text: lang === 'ne' ? 'अर्डर सुरक्षित भयो! टेबल व्यस्त राखिएको छ।' : 'Order saved to table successfully.',
                      type: 'info'
                    });
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg disabled:opacity-40 transition-colors"
                >
                  <span>{lang === 'ne' ? 'अर्डर होल्ड' : 'Hold Order'}</span>
                </button>
              </div>

              {/* Estimate Slip, Split & Admin Quick Actions Bar */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => {
                    setEstimateOrderTarget(currentOrderObject);
                    setShowEstimateModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 shadow-2xs"
                  title="Print Pro-Forma Estimate Bill Slip for Customer"
                >
                  <Printer className="h-3 w-3 text-amber-700" />
                  <span className="truncate">{lang === 'ne' ? 'कच्चा बिल (Estimate)' : 'Estimate Bill'}</span>
                </button>

                {orderType !== 'dine_in' && (
                  <button
                    type="button"
                    disabled={cartItems.length === 0}
                    onClick={() => {
                      setSplitTargetOrder(null);
                      setShowSplitBillModal(true);
                    }}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors disabled:opacity-40 shrink-0"
                    title="Split bill by Item, Equal PAX, or Custom Amount"
                  >
                    <Split className="h-3 w-3" />
                    <span>{lang === 'ne' ? 'टुक्राउने' : 'Split'}</span>
                  </button>
                )}

                {isAdminOrManager && (currentOrderId || (orderType === 'dine_in' && activeOrderForTable)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const ordId = currentOrderId || activeOrderForTable?.id;
                      if (ordId) {
                        setVoidTargetOrderIdInPOS(ordId);
                        setVoidReasonInPOS('Customer cancelled / अर्डर रद्द');
                        setCustomVoidReasonInPOS('');
                      }
                    }}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-[11px] font-bold transition-colors shrink-0"
                    title="Cancel / Void Running Order"
                  >
                    <span>{lang === 'ne' ? 'रद्द (Cancel)' : 'Cancel Bill'}</span>
                  </button>
                )}
              </div>

              {/* Quick Payment Method Selector in POS Cart */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-0.5">
                  <span>{lang === 'ne' ? 'भुक्तानी विधि:' : 'Payment Method:'}</span>
                  <span className="text-emerald-700 uppercase font-black text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {selectedPaymentMethod.replace('_', ' ')}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('cash')}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                      selectedPaymentMethod === 'cash'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    <span>Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('fonepay_qr')}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                      selectedPaymentMethod === 'fonepay_qr' || selectedPaymentMethod === 'qr'
                        ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    <span>Fonepay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('card')}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                      selectedPaymentMethod === 'card'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('credit_khata')}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                      selectedPaymentMethod === 'credit_khata'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Khata</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('split')}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 border transition-all cursor-pointer ${
                      selectedPaymentMethod === 'split'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Split className="h-3.5 w-3.5" />
                    <span>Split</span>
                  </button>
                </div>
              </div>

              {/* Primary Pay & Settle Action */}
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cartItems.length === 0}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-30 shrink-0"
                  title={t.clearCart}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => {
                    setStatusBanner(null);
                    if (!currentSession) {
                      onPromptAuth?.();
                      return;
                    }
                    if (!canSettlePayment) {
                      setStatusBanner({
                        text: lang === 'ne' 
                          ? 'तपाईंको खातामा बिल चुक्ता गर्ने अधिकार प्रदान गरिएको छैन। कृपया क्यासियर वा म्यानेजरलाई अनुरोध गर्नुहोस्।' 
                          : 'Your role does not have settlement permissions. Please contact Cashier or Manager.',
                        type: 'error'
                      });
                      return;
                    }

                    // Stock Availability Pre-check
                    const stockCheck = validateInventoryStock(cartItems, menuItems, inventoryItems);
                    if (!stockCheck.hasSufficientStock) {
                      const shortageList = stockCheck.shortages.map(s => `${s.itemName} (Available: ${s.currentStock} ${s.unit}, Required: ${s.requiredQty} ${s.unit})`).join(', ');
                      setStatusBanner({
                        text: lang === 'ne'
                          ? `अपर्याप्त स्टक! निम्न सामग्री मौज्दातमा छैन: ${shortageList}`
                          : `Insufficient inventory stock to fulfill order: ${shortageList}`,
                        type: 'error'
                      });
                      return;
                    }

                    if (!isNetworkOnline()) {
                      setStatusBanner({
                        text: lang === 'ne'
                          ? 'अफलाइन मोडमा बिल भुक्तानी फर्स्यौट गर्न मिल्दैन। कृपया इन्टरनेट/सिंक जोडिएपछि मात्र भुक्तानी लिनुहोस् वा अर्डर सुरक्षित गर्नुहोस्।'
                          : 'Cannot settle payment while offline. Financial transactions require an active server connection. You can save this order as a draft.',
                        type: 'error'
                      });
                      soundFX.play('alert');
                      return;
                    }

                    setSplitCheckoutContext(null);
                    setShowCheckoutModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-black text-white bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] rounded-xl shadow-md disabled:opacity-40 transition-all border border-emerald-600 ring-2 ring-emerald-500/20"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {lang === 'ne' 
                      ? `बिल भुक्तानी (${settings.currencySymbol} ${grandTotal.toFixed(0)})` 
                      : `Pay & Settle (${settings.currencySymbol} ${grandTotal.toFixed(0)})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )}

      {/* Fast-Service Sticky Orange Confirm Order Bar (Mobile < lg) */}
      {mobilePOSTab === 'menu' && cartItems.length > 0 && (() => {
        const totalQty = cartItems.reduce((sum, i) => sum + i.quantity, 0);
        const hasPendingItems = cartItems.some(i => i.kotStatus !== 'sent_to_kitchen');
        return (
          <div className="lg:hidden fixed bottom-[4.15rem] inset-x-3 z-30 bg-orange-500 text-white rounded-2xl px-3.5 py-2.5 shadow-xl flex items-center justify-between gap-2.5 animate-in slide-in-from-bottom duration-200">
            <button
              type="button"
              onClick={() => setMobilePOSTab('cart')}
              className="min-w-0 text-left flex-1"
            >
              <p className="text-[11px] font-bold text-orange-100 leading-tight tabular-nums">
                {totalQty}x {totalQty === 1 ? 'item' : 'items'}
                {!hasPendingItems && currentOrderId ? ' · Saved as Unpaid' : ''}
              </p>
              <p className="font-mono-num font-black text-base text-white leading-tight tabular-nums">
                {settings.currencySymbol} {grandTotal.toFixed(2)}
              </p>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasPendingItems ? (
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  className="min-h-[42px] px-4 py-2 bg-white hover:bg-orange-50 text-orange-600 font-black text-xs sm:text-sm rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                >
                  <span>{lang === 'ne' ? 'अर्डर पठाउनुहोस्' : 'Confirm Order'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToBilling) {
                      onNavigateToBilling();
                    } else {
                      setMobilePOSTab('cart');
                    }
                  }}
                  className="min-h-[42px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                >
                  <span>{lang === 'ne' ? 'बिल खोल्नुहोस्' : 'Open Bill'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Item Customization / Variant / Add-on Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{customizingItem.name}</h3>
                <p className="text-xs text-slate-500">{customizingItem.category.replace(/_/g, ' ')}</p>
              </div>
              <button onClick={() => setCustomizingItem(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Variants Selector */}
              {customizingItem.variants && customizingItem.variants.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-800 mb-2">Select Size / Portion:</label>
                  <div className="space-y-1.5">
                    {customizingItem.variants.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => setChosenVariant(v)}
                        className={`w-full p-2.5 rounded-lg border text-left font-semibold text-xs flex justify-between items-center transition-colors ${
                          chosenVariant?.name === v.name
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{v.name}</span>
                        <span className="font-mono-num font-bold">{settings.currencySymbol} {v.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons Selector */}
              {customizingItem.addOns && customizingItem.addOns.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-800 mb-2">Select Add-ons / Extras:</label>
                  <div className="space-y-1.5">
                    {customizingItem.addOns.map((a) => {
                      const isSelected = chosenAddOns.some(ca => ca.name === a.name);
                      return (
                        <button
                          key={a.name}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setChosenAddOns(prev => prev.filter(ca => ca.name !== a.name));
                            } else {
                              setChosenAddOns(prev => [...prev, a]);
                            }
                          }}
                          className={`w-full p-2.5 rounded-lg border text-left font-semibold text-xs flex justify-between items-center transition-colors ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-950 border-emerald-500 font-bold'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-4 w-4 rounded border flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>
                              {isSelected && '✓'}
                            </span>
                            <span>{a.name}</span>
                          </div>
                          <span className="font-mono-num text-slate-600">+{settings.currencySymbol} {a.price}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Category-Aware Special Kitchen/Bar Instructions in Customization Modal */}
              {(() => {
                const modalNoteCfg = getItemNoteConfig(customizingItem);
                return (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <label className="block font-bold text-slate-800 text-[11px]">
                      {modalNoteCfg.stationType === 'beverage'
                        ? 'Bar / Beverage Instructions (Optional):'
                        : modalNoteCfg.stationType === 'bakery'
                        ? 'Bakery Instructions (Optional):'
                        : 'Kitchen Instructions (Optional):'}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder={modalNoteCfg.placeholder}
                        value={chosenItemNote}
                        onChange={(e) => setChosenItemNote(e.target.value)}
                        className="text-xs w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1 focus:bg-white focus:outline-hidden text-slate-800 font-medium"
                      />
                    </div>
                    <div className="flex items-center gap-1 overflow-x-auto pl-5 scrollbar-none text-[10px]">
                      {modalNoteCfg.chips.map((chip) => {
                        const active = isChipActive(chosenItemNote, chip.val);
                        return (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => {
                              setChosenItemNote(prev => toggleNoteChip(prev, chip.val));
                              soundFX.play('tap');
                            }}
                            className={`shrink-0 px-2 py-0.5 rounded border transition-colors ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 font-medium'
                            }`}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomization}
                className="px-5 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
              >
                {lang === 'ne' ? 'अर्डर बिलिङमा थप्नुहोस् (Add to Order)' : 'Add to Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <CheckoutModal
          order={splitCheckoutContext ? splitCheckoutContext.splitOrder : currentOrderObject}
          customers={customers}
          settings={settings}
          lang={lang}
          currentSession={currentSession}
          initialPaymentMethod={splitCheckoutContext ? 'cash' : selectedPaymentMethod}
          occupiedRooms={occupiedResortRooms}
          onConfirmSettlement={handleConfirmSettlement}
          onUpdateSettings={onUpdateSettings}
          onClose={() => {
            setShowCheckoutModal(false);
            setSplitCheckoutContext(null);
          }}
        />
      )}

      {/* KOT Modal */}
      {showKOTModal && (
        <KOTModal
          order={lastDispatchedKOT || currentOrderObject}
          settings={settings}
          lang={lang}
          onClose={() => setShowKOTModal(false)}
          onStartNewOrder={handleStartNewOrder}
        />
      )}

      {/* Printable Receipt Modal */}
      {showReceiptModal && settledOrderForReceipt && (
        <ReceiptModal
          order={settledOrderForReceipt}
          settings={settings}
          lang={lang}
          onClose={() => {
            setShowReceiptModal(false);
            setSettledOrderForReceipt(null);
          }}
        />
      )}

      {/* Menu Dishes Manager Modal */}
      {showMenuManagerModal && (
        <MenuManagerModal
          menuItems={menuItems}
          inventoryItems={inventoryItems}
          settings={settings}
          lang={lang}
          onAddMenuItem={onAddMenuItem}
          onUpdateMenuItem={onUpdateMenuItem}
          onDeleteMenuItem={onDeleteMenuItem}
          initialEditingItem={menuEditingItem}
          onClose={() => {
            setShowMenuManagerModal(false);
            setMenuEditingItem(null);
          }}
        />
      )}

      {/* Shift / Transfer Table Modal */}
      {showShiftTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
              <h4 className="font-bold text-indigo-950 text-sm">
                {lang === 'ne' ? 'अर्डर अर्को टेबल वा कोठामा सार्नुहोस्' : 'Transfer Order to Table/Room'}
              </h4>
              <button onClick={() => setShowShiftTableModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                From: <span className="font-bold text-slate-900">{selectedTableRoom?.name}</span>
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'नयाँ टेबल वा कोठा रोज्नुहोस्:' : 'Select Destination Space:'}
                </label>
                <select
                  value={targetShiftTableId}
                  onChange={(e) => setTargetShiftTableId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-semibold bg-white"
                >
                  <option value="">-- Choose Table / Room --</option>
                  {tablesRooms
                    .filter(tr => tr.id !== selectedTableRoomId)
                    .map(tr => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name} ({tr.type.toUpperCase()}) {tr.status === 'occupied' ? '• [Busy]' : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowShiftTableModal(false)}
                className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!targetShiftTableId}
                onClick={() => {
                  onShiftTableOrder(selectedTableRoomId, targetShiftTableId);
                  setSelectedTableRoomId(targetShiftTableId);
                  setShowShiftTableModal(false);
                  setStatusBanner({
                    text: lang === 'ne' ? 'अर्डर सफलतापूर्वक नयाँ टेबलमा सारियो!' : 'Order transferred successfully!',
                    type: 'success'
                  });
                }}
                className="px-4 py-1.5 font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded disabled:opacity-40"
              >
                {lang === 'ne' ? 'सार्नुहोस् (Transfer)' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Table Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Merge className="h-4 w-4 text-amber-600" />
                <h4 className="font-bold text-amber-950 text-sm">
                  {lang === 'ne' ? 'टेबल तथा बिल मर्ज गर्नुहोस्' : 'Merge Table Orders'}
                </h4>
              </div>
              <button onClick={() => setShowMergeModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                {lang === 'ne' 
                  ? `"${selectedTableRoom?.name}" सँग गाभ्न (मर्ज गर्न) अर्को चालु टेबल छान्नुहोस्:` 
                  : `Select another running table to merge into "${selectedTableRoom?.name}":`}
              </p>
              <select
                value={selectedMergeTargetTableId}
                onChange={(e) => setSelectedMergeTargetTableId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
              >
                <option value="">-- {lang === 'ne' ? 'मर्ज गर्ने टेबल छान्नुहोस्' : 'Select Running Table'} --</option>
                {activeOrders
                  .filter(ao => ao.tableRoomId !== selectedTableRoomId && ao.orderType === 'dine_in')
                  .map(ao => (
                    <option key={ao.id} value={ao.tableRoomId}>
                      {ao.tableRoomName || ao.invoiceNo} (Rs. {ao.grandTotal.toFixed(0)} • {ao.items.length} items)
                    </option>
                  ))}
              </select>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg font-bold"
              >
                {lang === 'ne' ? 'रद्द' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={!selectedMergeTargetTableId}
                onClick={() => {
                  if (onMergeTables && selectedMergeTargetTableId) {
                    onMergeTables(selectedMergeTargetTableId, selectedTableRoomId);
                    setShowMergeModal(false);
                    setStatusBanner({
                      text: lang === 'ne' ? 'टेबलहरू सफलतापूर्वक मर्ज गरियो!' : 'Tables merged successfully!',
                      type: 'success'
                    });
                  }
                }}
                className="px-4 py-1.5 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-40 shadow-xs"
              >
                {lang === 'ne' ? 'मर्ज गर्नुहोस् (Merge)' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Bill Modal (By Item, Equal PAX, Custom Amount) */}
      {showSplitBillModal && (
        <SplitBillModal
          order={splitTargetOrder || currentOrderObject}
          menuItems={menuItems}
          orders={orders}
          settings={settings}
          lang={lang}
          initialGuests={(splitTargetOrder || currentOrderObject).guestCount || guestCount}
          onClose={() => {
            setShowSplitBillModal(false);
            setSplitTargetOrder(null);
          }}
          onProceedItemSplitSettle={(splitOrder, remainingItems) => {
            const parentOrder = splitTargetOrder || currentOrderObject;
            setShowSplitBillModal(false);
            setSplitTargetOrder(null);
            setSplitCheckoutContext({ parentOrder, splitOrder, remainingItems });
            setSelectedPaymentMethod('cash');
            setShowCheckoutModal(true);
          }}
          onOpenMixedPaymentCheckout={() => {
            const target = splitTargetOrder;
            setShowSplitBillModal(false);
            setSplitTargetOrder(null);
            setSplitCheckoutContext(null);
            setSelectedPaymentMethod('split');
            if (target && target.id !== currentOrderId) {
              handleOpenSettleModalForOrder(target, 'split');
            } else {
              setShowCheckoutModal(true);
            }
          }}
          onOpenEstimateSlip={(targetOrd) => {
            setEstimateOrderTarget(targetOrd);
            setShowEstimateModal(true);
          }}
        />
      )}

      {/* Business Tax & Service Charge On/Off & Rate Settings Modal (Admin & Manager) */}
      {showTaxSettingsModal && onUpdateSettings && (
        <TaxSettingsModal
          settings={settings}
          lang={lang}
          onClose={() => setShowTaxSettingsModal(false)}
          onSave={(updatedSettings) => {
            onUpdateSettings(updatedSettings);
            setStatusBanner({
              text: lang === 'ne'
                ? `कर सेटिङ अपडेट भयो: VAT ${updatedSettings.enableVat ? updatedSettings.vatRatePercent + '%' : 'बन्द'}, SC ${updatedSettings.enableServiceCharge ? updatedSettings.serviceChargePercent + '%' : 'बन्द'}`
                : `Tax settings saved: VAT ${updatedSettings.enableVat ? updatedSettings.vatRatePercent + '%' : 'Off'}, SC ${updatedSettings.enableServiceCharge ? updatedSettings.serviceChargePercent + '%' : 'Off'}`,
              type: 'success'
            });
          }}
        />
      )}

      {/* Active Orders & Live Billing Hub Modal */}
      {showActiveOrdersModal && (
        <ActiveOrdersModal
          orders={orders}
          tablesRooms={tablesRooms}
          settings={settings}
          lang={lang}
          currentSession={currentSession}
          onClose={() => setShowActiveOrdersModal(false)}
          onSelectOrderForPOS={(tableRoomId, orderId) => {
            const ord = orders.find(o => o.id === orderId);
            if (ord) {
              if (ord.orderType === 'dine_in') {
                setOrderType('dine_in');
                setSelectedTableRoomId(tableRoomId);
              } else if (ord.orderType === 'takeaway') {
                setOrderType('takeaway');
              } else if (ord.orderType === 'delivery') {
                setOrderType('delivery');
              } else {
                setOrderType('dine_in');
              }
              setCurrentOrderId(orderId);
              setCartItems(ord.items);
              setDiscountPercent(ord.discountPercent || 0);
              setFlatDiscountAmount(0);
              setGuestCount(ord.guestCount || 2);
              setSpecialNote(ord.specialInstructions || '');
              if (ord.waiterName) setSelectedWaiter(ord.waiterName);
              setMobilePOSTab('cart');
            }
          }}
          onOpenSettleModal={(order) => {
            setShowActiveOrdersModal(false);
            handleOpenSettleModalForOrder(order);
          }}
          onSplitOrder={(order) => {
            setShowActiveOrdersModal(false);
            setPosScreenMode('pos_menu');
            setSplitTargetOrder(order);
            setShowSplitBillModal(true);
          }}
          onPrintEstimate={(order) => {
            setEstimateOrderTarget(order);
            setShowEstimateModal(true);
          }}
          onShiftTableOrder={onShiftTableOrder}
          onMergeTables={onMergeTables}
          onVoidOrder={onVoidOrder}
          onVoidOrderItem={onVoidOrderItem}
          onAdminUpdatePricing={onAdminUpdatePricing}
          onForceReleaseTable={onForceReleaseTable}
        />
      )}

      {/* Estimate Bill Slip Modal */}
      {showEstimateModal && (estimateOrderTarget || currentOrderObject) && (
        <ReceiptModal
          order={estimateOrderTarget || currentOrderObject}
          settings={settings}
          lang={lang}
          isEstimate={true}
          onClose={() => {
            setShowEstimateModal(false);
            setEstimateOrderTarget(null);
          }}
        />
      )}

      {/* Admin Billing, Discount & Tax Override Modal */}
      {showAdminPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">
                    {lang === 'ne' ? 'प्रशासक बिल तथा कर नियन्त्रण' : 'Admin Billing & Financial Control'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {lang === 'ne' ? 'विशेष छुट, सेवा शुल्क तथा भ्याट छुट व्यवस्थापन' : 'Manager overrides for discounts and tax waivers'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminPricingModal(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Custom Discount Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    {lang === 'ne' ? 'विशेष प्रशासनिक छुट दर (%):' : 'Custom Admin Discount (%):'}
                  </label>
                  <span className="font-mono-num font-black text-sm text-indigo-700">
                    {adminCustomDiscountPct}%
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 10, 20, 50, 100].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAdminCustomDiscountPct(pct)}
                      className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-xs ${
                        adminCustomDiscountPct === pct
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pct === 100 ? (lang === 'ne' ? 'निःशुल्क' : '100% Free') : `${pct}%`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <NumberInput
                    min={0}
                    max={100}
                    blankWhenZero
                    value={adminCustomDiscountPct}
                    onValueChange={(val) => setAdminCustomDiscountPct(Math.min(100, Math.max(0, val)))}
                    placeholder="Custom % (0-100)"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  />
                </div>
              </div>

              {/* Tax & Fee Waivers */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200">
                <p className="font-bold text-slate-800">
                  {lang === 'ne' ? 'कर तथा सेवा शुल्क छुट (Tax / Fee Waivers):' : 'Tax & Fee Waivers:'}
                </p>

                <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors">
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {lang === 'ne' ? '१०% सेवा शुल्क मिनाहा (Waive Service Charge)' : 'Waive Service Charge (SC)'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ne' ? 'ग्राहकलाई सेवा शुल्क नलाग्ने बनाउनुहोस्' : 'Zero out service charge for this customer bill'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={adminWaiveSC}
                    onChange={(e) => setAdminWaiveSC(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer transition-colors">
                  <div>
                    <span className="font-bold text-slate-900 block">
                      {lang === 'ne' ? '१३% भ्याट मिनाहा (Waive VAT)' : 'Waive VAT (13%)'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {lang === 'ne' ? 'यस बिलमा १३% भ्याट छुट गर्नुहोस्' : 'Exempt VAT for tax-free or special order'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={adminWaiveVat}
                    onChange={(e) => setAdminWaiveVat(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                </label>
              </div>

              {/* Override Reason / Notes */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <label className="font-bold text-slate-800 block">
                  {lang === 'ne' ? 'छुट वा छुट मिनाहाको कारण (Audit Reason):' : 'Reason / Audit Note:'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'ne' ? 'उदा. भी.आई.पी पाहुना, सञ्चालक स्वीकृति, निःशुल्क कफी...' : 'e.g., VIP guest, Owner approval, Food comp...'}
                  value={adminPricingNote}
                  onChange={(e) => setAdminPricingNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdminCustomDiscountPct(0);
                  setAdminWaiveSC(false);
                  setAdminWaiveVat(false);
                  setAdminPricingNote('');
                  setShowAdminPricingModal(false);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
              >
                {lang === 'ne' ? 'सबै हटाउनुहोस् (Reset)' : 'Reset All'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminPricingModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  {lang === 'ne' ? 'बन्द' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminPricingModal(false);
                    if (currentOrderId && onAdminUpdatePricing) {
                      onAdminUpdatePricing(currentOrderId, {
                        discountPercent: adminCustomDiscountPct,
                        waiveServiceCharge: adminWaiveSC,
                        waiveVat: adminWaiveVat,
                        notes: adminPricingNote
                      });
                    }
                    setStatusBanner({
                      text: lang === 'ne' ? 'प्रशासक छुट तथा कर समायोजन लागु भयो!' : 'Admin pricing overrides applied!',
                      type: 'success'
                    });
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
                >
                  {lang === 'ne' ? 'लागु गर्नुहोस् (Apply)' : 'Apply Overrides'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Void / Cancel Order Confirmation Modal */}
      {voidTargetOrderIdInPOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-300 animate-in fade-in zoom-in-95">
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {lang === 'ne' ? 'अर्डर खारेज (Void Order)' : 'Cancel & Void Order'}
                  </h3>
                  <p className="text-[11px] text-rose-800 font-mono-num font-semibold">
                    {currentOrderObject.tableRoomName || 'Counter'} · {currentOrderObject.invoiceNo}
                  </p>
                </div>
              </div>
              <button onClick={() => setVoidTargetOrderIdInPOS(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  {lang === 'ne' 
                    ? 'चेतावनी: यो चालु अर्डर खारेज हुनेछ र टेबल तुरुन्त खाली हुनेछ।' 
                    : 'Warning: This active order will be cancelled and the table will be freed.'}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  {lang === 'ne' ? 'खारेज गर्नुको कारण:' : 'Reason for Cancellation:'}
                </label>
                <select
                  value={voidReasonInPOS}
                  onChange={(e) => setVoidReasonInPOS(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white"
                >
                  <option value="Customer cancelled / अर्डर रद्द">Customer cancelled / ग्राहकले रद्द गरे</option>
                  <option value="Mistake entry / गल्तीले थपिएको">Mistake entry / गल्ती प्रविष्टि</option>
                  <option value="Kitchen unavailable / किचेनमा परिकार अभाव">Kitchen item unavailable / सामग्री अभाव</option>
                  <option value="Customer walked out / ग्राहक निस्किए">Customer walked out / ग्राहक हिँडे</option>
                  <option value="Test order / परीक्षण अर्डर">Test order / टेस्ट अर्डर</option>
                  <option value="Other / अन्य">Other / अन्य विशेष कारण</option>
                </select>
              </div>

              {voidReasonInPOS.includes('Other') && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    {lang === 'ne' ? 'थप विवरण खुलाउनुहोस्:' : 'Specify Custom Reason:'}
                  </label>
                  <textarea
                    rows={2}
                    value={customVoidReasonInPOS}
                    onChange={(e) => setCustomVoidReasonInPOS(e.target.value)}
                    placeholder="Enter detailed reason for voiding order..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setVoidTargetOrderIdInPOS(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  {lang === 'ne' ? 'रद्द नगर्नुहोस्' : 'Keep Order'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const finalReason = voidReasonInPOS.includes('Other')
                      ? (customVoidReasonInPOS.trim() || 'Admin cancelled order')
                      : voidReasonInPOS;
                    if (onVoidOrder && voidTargetOrderIdInPOS) {
                      onVoidOrder(voidTargetOrderIdInPOS, finalReason);
                      handleStartNewOrder();
                    }
                    setVoidTargetOrderIdInPOS(null);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg transition-colors shadow-sm"
                >
                  {lang === 'ne' ? 'पुष्टि गर्नुहोस् (Confirm Void)' : 'Confirm Void'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Waiter / Server Name Edit & Manage Modal */}
      {showWaiterManageModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {lang === 'ne' ? 'वेटरको नाम सम्पादन तथा नयाँ थप्ने' : 'Edit & Manage Waiter Names'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'ne' ? 'बिल तथा KOT मा देखिने वेटरको नाम परिवर्तन गर्नुहोस्' : 'Update server names displayed on KOT tickets and bills'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setShowWaiterManageModal(false); setEditingStaffTarget(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[480px] overflow-y-auto">
              {/* If editing an existing waiter */}
              {editingStaffTarget ? (
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editingStaffTarget.name.trim() || !onUpdateStaffUsers) return;
                    const updated = staffUsers.map(s => s.id === editingStaffTarget.id ? editingStaffTarget : s);
                    onUpdateStaffUsers(updated);
                    const displayName = editingStaffTarget.nepaliName 
                      ? `${editingStaffTarget.name} (${editingStaffTarget.nepaliName})` 
                      : editingStaffTarget.name;
                    setSelectedWaiter(displayName);
                    setEditingStaffTarget(null);
                    setStatusBanner({
                      text: lang === 'ne' ? `${editingStaffTarget.name} को नाम अपडेट भयो!` : `Waiter ${editingStaffTarget.name} updated!`,
                      type: 'success'
                    });
                  }}
                  className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900">
                      {lang === 'ne' ? 'वेटरको नाम सम्पादन गर्नुहोस्:' : 'Edit Waiter Profile:'}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setEditingStaffTarget(null)} 
                      className="text-[10px] text-slate-500 hover:text-slate-800"
                    >
                      {lang === 'ne' ? 'रद्द' : 'Cancel'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      {lang === 'ne' ? 'अंग्रेजी नाम (English Name):' : 'Full Name (English):'}
                    </label>
                    <input
                      type="text"
                      required
                      value={editingStaffTarget.name}
                      onChange={e => setEditingStaffTarget({ ...editingStaffTarget, name: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      {lang === 'ne' ? 'नेपाली नाम (Nepali Name - ऐच्छिक):' : 'Nepali Name (Optional):'}
                    </label>
                    <input
                      type="text"
                      placeholder="जस्तै: विकास तामाङ"
                      value={editingStaffTarget.nepaliName || ''}
                      onChange={e => setEditingStaffTarget({ ...editingStaffTarget, nepaliName: e.target.value })}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-xs"
                    >
                      {lang === 'ne' ? 'नाम सेभ गर्नुहोस्' : 'Save Name'}
                    </button>
                  </div>
                </form>
              ) : null}

              {/* List of existing staff / waiters */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  {lang === 'ne' ? 'दर्ता भएका वेटर तथा स्टाफहरू:' : 'Registered Waiters & Staff:'}
                </label>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  {staffUsers.filter(s => s.isActive).map(s => {
                    const displayName = s.nepaliName ? `${s.name} (${s.nepaliName})` : s.name;
                    const isCurrent = selectedWaiter.startsWith(s.name);
                    return (
                      <div key={s.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            {s.name}
                            {s.nepaliName && <span className="text-[11px] text-slate-500 font-medium">({s.nepaliName})</span>}
                            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                              {s.role}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingStaffTarget(s)}
                            className="px-2 py-0.5 text-xs text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded font-semibold flex items-center gap-1"
                            title="Edit this waiter's name"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>{lang === 'ne' ? 'सच्याउने' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWaiter(displayName);
                              setShowWaiterManageModal(false);
                            }}
                            className={`px-2 py-0.5 text-xs rounded font-bold transition-all ${
                              isCurrent
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {isCurrent ? (lang === 'ne' ? 'छानिएको' : 'Selected') : (lang === 'ne' ? 'छान्ने' : 'Select')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Add New Waiter Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newQuickWaiterName.trim() || !onUpdateStaffUsers) return;
                  const newStaffMember: StaffUser = {
                    id: 'staff-waiter-' + Date.now().toString(36),
                    username: 'waiter_' + newQuickWaiterName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Math.random().toString(36).substring(2, 5),
                    name: newQuickWaiterName.trim(),
                    nepaliName: newQuickWaiterNepali.trim() || undefined,
                    role: 'WAITER',
                    pinHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
                    salt: 'def-salt',
                    isActive: true,
                    businessId: settings.businessId,
                    createdAt: new Date().toISOString().split('T')[0]
                  };
                  onUpdateStaffUsers([...staffUsers, newStaffMember]);
                  const newDisplayName = newStaffMember.nepaliName 
                    ? `${newStaffMember.name} (${newStaffMember.nepaliName})` 
                    : newStaffMember.name;
                  setSelectedWaiter(newDisplayName);
                  setNewQuickWaiterName('');
                  setNewQuickWaiterNepali('');
                  setShowWaiterManageModal(false);
                  setStatusBanner({
                    text: lang === 'ne' ? `नयाँ वेटर ${newStaffMember.name} थपियो!` : `New waiter ${newStaffMember.name} added!`,
                    type: 'success'
                  });
                }}
                className="pt-3 border-t border-slate-100 space-y-2"
              >
                <span className="block text-[11px] font-bold text-slate-700 uppercase">
                  {lang === 'ne' ? '+ नयाँ वेटर तुरुन्तै थप्नुहोस्:' : '+ Quick Add New Waiter:'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ne' ? 'वेटरको नाम (उदा: Ramesh)' : 'Waiter Name (e.g. Ramesh)'}
                    value={newQuickWaiterName}
                    onChange={e => setNewQuickWaiterName(e.target.value)}
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder={lang === 'ne' ? 'नेपाली नाम (उदा: रमेश)' : 'Nepali Name (e.g. रमेश)'}
                    value={newQuickWaiterNepali}
                    onChange={e => setNewQuickWaiterNepali(e.target.value)}
                    className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{lang === 'ne' ? 'नयाँ वेटर थप्नुहोस् र अर्डरमा राख्नुहोस्' : 'Add Waiter & Assign to Order'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Mobile More POS Actions Drawer Sheet */}
      {showMobileMoreSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setShowMobileMoreSheet(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full overflow-hidden border border-slate-200 shadow-2xl animate-in slide-in-from-bottom duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === 'ne' ? 'अर्डर तथा बिलिङ विकल्पहरू' : 'Order & Table Actions'}
                </h3>
                <p className="text-xs text-slate-500">
                  {orderType === 'dine_in' ? selectedTableRoom?.name : orderType.toUpperCase()} · {currentOrderObject.invoiceNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMoreSheet(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreSheet(false);
                  handleStartNewOrder();
                }}
                className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold flex items-center gap-2 text-left"
              >
                <Plus className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{lang === 'ne' ? 'नयाँ अर्डर' : 'New Order'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreSheet(false);
                  setShowActiveOrdersModal(true);
                }}
                className="min-h-[44px] px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold flex items-center gap-2 text-left"
              >
                <Receipt className="h-4 w-4 text-amber-700 shrink-0" />
                <span>{lang === 'ne' ? `चालु बिल (${activeOrders.length})` : `Active Bills (${activeOrders.length})`}</span>
              </button>

              {orderType === 'dine_in' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMoreSheet(false);
                      setShowWaiterManageModal(true);
                    }}
                    className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-2 text-left"
                  >
                    <UserCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>{lang === 'ne' ? 'वेटर छान्नुहोस्' : 'Waiter / Staff'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMoreSheet(false);
                      setTargetShiftTableId('');
                      setShowShiftTableModal(true);
                    }}
                    className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-2 text-left"
                  >
                    <ArrowRightLeft className="h-4 w-4 text-indigo-600 shrink-0" />
                    <span>{lang === 'ne' ? 'टेबल सार्नुहोस्' : 'Shift Table'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMoreSheet(false);
                      setSelectedMergeTargetTableId('');
                      setShowMergeModal(true);
                    }}
                    className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-2 text-left"
                  >
                    <Merge className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{lang === 'ne' ? 'टेबल मर्ज' : 'Merge Tables'}</span>
                  </button>
                </>
              )}

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={() => {
                  setShowMobileMoreSheet(false);
                  setSplitTargetOrder(null);
                  setShowSplitBillModal(true);
                }}
                className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-2 text-left disabled:opacity-40"
              >
                <Split className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{lang === 'ne' ? 'बिल टुक्राउने' : 'Split Bill'}</span>
              </button>

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={() => {
                  setShowMobileMoreSheet(false);
                  setEstimateOrderTarget(currentOrderObject);
                  setShowEstimateModal(true);
                }}
                className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-2 text-left disabled:opacity-40"
              >
                <Printer className="h-4 w-4 text-slate-700 shrink-0" />
                <span>{lang === 'ne' ? 'कच्चा बिल' : 'Estimate Slip'}</span>
              </button>

              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={() => {
                  setShowMobileMoreSheet(false);
                  setShowKOTModal(true);
                }}
                className="min-h-[44px] px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold flex items-center gap-2 text-left disabled:opacity-40"
              >
                <FileText className="h-4 w-4 text-amber-700 shrink-0" />
                <span>{lang === 'ne' ? 'KOT पर्ची प्रिन्ट' : 'Print KOT'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileMoreSheet(false);
                  setShowHeldDraftsModal(true);
                }}
                className="min-h-[44px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-2 text-left"
              >
                <PauseCircle className="h-4 w-4 text-slate-600 shrink-0" />
                <span>{lang === 'ne' ? `होल्ड ड्राफ्ट (${heldDrafts.length})` : `Held Drafts (${heldDrafts.length})`}</span>
              </button>

              {canModifyTaxConfig && onUpdateSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMoreSheet(false);
                    setShowTaxSettingsModal(true);
                  }}
                  className="min-h-[44px] px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold flex items-center gap-2 text-left"
                >
                  <Percent className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>{lang === 'ne' ? 'कर / भ्याट On/Off' : 'Tax & VAT On/Off'}</span>
                </button>
              )}

              {isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMoreSheet(false);
                    setShowAdminPricingModal(true);
                  }}
                  className="min-h-[44px] px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold flex items-center gap-2 text-left"
                >
                  <ShieldAlert className="h-4 w-4 text-indigo-700 shrink-0" />
                  <span>{lang === 'ne' ? 'प्रशासक छुट/कर' : 'Admin Override'}</span>
                </button>
              )}

              {isAdminOrManager && (currentOrderId || (orderType === 'dine_in' && activeOrderForTable)) && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMoreSheet(false);
                    const ordId = currentOrderId || activeOrderForTable?.id;
                    if (ordId) {
                      setVoidTargetOrderIdInPOS(ordId);
                      setVoidReasonInPOS('Customer cancelled / अर्डर रद्द');
                      setCustomVoidReasonInPOS('');
                    }
                  }}
                  className="min-h-[44px] px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold flex items-center gap-2 text-left"
                >
                  <Trash2 className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{lang === 'ne' ? 'अर्डर रद्द (Void)' : 'Void Order'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
