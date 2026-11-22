import React, { useState } from 'react';
import { X, Edit2, DollarSign, Check, Tag, AlertCircle } from 'lucide-react';
import { MenuItem, ItemCategory } from '../../types';
import { Language } from '../../utils/translations';

interface QuickPriceEditModalProps {
  item: MenuItem;
  currencySymbol: string;
  lang: Language;
  onClose: () => void;
  onSave: (updatedItem: MenuItem) => void;
}

export const QuickPriceEditModal: React.FC<QuickPriceEditModalProps> = ({
  item,
  currencySymbol,
  lang,
  onClose,
  onSave
}) => {
  const [name, setName] = useState(item.name);
  const [nepaliName, setNepaliName] = useState(item.nepaliName || '');
  const [price, setPrice] = useState(item.price);
  const [costPrice, setCostPrice] = useState(item.costPrice || 0);
  const [isAvailable, setIsAvailable] = useState(item.isAvailable !== false);
  const [category, setCategory] = useState<ItemCategory>(item.category);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || Number(price) <= 0) return;

    const updated: MenuItem = {
      ...item,
      name: name.trim(),
      nepaliName: nepaliName.trim() || name.trim(),
      price: Number(price),
      costPrice: Number(costPrice) || 0,
      isAvailable,
      category
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-400 text-slate-950 flex items-center justify-center font-black">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                {lang === 'ne' ? 'परिकारको मूल्य तथा विवरण परिवर्तन' : 'Edit Dish Price & Details'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {lang === 'ne' 
                  ? 'एडमिनले तत्काल मेनुको मूल्य अपडेट गर्न सक्ने ठाउँ।' 
                  : 'Instantly update price, name, or availability.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Dish Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'ne' ? 'अंग्रेजी नाम (Dish Name):' : 'Item Name:'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {lang === 'ne' ? 'नेपाली नाम (Nepali Name):' : 'Nepali Name:'}
              </label>
              <input
                type="text"
                value={nepaliName}
                onChange={(e) => setNepaliName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white"
              />
            </div>
          </div>

          {/* Price & Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <label className="block font-black text-emerald-950 mb-1 text-[11px] uppercase tracking-wider">
                {lang === 'ne' ? 'बिक्री मूल्य (Selling Price):' : 'Sale Price:'}
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-emerald-800">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-emerald-300 rounded-lg font-black font-mono-num text-sm text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
                {lang === 'ne' ? 'लागत मूल्य (Cost Price):' : 'Cost Price:'}
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-500">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num text-sm text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Availability Switch */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-extrabold text-slate-900 block text-xs">
                {lang === 'ne' ? 'उपलब्धता स्थिति (Availability):' : 'Available for Order'}
              </span>
              <span className="text-[11px] text-slate-500">
                {isAvailable 
                  ? (lang === 'ne' ? '✓ मेनुमा उपलब्ध छ (In Stock)' : 'Active in POS menu') 
                  : (lang === 'ne' ? '✗ स्टक सकिएको (Sold Out)' : 'Marked as Sold Out')}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
            >
              {lang === 'ne' ? 'रद्द' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-black text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
            >
              {lang === 'ne' ? 'मूल्य सेभ गर्नुहोस् (Save Price)' : 'Update Price'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
