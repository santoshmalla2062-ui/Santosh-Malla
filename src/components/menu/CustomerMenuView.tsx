import React, { useMemo, useState } from 'react';
import {
  Flame,
  LogIn,
  Search,
  Sparkles,
  UtensilsCrossed,
  X
} from 'lucide-react';
import { BusinessSettings, MenuItem } from '../../types';
import { CompactDigitalMenuPayload } from '../../utils/distribution';
import { sanitizeBusinessLogoUrl, sanitizeMenuImageUrl } from '../../utils/imageUtils';
import { Language } from '../../utils/translations';

interface CustomerMenuViewProps {
  settings: BusinessSettings;
  menuItems: MenuItem[];
  decodedPayload?: CompactDigitalMenuPayload | null;
  tableName?: string;
  lang: Language;
  isPreviewMode?: boolean;
  onExitMenu: () => void;
}

const CATEGORY_LABELS: Record<string, { en: string; ne: string }> = {
  all: { en: 'All Items', ne: 'सबै परिकार' },
  coffee: { en: 'Coffee', ne: 'कफी' },
  tea: { en: 'Tea & Chai', ne: 'चिया' },
  cold_drinks: { en: 'Cold Drinks', ne: 'चिसो पेय' },
  mocktails: { en: 'Mocktails', ne: 'मकटेल' },
  snacks: { en: 'Snacks', ne: 'खाजा' },
  fast_food: { en: 'Fast Food', ne: 'फास्ट फुड' },
  nepali_food: { en: 'Nepali Food', ne: 'नेपाली खाना' },
  continental: { en: 'Continental', ne: 'कन्टिनेन्टल' },
  bakery: { en: 'Bakery', ne: 'बेकरी' },
  dessert: { en: 'Dessert', ne: 'मिठाई' },
  desserts: { en: 'Desserts', ne: 'मिठाई' },
  cafe_beverages: { en: 'Beverages', ne: 'पेय पदार्थ' },
  bakery_snacks: { en: 'Bakery & Snacks', ne: 'बेकरी र खाजा' },
  dining_food: { en: 'Dining Food', ne: 'मुख्य खाना' },
  bar_spirits: { en: 'Bar & Spirits', ne: 'बार' }
};

interface DisplayMenuItem {
  id: string;
  name: string;
  nepaliName?: string;
  category: string;
  price: number;
  offerPrice?: number;
  isOffer?: boolean;
  offerLabel?: string;
  description?: string;
  imageUrl?: string;
}

export const CustomerMenuView: React.FC<CustomerMenuViewProps> = ({
  settings,
  menuItems,
  decodedPayload,
  tableName,
  lang,
  isPreviewMode = false,
  onExitMenu
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const liveAvailable = useMemo(
    () => menuItems.filter((item) => item.isAvailable !== false),
    [menuItems]
  );

  const displayItems: DisplayMenuItem[] = useMemo(() => {
    if (liveAvailable.length > 0) {
      return liveAvailable.map((m) => ({
        id: m.id,
        name: m.name,
        nepaliName: m.nepaliName,
        category: m.category,
        price: m.price,
        offerPrice: m.offerPrice,
        isOffer: m.isOffer,
        offerLabel: m.offerLabel,
        description: m.description,
        imageUrl: sanitizeMenuImageUrl(m.imageUrl)
      }));
    }
    if (decodedPayload?.items?.length) {
      return decodedPayload.items.map((it, idx) => ({
        id: `qr-${idx}`,
        name: it.n,
        category: it.c || 'snacks',
        price: it.p,
        offerPrice: it.o,
        isOffer: typeof it.o === 'number' && it.o > 0 && it.o < it.p,
        description: it.d
      }));
    }
    return [];
  }, [liveAvailable, decodedPayload]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    displayItems.forEach((it) => {
      if (it.category) seen.add(it.category);
    });
    return ['all', ...Array.from(seen)];
  }, [displayItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayItems.filter((it) => {
      if (selectedCategory !== 'all' && it.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.nepaliName && it.nepaliName.toLowerCase().includes(q)) ||
        (it.description && it.description.toLowerCase().includes(q))
      );
    });
  }, [displayItems, selectedCategory, searchQuery]);

  const offerItems = useMemo(
    () => displayItems.filter((it) => it.isOffer && typeof it.offerPrice === 'number' && it.offerPrice < it.price),
    [displayItems]
  );

  const businessName =
    (liveAvailable.length > 0 ? settings.businessName : decodedPayload?.bn || settings.businessName) || 'CAFE HOST';
  const currency =
    (liveAvailable.length > 0 ? settings.currencySymbol : decodedPayload?.cur || settings.currencySymbol) || 'Rs.';
  const logoUrl = sanitizeBusinessLogoUrl(settings.logoUrl);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Top Restaurant Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={businessName}
                className="h-10 w-10 rounded-xl object-cover bg-white p-0.5 shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight truncate">{businessName}</h1>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span>{settings.tagline || (lang === 'ne' ? 'डिजिटल मेनु' : 'Digital Menu')}</span>
                {tableName && (
                  <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black rounded-md">
                    {tableName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onExitMenu}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors shrink-0"
          >
            {isPreviewMode ? <X className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
            <span>{isPreviewMode ? (lang === 'ne' ? 'बन्द' : 'Close') : (lang === 'ne' ? 'स्टाफ लगइन' : 'Staff POS')}</span>
          </button>
        </div>

        {/* Search & Category Bar */}
        <div className="max-w-3xl mx-auto px-4 pb-3 space-y-2.5">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ne' ? 'परिकार खोज्नुहोस्...' : 'Search dishes, coffee, snacks...'}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white/10 border border-white/15 text-white placeholder:text-slate-400 rounded-xl focus:outline-hidden focus:bg-white/15"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {categories.map((cat) => {
              const labelObj = CATEGORY_LABELS[cat];
              const label = labelObj
                ? lang === 'ne'
                  ? labelObj.ne
                  : labelObj.en
                : cat.replace(/_/g, ' ');
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        {/* Today's Special Offers */}
        {selectedCategory === 'all' && !searchQuery && offerItems.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700">
              <Flame className="h-4 w-4 text-amber-600" />
              <span>{lang === 'ne' ? 'आजको विशेष अफर' : "Today's Special Offers"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {offerItems.map((item) => (
                <div
                  key={`offer-${item.id}`}
                  className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.name}</h3>
                    </div>
                    {item.offerLabel && (
                      <p className="text-[11px] font-semibold text-amber-800 mt-0.5">{item.offerLabel}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-emerald-700 tabular-nums">
                      {currency} {item.offerPrice?.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-slate-400 line-through tabular-nums">
                      {currency} {item.price.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Menu List */}
        {filteredItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
            <UtensilsCrossed className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">
              {displayItems.length === 0
                ? lang === 'ne'
                  ? 'मेनुमा हाल कुनै परिकार राखिएको छैन।'
                  : 'Menu items have not been added yet.'
                : lang === 'ne'
                ? 'खोजिएको परिकार भेटिएन।'
                : 'No matching dishes found.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredItems.map((item) => {
              const effectivePrice =
                item.isOffer && typeof item.offerPrice === 'number' && item.offerPrice < item.price
                  ? item.offerPrice
                  : item.price;
              const catLabel = CATEGORY_LABELS[item.category];
              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-2xs"
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-16 w-16 rounded-xl object-cover shrink-0 bg-slate-100"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.name}</h3>
                    {item.nepaliName && item.nepaliName !== item.name && (
                      <p className="text-[11px] text-slate-500">{item.nepaliName}</p>
                    )}
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.description}</p>
                    )}
                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {catLabel ? (lang === 'ne' ? catLabel.ne : catLabel.en) : item.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-950 tabular-nums">
                      {currency} {effectivePrice.toLocaleString()}
                    </p>
                    {effectivePrice < item.price && (
                      <p className="text-[11px] text-slate-400 line-through tabular-nums">
                        {currency} {item.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <footer className="text-center pt-4 text-[11px] text-slate-400 space-y-0.5">
          <p>{settings.address || businessName}</p>
          {settings.enableVat && (
            <p>
              {lang === 'ne'
                ? `लागु हुने कर (${settings.vatRatePercent}% VAT) र सेवा शुल्क अतिरिक्त हुन सक्छ।`
                : `Prices may be subject to ${settings.vatRatePercent}% VAT${settings.enableServiceCharge ? ` & ${settings.serviceChargePercent}% service charge` : ''}.`}
            </p>
          )}
        </footer>
      </main>
    </div>
  );
};
