import { 
  AppModule, 
  BillingInterval, 
  BusinessStatus, 
  BusinessTenant, 
  StaffRole, 
  SubscriptionInvoice, 
  SubscriptionInvoiceStatus, 
  SubscriptionPlan, 
  SubscriptionStatus, 
  TenantSubscription 
} from '../types';
import { getRegisteredBusinesses, saveRegisteredBusinesses, updateBusiness } from './tenantStorage';
import { createAuditLog } from './security';

export const SUBSCRIPTION_PLANS_KEY = 'hb_subscription_plans_v1';
export const TENANT_SUBSCRIPTIONS_KEY = 'hb_tenant_subscriptions_v1';
export const SUBSCRIPTION_INVOICES_KEY = 'hb_subscription_invoices_v1';

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter POS (स्टार्टर)',
    nepaliName: 'स्टार्टर बिलिङ',
    description: 'Essential billing POS, basic tables, order history, and business administration for small cafes.',
    billingInterval: 'monthly',
    price: 1999,
    currency: 'NPR',
    includedModules: ['pos', 'tables_rooms', 'reports', 'settings', 'business_admin'],
    staffLimit: 5,
    maxProducts: 100,
    trialDays: 14,
    isTrialAvailable: true,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'plan-professional',
    name: 'Professional F&B (प्रोफेशनल)',
    nepaliName: 'प्रोफेशनल रेस्टुरेन्ट',
    description: 'Full restaurant operations with KOT/KDS kitchen display, recipe inventory tracking, customer khata, and day closing.',
    billingInterval: 'monthly',
    price: 4499,
    currency: 'NPR',
    includedModules: ['pos', 'tables_rooms', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
    staffLimit: 20,
    maxProducts: 500,
    trialDays: 14,
    isTrialAvailable: true,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'plan-resort-enterprise',
    name: 'Resort & Hotel Enterprise (रिसोर्ट / इन्टरप्राइज)',
    nepaliName: 'रिसोर्ट तथा होटल इन्टरप्राइज',
    description: 'Complete hospitality suite with Room PMS, reservations, guest folios, housekeeping, POS, KDS, inventory, and multi-station bar operations.',
    billingInterval: 'monthly',
    price: 8999,
    currency: 'NPR',
    includedModules: ['pos', 'tables_rooms', 'resort', 'kds', 'inventory', 'customers', 'day_closing', 'reports', 'settings', 'business_admin'],
    staffLimit: 100,
    maxProducts: 2000,
    maxRooms: 100,
    trialDays: 14,
    isTrialAvailable: true,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
];

// Helper: Safe browser storage
function getStorageItem(key: string): string | null {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error(`Storage error for key ${key}:`, err);
  }
}

// 1. Subscription Plans Management
export function getSubscriptionPlans(): SubscriptionPlan[] {
  const raw = getStorageItem(SUBSCRIPTION_PLANS_KEY);
  if (!raw) {
    setStorageItem(SUBSCRIPTION_PLANS_KEY, JSON.stringify(DEFAULT_SUBSCRIPTION_PLANS));
    return DEFAULT_SUBSCRIPTION_PLANS;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SUBSCRIPTION_PLANS;
  } catch {
    return DEFAULT_SUBSCRIPTION_PLANS;
  }
}

export function saveSubscriptionPlans(plans: SubscriptionPlan[]): void {
  setStorageItem(SUBSCRIPTION_PLANS_KEY, JSON.stringify(plans));
}

export function getSubscriptionPlan(planId: string): SubscriptionPlan {
  const plans = getSubscriptionPlans();
  return plans.find(p => p.id === planId) || plans[0] || DEFAULT_SUBSCRIPTION_PLANS[0];
}

export function createSubscriptionPlan(planData: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): SubscriptionPlan {
  const plans = getSubscriptionPlans();
  const id = 'plan-' + Date.now().toString(36);
  const now = new Date().toISOString().split('T')[0];
  const newPlan: SubscriptionPlan = {
    ...planData,
    id,
    createdAt: now,
    updatedAt: now
  };
  plans.push(newPlan);
  saveSubscriptionPlans(plans);
  return newPlan;
}

export function updateSubscriptionPlan(planId: string, updates: Partial<SubscriptionPlan>): SubscriptionPlan | null {
  const plans = getSubscriptionPlans();
  const idx = plans.findIndex(p => p.id === planId);
  if (idx === -1) return null;
  const updated: SubscriptionPlan = {
    ...plans[idx],
    ...updates,
    updatedAt: new Date().toISOString().split('T')[0]
  };
  plans[idx] = updated;
  saveSubscriptionPlans(plans);
  return updated;
}

// 2. Tenant Subscriptions
export function getAllTenantSubscriptions(): Record<string, TenantSubscription> {
  const raw = getStorageItem(TENANT_SUBSCRIPTIONS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveAllTenantSubscriptions(subs: Record<string, TenantSubscription>): void {
  setStorageItem(TENANT_SUBSCRIPTIONS_KEY, JSON.stringify(subs));
}

export function getTenantSubscription(businessId: string): TenantSubscription {
  const allSubs = getAllTenantSubscriptions();
  if (allSubs[businessId]) {
    return allSubs[businessId];
  }

  // Derive initial subscription from business tenant
  const businesses = getRegisteredBusinesses();
  const biz = businesses.find(b => b.businessId === businessId);
  const defaultPlanId = biz?.businessType.includes('RESORT') || biz?.businessType === 'HOTEL' 
    ? 'plan-resort-enterprise' 
    : (biz?.businessType === 'CAFE' ? 'plan-starter' : 'plan-professional');

  const now = new Date();
  const startDate = now.toISOString().split('T')[0];
  
  // 30 days renewal
  const nextRenewal = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const sub: TenantSubscription = {
    id: 'sub-' + businessId,
    businessId,
    planId: biz?.subscriptionPlanId || defaultPlanId,
    status: (biz?.subscriptionStatus as SubscriptionStatus) || 'ACTIVE',
    startDate,
    currentPeriodStart: startDate,
    currentPeriodEnd: nextRenewal,
    nextRenewalDate: nextRenewal,
    trialEndDate: trialEnd,
    autoRenew: true,
    createdAt: startDate,
    updatedAt: startDate
  };

  allSubs[businessId] = sub;
  saveAllTenantSubscriptions(allSubs);
  return sub;
}

export function saveTenantSubscription(sub: TenantSubscription): void {
  const allSubs = getAllTenantSubscriptions();
  allSubs[sub.businessId] = {
    ...sub,
    updatedAt: new Date().toISOString().split('T')[0]
  };
  saveAllTenantSubscriptions(allSubs);

  // Sync to BusinessTenant summary
  updateBusiness(sub.businessId, {
    subscriptionPlanId: sub.planId,
    subscriptionStatus: sub.status,
    subscriptionExpiresAt: sub.nextRenewalDate
  });
}

// 3. Status Transitions with Safeguards
export function transitionSubscriptionStatus(
  businessId: string, 
  newStatus: SubscriptionStatus, 
  reason?: string,
  actorName: string = 'Super Admin'
): TenantSubscription {
  const currentSub = getTenantSubscription(businessId);
  const now = new Date().toISOString().split('T')[0];

  const updated: TenantSubscription = {
    ...currentSub,
    status: newStatus,
    updatedAt: now
  };

  if (newStatus === 'SUSPENDED') {
    updated.suspensionReason = reason || 'Suspended by platform administrator';
    updated.suspendedBy = actorName;
    updated.suspendedAt = now;
  } else if (newStatus === 'CANCELLED') {
    updated.cancellationDate = now;
    updated.autoRenew = false;
  } else if (newStatus === 'ACTIVE') {
    updated.suspensionReason = undefined;
    updated.suspendedBy = undefined;
    updated.suspendedAt = undefined;
  }

  saveTenantSubscription(updated);

  // If suspended, update business status to SUSPENDED as well; if ACTIVE, ensure ACTIVE
  if (newStatus === 'SUSPENDED') {
    updateBusiness(businessId, { status: 'SUSPENDED', suspensionReason: reason });
  } else if (newStatus === 'ACTIVE') {
    updateBusiness(businessId, { status: 'ACTIVE', suspensionReason: undefined });
  }

  return updated;
}

// 4. Change Plan (Upgrade / Downgrade)
export function changeTenantPlan(
  businessId: string, 
  newPlanId: string, 
  notes?: string
): { subscription: TenantSubscription; invoice: SubscriptionInvoice } {
  const sub = getTenantSubscription(businessId);
  const targetPlan = getSubscriptionPlan(newPlanId);
  const businesses = getRegisteredBusinesses();
  const biz = businesses.find(b => b.businessId === businessId);
  const bizName = biz?.businessName || 'Business Tenant';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const updatedSub: TenantSubscription = {
    ...sub,
    planId: newPlanId,
    status: 'ACTIVE',
    currentPeriodStart: todayStr,
    currentPeriodEnd: nextMonth,
    nextRenewalDate: nextMonth,
    notes: notes || `Switched to ${targetPlan.name}`,
    updatedAt: todayStr
  };
  saveTenantSubscription(updatedSub);

  // Synchronize enabled modules to include the new plan's modules without wiping existing data
  if (biz) {
    const combinedModules = Array.from(new Set([...targetPlan.includedModules, 'pos', 'settings', 'business_admin'])) as AppModule[];
    updateBusiness(businessId, {
      enabledModules: combinedModules,
      subscriptionPlanId: newPlanId,
      subscriptionStatus: 'ACTIVE',
      subscriptionExpiresAt: nextMonth
    });
  }

  // Generate subscription billing invoice
  const invNumber = 'SUB-INV-' + now.getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);
  const invoice: SubscriptionInvoice = {
    id: invNumber,
    businessId,
    businessName: bizName,
    planId: newPlanId,
    planName: targetPlan.name,
    billingPeriod: `${todayStr} to ${nextMonth}`,
    amount: targetPlan.price,
    taxAmount: Math.round(targetPlan.price * 0.13), // 13% VAT
    totalAmount: Math.round(targetPlan.price * 1.13),
    currency: targetPlan.currency,
    status: 'PENDING',
    paymentNotes: notes,
    issuedAt: todayStr,
    dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  };

  const invoices = getSubscriptionInvoices();
  invoices.unshift(invoice);
  saveSubscriptionInvoices(invoices);

  return { subscription: updatedSub, invoice };
}

// 5. Subscription Invoices
export function getSubscriptionInvoices(businessId?: string): SubscriptionInvoice[] {
  const raw = getStorageItem(SUBSCRIPTION_INVOICES_KEY);
  let allInvoices: SubscriptionInvoice[] = [];
  if (!raw) {
    // Generate initial sample seed invoice for existing business
    const initialSeed: SubscriptionInvoice[] = [
      {
        id: 'SUB-INV-2026-1001',
        businessId: 'biz-himalayan-breeze',
        businessName: 'Himalayan Breeze Cafe & Resort',
        planId: 'plan-resort-enterprise',
        planName: 'Resort & Hotel Enterprise',
        billingPeriod: '2026-10-01 to 2026-11-01',
        amount: 8999,
        taxAmount: 1170,
        totalAmount: 10169,
        currency: 'NPR',
        status: 'PAID',
        paymentMethod: 'Fonepay QR Merchant',
        paymentReference: 'FP-9821837482',
        verifiedByStaffId: 'staff-super',
        verifiedByStaffName: 'Platform Super Admin',
        verifiedAt: '2026-10-02',
        issuedAt: '2026-10-01',
        dueDate: '2026-10-08',
        paidAt: '2026-10-02'
      }
    ];
    setStorageItem(SUBSCRIPTION_INVOICES_KEY, JSON.stringify(initialSeed));
    allInvoices = initialSeed;
  } else {
    try {
      allInvoices = JSON.parse(raw);
    } catch {
      allInvoices = [];
    }
  }

  if (businessId) {
    return allInvoices.filter(i => i.businessId === businessId);
  }
  return allInvoices;
}

export function saveSubscriptionInvoices(invoices: SubscriptionInvoice[]): void {
  setStorageItem(SUBSCRIPTION_INVOICES_KEY, JSON.stringify(invoices));
}

// 6. Submit Subscription Payment (Separate from customer dining bills)
export function submitSubscriptionPayment(
  invoiceId: string, 
  paymentMethod: string, 
  paymentReference: string, 
  notes?: string
): SubscriptionInvoice | null {
  const invoices = getSubscriptionInvoices();
  const idx = invoices.findIndex(i => i.id === invoiceId);
  if (idx === -1) return null;

  const target = invoices[idx];
  const updated: SubscriptionInvoice = {
    ...target,
    paymentMethod,
    paymentReference: paymentReference.trim(),
    paymentNotes: notes?.trim() || target.paymentNotes,
    status: 'PENDING'
  };

  invoices[idx] = updated;
  saveSubscriptionInvoices(invoices);
  return updated;
}

// 7. Verify Subscription Payment (Server-Verified Super Admin Action)
export function verifySubscriptionPayment(
  invoiceId: string, 
  isApproved: boolean, 
  verifier: { id: string; name: string }, 
  rejectReason?: string
): { invoice: SubscriptionInvoice; subscription?: TenantSubscription } {
  const invoices = getSubscriptionInvoices();
  const idx = invoices.findIndex(i => i.id === invoiceId);
  if (idx === -1) {
    throw new Error('Subscription invoice not found: ' + invoiceId);
  }

  const inv = invoices[idx];
  const now = new Date().toISOString().split('T')[0];

  const updatedInv: SubscriptionInvoice = {
    ...inv,
    status: isApproved ? 'PAID' : 'REJECTED',
    verifiedByStaffId: verifier.id,
    verifiedByStaffName: verifier.name,
    verifiedAt: now,
    paidAt: isApproved ? now : undefined,
    paymentNotes: isApproved ? inv.paymentNotes : (rejectReason || 'Payment rejected during verification')
  };
  invoices[idx] = updatedInv;
  saveSubscriptionInvoices(invoices);

  let updatedSub: TenantSubscription | undefined;
  if (isApproved) {
    // Extend subscription period by 30 days and mark ACTIVE
    const sub = getTenantSubscription(inv.businessId);
    const renewalDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    updatedSub = {
      ...sub,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: renewalDate,
      nextRenewalDate: renewalDate,
      suspensionReason: undefined,
      updatedAt: now
    };
    saveTenantSubscription(updatedSub);
    updateBusiness(inv.businessId, { status: 'ACTIVE', subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: renewalDate });
  }

  return { invoice: updatedInv, subscription: updatedSub };
}

// 8. Module Access Control Guard (Prevents unauthorized module execution)
export function isModuleAllowedForBusiness(
  business: BusinessTenant, 
  module: AppModule
): { allowed: boolean; reason?: string } {
  // Core infrastructure is always allowed
  if (module === 'pos' || module === 'settings' || module === 'business_admin') {
    return { allowed: true };
  }

  // If business is suspended, block operational modules
  if (business.status === 'SUSPENDED') {
    return { 
      allowed: false, 
      reason: `Business account is suspended (${business.suspensionReason || 'Contact platform administration'}). Operational modules are in read-only / restricted state.` 
    };
  }

  const sub = getTenantSubscription(business.businessId);
  if (sub.status === 'EXPIRED') {
    return { 
      allowed: false, 
      reason: 'Subscription period has expired. Please renew your plan to restore full module access.' 
    };
  }

  const plan = getSubscriptionPlan(sub.planId);
  const isIncludedInPlan = plan.includedModules.includes(module);
  const isEnabledInTenant = business.enabledModules.includes(module);

  if (!isIncludedInPlan) {
    return { 
      allowed: false, 
      reason: `The module "${module.replace(/_/g, ' ')}" is not included in your current plan (${plan.name}). Please upgrade to access this feature.` 
    };
  }

  if (!isEnabledInTenant) {
    return { 
      allowed: false, 
      reason: `The module "${module.replace(/_/g, ' ')}" is disabled in your business settings.` 
    };
  }

  return { allowed: true };
}

// 9. Platform-Level Subscription Analytics (No private customer data exposed)
export function getPlatformSubscriptionMetrics(): {
  totalBusinesses: number;
  activeBusinesses: number;
  trialBusinesses: number;
  suspendedBusinesses: number;
  expiredSubscriptions: number;
  totalVerifiedRevenueNpr: number;
  pendingRevenueNpr: number;
} {
  const businesses = getRegisteredBusinesses();
  const subscriptions = Object.values(getAllTenantSubscriptions());
  const invoices = getSubscriptionInvoices();

  const totalBusinesses = businesses.length;
  const activeBusinesses = businesses.filter(b => b.status === 'ACTIVE').length;
  const suspendedBusinesses = businesses.filter(b => b.status === 'SUSPENDED').length;
  const trialBusinesses = subscriptions.filter(s => s.status === 'TRIAL').length;
  const expiredSubscriptions = subscriptions.filter(s => s.status === 'EXPIRED' || s.status === 'PAST_DUE').length;

  const totalVerifiedRevenueNpr = invoices
    .filter(i => i.status === 'PAID')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const pendingRevenueNpr = invoices
    .filter(i => i.status === 'PENDING')
    .reduce((sum, i) => sum + i.totalAmount, 0);

  return {
    totalBusinesses,
    activeBusinesses,
    trialBusinesses,
    suspendedBusinesses,
    expiredSubscriptions,
    totalVerifiedRevenueNpr,
    pendingRevenueNpr
  };
}
