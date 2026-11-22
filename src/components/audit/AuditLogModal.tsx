import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  History, 
  Search, 
  Download, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  UserCheck
} from 'lucide-react';
import { AuditLogEntry } from '../../types';
import { Language } from '../../utils/translations';

interface AuditLogModalProps {
  auditLogs: AuditLogEntry[];
  lang: Language;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  auditLogs,
  lang,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = 
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;
      return matchesSearch && matchesSeverity;
    });
  }, [auditLogs, searchQuery, selectedSeverity]);

  const exportAuditCSV = () => {
    const headers = ['Timestamp', 'Staff Name', 'Role', 'Action', 'Target Record', 'Severity', 'Details'];
    const rows = filteredLogs.map(l => [
      l.timestamp,
      `"${l.staffName.replace(/"/g, '""')}"`,
      l.role,
      l.action,
      l.targetRecordId || '',
      l.severity,
      `"${l.details.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `System_Security_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityBadge = (sev: 'INFO' | 'WARNING' | 'CRITICAL') => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'WARNING':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col animate-in fade-in duration-150">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <History className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {lang === 'ne' ? 'सुरक्षा तथा कारोबार अडिट लग (System Audit Trail)' : 'Security & System Audit Trail'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Immutable event record of staff logins, price modifications, settlements & voided orders
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
            >
              <option value="all">All Severities</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </select>

            <button
              onClick={exportAuditCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors shadow-2xs"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Audit Table */}
        <div className="overflow-y-auto flex-1 p-4">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Staff / Role</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Target ID</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 text-slate-500 font-mono-num whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-slate-900 block">{log.staffName}</span>
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">{log.role}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono-num font-bold text-slate-800">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getSeverityBadge(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono-num text-slate-600">
                    {log.targetRecordId || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLogs.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-xs">
              No audit records match your search filter.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-mono-num font-semibold">
            {filteredLogs.length} total security logs
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
