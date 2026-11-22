import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  BedDouble, 
  DollarSign, 
  Users, 
  Calendar, 
  PieChart, 
  ArrowUpRight, 
  CreditCard,
  Download,
  Printer,
  Moon,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Receipt,
  UtensilsCrossed,
  Sparkles,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';
import { 
  BusinessSettings, 
  BusinessTenant, 
  GuestFolioItem, 
  GuestProfile, 
  HotelPaymentRecord, 
  NightAuditRecord, 
  Order, 
  PaymentMethod, 
  Reservation, 
  ResortRoom 
} from '../../types';
import { Language } from '../../utils/translations';
import { 
  calculateHospitalityYieldMetrics, 
  exportTouristRegistrationToCSV, 
  formatLocalYMD,
  generateTouristRegistrationData, 
  reconcileDailyClosing,
  summarizeHotelPaymentsCashVsOnline
} from '../../services/resortSecurity';

interface ResortReportsProps {
  rooms: ResortRoom[];
  reservations: Reservation[];
  folioItems: GuestFolioItem[];
  payments: HotelPaymentRecord[];
  orders: Order[];
  guests?: GuestProfile[];
  nightAudits?: NightAuditRecord[];
  businessTenant?: BusinessTenant;
  settings: BusinessSettings;
  lang: Language;
}

type ReportSubTab = 
  | 'yield' 
  | 'daily_closing' 
  | 'room_performance' 
  | 'fb_services' 
  | 'payments' 
  | 'tourist_export' 
  | 'night_audit_log';

export const ResortReports: React.FC<ResortReportsProps> = ({
  rooms,
  reservations,
  folioItems,
  payments,
  orders,
  guests = [],
  nightAudits = [],
  businessTenant,
  settings,
  lang
}) => {
  const [activeTab, setActiveTab] = useState<ReportSubTab>('yield');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [closingDate, setClosingDate] = useState(() => formatLocalYMD());
  const [touristSearch, setTouristSearch] = useState('');

  // 1. Calculate yield analytics (date-range aware)
  const yieldMetrics = calculateHospitalityYieldMetrics(
    rooms,
    reservations,
    folioItems,
    dateFilter,
    customStart || undefined,
    customEnd || undefined
  );

  // 2. Daily Closing calculation for closingDate
  const dailyClosing = reconcileDailyClosing(
    closingDate,
    folioItems,
    payments,
    orders,
    settings.vatRatePercent || 13
  );

  // 3. Room Type Performance Metrics
  const roomTypesMap = rooms.reduce((acc, rm) => {
    const typeName = rm.roomTypeName || 'Standard Room';
    if (!acc[typeName]) {
      acc[typeName] = {
        typeName,
        totalRooms: 0,
        occupiedRooms: 0,
        totalRevenue: 0,
        soldNights: 0
      };
    }
    acc[typeName].totalRooms += 1;
    if (rm.status === 'OCCUPIED') {
      acc[typeName].occupiedRooms += 1;
    }
    return acc;
  }, {} as Record<string, { typeName: string; totalRooms: number; occupiedRooms: number; totalRevenue: number; soldNights: number }>);

  // Accumulate folio room revenue by room type
  folioItems.filter(f => f.category === 'ROOM').forEach(f => {
    const room = rooms.find(r => r.id === f.roomId);
    const typeName = room?.roomTypeName || 'Standard Room';
    if (roomTypesMap[typeName]) {
      roomTypesMap[typeName].totalRevenue += f.totalPrice;
      roomTypesMap[typeName].soldNights += f.quantity || 1;
    }
  });

  // 4. Individual Room Performance
  const individualRoomStats = rooms.map(rm => {
    const roomFolios = folioItems.filter(f => f.roomId === rm.id);
    const totalRev = roomFolios.reduce((s, f) => s + f.totalPrice, 0);
    const nights = roomFolios.filter(f => f.category === 'ROOM').reduce((s, f) => s + f.quantity, 0);
    const staysCount = reservations.filter(r => r.roomId === rm.id && (r.status === 'CHECKED_IN' || r.status === 'CHECKED_OUT')).length;
    return {
      roomId: rm.id,
      roomNumber: rm.roomNumber,
      roomTypeName: rm.roomTypeName,
      status: rm.status,
      floor: rm.floor,
      totalRevenue: totalRev,
      soldNights: nights,
      staysCount
    };
  }).sort((a, b) => b.totalRevenue - a.totalRevenue);

  // 5. Tourist Registration Data
  const touristData = generateTouristRegistrationData(guests, reservations, rooms);
  const filteredTouristData = touristData.filter(d => 
    d.guestName.toLowerCase().includes(touristSearch.toLowerCase()) ||
    d.roomNumber.toLowerCase().includes(touristSearch.toLowerCase()) ||
    d.nationality.toLowerCase().includes(touristSearch.toLowerCase()) ||
    d.idNumber.toLowerCase().includes(touristSearch.toLowerCase())
  );

  // CSV Export handler
  const handleExportTouristCSV = () => {
    const csvContent = exportTouristRegistrationToCSV(
      touristData,
      businessTenant?.businessName || settings.businessName || 'Mugu Resort'
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Tourist_Registration_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Payment Breakdown + Cash vs Online Summary
  const paymentsByTender = payments
    .filter(p => p.status !== 'refunded')
    .reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);
  const cashOnlineSummary = summarizeHotelPaymentsCashVsOnline(payments);

  // Services Breakdown
  const servicesBreakdown = folioItems
    .filter(f => f.category !== 'ROOM' && f.category !== 'RESTAURANT' && f.category !== 'CAFE' && f.category !== 'BREAKFAST')
    .reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + f.totalPrice;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-5">
      {/* Top Header & Report Navigation */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-800" />
              {lang === 'ne' ? 'रिसोर्ट विश्लेषण तथा वित्तीय रिपोर्टहरू' : 'Resort Hospitality & Yield Analytics'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {businessTenant?.businessName || settings.businessName} · ADR, RevPAR, daily closing reconciliation, and government tourist reporting
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Print Report
            </button>
            <button
              onClick={handleExportTouristCSV}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Export Tourist Reg (CSV)
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-3 text-xs font-semibold">
          {[
            { id: 'yield', label: 'Yield Analytics (ADR/RevPAR)', icon: TrendingUp },
            { id: 'daily_closing', label: 'Daily Closing Reconciliation', icon: Receipt },
            { id: 'room_performance', label: 'Room & Type Performance', icon: BedDouble },
            { id: 'fb_services', label: 'F&B & Extra Services', icon: UtensilsCrossed },
            { id: 'payments', label: 'Payment Reconciliation', icon: CreditCard },
            { id: 'tourist_export', label: 'Govt. Tourist Register', icon: FileSpreadsheet },
            { id: 'night_audit_log', label: 'Night Audit Journal', icon: Moon }
          ].map(t => {
            const Icon = t.icon;
            const isSel = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as ReportSubTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isSel ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= TAB 1: YIELD ANALYTICS (ADR, REVPAR, OCCUPANCY) ================= */}
      {activeTab === 'yield' && (
        <div className="space-y-5">
          {/* Date Range Selector */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Analytics Period:</span>
              <div className="flex gap-1">
                {(['today', 'yesterday', 'week', 'month', 'all'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDateFilter(f)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      dateFilter === f ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {f === 'week' ? 'Last 7 Days' : f === 'month' ? 'This Month' : f}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span>Sellable Rooms: <strong className="text-slate-800">{yieldMetrics.sellableRooms}</strong></span>
              <span>· Out of Service: <strong className="text-rose-700">{yieldMetrics.outOfServiceRooms + yieldMetrics.maintenanceRooms}</strong></span>
            </div>
          </div>

          {/* Hospitality Core KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Occupancy Rate */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Occupancy Rate
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                  <BedDouble className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono-num">{yieldMetrics.occupancyRate}%</span>
                <span className="text-xs font-semibold text-emerald-700">
                  ({yieldMetrics.soldRoomNights} / {yieldMetrics.availableRoomNights} Nights)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Excludes maintenance & out-of-service rooms</p>
            </div>

            {/* ADR (Average Daily Rate) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  ADR (Avg Daily Rate)
                </span>
                <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 font-mono-num">
                  {settings.currencySymbol} {yieldMetrics.adr}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Pure room revenue ÷ Sold room nights</p>
            </div>

            {/* RevPAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  RevPAR (Yield)
                </span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-800">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 font-mono-num">
                  {settings.currencySymbol} {yieldMetrics.revpar}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Room revenue ÷ Available sellable rooms</p>
            </div>

            {/* Total Room Accommodation Revenue */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Total Room Revenue
                </span>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-800">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 font-mono-num">
                  {settings.currencySymbol} {yieldMetrics.roomRevenue.toFixed(0)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Cumulative room stays billed</p>
            </div>
          </div>

          {/* Revenue Stream Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">
                Total Hospitality Revenue Composition
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-700 font-semibold mb-1">
                    <span>Room Accommodation Charges</span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {settings.currencySymbol} {yieldMetrics.roomRevenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-emerald-800 h-2 rounded-full" 
                      style={{ width: `${yieldMetrics.totalHospitalityRevenue > 0 ? (yieldMetrics.roomRevenue / yieldMetrics.totalHospitalityRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-700 font-semibold mb-1">
                    <span>Food & Beverage Dining (POS & Folio)</span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {settings.currencySymbol} {yieldMetrics.fbRevenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-amber-600 h-2 rounded-full" 
                      style={{ width: `${yieldMetrics.totalHospitalityRevenue > 0 ? (yieldMetrics.fbRevenue / yieldMetrics.totalHospitalityRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-700 font-semibold mb-1">
                    <span>Resort Services (Spa, Airport, Laundry, Tours)</span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {settings.currencySymbol} {yieldMetrics.serviceRevenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full" 
                      style={{ width: `${yieldMetrics.totalHospitalityRevenue > 0 ? (yieldMetrics.serviceRevenue / yieldMetrics.totalHospitalityRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs font-bold text-slate-900">
                <span>Total Hospitality Revenue:</span>
                <span className="text-base text-emerald-800 font-mono-num">
                  {settings.currencySymbol} {yieldMetrics.totalHospitalityRevenue.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Booking Channel Distribution */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">
                Guest Acquisition Channels & Market Share
              </h3>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
                {Object.entries(
                  reservations.reduce((acc, r) => {
                    acc[r.bookingSource] = (acc[r.bookingSource] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([source, count]) => {
                  const pct = ((count / Math.max(1, reservations.length)) * 100).toFixed(0);
                  return (
                    <div key={source} className="p-3 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <p className="font-bold text-slate-800">{source}</p>
                        <p className="text-[10px] text-slate-400">{count} bookings ({pct}%)</p>
                      </div>
                      <div className="w-24 bg-slate-100 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: DAILY CLOSING RECONCILIATION ================= */}
      {activeTab === 'daily_closing' && (
        <div className="space-y-5">
          {/* Closing Date Picker */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Daily Financial Closing & Cashier Reconciliation</h3>
              <p className="text-xs text-slate-500">Gross sales, net revenue, department turnover, and payment tender balance</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Closing Date:</span>
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
              />
            </div>
          </div>

          {/* Daily Closing Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Gross Sales</span>
              <p className="text-xl font-black text-slate-900 font-mono-num">
                {settings.currencySymbol} {dailyClosing.grossSales.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400">Rooms + Dining + Services</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Total Taxes ({settings.vatRatePercent || 13}%)</span>
              <p className="text-xl font-black text-blue-900 font-mono-num">
                {settings.currencySymbol} {dailyClosing.taxes.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400">VAT / Service levy</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Payments Collected</span>
              <p className="text-xl font-black text-emerald-800 font-mono-num">
                {settings.currencySymbol} {dailyClosing.totalPaymentsCollected.toFixed(2)}
              </p>
              <p className="text-[10px] text-emerald-700">All tender receipts</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Outstanding / Unsettled</span>
              <p className="text-xl font-black text-amber-700 font-mono-num">
                {settings.currencySymbol} {dailyClosing.outstandingBalance.toFixed(2)}
              </p>
              <p className="text-[10px] text-amber-600">Pending on guest accounts</p>
            </div>
          </div>

          {/* Department Breakdown & Payment Tender Reconciliation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                Department Revenue Turnover ({closingDate})
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Room Accommodation Revenue</span>
                  <span className="font-mono-num font-bold text-slate-900">
                    {settings.currencySymbol} {dailyClosing.roomRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Restaurant Dining</span>
                  <span className="font-mono-num font-bold text-slate-900">
                    {settings.currencySymbol} {dailyClosing.restaurantRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Cafe / Coffee Bar</span>
                  <span className="font-mono-num font-bold text-slate-900">
                    {settings.currencySymbol} {dailyClosing.cafeRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Room Service</span>
                  <span className="font-mono-num font-bold text-slate-900">
                    {settings.currencySymbol} {dailyClosing.roomServiceRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center">
                  <span className="text-slate-700 font-medium">Extra Services (Spa, Laundry, Tours)</span>
                  <span className="font-mono-num font-bold text-slate-900">
                    {settings.currencySymbol} {dailyClosing.extraServiceRevenue.toFixed(2)}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between items-center font-bold text-slate-900 bg-slate-50 px-2 rounded">
                  <span>Gross Sales Total:</span>
                  <span className="font-mono-num text-emerald-800">
                    {settings.currencySymbol} {dailyClosing.grossSales.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Method Reconciliation */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                Payment Tender Settlements ({closingDate})
              </h4>
              <div className="divide-y divide-slate-100 text-xs">
                {Object.entries(dailyClosing.paymentsByMethod).map(([method, amount]) => (
                  <div key={method} className="py-2 flex justify-between items-center">
                    <span className="capitalize font-medium text-slate-700">
                      {method.replace('_', ' ')}
                    </span>
                    <span className="font-mono-num font-bold text-slate-900">
                      {settings.currencySymbol} {amount.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="py-2.5 flex justify-between items-center font-bold text-slate-900 bg-emerald-50 px-2 rounded">
                  <span>Total Payments Reconciled:</span>
                  <span className="font-mono-num text-emerald-800">
                    {settings.currencySymbol} {dailyClosing.totalPaymentsCollected.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: ROOM & TYPE PERFORMANCE ================= */}
      {activeTab === 'room_performance' && (
        <div className="space-y-6">
          {/* Room Type Performance */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Room Type Yield & Occupancy Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Room Type</th>
                    <th className="py-2.5 px-3">Inventory</th>
                    <th className="py-2.5 px-3">Current Occupied</th>
                    <th className="py-2.5 px-3">Sold Nights</th>
                    <th className="py-2.5 px-3">Room Revenue</th>
                    <th className="py-2.5 px-3">Avg Rate (ADR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {Object.values(roomTypesMap).map((rt) => {
                    const typeAdr = rt.soldNights > 0 ? (rt.totalRevenue / rt.soldNights).toFixed(0) : '0';
                    return (
                      <tr key={rt.typeName} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{rt.typeName}</td>
                        <td className="py-2.5 px-3">{rt.totalRooms} rooms</td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-emerald-800">{rt.occupiedRooms}</span> ({((rt.occupiedRooms / Math.max(1, rt.totalRooms)) * 100).toFixed(0)}%)
                        </td>
                        <td className="py-2.5 px-3 font-mono-num">{rt.soldNights} nights</td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-slate-900">
                          {settings.currencySymbol} {rt.totalRevenue.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num">
                          {settings.currencySymbol} {typeAdr}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual Room Performance */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Individual Room Turnover & Stays Log</h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-y border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Room #</th>
                    <th className="py-2.5 px-3">Room Type</th>
                    <th className="py-2.5 px-3">Floor / Wing</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Total Stays</th>
                    <th className="py-2.5 px-3">Nights Sold</th>
                    <th className="py-2.5 px-3">Total Billed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {individualRoomStats.map((rm) => (
                    <tr key={rm.roomId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-black text-slate-900">Room {rm.roomNumber}</td>
                      <td className="py-2 px-3 text-slate-600">{rm.roomTypeName}</td>
                      <td className="py-2 px-3 text-slate-500">{rm.floor}</td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          rm.status === 'OCCUPIED' ? 'bg-indigo-100 text-indigo-800' :
                          rm.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' :
                          rm.status === 'DIRTY' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {rm.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono-num">{rm.staysCount}</td>
                      <td className="py-2 px-3 font-mono-num">{rm.soldNights}</td>
                      <td className="py-2 px-3 font-mono-num font-bold text-emerald-800">
                        {settings.currencySymbol} {rm.totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: F&B & EXTRA SERVICES ================= */}
      {activeTab === 'fb_services' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* F&B Outlet Turnover */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-amber-700" />
              Food & Beverage Outlet Reconciliation
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-800 block">Direct Restaurant & POS Orders</span>
                  <span className="text-[10px] text-slate-500">Dine-in, takeaway, and counter service</span>
                </div>
                <span className="font-mono-num font-black text-slate-900 text-sm">
                  {settings.currencySymbol} {orders.reduce((s, o) => s + (o.paymentMethod !== 'charge_to_room' ? o.grandTotal : 0), 0).toFixed(2)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                <div>
                  <span className="font-bold text-slate-800 block">Room Folio F&B Charges (Charge to Room)</span>
                  <span className="text-[10px] text-slate-500">Directly posted to resident guest accounts</span>
                </div>
                <span className="font-mono-num font-black text-emerald-800 text-sm">
                  {settings.currencySymbol} {folioItems.filter(f => f.category === 'RESTAURANT' || f.category === 'CAFE' || f.category === 'BREAKFAST').reduce((s, f) => s + f.totalPrice, 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Extra Services Breakdown */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-700" />
              Resort Extra Services Revenue
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
              {Object.keys(servicesBreakdown).length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic">No extra service charges recorded yet</div>
              ) : (
                Object.entries(servicesBreakdown).map(([cat, amt]) => (
                  <div key={cat} className="p-3 flex justify-between items-center hover:bg-slate-50">
                    <span className="font-bold text-slate-800 uppercase">{cat.replace('_', ' ')}</span>
                    <span className="font-mono-num font-bold text-purple-900">
                      {settings.currencySymbol} {amt.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: PAYMENT RECONCILIATION ================= */}
      {activeTab === 'payments' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-900 text-sm">Hotel Payment Method Settlements</h3>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg font-mono-num">
                Cash: <strong className="text-emerald-900">{settings.currencySymbol} {cashOnlineSummary.cash.toFixed(2)}</strong>
              </span>
              <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg font-mono-num">
                Online (QR/Wallet/Card/Bank): <strong className="text-blue-900">{settings.currencySymbol} {cashOnlineSummary.online.toFixed(2)}</strong>
              </span>
              <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg font-mono-num">
                Total: <strong className="text-slate-900">{settings.currencySymbol} {cashOnlineSummary.total.toFixed(2)}</strong>
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Payment Tender</th>
                  <th className="py-2.5 px-3">Receipt Count</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {Object.entries(paymentsByTender).map(([m, amt]) => {
                  const count = payments.filter(p => p.method === m && p.status !== 'refunded').length;
                  return (
                    <tr key={m} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900 capitalize">{m.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3 font-mono-num">{count} payments</td>
                      <td className="py-2.5 px-3 font-mono-num font-bold text-emerald-800">
                        {settings.currencySymbol} {amt.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                          Reconciled
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 6: GOVERNMENT / TOURIST REGISTRATION EXPORT ================= */}
      {activeTab === 'tourist_export' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Department of Tourism & Tourist Police Registration Register
              </h3>
              <p className="text-xs text-slate-500">
                Official guest registration record compliance with nationality, identification, and stay periods
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search guest or room..."
                  value={touristSearch}
                  onChange={(e) => setTouristSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48"
                />
              </div>
              <button
                onClick={handleExportTouristCSV}
                className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-y border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">S.N.</th>
                  <th className="py-2.5 px-3">Guest Full Name</th>
                  <th className="py-2.5 px-3">Nationality</th>
                  <th className="py-2.5 px-3">ID / Passport #</th>
                  <th className="py-2.5 px-3">Room</th>
                  <th className="py-2.5 px-3">Check-In</th>
                  <th className="py-2.5 px-3">Check-Out</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTouristData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                      No matching tourist registrations found.
                    </td>
                  </tr>
                ) : (
                  filteredTouristData.map(t => (
                    <tr key={t.sn} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-num">{t.sn}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{t.guestName}</td>
                      <td className="py-2.5 px-3">{t.nationality}</td>
                      <td className="py-2.5 px-3 font-mono-num">{t.idType}: {t.idNumber}</td>
                      <td className="py-2.5 px-3 font-bold text-emerald-800">Room {t.roomNumber}</td>
                      <td className="py-2.5 px-3 font-mono-num">{t.checkInDate}</td>
                      <td className="py-2.5 px-3 font-mono-num">{t.checkOutDate}</td>
                      <td className="py-2.5 px-3 text-slate-500">{t.purposeOfVisit}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          t.bookingStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' :
                          t.bookingStatus === 'CHECKED_OUT' ? 'bg-slate-100 text-slate-700' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {t.bookingStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 7: NIGHT AUDIT JOURNAL ================= */}
      {activeTab === 'night_audit_log' && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Moon className="h-4 w-4 text-indigo-900" />
            Night Audit Closing Journal
          </h3>
          {nightAudits.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 italic">
              No Night Audit records found. Run the Night Audit wizard to post room charges and close the business day.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {nightAudits.map((a) => (
                <div key={a.id} className="p-4 bg-white hover:bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">Business Date: {a.businessDate}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                        {a.status}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Auditor: {a.startedBy} · Executed: {a.completedAt || a.startedAt}
                    </p>
                    <p className="text-slate-600 italic text-[11px] mt-1">{a.notes}</p>
                  </div>
                  <div className="text-right sm:border-l sm:pl-4 border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Room Charges Posted</span>
                    <span className="font-mono-num font-bold text-emerald-800 text-base">
                      {settings.currencySymbol} {a.totalRoomChargesPosted.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Occupancy: {a.occupancyPercent}% ({a.totalRoomsOccupied} rooms)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
