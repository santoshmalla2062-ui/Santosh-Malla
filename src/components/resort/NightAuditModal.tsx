import React, { useState } from 'react';
import { 
  X, 
  Moon, 
  CheckCircle, 
  AlertCircle, 
  DollarSign, 
  ShieldCheck, 
  BedDouble, 
  FileText, 
  TrendingUp, 
  Clock,
  AlertTriangle,
  History,
  ArrowRight
} from 'lucide-react';
import { 
  BusinessSettings, 
  GuestFolioItem, 
  HotelPaymentRecord, 
  NightAuditRecord, 
  NightAuditStatus, 
  Order, 
  Reservation, 
  ResortRoom, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';
import { prepareNightAudit, formatLocalYMD } from '../../services/resortSecurity';

interface NightAuditModalProps {
  rooms: ResortRoom[];
  reservations: Reservation[];
  folioItems: GuestFolioItem[];
  payments?: HotelPaymentRecord[];
  pastNightAudits?: NightAuditRecord[];
  businessId?: string;
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onPostDailyRoomCharges: (folioItems: Omit<GuestFolioItem, 'id'>[], auditNotes: string, auditRecord?: NightAuditRecord) => void;
  onClose: () => void;
}

export const NightAuditModal: React.FC<NightAuditModalProps> = ({
  rooms,
  reservations,
  folioItems,
  payments = [],
  pastNightAudits = [],
  businessId = 'biz-mugu-resort',
  settings,
  currentSession,
  lang,
  onPostDailyRoomCharges,
  onClose
}) => {
  const [selectedDate, setSelectedDate] = useState(() => formatLocalYMD());
  const [auditNotes, setAuditNotes] = useState('');
  const [auditStatus, setAuditStatus] = useState<NightAuditStatus>('OPEN');
  const [activeTab, setActiveTab] = useState<'run' | 'history'>('run');
  const [completedRecord, setCompletedRecord] = useState<NightAuditRecord | null>(null);

  // Compute pre-flight night audit data
  const prep = prepareNightAudit(
    selectedDate,
    businessId,
    rooms,
    reservations,
    folioItems,
    payments,
    pastNightAudits
  );

  const tonightRoomRevenue = prep.chargesToPost.reduce((sum, c) => sum + c.rate, 0);

  const handleRunNightAudit = () => {
    setAuditStatus('IN_PROGRESS');

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newFolioEntries: Omit<GuestFolioItem, 'id'>[] = prep.chargesToPost.map(charge => ({
      reservationId: charge.reservationId,
      roomId: charge.roomId,
      roomNumber: charge.roomNumber,
      dateTime: `${selectedDate} 23:59`,
      description: charge.description,
      category: 'ROOM',
      quantity: 1,
      unitPrice: charge.rate,
      totalPrice: charge.rate,
      addedByStaff: `${currentSession?.name || 'Night Auditor'} (Automated Night Audit)`
    }));

    const auditRecord: NightAuditRecord = {
      id: 'na-' + Date.now(),
      businessId,
      businessDate: selectedDate,
      startedBy: currentSession?.name || 'Night Auditor',
      startedAt: nowStr,
      completedAt: nowStr,
      status: 'COMPLETED',
      totalRoomsOccupied: prep.totalOccupied,
      totalRoomsSellable: prep.totalSellable,
      occupancyPercent: prep.occupancyPercent,
      totalRoomChargesPosted: tonightRoomRevenue,
      postedCount: prep.chargesToPost.length,
      postedFolioItemIds: [],
      warnings: prep.warnings,
      errors: prep.errors,
      transactionSummary: {
        roomRevenue: tonightRoomRevenue,
        fbRevenue: 0,
        serviceRevenue: 0,
        paymentsCollected: payments.filter(p => p.dateTime.startsWith(selectedDate)).reduce((s, p) => s + p.amount, 0),
        unpaidFolioCount: prep.unpaidFoliosCount,
        unpaidBalanceTotal: prep.totalUnpaidBalance,
        noShowCount: reservations.filter(r => r.status === 'NO_SHOW' && r.checkInDate === selectedDate).length
      },
      notes: auditNotes || `Night Audit completed for ${selectedDate}. Occupancy: ${prep.occupancyPercent}%. Posted ${prep.chargesToPost.length} room charges.`
    };

    onPostDailyRoomCharges(newFolioEntries, auditRecord.notes || '', auditRecord);
    setCompletedRecord(auditRecord);
    setAuditStatus('COMPLETED');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-950 border border-indigo-800">
              <Moon className="h-5 w-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">
                  {lang === 'ne' ? 'नाइट अडिट तथा दैनिक कोठा आम्दानी पोस्टिङ' : 'Night Audit & Daily Hospitality Closing'}
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wide ${
                  auditStatus === 'COMPLETED' ? 'bg-emerald-900 text-emerald-300' :
                  auditStatus === 'IN_PROGRESS' ? 'bg-amber-900 text-amber-300' :
                  'bg-indigo-900 text-indigo-300'
                }`}>
                  STATUS: {auditStatus}
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Business-scoped end-of-day room charges, folio balance audit, and occupancy reconciliation
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-tabs: Run Audit vs Audit History */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('run')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'run'
                ? 'border-indigo-600 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Moon className="h-3.5 w-3.5" /> Run Night Audit
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="h-3.5 w-3.5" /> Past Audit Runs ({pastNightAudits.length})
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {activeTab === 'history' ? (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 text-xs">Historical Night Audit Journal</h4>
              {pastNightAudits.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 italic">
                  No past Night Audit runs found in this business tenant partition.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {pastNightAudits.map((record) => (
                    <div key={record.id} className="p-3 bg-white hover:bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">Date: {record.businessDate}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded">
                            {record.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Auditor: {record.startedBy} · Completed: {record.completedAt}
                        </p>
                        <p className="text-[11px] text-slate-600 italic mt-0.5">
                          {record.notes}
                        </p>
                      </div>
                      <div className="text-right sm:border-l sm:pl-4 border-slate-100">
                        <span className="text-[10px] text-slate-400 block">Room Revenue Posted</span>
                        <span className="font-mono-num font-bold text-emerald-800 text-sm">
                          {settings.currencySymbol} {record.totalRoomChargesPosted.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Occupancy: {record.occupancyPercent}% ({record.totalRoomsOccupied} rms)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : auditStatus === 'COMPLETED' && completedRecord ? (
            <div className="p-6 text-center space-y-3 bg-emerald-50 rounded-xl border border-emerald-300 animate-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-emerald-800 text-white flex items-center justify-center mx-auto">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h4 className="text-base font-black text-emerald-950">
                Night Audit Successfully Executed!
              </h4>
              <p className="text-xs text-emerald-800 max-w-lg mx-auto">
                Posted daily room charges for <strong>{completedRecord.postedCount}</strong> occupied rooms totaling{' '}
                <strong className="font-mono-num">{settings.currencySymbol} {completedRecord.totalRoomChargesPosted.toFixed(2)}</strong> for business date <strong>{completedRecord.businessDate}</strong>.
                All guest folios, accounts receivable, and audit logs have been reconciled.
              </p>

              <div className="grid grid-cols-3 gap-2 max-w-md mx-auto pt-2 text-left">
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Occupancy</span>
                  <span className="font-bold text-slate-900 text-sm font-mono-num">{completedRecord.occupancyPercent}%</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Unpaid Folios</span>
                  <span className="font-bold text-slate-900 text-sm font-mono-num">{completedRecord.transactionSummary.unpaidFolioCount}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Unpaid Total</span>
                  <span className="font-bold text-amber-700 text-sm font-mono-num">
                    {settings.currencySymbol} {completedRecord.transactionSummary.unpaidBalanceTotal.toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs shadow-2xs"
                >
                  Close Audit Wizard
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Business Date Selection */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 block">Audit Business Date:</span>
                  <span className="text-[11px] text-slate-500">Posting room charges and closing books for this operational night</span>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                />
              </div>

              {/* Warnings / Idempotency Notice */}
              {prep.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                  {prep.warnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-amber-800 text-[11px]">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Audit Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Sellable Occupancy</span>
                  <p className="font-black text-slate-900 text-lg mt-0.5">{prep.occupancyPercent}%</p>
                  <p className="text-[10px] text-slate-400">{prep.totalOccupied} of {prep.totalSellable} sellable rooms</p>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase">Room Charges to Post</span>
                  <p className="font-black text-emerald-950 text-lg font-mono-num mt-0.5">
                    {settings.currencySymbol} {tonightRoomRevenue.toFixed(0)}
                  </p>
                  <p className="text-[10px] text-emerald-700">{prep.chargesToPost.length} rooms eligible</p>
                </div>

                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-800 uppercase">Already Charged</span>
                  <p className="font-black text-indigo-950 text-lg mt-0.5">{prep.alreadyChargedCount}</p>
                  <p className="text-[10px] text-indigo-700">Idempotent guard skipped</p>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-800 uppercase">Open Folios Due</span>
                  <p className="font-black text-amber-950 text-lg mt-0.5">
                    {settings.currencySymbol} {prep.totalUnpaidBalance.toFixed(0)}
                  </p>
                  <p className="text-[10px] text-amber-700">{prep.unpaidFoliosCount} unpaid folios</p>
                </div>
              </div>

              {/* Verification Checklist */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-500">
                  Night Audit Protocol & Security Verification
                </h4>
                <div className="space-y-1.5 text-slate-700 text-[11px]">
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0" />
                    Verify all arrivals for today have been checked in or marked as NO_SHOW.
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0" />
                    Ensure restaurant & cafe POS room charges have been synchronized to folios.
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0" />
                    Calculate and post nightly room charges exactly once (idempotent double-posting protection).
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0" />
                    Record immutable entry into security audit log under Auditor: <span className="font-mono-num font-bold">{currentSession?.name || 'Night Auditor'}</span>.
                  </p>
                </div>
              </div>

              {/* Charges to Post Table */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-2">
                  Rooms Pending Room Charge Posting for {selectedDate} ({prep.chargesToPost.length})
                </h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto">
                  {prep.chargesToPost.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 italic">
                      {prep.alreadyChargedCount > 0 
                        ? 'All checked-in rooms have already had room charges posted for this date. Idempotency guaranteed!' 
                        : 'No checked-in guests eligible for room charge posting on this date.'}
                    </div>
                  ) : (
                    prep.chargesToPost.map(charge => (
                      <div key={charge.reservationId} className="p-2.5 px-3 flex justify-between items-center text-xs hover:bg-slate-50">
                        <div>
                          <span className="font-bold text-slate-900">Room {charge.roomNumber}</span>
                          <span className="text-slate-500 ml-2">({charge.guestName})</span>
                          <p className="text-[10px] text-slate-400">{charge.description}</p>
                        </div>
                        <span className="font-mono-num font-black text-emerald-800">
                          +{settings.currencySymbol} {charge.rate.toFixed(2)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Auditor Shift Notes & Observations:</label>
                <textarea
                  rows={2}
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  placeholder="e.g. End of day reconciliation complete. All active folios reviewed. No cash discrepancies noted."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRunNightAudit}
                  disabled={prep.chargesToPost.length === 0 && prep.alreadyChargedCount === 0}
                  className="px-5 py-2 bg-indigo-950 hover:bg-black disabled:bg-slate-300 text-white font-bold rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <Moon className="h-4 w-4 text-indigo-300" />
                  {prep.chargesToPost.length === 0 
                    ? 'Audit Checked (Charges Already Posted)' 
                    : `Execute Night Audit (${prep.chargesToPost.length} Rooms)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
