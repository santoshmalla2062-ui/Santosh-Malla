import React from 'react';
import {
  Banknote,
  ChefHat,
  LayoutGrid,
  Menu,
  Receipt
} from 'lucide-react';
import { ActiveTab } from '../Navigation';
import { Language } from '../../utils/translations';
import { StaffRole } from '../../types';

interface MobileBottomBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  lang: Language;
  occupiedTablesCount: number;
  activeKOTCount: number;
  unpaidBillsCount?: number;
  lowStockCount: number;
  unreadNotificationsCount: number;
  onOpenMobileMenu: () => void;
  onOpenQuickSearch: () => void;
  currentRole?: StaffRole;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeTab,
  onTabChange,
  lang,
  occupiedTablesCount,
  activeKOTCount,
  unpaidBillsCount = 0,
  unreadNotificationsCount,
  onOpenMobileMenu
}) => {
  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl safe-area-bottom"
    >
      <div className="grid grid-cols-5 h-15 items-center px-1">
        {/* 1. Tables */}
        <button
          type="button"
          onClick={() => onTabChange('tables_rooms')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
            activeTab === 'tables_rooms'
              ? 'text-orange-600 font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <LayoutGrid className={`h-5 w-5 ${activeTab === 'tables_rooms' ? 'stroke-[2.5]' : ''}`} />
            {occupiedTablesCount > 0 && (
              <span className="absolute -top-1 -right-2 h-3.5 min-w-[14px] px-1 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center tabular-nums">
                {occupiedTablesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-none whitespace-nowrap">
            {lang === 'ne' ? 'टेबल' : 'Tables'}
          </span>
        </button>

        {/* 2. Orders (POS) */}
        <button
          type="button"
          onClick={() => onTabChange('pos')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            activeTab === 'pos'
              ? 'text-orange-600 font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Receipt className={`h-5 w-5 ${activeTab === 'pos' ? 'stroke-[2.5]' : ''}`} />
          </div>
          <span className="text-[10px] mt-0.5 leading-none whitespace-nowrap">
            {lang === 'ne' ? 'अर्डर' : 'Orders'}
          </span>
        </button>

        {/* 3. Kitchen KDS */}
        <button
          type="button"
          onClick={() => onTabChange('kds')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
            activeTab === 'kds'
              ? 'text-orange-600 font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <ChefHat className={`h-5 w-5 ${activeTab === 'kds' ? 'stroke-[2.5]' : ''}`} />
            {activeKOTCount > 0 && (
              <span className="absolute -top-1 -right-2 h-3.5 min-w-[14px] px-1 bg-orange-600 text-white text-[9px] font-black rounded-full flex items-center justify-center tabular-nums">
                {activeKOTCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-none whitespace-nowrap">
            {lang === 'ne' ? 'भान्सा' : 'Kitchen'}
          </span>
        </button>

        {/* 4. Billing (Unpaid & Open Bills) */}
        <button
          type="button"
          onClick={() => onTabChange('billing')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
            activeTab === 'billing'
              ? 'text-orange-600 font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Banknote className={`h-5 w-5 ${activeTab === 'billing' ? 'stroke-[2.5]' : ''}`} />
            {unpaidBillsCount > 0 && (
              <span className="absolute -top-1 -right-2 h-3.5 min-w-[14px] px-1 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center tabular-nums">
                {unpaidBillsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-none whitespace-nowrap">
            {lang === 'ne' ? 'बिलिङ' : 'Billing'}
          </span>
        </button>

        {/* 5. Mobile Menu Drawer Toggle */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 hover:text-slate-900 transition-all relative"
        >
          <div className="relative">
            <Menu className="h-5 w-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 bg-orange-600 rounded-full ring-2 ring-white" />
            )}
          </div>
          <span className="text-[10px] mt-0.5 leading-none whitespace-nowrap">
            {lang === 'ne' ? 'मेनु' : 'Menu'}
          </span>
        </button>
      </div>
    </nav>
  );
};
