import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Plus, 
  Receipt, 
  CreditCard, 
  Calendar, 
  User, 
  Phone, 
  Sparkles, 
  Trash2, 
  CheckCircle, 
  Clock, 
  DollarSign,
  ArrowRightLeft,
  AlertCircle,
  CalendarPlus,
  Edit3
} from 'lucide-react';
import { 
  BusinessSettings, 
  FolioCategory, 
  GuestFolioItem, 
  HotelPaymentRecord, 
  PaymentMethod, 
  Reservation, 
  ResortRoom, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';
import { ResortInvoiceModal } from './ResortInvoiceModal';
import {
  addDaysLocalYMD,
  computeReservationFolioMetrics,
  formatLocalYMD
} from '../../services/resortSecurity';

interface GuestFolioModalProps {
  reservation: Reservation;
  room?: ResortRoom;
  folioItems: GuestFolioItem[];
  payments: HotelPaymentRecord[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  availableRooms?: ResortRoom[];
  initialAction?: 'charge' | 'payment' | 'reassign' | 'extend';
  onAddFolioCharge: (charge: Omit<GuestFolioItem, 'id'>) => void;
  onRecordPayment: (payment: Omit<HotelPaymentRecord, 'id'>) => void;
  onReassignRoom?: (reservationId: string, newRoomId: string, reason?: string) => void;
  onExtendStay?: (
    reservationId: string,
    newCheckOutDate: string,
    reason?: string
  ) => { ok: boolean; error?: string } | void;
  onOpenEditReservation?: () => void;
  onClose: () => void;
}

export const GuestFolioModal: React.FC<GuestFolioModalProps> = ({
  reservation,
  room,
  folioItems,
  payments,
  settings,
  currentSession,
  lang,
  availableRooms = [],
  initialAction,
  onAddFolioCharge,
  onRecordPayment,
  onReassignRoom,
  onExtendStay,
  onOpenEditReservation,
  onClose
}) => {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showAddChargeForm, setShowAddChargeForm] = useState(initialAction === 'charge');
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(initialAction === 'payment');
  const [showReassignModal, setShowReassignModal] = useState(initialAction === 'reassign');
  const [showExtendStayForm, setShowExtendStayForm] = useState(initialAction === 'extend');
  const [targetRoomId, setTargetRoomId] = useState('');
  const [reassignReason, setReassignReason] = useState('Guest request for room upgrade');
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [extendCheckOutDate, setExtendCheckOutDate] = useState(() =>
    addDaysLocalYMD(reservation.checkOutDate, 1)
  );
  const [extendReason, setExtendReason] = useState('Guest requested stay extension');
  const [extendError, setExtendError] = useState<string | null>(null);

  // New charge state
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeCategory, setChargeCategory] = useState<FolioCategory>('RESTAURANT');
  const [chargeQty, setChargeQty] = useState<number>(1);
  const [chargeUnitPrice, setChargeUnitPrice] = useState<number>(500);

  // New payment state
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Accurate Folio Breakdown (deduplicates payments + deposits)
  const metrics = computeReservationFolioMetrics(folioItems, payments, reservation, settings);
  const {
    roomCharges,
    fbCharges,
    serviceCharges,
    effectivePaid,
    balanceDue
  } = metrics;

  const extraNightsPreview = (() => {
    if (!extendCheckOutDate || extendCheckOutDate <= reservation.checkOutDate) return 0;
    const oldEnd = new Date(reservation.checkOutDate).getTime();
    const newEnd = new Date(extendCheckOutDate).getTime();
    return Math.max(0, Math.round((newEnd - oldEnd) / (1000 * 60 * 60 * 24)));
  })();

  const handleCreateCharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargeDesc.trim() || chargeUnitPrice <= 0) return;

    onAddFolioCharge({
      reservationId: reservation.id,
      roomId: reservation.roomId,
      roomNumber: reservation.roomNumber,
      dateTime: `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`,
      description: chargeDesc.trim(),
      category: chargeCategory,
      quantity: chargeQty,
      unitPrice: chargeUnitPrice,
      totalPrice: chargeUnitPrice * chargeQty,
      addedByStaff: currentSession?.name || 'Staff'
    });

    setChargeDesc('');
    setShowAddChargeForm(false);
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) return;

    onRecordPayment({
      reservationId: reservation.id,
      guestName: reservation.guestName,
      roomNumber: reservation.roomNumber,
      amount: payAmount,
      method: payMethod,
      dateTime: `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`,
      staffName: currentSession?.name || 'Receptionist',
      status: 'completed',
      reference: payReference.trim() || undefined,
      notes: payNotes.trim() || undefined
    });

    setPayAmount(0);
    setPayReference('');
    setShowAddPaymentForm(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-800" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'ne' ? 'अतिथि खाता तथा खर्च विवरण (Guest Folio)' : 'Guest Folio & Transaction Ledger'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Room {reservation.roomNumber} ({reservation.roomTypeName}) · {reservation.guestName} ·{' '}
                  <span className="font-semibold text-slate-700">
                    {reservation.checkInDate}{reservation.checkInTime ? ` ${reservation.checkInTime}` : ''} → {reservation.checkOutDate}{reservation.checkOutTime ? ` ${reservation.checkOutTime}` : ''} ({reservation.nightsCount} Nights)
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Print Folio
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-slate-500">Room Total</span>
                <p className="font-black text-slate-900 font-mono-num text-sm mt-0.5">
                  {settings.currencySymbol} {roomCharges.toFixed(0)}
                </p>
              </div>

              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-amber-800">F&B Total</span>
                <p className="font-black text-amber-950 font-mono-num text-sm mt-0.5">
                  {settings.currencySymbol} {fbCharges.toFixed(0)}
                </p>
              </div>

              <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-purple-800">Services Total</span>
                <p className="font-black text-purple-950 font-mono-num text-sm mt-0.5">
                  {settings.currencySymbol} {serviceCharges.toFixed(0)}
                </p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Balance Due</span>
                <p className="font-black text-emerald-950 font-mono-num text-sm mt-0.5">
                  {settings.currencySymbol} {balanceDue.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Action Bar: Extend Stay, Change Room, Add Charge, Record Payment */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 text-xs block">
                  Ledger Entries ({folioItems.length} charges · {payments.length} payments)
                </span>
                <span className="text-[11px] text-slate-500 font-mono-num">
                  Paid to date: {settings.currencySymbol} {effectivePaid.toFixed(0)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {onOpenEditReservation && (reservation.status === 'CHECKED_IN' || reservation.status === 'CONFIRMED' || reservation.status === 'PENDING') && (
                  <button
                    type="button"
                    onClick={onOpenEditReservation}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-slate-700" />
                    {lang === 'ne' ? 'बुकिङ / दर सम्पादन' : 'Edit Stay / Rate'}
                  </button>
                )}
                {onExtendStay && (reservation.status === 'CHECKED_IN' || reservation.status === 'CONFIRMED') && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowExtendStayForm(!showExtendStayForm);
                      setExtendError(null);
                      setShowAddChargeForm(false);
                      setShowAddPaymentForm(false);
                      setShowReassignModal(false);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                  >
                    <CalendarPlus className="h-3.5 w-3.5 text-emerald-700" />
                    {lang === 'ne' ? 'बसाइ थप्नुहोस्' : 'Extend Stay'}
                  </button>
                )}
                {onReassignRoom && reservation.status === 'CHECKED_IN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowReassignModal(!showReassignModal);
                      setReassignError(null);
                      setShowAddChargeForm(false);
                      setShowAddPaymentForm(false);
                      setShowExtendStayForm(false);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-700" /> Change Room
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddChargeForm(!showAddChargeForm);
                    setShowAddPaymentForm(false);
                    setShowReassignModal(false);
                    setShowExtendStayForm(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Charge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPaymentForm(!showAddPaymentForm);
                    setShowAddChargeForm(false);
                    setShowReassignModal(false);
                    setShowExtendStayForm(false);
                    setPayAmount(balanceDue);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors whitespace-nowrap shrink-0"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Record Payment
                </button>
              </div>
            </div>

            {/* Extend Stay Form */}
            {showExtendStayForm && onExtendStay && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const result = onExtendStay(reservation.id, extendCheckOutDate, extendReason);
                  if (result && !result.ok) {
                    setExtendError(result.error || 'Could not extend stay for selected dates.');
                    return;
                  }
                  setExtendError(null);
                  setShowExtendStayForm(false);
                }}
                className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarPlus className="h-4 w-4 text-emerald-800" />
                    <h4 className="font-bold text-emerald-950 text-xs">
                      Extend Guest Stay · Current Check-Out: {reservation.checkOutDate}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setExtendCheckOutDate(addDaysLocalYMD(reservation.checkOutDate, n));
                          setExtendError(null);
                        }}
                        className="px-2 py-1 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 rounded text-[11px] font-bold font-mono-num"
                      >
                        +{n} Night{n > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-900 mb-0.5">
                      New Check-Out Date:
                    </label>
                    <input
                      type="date"
                      value={extendCheckOutDate}
                      min={addDaysLocalYMD(reservation.checkOutDate, 1)}
                      onChange={(e) => {
                        setExtendCheckOutDate(e.target.value);
                        if (extendError) setExtendError(null);
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-md text-xs font-semibold font-mono-num"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-900 mb-0.5">
                      Extension Note / Reason:
                    </label>
                    <input
                      type="text"
                      value={extendReason}
                      onChange={(e) => setExtendReason(e.target.value)}
                      placeholder="e.g. Guest extended holiday by 2 nights"
                      className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-md text-xs font-medium"
                    />
                  </div>
                </div>

                {extraNightsPreview > 0 && (
                  <div className="p-2 bg-white rounded-lg border border-emerald-200 flex justify-between items-center text-[11px]">
                    <span className="text-slate-600">
                      Adding <strong className="text-slate-900">{extraNightsPreview} extra night{extraNightsPreview > 1 ? 's' : ''}</strong> @ {settings.currencySymbol} {reservation.roomRate}/night
                    </span>
                    <span className="font-mono-num font-black text-emerald-900">
                      +{settings.currencySymbol} {(extraNightsPreview * reservation.roomRate).toFixed(0)} {settings.enableVat ? '(+VAT)' : ''}
                    </span>
                  </div>
                )}

                {extendError && (
                  <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{extendError}</span>
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExtendStayForm(false);
                      setExtendError(null);
                    }}
                    className="px-3 py-1 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={extraNightsPreview <= 0}
                    className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white font-bold rounded-md transition-colors"
                  >
                    Confirm Stay Extension
                  </button>
                </div>
              </form>
            )}

            {/* Quick Add Charge Form */}
            {showAddChargeForm && (
              <form onSubmit={handleCreateCharge} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
                <h4 className="font-bold text-slate-900 text-xs">Post Custom Charge to Folio</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={chargeDesc}
                    onChange={(e) => setChargeDesc(e.target.value)}
                    placeholder="Description (e.g. Laundry 3 items, Extra Pillow)"
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                    required
                  />
                  <select
                    value={chargeCategory}
                    onChange={(e) => setChargeCategory(e.target.value as FolioCategory)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                  >
                    <option value="RESTAURANT">RESTAURANT</option>
                    <option value="CAFE">CAFE</option>
                    <option value="SPA">SPA</option>
                    <option value="LAUNDRY">LAUNDRY</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="BREAKFAST">BREAKFAST</option>
                    <option value="ROOM">ROOM CHARGE</option>
                    <option value="OTHER_SERVICE">OTHER SERVICE</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="1"
                    value={chargeQty}
                    onChange={(e) => setChargeQty(Math.max(1, Number(e.target.value)))}
                    placeholder="Quantity"
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono-num"
                  />
                  <input
                    type="number"
                    min="1"
                    step="50"
                    value={chargeUnitPrice}
                    onChange={(e) => setChargeUnitPrice(Number(e.target.value))}
                    placeholder="Unit Price"
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-mono-num font-bold"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddChargeForm(false)}
                    className="px-3 py-1 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-emerald-800 text-white font-bold rounded-md"
                  >
                    Post Charge
                  </button>
                </div>
              </form>
            )}

            {/* Quick Add Payment Form */}
            {showAddPaymentForm && (
              <form onSubmit={handleCreatePayment} className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in">
                <h4 className="font-bold text-emerald-950 text-xs">Record Payment / Advance Deposit</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-900 mb-0.5">Amount ({settings.currencySymbol}):</label>
                    <input
                      type="number"
                      min="1"
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-400 rounded-md text-xs font-mono-num font-bold text-emerald-950"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-900 mb-0.5">Payment Method:</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-400 rounded-md text-xs font-medium text-slate-800 capitalize"
                    >
                      <option value="cash">Cash (नगद)</option>
                      <option value="fonepay_qr">Fonepay / QR</option>
                      <option value="card">Card / POS</option>
                      <option value="esewa">eSewa</option>
                      <option value="khalti">Khalti</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="Transaction Reference / Note"
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                  />
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Additional notes"
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPaymentForm(false)}
                    className="px-3 py-1 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-emerald-800 text-white font-bold rounded-md"
                  >
                    Record Payment
                  </button>
                </div>
              </form>
            )}

            {/* Room Reassignment Form */}
            {showReassignModal && onReassignRoom && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!targetRoomId) {
                    setReassignError('Please select a target room.');
                    return;
                  }
                  setReassignError(null);
                  onReassignRoom(reservation.id, targetRoomId, reassignReason);
                  setShowReassignModal(false);
                }} 
                className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in"
              >
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-indigo-700" />
                  <h4 className="font-bold text-indigo-950 text-xs">
                    Reassign Guest Stay from Room {reservation.roomNumber} ({reservation.roomTypeName})
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Select Destination Room *:</label>
                    <select
                      value={targetRoomId}
                      onChange={(e) => {
                        setTargetRoomId(e.target.value);
                        if (reassignError) setReassignError(null);
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-md text-xs font-semibold text-slate-900"
                      required
                    >
                      <option value="">-- Choose an Available Room --</option>
                      {availableRooms
                        .filter(r => r.status === 'AVAILABLE' && r.id !== reservation.roomId)
                        .map(r => (
                          <option key={r.id} value={r.id}>
                            Room {r.roomNumber} - {r.roomTypeName} ({settings.currencySymbol} {r.pricePerNight}/night)
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">Reason for Room Move:</label>
                    <input
                      type="text"
                      value={reassignReason}
                      onChange={(e) => setReassignReason(e.target.value)}
                      placeholder="e.g. AC maintenance, room upgrade, quiet floor request"
                      className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-md text-xs font-medium text-slate-800"
                      required
                    />
                  </div>
                </div>

                {reassignError && (
                  <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{reassignError}</span>
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReassignModal(false);
                      setReassignError(null);
                    }}
                    className="px-3 py-1 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-900 hover:bg-black text-white font-bold rounded-md shadow-xs transition-colors"
                  >
                    Confirm Room Transfer
                  </button>
                </div>
              </form>
            )}

            {/* Folio Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3">Date/Time</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 text-center">Category</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {folioItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                        No charges posted yet.
                      </td>
                    </tr>
                  ) : (
                    folioItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                          {item.dateTime}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {item.description}
                          {item.referenceId && (
                            <span className="block text-[10px] text-slate-400">Order #{item.referenceId}</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.category === 'ROOM' ? 'bg-indigo-50 text-indigo-800' :
                            item.category === 'RESTAURANT' ? 'bg-amber-50 text-amber-800' :
                            item.category === 'CAFE' ? 'bg-emerald-50 text-emerald-800' :
                            item.category === 'SPA' ? 'bg-purple-50 text-purple-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono-num font-semibold text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num text-slate-600">
                          {settings.currencySymbol} {item.unitPrice.toFixed(0)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900">
                          {settings.currencySymbol} {item.totalPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {item.addedByStaff}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Payments List */}
            {payments.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 pt-3">
                <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-500">
                  Recorded Payments & Deposits
                </h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/50">
                  {payments.map((p) => (
                    <div key={p.id} className="p-2.5 px-3 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 capitalize">{p.method.replace('_', ' ')} Payment</p>
                        <p className="text-[10px] text-slate-400">{p.dateTime} · By {p.staffName}{p.reference ? ` · Ref: ${p.reference}` : ''}</p>
                      </div>
                      <span className="font-mono-num font-bold text-emerald-800">
                        +{settings.currencySymbol} {p.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showInvoiceModal && (
        <ResortInvoiceModal
          reservation={reservation}
          room={room}
          folioItems={folioItems}
          payments={payments}
          settings={settings}
          lang={lang}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </>
  );
};
