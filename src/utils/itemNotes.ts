// Smart Category-Aware Kitchen / Bar Note Presets and Modifiers
// Translates notes into clean English and adapts presets based on item category (Coffee/Beverage vs Bakery vs Food)

export interface ItemNoteChip {
  label: string;
  val: string;
}

export type ItemStationType = 'beverage' | 'bakery' | 'kitchen';

export interface ItemNoteConfig {
  stationType: ItemStationType;
  placeholder: string;
  chips: ItemNoteChip[];
}

export function getItemNoteConfig(item: {
  name?: string;
  nepaliName?: string;
  category?: string;
  station?: string;
} | null | undefined): ItemNoteConfig {
  if (!item) {
    return {
      stationType: 'kitchen',
      placeholder: 'Kitchen note (e.g. Less Spicy, Less Salt)',
      chips: [
        { label: '🌶️ Less Spicy', val: 'Less Spicy' },
        { label: '🌶️🌶️ Extra Spicy', val: 'Extra Spicy' },
        { label: '🧂 Less Salt', val: 'Less Salt' },
        { label: '🚫 No Onion/Garlic', val: 'No Onion/Garlic' },
        { label: '📦 Pack Separately', val: 'Pack Separately' },
        { label: '🌿 Well Cooked', val: 'Well Cooked' }
      ]
    };
  }

  const cat = (item.category || '').toLowerCase();
  const st = (item.station || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  const nepaliName = (item.nepaliName || '').toLowerCase();

  // 1. Check for Coffee, Tea, Mocktails, Drinks & Bar Beverages
  const isBeverage =
    cat === 'coffee' ||
    cat === 'tea' ||
    cat === 'cold_drinks' ||
    cat === 'mocktails' ||
    cat === 'cafe_beverages' ||
    cat === 'bar_spirits' ||
    st === 'coffee_bar' ||
    name.includes('coffee') ||
    name.includes('caffe') ||
    name.includes('americano') ||
    name.includes('cappuccino') ||
    name.includes('latte') ||
    name.includes('espresso') ||
    name.includes('tea') ||
    name.includes('chai') ||
    name.includes('mocha') ||
    name.includes('macchiato') ||
    name.includes('juice') ||
    name.includes('shake') ||
    name.includes('smoothie') ||
    name.includes('soda') ||
    name.includes('beer') ||
    name.includes('wine') ||
    name.includes('cocktail') ||
    name.includes('mocktail') ||
    name.includes('mojito') ||
    nepaliName.includes('कफी') ||
    nepaliName.includes('चिया') ||
    nepaliName.includes('जुस');

  if (isBeverage) {
    return {
      stationType: 'beverage',
      placeholder: 'Bar note (e.g. No Sugar, Extra Hot, Less Ice)',
      chips: [
        { label: '☕ No Sugar', val: 'No Sugar' },
        { label: '🍬 Less Sugar', val: 'Less Sugar' },
        { label: '🔥 Extra Hot', val: 'Extra Hot' },
        { label: '🧊 Less Ice', val: 'Less Ice' },
        { label: '🥛 Less Milk', val: 'Less Milk' },
        { label: '🖤 Black / Strong', val: 'Black / Strong' },
        { label: '📦 Takeaway Cup', val: 'Takeaway Cup' },
        { label: '📦 Pack Separately', val: 'Pack Separately' }
      ]
    };
  }

  // 2. Check for Bakery & Desserts
  const isBakery =
    cat === 'bakery' ||
    cat === 'dessert' ||
    cat === 'desserts' ||
    cat === 'bakery_snacks' ||
    st === 'bakery' ||
    st === 'dessert' ||
    name.includes('cake') ||
    name.includes('croissant') ||
    name.includes('pastry') ||
    name.includes('muffin') ||
    name.includes('brownie') ||
    name.includes('donut') ||
    name.includes('pie') ||
    name.includes('tart') ||
    name.includes('cookie') ||
    nepaliName.includes('केक') ||
    nepaliName.includes('बेकरी');

  if (isBakery) {
    return {
      stationType: 'bakery',
      placeholder: 'Bakery note (e.g. Warm Up, Pack Separately)',
      chips: [
        { label: '🔥 Warm Up / Heat', val: 'Warm Up' },
        { label: '❄️ Serve Cold', val: 'Serve Cold' },
        { label: '🍬 Less Sweet', val: 'Less Sweet' },
        { label: '🍴 With Cutlery', val: 'With Cutlery' },
        { label: '📦 Pack Separately', val: 'Pack Separately' }
      ]
    };
  }

  // 3. Kitchen Food / Savory Dishes (Default)
  return {
    stationType: 'kitchen',
    placeholder: 'Kitchen note (e.g. Less Spicy, Less Salt)',
    chips: [
      { label: '🌶️ Less Spicy', val: 'Less Spicy' },
      { label: '🌶️🌶️ Extra Spicy', val: 'Extra Spicy' },
      { label: '🧂 Less Salt', val: 'Less Salt' },
      { label: '🚫 No Onion/Garlic', val: 'No Onion/Garlic' },
      { label: '📦 Pack Separately', val: 'Pack Separately' },
      { label: '🌿 Well Cooked', val: 'Well Cooked' }
    ]
  };
}

/**
 * Toggles a preset chip in a comma-separated note string.
 * If the chip exists, it removes it cleanly. If not, it appends it.
 */
export function toggleNoteChip(currentNote: string | undefined, chipVal: string): string {
  const parts = (currentNote || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const existingIdx = parts.findIndex(p => p.toLowerCase() === chipVal.toLowerCase());
  if (existingIdx >= 0) {
    parts.splice(existingIdx, 1);
  } else {
    parts.push(chipVal);
  }

  return parts.join(', ');
}

/**
 * Checks whether a given chip value is currently active in the note string.
 */
export function isChipActive(currentNote: string | undefined, chipVal: string): boolean {
  if (!currentNote) return false;
  const parts = currentNote
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

  return parts.includes(chipVal.toLowerCase());
}
