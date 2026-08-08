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
  memberships: {
    role: 'owner' | 'admin' | 'member';
    tenant: { id: string; slug: string; name: string };
  }[];
}
