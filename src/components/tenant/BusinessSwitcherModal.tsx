import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Check, 
  Plus, 
  Search, 
  ShieldCheck, 
  Sliders, 
  MapPin, 
  Phone, 
  Mail, 
  ExternalLink,
  Lock,
  Layers,
  Trash2
} from 'lucide-react';
import { BusinessTenant, StaffRole } from '../../types';

interface BusinessSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: BusinessTenant[];
  activeBusinessId: string;
  onSelectBusiness: (businessId: string) => void;
  onDeleteBusiness?: (businessId: string) => void;
  onUpdateBusiness?: (businessId: string, updates: Partial<BusinessTenant>) => void;
  onOpenRegister: () => void;
  onOpenSuperAdmin?: () => void;
  currentRole?: StaffRole;
  isAppCreator?: boolean;
  canCreateBusiness?: boolean;
  createBusinessBlockedReason?: string;
}

export const BusinessSwitcherModal: React.FC<BusinessSwitcherModalProps> = ({
  isOpen,
  onClose,
  businesses,
  activeBusinessId,
  onSelectBusiness,
  onDeleteBusiness,
  onOpenRegister,
  onOpenSuperAdmin,
  currentRole,
  isAppCreator = false,
  canCreateBusiness = false,
  createBusinessBlockedReason
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredBusinesses = businesses.filter(b => 
    b.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.nepaliBusinessName && b.nepaliBusinessName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    b.businessType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeBusiness = businesses.find(b => b.businessId === activeBusinessId) || businesses[0];

  const typeColorMap: Record<string, { bg: string; text: string; border: string }> = {
    CAFE: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    RESTAURANT: { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
    RESORT: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    HOTEL: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
    CAFE_RESTAURANT: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
    RESTAURANT_RESORT: { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' },
    CAFE_RESTAURANT_RESORT: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' },
    OTHER: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Switch Business Workspace</h2>
              <p className="text-xs text-slate-500">
                Isolated data, billing POS, room bookings & ledger per enterprise
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar & Action Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search by business name, type, or address..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50"
            />
          </div>
          {(canCreateBusiness || isAppCreator || currentRole === 'SUPER_ADMIN') ? (
            <button
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Create Business</span>
            </button>
          ) : (
            <span
              title={createBusinessBlockedReason || 'One business workspace allowed per account'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-xl border border-slate-200 whitespace-nowrap"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>1 Business / Account</span>
            </span>
          )}
        </div>

        {/* Businesses List */}
        <div className="p-4 max-h-[420px] overflow-y-auto space-y-3">
          {filteredBusinesses.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No businesses match your query</p>
              <p className="text-xs text-slate-500 mt-1">Try another keyword or register a new business</p>
            </div>
          ) : (
            filteredBusinesses.map(business => {
              const isActive = business.businessId === activeBusinessId;
              const typeStyle = typeColorMap[business.businessType] || typeColorMap.OTHER;

              return (
                <div
                  key={business.businessId}
                  onClick={() => {
                    if (!isActive) {
                      onSelectBusiness(business.businessId);
                      onClose();
                    }
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                    isActive 
                      ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20' 
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {business.logo ? (
                        <img 
                          src={business.logo} 
                          alt={business.businessName}
                          className="h-11 w-11 rounded-lg object-cover border border-slate-200 mt-0.5 shrink-0" 
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                          {business.businessName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">
                            {business.businessName}
                          </h3>
                          {business.nepaliBusinessName && (
                            <span className="text-xs text-slate-500 font-medium">
                              ({business.nepaliBusinessName})
                            </span>
                          )}
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
                            {business.businessType.replace(/_/g, ' ')}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            business.status === 'ACTIVE' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {business.status}
                          </span>
                        </div>

                        {business.tagline && (
                          <p className="text-xs text-slate-600 italic mt-0.5">
                            {business.tagline}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2 flex-wrap">
                          {business.address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {business.address}
                            </span>
                          )}
                          {business.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {business.phone}
                            </span>
                          )}
                          {business.panVatNumber && (
                            <span className="font-mono-num">
                              PAN: {business.panVatNumber}
                            </span>
                          )}
                          <span className="flex items-center gap-1 font-medium text-slate-600">
                            <Layers className="h-3 w-3 text-slate-400" />
                            {business.enabledModules.length} Modules Active
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Active Checkmark or Switch & Delete Buttons */}
                    <div className="shrink-0 self-center flex items-center gap-2">
                      {isActive ? (
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-300">
                          <Check className="h-3.5 w-3.5" />
                          <span>Active</span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                          >
                            Switch
                          </button>
                          {onDeleteBusiness &&
                            businesses.length > 1 &&
                            (currentRole === 'SUPER_ADMIN' || isAppCreator) &&
                            (confirmDeleteId === business.businessId ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteBusiness(business.businessId);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Remove workspace"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(business.businessId);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Super Admin management link */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Multi-enterprise database isolation enforced at workspace level</span>
          </div>

          {currentRole === 'SUPER_ADMIN' && onOpenSuperAdmin && (
            <button
              onClick={() => {
                onClose();
                onOpenSuperAdmin();
              }}
              className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:text-purple-900 hover:underline"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>App Creator SaaS Hub</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
