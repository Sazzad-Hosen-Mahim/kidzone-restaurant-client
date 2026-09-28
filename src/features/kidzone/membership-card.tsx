import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/page';
import { useGetMembershipQrQuery, useReissueMembershipQrMutation } from './kidzone-api';
import { errorMessage } from '@/app/api-error';
import { formatBusinessDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { QrCard } from '@/types/api';
import { AlertCircle, KeyRound, Loader2, Printer, TriangleAlert } from 'lucide-react';

/**
 * The membership card a guardian carries to the gate.
 *
 * The QR square encodes `qrToken` verbatim, which is exactly what the gate
 * posts back to `/kidzone/checkin/qr` — there is no URL wrapper or JSON
 * envelope around it, so a cheap handheld scanner that simply types what it
 * reads works as well as the camera.
 *
 * Rendered as SVG rather than canvas so it stays crisp at whatever size the
 * printer runs at, and at the highest error correction level because this is a
 * card that will live in a wallet and pick up creases.
 */
export function MembershipCard({ card, className }: { card: QrCard; className?: string }) {
  return (
    <div
      data-print-root
      className={cn('bg-card mx-auto w-full max-w-sm space-y-4 rounded-xl border p-5 text-center', className)}
    >
      <div>
        <p className="text-muted-foreground text-xs tracking-wide uppercase">Membership card</p>
        <h3 className="mt-0.5 text-lg font-semibold">{card.child.name}</h3>
        <p className="text-muted-foreground text-sm">{card.plan.name}</p>
      </div>

      <div className="flex justify-center">
        {/* White plate behind the code: a dark-mode card that printed as light
            on dark would not scan at all. */}
        <div className="rounded-lg bg-white p-3">
          <QRCodeSVG value={card.qrToken} size={188} level="H" marginSize={0} />
        </div>
      </div>

      <dl className="space-y-1 text-sm">
        <CardRow label="Guardian" value={card.customer.name} />
        <CardRow label="Phone" value={card.customer.phone} />
        <CardRow label="Valid until" value={formatBusinessDate(card.endDate)} emphasis />
      </dl>

      {card.usable ? (
        <p className="text-muted-foreground text-xs">
          Show this code at the gate. {card.daysRemaining} day{card.daysRemaining === 1 ? '' : 's'} remaining.
        </p>
      ) : (
        <p className="text-destructive text-xs font-medium">{card.blockedReason}</p>
      )}

      {/* The token in plain text as well: a creased card that will not scan can
          still be typed in, and it is what the guardian received by SMS. */}
      <p className="text-muted-foreground border-t pt-3 font-mono text-[10px] break-all">{card.qrToken}</p>
    </div>
  );
}

function CardRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 truncate', emphasis && 'font-semibold')}>{value}</dd>
    </div>
  );
}

/**
 * Pulls a membership's card so it can be shown or reprinted.
 *
 * Fetching the token is audited server-side, so this only runs while the dialog
 * is actually open — never as part of loading the memberships list.
 */
export function MembershipQrDialog({
  membershipId,
  onOpenChange,
}: {
  membershipId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: card, isLoading, error, refetch } = useGetMembershipQrQuery(membershipId!, {
    skip: !membershipId,
  });

  const [reissuing, setReissuing] = useState(false);

  if (!membershipId) return null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) setReissuing(false);
      }}
    >
      <DialogContent className="max-h-[88svh] overflow-auto sm:max-w-md">
        <DialogHeader className="no-print">
          <DialogTitle>Membership card</DialogTitle>
          <DialogDescription>
            Print this for the guardian to carry. The code is what the gate scans.
          </DialogDescription>
        </DialogHeader>

        {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
        {isLoading ? <Skeleton className="mx-auto h-[420px] w-full max-w-sm rounded-xl" /> : null}

        {card ? (
          reissuing ? (
            <ReissueForm
              card={card}
              onCancel={() => setReissuing(false)}
              onReissued={() => setReissuing(false)}
            />
          ) : (
            <>
              <MembershipCard card={card} />

              <DialogFooter className="no-print sm:justify-between">
                <Button type="button" variant="ghost" size="sm" onClick={() => setReissuing(true)}>
                  <KeyRound /> Card lost
                </Button>
                <Button type="button" onClick={() => window.print()}>
                  <Printer /> Print card
                </Button>
              </DialogFooter>
            </>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Rotating the token.
 *
 * Kept behind a confirmation with a written reason because it is not an
 * undoable action in any useful sense: the card in the guardian's hand stops
 * working the moment this succeeds, and if they had merely left it at home,
 * they are now locked out of a card that was fine. OTP check-in is the right
 * answer for a forgotten card, so the form says so.
 */
function ReissueForm({
  card,
  onCancel,
  onReissued,
}: {
  card: QrCard;
  onCancel: () => void;
  onReissued: () => void;
}) {
  const [reason, setReason] = useState('');
  const [reissue, { isLoading, error }] = useReissueMembershipQrMutation();

  const submit = async () => {
    const result = await reissue({ id: card.membershipId, reason: reason.trim() })
      .unwrap()
      .catch(() => null);

    if (result) {
      toast.success('New card issued', { description: 'The old code no longer works at the gate.' });
      onReissued();
    }
  };

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>This revokes the printed card</AlertTitle>
        <AlertDescription>
          {card.child.name}'s current code stops working immediately. If the guardian only left the card at
          home, check in by OTP instead and leave the code alone.
        </AlertDescription>
      </Alert>

      <div className="space-y-1.5">
        <Label htmlFor="reissue-reason">Why is a new card needed?</Label>
        <Textarea
          id="reissue-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Guardian reported the card lost at the gate"
          rows={3}
          maxLength={500}
          disabled={isLoading}
        />
        <p className="text-muted-foreground text-xs">Recorded in the audit log against your name.</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={reason.trim().length < 5 || isLoading}
          onClick={() => void submit()}
        >
          {isLoading ? <Loader2 className="animate-spin" /> : <KeyRound />}
          Issue a new card
        </Button>
      </DialogFooter>
    </div>
  );
}
