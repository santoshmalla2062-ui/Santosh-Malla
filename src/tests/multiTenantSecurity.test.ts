import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  getRegisteredBusinesses, 
  getBusinessesForUser,
  canActorCreateBusiness,
  registerNewBusiness, 
  saveTenantAppState, 
  loadTenantAppState, 
  canUserAccessBusiness, 
  TENANT_STORAGE_PREFIX, 
  BUSINESSES_REGISTRY_KEY 
} from '../services/tenantStorage';
import { hasPermission } from '../services/security';
import { getInitialAppState } from '../services/storage';
import { StaffUser, BusinessTenant, Session } from '../types';

// Mock localStorage / sessionStorage in Node environment for headless test execution
class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new LocalStorageMock();
}
if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new LocalStorageMock();
}

test('Multi-Tenant Isolation: Business A and Business B data partition', () => {
  localStorage.clear();

  // Create Business A
  const bizAId = 'biz-cafe-pokhara';
  const stateA = getInitialAppState();
  stateA.businessId = bizAId;
  stateA.settings.businessId = bizAId;
  stateA.settings.businessName = 'Pokhara Lakeside Cafe';
  stateA.menuItems = [
    {
      id: 'item-a-1',
      code: 'LAK-01',
      name: 'Lakeside Special Filter Coffee',
      nepaliName: 'लेकसाइड स्पेशल कफी',
      category: 'coffee',
      price: 250,
      costPrice: 70,
      isAvailable: true
    }
  ];

  // Create Business B
  const bizBId = 'biz-resort-kathmandu';
  const stateB = getInitialAppState();
  stateB.businessId = bizBId;
  stateB.settings.businessId = bizBId;
  stateB.settings.businessName = 'Himalayan Ridge Resort Kathmandu';
  stateB.menuItems = [
    {
      id: 'item-b-1',
      code: 'RID-01',
      name: 'Ridge Royal Breakfast',
      nepaliName: 'रिज रोयल ब्रेकफास्ट',
      category: 'dining_food',
      price: 950,
      costPrice: 350,
      isAvailable: true
    }
  ];

  // Save both states
  saveTenantAppState(bizAId, stateA);
  saveTenantAppState(bizBId, stateB);

  // 1. Verify separate storage keys
  const rawA = localStorage.getItem(`${TENANT_STORAGE_PREFIX}${bizAId}`);
  const rawB = localStorage.getItem(`${TENANT_STORAGE_PREFIX}${bizBId}`);

  assert.ok(rawA, 'Business A raw data must exist in dedicated storage partition');
  assert.ok(rawB, 'Business B raw data must exist in dedicated storage partition');
  assert.notStrictEqual(rawA, rawB, 'Storage data for Business A and B must never be identical');

  // 2. Load Business A and verify Business B items are absent
  const loadedA = loadTenantAppState(bizAId);
  assert.strictEqual(loadedA.settings.businessName, 'Pokhara Lakeside Cafe');
  assert.strictEqual(loadedA.menuItems.length, 1);
  assert.strictEqual(loadedA.menuItems[0].name, 'Lakeside Special Filter Coffee');
  assert.ok(!loadedA.menuItems.some(i => i.id === 'item-b-1'), 'Business A must not leak Business B items');

  // 3. Load Business B and verify Business A items are absent
  const loadedB = loadTenantAppState(bizBId);
  assert.strictEqual(loadedB.settings.businessName, 'Himalayan Ridge Resort Kathmandu');
  assert.strictEqual(loadedB.menuItems.length, 1);
  assert.strictEqual(loadedB.menuItems[0].name, 'Ridge Royal Breakfast');
  assert.ok(!loadedB.menuItems.some(i => i.id === 'item-a-1'), 'Business B must not leak Business A items');
});

test('Multi-Tenant Authorization: User Membership & Super Admin Access', () => {
  const staffBizA: StaffUser = {
    id: 'staff-a',
    username: 'ram_pokhara',
    name: 'Ram Shrestha',
    nepaliName: 'राम श्रेष्ठ',
    role: 'CASHIER',
    pinHash: 'hash',
    salt: 'salt',
    isActive: true,
    businessId: 'biz-cafe-pokhara',
    createdAt: '2026-10-10'
  };

  const superAdminUser: StaffUser = {
    id: 'staff-super',
    username: 'super_admin',
    name: 'Platform Super Admin',
    nepaliName: 'सुपर एडमिन',
    role: 'SUPER_ADMIN',
    pinHash: 'hash',
    salt: 'salt',
    isActive: true,
    createdAt: '2026-10-10'
  };

  // Cashier from Pokhara should have access to Pokhara but NOT to Kathmandu
  const accessPokhara = canUserAccessBusiness(staffBizA, 'biz-cafe-pokhara');
  const accessKathmandu = canUserAccessBusiness(staffBizA, 'biz-resort-kathmandu');

  assert.strictEqual(accessPokhara, true, 'Staff must have access to their own business');
  assert.strictEqual(accessKathmandu, false, 'Ordinary staff must be blocked from foreign business tenant');

  // Super Admin can access any business across the platform
  const superAccessPokhara = canUserAccessBusiness(superAdminUser, 'biz-cafe-pokhara');
  const superAccessKathmandu = canUserAccessBusiness(superAdminUser, 'biz-resort-kathmandu');

  assert.strictEqual(superAccessPokhara, true, 'SUPER_ADMIN must be authorized across all tenants');
  assert.strictEqual(superAccessKathmandu, true, 'SUPER_ADMIN must be authorized across all tenants');
});

test('Multi-Tenant Security: One-business-per-account cap & zero foreign workspace leakage', () => {
  localStorage.clear();

  // 1. Fresh owner can create their first business
  const firstCheck = canActorCreateBusiness({
    id: 'owner-single-1',
    role: 'OWNER',
    email: 'ramcafe@example.com'
  });
  assert.strictEqual(firstCheck.allowed, true);

  const firstCreated = registerNewBusiness({
    businessName: 'Ram Lakeside Coffee',
    businessType: 'CAFE',
    phone: '9841000011',
    email: 'ramcafe@example.com',
    address: 'Pokhara',
    ownerId: 'owner-single-1',
    ownerName: 'Ram Thapa',
    environment: 'production',
    enforceSingleBusinessCap: true,
    actorRole: 'OWNER'
  });

  // 2. Second business creation by the same owner MUST be blocked
  const secondCheck = canActorCreateBusiness({
    id: 'owner-single-1',
    role: 'OWNER',
    email: 'ramcafe@example.com',
    businessId: firstCreated.business.businessId
  });
  assert.strictEqual(secondCheck.allowed, false, 'Owner with 1 business must be blocked from creating a 2nd business');

  assert.throws(
    () =>
      registerNewBusiness({
        businessName: 'Ram Second Restaurant',
        businessType: 'RESTAURANT',
        phone: '9841000022',
        email: 'ramcafe@example.com',
        address: 'Kathmandu',
        ownerId: 'owner-single-1',
        ownerName: 'Ram Thapa',
        environment: 'production',
        enforceSingleBusinessCap: true,
        actorRole: 'OWNER'
      }),
    /Single-Business Policy/i
  );

  // 3. Staff roles (ADMIN / MANAGER) cannot create separate businesses
  assert.strictEqual(hasPermission('ADMIN', 'CREATE_BUSINESS'), false);
  assert.strictEqual(hasPermission('MANAGER', 'CREATE_BUSINESS'), false);
  assert.strictEqual(
    canActorCreateBusiness({ id: 'staff-mgr-1', role: 'MANAGER', businessId: firstCreated.business.businessId }).allowed,
    false
  );

  // 4. Owner only sees their own business — NEVER pre-seeded/foreign businesses
  const visibleToOwner = getBusinessesForUser('owner-single-1', 'OWNER', firstCreated.business.businessId);
  assert.strictEqual(visibleToOwner.length, 1);
  assert.strictEqual(visibleToOwner[0].businessId, firstCreated.business.businessId);
  assert.strictEqual(
    canUserAccessBusiness(
      { id: 'owner-single-1', role: 'OWNER', businessId: firstCreated.business.businessId },
      'biz-annapurna-coffee'
    ),
    false,
    'Owner must NEVER access another business workspace'
  );
  assert.strictEqual(
    canUserAccessBusiness(
      { id: 'owner-single-1', role: 'OWNER', businessId: firstCreated.business.businessId },
      'biz-phewa-dining'
    ),
    false
  );

  // 5. Verified SUPER_ADMIN retains multi-tenant creation and management
  const superCheck = canActorCreateBusiness({
    id: 'super-uid',
    role: 'SUPER_ADMIN',
    isAppCreator: true
  });
  assert.strictEqual(superCheck.allowed, true);
});

