import React, { useState } from 'react';
import { 
  X, 
  Wrench, 
  AlertTriangle, 
  Check, 
  Clock, 
  CheckCircle, 
  ShieldAlert, 
  Plus 
} from 'lucide-react';
import { 
  MaintenanceIssue, 
  ResortRoom, 
  ResortRoomStatus, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';

interface MaintenanceModalProps {
  rooms: ResortRoom[];
  issues: MaintenanceIssue[];
  initialRoomId?: string;
  currentSession: Session | null;
  lang: Language;
  onReportIssue: (issue: Omit<MaintenanceIssue, 'id'>, setRoomStatus?: ResortRoomStatus) => void;
  onResolveIssue: (issueId: string, resolution: string, returnRoomStatus: ResortRoomStatus) => void;
  onClose: () => void;
}

export const MaintenanceModal: React.FC<MaintenanceModalProps> = ({
  rooms,
  issues,
  initialRoomId,
  currentSession,
  lang,
  onReportIssue,
  onResolveIssue,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'report' | 'active_issues'>('report');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || rooms[0]?.id || '');
  const [issueType, setIssueType] = useState<MaintenanceIssue['issueType']>('AC problem');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenanceIssue['priority']>('high');
  const [roomAction, setRoomAction] = useState<'MAINTENANCE' | 'OUT_OF_SERVICE' | 'keep'>('MAINTENANCE');

  // Resolving an issue
  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [returnStatus, setReturnStatus] = useState<ResortRoomStatus>('CLEANING');
  const [resolveError, setResolveError] = useState<string | null>(null);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !description.trim()) return;

    onReportIssue({
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.roomNumber,
      issueType,
      description: description.trim(),
      priority,
      reportedBy: currentSession?.name || 'Staff',
      reportedDate: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'reported'
    }, roomAction === 'keep' ? undefined : roomAction);

    setDescription('');
    setActiveTab('active_issues');
  };

  const handleResolveSubmit = (issue: MaintenanceIssue) => {
    if (!resolutionText.trim()) {
      setResolveError('Please enter a brief note explaining the resolution.');
      return;
    }

    setResolveError(null);
    onResolveIssue(issue.id, resolutionText.trim(), returnStatus);
    setResolvingIssueId(null);
    setResolutionText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">
                {lang === 'ne' ? 'कोठा मर्मत तथा प्राविधिक समस्या (Room Maintenance & Repairs)' : 'Room Maintenance & Repair Tickets'}
              </h3>
              <p className="text-slate-400 text-[11px]">Log electrical, AC, plumbing, or hardware issues</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('report')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'report' ? 'border-amber-600 text-amber-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Report New Issue
          </button>
          <button
            onClick={() => setActiveTab('active_issues')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'active_issues' ? 'border-amber-600 text-amber-900 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Active Tickets ({issues.filter(i => i.status !== 'closed' && i.status !== 'resolved').length})
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto text-xs">
          {activeTab === 'report' && (
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Room:</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} - {r.roomTypeName} (Status: {r.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Issue Category:</label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                  >
                    <option value="AC problem">Air Conditioning / Heating</option>
                    <option value="Plumbing problem">Plumbing / Water leak / Drain</option>
                    <option value="Electrical problem">Electrical / Lighting / Geyser</option>
                    <option value="Furniture problem">Furniture / Doors / Balcony</option>
                    <option value="Water problem">No Hot Water / Pressure</option>
                    <option value="Other">Other Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Priority Level:</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                  >
                    <option value="urgent">Urgent (Room Unusable)</option>
                    <option value="high">High (Affects Comfort)</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low (Minor defect)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Problem Description:</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the issue (e.g. Master bathroom sink drain clogged, leaking onto floor tiling)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <label className="block text-amber-900 font-bold">
                  Update Room Status During Repair:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-amber-200 cursor-pointer text-slate-800">
                    <input
                      type="radio"
                      name="roomAction"
                      checked={roomAction === 'MAINTENANCE'}
                      onChange={() => setRoomAction('MAINTENANCE')}
                    />
                    <span className="font-semibold text-[11px]">Set MAINTENANCE</span>
                  </label>

                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-amber-200 cursor-pointer text-slate-800">
                    <input
                      type="radio"
                      name="roomAction"
                      checked={roomAction === 'OUT_OF_SERVICE'}
                      onChange={() => setRoomAction('OUT_OF_SERVICE')}
                    />
                    <span className="font-semibold text-[11px]">OUT OF SERVICE</span>
                  </label>

                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-lg border border-amber-200 cursor-pointer text-slate-800">
                    <input
                      type="radio"
                      name="roomAction"
                      checked={roomAction === 'keep'}
                      onChange={() => setRoomAction('keep')}
                    />
                    <span className="font-semibold text-[11px]">Keep Current</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <Wrench className="h-4 w-4" />
                  Log Maintenance Ticket
                </button>
              </div>
            </form>
          )}

          {activeTab === 'active_issues' && (
            <div className="space-y-3">
              {issues.length === 0 ? (
                <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No maintenance tickets recorded.
                </div>
              ) : (
                issues.map((issue) => (
                  <div key={issue.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">Room {issue.roomNumber}</span>
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        issue.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                        issue.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {issue.status}
                      </span>
                    </div>

                    <p className="text-slate-800 font-medium text-xs">{issue.description}</p>
                    <p className="text-[10px] text-slate-400">
                      Reported by {issue.reportedBy} on {issue.reportedDate}
                    </p>

                    {issue.status === 'resolved' ? (
                      <div className="p-2 bg-emerald-50 rounded text-[11px] text-emerald-900 border border-emerald-200">
                        <strong>Resolution:</strong> {issue.resolution} (By {issue.completedBy} on {issue.completedDate})
                      </div>
                    ) : resolvingIssueId === issue.id ? (
                      <div className="p-3 bg-white border border-emerald-300 rounded-lg space-y-2 mt-2">
                        <h5 className="font-bold text-slate-900 text-xs">Complete Repair & Return Room</h5>
                        <input
                          type="text"
                          value={resolutionText}
                          onChange={(e) => {
                            setResolutionText(e.target.value);
                            if (resolveError) setResolveError(null);
                          }}
                          placeholder="Action taken (e.g. replaced rubber seal, cleaned air filter)"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs"
                          required
                        />
                        {resolveError && (
                          <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{resolveError}</span>
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-semibold text-slate-700">Return Room To:</span>
                          <select
                            value={returnStatus}
                            onChange={(e) => setReturnStatus(e.target.value as ResortRoomStatus)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded font-semibold text-slate-800"
                          >
                            <option value="CLEANING">CLEANING (Housekeeping turnaround)</option>
                            <option value="AVAILABLE">AVAILABLE (Immediate occupancy)</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setResolvingIssueId(null);
                              setResolveError(null);
                            }}
                            className="px-2.5 py-1 text-slate-500 font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveSubmit(issue)}
                            className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded font-bold"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            setResolvingIssueId(issue.id);
                            setResolutionText('');
                            setResolveError(null);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Resolve Issue
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
