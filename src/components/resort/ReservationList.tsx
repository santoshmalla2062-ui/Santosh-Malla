import React, { useState } from 'react';
import { 
  Calendar, 
  Search, 
  Plus, 
  DoorOpen, 
  DoorClosed, 
  Receipt, 
  XCircle, 
  Filter, 
  User, 
  Phone, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import { 
  BusinessSettings, 
  Reservation, 
  ReservationStatus, 
  ResortRoom, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';

interface ReservationListProps {
  reservations: Reservation[];
  rooms: ResortRoom[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onOpenCheckIn: (reservation: Reservation) => void;
  onOpenCheckOut: (reservation: Reservation) => void;
  onOpenFolio: (reservation: Reservation) => void;
  onCancelReservation: (reservationId: string, reason: string) => void;
  onOpenNewBooking: () => void;
}

export const ReservationList: React.FC<ReservationListProps> = ({
  reservations,
  rooms,
  settings,
  currentSession,
  lang,
  onOpenCheckIn,
  onOpenCheckOut,
  onOpenFolio,
  onCancelReservation,
  onOpenNewBooking
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingResId, setCancellingResId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const filtered = reservations.filter(res => {
    if (statusFilter !== 'all' && res.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = res.guestName.toLowerCase().includes(q);
      const matchPhone = res.guestPhone.toLowerCase().includes(q);
      const matchRoom = res.roomNumber.toLowerCase().includes(q);
      const matchId = res.id.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchRoom && !matchId) return false;
    }
    return true;
  });

  const getStatusBadge = (status: ReservationStatus) => {
    switch (status) {
      case 'CHECKED_IN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">CHECKED IN</span>;
      case 'CONFIRMED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">CONFIRMED</span>;
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">PENDING</span>;
      case 'CHECKED_OUT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">CHECKED OUT</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">CANCELLED</span>;
      case 'NO_SHOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">NO SHOW</span>;
    }
  };

  const handleConfirmCancel = (resId: string) => {
    if (!cancelReason.trim()) {
      setCancelError('Please provide a reason for cancellation.');
      return;
    }
    setCancelError(null);
    onCancelReservation(resId, cancelReason.trim());
    setCancellingResId(null);
    setCancelReason('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-800" />
            {lang === 'ne' ? 'रिजर्भेसन तथा बुकिङ सूची (Reservations Ledger)' : 'Guest Reservations & Bookings Ledger'}
          </h2>
          <p className="text-xs text-slate-500">
            Manage incoming arrivals, in-house guests, cancellations, and advance deposits
          </p>
        </div>

        <button
          onClick={onOpenNewBooking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Reservation
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 border-t border-slate-100 pt-3 text-xs">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by guest name, phone, room number, or booking ID..."
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
        >
          <option value="all">All Reservation Statuses ({reservations.length})</option>
          <option value="CONFIRMED">CONFIRMED (आगमन बाँकी)</option>
          <option value="CHECKED_IN">CHECKED IN (हाल बसेको)</option>
          <option value="PENDING">PENDING (पेन्डिङ)</option>
          <option value="CHECKED_OUT">CHECKED OUT (गइसकेको)</option>
          <option value="CANCELLED">CANCELLED (रद्द)</option>
        </select>
      </div>

      {/* Reservations Table */}
      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[750px]">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
              <th className="py-2.5 px-3">Booking ID</th>
              <th className="py-2.5 px-3">Guest Details</th>
              <th className="py-2.5 px-3">Room & Type</th>
              <th className="py-2.5 px-3">Dates (Nights)</th>
              <th className="py-2.5 px-3 text-right">Total ({settings.currencySymbol})</th>
              <th className="py-2.5 px-3 text-right">Paid / Balance</th>
              <th className="py-2.5 px-2 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                  No reservations found matching the filters.
                </td>
              </tr>
            ) : (
              filtered.map((res) => {
                const isCancelling = cancellingResId === res.id;

                return (
                  <tr key={res.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono-num font-bold text-slate-700">
                      {res.id}
                      <span className="block text-[10px] text-slate-400 font-normal">{res.bookingSource}</span>
                    </td>

                    <td className="py-2.5 px-3">
                      <p className="font-bold text-slate-900">{res.guestName}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" /> {res.guestPhone}
                      </p>
                    </td>

                    <td className="py-2.5 px-3">
                      <span className="font-black text-slate-900">Room {res.roomNumber}</span>
                      <span className="block text-[10px] text-slate-500">{res.roomTypeName}</span>
                    </td>

                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                      <p><span className="font-semibold text-slate-800">{res.checkInDate}</span> to <span className="font-semibold text-slate-800">{res.checkOutDate}</span></p>
                      <p className="text-[10px] text-slate-400">{res.nightsCount} Nights · {res.adults} Adults</p>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono-num font-bold text-slate-900">
                      {res.totalAmount.toFixed(2)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono-num">
                      <span className="font-bold text-emerald-800 block">
                        Paid: {res.paidAmount.toFixed(0)}
                      </span>
                      {res.remainingAmount > 0 ? (
                        <span className="text-[10px] text-rose-700 font-semibold block">
                          Due: {res.remainingAmount.toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-700 block">Fully Paid</span>
                      )}
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      {getStatusBadge(res.status)}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {res.status === 'CONFIRMED' && (
                          <button
                            onClick={() => onOpenCheckIn(res)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-2xs flex items-center gap-1"
                            title="Check-In Guest"
                          >
                            <DoorOpen className="h-3 w-3" /> Check-In
                          </button>
                        )}

                        {res.status === 'CHECKED_IN' && (
                          <>
                            <button
                              onClick={() => onOpenFolio(res)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] flex items-center gap-1"
                              title="View Guest Folio"
                            >
                              <Receipt className="h-3 w-3" /> Folio
                            </button>
                            <button
                              onClick={() => onOpenCheckOut(res)}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] shadow-2xs flex items-center gap-1"
                              title="Settle & Check-Out"
                            >
                              <DoorClosed className="h-3 w-3" /> Check-Out
                            </button>
                          </>
                        )}

                        {(res.status === 'CONFIRMED' || res.status === 'PENDING') && (
                          <button
                            onClick={() => {
                              setCancellingResId(isCancelling ? null : res.id);
                              setCancelReason('');
                              setCancelError(null);
                            }}
                            className="px-2 py-1 text-rose-700 hover:bg-rose-50 rounded text-[11px] font-semibold"
                          >
                            Cancel
                          </button>
                        )}

                        {res.status === 'CHECKED_OUT' && (
                          <button
                            onClick={() => onOpenFolio(res)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] flex items-center gap-1"
                          >
                            <Receipt className="h-3 w-3" /> View Folio
                          </button>
                        )}
                      </div>

                      {/* Cancel Input Collapse */}
                      {isCancelling && (
                        <div className="mt-2 p-2 bg-rose-50 rounded-lg border border-rose-200 text-left space-y-1.5 animate-in fade-in">
                          <label className="block text-[10px] font-bold text-rose-900">Cancellation Reason:</label>
                          <input
                            type="text"
                            value={cancelReason}
                            onChange={(e) => {
                              setCancelReason(e.target.value);
                              if (cancelError) setCancelError(null);
                            }}
                            placeholder="e.g. Flight cancelled, guest requested change"
                            className="w-full px-2 py-1 bg-white border border-rose-300 rounded text-xs"
                            required
                          />
                          {cancelError && (
                            <p className="text-[10px] font-semibold text-rose-700 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span>{cancelError}</span>
                            </p>
                          )}
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => {
                                setCancellingResId(null);
                                setCancelError(null);
                              }}
                              className="px-2 py-0.5 text-[10px] text-slate-600"
                            >
                              Close
                            </button>
                            <button
                              onClick={() => handleConfirmCancel(res.id)}
                              className="px-2.5 py-0.5 bg-rose-700 text-white font-bold rounded text-[10px]"
                            >
                              Confirm Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
