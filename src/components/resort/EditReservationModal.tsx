import React, { useMemo, useState } from 'react';
import {
  X,
  Edit3,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  User
} from 'lucide-react';
import {
  BusinessSettings,
  GuestProfile,
  Reservation,
  ResortRoom
} from '../../types';
import { Language } from '../../utils/translations';
import { NumberInput } from '../common/NumberInput';

export interface ReservationEditPayload {
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestAddress?: string;
  guestCountry?: string;
  idType?: GuestProfile['idType'];
  idNumber?: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  adults: number;
  children: number;
  roomRate: number;
  discountAmount: number;
  bookingSource: Reservation['bookingSource'];
  notes?: string;
}

interface EditReservationModalProps {
  reservation: Reservation;
  guestProfile?: GuestProfile;
  rooms: ResortRoom[];
  existingReservations: Reservation[];
  settings: BusinessSettings;
  lang: Language;
  onSave: (reservationId: string, updates: ReservationEditPayload) => void;
  onClose: () => void;
}

export const EditReservationModal: React.FC<EditReservationModalProps> = ({
  reservation,
  guestProfile,
  rooms,
  existingReservations,
  settings,
  lang,
  onSave,
  onClose
}) => {
  const defaultCheckInTime = settings.hotelCheckInTime || '14:00';
  const defaultCheckOutTime = settings.hotelCheckOutTime || '12:00';

  const [guestName, setGuestName] = useState(reservation.guestName);
  const [guestPhone, setGuestPhone] = useState(reservation.guestPhone);
  const [guestEmail, setGuestEmail] = useState(reservation.guestEmail || guestProfile?.email || '');
  const [guestAddress, setGuestAddress] = useState(
    reservation.guestAddress || guestProfile?.address || ''
  );
  const [guestCountry, setGuestCountry] = useState(
    reservation.guestCountry || guestProfile?.country || 'Nepal'
  );
  const [idType, setIdType] = useState<GuestProfile['idType']>(
    reservation.idType || guestProfile?.idType || 'Citizenship'
  );
  const [idNumber, setIdNumber] = useState(reservation.idNumber || guestProfile?.idNumber || '');

  const [roomId, setRoomId] = useState(reservation.roomId);
  const [checkInDate, setCheckInDate] = useState(reservation.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(reservation.checkOutDate);
  const [checkInTime, setCheckInTime] = useState(reservation.checkInTime || defaultCheckInTime);
  const [checkOutTime, setCheckOutTime] = useState(reservation.checkOutTime || defaultCheckOutTime);
  const [adults, setAdults] = useState(reservation.adults);
  const [children, setChildren] = useState(reservation.children);
  const [roomRate, setRoomRate] = useState(reservation.roomRate);
  const [discountAmount, setDiscountAmount] = useState(reservation.discountAmount || 0);
  const [bookingSource, setBookingSource] = useState<Reservation['bookingSource']>(
    reservation.bookingSource
  );
  const [notes, setNotes] = useState(reservation.notes || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const nightsCount = useMemo(() => {
    if (!checkInDate || !checkOutDate) return Math.max(1, reservation.nightsCount);
    const start = new Date(checkInDate).getTime();
    const end = new Date(checkOutDate).getTime();
    return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  }, [checkInDate, checkOutDate, reservation.nightsCount]);

  const roomSubtotal = Math.max(0, roomRate * nightsCount);
  const taxableRoomAndExtras = Math.max(0, roomSubtotal + (reservation.extraCharges || 0) - discountAmount);
  const estimatedVat = settings.enableVat
    ? Math.round(taxableRoomAndExtras * ((settings.vatRatePercent || 13) / 100) * 100) / 100
    : 0;
  const estimatedTotal = Math.round((taxableRoomAndExtras + estimatedVat) * 100) / 100;
  const estimatedDue = Math.max(0, Math.round((estimatedTotal - reservation.paidAmount) * 100) / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!guestName.trim() || !guestPhone.trim()) {
      setValidationError(
        lang === 'ne' ? 'पाहुनाको नाम र फोन अनिवार्य छ।' : 'Guest name and phone number are required.'
      );
      return;
    }

    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      setValidationError(
        lang === 'ne'
          ? 'चेक-आउट मिति चेक-इन मिति भन्दा पछि हुनुपर्छ।'
          : 'Check-out date must be after check-in date.'
      );
      return;
    }

    const selectedRoom = rooms.find((r) => r.id === roomId);
    if (!selectedRoom) {
      setValidationError('Selected room was not found.');
      return;
    }

    if (selectedRoom.status === 'OUT_OF_SERVICE' && selectedRoom.id !== reservation.roomId) {
      setValidationError(`Room ${selectedRoom.roomNumber} is currently Out of Service.`);
      return;
    }

    const hasConflict = existingReservations.some((other) => {
      if (other.id === reservation.id) return false;
      if (other.roomId !== roomId) return false;
      if (other.status === 'CANCELLED' || other.status === 'CHECKED_OUT' || other.status === 'NO_SHOW') {
        return false;
      }
      return other.checkInDate < checkOutDate && other.checkOutDate > checkInDate;
    });

    if (hasConflict) {
      setValidationError(
        lang === 'ne'
          ? `कोठा ${selectedRoom.roomNumber} यी मितिमा पहिले नै बुक भइसकेको छ।`
          : `Room ${selectedRoom.roomNumber} has another booking overlapping these dates.`
      );
      return;
    }

    onSave(reservation.id, {
      guestName: guestName.trim(),
      guestPhone: guestPhone.trim(),
      guestEmail: guestEmail.trim() || undefined,
      guestAddress: guestAddress.trim() || undefined,
      guestCountry: guestCountry.trim() || 'Nepal',
      idType,
      idNumber: idNumber.trim() || undefined,
      roomId,
      checkInDate,
      checkOutDate,
      checkInTime: checkInTime || defaultCheckInTime,
      checkOutTime: checkOutTime || defaultCheckOutTime,
      adults: Math.max(1, adults),
      children: Math.max(0, children),
      roomRate: Math.max(0, roomRate),
      discountAmount: Math.max(0, discountAmount),
      bookingSource,
      notes: notes.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-800">
              <Edit3 className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {lang === 'ne'
                  ? 'बसाइ, पाहुना र कोठा दर सम्पादन (Edit Stay)'
                  : 'Edit Reservation, Guest & Room Rate'}
              </h3>
              <p className="text-[11px] text-slate-300">
                Room {reservation.roomNumber} · {reservation.status}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Stay Dates & Timings */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-700" />
              <span>
                {lang === 'ne' ? 'बसाइ मिति र चेक-इन/आउट समय' : 'Stay Dates, Timings & Room'}
              </span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Check-In Date</label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" /> Check-In Time
                </label>
                <input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Check-Out Date</label>
                <input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" /> Check-Out Time
                </label>
                <input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Room Assigned</label>
                <select
                  value={roomId}
                  onChange={(e) => {
                    setRoomId(e.target.value);
                    const nextRm = rooms.find((r) => r.id === e.target.value);
                    if (nextRm && roomRate === reservation.roomRate) {
                      setRoomRate(nextRm.pricePerNight);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} · {rm.roomTypeName} ({settings.currencySymbol}{' '}
                      {rm.pricePerNight})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Adults / Children</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <NumberInput
                    min={1}
                    integer
                    value={adults}
                    onValueChange={(val) => setAdults(val)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num"
                    title="Adults"
                  />
                  <NumberInput
                    min={0}
                    integer
                    value={children}
                    onValueChange={(val) => setChildren(val)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num"
                    title="Children"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Booking Source</label>
                <select
                  value={bookingSource}
                  onChange={(e) => setBookingSource(e.target.value as Reservation['bookingSource'])}
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
          </div>

          {/* Guest Details */}
          <div className="space-y-2.5 border-t border-slate-200 pt-3">
            <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-emerald-700" />
              <span>{lang === 'ne' ? 'पाहुना विवरण' : 'Guest Details & ID'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Guest Name *</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="City / Street"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={guestCountry}
                  onChange={(e) => setGuestCountry(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ID Type</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as GuestProfile['idType'])}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                >
                  <option value="Citizenship">Citizenship</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                  <option value="National ID">National ID</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ID Number</label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="Doc No."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
            </div>
          </div>

          {/* Pricing & Rate */}
          <div className="space-y-2.5 border-t border-slate-200 pt-3">
            <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              {lang === 'ne' ? 'कोठा दर र छुट (Rate & Discount)' : 'Room Rate & Pricing'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nightly Room Rate ({settings.currencySymbol})
                </label>
                <NumberInput
                  min={0}
                  value={roomRate}
                  onValueChange={(val) => setRoomRate(val)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Discount ({settings.currencySymbol})
                </label>
                <NumberInput
                  min={0}
                  value={discountAmount}
                  onValueChange={(val) => setDiscountAmount(val)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-rose-700"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5 text-slate-600">
                <p>
                  {nightsCount} Night{nightsCount > 1 ? 's' : ''} × {settings.currencySymbol}{' '}
                  {roomRate.toFixed(0)} ={' '}
                  <span className="font-bold text-slate-900">
                    {settings.currencySymbol} {roomSubtotal.toFixed(0)}
                  </span>
                </p>
                {reservation.extraCharges > 0 && (
                  <p>
                    Extras / F&B:{' '}
                    <span className="font-semibold text-slate-800">
                      {settings.currencySymbol} {reservation.extraCharges.toFixed(0)}
                    </span>
                  </p>
                )}
              </div>
              <div className="text-right font-mono-num">
                <p className="font-black text-slate-900 text-sm">
                  Total: {settings.currencySymbol} {estimatedTotal.toFixed(2)}
                </p>
                <p className="text-[11px] text-emerald-800 font-semibold">
                  Paid: {settings.currencySymbol} {reservation.paidAmount.toFixed(0)} · Due:{' '}
                  {settings.currencySymbol} {estimatedDue.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Notes / Special Requests</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              {lang === 'ne' ? 'परिवर्तन सेभ गर्नुहोस्' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
