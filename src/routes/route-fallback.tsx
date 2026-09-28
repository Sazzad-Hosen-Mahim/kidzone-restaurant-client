import { Loader2 } from 'lucide-react';

/** Shown while a lazily loaded route chunk arrives. */
export function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
