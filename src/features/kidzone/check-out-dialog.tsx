import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Money } from '@/components/shared/money';
import {
  PaymentSplit,
  resolvePayments,
  toPaymentInputs,
  validatePayments,
  type PaymentDraft,
} from '@/components/shared/payment-split';
import { useCheckOutMutation } from './kidzone-api';
import { errorMessage } from '@/app/api-error';
import { formatMinutes, formatTime } from '@/lib/dates';
import type { ActiveVisit } from '@/types/api';
import { AlertCircle, DoorOpen, Loader2 } from 'lucide-react';

/**
 * Check-out, with overtime settled in the same step.
 *
 * The amount shown is the server's projection as of the last poll. The server
 * recomputes it at the moment of check-out, so if the parent takes another
 * twenty minutes to collect, the charge can move — the dialog re-reads it and
 * says so rather than silently taking the stale figure.
 */
export function CheckOutDialog({
  visit,
  onOpenChange,
  onCheckedOut,
}: {
  visit: ActiveVisit | null;
  onOpenChange: (open: boolean) => void;
  onCheckedOut: (childName: string) => void;
}) {
  const [checkOut, { isLoading, error, reset }] = useCheckOutMutation();
  const [paymentsDraft, setPaymentsDraft] = useState<PaymentDraft[] | null>(null);

  const owed = visit?.projectedOvertimeCharge ?? 0;

  // Derived: one cash row for the exact amount owed. Overtime is nearly always
  // settled in cash at the gate, so this removes the four most common taps
  // without an effect that re-renders on every poll of the floor board.
  const payments = owed > 0 ? resolvePayments(paymentsDraft, owed) : [];

  if (!visit) return null;

  const validation = validatePayments(payments, owed);
  const blocked = owed > 0 && !validation.isBalanced;

  const submit = async () => {
    const result = await checkOut({
      id: visit.id,
      payments: owed > 0 ? toPaymentInputs(payments) : undefined,
    })
      .unwrap()
      .catch(() => null);

    if (result) onCheckedOut(visit.child?.name ?? 'Child');
  };

  return (
    <Dialog
      open={visit !== null}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          reset();
          setPaymentsDraft(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Check out {visit.child?.name}</DialogTitle>
          <DialogDescription>
            {visit.sale?.planNameSnapshot ?? 'Membership visit'} · gatepass{' '}
            <span className="tabular">{visit.gatepassNo}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5 text-sm">
            <Row label="Checked in" value={formatTime(visit.checkInAt)} />
            <Row label="Time inside" value={formatMinutes(visit.elapsedMinutes)} />
            {visit.projectedOvertimeMinutes > 0 ? (
              <Row label="Past the grace period" value={formatMinutes(visit.projectedOvertimeMinutes)} />
            ) : null}
          </div>

          <Separator />

          {owed > 0 ? (
            <>
              <Alert>
                <AlertCircle />
                <AlertTitle className="flex items-center justify-between gap-3">
                  <span>Overtime to collect</span>
                  <Money value={owed} className="text-base" />
                </AlertTitle>
                <AlertDescription>
                  Charged in whole blocks. The server confirms the final figure when you check out, so it may rise if
                  they are collected later than now.
                </AlertDescription>
              </Alert>

              <PaymentSplit payments={payments} onChange={setPaymentsDraft} amountDue={owed} disabled={isLoading} />
            </>
          ) : (
            <Alert>
              <AlertTitle>Nothing to pay</AlertTitle>
              <AlertDescription>
                {visit.withinGrace
                  ? 'They are past the session but still inside the grace period, so there is no charge.'
                  : 'No overtime has been run up on this visit.'}
              </AlertDescription>
            </Alert>
          )}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{errorMessage(error)}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={blocked || isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : <DoorOpen />}
            {owed > 0 ? 'Take payment and check out' : 'Check out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}
