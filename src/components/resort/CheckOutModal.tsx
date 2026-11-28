import React, { useState } from 'react';
import { 
  X, 
  DoorClosed, 
  CreditCard, 
  Check, 
  Printer, 
  AlertCircle, 
  Banknote, 
  QrCode, 
  Building, 
  CheckCircle, 
  Sparkles, 
  FileText 
} from 'lucide-react';
import { 
  BusinessSettings, 
  GuestFolioItem, 
  HotelPaymentRecord, 
  PaymentMethod, 
  Reservation, 
  ResortRoom, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';
import { NumberInput } from '../common/NumberInput';
import { ResortInvoiceModal } from './ResortInvoiceModal';
import { computeReservationFolioMetrics } from '../../services/resortSecurity';

interface CheckOutModalProps {
  reservation: Reservation;
  room?: ResortRoom;
  folioItems: GuestFolioItem[];
  payments: HotelPaymentRecord[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onConfirmCheckOut: (
    reservationId: string,
    roomId: string,
    settlementAmount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => void;
  onClose: () => void;
}

export const CheckOutModal: React.FC<CheckOutModalProps> = ({
  reservation,
  room,
  folioItems,
  payments,
  settings,
  currentSession,
  lang,
  onConfirmCheckOut,
  onClose
}) => {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmPartialCheckout, setConfirmPartialCheckout] = useState(false);

  // Unified accurate folio calculations (prevents payment double-counting)
  const metrics = computeReservationFolioMetrics(folioItems, payments, reservation, settings);
  const {
    roomCharges,
    fbCharges,
    serviceCharges,
    grandTotal,
    effectivePaid,
    balanceDue
  } = metrics;

  const [settlementAmount, setSettlementAmount] = useState<number>(balanceDue);

  const handleProcessCheckOut = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (settlementAmount < 0 || Number.isNaN(settlementAmount)) {
      setValidationError('Settlement amount must be zero or positive.');
      return;
    }

    if (balanceDue > 0.01 && settlementAmount < balanceDue - 0.01 && !confirmPartialCheckout) {
      setConfirmPartialCheckout(true);
      return;
    }

    onConfirmCheckOut(
      reservation.id,
      reservation.roomId,
      settlementAmount,
      selectedMethod,
      checkoutNotes
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-slate-800">
                <DoorClosed className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm">
                  {lang === 'ne' ? 'अतिथि चेक-आउट तथा बिल चुक्ता (Guest Check-Out & Folio Settlement)' : 'Guest Check-Out & Folio Settlement'}
                </h3>
                <p className="text-slate-300 text-[11px]">
                  Room {reservation.roomNumber} ({reservation.roomTypeName}) · Guest: {reservation.guestName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleProcessCheckOut} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Folio Financial Breakdown Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <p className="text-[10px] uppercase font-bold text-slate-500">Room Charges</p>
                <p className="text-sm font-black text-slate-900 font-mono-num mt-0.5">
                  {settings.currencySymbol} {roomCharges.toFixed(0)}
                </p>
                <p className="text-[10px] text-slate-400">{reservation.nightsCount} Nights</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-amber-50/50">
                <p className="text-[10px] uppercase font-bold text-amber-800">F&B Dining</p>
                <p className="text-sm font-black text-amber-950 font-mono-num mt-0.5">
                  {settings.currencySymbol} {fbCharges.toFixed(0)}
                </p>
                <p className="text-[10px] text-amber-700">From POS & Cafe</p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-purple-50/50">
                <p className="text-[10px] uppercase font-bold text-purple-800">Extra Services</p>
                <p className="text-sm font-black text-purple-950 font-mono-num mt-0.5">
                  {settings.currencySymbol} {serviceCharges.toFixed(0)}
                </p>
                <p className="text-[10px] text-purple-700">Spa / Laundry / Tour</p>
              </div>

              <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50">
                <p className="text-[10px] uppercase font-bold text-emerald-800">Grand Total</p>
                <p className="text-sm font-black text-emerald-950 font-mono-num mt-0.5">
                  {settings.currencySymbol} {grandTotal.toFixed(0)}
                </p>
                <p className="text-[10px] text-emerald-700">Incl. VAT</p>
              </div>
            </div>

            {/* Itemized Folio Preview with Print Button */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100/80 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                <span className="font-bold text-slate-700">
                  Guest Folio Items ({folioItems.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border border-slate-300 rounded font-semibold text-[11px] transition-colors"
                >
                  <Printer className="h-3 w-3" />
                  View & Print Full Invoice
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                {folioItems.map((item) => (
                  <div key={item.id} className="p-2.5 px-4 flex justify-between items-center text-[11px] hover:bg-slate-50/60">
                    <div>
                      <p className="font-semibold text-slate-800">{item.description}</p>
                      <p className="text-[10px] text-slate-400">{item.dateTime} · By {item.addedByStaff}</p>
                    </div>
                    <span className="font-mono-num font-bold text-slate-900">
                      {settings.currencySymbol} {item.totalPrice.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Settlement Box */}
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase font-bold text-emerald-800 tracking-wide">
                    Outstanding Folio Balance:
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black text-emerald-950 font-mono-num">
                      {settings.currencySymbol} {balanceDue.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-emerald-700 ml-2">
                      (Paid: {settings.currencySymbol} {effectivePaid.toFixed(2)})
                    </span>
                  </div>
                </div>

                {balanceDue === 0 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-200 text-emerald-900 rounded-lg font-bold text-xs">
                    <CheckCircle className="h-4 w-4" />
                    PAID IN FULL
                  </div>
                ) : (
                  <div className="w-44">
                    <label className="block text-[11px] font-bold text-emerald-900 mb-0.5">
                      Amount Paying Now:
                    </label>
                    <NumberInput
                      min={0}
                      max={balanceDue}
                      value={settlementAmount}
                      onValueChange={(val) => {
                        setSettlementAmount(val);
                        if (confirmPartialCheckout) setConfirmPartialCheckout(false);
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-400 rounded-md font-mono-num font-bold text-emerald-950"
                    />
                  </div>
                )}
              </div>

              {confirmPartialCheckout && balanceDue > settlementAmount && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-[11px]">
                      <p className="font-bold">
                        {lang === 'ne' ? 'आंशिक भुक्तानी चेतावनी' : 'Outstanding Balance Confirmation'}
                      </p>
                      <p className="mt-0.5">
                        Remaining unpaid balance is{' '}
                        <strong className="font-mono-num">
                          {settings.currencySymbol} {(balanceDue - settlementAmount).toFixed(2)}
                        </strong>
                        . Click <strong>Confirm Partial Check-Out</strong> below to complete checkout anyway, or update Amount Paying Now.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSettlementAmount(balanceDue);
                        setConfirmPartialCheckout(false);
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded text-[11px] font-semibold hover:bg-slate-50"
                    >
                      Pay Full ({settings.currencySymbol} {balanceDue.toFixed(0)})
                    </button>
                  </div>
                </div>
              )}

              {balanceDue > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Payment Method for Final Settlement:
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'fonepay_qr', label: 'Fonepay', icon: QrCode },
                      { id: 'card', label: 'Card/POS', icon: CreditCard },
                      { id: 'esewa', label: 'eSewa', icon: Sparkles },
                      { id: 'khalti', label: 'Khalti', icon: Sparkles },
                      { id: 'bank', label: 'Bank', icon: Building }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMethod(m.id as PaymentMethod)}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          selectedMethod === m.id
                            ? 'border-emerald-800 bg-white text-emerald-950 font-bold ring-2 ring-emerald-600/30'
                            : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700 font-medium'
                        }`}
                      >
                        <m.icon className="h-4 w-4 mx-auto mb-1 text-slate-600" />
                        <span className="text-[10px]">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Room Turnover Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
                Automatic Housekeeping Trigger:
              </p>
              <p className="text-amber-800">
                Upon completing check-out, Room {reservation.roomNumber} will automatically transition to <strong>DIRTY</strong> and an urgent turnaround task will be assigned to Housekeeping. The room will NOT become AVAILABLE until cleaned and inspected.
              </p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Departure Notes / Feedback:
              </label>
              <textarea
                rows={2}
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                placeholder="e.g. Guest appreciated lake view, returned 2 keycards in good order."
              />
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
              >
                <Printer className="h-4 w-4" />
                Print Folio Tax Invoice
              </button>

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
                  className={`px-5 py-2 text-white font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 ${
                    confirmPartialCheckout
                      ? 'bg-rose-700 hover:bg-rose-800'
                      : 'bg-emerald-800 hover:bg-emerald-900'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  {confirmPartialCheckout ? 'Confirm Partial Check-Out' : 'Complete Check-Out'}
                </button>
              </div>
            </div>
          </form>
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
