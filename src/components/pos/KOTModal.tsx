import React, { useState } from 'react';
import { ChefHat, Printer, X, Clock, Plus, Usb } from 'lucide-react';
import { BusinessSettings, Order } from '../../types';
import { Language } from '../../utils/translations';
import { formatReceiptNepaliDate } from '../../utils/nepaliCalendar';
import { buildEscPosKotBytes, sendEscPosToHardware } from '../../services/escposPrinter';

interface KOTModalProps {
  order: Order;
  settings?: BusinessSettings;
  lang: Language;
  onClose: () => void;
  onStartNewOrder?: () => void;
}

export const KOTModal: React.FC<KOTModalProps> = ({
  order,
  settings,
  lang,
  onClose,
  onStartNewOrder
}) => {
  const [hwMsg, setHwMsg] = useState<string | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleThermalKot = async () => {
    if (!settings) {
      window.print();
      return;
    }
    const bytes = buildEscPosKotBytes(order, settings, {
      width: settings.printerSettings?.paperWidth || '80mm'
    });
    const res = await sendEscPosToHardware(bytes, settings.printerSettings);
    if (!res.ok && res.fallbackToBrowserPrint && (!settings.printerSettings || settings.printerSettings.connectionType === 'browser')) {
      window.print();
      return;
    }
    setHwMsg(res.message);
  };

  const kotDateObj = order.createdAt ? new Date(order.createdAt) : new Date();
  const nepaliDateStr = formatReceiptNepaliDate(kotDateObj);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-amber-50/70 print:hidden">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-amber-700" />
            <div>
              <span className="font-bold text-amber-950 text-sm block">
                {lang === 'ne' ? 'किचेन अर्डर पर्ची (KOT)' : 'Kitchen Order Ticket (KOT)'}
              </span>
              <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.2 rounded inline-block mt-0.5">
                ✓ {lang === 'ne' ? 'किचेन KDS मा पठाइसकियो' : 'Dispatched to Kitchen KDS'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print KOT</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable KOT area */}
        <div id="printable-receipt" className="p-5 font-mono-num text-xs bg-white text-slate-900">
          <div className="text-center pb-2.5 border-b-2 border-dashed border-slate-900">
            <h3 className="text-base font-black tracking-wider uppercase font-sans">
              KITCHEN ORDER TICKET (KOT)
            </h3>
            <p className="text-lg font-black text-amber-900 mt-1">
              {order.kotNo || 'KOT-NEW'}
            </p>
          </div>

          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="font-bold text-slate-700">TABLE / ROOM:</span>
              <span className="font-black text-slate-950 text-sm bg-slate-100 px-2 py-0.5 rounded">
                {order.tableRoomName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order Type:</span>
              <span className="font-semibold uppercase text-slate-800">{order.orderType}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-slate-500">Date/Time:</span>
              <span className="text-slate-900 font-medium">
                {nepaliDateStr}
              </span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span className="text-slate-500">Guest:</span>
                <span className="font-medium text-slate-800">{order.customerName}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="py-2.5 border-b-2 border-dashed border-slate-900">
            <div className="grid grid-cols-12 font-bold text-slate-900 pb-1 text-[11px] border-b border-slate-200">
              <span className="col-span-2 text-center">QTY</span>
              <span className="col-span-10 pl-2">ITEM DESCRIPTION</span>
            </div>
            <div className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 py-2 text-[12px] items-start">
                  <span className="col-span-2 text-center font-black text-base text-slate-950 bg-slate-100 rounded py-0.5">
                    {item.quantity}
                  </span>
                  <div className="col-span-10 pl-3">
                    <p className="font-bold text-slate-950 text-sm">{item.name}</p>
                    {item.notes && (
                      <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-1 inline-block">
                        * {item.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 text-center text-[10px] text-slate-500">
            --- Send food fresh & hot · Himalayan Breeze Kitchen ---
          </div>
        </div>

        {/* Bottom Footer */}
        {hwMsg && (
          <div className="px-5 py-1.5 text-[11px] font-semibold bg-amber-50 border-t border-amber-200 text-amber-900 print:hidden">
            {hwMsg}
          </div>
        )}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 print:hidden">
          {onStartNewOrder ? (
            <button
              onClick={() => {
                onClose();
                onStartNewOrder();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 text-white" />
              <span>{lang === 'ne' ? 'अर्को टेबलको नयाँ अर्डर' : 'Take Next Order'}</span>
            </button>
          ) : <div />}
          
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
            >
              {lang === 'ne' ? 'यसैमा बस्नुहोस्' : 'Stay on Table'}
            </button>
            <button
              type="button"
              onClick={handleThermalKot}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition-colors"
            >
              <Usb className="h-3.5 w-3.5" />
              <span>ESC/POS</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-md transition-colors shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{lang === 'ne' ? 'प्रिन्ट गर्नुहोस्' : 'Print KOT'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
