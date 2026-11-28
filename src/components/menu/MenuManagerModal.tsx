import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  X, 
  Edit3, 
  Trash2, 
  UtensilsCrossed, 
  Image as ImageIcon, 
  Sparkles, 
  Upload, 
  Check, 
  Tag, 
  Flame, 
  Clock, 
  Search,
  Filter,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { NumberInput } from '../common/NumberInput';
import { 
  BusinessSettings, 
  InventoryItem, 
  ItemAddOn, 
  ItemCategory, 
  ItemVariant, 
  KitchenStation, 
  MenuItem 
} from '../../types';
import { Language } from '../../utils/translations';
import { getMenuItemImageUrl } from '../../utils/menuImages';

interface MenuManagerModalProps {
  menuItems: MenuItem[];
  inventoryItems: InventoryItem[];
  settings: BusinessSettings;
  lang: Language;
  onAddMenuItem: (item: MenuItem) => void;
  onUpdateMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem?: (itemId: string) => void;
  initialEditingItem?: MenuItem | null;
  onClose: () => void;
}

// Curated high-resolution food & beverage photos for 1-click selection
const PHOTO_PRESETS: { name: string; category: string; url: string }[] = [
  { name: 'Espresso', category: 'Coffee', url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=400&q=80' },
  { name: 'Americano', category: 'Coffee', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80' },
  { name: 'Cappuccino', category: 'Coffee', url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=400&q=80' },
  { name: 'Hot Latte', category: 'Coffee', url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=400&q=80' },
  { name: 'Mocha / Choco', category: 'Coffee', url: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=400&q=80' },
  { name: 'Masala Chai', category: 'Tea', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80' },
  { name: 'Steamed Momo', category: 'Snacks', url: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=400&q=80' },
  { name: 'Chowmein', category: 'Snacks', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80' },
  { name: 'Pizza', category: 'Fast Food', url: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=400&q=80' },
  { name: 'Burger & Fries', category: 'Fast Food', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80' },
  { name: 'French Fries', category: 'Snacks', url: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=400&q=80' },
  { name: 'Chicken Wings', category: 'Snacks', url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=400&q=80' },
  { name: 'Thakali Thali', category: 'Nepali Food', url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=400&q=80' },
  { name: 'Chicken Chhoila', category: 'Nepali Food', url: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=400&q=80' },
  { name: 'Biryani', category: 'Dining', url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80' },
  { name: 'Kathi Roll', category: 'Snacks', url: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=400&q=80' },
  { name: 'Croissant', category: 'Bakery', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80' },
  { name: 'Pastry / Cake', category: 'Dessert', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80' },
  { name: 'Ice Cream', category: 'Dessert', url: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?auto=format&fit=crop&w=400&q=80' },
  { name: 'Mojito / Mint', category: 'Drinks', url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80' },
  { name: 'Beer / Spirits', category: 'Bar', url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80' }
];

export const MenuManagerModal: React.FC<MenuManagerModalProps> = ({
  menuItems,
  inventoryItems,
  settings,
  lang,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  initialEditingItem,
  onClose
}) => {
  const [editingItem, setEditingItem] = useState<MenuItem | null>(initialEditingItem || null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('all');
  const [showOnlyOffers, setShowOnlyOffers] = useState(false);
  const [showPresetsGallery, setShowPresetsGallery] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [name, setName] = useState('');
  const [nepaliName, setNepaliName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<ItemCategory>('nepali_food');
  const [price, setPrice] = useState<number>(300);
  const [costPrice, setCostPrice] = useState<number>(100);
  const [station, setStation] = useState<KitchenStation>('main_kitchen');
  const [prepTime, setPrepTime] = useState<number>(15);
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  
  // Offer & Promotional Discount States
  const [isOffer, setIsOffer] = useState<boolean>(false);
  const [offerPrice, setOfferPrice] = useState<number>(250);
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [offerLabel, setOfferLabel] = useState<string>('');

  // Variants
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState<number>(0);

  // Add-ons
  const [addOns, setAddOns] = useState<ItemAddOn[]>([]);
  const [newAddOnName, setNewAddOnName] = useState('');
  const [newAddOnPrice, setNewAddOnPrice] = useState<number>(0);

  // Load initial editing item if provided
  useEffect(() => {
    if (initialEditingItem) {
      handleStartEdit(initialEditingItem);
    }
  }, [initialEditingItem]);

  const handleStartEdit = (item: MenuItem) => {
    setEditingItem(item);
    setIsAddingNew(false);
    setShowPresetsGallery(false);
    setImageError(null);
    setName(item.name);
    setNepaliName(item.nepaliName || '');
    setCode(item.code);
    setCategory(item.category);
    setPrice(item.price);
    setCostPrice(item.costPrice || Math.round(item.price * 0.4));
    setStation(item.station || 'main_kitchen');
    setPrepTime(item.preparationTimeMinutes || 15);
    setImageUrl(item.imageUrl || '');
    setDescription(item.description || '');
    setVariants(item.variants ? [...item.variants] : []);
    setAddOns(item.addOns ? [...item.addOns] : []);

    // Offer handling
    setIsOffer(!!item.isOffer);
    if (item.isOffer && item.offerPrice) {
      setOfferPrice(item.offerPrice);
      const computedPercent = item.discountPercent || Math.round(((item.price - item.offerPrice) / item.price) * 100);
      setDiscountPercent(computedPercent);
      setOfferLabel(item.offerLabel || `${computedPercent}% OFF`);
    } else {
      const defaultOffer = Math.round(item.price * 0.85);
      setOfferPrice(defaultOffer);
      setDiscountPercent(15);
      setOfferLabel('15% OFF');
    }
  };

  const handleStartAdd = () => {
    setEditingItem(null);
    setIsAddingNew(true);
    setShowPresetsGallery(false);
    setImageError(null);
    setName('');
    setNepaliName('');
    setCode('ITM-' + Math.floor(100 + Math.random() * 900));
    setCategory('nepali_food');
    setPrice(350);
    setCostPrice(120);
    setStation('main_kitchen');
    setPrepTime(15);
    setImageUrl('');
    setDescription('');
    setIsOffer(false);
    setOfferPrice(300);
    setDiscountPercent(15);
    setOfferLabel('15% OFF');
    setVariants([]);
    setAddOns([]);
  };

  // Sync offerPrice and discountPercent
  const handleRegularPriceChange = (newVal: number) => {
    setPrice(newVal);
    if (isOffer && newVal > 0) {
      const calculatedOffer = Math.round(newVal * (1 - discountPercent / 100));
      setOfferPrice(calculatedOffer);
    }
  };

  const handleOfferPriceChange = (newVal: number) => {
    setOfferPrice(newVal);
    if (price > 0 && newVal > 0 && newVal < price) {
      const calculatedDiscount = Math.round(((price - newVal) / price) * 100);
      setDiscountPercent(calculatedDiscount);
      if (!offerLabel || offerLabel.includes('% OFF')) {
        setOfferLabel(`${calculatedDiscount}% OFF`);
      }
    }
  };

  const handleDiscountPercentChange = (percent: number) => {
    setDiscountPercent(percent);
    if (price > 0 && percent >= 0 && percent <= 99) {
      const calculatedOffer = Math.round(price * (1 - percent / 100));
      setOfferPrice(calculatedOffer);
      if (!offerLabel || offerLabel.includes('% OFF')) {
        setOfferLabel(`${percent}% OFF`);
      }
    }
  };

  // Image file upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      setImageError(lang === 'ne' ? 'कृपया २.५ MB भन्दा सानो फोटो छान्नुहोस्।' : 'Please choose an image under 2.5MB.');
      e.target.value = '';
      return;
    }
    setImageError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddVariant = () => {
    if (!newVariantName.trim() || newVariantPrice <= 0) return;
    setVariants(prev => [...prev, { name: newVariantName.trim(), price: newVariantPrice }]);
    setNewVariantName('');
    setNewVariantPrice(0);
  };

  const handleRemoveVariant = (idx: number) => {
    setVariants(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddAddOn = () => {
    if (!newAddOnName.trim() || newAddOnPrice <= 0) return;
    setAddOns(prev => [...prev, { name: newAddOnName.trim(), price: newAddOnPrice }]);
    setNewAddOnName('');
    setNewAddOnPrice(0);
  };

  const handleRemoveAddOn = (idx: number) => {
    setAddOns(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || price <= 0) return;

    const finalItem: MenuItem = {
      id: isAddingNew ? ('m-' + Date.now()) : (editingItem ? editingItem.id : 'm-' + Date.now()),
      code: code.trim(),
      name: name.trim(),
      nepaliName: nepaliName.trim() || name.trim(),
      category,
      price,
      costPrice,
      station,
      preparationTimeMinutes: prepTime,
      imageUrl: imageUrl.trim() || undefined,
      isAvailable: editingItem ? editingItem.isAvailable : true,
      variants: variants.length > 0 ? variants : undefined,
      addOns: addOns.length > 0 ? addOns : undefined,
      description: description.trim() || undefined,
      // Offer details
      isOffer: isOffer ? true : undefined,
      offerPrice: (isOffer && offerPrice > 0 && offerPrice < price) ? offerPrice : undefined,
      discountPercent: (isOffer && discountPercent > 0) ? discountPercent : undefined,
      offerLabel: (isOffer && offerLabel.trim()) ? offerLabel.trim() : undefined
    };

    if (isAddingNew) {
      onAddMenuItem(finalItem);
    } else {
      onUpdateMenuItem(finalItem);
    }

    setIsAddingNew(false);
    setEditingItem(null);
  };

  const handleDelete = (item: MenuItem) => {
    const confirmMsg = lang === 'ne' 
      ? `के तपाईं साँच्चै "${item.name}" मेनुबाट हटाउन चाहनुहुन्छ?` 
      : `Are you sure you want to permanently delete "${item.name}" from the menu?`;
    if (window.confirm(confirmMsg)) {
      if (onDeleteMenuItem) {
        onDeleteMenuItem(item.id);
      }
      if (editingItem?.id === item.id) {
        setEditingItem(null);
        setIsAddingNew(false);
      }
    }
  };

  const handleToggleAvailable = (item: MenuItem) => {
    onUpdateMenuItem({
      ...item,
      isAvailable: !item.isAvailable
    });
  };

  const categoriesList: { id: ItemCategory; label: string }[] = [
    { id: 'coffee', label: 'Coffee (कफी)' },
    { id: 'tea', label: 'Tea (चिया)' },
    { id: 'cold_drinks', label: 'Cold Drinks (चिसो पेय)' },
    { id: 'mocktails', label: 'Mocktails (मकटेल)' },
    { id: 'snacks', label: 'Snacks (खाजा)' },
    { id: 'fast_food', label: 'Fast Food (फास्टफुड)' },
    { id: 'nepali_food', label: 'Nepali Food (नेपाली खाना)' },
    { id: 'continental', label: 'Continental (कन्टिनेन्टल)' },
    { id: 'bakery', label: 'Bakery (बेकरी)' },
    { id: 'dessert', label: 'Dessert (मिठाई / डिजर्ट)' },
    { id: 'cafe_beverages', label: 'Cafe Beverages (General)' },
    { id: 'bakery_snacks', label: 'Bakery & Pastries' },
    { id: 'dining_food', label: 'Dining Food' },
    { id: 'bar_spirits', label: 'Bar & Spirits' },
    { id: 'resort_rooms', label: 'Resort Stay / Room' }
  ];

  // Filtered menu items for the table
  const filteredMenuItems = menuItems.filter(item => {
    if (showOnlyOffers && !item.isOffer) return false;
    if (selectedFilterCategory !== 'all' && item.category !== selectedFilterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchNep = (item.nepaliName || '').toLowerCase().includes(q);
      const matchCode = item.code.toLowerCase().includes(q);
      if (!matchName && !matchNep && !matchCode) return false;
    }
    return true;
  });

  const offerCount = menuItems.filter(i => i.isOffer).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500 text-slate-950 rounded-xl font-bold">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                {lang === 'ne' ? 'मेनु तथा परिकार व्यवस्थापन (Menu & Dishes)' : 'Menu Dishes & Pricing Manager'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'ne' ? 'फोटो अपलोड, मूल्य निर्धारण, अफर छुट र परिकार सम्पादन' : 'Add & edit dishes, photos, regular/offer pricing & discounts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAddingNew && !editingItem && (
              <button
                type="button"
                onClick={handleStartAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>{lang === 'ne' ? 'नयाँ परिकार थप्नुहोस् (+ Add Item)' : '+ Add New Dish'}</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* Add / Edit Form Modal Form Section */}
          {(isAddingNew || editingItem) ? (
            <form onSubmit={handleSave} className="bg-slate-50 p-4 sm:p-5 rounded-2xl border-2 border-slate-300 space-y-4 shadow-sm animate-in fade-in duration-150">
              
              <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-black text-slate-900 text-sm sm:text-base">
                    {isAddingNew 
                      ? (lang === 'ne' ? 'नयाँ परिकार विवरण थप्नुहोस् (New Menu Item)' : 'Add New Menu Item') 
                      : (lang === 'ne' ? `परिकार सम्पादन: ${name || editingItem?.name}` : `Edit Menu Dish: ${name || editingItem?.name}`)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {editingItem && onDeleteMenuItem && (
                    <button
                      type="button"
                      onClick={() => handleDelete(editingItem)}
                      className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{lang === 'ne' ? 'हटाउनुहोस्' : 'Delete'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setIsAddingNew(false); setEditingItem(null); }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {lang === 'ne' ? 'रद्द' : 'Cancel'}
                  </button>
                </div>
              </div>

              {/* Section 1: Basic Identifiers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Item Code (कोड) *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. CAF-05"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category (श्रेणी) *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {categoriesList.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kitchen Station (स्टेशन) *</label>
                  <select
                    value={station}
                    onChange={(e) => setStation(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="main_kitchen">Main Kitchen (भान्छा)</option>
                    <option value="coffee_bar">Coffee & Bar (कफी तथा बार)</option>
                    <option value="bakery">Bakery (बेकरी)</option>
                    <option value="dessert">Dessert (मिठाई तथा डिजर्ट)</option>
                  </select>
                </div>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dish Name in English *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Caffe Americano / Chicken Momo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">नेपाली नाम (Nepali Name)</label>
                  <input
                    type="text"
                    placeholder="उदा. अमेरिकानो कफी / चिकेन मम"
                    value={nepaliName}
                    onChange={(e) => setNepaliName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Section 2: Pricing, Cost & Offer Discounts (प्रमुख आकर्षण) */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span>{lang === 'ne' ? 'मूल्य निर्धारण तथा अफर छुट (Pricing & Offers)' : 'Pricing & Promotional Discounts'}</span>
                  </span>

                  {/* Toggle Offer */}
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1 rounded-full transition-colors">
                    <input
                      type="checkbox"
                      checked={isOffer}
                      onChange={(e) => setIsOffer(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500 h-4 w-4"
                    />
                    <span className="font-bold text-xs text-amber-950 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      <span>{lang === 'ne' ? 'अफर छुट सक्रिय (Offer Active)' : 'Offer / Discount Promo'}</span>
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'नियमित बिक्री मूल्य (Regular Price) *' : 'Regular Selling Price *'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        {settings.currencySymbol}
                      </span>
                      <NumberInput
                        min={1}
                        required
                        value={price}
                        onValueChange={(val) => handleRegularPriceChange(val)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-black text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'लागत मूल्य (Cost Price)' : 'Cost / Ingredient Price'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        {settings.currencySymbol}
                      </span>
                      <NumberInput
                        min={0}
                        value={costPrice}
                        onValueChange={(val) => setCostPrice(val)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'तयारी समय (Prep Time Mins)' : 'Prep Time (minutes)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <Clock className="h-4 w-4" />
                      </span>
                      <NumberInput
                        min={1}
                        integer
                        value={prepTime}
                        onValueChange={(val) => setPrepTime(val)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Offer Fields when toggled */}
                {isOffer && (
                  <div className="p-3 bg-gradient-to-r from-rose-50 to-amber-50 rounded-xl border border-rose-200 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                      <Tag className="h-4 w-4 text-rose-600" />
                      <span>{lang === 'ne' ? 'अफर छुट विवरण (Offer Price & Discount Settings)' : 'Promotional Offer Pricing'}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-rose-950 mb-1">
                          {lang === 'ne' ? 'अफर मूल्य (Offer Price रू.) *' : 'Discounted Offer Price *'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-rose-500">
                            {settings.currencySymbol}
                          </span>
                          <NumberInput
                            min={1}
                            max={Math.max(1, price - 1)}
                            value={offerPrice}
                            onValueChange={(val) => handleOfferPriceChange(val)}
                            className="w-full pl-9 pr-3 py-2 bg-white border-2 border-rose-300 rounded-lg font-mono-num font-black text-rose-700 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-rose-950 mb-1">
                          {lang === 'ne' ? 'छुट प्रतिशत (Discount %)' : 'Discount Percentage (%)'}
                        </label>
                        <div className="relative">
                          <NumberInput
                            min={1}
                            max={99}
                            value={discountPercent}
                            onValueChange={(val) => handleDiscountPercentChange(val)}
                            className="w-full px-3 py-2 bg-white border-2 border-rose-300 rounded-lg font-mono-num font-black text-rose-700 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-rose-500">%</span>
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-rose-950 mb-1">
                          {lang === 'ne' ? 'अफर ब्याड्ज (Offer Tag/Label)' : 'Offer Badge / Label'}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 15% OFF, Special Deal"
                          value={offerLabel}
                          onChange={(e) => setOfferLabel(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-rose-300 rounded-lg font-bold text-rose-900 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Live Offer Preview Badge */}
                    <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-rose-200">
                      <span className="text-[11px] font-semibold text-slate-600">
                        {lang === 'ne' ? 'ग्राहक तथा POS मा देखिने रुप:' : 'POS Live Price Appearance:'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-slate-400 font-mono-num font-bold">
                          {settings.currencySymbol} {price}
                        </span>
                        <span className="text-emerald-700 font-mono-num font-black text-sm">
                          {settings.currencySymbol} {offerPrice}
                        </span>
                        <span className="bg-rose-600 text-white font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full shadow-2xs">
                          {offerLabel || `${discountPercent}% OFF`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Photo Management (फोटो व्यवस्थापन) */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-indigo-600" />
                    <span>{lang === 'ne' ? 'परिकारको फोटो (Dish Photo Upload & Presets)' : 'Dish Photography & Visuals'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowPresetsGallery(prev => !prev)}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors"
                  >
                    {showPresetsGallery 
                      ? (lang === 'ne' ? 'ग्यालरी बन्द' : 'Hide Gallery') 
                      : (lang === 'ne' ? '📸 तयार फोटो ग्यालरी छान्नुहोस्' : '📸 Choose from Curated Gallery')}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-start gap-3.5">
                  {/* Photo Preview Container */}
                  <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl border-2 border-dashed border-slate-300 overflow-hidden relative group shrink-0 bg-slate-50 flex items-center justify-center">
                    {imageUrl ? (
                      <>
                        <img 
                          src={imageUrl} 
                          alt="Dish preview" 
                          className="h-full w-full object-cover" 
                        />
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="absolute inset-0 bg-slate-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                          title="Remove Photo"
                        >
                          <Trash2 className="h-4 w-4 mb-0.5 text-rose-300" />
                          <span>हटाउनुहोस्</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <ImageIcon className="h-7 w-7 mx-auto mb-1 opacity-60" />
                        <span className="text-[10px] block leading-tight">No Photo Selected</span>
                      </div>
                    )}
                  </div>

                  {/* Upload & Link Controls */}
                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors shadow-2xs"
                      >
                        <Upload className="h-3.5 w-3.5 text-slate-600" />
                        <span>{lang === 'ne' ? 'कम्प्युटर / मोबाइलबाट फोटो अपलोड' : 'Upload from Device'}</span>
                      </button>

                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrl('');
                            setImageError(null);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                        >
                          {lang === 'ne' ? 'फोटो हटाउनुहोस्' : 'Clear Photo'}
                        </button>
                      )}
                    </div>

                    {imageError && (
                      <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{imageError}</span>
                      </p>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {lang === 'ne' ? 'वा फोटोको सीधा लिंक (Image URL):' : 'Or paste direct Image URL:'}
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/photo.jpg"
                        value={imageUrl}
                        onChange={(e) => {
                          setImageUrl(e.target.value);
                          if (imageError) setImageError(null);
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Preset Photography Gallery */}
                {showPresetsGallery && (
                  <div className="pt-2 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      {lang === 'ne' ? 'तत्काल १-क्लिकमा सुन्दर फोटो छान्नुहोस्:' : 'Click any photo below to instantly assign it:'}
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50">
                      {PHOTO_PRESETS.map((preset, idx) => {
                        const isSelected = imageUrl === preset.url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setImageUrl(preset.url);
                              setImageError(null);
                              setShowPresetsGallery(false);
                            }}
                            className={`group relative rounded-lg overflow-hidden border-2 transition-all aspect-square flex flex-col justify-end text-left ${
                              isSelected ? 'border-emerald-600 ring-2 ring-emerald-500/50' : 'border-transparent hover:border-slate-400'
                            }`}
                          >
                            <img 
                              src={preset.url} 
                              alt={preset.name} 
                              className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="relative z-10 bg-slate-950/80 p-1 text-[9px] text-white font-bold leading-tight truncate">
                              {preset.name}
                            </div>
                            {isSelected && (
                              <span className="absolute top-1 right-1 z-10 bg-emerald-600 text-white rounded-full p-0.5 shadow-2xs">
                                <Check className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Variants & Add-ons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Variants Builder */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">
                    {lang === 'ne' ? 'साइज तथा प्रकार (Variants e.g. Small / Large / Double):' : 'Product Variants (Sizes / Portions):'}
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Regular / Large"
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <NumberInput
                      min={0}
                      blankWhenZero
                      placeholder="Price (Rs)"
                      value={newVariantPrice}
                      onValueChange={(val) => setNewVariantPrice(val)}
                      className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={handleAddVariant}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                  {variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {variants.map((v, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 font-semibold text-[11px]">
                          <span>{v.name} ({settings.currencySymbol}{v.price})</span>
                          <button type="button" onClick={() => handleRemoveVariant(i)} className="text-rose-600 hover:text-rose-800">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add-ons Builder */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block text-xs">
                    {lang === 'ne' ? 'थप सामग्री (Add-ons e.g. Extra Cheese, Extra Shot):' : 'Product Add-ons (Extras):'}
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Extra Cheese"
                      value={newAddOnName}
                      onChange={(e) => setNewAddOnName(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                    <NumberInput
                      min={0}
                      blankWhenZero
                      placeholder="Price (Rs)"
                      value={newAddOnPrice}
                      onValueChange={(val) => setNewAddOnPrice(val)}
                      className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={handleAddAddOn}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                  {addOns.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {addOns.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200 font-semibold text-[11px]">
                          <span>{a.name} (+{settings.currencySymbol}{a.price})</span>
                          <button type="button" onClick={() => handleRemoveAddOn(i)} className="text-rose-600 hover:text-rose-800">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Ingredients / Taste Note</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, spice level, notes for staff and customer"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setIsAddingNew(false); setEditingItem(null); }}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 font-semibold transition-colors"
                >
                  {lang === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-md flex items-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{lang === 'ne' ? 'परिकार सुरक्षित गर्नुहोस् (Save Item)' : 'Save Dish'}</span>
                </button>
              </div>
            </form>
          ) : null}

          {/* Search & Category Filter Bar */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={lang === 'ne' ? 'परिकार, कोड वा नाम खोज्नुहोस्...' : 'Search dish name or code...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <select
                value={selectedFilterCategory}
                onChange={(e) => setSelectedFilterCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              >
                <option value="all">All Categories ({menuItems.length})</option>
                {categoriesList.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowOnlyOffers(prev => !prev)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  showOnlyOffers 
                    ? 'bg-rose-600 text-white border-rose-700 shadow-2xs' 
                    : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                <span>{lang === 'ne' ? `अफर परिकारहरू (${offerCount})` : `Offers Only (${offerCount})`}</span>
              </button>
            </div>

            <span className="text-xs text-slate-500 font-semibold">
              {filteredMenuItems.length} / {menuItems.length} dishes
            </span>
          </div>

          {/* Dishes Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Photo</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Dish / Item</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Station</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-center">Offer Promo</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMenuItems.map((item) => {
                  const img = getMenuItemImageUrl(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3">
                        <img 
                          src={img} 
                          alt={item.name} 
                          className="h-10 w-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
                          loading="lazy"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono-num font-bold text-slate-700">
                        {item.code}
                      </td>
                      <td className="py-2 px-3 max-w-[200px]">
                        <p className="font-bold text-slate-900 truncate">{item.name}</p>
                        {item.nepaliName && (
                          <p className="text-[11px] text-slate-500 truncate">{item.nepaliName}</p>
                        )}
                        {item.variants && item.variants.length > 0 && (
                          <span className="text-[10px] text-indigo-700 font-semibold block">
                            {item.variants.length} sizes/variants
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 capitalize text-slate-600">
                        {item.category.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 px-3 capitalize text-slate-600">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-700">
                          {item.station ? item.station.replace(/_/g, ' ') : 'main kitchen'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono-num">
                        {item.isOffer && item.offerPrice ? (
                          <div>
                            <span className="line-through text-slate-400 text-[11px] block">
                              {settings.currencySymbol} {item.price}
                            </span>
                            <span className="font-black text-emerald-800 text-sm">
                              {settings.currencySymbol} {item.offerPrice}
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-slate-900 text-sm">
                            {settings.currencySymbol} {item.price}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.isOffer && item.offerPrice ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px]">
                            <Sparkles className="h-2.5 w-2.5 text-rose-600" />
                            <span>{item.offerLabel || `${item.discountPercent || Math.round((1 - item.offerPrice/item.price)*100)}% OFF`}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailable(item)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                            item.isAvailable 
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                        >
                          {item.isAvailable ? 'Available' : 'Sold Out'}
                        </button>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Edit dish details, photo or offer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          {onDeleteMenuItem && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete dish"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredMenuItems.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-700">कुनै परिकार भेटिएन (No matching dishes)</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-3">
            <span>{menuItems.length} Total Items in Menu</span>
            {offerCount > 0 && (
              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                🏷️ {offerCount} Active Offers
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
          >
            {lang === 'ne' ? 'सम्पन्न (Done)' : 'Done'}
          </button>
        </div>

      </div>
    </div>
  );
};
