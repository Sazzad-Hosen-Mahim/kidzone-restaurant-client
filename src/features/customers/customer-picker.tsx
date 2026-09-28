import { useEffect, useState } from 'react';
import { useLatest } from '@/hooks/use-latest';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useLazyListCustomersQuery } from './customers-api';
import { formatPhone, isValidBdPhone, PHONE_ERROR } from '@/lib/phone';
import type { Customer } from '@/types/api';
import { CheckCircle2, Search, UserPlus } from 'lucide-react';

export interface CustomerSelection {
  /** Set when an existing record matched. */
  customer: Customer | null;
  phone: string;
  /** Only used when creating a new customer. */
  name: string;
  /** True once the phone has been looked up, whatever the outcome. */
  resolved: boolean;
}

export const emptySelection: CustomerSelection = { customer: null, phone: '', name: '', resolved: false };

/**
 * Find-or-create a guardian by phone.
 *
 * Phone is the identity across both sections, which is exactly why this has to
 * look up before it offers to create: typing a name for someone already on file
 * would be how duplicate customers get made, and duplicates are what break the
 * cross-section report.
 */
export function CustomerPicker({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: CustomerSelection;
  onChange: (value: CustomerSelection) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const [search, { isFetching }] = useLazyListCustomersQuery();
  const [touched, setTouched] = useState(false);

  // The lookup is async, so by the time it resolves the user may already have
  // typed a name. Reading the latest value through a ref means the result is
  // merged into what is on screen now, not into a snapshot from when the
  // request went out.
  const latest = useLatest({ value, onChange });

  const phoneValid = isValidBdPhone(value.phone);

  // Look up as soon as the number is complete, rather than making the user
  // press a button they would press every single time.
  const phone = value.phone;

  useEffect(() => {
    const settle = (patch: Partial<CustomerSelection>) => {
      const current = latest.current.value;
      latest.current.onChange({ ...current, ...patch });
    };

    if (!phoneValid) {
      if (latest.current.value.resolved) settle({ customer: null, resolved: false });
      return;
    }

    let cancelled = false;

    void search({ search: phone, limit: 5 })
      .unwrap()
      .then((result) => {
        if (cancelled) return;
        const normalized = formatPhone(phone);
        const match = result.items.find((candidate) => formatPhone(candidate.phone) === normalized) ?? null;
        settle({ customer: match, resolved: true });
      })
      .catch(() => {
        if (!cancelled) settle({ customer: null, resolved: true });
      });

    return () => {
      cancelled = true;
    };
    // Only the phone number should trigger a lookup; everything else the effect
    // needs is read through `latest` so it cannot go stale.
  }, [phone, phoneValid, search, latest]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="customer-phone">Guardian's phone</Label>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="customer-phone"
            value={value.phone}
            onChange={(event) => onChange({ ...value, phone: event.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="01712345678"
            inputMode="tel"
            autoComplete="off"
            autoFocus={autoFocus}
            disabled={disabled}
            className="tabular pl-9"
            aria-invalid={touched && value.phone.length > 0 && !phoneValid}
          />
        </div>
        {touched && value.phone.length > 0 && !phoneValid ? (
          <p className="text-destructive text-sm">{PHONE_ERROR}</p>
        ) : null}
      </div>

      {phoneValid && isFetching && !value.resolved ? <Skeleton className="h-16 w-full rounded-lg" /> : null}

      {value.customer ? (
        <Alert>
          <CheckCircle2 className="text-success" />
          <AlertDescription>
            <span className="text-foreground font-medium">{value.customer.name}</span> is already on file
            {value.customer.childCount ? (
              <>
                {' '}
                with {value.customer.childCount} {value.customer.childCount === 1 ? 'child' : 'children'}
              </>
            ) : null}
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {phoneValid && value.resolved && !value.customer ? (
        <div className="space-y-3">
          <Alert>
            <UserPlus />
            <AlertDescription>This number is new. Add a name and a customer record will be created.</AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="customer-name">Guardian's name</Label>
            <Input
              id="customer-name"
              value={value.name}
              onChange={(event) => onChange({ ...value, name: event.target.value })}
              placeholder="Shahana Akter"
              disabled={disabled}
              autoFocus
              maxLength={120}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The `customer` field a sale endpoint expects. */
export function toCustomerRef(selection: CustomerSelection) {
  if (selection.customer) return { id: selection.customer.id };
  return { phone: selection.phone, name: selection.name.trim() };
}

export function isCustomerReady(selection: CustomerSelection): boolean {
  if (!isValidBdPhone(selection.phone)) return false;
  if (selection.customer) return true;
  return selection.resolved && selection.name.trim().length >= 2;
}

/** Re-exported so callers do not have to import from two places. */
export { Button as PickerButton };
