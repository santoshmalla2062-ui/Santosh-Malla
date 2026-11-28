import React, { useState } from 'react';
import { 
  Building, 
  LayoutGrid, 
  Calendar, 
  Sparkles, 
  Wrench, 
  BarChart3, 
  Plus, 
  Moon, 
  Receipt, 
  BedDouble, 
  Tag, 
  Hotel,
  Users,
  ArrowRightLeft,
  Clock
} from 'lucide-react';
import { 
  AppState, 
  BusinessSettings, 
  BusinessTenant,
  GuestFolioItem, 
  GuestProfile, 
  HotelPaymentRecord, 
  HousekeepingTask, 
  MaintenanceIssue, 
  PaymentMethod, 
  Reservation, 
  ResortRoom, 
  ResortRoomStatus, 
  ResortService, 
  RoomType, 
  Session,
  NightAuditRecord 
} from '../../types';
import { Language } from '../../utils/translations';
import {
  formatLocalYMD,
  validateRoomReassignment,
  validateStayExtension
} from '../../services/resortSecurity';
import { postHotelPaymentJournal } from '../../services/generalLedger';
import { ResortDashboard } from './ResortDashboard';
import { RoomGridView } from './RoomGridView';
import { RoomTypeModal } from './RoomTypeModal';
import { ReservationList } from './ReservationList';
import { ReservationCalendar } from './ReservationCalendar';
import { NewReservationModal } from './NewReservationModal';
import { CheckInModal, CheckInGuestStayUpdates } from './CheckInModal';
import { CheckOutModal } from './CheckOutModal';
import { EditReservationModal, ReservationEditPayload } from './EditReservationModal';
import { GuestFolioModal } from './GuestFolioModal';
import { HousekeepingBoard } from './HousekeepingBoard';
import { MaintenanceModal } from './MaintenanceModal';
import { ResortServicesModal } from './ResortServicesModal';
import { NightAuditModal } from './NightAuditModal';
import { ResortReports } from './ResortReports';
import { GuestProfilesView } from './GuestProfilesView';

interface ResortMainViewProps {
  appState: AppState;
  activeBusiness: BusinessTenant;
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  recordAudit: (action: string, targetId?: string, details?: string, severity?: 'INFO' | 'WARNING' | 'CRITICAL') => void;
  playChime: (type: 'beep' | 'success' | 'alert') => void;
}

export type ResortSubTab = 
  | 'dashboard' 
  | 'rooms' 
  | 'reservations' 
  | 'calendar' 
  | 'guests'
  | 'housekeeping'
  | 'maintenance'
  | 'services' 
  | 'reports';

export const ResortMainView: React.FC<ResortMainViewProps> = ({
  appState,
  activeBusiness,
  settings,
  currentSession,
  lang,
  onUpdateAppState,
  recordAudit,
  playChime
}) => {
  const [activeTab, setActiveTab] = useState<ResortSubTab>('dashboard');

  // Modals state
  const [selectedResForCheckIn, setSelectedResForCheckIn] = useState<Reservation | null>(null);
  const [selectedResForCheckOut, setSelectedResForCheckOut] = useState<Reservation | null>(null);
  const [selectedResForFolio, setSelectedResForFolio] = useState<Reservation | null>(null);
  const [selectedFolioAction, setSelectedFolioAction] = useState<'charge' | 'payment' | 'reassign' | 'extend' | undefined>(undefined);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);
  const [newBookingRoomId, setNewBookingRoomId] = useState<string | undefined>(undefined);
  const [newBookingDate, setNewBookingDate] = useState<string | undefined>(undefined);
  const [newBookingWalkIn, setNewBookingWalkIn] = useState(false);
  const [showNightAuditModal, setShowNightAuditModal] = useState(false);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showTimingsModal, setShowTimingsModal] = useState(false);
  const [defaultCheckInInput, setDefaultCheckInInput] = useState(settings.hotelCheckInTime || '14:00');
  const [defaultCheckOutInput, setDefaultCheckOutInput] = useState(settings.hotelCheckOutTime || '12:00');
  const [maintenanceRoomDetails, setMaintenanceRoomDetails] = useState<{ id: string; number: string } | null>(null);

  // Sub-tab definitions
  const tabs = [
    { id: 'dashboard', label: lang === 'ne' ? 'ड्यासबोर्ड' : 'Dashboard', icon: Building },
    { id: 'rooms', label: lang === 'ne' ? 'कोठा ग्रिड' : 'Rooms Grid', icon: LayoutGrid },
    { id: 'reservations', label: lang === 'ne' ? 'रिजर्भेसन सूची' : 'Reservations', icon: Calendar },
    { id: 'calendar', label: lang === 'ne' ? 'क्यालेन्डर' : 'Timeline', icon: Calendar },
    { id: 'guests', label: lang === 'ne' ? 'पाहुना प्रोफाइल' : 'Guests', icon: Users },
    { id: 'housekeeping', label: lang === 'ne' ? 'हाउसकिपिङ' : 'Housekeeping', icon: Sparkles },
    { id: 'maintenance', label: lang === 'ne' ? 'मर्मत' : 'Maintenance', icon: Wrench },
    { id: 'services', label: lang === 'ne' ? 'सेवा तथा शुल्क' : 'Services', icon: Tag },
    { id: 'reports', label: lang === 'ne' ? 'रिपोर्टहरू' : 'Reports', icon: BarChart3 }
  ];

  // ==========================================
  // HANDLERS
  // ==========================================

  // Check-In Handler
  const handleConfirmCheckIn = (
    reservationId: string,
    roomId: string,
    depositAmount: number,
    depositMethod: PaymentMethod,
    guestUpdates?: CheckInGuestStayUpdates,
    notes?: string
  ) => {
    onUpdateAppState(prev => {
      const todayYMD = formatLocalYMD();
      const nowStr = `${todayYMD} ${new Date().toTimeString().substring(0, 5)}`;
      const currentRes = prev.reservations.find(r => r.id === reservationId);
      const updatedName = guestUpdates?.guestName?.trim() || currentRes?.guestName || 'Guest';
      const updatedPhone = guestUpdates?.phone?.trim() || currentRes?.guestPhone || '';
      const updatedEmail = guestUpdates?.email !== undefined ? guestUpdates.email.trim() || undefined : currentRes?.guestEmail;
      const updatedAddress = guestUpdates?.address !== undefined ? guestUpdates.address.trim() || undefined : currentRes?.guestAddress;
      const updatedCountry = guestUpdates?.country !== undefined ? guestUpdates.country.trim() || 'Nepal' : (currentRes?.guestCountry || 'Nepal');
      const nextCheckInDate = guestUpdates?.checkInDate || currentRes?.checkInDate || todayYMD;
      const nextCheckOutDate = guestUpdates?.checkOutDate || currentRes?.checkOutDate || todayYMD;
      const nextCheckInTime = guestUpdates?.checkInTime || currentRes?.checkInTime || settings.hotelCheckInTime || '14:00';
      const nextCheckOutTime = guestUpdates?.checkOutTime || currentRes?.checkOutTime || settings.hotelCheckOutTime || '12:00';
      const nextNights = Math.max(
        1,
        Math.ceil((new Date(nextCheckOutDate).getTime() - new Date(nextCheckInDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      const nextRate = guestUpdates?.roomRate !== undefined ? guestUpdates.roomRate : (currentRes?.roomRate || 0);

      // Update reservation
      const updatedReservations = prev.reservations.map(res => {
        if (res.id !== reservationId) return res;
        const roomSubtotal = nextRate * nextNights;
        const taxable = Math.max(0, roomSubtotal - (res.discountAmount || 0) + (res.extraCharges || 0));
        const vatAmount = settings.enableVat ? Math.round((taxable * ((settings.vatRatePercent || 13) / 100)) * 100) / 100 : 0;
        const totalAmount = Math.round((taxable + vatAmount) * 100) / 100;
        const newPaid = res.paidAmount + depositAmount;
        const newRemaining = Math.max(0, Math.round((totalAmount - newPaid) * 100) / 100);
        return {
          ...res,
          guestName: updatedName,
          guestPhone: updatedPhone || res.guestPhone,
          guestEmail: updatedEmail,
          guestAddress: updatedAddress,
          guestCountry: updatedCountry,
          idType: guestUpdates?.idType || res.idType,
          idNumber: guestUpdates?.idNumber?.trim() || res.idNumber,
          checkInDate: nextCheckInDate,
          checkOutDate: nextCheckOutDate,
          checkInTime: nextCheckInTime,
          checkOutTime: nextCheckOutTime,
          nightsCount: nextNights,
          roomRate: nextRate,
          taxAmount: vatAmount,
          totalAmount,
          status: 'CHECKED_IN' as const,
          actualCheckInTime: nowStr,
          checkedInByStaff: currentSession?.name || 'Staff',
          paidAmount: newPaid,
          depositAmount: res.depositAmount + depositAmount,
          remainingAmount: newRemaining,
          notes: notes !== undefined ? (notes.trim() || undefined) : res.notes
        };
      });

      // Persist ID document & profile details to guest profile
      let updatedGuests = [...prev.guestProfiles];
      if (currentRes) {
        const gIdx = updatedGuests.findIndex(
          g => g.id === currentRes.guestId || g.phone === currentRes.guestPhone
        );
        const safeIdType = (guestUpdates?.idType as GuestProfile['idType']) || currentRes.idType || 'Citizenship';
        if (gIdx >= 0) {
          updatedGuests[gIdx] = {
            ...updatedGuests[gIdx],
            fullName: updatedName,
            phone: updatedPhone || updatedGuests[gIdx].phone,
            email: updatedEmail !== undefined ? updatedEmail : updatedGuests[gIdx].email,
            address: updatedAddress !== undefined ? updatedAddress : updatedGuests[gIdx].address,
            country: updatedCountry || updatedGuests[gIdx].country,
            idType: safeIdType,
            idNumber: guestUpdates?.idNumber?.trim() || updatedGuests[gIdx].idNumber
          };
        } else {
          updatedGuests = [
            {
              id: currentRes.guestId || 'gp-' + Date.now(),
              fullName: updatedName,
              phone: updatedPhone || currentRes.guestPhone,
              email: updatedEmail || '',
              address: updatedAddress || '',
              country: updatedCountry || 'Nepal',
              idType: safeIdType,
              idNumber: guestUpdates?.idNumber?.trim() || '',
              totalStays: 1,
              createdAt: todayYMD
            },
            ...updatedGuests
          ];
        }
      }

      // Update room status to OCCUPIED
      const updatedRooms = prev.resortRooms.map(rm => {
        if (rm.id !== roomId) return rm;
        return {
          ...rm,
          status: 'OCCUPIED' as const,
          currentGuestName: updatedName,
          currentGuestPhone: updatedPhone || rm.currentGuestPhone,
          currentReservationId: reservationId,
          checkInDate: nextCheckInDate,
          checkOutDate: nextCheckOutDate
        };
      });

      // If deposit was collected, record hotel payment & General Ledger journal
      const updatedPayments = [...prev.hotelPayments];
      let nextAccounts = prev.accounts;
      let nextJournals = prev.journalEntries;
      if (depositAmount > 0 && currentRes) {
        const depositPaymentRec: HotelPaymentRecord = {
          id: 'hpay-' + Date.now(),
          reservationId: currentRes.id,
          guestName: updatedName,
          roomNumber: currentRes.roomNumber,
          amount: depositAmount,
          method: depositMethod,
          dateTime: nowStr,
          staffName: currentSession?.name || 'Staff',
          status: 'completed',
          notes: 'Advance deposit recorded at check-in'
        };
        updatedPayments.push(depositPaymentRec);
        const gl = postHotelPaymentJournal({ ...prev, accounts: nextAccounts, journalEntries: nextJournals }, depositPaymentRec, currentSession?.name || 'Reception');
        nextAccounts = gl.accounts;
        nextJournals = gl.journalEntries;
      }

      // Add or update initial room charge in folio
      const existingRoomIdx = prev.guestFolioItems.findIndex(
        f => f.reservationId === reservationId && f.category === 'ROOM'
      );
      const updatedFolios = [...prev.guestFolioItems];
      if (currentRes) {
        if (existingRoomIdx >= 0) {
          updatedFolios[existingRoomIdx] = {
            ...updatedFolios[existingRoomIdx],
            description: `${currentRes.roomTypeName} (${nextNights} Nights Accommodation)`,
            quantity: nextNights,
            unitPrice: nextRate,
            totalPrice: nextRate * nextNights
          };
        } else {
          updatedFolios.push({
            id: 'fol-' + Date.now(),
            reservationId: currentRes.id,
            roomId: currentRes.roomId,
            roomNumber: currentRes.roomNumber,
            dateTime: nowStr,
            description: `${currentRes.roomTypeName} (${nextNights} Nights Accommodation)`,
            category: 'ROOM',
            quantity: nextNights,
            unitPrice: nextRate,
            totalPrice: nextRate * nextNights,
            addedByStaff: currentSession?.name || 'Reception'
          });
        }
      }

      return {
        ...prev,
        reservations: updatedReservations,
        guestProfiles: updatedGuests,
        resortRooms: updatedRooms,
        hotelPayments: updatedPayments,
        guestFolioItems: updatedFolios,
        accounts: nextAccounts,
        journalEntries: nextJournals
      };
    });

    recordAudit('RESORT_GUEST_CHECKIN', roomId, `Guest checked into Room ${selectedResForCheckIn?.roomNumber}`, 'INFO');
    playChime('success');
    setSelectedResForCheckIn(null);
  };

  // Check-Out Handler
  const handleConfirmCheckOut = (
    reservationId: string,
    roomId: string,
    settlementAmount: number,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => {
    onUpdateAppState(prev => {
      const nowStr = `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`;
      const res = prev.reservations.find(r => r.id === reservationId);

      // Update reservation
      const updatedReservations = prev.reservations.map(r => {
        if (r.id !== reservationId) return r;
        const newPaid = r.paidAmount + settlementAmount;
        return {
          ...r,
          status: 'CHECKED_OUT' as const,
          actualCheckOutTime: nowStr,
          checkedOutByStaff: currentSession?.name || 'Staff',
          paidAmount: newPaid,
          remainingAmount: Math.max(0, r.totalAmount - newPaid),
          notes: notes ? `${r.notes ? r.notes + ' | ' : ''}Departure notes: ${notes}` : r.notes
        };
      });

      // Update room to DIRTY (never immediately available!)
      const updatedRooms = prev.resortRooms.map(rm => {
        if (rm.id !== roomId) return rm;
        return {
          ...rm,
          status: 'DIRTY' as const,
          currentGuestName: undefined,
          currentGuestPhone: undefined,
          currentReservationId: undefined
        };
      });

      // Add Housekeeping Turnaround Task automatically
      const updatedTasks = [
        ...prev.housekeepingTasks,
        {
          id: 'hk-auto-' + Date.now(),
          roomId,
          roomNumber: res?.roomNumber || 'Room',
          taskType: 'clean_room' as const,
          assignedStaffName: 'Unassigned',
          priority: 'urgent' as const,
          createdTime: nowStr,
          completedTime: null,
          notes: `Turnaround clean after checkout of ${res?.guestName || 'Guest'}.`,
          status: 'pending' as const
        }
      ];

      // Add payment record & GL journal if settlement paid
      const updatedPayments = [...prev.hotelPayments];
      let nextAccounts = prev.accounts;
      let nextJournals = prev.journalEntries;
      if (settlementAmount > 0 && res) {
        const checkoutPayment: HotelPaymentRecord = {
          id: 'hpay-' + Date.now(),
          reservationId: res.id,
          guestName: res.guestName,
          roomNumber: res.roomNumber,
          amount: settlementAmount,
          method: paymentMethod,
          dateTime: nowStr,
          staffName: currentSession?.name || 'Cashier',
          status: 'completed',
          notes: 'Folio balance settlement at checkout'
        };
        updatedPayments.push(checkoutPayment);
        const gl = postHotelPaymentJournal({ ...prev, accounts: nextAccounts, journalEntries: nextJournals }, checkoutPayment, currentSession?.name || 'Front Desk');
        nextAccounts = gl.accounts;
        nextJournals = gl.journalEntries;
      }

      return {
        ...prev,
        reservations: updatedReservations,
        resortRooms: updatedRooms,
        housekeepingTasks: updatedTasks,
        hotelPayments: updatedPayments,
        accounts: nextAccounts,
        journalEntries: nextJournals
      };
    });

    recordAudit('RESORT_GUEST_CHECKOUT', roomId, `Check-out settled for Room ${selectedResForCheckOut?.roomNumber}`, 'INFO');
    playChime('success');
    setSelectedResForCheckOut(null);
  };

  // Add Folio Charge Handler (with VAT sync)
  const handleAddFolioCharge = (charge: Omit<GuestFolioItem, 'id'>) => {
    onUpdateAppState(prev => {
      const newFolioItem: GuestFolioItem = {
        ...charge,
        id: 'fol-' + Date.now()
      };

      const vatFactor = settings.enableVat ? 1 + (settings.vatRatePercent || 13) / 100 : 1;
      const vatIncrement = Math.round((charge.totalPrice * (vatFactor - 1)) * 100) / 100;
      const grossIncrement = Math.round((charge.totalPrice + vatIncrement) * 100) / 100;

      // Update reservation extraCharges, taxAmount & totalAmount consistently
      const updatedReservations = prev.reservations.map(r => {
        if (r.id !== charge.reservationId) return r;
        const newExtras = Math.round((r.extraCharges + charge.totalPrice) * 100) / 100;
        const newTax = Math.round(((r.taxAmount || 0) + vatIncrement) * 100) / 100;
        const newTotal = Math.round((r.totalAmount + grossIncrement) * 100) / 100;
        const newRemaining = Math.max(0, Math.round((newTotal - r.paidAmount) * 100) / 100);
        return {
          ...r,
          extraCharges: newExtras,
          taxAmount: newTax,
          totalAmount: newTotal,
          remainingAmount: newRemaining
        };
      });

      return {
        ...prev,
        guestFolioItems: [newFolioItem, ...prev.guestFolioItems],
        reservations: updatedReservations
      };
    });

    recordAudit('GUEST_FOLIO_CHARGE_ADDED', charge.roomId, `Added ${charge.description} (${charge.totalPrice})`, 'INFO');
    playChime('beep');
  };

  // Record Folio Payment Handler
  const handleRecordHotelPayment = (payment: Omit<HotelPaymentRecord, 'id'>) => {
    onUpdateAppState(prev => {
      const newPayment: HotelPaymentRecord = {
        ...payment,
        id: 'hpay-' + Date.now()
      };

      const updatedReservations = prev.reservations.map(r => {
        if (r.id !== payment.reservationId) return r;
        const newPaid = r.paidAmount + payment.amount;
        return {
          ...r,
          paidAmount: newPaid,
          remainingAmount: Math.max(0, r.totalAmount - newPaid)
        };
      });

      const gl = postHotelPaymentJournal(prev, newPayment, currentSession?.name || 'Front Desk');

      return {
        ...prev,
        hotelPayments: [newPayment, ...prev.hotelPayments],
        reservations: updatedReservations,
        accounts: gl.accounts,
        journalEntries: gl.journalEntries
      };
    });

    recordAudit('HOTEL_PAYMENT_COLLECTED', payment.reservationId, `Collected ${payment.amount} via ${payment.method}`, 'INFO');
    playChime('success');
  };

  // New Reservation Handler (supports both Advance Booking and Immediate Walk-In Check-In)
  const handleSaveReservation = (
    reservation: Reservation, 
    guestProfile?: GuestProfile, 
    depositPayment?: { amount: number; method: PaymentMethod },
    immediateCheckIn?: boolean
  ) => {
    onUpdateAppState(prev => {
      const todayStr = formatLocalYMD();
      const nowStr = `${todayStr} ${new Date().toTimeString().substring(0, 5)}`;
      const isInstantCheckIn = Boolean(immediateCheckIn || reservation.status === 'CHECKED_IN');

      const finalReservation: Reservation = isInstantCheckIn
        ? {
            ...reservation,
            status: 'CHECKED_IN',
            actualCheckInTime: reservation.actualCheckInTime || nowStr,
            checkedInByStaff: reservation.checkedInByStaff || currentSession?.name || 'Reception'
          }
        : reservation;

      const updatedReservations = [finalReservation, ...prev.reservations];

      // Update guest profiles
      let updatedGuests = [...prev.guestProfiles];
      if (guestProfile) {
        const existingIdx = updatedGuests.findIndex(g => g.phone === guestProfile.phone);
        if (existingIdx >= 0) {
          updatedGuests[existingIdx] = {
            ...updatedGuests[existingIdx],
            fullName: guestProfile.fullName || updatedGuests[existingIdx].fullName,
            idType: guestProfile.idType || updatedGuests[existingIdx].idType,
            idNumber: guestProfile.idNumber || updatedGuests[existingIdx].idNumber,
            totalStays: updatedGuests[existingIdx].totalStays + 1
          };
        } else {
          updatedGuests.push(guestProfile);
        }
      }

      // Sync room status: OCCUPIED if immediate walk-in, RESERVED if arriving today
      const updatedRooms = prev.resortRooms.map(rm => {
        if (rm.id !== finalReservation.roomId) return rm;
        if (isInstantCheckIn) {
          return {
            ...rm,
            status: 'OCCUPIED' as const,
            currentGuestName: finalReservation.guestName,
            currentGuestPhone: finalReservation.guestPhone,
            currentReservationId: finalReservation.id,
            checkInDate: finalReservation.checkInDate,
            checkOutDate: finalReservation.checkOutDate
          };
        }
        if (finalReservation.checkInDate === todayStr && (rm.status === 'AVAILABLE' || rm.status === 'CLEAN')) {
          return {
            ...rm,
            status: 'RESERVED' as const,
            currentGuestName: finalReservation.guestName,
            currentGuestPhone: finalReservation.guestPhone,
            currentReservationId: finalReservation.id,
            checkInDate: finalReservation.checkInDate,
            checkOutDate: finalReservation.checkOutDate
          };
        }
        return rm;
      });

      // Record deposit payment & GL journal
      const updatedPayments = [...prev.hotelPayments];
      let nextAccounts = prev.accounts;
      let nextJournals = prev.journalEntries;
      if (depositPayment && depositPayment.amount > 0) {
        const resDepositRec: HotelPaymentRecord = {
          id: 'hpay-' + Date.now(),
          reservationId: finalReservation.id,
          guestName: finalReservation.guestName,
          roomNumber: finalReservation.roomNumber,
          amount: depositPayment.amount,
          method: depositPayment.method,
          dateTime: nowStr,
          staffName: currentSession?.name || 'Staff',
          status: 'completed',
          notes: isInstantCheckIn ? 'Walk-in advance deposit at check-in' : 'Advance booking confirmation deposit'
        };
        updatedPayments.push(resDepositRec);
        const gl = postHotelPaymentJournal({ ...prev, accounts: nextAccounts, journalEntries: nextJournals }, resDepositRec, currentSession?.name || 'Reception');
        nextAccounts = gl.accounts;
        nextJournals = gl.journalEntries;
      }

      // Create initial ROOM folio entry right away for instant Walk-In Check-In
      const updatedFolios = [...prev.guestFolioItems];
      if (isInstantCheckIn) {
        updatedFolios.push({
          id: 'fol-' + Date.now(),
          reservationId: finalReservation.id,
          roomId: finalReservation.roomId,
          roomNumber: finalReservation.roomNumber,
          dateTime: nowStr,
          description: `${finalReservation.roomTypeName} (${finalReservation.nightsCount} Nights Accommodation)`,
          category: 'ROOM',
          quantity: finalReservation.nightsCount,
          unitPrice: finalReservation.roomRate,
          totalPrice: finalReservation.roomRate * finalReservation.nightsCount,
          addedByStaff: currentSession?.name || 'Reception'
        });
      }

      return {
        ...prev,
        reservations: updatedReservations,
        guestProfiles: updatedGuests,
        resortRooms: updatedRooms,
        hotelPayments: updatedPayments,
        guestFolioItems: updatedFolios,
        accounts: nextAccounts,
        journalEntries: nextJournals
      };
    });

    recordAudit(
      immediateCheckIn ? 'RESORT_WALKIN_CHECKIN' : 'RESERVATION_CREATED',
      reservation.roomId,
      `${immediateCheckIn ? 'Walk-in checked in' : 'Created booking'} #${reservation.id} for ${reservation.guestName}`,
      'INFO'
    );
    playChime('success');
    setShowNewReservationModal(false);
    setNewBookingRoomId(undefined);
    setNewBookingDate(undefined);
    setNewBookingWalkIn(false);
  };

  // Cancel Reservation
  const handleCancelReservation = (reservationId: string, reason: string) => {
    onUpdateAppState(prev => {
      const nowStr = `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`;
      const res = prev.reservations.find(r => r.id === reservationId);

      const updatedReservations = prev.reservations.map(r => {
        if (r.id !== reservationId) return r;
        return {
          ...r,
          status: 'CANCELLED' as const,
          cancellationReason: reason,
          cancelledAt: nowStr,
          cancelledByStaff: currentSession?.name || 'Staff'
        };
      });

      // If room was RESERVED by this booking, release back to AVAILABLE
      const updatedRooms = prev.resortRooms.map(rm => {
        if (rm.currentReservationId !== reservationId) return rm;
        return {
          ...rm,
          status: 'AVAILABLE' as const,
          currentGuestName: undefined,
          currentGuestPhone: undefined,
          currentReservationId: undefined
        };
      });

      return {
        ...prev,
        reservations: updatedReservations,
        resortRooms: updatedRooms
      };
    });

    recordAudit('RESERVATION_CANCELLED', reservationId, `Reason: ${reason}`, 'WARNING');
    playChime('alert');
  };

  // Room Status Quick Updater
  const handleUpdateRoomStatus = (roomId: string, status: ResortRoomStatus, housekeeperName?: string) => {
    const nowStr = `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`;
    onUpdateAppState(prev => {
      const updatedRooms = prev.resortRooms.map(rm => {
        if (rm.id !== roomId) return rm;
        const clearingStay = status === 'DIRTY' || status === 'CLEANING' || status === 'AVAILABLE';
        return {
          ...rm,
          status,
          assignedHousekeeper: housekeeperName || rm.assignedHousekeeper,
          lastCleanedTime: status === 'AVAILABLE' ? nowStr : rm.lastCleanedTime,
          ...(clearingStay
            ? {
                currentGuestName: undefined,
                currentGuestPhone: undefined,
                currentReservationId: undefined,
                checkInDate: undefined,
                checkOutDate: undefined
              }
            : {})
        };
      });

      return {
        ...prev,
        resortRooms: updatedRooms
      };
    });

    recordAudit('ROOM_STATUS_CHANGED', roomId, `Status updated to ${status}`, 'INFO');
  };

  // Save / Edit Room
  const handleSaveRoom = (room: ResortRoom) => {
    onUpdateAppState(prev => {
      const idx = prev.resortRooms.findIndex(r => r.id === room.id);
      const updatedRooms = [...prev.resortRooms];
      if (idx >= 0) {
        updatedRooms[idx] = room;
      } else {
        updatedRooms.push(room);
      }
      return { ...prev, resortRooms: updatedRooms };
    });
    recordAudit('ROOM_CONFIG_SAVED', room.id, `Saved Room ${room.roomNumber} (${room.roomTypeName})`, 'INFO');
  };

  // Delete / Remove Room (guarded)
  const handleDeleteRoom = (roomId: string): { ok: boolean; error?: string } => {
    const room = appState.resortRooms.find(r => r.id === roomId);
    if (!room) return { ok: false, error: 'Room not found.' };
    if (room.status === 'OCCUPIED' || room.status === 'RESERVED') {
      return {
        ok: false,
        error: `Cannot remove Room ${room.roomNumber} while its status is ${room.status}.`
      };
    }
    const hasActiveBookings = appState.reservations.some(
      r => r.roomId === roomId && (r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'CHECKED_IN')
    );
    if (hasActiveBookings) {
      return {
        ok: false,
        error: `Cannot remove Room ${room.roomNumber} while active or upcoming reservations exist.`
      };
    }
    onUpdateAppState(prev => ({
      ...prev,
      resortRooms: prev.resortRooms.filter(r => r.id !== roomId)
    }));
    recordAudit('ROOM_DELETED', roomId, `Removed Room ${room.roomNumber}`, 'WARNING');
    playChime('alert');
    return { ok: true };
  };

  // Extend Guest Stay Handler (validated against future bookings)
  const handleExtendStay = (
    reservationId: string,
    newCheckOutDate: string,
    reason?: string
  ): { ok: boolean; error?: string } => {
    const currentRes = appState.reservations.find(r => r.id === reservationId);
    if (!currentRes) {
      return { ok: false, error: 'Reservation not found.' };
    }

    const check = validateStayExtension(
      currentRes,
      newCheckOutDate,
      appState.resortRooms,
      appState.reservations
    );

    if (!check.isValid) {
      return { ok: false, error: check.error };
    }

    const vatFactor = settings.enableVat ? 1 + (settings.vatRatePercent || 13) / 100 : 1;
    const vatIncrement = Math.round((check.extraRoomCharge * (vatFactor - 1)) * 100) / 100;
    const grossIncrement = Math.round((check.extraRoomCharge + vatIncrement) * 100) / 100;
    const nowStr = `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`;

    onUpdateAppState(prev => {
      const updatedReservations = prev.reservations.map(r => {
        if (r.id !== reservationId) return r;
        const newTotal = Math.round((r.totalAmount + grossIncrement) * 100) / 100;
        const newTax = Math.round(((r.taxAmount || 0) + vatIncrement) * 100) / 100;
        return {
          ...r,
          checkOutDate: newCheckOutDate,
          nightsCount: check.totalNights,
          taxAmount: newTax,
          totalAmount: newTotal,
          remainingAmount: Math.max(0, Math.round((newTotal - r.paidAmount) * 100) / 100),
          notes: `${r.notes ? r.notes + ' | ' : ''}Extended +${check.extraNights}N to ${newCheckOutDate}${reason ? `: ${reason}` : ''}`
        };
      });

      const updatedRooms = prev.resortRooms.map(rm => {
        if (rm.id !== currentRes.roomId) return rm;
        return {
          ...rm,
          checkOutDate: newCheckOutDate
        };
      });

      const updatedFolios = [...prev.guestFolioItems];
      if (currentRes.status === 'CHECKED_IN' && check.extraRoomCharge > 0) {
        updatedFolios.push({
          id: 'fol-ext-' + Date.now(),
          reservationId: currentRes.id,
          roomId: currentRes.roomId,
          roomNumber: currentRes.roomNumber,
          dateTime: nowStr,
          description: `Stay Extension (${check.extraNights} Extra Night${check.extraNights > 1 ? 's' : ''} → ${newCheckOutDate})`,
          category: 'ROOM',
          quantity: check.extraNights,
          unitPrice: currentRes.roomRate,
          totalPrice: check.extraRoomCharge,
          addedByStaff: currentSession?.name || 'Reception'
        });
      }

      return {
        ...prev,
        reservations: updatedReservations,
        resortRooms: updatedRooms,
        guestFolioItems: updatedFolios
      };
    });

    // Keep modal reservation ref fresh if viewing Folio
    setSelectedResForFolio(prev =>
      prev && prev.id === reservationId
        ? {
            ...prev,
            checkOutDate: newCheckOutDate,
            nightsCount: check.totalNights,
            totalAmount: Math.round((prev.totalAmount + grossIncrement) * 100) / 100
          }
        : prev
    );

    recordAudit(
      'STAY_EXTENDED',
      currentRes.roomId,
      `Extended Room ${currentRes.roomNumber} checkout from ${currentRes.checkOutDate} to ${newCheckOutDate} (+${check.extraNights}N)`,
      'INFO'
    );
    playChime('success');
    return { ok: true };
  };

  // Save Room Type (optionally sync updated price/name/capacity to rooms of this category)
  const handleSaveRoomType = (roomType: RoomType, syncRooms?: boolean) => {
    onUpdateAppState(prev => {
      const idx = prev.roomTypes.findIndex(rt => rt.id === roomType.id);
      const updatedTypes = [...prev.roomTypes];
      if (idx >= 0) {
        updatedTypes[idx] = roomType;
      } else {
        updatedTypes.push(roomType);
      }
      const updatedRooms = syncRooms
        ? prev.resortRooms.map(rm =>
            rm.roomTypeId === roomType.id
              ? {
                  ...rm,
                  roomTypeName: roomType.name,
                  pricePerNight: roomType.basePrice,
                  extraGuestPrice: roomType.extraGuestPrice,
                  capacity: roomType.totalCapacity || rm.capacity
                }
              : rm
          )
        : prev.resortRooms;
      return { ...prev, roomTypes: updatedTypes, resortRooms: updatedRooms };
    });
    recordAudit(
      'ROOM_TYPE_SAVED',
      roomType.id,
      `Saved Room Type ${roomType.name} (${settings.currencySymbol} ${roomType.basePrice}${syncRooms ? ', synced to existing rooms' : ''})`,
      'INFO'
    );
    playChime('success');
  };

  // Update Reservation / Active Stay (Guest details, Dates/Timings, Room, Rate, Discount, Adults/Children)
  const handleUpdateReservation = (
    reservationId: string,
    updates: ReservationEditPayload
  ): { ok: boolean; error?: string } => {
    const existingRes = appState.reservations.find(r => r.id === reservationId);
    if (!existingRes) {
      return { ok: false, error: 'Reservation record not found.' };
    }

    const targetRoom = appState.resortRooms.find(rm => rm.id === updates.roomId);
    if (!targetRoom) {
      return { ok: false, error: 'Selected room does not exist.' };
    }

    // Double-booking validation against other active reservations
    const overlappingBooking = appState.reservations.find(other => {
      if (other.id === reservationId) return false;
      if (other.roomId !== updates.roomId) return false;
      if (other.status === 'CANCELLED' || other.status === 'CHECKED_OUT' || other.status === 'NO_SHOW') {
        return false;
      }
      return other.checkInDate < updates.checkOutDate && other.checkOutDate > updates.checkInDate;
    });

    if (overlappingBooking) {
      return {
        ok: false,
        error: `Room ${targetRoom.roomNumber} is already booked by ${overlappingBooking.guestName} (${overlappingBooking.checkInDate} → ${overlappingBooking.checkOutDate}).`
      };
    }

    const nightsCount = Math.max(
      1,
      Math.ceil(
        (new Date(updates.checkOutDate).getTime() - new Date(updates.checkInDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    const roomSubtotal = updates.roomRate * nightsCount;
    const taxable = Math.max(0, roomSubtotal - updates.discountAmount + (existingRes.extraCharges || 0));
    const vatAmount = settings.enableVat
      ? Math.round((taxable * ((settings.vatRatePercent || 13) / 100)) * 100) / 100
      : 0;
    const totalAmount = Math.round((taxable + vatAmount) * 100) / 100;
    const remainingAmount = Math.max(0, Math.round((totalAmount - existingRes.paidAmount) * 100) / 100);

    let updatedResSnapshot: Reservation | null = null;

    onUpdateAppState(prev => {
      const updatedReservations = prev.reservations.map(r => {
        if (r.id !== reservationId) return r;
        const nextRes: Reservation = {
          ...r,
          guestName: updates.guestName,
          guestPhone: updates.guestPhone,
          guestEmail: updates.guestEmail,
          guestAddress: updates.guestAddress,
          guestCountry: updates.guestCountry,
          idType: updates.idType,
          idNumber: updates.idNumber,
          roomId: targetRoom.id,
          roomNumber: targetRoom.roomNumber,
          roomTypeId: targetRoom.roomTypeId,
          roomTypeName: targetRoom.roomTypeName,
          checkInDate: updates.checkInDate,
          checkOutDate: updates.checkOutDate,
          checkInTime: updates.checkInTime,
          checkOutTime: updates.checkOutTime,
          adults: updates.adults,
          children: updates.children,
          nightsCount,
          roomRate: updates.roomRate,
          discountAmount: updates.discountAmount,
          taxAmount: vatAmount,
          totalAmount,
          remainingAmount,
          bookingSource: updates.bookingSource,
          notes: updates.notes
        };
        updatedResSnapshot = nextRes;
        return nextRes;
      });

      // Sync guest profile
      let updatedGuests = [...prev.guestProfiles];
      const gIdx = updatedGuests.findIndex(
        g => g.id === existingRes.guestId || g.phone === existingRes.guestPhone
      );
      if (gIdx >= 0) {
        updatedGuests[gIdx] = {
          ...updatedGuests[gIdx],
          fullName: updates.guestName,
          phone: updates.guestPhone,
          email: updates.guestEmail ?? updatedGuests[gIdx].email,
          address: updates.guestAddress ?? updatedGuests[gIdx].address,
          country: updates.guestCountry || updatedGuests[gIdx].country,
          idType: updates.idType || updatedGuests[gIdx].idType,
          idNumber: updates.idNumber ?? updatedGuests[gIdx].idNumber
        };
      } else {
        updatedGuests = [
          {
            id: existingRes.guestId || 'gp-' + Date.now(),
            fullName: updates.guestName,
            phone: updates.guestPhone,
            email: updates.guestEmail || '',
            address: updates.guestAddress || '',
            country: updates.guestCountry || 'Nepal',
            idType: updates.idType || 'Citizenship',
            idNumber: updates.idNumber || '',
            totalStays: 1,
            createdAt: formatLocalYMD()
          },
          ...updatedGuests
        ];
      }

      // Sync room record(s)
      const roomChanged = existingRes.roomId !== targetRoom.id;
      const isActiveOccupancy = existingRes.status === 'CHECKED_IN';
      const isTodayReserved =
        (existingRes.status === 'CONFIRMED' || existingRes.status === 'PENDING') &&
        updates.checkInDate <= formatLocalYMD();

      const updatedRooms = prev.resortRooms.map(rm => {
        if (roomChanged && rm.id === existingRes.roomId && rm.currentReservationId === reservationId) {
          return {
            ...rm,
            status: (isActiveOccupancy ? 'DIRTY' : 'AVAILABLE') as ResortRoomStatus,
            currentGuestName: undefined,
            currentGuestPhone: undefined,
            currentReservationId: undefined,
            checkInDate: undefined,
            checkOutDate: undefined
          };
        }
        if (rm.id === targetRoom.id && (isActiveOccupancy || isTodayReserved || rm.currentReservationId === reservationId)) {
          return {
            ...rm,
            status: (isActiveOccupancy ? 'OCCUPIED' : isTodayReserved ? 'RESERVED' : rm.status) as ResortRoomStatus,
            currentGuestName: updates.guestName,
            currentGuestPhone: updates.guestPhone,
            currentReservationId: reservationId,
            checkInDate: updates.checkInDate,
            checkOutDate: updates.checkOutDate
          };
        }
        return rm;
      });

      // Update primary ROOM folio line item so folio & invoice match new nights/rate/room
      let updatedPrimaryRoomFolio = false;
      const updatedFolios = prev.guestFolioItems.map(f => {
        if (f.reservationId !== reservationId) return f;
        if (f.category === 'ROOM' && !updatedPrimaryRoomFolio) {
          updatedPrimaryRoomFolio = true;
          return {
            ...f,
            roomId: targetRoom.id,
            roomNumber: targetRoom.roomNumber,
            description: `${targetRoom.roomTypeName} (${nightsCount} Nights Accommodation)`,
            quantity: nightsCount,
            unitPrice: updates.roomRate,
            totalPrice: updates.roomRate * nightsCount
          };
        }
        return {
          ...f,
          roomId: targetRoom.id,
          roomNumber: targetRoom.roomNumber
        };
      });

      return {
        ...prev,
        reservations: updatedReservations,
        guestProfiles: updatedGuests,
        resortRooms: updatedRooms,
        guestFolioItems: updatedFolios
      };
    });

    if (selectedResForFolio && selectedResForFolio.id === reservationId && updatedResSnapshot) {
      setSelectedResForFolio(updatedResSnapshot);
    }

    recordAudit(
      'RESERVATION_UPDATED',
      targetRoom.id,
      `Updated booking #${reservationId} (${updates.guestName}, Room ${targetRoom.roomNumber}, ${updates.checkInDate}→${updates.checkOutDate}, Rate ${updates.roomRate})`,
      'INFO'
    );
    playChime('success');
    setEditingReservation(null);
    return { ok: true };
  };

  // Archive Room Type
  const handleArchiveRoomType = (roomTypeId: string) => {
    onUpdateAppState(prev => {
      const updatedTypes = prev.roomTypes.map(rt => {
        if (rt.id !== roomTypeId) return rt;
        return { ...rt, isActive: !rt.isActive };
      });
      return { ...prev, roomTypes: updatedTypes };
    });
  };

  // Post Daily Room Charges (Night Audit)
  const handlePostDailyRoomCharges = (
    newFolios: Omit<GuestFolioItem, 'id'>[], 
    auditNotes: string,
    auditRecord?: NightAuditRecord
  ) => {
    onUpdateAppState(prev => {
      const itemsToAdd: GuestFolioItem[] = newFolios.map(f => ({
        ...f,
        id: 'fol-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      }));

      // Update reservation extra/total balances
      const updatedReservations = prev.reservations.map(res => {
        const item = newFolios.find(f => f.reservationId === res.id);
        if (!item) return res;
        const newTotal = res.totalAmount + item.totalPrice;
        return {
          ...res,
          totalAmount: newTotal,
          remainingAmount: Math.max(0, newTotal - res.paidAmount)
        };
      });

      const updatedNightAudits = auditRecord 
        ? [auditRecord, ...(prev.nightAudits || [])]
        : (prev.nightAudits || []);

      return {
        ...prev,
        guestFolioItems: [...itemsToAdd, ...prev.guestFolioItems],
        reservations: updatedReservations,
        nightAudits: updatedNightAudits
      };
    });

    recordAudit('NIGHT_AUDIT_COMPLETED', undefined, auditNotes, 'INFO');
    playChime('success');
  };

  // Maintenance Issue Handlers
  const handleReportMaintenanceIssue = (
    issue: Omit<MaintenanceIssue, 'id'>, 
    setRoomStatus?: ResortRoomStatus
  ) => {
    onUpdateAppState(prev => {
      const newIssue: MaintenanceIssue = {
        ...issue,
        id: 'mnt-' + Date.now()
      };

      let updatedRooms = prev.resortRooms;
      if (setRoomStatus) {
        updatedRooms = prev.resortRooms.map(rm => {
          if (rm.id !== issue.roomId) return rm;
          return {
            ...rm,
            status: setRoomStatus,
            description: issue.description
          };
        });
      }

      return {
        ...prev,
        maintenanceIssues: [newIssue, ...prev.maintenanceIssues],
        resortRooms: updatedRooms
      };
    });

    recordAudit('MAINTENANCE_TICKET_REPORTED', issue.roomId, `Issue: ${issue.issueType}`, 'WARNING');
    setMaintenanceRoomDetails(null);
  };

  const handleResolveMaintenanceIssue = (
    issueId: string, 
    resolution: string, 
    returnRoomStatus: ResortRoomStatus
  ) => {
    onUpdateAppState(prev => {
      const issue = prev.maintenanceIssues.find(i => i.id === issueId);
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

      const updatedIssues = prev.maintenanceIssues.map(i => {
        if (i.id !== issueId) return i;
        return {
          ...i,
          status: 'resolved' as const,
          resolution,
          completedBy: currentSession?.name || 'Maintenance Tech',
          completedDate: nowStr
        };
      });

      let updatedRooms = prev.resortRooms;
      if (issue) {
        updatedRooms = prev.resortRooms.map(rm => {
          if (rm.id !== issue.roomId) return rm;
          return {
            ...rm,
            status: returnRoomStatus,
            description: undefined
          };
        });
      }

      return {
        ...prev,
        maintenanceIssues: updatedIssues,
        resortRooms: updatedRooms
      };
    });

    recordAudit('MAINTENANCE_TICKET_RESOLVED', issueId, `Resolution: ${resolution}`, 'INFO');
    playChime('success');
  };

  // Save / Update Guest Profile
  const handleSaveGuest = (guest: GuestProfile) => {
    onUpdateAppState(prev => {
      const idx = prev.guestProfiles.findIndex(g => g.id === guest.id);
      let updatedGuests = [...prev.guestProfiles];
      if (idx >= 0) {
        updatedGuests[idx] = guest;
      } else {
        updatedGuests = [guest, ...prev.guestProfiles];
      }
      return { ...prev, guestProfiles: updatedGuests };
    });
    recordAudit('GUEST_PROFILE_SAVED', guest.id, `Saved profile for ${guest.fullName}`, 'INFO');
    playChime('success');
  };

  // Reassign Room / Room Move (validated via validateRoomReassignment)
  const handleReassignRoom = (reservationId: string, newRoomId: string, reason?: string) => {
    const res = appState.reservations.find(r => r.id === reservationId);
    if (!res) return;
    const validation = validateRoomReassignment(
      res,
      newRoomId,
      appState.resortRooms,
      appState.reservations
    );
    if (!validation.isValid || !validation.targetRoom) {
      recordAudit('ROOM_REASSIGN_REJECTED', newRoomId, validation.error || 'Invalid transfer', 'WARNING');
      playChime('alert');
      return;
    }

    onUpdateAppState(prev => {
      const currentRes = prev.reservations.find(r => r.id === reservationId);
      const targetRoom = prev.resortRooms.find(r => r.id === newRoomId);
      if (!currentRes || !targetRoom) return prev;

      const oldRoomId = currentRes.roomId;
      const oldRoomNumber = currentRes.roomNumber;

      const updatedReservations = prev.reservations.map(r => {
        if (r.id !== reservationId) return r;
        return {
          ...r,
          roomId: targetRoom.id,
          roomNumber: targetRoom.roomNumber,
          roomTypeId: targetRoom.roomTypeId,
          roomTypeName: targetRoom.roomTypeName,
          notes: `${r.notes ? r.notes + ' | ' : ''}Transferred from Room ${oldRoomNumber} to ${targetRoom.roomNumber}: ${reason || 'Guest request'}`
        };
      });

      const updatedRooms = prev.resortRooms.map(rm => {
        if (rm.id === oldRoomId) {
          return {
            ...rm,
            status: 'DIRTY' as const,
            currentGuestName: undefined,
            currentGuestPhone: undefined,
            currentReservationId: undefined,
            checkInDate: undefined,
            checkOutDate: undefined
          };
        }
        if (rm.id === newRoomId) {
          return {
            ...rm,
            status: 'OCCUPIED' as const,
            currentGuestName: currentRes.guestName,
            currentGuestPhone: currentRes.guestPhone,
            currentReservationId: currentRes.id,
            checkInDate: currentRes.checkInDate,
            checkOutDate: currentRes.checkOutDate
          };
        }
        return rm;
      });

      const updatedFolios = prev.guestFolioItems.map(f => {
        if (f.reservationId !== reservationId) return f;
        return {
          ...f,
          roomId: targetRoom.id,
          roomNumber: targetRoom.roomNumber
        };
      });

      return {
        ...prev,
        reservations: updatedReservations,
        resortRooms: updatedRooms,
        guestFolioItems: updatedFolios
      };
    });

    recordAudit('ROOM_REASSIGNED', newRoomId, `Moved guest to Room ${newRoomId}. Reason: ${reason || 'Upgrade'}`, 'INFO');
    playChime('success');
  };

  return (
    <div className="space-y-6">
      {/* Resort Sub-Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ResortSubTab)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Global Resort Action Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setNewBookingRoomId(undefined);
              setNewBookingDate(undefined);
              setNewBookingWalkIn(true);
              setShowNewReservationModal(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-2xs transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> Walk-In / Book
          </button>
          <button
            type="button"
            onClick={() => setShowRoomTypeModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <BedDouble className="h-3.5 w-3.5" /> Room Types
          </button>
          <button
            type="button"
            onClick={() => setShowServicesModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            <Tag className="h-3.5 w-3.5" /> Extra Services
          </button>
          <button
            type="button"
            onClick={() => {
              setDefaultCheckInInput(settings.hotelCheckInTime || '14:00');
              setDefaultCheckOutInput(settings.hotelCheckOutTime || '12:00');
              setShowTimingsModal(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors whitespace-nowrap shrink-0"
            title="Configure Default Check-In & Check-Out Timings"
          >
            <Clock className="h-3.5 w-3.5 text-emerald-800" />
            <span>{settings.hotelCheckInTime || '14:00'} / {settings.hotelCheckOutTime || '12:00'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNightAuditModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-950 hover:bg-black text-white rounded-lg font-bold shadow-2xs transition-colors whitespace-nowrap shrink-0"
          >
            <Moon className="h-3.5 w-3.5 text-indigo-300" /> Night Audit
          </button>
        </div>
      </div>

      {/* Main Tab Content Display */}
      {activeTab === 'dashboard' && (
        <ResortDashboard
          rooms={appState.resortRooms}
          reservations={appState.reservations}
          folioItems={appState.guestFolioItems}
          payments={appState.hotelPayments}
          housekeepingTasks={appState.housekeepingTasks}
          maintenanceIssues={appState.maintenanceIssues}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onNavigateTab={(tab) => setActiveTab(tab as ResortSubTab)}
          onOpenCheckIn={(res) => setSelectedResForCheckIn(res)}
          onOpenCheckOut={(res) => setSelectedResForCheckOut(res)}
          onOpenFolio={(res) => {
            setSelectedFolioAction(undefined);
            setSelectedResForFolio(res);
          }}
          onOpenNewBooking={() => {
            setNewBookingWalkIn(false);
            setShowNewReservationModal(true);
          }}
          onOpenNightAudit={() => setShowNightAuditModal(true)}
        />
      )}

      {activeTab === 'rooms' && (
        <RoomGridView
          rooms={appState.resortRooms}
          roomTypes={appState.roomTypes}
          reservations={appState.reservations}
          folioItems={appState.guestFolioItems}
          payments={appState.hotelPayments}
          maintenanceIssues={appState.maintenanceIssues}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onOpenCheckIn={(res) => setSelectedResForCheckIn(res)}
          onOpenCheckOut={(res) => setSelectedResForCheckOut(res)}
          onOpenFolio={(res) => {
            setSelectedFolioAction(undefined);
            setSelectedResForFolio(res);
          }}
          onOpenFolioAction={(res, action) => {
            setSelectedFolioAction(action);
            setSelectedResForFolio(res);
          }}
          onOpenNewBooking={(roomId) => {
            setNewBookingRoomId(roomId);
            setNewBookingWalkIn(false);
            setShowNewReservationModal(true);
          }}
          onOpenWalkIn={(roomId) => {
            setNewBookingRoomId(roomId);
            setNewBookingDate(formatLocalYMD());
            setNewBookingWalkIn(true);
            setShowNewReservationModal(true);
          }}
          onOpenMaintenanceModal={(roomId, roomNumber) => {
            setMaintenanceRoomDetails({ id: roomId, number: roomNumber });
          }}
          onUpdateRoomStatus={handleUpdateRoomStatus}
          onSaveRoom={handleSaveRoom}
          onDeleteRoom={handleDeleteRoom}
          onOpenRoomTypes={() => setShowRoomTypeModal(true)}
          onOpenEditStay={(res) => setEditingReservation(res)}
        />
      )}

      {activeTab === 'reservations' && (
        <ReservationList
          reservations={appState.reservations}
          rooms={appState.resortRooms}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onOpenCheckIn={(res) => setSelectedResForCheckIn(res)}
          onOpenCheckOut={(res) => setSelectedResForCheckOut(res)}
          onOpenFolio={(res) => setSelectedResForFolio(res)}
          onCancelReservation={handleCancelReservation}
          onOpenNewBooking={() => setShowNewReservationModal(true)}
          onOpenEditReservation={(res) => setEditingReservation(res)}
        />
      )}

      {activeTab === 'calendar' && (
        <ReservationCalendar
          rooms={appState.resortRooms}
          roomTypes={appState.roomTypes}
          reservations={appState.reservations}
          lang={lang}
          onSelectReservation={(res) => {
            if (res.status === 'CHECKED_IN') setSelectedResForFolio(res);
            else if (res.status === 'CONFIRMED') setSelectedResForCheckIn(res);
            else setSelectedResForFolio(res);
          }}
          onNewBookingForSlot={(roomId, date) => {
            setNewBookingRoomId(roomId);
            setNewBookingDate(date);
            setShowNewReservationModal(true);
          }}
        />
      )}

      {activeTab === 'guests' && (
        <GuestProfilesView
          guests={appState.guestProfiles}
          reservations={appState.reservations}
          payments={appState.hotelPayments}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onSaveGuest={handleSaveGuest}
          onSelectGuestForBooking={() => {
            setShowNewReservationModal(true);
          }}
        />
      )}

      {activeTab === 'housekeeping' && (
        <HousekeepingBoard
          rooms={appState.resortRooms}
          tasks={appState.housekeepingTasks}
          staffUsers={appState.staffUsers}
          currentSession={currentSession}
          lang={lang}
          onUpdateRoomStatus={handleUpdateRoomStatus}
          onUpdateTask={(task) => {
            onUpdateAppState(prev => ({
              ...prev,
              housekeepingTasks: prev.housekeepingTasks.map(t => t.id === task.id ? task : t)
            }));
          }}
          onAddTask={(task) => {
            onUpdateAppState(prev => ({
              ...prev,
              housekeepingTasks: [{ ...task, id: 'hk-' + Date.now() }, ...prev.housekeepingTasks]
            }));
          }}
          onOpenMaintenanceModal={(roomId, roomNumber) => {
            setMaintenanceRoomDetails({ id: roomId, number: roomNumber });
          }}
        />
      )}

      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-700" />
                {lang === 'ne' ? 'कोठा मर्मत र प्राविधिक टिकट व्यवस्थापन' : 'Room Maintenance & Engineering Tickets'}
              </h3>
              <p className="text-xs text-slate-500">
                Track AC, plumbing, electrical, and facility repair tickets across all rooms
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const firstRoom = appState.resortRooms[0];
                if (firstRoom) {
                  setMaintenanceRoomDetails({ id: firstRoom.id, number: firstRoom.roomNumber });
                }
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-2xs inline-flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Report / Resolve Ticket
            </button>
          </div>

          {appState.maintenanceIssues.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No maintenance tickets reported yet. All rooms are operating normally.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {appState.maintenanceIssues.map((issue) => (
                <div key={issue.id} className="p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">Room {issue.roomNumber}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                        {issue.issueType}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        issue.priority === 'urgent' ? 'bg-rose-100 text-rose-800' :
                        issue.priority === 'high' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {issue.priority}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{issue.description}</p>
                    <p className="text-[10px] text-slate-400">
                      Reported by {issue.reportedBy} on {issue.reportedDate}
                      {issue.resolution ? ` · Resolved: ${issue.resolution}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {issue.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMaintenanceRoomDetails({ id: issue.roomId, number: issue.roomNumber })}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px]"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Resort Services & Amenities Catalog</h3>
              <p className="text-xs text-slate-500">Manage extras, tours, spa, and post charges to active room folios</p>
            </div>
            <button
              onClick={() => setShowServicesModal(true)}
              className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs shadow-2xs"
            >
              Open Service Charging Center
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {appState.resortServices.map((srv) => (
              <div key={srv.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                  {srv.category}
                </span>
                <h4 className="font-bold text-slate-900 text-xs mt-1">{srv.name}</h4>
                <p className="text-[11px] text-slate-500 line-clamp-2">{srv.description}</p>
                <p className="font-mono-num font-bold text-emerald-800 text-xs pt-1">
                  {settings.currencySymbol} {srv.price.toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <ResortReports
          rooms={appState.resortRooms}
          reservations={appState.reservations}
          folioItems={appState.guestFolioItems}
          payments={appState.hotelPayments}
          orders={appState.orders}
          guests={appState.guestProfiles}
          nightAudits={appState.nightAudits || []}
          businessTenant={activeBusiness}
          settings={settings}
          lang={lang}
        />
      )}

      {/* ================= MODALS ================= */}

      {/* Check-In Modal */}
      {selectedResForCheckIn && (
        <CheckInModal
          reservation={selectedResForCheckIn}
          room={appState.resortRooms.find(r => r.id === selectedResForCheckIn.roomId)}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onConfirmCheckIn={handleConfirmCheckIn}
          onClose={() => setSelectedResForCheckIn(null)}
        />
      )}

      {/* Check-Out Modal */}
      {selectedResForCheckOut && (
        <CheckOutModal
          reservation={selectedResForCheckOut}
          room={appState.resortRooms.find(r => r.id === selectedResForCheckOut.roomId)}
          folioItems={appState.guestFolioItems.filter(f => f.reservationId === selectedResForCheckOut.id)}
          payments={appState.hotelPayments.filter(p => p.reservationId === selectedResForCheckOut.id)}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onConfirmCheckOut={handleConfirmCheckOut}
          onClose={() => setSelectedResForCheckOut(null)}
        />
      )}

      {/* Guest Folio Modal */}
      {selectedResForFolio && (
        <GuestFolioModal
          reservation={appState.reservations.find(r => r.id === selectedResForFolio.id) || selectedResForFolio}
          room={appState.resortRooms.find(r => r.id === selectedResForFolio.roomId)}
          folioItems={appState.guestFolioItems.filter(f => f.reservationId === selectedResForFolio.id)}
          payments={appState.hotelPayments.filter(p => p.reservationId === selectedResForFolio.id)}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          availableRooms={appState.resortRooms}
          initialAction={selectedFolioAction}
          onAddFolioCharge={handleAddFolioCharge}
          onRecordPayment={handleRecordHotelPayment}
          onReassignRoom={handleReassignRoom}
          onExtendStay={handleExtendStay}
          onOpenEditReservation={() => {
            const currentRes = appState.reservations.find(r => r.id === selectedResForFolio.id) || selectedResForFolio;
            setEditingReservation(currentRes);
          }}
          onClose={() => {
            setSelectedResForFolio(null);
            setSelectedFolioAction(undefined);
          }}
        />
      )}

      {/* New Reservation Modal */}
      {showNewReservationModal && (
        <NewReservationModal
          rooms={appState.resortRooms}
          roomTypes={appState.roomTypes}
          existingReservations={appState.reservations}
          guestProfiles={appState.guestProfiles}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onSaveReservation={handleSaveReservation}
          onClose={() => {
            setShowNewReservationModal(false);
            setNewBookingRoomId(undefined);
            setNewBookingDate(undefined);
            setNewBookingWalkIn(false);
          }}
          initialRoomId={newBookingRoomId}
          initialDate={newBookingDate}
          initialImmediateCheckIn={newBookingWalkIn}
        />
      )}

      {/* Night Audit Modal */}
      {showNightAuditModal && (
        <NightAuditModal
          rooms={appState.resortRooms}
          reservations={appState.reservations}
          folioItems={appState.guestFolioItems}
          payments={appState.hotelPayments}
          pastNightAudits={appState.nightAudits || []}
          businessId={activeBusiness.businessId}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onPostDailyRoomCharges={handlePostDailyRoomCharges}
          onClose={() => setShowNightAuditModal(false)}
        />
      )}

      {/* Room Type Manager Modal */}
      {showRoomTypeModal && (
        <RoomTypeModal
          roomTypes={appState.roomTypes}
          settings={settings}
          currentSession={currentSession}
          lang={lang}
          onSaveRoomType={handleSaveRoomType}
          onArchiveRoomType={handleArchiveRoomType}
          onClose={() => setShowRoomTypeModal(false)}
        />
      )}

      {/* Services Modal */}
      {showServicesModal && (
        <ResortServicesModal
          services={appState.resortServices}
          occupiedRooms={appState.resortRooms.filter(r => r.status === 'OCCUPIED')}
          reservations={appState.reservations}
          currentSession={currentSession}
          settings={settings}
          lang={lang}
          onAddChargeToRoom={handleAddFolioCharge}
          onSaveService={(srv) => {
            onUpdateAppState(prev => ({
              ...prev,
              resortServices: [srv, ...prev.resortServices]
            }));
          }}
          onClose={() => setShowServicesModal(false)}
        />
      )}

      {/* Maintenance Modal */}
      {maintenanceRoomDetails && (
        <MaintenanceModal
          rooms={appState.resortRooms}
          issues={appState.maintenanceIssues}
          initialRoomId={maintenanceRoomDetails.id}
          currentSession={currentSession}
          lang={lang}
          onReportIssue={handleReportMaintenanceIssue}
          onResolveIssue={handleResolveMaintenanceIssue}
          onClose={() => setMaintenanceRoomDetails(null)}
        />
      )}

      {/* Edit Reservation / Active Stay Modal */}
      {editingReservation && (
        <EditReservationModal
          reservation={editingReservation}
          guestProfile={appState.guestProfiles.find(
            g => g.id === editingReservation.guestId || g.phone === editingReservation.guestPhone
          )}
          rooms={appState.resortRooms}
          existingReservations={appState.reservations}
          settings={settings}
          lang={lang}
          onSave={handleUpdateReservation}
          onClose={() => setEditingReservation(null)}
        />
      )}

      {/* Property Default Check-In / Check-Out Timings Modal */}
      {showTimingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-800" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'ne' ? 'होटल चेक-इन / चेक-आउट समय' : 'Standard Hotel Timings'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTimingsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {lang === 'ne'
                ? 'नयाँ बुकिङ र चेक-इन गर्दा स्वतः भरिने मानक समय सेट गर्नुहोस्।'
                : 'Default Check-In and Check-Out hours prefilled for new bookings and guest check-ins.'}
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Standard Check-In:</label>
                <input
                  type="time"
                  value={defaultCheckInInput}
                  onChange={(e) => setDefaultCheckInInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Standard Check-Out:</label>
                <input
                  type="time"
                  value={defaultCheckOutInput}
                  onChange={(e) => setDefaultCheckOutInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setShowTimingsModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateAppState(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      hotelCheckInTime: defaultCheckInInput || '14:00',
                      hotelCheckOutTime: defaultCheckOutInput || '12:00'
                    }
                  }));
                  recordAudit(
                    'HOTEL_TIMINGS_UPDATED',
                    undefined,
                    `Updated default Check-In ${defaultCheckInInput} / Check-Out ${defaultCheckOutInput}`,
                    'INFO'
                  );
                  playChime('success');
                  setShowTimingsModal(false);
                }}
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold"
              >
                Save Timings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
