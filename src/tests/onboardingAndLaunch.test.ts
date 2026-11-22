import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import { 
  registerNewBusiness, 
  getRegisteredBusinesses, 
  loadTenantAppState, 
  getMemberships, 
  getActiveBusinessId,
  canUserAccessBusiness,
  updateBusiness
} from '../services/tenantStorage';
import { BusinessType } from '../types';

test('Onboarding: Real Business Registration with Clean Slate', () => {
  localStorage.clear();

  const registrationInput = {
    businessName: 'Kathmandu Heights Cafe & Rooftop',
    nepaliBusinessName: 'काठमाडौँ हाइट्स क्याफे',
    tagline: 'Artisan Coffee with Himalayan Horizon',
    businessType: 'CAFE' as BusinessType,
    phone: '+977 1 4412345',
    email: 'info@ktmheights.com',
    address: 'Baluwatar-4, Kathmandu, Nepal',
    panVatNumber: '609876543',
    ownerId: 'owner-sunil-ktm',
    ownerName: 'Sunil Bajracharya',
    environment: 'production' as const,
    templateType: 'clean_slate' as const
  };

  // 1. Register new real business
  const { business, state } = registerNewBusiness(registrationInput);

  assert.ok(business.businessId.startsWith('biz-cafe-'), 'Business ID must have valid tenant prefix');
  assert.strictEqual(business.businessName, 'Kathmandu Heights Cafe & Rooftop');
  assert.strictEqual(business.environment, 'production', 'Workspace must be marked as production');
  assert.strictEqual(business.templateType, 'clean_slate');

  // 2. Clean slate verification: zero demo orders, dishes, tables, or expenses
  assert.strictEqual(state.menuItems.length, 0, 'Clean slate must have empty menu items');
  assert.strictEqual(state.tablesRooms.length, 0, 'Clean slate must have empty tables');
  assert.strictEqual(state.inventoryItems.length, 0, 'Clean slate must have empty inventory');
  assert.strictEqual(state.orders.length, 0, 'Clean slate must have zero sample orders');
  assert.strictEqual(state.expenses.length, 0, 'Clean slate must have zero sample expenses');
  assert.strictEqual(state.dayClosings.length, 0, 'Clean slate must have zero sample day closings');

  // 3. Verify registry & active business
  const registered = getRegisteredBusinesses();
  assert.ok(registered.some(b => b.businessId === business.businessId), 'New business must be present in registry');
  assert.strictEqual(getActiveBusinessId(), business.businessId, 'Newly registered business must become active');

  // 4. Verify Owner membership created
  const memberships = getMemberships();
  const ownerMembership = memberships.find(m => m.businessId === business.businessId && m.userId === 'owner-sunil-ktm');
  assert.ok(ownerMembership, 'Owner membership must be recorded');
  assert.strictEqual(ownerMembership?.role, 'OWNER');
  assert.strictEqual(ownerMembership?.status, 'ACTIVE');

  // 5. Access check: Owner Sunil can access his business
  const hasAccess = canUserAccessBusiness({ id: 'owner-sunil-ktm', role: 'OWNER', businessId: business.businessId }, business.businessId);
  assert.strictEqual(hasAccess, true, 'Owner must have verified access to his business');
});

test('Onboarding: Duplicate Business Name Prevention', () => {
  localStorage.clear();

  const firstInput = {
    businessName: 'Lakeside Organic Bistro',
    businessType: 'RESTAURANT' as BusinessType,
    phone: '9841112233',
    email: 'contact@lakesidebistro.com',
    address: 'Lakeside, Pokhara',
    ownerId: 'owner-1',
    ownerName: 'Owner One'
  };

  registerNewBusiness(firstInput);

  // Attempt to register again with identical name (case-insensitive)
  const duplicateInput = {
    businessName: '  lakeside organic bistro  ',
    businessType: 'RESTAURANT' as BusinessType,
    phone: '9849998877',
    email: 'dup@lakesidebistro.com',
    address: 'Other Location',
    ownerId: 'owner-2',
    ownerName: 'Owner Two'
  };

  assert.throws(() => {
    registerNewBusiness(duplicateInput);
  }, /already registered/i, 'Duplicate business name registration must throw descriptive error');
});

test('Onboarding: Starter Template provides sample catalog with zero financial history', () => {
  localStorage.clear();

  const starterInput = {
    businessName: 'Nagarkot Mountain Resort & Spa',
    businessType: 'RESORT' as BusinessType,
    phone: '9851002233',
    email: 'info@nagarkotresort.np',
    address: 'Nagarkot, Bhaktapur',
    ownerId: 'owner-nagarkot',
    ownerName: 'Pasang Sherpa',
    environment: 'production' as const,
    templateType: 'starter' as const
  };

  const { business, state } = registerNewBusiness(starterInput);

  // Starter template pre-populates menu & rooms for quick launch
  assert.ok(state.menuItems.length > 0, 'Starter template should contain starter dishes');
  assert.ok(state.tablesRooms.length > 0, 'Starter template should contain tables');
  
  // BUT all financial history, orders, expenses, day closings MUST be pristine empty
  assert.strictEqual(state.orders.length, 0, 'Starter business must not contain fake orders');
  assert.strictEqual(state.expenses.length, 0, 'Starter business must not contain fake expenses');
  assert.strictEqual(state.dayClosings.length, 0, 'Starter business must not contain fake day closings');
  assert.strictEqual(state.khataTransactions.length, 0, 'Starter business must not contain fake khata transactions');
});

test('Onboarding & Admin: Update business name immediately persists in tenant record', () => {
  localStorage.clear();

  const initialBiz = registerNewBusiness({
    businessName: 'Original Cafe & Bakery',
    businessType: 'CAFE' as BusinessType,
    phone: '9841000000',
    email: 'hello@originalcafe.com',
    address: 'Kathmandu',
    ownerId: 'owner-edit-test',
    ownerName: 'Test Owner'
  });

  const bizId = initialBiz.business.businessId;

  // 1. Update business name via updateBusiness
  const updated = updateBusiness(bizId, {
    businessName: 'Himalayan Sunrise Artisan Cafe & Roastery'
  });

  assert.ok(updated, 'updateBusiness should return updated business tenant');
  assert.strictEqual(updated?.businessName, 'Himalayan Sunrise Artisan Cafe & Roastery');

  // 2. Verify registry is immediately updated
  const registered = getRegisteredBusinesses();
  const foundInRegistry = registered.find(b => b.businessId === bizId);
  assert.strictEqual(foundInRegistry?.businessName, 'Himalayan Sunrise Artisan Cafe & Roastery');

  // 3. Verify tenant state settings are immediately updated
  const tenantState = loadTenantAppState(bizId);
  assert.strictEqual(tenantState.settings.businessName, 'Himalayan Sunrise Artisan Cafe & Roastery');

  // 4. Reject empty business name
  assert.throws(() => {
    updateBusiness(bizId, { businessName: '   ' });
  }, /cannot be empty/i);
});
