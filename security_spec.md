# YouthGo Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **No Self-Assigned Admin**: A regular user cannot write to `adminUsers/{uid}` or set `role: "admin"` in `users/{uid}` on creation or update. Only a verified Super Admin (`raselmdariyenahmed82@gmail.com` or active `super_admin` in `adminUsers`) can grant admin privileges.
2. **Wallet Protection**: Neither customers, sellers, nor riders can directly create, update, or delete `sellerWallets/{id}`, `riderWallets/{id}`, or `transactions/{id}` balances from the client. Wallet settlement occurs only via admin/server-verified settlement flows.
3. **Order Ownership & State Integrity**: Customers can only create orders with `customerUid == request.auth.uid`, `settlementApplied == false`, and `orderStatus == "placed"`. Terminal orders (`delivered`, `cancelled`) are locked against non-admin mutations.
4. **PII Isolation**: Customer profiles (`customers/{uid}`), user accounts (`users/{uid}`), withdrawals, and complaints containing PII are restricted to the document owner or verified Admins.
5. **Immutable Audit Trail**: `auditLogs/{logId}` is append-only by verified Admins and can never be updated or deleted.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps on protected writes must match `request.time`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Privilege Escalation on Signup**: Regular user writes `users/{uid}` with `role: "admin"`. Expected: `PERMISSION_DENIED`.
2. **Self-Admin Creation**: Regular user creates `adminUsers/{uid}` with `role: "super_admin"`. Expected: `PERMISSION_DENIED`.
3. **Direct Wallet Tampering**: Seller updates `sellerWallets/{uid}` setting `availableBalance: 999999`. Expected: `PERMISSION_DENIED`.
4. **Rider Wallet Tampering**: Rider creates `riderWallets/{uid}` with arbitrary `totalEarned`. Expected: `PERMISSION_DENIED`.
5. **Idempotency Bypass / Fake Transaction**: User creates `transactions/fake_tx` with `ledgerType: "platform_revenue"`. Expected: `PERMISSION_DENIED`.
6. **PII Scraping**: Customer A reads `customers/{customerB_uid}`. Expected: `PERMISSION_DENIED`.
7. **Unverified Email Admin Spoof**: Token with `email: "raselmdariyenahmed82@gmail.com"` and `email_verified: false` tries to approve shop. Expected: `PERMISSION_DENIED`.
8. **Shadow Field Injection**: Customer updates `orders/{orderId}` with ghost field `settlementApplied: true`. Expected: `PERMISSION_DENIED`.
9. **Path ID Poisoning**: User writes `/orders/` with a 300-character invalid document ID containing `$` or spaces. Expected: `PERMISSION_DENIED`.
10. **Cross-Seller Product Tampering**: Seller A attempts to update `products/{productB}` owned by Seller B. Expected: `PERMISSION_DENIED`.
11. **Terminal Order Reversal**: Customer tries to change an order from `delivered` back to `placed`. Expected: `PERMISSION_DENIED`.
12. **Audit Log Erasure**: Admin or user tries to delete or modify `auditLogs/{logId}`. Expected: `PERMISSION_DENIED`.
