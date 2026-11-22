import { 
  FolioCategory, 
  GuestFolioItem, 
  HotelPaymentRecord, 
  Reservation, 
  ReservationStatus, 
  ResortRoom, 
  StaffRole,
  NightAuditRecord,
  GuestProfile,
  Order,
  PaymentMethod
} from '../types';

/**
 * Mathematical Room Availability Check (Anti-Double-Booking Guard)
 * Strict condition: (newCheckIn < existingCheckOut) && (newCheckOut > existingCheckIn)
 */
export function validateRoomAvailability(
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  existingReservations: Reservation[],
  rooms: ResortRoom[],
  excludeReservationId?: string
): { isAvailable: boolean; conflictReservation?: Reservation; error?: string } {
  if (!checkInDate || !checkOutDate) {
    return { isAvailable: false, error: 'Check-in and check-out dates are mandatory.' };
  }

  if (checkInDate >= checkOutDate) {
    return { isAvailable: false, error: 'Check-out date must be strictly after check-in date.' };
  }

  const room = rooms.find(r => r.id === roomId);
  if (!room) {
    return { isAvailable: false, error: 'Selected room not found.' };
  }

  if (room.status === 'OUT_OF_SERVICE') {
    return { isAvailable: false, error: `Room ${room.roomNumber} is currently OUT OF SERVICE and unavailable for booking.` };
  }

  // Check overlap against all active bookings
  const conflicting = existingReservations.find(res => {
    if (res.roomId !== roomId) return false;
    if (excludeReservationId && res.id === excludeReservationId) return false;
    if (res.status === 'CANCELLED' || res.status === 'CHECKED_OUT' || res.status === 'NO_SHOW') return false;

    // Overlap formula:
    // (existingStart < requestedEnd) && (existingEnd > requestedStart)
    const existingStart = res.checkInDate;
    const existingEnd = res.checkOutDate;
    const hasOverlap = (existingStart < checkOutDate) && (existingEnd > checkInDate);
    return hasOverlap;
  });

  if (conflicting) {
    return {
      isAvailable: false,
      conflictReservation: conflicting,
      error: `Room ${room.roomNumber} is already booked by ${conflicting.guestName} for overlapping dates (${conflicting.checkInDate} to ${conflicting.checkOutDate}). Double booking is rejected.`
    };
  }

  return { isAvailable: true };
}

/**
 * Validates Reservation Lifecycle Status Transitions
 */
const VALID_RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['CHECKED_OUT', 'CANCELLED'],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: []
};

export function isValidReservationTransition(
  currentState: ReservationStatus,
  targetState: ReservationStatus,
  userRole?: StaffRole
): { isValid: boolean; error?: string } {
  if (currentState === targetState) return { isValid: true };

  // Super Admin and Owner can force changes in edge cases
  if ((userRole === 'SUPER_ADMIN' || userRole === 'OWNER') && (targetState === 'CANCELLED' || targetState === 'NO_SHOW')) {
    return { isValid: true };
  }

  if (currentState === 'CHECKED_OUT' || currentState === 'CANCELLED' || currentState === 'NO_SHOW') {
    return {
      isValid: false,
      error: `Cannot transition reservation from terminal status [${currentState}] to [${targetState}].`
    };
  }

  const allowed = VALID_RESERVATION_TRANSITIONS[currentState] || [];
  if (!allowed.includes(targetState)) {
    return {
      isValid: false,
      error: `Invalid reservation status transition from ${currentState} to ${targetState}. Allowed next steps: ${allowed.join(', ') || 'None'}.`
    };
  }

  return { isValid: true };
}

/**
 * Validates Room Reassignment
 */
export function validateRoomReassignment(
  currentReservation: Reservation,
  newRoomId: string,
  rooms: ResortRoom[],
  existingReservations: Reservation[]
): { isValid: boolean; targetRoom?: ResortRoom; error?: string } {
  if (currentReservation.roomId === newRoomId) {
    return { isValid: false, error: 'Target room is the same as the current room.' };
  }

  const targetRoom = rooms.find(r => r.id === newRoomId);
  if (!targetRoom) {
    return { isValid: false, error: 'Target room does not exist.' };
  }

  if (targetRoom.status === 'OCCUPIED') {
    return { isValid: false, error: `Target Room ${targetRoom.roomNumber} is currently occupied by another guest.` };
  }

  if (targetRoom.status === 'OUT_OF_SERVICE' || targetRoom.status === 'MAINTENANCE') {
    return { isValid: false, error: `Target Room ${targetRoom.roomNumber} is under maintenance / out of service.` };
  }

  // Check remaining dates availability
  const checkIn = currentReservation.actualCheckInTime?.split(' ')[0] || currentReservation.checkInDate;
  const checkOut = currentReservation.checkOutDate;

  const availability = validateRoomAvailability(
    newRoomId,
    checkIn,
    checkOut,
    existingReservations,
    rooms,
    currentReservation.id
  );

  if (!availability.isAvailable) {
    return { isValid: false, error: availability.error };
  }

  return { isValid: true, targetRoom };
}

/**
 * Calculates Guest Folio Financial Breakdown
 */
export interface FolioSummary {
  roomCharges: number;
  foodBeverageCharges: number;
  serviceCharges: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  totalPaid: number;
  depositAmount: number;
  balanceDue: number;
  isFullyPaid: boolean;
}

export function calculateGuestFolioSummary(
  folioItems: GuestFolioItem[],
  payments: HotelPaymentRecord[],
  reservationDeposit: number = 0,
  reservationDiscount: number = 0,
  vatRatePercent: number = 13,
  enableVat: boolean = true
): FolioSummary {
  let roomCharges = 0;
  let foodBeverageCharges = 0;
  let serviceCharges = 0;

  for (const item of folioItems) {
    if (item.category === 'ROOM') {
      roomCharges += item.totalPrice;
    } else if (item.category === 'RESTAURANT' || item.category === 'CAFE' || item.category === 'BREAKFAST') {
      foodBeverageCharges += item.totalPrice;
    } else {
      serviceCharges += item.totalPrice;
    }
  }

  const subtotal = Math.round((roomCharges + foodBeverageCharges + serviceCharges) * 100) / 100;
  const discountAmount = Math.min(subtotal, Math.max(0, reservationDiscount));
  const taxableAmount = Math.max(0, subtotal - discountAmount);

  const vatAmount = enableVat
    ? Math.round(((taxableAmount * Math.max(0, vatRatePercent)) / 100) * 100) / 100
    : 0;

  const grandTotal = Math.round((taxableAmount + vatAmount) * 100) / 100;

  // Payments & deposits
  const directPayments = payments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + p.amount, 0);

  const totalPaid = Math.round((directPayments + Math.max(0, reservationDeposit)) * 100) / 100;
  const balanceDue = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100);

  return {
    roomCharges,
    foodBeverageCharges,
    serviceCharges,
    subtotal,
    discountAmount,
    taxableAmount,
    vatAmount,
    grandTotal,
    totalPaid,
    depositAmount: reservationDeposit,
    balanceDue,
    isFullyPaid: balanceDue <= 0.01
  };
}

/**
 * Tenant Isolation Verification Helper
 */
export function verifyResortTenantIsolation(
  recordBusinessId: string | undefined,
  activeBusinessId: string
): { isAuthorized: boolean; error?: string } {
  if (!recordBusinessId) {
    // Legacy fallback allowed within active
    return { isAuthorized: true };
  }
  if (recordBusinessId !== activeBusinessId) {
    return {
      isAuthorized: false,
      error: `Security Alert: Access denied. Target record belongs to business [${recordBusinessId}], but current session is in [${activeBusinessId}].`
    };
  }
  return { isAuthorized: true };
}

/**
 * Phase 5: Validates and prepares Night Audit run (Idempotent Room Charge Posting)
 */
export interface NightAuditPreparation {
  canProceed: boolean;
  businessDate: string;
  totalOccupied: number;
  totalSellable: number;
  occupancyPercent: number;
  chargesToPost: Array<{
    reservationId: string;
    roomId: string;
    roomNumber: string;
    guestName: string;
    rate: number;
    description: string;
  }>;
  alreadyChargedCount: number;
  unpaidFoliosCount: number;
  totalUnpaidBalance: number;
  warnings: string[];
  errors: string[];
}

export function prepareNightAudit(
  businessDate: string,
  businessId: string,
  rooms: ResortRoom[],
  reservations: Reservation[],
  folioItems: GuestFolioItem[],
  payments: HotelPaymentRecord[],
  pastNightAudits: NightAuditRecord[] = []
): NightAuditPreparation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if audit already completed for this date
  const completedAudit = pastNightAudits.find(
    a => a.businessDate === businessDate && a.status === 'COMPLETED'
  );
  if (completedAudit) {
    warnings.push(`Night Audit for business date [${businessDate}] was already COMPLETED on ${completedAudit.completedAt || completedAudit.startedAt}. Idempotent guard is active: existing room charges will not be duplicated.`);
  }

  // Active sellable rooms (exclude OUT_OF_SERVICE and MAINTENANCE)
  const sellableRooms = rooms.filter(
    r => r.status !== 'OUT_OF_SERVICE' && r.status !== 'MAINTENANCE'
  );
  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED');
  const checkedInReservations = reservations.filter(r => r.status === 'CHECKED_IN');

  const occupancyPercent = sellableRooms.length > 0
    ? Math.round(((occupiedRooms.length / sellableRooms.length) * 100) * 10) / 10
    : 0;

  // Identify already posted room charges for this business date
  const chargesToPost: NightAuditPreparation['chargesToPost'] = [];
  let alreadyChargedCount = 0;

  for (const res of checkedInReservations) {
    const hasTodayCharge = folioItems.some(
      f => f.reservationId === res.id && 
           f.category === 'ROOM' && 
           (f.dateTime.startsWith(businessDate) || f.description.includes(businessDate))
    );

    if (hasTodayCharge) {
      alreadyChargedCount++;
    } else {
      chargesToPost.push({
        reservationId: res.id,
        roomId: res.roomId,
        roomNumber: res.roomNumber,
        guestName: res.guestName,
        rate: res.roomRate,
        description: `Daily Room Charge (${res.roomTypeName}) - Night of ${businessDate}`
      });
    }
  }

  // Calculate unpaid balances across checked-in reservations
  let unpaidFoliosCount = 0;
  let totalUnpaidBalance = 0;

  for (const res of checkedInReservations) {
    const resFolios = folioItems.filter(f => f.reservationId === res.id);
    const resPayments = payments.filter(p => p.reservationId === res.id);
    const summary = calculateGuestFolioSummary(resFolios, resPayments, res.depositAmount, res.discountAmount);
    if (summary.balanceDue > 0.01) {
      unpaidFoliosCount++;
      totalUnpaidBalance += summary.balanceDue;
    }
  }

  if (checkedInReservations.length === 0) {
    warnings.push('No checked-in guests currently in-house for this business date.');
  }

  return {
    canProceed: errors.length === 0,
    businessDate,
    totalOccupied: occupiedRooms.length,
    totalSellable: sellableRooms.length,
    occupancyPercent,
    chargesToPost,
    alreadyChargedCount,
    unpaidFoliosCount,
    totalUnpaidBalance: Math.round(totalUnpaidBalance * 100) / 100,
    warnings,
    errors
  };
}

/**
 * Phase 5: Hospitality Yield Analytics (Occupancy, ADR, RevPAR)
 */
export interface HospitalityYieldMetrics {
  totalRooms: number;
  sellableRooms: number;
  outOfServiceRooms: number;
  maintenanceRooms: number;
  occupiedRooms: number;
  occupancyRate: number; // percentage
  soldRoomNights: number;
  availableRoomNights: number;
  roomRevenue: number;
  fbRevenue: number;
  serviceRevenue: number;
  totalHospitalityRevenue: number;
  adr: number;    // Average Daily Rate = Room Revenue / Sold Room Nights
  revpar: number; // RevPAR = Room Revenue / Available Sellable Room Nights
}

export function calculateHospitalityYieldMetrics(
  rooms: ResortRoom[],
  reservations: Reservation[],
  folioItems: GuestFolioItem[],
  dateFilter: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'all',
  customStartDate?: string,
  customEndDate?: string
): HospitalityYieldMetrics {
  const totalRooms = rooms.length;
  const outOfServiceRooms = rooms.filter(r => r.status === 'OUT_OF_SERVICE').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'MAINTENANCE').length;
  const sellableRooms = Math.max(1, totalRooms - outOfServiceRooms - maintenanceRooms);
  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;

  const todayDate = new Date();
  const todayStr = formatLocalYMD(todayDate);
  const yesterday = new Date(todayDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalYMD(yesterday);

  const weekAgo = new Date(todayDate);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = formatLocalYMD(weekAgo);

  const monthAgo = new Date(todayDate);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoStr = formatLocalYMD(monthAgo);

  // Filter folio items by date
  const filteredFolios = folioItems.filter(f => {
    const itemDate = f.dateTime.split(' ')[0];
    if (dateFilter === 'today') return itemDate === todayStr;
    if (dateFilter === 'yesterday') return itemDate === yesterdayStr;
    if (dateFilter === 'week') return itemDate >= weekAgoStr;
    if (dateFilter === 'month') return itemDate >= monthAgoStr;
    if (customStartDate && customEndDate) return itemDate >= customStartDate && itemDate <= customEndDate;
    return true; // 'all'
  });

  // Calculate pure room revenue (strictly category === 'ROOM')
  const roomRevenue = filteredFolios
    .filter(f => f.category === 'ROOM')
    .reduce((sum, f) => sum + f.totalPrice, 0);

  // F&B cross revenue
  const fbRevenue = filteredFolios
    .filter(f => f.category === 'RESTAURANT' || f.category === 'CAFE' || f.category === 'BREAKFAST')
    .reduce((sum, f) => sum + f.totalPrice, 0);

  // Extra service revenue
  const serviceRevenue = filteredFolios
    .filter(f => f.category === 'SPA' || f.category === 'LAUNDRY' || f.category === 'TRANSPORT' || f.category === 'OTHER_SERVICE')
    .reduce((sum, f) => sum + f.totalPrice, 0);

  const totalHospitalityRevenue = roomRevenue + fbRevenue + serviceRevenue;

  // Calculate sold room nights in this period
  let soldRoomNights = 0;
  if (dateFilter === 'today') {
    soldRoomNights = Math.max(occupiedRooms, filteredFolios.filter(f => f.category === 'ROOM').length);
  } else if (dateFilter === 'yesterday') {
    soldRoomNights = filteredFolios.filter(f => f.category === 'ROOM').length;
  } else {
    soldRoomNights = Math.max(1, filteredFolios.filter(f => f.category === 'ROOM').length || occupiedRooms);
  }

  // Days multiplier
  let daysInPeriod = 1;
  if (dateFilter === 'week') daysInPeriod = 7;
  else if (dateFilter === 'month') daysInPeriod = 30;
  else if (customStartDate && customEndDate) {
    const diff = (new Date(customEndDate).getTime() - new Date(customStartDate).getTime()) / (1000 * 3600 * 24) + 1;
    daysInPeriod = Math.max(1, Math.round(diff));
  }

  const availableRoomNights = Math.max(1, sellableRooms * daysInPeriod);
  const occupancyRate = Math.min(100, Math.round(((soldRoomNights / availableRoomNights) * 100) * 10) / 10);

  // ADR = Room Revenue / Sold Room Nights
  const adr = soldRoomNights > 0 ? Math.round(roomRevenue / soldRoomNights) : 0;

  // RevPAR = Room Revenue / Available Sellable Room Nights
  const revpar = availableRoomNights > 0 ? Math.round(roomRevenue / availableRoomNights) : 0;

  return {
    totalRooms,
    sellableRooms,
    outOfServiceRooms,
    maintenanceRooms,
    occupiedRooms,
    occupancyRate,
    soldRoomNights,
    availableRoomNights,
    roomRevenue,
    fbRevenue,
    serviceRevenue,
    totalHospitalityRevenue,
    adr,
    revpar
  };
}

/**
 * Phase 5: Daily Closing Reconciliation
 */
export interface DailyClosingSummary {
  businessDate: string;
  grossSales: number;
  discounts: number;
  taxes: number;
  netSales: number;
  roomRevenue: number;
  restaurantRevenue: number;
  cafeRevenue: number;
  roomServiceRevenue: number;
  extraServiceRevenue: number;
  paymentsByMethod: Record<PaymentMethod, number>;
  totalPaymentsCollected: number;
  refunds: number;
  outstandingBalance: number;
  isReconciled: boolean;
  discrepancy: number;
}

export function reconcileDailyClosing(
  businessDate: string,
  folioItems: GuestFolioItem[],
  hotelPayments: HotelPaymentRecord[],
  orders: Order[] = [],
  taxPercent: number = 13
): DailyClosingSummary {
  // Filter for this date
  const dateFolios = folioItems.filter(f => f.dateTime.startsWith(businessDate));
  const datePayments = hotelPayments.filter(p => p.dateTime.startsWith(businessDate));
  const dateOrders = orders.filter(o => o.createdAt.startsWith(businessDate));

  let roomRevenue = 0;
  let restaurantRevenue = 0;
  let cafeRevenue = 0;
  let roomServiceRevenue = 0;
  let extraServiceRevenue = 0;

  for (const f of dateFolios) {
    if (f.category === 'ROOM') roomRevenue += f.totalPrice;
    else if (f.category === 'RESTAURANT') restaurantRevenue += f.totalPrice;
    else if (f.category === 'CAFE') cafeRevenue += f.totalPrice;
    else if (f.description.toLowerCase().includes('room service')) roomServiceRevenue += f.totalPrice;
    else extraServiceRevenue += f.totalPrice;
  }

  // POS orders (not settled to folio to prevent double counting)
  for (const o of dateOrders) {
    if (o.status !== 'cancelled' && o.paymentMethod !== 'charge_to_room') {
      restaurantRevenue += o.subtotal;
    }
  }

  const grossSales = Math.round((roomRevenue + restaurantRevenue + cafeRevenue + roomServiceRevenue + extraServiceRevenue) * 100) / 100;
  const activeOrCompletedOrders = dateOrders.filter(o => o.status !== 'cancelled');
  const discounts = Math.round(activeOrCompletedOrders.reduce((s, o) => s + (o.discountAmount || 0), 0) * 100) / 100;
  const netSales = Math.round(Math.max(0, grossSales - discounts) * 100) / 100;
  const taxes = Math.round(((netSales * taxPercent) / 100) * 100) / 100;

  // Payments breakdown
  const paymentsByMethod: Record<PaymentMethod, number> = {
    cash: 0,
    card: 0,
    qr: 0,
    fonepay_qr: 0,
    esewa: 0,
    khalti: 0,
    bank: 0,
    credit_khata: 0,
    charge_to_room: 0,
    split: 0
  };

  let totalPaymentsCollected = 0;
  let refunds = 0;

  for (const p of datePayments) {
    if (p.status === 'completed') {
      paymentsByMethod[p.method] = (paymentsByMethod[p.method] || 0) + p.amount;
      totalPaymentsCollected += p.amount;
    } else if (p.status === 'refunded') {
      refunds += p.amount;
    }
  }

  // Include direct POS order payments (excluding charge_to_room which settles via hotelPayments)
  for (const o of dateOrders) {
    if (o.status === 'completed' && o.paymentMethod !== 'charge_to_room') {
      if (o.paymentMethod === 'split' && o.paymentDetails) {
        const pd = o.paymentDetails;
        const cashVal = Number(pd.cash) || 0;
        const fpVal = (Number(pd.fonepay) || 0) + (Number(pd.qr) || 0);
        const cardVal = Number(pd.card) || 0;
        const esewaVal = Number(pd.esewa) || 0;
        const khaltiVal = Number(pd.khalti) || 0;
        const bankVal = Number(pd.bank) || 0;
        const creditVal = Number(pd.credit) || 0;
        paymentsByMethod.cash += cashVal;
        paymentsByMethod.fonepay_qr += fpVal;
        paymentsByMethod.card += cardVal;
        paymentsByMethod.esewa += esewaVal;
        paymentsByMethod.khalti += khaltiVal;
        paymentsByMethod.bank += bankVal;
        paymentsByMethod.credit_khata += creditVal;
        totalPaymentsCollected += cashVal + fpVal + cardVal + esewaVal + khaltiVal + bankVal;
      } else if (o.paymentMethod === 'credit_khata' || o.paymentStatus === 'credit') {
        const dueAmt = o.dueAmount !== undefined ? Number(o.dueAmount) || 0 : o.grandTotal;
        paymentsByMethod.credit_khata += dueAmt;
      } else {
        const collected = o.paidAmount !== undefined ? Number(o.paidAmount) || 0 : o.grandTotal;
        const dueAmt = Math.max(0, Number(o.dueAmount) || 0);
        paymentsByMethod[o.paymentMethod] = (paymentsByMethod[o.paymentMethod] || 0) + collected;
        if (dueAmt > 0) paymentsByMethod.credit_khata += dueAmt;
        totalPaymentsCollected += collected;
      }
    }
  }

  totalPaymentsCollected = Math.round(totalPaymentsCollected * 100) / 100;
  const discrepancy = Math.round((netSales + taxes - totalPaymentsCollected) * 100) / 100;
  const outstandingBalance = Math.max(0, discrepancy);

  return {
    businessDate,
    grossSales,
    discounts,
    taxes,
    netSales,
    roomRevenue,
    restaurantRevenue,
    cafeRevenue,
    roomServiceRevenue,
    extraServiceRevenue,
    paymentsByMethod,
    totalPaymentsCollected,
    refunds,
    outstandingBalance,
    isReconciled: Math.abs(discrepancy) < 1,
    discrepancy
  };
}

/**
 * Phase 5: Department of Tourism / Police Immigration Tourist Registration Formatter
 */
export function generateTouristRegistrationData(
  guests: GuestProfile[],
  reservations: Reservation[],
  rooms: ResortRoom[]
) {
  return reservations.map((res, index) => {
    const profile = guests.find(g => g.id === res.guestId || g.phone === res.guestPhone);
    const room = rooms.find(r => r.id === res.roomId);

    return {
      sn: index + 1,
      guestName: res.guestName,
      nationality: profile?.country || 'Nepali',
      idType: profile?.idType || 'Citizenship / Passport',
      idNumber: profile?.idNumber || 'N/A',
      contactPhone: res.guestPhone,
      email: res.guestEmail || profile?.email || 'N/A',
      roomNumber: res.roomNumber || room?.roomNumber || 'N/A',
      checkInDate: res.actualCheckInTime?.split(' ')[0] || res.checkInDate,
      checkOutDate: res.actualCheckOutTime?.split(' ')[0] || res.checkOutDate,
      numberOfNights: res.nightsCount,
      numberOfGuests: (res.adults || 1) + (res.children || 0),
      purposeOfVisit: profile?.notes || 'Holiday / Trekking',
      bookingStatus: res.status,
      address: profile?.address || 'Nepal'
    };
  });
}

export function exportTouristRegistrationToCSV(
  data: ReturnType<typeof generateTouristRegistrationData>,
  businessName: string
): string {
  const headers = [
    'S.N.',
    'Guest Full Name',
    'Nationality',
    'ID / Passport Type',
    'ID / Passport Number',
    'Contact Number',
    'Email Address',
    'Room Number',
    'Check-in Date',
    'Check-out Date',
    'Nights',
    'Guest Count',
    'Purpose of Visit',
    'Status',
    'Home Address'
  ];

  const rows = data.map(d => [
    d.sn,
    `"${d.guestName}"`,
    `"${d.nationality}"`,
    `"${d.idType}"`,
    `"${d.idNumber}"`,
    `"${d.contactPhone}"`,
    `"${d.email}"`,
    `"${d.roomNumber}"`,
    `"${d.checkInDate}"`,
    `"${d.checkOutDate}"`,
    d.numberOfNights,
    d.numberOfGuests,
    `"${d.purposeOfVisit}"`,
    d.bookingStatus,
    `"${d.address}"`
  ]);

  return [
    `# Government / Department of Tourism & Police Registration Export - ${businessName}`,
    `# Generated on: ${new Date().toISOString()}`,
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');
}

/**
 * Local calendar YYYY-MM-DD formatter (avoids UTC midnight date-shift issues)
 */
export function formatLocalYMD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Local calendar YYYY-MM-DD + N days helper
 */
export function addDaysLocalYMD(ymd: string, days: number): string {
  const parts = ymd.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + days);
    return formatLocalYMD(fallback);
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return formatLocalYMD(d);
}

/**
 * Unified Reservation Folio Financial Breakdown (fixes payment double-counting)
 * Note: reservation.paidAmount already accumulates recorded HotelPaymentRecords + initial deposits.
 * Summing `payments` starting from `reservation.paidAmount` previously double-counted payments!
 */
export interface ReservationFolioMetrics {
  roomCharges: number;
  fbCharges: number;
  serviceCharges: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  vatAmount: number;
  grandTotal: number;
  completedPaymentsSum: number;
  effectivePaid: number;
  untrackedAdvance: number;
  balanceDue: number;
  isFullyPaid: boolean;
}

export function computeReservationFolioMetrics(
  folioItems: GuestFolioItem[],
  payments: HotelPaymentRecord[],
  reservation: Pick<Reservation, 'discountAmount' | 'paidAmount' | 'totalAmount'>,
  vatConfig: { enableVat?: boolean; vatRatePercent?: number } = { enableVat: true, vatRatePercent: 13 }
): ReservationFolioMetrics {
  const roomCharges = folioItems
    .filter(i => i.category === 'ROOM')
    .reduce((s, i) => s + i.totalPrice, 0);

  const fbCharges = folioItems
    .filter(i => i.category === 'RESTAURANT' || i.category === 'CAFE' || i.category === 'BREAKFAST')
    .reduce((s, i) => s + i.totalPrice, 0);

  const serviceCharges = folioItems
    .filter(
      i =>
        i.category === 'SPA' ||
        i.category === 'LAUNDRY' ||
        i.category === 'TRANSPORT' ||
        i.category === 'OTHER_SERVICE'
    )
    .reduce((s, i) => s + i.totalPrice, 0);

  // Fallback to reservation.totalAmount if folioItems hasn't been populated yet (e.g., pre-checkin booking)
  const rawSubtotal =
    folioItems.length > 0
      ? Math.round((roomCharges + fbCharges + serviceCharges) * 100) / 100
      : Math.max(0, reservation.totalAmount || 0);

  const discountAmount = Math.min(rawSubtotal, Math.max(0, reservation.discountAmount || 0));
  const taxableAmount = Math.max(0, Math.round((rawSubtotal - discountAmount) * 100) / 100);

  const enableVat = vatConfig.enableVat !== false && folioItems.length > 0;
  const vatRate = Math.max(0, vatConfig.vatRatePercent ?? 13);
  const vatAmount = enableVat ? Math.round(((taxableAmount * vatRate) / 100) * 100) / 100 : 0;
  const grandTotal = Math.round((taxableAmount + vatAmount) * 100) / 100;

  // Deduplicate: sum completed payments ONLY (exclude refunded), then take max with reservation.paidAmount
  const completedPaymentsSum =
    Math.round(
      payments
        .filter(p => p.status !== 'refunded')
        .reduce((s, p) => s + p.amount, 0) * 100
    ) / 100;

  const recordedPaid = Math.max(0, reservation.paidAmount || 0);
  const effectivePaid = Math.round(Math.max(completedPaymentsSum, recordedPaid) * 100) / 100;
  const untrackedAdvance = Math.max(0, Math.round((effectivePaid - completedPaymentsSum) * 100) / 100);
  const balanceDue = Math.max(0, Math.round((grandTotal - effectivePaid) * 100) / 100);

  return {
    roomCharges: Math.round(roomCharges * 100) / 100,
    fbCharges: Math.round(fbCharges * 100) / 100,
    serviceCharges: Math.round(serviceCharges * 100) / 100,
    subtotal: rawSubtotal,
    discountAmount,
    taxableAmount,
    vatAmount,
    grandTotal,
    completedPaymentsSum,
    effectivePaid,
    untrackedAdvance,
    balanceDue,
    isFullyPaid: balanceDue <= 0.01
  };
}

/**
 * Validates Stay Extension against future bookings on the same room
 */
export function validateStayExtension(
  reservation: Reservation,
  newCheckOutDate: string,
  rooms: ResortRoom[],
  existingReservations: Reservation[]
): {
  isValid: boolean;
  extraNights: number;
  totalNights: number;
  extraRoomCharge: number;
  error?: string;
} {
  if (reservation.status !== 'CHECKED_IN' && reservation.status !== 'CONFIRMED') {
    return {
      isValid: false,
      extraNights: 0,
      totalNights: reservation.nightsCount,
      extraRoomCharge: 0,
      error: `Cannot extend stay for reservation with status ${reservation.status}.`
    };
  }

  if (!newCheckOutDate || newCheckOutDate <= reservation.checkOutDate) {
    return {
      isValid: false,
      extraNights: 0,
      totalNights: reservation.nightsCount,
      extraRoomCharge: 0,
      error: `New check-out date must be after current check-out date (${reservation.checkOutDate}).`
    };
  }

  const availability = validateRoomAvailability(
    reservation.roomId,
    reservation.checkInDate,
    newCheckOutDate,
    existingReservations,
    rooms,
    reservation.id
  );

  if (!availability.isAvailable) {
    return {
      isValid: false,
      extraNights: 0,
      totalNights: reservation.nightsCount,
      extraRoomCharge: 0,
      error: availability.error
    };
  }

  const oldEnd = new Date(reservation.checkOutDate).getTime();
  const newEnd = new Date(newCheckOutDate).getTime();
  const extraNights = Math.max(1, Math.round((newEnd - oldEnd) / (1000 * 60 * 60 * 24)));
  const totalNights = reservation.nightsCount + extraNights;
  const extraRoomCharge = Math.round(extraNights * reservation.roomRate * 100) / 100;

  return {
    isValid: true,
    extraNights,
    totalNights,
    extraRoomCharge
  };
}

/**
 * Cash vs Online Tender Summary for Hotel Payment Records
 */
export interface HotelCashOnlineSummary {
  cash: number;
  online: number;
  fonepayQr: number;
  esewa: number;
  khalti: number;
  card: number;
  bank: number;
  other: number;
  total: number;
  count: number;
}

export function summarizeHotelPaymentsCashVsOnline(
  payments: HotelPaymentRecord[],
  filterDateYMD?: string
): HotelCashOnlineSummary {
  let cash = 0;
  let fonepayQr = 0;
  let esewa = 0;
  let khalti = 0;
  let card = 0;
  let bank = 0;
  let other = 0;
  let count = 0;

  for (const p of payments) {
    if (p.status === 'refunded') continue;
    if (filterDateYMD && !p.dateTime.startsWith(filterDateYMD)) continue;
    count++;
    switch (p.method) {
      case 'cash':
        cash += p.amount;
        break;
      case 'fonepay_qr':
      case 'qr':
        fonepayQr += p.amount;
        break;
      case 'esewa':
        esewa += p.amount;
        break;
      case 'khalti':
        khalti += p.amount;
        break;
      case 'card':
        card += p.amount;
        break;
      case 'bank':
        bank += p.amount;
        break;
      default:
        other += p.amount;
        break;
    }
  }

  const online = Math.round((fonepayQr + esewa + khalti + card + bank + other) * 100) / 100;
  const cashRounded = Math.round(cash * 100) / 100;
  const total = Math.round((cashRounded + online) * 100) / 100;

  return {
    cash: cashRounded,
    online,
    fonepayQr: Math.round(fonepayQr * 100) / 100,
    esewa: Math.round(esewa * 100) / 100,
    khalti: Math.round(khalti * 100) / 100,
    card: Math.round(card * 100) / 100,
    bank: Math.round(bank * 100) / 100,
    other: Math.round(other * 100) / 100,
    total,
    count
  };
}

