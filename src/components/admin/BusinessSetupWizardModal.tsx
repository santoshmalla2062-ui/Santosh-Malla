import React, { useState } from 'react';
import { NumberInput } from '../common/NumberInput';
import { 
  X, 
  Building2, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Layers, 
  Sliders, 
  CreditCard, 
  Receipt, 
  MapPin, 
  Phone, 
  Mail, 
  FileText,
  DollarSign,
  ShieldCheck,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { AppModule, AppState, BusinessTenant, BusinessType, PaymentMethodConfig, ReceiptSettings, StaffRole } from '../../types';
import { 
  ALL_APP_MODULES, 
  DEFAULT_MODULES_BY_TYPE, 
  DEFAULT_PAYMENT_METHODS, 
  DEFAULT_RECEIPT_SETTINGS, 
  canActorCreateBusiness,
  registerNewBusiness,
  saveTenantAppState,
  loadTenantAppState
} from '../../services/tenantStorage';

interface BusinessSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete: (business: BusinessTenant, initialState?: AppState) => void;
  currentUser?: { id: string; name: string; role: StaffRole; businessId?: string } | null;
  isMasterOwner?: boolean;
  canCreateBusiness?: boolean;
  blockedReason?: string;
}

export const BusinessSetupWizardModal: React.FC<BusinessSetupWizardModalProps> = ({
  isOpen,
  onClose,
  onSetupComplete,
  currentUser,
  isMasterOwner = false,
  canCreateBusiness,
  blockedReason
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Info
  const [businessName, setBusinessName] = useState('');
  const [nepaliBusinessName, setNepaliBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('CAFE_RESTAURANT');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [panVatNumber, setPanVatNumber] = useState('');
  const [logo, setLogo] = useState('');

  // Step 2: Modules
  const [enabledModules, setEnabledModules] = useState<AppModule[]>(DEFAULT_MODULES_BY_TYPE.CAFE_RESTAURANT);

  // Step 3: Settings
  const [currencySymbol, setCurrencySymbol] = useState('Rs.');
  const [enableVat, setEnableVat] = useState(true);
  const [vatRatePercent, setVatRatePercent] = useState<number>(13);
  const [enableServiceCharge, setEnableServiceCharge] = useState(true);
  const [serviceChargePercent, setServiceChargePercent] = useState<number>(10);
  const [receiptFooter, setReceiptFooter] = useState('Thank you for choosing our hospitality! Visit again.');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS);

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBusinessTypeChange = (newType: BusinessType) => {
    setBusinessType(newType);
    setEnabledModules(DEFAULT_MODULES_BY_TYPE[newType] || ALL_APP_MODULES);
    if (newType.includes('RESORT') || newType.includes('HOTEL')) {
      setEnableServiceCharge(true);
    }
  };

  const toggleModule = (mod: AppModule) => {
    if (mod === 'pos' || mod === 'settings' || mod === 'business_admin') return;
    if (enabledModules.includes(mod)) {
      setEnabledModules(enabledModules.filter(m => m !== mod));
    } else {
      setEnabledModules([...enabledModules, mod]);
    }
  };

  const togglePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.map(pm => pm.id === id ? { ...pm, enabled: !pm.enabled } : pm));
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!businessName.trim()) {
        setError('Please provide a Business Name.');
        return;
      }
      if (!phone.trim()) {
        setError('Please provide a contact phone number.');
        return;
      }
      if (!address.trim()) {
        setError('Please provide a physical address.');
        return;
      }
    }
    setError(null);
    if (currentStep < 3) {
      setCurrentStep((currentStep + 1) as any);
    }
  };

  const handlePrevStep = () => {
    setError(null);
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as any);
    }
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
    'Single-Business Policy: Your account already owns a business workspace and cannot create another.';

  const handleFinalSubmit = () => {
    if (!isCreationAllowed) {
      setError(effectiveBlockedReason);
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

      // Apply Step 3 custom settings into the state
      state.settings.currencySymbol = currencySymbol;
      state.settings.enableVat = enableVat;
      state.settings.vatRatePercent = vatRatePercent;
      state.settings.enableServiceCharge = enableServiceCharge;
      state.settings.serviceChargePercent = serviceChargePercent;
      state.settings.receiptFooterMessage = receiptFooter;
      state.settings.paymentMethodsConfig = paymentMethods;
      state.settings.receiptSettings = {
        ...DEFAULT_RECEIPT_SETTINGS,
        receiptTitle: business.businessName,
        footerMessage: receiptFooter
      };

      saveTenantAppState(business.businessId, state);
      onSetupComplete(business, state);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to complete business setup.');
    }
  };

  const moduleLabels: Record<AppModule, { name: string; desc: string }> = {
    dashboard: { name: 'Executive Dashboard', desc: 'KPI summaries, sales trends, occupancy and fast metrics' },
    pos: { name: 'POS Order Builder', desc: 'Fast menu ordering, kitchen dispatch, modifiers & table orders' },
    billing: { name: 'Open & Settled Billing', desc: 'Track open unpaid bills, present bills, record payments & receipts' },
    tables_rooms: { name: 'Tables & Cabins Floor Plan', desc: 'Live visual floor grid, table occupancy & merged tables' },
    resort: { name: 'Resort & Hotel Management', desc: 'Room availability search, guest profiles, folios & housekeeping' },
    kds: { name: 'Kitchen Order Display (KDS)', desc: 'Head chef display screens for kitchen and barista fulfillment' },
    inventory: { name: 'Inventory & Recipe Deductions', desc: 'Ingredient tracking, stock alerts, purchases & suppliers' },
    customers: { name: 'Customer Khata (Credit Ledger)', desc: 'Udharo credit ledger, payment reminders & customer CRM' },
    day_closing: { name: 'Day Closing & Expense Vault', desc: 'Cash in drawer audit, petty cash expenses & end-of-shift' },
    reports: { name: 'Financial & Tax Analytics', desc: 'Real-time sales summaries, item sales & VAT breakdown' },
    settings: { name: 'System Settings', desc: 'Terminal preferences, hardware printer setup & security' },
    business_admin: { name: 'Business Owner Portal', desc: 'Business profile, staff roster, roles, payment & receipt control' }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Stepper Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Building2 className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Enterprise Onboarding Wizard</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stepper progress */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className={`p-2 rounded-lg border text-center transition-all ${
              currentStep === 1 ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 text-slate-500'
            }`}>
              1. Business Info
            </div>
            <div className={`p-2 rounded-lg border text-center transition-all ${
              currentStep === 2 ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 text-slate-500'
            }`}>
              2. Choose Modules
            </div>
            <div className={`p-2 rounded-lg border text-center transition-all ${
              currentStep === 3 ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold' : 'border-slate-200 text-slate-500'
            }`}>
              3. Finance & Settings
            </div>
          </div>
        </div>

        {/* Content Area */}
        {!isCreationAllowed ? (
          <div className="p-6 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-950">
              <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm">Single-Business Policy Active</p>
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
        <>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: BUSINESS INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Name *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Annapurna Panorama Resort & Cafe"
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
                    Nepali Name (Optional)
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. अन्नपूर्ण पानोरमा रिसोर्ट"
                    value={nepaliBusinessName}
                    onChange={e => setNepaliBusinessName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Business Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['CAFE', 'RESTAURANT', 'RESORT', 'HOTEL', 'CAFE_RESTAURANT', 'RESTAURANT_RESORT', 'CAFE_RESTAURANT_RESORT', 'OTHER'] as BusinessType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleBusinessTypeChange(type)}
                      className={`p-2 rounded-xl border text-xs font-semibold text-center transition-all ${
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder="+977 98XXXXXXXX"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Official Email
                  </label>
                  <input 
                    type="email"
                    placeholder="info@business.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Physical Address *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Street, City, Province, Country"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PAN / VAT Registration Number
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. 601928374"
                    value={panVatNumber}
                    onChange={e => setPanVatNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tagline / Motto
                  </label>
                  <input 
                    type="text"
                    placeholder="e.g. Artisanal Dining & Mountain Hospitality"
                    value={tagline}
                    onChange={e => setTagline(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS MODULES */}
          {currentStep === 2 && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-1">
                <p className="text-xs text-slate-500">
                  Select which software features are active for <span className="font-semibold text-slate-800">{businessName || 'this business'}</span>. Disabled modules will not clutter the navigation.
                </p>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {enabledModules.length} Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ALL_APP_MODULES.map(mod => {
                  const isSelected = enabledModules.includes(mod);
                  const isCore = mod === 'pos' || mod === 'settings' || mod === 'business_admin';
                  const info = moduleLabels[mod];

                  return (
                    <div
                      key={mod}
                      onClick={() => !isCore && toggleModule(mod)}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition-all ${
                        isCore 
                          ? 'bg-slate-50 border-slate-200 opacity-90 cursor-default' 
                          : isSelected 
                          ? 'border-emerald-500 bg-emerald-50/40 cursor-pointer' 
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        disabled={isCore}
                        onChange={() => toggleModule(mod)}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {info.name} {isCore && <span className="text-[10px] text-slate-400 font-normal">(Core)</span>}
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
          )}

          {/* STEP 3: BUSINESS SETTINGS & PAYMENTS */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Tax & Charges Configuration</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Value Added Tax (VAT)</label>
                    <input 
                      type="checkbox"
                      checked={enableVat}
                      onChange={e => setEnableVat(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                  </div>
                  {enableVat && (
                    <div className="flex items-center gap-2">
                      <NumberInput
                        min={0}
                        max={100}
                        value={vatRatePercent}
                        onValueChange={val => setVatRatePercent(val)}
                        className="w-20 px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-mono-num font-bold"
                      />
                      <span className="text-xs text-slate-500">% legal VAT rate</span>
                    </div>
                  )}
                </div>

                <div className="p-3 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">Service Charge</label>
                    <input 
                      type="checkbox"
                      checked={enableServiceCharge}
                      onChange={e => setEnableServiceCharge(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                  </div>
                  {enableServiceCharge && (
                    <div className="flex items-center gap-2">
                      <NumberInput
                        min={0}
                        max={100}
                        value={serviceChargePercent}
                        onValueChange={val => setServiceChargePercent(val)}
                        className="w-20 px-2.5 py-1 text-xs border border-slate-300 rounded-lg font-mono-num font-bold"
                      />
                      <span className="text-xs text-slate-500">% service fee</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Accepted Payment Methods</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {paymentMethods.map(pm => (
                    <div
                      key={pm.id}
                      onClick={() => togglePaymentMethod(pm.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                        pm.enabled ? 'border-emerald-500 bg-emerald-50/50 font-semibold text-emerald-900' : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      <span>{pm.name}</span>
                      <input 
                        type="checkbox"
                        checked={pm.enabled}
                        onChange={() => togglePaymentMethod(pm.id)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipt Footer Message */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Receipt Customer Footer Message
                </label>
                <input 
                  type="text"
                  value={receiptFooter}
                  onChange={e => setReceiptFooter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl transition-colors shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Launch Enterprise</span>
              </button>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
