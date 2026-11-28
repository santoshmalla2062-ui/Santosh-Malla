import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  DollarSign, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  Users, 
  BedDouble, 
  Building,
  DoorOpen
} from 'lucide-react';
import { NumberInput } from '../common/NumberInput';
import { 
  BusinessSettings, 
  GuestProfile, 
  PaymentMethod, 
  Reservation, 
  ResortRoom, 
  RoomType, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';
import { addDaysLocalYMD, formatLocalYMD } from '../../services/resortSecurity';

interface NewReservationModalProps {
  rooms: ResortRoom[];
  roomTypes: RoomType[];
  existingReservations: Reservation[];
  guestProfiles: GuestProfile[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onSaveReservation: (
    reservation: Reservation,
    guestProfile?: GuestProfile,
    depositPayment?: { amount: number; method: PaymentMethod },
    immediateCheckIn?: boolean
  ) => void;
  onClose: () => void;
  initialRoomId?: string;
  initialDate?: string;
  initialImmediateCheckIn?: boolean;
}

export const NewReservationModal: React.FC<NewReservationModalProps> = ({
  rooms,
  roomTypes,
  existingReservations,
  guestProfiles,
  settings,
  currentSession,
  lang,
  onSaveReservation,
  onClose,
  initialRoomId,
  initialDate,
  initialImmediateCheckIn = false
}) => {
  const todayStr = formatLocalYMD();
  const tomorrowStr = addDaysLocalYMD(todayStr, 1);

  const [checkInDate, setCheckInDate] = useState<string>(initialDate || todayStr);
  const [checkOutDate, setCheckOutDate] = useState<string>(
    initialDate ? addDaysLocalYMD(initialDate, 1) : tomorrowStr
  );
  const [checkInTime, setCheckInTime] = useState<string>(settings.hotelCheckInTime || '14:00');
  const [checkOutTime, setCheckOutTime] = useState<string>(settings.hotelCheckOutTime || '12:00');
  const [immediateCheckIn, setImmediateCheckIn] = useState<boolean>(
    initialImmediateCheckIn && (!initialDate || initialDate === todayStr)
  );
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('all');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || '');
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [bookingSource, setBookingSource] = useState<Reservation['bookingSource']>('Direct Walk-in');

  // Guest details
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [guestCountry, setGuestCountry] = useState('Nepal');
  const [idType, setIdType] = useState<GuestProfile['idType']>('Citizenship');
  const [idNumber, setIdNumber] = useState('');

  // Financials
  const [customRoomRate, setCustomRoomRate] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('fonepay_qr');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Compute nights count
  const nightsCount = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 1;
    const start = new Date(checkInDate).getTime();
    const end = new Date(checkOutDate).getTime();
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [checkInDate, checkOutDate]);

  // STRICT OVERLAP DETECTION: Check if a room is available for dates
  const isRoomAvailable = (room: ResortRoom): boolean => {
    // If room is out of service, not available
    if (room.status === 'OUT_OF_SERVICE') return false;

    // Check against all active reservations
    const hasOverlap = existingReservations.some(res => {
      if (res.roomId !== room.id) return false;
      if (res.status === 'CANCELLED' || res.status === 'CHECKED_OUT' || res.status === 'NO_SHOW') return false;

      // Overlap condition:
      // (existingStart < newEnd) && (existingEnd > newStart)
      const existingStart = res.checkInDate;
      const existingEnd = res.checkOutDate;
      return (existingStart < checkOutDate) && (existingEnd > checkInDate);
    });

    return !hasOverlap;
  };

  // Filter available rooms
  const availableRooms = useMemo(() => {
    return rooms.filter(r => {
      if (selectedRoomTypeId !== 'all' && r.roomTypeId !== selectedRoomTypeId) return false;
      return isRoomAvailable(r);
    });
  }, [rooms, selectedRoomTypeId, checkInDate, checkOutDate, existingReservations]);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const activeRate = customRoomRate !== null ? customRoomRate : (selectedRoom?.pricePerNight || 4000);
  const subtotal = activeRate * nightsCount;
  const taxable = Math.max(0, subtotal - discountAmount);
  const vatAmount = settings.enableVat ? taxable * (settings.vatRatePercent / 100) : 0;
  const totalAmount = taxable + vatAmount;
  const remainingAmount = Math.max(0, totalAmount - depositAmount);

  // Quick autofill if guest phone matches existing profile
  const handlePhoneBlur = () => {
    if (!guestPhone.trim()) return;
    const found = guestProfiles.find(g => g.phone === guestPhone.trim());
    if (found) {
      setGuestName(found.fullName);
      if (found.email) setGuestEmail(found.email);
      if (found.address) setGuestAddress(found.address);
      if (found.country) setGuestCountry(found.country);
      if (found.idType) setIdType(found.idType);
      if (found.idNumber) setIdNumber(found.idNumber);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!selectedRoomId) {
      setValidationError('Please select an available room.');
      return;
    }

    if (!checkInDate || !checkOutDate) {
      setValidationError('Please enter valid check-in and check-out dates.');
      return;
    }

    if (checkOutDate <= checkInDate) {
      setValidationError('Check-out date must be after check-in date.');
      return;
    }

    const room = rooms.find(r => r.id === selectedRoomId);
    if (!room) {
      setValidationError('Selected room is invalid.');
      return;
    }

    // Double booking sanity check!
    if (!isRoomAvailable(room)) {
      setValidationError(`Room ${room.roomNumber} is already booked for these dates. Please choose another room.`);
      return;
    }

    // For immediate walk-in check-in, room must also be ready (not OCCUPIED or MAINTENANCE)
    if (immediateCheckIn && checkInDate === todayStr) {
      if (room.status === 'OCCUPIED') {
        setValidationError(`Room ${room.roomNumber} is currently occupied.`);
        return;
      }
      if (room.status === 'MAINTENANCE' || room.status === 'OUT_OF_SERVICE') {
        setValidationError(`Room ${room.roomNumber} is under maintenance and cannot be checked in immediately.`);
        return;
      }
    }

    const resId = 'res-' + Date.now();
    const guestId = 'gp-' + (guestPhone.replace(/\D/g, '') || Date.now());
    const canInstantCheckIn = immediateCheckIn && checkInDate === todayStr;
    const nowTimeStr = `${todayStr} ${new Date().toTimeString().substring(0, 5)}`;

    const newReservation: Reservation = {
      id: resId,
      guestId,
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestEmail: guestEmail.trim() || undefined,
      guestAddress: guestAddress.trim() || undefined,
      guestCountry: guestCountry.trim() || 'Nepal',
      idType,
      idNumber: idNumber.trim() || undefined,
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomTypeId: room.roomTypeId,
      roomTypeName: room.roomTypeName,
      checkInDate,
      checkOutDate,
      checkInTime,
      checkOutTime,
      adults,
      children,
      nightsCount,
      roomRate: activeRate,
      discountAmount,
      taxAmount: vatAmount,
      extraCharges: 0,
      totalAmount,
      depositAmount,
      paidAmount: depositAmount,
      remainingAmount,
      paymentMethod: depositMethod,
      bookingSource,
      notes: notes.trim() || undefined,
      status: canInstantCheckIn ? 'CHECKED_IN' : 'CONFIRMED',
      actualCheckInTime: canInstantCheckIn ? nowTimeStr : undefined,
      checkedInByStaff: canInstantCheckIn ? (currentSession?.name || 'Reception') : undefined,
      createdAt: todayStr
    };

    const newGuestProfile: GuestProfile = {
      id: guestId,
      fullName: guestName.trim(),
      phone: guestPhone.trim(),
      email: guestEmail.trim(),
      address: guestAddress.trim(),
      country: guestCountry,
      idType,
      idNumber: idNumber.trim(),
      notes: `Reservation #${resId}`,
      totalStays: 1,
      createdAt: todayStr
    };

    const depositPayment = depositAmount > 0 ? {
      amount: depositAmount,
      method: depositMethod
    } : undefined;

    onSaveReservation(newReservation, newGuestProfile, depositPayment, canInstantCheckIn);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-900 text-white">
          <div className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-emerald-300" />
            <div>
              <h3 className="font-bold text-sm">
                {lang === 'ne' ? 'नयाँ कोठा बुकिङ (New Room Reservation)' : 'New Room Reservation & Availability Booking'}
              </h3>
              <p className="text-emerald-200 text-[11px]">Strict double-booking prevention & guest profile registration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Stay Dates & Capacity */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-500">
              1. Stay Dates & Capacity
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Check-in Date &amp; Time:</label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={checkInDate}
                    min={todayStr}
                    onChange={(e) => {
                      const nextCheckIn = e.target.value;
                      setCheckInDate(nextCheckIn);
                      if (nextCheckIn !== todayStr && immediateCheckIn) {
                        setImmediateCheckIn(false);
                      }
                      if (checkOutDate <= nextCheckIn) {
                        setCheckOutDate(addDaysLocalYMD(nextCheckIn, 1));
                      }
                    }}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                    required
                  />
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-24 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num text-[11px]"
                    title="Expected / Standard Check-In Time"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Check-out Date &amp; Time:</label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={checkOutDate}
                    min={checkInDate || todayStr}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                    required
                  />
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-24 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num text-[11px]"
                    title="Expected / Standard Check-Out Time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Adults:</label>
                  <NumberInput
                    min={1}
                    max={12}
                    integer
                    emptyValue={1}
                    value={adults}
                    onValueChange={(val) => setAdults(val)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold font-mono-num"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Children:</label>
                  <NumberInput
                    min={0}
                    max={8}
                    integer
                    value={children}
                    onValueChange={(val) => setChildren(val)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-bold font-mono-num"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {checkInDate === todayStr ? (
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={immediateCheckIn}
                    onChange={(e) => setImmediateCheckIn(e.target.checked)}
                    className="rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
                  />
                  <DoorOpen className="h-3.5 w-3.5 text-emerald-700" />
                  <span>
                    {lang === 'ne'
                      ? 'सिधै चेक-इन गर्नुहोस् (Walk-In Guest)'
                      : 'Check-In Immediately (Direct Walk-In)'}
                  </span>
                </label>
              ) : (
                <span />
              )}
              <div className="text-[11px] font-semibold text-emerald-800">
                Selected Duration: <span className="font-black text-slate-900 font-mono-num">{nightsCount} Night{nightsCount > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {/* Room Selection with Availability Filtering */}
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-500">
                2. Select Available Room ({availableRooms.length} available for dates)
              </h4>
              <select
                value={selectedRoomTypeId}
                onChange={(e) => setSelectedRoomTypeId(e.target.value)}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
              >
                <option value="all">All Room Types</option>
                {roomTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>

            {availableRooms.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs">
                No rooms of this type are available for the selected dates. Please adjust dates or select a different room type.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                {availableRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      setCustomRoomRate(room.pricePerNight);
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      selectedRoomId === room.id
                        ? 'border-emerald-800 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600/30'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-black text-sm">Room {room.roomNumber}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded">{room.floor}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{room.roomTypeName}</p>
                    <p className="font-mono-num font-bold text-emerald-800 text-xs mt-1">
                      {settings.currencySymbol} {room.pricePerNight.toFixed(0)} <span className="text-[10px] text-slate-400 font-normal">/ night</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Guest Profile Information */}
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-500">
              3. Guest Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Mobile / WhatsApp:</label>
                <input
                  type="text"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder="e.g. 9841234567"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Guest Name:</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Subash Pokhrel"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Email Address:</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="e.g. guest@example.com"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">City / Address:</label>
                <input
                  type="text"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="Kathmandu / Pokhara"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Country:</label>
                <input
                  type="text"
                  value={guestCountry}
                  onChange={(e) => setGuestCountry(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Booking Source:</label>
                <select
                  value={bookingSource}
                  onChange={(e) => setBookingSource(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="Direct Walk-in">Direct Walk-in</option>
                  <option value="Website">Website Direct</option>
                  <option value="Phone / WhatsApp">Phone / WhatsApp</option>
                  <option value="Booking.com">Booking.com</option>
                  <option value="Agoda">Agoda</option>
                  <option value="Expedia">Expedia</option>
                  <option value="Corporate">Corporate Preferred</option>
                </select>
              </div>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border ${
              immediateCheckIn ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <label className="block text-slate-800 font-bold mb-1">ID Document Type:</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as GuestProfile['idType'])}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="Citizenship">Citizenship (नागरिकता)</option>
                  <option value="Passport">Passport (राहदानी)</option>
                  <option value="Driving License">Driving License (सवारी अनुमति)</option>
                  <option value="National ID">National ID (राष्ट्रिय परिचयपत्र)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-800 font-bold mb-1">ID / Passport Number:</label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 27-01-78-01923 or Passport #"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium font-mono-num"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Deposit */}
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-500">
              4. Pricing, Taxes & Advance Deposit
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nightly Room Rate ({settings.currencySymbol}):</label>
                <NumberInput
                  min={0}
                  value={activeRate}
                  onValueChange={(val) => setCustomRoomRate(val)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Discount Amount ({settings.currencySymbol}):</label>
                <NumberInput
                  min={0}
                  value={discountAmount}
                  onValueChange={(val) => setDiscountAmount(val)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-rose-700"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Advance Deposit ({settings.currencySymbol}):</label>
                <NumberInput
                  min={0}
                  value={depositAmount}
                  onValueChange={(val) => setDepositAmount(val)}
                  className="w-full px-2.5 py-1.5 bg-white border border-emerald-400 rounded-lg font-mono-num font-bold text-emerald-950"
                />
              </div>
            </div>

            {depositAmount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-bold">Deposit Payment Mode:</span>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-md capitalize"
                >
                  <option value="fonepay_qr">Fonepay / QR</option>
                  <option value="cash">Cash</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
            )}

            {/* Calculations Callout */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap justify-between items-center text-xs">
              <div className="space-y-0.5 text-slate-600">
                <p>Nights Subtotal: <span className="font-semibold text-slate-800">{settings.currencySymbol} {subtotal.toFixed(2)}</span></p>
                {settings.enableVat && (
                  <p>13% VAT: <span className="font-semibold text-slate-800">{settings.currencySymbol} {vatAmount.toFixed(2)}</span></p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500 font-bold uppercase">Estimated Total:</p>
                <p className="text-base font-black text-slate-900 font-mono-num">
                  {settings.currencySymbol} {totalAmount.toFixed(2)}
                </p>
                <p className="text-[10px] text-emerald-800 font-semibold">
                  Remaining at Check-in: {settings.currencySymbol} {remainingAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Special Notes / Requests:</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
              placeholder="e.g. Honeymoon setup requested, quiet room, late arrival."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={availableRooms.length === 0}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              {immediateCheckIn && checkInDate === todayStr
                ? (lang === 'ne' ? 'तुरुन्त चेक-इन पूरा गर्नुहोस्' : 'Confirm & Check-In Now')
                : (lang === 'ne' ? 'बुकिङ सुरक्षित गर्नुहोस्' : 'Confirm Reservation')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
