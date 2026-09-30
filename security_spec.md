# Security Specification: SM Voice Studio User, Licenses & Quota Hardening

## 1. Data Invariants
- Each user document lives strictly at `/users/{userId}` where `userId == request.auth.uid`.
- Default Catch-All: All documents outside explicit match blocks are closed (`allow read, write: if false;`).
- Read Access:
  - `/users/{userId}`: A user can only read their own document (`request.auth.uid == userId`). No listing or cross-user scraping. Admins can read all.
  - `/licenses/{licenseId}`: Readable and writable ONLY by the admin (`request.auth.token.email_verified == true && request.auth.token.email == 'chromebook160nb@gmail.com'`).
  - `/paymentRequests/{requestId}`: Users can only read their own payment requests (`resource.data.uid == request.auth.uid`). Admins can read all.
- Creation Integrity:
  - `/users/{userId}`:
    - Must be authenticated (`request.auth != null && request.auth.uid == userId`).
    - Strict key structure: only `['email', 'plan', 'charactersUsed', 'planWordsUsed', 'freeLimit', 'planExpiresAt', 'createdAt']` allowed.
    - Initial values must be default: `plan == 'free'`, `charactersUsed == 0`, `(!('planWordsUsed' in data) || data.planWordsUsed == 0)`, `freeLimit == 10000`, `planExpiresAt == null`.
    - Timestamp integrity: `createdAt == request.time || createdAt is timestamp`.
  - `/paymentRequests/{requestId}`:
    - Created only with `status == 'pending'`, `uid == request.auth.uid`, no `reviewedAt` or `rejectionReason`.
- Immutable Protected Fields (Anti-Tampering):
  - Client SDK can NEVER write or modify `charactersUsed`, `planWordsUsed`, `plan`, `freeLimit`, or `planExpiresAt`.
  - Any attempt by client to update `plan`, `planExpiresAt`, `planWordsUsed`, `charactersUsed`, or `freeLimit` returns `PERMISSION_DENIED`.
  - Only server functions / admin SDK (which bypass client rules with server credentials) alter usage counters or subscription plans.
  - Non-admin client SDK can never update `/licenses/{licenseId}` or `/paymentRequests/{requestId}`.
- Deletion:
  - User documents cannot be deleted directly from client SDK (`allow delete: if false;`).
  - Licenses and payment requests can only be deleted by admin.

## 2. The Dirty Dozen Malicious Payloads
1. **Unauthenticated Read**: Attempting to read `/users/target_user_123` without auth token -> REJECTED.
2. **Cross-Tenant Read**: User A (`auth.uid == user_a`) attempting to read `/users/user_b` -> REJECTED.
3. **List Collection Scraping**: Non-admin querying `collection('users')` to list all registered users -> REJECTED.
4. **Self-Upgrade Plan on Create**: User attempts to create document with `plan: 'lifetime'` -> REJECTED.
5. **Increased Quota on Create**: User attempts to create document with `freeLimit: 9999999` -> REJECTED.
6. **Spoofed Pre-Existing Usage on Create**: User attempts to create document with negative `charactersUsed: -5000` -> REJECTED.
7. **Client Plan Tampering (Update)**: User submits an update payload `plan: 'lifetime'` or `plan: 'monthly'` -> REJECTED.
8. **Client Usage Reset (Update)**: User attempts to reset `charactersUsed: 0` or `planWordsUsed: 0` from client SDK -> REJECTED.
9. **Client Expiration Manipulation (Update)**: User sets `planExpiresAt: 2099-01-01` -> REJECTED.
10. **License Scraping**: Normal signed-in user attempting to query `/licenses` -> REJECTED.
11. **License Self-Redemption Bypass**: Normal user attempting to update `/licenses/{licenseId}` -> REJECTED.
12. **Payment Approval Spoofing**: Normal user attempting to set `paymentRequests/{requestId}.status = 'approved'` -> REJECTED.
