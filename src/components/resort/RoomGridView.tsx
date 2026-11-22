import React, { useState } from 'react';
import {
  Building,
  DoorOpen,
  User,
  Calendar,
  Sparkles,
  Wrench,
  Plus,
  Search,
  CheckCircle,
  Clock,
  Receipt,
  DoorClosed,
  X,
  LayoutGrid,
  List,
  CalendarPlus,
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  Users
} from 'lucide-react';
import {
  BusinessSettings,
  GuestFolioItem,
  HotelPaymentRecord,
  MaintenanceIssue,
  Reservation,
  ResortRoom,
  ResortRoomStatus,
  RoomType,
  Session
} from '../../types';
import { Language } from '../../utils/translations';
import {
  computeReservationFolioMetrics,
  formatLocalYMD
} from '../../services/resortSecurity';

interface RoomGridViewProps {
  rooms: ResortRoom[];
  roomTypes: RoomType[];
  reservations: Reservation[];
  folioItems?: GuestFolioItem[];
  payments?: HotelPaymentRecord[];
  maintenanceIssues?: MaintenanceIssue[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onOpenCheckIn: (reservation: Reservation) => void;
  onOpenCheckOut: (reservation: Reservation) => void;
  onOpenFolio: (reservation: Reservation) => void;
  onOpenFolioAction?: (
    reservation: Reservation,
    action: 'charge' | 'payment' | 'reassign' | 'extend'
  ) => void;
  onOpenNewBooking: (roomId?: string) => void;
  onOpenWalkIn?: (roomId?: string) => void;
  onOpenMaintenanceModal: (roomId: string, roomNumber: string) => void;
  onUpdateRoomStatus: (roomId: string, status: ResortRoomStatus) => void;
  onSaveRoom: (room: ResortRoom) => void;
  onDeleteRoom?: (roomId: string) => { ok: boolean; error?: string } | void;
}

export const RoomGridView: React.FC<RoomGridViewProps> = ({
  rooms,
  roomTypes,
  reservations,
  folioItems = [],
  payments = [],
  maintenanceIssues = [],
  settings,
  lang,
  onOpenCheckIn,
  onOpenCheckOut,
  onOpenFolio,
  onOpenFolioAction,
  onOpenNewBooking,
  onOpenWalkIn,
  onOpenMaintenanceModal,
  onUpdateRoomStatus,
  onSaveRoom,
  onDeleteRoom
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Add / Edit Room Modal
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ResortRoom | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id || '');
  const [floor, setFloor] = useState('Floor 1');
  const [pricePerNight, setPricePerNight] = useState<number>(4500);
  const [capacity, setCapacity] = useState<number>(3);
  const [amenitiesStr, setAmenitiesStr] = useState('WiFi, Mountain View, AC, Hot Shower');
  const [roomStatusInput, setRoomStatusInput] = useState<ResortRoomStatus>('AVAILABLE');
  const [roomNotesInput, setRoomNotesInput] = useState('');
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState(false);
  const [deleteRoomError, setDeleteRoomError] = useState<string | null>(null);

  const todayYMD = formatLocalYMD();
  const floors = Array.from(new Set(rooms.map(r => r.floor)));

  // Live room status summary counts
  const statusCounts = {
    all: rooms.length,
    AVAILABLE: rooms.filter(r => r.status === 'AVAILABLE' || r.status === 'CLEAN').length,
    OCCUPIED: rooms.filter(r => r.status === 'OCCUPIED').length,
    RESERVED: rooms.filter(r => r.status === 'RESERVED').length,
    DIRTY: rooms.filter(r => r.status === 'DIRTY').length,
    CLEANING: rooms.filter(r => r.status === 'CLEANING').length,
    MAINTENANCE: rooms.filter(r => r.status === 'MAINTENANCE' || r.status === 'OUT_OF_SERVICE').length
  };

  const filteredRooms = rooms.filter(room => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'AVAILABLE') {
        if (room.status !== 'AVAILABLE' && room.status !== 'CLEAN') return false;
      } else if (filterStatus === 'MAINTENANCE') {
        if (room.status !== 'MAINTENANCE' && room.status !== 'OUT_OF_SERVICE') return false;
      } else if (room.status !== filterStatus) {
        return false;
      }
    }
    if (filterFloor !== 'all' && room.floor !== filterFloor) return false;
    if (filterType !== 'all' && room.roomTypeId !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNo = room.roomNumber.toLowerCase().includes(q);
      const matchType = room.roomTypeName.toLowerCase().includes(q);
      const matchGuest = (room.currentGuestName || '').toLowerCase().includes(q);
      const matchPhone = (room.currentGuestPhone || '').toLowerCase().includes(q);
      if (!matchNo && !matchType && !matchGuest && !matchPhone) return false;
    }
    return true;
  });

  const getStatusBadge = (status: ResortRoomStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 whitespace-nowrap">AVAILABLE</span>;
      case 'OCCUPIED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-300 whitespace-nowrap">OCCUPIED</span>;
      case 'RESERVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 whitespace-nowrap">RESERVED</span>;
      case 'DIRTY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300 whitespace-nowrap">DIRTY</span>;
      case 'CLEANING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 whitespace-nowrap">CLEANING</span>;
      case 'CLEAN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 whitespace-nowrap">CLEAN / READY</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-950 border border-orange-300 whitespace-nowrap">MAINTENANCE</span>;
      case 'OUT_OF_SERVICE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-300 whitespace-nowrap">OUT OF SERVICE</span>;
      default:
        return null;
    }
  };

  const getRoomStayDetails = (room: ResortRoom) => {
    const activeRes =
      reservations.find(r => r.id === room.currentReservationId) ||
      (room.status === 'OCCUPIED'
        ? reservations.find(r => r.roomId === room.id && r.status === 'CHECKED_IN')
        : room.status === 'RESERVED'
        ? reservations.find(r => r.roomId === room.id && r.status === 'CONFIRMED' && r.checkInDate <= todayYMD)
        : undefined);

    const nextBooking = reservations
      .filter(
        r =>
          r.roomId === room.id &&
          r.id !== activeRes?.id &&
          (r.status === 'CONFIRMED' || r.status === 'PENDING') &&
          r.checkInDate >= todayYMD
      )
      .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))[0];

    const openTicketsCount = maintenanceIssues.filter(
      m => m.roomId === room.id && m.status !== 'resolved' && m.status !== 'closed'
    ).length;

    let folioMetrics = null;
    if (activeRes) {
      const resFolios = folioItems.filter(f => f.reservationId === activeRes.id);
      const resPayments = payments.filter(p => p.reservationId === activeRes.id);
      folioMetrics = computeReservationFolioMetrics(resFolios, resPayments, activeRes, settings);
    }

    const checkoutDate = activeRes?.checkOutDate || room.checkOutDate;
    const isOverstay = room.status === 'OCCUPIED' && Boolean(checkoutDate && checkoutDate < todayYMD);
    const isDepartingToday = room.status === 'OCCUPIED' && Boolean(checkoutDate && checkoutDate === todayYMD);

    return {
      activeRes,
      nextBooking,
      openTicketsCount,
      folioMetrics,
      isOverstay,
      isDepartingToday
    };
  };

  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomNumber('');
    setRoomTypeId(roomTypes[0]?.id || '');
    setFloor(floors[0] || 'Floor 1');
    setPricePerNight(roomTypes[0]?.basePrice || 4500);
    setCapacity(3);
    setAmenitiesStr('WiFi, Mountain View, AC, Hot Shower');
    setRoomStatusInput('AVAILABLE');
    setRoomNotesInput('');
    setConfirmDeleteRoom(false);
    setDeleteRoomError(null);
    setShowRoomModal(true);
  };

  const openEditRoom = (room: ResortRoom) => {
    setEditingRoom(room);
    setRoomNumber(room.roomNumber);
    setRoomTypeId(room.roomTypeId);
    setFloor(room.floor);
    setPricePerNight(room.pricePerNight);
    setCapacity(room.capacity);
    setAmenitiesStr(room.amenities.join(', '));
    setRoomStatusInput(room.status);
    setRoomNotesInput(room.description || '');
    setConfirmDeleteRoom(false);
    setDeleteRoomError(null);
    setShowRoomModal(true);
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) return;

    const rType = roomTypes.find(rt => rt.id === roomTypeId);
    const amenities = amenitiesStr.split(',').map(a => a.trim()).filter(Boolean);

    const roomData: ResortRoom = {
      id: editingRoom ? editingRoom.id : 'r-' + roomNumber.trim().toLowerCase().replace(/\s+/g, '-'),
      roomNumber: roomNumber.trim(),
      roomTypeId,
      roomTypeName: rType?.name || 'Standard Room',
      floor,
      capacity,
      pricePerNight,
      amenities,
      description: roomNotesInput.trim() || undefined,
      status: editingRoom
        ? (editingRoom.status === 'OCCUPIED' ? 'OCCUPIED' : roomStatusInput)
        : 'AVAILABLE',
      currentGuestName: editingRoom?.currentGuestName,
      currentGuestPhone: editingRoom?.currentGuestPhone,
      currentReservationId: editingRoom?.currentReservationId,
      checkInDate: editingRoom?.checkInDate,
      checkOutDate: editingRoom?.checkOutDate
    };

    onSaveRoom(roomData);
    setShowRoomModal(false);
  };

  const handleDeleteCurrentRoom = () => {
    if (!editingRoom || !onDeleteRoom) return;
    if (!confirmDeleteRoom) {
      setConfirmDeleteRoom(true);
      setDeleteRoomError(null);
      return;
    }
    const res = onDeleteRoom(editingRoom.id);
    if (res && !res.ok) {
      setDeleteRoomError(res.error || 'Cannot delete this room while active stays or reservations exist.');
      setConfirmDeleteRoom(false);
      return;
    }
    setShowRoomModal(false);
  };

  const triggerFolioAction = (
    res: Reservation,
    action: 'charge' | 'payment' | 'reassign' | 'extend'
  ) => {
    if (onOpenFolioAction) {
      onOpenFolioAction(res, action);
    } else {
      onOpenFolio(res);
    }
  };

  const statusChips = [
    { id: 'all', label: lang === 'ne' ? 'सबै' : 'All Rooms', count: statusCounts.all },
    { id: 'AVAILABLE', label: lang === 'ne' ? 'खाली' : 'Available', count: statusCounts.AVAILABLE },
    { id: 'OCCUPIED', label: lang === 'ne' ? 'बसेको' : 'Occupied', count: statusCounts.OCCUPIED },
    { id: 'RESERVED', label: lang === 'ne' ? 'बुकिङ' : 'Reserved', count: statusCounts.RESERVED },
    { id: 'DIRTY', label: lang === 'ne' ? 'असफा' : 'Dirty', count: statusCounts.DIRTY },
    { id: 'CLEANING', label: lang === 'ne' ? 'सफाइ हुँदै' : 'Cleaning', count: statusCounts.CLEANING },
    { id: 'MAINTENANCE', label: lang === 'ne' ? 'मर्मत' : 'Maintenance', count: statusCounts.MAINTENANCE }
  ];

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="h-5 w-5 text-emerald-800" />
              {lang === 'ne' ? 'रिसोर्ट कोठा व्यवस्थापन (Room Operations)' : 'Resort Rooms & Accommodation Operations'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'ne'
                ? `${rooms.length} कोठाहरूको प्रत्यक्ष अवस्था, गेस्ट बिल र चेक-इन / चेक-आउट नियन्त्रण`
                : `Live occupancy, folio balances, walk-in check-in, and turnaround control across ${rooms.length} rooms`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Grid / Table View Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {lang === 'ne' ? 'ग्रिड' : 'Grid'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                {lang === 'ne' ? 'तालिका' : 'Table'}
              </button>
            </div>

            {onOpenWalkIn && (
              <button
                type="button"
                onClick={() => onOpenWalkIn()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-2xs transition-colors whitespace-nowrap shrink-0"
              >
                <DoorOpen className="h-3.5 w-3.5 text-emerald-300" />
                {lang === 'ne' ? 'वाक-इन चेक-इन' : 'Walk-In Check-In'}
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenNewBooking()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {lang === 'ne' ? 'नयाँ बुकिङ' : 'New Booking'}
            </button>

            <button
              type="button"
              onClick={openAddRoom}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {lang === 'ne' ? 'कोठा थप्नुहोस्' : 'Add Room'}
            </button>
          </div>
        </div>

        {/* Status Summary Filter Strip */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {statusChips.map(chip => {
            const active = filterStatus === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterStatus(chip.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{chip.label}</span>
                <span className={`font-mono-num text-[10px] px-1 rounded ${
                  active ? 'bg-emerald-950/50 text-emerald-100' : 'bg-white text-slate-600 border border-slate-200'
                }`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ne' ? 'कोठा नं, पाहुनाको नाम वा फोन खोज्नुहोस्...' : 'Search room no, guest name, phone...'}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <select
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="all">{lang === 'ne' ? 'सबै तला र क्षेत्र' : 'All Floors & Locations'}</option>
            {floors.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="all">{lang === 'ne' ? 'सबै कोठा प्रकार' : 'All Room Types'}</option>
            {roomTypes.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500 text-xs space-y-2">
          <p className="font-bold text-slate-700">No rooms match your active filters.</p>
          <button
            type="button"
            onClick={() => {
              setFilterStatus('all');
              setFilterFloor('all');
              setFilterType('all');
              setSearchQuery('');
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
          >
            Reset Room Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Visual Room Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const {
              activeRes,
              nextBooking,
              openTicketsCount,
              folioMetrics,
              isOverstay,
              isDepartingToday
            } = getRoomStayDetails(room);

            return (
              <div
                key={room.id}
                className={`rounded-xl border transition-all duration-150 p-4 space-y-3 flex flex-col justify-between ${
                  room.status === 'OCCUPIED'
                    ? isOverstay
                      ? 'border-rose-400 bg-rose-50/20 shadow-2xs'
                      : 'border-amber-300 bg-amber-50/20 shadow-2xs'
                    : room.status === 'AVAILABLE' || room.status === 'CLEAN'
                    ? 'border-emerald-300 bg-white hover:border-emerald-500 shadow-2xs'
                    : room.status === 'RESERVED'
                    ? 'border-blue-300 bg-blue-50/20 shadow-2xs'
                    : room.status === 'DIRTY'
                    ? 'border-rose-300 bg-rose-50/20'
                    : room.status === 'CLEANING'
                    ? 'border-purple-300 bg-purple-50/20'
                    : 'border-slate-300 bg-slate-50'
                }`}
              >
                {/* Card Header: Room Number, Location & Status */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xl font-black text-slate-900 tracking-tight font-mono-num">
                        Room {room.roomNumber}
                      </span>
                      <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                        <span>{room.floor}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Users className="h-3 w-3 text-slate-400" />
                          <span className="font-mono-num">{room.capacity}</span>
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(room.status)}
                      {isOverstay && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-700 text-white whitespace-nowrap">
                          OVERSTAY DUE
                        </span>
                      )}
                      {isDepartingToday && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-200 text-amber-950 whitespace-nowrap">
                          DEPARTING TODAY
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p className="font-bold text-xs text-slate-800 truncate">{room.roomTypeName}</p>
                    <p className="font-mono-num font-bold text-emerald-800 text-xs shrink-0">
                      {settings.currencySymbol} {room.pricePerNight.toFixed(0)}
                      <span className="text-[10px] text-slate-400 font-normal"> /nt</span>
                    </p>
                  </div>
                </div>

                {/* Guest / Occupancy / Folio Info Block */}
                <div className="bg-slate-50/80 rounded-lg p-2.5 text-xs space-y-1.5 border border-slate-200/70">
                  {room.status === 'OCCUPIED' && (
                    <>
                      <p className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <span className="truncate">{activeRes?.guestName || room.currentGuestName || 'In-House Guest'}</span>
                      </p>
                      {(activeRes?.checkOutDate || room.checkOutDate) && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>
                            Departs:{' '}
                            <span className={`font-semibold font-mono-num ${isOverstay ? 'text-rose-700' : 'text-slate-800'}`}>
                              {activeRes?.checkOutDate || room.checkOutDate}
                            </span>
                            {activeRes && ` (${activeRes.nightsCount}N)`}
                          </span>
                        </p>
                      )}
                      {folioMetrics && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 text-[11px]">
                          <span className="text-slate-500 font-mono-num">
                            Bill: <strong className="text-slate-800">{settings.currencySymbol} {folioMetrics.grandTotal.toFixed(0)}</strong>
                          </span>
                          <span className={`font-mono-num font-bold ${
                            folioMetrics.balanceDue > 0.01 ? 'text-rose-700' : 'text-emerald-800'
                          }`}>
                            {folioMetrics.balanceDue > 0.01
                              ? `Due: ${settings.currencySymbol} ${folioMetrics.balanceDue.toFixed(0)}`
                              : 'Settled'}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {room.status === 'RESERVED' && (
                    <>
                      <p className="font-bold text-blue-900 flex items-center gap-1.5 truncate">
                        <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{activeRes?.guestName || room.currentGuestName || 'Reserved Guest'}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Arrival:{' '}
                        <span className="font-semibold text-slate-800 font-mono-num">
                          {activeRes?.checkInDate || room.checkInDate || todayYMD}
                        </span>
                        {activeRes && ` · ${activeRes.nightsCount}N`}
                      </p>
                    </>
                  )}

                  {(room.status === 'AVAILABLE' || room.status === 'CLEAN') && (
                    <>
                      <p className="text-emerald-800 font-semibold text-[11px] flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{room.status === 'CLEAN' ? 'Cleaned · Ready for Walk-In' : 'Clean & Ready for Walk-In'}</span>
                      </p>
                      {nextBooking && (
                        <p className="text-[10px] text-blue-700 font-semibold truncate">
                          Next booking: {nextBooking.checkInDate} ({nextBooking.guestName})
                        </p>
                      )}
                    </>
                  )}

                  {room.status === 'DIRTY' && (
                    <p className="text-rose-800 font-semibold text-[11px] flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      Requires Turnaround Clean
                    </p>
                  )}

                  {room.status === 'CLEANING' && (
                    <p className="text-purple-800 font-semibold text-[11px] flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      Housekeeper on duty {room.assignedHousekeeper ? `(${room.assignedHousekeeper})` : ''}
                    </p>
                  )}

                  {(room.status === 'MAINTENANCE' || room.status === 'OUT_OF_SERVICE') && (
                    <p className="text-amber-900 font-semibold text-[11px] flex items-center gap-1">
                      <Wrench className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="truncate">{room.description || 'Maintenance in progress'}</span>
                    </p>
                  )}

                  {openTicketsCount > 0 && room.status !== 'MAINTENANCE' && room.status !== 'OUT_OF_SERVICE' && (
                    <p className="text-[10px] font-bold text-amber-800 flex items-center gap-1 pt-0.5">
                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                      {openTicketsCount} open maintenance ticket{openTicketsCount > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Dynamic Contextual Action Buttons */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  {room.status === 'OCCUPIED' && activeRes && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => triggerFolioAction(activeRes, 'charge')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                        title="Post Extra Service / Dining Charge"
                      >
                        <Plus className="h-3 w-3" /> Service
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerFolioAction(activeRes, 'extend')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                        title="Extend Guest Stay"
                      >
                        <CalendarPlus className="h-3 w-3 text-emerald-700" /> Extend
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerFolioAction(activeRes, 'reassign')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                        title="Transfer Guest to Another Room"
                      >
                        <ArrowRightLeft className="h-3 w-3 text-indigo-700" /> Move
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenFolio(activeRes)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Receipt className="h-3 w-3" /> Folio
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCheckOut(activeRes)}
                        className="ml-auto px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] inline-flex items-center gap-1 shadow-2xs transition-colors whitespace-nowrap shrink-0"
                      >
                        <DoorClosed className="h-3 w-3" /> Check-Out
                      </button>
                    </div>
                  )}

                  {room.status === 'OCCUPIED' && !activeRes && (
                    <button
                      type="button"
                      onClick={() => onUpdateRoomStatus(room.id, 'DIRTY')}
                      className="w-full px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded text-xs flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Release Room → Dirty
                    </button>
                  )}

                  {room.status === 'RESERVED' && activeRes && (
                    <button
                      type="button"
                      onClick={() => onOpenCheckIn(activeRes)}
                      className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1 shadow-2xs transition-colors"
                    >
                      <DoorOpen className="h-3.5 w-3.5" /> Check-In Guest
                    </button>
                  )}

                  {(room.status === 'AVAILABLE' || room.status === 'CLEAN') && (
                    <div className="flex items-center gap-1.5">
                      {onOpenWalkIn && (
                        <button
                          type="button"
                          onClick={() => onOpenWalkIn(room.id)}
                          className="flex-1 px-2.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded text-[11px] flex items-center justify-center gap-1 shadow-2xs transition-colors whitespace-nowrap shrink-0"
                        >
                          <DoorOpen className="h-3.5 w-3.5" /> Walk-In
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenNewBooking(room.id)}
                        className="flex-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded text-[11px] flex items-center justify-center gap-1 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" /> Book Dates
                      </button>
                    </div>
                  )}

                  {room.status === 'DIRTY' && (
                    <button
                      type="button"
                      onClick={() => onUpdateRoomStatus(room.id, 'CLEANING')}
                      className="w-full px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Start Cleaning
                    </button>
                  )}

                  {room.status === 'CLEANING' && (
                    <button
                      type="button"
                      onClick={() => onUpdateRoomStatus(room.id, 'AVAILABLE')}
                      className="w-full px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded text-xs flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Mark Inspected & Ready
                    </button>
                  )}

                  {(room.status === 'MAINTENANCE' || room.status === 'OUT_OF_SERVICE') && (
                    <button
                      type="button"
                      onClick={() => onOpenMaintenanceModal(room.id, room.roomNumber)}
                      className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-xs flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <Wrench className="h-3.5 w-3.5" /> Manage Ticket
                    </button>
                  )}

                  {/* Footer secondary actions */}
                  <div className="flex items-center justify-between pt-1">
                    {room.status !== 'MAINTENANCE' && room.status !== 'OUT_OF_SERVICE' ? (
                      <button
                        type="button"
                        onClick={() => onOpenMaintenanceModal(room.id, room.roomNumber)}
                        className="text-[10px] text-slate-500 hover:text-amber-700 font-semibold inline-flex items-center gap-1"
                      >
                        <Wrench className="h-3 w-3" /> Report Issue
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      onClick={() => openEditRoom(room)}
                      className="text-[10px] text-slate-500 hover:text-slate-900 font-semibold"
                    >
                      Edit Room
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Structured Operations Table View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-2xs">
          <table className="w-full text-left border-collapse min-w-[780px] text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                <th className="py-2.5 px-3">Room</th>
                <th className="py-2.5 px-3">Type & Floor</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Current Guest / Dates</th>
                <th className="py-2.5 px-3 text-right">Rate / Night</th>
                <th className="py-2.5 px-3 text-right">Folio Due</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRooms.map((room) => {
                const { activeRes, folioMetrics, isOverstay, isDepartingToday } = getRoomStayDetails(room);
                return (
                  <tr key={room.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-black text-slate-900 font-mono-num">
                      Room {room.roomNumber}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-800">{room.roomTypeName}</p>
                      <p className="text-[10px] text-slate-500">{room.floor} · Max {room.capacity} Guests</p>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col items-start gap-1">
                        {getStatusBadge(room.status)}
                        {isOverstay && (
                          <span className="text-[9px] font-black text-rose-700">OVERSTAY DUE</span>
                        )}
                        {isDepartingToday && (
                          <span className="text-[9px] font-bold text-amber-800">DEPARTING TODAY</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {activeRes ? (
                        <div>
                          <p className="font-bold text-slate-900">{activeRes.guestName}</p>
                          <p className="text-[10px] text-slate-500 font-mono-num">
                            {activeRes.checkInDate} → {activeRes.checkOutDate} ({activeRes.nightsCount}N)
                          </p>
                        </div>
                      ) : room.currentGuestName ? (
                        <span className="font-semibold text-slate-800">{room.currentGuestName}</span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num font-bold text-slate-800">
                      {settings.currencySymbol} {room.pricePerNight.toFixed(0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-num">
                      {folioMetrics ? (
                        <div>
                          <span className={`font-bold block ${folioMetrics.balanceDue > 0.01 ? 'text-rose-700' : 'text-emerald-800'}`}>
                            {folioMetrics.balanceDue > 0.01
                              ? `${settings.currencySymbol} ${folioMetrics.balanceDue.toFixed(0)}`
                              : 'Settled'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            of {settings.currencySymbol} {folioMetrics.grandTotal.toFixed(0)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {room.status === 'OCCUPIED' && activeRes && (
                          <>
                            <button
                              type="button"
                              onClick={() => triggerFolioAction(activeRes, 'extend')}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] whitespace-nowrap"
                            >
                              Extend
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenFolio(activeRes)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] whitespace-nowrap"
                            >
                              Folio
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenCheckOut(activeRes)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] whitespace-nowrap"
                            >
                              Check-Out
                            </button>
                          </>
                        )}
                        {room.status === 'RESERVED' && activeRes && (
                          <button
                            type="button"
                            onClick={() => onOpenCheckIn(activeRes)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[11px] whitespace-nowrap"
                          >
                            Check-In
                          </button>
                        )}
                        {(room.status === 'AVAILABLE' || room.status === 'CLEAN') && (
                          <>
                            {onOpenWalkIn && (
                              <button
                                type="button"
                                onClick={() => onOpenWalkIn(room.id)}
                                className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded text-[11px] whitespace-nowrap"
                              >
                                Walk-In
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenNewBooking(room.id)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded text-[11px] whitespace-nowrap"
                            >
                              Book
                            </button>
                          </>
                        )}
                        {room.status === 'DIRTY' && (
                          <button
                            type="button"
                            onClick={() => onUpdateRoomStatus(room.id, 'CLEANING')}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-[11px] whitespace-nowrap"
                          >
                            Clean
                          </button>
                        )}
                        {room.status === 'CLEANING' && (
                          <button
                            type="button"
                            onClick={() => onUpdateRoomStatus(room.id, 'AVAILABLE')}
                            className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded text-[11px] whitespace-nowrap"
                          >
                            Ready
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditRoom(room)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-900 font-semibold text-[11px]"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Room Modal */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : 'Add New Guest Room'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRoomModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Room Number / Name:</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 106, Cottage-3"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Floor / Zone:</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. Floor 1, Garden Lawn"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Room Type Category:</label>
                <select
                  value={roomTypeId}
                  onChange={(e) => {
                    setRoomTypeId(e.target.value);
                    const sel = roomTypes.find(rt => rt.id === e.target.value);
                    if (sel) setPricePerNight(sel.basePrice);
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Price / Night ({settings.currencySymbol}):</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={pricePerNight}
                    onChange={(e) => setPricePerNight(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Max Capacity (Guests):</label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num"
                    required
                  />
                </div>
              </div>

              {editingRoom && editingRoom.status !== 'OCCUPIED' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Operational Status:</label>
                  <select
                    value={roomStatusInput}
                    onChange={(e) => setRoomStatusInput(e.target.value as ResortRoomStatus)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="DIRTY">DIRTY</option>
                    <option value="CLEANING">CLEANING</option>
                    <option value="CLEAN">CLEAN</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="OUT_OF_SERVICE">OUT OF SERVICE</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Amenities (Comma separated):</label>
                <input
                  type="text"
                  value={amenitiesStr}
                  onChange={(e) => setAmenitiesStr(e.target.value)}
                  placeholder="e.g. Lake View, AC, Smart TV, King Bed"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Room Notes / Remarks (Optional):</label>
                <input
                  type="text"
                  value={roomNotesInput}
                  onChange={(e) => setRoomNotesInput(e.target.value)}
                  placeholder="e.g. Corner balcony suite near garden stair"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {deleteRoomError && (
                <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>{deleteRoomError}</span>
                </p>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                {editingRoom && onDeleteRoom ? (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentRoom}
                    className={`px-3 py-2 rounded-lg font-bold inline-flex items-center gap-1 transition-colors ${
                      confirmDeleteRoom
                        ? 'bg-rose-700 text-white hover:bg-rose-800'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDeleteRoom ? 'Confirm Delete' : 'Remove Room'}
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRoomModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-800 text-white rounded-lg font-bold shadow-2xs"
                  >
                    Save Room
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
