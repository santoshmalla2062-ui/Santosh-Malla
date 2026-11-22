import React from 'react';
import { 
  Printer, 
  X, 
  Hotel, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  FileText, 
  CheckCircle,
  Clock
} from 'lucide-react';
import { 
  BusinessSettings, 
  GuestFolioItem, 
  GuestProfile, 
  HotelPaymentRecord, 
  Reservation, 
  ResortRoom 
} from '../../types';
import { Language } from '../../utils/translations';
import { computeReservationFolioMetrics, formatLocalYMD } from '../../services/resortSecurity';

interface ResortInvoiceModalProps {
  reservation: Reservation;
  room?: ResortRoom;
  guest?: GuestProfile;
  folioItems: GuestFolioItem[];
  payments: HotelPaymentRecord[];
  settings: BusinessSettings;
  lang: Language;
  onClose: () => void;
}

export const ResortInvoiceModal: React.FC<ResortInvoiceModalProps> = ({
  reservation,
  room,
  guest,
  folioItems,
  payments,
  settings,
  lang,
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const metrics = computeReservationFolioMetrics(folioItems, payments, reservation, settings);
  const {
    roomCharges,
    fbCharges,
    serviceCharges,
    discountAmount: discount,
    taxableAmount: taxable,
    vatAmount,
    grandTotal,
    effectivePaid,
    balanceDue
  } = metrics;

  const invoiceNo = `INV-RES-${reservation.roomNumber}-${reservation.id.replace('res-', '')}`;
  const nowStr = `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Modal Controls (Hidden in print) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <Hotel className="h-5 w-5 text-emerald-800" />
            <h3 className="font-bold text-slate-800 text-sm">
              {lang === 'ne' ? 'अतिथि बिल तथा कर बीजक (Guest Folio Invoice)' : 'Guest Folio & Tax Invoice'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              {lang === 'ne' ? 'प्रिन्ट गर्नुहोस्' : 'Print Folio'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Folio Document */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 text-slate-800 text-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-5 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-white font-black text-sm">
                  HB
                </div>
                <div>
                  <h1 className="text-base font-black text-slate-900 tracking-tight">
                    {settings.businessName}
                  </h1>
                  <p className="text-[11px] text-emerald-800 font-semibold">
                    {settings.tagline}
                  </p>
                </div>
              </div>
              <p className="text-slate-500 mt-2 text-[11px] leading-relaxed">
                {settings.address} · Phone: {settings.phone}
                <br />
                Email: {settings.email} · PAN/VAT No: <span className="font-mono-num font-bold text-slate-800">{settings.panVatNumber}</span>
              </p>
            </div>
            <div className="text-left sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-slate-200 w-full sm:w-auto">
              <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded font-black tracking-wider text-[11px] uppercase">
                GUEST TAX INVOICE
              </span>
              <p className="font-mono-num font-bold text-slate-900 text-sm mt-1.5">
                {invoiceNo}
              </p>
              <p className="text-slate-500 text-[11px]">
                Date: {nowStr}
              </p>
              <div className="mt-1">
                {balanceDue === 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                    <CheckCircle className="h-3 w-3" /> PAID IN FULL
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                    <Clock className="h-3 w-3" /> BALANCE DUE: {settings.currencySymbol} {balanceDue.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Guest & Stay Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 border border-slate-200 rounded-xl p-4">
            <div>
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-500 mb-2">
                Guest Information
              </h4>
              <p className="font-bold text-slate-900 text-sm">{reservation.guestName}</p>
              <div className="mt-1 space-y-0.5 text-slate-600 text-[11px]">
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {reservation.guestPhone}
                </p>
                {reservation.guestEmail && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-slate-400" />
                    {reservation.guestEmail}
                  </p>
                )}
                {guest && (
                  <p className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-slate-400" />
                    {guest.country} · {guest.idType}: <span className="font-mono-num">{guest.idNumber}</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider text-slate-500 mb-2">
                Accommodation Details
              </h4>
              <p className="font-bold text-slate-900 text-sm">
                Room {reservation.roomNumber} ({reservation.roomTypeName})
              </p>
              <div className="mt-1 space-y-0.5 text-slate-600 text-[11px]">
                <p className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  Check-in: <span className="font-semibold text-slate-800">{reservation.checkInDate}</span> · Check-out: <span className="font-semibold text-slate-800">{reservation.checkOutDate}</span>
                </p>
                <p>
                  Duration: <span className="font-semibold text-slate-800">{reservation.nightsCount} Nights</span> · Guests: {reservation.adults} Adults{reservation.children > 0 ? `, ${reservation.children} Children` : ''}
                </p>
                <p className="text-slate-500">
                  Booking Channel: <span className="font-medium text-slate-700">{reservation.bookingSource}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Folio Items Table */}
          <div>
            <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-2">
              Itemized Charges & Services
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                    <th className="py-2.5 px-3">Date/Time</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 text-center">Category</th>
                    <th className="py-2.5 px-2 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Rate ({settings.currencySymbol})</th>
                    <th className="py-2.5 px-3 text-right">Total ({settings.currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {folioItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400 italic">
                        No charges posted on this room folio yet.
                      </td>
                    </tr>
                  ) : (
                    folioItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                          {item.dateTime}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {item.description}
                          {item.referenceId && (
                            <span className="block text-[10px] text-slate-400">Ref: {item.referenceId}</span>
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
                          {item.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900">
                          {item.totalPrice.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Folio Summary & Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Payments Made */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                Payments & Advance Deposits
              </h4>
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-2">
                {payments.length === 0 ? (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600">Initial Advance Deposit:</span>
                    <span className="font-mono-num font-bold text-emerald-900">
                      {settings.currencySymbol} {reservation.paidAmount.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  payments.map((p) => (
                    <div key={p.id} className="flex justify-between items-center text-[11px] border-b border-slate-200/60 pb-1.5 last:border-0 last:pb-0">
                      <div>
                        <p className="font-semibold text-slate-800 capitalize">{p.method.replace('_', ' ')} Deposit</p>
                        <p className="text-[10px] text-slate-400">{p.dateTime} · Ref: {p.reference || p.id}</p>
                      </div>
                      <span className="font-mono-num font-bold text-emerald-800">
                        {settings.currencySymbol} {p.amount.toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-slate-900 text-xs">
                  <span>Total Payments Received:</span>
                  <span className="font-mono-num text-emerald-900">
                    {settings.currencySymbol} {effectivePaid.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 space-y-2">
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Room Charges:</span>
                <span className="font-mono-num font-semibold text-slate-800">
                  {settings.currencySymbol} {roomCharges.toFixed(2)}
                </span>
              </div>
              {fbCharges > 0 && (
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>F&B / Restaurant & Cafe:</span>
                  <span className="font-mono-num font-semibold text-slate-800">
                    {settings.currencySymbol} {fbCharges.toFixed(2)}
                  </span>
                </div>
              )}
              {serviceCharges > 0 && (
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>Resort Services (Spa/Transport/Laundry):</span>
                  <span className="font-mono-num font-semibold text-slate-800">
                    {settings.currencySymbol} {serviceCharges.toFixed(2)}
                  </span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-rose-700 text-[11px]">
                  <span>Special Discount:</span>
                  <span className="font-mono-num font-semibold">
                    -{settings.currencySymbol} {discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 text-[11px] border-t border-slate-200/80 pt-1">
                <span>Subtotal:</span>
                <span className="font-mono-num font-semibold text-slate-800">
                  {settings.currencySymbol} {taxable.toFixed(2)}
                </span>
              </div>
              {settings.enableVat && (
                <div className="flex justify-between text-slate-600 text-[11px]">
                  <span>VAT ({settings.vatRatePercent}%):</span>
                  <span className="font-mono-num font-semibold text-slate-800">
                    {settings.currencySymbol} {vatAmount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm border-t border-slate-300 pt-2">
                <span>Grand Total:</span>
                <span className="font-mono-num text-slate-950">
                  {settings.currencySymbol} {grandTotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-900 font-bold text-xs">
                <span>Paid to Date:</span>
                <span className="font-mono-num">
                  {settings.currencySymbol} {effectivePaid.toFixed(2)}
                </span>
              </div>
              <div className={`flex justify-between font-black text-sm border-t border-slate-300 pt-2 ${
                balanceDue > 0 ? 'text-rose-700' : 'text-emerald-900'
              }`}>
                <span>Remaining Balance Due:</span>
                <span className="font-mono-num">
                  {settings.currencySymbol} {balanceDue.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer & Signatures */}
          <div className="border-t border-slate-200 pt-6 mt-6 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-4">
            <div>
              <p className="font-medium text-slate-700">{settings.receiptFooterMessage}</p>
              <p className="mt-0.5">Thank you for your patronage. Safe travels!</p>
            </div>
            <div className="flex gap-8 text-center">
              <div>
                <div className="w-32 border-b border-slate-400 mb-1"></div>
                <p className="text-slate-600 font-semibold">Guest Signature</p>
              </div>
              <div>
                <div className="w-32 border-b border-slate-400 mb-1"></div>
                <p className="text-slate-600 font-semibold">Front Desk Cashier</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
