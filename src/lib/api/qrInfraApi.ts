import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  CallerSettableStatus,
  Code,
  CodeList,
  CreateCodeInput,
  DestinationList,
  QrOptions,
  ScanQuery,
  Me,
  ScanSummary,
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
  tagTypes: ['Codes', 'Code', 'Scans', 'Destinations', 'Me'],

  endpoints: (builder) => ({
    me: builder.query<Me, void>({
      query: () => '/v1/auth/me',
      providesTags: ['Me'],
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
      invalidatesTags: [{ type: 'Codes', id: 'LIST' }],
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
      invalidatesTags: (_result, _error, id) => [{ type: 'Code', id }, { type: 'Codes', id: 'LIST' }],
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
  }),
});

export const {
  useMeQuery,
  useListCodesQuery,
  useGetCodeQuery,
  useGetScanSummaryQuery,
  useListDestinationsQuery,
  usePreviewQrQuery,
  useCreateCodeMutation,
  useRevokeCodeMutation,
  useUpdateCodeStatusMutation,
  useAddDestinationMutation,
} = qrInfraApi;
