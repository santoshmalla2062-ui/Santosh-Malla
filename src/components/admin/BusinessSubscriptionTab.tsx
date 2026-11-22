import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  CreditCard, 
  Check, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  ArrowUpRight, 
  FileText, 
  Printer, 
  Send,
  Building2,
  Users,
  UtensilsCrossed,
  Hotel
} from 'lucide-react';
import { AppState, BusinessTenant, SubscriptionInvoice, SubscriptionPlan, TenantSubscription, AppModule } from '../../types';
import { 
  getTenantSubscription, 
  getSubscriptionPlans, 
  getSubscriptionInvoices, 
  changeTenantPlan, 
  submitSubscriptionPayment 
} from '../../services/subscriptionService';

interface BusinessSubscriptionTabProps {
  business: BusinessTenant;
  appState: AppState;
  lang: 'en' | 'ne';
  onUpdateBusiness: (businessId: string, updates: Partial<BusinessTenant>) => void;
  recordAudit: (action: string, targetId?: string, details?: string, severity?: 'INFO' | 'WARNING' | 'CRITICAL') => void;
  playChime: (type?: 'success' | 'alert' | 'beep') => void;
}

export const BusinessSubscriptionTab: React.FC<BusinessSubscriptionTabProps> = ({
  business,
  appState,
  lang,
  onUpdateBusiness,
  recordAudit,
  playChime
}) => {
  const [subscription, setSubscription] = useState<TenantSubscription>(() => getTenantSubscription(business.businessId));
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => getSubscriptionPlans());
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>(() => getSubscriptionInvoices(business.businessId));

  // Payment form states
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Fonepay QR');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentRemarks, setPaymentRemarks] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Active plan
  const currentPlan = plans.find(p => p.id === subscription.planId) || plans[0];

  useEffect(() => {
    const sub = getTenantSubscription(business.businessId);
    setSubscription(sub);
    setPlans(getSubscriptionPlans());
    const invs = getSubscriptionInvoices(business.businessId);
    setInvoices(invs);
    if (invs.length > 0 && !selectedInvoiceId) {
      setSelectedInvoiceId(invs[0].id);
    }
  }, [business.businessId]);

  const handleSelectPlan = (newPlanId: string) => {
    if (newPlanId === subscription.planId) return;

    const targetPlan = plans.find(p => p.id === newPlanId);
    const confirmChange = window.confirm(
      lang === 'ne' 
        ? `के तपाईं "${targetPlan?.name}" योजनामा परिवर्तन गर्न चाहनुहुन्छ? तपाईंको पुरानो सबै डाटा सुरक्षित रहनेछ।` 
        : `Switch to plan "${targetPlan?.name}"? All existing data and menus will be safely preserved.`
    );
    if (!confirmChange) return;

    const { subscription: updatedSub, invoice } = changeTenantPlan(business.businessId, newPlanId, 'Owner requested plan change');
    setSubscription(updatedSub);
    onUpdateBusiness(business.businessId, {
      subscriptionPlanId: updatedSub.planId,
      subscriptionStatus: updatedSub.status,
      subscriptionExpiresAt: updatedSub.nextRenewalDate
    });
    setInvoices(getSubscriptionInvoices(business.businessId));
    recordAudit('PLAN_CHANGED', updatedSub.planId, `Switched plan to ${targetPlan?.name}`, 'INFO');
    playChime('success');
    setSubmitSuccess(`Successfully switched to ${targetPlan?.name}! Invoice ${invoice.id} has been created.`);
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !paymentReference.trim()) return;

    const updated = submitSubscriptionPayment(selectedInvoiceId, paymentMethod, paymentReference.trim(), paymentRemarks.trim());
    if (updated) {
      setInvoices(getSubscriptionInvoices(business.businessId));
      recordAudit('SUBSCRIPTION_PAYMENT_SUBMITTED', selectedInvoiceId, `Submitted ${paymentMethod} ref: ${paymentReference}`, 'INFO');
      playChime('success');
      setSubmitSuccess(`Payment reference submitted successfully for invoice ${selectedInvoiceId}. Super Admin will verify and activate renewal.`);
      setPaymentReference('');
      setPaymentRemarks('');
    }
  };

  const isSuspended = business.status === 'SUSPENDED' || subscription.status === 'SUSPENDED';

  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-150">
      
      {/* Alert if Suspended or Expired */}
      {isSuspended && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-900 shadow-xs">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-extrabold text-sm">Account Status: Suspended / Restricted</h4>
            <p className="mt-0.5 text-xs">
              Reason: <strong>{subscription.suspensionReason || business.suspensionReason || 'Subscription payment pending or administrative review'}</strong>.
            </p>
            <p className="mt-1 text-[11px] text-rose-700">
              All your tables, menus, folios, and financial reports are securely preserved. Please submit your renewal payment below or contact Super Admin to reactivate full operational modules.
            </p>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {submitSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 font-bold flex items-center justify-between">
          <span>✓ {submitSuccess}</span>
          <button onClick={() => setSubmitSuccess(null)} className="text-emerald-700 hover:text-emerald-950 font-black">✕</button>
        </div>
      )}

      {/* 1. CURRENT PLAN OVERVIEW CARD */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-purple-400 block">
              Active SaaS Plan
            </span>
            <h3 className="text-xl sm:text-2xl font-black mt-0.5 flex items-center gap-2">
              <span>{currentPlan.name}</span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                subscription.status === 'ACTIVE' 
                  ? 'bg-emerald-500 text-slate-950' 
                  : subscription.status === 'TRIAL'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-rose-500 text-white'
              }`}>
                {subscription.status}
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">{currentPlan.description}</p>
          </div>

          <div className="sm:text-right bg-slate-800/80 backdrop-blur-xs p-3 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 block">Billing Rate</span>
            <span className="text-xl font-black font-mono-num text-amber-300">
              {currentPlan.currency} {currentPlan.price.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block capitalize">/ {currentPlan.billingInterval}</span>
          </div>
        </div>

        {/* Subscription Metadata & Quotas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Period Start</span>
            <span className="font-bold font-mono-num">{subscription.currentPeriodStart}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Next Renewal Date</span>
            <span className="font-bold font-mono-num text-emerald-400">{subscription.nextRenewalDate}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Staff Quota Usage</span>
            <span className="font-bold font-mono-num">
              {appState.staffUsers.length} / {currentPlan.staffLimit} users
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Menu Products Quota</span>
            <span className="font-bold font-mono-num">
              {appState.menuItems.length} / {currentPlan.maxProducts || 'Unlimited'} dishes
            </span>
          </div>
        </div>

        {/* Included Modules Badges */}
        <div className="pt-4 mt-2 border-t border-slate-800 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 mr-2">Included Modules:</span>
          {currentPlan.includedModules.map((mod: AppModule) => (
            <span key={mod} className="bg-purple-900/60 text-purple-200 border border-purple-700/60 px-2 py-0.5 rounded-md text-[10px] font-semibold">
              ✓ {mod.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* 2. PLAN COMPARISON & SWITCHER */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Available Business Plans</h3>
          <p className="text-xs text-slate-500">Upgrade or switch tiers at any time. Data is preserved across plan changes.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isSelected = plan.id === subscription.planId;
            return (
              <div 
                key={plan.id}
                className={`bg-white rounded-2xl border-2 p-5 flex flex-col justify-between transition-all ${
                  isSelected 
                    ? 'border-purple-600 shadow-md ring-2 ring-purple-400/30' 
                    : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-900">{plan.name}</span>
                    {isSelected && (
                      <span className="bg-purple-100 text-purple-800 font-black text-[9px] px-2 py-0.5 rounded-full uppercase">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{plan.description}</p>
                  
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono-num text-slate-900">
                        {plan.currency} {plan.price.toLocaleString()}
                      </span>
                      <span className="text-slate-400 text-xs">/ mo</span>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Up to <strong>{plan.staffLimit} staff users</strong>
                    </span>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <span className="font-bold text-[11px] text-slate-700 block">Features:</span>
                    {plan.includedModules.map((mod: AppModule) => (
                      <div key={mod} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="capitalize">{mod.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  {isSelected ? (
                    <button
                      disabled
                      className="w-full py-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-default"
                    >
                      Active Plan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.id)}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs"
                    >
                      Switch to {plan.name.split(' ')[0]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. SUBSCRIPTION PAYMENT SUBMISSION (Separate from customer dining bills) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Payment Channels Info */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5">
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-purple-700" />
              <span>Subscription Payment Accounts (भुक्तानी विवरण)</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pay using Fonepay Merchant QR, Corporate Bank Transfer, or eSewa wallet.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block text-xs">1. Bank Transfer (बैंक खाता)</span>
              <p className="text-[11px] text-slate-600">Bank: <strong>Nabil Bank Limited</strong></p>
              <p className="text-[11px] text-slate-600">A/C Name: <strong>Himalayan Breeze Platform Services Pvt. Ltd.</strong></p>
              <p className="text-[11px] font-mono-num font-bold text-slate-900">A/C No: 019283749281001</p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block text-xs">2. Fonepay QR & Merchant</span>
              <p className="text-[11px] text-slate-600">Merchant Code: <strong>HB-SAAS-MERCHANT-01</strong></p>
              <p className="text-[11px] text-slate-500">Scan via any mobile banking app (NIC Asia, Nabil, Global IME, etc.)</p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block text-xs">3. Mobile Wallets (eSewa / Khalti)</span>
              <p className="text-[11px] text-slate-600">eSewa ID: <strong>9841234567</strong></p>
              <p className="text-[11px] text-slate-600">Khalti ID: <strong>9856012345</strong></p>
            </div>
          </div>
        </div>

        {/* Submit Payment Form */}
        <form onSubmit={handleSubmitPayment} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3.5 shadow-2xs">
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Send className="h-4 w-4 text-emerald-700" />
              <span>Submit Payment Reference (रसिद / भौचर बुझाउनुहोस्)</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Submit your voucher reference code. Super Admin will verify and activate your next billing cycle.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Subscription Invoice *</label>
            <select
              value={selectedInvoiceId}
              onChange={e => setSelectedInvoiceId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
            >
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.id} — {inv.planName} ({inv.currency} {inv.totalAmount.toLocaleString()}) [{inv.status}]
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              >
                <option value="Fonepay QR">Fonepay QR</option>
                <option value="Bank Transfer">Bank Transfer (भौचर)</option>
                <option value="eSewa">eSewa Wallet</option>
                <option value="Khalti">Khalti Wallet</option>
                <option value="Cash Counter">Cash / In-Person</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transaction Ref / Voucher # *</label>
              <input
                type="text"
                required
                placeholder="e.g. FP-9812938491"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Optional Remarks / Note</label>
            <input
              type="text"
              placeholder="e.g. Paid for October 2026 renewal"
              value={paymentRemarks}
              onChange={e => setPaymentRemarks(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl text-xs"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 font-black text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors shadow-xs"
          >
            Submit Voucher for Super Admin Verification
          </button>
        </form>

      </div>

      {/* 4. INVOICES & BILLING HISTORY */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Subscription Invoices & Receipts History</h3>
          <p className="text-xs text-slate-500">Official platform subscription tax invoices and payment vouchers</p>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Invoice #</th>
                <th className="py-2.5 px-3">Plan</th>
                <th className="py-2.5 px-3">Billing Cycle</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Ref & Method</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {inv.id}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {inv.planName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                    {inv.billingPeriod}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    {inv.currency} {inv.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="font-semibold text-slate-800">{inv.paymentMethod || 'Pending'}</p>
                    <span className="font-mono text-[10px] text-slate-400">{inv.paymentReference || '-'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : inv.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        window.print();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Print subscription receipt"
                    >
                      <Printer className="h-3 w-3" />
                      <span>Slip</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
