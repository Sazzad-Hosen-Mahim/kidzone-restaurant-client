import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Money } from './money';
import { errorCode, errorMessage, type QueryError } from '@/app/api-error';
import { AlertCircle, Ban, Loader2 } from 'lucide-react';

/**
 * Voiding a sale or an order.
 *
 * The wording is deliberate about what a void is and is not: the record is kept
 * and excluded from revenue, not deleted. The reason is mandatory and ends up
 * in the audit log under the admin's name, so the field asks for something a
 * person reading it next month would understand.
 */
export function VoidDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  error,
  receiptNo,
  amount,
  kind,
  extraWarning,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<unknown>;
  isLoading: boolean;
  error: QueryError;
  receiptNo: string;
  amount: number;
  kind: 'sale' | 'order';
  /** Shown when voiding has a side effect, e.g. cancelling a membership. */
  extraWarning?: string;
}) {
  const [reason, setReason] = useState('');

  const submit = async () => {
    const result = await onConfirm(reason.trim());
    if (result) {
      toast.success(`${kind === 'sale' ? 'Sale' : 'Order'} ${receiptNo} voided`);
      setReason('');
      onOpenChange(false);
    }
  };

  const dayClosed = errorCode(error) === 'DAY_ALREADY_CLOSED';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setReason('');
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void {receiptNo}?</DialogTitle>
          <DialogDescription>
            The {kind} is kept on record and marked voided. It stops counting toward revenue but still appears in the
            voids report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted flex items-center justify-between rounded-lg p-3 text-sm">
            <span className="text-muted-foreground">Amount being voided</span>
            <Money value={amount} className="font-semibold" />
          </div>

          {extraWarning ? (
            <Alert>
              <AlertCircle />
              <AlertTitle>This also has an effect</AlertTitle>
              <AlertDescription>{extraWarning}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason</Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Rung up on the wrong table"
              rows={3}
              maxLength={300}
              disabled={isLoading}
              autoFocus
            />
            <p className="text-muted-foreground text-xs">
              Recorded in the audit log against your name. At least 5 characters.
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>{dayClosed ? 'This day is closed' : 'Could not void'}</AlertTitle>
              <AlertDescription>
                {errorMessage(error)}
                {dayClosed ? (
                  <span className="mt-1 block text-xs">Reopen the day from Day closing, then try again.</span>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={reason.trim().length < 5 || isLoading}
            onClick={() => void submit()}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Ban />}
            Void {kind}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
