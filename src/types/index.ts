export type ItemCategory = 
  | 'coffee'
  | 'tea'
  | 'cold_drinks'
  | 'mocktails'
  | 'snacks'
  | 'fast_food'
  | 'nepali_food'
  | 'continental'
  | 'bakery'
  | 'dessert'
  | 'cafe_beverages' 
  | 'bakery_snacks' 
  | 'dining_food' 
  | 'resort_rooms' 
  | 'bar_spirits' 
  | 'desserts';

export type KitchenStation = 'main_kitchen' | 'coffee_bar' | 'bakery' | 'dessert';

export interface ItemVariant {
  name: string;
  price: number;
}

export interface ItemAddOn {
  name: string;
  price: number;
}

export interface InventoryDeduction {
  inventoryItemId: string;
  amount: number;
  unit: string;
}

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  nepaliName: string;
  category: ItemCategory;
  price: number;
  costPrice: number;
  isAvailable: boolean;
  preparationTimeMinutes?: number;
  inventoryRecipe?: InventoryDeduction[];
  description?: string;
  imageUrl?: string;
  station?: KitchenStation;
  variants?: ItemVariant[];
  addOns?: ItemAddOn[];
  isOffer?: boolean;
  offerPrice?: number;
  discountPercent?: number;
  offerLabel?: string;
}

export type TableRoomType = 'table' | 'cottage' | 'room' | 'takeaway';
export type TableRoomStatus = 
  | 'available' 
  | 'occupied' 
  | 'reserved' 
  | 'waiting_for_bill' 
  | 'cleaning' 
  | 'out_of_service';

export interface TableRoom {
  id: string;
  code: string;
  name: string;
  nepaliName: string;
  type: TableRoomType;
  area?: string;
  capacity: number;
  status: TableRoomStatus;
  ratePerNight?: number;
  currentOrderId?: string;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  mergedTableIds?: string[];
  guestName?: string;
  guestPhone?: string;
  checkInTime?: string;
  notes?: string;
  version?: number;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  code: string;
  name: string;
  nepaliName: string;
  price: number;
  originalPrice?: number;
  isOffer?: boolean;
  offerLabel?: string;
  quantity: number;
  category: ItemCategory;
  station?: KitchenStation;
  selectedVariant?: ItemVariant;
  selectedAddOns?: ItemAddOn[];
  notes?: string;
  kotStatus?: 'pending' | 'new' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'sent_to_kitchen' | 'expired';
  addedAt?: string;
}

export type PaymentMethod = 
  | 'cash' 
  | 'esewa' 
  | 'khalti' 
  | 'card' 
  | 'bank' 
  | 'qr' 
  | 'fonepay_qr' 
  | 'credit_khata' 
  | 'charge_to_room'
  | 'split';

export type OrderStatus = 'active' | 'completed' | 'cancelled';

export interface PaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  dateTime: string;
  staffId: string;
  staffName: string;
  status: 'completed' | 'partial' | 'due';
  referenceNo?: string;
  cashTendered?: number;
  changeReturned?: number;
  notes?: string;
}

export interface DeliveryDetails {
  customerName: string;
  phone: string;
  address: string;
  deliveryNotes?: string;
  driverName?: string;
}

export interface Order {
  id: string;
  businessId?: string;
  invoiceNo: string;
  invoiceNumber?: string;
  kotNo: string;
  tableRoomId: string;
  tableRoomName: string;
  tableRoomType: TableRoomType;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'room_service' | 'room_stay';
  items: OrderItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  serviceChargeAmount: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  paymentDetails?: {
    cash?: number;
    esewa?: number;
    khalti?: number;
    fonepay?: number;
    card?: number;
    bank?: number;
    qr?: number;
    credit?: number;
    charge_to_room?: number;
  };
  cashTendered?: number;
  changeReturned?: number;
  paymentReference?: string;
  guestCount?: number;
  parentSplitOrderId?: string;
  cashierName?: string;
  roomChargeDetails?: {
    resortRoomId: string;
    roomNumber: string;
    guestName: string;
    reservationId: string;
  };
  paymentRecords?: PaymentRecord[];
  paymentStatus: 'paid' | 'pending' | 'credit' | 'partial';
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryDetails?: DeliveryDetails;
  waiterId?: string;
  waiterName?: string;
  createdAt: string;
  settledAt?: string;
  status: OrderStatus;
  kotStatus?: 'pending' | 'new' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled' | 'sent_to_kitchen' | 'expired';
  kotPriority?: 'normal' | 'urgent' | 'vip';
  kotSentAt?: string;
  kotAcceptedAt?: string;
  kotPreparingAt?: string;
  kotReadyAt?: string;
  kotServedAt?: string;
  specialInstructions?: string;
  lifecycleStatus?: 'DRAFT' | 'CONFIRMED' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'SERVED' | 'BILLED' | 'PAID' | 'COMPLETED' | 'CANCELLED' | 'VOIDED' | 'EXPIRED';
  inventoryDeducted?: boolean;
  isHeld?: boolean;
  heldAt?: string;
  heldNote?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  waivedServiceCharge?: boolean;
  waivedVat?: boolean;
  customAdminDiscount?: number;
  customAdminDiscountReason?: string;
  syncStatus?: 'local_draft' | 'pending_sync' | 'server_confirmed' | 'sync_failed';
  idempotencyKey?: string;
  version?: number;
  updatedAt?: string;
  deviceId?: string;
  // IRD Nepal Fiscal & CBMS Compliance fields
  fiscalYear?: string;
  bsDate?: string;
  buyerPan?: string;
  taxInvoicePrinted?: boolean;
  printCount?: number;
  creditNoteNo?: string;
  cbmsSynced?: boolean;
  cbmsSyncTime?: string;
}

export type ExpenseCategory = 
  | 'groceries' 
  | 'dairy' 
  | 'gas_fuel' 
  | 'maintenance' 
  | 'staff_advance' 
  | 'utilities' 
  | 'rent'
  | 'salary'
  | 'transport'
  | 'cleaning'
  | 'marketing'
  | 'supplies'
  | 'other';

export type ExpenseApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID' | 'REJECTED';

export interface Expense {
  id: string;
  businessId?: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  paymentMode: 'cash' | 'fonepay_qr' | 'bank_transfer';
  date: string;
  notes?: string;
  billNumber?: string;
  approvalStatus?: ExpenseApprovalStatus;
  submittedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  receiptUrl?: string;
}

export interface DayClosingRecord {
  id: string;
  date: string;
  openingCash: number;
  totalCashSales: number;
  totalDigitalSales: number;
  totalCreditSales: number;
  totalExpenses: number;
  expectedCashInDrawer: number;
  actualCashInDrawer: number;
  discrepancy: number;
  closedAt: string;
  notes?: string;
}

export type InventoryCategory = 
  | 'coffee_tea' 
  | 'dairy' 
  | 'groceries' 
  | 'meat_poultry' 
  | 'vegetables' 
  | 'beverages_bar' 
  | 'resort_supplies' 
  | 'packaging';

export type InventoryUnit = 'kg' | 'g' | 'ltr' | 'ml' | 'pcs' | 'bottle' | 'box' | 'pkt' | 'dozen';

export interface InventoryItem {
  id: string;
  businessId?: string;
  code: string;
  name: string;
  nepaliName: string;
  category: InventoryCategory;
  currentStock: number;
  unit: InventoryUnit;
  minStockAlert: number;
  maxStock?: number;
  reorderLevel?: number;
  costPerUnit: number;
  averageCost?: number;
  supplierId?: string;
  supplierName?: string;
  supplierPhone?: string;
  expiryDate?: string;
  batchNumber?: string;
  storageLocation?: string;
  isActive?: boolean;
  notes?: string;
  lastUpdated: string;
  version?: number;
  updatedAt?: string;
}

export type InventoryLogType = 
  | 'restock_in' 
  | 'pos_sale_deduction' 
  | 'wastage_spoilage' 
  | 'manual_adjustment'
  | 'purchase_receive'
  | 'purchase_return'
  | 'stock_transfer';

export interface InventoryLog {
  id: string;
  businessId?: string;
  inventoryItemId: string;
  itemName: string;
  logType: InventoryLogType;
  quantityChanged: number;
  unit: string;
  stockBefore: number;
  stockAfter: number;
  date: string;
  notes?: string;
}

export type StockMovementType = 
  | 'STOCK_IN' 
  | 'STOCK_OUT' 
  | 'SALE_CONSUMPTION' 
  | 'PURCHASE' 
  | 'ADJUSTMENT' 
  | 'WASTAGE' 
  | 'DAMAGE' 
  | 'RETURN' 
  | 'TRANSFER';

export interface StockMovement {
  id: string;
  businessId: string;
  inventoryItemId: string;
  itemName: string;
  movementType: StockMovementType;
  quantity: number;
  unit: InventoryUnit;
  previousStock: number;
  newStock: number;
  costPerUnit: number;
  totalCost: number;
  reason: string;
  fromLocation?: string;
  toLocation?: string;
  batchNumber?: string;
  referenceTransactionId?: string;
  userId: string;
  userName: string;
  dateTime: string;
  notes?: string;
}

export interface RecipeIngredient {
  inventoryItemId: string;
  itemName: string;
  quantity: number;
  unit: InventoryUnit;
  costPerUnit?: number;
  totalCost?: number;
}

export interface ProductRecipe {
  id: string;
  businessId: string;
  menuItemId: string;
  menuItemName: string;
  ingredients: RecipeIngredient[];
  preparationInstructions?: string;
  estimatedIngredientCost: number;
  sellingPrice: number;
  grossMargin: number;
  marginPercent: number;
  isActive: boolean;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  panVatNumber?: string;
  paymentTerms: 'Cash on Delivery' | 'Net 7' | 'Net 15' | 'Net 30' | 'Advance';
  bankDetails?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  inventoryItemId: string;
  itemName: string;
  unit: InventoryUnit;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  taxPercent: number;
  discountAmount: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  businessId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paidAmount: number;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  createdByName: string;
  notes?: string;
}

export type PayableStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface SupplierPayable {
  id: string;
  businessId: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  billNumber?: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: PayableStatus;
  notes?: string;
}

export interface SupplierPaymentRecord {
  id: string;
  businessId: string;
  payableId: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod: 'cash' | 'bank' | 'card' | 'fonepay_qr' | 'esewa' | 'khalti' | 'cheque';
  referenceNo?: string;
  paymentDate: string;
  paidByName: string;
  notes?: string;
}

export type ReceivableStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface CustomerReceivable {
  id: string;
  businessId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  sourceType: 'POS_CREDIT_KHATA' | 'RESORT_FOLIO_DUE' | 'CORPORATE_BILL';
  referenceId: string;
  originalAmount: number;
  paidAmount: number;
  balanceDue: number;
  dueDate: string;
  createdAt: string;
  status: ReceivableStatus;
  notes?: string;
}

export interface CashRegisterSession {
  id: string;
  businessId: string;
  openedAt: string;
  closedAt?: string;
  openedByName: string;
  closedByName?: string;
  openingCash: number;
  cashSales: number;
  cashExpenses: number;
  cashRefunds: number;
  cashDeposits: number;
  cashWithdrawals: number;
  expectedClosingCash: number;
  actualClosingCash?: number;
  cashVariance?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  nepaliName?: string;
  phone: string;
  email?: string;
  address?: string;
  customerType: 'regular' | 'vip' | 'resort_guest' | 'corporate';
  creditBalance: number; // Positive means customer owes money (Udharo/Khata)
  loyaltyPoints: number;
  totalSpend: number;
  totalVisits: number;
  createdAt: string;
  lastVisit?: string;
  notes?: string;
}

export interface KhataTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: 'credit_taken' | 'payment_received';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string;
  invoiceNo?: string;
  paymentMode?: 'cash' | 'fonepay_qr' | 'bank_transfer';
  date: string;
  notes?: string;
}

export type BusinessType = 
  | 'CAFE' 
  | 'RESTAURANT' 
  | 'RESORT' 
  | 'HOTEL' 
  | 'CAFE_RESTAURANT' 
  | 'RESTAURANT_RESORT' 
  | 'CAFE_RESTAURANT_RESORT' 
  | 'OTHER';

export type BusinessStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export type AppModule = 
  | 'dashboard'
  | 'pos' 
  | 'billing'
  | 'tables_rooms' 
  | 'resort' 
  | 'kds' 
  | 'inventory' 
  | 'customers' 
  | 'day_closing' 
  | 'reports' 
  | 'settings'
  | 'business_admin';

export interface BusinessTenant {
  businessId: string;
  businessName: string;
  nepaliBusinessName?: string;
  tagline?: string;
  businessType: BusinessType;
  ownerId: string;
  ownerName: string;
  logo?: string;
  phone: string;
  email: string;
  address: string;
  panVatNumber?: string;
  status: BusinessStatus;
  enabledModules: AppModule[];
  currencySymbol: string;
  environment?: 'production' | 'demo';
  templateType?: 'starter' | 'clean_slate';
  subscriptionPlanId?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionExpiresAt?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type BillingInterval = 'monthly' | 'yearly' | 'quarterly' | 'MONTHLY' | 'YEARLY' | 'QUARTERLY';
export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED' | 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type SubscriptionInvoiceStatus = 'PAID' | 'PENDING' | 'REJECTED' | 'OVERDUE' | 'VOID' | 'paid' | 'pending' | 'overdue' | 'void';

export interface SubscriptionPlan {
  id: string;
  name: string;
  nepaliName: string;
  description: string;
  billingInterval: BillingInterval;
  price: number;
  currency: string;
  includedModules: AppModule[];
  staffLimit: number;
  maxProducts: number;
  maxRooms?: number;
  trialDays: number;
  isTrialAvailable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscription {
  id: string;
  businessId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextRenewalDate?: string;
  trialEndsAt?: string;
  trialEndDate?: string;
  cancelledAt?: string;
  cancelReason?: string;
  cancellationDate?: string;
  suspensionReason?: string;
  suspendedBy?: string;
  suspendedAt?: string;
  autoRenew: boolean;
  paymentMethod?: string;
  lastPaymentDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt: string;
}

export interface SubscriptionInvoice {
  id: string;
  invoiceNumber?: string;
  businessId: string;
  businessName?: string;
  planId: string;
  planName?: string;
  amount: number;
  taxAmount?: number;
  totalAmount: number;
  currency: string;
  status: SubscriptionInvoiceStatus;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentNotes?: string;
  verifiedByStaffId?: string;
  verifiedByStaffName?: string;
  verifiedAt?: string;
  billingPeriod?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  notes?: string;
  issuedAt?: string;
  createdAt?: string;
}

export interface UserBusinessMembership {
  id: string;
  userId: string;
  businessId: string;
  role: StaffRole;
  status: 'ACTIVE' | 'SUSPENDED';
  permissions?: string[];
  createdAt: string;
}

export type StaffRole = 
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN' 
  | 'MANAGER' 
  | 'CASHIER' 
  | 'WAITER' 
  | 'KITCHEN' 
  | 'RECEPTIONIST' 
  | 'HOUSEKEEPING' 
  | 'ACCOUNTANT'
  | 'INVENTORY_STAFF'
  | 'STAFF';

export interface StaffUser {
  id: string;
  username: string;
  name: string;
  nepaliName?: string;
  role: StaffRole;
  pinHash: string; // SHA-256 salted hash, never plain text
  salt: string;
  isActive: boolean;
  businessId?: string; // Tenant association
  email?: string;
  phone?: string;
  permissions?: string[]; // Granular permission overrides
  createdAt: string;
  lastLogin?: string;
  mustChangePin?: boolean;
  lastPinChangedAt?: string;
  linkedFirebaseUid?: string;
}

export interface StaffInvitation {
  id: string;
  businessId: string;
  businessName: string;
  emailOrPhone: string;
  role: StaffRole;
  permissions?: string[];
  invitedByName: string;
  invitedByStaffId: string;
  createdAt: string;
  expiresAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED';
  inviteCode: string;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: 'cash' | 'card' | 'bank_transfer' | 'fonepay_qr' | 'esewa' | 'khalti' | 'charge_to_room' | 'custom';
  accountDetails?: string; // e.g. "Nabil Bank A/C: 01928374928" or "Merchant Code: 99182"
  instructions?: string;
  qrImageDataUrl?: string; // Compact base64 raster QR photo for customer Scan-to-Pay in checkout
}

export interface ReceiptSettings {
  receiptTitle?: string;
  headerSubtitle?: string;
  showLogo: boolean;
  showPanVat: boolean;
  showCustomerDetails: boolean;
  showTaxBreakdown: boolean;
  showQrCode: boolean;
  invoicePrefix: string;
  kotPrefix?: string;
  footerMessage: string;
  printWidth: '58mm' | '80mm' | 'A4';
}

export interface Session {
  token: string;
  staffId: string;
  username: string;
  name: string;
  role: StaffRole;
  businessId?: string; // Current active tenant
  expiresAt: number; // epoch ms
}

export interface AuditLogEntry {
  id: string;
  businessId?: string;
  staffId: string;
  staffName: string;
  role: StaffRole;
  action: string;
  targetRecordId?: string;
  details: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface NotificationSettings {
  enableSoundAlerts: boolean;
  enableOrderChime: boolean;
  enableLowStockAlert: boolean;
  lowStockThresholdEmail?: string;
  enableDailyCloseAlert: boolean;
  dailyCloseReportEmail?: string;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  requirePinForDiscounts: boolean;
  requirePinForVoidOrder: boolean;
  requirePinForDayClose: boolean;
  strictTenantDataIsolation: boolean;
  allowSuperAdminAuditInspect: boolean;
  ownerControlLocked?: boolean;
  masterOwnerEmail?: string;
}

export interface PrinterSettings {
  connectionType: 'browser' | 'web_serial' | 'web_usb' | 'network_bridge';
  paperWidth: '58mm' | '80mm';
  baudRate?: number;
  bridgeUrl?: string;
  autoPrintReceipt?: boolean;
  autoPrintKot?: boolean;
  autoOpenCashDrawerOnCash?: boolean;
  drawerKickPin?: 0 | 1;
  printerLabel?: string;
}

export interface IrdComplianceSettings {
  fiscalYearLabel?: string;
  cbmsEnabled?: boolean;
  cbmsEndpoint?: string;
  cbmsUsername?: string;
  strictTaxInvoiceLock?: boolean;
}

export interface BusinessSettings {
  businessId?: string;
  businessName: string;
  tagline: string;
  nepaliBusinessName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  email: string;
  panVatNumber: string;
  currencySymbol: string;
  enableVat: boolean;
  vatRatePercent: number;
  enableServiceCharge: boolean;
  serviceChargePercent: number;
  receiptFooterMessage: string;
  enableSoundEffects: boolean;
  defaultLanguage: 'en' | 'ne';
  fonepayMerchantName: string;
  sessionTimeoutMinutes: number;
  paymentMethodsConfig?: PaymentMethodConfig[];
  receiptSettings?: ReceiptSettings;
  customRolePermissions?: Record<string, string[]>;
  notificationSettings?: NotificationSettings;
  securitySettings?: SecuritySettings;
  printerSettings?: PrinterSettings;
  irdSettings?: IrdComplianceSettings;
  tableAreas?: string[];
  quickCashNotes?: number[];
  androidApkUrl?: string;
}

export interface RoomType {
  id: string;
  name: string;
  nepaliName?: string;
  description: string;
  imageUrl?: string;
  basePrice: number;
  extraGuestPrice?: number;
  numberOfBeds?: number;
  maxAdults: number;
  maxChildren: number;
  totalCapacity: number;
  amenities: string[];
  isActive: boolean;
}

export type ResortRoomStatus = 
  | 'AVAILABLE' 
  | 'RESERVED' 
  | 'OCCUPIED' 
  | 'DIRTY' 
  | 'CLEANING' 
  | 'CLEAN' 
  | 'MAINTENANCE' 
  | 'OUT_OF_SERVICE';

export interface ResortRoom {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor: string;
  capacity: number;
  pricePerNight: number;
  amenities: string[];
  imageUrl?: string;
  description?: string;
  notes?: string;
  status: ResortRoomStatus;
  currentGuestName?: string;
  currentGuestPhone?: string;
  currentReservationId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  lastCleanedTime?: string;
  assignedHousekeeper?: string;
  version?: number;
  updatedAt?: string;
}

export interface GuestProfile {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  idType: 'Citizenship' | 'Passport' | 'Driving License' | 'National ID' | 'Other';
  idNumber: string;
  notes?: string;
  totalStays: number;
  createdAt: string;
}

export type ReservationStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'CHECKED_IN' 
  | 'CHECKED_OUT' 
  | 'CANCELLED' 
  | 'NO_SHOW';

export interface Reservation {
  id: string;
  businessId?: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  nightsCount: number;
  roomRate: number;
  discountAmount: number;
  taxAmount: number;
  extraCharges: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: PaymentMethod;
  bookingSource: 'Direct Walk-in' | 'Website' | 'Phone / WhatsApp' | 'Booking.com' | 'Expedia' | 'Agoda' | 'Corporate';
  notes?: string;
  status: ReservationStatus;
  actualCheckInTime?: string;
  actualCheckOutTime?: string;
  checkedInByStaff?: string;
  checkedOutByStaff?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledByStaff?: string;
  createdByStaff?: string;
  createdAt: string;
  version?: number;
  updatedAt?: string;
}

export type FolioCategory = 
  | 'ROOM' 
  | 'RESTAURANT' 
  | 'CAFE' 
  | 'LAUNDRY' 
  | 'TRANSPORT' 
  | 'SPA' 
  | 'BREAKFAST' 
  | 'OTHER_SERVICE';

export interface GuestFolioItem {
  id: string;
  reservationId: string;
  roomId: string;
  roomNumber: string;
  dateTime: string;
  description: string;
  category: FolioCategory;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  addedByStaff: string;
  referenceId?: string;
}

export interface ResortService {
  id: string;
  name: string;
  category: FolioCategory;
  description: string;
  price: number;
  taxPercent: number;
  isAvailable: boolean;
  isActive: boolean;
}

export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomNumber: string;
  taskType: 'clean_room' | 'change_linen' | 'bathroom_cleaning' | 'restock_amenities' | 'inspect_room' | 'maintenance_request';
  assignedStaffId?: string;
  assignedStaffName?: string;
  priority: 'low' | 'normal' | 'urgent';
  createdTime: string;
  completedTime: string | null;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'inspected';
}

export interface MaintenanceIssue {
  id: string;
  roomId: string;
  roomNumber: string;
  issueType: 'AC problem' | 'Water problem' | 'Electrical problem' | 'Furniture problem' | 'Plumbing problem' | 'Other';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reportedBy: string;
  reportedDate: string;
  status: 'reported' | 'in_progress' | 'resolved' | 'closed';
  resolution?: string;
  completedBy?: string;
  completedDate?: string;
}

export interface HotelPaymentRecord {
  id: string;
  reservationId: string;
  guestName: string;
  roomNumber: string;
  amount: number;
  method: PaymentMethod;
  dateTime: string;
  staffName: string;
  status: 'completed' | 'refunded';
  reference?: string;
  notes?: string;
}

export type NightAuditStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface NightAuditRecord {
  id: string;
  businessId: string;
  businessDate: string; // YYYY-MM-DD
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  status: NightAuditStatus;
  totalRoomsOccupied: number;
  totalRoomsSellable: number;
  occupancyPercent: number;
  totalRoomChargesPosted: number;
  postedCount: number;
  postedFolioItemIds: string[];
  warnings: string[];
  errors: string[];
  transactionSummary: {
    roomRevenue: number;
    fbRevenue: number;
    serviceRevenue: number;
    paymentsCollected: number;
    unpaidFolioCount: number;
    unpaidBalanceTotal: number;
    noShowCount: number;
  };
  notes?: string;
}

export interface AppState {
  businessId?: string;
  menuItems: MenuItem[];
  tablesRooms: TableRoom[];
  orders: Order[];
  inventoryItems: InventoryItem[];
  inventoryLogs: InventoryLog[];
  customers: Customer[];
  khataTransactions: KhataTransaction[];
  expenses: Expense[];
  dayClosings: DayClosingRecord[];
  staffUsers: StaffUser[];
  auditLogs: AuditLogEntry[];
  settings: BusinessSettings;
  activeOrderId?: string;
  // Resort & Hotel State
  roomTypes: RoomType[];
  resortRooms: ResortRoom[];
  guestProfiles: GuestProfile[];
  reservations: Reservation[];
  guestFolioItems: GuestFolioItem[];
  resortServices: ResortService[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceIssues: MaintenanceIssue[];
  hotelPayments: HotelPaymentRecord[];
  nightAudits?: NightAuditRecord[];
  staffInvitations?: StaffInvitation[];
  // Phase 6: Inventory & Finance State
  stockMovements?: StockMovement[];
  recipes?: ProductRecipe[];
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  supplierPayables?: SupplierPayable[];
  supplierPayments?: SupplierPaymentRecord[];
  receivables?: CustomerReceivable[];
  cashRegisters?: CashRegisterSession[];
  // Phase 7: General Ledger & Reconciliation
  accounts?: ChartAccount[];
  journalEntries?: JournalEntry[];
  creditNotes?: CreditNoteRecord[];
  paymentReconciliations?: PaymentReconciliationRecord[];
  financialPeriods?: FinancialPeriod[];
}

export interface CreditNoteRecord {
  id: string;
  businessId: string;
  creditNoteNo: string;
  originalOrderId: string;
  originalInvoiceNo: string;
  fiscalYear: string;
  bsDate: string;
  adDate: string;
  reason: string;
  subtotal: number;
  discountAmount: number;
  serviceChargeAmount: number;
  vatAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod | string;
  buyerName?: string;
  buyerPan?: string;
  issuedByName: string;
  items: OrderItem[];
  cbmsSynced?: boolean;
  createdAt: string;
}

export interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  businessId: string;
  entryNumber: string;
  date: string;
  bsDate?: string;
  referenceType:
    | 'POS_SALE'
    | 'CREDIT_NOTE'
    | 'EXPENSE'
    | 'KHATA_COLLECTION'
    | 'HOTEL_PAYMENT'
    | 'HOTEL_CHECKOUT'
    | 'SUPPLIER_PAYMENT'
    | 'OPENING_BALANCE'
    | 'MANUAL_ADJUSTMENT';
  referenceId: string;
  referenceNo?: string;
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  createdByName: string;
  createdAt: string;
}

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  nepaliName?: string;
  category: AccountCategory;
  subcategory?: string;
  description?: string;
  balance: number;
  isSystem: boolean;
  businessId?: string;
}

export type FinancialPeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

export interface FinancialPeriod {
  id: string;
  businessId: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: FinancialPeriodStatus;
  closedByName?: string;
  closedAt?: string;
}

export interface PaymentReconciliationRecord {
  id: string;
  businessId: string;
  date: string;
  paymentMethod: PaymentMethod | string;
  expectedAmount: number;
  recordedAmount: number;
  actualAmount: number;
  discrepancy: number;
  status: 'RECONCILED' | 'PENDING' | 'DISCREPANCY';
  reconciledByName: string;
  reconciledAt: string;
  notes?: string;
}

