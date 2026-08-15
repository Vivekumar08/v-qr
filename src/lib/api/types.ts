/**
 * Wire types for the qr-infra API.
 *
 * Hand-written from the published OpenAPI document rather than generated, so
 * the shapes stay readable at the call site. They must track
 * `GET /v1/openapi.json` — the backend treats v1 as additive-only, so new
 * optional fields are safe but removals are not.
 */

export type CodeStatus = 'active' | 'paused' | 'revoked' | 'blocked';
export type Reputation = 'pending' | 'clean' | 'flagged';

export interface Destination {
  version: number;
  url: string;
  active: boolean;
  reputation: Reputation;
  created_at: string;
}

export interface Code {
  id: string;
  short_code: string;
  /**
   * What the QR encodes, and what is printed. Comes from the API rather than
   * being composed here: a tenant on a custom domain resolves there, and a
   * locally-built `{slug}.{domain}` would be a URL on none of their labels.
   */
  scan_url: string;
  gtin: string | null;
  serial: string | null;
  status: CodeStatus;
  created_at: string;
  destination?: Destination;
}

export interface CodeList {
  data: Code[];
  has_more: boolean;
  /** Opaque. Pass back as `starting_after`; never construct one. */
  next_cursor: string | null;
}

export interface ScanSummary {
  total: number;
  first_at: string | null;
  last_at: string | null;
  by_country: { key: string; count: number }[];
  by_device: { key: string; count: number }[];
}

/** The single error envelope every endpoint uses. */
export interface ApiErrorBody {
  error: {
    type:
      | 'invalid_request'
      | 'authentication'
      | 'permission'
      | 'not_found'
      | 'conflict'
      | 'rate_limit'
      | 'server_error';
    code: string;
    message: string;
    param?: string;
    /** Quote this when contacting support — it ties to the server log line. */
    request_id: string;
  };
}

export interface CreateCodeInput {
  url: string;
  gtin?: string;
  serial?: string;
}

/** The only two a caller may set. `revoked` and `blocked` are not transitions the console offers. */
export type CallerSettableStatus = 'active' | 'paused';

export interface DestinationList {
  /** Newest version first. Exactly one entry is `active`. */
  data: Destination[];
}

export type QrFormat = 'svg' | 'pdf' | 'eps';
/** Higher levels survive more damage but need a larger code for the same content. */
export type EccLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  format: QrFormat;
  ecc: EccLevel;
  size_mm: number;
  print_marks: boolean;
}

export interface ScanQuery {
  /** ISO 8601. Omitted means all history. */
  since?: string;
  includeBots?: boolean;
}

export interface Me {
  user: {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    email_verified: boolean;
    created_at: string;
  };
  active_tenant_id: string | null;
  /**
   * Whether to offer the operator navigation. Nothing more.
   *
   * Every `/v1/admin` route re-checks the allow-list and answers 404 to anyone
   * not on it, so this is safe to trust for rendering and worthless to forge.
   */
  is_super_admin: boolean;
  memberships: {
    role: 'owner' | 'admin' | 'member';
    tenant: { id: string; slug: string; name: string };
  }[];
}

export type Role = 'owner' | 'admin' | 'member';

export interface Member {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  joined_at: string;
}

export interface Invite {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

/** Only ever returned once, at creation. */
export interface CreatedApiKey extends ApiKeySummary {
  key: string;
}

/* ------------------------------------------------------------------ *
 * Operator surface (`/v1/admin`)
 *
 * Everything here reads across tenant boundaries, which is the one thing the
 * rest of the API is built never to do. The shapes are deliberately thin:
 * counts, status and timestamps, never a customer's content.
 * ------------------------------------------------------------------ */

export type TenantPlan = 'free' | 'paid' | 'enterprise';

export interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
  custom_domain: string | null;
  suspended: boolean;
  suspended_at: string | null;
  code_count: number;
  active_code_count: number;
  member_count: number;
  last_scan_at: string | null;
  created_at: string;
}

/** No destination URL, by design — an operator sees shape, not marketing links. */
export interface AdminCode {
  id: string;
  short_code: string;
  status: CodeStatus;
  gtin: string | null;
  created_at: string;
}

/**
 * Mirrors `AUDIT_ACTIONS` in the API
 * (`src/modules/admin/domain/entities/AuditEntry.ts`), which is the source of
 * truth. Keep both in step: this list has drifted twice, and the symptom both
 * times was rows rendering wrong rather than anything failing.
 */
export type AuditAction =
  | 'tenants.list'
  | 'tenant.read'
  | 'tenant.plan_changed'
  | 'tenant.suspended'
  | 'tenant.unsuspended'
  | 'users.list'
  | 'codes.read'
  | 'code.blocked'
  | 'code.unblocked'
  | 'scans.read'
  | 'impersonation.start'
  | 'audit.read';

export interface AuditEntry {
  /** A `bigserial`, so ordering by it is total — two entries in the same
   *  millisecond still sort deterministically. Serialised as a string. */
  id: string;
  actor_email: string;
  action: AuditAction;
  tenant_slug: string | null;
  target_id: string | null;
  reason: string | null;
  created_at: string;
}

/**
 * A short-lived, read-only view of a customer's account.
 *
 * No refresh token comes back: the session lasts one access-token lifetime and
 * cannot be extended without a fresh reason on the record.
 */
export interface Impersonation {
  tenant_slug: string;
  expires_in: number;
  read_only: true;
}

export type PlanFeature = 'analytics' | 'export' | 'api_keys';

/** Mirrors `GET /v1/plan`. `null` is unlimited, never a sentinel. */
export interface PlanState {
  plan: TenantPlan;
  limits: {
    active_codes: number | null;
    seats: number | null;
    /** The features this plan grants. */
    features: PlanFeature[];
    /**
     * Every feature that exists, regardless of what this plan grants — the
     * only way the console can render a feature as "not on this plan" without
     * hardcoding the universe itself. Source of truth is the backend's
     * `PLAN_FEATURES`.
     *
     * Optional: the two repos deploy independently, and the backend has shipped
     * ahead of the console before. An older backend simply omits this field, and
     * callers must fall back to `features` rather than assume it is present.
     */
    all_features?: PlanFeature[];
  };
  usage: {
    active_codes: number;
    seats: number;
  };
}
