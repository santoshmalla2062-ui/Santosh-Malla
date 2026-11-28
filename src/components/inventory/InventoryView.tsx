import React, { useState, useMemo } from 'react';
import { NumberInput } from '../common/NumberInput';
import { 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  Plus, 
  Minus, 
  Search, 
  Download, 
  History, 
  X, 
  Check, 
  Phone, 
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Truck,
  FileCheck,
  CalendarClock,
  ArrowRightLeft,
  ShieldCheck,
  Printer,
  DollarSign,
  Tag,
  CheckCircle2,
  CheckSquare,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { 
  AppState,
  BusinessSettings, 
  BusinessTenant,
  InventoryCategory, 
  InventoryItem, 
  InventoryLog,
  InventoryUnit,
  MenuItem,
  ProductRecipe,
  PurchaseOrder,
  PurchaseOrderItem,
  RecipeIngredient,
  Session, 
  StockMovement, 
  Supplier
} from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { exportInventoryCSV } from '../../services/storage';
import { hasPermission, validateStockChange } from '../../services/security';
import { 
  calculateRecipeCosting, 
  processGoodsReceived, 
  recordStockAuditAdjustment, 
  recordStockTransfer 
} from '../../services/inventoryFinanceService';
import { InventoryFinanceWorkflowTestModal } from './InventoryFinanceWorkflowTestModal';

interface InventoryViewProps {
  inventoryItems: InventoryItem[];
  inventoryLogs: InventoryLog[];
  stockMovements?: StockMovement[];
  recipes?: ProductRecipe[];
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  menuItems?: MenuItem[];
  settings: BusinessSettings;
  activeBusiness?: BusinessTenant;
  lang: Language;
  currentSession?: Session | null;
  onStockIn: (itemId: string, quantity: number, costPerUnit: number, supplierName: string, notes: string) => void;
  onStockOut: (itemId: string, quantity: number, reason: 'wastage_spoilage' | 'manual_adjustment', notes: string) => void;
  onAddNewItem: (item: InventoryItem) => void;
  onUpdateAppState?: React.Dispatch<React.SetStateAction<AppState>>;
}

type InventorySubTab = 
  | 'inventory' 
  | 'movements' 
  | 'recipes' 
  | 'purchasing' 
  | 'stock_audit' 
  | 'transfers' 
  | 'alerts';

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventoryItems,
  inventoryLogs,
  stockMovements = [],
  recipes = [],
  suppliers = [],
  purchaseOrders = [],
  menuItems = [],
  settings,
  activeBusiness,
  lang,
  currentSession,
  onStockIn,
  onStockOut,
  onAddNewItem,
  onUpdateAppState
}) => {
  const t = TRANSLATIONS[lang];
  const userRole = currentSession?.role;
  const canStockInOut = !userRole || hasPermission(userRole, 'STOCK_IN_OUT');
  const [stockError, setStockError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<InventorySubTab>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<InventoryCategory | 'all'>('all');
  const [showTestModal, setShowTestModal] = useState(false);

  // Stock In Modal
  const [stockInTarget, setStockInTarget] = useState<InventoryItem | null>(null);
  const [stockInQty, setStockInQty] = useState<number>(10);
  const [stockInCost, setStockInCost] = useState<number>(0);
  const [stockInSupplier, setStockInSupplier] = useState<string>('');
  const [stockInNotes, setStockInNotes] = useState<string>('');

  // Stock Out Modal
  const [stockOutTarget, setStockOutTarget] = useState<InventoryItem | null>(null);
  const [stockOutQty, setStockOutQty] = useState<number>(1);
  const [stockOutReason, setStockOutReason] = useState<'wastage_spoilage' | 'manual_adjustment'>('wastage_spoilage');
  const [stockOutNotes, setStockOutNotes] = useState<string>('');

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNepaliName, setNewNepaliName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCategory, setNewCategory] = useState<InventoryCategory>('groceries');
  const [newStock, setNewStock] = useState<number>(10);
  const [newUnit, setNewUnit] = useState<InventoryUnit>('kg');
  const [newMinAlert, setNewMinAlert] = useState<number>(3);
  const [newReorderLevel, setNewReorderLevel] = useState<number>(5);
  const [newCost, setNewCost] = useState<number>(200);
  const [newSupplier, setNewSupplier] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [newLocation, setNewLocation] = useState('Main Store');

  // Recipe Modal
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState('');
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);

  // Purchase Order Modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [poSupplierId, setPOSupplierId] = useState('');
  const [poItems, setPOItems] = useState<PurchaseOrderItem[]>([]);
  const [poDeliveryDate, setPODeliveryDate] = useState('');

  // Goods Received Note Modal
  const [grnTargetPO, setGrnTargetPO] = useState<PurchaseOrder | null>(null);
  const [grnReceiveInputs, setGrnReceiveInputs] = useState<Record<string, number>>({});

  // Stock Audit Modal
  const [auditTargetItem, setAuditTargetItem] = useState<InventoryItem | null>(null);
  const [auditCount, setAuditCount] = useState<number>(0);
  const [auditReason, setAuditReason] = useState('Physical Stock Audit');

  // Stock Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferItemId, setTransferItemId] = useState('');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [fromLoc, setFromLoc] = useState('Main Store');
  const [toLoc, setToLoc] = useState('Kitchen Store');

  // Supplier Modal
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supPan, setSupPan] = useState('');
  const [supTerms, setSupTerms] = useState<'Cash on Delivery' | 'Net 7' | 'Net 15' | 'Net 30' | 'Advance'>('Net 15');

  // Calculations
  const totalValuation = inventoryItems.reduce((sum, item) => sum + (item.currentStock * (item.averageCost || item.costPerUnit)), 0);
  const lowStockItems = inventoryItems.filter(item => item.currentStock <= (item.reorderLevel || item.minStockAlert));
  const outOfStockItems = inventoryItems.filter(item => item.currentStock <= 0);

  // Expiring items
  const today = new Date();
  const expiringSoonItems = inventoryItems.filter(item => {
    if (!item.expiryDate) return false;
    const diff = (new Date(item.expiryDate).getTime() - today.getTime()) / (1000 * 3600 * 24);
    return diff >= 0 && diff <= 30;
  });
  const expiredItems = inventoryItems.filter(item => {
    if (!item.expiryDate) return false;
    return new Date(item.expiryDate) < today;
  });

  // Filtered items
  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nepaliName.includes(searchQuery) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [inventoryItems, selectedCategory, searchQuery]);

  // Handler: Stock In
  const handleOpenStockIn = (item: InventoryItem) => {
    setStockInTarget(item);
    setStockInQty(10);
    setStockInCost(item.costPerUnit);
    setStockInSupplier(item.supplierName || '');
    setStockInNotes('');
  };

  const handleConfirmStockIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInTarget) return;
    const validation = validateStockChange(stockInTarget.currentStock, stockInQty, false);
    if (!validation.isValid) {
      setStockError(validation.error || 'Invalid restock quantity.');
      return;
    }
    onStockIn(stockInTarget.id, stockInQty, stockInCost, stockInSupplier, stockInNotes);
    setStockInTarget(null);
    setStockError(null);
  };

  // Handler: Stock Out
  const handleOpenStockOut = (item: InventoryItem) => {
    setStockOutTarget(item);
    setStockOutQty(1);
    setStockOutReason('wastage_spoilage');
    setStockOutNotes('');
    setStockError(null);
  };

  const handleConfirmStockOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockOutTarget) return;
    const validation = validateStockChange(stockOutTarget.currentStock, stockOutQty, true);
    if (!validation.isValid) {
      setStockError(validation.error || 'Insufficient stock to deduct.');
      return;
    }
    onStockOut(stockOutTarget.id, stockOutQty, stockOutReason, stockOutNotes);
    setStockOutTarget(null);
    setStockError(null);
  };

  // Handler: Create New Item
  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCode.trim()) return;

    const newItem: InventoryItem = {
      id: 'inv-' + Date.now(),
      businessId: activeBusiness?.businessId || settings.businessId,
      code: newCode.trim(),
      name: newName.trim(),
      nepaliName: newNepaliName.trim() || newName.trim(),
      category: newCategory,
      currentStock: newStock,
      unit: newUnit,
      minStockAlert: newMinAlert,
      reorderLevel: newReorderLevel,
      costPerUnit: newCost,
      averageCost: newCost,
      supplierName: newSupplier.trim() || undefined,
      expiryDate: newExpiry || undefined,
      batchNumber: newBatch || undefined,
      storageLocation: newLocation,
      isActive: true,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    onAddNewItem(newItem);
    setShowAddModal(false);
    setNewName('');
    setNewNepaliName('');
    setNewCode('');
    setNewExpiry('');
    setNewBatch('');
  };

  // Handler: Save Recipe
  const handleSaveRecipe = () => {
    if (!selectedMenuItemId || recipeIngredients.length === 0 || !onUpdateAppState) return;
    const menuItem = menuItems.find(m => m.id === selectedMenuItemId);
    if (!menuItem) return;

    const costing = calculateRecipeCosting(recipeIngredients, menuItem.price, inventoryItems);

    const newRecipe: ProductRecipe = {
      id: 'rec-' + Date.now(),
      businessId: activeBusiness?.businessId || settings.businessId || 'biz-default',
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      ingredients: recipeIngredients,
      estimatedIngredientCost: costing.estimatedCost,
      sellingPrice: menuItem.price,
      grossMargin: costing.grossMargin,
      marginPercent: costing.marginPercent,
      isActive: true,
      updatedAt: new Date().toISOString().split('T')[0]
    };

    onUpdateAppState(prev => {
      const filtered = (prev.recipes || []).filter(r => r.menuItemId !== menuItem.id);
      const mappedRecipe = recipeIngredients.map(ing => ({
        inventoryItemId: ing.inventoryItemId,
        amount: ing.quantity,
        unit: ing.unit
      }));
      const updatedMenuItems = prev.menuItems.map(m =>
        m.id === menuItem.id
          ? {
              ...m,
              inventoryRecipe: mappedRecipe,
              costPrice: costing.estimatedCost || m.costPrice
            }
          : m
      );
      return {
        ...prev,
        recipes: [newRecipe, ...filtered],
        menuItems: updatedMenuItems
      };
    });

    setShowRecipeModal(false);
    setSelectedMenuItemId('');
    setRecipeIngredients([]);
  };

  // Handler: Save Supplier
  const handleSaveSupplier = () => {
    if (!supName.trim() || !onUpdateAppState) return;
    const newSup: Supplier = {
      id: 'sup-' + Date.now(),
      businessId: activeBusiness?.businessId || settings.businessId || 'biz-default',
      name: supName.trim(),
      contactPerson: supContact.trim(),
      phone: supPhone.trim(),
      email: supEmail.trim(),
      address: supAddress.trim(),
      panVatNumber: supPan.trim() || undefined,
      paymentTerms: supTerms,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    onUpdateAppState(prev => ({
      ...prev,
      suppliers: [newSup, ...(prev.suppliers || [])]
    }));

    setShowSupplierModal(false);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupPan('');
  };

  // Handler: Create Purchase Order
  const handleCreatePO = () => {
    if (!poSupplierId || poItems.length === 0 || !onUpdateAppState) return;
    const sup = suppliers.find(s => s.id === poSupplierId);
    const subtotal = poItems.reduce((s, i) => s + i.totalAmount, 0);

    const newPO: PurchaseOrder = {
      id: 'po-' + Date.now(),
      businessId: activeBusiness?.businessId || settings.businessId || 'biz-default',
      poNumber: `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      supplierId: poSupplierId,
      supplierName: sup?.name || 'Supplier',
      items: poItems,
      subtotal,
      taxTotal: 0,
      discountTotal: 0,
      grandTotal: subtotal,
      paidAmount: 0,
      status: 'SENT',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: poDeliveryDate || undefined,
      createdByName: currentSession?.name || 'Staff'
    };

    onUpdateAppState(prev => ({
      ...prev,
      purchaseOrders: [newPO, ...(prev.purchaseOrders || [])]
    }));

    setShowPOModal(false);
    setPOSupplierId('');
    setPOItems([]);
    setPODeliveryDate('');
  };

  // Handler: Confirm Goods Received Note (GRN)
  const handleConfirmGRN = () => {
    if (!grnTargetPO || !onUpdateAppState) return;

    const receivedPayload = Object.entries(grnReceiveInputs).map(([itemId, qty]) => ({
      inventoryItemId: itemId,
      quantityToReceive: Number(qty) || 0
    }));

    const result = processGoodsReceived(
      grnTargetPO,
      receivedPayload,
      inventoryItems,
      currentSession?.staffId || 'staff',
      currentSession?.name || 'Storekeeper'
    );

    onUpdateAppState(prev => {
      const updatedPOs = (prev.purchaseOrders || []).map(p => p.id === grnTargetPO.id ? result.updatedPO : p);
      const updatedPayables = result.payableCreated 
        ? [result.payableCreated, ...(prev.supplierPayables || [])] 
        : (prev.supplierPayables || []);
      const updatedMovements = [...result.movements, ...(prev.stockMovements || [])];

      return {
        ...prev,
        inventoryItems: result.updatedInventory,
        purchaseOrders: updatedPOs,
        supplierPayables: updatedPayables,
        stockMovements: updatedMovements
      };
    });

    setGrnTargetPO(null);
    setGrnReceiveInputs({});
  };

  // Handler: Physical Stock Audit Adjustment
  const handleConfirmStockAudit = () => {
    if (!auditTargetItem || !onUpdateAppState) return;
    const res = recordStockAuditAdjustment(
      auditTargetItem,
      auditCount,
      currentSession?.staffId || 'auditor',
      currentSession?.name || 'Auditor',
      auditReason
    );

    onUpdateAppState(prev => {
      const updatedItems = prev.inventoryItems.map(i => i.id === auditTargetItem.id ? res.updatedItem : i);
      return {
        ...prev,
        inventoryItems: updatedItems,
        stockMovements: [res.movement, ...(prev.stockMovements || [])]
      };
    });

    setAuditTargetItem(null);
    setAuditReason('Physical Stock Audit');
  };

  // Handler: Stock Transfer
  const handleConfirmStockTransfer = () => {
    if (!transferItemId || !onUpdateAppState) return;
    const item = inventoryItems.find(i => i.id === transferItemId);
    if (!item) return;

    const res = recordStockTransfer(
      item,
      transferQty,
      fromLoc,
      toLoc,
      currentSession?.staffId || 'staff',
      currentSession?.name || 'Staff'
    );

    if (res.error) {
      setStockError(res.error);
      return;
    }

    onUpdateAppState(prev => ({
      ...prev,
      stockMovements: [res.movement, ...(prev.stockMovements || [])]
    }));

    setShowTransferModal(false);
    setTransferItemId('');
    setTransferQty(1);
    setStockError(null);
  };

  const categories: { id: InventoryCategory | 'all'; label: string }[] = [
    { id: 'all', label: lang === 'ne' ? 'सबै' : 'All' },
    { id: 'coffee_tea', label: lang === 'ne' ? 'कफी र चिया' : 'Coffee & Tea' },
    { id: 'dairy', label: lang === 'ne' ? 'दुग्धजन्य (Dairy)' : 'Dairy' },
    { id: 'meat_poultry', label: lang === 'ne' ? 'मासु तथा चिकेन' : 'Meat & Poultry' },
    { id: 'groceries', label: lang === 'ne' ? 'किराना तथा चामल' : 'Groceries' },
    { id: 'vegetables', label: lang === 'ne' ? 'तरकारी' : 'Vegetables' },
    { id: 'beverages_bar', label: lang === 'ne' ? 'बार पेय' : 'Bar Spirits' },
    { id: 'resort_supplies', label: lang === 'ne' ? 'रिसोर्ट सामग्री' : 'Resort Supplies' },
    { id: 'packaging', label: lang === 'ne' ? 'पार्सल बक्स' : 'Packaging' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Executive Action Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-800" />
                {lang === 'ne' ? 'भण्डार, खरिद तथा आपूर्ति व्यवस्थापन' : 'Enterprise Inventory, Purchase & Recipes'}
              </h2>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">
                {activeBusiness?.businessName || settings.businessName || 'Business Inventory'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Strictly business-scoped stock ledger, recipe BOM costing, goods received (GRN), and physical audit
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowTestModal(true)}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Run Phase 6 Tests
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" /> New Item
            </button>
            <button
              onClick={() => setShowPOModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Truck className="h-3.5 w-3.5" /> New PO
            </button>
            <button
              onClick={() => setShowRecipeModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" /> New Recipe
            </button>
            <button
              onClick={() => exportInventoryCSV(inventoryItems, settings.businessName)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-3 text-xs font-semibold">
          {[
            { id: 'inventory', label: 'Stock SKUs & Valuation', icon: Layers },
            { id: 'movements', label: `Stock Ledger (${stockMovements.length})`, icon: History },
            { id: 'recipes', label: `Recipes & BOM (${recipes.length})`, icon: BookOpen },
            { id: 'purchasing', label: `Purchases & Suppliers (${purchaseOrders.length})`, icon: Truck },
            { id: 'stock_audit', label: 'Stock Audit / Count', icon: CheckSquare },
            { id: 'transfers', label: 'Internal Transfers', icon: ArrowRightLeft },
            { id: 'alerts', label: `Alerts (${lowStockItems.length + expiredItems.length})`, icon: AlertTriangle }
          ].map(t => {
            const Icon = t.icon;
            const isSel = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as InventorySubTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isSel ? 'bg-slate-900 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Inventory SKUs</span>
            <Package className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono-num mt-1">{inventoryItems.length}</p>
          <p className="text-[11px] text-slate-500">Active managed items</p>
        </div>

        <div className={`p-4 rounded-xl border shadow-2xs space-y-1 ${lowStockItems.length > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">Low Stock & Out</span>
            <AlertTriangle className={`h-4 w-4 ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <p className="text-2xl font-black font-mono-num mt-1 text-amber-950">{lowStockItems.length}</p>
          <p className="text-[11px] text-amber-800">{outOfStockItems.length} out of stock</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Stock Asset Valuation</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-800 font-mono-num mt-1">
            {settings.currencySymbol} {totalValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-slate-500">Weighted Average Costing</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Open Purchase Orders</span>
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-900 font-mono-num mt-1">
            {purchaseOrders.filter(p => p.status === 'SENT' || p.status === 'PARTIALLY_RECEIVED').length}
          </p>
          <p className="text-[11px] text-blue-700">Awaiting goods delivery</p>
        </div>
      </div>

      {/* Main Tab Views */}

      {/* ================= TAB 1: INVENTORY ITEMS ================= */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search item, code, or Nepali name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Showing <strong>{filteredItems.length}</strong> of <strong>{inventoryItems.length}</strong> SKUs
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Code / SKU</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Current Stock</th>
                  <th className="py-3 px-4 text-right">Reorder Level</th>
                  <th className="py-3 px-4 text-right">Avg Cost</th>
                  <th className="py-3 px-4 text-right">Total Value</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                      No matching inventory items found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.currentStock <= (item.reorderLevel || item.minStockAlert);
                    const isOut = item.currentStock <= 0;
                    const val = item.currentStock * (item.averageCost || item.costPerUnit);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.code}</td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <p className="text-[11px] text-slate-500">{item.nepaliName}</p>
                          {item.batchNumber && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono">
                              Batch: {item.batchNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 capitalize">{item.category.replace('_', ' ')}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-mono font-black text-sm ${isOut ? 'text-rose-600' : isLow ? 'text-amber-700' : 'text-slate-900'}`}>
                            {item.currentStock} {item.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">
                          {item.reorderLevel || item.minStockAlert} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {settings.currencySymbol} {(item.averageCost || item.costPerUnit).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                          {settings.currencySymbol} {val.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{item.storageLocation || 'Main Store'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenStockIn(item)}
                              disabled={!canStockInOut}
                              title="Stock In / Purchase Addition"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md font-semibold transition-colors disabled:opacity-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenStockOut(item)}
                              disabled={!canStockInOut}
                              title="Stock Out / Wastage"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md font-semibold transition-colors disabled:opacity-50"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setAuditTargetItem(item);
                                setAuditCount(item.currentStock);
                              }}
                              title="Physical Stock Audit"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                            >
                              <CheckSquare className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: STOCK MOVEMENTS LEDGER ================= */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Immutable Stock Movement Ledger</h3>
              <p className="text-xs text-slate-500">Every stock in, sale deduction, purchase receiving, and wastage movement is permanently recorded</p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
              {stockMovements.length} total entries
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-y border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Date / Time</th>
                  <th className="py-2.5 px-3">Item</th>
                  <th className="py-2.5 px-3">Movement Type</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Prev Stock</th>
                  <th className="py-2.5 px-3 text-right">New Stock</th>
                  <th className="py-2.5 px-3">Reason / Reference</th>
                  <th className="py-2.5 px-3">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No stock movements recorded yet. Complete sales, stock-ins, or physical audits to generate ledger records.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-500">{m.dateTime}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{m.itemName}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wide ${
                          m.movementType === 'STOCK_IN' || m.movementType === 'PURCHASE' ? 'bg-emerald-100 text-emerald-800' :
                          m.movementType === 'SALE_CONSUMPTION' ? 'bg-blue-100 text-blue-800' :
                          m.movementType === 'WASTAGE' || m.movementType === 'DAMAGE' ? 'bg-rose-100 text-rose-800' :
                          m.movementType === 'RETURN' ? 'bg-purple-100 text-purple-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {m.movementType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {m.quantity} {m.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{m.previousStock}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{m.newStock}</td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{m.reason}</td>
                      <td className="py-2.5 px-3 text-slate-500">{m.userName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: RECIPES & BOM ================= */}
      {activeTab === 'recipes' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Product Recipes & Bill of Materials (BOM)</h3>
              <p className="text-xs text-slate-500">Connect POS dishes with raw ingredients, calculate recipe costs, and track gross margin percentage</p>
            </div>
            <button
              onClick={() => setShowRecipeModal(true)}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Create Recipe
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic">
                No recipes created yet. Click "Create Recipe" to link POS dishes with raw ingredients.
              </div>
            ) : (
              recipes.map(r => (
                <div key={r.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{r.menuItemName}</h4>
                      <p className="text-[11px] text-slate-500">{r.ingredients.length} raw ingredients</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-full">
                      {r.marginPercent}% Margin
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                    {r.ingredients.map((ing, idx) => (
                      <div key={idx} className="py-1 flex justify-between items-center text-slate-600">
                        <span>{ing.itemName}</span>
                        <span className="font-mono font-bold">{ing.quantity} {ing.unit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Ingredient Cost</span>
                      <span className="font-mono font-bold text-slate-700">
                        {settings.currencySymbol} {r.estimatedIngredientCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px]">Selling Price</span>
                      <span className="font-mono font-bold text-emerald-800 text-sm">
                        {settings.currencySymbol} {r.sellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 4: PURCHASING & SUPPLIERS ================= */}
      {activeTab === 'purchasing' && (
        <div className="space-y-6">
          {/* Purchase Orders */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Purchase Orders (PO) & Goods Receiving</h3>
                <p className="text-xs text-slate-500">Generate POs, verify quantities on arrival, update inventory, and create payables</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSupplierModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" /> New Supplier
                </button>
                <button
                  onClick={() => setShowPOModal(true)}
                  className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" /> Create PO
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">PO #</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Order Date</th>
                    <th className="py-2.5 px-3">Items Count</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No purchase orders registered. Click "Create PO" to place an order.
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map(po => (
                      <tr key={po.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{po.poNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{po.supplierName}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">{po.orderDate}</td>
                        <td className="py-2.5 px-3">{po.items.length} line items</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {settings.currencySymbol} {po.grandTotal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wide ${
                            po.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-800' :
                            po.status === 'PARTIALLY_RECEIVED' ? 'bg-amber-100 text-amber-800' :
                            po.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && (
                            <button
                              onClick={() => {
                                setGrnTargetPO(po);
                                const initialRecv: Record<string, number> = {};
                                po.items.forEach(i => {
                                  initialRecv[i.inventoryItemId] = i.quantityOrdered - i.quantityReceived;
                                });
                                setGrnReceiveInputs(initialRecv);
                              }}
                              className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded font-bold text-xs"
                            >
                              Receive Goods (GRN)
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Suppliers Directory */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Verified Suppliers Directory ({suppliers.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {suppliers.map(s => (
                <div key={s.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-900">{s.name}</h4>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-700 font-semibold rounded">
                      {s.paymentTerms}
                    </span>
                  </div>
                  <p className="text-slate-600">Contact: {s.contactPerson} · {s.phone}</p>
                  <p className="text-slate-500">{s.address}</p>
                  {s.panVatNumber && (
                    <p className="text-[10px] text-slate-400 font-mono">PAN/VAT: {s.panVatNumber}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: PHYSICAL STOCK AUDIT ================= */}
      {activeTab === 'stock_audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Physical Stock Audit & Count Reconciler</h3>
            <p className="text-xs text-slate-500">Perform periodic physical count, verify discrepancies against system ledger, and post approved variance adjustments</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {inventoryItems.map(item => (
              <div key={item.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between gap-3 text-xs">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="font-mono text-slate-400 text-[10px]">{item.code}</span>
                  </div>
                  <p className="text-slate-500 mt-1">
                    System Stock: <strong className="text-slate-900 font-mono">{item.currentStock} {item.unit}</strong>
                  </p>
                  <p className="text-[10px] text-slate-400">Location: {item.storageLocation || 'Main Store'}</p>
                </div>

                <button
                  onClick={() => {
                    setAuditTargetItem(item);
                    setAuditCount(item.currentStock);
                  }}
                  className="w-full py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <CheckSquare className="h-3.5 w-3.5 text-emerald-700" /> Count & Reconcile
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 6: INTERNAL TRANSFERS ================= */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Internal Stock Transfers</h3>
              <p className="text-xs text-slate-500">Move inventory between property departments (Main Store $\rightarrow$ Kitchen Store, Bar Store, Housekeeping Store)</p>
            </div>
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer Stock
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {stockMovements.filter(m => m.movementType === 'TRANSFER').length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">No internal stock transfers recorded yet.</div>
            ) : (
              stockMovements.filter(m => m.movementType === 'TRANSFER').map(tr => (
                <div key={tr.id} className="p-3.5 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <span className="font-bold text-slate-900">{tr.itemName}</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">{tr.reason}</p>
                    <span className="text-[10px] text-slate-400 font-mono">{tr.dateTime} · By {tr.userName}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {tr.quantity} {tr.unit}
                    </span>
                    <span className="text-[10px] text-emerald-700 block font-semibold">Completed</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 7: ALERTS & EXPIRY CENTER ================= */}
      {activeTab === 'alerts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Low Stock & Out of Stock */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Reorder & Low Stock Alerts ({lowStockItems.length})
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {lowStockItems.length === 0 ? (
                <p className="py-6 text-center text-emerald-800 italic">All items are adequately stocked!</p>
              ) : (
                lowStockItems.map(i => (
                  <div key={i.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-900">{i.name}</p>
                      <p className="text-[10px] text-slate-400">Reorder Level: {i.reorderLevel || i.minStockAlert} {i.unit}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-black ${i.currentStock <= 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                        {i.currentStock} {i.unit}
                      </span>
                      <button
                        onClick={() => handleOpenStockIn(i)}
                        className="block text-[10px] text-emerald-800 font-bold hover:underline mt-0.5"
                      >
                        + Restock
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expiry Tracking */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-rose-600" />
              Perishable Expiry Tracking ({expiringSoonItems.length + expiredItems.length})
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {expiringSoonItems.length === 0 && expiredItems.length === 0 ? (
                <p className="py-6 text-center text-slate-400 italic">No perishable items expiring soon.</p>
              ) : (
                [...expiredItems, ...expiringSoonItems].map(i => {
                  const isExp = i.expiryDate && new Date(i.expiryDate) < today;
                  return (
                    <div key={i.id} className="py-2.5 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900">{i.name}</p>
                        <p className="text-[10px] text-slate-400">Batch: {i.batchNumber || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] px-2 py-0.5 font-bold rounded ${
                          isExp ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {isExp ? 'EXPIRED' : `Expires: ${i.expiryDate}`}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-500 mt-0.5">
                          {i.currentStock} {i.unit}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Stock In Modal */}
      {stockInTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Stock In / Restock: {stockInTarget.name}</h3>
              <button onClick={() => setStockInTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {stockError && (
              <div className="p-2 bg-rose-50 text-rose-800 rounded border border-rose-200">{stockError}</div>
            )}

            <form onSubmit={handleConfirmStockIn} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Restock Quantity ({stockInTarget.unit}):</label>
                <NumberInput
                  min={0.01}
                  required
                  value={stockInQty}
                  onValueChange={(val) => setStockInQty(val)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Unit Cost Price ({settings.currencySymbol}):</label>
                <NumberInput
                  min={0}
                  value={stockInCost}
                  onValueChange={(val) => setStockInCost(val)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Supplier Name:</label>
                <input
                  type="text"
                  value={stockInSupplier}
                  onChange={(e) => setStockInSupplier(e.target.value)}
                  placeholder="e.g. Pokhara Dairy Vendor"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Notes / Invoice No:</label>
                <input
                  type="text"
                  value={stockInNotes}
                  onChange={(e) => setStockInNotes(e.target.value)}
                  placeholder="e.g. Direct purchase cash bill #8812"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStockInTarget(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-2xs"
                >
                  Confirm Stock-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Out Modal */}
      {stockOutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Stock Out / Wastage: {stockOutTarget.name}</h3>
              <button onClick={() => setStockOutTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {stockError && (
              <div className="p-2 bg-rose-50 text-rose-800 rounded border border-rose-200">{stockError}</div>
            )}

            <form onSubmit={handleConfirmStockOut} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Deduct Quantity ({stockOutTarget.unit}):</label>
                <NumberInput
                  min={0.01}
                  required
                  value={stockOutQty}
                  onValueChange={(val) => setStockOutQty(val)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Reason for Deduction:</label>
                <select
                  value={stockOutReason}
                  onChange={(e) => setStockOutReason(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="wastage_spoilage">Wastage / Kitchen Spoilage / Expired</option>
                  <option value="manual_adjustment">Manual Stock Adjustment / Broken</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Audit Explanation:</label>
                <input
                  type="text"
                  required
                  value={stockOutNotes}
                  onChange={(e) => setStockOutNotes(e.target.value)}
                  placeholder="e.g. Expired batch discarded from kitchen chiller"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStockOutTarget(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg shadow-2xs"
                >
                  Confirm Stock-Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Create New Inventory Stock Item</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">SKU / Code:</label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g. COF-01"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Category:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    {categories.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Item Name (English):</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Organic Nuwakot Coffee Beans"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nepali Name (वैकल्पिक नाम):</label>
                <input
                  type="text"
                  value={newNepaliName}
                  onChange={(e) => setNewNepaliName(e.target.value)}
                  placeholder="e.g. नुवाकोट अर्गानिक कफी दाना"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Initial Stock:</label>
                  <NumberInput
                    min={0}
                    value={newStock}
                    onValueChange={(val) => setNewStock(val)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Unit:</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="g">Gram (g)</option>
                    <option value="ltr">Liter (ltr)</option>
                    <option value="ml">Milliliter (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="bottle">Bottle</option>
                    <option value="box">Box</option>
                    <option value="pkt">Packet (pkt)</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cost / Unit ({settings.currencySymbol}):</label>
                  <NumberInput
                    min={0}
                    value={newCost}
                    onValueChange={(val) => setNewCost(val)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Min Stock Alert:</label>
                  <NumberInput
                    min={0}
                    value={newMinAlert}
                    onValueChange={(val) => setNewMinAlert(val)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Reorder Level:</label>
                  <NumberInput
                    min={0}
                    value={newReorderLevel}
                    onValueChange={(val) => setNewReorderLevel(val)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Batch Number (Optional):</label>
                  <input
                    type="text"
                    value={newBatch}
                    onChange={(e) => setNewBatch(e.target.value)}
                    placeholder="e.g. BAT-2026-OCT"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Expiry Date (Optional):</label>
                  <input
                    type="date"
                    value={newExpiry}
                    onChange={(e) => setNewExpiry(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-2xs"
                >
                  Create Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recipe Builder Modal */}
      {showRecipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Product Recipe & BOM Builder</h3>
              <button onClick={() => setShowRecipeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Menu Dish / Drink:</label>
                <select
                  value={selectedMenuItemId}
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="">-- Choose Menu Product --</option>
                  {menuItems.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({settings.currencySymbol} {m.price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">Raw Ingredients</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (inventoryItems.length > 0) {
                        const first = inventoryItems[0];
                        setRecipeIngredients([...recipeIngredients, {
                          inventoryItemId: first.id,
                          itemName: first.name,
                          quantity: 1,
                          unit: first.unit
                        }]);
                      }
                    }}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold text-[11px]"
                  >
                    + Add Ingredient
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recipeIngredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
                      <select
                        value={ing.inventoryItemId}
                        onChange={(e) => {
                          const item = inventoryItems.find(i => i.id === e.target.value);
                          if (item) {
                            const updated = [...recipeIngredients];
                            updated[idx] = { ...updated[idx], inventoryItemId: item.id, itemName: item.name, unit: item.unit };
                            setRecipeIngredients(updated);
                          }
                        }}
                        className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
                      >
                        {inventoryItems.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                        ))}
                      </select>

                      <NumberInput
                        min={0.001}
                        value={ing.quantity}
                        onValueChange={(val) => {
                          setRecipeIngredients((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, quantity: val } : item))
                          );
                        }}
                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold"
                      />

                      <span className="w-12 text-slate-500 font-mono text-[11px]">{ing.unit}</span>

                      <button
                        type="button"
                        onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== idx))}
                        className="text-rose-600 hover:text-rose-800 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRecipeModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRecipe}
                  disabled={!selectedMenuItemId || recipeIngredients.length === 0}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg shadow-2xs"
                >
                  Save Recipe (BOM)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goods Received Note (GRN) Modal */}
      {grnTargetPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Goods Received Note (GRN)</h3>
                <p className="text-slate-500 text-[11px]">PO #{grnTargetPO.poNumber} · {grnTargetPO.supplierName}</p>
              </div>
              <button onClick={() => setGrnTargetPO(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-slate-600">
                Verify physically delivered quantities. Received stock will be added to inventory and weighted average cost updated.
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {grnTargetPO.items.map(item => (
                  <div key={item.inventoryItemId} className="p-3 bg-white flex justify-between items-center gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{item.itemName}</p>
                      <p className="text-[11px] text-slate-500">
                        Ordered: {item.quantityOrdered} {item.unit} · Already Received: {item.quantityReceived} {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-slate-500">Receive Now:</label>
                      <NumberInput
                        min={0}
                        max={item.quantityOrdered - item.quantityReceived}
                        value={grnReceiveInputs[item.inventoryItemId] ?? 0}
                        onValueChange={(val) => {
                          setGrnReceiveInputs((prev) => ({
                            ...prev,
                            [item.inventoryItemId]: val
                          }));
                        }}
                        className="w-20 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-right text-xs"
                      />
                      <span className="text-slate-500">{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGrnTargetPO(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmGRN}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-2xs"
                >
                  Confirm Goods Receipt (GRN)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Physical Stock Audit Modal */}
      {auditTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Physical Stock Audit & Count</h3>
              <button onClick={() => setAuditTargetItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">{auditTargetItem.name}</p>
                <p className="text-slate-600">
                  System Ledger Stock: <strong className="font-mono text-slate-900">{auditTargetItem.currentStock} {auditTargetItem.unit}</strong>
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Physical Counted Quantity ({auditTargetItem.unit}):</label>
                <NumberInput
                  min={0}
                  value={auditCount}
                  onValueChange={(val) => setAuditCount(val)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-black text-sm"
                />
              </div>

              <div className="p-2.5 rounded-lg border text-xs flex justify-between items-center font-bold">
                <span>Calculated Variance:</span>
                <span className={`font-mono text-sm ${
                  auditCount - auditTargetItem.currentStock === 0 ? 'text-emerald-800' :
                  auditCount - auditTargetItem.currentStock < 0 ? 'text-rose-700' : 'text-blue-700'
                }`}>
                  {auditCount - auditTargetItem.currentStock > 0 ? '+' : ''}
                  {Math.round((auditCount - auditTargetItem.currentStock) * 1000) / 1000} {auditTargetItem.unit}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Audit Reason / Justification:</label>
                <input
                  type="text"
                  required
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. End of Month Physical Audit"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAuditTargetItem(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStockAudit}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-2xs"
                >
                  Post Variance Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 text-xs animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Internal Stock Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {stockError && (
              <div className="p-2 bg-rose-50 text-rose-800 rounded border border-rose-200">{stockError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Item to Transfer:</label>
                <select
                  value={transferItemId}
                  onChange={(e) => setTransferItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
                >
                  <option value="">-- Choose Stock Item --</option>
                  {inventoryItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Stock: {i.currentStock} {i.unit})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Transfer Quantity:</label>
                <NumberInput
                  min={0.01}
                  value={transferQty}
                  onValueChange={(val) => setTransferQty(val)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">From Location:</label>
                  <select
                    value={fromLoc}
                    onChange={(e) => setFromLoc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Main Store">Main Store</option>
                    <option value="Kitchen Store">Kitchen Store</option>
                    <option value="Bar Store">Bar Store</option>
                    <option value="Housekeeping Store">Housekeeping Store</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">To Location:</label>
                  <select
                    value={toLoc}
                    onChange={(e) => setToLoc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="Kitchen Store">Kitchen Store</option>
                    <option value="Bar Store">Bar Store</option>
                    <option value="Housekeeping Store">Housekeeping Store</option>
                    <option value="Main Store">Main Store</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStockTransfer}
                  disabled={!transferItemId || transferQty <= 0}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg shadow-2xs"
                >
                  Confirm Transfer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Automated Test Suite Modal */}
      {showTestModal && (
        <InventoryFinanceWorkflowTestModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          activeBusiness={activeBusiness || { businessId: settings.businessId || 'biz-default', businessName: settings.businessName || 'Business' } as any}
          appState={{
            inventoryItems,
            inventoryLogs,
            stockMovements,
            recipes,
            suppliers,
            purchaseOrders,
            orders: [],
            menuItems,
            tablesRooms: [],
            customers: [],
            khataTransactions: [],
            expenses: [],
            dayClosings: [],
            staffUsers: [],
            auditLogs: [],
            settings,
            roomTypes: [],
            resortRooms: [],
            guestProfiles: [],
            reservations: [],
            guestFolioItems: [],
            resortServices: [],
            housekeepingTasks: [],
            maintenanceIssues: [],
            hotelPayments: []
          }}
          currentSession={currentSession || null}
        />
      )}
    </div>
  );
};
