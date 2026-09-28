import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { paymentMethodLabel } from '@/components/shared/status-badge';
import { useGetReceiptQuery, type ReceiptKind } from './receipts-api';
import { openReceiptPdf } from '@/lib/download';
import { cn } from '@/lib/utils';
import type { ReceiptDocument } from '@/types/api';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';

const KINDS: ReceiptKind[] = ['kidzone', 'restaurant', 'gatepass'];

/**
 * The receipt viewer.
 *
 * Rendered at roughly thermal-roll width so what is on screen matches what
 * comes out of the printer. Every figure comes from the document the API built
 * out of the transaction's own snapshots, so reprinting an old receipt after a
 * price or VAT change reproduces it exactly.
 */
export function ReceiptPage() {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false);

  const validKind = KINDS.includes(kind as ReceiptKind) ? (kind as ReceiptKind) : null;

  const { data: receipt, isLoading, error, refetch } = useGetReceiptQuery(
    { kind: validKind!, id: id! },
    { skip: !validKind || !id },
  );

  if (!validKind || !id) {
    return <ErrorState error={undefined} title="That is not a receipt address" />;
  }

  const openPdf = async () => {
    setPrinting(true);
    try {
      await openReceiptPdf(validKind, id, receipt?.receiptNo ?? 'receipt');
    } catch (cause) {
      toast.error('Could not open the PDF', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft /> Back
        </Button>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print this page
          </Button>
          <Button type="button" size="sm" onClick={() => void openPdf()} disabled={printing || !receipt}>
            {printing ? <Loader2 className="animate-spin" /> : <Printer />}
            80mm PDF
          </Button>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isLoading ? <Skeleton className="mx-auto h-[600px] w-full max-w-sm rounded-lg" /> : null}
      {receipt ? <ReceiptCard receipt={receipt} /> : null}
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: ReceiptDocument }) {
  const { totals, gatepass } = receipt;

  return (
    <Card className="mx-auto max-w-sm">
      <CardContent className="space-y-3 font-mono text-[13px]">
        <header className="space-y-0.5 text-center">
          <p className="font-sans text-base font-bold">{receipt.business.name}</p>
          {receipt.business.address ? (
            <p className="text-muted-foreground text-[11px]">{receipt.business.address}</p>
          ) : null}
          {receipt.business.phone ? (
            <p className="text-muted-foreground text-[11px]">{receipt.business.phone}</p>
          ) : null}
          <p className="pt-1 font-sans text-xs font-semibold tracking-wide">{titleFor(receipt.kind)}</p>
        </header>

        {/* Reprinting a voided sale has to be unmistakable at a glance. */}
        {receipt.voided.isVoided ? (
          <div className="border-destructive text-destructive space-y-0.5 rounded border-2 border-dashed py-2 text-center">
            <p className="font-sans text-xl font-bold">*** VOID ***</p>
            {receipt.voided.reason ? <p className="text-[11px]">{receipt.voided.reason}</p> : null}
            {receipt.voided.voidedAt ? (
              <p className="text-[11px]">
                Voided {receipt.voided.voidedAt}
                {receipt.voided.voidedBy ? ` by ${receipt.voided.voidedBy}` : ''}
              </p>
            ) : null}
            <p className="text-[11px] font-semibold">This receipt is not valid.</p>
          </div>
        ) : null}

        <Dashed />

        <dl className="space-y-0.5 text-[11px]">
          <Meta label={receipt.kind === 'GATEPASS' ? 'Gatepass' : 'Receipt'} value={receipt.receiptNo} />
          {/* Pre-rendered by the API in the business timezone, so it reads the
              same wherever it is reprinted. */}
          <Meta label="Date" value={receipt.issuedAt} />
          {receipt.tableNo ? <Meta label="Table" value={receipt.tableNo} /> : null}
          {receipt.customer ? (
            <>
              <Meta label="Customer" value={receipt.customer.name} />
              <Meta label="Phone" value={receipt.customer.phone} />
            </>
          ) : null}
          <Meta label="Served by" value={receipt.servedBy} />
        </dl>

        <Dashed />

        {gatepass ? (
          <div className="space-y-2">
            <dl className="space-y-0.5 text-[11px]">
              <Meta label="Child" value={gatepass.childName} />
              <Meta label="Plan" value={gatepass.planName} />
              <Meta label="Checked in" value={gatepass.checkInAt} />
              {gatepass.expectedCheckOutAt ? <Meta label="Due out" value={gatepass.expectedCheckOutAt} /> : null}
              {gatepass.checkOutAt ? <Meta label="Checked out" value={gatepass.checkOutAt} /> : null}
              <Meta label="Status" value={gatepass.status === 'ACTIVE' ? 'Inside' : 'Checked out'} />
            </dl>

            <div className="space-y-1 pt-1 text-center">
              {/* The gatepass number, never the membership QR token: a slip that
                  can be dropped on the floor must not be a credential. */}
              <p className="text-base font-bold">{gatepass.qrPayload}</p>
              <p className="text-muted-foreground text-[10px]">Present this pass to collect your child.</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {receipt.lines.map((line, index) => (
              <li key={index} className="space-y-0.5">
                <p className="leading-tight">{line.name}</p>
                <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                  <span>
                    {line.quantity} × <Money value={line.unitPrice} symbol={false} />
                  </span>
                  <Money value={line.lineTotal} symbol={false} className="text-foreground" />
                </div>
                {line.note ? <p className="text-muted-foreground text-[10px] italic">{line.note}</p> : null}
              </li>
            ))}
          </ul>
        )}

        <Dashed />

        <div className="space-y-0.5 text-[12px]">
          {receipt.kind !== 'GATEPASS' ? (
            <>
              <Line label="Subtotal" value={totals.subtotal} />
              {totals.discountAmount > 0 ? <Line label="Discount" value={-totals.discountAmount} /> : null}
              {totals.serviceChargeAmount ? (
                <Line label={`Service charge (${totals.serviceChargePercent}%)`} value={totals.serviceChargeAmount} />
              ) : null}
              {totals.vatAmount ? <Line label={`VAT (${totals.vatPercent}%)`} value={totals.vatAmount} /> : null}
            </>
          ) : totals.totalAmount > 0 ? (
            <Line label="Overtime charge" value={totals.totalAmount} />
          ) : null}

          <div className="flex items-center justify-between pt-1 font-sans text-base font-bold">
            <span>TOTAL</span>
            <Money value={totals.totalAmount} />
          </div>

          {totals.discountReason ? (
            <p className="text-muted-foreground text-[10px] italic">Discount: {totals.discountReason}</p>
          ) : null}
        </div>

        {receipt.payments.length > 0 ? (
          <>
            <Dashed />
            <div className="space-y-0.5 text-[11px]">
              <p className="font-semibold">Paid by</p>
              {receipt.payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span>
                    {paymentMethodLabel(payment.method)}
                    {payment.reference ? ` (${payment.reference})` : ''}
                  </span>
                  <Money value={payment.amount} symbol={false} />
                </div>
              ))}
            </div>
          </>
        ) : null}

        <Dashed />

        <footer className="text-muted-foreground space-y-1 text-center text-[11px]">
          {receipt.voided.isVoided ? (
            <p className="text-destructive font-sans text-lg font-bold">*** VOID ***</p>
          ) : null}
          <p>{receipt.business.footer}</p>
          <p className="tabular">{receipt.receiptNo}</p>
        </footer>
      </CardContent>
    </Card>
  );
}

function Dashed({ className }: { className?: string }) {
  return <div className={cn('border-muted-foreground/40 border-t border-dashed', className)} />;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Money value={value} symbol={false} />
    </div>
  );
}

function titleFor(kind: ReceiptDocument['kind']): string {
  switch (kind) {
    case 'KIDZONE_SALE':
      return 'KID ZONE RECEIPT';
    case 'RESTAURANT_ORDER':
      return 'RESTAURANT RECEIPT';
    case 'GATEPASS':
      return 'GATEPASS';
  }
}
