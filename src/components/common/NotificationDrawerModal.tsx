import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChefHat,
  CreditCard,
  Hotel,
  Info,
  Package,
  ShieldAlert,
  X
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../../services/notificationService';
import { ActiveTab } from '../SidebarNavigation';
import { Language } from '../../utils/translations';

interface NotificationDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  lang: Language;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

export const NotificationDrawerModal: React.FC<NotificationDrawerModalProps> = ({
  isOpen,
  onClose,
  notifications,
  lang,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateTab
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const visibleList = useMemo(() => {
    if (filterMode === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterMode]);

  if (!isOpen) return null;

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'INVENTORY':
        return <Package className="h-4 w-4 text-amber-600" />;
      case 'KITCHEN':
        return <ChefHat className="h-4 w-4 text-orange-600" />;
      case 'RESERVATION':
      case 'HOUSEKEEPING':
        return <Hotel className="h-4 w-4 text-teal-600" />;
      case 'FINANCE':
        return <CreditCard className="h-4 w-4 text-emerald-600" />;
      case 'SECURITY':
        return <ShieldAlert className="h-4 w-4 text-rose-600" />;
      default:
        return <Info className="h-4 w-4 text-slate-600" />;
    }
  };

  const getSeverityBadge = (severity: AppNotification['severity']) => {
    switch (severity) {
      case 'alert':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'success':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-2xs flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center relative">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'सूचनाहरू (Notifications)' : 'Notifications & Alerts'}
              </h2>
              <p className="text-[11px] text-slate-500 tabular-nums">
                {unreadCount > 0
                  ? lang === 'ne'
                    ? `${unreadCount} नपढिएका सूचना`
                    : `${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}`
                  : lang === 'ne'
                  ? 'सबै सूचना पढिसकिएको छ'
                  : 'All caught up'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter & Mark All Bar */}
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              {lang === 'ne' ? `सबै (${notifications.length})` : `All (${notifications.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                filterMode === 'unread' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              {lang === 'ne' ? `नपढिएको (${unreadCount})` : `Unread (${unreadCount})`}
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors whitespace-nowrap"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>{lang === 'ne' ? 'सबै पढेको चिन्ह' : 'Mark all read'}</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {visibleList.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Bell className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {lang === 'ne' ? 'कुनै नयाँ सूचना छैन' : 'No notifications to show'}
              </p>
              <p className="text-xs text-slate-500">
                {lang === 'ne'
                  ? 'कम स्टक, भान्सा KOT, रद्दीकरण वा दिन अन्त्य अलर्टहरू यहाँ देखिनेछन्।'
                  : 'Low stock, ready kitchen KOTs, cancelled orders, and day-closing alerts appear here.'}
              </p>
            </div>
          ) : (
            visibleList.map((n) => (
              <div
                key={n.id}
                className={`p-4 transition-colors ${
                  n.isRead ? 'bg-white' : 'bg-slate-50/90'
                } hover:bg-slate-100/70`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    {n.severity === 'alert' ? (
                      <AlertTriangle className="h-4 w-4 text-rose-600" />
                    ) : (
                      getCategoryIcon(n.category)
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs leading-snug ${n.isRead ? 'font-semibold text-slate-700' : 'font-bold text-slate-950'}`}>
                        {n.title}
                      </p>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${getSeverityBadge(n.severity)}`}>
                        {n.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                    <div className="flex items-center justify-between gap-2 pt-1.5">
                      <span className="text-[10px] text-slate-400 tabular-nums">{n.timestamp}</span>
                      <div className="flex items-center gap-2">
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => onMarkAsRead(n.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded border border-slate-200 bg-white"
                          >
                            <Check className="h-3 w-3" />
                            <span>{lang === 'ne' ? 'पढेको' : 'Read'}</span>
                          </button>
                        )}
                        {n.targetTab && (
                          <button
                            type="button"
                            onClick={() => {
                              onMarkAsRead(n.id);
                              onNavigateTab(n.targetTab!);
                              onClose();
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                          >
                            {lang === 'ne' ? 'खोल्नुहोस् →' : 'Open →'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
