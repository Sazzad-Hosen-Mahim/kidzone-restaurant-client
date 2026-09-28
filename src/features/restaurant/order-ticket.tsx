import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Money } from '@/components/shared/money';
import { EmptyState } from '@/components/shared/page';
import { DiscountField, validateDiscount } from '@/components/shared/discount-field';
import {
  PaymentSplit,
  resolvePayments,
  toPaymentInputs,
  validatePayments,
  type PaymentDraft,
} from '@/components/shared/payment-split';
import { useAppDispatch, useAppSelector } from '@/app/store';
import {
  cartCleared,
  customerChanged,
  discountChanged,
  lineNoteChanged,
  lineRemoved,
  quantityChanged,
  tableChanged,
} from './cart-slice';
import { useCreateOrderMutation } from './restaurant-api';
import { useGetSettingsQuery } from '@/features/admin/admin-api';
import { useAuth } from '@/features/auth/use-auth';
import { priceOrder } from '@/lib/money';
import { errorCode, errorMessage } from '@/app/api-error';
import { isValidBdPhone } from '@/lib/phone';
import type { Order } from '@/types/api';
import { AlertCircle, Loader2, Minus, Plus, ShoppingCart, StickyNote, Trash2 } from 'lucide-react';

/**
 * The running order.
 *
 * The totals are computed locally with the same arithmetic the server uses —
 * subtotal, then discount, then service charge, then VAT, each rounded once —
 * so the cashier can quote a figure before submitting. The server recomputes
 * everything from its own prices and percentages; if the two ever disagree, the
 * server's answer is the one that stands and the submit fails loudly rather
 * than quietly charging a different amount.
 */
export function OrderTicket({ onCompleted }: { onCompleted: (order: Order) => void }) {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((state) => state.cart);
  const { can } = useAuth();

  const { data: settings } = useGetSettingsQuery(undefined, { skip: !can.manageSettings });
  const [createOrder, { isLoading, error, reset }] = useCreateOrderMutation();

  const [paymentsDraft, setPaymentsDraft] = useState<PaymentDraft[] | null>(null);
  const [showNoteFor, setShowNoteFor] = useState<number | null>(null);

  // Percentages are snapshotted onto the order server-side. Non-admins cannot
  // read settings, so the preview falls back to the shipped defaults — and the
  // authoritative figures come back on the created order either way.
  const vatPercent = settings?.vatPercent ?? 5;
  const serviceChargePercent = settings?.serviceChargePercent ?? 10;
  const maxStaffPercent = settings?.maxStaffDiscountPercent ?? 10;

  const pricing = useMemo(
    () =>
      priceOrder({
        lines: cart.lines,
        discountAmount: cart.discountAmount,
        serviceChargePercent,
        vatPercent,
      }),
    [cart.lines, cart.discountAmount, serviceChargePercent, vatPercent],
  );

  // Derived rather than synced by an effect: the total changes on every tap of
  // the menu, and an effect that setStates each time would re-render twice per
  // item added.
  const payments = resolvePayments(paymentsDraft, pricing.totalAmount);

  const discountCheck = validateDiscount(
    { amount: cart.discountAmount, reason: cart.discountReason },
    pricing.subtotal,
    maxStaffPercent,
    can.unlimitedDiscount,
  );
  const paymentCheck = validatePayments(payments, pricing.totalAmount);

  const phoneGiven = cart.customerPhone.trim().length > 0;
  const phoneValid = !phoneGiven || isValidBdPhone(cart.customerPhone);

  const ready =
    cart.lines.length > 0 && discountCheck.problem === null && paymentCheck.problem === null && phoneValid;

  const submit = async () => {
    const order = await createOrder({
      items: cart.lines.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        ...(line.note ? { note: line.note } : {}),
      })),
      ...(phoneGiven
        ? { customerPhone: cart.customerPhone.trim(), ...(cart.customerName.trim() ? { customerName: cart.customerName.trim() } : {}) }
        : {}),
      ...(cart.tableNo.trim() ? { tableNo: cart.tableNo.trim() } : {}),
      ...(cart.discountAmount > 0
        ? { discountAmount: cart.discountAmount, discountReason: cart.discountReason.trim() }
        : {}),
      payments: toPaymentInputs(payments),
    })
      .unwrap()
      .catch(() => null);

    if (order) {
      setPaymentsDraft(null);
      onCompleted(order);
    }
  };

  const needsCustomerName = errorCode(error) === 'CUSTOMER_NAME_REQUIRED';

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between gap-2 border-b py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="size-4" /> Current order
        </CardTitle>
        {cart.lines.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              dispatch(cartCleared());
              reset();
            }}
            disabled={isLoading}
          >
            Clear
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4 py-4">
        {cart.lines.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No items yet"
            description="Tap a dish on the menu to start the order."
            className="py-8"
          />
        ) : (
          <div className="space-y-2">
            {cart.lines.map((line, index) => (
              <div key={`${line.menuItemId}-${index}`} className="space-y-1.5 rounded-lg border p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="text-muted-foreground tabular text-xs">
                      <Money value={line.unitPrice} symbol={false} /> each
                    </p>
                  </div>
                  <Money value={line.unitPrice * line.quantity} className="shrink-0 text-sm font-semibold" />
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={isLoading}
                    onClick={() => dispatch(quantityChanged({ index, quantity: line.quantity - 1 }))}
                    aria-label={`One fewer ${line.name}`}
                  >
                    <Minus className="size-3" />
                  </Button>

                  <span className="tabular w-8 text-center text-sm font-medium">{line.quantity}</span>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={isLoading}
                    onClick={() => dispatch(quantityChanged({ index, quantity: line.quantity + 1 }))}
                    aria-label={`One more ${line.name}`}
                  >
                    <Plus className="size-3" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isLoading}
                    onClick={() => setShowNoteFor(showNoteFor === index ? null : index)}
                    aria-label={`Kitchen note for ${line.name}`}
                  >
                    <StickyNote className={line.note ? 'text-primary size-3.5' : 'size-3.5'} />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground ml-auto size-7"
                    disabled={isLoading}
                    onClick={() => dispatch(lineRemoved(index))}
                    aria-label={`Remove ${line.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {showNoteFor === index || line.note ? (
                  <Input
                    value={line.note ?? ''}
                    onChange={(event) => dispatch(lineNoteChanged({ index, note: event.target.value }))}
                    placeholder="Kitchen note, e.g. no chilli"
                    className="h-8 text-xs"
                    maxLength={200}
                    disabled={isLoading}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}

        {cart.lines.length > 0 ? (
          <>
            <Separator />

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="table-no">Table</Label>
                <Input
                  id="table-no"
                  value={cart.tableNo}
                  onChange={(event) => dispatch(tableChanged(event.target.value))}
                  placeholder="T-12"
                  maxLength={20}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customer-phone-order">Customer phone (optional)</Label>
                <Input
                  id="customer-phone-order"
                  value={cart.customerPhone}
                  onChange={(event) => dispatch(customerChanged({ phone: event.target.value }))}
                  placeholder="01712345678"
                  inputMode="tel"
                  className="tabular"
                  disabled={isLoading}
                  aria-invalid={!phoneValid}
                />
              </div>
            </div>

            {!phoneValid ? (
              <p className="text-destructive text-xs">That is not a valid Bangladeshi mobile number.</p>
            ) : null}

            {/* Only asked for once the server says the number is new — there is
                no point demanding a name for a guardian already on file. */}
            {needsCustomerName ? (
              <div className="space-y-1.5">
                <Label htmlFor="customer-name-order">Customer name</Label>
                <Input
                  id="customer-name-order"
                  value={cart.customerName}
                  onChange={(event) =>
                    dispatch(customerChanged({ phone: cart.customerPhone, name: event.target.value }))
                  }
                  placeholder="Walk-in guest"
                  maxLength={120}
                  autoFocus
                />
                <p className="text-muted-foreground text-xs">
                  This number is not on file yet, so a name is needed to create the customer.
                </p>
              </div>
            ) : null}

            <Separator />

            <DiscountField
              value={{ amount: cart.discountAmount, reason: cart.discountReason }}
              onChange={(next) => dispatch(discountChanged(next))}
              subtotal={pricing.subtotal}
              maxStaffPercent={maxStaffPercent}
              disabled={isLoading}
            />

            <Separator />

            <div className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={<Money value={pricing.subtotal} />} />
              {pricing.discountAmount > 0 ? (
                <Row
                  label="Discount"
                  value={<Money value={-pricing.discountAmount} className="text-destructive" />}
                />
              ) : null}
              <Row
                label={`Service charge (${serviceChargePercent}%)`}
                value={<Money value={pricing.serviceChargeAmount} />}
              />
              <Row label={`VAT (${vatPercent}%)`} value={<Money value={pricing.vatAmount} />} />
              <Separator className="my-1.5" />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Total</span>
                <Money value={pricing.totalAmount} />
              </div>
            </div>

            <Separator />

            <PaymentSplit
              payments={payments}
              onChange={setPaymentsDraft}
              amountDue={pricing.totalAmount}
              disabled={isLoading}
            />

            {error && !needsCustomerName ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>
                  {errorCode(error) === 'DAY_ALREADY_CLOSED' ? 'This day is closed' : 'The order was not saved'}
                </AlertTitle>
                <AlertDescription>
                  {errorMessage(error)}
                  {errorCode(error) === 'MENU_ITEM_UNAVAILABLE' ? (
                    <span className="mt-1 block text-xs">Remove it from the order, or put it back in stock.</span>
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={!ready || isLoading}
              onClick={() => void submit()}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : null}
              Charge <Money value={pricing.totalAmount} className="font-semibold" />
            </Button>

            {!ready ? (
              <p className="text-muted-foreground text-center text-xs">
                {discountCheck.problem ?? paymentCheck.problem ?? 'Fix the highlighted fields to continue.'}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
