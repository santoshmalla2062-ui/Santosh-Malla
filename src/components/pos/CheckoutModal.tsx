import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BookOpen,
  Building,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Hotel,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Split,
  UserPlus,
  Wallet,
  X
} from 'lucide-react';
import {
  BusinessSettings,
  Customer,
  Order,
  PaymentMethod,
  PaymentRecord,
  Session
} from '../../types';
import { Language } from '../../utils/translations';
import { SplitPaymentDetails, hasPermission, validatePaymentSettlement } from '../../services/security';
import { NumberInput } from '../common/NumberInput';
import { sanitizeNumericDraft } from '../../utils/numberInput';
import {
  DEFAULT_QUICK_CASH_NOTES,
  addCustomQuickCashNote,
  buildQuickCashOptionsForPayable,
  loadQuickCashNotes,
  removeQuickCashNote,
  saveQuickCashNotes
} from '../../services/quickCashNotes';
import { sanitizePaymentQrDataUrl } from '../../utils/imageUtils';
import { nowIsoString } from '../../utils/timeUtils';

interface CheckoutModalProps {
  order: Order;
  customers: Customer[];
  settings: BusinessSettings;
  lang: Language;
  currentSession?: Session | null;
  initialPaymentMethod?: PaymentMethod;
  occupiedRooms?: { id: string; roomNumber: string; currentGuestName?: string; currentReservationId?: string }[];
  onConfirmSettlement: (
    paymentMethod: PaymentMethod,
    paymentDetails: {
      cash?: number;
      esewa?: number;
      khalti?: number;
      fonepay?: number;
      card?: number;
      bank?: number;
      qr?: number;
      credit?: number;
      charge_to_room?: number;
    },
    customerId?: string,
    customerName?: string,
    customerPhone?: string,
    paidAmount?: number,
    dueAmount?: number,
    paymentRecord?: PaymentRecord,
    roomChargeDetails?: {
      resortRoomId: string;
      roomNumber: string;
      guestName: string;
      reservationId: string;
    }
  ) => void;
  onUpdateSettings?: (newSettings: BusinessSettings) => void;
  onClose: () => void;
}

const SPLIT_CHANNELS: {
  key: keyof SplitPaymentDetails;
  label: string;
  nepaliLabel: string;
  accent: string;
}[] = [
  { key: 'cash', label: 'Cash', nepaliLabel: 'नगद', accent: 'text-emerald-700' },
  { key: 'fonepay', label: 'Fonepay QR', nepaliLabel: 'फोनपे QR', accent: 'text-red-600' },
  { key: 'card', label: 'Card / POS', nepaliLabel: 'कार्ड स्वाइप', accent: 'text-blue-600' },
  { key: 'esewa', label: 'eSewa', nepaliLabel: 'ईसेवा', accent: 'text-emerald-600' },
  { key: 'khalti', label: 'Khalti', nepaliLabel: 'खल्ती', accent: 'text-purple-600' },
  { key: 'bank', label: 'Bank Transfer', nepaliLabel: 'बैंक खाता', accent: 'text-cyan-700' },
  { key: 'credit', label: 'Khata / Credit Due', nepaliLabel: 'उधारो बाँकी', accent: 'text-amber-700' }
];

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  order,
  customers,
  settings,
  lang,
  currentSession,
  initialPaymentMethod,
  occupiedRooms = [],
  onConfirmSettlement,
  onUpdateSettings,
  onClose
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    initialPaymentMethod || order.paymentMethod || 'cash'
  );
  const [paymentMode, setPaymentMode] = useState<'full' | 'partial' | 'due'>('full');

  // Custom partial amount
  const [partialPaidAmount, setPartialPaidAmount] = useState<number>(
    Math.max(1, Math.floor(order.grandTotal / 2))
  );

  // Customer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(order.customerId || '');
  const [cashTendered, setCashTendered] = useState<number>(Math.round(order.grandTotal * 100) / 100);
  const [showQuickCashNotes, setShowQuickCashNotes] = useState<boolean>(false);
  const [editingQuickNotes, setEditingQuickNotes] = useState<boolean>(false);
  const [configuredQuickNotes, setConfiguredQuickNotes] = useState<number[]>(() =>
    loadQuickCashNotes(settings.businessId, settings.quickCashNotes)
  );
  const [customQuickNoteInput, setCustomQuickNoteInput] = useState<string>('');
  const [quickNoteError, setQuickNoteError] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string>(order.paymentReference || '');

  // Room charge selection
  const [selectedRoomId, setSelectedRoomId] = useState<string>(occupiedRooms[0]?.id || '');

  // Quick customer registration & walk-in guest phone state
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [walkInPhone, setWalkInPhone] = useState(order.customerPhone || '');
  const [qrZoomed, setQrZoomed] = useState(false);
  const [mobileStep, setMobileStep] = useState<'present_bill' | 'record_payment'>('present_bill');

  // Full multi-channel Split details (paisa-exact initialization)
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>(() => {
    const halfCash = Math.floor((order.grandTotal / 2) * 100) / 100;
    const restFonepay = Math.round((order.grandTotal - halfCash) * 100) / 100;
    return {
      cash: halfCash,
      fonepay: restFonepay,
      card: 0,
      esewa: 0,
      khalti: 0,
      bank: 0,
      credit: 0
    };
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedOccupiedRoom = occupiedRooms.find((r) => r.id === selectedRoomId);

  const activePayableAmount =
    paymentMode === 'due' ? 0 : paymentMode === 'partial' ? partialPaidAmount : order.grandTotal;
  const changeDue =
    selectedMethod === 'cash' && paymentMode !== 'due'
      ? Math.max(0, Math.round((cashTendered - activePayableAmount) * 100) / 100)
      : 0;

  // Split totals
  const splitEnteredTotal = useMemo(() => {
    const raw =
      (Number(splitAmounts.cash) || 0) +
      (Number(splitAmounts.fonepay) || 0) +
      (Number(splitAmounts.card) || 0) +
      (Number(splitAmounts.esewa) || 0) +
      (Number(splitAmounts.khalti) || 0) +
      (Number(splitAmounts.bank) || 0) +
      (Number(splitAmounts.credit) || 0);
    return Math.round(raw * 100) / 100;
  }, [splitAmounts]);

  const splitRemaining = Math.round((order.grandTotal - splitEnteredTotal) * 100) / 100;
  const splitCreditAmount = Number(splitAmounts.credit) || 0;

  const isMethodEnabled = (methodType: string) => {
    if (!settings.paymentMethodsConfig || settings.paymentMethodsConfig.length === 0) return true;
    const found = settings.paymentMethodsConfig.find(
      (p) =>
        p.type === methodType ||
        (methodType === 'fonepay_qr' && (p.type === 'custom' || p.id.includes('fonepay'))) ||
        (methodType === 'bank_transfer' &&
          (p.type === 'bank_transfer' || p.type === 'custom' || p.id.includes('bank')))
    );
    return found ? found.enabled : true;
  };

  const activeChannelConfig = useMemo(() => {
    if (!settings.paymentMethodsConfig) return undefined;
    return settings.paymentMethodsConfig.find(
      (p) =>
        p.type === selectedMethod ||
        (selectedMethod === 'fonepay_qr' && (p.type === 'fonepay_qr' || p.id.includes('fonepay'))) ||
        (selectedMethod === 'bank' && (p.type === 'bank_transfer' || p.id.includes('bank')))
    );
  }, [settings.paymentMethodsConfig, selectedMethod]);

  const configuredQrMethods = useMemo(() => {
    if (!settings.paymentMethodsConfig) return [];
    return settings.paymentMethodsConfig
      .filter((p) => p.enabled && sanitizePaymentQrDataUrl(p.qrImageDataUrl))
      .map((p) => ({
        ...p,
        safeQr: sanitizePaymentQrDataUrl(p.qrImageDataUrl)!
      }));
  }, [settings.paymentMethodsConfig]);

  const handleFillSplitChannel = (channelKey: string) => {
    const othersSum = SPLIT_CHANNELS.reduce((sum, ch) => {
      if (ch.key === channelKey) return sum;
      return sum + (Number(splitAmounts[ch.key]) || 0);
    }, 0);
    const needed = Math.max(0, Math.round((order.grandTotal - othersSum) * 100) / 100);
    setSplitAmounts((prev) => ({ ...prev, [channelKey]: needed }));
  };

  const handleClearSplitChannels = () => {
    setSplitAmounts({
      cash: 0,
      fonepay: 0,
      card: 0,
      esewa: 0,
      khalti: 0,
      bank: 0,
      credit: 0
    });
  };

  const handleSettle = () => {
    setValidationError(null);
    let custId: string | undefined = selectedCustomerId || undefined;
    let custName = selectedCustomer?.name;
    let custPhone = selectedCustomer?.phone;
    let roomChargeDetails:
      | { resortRoomId: string; roomNumber: string; guestName: string; reservationId: string }
      | undefined = undefined;

    if (newCustName.trim()) {
      custName = newCustName.trim();
      custPhone = newCustPhone.trim();
    } else if (!custId && walkInPhone.trim()) {
      custPhone = walkInPhone.trim();
    }

    if (selectedMethod === 'charge_to_room') {
      if (!selectedOccupiedRoom || !selectedOccupiedRoom.currentReservationId) {
        setValidationError(
          lang === 'ne'
            ? 'कृपया कोठा चार्ज गर्नको लागि अतिथि बसेको कोठा छान्नुहोस्।'
            : 'Please select an occupied room with an in-house guest to charge.'
        );
        return;
      }
      roomChargeDetails = {
        resortRoomId: selectedOccupiedRoom.id,
        roomNumber: selectedOccupiedRoom.roomNumber,
        guestName: selectedOccupiedRoom.currentGuestName || 'Resort Guest',
        reservationId: selectedOccupiedRoom.currentReservationId
      };
      custId = undefined;
      custName = selectedOccupiedRoom.currentGuestName;
    }

    const requiresCustomer =
      selectedMethod === 'credit_khata' ||
      paymentMode === 'due' ||
      paymentMode === 'partial' ||
      (selectedMethod === 'split' && splitCreditAmount > 0);

    if (requiresCustomer && !custId && !custName && selectedMethod !== 'charge_to_room') {
      setValidationError(
        lang === 'ne'
          ? 'कृपया बाँकी/उधारो रकमको लागि ग्राहक छान्नुहोस् वा नयाँ नाम लेख्नुहोस्।'
          : 'Please select or enter a customer name for Khata / credit balance.'
      );
      return;
    }

    let finalPaidAmount = 0;
    let finalDueAmount = 0;
    let paymentDetails: Record<string, number> = {};

    if (selectedMethod === 'charge_to_room') {
      finalPaidAmount = order.grandTotal;
      finalDueAmount = 0;
      paymentDetails = { charge_to_room: order.grandTotal };
    } else if (paymentMode === 'due') {
      finalPaidAmount = 0;
      finalDueAmount = order.grandTotal;
      paymentDetails = { credit: order.grandTotal };
    } else if (paymentMode === 'partial') {
      if (partialPaidAmount <= 0 || partialPaidAmount >= order.grandTotal) {
        setValidationError(
          'Partial payment amount must be greater than 0 and less than the grand total.'
        );
        return;
      }
      if (selectedMethod === 'cash' && cashTendered < partialPaidAmount) {
        setValidationError('Cash tendered cannot be less than the partial amount being paid.');
        return;
      }
      finalPaidAmount = Math.round(partialPaidAmount * 100) / 100;
      finalDueAmount = Math.round((order.grandTotal - partialPaidAmount) * 100) / 100;
      const key =
        selectedMethod === 'fonepay_qr'
          ? 'fonepay'
          : selectedMethod === 'credit_khata'
          ? 'credit'
          : selectedMethod === 'split'
          ? 'cash'
          : selectedMethod;
      paymentDetails = {
        [key]: finalPaidAmount,
        credit: finalDueAmount
      };
    } else if (selectedMethod === 'split') {
      const splitPayload: SplitPaymentDetails = {
        cash: Number(splitAmounts.cash) || 0,
        fonepay: Number(splitAmounts.fonepay) || 0,
        card: Number(splitAmounts.card) || 0,
        esewa: Number(splitAmounts.esewa) || 0,
        khalti: Number(splitAmounts.khalti) || 0,
        bank: Number(splitAmounts.bank) || 0,
        credit: Number(splitAmounts.credit) || 0
      };
      const check = validatePaymentSettlement(
        'split',
        splitPayload,
        order.grandTotal,
        custId,
        selectedOccupiedRoom?.id
      );
      if (!check.isValid) {
        setValidationError(check.error || 'Invalid split payment totals.');
        return;
      }
      paymentDetails = splitPayload as Record<string, number>;
      finalDueAmount = Math.round((Number(splitAmounts.credit) || 0) * 100) / 100;
      finalPaidAmount = Math.round((order.grandTotal - finalDueAmount) * 100) / 100;
    } else {
      // Single-channel full payment
      if (selectedMethod === 'cash' && cashTendered < order.grandTotal) {
        setValidationError('Cash tendered cannot be less than the bill total.');
        return;
      }
      const key =
        selectedMethod === 'fonepay_qr'
          ? 'fonepay'
          : selectedMethod === 'credit_khata'
          ? 'credit'
          : selectedMethod;
      paymentDetails = { [key]: order.grandTotal };
      if (selectedMethod === 'credit_khata') {
        finalPaidAmount = 0;
        finalDueAmount = order.grandTotal;
      } else {
        finalPaidAmount = order.grandTotal;
        finalDueAmount = 0;
      }
    }

    const effectiveMethod: PaymentMethod =
      paymentMode === 'due' ? 'credit_khata' : selectedMethod;

    const checkFinal = validatePaymentSettlement(
      effectiveMethod,
      effectiveMethod === 'split' ? (paymentDetails as SplitPaymentDetails) : order.grandTotal,
      order.grandTotal,
      custId,
      selectedOccupiedRoom?.id
    );
    if (!checkFinal.isValid) {
      setValidationError(checkFinal.error || 'Settlement validation failed.');
      return;
    }

    const cleanCashTendered =
      effectiveMethod === 'cash' && paymentMode !== 'due'
        ? Math.max(activePayableAmount, Number(cashTendered) || activePayableAmount)
        : undefined;

    const paymentRecord: PaymentRecord = {
      id: 'pay-' + Date.now(),
      orderId: order.id,
      amount: finalPaidAmount,
      method: effectiveMethod,
      dateTime: nowIsoString(),
      staffId: currentSession?.staffId || 'staff-current',
      staffName: currentSession?.name || 'Counter Cashier',
      status: finalDueAmount === 0 ? 'completed' : finalPaidAmount > 0 ? 'partial' : 'due',
      referenceNo: paymentReference.trim() || undefined,
      cashTendered: cleanCashTendered,
      changeReturned: cleanCashTendered !== undefined ? changeDue : undefined,
      notes:
        effectiveMethod === 'charge_to_room'
          ? `Charged to Room ${selectedOccupiedRoom?.roomNumber} (${selectedOccupiedRoom?.currentGuestName})`
          : paymentMode === 'partial'
          ? `Partial payment with Rs. ${finalDueAmount.toFixed(2)} due`
          : undefined
    };

    onConfirmSettlement(
      effectiveMethod,
      paymentDetails,
      custId,
      custName,
      custPhone,
      finalPaidAmount,
      finalDueAmount,
      paymentRecord,
      roomChargeDetails
    );
  };

  const persistQuickNotes = (nextNotes: number[]) => {
    const saved = saveQuickCashNotes(nextNotes, settings.businessId);
    setConfiguredQuickNotes(saved);
    const canSyncBusinessSettings =
      currentSession?.role === 'OWNER' ||
      currentSession?.role === 'SUPER_ADMIN' ||
      currentSession?.role === 'ADMIN' ||
      currentSession?.role === 'MANAGER' ||
      (currentSession?.role
        ? hasPermission(currentSession.role, 'MANAGE_PAYMENT_METHODS', undefined, settings.customRolePermissions)
        : false);
    if (onUpdateSettings && canSyncBusinessSettings) {
      onUpdateSettings({ ...settings, quickCashNotes: saved });
    }
  };

  const handleAddCustomQuickNote = () => {
    setQuickNoteError(null);
    const res = addCustomQuickCashNote(configuredQuickNotes, customQuickNoteInput);
    if (res.error) {
      setQuickNoteError(res.error);
      return;
    }
    persistQuickNotes(res.notes);
    setCustomQuickNoteInput('');
  };

  const handleRemoveQuickNote = (amount: number) => {
    setQuickNoteError(null);
    persistQuickNotes(removeQuickCashNote(configuredQuickNotes, amount));
  };

  const handleResetDefaultQuickNotes = () => {
    setQuickNoteError(null);
    persistQuickNotes([...DEFAULT_QUICK_CASH_NOTES]);
  };

  const exactPayable = Math.round(activePayableAmount * 100) / 100;
  const quickCashAmounts = buildQuickCashOptionsForPayable(exactPayable, configuredQuickNotes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {lang === 'ne' ? 'बिल प्रस्तुति तथा भुक्तानी' : 'Present Bill & Record Payment'}
            </h3>
            <p className="text-xs text-slate-500 font-mono-num tabular-nums">
              {order.tableRoomName} · {order.invoiceNo}
              {order.parentSplitOrderId ? ' · SPLIT BILL' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Two-Step Switcher: Present Bill & QR vs Record Payment */}
        <div className="md:hidden px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobileStep('present_bill')}
            className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mobileStep === 'present_bill'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>{lang === 'ne' ? '१. बिल र QR' : '1. Bill & QR'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileStep('record_payment')}
            className={`flex-1 min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mobileStep === 'record_payment'
                ? 'bg-emerald-700 text-white'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <Banknote className="h-3.5 w-3.5" />
            <span>{lang === 'ne' ? '२. भुक्तानी लिनुहोस्' : '2. Record Pay'}</span>
          </button>
        </div>

        {/* Two-Column POS Checkout Workspace */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* LEFT 7 COLS: Payment Type + Channel Selector + Channel Inputs */}
          <div className={`md:col-span-7 space-y-4 ${mobileStep === 'record_payment' ? 'block' : 'hidden md:block'}`}>
            {/* Always-visible Total Payable Header (crucial on mobile Step 2 where summary column is hidden) */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                  {paymentMode === 'partial'
                    ? lang === 'ne'
                      ? 'अहिले तिर्ने रकम'
                      : 'Paying Now'
                    : paymentMode === 'due'
                    ? lang === 'ne'
                      ? 'उधारो जम्मा रकम'
                      : 'Khata Due Total'
                    : lang === 'ne'
                    ? 'तिर्नुपर्ने कुल रकम (Bill Total)'
                    : 'Bill Total'}
                </p>
                <p className="text-[11px] text-emerald-700 font-mono-num tabular-nums">
                  {order.tableRoomName} · {order.items.reduce((s, i) => s + i.quantity, 0)} {lang === 'ne' ? 'वटा' : 'items'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black font-mono-num text-emerald-900 tabular-nums">
                  {settings.currencySymbol} {(paymentMode === 'due' ? order.grandTotal : activePayableAmount).toFixed(2)}
                </p>
                {paymentMode === 'partial' && (
                  <p className="text-[10px] font-mono-num text-emerald-800">
                    Total {settings.currencySymbol} {order.grandTotal.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Payment Type Segmented Switch */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {lang === 'ne' ? 'भुक्तानीको प्रकार:' : 'Settlement Mode'}
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('full');
                    setCashTendered(Math.round(order.grandTotal * 100) / 100);
                  }}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    paymentMode === 'full'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Full Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('partial');
                    if (selectedMethod === 'split' || selectedMethod === 'credit_khata') {
                      setSelectedMethod('cash');
                    }
                    setCashTendered(Math.round(partialPaidAmount * 100) / 100);
                  }}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    paymentMode === 'partial'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Partial + Due
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMode('due');
                    setSelectedMethod('credit_khata');
                  }}
                  className={`p-2 rounded-lg border text-center transition-colors ${
                    paymentMode === 'due'
                      ? 'bg-rose-700 text-white border-rose-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Full Khata Due
                </button>
              </div>
            </div>

            {/* Partial payment input */}
            {paymentMode === 'partial' && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-amber-900">
                  <span>Paying Now</span>
                  <span>Remaining as Khata Due</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberInput
                    min={1}
                    max={Math.max(1, order.grandTotal - 0.01)}
                    blankWhenZero
                    value={partialPaidAmount}
                    onValueChange={(val) => {
                      setPartialPaidAmount(val);
                      setCashTendered(Math.round(val * 100) / 100);
                    }}
                    className="px-3 py-1.5 bg-white border border-amber-300 rounded font-bold font-mono-num"
                  />
                  <div className="px-3 py-1.5 bg-white border border-amber-200 rounded font-bold font-mono-num text-rose-700 flex items-center justify-end">
                    {settings.currencySymbol} {Math.max(0, order.grandTotal - partialPaidAmount).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Channel Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800">
                  {lang === 'ne' ? 'भुक्तानी माध्यम छान्नुहोस्:' : 'Payment Channel'}
                </label>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">
                  {selectedMethod.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* 1. Cash */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('cash');
                    if (paymentMode === 'due') setPaymentMode('full');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'cash'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {selectedMethod === 'cash' && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <Banknote className={`h-4 w-4 mb-1 ${selectedMethod === 'cash' ? 'text-white' : 'text-emerald-700'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">Cash</span>
                </button>

                {/* 2. Fonepay / QR */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('fonepay_qr');
                    if (paymentMode === 'due') setPaymentMode('full');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'fonepay_qr' || selectedMethod === 'qr'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {(selectedMethod === 'fonepay_qr' || selectedMethod === 'qr') && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <QrCode className={`h-4 w-4 mb-1 ${selectedMethod === 'fonepay_qr' || selectedMethod === 'qr' ? 'text-white' : 'text-red-600'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">Fonepay QR</span>
                </button>

                {/* 3. Card / POS */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('card');
                    if (paymentMode === 'due') setPaymentMode('full');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'card'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {selectedMethod === 'card' && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <CreditCard className={`h-4 w-4 mb-1 ${selectedMethod === 'card' ? 'text-white' : 'text-blue-600'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">Card</span>
                </button>

                {/* 4. eSewa */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('esewa');
                    if (paymentMode === 'due') setPaymentMode('full');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'esewa'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {selectedMethod === 'esewa' && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <Wallet className={`h-4 w-4 mb-1 ${selectedMethod === 'esewa' ? 'text-white' : 'text-emerald-600'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">eSewa</span>
                </button>

                {/* 5. Khalti */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('khalti');
                    if (paymentMode === 'due') setPaymentMode('full');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'khalti'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {selectedMethod === 'khalti' && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <Smartphone className={`h-4 w-4 mb-1 ${selectedMethod === 'khalti' ? 'text-white' : 'text-purple-600'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">Khalti</span>
                </button>

                {/* 6. Bank Transfer */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('bank');
                    if (paymentMode === 'due') setPaymentMode('full');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'bank'
                      ? 'bg-cyan-700 text-white border-cyan-700'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {selectedMethod === 'bank' && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <Building className={`h-4 w-4 mb-1 ${selectedMethod === 'bank' ? 'text-white' : 'text-cyan-700'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">Bank</span>
                </button>

                {/* 7. Khata / Credit */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('credit_khata');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'credit_khata'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {selectedMethod === 'credit_khata' && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <BookOpen className={`h-4 w-4 mb-1 ${selectedMethod === 'credit_khata' ? 'text-white' : 'text-amber-700'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">Khata Due</span>
                </button>

                {/* 8. Split Pay */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('split');
                    setPaymentMode('full');
                  }}
                  className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                    selectedMethod === 'split'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  {selectedMethod === 'split' && (
                    <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                  )}
                  <Split className={`h-4 w-4 mb-1 ${selectedMethod === 'split' ? 'text-white' : 'text-indigo-600'}`} />
                  <span className="text-xs font-bold whitespace-nowrap">Split Pay</span>
                </button>

                {/* 9. Charge to Room */}
                {(occupiedRooms.length > 0 || isMethodEnabled('charge_to_room')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMethod('charge_to_room');
                      setPaymentMode('full');
                    }}
                    className={`relative min-h-[54px] flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-colors cursor-pointer ${
                      selectedMethod === 'charge_to_room'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    {selectedMethod === 'charge_to_room' && (
                      <Check className="h-3.5 w-3.5 absolute top-1.5 right-1.5 stroke-[3]" />
                    )}
                    <Hotel className={`h-4 w-4 mb-1 ${selectedMethod === 'charge_to_room' ? 'text-white' : 'text-slate-700'}`} />
                    <span className="text-xs font-bold whitespace-nowrap">Room Folio</span>
                  </button>
                )}
              </div>
            </div>

            {/* MULTI-CHANNEL SPLIT PAYMENT PANEL (FIXED & COMPLETE) */}
            {selectedMethod === 'split' && paymentMode === 'full' && (
              <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-indigo-200/80 pb-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {lang === 'ne' ? 'मिश्रित भुक्तानी बाँडफाँड (Multi-Channel Split)' : 'Multi-Channel Split Breakdown'}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {lang === 'ne'
                        ? 'रकम भर्नुहोस् वा "Fill" थिचेर बाँकी रकम सिधै मिलाउनुहोस्।'
                        : 'Enter amounts per method or tap Fill to auto-balance exact paisa.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSplitChannels}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline"
                  >
                    Zero All
                  </button>
                </div>

                <div className="space-y-1.5">
                  {SPLIT_CHANNELS.map((ch) => (
                    <div key={ch.key} className="grid grid-cols-12 items-center gap-2 text-xs">
                      <span className={`col-span-5 font-semibold truncate ${ch.accent}`}>
                        {ch.label}
                      </span>
                      <div className="col-span-5 relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                          {settings.currencySymbol}
                        </span>
                        <NumberInput
                          min={0}
                          blankWhenZero
                          value={splitAmounts[ch.key]}
                          onValueChange={(val) => {
                            const safeVal = Math.max(0, val);
                            setSplitAmounts((prev) => ({ ...prev, [ch.key]: safeVal }));
                          }}
                          className="w-full pl-7 pr-2 py-1 bg-white border border-slate-300 rounded font-mono-num font-bold text-slate-900 text-right text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFillSplitChannel(ch.key)}
                        className="col-span-2 py-1 px-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[10px] font-bold text-slate-700"
                      >
                        Fill
                      </button>
                    </div>
                  ))}
                </div>

                {/* Live Reconciliation Status */}
                <div
                  className={`p-2.5 rounded-md border flex items-center justify-between text-xs font-mono-num ${
                    Math.abs(splitRemaining) <= 0.01
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <span className="font-sans font-bold">
                    {Math.abs(splitRemaining) <= 0.01
                      ? 'Balanced Exactly'
                      : splitRemaining > 0
                      ? 'Remaining Balance'
                      : 'Excess Amount'}
                  </span>
                  <span className="font-black">
                    {Math.abs(splitRemaining) <= 0.01
                      ? `${settings.currencySymbol} ${splitEnteredTotal.toFixed(2)}`
                      : `${splitRemaining > 0 ? '+' : '-'}${settings.currencySymbol} ${Math.abs(splitRemaining).toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}

            {/* Cash Tender & Collapsible Quick Notes */}
            {selectedMethod === 'cash' && paymentMode !== 'due' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block">
                      {lang === 'ne' ? 'प्राप्त नगद (Cash Tendered)' : 'Cash Tendered'}
                    </label>
                    {Math.abs(cashTendered - exactPayable) > 0.005 && (
                      <button
                        type="button"
                        onClick={() => setCashTendered(exactPayable)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline mt-0.5"
                      >
                        {lang === 'ne'
                          ? `ठिक्क रकम (${settings.currencySymbol}${exactPayable.toFixed(2)})`
                          : `Reset Exact (${settings.currencySymbol}${exactPayable.toFixed(2)})`}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-slate-500 font-semibold">{settings.currencySymbol}</span>
                    <NumberInput
                      min={0}
                      blankWhenZero
                      value={cashTendered}
                      onFocus={(e) => e.target.select()}
                      onValueChange={(val) => setCashTendered(Math.max(0, val))}
                      className="w-32 px-2.5 py-1.5 text-right font-mono-num font-bold text-slate-900 bg-white border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Collapsible Quick Cash Notes Drawer (closed by default to prevent accidental taps) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowQuickCashNotes((prev) => !prev)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
                  >
                    <span>
                      {lang === 'ne'
                        ? 'छिटो नोट रकमहरू (Quick Cash Notes)'
                        : 'Quick Cash Notes'}
                    </span>
                    {showQuickCashNotes ? (
                      <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                    )}
                  </button>

                  {showQuickCashNotes && (
                    <div className="mt-2 p-2.5 bg-white border border-slate-200 rounded-lg space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {editingQuickNotes
                            ? lang === 'ne'
                              ? 'आफ्नै रकम थप्नुहोस् वा हटाउनुहोस्'
                              : 'Add or remove custom amounts'
                            : lang === 'ne'
                            ? 'नोट छान्नुहोस् वा रकम थप्नुहोस्'
                            : 'Tap a note or customize'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQuickNotes((prev) => !prev);
                            setQuickNoteError(null);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold border transition-colors ${
                            editingQuickNotes
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {editingQuickNotes ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>{lang === 'ne' ? 'सकियो' : 'Done'}</span>
                            </>
                          ) : (
                            <>
                              <Pencil className="h-3 w-3" />
                              <span>{lang === 'ne' ? 'रकम मिलाउनुहोस्' : 'Edit Notes'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Selectable Quick Cash Chips (or All Configured Chips in Edit Mode) */}
                      {editingQuickNotes ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {configuredQuickNotes.length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">
                                {lang === 'ne' ? 'कुनै नोट राखिएको छैन — तल रकम थप्नुहोस्।' : 'No saved notes yet — add an amount below.'}
                              </span>
                            ) : (
                              configuredQuickNotes.map((amt) => (
                                <span
                                  key={amt}
                                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs font-mono-num font-semibold rounded-lg border bg-slate-50 border-slate-300 text-slate-800"
                                >
                                  <span>{settings.currencySymbol}{amt}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveQuickNote(amt)}
                                    className="p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    aria-label={`Remove ${amt}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                                {settings.currencySymbol}
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder={lang === 'ne' ? 'नयाँ रकम (उदा: 750)' : 'Custom amount (e.g. 750)'}
                                value={customQuickNoteInput}
                                onChange={(e) => {
                                  setCustomQuickNoteInput(sanitizeNumericDraft(e.target.value, { allowDecimal: false }));
                                  if (quickNoteError) setQuickNoteError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomQuickNote();
                                  }
                                }}
                                className="w-full pl-9 pr-2.5 py-1.5 text-xs font-mono-num font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddCustomQuickNote}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>{lang === 'ne' ? 'थप्नुहोस्' : 'Add'}</span>
                            </button>
                          </div>

                          {quickNoteError && (
                            <p className="text-[11px] font-semibold text-rose-600">{quickNoteError}</p>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={handleResetDefaultQuickNotes}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>{lang === 'ne' ? 'डिफल्ट राख्नुहोस्' : 'Reset Defaults'}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {quickCashAmounts.map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => {
                                  setCashTendered(amt);
                                  setShowQuickCashNotes(false);
                                }}
                                className={`px-2.5 py-1.5 text-xs font-mono-num font-semibold rounded-lg border transition-colors ${
                                  Math.abs(cashTendered - amt) < 0.01
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                {amt === exactPayable
                                  ? `Exact (${settings.currencySymbol}${amt % 1 === 0 ? amt : amt.toFixed(2)})`
                                  : `${settings.currencySymbol}${amt}`}
                              </button>
                            ))}
                          </div>
                          {/* Direct quick-add input even without switching mode */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                            <div className="relative flex-1">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                                {settings.currencySymbol}
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                placeholder={lang === 'ne' ? 'आफ्नै नोट रकम राख्नुहोस्...' : 'Add custom note amount...'}
                                value={customQuickNoteInput}
                                onChange={(e) => {
                                  setCustomQuickNoteInput(sanitizeNumericDraft(e.target.value, { allowDecimal: false }));
                                  if (quickNoteError) setQuickNoteError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomQuickNote();
                                  }
                                }}
                                className="w-full pl-9 pr-2.5 py-1.5 text-xs font-mono-num font-semibold text-slate-900 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddCustomQuickNote}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shrink-0"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>{lang === 'ne' ? 'थप' : 'Add'}</span>
                            </button>
                          </div>
                          {quickNoteError && (
                            <p className="text-[11px] font-semibold text-rose-600">{quickNoteError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-600">
                    {lang === 'ne' ? 'फिर्ता दिनुपर्ने (Change Return):' : 'Change Return'}
                  </span>
                  <div className="text-right">
                    <span className={`font-mono-num font-bold text-sm ${changeDue > 0 ? 'text-amber-800' : 'text-slate-800'}`}>
                      {settings.currencySymbol} {changeDue.toFixed(2)}
                    </span>
                    {changeDue > 0 && Math.round(changeDue * 100) % 100 !== 0 && (
                      <span className="block text-[10px] font-mono-num text-slate-500">
                        (~ {settings.currencySymbol} {Math.round(changeDue)} whole Rs)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Digital / Card / Bank Details + Scan-to-Pay QR + Reference No */}
            {(selectedMethod === 'esewa' ||
              selectedMethod === 'khalti' ||
              selectedMethod === 'fonepay_qr' ||
              selectedMethod === 'qr' ||
              selectedMethod === 'card' ||
              selectedMethod === 'bank') && (() => {
              const channelQrDataUrl = sanitizePaymentQrDataUrl(activeChannelConfig?.qrImageDataUrl);
              const isQrCapableMethod = selectedMethod !== 'card';
              return (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 uppercase tracking-wide">
                        {activeChannelConfig?.name || selectedMethod.replace(/_/g, ' ')} Collection
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {activeChannelConfig?.accountDetails ||
                          settings.fonepayMerchantName ||
                          settings.businessName}
                        {settings.panVatNumber ? ` · PAN ${settings.panVatNumber}` : ''}
                      </p>
                    </div>
                    <span className="font-mono-num font-black text-sm text-emerald-800 shrink-0">
                      {settings.currencySymbol} {activePayableAmount.toFixed(2)}
                    </span>
                  </div>

                  {isQrCapableMethod && (
                    channelQrDataUrl ? (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setQrZoomed(!qrZoomed)}
                          title={qrZoomed ? 'Shrink QR' : 'Enlarge QR for customer scanning'}
                          className="bg-white border border-slate-300 rounded-xl p-1.5 shrink-0 hover:border-emerald-500 transition-colors cursor-pointer"
                        >
                          <img
                            src={channelQrDataUrl}
                            alt={`${selectedMethod} Scan to Pay QR`}
                            referrerPolicy="no-referrer"
                            className={`object-contain rounded-lg transition-all ${
                              qrZoomed ? 'h-48 w-48' : 'h-24 w-24'
                            }`}
                          />
                        </button>
                        <div className="text-center sm:text-left space-y-1">
                          <p className="font-bold text-slate-900 text-xs">
                            {lang === 'ne' ? 'स्क्यान गरी भुक्तानी गर्नुहोस् (Scan to Pay)' : 'Scan to Pay'}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            {lang === 'ne'
                              ? 'ग्राहकलाई स्पष्ट देखाउन QR फोटोमा क्लिक गरी ठूलो पार्न सक्नुहुन्छ।'
                              : 'Tap the QR photo to enlarge across the counter for the guest.'}
                          </p>
                          <p className="font-mono-num font-bold text-emerald-800 text-xs">
                            {settings.currencySymbol} {activePayableAmount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>
                          {lang === 'ne'
                            ? 'यस माध्यमको QR फोटो अपलोड गरिएको छैन — Owner Suite → Payment Methods बाट अपलोड गर्नुहोस्।'
                            : 'No QR photo uploaded yet for this channel — Owner can upload it in Owner Suite → Payment Methods.'}
                        </span>
                      </div>
                    )
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {lang === 'ne'
                        ? 'ट्रान्जेक्सन / रिफरेन्स नं. (ऐच्छिक):'
                        : 'Transaction Ref / Approval Code (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. FP-98412 or Card Batch #14"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono-num"
                    />
                  </div>
                </div>
              );
            })()}

            {/* Charge to Room Selector */}
            {selectedMethod === 'charge_to_room' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <Hotel className="h-4 w-4 text-emerald-800" />
                  <span>
                    {lang === 'ne' ? 'अतिथि बसेको कोठा छान्नुहोस्:' : 'Select Occupied Room Folio'}
                  </span>
                </div>

                {occupiedRooms.length === 0 ? (
                  <p className="p-2.5 bg-white border border-amber-300 rounded text-amber-900">
                    No rooms are currently OCCUPIED. Check in a guest first in Resort Management.
                  </p>
                ) : (
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-emerald-400 rounded-lg font-bold text-xs text-emerald-950"
                  >
                    {occupiedRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.roomNumber} - {r.currentGuestName || 'In-House Guest'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Mobile Customer & Khata assignment (accessible directly in Step 2: Record Pay) */}
            <div className="md:hidden p-3.5 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Customer & Khata{' '}
                  {(selectedMethod === 'credit_khata' ||
                    paymentMode !== 'full' ||
                    (selectedMethod === 'split' && splitCreditAmount > 0)) && (
                    <span className="text-rose-600">*</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>{showNewCustomerForm ? 'Select Existing' : '+ Quick Add'}</span>
                </button>
              </div>
              {showNewCustomerForm ? (
                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    placeholder="Customer Full Name *"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded font-semibold"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Phone (98XXXXXXXX)"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded font-mono-num"
                  />
                </div>
              ) : (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                >
                  <option value="">-- Walk-in Guest --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) {c.creditBalance > 0 ? `• Due ${settings.currencySymbol}${c.creditBalance}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* RIGHT 5 COLS: Present Bill Summary + Scan-to-Pay QR + Customer + Staff Attribution */}
          <div className={`md:col-span-5 space-y-4 ${mobileStep === 'present_bill' ? 'block' : 'hidden md:block'}`}>
            {/* Clean Financial Summary & Itemized List */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {lang === 'ne' ? 'बिल विवरण' : 'Present Bill Summary'}
                </p>
                <span className="text-[11px] font-mono-num font-bold text-slate-600 tabular-nums">
                  {order.items.reduce((s, i) => s + i.quantity, 0)} {lang === 'ne' ? 'वटा' : 'items'}
                </span>
              </div>

              {/* Itemized Preview */}
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/70 bg-white rounded-lg border border-slate-200/80 px-2.5">
                {order.items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-900 truncate block">{item.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono-num tabular-nums">
                        {item.quantity} × {settings.currencySymbol}{item.price.toFixed(0)}
                      </span>
                    </div>
                    <span className="font-mono-num font-bold text-slate-900 shrink-0 tabular-nums">
                      {settings.currencySymbol}{(item.price * item.quantity).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{lang === 'ne' ? 'उप-जम्मा' : 'Subtotal'}</span>
                  <span className="font-mono-num font-semibold text-slate-900 tabular-nums">
                    {settings.currencySymbol} {order.subtotal.toFixed(2)}
                  </span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-700 font-medium">
                    <span>Discount ({(order.discountPercent || 0).toFixed(1)}%)</span>
                    <span className="font-mono-num tabular-nums">
                      -{settings.currencySymbol} {order.discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {order.serviceChargeAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Service Charge ({settings.serviceChargePercent}%)</span>
                    <span className="font-mono-num font-semibold text-slate-900 tabular-nums">
                      {settings.currencySymbol} {order.serviceChargeAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {order.vatAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({settings.vatRatePercent}%)</span>
                    <span className="font-mono-num font-semibold text-slate-900 tabular-nums">
                      {settings.currencySymbol} {order.vatAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2.5 border-t border-slate-200 flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase">Grand Total</span>
                <span className="text-2xl font-black font-mono-num text-emerald-800 tabular-nums">
                  {settings.currencySymbol} {order.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Instant Guest Scan-to-Pay QR Preview (Shown cleanly during Present Bill step) */}
            {configuredQrMethods.length > 0 && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-emerald-700" />
                  <span>{lang === 'ne' ? 'ग्राहकको लागि Scan to Pay QR' : 'Guest Scan-to-Pay QR'}</span>
                </p>
                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  {configuredQrMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMethod(
                          m.id.includes('fonepay')
                            ? 'fonepay_qr'
                            : m.id.includes('esewa')
                            ? 'esewa'
                            : m.id.includes('khalti')
                            ? 'khalti'
                            : 'bank'
                        );
                        setMobileStep('record_payment');
                      }}
                      className="shrink-0 p-2 rounded-lg border border-slate-200 hover:border-emerald-500 bg-slate-50 flex flex-col items-center gap-1 text-center transition-colors"
                    >
                      <img
                        src={m.safeQr}
                        alt={m.name}
                        referrerPolicy="no-referrer"
                        className="h-20 w-20 object-contain rounded bg-white border border-slate-200"
                      />
                      <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Customer / Khata Assignment */}
            <div className="p-3.5 bg-white rounded-lg border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Customer & Khata{' '}
                  {(selectedMethod === 'credit_khata' ||
                    paymentMode !== 'full' ||
                    (selectedMethod === 'split' && splitCreditAmount > 0)) && (
                    <span className="text-rose-600">*</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>{showNewCustomerForm ? 'Select Existing' : '+ Quick Add'}</span>
                </button>
              </div>

              {showNewCustomerForm ? (
                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    placeholder="Customer Full Name *"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-semibold"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Phone (98XXXXXXXX)"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono-num"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="">-- Walk-in Guest --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) {c.creditBalance > 0 ? `• Due ${settings.currencySymbol}${c.creditBalance}` : ''}
                      </option>
                    ))}
                  </select>
                  {!selectedCustomerId && (
                    <input
                      type="tel"
                      placeholder={
                        lang === 'ne'
                          ? 'अतिथि मोबाइल नं. (ऐच्छिक: 98XXXXXXXX)'
                          : 'Walk-in Guest Phone (Optional: 98XXXXXXXX)'
                      }
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-mono-num text-slate-800"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Cashier Attribution */}
            <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-slate-500">Cashier Terminal</span>
              <span className="font-bold text-slate-900 truncate max-w-[170px]">
                {currentSession?.name || 'Counter Cashier'}
              </span>
            </div>
          </div>
        </div>

        {/* Always-Visible Validation Error Banner */}
        {validationError && (
          <div className="mx-4 sm:mx-6 mb-3 flex items-start gap-2 p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs font-semibold shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>

          {mobileStep === 'present_bill' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileStep('record_payment')}
                className="md:hidden inline-flex items-center gap-1.5 min-h-[40px] px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors"
              >
                <span>{lang === 'ne' ? 'भुक्तानी लिनुहोस्' : 'Record Payment'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleSettle}
                className="hidden md:inline-flex items-center gap-2 min-h-[40px] px-6 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {lang === 'ne' ? 'भुक्तानी पुष्टि र रसिद प्रिन्ट' : 'Confirm & Print Bill'}
                </span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSettle}
              className="inline-flex items-center gap-2 min-h-[40px] px-6 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                {lang === 'ne' ? 'भुक्तानी पुष्टि र रसिद प्रिन्ट' : 'Confirm & Print Bill'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
