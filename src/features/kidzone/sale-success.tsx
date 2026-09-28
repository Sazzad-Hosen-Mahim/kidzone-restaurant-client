import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/shared/money';
import { MembershipCard } from './membership-card';
import { useGetMembershipQrQuery } from './kidzone-api';
import { formatBusinessDate, formatTime } from '@/lib/dates';
import type { SaleResult } from '@/types/api';
import { CalendarCheck, CheckCircle2, DoorOpen, MessageSquare, Plus, Printer } from 'lucide-react';

/**
 * Confirmation after a Kid Zone sale.
 *
 * What it shows depends on what the sale produced: a membership sale ends with
 * a dated card and an SMS to the guardian; a session sale has already checked
 * the child in and ends with a gatepass to print.
 */
export function SaleSuccess({ result, onNewSale }: { result: SaleResult; onNewSale: () => void }) {
  const { sale, membership, visit } = result;

  return (
    <div className="mx-auto max-w-lg space-y-4 pt-4">
      <Card className="border-success/40">
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="bg-success/12 text-success flex size-14 items-center justify-center rounded-full">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Sale complete</h2>
              <p className="text-muted-foreground text-sm">
                Receipt <span className="tabular">{sale.receiptNo}</span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-sm">
            <Row label={sale.planNameSnapshot} value={<Money value={sale.unitPriceSnapshot} />} />
            {sale.discountAmount > 0 ? (
              <Row
                label={`Discount — ${sale.discountReason}`}
                value={<Money value={-sale.discountAmount} className="text-destructive" />}
              />
            ) : null}
            <Separator className="my-2" />
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Paid</span>
              <Money value={sale.totalAmount} />
            </div>
          </div>
        </CardContent>
      </Card>

      {membership ? (
        <>
          <Alert>
            <CalendarCheck />
            <AlertTitle>Membership active</AlertTitle>
            <AlertDescription className="space-y-1">
              <span>
                Runs from {formatBusinessDate(membership.startDate)} to{' '}
                <strong>{formatBusinessDate(membership.endDate)}</strong>.
              </span>
              <span className="flex items-center gap-1.5 text-xs">
                <MessageSquare className="size-3" />
                The guardian has been texted the plan, the end date and their code.
              </span>
            </AlertDescription>
          </Alert>

          <MembershipQrPanel membershipId={membership.id} />
        </>
      ) : null}

      {visit ? (
        <Alert>
          <DoorOpen />
          <AlertTitle>Checked in on gatepass {visit.gatepassNo}</AlertTitle>
          <AlertDescription>
            In at {formatTime(visit.checkInAt)}
            {visit.expectedCheckOutAt ? <>, due out at {formatTime(visit.expectedCheckOutAt)}</> : null}. The
            gatepass has been texted to the guardian.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onNewSale} className="flex-1">
          <Plus /> New sale
        </Button>
        <Button asChild variant="outline">
          <Link to={`/receipts/kidzone/${sale.id}`}>
            <Printer /> Receipt
          </Link>
        </Button>
        {visit ? (
          <Button asChild variant="outline">
            <Link to={`/receipts/gatepass/${visit.id}`}>
              <Printer /> Gatepass
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The card to hand over, shown the moment the membership exists.
 *
 * Fetched rather than read off the sale response so the card carries the same
 * names and dates a reprint would, and so issuing it leaves the same audit
 * trail. A failure here is not worth an error state: the sale went through, the
 * guardian has the code by SMS, and the card can be printed again from the
 * memberships list.
 */
function MembershipQrPanel({ membershipId }: { membershipId: string }) {
  const { data: card, isLoading } = useGetMembershipQrQuery(membershipId);

  if (isLoading) return <Skeleton className="mx-auto h-[420px] w-full max-w-sm rounded-xl" />;
  if (!card) return null;

  return (
    <div className="space-y-3">
      <MembershipCard card={card} />
      <Button type="button" variant="outline" className="no-print w-full" onClick={() => window.print()}>
        <Printer /> Print the membership card
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground min-w-0">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}
