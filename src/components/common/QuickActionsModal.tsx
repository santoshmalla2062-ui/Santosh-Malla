import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  Command, 
  X, 
  ArrowRight, 
  Utensils, 
  Receipt, 
  ChefHat, 
  Calendar, 
  Hotel, 
  Package, 
  Banknote, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Clock, 
  Check, 
  AlertTriangle,
  History,
  Wifi,
  Sparkles,
  LayoutGrid,
  QrCode
} from 'lucide-react';
import { AppState, StaffRole } from '../../types';
import { ActiveTab } from '../Navigation';
import { Language } from '../../utils/translations';
import { hasPermission } from '../../services/security';

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  activeBusinessId: string;
  lang: Language;
  currentRole?: StaffRole;
  onNavigateToTab: (tab: ActiveTab, subAction?: string) => void;
  onOpenAuditLogs: () => void;
  onOpenSyncDetails: () => void;
  onOpenMobileQR?: () => void;
}

interface SearchResultItem {
  id: string;
  type: 'menu_item' | 'order' | 'customer' | 'table' | 'room' | 'reservation' | 'inventory';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  targetTab: ActiveTab;
  actionPayload?: any;
}

export const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  isOpen,
  onClose,
  appState,
  activeBusinessId,
  lang,
  currentRole,
  onNavigateToTab,
  onOpenAuditLogs,
  onOpenSyncDetails,
  onOpenMobileQR
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Define authorized quick shortcuts based on current role
  const quickShortcuts = useMemo(() => {
    const role = currentRole || 'STAFF';
    const list = [
      {
        id: 'qa-pos',
        title: lang === 'ne' ? 'नयाँ अर्डर सुरु गर्नुहोस्' : 'New Order / POS Terminal',
        subtitle: 'Point of sale, take order, quick billing',
        icon: Receipt,
        tab: 'pos' as ActiveTab,
        action: 'VIEW_TAB_POS'
      },
      {
        id: 'qa-tables',
        title: lang === 'ne' ? 'डाइनिङ टेबल हेर्नुहोस्' : 'Floor Tables & Dining Rooms',
        subtitle: 'View occupied tables, assign waiters, shift table',
        icon: LayoutGrid,
        tab: 'tables_rooms' as ActiveTab,
        action: 'VIEW_TAB_TABLES'
      },
      {
        id: 'qa-kds',
        title: lang === 'ne' ? 'किचन डिस्प्ले प्रणाली खोल्नुहोस्' : 'Kitchen Display System (KDS)',
        subtitle: 'Track live KOT orders, cooking timer, ready alerts',
        icon: ChefHat,
        tab: 'kds' as ActiveTab,
        action: 'VIEW_TAB_KDS'
      },
      {
        id: 'qa-resort',
        title: lang === 'ne' ? 'रिसोर्ट बुकिङ र फ्रन्ट डेस्क' : 'Resort & Hotel Front Desk',
        subtitle: 'Reservations, guest check-in/out, room folios',
        icon: Hotel,
        tab: 'resort' as ActiveTab,
        action: 'VIEW_TAB_RESORT'
      },
      {
        id: 'qa-inventory',
        title: lang === 'ne' ? 'सामान मौज्दात र स्टक प्रविष्टि' : 'Inventory & Raw Materials',
        subtitle: 'Stock level, recipe cost, low-stock warnings',
        icon: Package,
        tab: 'inventory' as ActiveTab,
        action: 'VIEW_TAB_INVENTORY'
      },
      {
        id: 'qa-closing',
        title: lang === 'ne' ? 'दैनिक खर्च र हिसाब बन्द' : 'Day Closing & Daily Expenses',
        subtitle: 'Close cash register, reconcile drawer, log costs',
        icon: Banknote,
        tab: 'day_closing' as ActiveTab,
        action: 'VIEW_TAB_DAY_CLOSING'
      },
      {
        id: 'qa-reports',
        title: lang === 'ne' ? 'बिक्री तथा वित्तीय प्रतिवेदन' : 'Financial & Sales Analytics',
        subtitle: 'Daily sales, category breakdown, tax summary',
        icon: BarChart3,
        tab: 'reports' as ActiveTab,
        action: 'VIEW_TAB_REPORTS'
      },
      {
        id: 'qa-customers',
        title: lang === 'ne' ? 'ग्राहक तथा उधारो खाता' : 'Customers & Credit Khata',
        subtitle: 'Customer ledgers, loyalty points, receivables',
        icon: Users,
        tab: 'customers' as ActiveTab,
        action: 'VIEW_TAB_CUSTOMERS'
      }
    ];

    return list.filter(item => hasPermission(role, item.action as any));
  }, [currentRole, lang]);

  // Real-time Multi-Tenant Smart Search across authorized records
  const searchResults: SearchResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: SearchResultItem[] = [];

    // 1. Search Menu Items
    (appState.menuItems || []).forEach(item => {
      const match = item.name.toLowerCase().includes(q) ||
        (item.nepaliName && item.nepaliName.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q);
      if (match) {
        results.push({
          id: `item-${item.id}`,
          type: 'menu_item',
          title: item.name,
          subtitle: `${item.nepaliName ? `${item.nepaliName} • ` : ''}Rs. ${item.price.toLocaleString()} (${item.category})`,
          badge: item.isAvailable !== false ? 'In Menu' : 'Out of Stock',
          badgeColor: item.isAvailable !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
          targetTab: 'pos',
          actionPayload: { menuItemId: item.id }
        });
      }
    });

    // 2. Search Customers
    (appState.customers || []).forEach(c => {
      const match = c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q));
      if (match) {
        results.push({
          id: `cust-${c.id}`,
          type: 'customer',
          title: c.name,
          subtitle: `${c.phone || 'No phone'} • Khata Due: Rs. ${(c.creditBalance || 0).toLocaleString()}`,
          badge: (c.creditBalance || 0) > 0 ? 'Khata Due' : 'Customer',
          badgeColor: (c.creditBalance || 0) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800',
          targetTab: 'customers',
          actionPayload: { customerId: c.id }
        });
      }
    });

    // 3. Search Orders (Invoice No, KOT No, Table)
    (appState.orders || []).forEach(o => {
      const match = (o.invoiceNo && o.invoiceNo.toLowerCase().includes(q)) ||
        (o.kotNo && o.kotNo.toLowerCase().includes(q)) ||
        (o.tableRoomName && o.tableRoomName.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q));
      if (match) {
        results.push({
          id: `order-${o.id}`,
          type: 'order',
          title: `${o.tableRoomName || `Token #${o.kotNo}`} • ${o.invoiceNo || `KOT #${o.kotNo}`}`,
          subtitle: `${o.orderType.toUpperCase()} • Rs. ${o.grandTotal.toLocaleString()} • Status: ${o.status}`,
          badge: o.status === 'completed' ? 'Paid' : 'Active',
          badgeColor: o.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800',
          targetTab: o.status === 'completed' ? 'reports' : 'pos',
          actionPayload: { orderId: o.id }
        });
      }
    });

    // 4. Search Tables & Resort Rooms
    (appState.tablesRooms || []).forEach(tr => {
      if (tr.name.toLowerCase().includes(q)) {
        results.push({
          id: `tr-${tr.id}`,
          type: 'table',
          title: tr.name,
          subtitle: `Capacity: ${tr.capacity} • Type: ${tr.type} • Status: ${tr.status}`,
          badge: tr.status,
          badgeColor: tr.status === 'occupied' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800',
          targetTab: 'tables_rooms'
        });
      }
    });

    // 5. Search Resort Reservations & Rooms
    (appState.reservations || []).forEach(r => {
      const match = r.guestName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.roomNumber && r.roomNumber.includes(q));
      if (match) {
        results.push({
          id: `res-${r.id}`,
          type: 'reservation',
          title: `${r.guestName} (Room ${r.roomNumber || 'TBD'})`,
          subtitle: `Check-in: ${r.checkInDate} • Check-out: ${r.checkOutDate} • ${r.status}`,
          badge: r.status,
          badgeColor: 'bg-blue-100 text-blue-800',
          targetTab: 'resort'
        });
      }
    });

    // 6. Search Inventory
    (appState.inventoryItems || []).forEach(inv => {
      if (inv.name.toLowerCase().includes(q) || inv.category.toLowerCase().includes(q)) {
        results.push({
          id: `inv-${inv.id}`,
          type: 'inventory',
          title: inv.name,
          subtitle: `Stock: ${inv.currentStock} ${inv.unit} • Cost: Rs. ${inv.costPerUnit} (${inv.category})`,
          badge: inv.currentStock <= inv.minStockAlert ? 'Low Stock' : 'In Stock',
          badgeColor: inv.currentStock <= inv.minStockAlert ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800',
          targetTab: 'inventory'
        });
      }
    });

    return results.slice(0, 20); // Top 20 results
  }, [query, appState]);

  // Combined item list for keyboard navigation
  const itemsToNavigate = query.trim() ? searchResults : quickShortcuts;

  const handleSelect = (item: any) => {
    onClose();
    if (item.tab) {
      onNavigateToTab(item.tab);
    } else if (item.targetTab) {
      onNavigateToTab(item.targetTab);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, itemsToNavigate.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + itemsToNavigate.length) % Math.max(1, itemsToNavigate.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (itemsToNavigate[selectedIndex]) {
        handleSelect(itemsToNavigate[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 sm:pt-20 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150 my-auto sm:my-0"
        role="dialog"
        aria-label="Quick Actions and Universal Search"
      >
        {/* Search Input Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50/80">
          <Search className="h-5 w-5 text-orange-600 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={lang === 'ne' 
              ? 'खाना, अर्डर, ग्राहक, टेबल, बुकिङ वा सामान खोज्नुहोस्...' 
              : 'Search dishes, invoices, customers, tables, rooms, stock...'}
            className="flex-1 bg-transparent text-sm sm:text-base font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              title="Clear search"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">
              ESC
            </kbd>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close search"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors sm:hidden"
          >
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Results / Shortcuts List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {query.trim() === '' ? (
            /* Quick Action Shortcuts when search is empty */
            <div>
              <div className="px-3 py-2 text-[11px] font-black uppercase text-slate-400 flex items-center justify-between">
                <span>{lang === 'ne' ? 'द्रुत सर्टकटहरू (Quick Actions)' : 'Authorized Quick Actions'}</span>
                <span>{currentRole}</span>
              </div>
              <div className="space-y-1">
                {quickShortcuts.map((sc, idx) => {
                  const Icon = sc.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => handleSelect(sc)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'bg-orange-50 text-orange-950 border border-orange-200 shadow-2xs'
                          : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${
                          isSelected ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                            {sc.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {sc.subtitle}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className={`h-4 w-4 transition-transform ${
                        isSelected ? 'text-orange-600 translate-x-1' : 'text-slate-300'
                      }`} />
                    </button>
                  );
                })}
              </div>

              {/* System Diagnostics Buttons */}
              <div className="mt-3 pt-3 border-t border-slate-100 px-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { onClose(); onOpenAuditLogs(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <History className="h-3.5 w-3.5 text-slate-600" />
                  <span>Audit Trail</span>
                </button>
                <button
                  onClick={() => { onClose(); onOpenSyncDetails(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <Wifi className="h-3.5 w-3.5 text-slate-600" />
                  <span>Sync & Offline Suite</span>
                </button>
                {onOpenMobileQR && (
                  <button
                    onClick={() => { onClose(); onOpenMobileQR(); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    <QrCode className="h-3.5 w-3.5 text-emerald-700" />
                    <span>{lang === 'ne' ? 'मोबाइल पहुँच QR कोड' : 'Mobile Access & QR Code'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            /* Empty Search Result */
            <div className="p-8 text-center text-slate-500">
              <Search className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-sm text-slate-700">
                {lang === 'ne' ? 'कुनै नतिजा फेला परेन' : 'No records found matching query'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                "{query}" {lang === 'ne' ? 'सँग सम्बन्धित कुनै मेनु, अर्डर वा ग्राहक छैन।' : 'returned zero matches in current business.'}
              </p>
            </div>
          ) : (
            /* Search Results */
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase">
                {searchResults.length} {lang === 'ne' ? 'नतिजाहरू फेला परे' : 'Matches Found'}
              </div>
              <div className="space-y-1">
                {searchResults.map((res, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={res.id}
                      onClick={() => handleSelect(res)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between group ${
                        isSelected
                          ? 'bg-orange-50 text-orange-950 border border-orange-200 shadow-2xs'
                          : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                          {res.type === 'menu_item' && <Utensils className="h-4 w-4 text-orange-600" />}
                          {res.type === 'order' && <Receipt className="h-4 w-4 text-emerald-600" />}
                          {res.type === 'customer' && <Users className="h-4 w-4 text-blue-600" />}
                          {res.type === 'table' && <LayoutGrid className="h-4 w-4 text-purple-600" />}
                          {res.type === 'room' && <Hotel className="h-4 w-4 text-indigo-600" />}
                          {res.type === 'reservation' && <Calendar className="h-4 w-4 text-cyan-600" />}
                          {res.type === 'inventory' && <Package className="h-4 w-4 text-amber-600" />}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {res.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {res.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {res.badge && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${res.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                            {res.badge}
                          </span>
                        )}
                        <ArrowRight className={`h-4 w-4 ${isSelected ? 'text-orange-600' : 'text-slate-300'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">ESC</kbd> Close
            </span>
          </div>

          <span className="text-[11px] text-slate-400 font-medium">
            Multi-Tenant Scoped: {activeBusinessId}
          </span>
        </div>
      </div>
    </div>
  );
};
