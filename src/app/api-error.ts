import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import type { ApiError } from '@/types/api';

/**
 * Turning whatever RTK Query throws into something showable.
 *
 * The backend always answers with `{ statusCode, error, message, details? }`,
 * so the job here is mostly to find that shape inside the wrapper and to cope
 * with the cases where it is absent: the network was down, or a proxy returned
 * HTML.
 */

export type QueryError = FetchBaseQueryError | SerializedError | undefined;

export function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

/** Extracts the API's error envelope, when there is one. */
export function toApiError(error: QueryError): ApiError | null {
  if (!isFetchBaseQueryError(error)) return null;

  const body = 'data' in error ? error.data : undefined;
  if (body && typeof body === 'object' && 'error' in body && 'message' in body) {
    return body as ApiError;
  }
  return null;
}

/** The stable machine-readable code, for branching. */
export function errorCode(error: QueryError): string | null {
  return toApiError(error)?.error ?? null;
}

export function errorStatus(error: QueryError): number | null {
  if (!isFetchBaseQueryError(error)) return null;
  if (typeof error.status === 'number') return error.status;
  const api = toApiError(error);
  return api?.statusCode ?? null;
}

/**
 * A sentence to show the user.
 *
 * The API's messages are written for staff — "This membership expired on
 * 2026-09-21. Please renew it to check in." — so they are used as-is rather
 * than replaced with something generic.
 */
export function errorMessage(error: QueryError, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;

  const api = toApiError(error);
  if (api) return api.message;

  if (isFetchBaseQueryError(error)) {
    if (error.status === 'FETCH_ERROR') {
      return 'Cannot reach the server. Check that the API is running and your connection is up.';
    }
    if (error.status === 'TIMEOUT_ERROR') return 'The server took too long to respond. Please try again.';
    if (error.status === 'PARSING_ERROR') return 'The server sent a response this app could not read.';
    if (typeof error.status === 'number') {
      if (error.status === 401) return 'Your session has ended. Please sign in again.';
      if (error.status === 403) return 'You do not have permission to do that.';
      if (error.status === 404) return 'That record no longer exists.';
      if (error.status >= 500) return 'The server ran into a problem. Please try again shortly.';
    }
    return fallback;
  }

  return ('message' in error && error.message) || fallback;
}

/**
 * Per-field problems from the global ValidationPipe, which arrive as
 * `details.errors: string[]` with the field name at the start of each sentence.
 */
export function validationErrors(error: QueryError): string[] {
  const api = toApiError(error);
  if (api?.error !== 'VALIDATION_FAILED') return [];
  const details = api.details as { errors?: unknown } | undefined;
  return Array.isArray(details?.errors) ? details.errors.filter((e): e is string => typeof e === 'string') : [];
}

/** Typed access to an error's `details`, e.g. the end date on an expired membership. */
export function errorDetails<T = Record<string, unknown>>(error: QueryError): T | null {
  return (toApiError(error)?.details as T | undefined) ?? null;
}
