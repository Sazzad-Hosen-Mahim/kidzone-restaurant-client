import { fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { Mutex } from './mutex';
import { credentialsReceived, loggedOut } from '@/features/auth/auth-slice';
import type { RootState } from './store';
import type { ApiEnvelope, LoginResponse } from '@/types/api';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  // The refresh token is an httpOnly cookie on a different origin, so it only
  // travels if credentials are included on every request.
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken;
    if (token) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

/**
 * Serialises refreshes.
 *
 * Without this, a screen that fires five queries at once would, on an expired
 * token, send five refreshes. The backend rotates on every refresh and treats a
 * replayed token as theft — it revokes the whole session — so the four losers
 * would log the user out. One refresh at a time, with everyone else waiting for
 * its result, is the difference between a seamless renewal and a surprise
 * logout mid-shift.
 */
const refreshMutex = new Mutex();

export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  // If a refresh is already in flight, wait for it rather than racing it.
  await refreshMutex.waitForUnlock();

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401) return result;

  // `POST /auth/refresh` returning 401 means the cookie itself is finished;
  // retrying would loop.
  const isRefreshCall = typeof args !== 'string' && args.url === '/auth/refresh';
  if (isRefreshCall) {
    api.dispatch(loggedOut());
    return result;
  }

  if (refreshMutex.isLocked()) {
    // Someone else refreshed while we were waiting; retry with the new token.
    await refreshMutex.waitForUnlock();
    return rawBaseQuery(args, api, extraOptions);
  }

  const release = await refreshMutex.acquire();

  try {
    const refreshResult = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extraOptions);

    const envelope = refreshResult.data as ApiEnvelope<LoginResponse> | undefined;

    if (envelope?.data?.accessToken) {
      api.dispatch(
        credentialsReceived({ user: envelope.data.user, accessToken: envelope.data.accessToken }),
      );
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(loggedOut());
    }
  } finally {
    release();
  }

  return result;
};

/** Unwraps the API's `{ data, meta }` envelope down to `data`. */
export function unwrapData<T>(response: ApiEnvelope<T>): T {
  return response.data;
}
