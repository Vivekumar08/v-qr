import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  AdminCode,
  AdminTenant,
  AuditEntry,
  CallerSettableStatus,
  Code,
  CodeList,
  CreateCodeInput,
  DestinationList,
  QrOptions,
  ScanQuery,
  ApiKeySummary,
  CreatedApiKey,
  Invite,
  Me,
  Member,
  PlanState,
  Role,
  ScanSummary,
  TenantPlan,
} from './types';
import { qrQueryString } from './qrUrl';

/**
 * RTK Query client for the qr-infra API.
 *
 * Requests go to a same-origin `/api` route rather than straight to the backend.
 * That keeps the API key server-side: anything in `NEXT_PUBLIC_*` ships to the
 * browser, and an API key with `codes:write` in browser-readable config is a key
 * anyone can lift from devtools.
 */
export const qrInfraApi = createApi({
  reducerPath: 'qrInfraApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/proxy' }),

  // `Codes` is the list; individual entries are tagged by id so revoking one
  // code refetches that code and the list, not every query in the cache.
  tagTypes: [
    'Codes',
    'Code',
    'Scans',
    'Destinations',
    'Me',
    'Members',
    'Invites',
    'ApiKeys',
    'AdminTenants',
    'AdminTenant',
    'AdminCodes',
    'AdminAudit',
    'Plan',
  ],

  endpoints: (builder) => ({
    me: builder.query<Me, void>({
      query: () => '/v1/auth/me',
      providesTags: ['Me'],
    }),

    plan: builder.query<PlanState, void>({
      query: () => '/v1/plan',
      providesTags: ['Plan'],
    }),

    listMembers: builder.query<{ data: Member[] }, void>({
      query: () => '/v1/members',
      providesTags: ['Members'],
    }),

    changeMemberRole: builder.mutation<unknown, { userId: string; role: Role }>({
      query: ({ userId, role }) => ({
        url: `/v1/members/${userId}`,
        method: 'PATCH',
        body: { role },
      }),
      invalidatesTags: ['Members'],
    }),

    removeMember: builder.mutation<unknown, string>({
      query: (userId) => ({ url: `/v1/members/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Members'],
    }),

    transferOwnership: builder.mutation<unknown, string>({
      query: (userId) => ({
        url: '/v1/members/transfer-ownership',
        method: 'POST',
        body: { user_id: userId },
      }),
      // Both change: the caller stops being owner as the target starts.
      invalidatesTags: ['Members', 'Me'],
    }),

    listInvites: builder.query<{ data: Invite[] }, void>({
      query: () => '/v1/invites',
      providesTags: ['Invites'],
    }),

    createInvite: builder.mutation<{ invite: Invite; link: string }, { email: string; role: Role }>({
      query: (body) => ({
        url: '/v1/invites',
        method: 'POST',
        body,
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: ['Invites'],
    }),

    revokeInvite: builder.mutation<unknown, string>({
      query: (id) => ({ url: `/v1/invites/${id}`, method: 'DELETE' }),
      // A seat is spoken for the moment the invite exists, not only once it's
      // accepted, so the usage meter has to move here too.
      invalidatesTags: ['Invites', 'Plan'],
    }),

    listApiKeys: builder.query<{ data: ApiKeySummary[] }, void>({
      query: () => '/v1/api-keys',
      providesTags: ['ApiKeys'],
    }),

    createApiKey: builder.mutation<CreatedApiKey, { name: string; scopes: string[] }>({
      query: (body) => ({ url: '/v1/api-keys', method: 'POST', body }),
      invalidatesTags: ['ApiKeys'],
    }),

    revokeApiKey: builder.mutation<unknown, string>({
      query: (id) => ({ url: `/v1/api-keys/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ApiKeys'],
    }),

    listCodes: builder.query<CodeList, { limit?: number; cursor?: string; status?: string }>({
      query: ({ limit = 25, cursor, status }) => ({
        url: '/v1/codes',
        params: {
          limit,
          ...(cursor === undefined ? {} : { starting_after: cursor }),
          ...(status === undefined ? {} : { status }),
        },
      }),
      providesTags: (result) => [
        { type: 'Codes' as const, id: 'LIST' },
        ...(result?.data ?? []).map((code) => ({ type: 'Code' as const, id: code.id })),
      ],
    }),

    getCode: builder.query<Code, string>({
      query: (id) => `/v1/codes/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Code', id }],
    }),

    getScanSummary: builder.query<ScanSummary, { id: string } & ScanQuery>({
      query: ({ id, since, includeBots }) => ({
        url: `/v1/codes/${id}/scans`,
        params: {
          ...(since === undefined ? {} : { since }),
          // Only sent when true: the API defaults to excluding bots, and a
          // literal `false` in the URL is noise in the request log.
          ...(includeBots === true ? { include_bots: 'true' } : {}),
        },
      }),
      providesTags: (_result, _error, { id }) => [{ type: 'Scans', id }],
    }),

    listDestinations: builder.query<DestinationList, string>({
      query: (id) => `/v1/codes/${id}/destinations`,
      providesTags: (_result, _error, id) => [{ type: 'Destinations', id }],
    }),

    /**
     * Artwork for the preview pane, as a data URL.
     *
     * SVG only, and deliberately not a plain `<img src="/api/proxy/...">`: an
     * image element reports a 400 as a broken icon, which hides exactly the
     * errors worth reading — a size too small to scan, or a palette below the
     * contrast floor. Going through the same query layer surfaces the API's
     * explanation instead.
     */
    previewQr: builder.query<string, { id: string } & Omit<QrOptions, 'format'>>({
      query: ({ id, ...options }) => ({
        url: `/v1/codes/${id}/qr?${qrQueryString({ ...options, format: 'svg' })}`,
        responseHandler: async (response) => {
          if (!response.ok) return response.json();
          // A data URL rather than an object URL: nothing to revoke, so the
          // cached value stays valid across remounts.
          return `data:image/svg+xml;utf8,${encodeURIComponent(await response.text())}`;
        },
      }),
      providesTags: (_result, _error, { id }) => [{ type: 'Code', id }],
    }),

    createCode: builder.mutation<Code, CreateCodeInput>({
      query: (body) => ({
        url: '/v1/codes',
        method: 'POST',
        body,
        // The API replays a repeated key instead of creating a second code.
        // Printed labels make a duplicate unrecoverable, so a retry — including
        // an impatient double-click — must never produce two codes.
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: [{ type: 'Codes', id: 'LIST' }, 'Plan'],
    }),

    updateCodeStatus: builder.mutation<Code, { id: string; status: CallerSettableStatus }>({
      query: ({ id, status }) => ({
        url: `/v1/codes/${id}`,
        method: 'PATCH',
        body: { status },
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Code', id },
        { type: 'Codes', id: 'LIST' },
      ],
    }),

    revokeCode: builder.mutation<Code, string>({
      query: (id) => ({
        url: `/v1/codes/${id}/revoke`,
        method: 'POST',
        body: {},
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Code', id },
        { type: 'Codes', id: 'LIST' },
        'Plan',
      ],
    }),

    addDestination: builder.mutation<unknown, { id: string; url: string }>({
      query: ({ id, url }) => ({
        url: `/v1/codes/${id}/destinations`,
        method: 'POST',
        body: { url },
        headers: { 'idempotency-key': crypto.randomUUID() },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Code', id },
        { type: 'Destinations', id },
        { type: 'Codes', id: 'LIST' },
      ],
    }),

    /* ---------------------------------------------------------------- *
     * Operator surface.
     *
     * Every read below is itself recorded in the audit log server-side, so
     * these are not free calls to make casually — refetching a tenant list
     * writes a `tenants.list` entry each time. That is why none of them poll.
     * ---------------------------------------------------------------- */

    listAdminTenants: builder.query<{ data: AdminTenant[] }, { search?: string } | void>({
      query: (args) => ({
        url: '/v1/admin/tenants',
        params: {
          limit: 200,
          ...(args?.search === undefined || args.search === '' ? {} : { search: args.search }),
        },
      }),
      providesTags: ['AdminTenants'],
    }),

    getAdminTenant: builder.query<AdminTenant, string>({
      query: (tenantId) => `/v1/admin/tenants/${tenantId}`,
      providesTags: (_result, _error, tenantId) => [{ type: 'AdminTenant', id: tenantId }],
    }),

    listAdminTenantCodes: builder.query<
      { data: AdminCode[]; has_more: boolean },
      { tenantId: string; limit?: number }
    >({
      query: ({ tenantId, limit = 25 }) => ({
        url: `/v1/admin/tenants/${tenantId}/codes`,
        params: { limit },
      }),
      providesTags: (_result, _error, { tenantId }) => [{ type: 'AdminCodes', id: tenantId }],
    }),

    listAudit: builder.query<{ data: AuditEntry[] }, { tenantId?: string; limit?: number } | void>({
      query: (args) => ({
        url: '/v1/admin/audit',
        params: {
          limit: args?.limit ?? 100,
          ...(args?.tenantId === undefined ? {} : { tenant_id: args.tenantId }),
        },
      }),
      providesTags: ['AdminAudit'],
    }),

    /**
     * The operator actions.
     *
     * Each takes a reason the API enforces a minimum length on, and each writes
     * an audit entry — hence `AdminAudit` in every invalidation. Blocking a code
     * also moves the tenant's active count, so the overview is refetched too.
     */
    blockCode: builder.mutation<void, { codeId: string; tenantId: string; reason: string }>({
      query: ({ codeId, reason }) => ({
        url: `/v1/admin/codes/${codeId}/block`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { tenantId }) => [
        { type: 'AdminCodes', id: tenantId },
        { type: 'AdminTenant', id: tenantId },
        'AdminTenants',
        'AdminAudit',
      ],
    }),

    unblockCode: builder.mutation<void, { codeId: string; tenantId: string; reason: string }>({
      query: ({ codeId, reason }) => ({
        url: `/v1/admin/codes/${codeId}/unblock`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: (_result, _error, { tenantId }) => [
        { type: 'AdminCodes', id: tenantId },
        { type: 'AdminTenant', id: tenantId },
        'AdminTenants',
        'AdminAudit',
      ],
    }),

    setTenantSuspension: builder.mutation<
      void,
      { tenantId: string; suspended: boolean; reason: string }
    >({
      query: ({ tenantId, suspended, reason }) => ({
        url: `/v1/admin/tenants/${tenantId}/suspension`,
        method: 'POST',
        body: { suspended, reason },
      }),
      invalidatesTags: (_result, _error, { tenantId }) => [
        { type: 'AdminTenant', id: tenantId },
        'AdminTenants',
        'AdminAudit',
      ],
    }),

    setTenantPlan: builder.mutation<void, { tenantId: string; plan: TenantPlan; reason: string }>({
      query: ({ tenantId, plan, reason }) => ({
        url: `/v1/admin/tenants/${tenantId}/plan`,
        method: 'POST',
        body: { plan, reason },
      }),
      invalidatesTags: (_result, _error, { tenantId }) => [
        { type: 'AdminTenant', id: tenantId },
        'AdminTenants',
        'AdminAudit',
      ],
    }),
  }),
});

export const {
  useMeQuery,
  usePlanQuery,
  useListMembersQuery,
  useChangeMemberRoleMutation,
  useRemoveMemberMutation,
  useTransferOwnershipMutation,
  useListInvitesQuery,
  useCreateInviteMutation,
  useRevokeInviteMutation,
  useListApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  useListCodesQuery,
  useGetCodeQuery,
  useGetScanSummaryQuery,
  useListDestinationsQuery,
  usePreviewQrQuery,
  useCreateCodeMutation,
  useRevokeCodeMutation,
  useUpdateCodeStatusMutation,
  useAddDestinationMutation,
  useListAdminTenantsQuery,
  useGetAdminTenantQuery,
  useListAdminTenantCodesQuery,
  useListAuditQuery,
  useBlockCodeMutation,
  useUnblockCodeMutation,
  useSetTenantSuspensionMutation,
  useSetTenantPlanMutation,
} = qrInfraApi;
