import React from 'react';
import { 
  Building, 
  DoorOpen, 
  DoorClosed, 
  BedDouble, 
  Users, 
  Calendar, 
  Sparkles, 
  Wrench, 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  Plus, 
  Moon, 
  ArrowRight,
  Receipt,
  Banknote,
  QrCode
} from 'lucide-react';
import { 
  BusinessSettings, 
  GuestFolioItem, 
  HotelPaymentRecord, 
  HousekeepingTask, 
  MaintenanceIssue, 
  Reservation, 
  ResortRoom, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';
import {
  computeReservationFolioMetrics,
  formatLocalYMD,
  summarizeHotelPaymentsCashVsOnline
} from '../../services/resortSecurity';

interface ResortDashboardProps {
  rooms: ResortRoom[];
  reservations: Reservation[];
  folioItems: GuestFolioItem[];
  payments?: HotelPaymentRecord[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceIssues: MaintenanceIssue[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onNavigateTab: (tab: string) => void;
  onOpenCheckIn: (reservation: Reservation) => void;
  onOpenCheckOut: (reservation: Reservation) => void;
  onOpenFolio: (reservation: Reservation) => void;
  onOpenNewBooking: () => void;
  onOpenNightAudit: () => void;
}

export const ResortDashboard: React.FC<ResortDashboardProps> = ({
  rooms,
  reservations,
  folioItems,
  payments = [],
  housekeepingTasks,
  maintenanceIssues,
  settings,
  currentSession,
  lang,
  onNavigateTab,
  onOpenCheckIn,
  onOpenCheckOut,
  onOpenFolio,
  onOpenNewBooking,
  onOpenNightAudit
}) => {
  const todayStr = formatLocalYMD();

  // Room counts
  const totalRooms = rooms.length;
  const availableRooms = rooms.filter(r => r.status === 'AVAILABLE').length;
  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
  const reservedRooms = rooms.filter(r => r.status === 'RESERVED').length;
  const cleaningRooms = rooms.filter(r => r.status === 'CLEANING').length;
  const dirtyRooms = rooms.filter(r => r.status === 'DIRTY').length;
  const maintenanceRooms = rooms.filter(r => r.status === 'MAINTENANCE').length;
  const outOfServiceRooms = rooms.filter(r => r.status === 'OUT_OF_SERVICE').length;

  const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0';

  // Today's arrivals (reservations checking in today and not yet checked in)
  const todayArrivals = reservations.filter(
    r => r.checkInDate === todayStr && r.status === 'CONFIRMED'
  );

  // Today's departures (checked-in reservations checking out on or before today)
  const todayDepartures = reservations.filter(
    r => r.checkOutDate <= todayStr && r.status === 'CHECKED_IN'
  );

  // In-house guests (checked-in)
  const inHouseGuests = reservations.filter(r => r.status === 'CHECKED_IN');

  // Helper for live folio metrics per reservation
  const getResMetrics = (res: Reservation) =>
    computeReservationFolioMetrics(
      folioItems.filter(f => f.reservationId === res.id),
      payments.filter(p => p.reservationId === res.id),
      res,
      settings
    );

  // Outstanding guest payments (sum of accurate balance due of active checked-in stays)
  const outstandingPayments = inHouseGuests.reduce((sum, r) => sum + getResMetrics(r).balanceDue, 0);

  // Today's estimated room revenue (from daily room rate of occupied rooms)
  const todayRoomRevenue = inHouseGuests.reduce((sum, r) => sum + r.roomRate, 0);

  // Today's Cash vs Online room/hotel collections
  const todayCollections = summarizeHotelPaymentsCashVsOnline(payments, todayStr);
  const openMaintenanceCount = maintenanceIssues.filter(
    m => m.status !== 'resolved' && m.status !== 'closed'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building className="h-6 w-6 text-emerald-800" />
            <h1 className="text-lg font-black text-slate-900 tracking-tight">
              {lang === 'ne' ? 'रिसोर्ट तथा होटेल व्यवस्थापन ड्यासबोर्ड' : 'Resort & Hotel Operations Dashboard'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {settings.businessName} · Live Operations & In-House Guest Management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenNewBooking}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Reservation
          </button>
          <button
            onClick={onOpenNightAudit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
          >
            <Moon className="h-4 w-4 text-indigo-300" />
            Night Audit Wizard
          </button>
        </div>
      </div>

      {/* KPI Cards: Rooms, Revenue & Flow */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Rooms */}
        <div 
          onClick={() => onNavigateTab('rooms')} 
          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-emerald-600 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Total Rooms</span>
            <BedDouble className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono-num mt-1">{totalRooms}</p>
          <span className="text-[10px] text-emerald-800 font-semibold">{occupancyRate}% Occupied</span>
        </div>

        {/* Available Rooms */}
        <div 
          onClick={() => onNavigateTab('rooms')} 
          className="bg-white p-3.5 rounded-xl border border-emerald-300 hover:border-emerald-600 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">Available</span>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-950 font-mono-num mt-1">{availableRooms}</p>
          <span className="text-[10px] text-slate-400">Ready for walk-in</span>
        </div>

        {/* Occupied Rooms */}
        <div 
          onClick={() => onNavigateTab('rooms')} 
          className="bg-white p-3.5 rounded-xl border border-amber-300 hover:border-amber-600 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-amber-800 uppercase">Occupied</span>
            <Users className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-950 font-mono-num mt-1">{occupiedRooms}</p>
          <span className="text-[10px] text-amber-700 font-semibold">{inHouseGuests.length} In-House Stays</span>
        </div>

        {/* Dirty / Cleaning */}
        <div 
          onClick={() => onNavigateTab('housekeeping')} 
          className="bg-white p-3.5 rounded-xl border border-rose-300 hover:border-rose-600 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-rose-800 uppercase">Cleaning Due</span>
            <Sparkles className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-950 font-mono-num mt-1">{dirtyRooms + cleaningRooms}</p>
          <span className="text-[10px] text-rose-700 font-semibold">{dirtyRooms} dirty, {cleaningRooms} in progress</span>
        </div>

        {/* Maintenance */}
        <div 
          onClick={() => onNavigateTab('maintenance')} 
          className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-400 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Maintenance</span>
            <Wrench className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-xl font-black text-slate-900 font-mono-num mt-1">{maintenanceRooms + outOfServiceRooms}</p>
          <span className="text-[10px] text-slate-500 font-semibold font-mono-num">{openMaintenanceCount} open tickets</span>
        </div>

        {/* Tonight's Projected Revenue */}
        <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-300 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-emerald-800 uppercase">Nightly Revenue</span>
            <DollarSign className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="text-lg font-black text-emerald-950 font-mono-num mt-1">
            {settings.currencySymbol} {todayRoomRevenue.toFixed(0)}
          </p>
          <span className="text-[10px] text-emerald-800 font-semibold">Active in-house</span>
        </div>
      </div>

      {/* Today's Cash vs Online Room Collections Strip */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            {lang === 'ne' ? 'आजको कोठा तथा होटेल भुक्तानी संकलन' : "Today's Hospitality Collections (Cash vs Online)"}
          </span>
          <p className="text-base font-black text-slate-900 font-mono-num mt-0.5">
            {settings.currencySymbol} {todayCollections.total.toFixed(0)}{' '}
            <span className="text-[11px] font-semibold text-slate-500">
              ({todayCollections.count} receipt{todayCollections.count !== 1 ? 's' : ''})
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-800" />
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Cash Collected</span>
              <span className="font-mono-num font-black text-emerald-950 text-sm">
                {settings.currencySymbol} {todayCollections.cash.toFixed(0)}
              </span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
            <QrCode className="h-4 w-4 text-blue-800" />
            <div>
              <span className="text-[10px] font-bold text-blue-800 uppercase block">Online (QR / Wallet / Card / Bank)</span>
              <span className="font-mono-num font-black text-blue-950 text-sm">
                {settings.currencySymbol} {todayCollections.online.toFixed(0)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('reports')}
            className="text-xs font-bold text-emerald-800 hover:underline px-2 py-1"
          >
            Reconcile →
          </button>
        </div>
      </div>

      {/* Housekeeping Alerts Banner if any */}
      {dirtyRooms > 0 && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 flex items-center justify-between text-xs text-rose-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span className="font-bold">
              Housekeeping Alert: {dirtyRooms} room{dirtyRooms > 1 ? 's' : ''} currently marked as DIRTY require sanitization and linen turnaround.
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('housekeeping')}
            className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold text-[11px] shrink-0"
          >
            Open Housekeeping Board
          </button>
        </div>
      )}

      {/* Grid: Today's Arrivals & Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Arrivals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Today's Arrivals ({todayArrivals.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('reservations')}
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
            {todayArrivals.length === 0 ? (
              <p className="py-6 text-center text-slate-400 italic">
                No more arrivals scheduled for today.
              </p>
            ) : (
              todayArrivals.map((res) => (
                <div key={res.id} className="py-3 flex justify-between items-center hover:bg-slate-50 px-1 rounded-lg">
                  <div>
                    <span className="font-black text-slate-900">Room {res.roomNumber}</span>
                    <span className="text-slate-700 font-semibold ml-2">{res.guestName}</span>
                    <p className="text-[11px] text-slate-400">
                      {res.roomTypeName} · {res.nightsCount} Nights ({res.checkInDate} to {res.checkOutDate})
                    </p>
                  </div>
                  <button
                    onClick={() => onOpenCheckIn(res)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1"
                  >
                    <DoorOpen className="h-3.5 w-3.5" /> Check-In
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Today's Departures */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorClosed className="h-5 w-5 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Today's Departures & Check-Outs ({todayDepartures.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('reservations')}
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto text-xs">
            {todayDepartures.length === 0 ? (
              <p className="py-6 text-center text-slate-400 italic">
                No check-outs scheduled for departure today.
              </p>
            ) : (
              todayDepartures.map((res) => {
                const m = getResMetrics(res);
                const isOverdue = res.checkOutDate < todayStr;
                return (
                  <div key={res.id} className="py-3 flex justify-between items-center hover:bg-slate-50 px-1 rounded-lg">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900">Room {res.roomNumber}</span>
                        <span className="text-slate-700 font-semibold">{res.guestName}</span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800">
                            OVERSTAY ({res.checkOutDate})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Folio Total: <strong className="text-slate-800 font-mono-num">{settings.currencySymbol} {m.grandTotal.toFixed(0)}</strong>
                        {m.balanceDue > 0.01 && (
                          <span className="text-rose-700 ml-1 font-bold font-mono-num">
                            ({settings.currencySymbol} {m.balanceDue.toFixed(0)} due)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onOpenFolio(res)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1"
                      >
                        <Receipt className="h-3 w-3" /> Folio
                      </button>
                      <button
                        onClick={() => onOpenCheckOut(res)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1"
                      >
                        <DoorClosed className="h-3.5 w-3.5" /> Check-Out
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* In-House Guests Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-sm">
            Current In-House Stays ({inHouseGuests.length})
          </h3>
          <span className="text-xs text-slate-500">
            Total Outstanding Folio Balance: <strong className="font-mono-num text-rose-700">{settings.currencySymbol} {outstandingPayments.toFixed(2)}</strong>
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
          {inHouseGuests.length === 0 ? (
            <div className="p-6 text-center text-slate-400 italic">
              No in-house guests currently checked in.
            </div>
          ) : (
            inHouseGuests.map((res) => {
              const m = getResMetrics(res);
              return (
                <div key={res.id} className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">Room {res.roomNumber}</span>
                      <span className="font-bold text-slate-800">{res.guestName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">
                        IN-HOUSE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {res.roomTypeName} · Stay: {res.checkInDate} to {res.checkOutDate} ({res.nightsCount} Nights) · Phone: {res.guestPhone}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <div className="text-right mr-2">
                      <p className="font-bold text-slate-900 font-mono-num text-xs">
                        {settings.currencySymbol} {m.grandTotal.toFixed(0)}
                      </p>
                      <p className="text-[10px] text-emerald-800 font-mono-num">
                        Paid: {settings.currencySymbol} {m.effectivePaid.toFixed(0)}
                        {m.balanceDue > 0.01 ? ` · Due: ${settings.currencySymbol} ${m.balanceDue.toFixed(0)}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => onOpenFolio(res)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1"
                    >
                      <Receipt className="h-3 w-3" /> Folio
                    </button>
                    <button
                      onClick={() => onOpenCheckOut(res)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1"
                    >
                      <DoorClosed className="h-3 w-3" /> Check-Out
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
