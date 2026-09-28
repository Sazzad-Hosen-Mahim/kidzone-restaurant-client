import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { VerificationBadge, VisitStatusBadge } from '@/components/shared/status-badge';
import { ClearFilters, DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from '@/components/shared/filter-bar';
import { useListVisitsQuery } from './kidzone-api';
import { formatBusinessDate, formatMinutes, formatTime } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { useDebounced } from '@/hooks/use-debounced';
import type { VerificationMethod, Visit, VisitStatus } from '@/types/api';
import { Printer, ShieldAlert } from 'lucide-react';

/** Minutes between check-in and check-out, for a completed visit. */
function visitDuration(visit: Visit): number | null {
  if (!visit.checkOutAt) return null;
  return Math.max(0, Math.round((Date.parse(visit.checkOutAt) - Date.parse(visit.checkInAt)) / 60_000));
}

export function VisitsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VisitStatus | undefined>();
  const [method, setMethod] = useState<VerificationMethod | undefined>();
  const [range, setRange] = useState({ from: '', to: '' });
  const debouncedSearch = useDebounced(search, 300);

  const query = useListVisitsQuery({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    status,
    verificationMethod: method,
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const hasFilters = Boolean(search || status || method || range.from || range.to);

  const columns: Array<Column<Visit>> = [
    {
      key: 'gatepassNo',
      header: 'Gatepass',
      cell: (visit) => (
        <div className="min-w-0">
          <p className="tabular text-sm font-medium">{visit.gatepassNo}</p>
          <p className="text-muted-foreground text-xs">{formatBusinessDate(visit.businessDate)}</p>
        </div>
      ),
    },
    {
      key: 'child',
      header: 'Child',
      cell: (visit) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{visit.child?.name}</p>
          <p className="text-muted-foreground truncate text-xs">
            {visit.sale?.planNameSnapshot ?? 'Membership visit'}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Guardian',
      hideOnMobile: true,
      cell: (visit) => (
        <div className="min-w-0">
          <Link to={`/customers/${visit.customerId}`} className="hover:text-primary truncate text-sm hover:underline">
            {visit.customer?.name}
          </Link>
          <p className="text-muted-foreground tabular text-xs">{formatPhone(visit.customer?.phone)}</p>
        </div>
      ),
    },
    {
      key: 'checkInAt',
      header: 'In / out',
      sortable: true,
      cell: (visit) => (
        <div className="text-sm">
          <p className="tabular">{formatTime(visit.checkInAt)}</p>
          <p className="text-muted-foreground tabular text-xs">
            {visit.checkOutAt ? formatTime(visit.checkOutAt) : 'still inside'}
          </p>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Stayed',
      numeric: true,
      hideOnMobile: true,
      cell: (visit) => <span className="tabular text-sm">{formatMinutes(visitDuration(visit))}</span>,
    },
    {
      key: 'method',
      header: 'Verified',
      hideOnMobile: true,
      cell: (visit) => (
        <div className="space-y-1">
          <VerificationBadge method={visit.verificationMethod} />
          {visit.overrideReason ? (
            <p className="text-muted-foreground flex items-start gap-1 text-xs">
              <ShieldAlert className="mt-0.5 size-3 shrink-0" />
              {visit.overrideReason}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'overtimeCharge',
      header: 'Overtime',
      numeric: true,
      cell: (visit) =>
        visit.overtimeCharge > 0 ? (
          <div>
            <Money value={visit.overtimeCharge} className="text-destructive font-medium" />
            <p className="text-muted-foreground tabular text-xs">{visit.overtimeMinutes} min</p>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    { key: 'status', header: 'Status', cell: (visit) => <VisitStatusBadge status={visit.status} /> },
    {
      key: 'actions',
      header: '',
      numeric: true,
      cell: (visit) => (
        <Button asChild variant="ghost" size="icon" aria-label="Gatepass">
          <Link to={`/receipts/gatepass/${visit.id}`}>
            <Printer className="size-4" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Visit log" description="Every check-in, including manual overrides." />

      <Card>
        <CardContent>
          <FilterBar>
            <SearchFilter
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Gatepass, child name or phone…"
            />
            <SelectFilter
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: 'ACTIVE' as const, label: 'Inside' },
                { value: 'COMPLETED' as const, label: 'Checked out' },
              ]}
            />
            <SelectFilter
              label="Verified by"
              value={method}
              onChange={(value) => {
                setMethod(value);
                setPage(1);
              }}
              options={[
                { value: 'OTP' as const, label: 'OTP' },
                { value: 'QR' as const, label: 'QR' },
                { value: 'GATEPASS' as const, label: 'Gatepass' },
                { value: 'MANUAL_OVERRIDE' as const, label: 'Manual override' },
              ]}
            />
            <DateRangeFilter
              from={range.from}
              to={range.to}
              onChange={(next) => {
                setRange(next);
                setPage(1);
              }}
            />
            <ClearFilters
              show={hasFilters}
              onClear={() => {
                setSearch('');
                setStatus(undefined);
                setMethod(undefined);
                setRange({ from: '', to: '' });
                setPage(1);
              }}
            />
          </FilterBar>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(visit) => visit.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle="No visits"
        emptyDescription={hasFilters ? 'Nothing matches those filters.' : 'Check-ins appear here as they happen.'}
      />
    </div>
  );
}
