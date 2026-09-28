import { useMemo, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Money } from '@/components/shared/money';
import { DiscountField, validateDiscount, type DiscountState } from '@/components/shared/discount-field';
import {
  PaymentSplit,
  resolvePayments,
  toPaymentInputs,
  validatePayments,
  type PaymentDraft,
} from '@/components/shared/payment-split';
import { useListPlansQuery, useRenewMembershipMutation } from './kidzone-api';
import { useGetSettingsQuery } from '@/features/admin/admin-api';
import { useAuth } from '@/features/auth/use-auth';
import { errorMessage } from '@/app/api-error';
import { addDays, formatBusinessDate, todayBusinessDate } from '@/lib/dates';
import type { Membership } from '@/types/api';
import { AlertCircle, CalendarClock, Loader2, RefreshCw } from 'lucide-react';

/**
 * Renewing a membership.
 *
 * The screen shows the term the customer will actually get, because that is the
 * question they ask. Renewing before the current term ends starts the new one
 * the day after, so no paid days are lost; renewing after a lapse restarts
 * today. The server decides this — the preview here just makes it visible
 * before the money is taken.
 */
export function RenewDialog({
  membership,
  onOpenChange,
  onRenewed,
}: {
  membership: Membership | null;
  onOpenChange: (open: boolean) => void;
  onRenewed: () => void;
}) {
  const { can } = useAuth();
  const { data: plansPage } = useListPlansQuery({ isActive: true, type: 'MEMBERSHIP', limit: 100 });
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !can.manageSettings });
  const [renew, { isLoading, error, reset }] = useRenewMembershipMutation();

  const plans = useMemo(() => plansPage?.items.filter((plan) => plan.type === 'MEMBERSHIP') ?? [], [plansPage]);

  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const [discount, setDiscount] = useState<DiscountState>({ amount: 0, reason: '' });
  const [paymentsDraft, setPaymentsDraft] = useState<PaymentDraft[] | null>(null);

  // Default to renewing onto the plan they are already on, derived rather than
  // pushed into state by an effect when the dialog opens.
  const planId = chosenPlanId ?? membership?.planId ?? '';

  const plan = plans.find((candidate) => candidate.id === planId) ?? null;
  const subtotal = plan?.price ?? 0;
  const maxStaffPercent = settings?.maxStaffDiscountPercent ?? 10;
  const total = Math.max(0, subtotal - discount.amount);

  const payments = resolvePayments(paymentsDraft, total);

  if (!membership) return null;

  const today = todayBusinessDate();
  const lapsed = membership.endDate < today;
  const newStart = lapsed ? today : addDays(membership.endDate, 1);
  const newEnd = plan?.durationDays ? addDays(newStart, plan.durationDays - 1) : null;

  const discountCheck = validateDiscount(discount, subtotal, maxStaffPercent, can.unlimitedDiscount);
  const paymentCheck = validatePayments(payments, total);
  const ready = plan !== null && discountCheck.problem === null && paymentCheck.problem === null;

  const submit = async () => {
    const result = await renew({
      id: membership.id,
      body: {
        ...(planId !== membership.planId ? { planId } : {}),
        ...(discount.amount > 0
          ? { discountAmount: discount.amount, discountReason: discount.reason.trim() }
          : {}),
        payments: toPaymentInputs(payments),
      },
    })
      .unwrap()
      .catch(() => null);

    if (result) {
      toast.success('Membership renewed', {
        description: `Runs to ${formatBusinessDate(result.membership?.endDate ?? '')}.`,
      });
      setPaymentsDraft(null);
      onRenewed();
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          reset();
          setChosenPlanId(null);
          setDiscount({ amount: 0, reason: '' });
          setPaymentsDraft(null);
        }
      }}
    >
      <DialogContent className="max-h-[88svh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Renew {membership.child?.name}'s membership</DialogTitle>
          <DialogDescription>
            {membership.customer?.name} · currently {membership.plan?.name}, ending{' '}
            {formatBusinessDate(membership.endDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="renew-plan">Plan</Label>
            <Select value={planId} onValueChange={setChosenPlanId} disabled={isLoading}>
              <SelectTrigger id="renew-plan">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name} — ৳{(candidate.price / 100).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newEnd ? (
            <Alert>
              <CalendarClock />
              <AlertTitle>New term</AlertTitle>
              <AlertDescription>
                {formatBusinessDate(newStart)} to <strong>{formatBusinessDate(newEnd)}</strong>
                <span className="mt-1 block text-xs">
                  {lapsed
                    ? 'The old membership has already lapsed, so the new one starts today.'
                    : 'Starts the day after the current term ends, so no paid days are lost.'}
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          <Separator />

          <DiscountField
            value={discount}
            onChange={setDiscount}
            subtotal={subtotal}
            maxStaffPercent={maxStaffPercent}
            disabled={isLoading}
          />

          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <Money value={total} />
          </div>

          <Separator />

          <PaymentSplit payments={payments} onChange={setPaymentsDraft} amountDue={total} disabled={isLoading} />

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
          <Button type="button" disabled={!ready || isLoading} onClick={() => void submit()}>
            {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Renew and take payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
