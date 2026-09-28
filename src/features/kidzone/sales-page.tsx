import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useListSalesQuery, useVoidSaleMutation } from './kidzone-api';
import { useAuth } from '@/features/auth/use-auth';
import { formatBusinessDate, formatTime } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { useDebounced } from '@/hooks/use-debounced';
import type { KidZoneSale, SaleStatus } from '@/types/api';
import { Ban, Plus, Printer } from 'lucide-react';

export function KidZoneSalesPage() {
  const { can } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SaleStatus | undefined>();
  const [period, setPeriod] = useState<PeriodValue>(EMPTY_PERIOD);
  const debouncedSearch = useDebounced(search, 300);

  const query = useListSalesQuery({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    status,
    from: period.from || undefined,
    to: period.to || undefined,
  });
  const summary = query.data?.summary;

  const [voiding, setVoiding] = useState<KidZoneSale | null>(null);
  const [voidSale, voidState] = useVoidSaleMutation();

  const hasFilters = Boolean(search || status || hasPeriod(period));

  const columns: Array<Column<KidZoneSale>> = [
    {
      key: 'receiptNo',
      header: 'Receipt',
      footer: <SalesSummaryLabel summary={summary} noun="sale" />,
      cell: (sale) => (
        <div className="min-w-0">
          <p className="tabular font-medium">{sale.receiptNo}</p>
          <p className="text-muted-foreground text-xs">{formatTime(sale.createdAt)}</p>
        </div>
      ),
    },
    {
      key: 'businessDate',
      header: 'Business day',
      hideOnMobile: true,
      cell: (sale) => <span className="tabular text-sm">{formatBusinessDate(sale.businessDate)}</span>,
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (sale) => (
        <div className="min-w-0">
          {/* The snapshot, not the live plan name — this is what was sold. */}
          <p className="truncate text-sm font-medium">{sale.planNameSnapshot}</p>
          <p className="text-muted-foreground truncate text-xs">for {sale.child?.name}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Guardian',
      hideOnMobile: true,
      cell: (sale) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{sale.customer?.name}</p>
          <p className="text-muted-foreground tabular text-xs">{formatPhone(sale.customer?.phone)}</p>
        </div>
      ),
    },
    {
      key: 'payments',
      header: 'Paid by',
      hideOnMobile: true,
      cell: (sale) => (
        <div className="flex flex-wrap gap-1">
          {sale.payments?.map((payment) => (
            <PaymentMethodBadge key={payment.id} method={payment.method} />
          ))}
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      numeric: true,
      footer: <SalesSummaryTotal summary={summary} />,
      cell: (sale) => (
        <div>
          <Money value={sale.totalAmount} className="font-medium" />
          {sale.discountAmount > 0 ? (
            <p className="text-muted-foreground text-xs">
              <Money value={sale.discountAmount} symbol={false} /> off
            </p>
          ) : null}
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (sale) => <SaleStatusBadge status={sale.status} /> },
    {
      key: 'actions',
      header: '',
      numeric: true,
      cell: (sale) => (
        <div className="flex justify-end gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Receipt">
            <Link to={`/receipts/kidzone/${sale.id}`}>
              <Printer className="size-4" />
            </Link>
          </Button>
          {can.voidTransactions && sale.status === 'COMPLETED' ? (
            <Button variant="ghost" size="icon" aria-label="Void" onClick={() => setVoiding(sale)}>
              <Ban className="text-destructive size-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kid Zone sales"
        description="Plans sold, with the name and price as they were at the time."
        actions={
          <Button asChild>
            <Link to="/kidzone/sell">
              <Plus /> Sell a plan
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent>
          <FilterBar>
            <SearchFilter
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Receipt number, guardian name or phone…"
            />
            <SelectFilter
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: 'COMPLETED' as const, label: 'Completed' },
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
        rowKey={(sale) => sale.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle="No sales"
        emptyDescription={hasFilters ? 'Nothing matches those filters.' : 'Plans you sell appear here.'}
      />

      {voiding ? (
        <VoidDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setVoiding(null);
              voidState.reset();
            }
          }}
          onConfirm={(reason) => voidSale({ id: voiding.id, reason }).unwrap().catch(() => null)}
          isLoading={voidState.isLoading}
          error={voidState.error}
          receiptNo={voiding.receiptNo}
          amount={voiding.totalAmount}
          kind="sale"
          extraWarning={
            voiding.membership
              ? 'The membership this sale created will be cancelled, so the child can no longer use the gate.'
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
