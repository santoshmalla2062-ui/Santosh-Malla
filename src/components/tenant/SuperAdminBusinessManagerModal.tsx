import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  ShieldAlert, 
  CheckCircle, 
  Sliders, 
  Play, 
  PauseCircle, 
  Plus, 
  Download, 
  Layers, 
  MapPin, 
  Phone, 
  Mail,
  Search,
  ExternalLink,
  Edit2,
  Check,
  Sparkles,
  CreditCard,
  DollarSign,
  TrendingUp,
  BarChart3,
  Calendar,
  AlertTriangle,
  FileText,
  Clock,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  BookOpen,
  Globe
} from 'lucide-react';
import { AppModule, BusinessStatus, BusinessTenant, BusinessType, StaffRole, SubscriptionPlan, SubscriptionInvoice, TenantSubscription } from '../../types';
import { ALL_APP_MODULES } from '../../services/tenantStorage';
import { MASTER_OWNER_EMAIL } from '../../services/cloudSyncService';
import { 
  getSubscriptionPlans, 
  saveSubscriptionPlans, 
  updateSubscriptionPlan, 
  createSubscriptionPlan,
  getSubscriptionInvoices,
  verifySubscriptionPayment,
  getPlatformSubscriptionMetrics,
  getTenantSubscription,
  transitionSubscriptionStatus,
  changeTenantPlan
} from '../../services/subscriptionService';

interface SuperAdminBusinessManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: BusinessTenant[];
  activeBusinessId: string;
  onSelectBusiness: (businessId: string) => void;
  onUpdateBusiness: (businessId: string, updates: Partial<BusinessTenant>) => void;
  onOpenRegister: () => void;
  onExportAll?: () => void;
  currentRole?: StaffRole;
  isAppCreator?: boolean;
  cloudSyncStatus?: 'connected' | 'local' | 'error' | 'connecting';
  cloudUserEmail?: string | null;
  onSyncCloudBusinesses?: () => Promise<number>;
  onGoogleCreatorLogin?: () => void;
}

type SuperAdminTab = 'tenants' | 'plans' | 'payments' | 'analytics' | 'guide';

export const SuperAdminBusinessManagerModal: React.FC<SuperAdminBusinessManagerModalProps> = ({
  isOpen,
  onClose,
  businesses,
  activeBusinessId,
  onSelectBusiness,
  onUpdateBusiness,
  onOpenRegister,
  onExportAll,
  currentRole,
  isAppCreator = false,
  cloudSyncStatus = 'local',
  cloudUserEmail = null,
  onSyncCloudBusinesses,
  onGoogleCreatorLogin
}) => {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('tenants');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  
  // Plans & Invoices state
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [rejectingInvoiceId, setRejectingInvoiceId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // Business editing
  const [editingBusinessId, setEditingBusinessId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BusinessTenant>>({});
  const [moduleModalBusiness, setModuleModalBusiness] = useState<BusinessTenant | null>(null);
  const [moduleDraft, setModuleDraft] = useState<AppModule[]>([]);

  // Suspension Modal State
  const [suspensionTargetBiz, setSuspensionTargetBiz] = useState<BusinessTenant | null>(null);
  const [suspensionReasonInput, setSuspensionReasonInput] = useState('');

  // Assign Plan Modal State
  const [planChangeTargetBiz, setPlanChangeTargetBiz] = useState<BusinessTenant | null>(null);
  const [selectedNewPlanId, setSelectedNewPlanId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPlans(getSubscriptionPlans());
      setInvoices(getSubscriptionInvoices());
      setCloudSyncMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Strict App Creator / Super Admin Access Authorization Check
  if (currentRole !== 'SUPER_ADMIN' && !isAppCreator) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-rose-200">
          <ShieldAlert className="h-12 w-12 text-rose-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">App Creator Access Required</h3>
          <p className="text-xs text-slate-600 mb-4">
            Global platform governance is locked exclusively to the verified App Creator ({MASTER_OWNER_EMAIL}). Individual business owners can manage their branch from Business Admin.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const metrics = getPlatformSubscriptionMetrics();

  const filteredBusinesses = businesses.filter(b => {
    if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.businessName.toLowerCase().includes(q) ||
      b.businessId.toLowerCase().includes(q) ||
      b.businessType.toLowerCase().includes(q) ||
      b.ownerName.toLowerCase().includes(q);
  });

  const handleExecuteSuspension = () => {
    if (!suspensionTargetBiz) return;
    const reason = suspensionReasonInput.trim() || 'Suspended by platform administrator';
    transitionSubscriptionStatus(suspensionTargetBiz.businessId, 'SUSPENDED', reason, 'Super Admin');
    onUpdateBusiness(suspensionTargetBiz.businessId, { status: 'SUSPENDED', suspensionReason: reason });
    setSuspensionTargetBiz(null);
    setSuspensionReasonInput('');
  };

  const handleReactivateBusiness = (biz: BusinessTenant) => {
    transitionSubscriptionStatus(biz.businessId, 'ACTIVE', undefined, 'Super Admin');
    onUpdateBusiness(biz.businessId, { status: 'ACTIVE', suspensionReason: undefined });
  };

  const handleExecutePlanChange = () => {
    if (!planChangeTargetBiz || !selectedNewPlanId) return;
    const { subscription } = changeTenantPlan(planChangeTargetBiz.businessId, selectedNewPlanId, 'Assigned by Super Admin');
    onUpdateBusiness(planChangeTargetBiz.businessId, { 
      subscriptionPlanId: subscription.planId,
      subscriptionStatus: subscription.status,
      subscriptionExpiresAt: subscription.nextRenewalDate
    });
    setInvoices(getSubscriptionInvoices());
    setPlanChangeTargetBiz(null);
  };

  const handleVerifyInvoice = (invoiceId: string, approve: boolean, reasonOverride?: string) => {
    if (!approve && !reasonOverride) {
      setRejectingInvoiceId(invoiceId);
      setRejectReasonInput('');
      return;
    }

    verifySubscriptionPayment(invoiceId, approve, { id: 'staff-super', name: 'App Creator' }, reasonOverride);
    setInvoices(getSubscriptionInvoices());
    setRejectingInvoiceId(null);
    setRejectReasonInput('');
  };

  const handleSyncCloudTenants = async () => {
    if (!onSyncCloudBusinesses) return;
    setIsSyncingCloud(true);
    setCloudSyncMsg(null);
    try {
      const count = await onSyncCloudBusinesses();
      setCloudSyncMsg({ ok: true, text: `Synced ${count} cloud business workspace(s) from Firestore.` });
    } catch (err: any) {
      setCloudSyncMsg({ ok: false, text: err?.message || 'Failed to sync cloud businesses.' });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">App Creator Control Hub & SaaS Sync</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
                  {isAppCreator ? `Verified Creator (${MASTER_OWNER_EMAIL})` : 'Super Admin'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cloud-wide business control, remote module locks, SaaS plans, payment approvals & creator guide
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Global Navigation Tabs */}
        <div className="flex items-center justify-between px-6 bg-slate-800 border-b border-slate-700 text-xs shrink-0 overflow-x-auto">
          <div className="flex gap-1 py-1.5">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'tenants' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Tenants ({businesses.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'plans' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>SaaS Plans ({plans.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'payments' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Payment Approvals ({invoices.filter(i => i.status === 'PENDING').length})</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'analytics' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Platform Financials</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'guide' 
                  ? 'bg-amber-500 text-slate-950 shadow-xs' 
                  : 'text-amber-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>How to Manage (Guide)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono-num hidden sm:block whitespace-nowrap">
            Revenue: NPR {metrics.totalVerifiedRevenueNpr.toLocaleString()}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          
          {/* TAB 1: TENANTS & ENTERPRISES */}
          {activeTab === 'tenants' && (
            <div className="space-y-4">
              {/* Quick Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block font-medium">Total Registered</span>
                  <span className="text-lg font-bold text-slate-900 font-mono-num">{businesses.length}</span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <span className="text-emerald-700 block font-medium">Active Tenants</span>
                  <span className="text-lg font-bold text-emerald-800 font-mono-num">{metrics.activeBusinesses}</span>
                </div>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-200">
                  <span className="text-rose-700 block font-medium">Suspended</span>
                  <span className="text-lg font-bold text-rose-800 font-mono-num">{metrics.suspendedBusinesses}</span>
                </div>
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                  <span className="text-purple-700 block font-medium">Verified SaaS Revenue</span>
                  <span className="text-lg font-bold text-purple-900 font-mono-num">
                    NPR {metrics.totalVerifiedRevenueNpr.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* App Creator Cloud Governance Bar */}
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Globe className={`h-4 w-4 shrink-0 ${cloudSyncStatus === 'connected' ? 'text-emerald-700' : 'text-amber-700'}`} />
                  <div>
                    <p className="font-bold text-slate-900">
                      {cloudSyncStatus === 'connected' && isAppCreator
                        ? `App Creator Cloud Sync Active (${cloudUserEmail})`
                        : 'App Creator Cloud Sync Not Connected'}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {cloudSyncStatus === 'connected' && isAppCreator
                        ? 'Pull all Firestore client businesses, suspend unpaid branches remotely, or edit active modules.'
                        : `Sign in with ${MASTER_OWNER_EMAIL} to sync and govern client workspaces across cloud devices.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {cloudSyncStatus === 'connected' && isAppCreator && onSyncCloudBusinesses ? (
                    <button
                      type="button"
                      disabled={isSyncingCloud}
                      onClick={handleSyncCloudTenants}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                      <span>{isSyncingCloud ? 'Syncing...' : 'Sync Cloud Tenants'}</span>
                    </button>
                  ) : (
                    onGoogleCreatorLogin && (
                      <button
                        type="button"
                        onClick={onGoogleCreatorLogin}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Connect Creator Google</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {cloudSyncMsg && (
                <div className={`p-2.5 rounded-xl border text-xs font-semibold ${
                  cloudSyncMsg.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {cloudSyncMsg.text}
                </div>
              )}

              {/* Filters & Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search business name, ID, type, or owner..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="SUSPENDED">Suspended Only</option>
                  </select>

                  <button
                    onClick={() => {
                      onClose();
                      onOpenRegister();
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register Business</span>
                  </button>
                </div>
              </div>

              {/* Tenants Table */}
              <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Business</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Plan & Status</th>
                      <th className="py-2.5 px-3">Owner Contact</th>
                      <th className="py-2.5 px-3">Modules</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBusinesses.map(b => {
                      const isCurrent = b.businessId === activeBusinessId;
                      const sub = getTenantSubscription(b.businessId);
                      const currentPlan = plans.find(p => p.id === sub.planId);

                      return (
                        <tr key={b.businessId} className={`hover:bg-slate-50 transition-colors ${isCurrent ? 'bg-purple-50/40' : ''}`}>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{b.businessName}</span>
                                  {isCurrent && (
                                    <span className="bg-purple-100 text-purple-800 text-[9px] px-1.5 py-0.2 rounded font-black">
                                      CURRENT
                                    </span>
                                  )}
                                </p>
                                <span className="font-mono text-[10px] text-slate-400 block">{b.businessId}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="capitalize bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                              {b.businessType.replace(/_/g, ' ')}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div>
                              <span className="font-bold text-slate-800 block text-[11px]">
                                {currentPlan?.name || 'Professional F&B'}
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full ${
                                  b.status === 'ACTIVE' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {b.status}
                                </span>
                                {b.status === 'SUSPENDED' && b.suspensionReason && (
                                  <span className="text-[10px] text-rose-600 truncate max-w-[120px]" title={b.suspensionReason}>
                                    ({b.suspensionReason})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            <p className="font-semibold text-slate-800">{b.ownerName}</p>
                            <p className="text-slate-400">{b.phone || b.email}</p>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-semibold text-slate-700">
                              {b.enabledModules.length} enabled
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Switch Session Button */}
                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectBusiness(b.businessId);
                                    onClose();
                                  }}
                                  className="px-2 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                                  title="Switch to this business session context"
                                >
                                  Switch
                                </button>
                              )}

                              {/* Assign Plan Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setPlanChangeTargetBiz(b);
                                  setSelectedNewPlanId(sub.planId);
                                }}
                                className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                                title="Change SaaS Subscription Plan"
                              >
                                Plan
                              </button>

                              {/* Modules Control Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setModuleModalBusiness(b);
                                  setModuleDraft([...(b.enabledModules || [])]);
                                }}
                                className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                                title="Enable or lock operational modules for this business"
                              >
                                Modules
                              </button>

                              {/* Activate / Suspend Toggle */}
                              {b.status === 'ACTIVE' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSuspensionTargetBiz(b);
                                    setSuspensionReasonInput('');
                                  }}
                                  className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                                  title="Suspend business operations"
                                >
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReactivateBusiness(b)}
                                  className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                  title="Reactivate suspended business"
                                >
                                  Reactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: SAAS SUBSCRIPTION PLANS */}
          {activeTab === 'plans' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Configurable SaaS Subscription Plans</h3>
                  <p className="text-xs text-slate-500">Configure pricing, included modules, and staff limits across tiers</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingPlan(true)}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Add Custom Plan</span>
                </button>
              </div>

              {/* Plan Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans.map(plan => (
                  <div key={plan.id} className="bg-white rounded-xl border-2 border-slate-200 p-4 space-y-3 shadow-2xs flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-slate-900">{plan.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                          {plan.billingInterval}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{plan.description}</p>
                      
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black font-mono-num text-slate-900">
                            {plan.currency} {plan.price.toLocaleString()}
                          </span>
                          <span className="text-slate-400 text-xs">/ month</span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Staff limit: <strong>{plan.staffLimit} users</strong>
                        </span>
                      </div>

                      {/* Included modules */}
                      <div className="space-y-1 pt-2 border-t border-slate-100">
                        <span className="font-bold text-[11px] text-slate-700 block">Included Modules:</span>
                        <div className="flex flex-wrap gap-1">
                          {plan.includedModules.map((mod: AppModule) => (
                            <span key={mod} className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold">
                              ✓ {mod.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPlan(plan)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors"
                      >
                        Edit Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENT APPROVALS */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Subscription Invoices & Payment Approvals</h3>
                <p className="text-xs text-slate-500">
                  Verify offline bank vouchers, Fonepay merchant transactions, and eSewa slips to activate or extend business subscriptions.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Business</th>
                      <th className="py-2.5 px-3">Plan</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Payment Ref</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {inv.id}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {inv.businessName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {inv.planName}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {inv.currency} {inv.totalAmount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-800">{inv.paymentMethod || 'Manual Entry'}</p>
                          <span className="font-mono text-[10px] text-slate-500">{inv.paymentReference || 'No ref yet'}</span>
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
                          {inv.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleVerifyInvoice(inv.id, true)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors shadow-2xs"
                              >
                                Approve & Extend
                              </button>
                              <button
                                type="button"
                                onClick={() => handleVerifyInvoice(inv.id, false)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-[11px] font-bold transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              {inv.verifiedByStaffName ? `Verified by ${inv.verifiedByStaffName}` : 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PLATFORM ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-5 rounded-2xl shadow-md">
                  <span className="text-purple-200 text-xs font-semibold block">Total Verified Collected Revenue</span>
                  <span className="text-2xl sm:text-3xl font-black font-mono-num mt-1 block">
                    NPR {metrics.totalVerifiedRevenueNpr.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-purple-300 mt-2 block">
                    Collected across all verified tenant subscriptions
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 text-xs font-semibold block">Pending Invoice Submissions</span>
                  <span className="text-2xl font-bold font-mono-num text-amber-600 mt-1 block">
                    NPR {metrics.pendingRevenueNpr.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-2 block">
                    Awaiting Super Admin bank verification
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-slate-500 text-xs font-semibold block">Active vs Suspended Tenants</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold font-mono-num text-emerald-600">{metrics.activeBusinesses} Active</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-lg font-bold font-mono-num text-rose-600">{metrics.suspendedBusinesses} Suspended</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-2 block">
                    {metrics.totalBusinesses} total enterprise tenants
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CREATOR GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  <span>App Creator Operations Playbook ({MASTER_OWNER_EMAIL})</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Master Owner Sync अब पूर्ण रूपमा App Creator को लागि बनाइएको छ। तलको ५ चरणबाट सबै Client Businesses लाई सुरक्षित रूपमा manage गर्न सकिन्छ:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-amber-700">Step 1 · Creator Login</span>
                  <h4 className="font-bold text-slate-900">1. Sign in with Verified Creator Google</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>{MASTER_OWNER_EMAIL}</strong> बाट Google Connect गर्दा Header मा <strong>App Creator Sync</strong> र भूमिका <strong>SUPER_ADMIN</strong> खुल्छ। यसले Firestore बाट सबै client businesses तान्न र manage गर्न अनुमति दिन्छ।
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-purple-700">Step 2 · Onboard Client</span>
                  <h4 className="font-bold text-slate-900">2. Register & Sync New Businesses</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Tenants</strong> ट्याबमा <em>Register Business</em> बाट नयाँ क्याफे/रेस्टुरेन्ट/रिसोर्ट खोल्नुहोस् वा <em>Sync Cloud Tenants</em> थिची Cloud मा बनेका सबै client businesses यहाँ तान्नुहोस्।
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-indigo-700">Step 3 · Plans & Modules</span>
                  <h4 className="font-bold text-slate-900">3. Control Modules & SaaS Tiers</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    कुनै पनि client रोको <strong>Plan</strong> वा <strong>Modules</strong> बटनबाट Resort, KDS, Inventory वा Reports अन/अफ गर्नुहोस् — परिवर्तन सिधै Cloud Sync बाट client को डिभाइसमा लागू हुन्छ।
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-rose-700">Step 4 · Suspend / Reactivate</span>
                  <h4 className="font-bold text-slate-900">4. Remote Billing Lock & Payment Approval</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    भुक्तानी बाँकी रहेमा <strong>Suspend</strong> थिच्दा client टर्मिनलमा तुरुन्त POS/Billing लक हुन्छ (डाटा सुरक्षित रहन्छ)। <strong>Payment Approvals</strong> मा रसिद Verify गरी <strong>Reactivate</strong> गर्नुहोस्।
                  </p>
                </div>

                <div className="md:col-span-2 p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-emerald-800">Step 5 · Support & Staff Isolation</span>
                  <h4 className="font-bold text-slate-900">5. Troubleshoot Any Client Safely (Switch + Role Preview)</h4>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    कुनै client को समस्या हेर्न <strong>Switch</strong> थिची सो व्यवसाय खोल्नुहोस् र Header को Role Badge बाट Waiter / Cashier / Kitchen / Owner view जाँच गर्नुहोस्। Client को सामान्य Staff/Owner ले यो <strong>App Creator Hub</strong> देख्दैनन् र अरूको व्यवसायमा पहुँच पाउँदैनन्। प्रत्येक व्यवसायको <em>Owner Suite → Security</em> ट्याबबाट त्यहाँको कर्मचारी Gmail थप्न/हटाउन मिल्छ।
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <span>Active Context: <strong>{activeBusinessId}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Close Control Center
          </button>
        </div>

      </div>

      {/* SUSPENSION REASON MODAL */}
      {suspensionTargetBiz && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-bold text-base text-slate-900">
                Suspend Enterprise Tenant: {suspensionTargetBiz.businessName}
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Suspending this tenant will place operational modules (POS, Tables, KDS, Inventory, Resort) into restricted read-only access. All existing records and data will be safely preserved.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Suspension *</label>
              <textarea
                rows={3}
                required
                value={suspensionReasonInput}
                onChange={e => setSuspensionReasonInput(e.target.value)}
                placeholder="e.g. Subscription payment overdue / Terms violation / Manual review requested..."
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuspensionTargetBiz(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteSuspension}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs"
              >
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN PLAN MODAL */}
      {planChangeTargetBiz && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900">
              Change SaaS Plan for {planChangeTargetBiz.businessName}
            </h3>
            <p className="text-xs text-slate-500">
              Select the new plan tier. Module permissions will synchronize automatically without erasing any existing business records.
            </p>
            <div className="space-y-2">
              {plans.map(p => (
                <label key={p.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="selectedPlan" 
                      checked={selectedNewPlanId === p.id} 
                      onChange={() => setSelectedNewPlanId(p.id)} 
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{p.name}</span>
                      <span className="text-[10px] text-slate-500">{p.includedModules.length} modules, {p.staffLimit} staff</span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs text-purple-700">
                    {p.currency} {p.price.toLocaleString()}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPlanChangeTargetBiz(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePlanChange}
                className="px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-2xs"
              >
                Update Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODULE CONTROL MODAL */}
      {moduleModalBusiness && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900">
              Manage Modules: {moduleModalBusiness.businessName}
            </h3>
            <p className="text-xs text-slate-500">
              Enable or restrict application modules for this client. Essential POS & Settings modules remain locked on.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {ALL_APP_MODULES.map((mod) => {
                const isCoreLocked = mod === 'pos' || mod === 'settings';
                const checked = moduleDraft.includes(mod);
                return (
                  <label
                    key={mod}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold ${
                      checked ? 'border-indigo-300 bg-indigo-50/70 text-indigo-950' : 'border-slate-200 text-slate-600'
                    } ${isCoreLocked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="capitalize">{mod.replace(/_/g, ' ')}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isCoreLocked}
                      onChange={() => {
                        if (isCoreLocked) return;
                        setModuleDraft((prev) =>
                          prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
                        );
                      }}
                      className="rounded text-indigo-600"
                    />
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModuleModalBusiness(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateBusiness(moduleModalBusiness.businessId, { enabledModules: moduleDraft });
                  setModuleModalBusiness(null);
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs"
              >
                Save Modules
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT PAYMENT REASON MODAL */}
      {rejectingInvoiceId && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900">Reject Payment Verification</h3>
            <p className="text-xs text-slate-500">
              Provide a clear reason for rejecting invoice <strong>{rejectingInvoiceId}</strong>.
            </p>
            <textarea
              rows={3}
              value={rejectReasonInput}
              onChange={(e) => setRejectReasonInput(e.target.value)}
              placeholder="e.g. Transaction reference does not match bank statement..."
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingInvoiceId(null);
                  setRejectReasonInput('');
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleVerifyInvoice(
                    rejectingInvoiceId,
                    false,
                    rejectReasonInput.trim() || 'Verification failed'
                  )
                }
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
