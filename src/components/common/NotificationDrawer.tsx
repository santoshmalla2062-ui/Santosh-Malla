import React, { useState } from 'react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  Package,
  ChefHat,
  Calendar,
  Sparkles,
  Banknote,
  Shield,
  Layers,
  Filter
} from 'lucide-react';
import { AppNotification, NotificationCategory, saveStoredNotifications } from '../../services/notificationService';
import { ActiveTab } from '../Navigation';
import { Language } from '../../utils/translations';
import { StatusBadge } from './DesignSystem';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  businessId: string;
  lang: Language;
  onNavigateToTab: (tab: ActiveTab) => void;
  onUpdateNotifications: (updated: AppNotification[]) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  businessId,
  lang,
  onNavigateToTab,
  onUpdateNotifications
}) => {
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | 'ALL'>('ALL');

  if (!isOpen) return null;

  const filteredNotifications = selectedCategory === 'ALL'
    ? notifications
    : notifications.filter(n => n.category === selectedCategory);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, isRead: true } : n);
    onUpdateNotifications(updated);
    saveStoredNotifications(businessId, updated);
  };

  const handleMarkAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, isRead: true }));
    onUpdateNotifications(updated);
    saveStoredNotifications(businessId, updated);
  };

  const handleDismiss = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    onUpdateNotifications(updated);
    saveStoredNotifications(businessId, updated);
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'INVENTORY':
        return <Package className="h-4 w-4 text-amber-600" />;
      case 'KITCHEN':
        return <ChefHat className="h-4 w-4 text-orange-600" />;
      case 'RESERVATION':
        return <Calendar className="h-4 w-4 text-blue-600" />;
      case 'HOUSEKEEPING':
        return <Sparkles className="h-4 w-4 text-emerald-600" />;
      case 'FINANCE':
        return <Banknote className="h-4 w-4 text-indigo-600" />;
      case 'SECURITY':
        return <Shield className="h-4 w-4 text-rose-600" />;
      default:
        return <Info className="h-4 w-4 text-slate-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'alert':
        return <StatusBadge variant="danger" size="sm">Alert</StatusBadge>;
      case 'warning':
        return <StatusBadge variant="warning" size="sm">Warning</StatusBadge>;
      case 'success':
        return <StatusBadge variant="success" size="sm">Ready</StatusBadge>;
      default:
        return <StatusBadge variant="info" size="sm">Notice</StatusBadge>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label="Notification Center"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-2xs">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{lang === 'ne' ? 'सूचना तथा स्मार्ट अलर्ट' : 'Smart Notifications & Alerts'}</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-orange-600 text-white">
                    {unreadCount}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-500">
                {lang === 'ne' ? 'वास्तविक समय व्यापार अपडेट' : 'Real-time operational alerts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
                className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-orange-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{lang === 'ne' ? 'सबै पढियो' : 'Mark all read'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="p-2 border-b border-slate-100 bg-white flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {lang === 'ne' ? 'सबै' : 'All'} ({notifications.length})
          </button>
          <button
            onClick={() => setSelectedCategory('KITCHEN')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'KITCHEN'
                ? 'bg-orange-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ChefHat className="h-3 w-3" />
            <span>Kitchen</span>
          </button>
          <button
            onClick={() => setSelectedCategory('INVENTORY')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'INVENTORY'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Package className="h-3 w-3" />
            <span>Stock</span>
          </button>
          <button
            onClick={() => setSelectedCategory('RESERVATION')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'RESERVATION'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-3 w-3" />
            <span>Resort</span>
          </button>
          <button
            onClick={() => setSelectedCategory('FINANCE')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 ${
              selectedCategory === 'FINANCE'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Banknote className="h-3 w-3" />
            <span>Finance</span>
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-100">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                <Bell className="h-7 w-7 text-slate-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {lang === 'ne' ? 'कुनै नयाँ सूचना छैन!' : 'All clear! No notifications'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {lang === 'ne'
                  ? 'कम स्टक, भान्साको तयार अर्डर, र पाहुना बुकिङ सम्बन्धी स्मार्ट अलर्ट यहाँ स्वतः आउनेछन्।'
                  : 'Automated warnings for low stock, kitchen orders, resort check-ins, and closing will appear here.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                className={`pt-2.5 first:pt-0 rounded-xl p-3 border transition-all ${
                  notification.isRead
                    ? 'bg-white border-slate-200/80 text-slate-600'
                    : 'bg-orange-50/40 border-orange-200 shadow-2xs text-slate-900'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(notification.category)}
                    <span className="text-[11px] font-black uppercase text-slate-500">
                      {notification.category}
                    </span>
                    {getSeverityBadge(notification.severity)}
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {notification.timestamp.slice(11, 16)}
                  </span>
                </div>

                <h3 className={`text-xs sm:text-sm font-bold mt-1.5 leading-snug ${
                  notification.isRead ? 'text-slate-800' : 'text-slate-950 font-black'
                }`}>
                  {notification.title}
                </h3>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {notification.message}
                </p>

                {/* Footer Actions */}
                <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {notification.targetTab && (
                      <button
                        onClick={() => {
                          handleMarkAsRead(notification.id);
                          onNavigateToTab(notification.targetTab!);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                      >
                        <span>{lang === 'ne' ? 'हेर्नुहोस्' : 'Review in Tab'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {!notification.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="font-bold text-slate-500 hover:text-slate-800"
                      >
                        {lang === 'ne' ? 'पढियो' : 'Mark read'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDismiss(notification.id)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      {lang === 'ne' ? 'हटाउनुहोस्' : 'Dismiss'}
                    </button>
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
