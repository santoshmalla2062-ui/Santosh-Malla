import React, { useState, useMemo } from 'react';
import { 
  Banknote, 
  Receipt, 
  Plus, 
  TrendingDown, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  X,
  History
} from 'lucide-react';
import { BusinessSettings, DayClosingRecord, Expense, ExpenseCategory, HotelPaymentRecord, KhataTransaction, Order, Session } from '../../types';
import { Language } from '../../utils/translations';
import { hasPermission, validateExpense } from '../../services/security';
import { classifyOrderPayment } from '../../services/orderAudit';
import { NumberInput } from '../common/NumberInput';

interface DayClosingViewProps {
  expenses: Expense[];
  dayClosings: DayClosingRecord[];
  orders: Order[];
  khataTransactions?: KhataTransaction[];
  hotelPayments?: HotelPaymentRecord[];
  settings: BusinessSettings;
  lang: Language;
  currentSession?: Session | null;
  onAddExpense: (expense: Expense) => void;
  onSaveDayClosing: (record: DayClosingRecord) => void;
}

export const DayClosingView: React.FC<DayClosingViewProps> = ({
  expenses,
  dayClosings,
  orders,
  khataTransactions = [],
  hotelPayments = [],
  settings,
  lang,
  currentSession,
  onAddExpense,
  onSaveDayClosing
}) => {
  const userRole = currentSession?.role;
  const canRecordExpense = !userRole || hasPermission(userRole, 'RECORD_EXPENSE');
  const canPerformDayClose = !userRole || hasPermission(userRole, 'PERFORM_DAY_CLOSE');
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'closing' | 'expenses' | 'history'>('closing');

  // New Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('groceries');
  const [expPaymentMode, setExpPaymentMode] = useState<'cash' | 'fonepay_qr' | 'bank_transfer'>('cash');
  const [expBillNo, setExpBillNo] = useState('');
  const [expNotes, setExpNotes] = useState('');

  // Day closing inputs (carry forward previous closing actual cash, or 0 for clean Day 1 — never fake 5000)
  const initialOpeningCash = useMemo(() => {
    const latest = dayClosings?.[0];
    return latest ? Number(latest.actualCashInDrawer ?? latest.openingCash ?? 0) : 0;
  }, [dayClosings]);

  const [openingCash, setOpeningCash] = useState<number>(initialOpeningCash);
  const [actualCashCounted, setActualCashCounted] = useState<number>(initialOpeningCash);
  const [closingNotes, setClosingNotes] = useState<string>('');

  // Calculate Today's Stats
  const todayStr = new Date().toDateString();

  const todayOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== 'completed') return false;
      const rawDate = o.settledAt || o.createdAt;
      const d = new Date(rawDate);
      return !isNaN(d.getTime()) && d.toDateString() === todayStr;
    });
  }, [orders, todayStr]);

  const todayExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && d.toDateString() === todayStr;
    });
  }, [expenses, todayStr]);

  const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

  const { totalCashSalesToday, totalDigitalSalesToday, totalCreditSalesToday } = useMemo(() => {
    let cash = 0;
    let digital = 0;
    let credit = 0;
    for (const o of todayOrders) {
      const p = classifyOrderPayment(o);
      cash += p.cash;
      digital += p.onlineTotal;
      credit += p.khataCredit;
    }
    return {
      totalCashSalesToday: round2(cash),
      totalDigitalSalesToday: round2(digital),
      totalCreditSalesToday: round2(credit)
    };
  }, [todayOrders]);

  const khataCashReceivedToday = useMemo(() => {
    return round2(
      khataTransactions
        .filter(kt => {
          if (kt.type !== 'payment_received' || kt.paymentMode !== 'cash') return false;
          const d = new Date(kt.date);
          return !isNaN(d.getTime()) && d.toDateString() === todayStr;
        })
        .reduce((sum, kt) => sum + (Number(kt.amount) || 0), 0)
    );
  }, [khataTransactions, todayStr]);

  const hotelCashReceivedToday = useMemo(() => {
    return round2(
      hotelPayments
        .filter(hp => {
          if (hp.status !== 'completed' || hp.method !== 'cash') return false;
          const d = new Date(hp.dateTime);
          return !isNaN(d.getTime()) && d.toDateString() === todayStr;
        })
        .reduce((sum, hp) => sum + (Number(hp.amount) || 0), 0)
    );
  }, [hotelPayments, todayStr]);

  const totalCashExpensesToday = round2(
    todayExpenses.reduce((sum, e) => (e.paymentMode === 'cash' ? sum + (Number(e.amount) || 0) : sum), 0)
  );

  const totalCashInflowToday = round2(totalCashSalesToday + khataCashReceivedToday + hotelCashReceivedToday);
  const expectedCash = round2((Number(openingCash) || 0) + totalCashInflowToday - totalCashExpensesToday);
  const cashDiscrepancy = round2((Number(actualCashCounted) || 0) - expectedCash);

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRecordExpense) {
      setExpenseError('Permission denied: You do not have authorization to record expenses.');
      return;
    }
    const validation = validateExpense(expTitle, expAmount);
    if (!validation.isValid) {
      setExpenseError(validation.error || 'Invalid expense values.');
      return;
    }

    const newExp: Expense = {
      id: 'exp-' + Date.now(),
      title: expTitle.trim(),
      amount: expAmount,
      category: expCategory,
      paymentMode: expPaymentMode,
      billNumber: expBillNo.trim() || undefined,
      notes: expNotes.trim() || undefined,
      date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    onAddExpense(newExp);
    setShowExpenseModal(false);
    setExpenseError(null);
    setExpTitle('');
    setExpAmount(0);
    setExpBillNo('');
    setExpNotes('');
  };

  const handleConfirmDayClosing = () => {
    if (!canPerformDayClose) {
      return;
    }
    const record: DayClosingRecord = {
      id: 'dc-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      openingCash,
      totalCashSales: totalCashSalesToday,
      totalDigitalSales: totalDigitalSalesToday,
      totalCreditSales: totalCreditSalesToday,
      totalExpenses: totalCashExpensesToday,
      expectedCashInDrawer: expectedCash,
      actualCashInDrawer: actualCashCounted,
      discrepancy: cashDiscrepancy,
      closedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      notes: closingNotes.trim() || undefined
    };

    onSaveDayClosing(record);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {lang === 'ne' ? 'काउन्टर क्यास तथा डे-क्लोजिङ (Day Closing & Expenses)' : 'Day-End Cash Closing & Expenses'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'ne' ? 'काउन्टरको नगद हिसाब मिलान, दिनभरिको खर्च र दैनिक क्लोजिङ रिपोर्ट' : 'Daily cash drawer reconciliation, petty cash expenses and closing ledger'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('closing')}
              className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === 'closing' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {lang === 'ne' ? 'आजको डे-क्लोजिङ' : 'Today Closing'}
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === 'expenses' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {lang === 'ne' ? 'दैनिक खर्चहरू' : 'Expenses'}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <History className="h-3.5 w-3.5 inline mr-1" />
              {lang === 'ne' ? 'क्लोजिङ इतिहास' : 'History'}
            </button>
          </div>

          <button
            onClick={() => setShowExpenseModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{lang === 'ne' ? '+ खर्च थप्नुहोस्' : '+ Add Expense'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'closing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Financial Reconciliation Sheet (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
              {lang === 'ne' ? 'आजको नगद मिलान पाना (Cash Reconciliation Sheet)' : "Today's Drawer Reconciliation"}
            </h3>

            <div className="space-y-3 text-xs">
              {/* Opening Float Input */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block text-sm">
                    {lang === 'ne' ? '१. सुरुवाती काउन्टर नगद (Opening Float):' : '1. Opening Drawer Float:'}
                  </span>
                  <span className="text-slate-500 text-[11px]">बिहान काउन्टरमा राखिएको खुद्रा रकम</span>
                </div>
                <div className="w-36">
                  <NumberInput
                    min={0}
                    value={openingCash}
                    onValueChange={(val) => setOpeningCash(val)}
                    className="w-full text-right px-3 py-1.5 bg-white border border-slate-300 rounded font-mono-num font-bold text-sm"
                  />
                </div>
              </div>

              {/* Total Cash Inflows */}
              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 text-emerald-950 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold block text-sm">
                      {lang === 'ne' ? '२. आजको नगद आम्दानी (Total Cash In):' : '2. Total Cash Inflows Today:'}
                    </span>
                    <span className="text-emerald-800 text-[11px] font-mono-num">
                      POS: {settings.currencySymbol} {totalCashSalesToday.toLocaleString()} ({todayOrders.length} bills)
                      {khataCashReceivedToday > 0 && ` · Khata Cash: +${settings.currencySymbol} ${khataCashReceivedToday.toLocaleString()}`}
                      {hotelCashReceivedToday > 0 && ` · Room Cash: +${settings.currencySymbol} ${hotelCashReceivedToday.toLocaleString()}`}
                    </span>
                  </div>
                  <span className="font-mono-num font-black text-base text-emerald-900">
                    + {settings.currencySymbol} {totalCashInflowToday.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Total Cash Outflows */}
              <div className="flex items-center justify-between p-3 bg-rose-50/50 rounded-lg border border-rose-200 text-rose-950">
                <div>
                  <span className="font-bold block text-sm">
                    {lang === 'ne' ? '३. काउन्टरबाट गरिएको खर्च (Cash Expenses Out):' : '3. Cash Expenses Paid Today:'}
                  </span>
                  <span className="text-rose-800 text-[11px] font-mono-num">{todayExpenses.length} expense entries</span>
                </div>
                <span className="font-mono-num font-black text-base text-rose-800">
                  - {settings.currencySymbol} {totalCashExpensesToday.toLocaleString()}
                </span>
              </div>

              {/* Expected Total in Drawer */}
              <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-xl shadow-xs">
                <div>
                  <span className="font-extrabold text-sm block">
                    {lang === 'ne' ? '४. काउन्टरमा हुनुपर्ने नगद (Expected Cash):' : '4. Expected Cash in Drawer:'}
                  </span>
                  <span className="text-slate-400 text-[11px]">(सुरुवाती + नगद बिक्री - खर्च)</span>
                </div>
                <span className="font-mono-num font-black text-xl text-amber-400">
                  {settings.currencySymbol} {expectedCash.toLocaleString()}
                </span>
              </div>

              {/* Actual Cash Counted */}
              <div className="flex items-center justify-between p-3 bg-amber-50/60 rounded-lg border border-amber-300">
                <div>
                  <span className="font-bold text-amber-950 block text-sm">
                    {lang === 'ne' ? '५. काउन्टरमा गनेर भेटिएको नगद (Counted Cash):' : '5. Actual Counted Cash:'}
                  </span>
                  <span className="text-amber-800 text-[11px]">काउन्टरका सबै नोट गनेर लेख्नुहोस्</span>
                </div>
                <div className="w-36">
                  <NumberInput
                    min={0}
                    value={actualCashCounted}
                    onValueChange={(val) => setActualCashCounted(val)}
                    className="w-full text-right px-3 py-1.5 bg-white border border-amber-400 rounded font-mono-num font-black text-base text-slate-950"
                  />
                </div>
              </div>

              {/* Discrepancy Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                cashDiscrepancy === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : cashDiscrepancy > 0
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div className="flex items-center gap-2">
                  {cashDiscrepancy === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-rose-600" />
                  )}
                  <div>
                    <span className="font-bold text-sm block">
                      {cashDiscrepancy === 0 
                        ? (lang === 'ne' ? 'हिसाब ठ्याक्कै मिल्यो (Balanced 100%)' : 'Cash Drawer Balanced Exactly') 
                        : cashDiscrepancy > 0 
                        ? (lang === 'ne' ? 'नगद बढी भयो (Cash Overage)' : 'Cash Overage')
                        : (lang === 'ne' ? 'नगद नपुग भयो (Cash Shortage)' : 'Cash Shortage')}
                    </span>
                  </div>
                </div>
                <span className="font-mono-num font-black text-base">
                  {cashDiscrepancy >= 0 ? '+' : ''}{settings.currencySymbol} {cashDiscrepancy.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Digital & Credit Sales Breakdown + Close Action (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3">
              <h4 className="font-bold text-slate-900 text-sm">
                {lang === 'ne' ? 'अन्य गैर-नगद कारोबार (Non-Cash Sales)' : 'Non-Cash Sales Today'}
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-600">Fonepay QR + Card:</span>
                  <span className="font-mono-num font-bold text-slate-900">{settings.currencySymbol} {totalDigitalSalesToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-100">
                  <span className="text-slate-600">Khata Credit (उधारो):</span>
                  <span className="font-mono-num font-bold text-rose-700">{settings.currencySymbol} {totalCreditSalesToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-2.5 bg-emerald-50 rounded border border-emerald-200 font-bold">
                  <span className="text-emerald-950">Total Gross Business Today:</span>
                  <span className="font-mono-num text-emerald-900">
                    {settings.currencySymbol} {(totalCashSalesToday + totalDigitalSalesToday + totalCreditSalesToday).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Closing Notes & Submit */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                {lang === 'ne' ? 'क्लोजिङ टिप्पणी वा कैफियत (Closing Remarks):' : 'Closing Notes / Shift Handover:'}
              </label>
              <textarea
                rows={2}
                placeholder={lang === 'ne' ? 'आजको कारोबार सन्तोषजनक रह्यो...' : 'Shift handover notes...'}
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
              />

              <button
                type="button"
                onClick={handleConfirmDayClosing}
                className="w-full py-3 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>{lang === 'ne' ? 'आजको दिन बन्द गर्नुहोस् (Confirm Day Close)' : 'Finalize & Record Day Close'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">
              {lang === 'ne' ? 'खर्चहरूको सूची (Expenses Ledger)' : 'Recorded Expenses'}
            </h3>
            <span className="font-mono-num text-xs font-bold text-slate-600">
              Total: {settings.currencySymbol} {expenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date/Time</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Amount (रू.)</th>
                  <th className="py-3 px-4">Notes / Bill #</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-500 font-mono-num whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {exp.title}
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-600">
                      {exp.category.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 uppercase text-[11px] font-semibold text-slate-700">
                      {exp.paymentMode.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-black text-rose-700 text-sm">
                      {settings.currencySymbol} {exp.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {exp.notes || exp.billNumber || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm">
              {lang === 'ne' ? 'विगतका डे-क्लोजिङ रेकर्डहरू' : 'Past Day-End Closing History'}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Closing Date</th>
                  <th className="py-3 px-4 text-right">Opening Float</th>
                  <th className="py-3 px-4 text-right">Cash Sales</th>
                  <th className="py-3 px-4 text-right">Digital Sales</th>
                  <th className="py-3 px-4 text-right">Expenses</th>
                  <th className="py-3 px-4 text-right">Counted Cash</th>
                  <th className="py-3 px-4 text-right">Discrepancy</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dayClosings.map((dc) => (
                  <tr key={dc.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono-num font-bold text-slate-800">
                      {dc.date}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-600">
                      {settings.currencySymbol} {dc.openingCash.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-emerald-800">
                      {settings.currencySymbol} {dc.totalCashSales.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-slate-600">
                      {settings.currencySymbol} {dc.totalDigitalSales.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-rose-700">
                      {settings.currencySymbol} {dc.totalExpenses.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-black text-slate-950">
                      {settings.currencySymbol} {dc.actualCashInDrawer.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold">
                      <span className={dc.discrepancy === 0 ? 'text-emerald-700' : 'text-rose-600'}>
                        {dc.discrepancy >= 0 ? '+' : ''}{settings.currencySymbol} {dc.discrepancy.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {dc.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-rose-50/60">
              <h3 className="font-bold text-rose-950 text-sm">
                {lang === 'ne' ? 'नयाँ खर्च दर्ता गर्नुहोस्' : 'Record New Expense'}
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'खर्च शीर्षक (Title) *' : 'Expense Title *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5kg Tomato & Vegetables"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'रकम (रू.) *' : 'Amount (Rs.) *'}
                  </label>
                  <NumberInput
                    min={1}
                    required
                    value={expAmount}
                    onValueChange={(val) => setExpAmount(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-rose-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="groceries">Groceries & Veg</option>
                    <option value="dairy">Dairy & Milk</option>
                    <option value="gas_fuel">Gas & Fuel</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="staff_advance">Staff Advance</option>
                    <option value="utilities">Electricity/Water</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Paid From</label>
                  <select
                    value={expPaymentMode}
                    onChange={(e) => setExpPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="cash">Counter Cash</option>
                    <option value="fonepay_qr">Fonepay QR</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bill / Voucher #</label>
                  <input
                    type="text"
                    placeholder="BIL-01"
                    value={expBillNo}
                    onChange={(e) => setExpBillNo(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Details"
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors shadow-2xs"
                >
                  {lang === 'ne' ? 'खर्च सुरक्षित गर्नुहोस्' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
