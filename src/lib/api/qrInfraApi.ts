import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Code, CodeList, CreateCodeInput, ScanSummary } from './types';

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
  tagTypes: ['Codes', 'Code', 'Scans'],

  endpoints: (builder) => ({
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

    getScanSummary: builder.query<ScanSummary, string>({
      query: (id) => `/v1/codes/${id}/scans`,
      providesTags: (_result, _error, id) => [{ type: 'Scans', id }],
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
        { type: 'Codes', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListCodesQuery,
  useGetCodeQuery,
  useGetScanSummaryQuery,
  useCreateCodeMutation,
  useRevokeCodeMutation,
  useAddDestinationMutation,
} = qrInfraApi;
