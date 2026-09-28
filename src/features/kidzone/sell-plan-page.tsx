import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PageHeader, ErrorState } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { DiscountField, validateDiscount, type DiscountState } from '@/components/shared/discount-field';
import {
  PaymentSplit,
  resolvePayments,
  toPaymentInputs,
  validatePayments,
  type PaymentDraft,
} from '@/components/shared/payment-split';
import { CustomerPicker, emptySelection, isCustomerReady, toCustomerRef, type CustomerSelection } from '@/features/customers/customer-picker';
import { ChildPicker, emptyChildSelection, isChildReady, toChildRef, type ChildSelection } from '@/features/customers/child-picker';
import { useCreateSaleMutation, useListPlansQuery } from './kidzone-api';
import { useGetSettingsQuery } from '@/features/admin/admin-api';
import { useAuth } from '@/features/auth/use-auth';
import { errorCode, errorMessage } from '@/app/api-error';
import { cn } from '@/lib/utils';
import type { KidZonePlan, SaleResult } from '@/types/api';
import { SaleSuccess } from './sale-success';
import { AlertCircle, CalendarDays, Clock, Cookie, Loader2, Lock, Ticket } from 'lucide-react';

/**
 * Selling a Kid Zone plan.
 *
 * One screen rather than a wizard: the counter staff can see the whole
 * transaction at once, and the plan price — which is what the guardian asked
 * about — is visible while the payment is being taken.
 */
export function SellPlanPage() {
  const { can } = useAuth();
  const { data: plansPage, isLoading: plansLoading, error: plansError, refetch } = useListPlansQuery({
    isActive: true,
    limit: 100,
  });
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !can.manageSettings });
  const [createSale, { isLoading: isSaving, error: saveError, reset: resetSale }] = useCreateSaleMutation();

  const [planId, setPlanId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerSelection>(emptySelection);
  const [child, setChild] = useState<ChildSelection>(() => emptyChildSelection());
  const [discount, setDiscount] = useState<DiscountState>({ amount: 0, reason: '' });
  const [paymentsDraft, setPaymentsDraft] = useState<PaymentDraft[] | null>(null);
  const [result, setResult] = useState<SaleResult | null>(null);

  const plans = useMemo(
    () => (plansPage?.items ?? []).filter((plan) => plan.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [plansPage],
  );

  const plan = plans.find((candidate) => candidate.id === planId) ?? null;
  const subtotal = plan?.price ?? 0;

  // The cap is a setting only admins can read; for everyone else the server is
  // the authority and 10 is the shipped default.
  const maxStaffPercent = settings?.maxStaffDiscountPercent ?? 10;
  const discountCheck = validateDiscount(discount, subtotal, maxStaffPercent, can.unlimitedDiscount);
  const total = Math.max(0, subtotal - discount.amount);

  // Derived, not synced by an effect: until the cashier touches the payment
  // rows they are one cash row for the exact total, which is the common case
  // and needs no typing at all.
  const payments = resolvePayments(paymentsDraft, total);

  const paymentCheck = validatePayments(payments, total);

  const ready =
    plan !== null &&
    isCustomerReady(customer) &&
    isChildReady(child) &&
    discountCheck.problem === null &&
    paymentCheck.problem === null;

  const submit = async () => {
    if (!plan) return;

    const sale = await createSale({
      customer: toCustomerRef(customer),
      child: toChildRef(child),
      planId: plan.id,
      ...(discount.amount > 0
        ? { discountAmount: discount.amount, discountReason: discount.reason.trim() }
        : {}),
      payments: toPaymentInputs(payments),
    })
      .unwrap()
      .catch(() => null);

    if (sale) setResult(sale);
  };

  const startNewSale = () => {
    setResult(null);
    setPlanId(null);
    setCustomer(emptySelection);
    setChild(emptyChildSelection());
    setDiscount({ amount: 0, reason: '' });
    setPaymentsDraft(null);
    resetSale();
  };

  if (result) return <SaleSuccess result={result} onNewSale={startNewSale} />;

  const dayClosed = errorCode(saveError) === 'DAY_ALREADY_CLOSED';

  return (
    <div className="space-y-6">
      <PageHeader title="Sell a plan" description="Memberships and one-time sessions." />

      {plansError ? <ErrorState error={plansError} onRetry={() => void refetch()} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Choose a plan</CardTitle>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <p className="text-muted-foreground text-sm">Loading plans…</p>
              ) : plans.length === 0 ? (
                <Alert>
                  <AlertCircle />
                  <AlertTitle>No plans on sale</AlertTitle>
                  <AlertDescription>
                    An administrator needs to create a plan before anything can be sold.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((candidate) => (
                    <PlanCard
                      key={candidate.id}
                      plan={candidate}
                      selected={candidate.id === planId}
                      onSelect={() => setPlanId(candidate.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Who is it for?</CardTitle>
              <CardDescription>
                The phone number links this guardian across the Kid Zone and the restaurant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <CustomerPicker value={customer} onChange={setCustomer} disabled={isSaving} />

              {isCustomerReady(customer) ? (
                <>
                  <Separator />
                  <ChildPicker
                    customerId={customer.customer?.id ?? null}
                    guardianName={customer.customer?.name ?? customer.name}
                    guardianPhone={customer.phone}
                    value={child}
                    onChange={setChild}
                    disabled={isSaving}
                  />
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>3. Take payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {plan ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground truncate">{plan.name}</span>
                    <Money value={plan.price} />
                  </div>
                  {discount.amount > 0 ? (
                    <div className="text-destructive flex items-center justify-between gap-3">
                      <span>Discount ({discountCheck.percent}%)</span>
                      <Money value={-discount.amount} />
                    </div>
                  ) : null}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between gap-3 text-base font-semibold">
                    <span>Total</span>
                    <Money value={total} />
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Choose a plan to see the total.</p>
              )}

              {plan ? (
                <>
                  <Separator />
                  <DiscountField
                    value={discount}
                    onChange={setDiscount}
                    subtotal={subtotal}
                    maxStaffPercent={maxStaffPercent}
                    disabled={isSaving}
                  />
                  <Separator />
                  <PaymentSplit
                    payments={payments}
                    onChange={setPaymentsDraft}
                    amountDue={total}
                    disabled={isSaving}
                  />
                </>
              ) : null}

              {saveError ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>{dayClosed ? 'This day is closed' : 'The sale was not saved'}</AlertTitle>
                  <AlertDescription>
                    {errorMessage(saveError)}
                    {dayClosed ? (
                      <span className="mt-1 block text-xs">
                        Nothing was charged. An administrator can reopen the day from Day closing.
                      </span>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!ready || isSaving}
                onClick={() => void submit()}
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Ticket />}
                Complete sale
              </Button>

              {!ready && plan ? (
                <p className="text-muted-foreground text-center text-xs">
                  {!isCustomerReady(customer)
                    ? 'Add the guardian to continue.'
                    : !isChildReady(child)
                      ? 'Add the child’s details to continue.'
                      : (discountCheck.problem ?? paymentCheck.problem)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-center text-xs">
            Need a renewal instead?{' '}
            <Link to="/kidzone/memberships" className="underline">
              Find the membership
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, selected, onSelect }: { plan: KidZonePlan; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-lg border p-3 text-left transition-colors',
        selected ? 'border-primary bg-primary/5 ring-primary/20 ring-2' : 'hover:bg-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-medium">{plan.name}</p>
        <Money value={plan.price} className="shrink-0 font-semibold" />
      </div>

      <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
        {plan.type === 'MEMBERSHIP' ? (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3" /> {plan.durationDays} days
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {plan.sessionMinutes} minutes
          </span>
        )}
        {plan.includesSnackBox ? (
          <span className="inline-flex items-center gap-1">
            <Cookie className="size-3" /> Snack box
          </span>
        ) : null}
        {plan.requiresVerification ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" /> Verified entry
          </span>
        ) : null}
      </div>

      {plan.type === 'SESSION' && plan.overtimeRatePerBlock ? (
        <Badge variant="outline" className="mt-2 text-[10px] font-normal">
          Overtime <Money value={plan.overtimeRatePerBlock} symbol={false} /> per {plan.overtimeBlockMinutes} min
          after {plan.gracePeriodMinutes} min grace
        </Badge>
      ) : null}
    </button>
  );
}
