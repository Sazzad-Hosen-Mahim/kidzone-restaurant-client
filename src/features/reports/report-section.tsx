import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/page';
import { ExportButtons } from './range-picker';
import { useReportExport } from './use-report-export';
import { errorCode, type QueryError } from '@/app/api-error';
import { useLatest } from '@/hooks/use-latest';
import type { QueryParams } from '@/app/query-helpers';
import type { ReportPeriod } from '@/types/api';
import { Lock } from 'lucide-react';

/**
 * A card wrapping one report: title, export buttons, loading and error states.
 *
 * Factored out because there are sixteen of these and the only things that
 * differ are the title, the query and the body.
 */
export function ReportCard({
  title,
  description,
  exportPath,
  exportName,
  exportParams,
  isLoading,
  isFetching,
  error,
  onRetry,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Omit to hide the export buttons, e.g. for a derived panel. */
  exportPath?: string;
  exportName?: string;
  exportParams?: QueryParams;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: QueryError;
  onRetry?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const exporter = useReportExport(exportPath ?? '', exportName ?? 'report');

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {exportPath ? (
            <ExportButtons
              busy={exporter.busy}
              disabled={isLoading || Boolean(error)}
              onExport={(format) => void exporter.run(format, exportParams ?? {})}
            />
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        {error ? (
          <ReportError error={error} onRetry={onRetry} />
        ) : isLoading ? (
          <Skeleton className="h-52 w-full rounded-lg" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/**
 * A 403 on a report is usually the role restriction rather than a fault, so it
 * is explained rather than shown as an error.
 */
function ReportError({ error, onRetry }: { error: QueryError; onRetry?: () => void }) {
  const code = errorCode(error);

  if (code === 'REPORT_RANGE_NOT_PERMITTED') {
    return (
      <div className="text-muted-foreground flex items-start gap-2 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <span>
          Your role can see today's figures only. An administrator can pull this period for you.
        </span>
      </div>
    );
  }

  return <ErrorState error={error} onRetry={onRetry} />;
}

/**
 * Keeps the shared period header in step with whichever report resolved it.
 *
 * The period object is a fresh one on every fetch, so the effect keys on its
 * three identifying fields and reads the object itself through a ref. Depending
 * on the object would re-report on every refetch even when the period had not
 * changed.
 */
export function usePeriodSync(period: ReportPeriod | undefined, onResolved?: (period: ReportPeriod) => void) {
  const latest = useLatest({ period, onResolved });
  const from = period?.from;
  const to = period?.to;
  const range = period?.range;

  useEffect(() => {
    const { period: current, onResolved: report } = latest.current;
    if (current?.from && report) report(current);
  }, [from, to, range, latest]);
}

export function ReportGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}

/** A simple ranked table body, used by several of the breakdown reports. */
export function RankedRows<T>({
  rows,
  rowKey,
  primary,
  secondary,
  value,
  share,
  emptyLabel = 'Nothing in this period.',
}: {
  rows: T[];
  rowKey: (row: T) => string;
  primary: (row: T) => React.ReactNode;
  secondary?: (row: T) => React.ReactNode;
  value: (row: T) => React.ReactNode;
  share?: (row: T) => number;
  emptyLabel?: string;
}) {
  if (rows.length === 0) return <p className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</p>;

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={rowKey(row)} className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="bg-muted text-muted-foreground tabular flex size-6 shrink-0 items-center justify-center rounded text-xs font-medium">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{primary(row)}</p>
              {secondary ? <p className="text-muted-foreground truncate text-xs">{secondary(row)}</p> : null}
            </div>
            <span className="shrink-0 text-sm">{value(row)}</span>
          </div>

          {share ? (
            <div className="bg-muted ml-9 h-1 overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, share(row))}%` }} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
