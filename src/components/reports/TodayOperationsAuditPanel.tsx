import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock,
  Receipt,
  Search,
  Smartphone,
  XCircle
} from 'lucide-react';
import { BusinessSettings, Order } from '../../types';
import { Language } from '../../utils/translations';
import { computeTodayOrderAuditSummary } from '../../services/orderAudit';
import { ReceiptModal } from '../pos/ReceiptModal';

interface TodayOperationsAuditPanelProps {
  orders: Order[];
  settings: BusinessSettings;
  lang: Language;
  title?: string;
}

type StatusFilter = 'all' | 'completed' | 'unpaid' | 'cancelled';
type ChannelFilter = 'all' | 'cash' | 'online' | 'khata';

export const TodayOperationsAuditPanel: React.FC<TodayOperationsAuditPanelProps> = ({
  orders,
  settings,
  lang,
  title
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptOrder, setReceiptOrder] = useState<{ order: Order; isEstimate: boolean } | null>(null);

  const currency = settings.currencySymbol || 'Rs.';
  const summary = useMemo(() => computeTodayOrderAuditSummary(orders), [orders]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.rows.filter((row) => {
      if (statusFilter === 'completed' && (row.order.status !== 'completed' || row.isTrueCancelled)) {
        return false;
      }
      if (statusFilter === 'unpaid' && (row.order.status !== 'active' || row.isTrueCancelled)) {
        return false;
      }
      if (statusFilter === 'cancelled' && !row.isTrueCancelled) {
        return false;
      }

      if (channelFilter === 'cash' && row.payment.cash <= 0) {
        return false;
      }
      if (channelFilter === 'online' && row.payment.onlineTotal <= 0) {
        return false;
      }
      if (channelFilter === 'khata' && row.payment.khataCredit <= 0 && row.payment.roomCharge <= 0) {
        return false;
      }

      if (q) {
        const hay = [
          row.order.invoiceNo,
          row.order.kotNo,
          row.order.tableRoomName,
          row.order.customerName,
          row.order.waiterName,
          row.order.cashierName,
          row.dishesSummary,
          row.order.voidReason,
          row.payment.channelLabel
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [summary.rows, statusFilter, channelFilter, searchQuery]);

  const settledCollectedTotal = summary.cashTotal + summary.onlineTotal;
  const cashSharePct = settledCollectedTotal > 0 ? Math.round((summary.cashTotal / settledCollectedTotal) * 100) : 0;
  const onlineSharePct = settledCollectedTotal > 0 ? 100 - cashSharePct : 0;

  const onlineParts: string[] = [];
  if (summary.fonepayQrTotal > 0) onlineParts.push(`Fonepay ${currency} ${summary.fonepayQrTotal.toLocaleString()}`);
  if (summary.esewaTotal > 0) onlineParts.push(`eSewa ${currency} ${summary.esewaTotal.toLocaleString()}`);
  if (summary.khaltiTotal > 0) onlineParts.push(`Khalti ${currency} ${summary.khaltiTotal.toLocaleString()}`);
  if (summary.cardTotal > 0) onlineParts.push(`Card ${currency} ${summary.cardTotal.toLocaleString()}`);
  if (summary.bankTotal > 0) onlineParts.push(`Bank ${currency} ${summary.bankTotal.toLocaleString()}`);

  const formatTime = (ms: number) => {
    if (!ms) return '—';
    return new Date(ms).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            {title ||
              (lang === 'ne'
                ? 'आजको अर्डर, नगद/अनलाइन भुक्तानी र रद्दीकरण विवरण'
                : "Today's Orders, Cash vs Online Payments & Cancellations")}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'ne'
              ? 'आज के-के परिकार अर्डर भए, कति भुक्तानी (नगद/अनलाइन) भयो र कति रद्द भयो भन्ने वास्तविक रेकर्ड'
              : 'Real-time breakdown of dishes ordered today, settled cash vs online collections, unpaid bills, and voided orders'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-semibold">
            {summary.totalOrdersCount} {lang === 'ne' ? 'कुल अर्डर' : 'Today Total'}
          </span>
        </div>
      </div>

      {/* 4 Crisp Metric Cards */}
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-slate-200 bg-slate-50/50">
        {/* 1. Completed Sales */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {lang === 'ne' ? 'आजको कुल अर्डर र बिक्री' : 'Completed Sales'}
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono-num tabular-nums mt-1.5">
            {currency} {summary.completedRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {summary.completedCount} {lang === 'ne' ? 'चुक्ता बिल' : 'settled'} · {summary.unpaidCount}{' '}
            {lang === 'ne' ? 'बाँकी' : 'unpaid'}
          </p>
        </div>

        {/* 2. Cash vs Online Collected */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {lang === 'ne' ? 'नगद बनाम अनलाइन' : 'Cash vs Online'}
            </span>
            <div className="flex items-center gap-1 text-slate-500">
              <Banknote className="h-3.5 w-3.5 text-emerald-600" />
              <Smartphone className="h-3.5 w-3.5 text-indigo-600" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs font-bold tabular-nums font-mono-num">
            <span className="text-emerald-800">
              Cash: {currency} {summary.cashTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-indigo-700">
              Online: {currency} {summary.onlineTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
            <div
              className="bg-emerald-600 h-full transition-all"
              style={{ width: `${settledCollectedTotal > 0 ? cashSharePct : 50}%` }}
            />
            <div
              className="bg-indigo-600 h-full transition-all"
              style={{ width: `${settledCollectedTotal > 0 ? onlineSharePct : 50}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            {onlineParts.length > 0
              ? onlineParts.join(' · ')
              : lang === 'ne'
              ? `${cashSharePct}% नगद · ${onlineSharePct}% अनलाइन`
              : `${cashSharePct}% Cash · ${onlineSharePct}% Online`}
          </p>
        </div>

        {/* 3. Open Unpaid Bills */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'unpaid' ? 'all' : 'unpaid')}
          className={`text-left bg-white p-3.5 rounded-xl border transition-colors ${
            statusFilter === 'unpaid' ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {lang === 'ne' ? 'बाँकी खुला बिल (Unpaid)' : 'Open Unpaid Bills'}
            </span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-700 font-mono-num tabular-nums mt-1.5">
            {currency} {summary.unpaidAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {summary.unpaidCount} {lang === 'ne' ? 'बिल तिर्न बाँकी (तिरेपछि स्वतः हट्छ)' : 'open bill(s) awaiting payment'}
          </p>
        </button>

        {/* 4. Cancelled / Voided Today */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
          className={`text-left bg-white p-3.5 rounded-xl border transition-colors ${
            statusFilter === 'cancelled' ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {lang === 'ne' ? 'आज रद्द भएका अर्डर' : 'Cancelled Today'}
            </span>
            <XCircle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-700 font-mono-num tabular-nums mt-1.5">
            {summary.cancelledCount}{' '}
            <span className="text-sm font-bold text-slate-500">
              ({currency} {summary.cancelledAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })})
            </span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary.cancelledCount > 0
              ? lang === 'ne'
                ? 'रद्द कारण हेर्न क्लिक गर्नुहोस्'
                : 'Click to inspect void reasons'
              : lang === 'ne'
              ? 'आज कुनै अर्डर रद्द भएको छैन'
              : 'Zero cancelled orders today'}
          </p>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 lg:pb-0">
          {(
            [
              { id: 'all', label: lang === 'ne' ? `सबै (${summary.totalOrdersCount})` : `All Today (${summary.totalOrdersCount})` },
              { id: 'completed', label: lang === 'ne' ? `तिरेको (${summary.completedCount})` : `Completed (${summary.completedCount})` },
              { id: 'unpaid', label: lang === 'ne' ? `बाँकी (${summary.unpaidCount})` : `Unpaid (${summary.unpaidCount})` },
              { id: 'cancelled', label: lang === 'ne' ? `रद्द (${summary.cancelledCount})` : `Cancelled (${summary.cancelledCount})` }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors tabular-nums ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">{lang === 'ne' ? 'सबै भुक्तानी माध्यम' : 'All Payment Channels'}</option>
            <option value="cash">{lang === 'ne' ? 'नगद मात्र (Cash)' : 'Cash Paid'}</option>
            <option value="online">{lang === 'ne' ? 'अनलाइन (Fonepay/eSewa/Card/Bank)' : 'Online (QR / Wallet / Card / Bank)'}</option>
            <option value="khata">{lang === 'ne' ? 'खाता / कोठा उधारो' : 'Khata / Room Charge'}</option>
          </select>

          <div className="relative min-w-[200px]">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ne' ? 'परिकार, बिल नं, टेबल खोज्नुहोस्...' : 'Search dish, bill #, table...'}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Orders Ledger */}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500">
          {lang === 'ne'
            ? 'आज छानिएको फिल्टर अनुसार कुनै अर्डर भेटिएन।'
            : 'No matching orders recorded today for this filter.'}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-2.5 px-4">{lang === 'ne' ? 'समय / बिल' : 'Time & Bill'}</th>
                  <th className="py-2.5 px-4">{lang === 'ne' ? 'टेबल / स्टाफ' : 'Table & Staff'}</th>
                  <th className="py-2.5 px-4">{lang === 'ne' ? 'अर्डर परिकारहरू' : 'Dishes Ordered'}</th>
                  <th className="py-2.5 px-4">{lang === 'ne' ? 'भुक्तानी माध्यम' : 'Cash / Online'}</th>
                  <th className="py-2.5 px-4">{lang === 'ne' ? 'अवस्था / कारण' : 'Status / Void Reason'}</th>
                  <th className="py-2.5 px-4 text-right">{lang === 'ne' ? 'रकम' : 'Amount'}</th>
                  <th className="py-2.5 px-4 text-center">{lang === 'ne' ? 'रसिद' : 'Bill'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map(({ order, timestampMs, dishesSummary, itemsCount, payment, isTrueCancelled }) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-slate-900 font-mono-num block">{order.invoiceNo}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {formatTime(timestampMs)} {order.kotNo ? `· ${order.kotNo}` : ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {order.tableRoomName || order.orderType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {order.cashierName || order.waiterName || 'Staff'}
                        {order.customerName ? ` · ${order.customerName}` : ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      <p className="text-slate-800 font-medium line-clamp-2" title={dishesSummary}>
                        {dishesSummary}
                      </p>
                      <span className="text-[10px] text-slate-400 tabular-nums">{itemsCount} item(s)</span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {isTrueCancelled ? (
                        <span className="text-[11px] text-slate-400">—</span>
                      ) : order.status === 'active' ? (
                        <span className="inline-flex px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[11px]">
                          {lang === 'ne' ? 'तिर्न बाँकी' : 'Pending'}
                        </span>
                      ) : (
                        <div>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded border font-semibold text-[11px] ${
                              payment.channelCategory === 'cash'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : payment.channelCategory === 'online'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                : payment.channelCategory === 'split'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {lang === 'ne' ? payment.channelLabelNe : payment.channelLabel}
                          </span>
                          {payment.channelCategory === 'split' && (
                            <span className="block text-[10px] text-slate-500 font-mono-num tabular-nums mt-0.5">
                              {payment.cash > 0 ? `Cash ${currency} ${payment.cash} ` : ''}
                              {payment.onlineTotal > 0 ? `Online ${currency} ${payment.onlineTotal} ` : ''}
                              {payment.khataCredit > 0 ? `Khata ${currency} ${payment.khataCredit}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {isTrueCancelled ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold text-[11px]">
                            <XCircle className="h-3 w-3" />
                            <span>{lang === 'ne' ? 'रद्द (Cancelled)' : 'Cancelled'}</span>
                          </span>
                          {order.voidReason && (
                            <p className="text-[11px] text-rose-700 font-medium">{order.voidReason}</p>
                          )}
                          {order.voidedBy && (
                            <p className="text-[10px] text-slate-500">By: {order.voidedBy}</p>
                          )}
                        </div>
                      ) : order.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{lang === 'ne' ? 'सम्पन्न' : 'Completed'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px]">
                          <Clock className="h-3 w-3" />
                          <span>{lang === 'ne' ? 'खुला' : 'Active'}</span>
                        </span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono-num font-bold tabular-nums whitespace-nowrap ${
                        isTrueCancelled ? 'text-rose-700 line-through' : 'text-slate-900'
                      }`}
                    >
                      {currency} {order.grandTotal.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setReceiptOrder({
                            order,
                            isEstimate: order.status === 'active'
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition-colors"
                      >
                        <Receipt className="h-3 w-3" />
                        <span>{lang === 'ne' ? 'रसिद' : 'View'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredRows.map(({ order, timestampMs, dishesSummary, payment, isTrueCancelled }) => (
              <div key={order.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 font-mono-num">{order.invoiceNo}</span>
                      <span className="text-[11px] text-slate-500 tabular-nums">{formatTime(timestampMs)}</span>
                      <span className="text-[11px] font-semibold text-slate-700">
                        {order.tableRoomName || order.orderType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium mt-1">{dishesSummary}</p>
                  </div>
                  <span
                    className={`text-sm font-black font-mono-num tabular-nums shrink-0 ${
                      isTrueCancelled ? 'text-rose-700 line-through' : 'text-slate-900'
                    }`}
                  >
                    {currency} {order.grandTotal.toFixed(2)}
                  </span>
                </div>

                {isTrueCancelled && (order.voidReason || order.voidedBy) && (
                  <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                    {order.voidReason || 'Cancelled'} {order.voidedBy ? `· ${order.voidedBy}` : ''}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                        isTrueCancelled
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : order.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {isTrueCancelled ? 'Cancelled' : order.status === 'completed' ? 'Completed' : 'Unpaid'}
                    </span>
                    {!isTrueCancelled && order.status === 'completed' && (
                      <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 text-[10px] font-semibold">
                        {lang === 'ne' ? payment.channelLabelNe : payment.channelLabel}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptOrder({ order, isEstimate: order.status === 'active' })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px]"
                  >
                    <Receipt className="h-3 w-3" />
                    <span>{lang === 'ne' ? 'बिल हेर्नुहोस्' : 'Receipt'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder.order}
          settings={settings}
          lang={lang}
          isEstimate={receiptOrder.isEstimate}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </section>
  );
};
