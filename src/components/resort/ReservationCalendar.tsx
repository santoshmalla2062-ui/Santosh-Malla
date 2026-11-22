import React, { useState } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  User, 
  CheckCircle, 
  Clock, 
  BedDouble, 
  Building 
} from 'lucide-react';
import { Reservation, ResortRoom, RoomType } from '../../types';
import { Language } from '../../utils/translations';
import { formatLocalYMD } from '../../services/resortSecurity';

interface ReservationCalendarProps {
  rooms: ResortRoom[];
  roomTypes: RoomType[];
  reservations: Reservation[];
  lang: Language;
  onSelectReservation: (res: Reservation) => void;
  onNewBookingForSlot: (roomId: string, date: string) => void;
}

export const ReservationCalendar: React.FC<ReservationCalendarProps> = ({
  rooms,
  roomTypes,
  reservations,
  lang,
  onSelectReservation,
  onNewBookingForSlot
}) => {
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [daysCount] = useState<number>(12); // Show 12 consecutive days
  const [selectedFloor, setSelectedFloor] = useState<string>('all');

  const shiftDays = (delta: number) => {
    const next = new Date(startDate);
    next.setDate(next.getDate() + delta);
    setStartDate(next);
  };

  const resetToToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setStartDate(d);
  };

  // Generate array of date objects
  const calendarDates = Array.from({ length: daysCount }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  const floors = Array.from(new Set(rooms.map(r => r.floor)));
  const filteredRooms = rooms.filter(r => selectedFloor === 'all' || r.floor === selectedFloor);

  const formatDateYMD = (d: Date) => formatLocalYMD(d);

  // Helper to find reservation occupying room on specific date
  const getReservationForRoomDate = (roomId: string, dateStr: string): Reservation | undefined => {
    return reservations.find(res => {
      if (res.roomId !== roomId) return false;
      if (res.status === 'CANCELLED' || res.status === 'NO_SHOW') return false;
      // Occupied if date >= checkInDate && date < checkOutDate
      return dateStr >= res.checkInDate && dateStr < res.checkOutDate;
    });
  };

  const getStatusColor = (status: Reservation['status']) => {
    switch (status) {
      case 'CHECKED_IN': return 'bg-emerald-700 text-white border-emerald-800 shadow-2xs';
      case 'CONFIRMED': return 'bg-blue-600 text-white border-blue-700 shadow-2xs';
      case 'PENDING': return 'bg-amber-500 text-white border-amber-600';
      case 'CHECKED_OUT': return 'bg-slate-400 text-white border-slate-500';
      default: return 'bg-slate-300 text-slate-800';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-4">
      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-800" />
            {lang === 'ne' ? 'रिजर्भेसन क्यालेन्डर तथा समयतालिका (Reservation Timeline)' : 'Room Reservation & Occupancy Timeline'}
          </h2>
          <p className="text-xs text-slate-500">
            Click any occupied block to view details, or click an empty slot to book
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">All Floors</option>
            {floors.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => shiftDays(-7)}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors"
              title="Previous 7 days"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={resetToToday}
              className="px-2 py-0.5 text-xs font-bold text-slate-700 hover:bg-white rounded transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => shiftDays(7)}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors"
              title="Next 7 days"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-700"></span> Checked-In (In-house)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-600"></span> Confirmed Reservation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500"></span> Pending Deposit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-100 border border-slate-300"></span> Available for Booking
        </span>
      </div>

      {/* Interactive Timeline Grid */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700">
              <th className="p-3 w-44 font-bold text-xs sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                Room
              </th>
              {calendarDates.map((date, idx) => {
                const isToday = formatDateYMD(date) === formatDateYMD(new Date());
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });

                return (
                  <th
                    key={idx}
                    className={`p-2 text-center border-r border-slate-200 last:border-0 ${
                      isToday ? 'bg-emerald-100/60 font-black text-emerald-950' : 'text-slate-600'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold tracking-tight">{dayName}</div>
                    <div className="text-xs font-black">{dayNum} {monthName}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredRooms.map((room) => (
              <tr key={room.id} className="hover:bg-slate-50/50">
                {/* Room Info Cell (Sticky Left) */}
                <td className="p-3 sticky left-0 bg-white hover:bg-slate-50 border-r border-slate-200 z-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-black text-slate-900 text-sm">Room {room.roomNumber}</span>
                      <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{room.roomTypeName}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      room.status === 'OCCUPIED' ? 'bg-amber-100 text-amber-900' :
                      room.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-900' :
                      room.status === 'RESERVED' ? 'bg-blue-100 text-blue-900' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {room.status}
                    </span>
                  </div>
                </td>

                {/* Date Columns */}
                {calendarDates.map((date, idx) => {
                  const dateStr = formatDateYMD(date);
                  const isToday = dateStr === formatDateYMD(new Date());
                  const res = getReservationForRoomDate(room.id, dateStr);

                  return (
                    <td
                      key={idx}
                      className={`p-1 text-center border-r border-slate-200/80 last:border-0 h-14 ${
                        isToday ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {res ? (
                        <button
                          type="button"
                          onClick={() => onSelectReservation(res)}
                          className={`w-full h-full p-1.5 rounded-lg border text-left flex flex-col justify-between overflow-hidden transition-transform hover:scale-[1.02] cursor-pointer ${getStatusColor(res.status)}`}
                          title={`${res.guestName} (${res.checkInDate} to ${res.checkOutDate})`}
                        >
                          <span className="font-bold text-[10px] truncate block leading-tight">
                            {res.guestName}
                          </span>
                          <span className="text-[9px] opacity-90 truncate block">
                            {res.status}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNewBookingForSlot(room.id, dateStr)}
                          className="w-full h-full rounded hover:bg-emerald-50/70 border border-transparent hover:border-emerald-300 transition-colors flex items-center justify-center text-slate-300 hover:text-emerald-700 group"
                          title={`Click to book Room ${room.roomNumber} on ${dateStr}`}
                        >
                          <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
