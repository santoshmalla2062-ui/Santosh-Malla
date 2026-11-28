import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  MessageCircle,
  Printer,
  ReceiptText,
  Usb,
  X
} from 'lucide-react';
import { BusinessSettings, Order } from '../../types';
import { Language } from '../../utils/translations';
import { sanitizeBusinessLogoUrl } from '../../utils/imageUtils';
import { formatReceiptNepaliDate } from '../../utils/nepaliCalendar';
import { parseOrderDate } from '../../utils/timeUtils';
import {
  buildReceiptPaymentRows,
  buildWhatsAppBillUrl,
  formatPlainTextReceipt,
  getEffectiveServicePercent,
  getReceiptAttribution,
  getReceiptBillIdentifier,
  getReceiptOrderTypeFormatted
} from '../../utils/receiptFormatter';
import { buildEscPosReceiptBytes, openCashDrawerHardware, sendEscPosToHardware } from '../../services/escposPrinter';
import { getNepalFiscalYear } from '../../services/irdCompliance';

interface ReceiptModalProps {
  order: Order;
  settings: BusinessSettings;
  lang: Language;
  onClose: () => void;
  isEstimate?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  settings,
  lang,
  onClose,
  isEstimate = false
}) => {
  const [billType, setBillType] = useState<'estimate' | 'tax_invoice'>(
    isEstimate ? 'estimate' : 'tax_invoice'
  );
  const [printWidth, setPrintWidth] = useState<'80mm' | '58mm'>('80mm');
  const [useNepaliCalendar, setUseNepaliCalendar] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [hwStatus, setHwStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const businessLogo = sanitizeBusinessLogoUrl(settings.logoUrl);
  const shouldShowLogo = Boolean(businessLogo && (settings.receiptSettings?.showLogo ?? true));
  const [logoError, setLogoError] = useState<boolean>(false);

  useEffect(() => {
    setLogoError(false);
  }, [businessLogo]);

  const handlePrint = () => {
    try {
      window.print();
      setHwStatus({
        ok: true,
        text:
          lang === 'ne'
            ? 'प्रिन्ट संवाद पठाइयो। मोबाइल वा एम्बेडेड ब्राउजरमा नखुले Save वा Copy प्रयोग गर्नुहोस् वा Thermal प्रिन्टर जोड्नुहोस्।'
            : 'Print command sent. If your mobile browser or preview blocks printing, use Save (.txt), Copy, or Thermal ESC/POS.'
      });
    } catch {
      setHwStatus({
        ok: false,
        text:
          lang === 'ne'
            ? 'यस ब्राउजरले प्रत्यक्ष प्रिन्ट रोकेको छ। कृपया Save वा Thermal प्रिन्टर प्रयोग गर्नुहोस्।'
            : 'Browser print is blocked in this preview window. Use Save (.txt), Copy, or Thermal ESC/POS.'
      });
    }
  };

  const handleDirectEscPosPrint = async () => {
    const bytes = buildEscPosReceiptBytes(order, settings, {
      width: printWidth,
      isEstimate: billType === 'estimate',
      kickDrawer: Boolean(settings.printerSettings?.autoOpenCashDrawerOnCash && order.paymentMethod === 'cash')
    });
    const res = await sendEscPosToHardware(bytes, settings.printerSettings);
    if (!res.ok && res.fallbackToBrowserPrint && (!settings.printerSettings || settings.printerSettings.connectionType === 'browser')) {
      handlePrint();
      return;
    }
    setHwStatus({ ok: res.ok, text: res.message });
  };

  const handleKickDrawer = async () => {
    const res = await openCashDrawerHardware(settings.printerSettings);
    setHwStatus({ ok: res.ok, text: res.message });
  };

  const billIdentifier = getReceiptBillIdentifier(order);

  const orderDateObj =
    order.settledAt || order.createdAt ? parseOrderDate(order.settledAt || order.createdAt) : new Date();
  const nepaliDateStr = formatReceiptNepaliDate(orderDateObj);
  const englishDateStr =
    orderDateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) +
    ', ' +
    orderDateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  const displayDateStr = useNepaliCalendar ? nepaliDateStr : englishDateStr;

  const orderTypeFormatted = getReceiptOrderTypeFormatted(order);
  const { cashierName, serverName } = getReceiptAttribution(order);
  const paymentDisplayRows = buildReceiptPaymentRows(order, billType);
  const effectiveServicePct = getEffectiveServicePercent(order, settings);

  const generatePlainTextReceipt = () =>
    formatPlainTextReceipt({
      order,
      settings,
      billType,
      displayDateStr
    });

  const whatsappBillUrl = buildWhatsAppBillUrl({
    order,
    settings,
    billType,
    displayDateStr
  });

  const handleDownloadReceipt = () => {
    const textReceipt = generatePlainTextReceipt();
    const blob = new Blob([textReceipt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${billIdentifier}-${billType}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setHwStatus({
      ok: true,
      text: lang === 'ne' ? 'रसिद फाइल (.txt) डाउनलोड गरियो।' : 'Receipt downloaded as .txt file.'
    });
  };

  const handleCopyReceipt = async () => {
    const textReceipt = generatePlainTextReceipt();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textReceipt);
      } else {
        throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setHwStatus({
        ok: true,
        text: lang === 'ne' ? 'रसिद क्लिपबोर्डमा कपी गरियो।' : 'Receipt text copied to clipboard.'
      });
    } catch {
      setHwStatus({
        ok: false,
        text: lang === 'ne' ? 'क्लिपबोर्डमा कपी गर्न सकिएन — Save (.txt) प्रयोग गर्नुहोस्।' : 'Copy blocked in this browser — use Save (.txt) instead.'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0 print:overflow-visible">
      <div className="bg-slate-100 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-300 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh] print:max-h-none print:overflow-visible print:shadow-none print:border-none print:rounded-none print:bg-white">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white print:hidden gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                billType === 'estimate' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              <ReceiptText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-sm block truncate">
                {billType === 'estimate'
                  ? lang === 'ne'
                    ? 'अनुमान बिल (Estimate)'
                    : 'Customer Estimate Slip'
                  : lang === 'ne'
                  ? 'कर बीजक (Tax Invoice)'
                  : 'Official Tax Invoice'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono truncate block">
                {billIdentifier} · {order.tableRoomName || 'Counter'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            aria-label="Close receipt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format Selector Bar (Hidden when printing) */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs print:hidden gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setBillType('estimate')}
              className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-all ${
                billType === 'estimate'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Estimate
            </button>
            <button
              type="button"
              onClick={() => setBillType('tax_invoice')}
              className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-all ${
                billType === 'tax_invoice'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax Invoice
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setUseNepaliCalendar(!useNepaliCalendar)}
              className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
              title="Toggle Bikram Sambat (BS) / Gregorian (AD)"
            >
              {useNepaliCalendar ? 'BS Date' : 'AD Date'}
            </button>

            <div className="flex items-center bg-white rounded-md border border-slate-200 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setPrintWidth('80mm')}
                className={`px-2 py-0.5 rounded ${
                  printWidth === '80mm' ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'
                }`}
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPrintWidth('58mm')}
                className={`px-2 py-0.5 rounded ${
                  printWidth === '58mm' ? 'bg-slate-800 text-white font-bold' : 'text-slate-600'
                }`}
              >
                58mm
              </button>
            </div>
          </div>
        </div>

        {/* Paid Confirmation & Cash Change Due Banner (Hidden when printing) */}
        {!isEstimate && order.status === 'completed' && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-xs print:hidden shrink-0">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                {lang === 'ne' ? 'भुक्तानी सम्पन्न' : 'Payment Settled'}
                {order.paymentMethod ? ` · ${order.paymentMethod.replace(/_/g, ' ').toUpperCase()}` : ''}
              </span>
            </div>
            {typeof order.changeReturned === 'number' && order.changeReturned > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-950 font-black tabular-nums">
                <span>{lang === 'ne' ? 'फिर्ता:' : 'Change:'}</span>
                <span>
                  {settings.currencySymbol} {order.changeReturned.toFixed(2)}
                </span>
              </div>
            ) : (
              <span className="tabular-nums font-bold text-emerald-800">
                {settings.currencySymbol} {(order.paidAmount ?? order.grandTotal).toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Realistic Thermal Paper Receipt Preview */}
        <div className="p-4 flex justify-center bg-slate-200/70 overflow-y-auto flex-1 print:p-0 print:bg-white print:overflow-visible">
          <div
            id="printable-receipt"
            style={{ width: printWidth === '58mm' ? '58mm' : '78mm' }}
            className="bg-white text-black font-mono text-[12px] leading-snug p-4 shadow-md border border-slate-300/80 rounded-xs selection:bg-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 h-fit"
          >
            {/* Top Right Bill Identifier */}
            <div className="text-right text-[11px] text-slate-700 mb-1 tracking-tight">
              {billIdentifier}
            </div>

            {/* Business Header */}
            <div className="text-center pb-2">
              {shouldShowLogo && !logoError && (
                <div className="flex justify-center mb-1.5">
                  <img
                    src={businessLogo}
                    alt={settings.businessName || 'Business Logo'}
                    onError={() => setLogoError(true)}
                    className="max-h-14 max-w-[140px] w-auto h-auto object-contain grayscale contrast-125"
                  />
                </div>
              )}
              <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-black">
                {settings.businessName || 'NAULO HOSPITALITY'}
              </h1>
              <p className="text-[11px] text-slate-800 mt-0.5">
                {settings.address || 'Pulchowk, Lalitpur'}
              </p>
              <p className="text-[11px] text-slate-800">
                Tel: {settings.phone || '9861157870'}
              </p>
              {billType === 'tax_invoice' && settings.panVatNumber && (
                <p className="text-[11px] font-bold text-black mt-0.5">
                  PAN/VAT: {settings.panVatNumber}
                </p>
              )}
            </div>

            {/* Document Title (ESTIMATE vs TAX INVOICE) - Strictly English */}
            <div className="text-center py-1.5">
              <p className="text-xs sm:text-sm font-black uppercase tracking-wider text-black">
                {billType === 'estimate' ? 'ESTIMATE' : 'TAX INVOICE'}
              </p>
              <p className="text-[10px] text-slate-700 italic">
                {billType === 'estimate' ? 'Not a tax invoice' : 'Official Tax Invoice'}
              </p>
              {order.creditNoteNo && (
                <p className="text-[10px] font-bold text-rose-700 uppercase mt-0.5">
                  CREDIT NOTE ISSUED: {order.creditNoteNo}
                </p>
              )}
              {order.parentSplitOrderId && (
                <p className="text-[10px] font-bold text-black uppercase mt-0.5">
                  SPLIT BILL INVOICE
                </p>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 my-1.5" />

            {/* Metadata Rows */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-800 font-semibold w-16 shrink-0">Printed</span>
                <span className="text-right text-black font-medium">{displayDateStr}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-slate-800 font-semibold w-16 shrink-0">Fiscal Yr</span>
                <span className="text-right text-black font-mono">
                  {order.fiscalYear || getNepalFiscalYear(orderDateObj)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-slate-800 font-semibold w-16 shrink-0">Order</span>
                <span className="text-right text-black">
                  #{order.invoiceNo || order.kotNo || order.id.slice(0, 8)}
                </span>
              </div>
              {order.buyerPan && (
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-800 font-semibold w-16 shrink-0">Buyer PAN</span>
                  <span className="text-right text-black font-mono">{order.buyerPan}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline">
                <span className="text-slate-800 font-semibold w-16 shrink-0">Type</span>
                <span className="text-right text-black font-bold uppercase">
                  {orderTypeFormatted}
                </span>
              </div>
              {order.guestCount && order.guestCount > 0 ? (
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-800 font-semibold w-16 shrink-0">Guests</span>
                  <span className="text-right text-black">{order.guestCount} PAX</span>
                </div>
              ) : null}
              {order.customerName && (
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-800 font-semibold w-16 shrink-0">Customer</span>
                  <span className="text-right text-black">{order.customerName}</span>
                </div>
              )}
              {order.customerPhone && (
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-800 font-semibold w-16 shrink-0">Phone</span>
                  <span className="text-right text-black font-mono-num">{order.customerPhone}</span>
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 my-1.5" />

            {/* Items Table Headers */}
            <div className="grid grid-cols-12 font-bold text-black text-[11px] pb-1">
              <span className="col-span-1">SN</span>
              <span className="col-span-5">Item</span>
              <span className="col-span-2 text-right">Rate</span>
              <span className="col-span-1 text-center">Qty</span>
              <span className="col-span-3 text-right">Amount</span>
            </div>

            {/* Items Rows (English Only) */}
            <div className="space-y-1 text-[11px]">
              {order.items.map((item, index) => {
                const itemRate = item.price;
                const itemTotal = item.price * item.quantity;
                return (
                  <div key={item.id} className="grid grid-cols-12 items-start py-0.5">
                    <span className="col-span-1 text-slate-700">{index + 1}</span>
                    <div className="col-span-5 pr-1">
                      <p className="font-semibold text-black leading-tight break-words">
                        {item.name}
                      </p>
                      {item.selectedVariant && (
                        <p className="text-[10px] text-slate-700">
                          ({item.selectedVariant.name})
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[9px] text-slate-600 italic">*{item.notes}</p>
                      )}
                    </div>
                    <span className="col-span-2 text-right text-black">
                      Rs.{itemRate.toFixed(2)}
                    </span>
                    <span className="col-span-1 text-center font-bold text-black">
                      {item.quantity}
                    </span>
                    <span className="col-span-3 text-right font-semibold text-black">
                      Rs.{itemTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Financial Summary */}
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>Rs.{order.subtotal.toFixed(2)}</span>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex justify-between text-slate-900">
                  <span>Discount ({(order.discountPercent || 0).toFixed(0)}%)</span>
                  <span>-Rs.{order.discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Service ({effectiveServicePct}%)</span>
                <span>Rs.{(order.serviceChargeAmount || 0).toFixed(2)}</span>
              </div>

              {settings.enableVat && order.vatAmount > 0 && (
                <div className="flex justify-between">
                  <span>VAT ({settings.vatRatePercent}%)</span>
                  <span>Rs.{(order.vatAmount || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-xs sm:text-sm text-black pt-1">
                <span>GRAND TOTAL</span>
                <span>Rs.{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Accurate Payment Breakdown Rows */}
            <div className="space-y-1 text-[11px]">
              {paymentDisplayRows.map((row, idx) => (
                <div
                  key={idx}
                  className={`flex justify-between ${row.bold ? 'font-bold text-black' : ''}`}
                >
                  <span>{row.label}</span>
                  <span>{row.amountText}</span>
                </div>
              ))}
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Cashier & Server Attribution */}
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span>Cashier</span>
                <span className="font-semibold text-black">{cashierName}</span>
              </div>
              {serverName && (
                <div className="flex justify-between">
                  <span>Server</span>
                  <span className="text-black">{serverName}</span>
                </div>
              )}
            </div>

            {/* Centered Thank You Footer */}
            <div className="text-center pt-3 pb-1 space-y-1">
              <p className="text-[11px] font-semibold text-black">
                {settings.receiptFooterMessage || 'Thank you, please come again'}
              </p>
              <p className="text-[9px] text-slate-600">
                Software by Himalayan Breeze POS
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Modal Actions (Hidden in Print) */}
        {hwStatus && (
          <div className={`px-4 py-1.5 text-[11px] font-semibold border-t print:hidden shrink-0 ${hwStatus.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
            {hwStatus.text}
          </div>
        )}
        <div className="px-4 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 print:hidden shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleDownloadReceipt}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              title="Download text receipt"
            >
              <Download className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReceipt}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              title="Copy receipt text"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-600" />
              )}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <a
              href={whatsappBillUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap"
              title={
                order.customerPhone
                  ? `Share bill on WhatsApp (${order.customerPhone})`
                  : 'Share bill on WhatsApp'
              }
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleKickDrawer}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap"
              title="Kick RJ11 Cash Drawer"
            >
              <Usb className="h-3.5 w-3.5 text-amber-700" />
              <span className="hidden sm:inline">Drawer</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              {!isEstimate && order.status === 'completed'
                ? lang === 'ne'
                  ? 'सम्पन्न'
                  : 'Done'
                : lang === 'ne'
                ? 'बन्द'
                : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleDirectEscPosPrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors whitespace-nowrap"
            >
              <Usb className="h-3.5 w-3.5" />
              <span>Thermal</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-lg transition-colors shadow-xs whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{lang === 'ne' ? 'प्रिन्ट गर्नुहोस्' : 'Print Receipt'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
