import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import fs from 'node:fs';
import path from 'node:path';
import { 
  hashPinWithSalt, 
  generateSalt, 
  createStaffAccount, 
  saveSession, 
  getCurrentSession, 
  clearSession, 
  hasPermission,
  SUBORDINATE_STAFF_ROLES,
  isOwnerOrAdminRole,
  canActorManageStaff,
  getAssignableRolesForActor,
  canActorManageStaffMember,
  canActorAssignRole
} from '../services/security';
import { formatFirebaseAuthError } from '../firebase';
import { buildStaffInviteUrl } from '../utils/distribution';
import { StaffRole, StaffUser } from '../types';

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

  // MANAGER can manage operational staff & invites, but CANNOT bypass Admin governance controls
  assert.strictEqual(hasPermission('MANAGER', 'MANAGE_STAFF'), true);
  assert.strictEqual(hasPermission('MANAGER', 'MANAGE_BUSINESS_STAFF'), true);
  assert.strictEqual(hasPermission('MANAGER', 'INVITE_STAFF'), true);
  assert.strictEqual(hasPermission('MANAGER', 'VIEW_TAB_BUSINESS_ADMIN'), true);
  assert.strictEqual(hasPermission('MANAGER', 'MANAGE_ROLES_PERMISSIONS'), false);
  assert.strictEqual(hasPermission('MANAGER', 'MANAGE_BUSINESS_MODULES'), false);
  assert.strictEqual(hasPermission('MANAGER', 'MODIFY_TAX_CONFIG'), false);
  assert.strictEqual(hasPermission('MANAGER', 'MANAGE_PAYMENT_METHODS'), false);

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

test('Role Hierarchy & Anti-Escalation: Only Admin & Manager can assign roles with strict boundaries', () => {
  assert.strictEqual(isOwnerOrAdminRole('OWNER'), true);
  assert.strictEqual(isOwnerOrAdminRole('ADMIN'), true);
  assert.strictEqual(isOwnerOrAdminRole('MANAGER'), false);

  assert.strictEqual(canActorManageStaff('OWNER'), true);
  assert.strictEqual(canActorManageStaff('ADMIN'), true);
  assert.strictEqual(canActorManageStaff('MANAGER'), true);
  assert.strictEqual(canActorManageStaff('CASHIER'), false);
  assert.strictEqual(canActorManageStaff('WAITER'), false);
  assert.strictEqual(canActorManageStaff('KITCHEN'), false);

  // Assignable role lists
  const adminAssignable = getAssignableRolesForActor('ADMIN');
  assert.ok(adminAssignable.includes('ADMIN'));
  assert.ok(adminAssignable.includes('MANAGER'));
  assert.ok(!adminAssignable.includes('OWNER'));
  assert.ok(!adminAssignable.includes('SUPER_ADMIN'));

  const managerAssignable = getAssignableRolesForActor('MANAGER');
  assert.deepStrictEqual(managerAssignable, [...SUBORDINATE_STAFF_ROLES]);
  assert.ok(!managerAssignable.includes('OWNER'));
  assert.ok(!managerAssignable.includes('ADMIN'));
  assert.ok(!managerAssignable.includes('MANAGER'));

  assert.deepStrictEqual(getAssignableRolesForActor('WAITER'), []);
  assert.deepStrictEqual(getAssignableRolesForActor('CASHIER'), []);

  // Existing member edit protection
  assert.strictEqual(canActorManageStaffMember('ADMIN', 'OWNER'), false);
  assert.strictEqual(canActorManageStaffMember('ADMIN', 'SUPER_ADMIN'), false);
  assert.strictEqual(canActorManageStaffMember('ADMIN', 'MANAGER'), true);
  assert.strictEqual(canActorManageStaffMember('ADMIN', 'WAITER'), true);

  assert.strictEqual(canActorManageStaffMember('MANAGER', 'OWNER'), false);
  assert.strictEqual(canActorManageStaffMember('MANAGER', 'ADMIN'), false);
  assert.strictEqual(canActorManageStaffMember('MANAGER', 'MANAGER'), false);
  assert.strictEqual(canActorManageStaffMember('MANAGER', 'WAITER'), true);
  assert.strictEqual(canActorManageStaffMember('MANAGER', 'CASHIER'), true);

  // Role assignment checks (including existing target role)
  assert.strictEqual(canActorAssignRole('ADMIN', 'MANAGER', 'WAITER'), true);
  assert.strictEqual(canActorAssignRole('ADMIN', 'ADMIN', 'MANAGER'), true);
  assert.strictEqual(canActorAssignRole('ADMIN', 'OWNER', 'WAITER'), false);

  assert.strictEqual(canActorAssignRole('MANAGER', 'CASHIER', 'WAITER'), true);
  assert.strictEqual(canActorAssignRole('MANAGER', 'MANAGER', 'WAITER'), false);
  assert.strictEqual(canActorAssignRole('MANAGER', 'ADMIN', 'WAITER'), false);
  assert.strictEqual(canActorAssignRole('MANAGER', 'WAITER', 'ADMIN'), false);

  const nonManagers: StaffRole[] = ['CASHIER', 'WAITER', 'KITCHEN', 'RECEPTIONIST', 'HOUSEKEEPING', 'ACCOUNTANT', 'INVENTORY_STAFF', 'STAFF'];
  for (const role of nonManagers) {
    assert.strictEqual(canActorAssignRole(role, 'STAFF'), false);
  }
});

test('Firebase Auth Errors: Bilingual Nepali & English messaging', () => {
  const opDisabledEn = formatFirebaseAuthError({ code: 'auth/operation-not-allowed' }, 'en');
  const opDisabledNe = formatFirebaseAuthError({ code: 'auth/operation-not-allowed' }, 'ne');
  assert.ok(opDisabledEn.includes('Firebase Console'));
  assert.ok(opDisabledNe.includes('Firebase Console'));

  const badCredEn = formatFirebaseAuthError({ code: 'auth/invalid-credential' }, 'en');
  const badCredNe = formatFirebaseAuthError({ code: 'auth/invalid-credential' }, 'ne');
  assert.ok(badCredEn.toLowerCase().includes('email or password'));
  assert.ok(badCredNe.includes('इमेल वा पासवर्ड'));

  const rateLimitNe = formatFirebaseAuthError({ code: 'auth/too-many-requests' }, 'ne');
  assert.ok(rateLimitNe.includes('पर्खेर'));
});

test('Firestore Rules: Manager subordinate-only & Admin role constraints on invites and members', () => {
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(rulesText.includes('function isSubordinateStaffRole(role)'), 'Subordinate role helper must be defined in firestore.rules');
  assert.ok(rulesText.includes("hasMemberRole(businessId, ['MANAGER']) && isSubordinateStaffRole(incoming().role)"), 'Invites create rule must restrict MANAGER to subordinate staff roles');
  assert.ok(rulesText.includes('isSubordinateStaffRole(existing().role) &&\n              isSubordinateStaffRole(incoming().role)'), 'Invites and members update rules must block MANAGER privilege escalation');
});

test('Staff Invite Link: Builds direct pre-filled join URL without download portal detour', () => {
  const url = buildStaffInviteUrl({
    baseUrl: 'https://pos.example.com/',
    businessId: 'biz-himalayan-breeze',
    inviteCode: 'inv-abc123',
    email: 'Sita@Example.com',
    name: 'Sita Gurung'
  });
  assert.ok(url.startsWith('https://pos.example.com/?'));
  assert.ok(!url.includes('download=1'), 'Direct join link must land straight on login/invite screen');
  const parsed = new URL(url);
  assert.strictEqual(parsed.searchParams.get('biz'), 'biz-himalayan-breeze');
  assert.strictEqual(parsed.searchParams.get('invite'), 'INV-ABC123');
  assert.strictEqual(parsed.searchParams.get('email'), 'sita@example.com');
  assert.strictEqual(parsed.searchParams.get('name'), 'Sita Gurung');
});

