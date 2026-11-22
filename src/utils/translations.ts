export type Language = 'ne' | 'en';

export const TRANSLATIONS = {
  ne: {
    appName: 'हिमालयन ब्रीज',
    tagline: 'क्याफे, रेस्टुरेन्ट र रिसोर्ट व्यवस्थापन',
    posBilling: 'बिलिङ (POS)',
    tablesRooms: 'टेबल तथा कोठाहरू',
    inventory: 'स्टक / इन्भेन्टरी',
    customersKhata: 'ग्राहक तथा खाता (CRM)',
    reports: 'बिक्री तथा रिपोर्ट',
    settings: 'सेटिङ तथा ब्याकअप',
    
    // POS
    searchMenu: 'मेनु आइटम खोज्नुहोस्...',
    allCategories: 'सबै मेनु',
    cafeBeverages: 'क्याफे कफी / चिया',
    bakerySnacks: 'बेकरी तथा खाजा',
    diningFood: 'खाना तथा मो:मो',
    resortRooms: 'रिसोर्ट कोठा / कटेज',
    barSpirits: 'बार तथा पेय',
    desserts: 'मिठाई / डेजर्ट',
    
    currentOrder: 'चालु अर्डर',
    tableRoom: 'टेबल / कोठा',
    changeTable: 'फेर्नुहोस्',
    orderType: 'अर्डर प्रकार',
    dineIn: 'डाइन-इन',
    roomStay: 'कोठा सेवा',
    takeaway: 'पार्सल / काउन्टर',
    
    emptyCart: 'अर्डरमा कुनै आइटम छैन',
    selectItems: 'बायाँ मेनुबाट परिकार थप्नुहोस्',
    subtotal: 'कुल रकम (Subtotal)',
    discount: 'छुट (Discount)',
    serviceCharge: 'सेवा शुल्क (SC)',
    vat: 'मूल्य अभिवृद्धि कर (VAT)',
    grandTotal: 'जम्मा तिर्नुपर्ने (Grand Total)',
    
    saveKOT: 'KOT किचेन पठाउनुहोस्',
    printKOT: 'KOT प्रिन्ट',
    settleBill: 'बिल भुक्तानी (Checkout)',
    clearCart: 'रद्द गर्नुहोस्',
    
    paymentMethod: 'भुक्तानी माध्यम',
    cash: 'नगद (Cash)',
    fonepay: 'Fonepay / QR',
    card: 'कार्ड (POS Machine)',
    khataCredit: 'उधारो / खाता (Credit)',
    splitPayment: 'छुट्टाछुट्टै (Split)',
    
    paidSuccessfully: 'भुक्तानी सम्पन्न भयो!',
    printBill: 'बिल प्रिन्ट गर्नुहोस्',
    close: 'बन्द गर्नुहोस्',
    
    // Tables & Rooms
    available: 'खाली (Available)',
    occupied: 'व्यस्त (Occupied)',
    reserved: 'सुरक्षित (Reserved)',
    cleaning: 'सरसफाइ (Cleaning)',
    checkIn: 'चेक-इन',
    checkOut: 'चेक-आउट',
    newBooking: 'नयाँ पाहुना दर्ता',
    roomRate: 'प्रति रात दर',
    capacity: 'क्षमता',
    
    // Inventory
    addItem: 'नयाँ स्टक आइटम थप्नुहोस्',
    lowStockAlert: 'कम मौज्दात चेतावनी',
    stockIn: 'खरिद थप (Stock In)',
    stockOut: 'खर्च वा नोक्सान (Usage/Wastage)',
    stockName: 'सामग्रीको नाम',
    currentQty: 'हालको मौज्दात',
    reorderLevel: 'न्यूनतम सिमा',
    unitCost: 'इकाई लागत',
    totalValuation: 'कुल मौज्दात मूल्य',
    allGood: 'सबै सामान पर्याप्त मात्रामा छ',
    
    // Customers & Khata
    customerDirectory: 'ग्राहक निर्देशिका',
    totalUdharo: 'कुल उठ्न बाँकी उधारो',
    addCustomer: 'नयाँ ग्राहक दर्ता',
    collectPayment: 'उधारो चुक्ता लिनुहोस्',
    giveCredit: 'उधारो थप गर्नुहोस्',
    khataLedger: 'खाता विवरण (Ledger)',
    loyaltyPoints: 'लोयल्टी पोइन्ट',
    phone: 'फोन नम्बर',
    address: 'ठेगाना',
    
    // Reports
    todaySales: 'आजको बिक्री',
    totalOrders: 'कुल अर्डर संख्या',
    avgOrderValue: 'औसत बिल रकम',
    topSelling: 'धेरै बिक्री हुने परिकार',
    paymentBreakdown: 'भुक्तानी अनुसार बिक्री',
    exportCSV: 'एक्सेल (CSV) डाउनलोड',
    exportBackup: 'डेटा ब्याकअप सुरक्षित गर्नुहोस् (JSON)',
    importBackup: 'ब्याकअप रिस्टोर गर्नुहोस्',
    savedNotice: 'डेटा सुरक्षित (Saved Locally)'
  },
  en: {
    appName: 'Himalayan Breeze',
    tagline: 'Cafe, Restaurant & Resort Management',
    posBilling: 'Billing (POS)',
    tablesRooms: 'Tables & Rooms',
    inventory: 'Inventory Tracking',
    customersKhata: 'Customers & Khata (CRM)',
    reports: 'Sales & Analytics',
    settings: 'Settings & Backup',
    
    // POS
    searchMenu: 'Search menu items...',
    allCategories: 'All Categories',
    cafeBeverages: 'Cafe Beverages',
    bakerySnacks: 'Bakery & Snacks',
    diningFood: 'Food & Meals',
    resortRooms: 'Resort Stays & Rooms',
    barSpirits: 'Bar & Spirits',
    desserts: 'Desserts',
    
    currentOrder: 'Current Order',
    tableRoom: 'Table / Room',
    changeTable: 'Change',
    orderType: 'Order Type',
    dineIn: 'Dine-in',
    roomStay: 'Room Service',
    takeaway: 'Takeaway',
    
    emptyCart: 'No items in order',
    selectItems: 'Tap items from the left menu to add',
    subtotal: 'Subtotal',
    discount: 'Discount',
    serviceCharge: 'Service Charge (SC)',
    vat: 'VAT (13%)',
    grandTotal: 'Grand Total',
    
    saveKOT: 'Send KOT to Kitchen',
    printKOT: 'Print KOT',
    settleBill: 'Settle Bill (Checkout)',
    clearCart: 'Clear Order',
    
    paymentMethod: 'Payment Method',
    cash: 'Cash',
    fonepay: 'Fonepay / QR Scan',
    card: 'Card',
    khataCredit: 'Credit / Khata',
    splitPayment: 'Split Payment',
    
    paidSuccessfully: 'Bill Settled Successfully!',
    printBill: 'Print Receipt',
    close: 'Close',
    
    // Tables & Rooms
    available: 'Available',
    occupied: 'Occupied',
    reserved: 'Reserved',
    cleaning: 'Cleaning',
    checkIn: 'Check In',
    checkOut: 'Check Out',
    newBooking: 'New Guest Registration',
    roomRate: 'Rate Per Night',
    capacity: 'Capacity',
    
    // Inventory
    addItem: 'Add Inventory Item',
    lowStockAlert: 'Low Stock Alert',
    stockIn: 'Stock In (Purchase)',
    stockOut: 'Usage / Spoilage',
    stockName: 'Item Name',
    currentQty: 'Current Stock',
    reorderLevel: 'Alert Level',
    unitCost: 'Cost / Unit',
    totalValuation: 'Total Stock Value',
    allGood: 'All stock levels are healthy',
    
    // Customers & Khata
    customerDirectory: 'Customer Directory',
    totalUdharo: 'Total Credit (Khata) Due',
    addCustomer: 'Add New Customer',
    collectPayment: 'Receive Payment',
    giveCredit: 'Add To Khata',
    khataLedger: 'Account Ledger',
    loyaltyPoints: 'Loyalty Points',
    phone: 'Phone',
    address: 'Address',
    
    // Reports
    todaySales: "Today's Sales",
    totalOrders: 'Total Invoices',
    avgOrderValue: 'Avg. Ticket Size',
    topSelling: 'Top Selling Items',
    paymentBreakdown: 'Payment Methods Breakdown',
    exportCSV: 'Export to CSV',
    exportBackup: 'Save Complete Backup (JSON)',
    importBackup: 'Restore Backup',
    savedNotice: 'All Changes Saved Locally'
  }
};
