import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { landingRouteFor, type Capabilities } from '@/app/permissions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/page';
import { Loader2, ShieldOff } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Requires a session.
 *
 * While the app is still trying to restore one from the refresh cookie it shows
 * a spinner rather than redirecting — bouncing a signed-in user to the login
 * screen for the half-second the refresh takes would be its own bug.
 */
export function RequireAuth() {
  const { isAuthenticated, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) return <FullPageSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

/**
 * Requires a capability.
 *
 * Capabilities rather than raw roles, so a route says what it needs — "can take
 * orders" — instead of restating the role matrix in every guard.
 */
export function RequireCapability({ capability }: { capability: keyof Capabilities }) {
  const { can, role } = useAuth();

  if (!can[capability]) return <NotPermitted role={role} />;

  return <Outlet />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center" aria-busy="true">
      <div className="text-muted-foreground flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">Restoring your session…</p>
      </div>
    </div>
  );
}

function NotPermitted({ role }: { role: string | undefined }) {
  return (
    <EmptyState
      icon={ShieldOff}
      title="You do not have access to this"
      description="Your role does not include this area. If you think that is wrong, ask an administrator."
      action={
        <Button asChild variant="outline">
          <Link to={landingRouteFor(role as never)}>Go to your home screen</Link>
        </Button>
      }
      className="min-h-[60vh]"
    />
  );
}
