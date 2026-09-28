import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { router } from '@/routes/router';
import { useRefreshMutation } from '@/features/auth/auth-api';
import { useAppSelector } from '@/app/store';
import { FullPageSpinner } from '@/routes/guards';

/**
 * Restores the session once on boot.
 *
 * The access token is held in memory only, so a reload starts with nothing. The
 * refresh cookie is httpOnly and the browser sends it automatically, so a
 * single call decides whether this is a signed-in session or not.
 */
function SessionGate({ children }: { children: React.ReactNode }) {
  const [refresh] = useRefreshMutation();
  const status = useAppSelector((state) => state.auth.status);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    void refresh();
  }, [refresh]);

  // Everything below the router waits for this, so a guard never sees a
  // half-restored session and bounces a signed-in user to the login page.
  if (status === 'restoring') return <FullPageSpinner />;

  return <>{children}</>;
}

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <ErrorBoundary>
          <SessionGate>
            <RouterProvider router={router} />
          </SessionGate>
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
