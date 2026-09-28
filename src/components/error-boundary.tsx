import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render crash so a single broken screen does not leave the user
 * staring at a blank page mid-shift.
 *
 * The error text is shown in development only: in production it would tell a
 * cashier nothing useful and might disclose internals.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-lg">
          <AlertOctagon />
          <AlertTitle>Something broke on this screen</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              The page stopped working. Reloading usually fixes it. If it keeps happening, tell your administrator
              what you were doing.
            </span>
            {import.meta.env.DEV ? (
              <code className="bg-destructive/10 max-h-40 w-full overflow-auto rounded p-2 text-xs">
                {error.message}
              </code>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
              <RotateCcw /> Reload
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
