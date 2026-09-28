import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { TakaInput } from './taka-input';
import { Money } from './money';
import { cn } from '@/lib/utils';
import { discountPercent } from '@/lib/money';
import { useAuth } from '@/features/auth/use-auth';
import { AlertTriangle } from 'lucide-react';

export interface DiscountState {
  amount: number;
  reason: string;
}

export interface DiscountValidation {
  percent: number;
  overLimit: boolean;
  problem: string | null;
}

/**
 * Checks a discount the way the server will.
 *
 * The limit comparison is exact integer arithmetic, not the rounded display
 * percentage: 1001 poisha off 10000 is 10.01%, which must fail a 10% cap even
 * though it renders as "10%". Getting this wrong client-side would mean
 * offering the cashier a discount the API then rejects.
 */
export function validateDiscount(
  discount: DiscountState,
  subtotal: number,
  maxStaffPercent: number,
  unlimited: boolean,
): DiscountValidation {
  const percent = discountPercent(subtotal, discount.amount);

  if (discount.amount === 0) return { percent: 0, overLimit: false, problem: null };

  if (discount.amount > subtotal) {
    return { percent, overLimit: false, problem: 'A discount cannot be more than the amount due.' };
  }

  if (!discount.reason.trim()) {
    return { percent, overLimit: false, problem: 'A reason is required for any discount.' };
  }

  const overLimit = !unlimited && discount.amount * 100 > subtotal * maxStaffPercent;
  if (overLimit) {
    return {
      percent,
      overLimit: true,
      problem: `Your role may discount up to ${maxStaffPercent}%. This is ${percent}% and needs an administrator.`,
    };
  }

  return { percent, overLimit: false, problem: null };
}

interface DiscountFieldProps {
  value: DiscountState;
  onChange: (value: DiscountState) => void;
  /** Poisha the discount applies to. */
  subtotal: number;
  maxStaffPercent: number;
  disabled?: boolean;
  className?: string;
}

export function DiscountField({
  value,
  onChange,
  subtotal,
  maxStaffPercent,
  disabled,
  className,
}: DiscountFieldProps) {
  const { can } = useAuth();
  const validation = validateDiscount(value, subtotal, maxStaffPercent, can.unlimitedDiscount);

  const applyPercent = (percent: number) => {
    onChange({ ...value, amount: Math.round((subtotal * percent) / 100) });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="discount-amount">Discount</Label>
          <TakaInput
            id="discount-amount"
            value={value.amount}
            onChange={(amount) => onChange({ ...value, amount })}
            disabled={disabled || subtotal === 0}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discount-reason">
            Reason {value.amount > 0 ? <span className="text-destructive">*</span> : null}
          </Label>
          <Input
            id="discount-reason"
            value={value.reason}
            onChange={(event) => onChange({ ...value, reason: event.target.value })}
            placeholder="Sibling discount"
            disabled={disabled || value.amount === 0}
            maxLength={200}
          />
        </div>
      </div>

      {/* Quick percentages, capped at what this role may actually apply. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[5, 10, 15, 20].map((percent) => {
          const blocked = !can.unlimitedDiscount && percent > maxStaffPercent;
          return (
            <Button
              key={percent}
              type="button"
              size="sm"
              variant={validation.percent === percent ? 'secondary' : 'outline'}
              disabled={disabled || subtotal === 0 || blocked}
              onClick={() => applyPercent(percent)}
              title={blocked ? `Above your ${maxStaffPercent}% limit` : undefined}
            >
              {percent}%
            </Button>
          );
        })}
        {value.amount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onChange({ amount: 0, reason: '' })}
          >
            Clear
          </Button>
        ) : null}
        {value.amount > 0 ? (
          <span className="text-muted-foreground ml-auto text-sm">
            <Money value={value.amount} /> off · {validation.percent}%
          </span>
        ) : null}
      </div>

      {validation.problem ? (
        <p className="text-destructive flex items-start gap-1.5 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {validation.problem}
        </p>
      ) : null}
    </div>
  );
}
