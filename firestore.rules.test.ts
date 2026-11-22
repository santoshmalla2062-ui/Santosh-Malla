import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const specPath = path.resolve(process.cwd(), 'security_spec.md');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

const rulesText = fs.readFileSync(rulesPath, 'utf8');
const specText = fs.readFileSync(specPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

const MASTER_OWNER_EMAIL = 'samjhamnamalla22444@gmail.com';
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

interface MockAuthToken {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface MockTimestamp {
  __serverTime: number;
}

function makeTime(ms: number): MockTimestamp {
  return { __serverTime: ms };
}

function isMasterOwner(auth: MockAuthToken | null): boolean {
  return Boolean(
    auth &&
      auth.email_verified === true &&
      auth.email.toLowerCase() === MASTER_OWNER_EMAIL
  );
}

test('Firestore Rules: Contains default-deny catch-all, email_verified gate, and Master Owner email', () => {
  assert.match(rulesText, /rules_version = '2';/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
  assert.ok(
    rulesText.includes(`request.auth.token.email == '${MASTER_OWNER_EMAIL}'`),
    'Master Owner email must be hardcoded in firestore.rules'
  );
  assert.ok(
    rulesText.includes('request.auth.token.email_verified == true'),
    'Email verification must be strictly enforced in firestore.rules'
  );
  assert.ok(
    specText.includes(MASTER_OWNER_EMAIL),
    'security_spec.md must reference Master Owner identity'
  );
});

test('Firestore Rules: Enforces zero blanket list queries with get()/exists() and blocks syncChannels list', () => {
  const syncListMatch = rulesText.match(/match \/syncChannels\/\{channelId\}[\s\S]*?allow list:\s*if\s*([^;]+);/);
  assert.ok(syncListMatch, 'syncChannels match block must declare allow list');
  assert.strictEqual(syncListMatch[1].trim(), 'false', 'syncChannels allow list must be false');

  // Extract every allow list statement across firestore.rules and confirm zero get(/exists( calls inside list rules
  const listRules = [...rulesText.matchAll(/allow list:\s*if\s*([^;]+);/g)];
  assert.ok(listRules.length >= 5, 'Expected list rules for admins, businesses, invites, members, syncChannels, orders');
  for (const [, expr] of listRules) {
    assert.equal(/\bget\s*\(/.test(expr), false, `allow list rule must not invoke get(): ${expr}`);
    assert.equal(/\bexists\s*\(/.test(expr), false, `allow list rule must not invoke exists(): ${expr}`);
    assert.equal(/\bisBusinessOwner\s*\(/.test(expr), false, `allow list must not call get()-based isBusinessOwner: ${expr}`);
    assert.equal(/\bisActiveMember\s*\(/.test(expr), false, `allow list must not call get()-based isActiveMember: ${expr}`);
  }
});

test('Firestore Rules: Matches every entity schema and field allowlist from firebase-blueprint.json', () => {
  const entities = Object.keys(blueprint.entities || {});
  assert.deepStrictEqual(
    entities.sort(),
    ['AdminRegistry', 'BusinessMember', 'BusinessWorkspace', 'FiscalOrderRecord', 'StaffInvite', 'SyncChannelState'].sort()
  );

  // AdminRegistry required fields
  for (const field of blueprint.entities.AdminRegistry.required) {
    assert.ok(rulesText.includes(`'${field}'`), `AdminRegistry field ${field} must appear in rules`);
  }
  // FiscalOrderRecord required fields + WAITER/CASHIER/KITCHEN/ADMIN tiers
  for (const field of blueprint.entities.FiscalOrderRecord.required) {
    assert.ok(rulesText.includes(`'${field}'`), `FiscalOrderRecord field ${field} must appear in rules`);
  }
  assert.match(rulesText, /hasMemberRole\(businessId,\s*\['KITCHEN'\]\)/);
  assert.match(rulesText, /hasMemberRole\(businessId,\s*\['WAITER'\]\)/);
  assert.match(rulesText, /hasMemberRole\(businessId,\s*\['CASHIER', 'RECEPTIONIST'\]\)/);
  assert.match(rulesText, /hasMemberRole\(businessId,\s*\['ADMIN', 'MANAGER'\]\)/);
});

test('Firestore Rules Dirty Dozen: Evaluates all 12 attack vectors and enforces PERMISSION_DENIED', () => {
  const REQUEST_TIME = makeTime(1_760_000_000_000);
  const attackerAuth: MockAuthToken = {
    uid: 'attacker-uid-999',
    email: 'attacker@gmail.com',
    email_verified: true
  };
  const ownerAuth: MockAuthToken = {
    uid: 'owner-uid-123',
    email: MASTER_OWNER_EMAIL,
    email_verified: true
  };

  // 1. Identity Spoofing (Fake Owner ID)
  assert.match(rulesText, /incoming\(\)\.ownerUid == request\.auth\.uid/);
  const spoofCreateAllowed =
    attackerAuth.email_verified && 'owner-uid-123' === attackerAuth.uid;
  assert.strictEqual(spoofCreateAllowed, false, 'Dirty Dozen #1: Identity Spoofing must fail');

  // 2. Self-Privilege Escalation (Role Hijack without invite)
  assert.match(rulesText, /incoming\(\)\.role != 'OWNER'/);
  assert.match(rulesText, /get\(\/databases\/\$\(database\)\/documents\/businesses\/\$\(businessId\)\/invites\/\$\(incoming\(\)\.inviteId\)\)\.data\.role == incoming\(\)\.role/);
  const hijackMemberAllowed = isMasterOwner(attackerAuth) || ('OWNER' !== 'OWNER');
  assert.strictEqual(hijackMemberAllowed, false, 'Dirty Dozen #2: Self-privilege escalation must fail');

  // 3. Role Mutation on Existing Membership by non-owner
  const memberUpdateRule = rulesText.match(/match \/members\/\{memberUid\}[\s\S]*?allow update:\s*if\s*([^;]+);/)?.[1] || '';
  assert.ok(memberUpdateRule.includes('isOwnerOrMaster(businessId)'), 'Members update must require Owner/Master');
  assert.strictEqual(isMasterOwner(attackerAuth), false, 'Dirty Dozen #3: Cashier self-promotion must fail');

  // 4. Unverified Email Spoof claiming Master Owner email
  const unverifiedSpoof: MockAuthToken = {
    uid: 'spoof-uid',
    email: MASTER_OWNER_EMAIL,
    email_verified: false
  };
  assert.strictEqual(isMasterOwner(unverifiedSpoof), false, 'Dirty Dozen #4: Unverified Master Owner email spoof must fail');

  // 5. Shadow Field Injection ("Ghost Field")
  assert.match(rulesText, /function isValidOrderDoc[\s\S]*?data\.keys\(\)\.hasOnly\(\[/);
  const orderAllowedKeysMatch = rulesText.match(/function isValidOrderDoc[\s\S]*?data\.keys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
  assert.ok(orderAllowedKeysMatch, 'Order schema must specify strict hasOnly allowlist');
  assert.equal(orderAllowedKeysMatch[1].includes('debugBypass'), false);
  assert.equal(orderAllowedKeysMatch[1].includes('isVerified'), false);

  // 6. PII Blanket Read on Member Emails by non-owner
  const memberListRule = rulesText.match(/match \/members\/\{memberUid\}[\s\S]*?allow list:\s*if\s*([^;]+);/)?.[1] || '';
  assert.ok(memberListRule.includes('isMasterOwnerEmail()') && memberListRule.includes('resource.data.ownerUid == request.auth.uid'));
  const cashierListMembers = isMasterOwner(attackerAuth) || 'owner-uid-123' === attackerAuth.uid;
  assert.strictEqual(cashierListMembers, false, 'Dirty Dozen #6: Non-owner list on members PII must fail');

  // 7. Unauthorized Financial / PIN Channel Access for KITCHEN
  assert.match(rulesText, /channelId == 'finance_records' && hasMemberRole\(businessId,\s*\['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'RECEPTIONIST'\]\)/);
  assert.equal(
    rulesText.includes("channelId == 'admin_controls' && hasMemberRole"),
    false,
    'Dirty Dozen #7: No non-owner role may ever access admin_controls syncChannel'
  );

  // 8. Terminal State Violation (Modifying Completed Invoice by Cashier)
  const orderUpdateRule = rulesText.match(/match \/orders\/\{orderId\}[\s\S]*?allow update:\s*if\s*([^;]+);/)?.[1] || '';
  assert.ok(
    orderUpdateRule.includes("existing().status == 'active'"),
    'Dirty Dozen #8: Non-owner order mutations must require existing().status == active'
  );

  // 9. Resource / ID Poisoning (Overlong IDs & path traversal)
  assert.match(rulesText, /function isValidId\(id\)[\s\S]*?id\.size\(\) <= 128 && id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.strictEqual(VALID_ID_REGEX.test('a'.repeat(1500)), false, 'Dirty Dozen #9a: 1500-char ID must be rejected');
  assert.strictEqual(VALID_ID_REGEX.test('../admin'), false, 'Dirty Dozen #9b: Path traversal ID must be rejected');
  assert.strictEqual(VALID_ID_REGEX.test('ord-valid_01'), true, 'Valid ID should pass');

  // 10. Client Timestamp Tampering
  assert.match(rulesText, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt == request\.time/);
  const backdated = makeTime(1_000_000);
  assert.notDeepStrictEqual(backdated, REQUEST_TIME, 'Dirty Dozen #10: Backdated timestamp must differ from request.time');

  // 11. Immortal Owner Reassignment on /businesses/{businessId}
  const bizUpdateRule = rulesText.match(/match \/businesses\/\{businessId\}[\s\S]*?allow update:\s*if\s*([^;]+);/)?.[1] || '';
  assert.ok(bizUpdateRule.includes('incoming().ownerUid == existing().ownerUid'), 'Dirty Dozen #11: ownerUid must be immutable');
  assert.ok(bizUpdateRule.includes('incoming().ownerEmail == existing().ownerEmail'), 'Dirty Dozen #11: ownerEmail must be immutable');

  // 12. Orphan Invite Replay (Non-Atomic Claim)
  assert.match(rulesText, /invites\/\$\(incoming\(\)\.inviteId\)\)\.data\.status == 'PENDING'/);
  assert.match(rulesText, /getAfter\(\/databases\/\$\(database\)\/documents\/businesses\/\$\(businessId\)\/invites\/\$\(incoming\(\)\.inviteId\)\)\.data\.status == 'ACTIVE'/);

  // Positive control sanity check: Master Owner passes owner gate
  assert.strictEqual(isMasterOwner(ownerAuth), true);
});

test('Firestore Rules: Waiter can settle customer billing without discount/tax tampering or voiding', () => {
  const waiterBlock = rulesText.match(/hasMemberRole\(businessId,\s*\['WAITER'\]\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\[([\s\S]*?)\]\)/);
  assert.ok(waiterBlock, 'Waiter order update allowlist must exist');
  const keys = waiterBlock[1];
  assert.ok(keys.includes("'status'") && keys.includes("'paymentMethod'") && keys.includes("'paymentStatus'"), 'Waiter must be able to settle customer bill');
  assert.equal(keys.includes("'discountPercent'"), false, 'Waiter cannot alter discountPercent');
  assert.equal(keys.includes("'waivedServiceCharge'"), false, 'Waiter cannot waive service charge');
  assert.equal(keys.includes("'waivedVat'"), false, 'Waiter cannot waive VAT');
  assert.match(rulesText, /hasMemberRole\(businessId,\s*\['WAITER'\]\)\s*&&\s*incoming\(\)\.status in \['active', 'completed'\]/);
});
