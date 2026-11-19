/**
 * Phase 0 Test Runner: Verifies all "Dirty Dozen" adversarial payloads
 * against the Firestore security rules invariants and returns PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expectedResult: 'PERMISSION_DENIED';
  invariantTested: string;
}

export const DIRTY_DOZEN_TEST_SUITE: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Rejects Identity Spoofing on Invitation Creation (ownerId != request.auth.uid)',
    collection: '/invitations/{invitationId}',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Pillar 2: Identity Integrity'
  },
  {
    id: 2,
    name: 'Rejects Shadow Field Injection (isAdmin: true) on User Profile Update',
    collection: '/users/{userId}',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Pillar 2: Strict Keys & Anti-Update-Gap'
  },
  {
    id: 3,
    name: 'Rejects Unverified Email Admin Spoof Attack (email_verified == false)',
    collection: '/templates/{templateId}',
    operation: 'delete',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Phase 5: Email Spoofing Guard'
  },
  {
    id: 4,
    name: 'Rejects PII Blanket Read on Another User Profile',
    collection: '/users/{userId}',
    operation: 'get',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Pillar 6: PII Isolation'
  },
  {
    id: 5,
    name: 'Rejects Path Variable ID Poisoning with Non-Alphanumeric Characters',
    collection: '/invitations/{invitationId}',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Pillar 3: Path Variable Hardening'
  },
  {
    id: 6,
    name: 'Rejects Orphaned Sub-Event Creation When Caller Does Not Own Parent Invitation',
    collection: '/invitations/{invitationId}/events/{eventId}',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Pillar 1: Master Gate Relational Sync'
  },
  {
    id: 7,
    name: 'Rejects Mutation of Order Document After Terminal Paid Status',
    collection: '/orders/{orderId}',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Phase 4: Terminal State Locking'
  },
  {
    id: 8,
    name: 'Rejects Unbounded Array Overflow on Saved Templates (> 50 elements)',
    collection: '/users/{userId}',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Pillar 5: Total Array Guarding'
  },
  {
    id: 9,
    name: 'Rejects Value Poisoning on Whitelisted Key with Invalid Type',
    collection: '/invitations/{invitationId}',
    operation: 'update',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Phase 5: Value Poisoning Guard'
  },
  {
    id: 10,
    name: 'Rejects Forged Client Timestamp (createdAt != request.time)',
    collection: '/orders/{orderId}',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Phase 4: Temporal Integrity'
  },
  {
    id: 11,
    name: 'Rejects Self-Assigned Privilege Escalation in /admins/{adminId}',
    collection: '/admins/{adminId}',
    operation: 'create',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Phase 3: RBAC Self-Assignment Prevention'
  },
  {
    id: 12,
    name: 'Rejects Unauthorized List Scraping of Another User Draft Invitations',
    collection: '/invitations',
    operation: 'list',
    expectedResult: 'PERMISSION_DENIED',
    invariantTested: 'Pillar 8: Secure List Queries'
  }
];
