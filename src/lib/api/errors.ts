import type { ApiErrorBody } from './types';

/**
 * RTK Query hands back `unknown` for errors. Everything the API returns uses one
 * envelope, so unwrapping it in one place means components never reach into
 * `error.data.error.message` themselves.
 */
export interface NormalisedError {
  message: string;
  code: string;
  /** Present for validation failures; names the offending field. */
  param?: string;
  requestId?: string;
  status?: number;
}

const isApiErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'error' in value &&
  typeof (value as ApiErrorBody).error?.message === 'string';

export const normaliseError = (error: unknown): NormalisedError => {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status, data } = error as { status: number | string; data?: unknown };

    if (isApiErrorBody(data)) {
      return {
        message: data.error.message,
        code: data.error.code,
        ...(data.error.param === undefined ? {} : { param: data.error.param }),
        requestId: data.error.request_id,
        ...(typeof status === 'number' ? { status } : {}),
      };
    }

    // A fetch that never reached the server — wrong base URL, CORS, offline.
    if (status === 'FETCH_ERROR') {
      return {
        message: 'Could not reach the API. Check that the server is running.',
        code: 'network_error',
      };
    }
  }

  return { message: 'Something went wrong.', code: 'unknown_error' };
};
