import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { landingRouteFor } from '@/app/permissions';

/**
 * Sends each role to the screen they actually work on: an admin to the
 * dashboard, a Kid Zone manager to the gate, a cashier to the till.
 */
export function LandingRedirect() {
  const { role } = useAuth();
  return <Navigate to={landingRouteFor(role)} replace />;
}
