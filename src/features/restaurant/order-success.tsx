import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Money } from '@/components/shared/money';
import { PaymentMethodBadge } from '@/components/shared/status-badge';
import { formatTime } from '@/lib/dates';
import type { Order } from '@/types/api';
import { CheckCircle2, Plus, Printer } from 'lucide-react';

export function OrderSuccess({ order, onNewOrder }: { order: Order; onNewOrder: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 pt-4">
      <Card className="border-success/40">
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="bg-success/12 text-success flex size-14 items-center justify-center rounded-full">
              <CheckCircle2 className="size-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Order complete</h2>
              <p className="text-muted-foreground text-sm">
                <span className="tabular">{order.receiptNo}</span>
                {order.tableNo ? <> · table {order.tableNo}</> : null} · {formatTime(order.createdAt)}
              </p>
            </div>
          </div>

          <div className="space-y-1 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground min-w-0">
                  <span className="tabular">{item.quantity}×</span> {item.itemNameSnapshot}
                </span>
                <Money value={item.lineTotal} className="shrink-0" />
              </div>
            ))}

            <Separator className="my-2" />

            <Row label="Subtotal" value={<Money value={order.subtotal} />} />
            {order.discountAmount > 0 ? (
              <Row
                label="Discount"
                value={<Money value={-order.discountAmount} className="text-destructive" />}
              />
            ) : null}
            <Row
              label={`Service charge (${order.serviceChargePercent}%)`}
              value={<Money value={order.serviceChargeAmount} />}
            />
            <Row label={`VAT (${order.vatPercent}%)`} value={<Money value={order.vatAmount} />} />

            <Separator className="my-2" />

            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <Money value={order.totalAmount} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {order.payments.map((payment) => (
              <span key={payment.id} className="flex items-center gap-1.5 text-sm">
                <PaymentMethodBadge method={payment.method} />
                <Money value={payment.amount} />
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onNewOrder} className="flex-1">
          <Plus /> New order
        </Button>
        <Button asChild variant="outline">
          <Link to={`/receipts/restaurant/${order.id}`}>
            <Printer /> Receipt
          </Link>
        </Button>
      </div>
    </div>
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
