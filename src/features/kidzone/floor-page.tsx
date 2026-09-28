import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { PageHeader, CardsSkeleton, EmptyState, ErrorState } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { VerificationBadge } from '@/components/shared/status-badge';
import { useListActiveVisitsQuery } from './kidzone-api';
import { CheckOutDialog } from './check-out-dialog';
import { formatMinutes, formatTime } from '@/lib/dates';
import { formatPhone, telHref } from '@/lib/phone';
import { cn } from '@/lib/utils';
import type { ActiveVisit } from '@/types/api';
import { DoorOpen, Phone, RefreshCw, TriangleAlert, Users } from 'lucide-react';

/**
 * Who is inside right now.
 *
 * Polled every 30 seconds. A session timer only needs to be right to the
 * minute, and polling survives a tablet sleeping and waking without any of the
 * reconnection logic a socket would need.
 *
 * The API already sorts overtime first and computes every timer server-side, so
 * this screen renders what it is given rather than recomputing elapsed time
 * from a clock that may be wrong.
 */
export function FloorPage() {
  const { data: visits, isLoading, isFetching, error, refetch } = useListActiveVisitsQuery(undefined, {
    pollingInterval: 30_000,
    refetchOnFocus: true,
  });

  const [checkingOut, setCheckingOut] = useState<ActiveVisit | null>(null);

  const overtime = visits?.filter((visit) => visit.isOvertime) ?? [];
  const owed = overtime.reduce((total, visit) => total + visit.projectedOvertimeCharge, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="On the floor"
        description="Live check-in board. Refreshes every 30 seconds."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Children inside" value={String(visits?.length ?? 0)} icon={Users} />
        <StatTile
          label="In overtime"
          value={String(overtime.length)}
          icon={TriangleAlert}
          tone={overtime.length > 0 ? 'danger' : undefined}
        />
        <StatTile
          label="Overtime owed"
          value={<Money value={owed} />}
          icon={DoorOpen}
          tone={owed > 0 ? 'danger' : undefined}
        />
      </div>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isLoading ? <CardsSkeleton count={3} /> : null}

      {visits && visits.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Users}
              title="Nobody is inside"
              description="Children appear here as soon as they are checked in."
              action={
                <Button asChild variant="outline">
                  <Link to="/kidzone/checkin">Go to check in</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <div className={cn('grid gap-3 md:grid-cols-2 xl:grid-cols-3', isFetching && 'opacity-70 transition-opacity')}>
        {visits?.map((visit) => (
          <VisitCard key={visit.id} visit={visit} onCheckOut={() => setCheckingOut(visit)} />
        ))}
      </div>

      <CheckOutDialog
        visit={checkingOut}
        onOpenChange={(open) => !open && setCheckingOut(null)}
        onCheckedOut={(name) => {
          setCheckingOut(null);
          toast.success(`${name} checked out`);
        }}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'danger';
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            tone === 'danger' ? 'bg-destructive/12 text-destructive' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className={cn('tabular text-xl font-semibold', tone === 'danger' && 'text-destructive')}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function VisitCard({ visit, onCheckOut }: { visit: ActiveVisit; onCheckOut: () => void }) {
  const sessionMinutes = visit.sale?.plan?.sessionMinutes ?? null;
  const progress =
    sessionMinutes && sessionMinutes > 0
      ? Math.min(100, Math.round((visit.elapsedMinutes / sessionMinutes) * 100))
      : null;

  const medicalNotes = visit.child?.medicalNotes;

  return (
    <Card
      className={cn(
        'transition-colors',
        visit.isOvertime && 'border-destructive/50 bg-destructive/[0.03]',
        visit.withinGrace && !visit.isOvertime && 'border-warning/50',
      )}
    >
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{visit.child?.name ?? 'Child'}</p>
            <p className="text-muted-foreground truncate text-xs">
              {visit.sale?.planNameSnapshot ?? 'Membership visit'}
            </p>
          </div>
          <VerificationBadge method={visit.verificationMethod} />
        </div>

        {medicalNotes ? (
          <p className="text-warning-foreground dark:text-warning bg-warning/10 flex items-start gap-1.5 rounded-md p-2 text-xs">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            {medicalNotes}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <div className="text-muted-foreground flex items-center justify-between text-xs">
            <span>In at {formatTime(visit.checkInAt)}</span>
            <span className="tabular">{formatMinutes(visit.elapsedMinutes)} elapsed</span>
          </div>

          {progress !== null ? (
            <>
              <Progress
                value={Math.min(progress, 100)}
                className={cn('h-1.5', visit.isOvertime && '[&>div]:bg-destructive')}
              />
              <p
                className={cn(
                  'tabular text-xs',
                  visit.isOvertime ? 'text-destructive font-medium' : 'text-muted-foreground',
                )}
              >
                {visit.remainingMinutes !== null && visit.remainingMinutes >= 0
                  ? `${formatMinutes(visit.remainingMinutes)} left`
                  : `${formatMinutes(Math.abs(visit.remainingMinutes ?? 0))} over`}
                {visit.withinGrace ? ' · within grace period' : ''}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">Membership visit — no time limit</p>
          )}
        </div>

        {visit.projectedOvertimeCharge > 0 ? (
          <div className="bg-destructive/10 text-destructive flex items-center justify-between rounded-md px-2.5 py-2 text-sm">
            <span>Overtime due</span>
            <Money value={visit.projectedOvertimeCharge} className="font-semibold" />
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="min-w-0 text-xs">
            <p className="text-muted-foreground truncate">{visit.customer?.name}</p>
            <a
              href={telHref(visit.customer?.phone)}
              className="text-primary tabular inline-flex items-center gap-1 hover:underline"
            >
              <Phone className="size-3" />
              {formatPhone(visit.customer?.phone)}
            </a>
          </div>

          <Button type="button" size="sm" onClick={onCheckOut}>
            <DoorOpen /> Check out
          </Button>
        </div>

        <Badge variant="outline" className="tabular text-[10px] font-normal">
          {visit.gatepassNo}
        </Badge>
      </CardContent>
    </Card>
  );
}
