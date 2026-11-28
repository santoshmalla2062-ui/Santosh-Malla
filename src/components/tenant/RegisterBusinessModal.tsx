import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Check, 
  Sparkles, 
  MapPin, 
  Phone, 
  Mail, 
  FileText, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { AppModule, AppState, BusinessTenant, BusinessType, StaffRole } from '../../types';
import {
  ALL_APP_MODULES,
  DEFAULT_MODULES_BY_TYPE,
  canActorCreateBusiness,
  registerNewBusiness
} from '../../services/tenantStorage';

interface RegisterBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (business: BusinessTenant, initialState?: AppState) => void;
  currentUser?: { id: string; name: string; role: StaffRole; businessId?: string } | null;
  isMasterOwner?: boolean;
  canCreateBusiness?: boolean;
  blockedReason?: string;
}

export const RegisterBusinessModal: React.FC<RegisterBusinessModalProps> = ({
  isOpen,
  onClose,
  onRegisterSuccess,
  currentUser,
  isMasterOwner = false,
  canCreateBusiness,
  blockedReason
}) => {
  const [businessName, setBusinessName] = useState('');
  const [nepaliBusinessName, setNepaliBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('CAFE');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [panVatNumber, setPanVatNumber] = useState('');
  const [logo] = useState('');
  const [enabledModules, setEnabledModules] = useState<AppModule[]>(DEFAULT_MODULES_BY_TYPE.CAFE);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBusinessTypeChange = (newType: BusinessType) => {
    setBusinessType(newType);
    setEnabledModules(DEFAULT_MODULES_BY_TYPE[newType] || ALL_APP_MODULES);
  };

  const toggleModule = (mod: AppModule) => {
    // POS and Settings should always stay enabled as foundational
    if (mod === 'pos' || mod === 'settings') return;

    if (enabledModules.includes(mod)) {
      setEnabledModules(enabledModules.filter(m => m !== mod));
    } else {
      setEnabledModules([...enabledModules, mod]);
    }
  };

  const moduleLabels: Record<AppModule, { name: string; desc: string }> = {
    dashboard: { name: 'Executive Dashboard', desc: 'KPI summaries, sales trends, occupancy and fast metrics' },
    pos: { name: 'POS Order Builder', desc: 'Fast order entry, KOT generation & modifiers' },
    billing: { name: 'Open & Settled Billing', desc: 'Manage unpaid open bills, present bills & record QR/cash payments' },
    tables_rooms: { name: 'Floor Tables & Cottages', desc: 'Visual floor plan & table occupancy tracker' },
    resort: { name: 'Resort & Hotel Management', desc: 'Room booking, availability, folios & housekeeping' },
    kds: { name: 'Kitchen Display (KDS)', desc: 'Live kitchen & bar order fulfillment screens' },
    inventory: { name: 'Inventory & Stock Control', desc: 'Auto-deduction recipes, wastage & supplier logs' },
    customers: { name: 'Customer CRM & Khata Ledger', desc: 'Udharo credit ledger, loyalty points & visits' },
    day_closing: { name: 'Day Closing & Expense Vault', desc: 'Shift cash reconciliation & daily overheads' },
    reports: { name: 'Sales & Tax Analytics', desc: 'Item performance, VAT summaries & profit margins' },
    settings: { name: 'Enterprise Configurations', desc: 'Printers, VAT rates, security & staff access' },
    business_admin: { name: 'Business Admin & Governance', desc: 'Owner dashboard, roles, payments, taxes & staff' }
  };

  const fallbackEligibility = canActorCreateBusiness({
    id: currentUser?.id,
    role: currentUser?.role,
    isAppCreator: isMasterOwner,
    businessId: currentUser?.businessId
  });
  const isCreationAllowed = canCreateBusiness !== undefined ? canCreateBusiness : fallbackEligibility.allowed;
  const effectiveBlockedReason =
    blockedReason ||
    fallbackEligibility.reason ||
    'Single-Business Policy: Only one business workspace is allowed per account.';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCreationAllowed) {
      setError(effectiveBlockedReason);
      return;
    }
    if (!businessName.trim()) {
      setError('Business Name is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Contact Phone number is required.');
      return;
    }
    if (!address.trim()) {
      setError('Physical Address is required.');
      return;
    }

    try {
      const { business, state } = registerNewBusiness({
        businessName: businessName.trim(),
        nepaliBusinessName: nepaliBusinessName.trim() || undefined,
        tagline: tagline.trim() || undefined,
        businessType,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        panVatNumber: panVatNumber.trim(),
        logo: logo.trim() || undefined,
        ownerId: currentUser?.id || 'owner-' + Date.now().toString(36),
        ownerName: currentUser?.name || 'Business Owner',
        enabledModules,
        environment: 'production',
        templateType: 'clean_slate',
        enforceSingleBusinessCap: true,
        actorRole: currentUser?.role || 'OWNER',
        isMasterOwner
      });

      onRegisterSuccess(business, state);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create business.');
    }
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
              <h2 className="text-base font-bold text-slate-900">Register New Business Workspace</h2>
              <p className="text-xs text-slate-500">
                Setup a new cafe, restaurant, or hotel with isolated database and custom modules
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

        {!isCreationAllowed ? (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-950">
              <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm">Single-Business Workspace Limit</p>
                <p className="leading-relaxed">{effectiveBlockedReason}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Business Profile */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Business Profile</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Name *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Lakeside Brews & Bistro"
                  value={businessName}
                  onChange={e => {
                    setBusinessName(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nepali Business Name (Optional)
                </label>
                <input 
                  type="text"
                  placeholder="e.g. लेकसाइड ब्रूज तथा बिस्ट्रो"
                  value={nepaliBusinessName}
                  onChange={e => setNepaliBusinessName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Business Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Business Type / Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['CAFE', 'RESTAURANT', 'RESORT', 'HOTEL', 'CAFE_RESTAURANT', 'RESTAURANT_RESORT', 'CAFE_RESTAURANT_RESORT', 'OTHER'] as BusinessType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleBusinessTypeChange(type)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      businessType === type 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs ring-1 ring-emerald-400' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {type.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tagline or Motto
              </label>
              <input 
                type="text"
                placeholder="e.g. Organic coffee, artisanal pastries and wood-fired pizza"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Section 2: Contact & Tax Details */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Contact & Location</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    placeholder="+977 98XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="email"
                    placeholder="contact@business.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Address *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Lakeside-6, Pokhara, Nepal"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PAN / VAT Number
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="e.g. 601928374"
                    value={panVatNumber}
                    onChange={e => setPanVatNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono-num"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Enabled Modules Configuration */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">3. Enabled Software Modules</h3>
              <span className="text-[11px] text-slate-500 font-medium">
                {enabledModules.length} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALL_APP_MODULES.map(mod => {
                const isSelected = enabledModules.includes(mod);
                const isMandatory = mod === 'pos' || mod === 'settings';
                const info = moduleLabels[mod];

                return (
                  <div
                    key={mod}
                    onClick={() => !isMandatory && toggleModule(mod)}
                    className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                      isMandatory 
                        ? 'bg-slate-50 border-slate-200 opacity-90 cursor-default' 
                        : isSelected 
                        ? 'border-emerald-500 bg-emerald-50/40 cursor-pointer' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      disabled={isMandatory}
                      onChange={() => toggleModule(mod)}
                      className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-900 leading-tight">
                        {info.name} {isMandatory && <span className="text-[10px] text-slate-400 font-normal">(Core)</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                        {info.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submission Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>You will be assigned as Business Owner</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                <span>Launch Business</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
