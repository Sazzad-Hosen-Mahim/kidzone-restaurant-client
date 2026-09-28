import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatBusinessDate, formatTime } from '@/lib/dates';
import type { CheckInResult } from '@/types/api';
import { CalendarClock, CheckCircle2, Printer, RotateCcw } from 'lucide-react';

/**
 * The confirmation screen after a successful check-in.
 *
 * Deliberately a full screen rather than a toast: it carries the gatepass
 * number the guardian needs, and it is what stops the next person being checked
 * in before the staff member has finished with this one.
 */
export function CheckInSuccess({ result, onDone }: { result: CheckInResult; onDone: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 pt-6">
      <Card className="border-success/40">
        <CardContent className="space-y-5 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-success/12 text-success flex size-14 items-center justify-center rounded-full">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{result.child.name} is checked in</h2>
              <p className="text-muted-foreground text-sm">
                {result.membership.planName} · checked in at {formatTime(result.visit.checkInAt)}
              </p>
            </div>
          </div>

          <div className="bg-muted rounded-lg p-4">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Gatepass</p>
            <p className="tabular text-2xl font-semibold">{result.visit.gatepassNo}</p>
          </div>

          <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
            <CalendarClock className="size-4" />
            Membership runs to {formatBusinessDate(result.membership.endDate)} ·{' '}
            <span className="tabular">{result.daysRemaining}</span> days left
          </div>
        </CardContent>
      </Card>

      {/* The renewal nudge belongs here, at the one moment the guardian is
          standing in front of a staff member. */}
      {result.expiringSoon ? (
        <Alert>
          <CalendarClock />
          <AlertTitle>This membership is nearly up</AlertTitle>
          <AlertDescription>
            Only {result.daysRemaining} day{result.daysRemaining === 1 ? '' : 's'} left. A good moment to ask about
            renewing while they are here.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onDone} className="flex-1">
          <RotateCcw /> Check someone else in
        </Button>
        <Button asChild variant="outline">
          <Link to={`/receipts/gatepass/${result.visit.id}`}>
            <Printer /> Gatepass
          </Link>
        </Button>
      </div>
    </div>
  );
}
