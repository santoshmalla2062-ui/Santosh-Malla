import React, { useState, useMemo } from 'react';
import { 
  Users, 
  BookOpen, 
  Award, 
  Search, 
  UserPlus, 
  Phone, 
  MessageCircle, 
  Download, 
  DollarSign, 
  X, 
  Check, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar 
} from 'lucide-react';
import { BusinessSettings, Customer, KhataTransaction, Session } from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { exportCustomerKhataCSV } from '../../services/storage';
import { hasPermission, validateCustomerInput } from '../../services/security';

interface CustomerViewProps {
  customers: Customer[];
  khataTransactions: KhataTransaction[];
  settings: BusinessSettings;
  lang: Language;
  currentSession?: Session | null;
  onAddCustomer: (customer: Customer) => void;
  onRecordKhataPayment: (customerId: string, amount: number, paymentMode: 'cash' | 'fonepay_qr' | 'bank_transfer', notes: string) => void;
  onAddKhataCredit: (customerId: string, amount: number, notes: string) => void;
}

export const CustomerView: React.FC<CustomerViewProps> = ({
  customers,
  khataTransactions,
  settings,
  lang,
  currentSession,
  onAddCustomer,
  onRecordKhataPayment,
  onAddKhataCredit
}) => {
  const t = TRANSLATIONS[lang];
  const userRole = currentSession?.role;
  const canCollectKhata = !userRole || hasPermission(userRole, 'COLLECT_KHATA_PAYMENT');
  const canAdjustCredit = !userRole || hasPermission(userRole, 'ADJUST_KHATA_CREDIT');
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [onlyDebtors, setOnlyDebtors] = useState(false);

  // Modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustNepaliName, setNewCustNepaliName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustType, setNewCustType] = useState<'regular' | 'vip' | 'resort_guest' | 'corporate'>('regular');
  const [newCustInitialCredit, setNewCustInitialCredit] = useState(0);

  // Collect Payment Modal
  const [collectTarget, setCollectTarget] = useState<Customer | null>(null);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMode, setCollectMode] = useState<'cash' | 'fonepay_qr' | 'bank_transfer'>('cash');
  const [collectNotes, setCollectNotes] = useState<string>('');

  // Give Credit Modal
  const [creditTarget, setCreditTarget] = useState<Customer | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [creditNotes, setCreditNotes] = useState<string>('');

  // Ledger History Modal
  const [ledgerTarget, setLedgerTarget] = useState<Customer | null>(null);

  // Calculations
  const totalKhataBalance = customers.reduce((sum, c) => sum + c.creditBalance, 0);
  const debtorsCount = customers.filter(c => c.creditBalance > 0).length;
  const totalLoyalty = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery) ||
        (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === 'all' || c.customerType === filterType;
      const matchesDebtor = onlyDebtors ? c.creditBalance > 0 : true;
      return matchesSearch && matchesType && matchesDebtor;
    });
  }, [customers, searchQuery, filterType, onlyDebtors]);

  const handleOpenCollect = (customer: Customer) => {
    setCollectTarget(customer);
    setCollectAmount(customer.creditBalance);
    setCollectMode('cash');
    setCollectNotes(lang === 'ne' ? 'उधारो चुक्ता भुक्तानी' : 'Khata credit settlement');
  };

  const handleConfirmCollect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCollectKhata) {
      setCustomerError('Permission denied: You do not have permission to collect Khata payments.');
      return;
    }
    if (!collectTarget || collectAmount <= 0 || !Number.isFinite(collectAmount)) return;
    onRecordKhataPayment(collectTarget.id, collectAmount, collectMode, collectNotes);
    setCollectTarget(null);
    setCustomerError(null);
  };

  const handleOpenCredit = (customer: Customer) => {
    setCreditTarget(customer);
    setCreditAmount(500);
    setCreditNotes(lang === 'ne' ? 'थप उधारो' : 'Additional credit');
    setCustomerError(null);
  };

  const handleConfirmCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdjustCredit) {
      setCustomerError('Permission denied: Only authorized staff (Accountant/Manager/Admin) can manually add Khata credit.');
      return;
    }
    if (!creditTarget || creditAmount <= 0 || !Number.isFinite(creditAmount)) return;
    onAddKhataCredit(creditTarget.id, creditAmount, creditNotes);
    setCreditTarget(null);
    setCustomerError(null);
  };

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCustomerInput(newCustName, newCustPhone, newCustInitialCredit);
    if (!validation.isValid) {
      setCustomerError(validation.error || 'Invalid customer input.');
      return;
    }

    const newCust: Customer = {
      id: 'c-' + Date.now(),
      name: newCustName.trim(),
      nepaliName: newCustNepaliName.trim() || undefined,
      phone: newCustPhone.trim(),
      email: newCustEmail.trim() || undefined,
      address: newCustAddress.trim() || undefined,
      customerType: newCustType,
      creditBalance: Number(newCustInitialCredit) || 0,
      loyaltyPoints: 0,
      totalSpend: 0,
      totalVisits: 1,
      createdAt: new Date().toISOString().split('T')[0]
    };

    onAddCustomer(newCust);
    setShowAddCustomerModal(false);
    setCustomerError(null);
    setNewCustName('');
    setNewCustNepaliName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustAddress('');
    setNewCustInitialCredit(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {lang === 'ne' ? 'कुल दर्ता ग्राहक (Total Customers)' : 'Registered Customers'}
            </span>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono-num mt-2">
            {customers.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne' ? 'नियमित तथा रिसोर्ट अतिथिहरू' : 'Regulars & Resort Guests'}
          </p>
        </div>

        <div className={`p-5 rounded-xl border shadow-2xs ${totalKhataBalance > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
              {t.totalUdharo}
            </span>
            <BookOpen className="h-5 w-5 text-amber-700" />
          </div>
          <p className="text-2xl font-black font-mono-num mt-2 text-rose-700">
            {settings.currencySymbol} {totalKhataBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-amber-800 mt-1 font-medium">
            {debtorsCount} {lang === 'ne' ? 'ग्राहकहरूबाट उठ्न बाँकी' : 'customers with outstanding balance'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {lang === 'ne' ? 'कुल लोयल्टी पोइन्ट' : 'Total Loyalty Points'}
            </span>
            <Award className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-900 font-mono-num mt-2">
            {totalLoyalty.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'ne' ? 'रू १०० = १ पोइन्ट' : '1 point per Rs. 100 spent'}
          </p>
        </div>
      </div>

      {/* Main Customer Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              {(['all', 'regular', 'vip', 'resort_guest', 'corporate'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-md capitalize transition-colors ${filterType === type ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {type === 'all' ? (lang === 'ne' ? 'सबै' : 'All') : type.replace('_', ' ')}
                </button>
              ))}
            </div>

            {debtorsCount > 0 && (
              <button
                onClick={() => setOnlyDebtors(!onlyDebtors)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${onlyDebtors ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'}`}
              >
                {onlyDebtors ? 'Show All' : `⚠️ ${debtorsCount} ${lang === 'ne' ? 'बाँकी उधारो मात्र' : 'With Khata Due'}`}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCustomerKhataCSV(customers)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>{t.exportCSV}</span>
            </button>
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{t.addCustomer}</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={lang === 'ne' ? 'ग्राहकको नाम वा फोन नम्बर खोज्नुहोस्...' : 'Search customers by name, phone number, address...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Khata Due (उधारो)</th>
                <th className="py-3 px-4 text-right">Loyalty Points</th>
                <th className="py-3 px-4 text-right">Total Spend</th>
                <th className="py-3 px-4 text-center">Visits</th>
                <th className="py-3 px-4">Contact & WhatsApp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((cust) => {
                const hasDue = cust.creditBalance > 0;
                return (
                  <tr key={cust.id} className={`hover:bg-slate-50/80 transition-colors ${hasDue ? 'bg-amber-50/30' : ''}`}>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 text-sm leading-tight">{cust.name}</p>
                      {cust.nepaliName && (
                        <p className="text-[11px] text-slate-500">{cust.nepaliName}</p>
                      )}
                      {cust.address && (
                        <p className="text-[11px] text-slate-400">{cust.address}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {cust.customerType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num">
                      {hasDue ? (
                        <div className="inline-block text-right">
                          <span className="font-black text-sm text-rose-700 block">
                            {settings.currencySymbol} {cust.creditBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-rose-600 font-bold uppercase">
                            उधारो बाँकी
                          </span>
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-semibold text-xs">
                          Clear (चुक्ता)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-indigo-900">
                      {cust.loyaltyPoints} pts
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-slate-800">
                      {settings.currencySymbol} {cust.totalSpend.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center font-mono-num text-slate-600 font-medium">
                      {cust.totalVisits}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-slate-700">{cust.phone}</span>
                        <a
                          href={`https://wa.me/977${cust.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Namaste ${cust.name}, Himalayan Breeze Resort & Cafe बाट नमस्कार!`)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Send WhatsApp message"
                          className="p-1 rounded text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setLedgerTarget(cust)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          title="View Ledger"
                        >
                          {lang === 'ne' ? 'खाता' : 'Ledger'}
                        </button>
                        {hasDue && (
                          <button
                            onClick={() => handleOpenCollect(cust)}
                            className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors"
                          >
                            {lang === 'ne' ? 'चुक्ता लिनुहोस्' : 'Receive'}
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenCredit(cust)}
                          className="px-2 py-1 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                          title="Add Credit"
                        >
                          + {lang === 'ne' ? 'उधारो' : 'Credit'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Payment Modal */}
      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-emerald-50/70">
              <h3 className="font-bold text-emerald-950 text-sm">
                {lang === 'ne' ? 'उधारो रकम भुक्तानी संकलन (Collect Payment)' : 'Receive Khata Payment'}
              </h3>
              <button onClick={() => setCollectTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCollect} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Customer:</span>
                <span className="font-bold text-slate-900 text-sm">{collectTarget.name} ({collectTarget.phone})</span>
                <p className="text-[11px] text-slate-600 mt-1">
                  Outstanding Due Balance: <span className="font-mono-num font-black text-rose-700 text-sm">{settings.currencySymbol} {collectTarget.creditBalance.toFixed(2)}</span>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'प्राप्त रकम (Amount Received) *' : 'Amount Received *'}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max={collectTarget.creditBalance}
                    required
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-black text-base text-emerald-900"
                  />
                  <button
                    type="button"
                    onClick={() => setCollectAmount(collectTarget.creditBalance)}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 font-bold rounded-lg text-slate-700 whitespace-nowrap"
                  >
                    Full
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'भुक्तानी माध्यम (Payment Mode):' : 'Payment Mode:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCollectMode('cash')}
                    className={`py-2 px-1 text-center font-bold rounded border ${collectMode === 'cash' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
                  >
                    Cash (नगद)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMode('fonepay_qr')}
                    className={`py-2 px-1 text-center font-bold rounded border ${collectMode === 'fonepay_qr' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
                  >
                    Fonepay QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setCollectMode('bank_transfer')}
                    className={`py-2 px-1 text-center font-bold rounded border ${collectMode === 'bank_transfer' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
                  >
                    Bank Transfer
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'कैफियत / टिप्पणी:' : 'Notes / Remarks:'}
                </label>
                <input
                  type="text"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 flex justify-between items-center text-xs">
                <span className="text-emerald-900 font-medium">{lang === 'ne' ? 'नयाँ बाँकी रकम:' : 'Remaining Balance:'}</span>
                <span className="font-mono-num font-bold text-emerald-950">
                  {settings.currencySymbol} {Math.max(0, collectTarget.creditBalance - collectAmount).toFixed(2)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCollectTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  {lang === 'ne' ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
                >
                  {lang === 'ne' ? 'रकम चुक्ता स्वीकार्नुहोस्' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Give Credit Modal */}
      {creditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-amber-50">
              <h3 className="font-bold text-amber-950 text-sm">
                {lang === 'ne' ? 'खातामा थप उधारो चढाउनुहोस् (Add Credit)' : 'Add Credit to Khata'}
              </h3>
              <button onClick={() => setCreditTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCredit} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block">Customer:</span>
                <span className="font-bold text-slate-900 text-sm">{creditTarget.name}</span>
                <p className="text-[11px] text-slate-600 mt-1">
                  Current Due: <span className="font-mono-num font-bold text-rose-700">{settings.currencySymbol} {creditTarget.creditBalance.toFixed(2)}</span>
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'उधारो रकम (Amount) *' : 'Credit Amount *'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-black text-base text-amber-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'कारण / विवरण (Notes):' : 'Reason / Reference:'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Extra lunch takeaway / room amenity"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex justify-between items-center text-xs">
                <span className="text-amber-900 font-medium">{lang === 'ne' ? 'नयाँ कुल उधारो:' : 'New Total Due:'}</span>
                <span className="font-mono-num font-bold text-amber-950">
                  {settings.currencySymbol} {(creditTarget.creditBalance + creditAmount).toFixed(2)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreditTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  {lang === 'ne' ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg transition-colors shadow-2xs"
                >
                  {lang === 'ne' ? 'उधारो थप्नुहोस्' : 'Confirm Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Khata Ledger History Modal */}
      {ledgerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'ne' ? 'ग्राहक खाता विवरण (Account Statement)' : 'Customer Khata Ledger'}
                </h3>
                <p className="text-xs text-slate-500">
                  {ledgerTarget.name} · {ledgerTarget.phone}
                </p>
              </div>
              <button onClick={() => setLedgerTarget(null)} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 bg-amber-50/50 border-b border-slate-200 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-500 block">Current Balance:</span>
                <span className="font-mono-num font-bold text-base text-rose-700">
                  {settings.currencySymbol} {ledgerTarget.creditBalance.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Lifetime Spend:</span>
                <span className="font-mono-num font-semibold text-slate-800">
                  {settings.currencySymbol} {ledgerTarget.totalSpend.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Loyalty Points:</span>
                <span className="font-mono-num font-semibold text-indigo-700">
                  {ledgerTarget.loyaltyPoints}
                </span>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Debit (उधारो लियो)</th>
                    <th className="py-2 px-3 text-right">Credit (चुक्ता गर्यो)</th>
                    <th className="py-2 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {khataTransactions
                    .filter(kt => kt.customerId === ledgerTarget.id)
                    .map((kt) => {
                      const isTaken = kt.type === 'credit_taken';
                      return (
                        <tr key={kt.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-500 font-mono-num whitespace-nowrap">
                            {kt.date}
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-medium text-slate-900">{kt.notes || (isTaken ? 'Bill credit' : 'Payment received')}</p>
                            {kt.invoiceNo && (
                              <p className="text-[10px] text-slate-400 font-mono-num">{kt.invoiceNo}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num font-bold text-rose-700">
                            {isTaken ? `${settings.currencySymbol} ${kt.amount.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num font-bold text-emerald-700">
                            {!isTaken ? `${settings.currencySymbol} ${kt.amount.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-num font-bold text-slate-900">
                            {settings.currencySymbol} {kt.balanceAfter.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {khataTransactions.filter(kt => kt.customerId === ledgerTarget.id).length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  कुनै कारोबार विवरण छैन (No Khata transactions recorded yet)
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setLedgerTarget(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {t.addCustomer}
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'ग्राहकको पूरा नाम (Full Name) *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunil Gurung"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'नेपाली नाम' : 'Nepali Name'}
                </label>
                <input
                  type="text"
                  placeholder="उदा. सुनिल गुरुङ"
                  value={newCustNepaliName}
                  onChange={(e) => setNewCustNepaliName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'सम्पर्क नम्बर *' : 'Phone Number *'}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="98XXXXXXXX"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'ग्राहक वर्ग:' : 'Customer Type:'}
                  </label>
                  <select
                    value={newCustType}
                    onChange={(e) => setNewCustType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="regular">Regular</option>
                    <option value="vip">VIP</option>
                    <option value="resort_guest">Resort Guest</option>
                    <option value="corporate">Corporate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'ठेगाना (Address):' : 'Address:'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lakeside, Pokhara"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'सुरुवाती पुरानो बाँकी उधारो (रू.):' : 'Initial Due Balance (Rs.):'}
                </label>
                <input
                  type="number"
                  min="0"
                  value={newCustInitialCredit}
                  onChange={(e) => setNewCustInitialCredit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  {lang === 'ne' ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-2xs"
                >
                  {lang === 'ne' ? 'दर्ता गर्नुहोस्' : 'Register Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
