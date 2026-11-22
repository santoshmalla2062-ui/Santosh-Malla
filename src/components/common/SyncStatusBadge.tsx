import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers,
  ChevronDown
} from 'lucide-react';
import { 
  ConnectionStatusInfo, 
  subscribeConnectionStatus, 
  setSimulatedOffline, 
  isOfflineSimulated 
} from '../../services/syncService';
import { Language } from '../../utils/translations';

interface SyncStatusBadgeProps {
  businessId: string;
  lang: Language;
  onOpenSyncDetails?: () => void;
  onFlushQueue?: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  businessId,
  lang,
  onOpenSyncDetails,
  onFlushQueue
}) => {
  const [status, setStatus] = useState<ConnectionStatusInfo>({
    state: 'online',
    isOnline: true,
    isSimulatedOffline: false,
    lastSyncTime: null,
    pendingQueueCount: 0
  });
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeConnectionStatus(newStatus => {
      setStatus(newStatus);
    }, businessId);
    return () => unsubscribe();
  }, [businessId]);

  const toggleOfflineSimulation = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !status.isSimulatedOffline;
    setSimulatedOffline(nextState, businessId);
  };

  const getBadgeConfig = () => {
    switch (status.state) {
      case 'online':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100',
          dot: 'bg-emerald-500 animate-pulse',
          icon: <Wifi className="h-3.5 w-3.5 text-emerald-600" />,
          label: lang === 'ne' ? 'अनलाइन (प्रत्यक्ष सिंक)' : 'Live Sync Active',
          subtext: status.lastSyncTime ? `Last sync: ${status.lastSyncTime}` : 'All systems synchronized'
        };
      case 'connecting':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
          dot: 'bg-amber-500 animate-spin',
          icon: <RefreshCw className="h-3.5 w-3.5 text-amber-600 animate-spin" />,
          label: lang === 'ne' ? 'सिंक जोडिँदै...' : 'Connecting...',
          subtext: 'Reconnecting to data channel'
        };
      case 'offline':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100',
          dot: 'bg-rose-500',
          icon: <WifiOff className="h-3.5 w-3.5 text-rose-600" />,
          label: lang === 'ne' ? 'अफलाइन मोड' : 'Offline Mode',
          subtext: status.isSimulatedOffline ? 'Simulated offline for testing' : 'Network disconnected'
        };
      case 'sync_pending':
        return {
          bg: 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100',
          dot: 'bg-blue-500 animate-bounce',
          icon: <RefreshCw className="h-3.5 w-3.5 text-blue-600 animate-spin" />,
          label: lang === 'ne' ? `सिंक बाँकी (${status.pendingQueueCount})` : `Sync Pending (${status.pendingQueueCount})`,
          subtext: `${status.pendingQueueCount} safe draft operations queued`
        };
      case 'sync_failed':
        return {
          bg: 'bg-red-50 text-red-900 border-red-300 hover:bg-red-100',
          dot: 'bg-red-600',
          icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />,
          label: lang === 'ne' ? 'सिंक असफल' : 'Sync Conflict',
          subtext: status.errorMessage || 'Synchronization issue detected'
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-300',
          dot: 'bg-slate-400',
          icon: <Wifi className="h-3.5 w-3.5 text-slate-500" />,
          label: 'Status Active',
          subtext: ''
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setShowDropdown(prev => !prev)}
        title={`${config.label} — ${config.subtext}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all shadow-2xs ${config.bg}`}
      >
        <span className={`h-2 w-2 rounded-full ${config.dot}`} />
        {config.icon}
        <span className="hidden sm:inline">{config.label}</span>
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>

      {showDropdown && (
        <div 
          className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-slate-200 shadow-xl z-50 p-3 text-xs text-slate-700"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              {config.icon}
              <span>{config.label}</span>
            </div>
            <button
              onClick={() => setShowDropdown(false)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1"
            >
              ✕
            </button>
          </div>

          <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">
            {config.subtext}
          </p>

          {status.lastSyncTime && (
            <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-3 bg-slate-50 p-1.5 rounded-md border border-slate-200">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>Last confirmed sync: <strong className="font-mono text-slate-800">{status.lastSyncTime}</strong></span>
            </div>
          )}

          {status.pendingQueueCount > 0 && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] flex items-center justify-between">
              <span>{status.pendingQueueCount} local draft(s) awaiting flush</span>
              {onFlushQueue && status.isOnline && (
                <button
                  type="button"
                  onClick={() => {
                    onFlushQueue();
                    setShowDropdown(false);
                  }}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[10px]"
                >
                  Sync Now
                </button>
              )}
            </div>
          )}

          <div className="space-y-1.5 pt-1">
            <button
              type="button"
              onClick={toggleOfflineSimulation}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                status.isSimulatedOffline
                  ? 'bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{status.isSimulatedOffline ? 'Resume Online Mode' : 'Test Offline Mode'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                status.isSimulatedOffline ? 'bg-rose-200 text-rose-900' : 'bg-slate-200 text-slate-700'
              }`}>
                {status.isSimulatedOffline ? 'SIMULATING OFFLINE' : 'ONLINE'}
              </span>
            </button>

            {onOpenSyncDetails && (
              <button
                type="button"
                onClick={() => {
                  setShowDropdown(false);
                  onOpenSyncDetails();
                }}
                className="w-full text-center px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-[11px] font-bold transition-colors"
              >
                Open Synchronization Diagnostics
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
