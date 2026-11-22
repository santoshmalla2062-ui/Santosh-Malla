import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import { 
  hashPinWithSalt, 
  generateSalt, 
  createStaffAccount, 
  saveSession, 
  getCurrentSession, 
  clearSession, 
  hasPermission 
} from '../services/security';
import { StaffUser } from '../types';

test('Authentication: Salted SHA-256 PIN hashing & verification', async () => {
  const pin = '7788';
  const salt = generateSalt();
  const hash1 = await hashPinWithSalt(pin, salt);

  // Verifying with correct pin and same salt yields identical hash
  const hash2 = await hashPinWithSalt(pin, salt);
  assert.strictEqual(hash1, hash2, 'Identical PIN and salt must yield identical hash');

  // Different PIN fails match
  const wrongHash = await hashPinWithSalt('9999', salt);
  assert.notStrictEqual(hash1, wrongHash, 'Incorrect PIN must produce different hash');

  // Different salt for same PIN produces different hash (protection against rainbow tables)
  const salt2 = generateSalt();
  const hashDifferentSalt = await hashPinWithSalt(pin, salt2);
  assert.notStrictEqual(hash1, hashDifferentSalt, 'Same PIN with different salt must produce different hash');
});

test('Session Lifecycle: Persistence, expiration and teardown', async () => {
  sessionStorage.clear();

  const user: StaffUser = {
    id: 'staff-admin-01',
    username: 'admin',
    name: 'General Manager',
    nepaliName: 'प्रमुख व्यवस्थापक',
    role: 'ADMIN',
    pinHash: 'testhash',
    salt: 'testsalt',
    isActive: true,
    businessId: 'biz-himalayan-breeze',
    createdAt: '2026-10-10'
  };

  // 1. Create active session (60 mins)
  const session = saveSession(user, 60, 'biz-himalayan-breeze');
  assert.ok(session.token.startsWith('sess_'));
  assert.strictEqual(session.staffId, 'staff-admin-01');
  assert.strictEqual(session.role, 'ADMIN');

  // 2. Retrieve session from storage
  const retrieved = getCurrentSession();
  assert.ok(retrieved !== null, 'Session must be retrievable while valid');
  assert.strictEqual(retrieved?.username, 'admin');

  // 3. Clear session (logout)
  clearSession();
  const afterLogout = getCurrentSession();
  assert.strictEqual(afterLogout, null, 'Cleared session must return null');

  // 4. Expired session verification
  const expiredSession = saveSession(user, -5); // Created 5 minutes in the past
  const retrievedExpired = getCurrentSession();
  assert.strictEqual(retrievedExpired, null, 'Expired session must be automatically invalidated and purged');
});

test('RBAC Authorization Matrix: Enforce role-based boundaries', () => {
  // SUPER_ADMIN has master privileges
  assert.strictEqual(hasPermission('SUPER_ADMIN', 'MANAGE_ALL_BUSINESSES'), true);
  assert.strictEqual(hasPermission('SUPER_ADMIN', 'SETTLE_PAYMENT'), true);
  assert.strictEqual(hasPermission('SUPER_ADMIN', 'MODIFY_PRICING'), true);

  // OWNER & ADMIN have full business operational privileges
  assert.strictEqual(hasPermission('OWNER', 'SETTLE_PAYMENT'), true);
  assert.strictEqual(hasPermission('OWNER', 'MODIFY_PRICING'), true);
  assert.strictEqual(hasPermission('OWNER', 'IMPORT_BACKUP'), true);
  assert.strictEqual(hasPermission('OWNER', 'MANAGE_ALL_BUSINESSES'), false); // Cannot manage foreign businesses

  assert.strictEqual(hasPermission('ADMIN', 'SETTLE_PAYMENT'), true);
  assert.strictEqual(hasPermission('ADMIN', 'MODIFY_PRICING'), true);
  assert.strictEqual(hasPermission('ADMIN', 'IMPORT_BACKUP'), true);

  // CASHIER can settle bills but CANNOT modify menu pricing or import backups
  assert.strictEqual(hasPermission('CASHIER', 'SETTLE_PAYMENT'), true);
  assert.strictEqual(hasPermission('CASHIER', 'MODIFY_PRICING'), false);
  assert.strictEqual(hasPermission('CASHIER', 'IMPORT_BACKUP'), false);

  // WAITER can send KOT and settle table bills, but CANNOT modify prices or view settings
  assert.strictEqual(hasPermission('WAITER', 'SEND_KOT'), true);
  assert.strictEqual(hasPermission('WAITER', 'SETTLE_PAYMENT'), true);
  assert.strictEqual(hasPermission('WAITER', 'MODIFY_PRICING'), false);
  assert.strictEqual(hasPermission('WAITER', 'VIEW_TAB_SETTINGS'), false);

  // KITCHEN can view KDS and inventory ingredients, but CANNOT settle bills or modify prices
  assert.strictEqual(hasPermission('KITCHEN', 'VIEW_TAB_KDS'), true);
  assert.strictEqual(hasPermission('KITCHEN', 'VIEW_TAB_INVENTORY'), true);
  assert.strictEqual(hasPermission('KITCHEN', 'SETTLE_PAYMENT'), false);
  assert.strictEqual(hasPermission('KITCHEN', 'MODIFY_PRICING'), false);

  // HOUSEKEEPING can update cleaning status but CANNOT access POS or settlement
  assert.strictEqual(hasPermission('HOUSEKEEPING', 'UPDATE_CLEANING_STATUS'), true);
  assert.strictEqual(hasPermission('HOUSEKEEPING', 'SETTLE_PAYMENT'), false);
  assert.strictEqual(hasPermission('HOUSEKEEPING', 'VIEW_TAB_POS'), false);
});
