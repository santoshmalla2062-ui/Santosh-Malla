import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysLocalYMD,
  computeReservationFolioMetrics,
  formatLocalYMD,
  summarizeHotelPaymentsCashVsOnline,
  validateStayExtension
} from '../services/resortSecurity';
import {
  GuestFolioItem,
  HotelPaymentRecord,
  Reservation,
  ResortRoom
} from '../types';

test('formatLocalYMD and addDaysLocalYMD preserve local calendar dates cleanly', () => {
  const sample = new Date(2026, 10, 15, 23, 55, 0);
  const ymd = formatLocalYMD(sample);
  assert.equal(ymd, '2026-11-15');
  assert.equal(addDaysLocalYMD(ymd, 1), '2026-11-16');
  assert.equal(addDaysLocalYMD('2026-11-30', 1), '2026-12-01');
});

test('computeReservationFolioMetrics never double-counts paidAmount with hotelPayments', () => {
  const reservation: Reservation = {
    id: 'res-101',
    guestId: 'gp-1',
    guestName: 'Aarav Shrestha',
    guestPhone: '9841000001',
    roomId: 'r-101',
    roomNumber: '101',
    roomTypeId: 'rt-deluxe',
    roomTypeName: 'Deluxe Room',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    adults: 2,
    children: 0,
    nightsCount: 2,
    roomRate: 5000,
    discountAmount: 0,
    taxAmount: 1300,
    extraCharges: 1000,
    totalAmount: 12430,
    depositAmount: 3000,
    paidAmount: 5000, // Includes 3000 deposit + 2000 interim payment recorded in hotelPayments
    remainingAmount: 7430,
    paymentMethod: 'fonepay_qr',
    bookingSource: 'Direct Walk-in',
    status: 'CHECKED_IN',
    createdAt: '2026-11-20'
  };

  const folioItems: GuestFolioItem[] = [
    {
      id: 'fol-1',
      reservationId: 'res-101',
      roomId: 'r-101',
      roomNumber: '101',
      dateTime: '2026-11-20 14:00',
      description: 'Deluxe Room (2 Nights)',
      category: 'ROOM',
      quantity: 2,
      unitPrice: 5000,
      totalPrice: 10000,
      addedByStaff: 'Reception'
    },
    {
      id: 'fol-2',
      reservationId: 'res-101',
      roomId: 'r-101',
      roomNumber: '101',
      dateTime: '2026-11-20 19:30',
      description: 'Dinner Room Service',
      category: 'RESTAURANT',
      quantity: 1,
      unitPrice: 1000,
      totalPrice: 1000,
      addedByStaff: 'POS'
    }
  ];

  const payments: HotelPaymentRecord[] = [
    {
      id: 'hpay-1',
      reservationId: 'res-101',
      guestName: 'Aarav Shrestha',
      roomNumber: '101',
      amount: 3000,
      method: 'fonepay_qr',
      dateTime: '2026-11-20 12:00',
      staffName: 'Reception',
      status: 'completed'
    },
    {
      id: 'hpay-2',
      reservationId: 'res-101',
      guestName: 'Aarav Shrestha',
      roomNumber: '101',
      amount: 2000,
      method: 'cash',
      dateTime: '2026-11-20 18:00',
      staffName: 'Reception',
      status: 'completed'
    },
    {
      id: 'hpay-ref',
      reservationId: 'res-101',
      guestName: 'Aarav Shrestha',
      roomNumber: '101',
      amount: 500,
      method: 'cash',
      dateTime: '2026-11-20 18:30',
      staffName: 'Reception',
      status: 'refunded'
    }
  ];

  const metrics = computeReservationFolioMetrics(folioItems, payments, reservation, {
    enableVat: true,
    vatRatePercent: 13
  });

  // Subtotal = 11000, 13% VAT = 1430, Grand Total = 12430
  assert.equal(metrics.roomCharges, 10000);
  assert.equal(metrics.fbCharges, 1000);
  assert.equal(metrics.subtotal, 11000);
  assert.equal(metrics.vatAmount, 1430);
  assert.equal(metrics.grandTotal, 12430);
  // CRITICAL: effectivePaid must be 5000 (NOT 10000 double-counted, and excludes 500 refunded)
  assert.equal(metrics.effectivePaid, 5000);
  assert.equal(metrics.balanceDue, 7430);
  assert.equal(metrics.isFullyPaid, false);
});

test('validateStayExtension blocks overlapping future booking and allows open dates', () => {
  const rooms: ResortRoom[] = [
    {
      id: 'r-101',
      roomNumber: '101',
      roomTypeId: 'rt-1',
      roomTypeName: 'Deluxe',
      floor: 'Floor 1',
      capacity: 2,
      pricePerNight: 4500,
      amenities: ['WiFi'],
      status: 'OCCUPIED',
      currentReservationId: 'res-active'
    }
  ];

  const activeRes: Reservation = {
    id: 'res-active',
    guestId: 'gp-1',
    guestName: 'Sita Gurung',
    guestPhone: '9841111111',
    roomId: 'r-101',
    roomNumber: '101',
    roomTypeId: 'rt-1',
    roomTypeName: 'Deluxe',
    checkInDate: '2026-11-20',
    checkOutDate: '2026-11-22',
    adults: 2,
    children: 0,
    nightsCount: 2,
    roomRate: 4500,
    discountAmount: 0,
    taxAmount: 0,
    extraCharges: 0,
    totalAmount: 9000,
    depositAmount: 0,
    paidAmount: 0,
    remainingAmount: 9000,
    paymentMethod: 'cash',
    bookingSource: 'Direct Walk-in',
    status: 'CHECKED_IN',
    createdAt: '2026-11-20'
  };

  const upcomingRes: Reservation = {
    ...activeRes,
    id: 'res-next',
    guestId: 'gp-2',
    guestName: 'Ramesh Thapa',
    checkInDate: '2026-11-23',
    checkOutDate: '2026-11-25',
    status: 'CONFIRMED'
  };

  // Extending by 1 night (22 -> 23) does not overlap [23, 25)
  const validExt = validateStayExtension(activeRes, '2026-11-23', rooms, [activeRes, upcomingRes]);
  assert.equal(validExt.isValid, true);
  assert.equal(validExt.extraNights, 1);
  assert.equal(validExt.totalNights, 3);
  assert.equal(validExt.extraRoomCharge, 4500);

  // Extending to Nov 24 overlaps Ramesh's CONFIRMED booking starting Nov 23!
  const blockedExt = validateStayExtension(activeRes, '2026-11-24', rooms, [activeRes, upcomingRes]);
  assert.equal(blockedExt.isValid, false);
  assert.match(blockedExt.error || '', /Ramesh Thapa/);
});

test('summarizeHotelPaymentsCashVsOnline separates Cash from Online tenders and respects date filter', () => {
  const payments: HotelPaymentRecord[] = [
    {
      id: 'p1',
      reservationId: 'r1',
      guestName: 'Guest A',
      roomNumber: '101',
      amount: 2500,
      method: 'cash',
      dateTime: '2026-11-20 10:00',
      staffName: 'Front Desk',
      status: 'completed'
    },
    {
      id: 'p2',
      reservationId: 'r2',
      guestName: 'Guest B',
      roomNumber: '102',
      amount: 4000,
      method: 'fonepay_qr',
      dateTime: '2026-11-20 11:30',
      staffName: 'Front Desk',
      status: 'completed'
    },
    {
      id: 'p3',
      reservationId: 'r3',
      guestName: 'Guest C',
      roomNumber: '103',
      amount: 1500,
      method: 'esewa',
      dateTime: '2026-11-20 15:00',
      staffName: 'Front Desk',
      status: 'completed'
    },
    {
      id: 'p4',
      reservationId: 'r4',
      guestName: 'Guest D',
      roomNumber: '104',
      amount: 3000,
      method: 'cash',
      dateTime: '2026-11-19 09:00',
      staffName: 'Front Desk',
      status: 'completed'
    },
    {
      id: 'p5',
      reservationId: 'r5',
      guestName: 'Guest E',
      roomNumber: '105',
      amount: 1000,
      method: 'card',
      dateTime: '2026-11-20 16:00',
      staffName: 'Front Desk',
      status: 'refunded'
    }
  ];

  const today = summarizeHotelPaymentsCashVsOnline(payments, '2026-11-20');
  assert.equal(today.cash, 2500);
  assert.equal(today.fonepayQr, 4000);
  assert.equal(today.esewa, 1500);
  assert.equal(today.online, 5500);
  assert.equal(today.total, 8000);
  assert.equal(today.count, 3);
});
