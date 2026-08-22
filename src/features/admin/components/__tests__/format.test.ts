import { describe, expect, it } from 'vitest';
import type { AuditAction } from '@/lib/api/types';
import { ACTION_LABEL, isWriteAction, labelFor } from '../format';

/**
 * The console's copy of the API's audit vocabulary.
 *
 * It has drifted twice, and both times nothing failed — rows simply rendered
 * wrong. `impersonation.start` was missing entirely and showed a blank badge;
 * `codes.read` was missing and showed up looking like an operator
 * intervention. Neither a type error nor a failing request.
 *
 * DRIFT WARNING: this pins the console against itself. It cannot see the API
 * adding an action. Keep it in step with `AUDIT_ACTIONS` in
 * `backend/src/modules/admin/domain/entities/AuditEntry.ts` by hand.
 */
const API_ACTIONS = [
  'tenants.list',
  'tenant.read',
  'tenant.plan_changed',
  'billing.plan_changed',
  'tenant.suspended',
  'tenant.unsuspended',
  'users.list',
  'codes.read',
  'code.blocked',
  'code.unblocked',
  'scans.read',
  'impersonation.start',
  'audit.read',
] as const;

describe('audit action labels', () => {
  it('names every action the API can emit', () => {
    for (const action of API_ACTIONS) {
      expect(ACTION_LABEL[action], action).toBeDefined();
    }
  });

  it('covers exactly the API vocabulary — no extras, no gaps', () => {
    expect(Object.keys(ACTION_LABEL).sort()).toEqual([...API_ACTIONS].sort());
  });

  it('classifies reads as reads', () => {
    // The bug: this was "not one of three known reads", so every unlisted
    // action was badged as a write.
    for (const action of ['tenants.list', 'tenant.read', 'users.list', 'codes.read', 'scans.read', 'audit.read'] as const) {
      expect(isWriteAction(action), action).toBe(false);
    }
  });

  it('classifies the consequential actions as writes', () => {
    for (const action of [
      'tenant.plan_changed',
      'billing.plan_changed',
      'tenant.suspended',
      'tenant.unsuspended',
      'code.blocked',
      'code.unblocked',
      // Changes nothing, but it is the entry somebody has to answer for.
      'impersonation.start',
    ] as const) {
      expect(isWriteAction(action), action).toBe(true);
    }
  });

  it('emphasises an action it has never heard of rather than hiding it', () => {
    const unknown = 'tenant.deleted' as AuditAction;
    expect(isWriteAction(unknown)).toBe(true);
    expect(labelFor(unknown)).toBe('tenant.deleted');
  });
});
