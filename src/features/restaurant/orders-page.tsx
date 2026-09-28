import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { PaymentMethodBadge, SaleStatusBadge } from '@/components/shared/status-badge';
import { VoidDialog } from '@/components/shared/void-dialog';
import {
  ClearFilters,
  EMPTY_PERIOD,
  FilterBar,
  PeriodFilter,
  SearchFilter,
  SelectFilter,
  hasPeriod,
  type PeriodValue,
} from '@/components/shared/filter-bar';
import { SalesSummaryLabel, SalesSummaryTotal } from '@/components/shared/sales-summary';
import { useListOrdersQuery, useVoidOrderMutation } from './restaurant-api';
import { useAuth } from '@/features/auth/use-auth';
import { formatBusinessDate, formatTime } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { useDebounced } from '@/hooks/use-debounced';
import type { Order, OrderStatus } from '@/types/api';
import { Ban, Printer, Receipt } from 'lucide-react';

export function OrdersPage() {
  const { can } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [period, setPeriod] = useState<PeriodValue>(EMPTY_PERIOD);
  const debouncedSearch = useDebounced(search, 300);

  const query = useListOrdersQuery({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    status,
    from: period.from || undefined,
    to: period.to || undefined,
  });
  const summary = query.data?.summary;

  const [detail, setDetail] = useState<Order | null>(null);
  const [voiding, setVoiding] = useState<Order | null>(null);
  const [voidOrder, voidState] = useVoidOrderMutation();

  const hasFilters = Boolean(search || status || hasPeriod(period));

  const columns: Array<Column<Order>> = [
    {
      key: 'receiptNo',
      header: 'Receipt',
      footer: <SalesSummaryLabel summary={summary} noun="order" />,
      cell: (order) => (
        <div className="min-w-0">
          <p className="tabular font-medium">{order.receiptNo}</p>
          <p className="text-muted-foreground text-xs">{formatTime(order.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'businessDate',
      header: 'Business day',
      hideOnMobile: true,
      cell: (order) => <span className="tabular text-sm">{formatBusinessDate(order.businessDate)}</span>,
    },
    {
      key: 'tableNo',
      header: 'Table',
      hideOnMobile: true,
      cell: (order) => <span className="text-sm">{order.tableNo ?? '—'}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      hideOnMobile: true,
      cell: (order) =>
        order.customer ? (
          <div className="min-w-0">
            <p className="truncate text-sm">{order.customer.name}</p>
            <p className="text-muted-foreground tabular text-xs">{formatPhone(order.customer.phone)}</p>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Walk-in</span>
        ),
    },
    {
      key: 'items',
      header: 'Items',
      numeric: true,
      hideOnMobile: true,
      cell: (order) => (
        <span className="tabular text-sm">{order.items.reduce((n, item) => n + item.quantity, 0)}</span>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      numeric: true,
      footer: <SalesSummaryTotal summary={summary} />,
      cell: (order) => <Money value={order.totalAmount} className="font-medium" />,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (order) => <SaleStatusBadge status={order.status} />,
    },
    {
      key: 'actions',
      header: '',
      numeric: true,
      cell: (order) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <Button asChild variant="ghost" size="icon" aria-label="Receipt">
            <Link to={`/receipts/restaurant/${order.id}`}>
              <Printer className="size-4" />
            </Link>
          </Button>
          {can.voidTransactions && order.status === 'PAID' ? (
            <Button variant="ghost" size="icon" aria-label="Void" onClick={() => setVoiding(order)}>
              <Ban className="text-destructive size-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Every restaurant bill, including voided ones." />

      <Card>
        <CardContent>
          <FilterBar>
            <SearchFilter
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Receipt, table, customer name or phone…"
            />
            <SelectFilter
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: 'PAID' as const, label: 'Paid' },
                { value: 'VOIDED' as const, label: 'Voided' },
              ]}
            />
            <PeriodFilter
              value={period}
              onChange={(next) => {
                setPeriod(next);
                setPage(1);
              }}
            />
            <ClearFilters
              show={hasFilters}
              onClear={() => {
                setSearch('');
                setStatus(undefined);
                setPeriod(EMPTY_PERIOD);
                setPage(1);
              }}
            />
          </FilterBar>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(order) => order.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={setDetail}
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle="No orders"
        emptyDescription={hasFilters ? 'Nothing matches those filters.' : 'Orders appear here as they are rung up.'}
      />

      <OrderDetailDialog order={detail} onOpenChange={(open) => !open && setDetail(null)} />

      {voiding ? (
        <VoidDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setVoiding(null);
              voidState.reset();
            }
          }}
          onConfirm={(reason) => voidOrder({ id: voiding.id, reason }).unwrap().catch(() => null)}
          isLoading={voidState.isLoading}
          error={voidState.error}
          receiptNo={voiding.receiptNo}
          amount={voiding.totalAmount}
          kind="order"
        />
      ) : null}
    </div>
  );
}

function OrderDetailDialog({ order, onOpenChange }: { order: Order | null; onOpenChange: (open: boolean) => void }) {
  if (!order) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4" /> <span className="tabular">{order.receiptNo}</span>
          </DialogTitle>
          <DialogDescription>
            {formatBusinessDate(order.businessDate)} · {formatTime(order.createdAt)}
            {order.tableNo ? <> · table {order.tableNo}</> : null} · {order.cashier?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {order.status === 'VOIDED' ? (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              <p className="font-semibold">Voided</p>
              <p>{order.voidReason}</p>
              <p className="mt-1 text-xs">
                By {order.voidedBy?.name} on {formatTime(order.voidedAt)}
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="tabular">{item.quantity}×</span> {item.itemNameSnapshot}
                  {item.note ? <p className="text-muted-foreground text-xs italic">{item.note}</p> : null}
                </div>
                <Money value={item.lineTotal} className="shrink-0" />
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-1 text-sm">
            <Row label="Subtotal" value={<Money value={order.subtotal} />} />
            {order.discountAmount > 0 ? (
              <Row
                label={`Discount — ${order.discountReason}`}
                value={<Money value={-order.discountAmount} className="text-destructive" />}
              />
            ) : null}
            {/* The percentages come from the order, not from today's settings:
                that is what makes an old bill reprint correctly. */}
            <Row
              label={`Service charge (${order.serviceChargePercent}%)`}
              value={<Money value={order.serviceChargeAmount} />}
            />
            <Row label={`VAT (${order.vatPercent}%)`} value={<Money value={order.vatAmount} />} />
            <Separator className="my-1.5" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <Money value={order.totalAmount} />
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Paid by</p>
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <PaymentMethodBadge method={payment.method} />
                  {payment.reference ? (
                    <span className="text-muted-foreground font-mono text-xs">{payment.reference}</span>
                  ) : null}
                </span>
                <Money value={payment.amount} />
              </div>
            ))}
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link to={`/receipts/restaurant/${order.id}`}>
              <Printer /> Open receipt
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
