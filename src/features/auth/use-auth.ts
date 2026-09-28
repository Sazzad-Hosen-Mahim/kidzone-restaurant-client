import { useMemo } from 'react';
import { useAppSelector } from '@/app/store';
import { capabilitiesFor, type Capabilities } from '@/app/permissions';
import type { AuthUser, Role } from '@/types/api';

export interface AuthContext {
  user: AuthUser | null;
  role: Role | undefined;
  isAuthenticated: boolean;
  isRestoring: boolean;
  can: Capabilities;
}

/** The session, plus what this role is allowed to do. */
export function useAuth(): AuthContext {
  const { user, status } = useAppSelector((state) => state.auth);

  return useMemo(
    () => ({
      user,
      role: user?.role,
      isAuthenticated: status === 'authenticated' && user !== null,
      isRestoring: status === 'restoring',
      can: capabilitiesFor(user?.role),
    }),
    [user, status],
  );
}
