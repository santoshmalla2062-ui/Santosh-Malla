# Firestore Zero-Trust Security Specification (Phase 0 TDD)

Master Owner Identity: `samjhamnamalla22444@gmail.com` (`email_verified == true`)

## 1. Core Data Invariants
1. **Master Gate & Instant Revocation**: Every sub-collection read (`get`), create, update, or delete under `/businesses/{businessId}` must verify either `isMasterOwnerEmail()`, business document ownership (`ownerUid == request.auth.uid`), or active membership in `/businesses/{businessId}/members/{request.auth.uid}` where `isActive == true`. Deleting or deactivating a member immediately revokes access across all sub-collections.
2. **Self-Assigned Role Prevention**: No non-owner user may create or mutate their own `role` in `/businesses/{businessId}/members/{uid}`. An employee may only create their own membership record in an atomic `WriteBatch` that consumes an Owner-issued `PENDING` invite document (`/businesses/{businessId}/invites/{inviteId}`) matching their verified email and exact invited `role`, transitioning that invite to `ACTIVE` (`getAfter`).
3. **PII & Secret Channel Isolation**:
   - Staff PIN hashes, permission matrices, security policies, and audit trails reside in `/syncChannels/admin_controls`, accessible strictly to Owner/Master Admin (`isMasterOwnerEmail() || isBusinessOwner(businessId)`).
   - Customer credit/Khata ledgers and daily cash closings reside in `/syncChannels/finance_records`, accessible only to `OWNER`, `ADMIN`, `MANAGER`, `CASHIER`, `ACCOUNTANT`. `WAITER`, `KITCHEN`, and `HOUSEKEEPING` are strictly denied.
4. **Tiered Action-Based Updates**:
   - Kitchen staff (`KITCHEN`) can update active KOT order statuses inside `orders_live` and stock deductions in `inventory_ledger`, but cannot touch `finance_records` or `admin_controls`.
   - Waiters (`WAITER`) can update `orders_live` and `menu_tables` table occupancy, but cannot touch `admin_controls` or `finance_records`.
   - Settled invoices in `/businesses/{businessId}/orders/{orderId}` lock upon reaching terminal status `completed` or `cancelled`, permitting subsequent modification only by Owner/Master Admin (`isAdmin()`).
5. **Temporal Integrity & Path Guard**:
   - Every document ID path variable passes `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, max 128 chars).
   - `createdAt` must equal `request.time` on create and remain immutable on update; `updatedAt` must equal `request.time` on create and update.
6. **Zero Blanket `list` Queries**:
   - `/syncChannels/{channelId}` sets `allow list: if false;` (clients listen strictly to named document refs via `get`).
   - `/businesses`, `/orders`, `/invites`, and `/members` never execute `get()` or `exists()` inside `allow list` blocks; they enforce ownership/membership directly on `resource.data`.

---

## 2. The "Dirty Dozen" Attack Payloads (Must All Return `PERMISSION_DENIED`)

1. **Identity Spoofing (Fake Owner ID)**: Unprivileged user sends `{ ownerUid: "owner-uid-123", ... }` on `POST /businesses/biz-victim`.
   - Blocked by: `incoming().ownerUid == request.auth.uid`.
2. **Self-Privilege Escalation (Role Hijack)**: Waiter writes `{ uid: waiterUid, role: "OWNER", ... }` to `/businesses/biz-1/members/{waiterUid}` without an owner invite.
   - Blocked by: `isMasterOwnerEmail() || isBusinessOwner(businessId)` or `get()/getAfter()` invite verification where invite `role` cannot exceed invited role and `'OWNER'` invites are rejected.
3. **Role Mutation on Existing Membership**: Cashier updates their own `/businesses/biz-1/members/{cashierUid}` changing `role` from `'CASHIER'` to `'ADMIN'`.
   - Blocked by: `allow update` on `/members` strictly requires `isMasterOwnerEmail() || isBusinessOwner(businessId)`.
4. **Unverified Email Spoof**: Attacker signs in via custom/unverified provider with `email == "samjhamnamalla22444@gmail.com"` and `email_verified == false`.
   - Blocked by: `isMasterOwnerEmail()` and `isVerifiedUser()` strictly mandate `request.auth.token.email_verified == true`.
5. **Shadow Field Injection ("Ghost Field")**: Attacker appends `{ ..., isVerified: true, debugBypass: 1 }` to `/businesses/biz-1/orders/ord-1`.
   - Blocked by: `data.keys().hasOnly([...])` and `affectedKeys().hasOnly([...])` on every create/update.
6. **PII Blanket Read on Member Emails**: Cashier attempts `list` query on `/businesses/biz-1/members` to scrape staff emails/phones.
   - Blocked by: `allow list: if isSignedIn() && isVerifiedUser() && (isMasterOwnerEmail() || resource.data.ownerUid == request.auth.uid)`.
7. **Unauthorized Financial / PIN Channel Access**: Kitchen Chef calls `getDoc('/businesses/biz-1/syncChannels/admin_controls')` or `'finance_records'`.
   - Blocked by: `canReadSyncChannel(businessId, channelId)` denying `KITCHEN` on both channels.
8. **Terminal State Violation (Modifying Completed Invoice)**: Cashier attempts to alter `grandTotal` or `items` on a `/businesses/biz-1/orders/ord-settled` document whose `existing().status == 'completed'`.
   - Blocked by: `existing().status == 'active'` gate on non-admin updates.
9. **Resource / ID Poisoning**: Attacker targets `/businesses/biz-1/orders/${'a'.repeat(1500)}` or injects characters `../admin`.
   - Blocked by: `isValidId(orderId)` regex `^[a-zA-Z0-9_\\-]+$` and `.size() <= 128`.
10. **Client Timestamp Tampering**: Client sends backdated `createdAt` or `updatedAt` string instead of `request.time`.
    - Blocked by: `incoming().createdAt == request.time` and `incoming().updatedAt == request.time`.
11. **Immortal Owner Reassignment**: Update payload on `/businesses/biz-1` tries to change `ownerUid` to attacker UID.
    - Blocked by: `incoming().ownerUid == existing().ownerUid` and `affectedKeys().hasOnly(...)`.
12. **Orphan Invite Replay (Non-Atomic Claim)**: Attacker tries to create `/members/{uid}` pointing to an already-used invite (`status == 'ACTIVE'`) or without atomically flipping the invite to `ACTIVE`.
    - Blocked by: `get(...).data.status == 'PENDING'` combined with `getAfter(...).data.status == 'ACTIVE'`.
