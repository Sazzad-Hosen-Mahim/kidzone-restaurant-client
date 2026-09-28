import { api } from '@/app/api';
import { transformEnvelope } from '@/app/query-helpers';
import { credentialsReceived, loggedOut, restorationFailed } from './auth-slice';
import type { ApiEnvelope, LoginResponse, Profile } from '@/types/api';

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const authApi = api.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      transformResponse: transformEnvelope<LoginResponse>,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(credentialsReceived({ user: data.user, accessToken: data.accessToken }));
      },
      invalidatesTags: ['Auth'],
    }),

    /**
     * Restores a session from the refresh cookie on boot.
     *
     * A failure here is the normal "not signed in" case, not an error worth
     * surfacing, so it resolves the auth status either way.
     */
    refresh: build.mutation<LoginResponse | null, void>({
      query: () => ({ url: '/auth/refresh', method: 'POST' }),
      transformResponse: (response: ApiEnvelope<LoginResponse>) => response.data,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data) dispatch(credentialsReceived({ user: data.user, accessToken: data.accessToken }));
          else dispatch(restorationFailed());
        } catch {
          dispatch(restorationFailed());
        }
      },
    }),

    logout: build.mutation<{ success: true }, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      transformResponse: transformEnvelope<{ success: true }>,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          // Whether or not the server acknowledged, this browser is done with
          // the session; holding on to a token after the user clicked sign out
          // would be the wrong failure mode.
          dispatch(loggedOut());
          dispatch(api.util.resetApiState());
        }
      },
    }),

    me: build.query<Profile, void>({
      query: () => '/auth/me',
      transformResponse: transformEnvelope<Profile>,
      providesTags: ['Auth'],
    }),

    changePassword: build.mutation<{ success: true }, ChangePasswordRequest>({
      query: (body) => ({ url: '/auth/change-password', method: 'PATCH', body }),
      transformResponse: transformEnvelope<{ success: true }>,
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        await queryFulfilled;
        // The backend revokes every session on a password change, including
        // this one, so the only honest thing to do is sign out locally too.
        dispatch(loggedOut());
        dispatch(api.util.resetApiState());
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useRefreshMutation,
  useLogoutMutation,
  useMeQuery,
  useChangePasswordMutation,
} = authApi;
