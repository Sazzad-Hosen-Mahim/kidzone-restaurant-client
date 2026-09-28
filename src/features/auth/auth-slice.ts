import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '@/types/api';

/**
 * Session state.
 *
 * The access token lives **in memory only**. It is deliberately not in
 * localStorage: the refresh token is already in an httpOnly cookie the browser
 * handles, and keeping the access token out of storage means an XSS payload
 * cannot simply read a long-lived credential out of the page.
 *
 * The cost is that a page reload starts with no token, which is what
 * `status: 'restoring'` covers — the app calls `POST /auth/refresh` once on
 * boot, and the cookie either restores the session or it does not.
 */
export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  /** Where to go after signing in, captured when a guard bounced the user. */
  redirectTo: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: 'restoring',
  redirectTo: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived(state, action: PayloadAction<{ user: AuthUser; accessToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.status = 'authenticated';
    },
    /** The refresh attempt on boot found no usable cookie. */
    restorationFailed(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
    },
    loggedOut(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'anonymous';
      state.redirectTo = null;
    },
    redirectCaptured(state, action: PayloadAction<string | null>) {
      state.redirectTo = action.payload;
    },
  },
});

export const { credentialsReceived, restorationFailed, loggedOut, redirectCaptured } = authSlice.actions;
export const authReducer = authSlice.reducer;
