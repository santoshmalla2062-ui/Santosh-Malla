import { 
  AppState, 
  AuditLogEntry,
  BusinessSettings, 
  Customer, 
  DayClosingRecord,
  Expense,
  InventoryItem, 
  InventoryLog, 
  KhataTransaction, 
  MenuItem, 
  Order, 
  StaffUser,
  TableRoom,
  RoomType,
  ResortRoom,
  GuestProfile,
  Reservation,
  GuestFolioItem,
  ResortService,
  HousekeepingTask,
  MaintenanceIssue,
  HotelPaymentRecord
} from '../types';

export const STORAGE_KEY = 'himalayan_breeze_pos_resort_v2';

export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: 'CAFE HOST',
  tagline: 'Hospitality & POS Management',
  nepaliBusinessName: 'CAFE HOST',
  address: '',
  phone: '',
  email: '',
  panVatNumber: '',
  currencySymbol: 'Rs.',
  enableVat: true,
  vatRatePercent: 13,
  enableServiceCharge: true,
  serviceChargePercent: 10,
  receiptFooterMessage: 'Thank you for visiting us!',
  enableSoundEffects: true,
  defaultLanguage: 'en',
  fonepayMerchantName: '',
  sessionTimeoutMinutes: 60,
  hotelCheckInTime: '14:00',
  hotelCheckOutTime: '12:00',
  notificationSettings: {
    enableSoundAlerts: true,
    enableOrderChime: true,
    enableLowStockAlert: true,
    lowStockThresholdEmail: '',
    enableDailyCloseAlert: true,
    dailyCloseReportEmail: ''
  },
  securitySettings: {
    sessionTimeoutMinutes: 60,
    requirePinForDiscounts: true,
    requirePinForVoidOrder: true,
    requirePinForDayClose: true,
    strictTenantDataIsolation: true,
    allowSuperAdminAuditInspect: true
  }
};

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  // Coffee
  {
    id: 'm1',
    code: 'COF-01',
    name: 'Himalayan Arabica Espresso',
    nepaliName: 'एस्प्रेसो कफी',
    category: 'coffee',
    price: 180,
    costPrice: 45,
    isAvailable: true,
    preparationTimeMinutes: 5,
    station: 'coffee_bar',
    description: 'Fresh organic high-altitude Arabica single shot',
    variants: [
      { name: 'Single Shot', price: 180 },
      { name: 'Double Shot (Doppio)', price: 230 }
    ],
    addOns: [
      { name: 'Extra Shot', price: 50 },
      { name: 'Vanilla Syrup', price: 40 }
    ],
    inventoryRecipe: [{ inventoryItemId: 'inv-1', amount: 0.018, unit: 'kg' }]
  },
  {
    id: 'm-amer',
    code: 'COF-02',
    name: 'Caffe Americano',
    nepaliName: 'अमेरिकानो कफी',
    category: 'coffee',
    price: 210,
    costPrice: 50,
    isAvailable: true,
    preparationTimeMinutes: 5,
    station: 'coffee_bar',
    description: 'Espresso shots topped with hot mountain water',
    variants: [
      { name: 'Regular (Hot)', price: 210 },
      { name: 'Iced Americano', price: 240 }
    ],
    addOns: [
      { name: 'Hazelnut Shot', price: 40 }
    ],
    inventoryRecipe: [{ inventoryItemId: 'inv-1', amount: 0.02, unit: 'kg' }]
  },
  {
    id: 'm2',
    code: 'COF-03',
    name: 'Caramel Cappuccino',
    nepaliName: 'क्यापुचिनो क्यारामेल',
    category: 'coffee',
    price: 260,
    costPrice: 70,
    isAvailable: true,
    preparationTimeMinutes: 7,
    station: 'coffee_bar',
    description: 'Steamed milk with rich espresso foam and drizzle',
    variants: [
      { name: 'Regular', price: 260 },
      { name: 'Large Mug', price: 310 }
    ],
    addOns: [
      { name: 'Extra Caramel Drizzle', price: 30 },
      { name: 'Oat Milk Sub', price: 60 }
    ],
    inventoryRecipe: [
      { inventoryItemId: 'inv-1', amount: 0.02, unit: 'kg' },
      { inventoryItemId: 'inv-2', amount: 0.2, unit: 'ltr' }
    ]
  },
  {
    id: 'm-latte',
    code: 'COF-04',
    name: 'Vanilla Caffe Latte',
    nepaliName: 'भेनिला क्याफे लात्ते',
    category: 'coffee',
    price: 280,
    costPrice: 75,
    isAvailable: true,
    preparationTimeMinutes: 6,
    station: 'coffee_bar',
    description: 'Smooth espresso with velvety steamed milk and Madagascar vanilla',
    variants: [
      { name: 'Hot Latte', price: 280 },
      { name: 'Iced Latte', price: 310 }
    ],
    addOns: [
      { name: 'Whipped Cream', price: 50 },
      { name: 'Almond Milk Sub', price: 60 }
    ],
    inventoryRecipe: [
      { inventoryItemId: 'inv-1', amount: 0.02, unit: 'kg' },
      { inventoryItemId: 'inv-2', amount: 0.22, unit: 'ltr' }
    ]
  },
  {
    id: 'm-mocha',
    code: 'COF-05',
    name: 'Dark Chocolate Caffe Mocha',
    nepaliName: 'क्याफे मोका',
    category: 'coffee',
    price: 320,
    costPrice: 90,
    isAvailable: true,
    preparationTimeMinutes: 7,
    station: 'coffee_bar',
    description: 'Rich Belgian dark chocolate ganache, espresso, and textured milk',
    variants: [
      { name: 'Regular', price: 320 },
      { name: 'Iced Mocha', price: 350 }
    ],
    addOns: [
      { name: 'Marshmallows', price: 40 },
      { name: 'Extra Ganache', price: 50 }
    ]
  },

  // Tea
  {
    id: 'm3',
    code: 'TEA-01',
    name: 'Spiced Himalayan Masala Chai',
    nepaliName: 'मसाला चिया (इलाइची, अदुवा)',
    category: 'tea',
    price: 140,
    costPrice: 35,
    isAvailable: true,
    preparationTimeMinutes: 6,
    station: 'coffee_bar',
    description: 'Traditional slow-brewed tea with organic spices & fresh milk',
    variants: [
      { name: 'Kullad Clay Cup', price: 140 },
      { name: 'Full Pot (2-3 Cups)', price: 300 }
    ],
    inventoryRecipe: [{ inventoryItemId: 'inv-2', amount: 0.15, unit: 'ltr' }]
  },
  {
    id: 'm-greentea',
    code: 'TEA-02',
    name: 'Ilam Organic Green Tea',
    nepaliName: 'इलाम ग्रीन टी',
    category: 'tea',
    price: 150,
    costPrice: 30,
    isAvailable: true,
    preparationTimeMinutes: 4,
    station: 'coffee_bar',
    description: 'Single-estate whole-leaf tea rich in natural antioxidants'
  },
  {
    id: 'm-lemontea',
    code: 'TEA-03',
    name: 'Hot Lemon Honey Ginger Tea',
    nepaliName: 'तातो कागती, मह र अदुवा चिया',
    category: 'tea',
    price: 180,
    costPrice: 40,
    isAvailable: true,
    preparationTimeMinutes: 5,
    station: 'coffee_bar',
    description: 'Fresh crushed ginger, wild mountain honey, and freshly squeezed lemon'
  },

  // Cold Drinks & Mocktails
  {
    id: 'm4',
    code: 'DRK-01',
    name: 'Iced Mint Lemonade',
    nepaliName: 'आइस मिन्ट लेमोनेड',
    category: 'cold_drinks',
    price: 220,
    costPrice: 40,
    isAvailable: true,
    preparationTimeMinutes: 5,
    station: 'coffee_bar',
    description: 'Fresh crushed garden mint, mountain lemon, and chilled soda'
  },
  {
    id: 'm-mojito',
    code: 'MCK-01',
    name: 'Virgin Passionfruit Mojito',
    nepaliName: 'प्यासनफ्रुट भर्जिन मोजितो',
    category: 'mocktails',
    price: 290,
    costPrice: 65,
    isAvailable: true,
    preparationTimeMinutes: 6,
    station: 'coffee_bar',
    description: 'Muddled fresh lime, mint leaves, passionfruit syrup, and sparkling soda',
    variants: [
      { name: 'Standard Glass', price: 290 },
      { name: 'Pitcher (1 Litre)', price: 750 }
    ]
  },
  {
    id: 'm-sunrise',
    code: 'MCK-02',
    name: 'Himalayan Sunrise Mocktail',
    nepaliName: 'हिमालयन सनराइज',
    category: 'mocktails',
    price: 280,
    costPrice: 60,
    isAvailable: true,
    preparationTimeMinutes: 5,
    station: 'coffee_bar',
    description: 'Layered fresh orange juice, peach puree, and pomegranate grenadine'
  },

  // Snacks & Fast Food
  {
    id: 'm6',
    code: 'SNK-01',
    name: 'Chicken Kathi Roll (Kathmandu Style)',
    nepaliName: 'चिकेन काठी रोल',
    category: 'snacks',
    price: 320,
    costPrice: 110,
    isAvailable: true,
    preparationTimeMinutes: 12,
    station: 'main_kitchen',
    description: 'Flaky paratha wrap stuffed with spiced tandoori chicken, mint chutney & onions',
    addOns: [
      { name: 'Extra Cheese', price: 50 },
      { name: 'Fried Egg Add-on', price: 40 }
    ],
    inventoryRecipe: [{ inventoryItemId: 'inv-4', amount: 0.12, unit: 'kg' }]
  },
  {
    id: 'm-fries',
    code: 'SNK-02',
    name: 'Crispy Peri-Peri Fries',
    nepaliName: 'पेरी-पेरी फ्रेन्च फ्राइज',
    category: 'snacks',
    price: 240,
    costPrice: 60,
    isAvailable: true,
    preparationTimeMinutes: 8,
    station: 'main_kitchen',
    description: 'Golden potato fries dusted with zesty African bird-eye chilli blend',
    addOns: [
      { name: 'Cheese Dip', price: 45 },
      { name: 'Garlic Mayo', price: 35 }
    ]
  },
  {
    id: 'm-burger',
    code: 'FST-01',
    name: 'Gourmet Crispy Chicken Burger',
    nepaliName: 'गौर्मे चिकेन बर्गर',
    category: 'fast_food',
    price: 450,
    costPrice: 160,
    isAvailable: true,
    preparationTimeMinutes: 15,
    station: 'main_kitchen',
    description: 'Buttermilk fried chicken breast, melted cheddar, pickles & house remoulade',
    variants: [
      { name: 'Single Patty', price: 450 },
      { name: 'Double Patty Monster', price: 590 }
    ],
    addOns: [
      { name: 'Add Bacon Strip', price: 80 },
      { name: 'Extra Cheddar Slice', price: 40 }
    ]
  },
  {
    id: 'm9',
    code: 'FST-02',
    name: 'Woodfired Margherita Pizza',
    nepaliName: 'मार्गेरिटा पिज्जा',
    category: 'fast_food',
    price: 590,
    costPrice: 190,
    isAvailable: true,
    preparationTimeMinutes: 18,
    station: 'main_kitchen',
    description: 'Fresh buffalo mozzarella, san marzano tomatoes, garden basil',
    variants: [
      { name: '10 Inch Medium', price: 590 },
      { name: '12 Inch Large', price: 790 }
    ],
    addOns: [
      { name: 'Extra Mozzarella', price: 80 },
      { name: 'Jalapenos & Olives', price: 60 }
    ]
  },

  // Nepali Food
  {
    id: 'm-momo-stm',
    code: 'NEP-01',
    name: 'Classic Chicken Steamed Mo:Mo (10 pcs)',
    nepaliName: 'चिकेन स्टिम मो:मो (१० पिस)',
    category: 'nepali_food',
    price: 310,
    costPrice: 105,
    isAvailable: true,
    preparationTimeMinutes: 12,
    station: 'main_kitchen',
    description: 'Juicy minced chicken infused with cilantro, ginger & spring onion, served with golbheda ko achar',
    addOns: [
      { name: 'Extra Tomato Chutney', price: 30 },
      { name: 'Spicy Timur Chilli Dip', price: 40 }
    ],
    inventoryRecipe: [{ inventoryItemId: 'inv-4', amount: 0.22, unit: 'kg' }]
  },
  {
    id: 'm7',
    code: 'NEP-02',
    name: 'Special Chicken Jhol Mo:Mo (10 pcs)',
    nepaliName: 'विशेष चिकेन झोल मो:मो',
    category: 'nepali_food',
    price: 360,
    costPrice: 120,
    isAvailable: true,
    preparationTimeMinutes: 15,
    station: 'main_kitchen',
    description: 'Steamed dumplings bathed in rich roasted sesame, peanut & soybean spiced broth',
    inventoryRecipe: [{ inventoryItemId: 'inv-4', amount: 0.25, unit: 'kg' }]
  },
  {
    id: 'm-chowmein',
    code: 'NEP-03',
    name: 'Himalayan Chicken Chowmein',
    nepaliName: 'चिकेन चाउमिन',
    category: 'nepali_food',
    price: 290,
    costPrice: 90,
    isAvailable: true,
    preparationTimeMinutes: 12,
    station: 'main_kitchen',
    description: 'Wok-tossed noodles with shredded chicken, crunchy cabbage, bell peppers & scallions',
    variants: [
      { name: 'Chicken Chowmein', price: 290 },
      { name: 'Egg & Veg Chowmein', price: 240 }
    ]
  },
  {
    id: 'm-thukpa',
    code: 'NEP-04',
    name: 'Sherpa Style Chicken Thukpa',
    nepaliName: 'चिकेन थुक्पा (तातो सुप नुडल्स)',
    category: 'nepali_food',
    price: 320,
    costPrice: 100,
    isAvailable: true,
    preparationTimeMinutes: 14,
    station: 'main_kitchen',
    description: 'Hearty mountain noodle soup with pulled chicken, bok choy, carrots and ginger broth'
  },
  {
    id: 'm8',
    code: 'NEP-05',
    name: 'Thakali Mutton Khana Set (Dal Bhat)',
    nepaliName: 'थकाली खसीको दालभात सेट',
    category: 'nepali_food',
    price: 680,
    costPrice: 280,
    isAvailable: true,
    preparationTimeMinutes: 20,
    station: 'main_kitchen',
    description: 'Organic Marsi/Basmati rice, Jimbu black dal, slow-cooked local mutton curry, saag, gundruk achar & ghee',
    inventoryRecipe: [
      { inventoryItemId: 'inv-3', amount: 0.25, unit: 'kg' },
      { inventoryItemId: 'inv-5', amount: 0.2, unit: 'kg' }
    ]
  },
  {
    id: 'm10',
    code: 'NEP-06',
    name: 'Smoked Chicken Chhoila with Baji',
    nepaliName: 'चिकेन छोइला र चिउरा',
    category: 'nepali_food',
    price: 420,
    costPrice: 140,
    isAvailable: true,
    preparationTimeMinutes: 14,
    station: 'main_kitchen',
    description: 'Charcoal-roasted spiced chicken marinated in mustard oil, roasted fenugreek & green chilies'
  },
  {
    id: 'm-friedrice',
    code: 'NEP-07',
    name: 'Wok Fried Rice with Chicken',
    nepaliName: 'चिकेन फ्राइड राइस',
    category: 'nepali_food',
    price: 280,
    costPrice: 85,
    isAvailable: true,
    preparationTimeMinutes: 10,
    station: 'main_kitchen',
    description: 'Fragrant basmati rice tossed with shredded chicken, eggs, diced carrots & spring onions'
  },

  // Continental
  {
    id: 'm-sizzler',
    code: 'CON-01',
    name: 'Sizzling Garlic Chicken Breast',
    nepaliName: 'चिकेन सिज्लर',
    category: 'continental',
    price: 650,
    costPrice: 220,
    isAvailable: true,
    preparationTimeMinutes: 20,
    station: 'main_kitchen',
    description: 'Served on a piping hot iron plate with herb butter rice, steamed vegetables and mushroom pepper sauce'
  },

  // Bakery & Dessert
  {
    id: 'm5',
    code: 'BAK-01',
    name: 'Butter Croissant & Berry Jam',
    nepaliName: 'बटर क्रोइसाँ र जाम',
    category: 'bakery',
    price: 190,
    costPrice: 60,
    isAvailable: true,
    preparationTimeMinutes: 4,
    station: 'bakery',
    description: 'Flaky baked golden pastry served with local strawberry compote'
  },
  {
    id: 'm-brownie',
    code: 'DES-01',
    name: 'Sizzling Fudge Brownie with Vanilla Ice Cream',
    nepaliName: 'चकलेट ब्राउनी र आइसक्रिम',
    category: 'dessert',
    price: 340,
    costPrice: 95,
    isAvailable: true,
    preparationTimeMinutes: 7,
    station: 'dessert',
    description: 'Warm dark chocolate walnut brownie with cold vanilla bean ice cream and hot chocolate fudge',
    addOns: [
      { name: 'Extra Scoop Ice Cream', price: 80 }
    ]
  },
  {
    id: 'm-cheesecake',
    code: 'DES-02',
    name: 'New York Baked Blueberry Cheesecake',
    nepaliName: 'ब्लुबेरी चिजकेक',
    category: 'dessert',
    price: 380,
    costPrice: 120,
    isAvailable: true,
    preparationTimeMinutes: 5,
    station: 'dessert',
    description: 'Creamy Philadelphia cream cheese on graham crust topped with wild blueberry glaze'
  }
];

export const INITIAL_TABLES_ROOMS: TableRoom[] = [
  // Cafe & Restaurant Tables
  {
    id: 'tr-1',
    code: 'T-01',
    name: 'Table 1 (Indoor Cafe)',
    nepaliName: 'टेबल १ (क्याफे)',
    type: 'table',
    capacity: 2,
    status: 'available'
  },
  {
    id: 'tr-2',
    code: 'T-02',
    name: 'Table 2 (Window)',
    nepaliName: 'टेबल २ (झ्याल छेउ)',
    type: 'table',
    capacity: 4,
    status: 'available'
  },
  {
    id: 'tr-3',
    code: 'T-03',
    name: 'Table 3 (Family Dining)',
    nepaliName: 'टेबल ३ (पारिवारिक)',
    type: 'table',
    capacity: 6,
    status: 'available'
  },
  {
    id: 'tr-4',
    code: 'T-04',
    name: 'Table 4 (Garden Terrace)',
    nepaliName: 'टेबल ४ (बगैंचा)',
    type: 'table',
    capacity: 4,
    status: 'available'
  },
  {
    id: 'tr-5',
    code: 'T-05',
    name: 'Table 5 (Rooftop)',
    nepaliName: 'टेबल ५ (रूफटप)',
    type: 'table',
    capacity: 4,
    status: 'available'
  },
  {
    id: 'tr-6',
    code: 'T-06',
    name: 'Table 6 (Lounge)',
    nepaliName: 'टेबल ६ (लाउन्ज)',
    type: 'table',
    capacity: 2,
    status: 'available'
  },

  // Resort Rooms & Cottages
  {
    id: 'tr-101',
    code: 'RM-101',
    name: 'Room 101 - Mountain Deluxe',
    nepaliName: 'कोठा १०१ - डिलक्स',
    type: 'room',
    capacity: 2,
    status: 'available',
    ratePerNight: 4500
  },
  {
    id: 'tr-102',
    code: 'RM-102',
    name: 'Room 102 - Mountain Deluxe',
    nepaliName: 'कोठा १०२ - डिलक्स',
    type: 'room',
    capacity: 2,
    status: 'available',
    ratePerNight: 4500
  },
  {
    id: 'tr-103',
    code: 'RM-103',
    name: 'Room 103 - Executive Suite',
    nepaliName: 'कोठा १०३ - सुइट',
    type: 'room',
    capacity: 3,
    status: 'available',
    ratePerNight: 5500
  },
  {
    id: 'tr-201',
    code: 'COT-01',
    name: 'Cottage A - Pine Villa',
    nepaliName: 'कटेज १ - पाइन भिल्ला',
    type: 'cottage',
    capacity: 4,
    status: 'available',
    ratePerNight: 6500
  },
  {
    id: 'tr-202',
    code: 'COT-02',
    name: 'Cottage B - Bamboo Villa',
    nepaliName: 'कटेज २ - बाम्बो भिल्ला',
    type: 'cottage',
    capacity: 4,
    status: 'available',
    ratePerNight: 6500
  },

  // Quick Counter / Takeaway
  {
    id: 'tr-tk',
    code: 'TK-01',
    name: 'Quick Counter / Takeaway',
    nepaliName: 'काउन्टर / पार्सल',
    type: 'takeaway',
    capacity: 1,
    status: 'available'
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    code: 'INV-COF',
    name: 'Himalayan Organic Arabica Roasted Beans',
    nepaliName: 'अर्गानिक कफी गेडा',
    category: 'coffee_tea',
    currentStock: 4.8,
    unit: 'kg',
    minStockAlert: 2.0,
    costPerUnit: 1800,
    supplierName: 'Kaski Organic Coffee Farm',
    supplierPhone: '9846011223',
    lastUpdated: '2026-09-29'
  },
  {
    id: 'inv-2',
    code: 'INV-MLK',
    name: 'Fresh Cow Milk (Pasteurized)',
    nepaliName: 'गाईको ताजा दुध',
    category: 'dairy',
    currentStock: 10.0,
    unit: 'ltr',
    minStockAlert: 5.0,
    costPerUnit: 110,
    supplierName: 'Pokhara Dairy Cooperative',
    supplierPhone: '9856033445',
    lastUpdated: '2026-10-01'
  },
  {
    id: 'inv-3',
    code: 'INV-RIC',
    name: 'Basmati Special Rice',
    nepaliName: 'बासमती चामल',
    category: 'groceries',
    currentStock: 45,
    unit: 'kg',
    minStockAlert: 15,
    costPerUnit: 140,
    supplierName: 'Shree Krishna Wholesalers',
    supplierPhone: '9806122334',
    lastUpdated: '2026-09-25'
  },
  {
    id: 'inv-4',
    code: 'INV-CHK',
    name: 'Fresh Boneless Chicken',
    nepaliName: 'बोनलेस कुखुराको मासु',
    category: 'meat_poultry',
    currentStock: 12.5,
    unit: 'kg',
    minStockAlert: 5.0,
    costPerUnit: 440,
    supplierName: 'Valley Fresh Meat Suppliers',
    supplierPhone: '9841223344',
    lastUpdated: '2026-10-01'
  },
  {
    id: 'inv-5',
    code: 'INV-MUT',
    name: 'Local Mutton (Khasi)',
    nepaliName: 'लोकल खसीको मासु',
    category: 'meat_poultry',
    currentStock: 8.0,
    unit: 'kg',
    minStockAlert: 4.0,
    costPerUnit: 1250,
    supplierName: 'Valley Fresh Meat Suppliers',
    supplierPhone: '9841223344',
    lastUpdated: '2026-09-30'
  },
  {
    id: 'inv-6',
    code: 'INV-BER',
    name: 'Gorkha Beer Bottles (650ml)',
    nepaliName: 'गोर्खा बियर',
    category: 'beverages_bar',
    currentStock: 42,
    unit: 'bottle',
    minStockAlert: 12,
    costPerUnit: 260,
    supplierName: 'Gorkha Brewery Dist.',
    supplierPhone: '061-532145',
    lastUpdated: '2026-09-28'
  },
  {
    id: 'inv-7',
    code: 'INV-RES-KIT',
    name: 'Resort Guest Toiletries & Amenity Kit',
    nepaliName: 'अतिथि ट्वाइलेट्रिज किट',
    category: 'resort_supplies',
    currentStock: 35,
    unit: 'pcs',
    minStockAlert: 10,
    costPerUnit: 120,
    supplierName: 'Himalayan Hospitality Essentials',
    supplierPhone: '9851122334',
    lastUpdated: '2026-09-20'
  },
  {
    id: 'inv-8',
    code: 'INV-BOX',
    name: 'Eco-Friendly Kraft Takeaway Box',
    nepaliName: 'पर्यावरणमैत्री पार्सल बक्स',
    category: 'packaging',
    currentStock: 85,
    unit: 'pcs',
    minStockAlert: 25,
    costPerUnit: 18,
    supplierName: 'Pokhara Eco Packaging',
    supplierPhone: '9801998877',
    lastUpdated: '2026-09-22'
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_KHATA: KhataTransaction[] = [];

export const INITIAL_ORDERS: Order[] = [];

export const INITIAL_LOGS: InventoryLog[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_DAY_CLOSINGS: DayClosingRecord[] = [];

export const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-admin-01',
    username: 'admin',
    name: 'Owner / General Manager',
    nepaliName: 'प्रमुख व्यवस्थापक (Admin)',
    role: 'ADMIN',
    pinHash: 'ba2e5a4b96af7be7541ca9493a22a8c26883f37755fa93814a5f4fe17f5c44f4',
    salt: 'salt_admin_2026a1',
    isActive: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'staff-manager-02',
    username: 'manager',
    name: 'Resort & F&B Manager',
    nepaliName: 'रिसोर्ट म्यानेजर',
    role: 'MANAGER',
    pinHash: '3ca2d4f24af9810baa95695d0a77a4744b4389777dc563a693dd3ec5d5bb2227',
    salt: 'salt_manager_2026b2',
    isActive: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'staff-cashier-03',
    username: 'cashier',
    name: 'Main Counter Cashier',
    nepaliName: 'काउन्टर क्यासियर',
    role: 'CASHIER',
    pinHash: '3aa437d2bc94b058fbdf76226543cd44a4c2f1bcebb1beb425b916057d755ef6',
    salt: 'salt_cashier_2026c3',
    isActive: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'staff-waiter-04',
    username: 'waiter',
    name: 'Dining Service Staff',
    nepaliName: 'डाइनिङ वेटर',
    role: 'WAITER',
    pinHash: '097100649c46deb9a4386e5da6931beb8d14f3a1f56b04eabd343e047e8ada4a',
    salt: 'salt_waiter_2026d4',
    isActive: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'staff-kitchen-05',
    username: 'kitchen',
    name: 'Head Chef & Kitchen',
    nepaliName: 'हेड सेफ (किचेन)',
    role: 'KITCHEN',
    pinHash: 'ca229d6c8ed28b2c21b3142677198fc1d2fabee69eb2bcb74ebf55b79a2a1cd8',
    salt: 'salt_kitchen_2026e5',
    isActive: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'staff-reception-06',
    username: 'reception',
    name: 'Front Desk Receptionist',
    nepaliName: 'रिसेप्सन तथा फ्रन्ट डेस्क',
    role: 'RECEPTIONIST',
    pinHash: 'f02d730a3c44e19585f83e3c64fa9d10d7ab4a33889f3669c34bc9349fa86f2d',
    salt: 'salt_reception_2026f6',
    isActive: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'staff-housekeeping-07',
    username: 'housekeeping',
    name: 'Housekeeping & Cleaning',
    nepaliName: 'हाउसकिपिङ तथा सरसफाइ',
    role: 'HOUSEKEEPING',
    pinHash: '9eb87eb73ecbab55d989dba4d5c9de56adf6c838463676ce3f9ee8ecd7e581d0',
    salt: 'salt_house_2026g7',
    isActive: true,
    createdAt: '2026-10-01'
  },
  {
    id: 'staff-accountant-08',
    username: 'accountant',
    name: 'Chief Accountant',
    nepaliName: 'मुख्य लेखापाल (Accountant)',
    role: 'ACCOUNTANT',
    pinHash: '40e89688f3454adf59c5447ba480ce7181893400ec3e4ed41eaabaeb9c3728ea',
    salt: 'salt_account_2026h8',
    isActive: true,
    createdAt: '2026-10-01'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const INITIAL_ROOM_TYPES: RoomType[] = [
  {
    id: 'rt-stnd',
    name: 'Standard Mountain View Room',
    nepaliName: 'स्ट्यान्डर्ड हिमाल भ्यू कोठा',
    description: 'Cozy and elegant accommodation featuring panoramic views of the Machapuchare and Annapurna range.',
    imageUrl: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    basePrice: 3500,
    maxAdults: 2,
    maxChildren: 1,
    totalCapacity: 3,
    amenities: ['Mountain View', 'High-Speed WiFi', 'Hot Shower 24/7', 'Electric Kettle', 'Tea/Coffee Setup', 'Work Desk'],
    isActive: true
  },
  {
    id: 'rt-dlx',
    name: 'Deluxe Lake-Facing Room',
    nepaliName: 'डिलक्स फेवा लेक भ्यू कोठा',
    description: 'Spacious retreat with private balcony overlooking the serene Phewa Lake waters, king bed, and climate control.',
    imageUrl: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80',
    basePrice: 5500,
    maxAdults: 2,
    maxChildren: 1,
    totalCapacity: 3,
    amenities: ['Private Balcony', 'Phewa Lake View', 'Inverter AC', 'Smart 43" TV', 'Mini Bar', 'King Sized Bed', 'Organic Toiletries'],
    isActive: true
  },
  {
    id: 'rt-ste',
    name: 'Himalayan Presidential Suite',
    nepaliName: 'हिमालयन प्रेसिडेन्सियल सुइट',
    description: 'Luxury master suite featuring a separate living parlor, private Jacuzzi tub, espresso bar, and butler service.',
    imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    basePrice: 9500,
    maxAdults: 3,
    maxChildren: 2,
    totalCapacity: 4,
    amenities: ['Private Jacuzzi Tub', 'Separate Living Salon', 'Italian Espresso Machine', 'Annapurna Panorama', 'King Bed + Sofa Bed', 'Complimentary Wine & Fruit Basket', 'Dedicated Butler'],
    isActive: true
  },
  {
    id: 'rt-ctg',
    name: 'Pine Wooden Garden Cottage',
    nepaliName: 'पाइन उडन गार्डेन कटेज',
    description: 'Independent pine-log cottage surrounded by organic gardens, stone fireplace, and rustic luxury ambiance.',
    imageUrl: 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=800&q=80',
    basePrice: 7200,
    maxAdults: 3,
    maxChildren: 1,
    totalCapacity: 4,
    amenities: ['Private Garden Porch', 'Working Fireplace', 'Handcrafted Pine Finish', 'Forest & Lake Views', 'Custom Bathrobes', 'Campfire Access'],
    isActive: true
  },
  {
    id: 'rt-vla',
    name: 'Family Retreat Lake Villa',
    nepaliName: 'पारिवारिक लेक भिल्ला',
    description: 'Exclusive multi-bedroom villa with private terrace, kitchenette, spacious dining area, and secluded lawn.',
    imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80',
    basePrice: 14000,
    maxAdults: 6,
    maxChildren: 3,
    totalCapacity: 8,
    amenities: ['2 Master Bedrooms', 'Fully Equipped Kitchenette', 'Private Lawn & BBQ Station', 'Dining Table for 8', 'Dedicated Butler & Chef on Demand', 'Lake Access Pier'],
    isActive: true
  },
  {
    id: 'rt-glm',
    name: 'Luxury Honeymoon Glamping Dome',
    nepaliName: 'लक्जरी हनिमुन ग्ल्याम्पिङ',
    description: 'Geodesic dome retreat perched on the hill with stargazing skylight, heated bedding, and private infinity plunge tub.',
    imageUrl: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=800&q=80',
    basePrice: 8000,
    maxAdults: 2,
    maxChildren: 0,
    totalCapacity: 2,
    amenities: ['Transparent Stargazing Dome', 'Outdoor Heated Plunge Tub', 'Private Sun Deck', 'Marshall Sound System', 'Romantic Candlelight Dinner Setup', 'Complimentary Champagne'],
    isActive: true
  }
];

export const INITIAL_RESORT_ROOMS: ResortRoom[] = [
  {
    id: 'r-101',
    roomNumber: '101',
    roomTypeId: 'rt-dlx',
    roomTypeName: 'Deluxe Lake-Facing Room',
    floor: 'Floor 1',
    capacity: 3,
    pricePerNight: 5500,
    amenities: ['Lake View Balcony', 'Inverter AC', 'King Bed', 'Smart TV', 'Hot Shower'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-102',
    roomNumber: '102',
    roomTypeId: 'rt-dlx',
    roomTypeName: 'Deluxe Lake-Facing Room',
    floor: 'Floor 1',
    capacity: 3,
    pricePerNight: 5500,
    amenities: ['Lake View Balcony', 'Inverter AC', 'King Bed', 'Smart TV', 'Hot Shower'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-103',
    roomNumber: '103',
    roomTypeId: 'rt-dlx',
    roomTypeName: 'Deluxe Lake-Facing Room',
    floor: 'Floor 1',
    capacity: 3,
    pricePerNight: 5500,
    amenities: ['Lake View Balcony', 'Inverter AC', 'King Bed', 'Smart TV'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-104',
    roomNumber: '104',
    roomTypeId: 'rt-stnd',
    roomTypeName: 'Standard Mountain View Room',
    floor: 'Floor 1',
    capacity: 2,
    pricePerNight: 3500,
    amenities: ['Mountain View', 'Hot Shower', 'WiFi', 'Kettle'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-105',
    roomNumber: '105',
    roomTypeId: 'rt-stnd',
    roomTypeName: 'Standard Mountain View Room',
    floor: 'Floor 1',
    capacity: 2,
    pricePerNight: 3500,
    amenities: ['Mountain View', 'Hot Shower', 'WiFi'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-201',
    roomNumber: '201',
    roomTypeId: 'rt-ste',
    roomTypeName: 'Himalayan Presidential Suite',
    floor: 'Floor 2',
    capacity: 4,
    pricePerNight: 9500,
    amenities: ['Jacuzzi Tub', 'Separate Living Room', 'Espresso Machine', 'Panorama View', 'King Bed'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-202',
    roomNumber: '202',
    roomTypeId: 'rt-ste',
    roomTypeName: 'Himalayan Presidential Suite',
    floor: 'Floor 2',
    capacity: 4,
    pricePerNight: 9500,
    amenities: ['Jacuzzi Tub', 'Separate Living Room', 'Espresso Machine', 'Panorama View'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-203',
    roomNumber: '203',
    roomTypeId: 'rt-stnd',
    roomTypeName: 'Standard Mountain View Room',
    floor: 'Floor 2',
    capacity: 2,
    pricePerNight: 3500,
    amenities: ['Mountain View', 'WiFi'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-ctg1',
    roomNumber: 'C-1',
    roomTypeId: 'rt-ctg',
    roomTypeName: 'Pine Wooden Garden Cottage',
    floor: 'Garden Lawn',
    capacity: 4,
    pricePerNight: 7200,
    amenities: ['Private Garden', 'Fireplace', 'Pine Wood Finish', 'Campfire Access'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-ctg2',
    roomNumber: 'C-2',
    roomTypeId: 'rt-ctg',
    roomTypeName: 'Pine Wooden Garden Cottage',
    floor: 'Garden Lawn',
    capacity: 4,
    pricePerNight: 7200,
    amenities: ['Private Garden', 'Fireplace', 'Pine Wood Finish'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-vla1',
    roomNumber: 'Villa-1',
    roomTypeId: 'rt-vla',
    roomTypeName: 'Family Retreat Lake Villa',
    floor: 'Private Enclave',
    capacity: 8,
    pricePerNight: 14000,
    amenities: ['2 Bedrooms', 'Kitchenette', 'Private Lawn', 'BBQ Pier', 'Butler Service'],
    status: 'AVAILABLE'
  },
  {
    id: 'r-glm1',
    roomNumber: 'Dome-1',
    roomTypeId: 'rt-glm',
    roomTypeName: 'Luxury Honeymoon Glamping Dome',
    floor: 'Stargazer Hill',
    capacity: 2,
    pricePerNight: 8000,
    amenities: ['Stargazer Dome', 'Heated Bedding', 'Infinity Plunge Tub', 'Private Sun Deck'],
    status: 'AVAILABLE'
  }
];

export const INITIAL_GUEST_PROFILES: GuestProfile[] = [];

export const INITIAL_RESERVATIONS: Reservation[] = [];

export const INITIAL_GUEST_FOLIOS: GuestFolioItem[] = [];

export const INITIAL_RESORT_SERVICES: ResortService[] = [
  {
    id: 'srv-1',
    name: 'Airport Transfer (Private Car/SUV)',
    category: 'TRANSPORT',
    description: 'Chauffeured pickup or drop between Pokhara Airport and Resort.',
    price: 2000,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  },
  {
    id: 'srv-2',
    name: 'Ayurvedic Herbal Relaxation Massage (60 min)',
    category: 'SPA',
    description: 'Therapeutic full-body warm herbal oil massage with Himalayan herbs.',
    price: 3500,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  },
  {
    id: 'srv-3',
    name: 'Deep Tissue Mountain Trekker Massage (90 min)',
    category: 'SPA',
    description: 'Intense relief massage focusing on calves, back, and shoulders post-hiking.',
    price: 4800,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  },
  {
    id: 'srv-4',
    name: 'Express Laundry Service (Wash, Dry & Iron)',
    category: 'LAUNDRY',
    description: 'Same day laundry turnaround delivered directly to your room wardrobe.',
    price: 400,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  },
  {
    id: 'srv-5',
    name: 'Lakeside Romantic Candlelight Dinner Setup',
    category: 'OTHER_SERVICE',
    description: 'Exclusive pier dining with flowers, torches, 4-course menu and live violin.',
    price: 5000,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  },
  {
    id: 'srv-6',
    name: 'Guided Sarangkot Sunrise Sightseeing Tour',
    category: 'TRANSPORT',
    description: 'Early morning private vehicle trip to Sarangkot viewpoint with hot thermos tea.',
    price: 3200,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  },
  {
    id: 'srv-7',
    name: 'Extra Rollaway Luxury Bed / Mattress',
    category: 'ROOM',
    description: 'High thread-count orthopedic mattress with complete duvet and pillows.',
    price: 1500,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  },
  {
    id: 'srv-8',
    name: 'Gourmet Himalayan Buffet Breakfast Spread',
    category: 'BREAKFAST',
    description: 'Continental & Nepali breakfast buffet with live egg and pancake stations.',
    price: 850,
    taxPercent: 13,
    isAvailable: true,
    isActive: true
  }
];

export const INITIAL_HOUSEKEEPING_TASKS: HousekeepingTask[] = [];

export const INITIAL_MAINTENANCE_ISSUES: MaintenanceIssue[] = [];

export const INITIAL_HOTEL_PAYMENTS: HotelPaymentRecord[] = [];

export const CLEAN_TABLES_ROOMS: TableRoom[] = INITIAL_TABLES_ROOMS.map((tr) => ({
  id: tr.id,
  code: tr.code,
  name: tr.name,
  nepaliName: tr.nepaliName,
  type: tr.type,
  capacity: tr.capacity,
  status: 'available' as const,
  ...(typeof tr.ratePerNight === 'number' ? { ratePerNight: tr.ratePerNight } : {})
}));

export const CLEAN_INVENTORY: InventoryItem[] = INITIAL_INVENTORY.map((item) => ({
  ...item,
  currentStock: Math.max(item.currentStock, item.minStockAlert * 2),
  lastUpdated: new Date().toISOString().split('T')[0]
}));

export const CLEAN_RESORT_ROOMS: ResortRoom[] = INITIAL_RESORT_ROOMS.map((rm) => ({
  id: rm.id,
  roomNumber: rm.roomNumber,
  roomTypeId: rm.roomTypeId,
  roomTypeName: rm.roomTypeName,
  floor: rm.floor,
  capacity: rm.capacity,
  pricePerNight: rm.pricePerNight,
  amenities: [...rm.amenities],
  status: 'AVAILABLE' as const
}));

const LEGACY_DEMO_ORDER_IDS = new Set(['ord-active-1', 'ord-hist-1', 'ord-hist-2']);
const LEGACY_DEMO_CUSTOMER_IDS = new Set(['c-1', 'c-2', 'c-3', 'c-4', 'cc-1']);
const LEGACY_DEMO_KHATA_IDS = new Set(['kt-1', 'kt-2', 'kt-3']);
const LEGACY_DEMO_EXPENSE_IDS = new Set(['exp-1', 'exp-2', 'exp-3']);
const LEGACY_DEMO_DAY_CLOSING_IDS = new Set(['dc-1']);
const LEGACY_DEMO_LOG_IDS = new Set(['log-1', 'log-2']);
const LEGACY_DEMO_GUEST_IDS = new Set(['gp-1', 'gp-101', 'gp-102', 'gp-103', 'gp-201', 'gp-c1']);
const LEGACY_DEMO_RESERVATION_IDS = new Set(['res-101', 'res-102', 'res-103', 'res-201', 'res-c1']);
const LEGACY_DEMO_FOLIO_IDS = new Set([
  'fol-1', 'fol-2', 'fol-3', 'fol-4', 'fol-5', 'fol-6', 'fol-7', 'fol-8', 'fol-9', 'fol-10'
]);
const LEGACY_DEMO_HOUSEKEEPING_IDS = new Set(['hk-1', 'hk-2', 'hk-3']);
const LEGACY_DEMO_MAINTENANCE_IDS = new Set(['mnt-1', 'mnt-2', 'mnt-3']);
const LEGACY_DEMO_PAYMENT_IDS = new Set(['hp-1', 'hpay-1', 'hpay-2', 'hpay-3', 'hpay-4', 'hpay-5']);

/**
 * Removes legacy seeded demo operational records (rooms showing fake guests/issues,
 * sample orders, sample reservations, sample Khata dues, sample low-stock counts)
 * without ever deleting user-created records.
 */
export function scrubLegacyDemoData(state: AppState): { state: AppState; changed: boolean } {
  let changed = false;

  const nextOrders = (state.orders || []).filter((o) => !LEGACY_DEMO_ORDER_IDS.has(o.id));
  if (nextOrders.length !== (state.orders || []).length) changed = true;

  const nextCustomers = (state.customers || []).filter((c) => !LEGACY_DEMO_CUSTOMER_IDS.has(c.id));
  if (nextCustomers.length !== (state.customers || []).length) changed = true;

  const nextKhata = (state.khataTransactions || []).filter((k) => !LEGACY_DEMO_KHATA_IDS.has(k.id));
  if (nextKhata.length !== (state.khataTransactions || []).length) changed = true;

  const nextExpenses = (state.expenses || []).filter((e) => !LEGACY_DEMO_EXPENSE_IDS.has(e.id));
  if (nextExpenses.length !== (state.expenses || []).length) changed = true;

  const nextClosings = (state.dayClosings || []).filter((d) => !LEGACY_DEMO_DAY_CLOSING_IDS.has(d.id));
  if (nextClosings.length !== (state.dayClosings || []).length) changed = true;

  const nextLogs = (state.inventoryLogs || []).filter((l) => !LEGACY_DEMO_LOG_IDS.has(l.id));
  if (nextLogs.length !== (state.inventoryLogs || []).length) changed = true;

  const nextGuests = (state.guestProfiles || []).filter((g) => !LEGACY_DEMO_GUEST_IDS.has(g.id));
  if (nextGuests.length !== (state.guestProfiles || []).length) changed = true;

  const nextReservations = (state.reservations || []).filter(
    (r) => !LEGACY_DEMO_RESERVATION_IDS.has(r.id)
  );
  if (nextReservations.length !== (state.reservations || []).length) changed = true;

  const nextFolios = (state.guestFolioItems || []).filter((f) => !LEGACY_DEMO_FOLIO_IDS.has(f.id));
  if (nextFolios.length !== (state.guestFolioItems || []).length) changed = true;

  const nextTasks = (state.housekeepingTasks || []).filter(
    (t) => !LEGACY_DEMO_HOUSEKEEPING_IDS.has(t.id)
  );
  if (nextTasks.length !== (state.housekeepingTasks || []).length) changed = true;

  const nextIssues = (state.maintenanceIssues || []).filter(
    (m) => !LEGACY_DEMO_MAINTENANCE_IDS.has(m.id)
  );
  if (nextIssues.length !== (state.maintenanceIssues || []).length) changed = true;

  const nextPayments = (state.hotelPayments || []).filter((p) => !LEGACY_DEMO_PAYMENT_IDS.has(p.id));
  if (nextPayments.length !== (state.hotelPayments || []).length) changed = true;

  const nextTables = (state.tablesRooms || []).map((tr) => {
    const isDemoOrder = Boolean(tr.currentOrderId && LEGACY_DEMO_ORDER_IDS.has(tr.currentOrderId));
    const hasLegacySeedDate = Boolean(
      tr.checkInTime === '2026-09-30 14:00' || tr.checkInTime === '2026-10-01 11:30'
    );
    const hasUnlinkedDemoTableState =
      (tr.id === 'tr-3' && tr.status === 'waiting_for_bill' && !tr.currentOrderId) ||
      (tr.id === 'tr-4' && tr.status === 'reserved' && tr.guestName === 'Anil Shrestha') ||
      (tr.id === 'tr-5' && tr.status === 'cleaning' && !tr.currentOrderId) ||
      (tr.id === 'tr-6' && tr.status === 'out_of_service');
    if (isDemoOrder || hasLegacySeedDate || hasUnlinkedDemoTableState) {
      changed = true;
      return {
        ...tr,
        status: 'available' as const,
        currentOrderId: undefined,
        guestName: undefined,
        guestPhone: undefined,
        checkInTime: undefined
      };
    }
    return tr;
  });

  const nextRooms = (state.resortRooms || []).map((rm) => {
    const isDemoRes = Boolean(
      rm.currentReservationId && LEGACY_DEMO_RESERVATION_IDS.has(rm.currentReservationId)
    );
    const isLegacyNonAvailable =
      (rm.id === 'r-105' && rm.status === 'DIRTY' && rm.lastCleanedTime === '2026-10-01 10:00') ||
      (rm.id === 'r-203' && rm.status === 'OUT_OF_SERVICE' && rm.lastCleanedTime === '2026-09-29 16:00') ||
      (rm.id === 'r-ctg2' && rm.status === 'CLEANING' && rm.lastCleanedTime === '2026-10-01 18:00') ||
      (rm.id === 'r-vla1' && rm.status === 'MAINTENANCE' && rm.lastCleanedTime === '2026-09-30 15:00');
    if (isDemoRes || isLegacyNonAvailable) {
      changed = true;
      return {
        ...rm,
        status: 'AVAILABLE' as const,
        description: isLegacyNonAvailable ? undefined : rm.description,
        currentGuestName: undefined,
        currentGuestPhone: undefined,
        currentReservationId: undefined,
        checkInDate: undefined,
        checkOutDate: undefined
      };
    }
    return rm;
  });

  // Top up untouched demo low-stock items (inv-2: 1.5, inv-5: 3.2) so starter alerts stay clean
  const nextInventory = (state.inventoryItems || []).map((inv) => {
    if (inv.id === 'inv-2' && inv.currentStock === 1.5 && inv.lastUpdated === '2026-10-01') {
      changed = true;
      return { ...inv, currentStock: 10 };
    }
    if (inv.id === 'inv-5' && inv.currentStock === 3.2 && inv.lastUpdated === '2026-09-30') {
      changed = true;
      return { ...inv, currentStock: 8 };
    }
    return inv;
  });

  const nextActiveOrderId =
    state.activeOrderId && LEGACY_DEMO_ORDER_IDS.has(state.activeOrderId)
      ? undefined
      : state.activeOrderId;
  if (nextActiveOrderId !== state.activeOrderId) changed = true;

  if (!changed) {
    return { state, changed: false };
  }

  return {
    changed: true,
    state: {
      ...state,
      orders: nextOrders,
      customers: nextCustomers,
      khataTransactions: nextKhata,
      expenses: nextExpenses,
      dayClosings: nextClosings,
      inventoryLogs: nextLogs,
      inventoryItems: nextInventory,
      tablesRooms: nextTables,
      resortRooms: nextRooms,
      guestProfiles: nextGuests,
      reservations: nextReservations,
      guestFolioItems: nextFolios,
      housekeepingTasks: nextTasks,
      maintenanceIssues: nextIssues,
      hotelPayments: nextPayments,
      activeOrderId: nextActiveOrderId
    }
  };
}

export function getCleanStarterState(preserveSettings?: BusinessSettings, preserveStaff?: StaffUser[]): AppState {
  return {
    menuItems: [],
    tablesRooms: [],
    orders: [],
    inventoryItems: [],
    inventoryLogs: [],
    customers: [],
    khataTransactions: [],
    expenses: [],
    dayClosings: [],
    staffUsers: preserveStaff && preserveStaff.length > 0 ? preserveStaff : INITIAL_STAFF_USERS,
    auditLogs: [],
    settings: preserveSettings
      ? {
          ...DEFAULT_SETTINGS,
          ...preserveSettings
        }
      : DEFAULT_SETTINGS,
    activeOrderId: undefined,
    roomTypes: [],
    resortRooms: [],
    guestProfiles: [],
    reservations: [],
    guestFolioItems: [],
    resortServices: [],
    housekeepingTasks: [],
    maintenanceIssues: [],
    hotelPayments: []
  };
}

export function getInitialAppState(): AppState {
  if (typeof window === 'undefined') {
    return getCleanStarterState();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.menuItems && parsed.orders && parsed.inventoryItems) {
        const cleanedSecurity = parsed.settings?.securitySettings
          ? (() => {
              const { masterOwnerEmail: _dropped, ...restSec } = parsed.settings.securitySettings;
              return restSec;
            })()
          : parsed.settings?.securitySettings;
        const cleanedStaff = (Array.isArray(parsed.staffUsers) && parsed.staffUsers.length > 0)
          ? parsed.staffUsers.map((s: StaffUser) =>
              s.role === 'SUPER_ADMIN'
                ? { ...s, email: undefined, username: s.username?.includes('@') ? 'superadmin' : s.username }
                : s
            )
          : INITIAL_STAFF_USERS;
        return {
          ...parsed,
          settings: parsed.settings
            ? { ...parsed.settings, securitySettings: cleanedSecurity }
            : parsed.settings,
          expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
          dayClosings: Array.isArray(parsed.dayClosings) ? parsed.dayClosings : [],
          staffUsers: cleanedStaff,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          roomTypes: Array.isArray(parsed.roomTypes) ? parsed.roomTypes : [],
          resortRooms: Array.isArray(parsed.resortRooms) ? parsed.resortRooms : [],
          guestProfiles: Array.isArray(parsed.guestProfiles) ? parsed.guestProfiles : [],
          reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [],
          guestFolioItems: Array.isArray(parsed.guestFolioItems) ? parsed.guestFolioItems : [],
          resortServices: Array.isArray(parsed.resortServices) ? parsed.resortServices : [],
          housekeepingTasks: Array.isArray(parsed.housekeepingTasks) ? parsed.housekeepingTasks : [],
          maintenanceIssues: Array.isArray(parsed.maintenanceIssues) ? parsed.maintenanceIssues : [],
          hotelPayments: Array.isArray(parsed.hotelPayments) ? parsed.hotelPayments : []
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse state from localStorage, falling back to clean defaults', e);
  }

  const defaultState = getCleanStarterState();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
  } catch (err) {
    console.error('Failed to save initial state to localStorage', err);
  }

  return defaultState;
}

export function saveAppState(state: AppState): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('Error saving app state to localStorage', err);
    return false;
  }
}

export function exportBackupJSON(state: AppState) {
  const sanitizedSecurity = state.settings?.securitySettings
    ? (() => {
        const { masterOwnerEmail: _dropped, ...restSec } = state.settings.securitySettings;
        return restSec;
      })()
    : state.settings?.securitySettings;
  const sanitizedState: AppState = {
    ...state,
    settings: state.settings ? { ...state.settings, securitySettings: sanitizedSecurity } : state.settings,
    staffUsers: Array.isArray(state.staffUsers)
      ? state.staffUsers.map((s) =>
          s.role === 'SUPER_ADMIN' ? { ...s, email: undefined } : s
        )
      : state.staffUsers
  };
  const jsonStr = JSON.stringify(sanitizedState, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `HimalayanBreeze_Backup_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSalesCSV(orders: Order[], currency: string = 'Rs.') {
  const headers = ['Invoice No', 'Date', 'Table/Room', 'Type', 'Subtotal', 'Discount', 'Tax/VAT', 'Total', 'Payment Mode', 'Status'];
  const rows = orders.map(o => [
    o.invoiceNo,
    o.createdAt,
    `"${o.tableRoomName.replace(/"/g, '""')}"`,
    o.orderType,
    o.subtotal.toFixed(2),
    o.discountAmount.toFixed(2),
    o.vatAmount.toFixed(2),
    o.grandTotal.toFixed(2),
    o.paymentMethod,
    o.status
  ]);
  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`);
  link.click();
  URL.revokeObjectURL(url);
}

export function exportInventoryCSV(items: InventoryItem[], businessName?: string) {
  const headers = ['Code', 'Item Name', 'Nepali Name', 'Category', 'Current Stock', 'Unit', 'Min Stock Alert', 'Cost Per Unit (Rs)', 'Total Value (Rs)', 'Supplier'];
  const rows = items.map(item => [
    item.code,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.nepaliName.replace(/"/g, '""')}"`,
    item.category,
    item.currentStock,
    item.unit,
    item.minStockAlert,
    item.costPerUnit,
    (item.currentStock * item.costPerUnit).toFixed(2),
    `"${(item.supplierName || '').replace(/"/g, '""')}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const prefix = businessName ? `${businessName.replace(/[^a-zA-Z0-9_-]/g, '_')}_` : '';
  link.setAttribute('download', `${prefix}Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCustomerKhataCSV(customers: Customer[]) {
  const headers = ['Name', 'Phone', 'Type', 'Khata Balance Due (Rs)', 'Loyalty Points', 'Total Spend', 'Total Visits', 'Last Visit'];
  const rows = customers.map(c => [
    `"${c.name.replace(/"/g, '""')}"`,
    c.phone,
    c.customerType,
    c.creditBalance.toFixed(2),
    c.loyaltyPoints,
    c.totalSpend.toFixed(2),
    c.totalVisits,
    c.lastVisit || ''
  ]);
  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Customer_Khata_Report_${new Date().toISOString().split('T')[0]}.csv`);
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Computes the next sequential serial KOT number based on existing tenant orders and stored sequence.
 * Pure preview by default (`persist = false`) so React re-renders never consume/skip KOT numbers.
 * Pass `persist = true` only when an order/KOT is actually dispatched.
 */
export function getNextKOTNumber(
  orders: Order[] = [],
  prefix: string = 'KOT-',
  businessId?: string,
  persist: boolean = false
): string {
  let maxNumber = 0;

  // 1. Scan all existing orders across current tenant state
  orders.forEach(order => {
    if (order.kotNo) {
      const match = order.kotNo.match(/KOT[-_ ]?(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });

  const seqKey = businessId ? `pos_last_kot_seq_${businessId}` : 'pos_last_kot_sequence';

  // 2. Scan tenant-scoped localStorage sequence counter if available
  try {
    const storedSeq = localStorage.getItem(seqKey);
    if (storedSeq) {
      const parsedSeq = parseInt(storedSeq, 10);
      if (!isNaN(parsedSeq) && parsedSeq > maxNumber) {
        maxNumber = parsedSeq;
      }
    }
  } catch (e) {
    // Ignore restricted storage environments
  }

  // If no previous orders found, default start sequence is 1
  const nextSeq = maxNumber + 1;

  // Persist sequence strictly on commit so re-renders never advance counter
  if (persist) {
    try {
      localStorage.setItem(seqKey, nextSeq.toString());
    } catch (e) {
      // Ignore
    }
  }

  const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  return `${cleanPrefix}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Computes the next sequential Invoice number based on existing tenant orders.
 * Pure preview by default (`persist = false`) so React re-renders never skip Invoice numbers.
 * Format: INV-YYYY-XXXX (e.g. INV-2026-1001)
 */
export function getNextInvoiceNumber(
  orders: Order[] = [],
  prefix: string = 'INV-',
  businessId?: string,
  persist: boolean = false
): string {
  const currentYear = new Date().getFullYear();
  let maxNumber = 0;

  orders.forEach(order => {
    const inv = order.invoiceNo || order.invoiceNumber || '';
    if (inv) {
      const match = inv.match(/(\d{4})-(\d+)/) || inv.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[2] || match[1], 10);
        if (!isNaN(num) && num > maxNumber) {
          maxNumber = num;
        }
      }
    }
  });

  const seqKey = businessId ? `pos_last_inv_seq_${businessId}` : 'pos_last_inv_sequence';

  try {
    const storedSeq = localStorage.getItem(seqKey);
    if (storedSeq) {
      const parsedSeq = parseInt(storedSeq, 10);
      if (!isNaN(parsedSeq) && parsedSeq > maxNumber) {
        maxNumber = parsedSeq;
      }
    }
  } catch (e) {
    // Ignore
  }

  // If no previous invoices found, start at 1001
  const nextSeq = maxNumber > 0 ? maxNumber + 1 : 1001;

  if (persist) {
    try {
      localStorage.setItem(seqKey, nextSeq.toString());
    } catch (e) {
      // Ignore
    }
  }

  const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  return `${cleanPrefix}${currentYear}-${String(nextSeq).padStart(4, '0')}`;
}
