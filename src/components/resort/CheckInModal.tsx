import React, { useMemo, useState } from 'react';
import {
  X,
  DoorOpen,
  AlertCircle,
  Check,
  ShieldCheck
} from 'lucide-react';
import {
  BusinessSettings,
  GuestProfile,
  PaymentMethod,
  Reservation,
  ResortRoom,
  Session
} from '../../types';
import { Language } from '../../utils/translations';
import { NumberInput } from '../common/NumberInput';

export interface CheckInGuestStayUpdates {
  guestName?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  idType?: GuestProfile['idType'];
  idNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  roomRate?: number;
}

interface CheckInModalProps {
  reservation: Reservation;
  room?: ResortRoom;
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onConfirmCheckIn: (
    reservationId: string,
    roomId: string,
    depositAmount: number,
    paymentMethod: PaymentMethod,
    guestUpdates?: CheckInGuestStayUpdates,
    notes?: string
  ) => void;
  onClose: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  reservation,
  room,
  settings,
  currentSession,
  lang,
  onConfirmCheckIn,
  onClose
}) => {
  const [guestName, setGuestName] = useState(reservation.guestName);
  const [guestPhone, setGuestPhone] = useState(reservation.guestPhone);
  const [guestEmail, setGuestEmail] = useState(reservation.guestEmail || '');
  const [guestAddress, setGuestAddress] = useState(reservation.guestAddress || '');
  const [guestCountry, setGuestCountry] = useState(reservation.guestCountry || 'Nepal');
  const [idType, setIdType] = useState<GuestProfile['idType']>(reservation.idType || 'Citizenship');
  const [idNumber, setIdNumber] = useState(reservation.idNumber || '');

  const [checkInDate, setCheckInDate] = useState(reservation.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(reservation.checkOutDate);
  const [checkInTime, setCheckInTime] = useState(
    reservation.checkInTime || settings.hotelCheckInTime || '14:00'
  );
  const [checkOutTime, setCheckOutTime] = useState(
    reservation.checkOutTime || settings.hotelCheckOutTime || '12:00'
  );
  const [roomRate, setRoomRate] = useState<number>(reservation.roomRate);

  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('cash');
  const [checkInNotes, setCheckInNotes] = useState(reservation.notes || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [allowDirtyOverride, setAllowDirtyOverride] = useState(false);

  const nightsCount = useMemo(() => {
    if (!checkInDate || !checkOutDate) return reservation.nightsCount || 1;
    const diff = Math.ceil(
      (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(1, diff);
  }, [checkInDate, checkOutDate, reservation.nightsCount]);

  const estimatedTotal = useMemo(() => {
    const subtotal = Math.max(0, roomRate) * nightsCount;
    const taxable = Math.max(0, subtotal - (reservation.discountAmount || 0) + (reservation.extraCharges || 0));
    const vat = settings.enableVat ? taxable * ((settings.vatRatePercent || 13) / 100) : 0;
    return Math.round((taxable + vat) * 100) / 100;
  }, [roomRate, nightsCount, reservation.discountAmount, reservation.extraCharges, settings]);

  // Check room readiness
  const isRoomDirty = room?.status === 'DIRTY' || room?.status === 'CLEANING';
  const isRoomMaintenance = room?.status === 'MAINTENANCE' || room?.status === 'OUT_OF_SERVICE';
  const isRoomOccupied = room?.status === 'OCCUPIED' && room.currentReservationId !== reservation.id;

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!guestName.trim() || !guestPhone.trim()) {
      setValidationError('Guest full name and contact phone are required.');
      return;
    }

    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      setValidationError('Check-out date must be after check-in date.');
      return;
    }

    if (roomRate < 0) {
      setValidationError('Nightly room rate cannot be negative.');
      return;
    }

    if (isRoomOccupied) {
      setValidationError('Cannot check in: This room is currently occupied by another guest.');
      return;
    }

    if (isRoomMaintenance) {
      setValidationError('Cannot check in: This room is currently under maintenance or out of service.');
      return;
    }

    if (isRoomDirty && !allowDirtyOverride) {
      setValidationError(
        `Room ${room?.roomNumber} is currently marked ${room?.status}. Tick the supervisor override box above to proceed with early check-in.`
      );
      return;
    }

    onConfirmCheckIn(
      reservation.id,
      reservation.roomId,
      depositAmount,
      depositMethod,
      {
        guestName: guestName.trim(),
        phone: guestPhone.trim(),
        email: guestEmail.trim(),
        address: guestAddress.trim(),
        country: guestCountry.trim() || 'Nepal',
        idType,
        idNumber: idNumber.trim(),
        checkInDate,
        checkOutDate,
        checkInTime,
        checkOutTime,
        roomRate: Number(roomRate) || 0
      },
      checkInNotes
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-800">
              <DoorOpen className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {lang === 'ne' ? 'अतिथि चेक-इन (Guest Check-In)' : 'Guest Arrival & Check-In'}
              </h3>
              <p className="text-emerald-200 text-[11px]">
                Room {reservation.roomNumber} · {reservation.roomTypeName} · Booking #{reservation.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCheckInSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto text-xs">
          {/* Room Readiness Status Banner */}
          {room && (
            <div className={`p-3 rounded-lg border space-y-2 ${
              room.status === 'AVAILABLE' || room.status === 'RESERVED' || room.status === 'CLEAN'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : room.status === 'CLEANING' || room.status === 'DIRTY'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-bold">
                    Room {room.roomNumber} Status: {room.status}
                  </span>
                </div>
                <span className="text-[11px] font-semibold">
                  Floor: {room.floor}
                </span>
              </div>

              {isRoomDirty && (
                <label className="flex items-center gap-2 pt-2 border-t border-amber-200/80 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowDirtyOverride}
                    onChange={(e) => {
                      setAllowDirtyOverride(e.target.checked);
                      if (e.target.checked && validationError) setValidationError(null);
                    }}
                    className="rounded border-amber-400 text-amber-700 focus:ring-amber-600"
                  />
                  <span>
                    {lang === 'ne'
                      ? 'सरसफाइ पूरा नभए पनि चेक-इन अनुमति दिनुहोस् (Supervisor Override)'
                      : 'Supervisor Override: Proceed with check-in before housekeeping completion'}
                  </span>
                </label>
              )}
            </div>
          )}

          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Stay Dates, Timings & Editable Room Rate */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                {lang === 'ne' ? '१. बसाइ मिति, समय र कोठा दर' : '1. Stay Dates, Timings & Rate'}
              </h4>
              <span className="text-[11px] font-bold text-emerald-900 font-mono-num">
                {nightsCount} Night{nightsCount > 1 ? 's' : ''} · Est. {settings.currencySymbol} {estimatedTotal.toFixed(0)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Check-In Date &amp; Time:</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                    required
                  />
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-22 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Check-Out Date &amp; Time:</label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={checkOutDate}
                    min={checkInDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                    required
                  />
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-22 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nightly Room Rate ({settings.currencySymbol}):
                </label>
                <NumberInput
                  min={0}
                  value={roomRate}
                  onValueChange={(val) => setRoomRate(val)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-900"
                  required
                />
              </div>
            </div>

            {reservation.paidAmount > 0 && (
              <div className="text-[11px] bg-emerald-100/70 border border-emerald-200 text-emerald-900 rounded p-1.5 font-bold flex justify-between">
                <span>Advance Deposit Already Paid:</span>
                <span>{settings.currencySymbol} {reservation.paidAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Guest Details & Identity Verification (Fully Editable) */}
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              {lang === 'ne' ? '२. पाहुना विवरण र परिचयपत्र' : '2. Guest Details & Identity Verification'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Full Guest Name *:</label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Contact Phone *:</label>
                <input
                  type="text"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Email:</label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="guest@example.com"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Address / City:</label>
                <input
                  type="text"
                  value={guestAddress}
                  onChange={(e) => setGuestAddress(e.target.value)}
                  placeholder="Kathmandu / Pokhara"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Country:</label>
                <input
                  type="text"
                  value={guestCountry}
                  onChange={(e) => setGuestCountry(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">ID / Document Type:</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value as GuestProfile['idType'])}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                >
                  <option value="Citizenship">Citizenship (नागरिकता)</option>
                  <option value="Passport">Passport (राहदानी)</option>
                  <option value="Driving License">Driving License (सवारी अनुमति)</option>
                  <option value="National ID">National ID (राष्ट्रिय परिचयपत्र)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">ID / Document Number:</label>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 27-01-78-01923 or Passport No."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium font-mono-num text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Deposit Collection at Check-In */}
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              3. Collect Security Deposit / Advance (Optional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Deposit Amount ({settings.currencySymbol}):
                </label>
                <NumberInput
                  min={0}
                  value={depositAmount}
                  onValueChange={(val) => setDepositAmount(val)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold font-mono-num text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Payment Method:
                </label>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 capitalize"
                >
                  <option value="cash">Cash (नगद)</option>
                  <option value="fonepay_qr">Fonepay / QR</option>
                  <option value="card">Card / POS Terminal</option>
                  <option value="esewa">eSewa Wallet</option>
                  <option value="khalti">Khalti Wallet</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Check-In Notes / Special Requests:
            </label>
            <textarea
              rows={2}
              value={checkInNotes}
              onChange={(e) => setCheckInNotes(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
              placeholder="e.g. Late checkout requested, feather pillows provided, breakfast time 8:00 AM."
            />
          </div>

          <div className="flex justify-between items-center border-t border-slate-200 pt-4">
            <span className="text-slate-500 text-[11px]">
              Assigned Staff: <span className="font-semibold text-slate-800">{currentSession?.name || 'Receptionist'}</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRoomOccupied || isRoomMaintenance}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                Confirm & Check-In
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
