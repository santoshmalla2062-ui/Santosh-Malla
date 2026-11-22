import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  Minus,
  Plus,
  Printer,
  Receipt,
  Split,
  Users,
  X
} from 'lucide-react';
import { BusinessSettings, MenuItem, Order, OrderItem } from '../../types';
import { Language } from '../../utils/translations';
import { carveItemsForSplitBill, splitAmountEqually } from '../../utils/splitBilling';
import { getNextInvoiceNumber } from '../../services/storage';

interface SplitBillModalProps {
  order: Order;
  menuItems: MenuItem[];
  orders: Order[];
  settings: BusinessSettings;
  lang: Language;
  initialGuests?: number;
  onClose: () => void;
  onProceedItemSplitSettle: (splitOrder: Order, remainingItems: OrderItem[]) => void;
  onOpenMixedPaymentCheckout: () => void;
  onOpenEstimateSlip: (targetOrder: Order) => void;
}

type SplitTab = 'by_item' | 'by_guest' | 'by_amount';

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  order,
  menuItems,
  orders,
  settings,
  lang,
  initialGuests = 2,
  onClose,
  onProceedItemSplitSettle,
  onOpenMixedPaymentCheckout,
  onOpenEstimateSlip
}) => {
  const [activeTab, setActiveTab] = useState<SplitTab>('by_item');
  const [guestCount, setGuestCount] = useState<number>(Math.max(2, Math.min(12, initialGuests || 2)));
  const [copiedBreakdown, setCopiedBreakdown] = useState(false);

  // Item split state: item.id -> quantity selected for sub-bill
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    order.items.forEach((item) => {
      initial[item.id] = 0;
    });
    return initial;
  });

  // Custom amount payers state
  const [customShares, setCustomShares] = useState<number[]>(() =>
    splitAmountEqually(order.grandTotal, 2)
  );

  // Compute item split calculation
  const splitInvoiceNo = useMemo(() => {
    const existingWithOrder = orders.some((o) => o.id === order.id) ? orders : [order, ...orders];
    return getNextInvoiceNumber(existingWithOrder, settings.receiptSettings?.invoicePrefix || 'INV-', settings.businessId, false);
  }, [orders, order, settings.receiptSettings?.invoicePrefix]);

  const itemSplitResult = useMemo(() => {
    return carveItemsForSplitBill(order, selectedQuantities, menuItems, settings, splitInvoiceNo);
  }, [order, selectedQuantities, menuItems, settings, splitInvoiceNo]);

  // Equal PAX shares (paisa-exact)
  const equalShares = useMemo(() => {
    return splitAmountEqually(order.grandTotal, guestCount);
  }, [order.grandTotal, guestCount]);

  // Custom shares math
  const customTotalEntered = useMemo(() => {
    return Math.round(customShares.reduce((sum, val) => sum + (Number(val) || 0), 0) * 100) / 100;
  }, [customShares]);

  const customRemainder = useMemo(() => {
    return Math.round((order.grandTotal - customTotalEntered) * 100) / 100;
  }, [order.grandTotal, customTotalEntered]);

  const totalSelectedItemUnits = useMemo(() => {
    return Object.values(selectedQuantities).reduce((sum, q) => sum + (q || 0), 0);
  }, [selectedQuantities]);

  const adjustItemQty = (item: OrderItem, delta: number) => {
    setSelectedQuantities((prev) => {
      const curr = prev[item.id] || 0;
      const next = Math.max(0, Math.min(item.quantity, curr + delta));
      return { ...prev, [item.id]: next };
    });
  };

  const selectAllItems = () => {
    const next: Record<string, number> = {};
    order.items.forEach((item) => {
      next[item.id] = item.quantity;
    });
    setSelectedQuantities(next);
  };

  const clearSelectedItems = () => {
    const next: Record<string, number> = {};
    order.items.forEach((item) => {
      next[item.id] = 0;
    });
    setSelectedQuantities(next);
  };

  const handleCopyGuestShares = () => {
    const lines = [
      `${settings.businessName} — Split Summary`,
      `${order.tableRoomName} | ${order.invoiceNo}`,
      `Total Bill: ${settings.currencySymbol} ${order.grandTotal.toFixed(2)}`,
      `Split Among ${guestCount} Guests:`,
      ...equalShares.map((amt, i) => `Guest ${i + 1}: ${settings.currencySymbol} ${amt.toFixed(2)}`)
    ];
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopiedBreakdown(true);
      setTimeout(() => setCopiedBreakdown(false), 1800);
    });
  };

  const handleAddCustomPayer = () => {
    if (customShares.length >= 8) return;
    setCustomShares((prev) => [...prev, Math.max(0, customRemainder)]);
  };

  const handleRemoveCustomPayer = (idx: number) => {
    if (customShares.length <= 2) return;
    setCustomShares((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFillCustomPayer = (idx: number) => {
    const othersSum = customShares.reduce((s, val, i) => (i === idx ? s : s + (Number(val) || 0)), 0);
    const needed = Math.max(0, Math.round((order.grandTotal - othersSum) * 100) / 100);
    setCustomShares((prev) => prev.map((v, i) => (i === idx ? needed : v)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Split className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {lang === 'ne' ? 'बिल विभाजन (Split Bill Workspace)' : 'Split Bill Workspace'}
              </h3>
              <p className="text-xs text-slate-500 font-mono-num truncate">
                {order.tableRoomName} · {order.invoiceNo} · Total: {settings.currencySymbol} {order.grandTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 bg-slate-200/70 p-1 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('by_item')}
              className={`py-2 px-2 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'by_item'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="h-3.5 w-3.5 text-emerald-700" />
              <span className="truncate">{lang === 'ne' ? 'परिकार अनुसार (By Item)' : 'By Item'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('by_guest')}
              className={`py-2 px-2 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'by_guest'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-indigo-700" />
              <span className="truncate">{lang === 'ne' ? 'बराबर भाग (Equal PAX)' : 'Equal Guests'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('by_amount')}
              className={`py-2 px-2 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'by_amount'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5 text-amber-700" />
              <span className="truncate">{lang === 'ne' ? 'इच्छा अनुसार (Custom)' : 'Custom Amount'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Workspace */}
        <div className="p-5 overflow-y-auto flex-1 bg-white">
          {activeTab === 'by_item' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left 7 Cols: Item Picker */}
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {lang === 'ne' ? 'छुट्टै तिर्ने परिकार छान्नुहोस्:' : 'Select Items to Settle Separately'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {lang === 'ne'
                        ? 'छानिएका परिकारको नयाँ रसिद बन्नेछ र बाँकी परिकार टेबलमै रहनेछन्।'
                        : 'Selected dishes issue a separate invoice; unpaid items stay active on the table.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold shrink-0">
                    <button
                      type="button"
                      onClick={selectAllItems}
                      className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-700"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedItems}
                      className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-500"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {order.items.map((item) => {
                    const selectedQty = selectedQuantities[item.id] || 0;
                    const isPartialOrFull = selectedQty > 0;
                    return (
                      <div
                        key={item.id}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                          isPartialOrFull ? 'bg-emerald-50/60' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                            <span className="text-[11px] font-mono-num text-slate-500 shrink-0">
                              ×{item.quantity}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono-num text-slate-500 mt-0.5">
                            {settings.currencySymbol} {item.price.toFixed(2)} each
                            {selectedQty > 0 && (
                              <span className="ml-2 font-bold text-emerald-700">
                                → Split: {settings.currencySymbol} {(item.price * selectedQty).toFixed(2)}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Qty stepper */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden">
                            <button
                              type="button"
                              disabled={selectedQty <= 0}
                              onClick={() => adjustItemQty(item, -1)}
                              className="h-7 w-7 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold font-mono-num text-slate-900">
                              {selectedQty}
                            </span>
                            <button
                              type="button"
                              disabled={selectedQty >= item.quantity}
                              onClick={() => adjustItemQty(item, 1)}
                              className="h-7 w-7 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Cols: Sub-Bill vs Remaining Preview */}
              <div className="md:col-span-5 space-y-3">
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {lang === 'ne' ? 'नयाँ छुट्टै बिल' : 'New Split Bill'}
                    </span>
                    <span className="text-[11px] font-mono-num text-slate-500">
                      {totalSelectedItemUnits} {lang === 'ne' ? 'एकाइ' : 'units'}
                    </span>
                  </div>

                  {totalSelectedItemUnits === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      {lang === 'ne'
                        ? 'बायाँबाट कम्तिमा १ परिकार छान्नुहोस्।'
                        : 'Select at least 1 dish on the left to build a split bill.'}
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal</span>
                          <span className="font-mono-num font-semibold text-slate-900">
                            {settings.currencySymbol} {itemSplitResult.splitSummary.verifiedSubtotal.toFixed(2)}
                          </span>
                        </div>
                        {itemSplitResult.splitSummary.verifiedDiscountAmount > 0 && (
                          <div className="flex justify-between text-rose-700">
                            <span>Discount ({order.discountPercent || 0}%)</span>
                            <span className="font-mono-num font-semibold">
                              -{settings.currencySymbol} {itemSplitResult.splitSummary.verifiedDiscountAmount.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {itemSplitResult.splitSummary.verifiedServiceCharge > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Service Charge ({settings.serviceChargePercent}%)</span>
                            <span className="font-mono-num font-semibold text-slate-900">
                              {settings.currencySymbol} {itemSplitResult.splitSummary.verifiedServiceCharge.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {itemSplitResult.splitSummary.verifiedVat > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>VAT ({settings.vatRatePercent}%)</span>
                            <span className="font-mono-num font-semibold text-slate-900">
                              {settings.currencySymbol} {itemSplitResult.splitSummary.verifiedVat.toFixed(2)}
                            </span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                          <span className="font-bold text-slate-900">Split Total</span>
                          <span className="text-xl font-black font-mono-num text-emerald-800">
                            {settings.currencySymbol} {itemSplitResult.splitSummary.verifiedGrandTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 text-[11px] flex justify-between items-center text-slate-600">
                        <span>{lang === 'ne' ? 'टेबलमा बाँकी रहने रकम:' : 'Remaining on Table:'}</span>
                        <span className="font-mono-num font-bold text-slate-900">
                          {itemSplitResult.remainingItems.length === 0
                            ? `${settings.currencySymbol} 0.00 (Full table)`
                            : `${settings.currencySymbol} ${itemSplitResult.remainingSummary.verifiedGrandTotal.toFixed(2)}`}
                        </span>
                      </div>

                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          disabled={!itemSplitResult.splitOrder}
                          onClick={() => {
                            if (itemSplitResult.splitOrder) {
                              onProceedItemSplitSettle(itemSplitResult.splitOrder, itemSplitResult.remainingItems);
                            }
                          }}
                          className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                          <CreditCard className="h-4 w-4" />
                          <span>
                            {lang === 'ne'
                              ? `छानिएको बिल चुक्ता (${settings.currencySymbol} ${itemSplitResult.splitSummary.verifiedGrandTotal.toFixed(2)})`
                              : `Settle Selected (${settings.currencySymbol} ${itemSplitResult.splitSummary.verifiedGrandTotal.toFixed(2)})`}
                          </span>
                        </button>

                        {itemSplitResult.splitOrder && (
                          <button
                            type="button"
                            onClick={() => {
                              if (itemSplitResult.splitOrder) {
                                onOpenEstimateSlip(itemSplitResult.splitOrder);
                              }
                            }}
                            className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
                          >
                            <Printer className="h-3.5 w-3.5 text-slate-500" />
                            <span>{lang === 'ne' ? 'छानिएको स्लिप हेर्नुहोस्' : 'Preview Sub-Bill Estimate'}</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'by_guest' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {lang === 'ne' ? 'अतिथि संख्या छान्नुहोस् (PAX):' : 'Select Number of Equal Shares'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {lang === 'ne'
                      ? 'प्रत्येक पैसा हिसाब मिलाएर बराबर विभाजन गरिन्छ।'
                      : 'Shares are balanced to exact 0.01 NPR so total never drifts.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGuestCount(n)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold font-mono-num border transition-colors ${
                          guestCount === n
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center border border-slate-300 rounded-lg bg-slate-50 px-1 h-9">
                    <button
                      type="button"
                      onClick={() => setGuestCount((g) => Math.max(2, g - 1))}
                      className="p-1 text-slate-600 hover:text-slate-900"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold font-mono-num">{guestCount}</span>
                    <button
                      type="button"
                      onClick={() => setGuestCount((g) => Math.min(12, g + 1))}
                      className="p-1 text-slate-600 hover:text-slate-900"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Guest Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {equalShares.map((amt, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between"
                  >
                    <span className="text-[11px] font-semibold text-slate-500">
                      Guest {index + 1}
                    </span>
                    <span className="text-base font-black font-mono-num text-slate-900 mt-1">
                      {settings.currencySymbol} {amt.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Strip for Equal Split */}
              <div className="p-4 rounded-lg bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 uppercase font-semibold">
                    Per Person Average ({guestCount} guests)
                  </span>
                  <p className="text-xl font-black font-mono-num text-emerald-400">
                    {settings.currencySymbol} {equalShares[0]?.toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyGuestShares}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
                  >
                    {copiedBreakdown ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedBreakdown ? 'Copied' : 'Copy Split'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenMixedPaymentCheckout}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>{lang === 'ne' ? 'मिश्रित भुक्तानी लिनुहोस् (Split Pay)' : 'Settle via Multi-Channel Split'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'by_amount' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {lang === 'ne' ? 'प्रत्येक भुक्तानीकर्ताको रकम राख्नुहोस्' : 'Custom Payer Split Amounts'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'ne'
                      ? 'कुल रकम ठीक मिल्ने गरी अलग–अलग रकम हिसाब गर्नुहोस्।'
                      : 'Assign exact NPR amounts per person until the remainder reaches zero.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={customShares.length >= 8}
                  onClick={handleAddCustomPayer}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Payer</span>
                </button>
              </div>

              <div className="space-y-2">
                {customShares.map((shareAmt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg bg-slate-50"
                  >
                    <span className="text-xs font-bold text-slate-700 w-20 shrink-0">
                      Payer {idx + 1}
                    </span>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-xs text-slate-500">{settings.currencySymbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={shareAmt || ''}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setCustomShares((prev) => prev.map((v, i) => (i === idx ? val : v)));
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono-num font-bold text-slate-900 text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFillCustomPayer(idx)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 shrink-0"
                    >
                      Fill Balance
                    </button>
                    {customShares.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomPayer(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600"
                        aria-label="Remove payer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Balance Status Bar */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono-num ${
                  Math.abs(customRemainder) <= 0.01
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <span className="font-sans font-bold">
                  {Math.abs(customRemainder) <= 0.01
                    ? 'Exact Total Balanced'
                    : customRemainder > 0
                    ? 'Remaining Unallocated'
                    : 'Over-allocated'}
                </span>
                <span className="font-black text-sm">
                  {Math.abs(customRemainder) <= 0.01
                    ? `${settings.currencySymbol} ${customTotalEntered.toFixed(2)} = ${settings.currencySymbol} ${order.grandTotal.toFixed(2)}`
                    : `${settings.currencySymbol} ${Math.abs(customRemainder).toFixed(2)}`}
                </span>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onOpenMixedPaymentCheckout}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-2"
                >
                  <CreditCard className="h-4 w-4 text-emerald-400" />
                  <span>{lang === 'ne' ? 'मिश्रित च्यानल भुक्तानीमा जानुहोस्' : 'Open Multi-Channel Payment Register'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs shrink-0">
          <button
            type="button"
            onClick={() => onOpenEstimateSlip(order)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-lg border border-slate-300"
          >
            <Printer className="h-3.5 w-3.5 text-slate-600" />
            <span>{lang === 'ne' ? 'पूर्ण बिल अनुमान स्लिप' : 'Print Full Estimate'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg"
          >
            {lang === 'ne' ? 'बन्द गर्नुहोस्' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
