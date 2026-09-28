import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TakaInput } from './taka-input';
import { Money } from './money';
import { cn } from '@/lib/utils';
import { sumPoisha } from '@/lib/money';
import { DIGITAL_METHODS, PAYMENT_METHODS, type PaymentInput, type PaymentMethod } from '@/types/api';
import { paymentMethodLabel } from './status-badge';
import { Plus, Trash2 } from 'lucide-react';

export interface PaymentDraft extends PaymentInput {
  /** Stable across re-renders so React does not remount a row while typing. */
  key: string;
}

export function newPayment(method: PaymentMethod = 'CASH', amount = 0): PaymentDraft {
  return { key: crypto.randomUUID(), method, amount, reference: '' };
}

/** Stable, so the untouched default row is not remounted on every render. */
const DEFAULT_PAYMENT_KEY = 'default-cash';

/**
 * The payment rows to show for a bill.
 *
 * Until the cashier touches anything, this is one cash row for the exact
 * amount — which is what most sales are. It is **derived** rather than synced
 * into state by an effect: an effect that setStates on every total change
 * causes a second render pass for every keystroke in the order, and gets the
 * ordering wrong when the total and the edit land together.
 *
 * `draft` being null means "untouched"; the moment the cashier edits anything,
 * their draft takes over and the total no longer overwrites it.
 */
export function resolvePayments(draft: PaymentDraft[] | null, amountDue: number): PaymentDraft[] {
  return draft ?? [{ key: DEFAULT_PAYMENT_KEY, method: 'CASH', amount: amountDue, reference: '' }];
}

export interface PaymentValidation {
  tendered: number;
  /** tendered − amountDue. Zero is the only acceptable value. */
  difference: number;
  isBalanced: boolean;
  /** A sentence to show, or null when the split is ready to submit. */
  problem: string | null;
}

/**
 * Validates a split the same way the server does.
 *
 * The rule the backend will not bend: payments must total **exactly** the
 * amount due. Over- or under-tendering would quietly corrupt the day-end cash
 * reconciliation, so it is rejected rather than rounded — which means the till
 * screen has to help the cashier land on the exact figure, not just warn them
 * afterwards.
 */
export function validatePayments(payments: PaymentDraft[], amountDue: number): PaymentValidation {
  const tendered = sumPoisha(payments.map((payment) => payment.amount));
  const difference = tendered - amountDue;

  let problem: string | null = null;

  if (payments.length === 0) {
    problem = 'Add at least one payment.';
  } else if (payments.some((payment) => payment.amount <= 0)) {
    problem = 'Every payment needs an amount above zero.';
  } else if (difference !== 0) {
    problem =
      difference > 0
        ? 'The payments add up to more than the amount due.'
        : 'The payments do not cover the amount due yet.';
  } else {
    const missingReference = payments.find(
      (payment) => DIGITAL_METHODS.includes(payment.method) && !payment.reference?.trim(),
    );
    if (missingReference) {
      problem = `${paymentMethodLabel(missingReference.method)} needs a transaction reference.`;
    }
  }

  return { tendered, difference, isBalanced: difference === 0, problem };
}

/** Strips the UI-only key before sending to the API. */
export function toPaymentInputs(payments: PaymentDraft[]): PaymentInput[] {
  return payments.map(({ method, amount, reference }) => ({
    method,
    amount,
    ...(reference?.trim() ? { reference: reference.trim() } : {}),
  }));
}

interface PaymentSplitProps {
  payments: PaymentDraft[];
  onChange: (payments: PaymentDraft[]) => void;
  /** Poisha the payments must add up to. */
  amountDue: number;
  disabled?: boolean;
  className?: string;
}

export function PaymentSplit({ payments, onChange, amountDue, disabled, className }: PaymentSplitProps) {
  const validation = useMemo(() => validatePayments(payments, amountDue), [payments, amountDue]);
  const remaining = amountDue - validation.tendered;

  const update = (index: number, patch: Partial<PaymentDraft>) => {
    onChange(payments.map((payment, i) => (i === index ? { ...payment, ...patch } : payment)));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-2">
        {payments.map((payment, index) => {
          const needsReference = DIGITAL_METHODS.includes(payment.method);

          return (
            <div key={payment.key} className="bg-muted/40 grid gap-2 rounded-lg border p-2 sm:grid-cols-[auto_1fr_auto]">
              <Select
                value={payment.method}
                disabled={disabled}
                onValueChange={(method) =>
                  update(index, {
                    method: method as PaymentMethod,
                    // Switching to cash drops a reference that no longer applies.
                    reference: DIGITAL_METHODS.includes(method as PaymentMethod) ? payment.reference : '',
                  })
                }
              >
                <SelectTrigger className="sm:w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {paymentMethodLabel(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sized by its own width, not the viewport: in the narrow checkout
                  panel, splitting amount and reference side by side leaves
                  neither enough room to show a figure. */}
              <div className="@container min-w-0">
                <div className={cn('grid gap-2', needsReference && '@xs:grid-cols-2')}>
                  <TakaInput
                    value={payment.amount}
                    onChange={(amount) => update(index, { amount })}
                    disabled={disabled}
                    aria-label={`Amount for payment ${index + 1}`}
                  />
                  {needsReference ? (
                    <Input
                      value={payment.reference ?? ''}
                      onChange={(event) => update(index, { reference: event.target.value })}
                      placeholder="Transaction ID"
                      disabled={disabled}
                      aria-label={`${paymentMethodLabel(payment.method)} transaction reference`}
                      className="font-mono text-sm"
                    />
                  ) : null}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || payments.length === 1}
                onClick={() => onChange(payments.filter((_, i) => i !== index))}
                aria-label={`Remove payment ${index + 1}`}
              >
                <Trash2 className="text-muted-foreground size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || payments.length >= 5}
          onClick={() => onChange([...payments, newPayment('BKASH', Math.max(0, remaining))])}
        >
          <Plus /> Split payment
        </Button>

        {/* One tap to land on the exact figure — the difference between a
            smooth till and a cashier doing mental arithmetic at a queue. */}
        {remaining !== 0 && payments.length > 0 ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => {
              const last = payments.length - 1;
              update(last, { amount: Math.max(0, payments[last].amount + remaining) });
            }}
          >
            Set exact amount
          </Button>
        ) : null}
      </div>

      <div className="space-y-1 rounded-lg border p-3 text-sm">
        <Row label="Amount due" value={<Money value={amountDue} className="font-semibold" />} />
        <Row label="Tendered" value={<Money value={validation.tendered} />} />
        {validation.difference !== 0 ? (
          <Row
            label={validation.difference > 0 ? 'Over by' : 'Still to pay'}
            value={<Money value={Math.abs(validation.difference)} className="text-destructive font-semibold" />}
          />
        ) : null}
      </div>

      {validation.problem ? (
        <p className="text-destructive text-sm" role="alert">
          {validation.problem}
        </p>
      ) : (
        <p className="text-success text-sm">Payments balance exactly.</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="text-muted-foreground font-normal">{label}</Label>
      {value}
    </div>
  );
}
