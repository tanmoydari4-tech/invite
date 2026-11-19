# Phase 0: Payload-First Security TDD Specification (`security_spec.md`)

## 1. Data Invariants

1. **PII Isolation Invariant (`/users/{userId}` & `/contact_messages/{messageId}`)**:
   - Customer profile documents containing `email` and `phone` can NEVER be read or listed by anyone other than the document owner (`request.auth.uid == userId`) or a verified administrator (`isAdmin()`).
   - Contact messages containing `senderEmail` can NEVER be read or listed by non-owners/non-admins.
2. **Master Gate Relational Sync Invariant (`/invitations/{invitationId}/events/{eventId}` & `/invitations/{invitationId}/gallery/{photoId}`)**:
   - Sub-events and gallery photos cannot be created, updated, or deleted unless the parent invitation `/invitations/{invitationId}` exists and its `ownerId` matches `request.auth.uid` (or the caller is `isAdmin()`).
3. **Validation Blueprint & Anti-Update-Gap Invariant**:
   - Every `create` and `update` rule must invoke its `isValid[Entity](incoming())` blueprint helper enforcing exact key allowlists (`hasAll` and `hasOnly`), field types, string length boundaries, and `request.time` server timestamp equality.
4. **Terminal State Locking Invariant (`/orders/{orderId}` & `/contact_messages/{messageId}`)**:
   - Once an order reaches `status == 'paid'` or `status == 'failed'`, no non-admin user can mutate the order document.
   - Once a contact message reaches `status == 'resolved'`, no non-admin user can mutate the message.
5. **Query Enforcer Invariant (`allow list`)**:
   - No `allow list` block delegates filtering to the client without checking `resource.data` (e.g., `resource.data.status == 'published'` or `resource.data.ownerId == request.auth.uid`) and no `allow list` performs O(n) `get()` or `exists()` lookups.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Identity Spoofing on Invitation Creation)**:
   ```json
   {
     "path": "/invitations/inv-spoof-1",
     "auth": { "uid": "attacker-uid", "email_verified": true },
     "op": "create",
     "data": { "id": "inv-spoof-1", "ownerId": "victim-uid", "status": "draft" }
   }
   ```
2. **Payload 2 (Shadow Field Injection on User Profile Update)**:
   ```json
   {
     "path": "/users/user-123",
     "auth": { "uid": "user-123", "email_verified": true },
     "op": "update",
     "data": { "uid": "user-123", "email": "user@example.com", "displayName": "Rahul", "phone": "9999999999", "savedTemplateIds": [], "isAdmin": true }
   }
   ```
3. **Payload 3 (Unverified Email Admin Spoof Attack)**:
   ```json
   {
     "path": "/templates/tpl-hijack",
     "auth": { "uid": "spoof-uid", "email": "tanmoydari4@gmail.com", "email_verified": false },
     "op": "delete"
   }
   ```
4. **Payload 4 (PII Blanket Read on Another User's Profile)**:
   ```json
   {
     "path": "/users/victim-uid",
     "auth": { "uid": "other-signed-in-user", "email_verified": true },
     "op": "get"
   }
   ```
5. **Payload 5 (ID Poisoning / 2KB Document ID Attack)**:
   ```json
   {
     "path": "/invitations/inv_with_invalid_chars_$#@!_and_overlong_payload",
     "auth": { "uid": "user-123", "email_verified": true },
     "op": "create",
     "data": { "id": "inv_with_invalid_chars_$#@!_and_overlong_payload" }
   }
   ```
6. **Payload 6 (Orphaned Sub-Event Write Without Parent Ownership)**:
   ```json
   {
     "path": "/invitations/victim-inv/events/evt-1",
     "auth": { "uid": "attacker-uid", "email_verified": true },
     "op": "create",
     "data": { "id": "evt-1", "invitationId": "victim-inv", "ownerId": "attacker-uid", "title": "Fake Event" }
   }
   ```
7. **Payload 7 (Terminal State Bypass on Paid Order)**:
   ```json
   {
     "path": "/orders/ord-paid-1",
     "auth": { "uid": "user-123", "email_verified": true },
     "op": "update",
     "existingStatus": "paid",
     "data": { "status": "pending", "finalAmount": 0 }
   }
   ```
8. **Payload 8 (Total Array Guarding Overflow on Saved Templates > 50 items)**:
   ```json
   {
     "path": "/users/user-123",
     "auth": { "uid": "user-123", "email_verified": true },
     "op": "update",
     "data": { "savedTemplateIds": ["t1", "t2", "...55 items..."] }
   }
   ```
9. **Payload 9 (Value Poisoning on Invitation Update - Invalid Type/Length)**:
   ```json
   {
     "path": "/invitations/inv-123",
     "auth": { "uid": "user-123", "email_verified": true },
     "op": "update",
     "data": { "eventTitle": 99999999 }
   }
   ```
10. **Payload 10 (Temporal Integrity Forgery - Forged Past `createdAt` Timestamp)**:
    ```json
    {
      "path": "/orders/ord-123",
      "auth": { "uid": "user-123", "email_verified": true },
      "op": "create",
      "data": { "createdAt": "2020-01-01T00:00:00Z" }
    }
    ```
11. **Payload 11 (Self-Assigned Admin Escalation in `/admins/{uid}`)**:
    ```json
    {
      "path": "/admins/attacker-uid",
      "auth": { "uid": "attacker-uid", "email_verified": true },
      "op": "create",
      "data": { "uid": "attacker-uid", "email": "attacker@example.com", "role": "super_admin" }
    }
    ```
12. **Payload 12 (Unauthorized Draft Invitation Scraping via List Query)**:
    ```json
    {
      "path": "/invitations",
      "auth": { "uid": "attacker-uid", "email_verified": true },
      "op": "list",
      "targetResource": { "ownerId": "victim-uid", "status": "draft" }
    }
    ```
