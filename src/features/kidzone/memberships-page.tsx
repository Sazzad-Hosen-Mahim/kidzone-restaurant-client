import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { MembershipStatusBadge } from '@/components/shared/status-badge';
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from '@/components/shared/filter-bar';
import { useListMembershipsQuery, type MembershipSortColumn } from './kidzone-api';
import { RenewDialog } from './renew-dialog';
import { MembershipQrDialog } from './membership-card';
import { formatBusinessDate } from '@/lib/dates';
import { formatPhone, telHref } from '@/lib/phone';
import { useDebounced } from '@/hooks/use-debounced';
import type { Membership, MembershipStatus } from '@/types/api';
import { CalendarClock, Phone, QrCode, RefreshCw } from 'lucide-react';

const EXPIRY_WINDOWS = [
  { value: '7', label: 'Next 7 days' },
  { value: '14', label: 'Next 14 days' },
  { value: '30', label: 'Next 30 days' },
];

export function MembershipsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MembershipStatus | undefined>('ACTIVE');
  const [expiringWithin, setExpiringWithin] = useState<string | undefined>();
  // Matches the server's default, so the first load is the soonest-to-expire first.
  const [sort, setSort] = useState<{ column: MembershipSortColumn; order: 'asc' | 'desc' }>({
    column: 'endDate',
    order: 'asc',
  });
  const debouncedSearch = useDebounced(search, 300);

  const query = useListMembershipsQuery({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    sort: sort.column,
    order: sort.order,
    // `expiringWithinDays` implies ACTIVE on the server, so sending both would
    // be redundant and could contradict each other.
    ...(expiringWithin ? { expiringWithinDays: Number(expiringWithin) } : { status }),
  });

  const [renewing, setRenewing] = useState<Membership | null>(null);
  const [showingCard, setShowingCard] = useState<string | null>(null);

  const hasFilters = Boolean(search || expiringWithin || status !== 'ACTIVE');

  const columns: Array<Column<Membership>> = [
    {
      key: 'child',
      header: 'Child',
      cell: (membership) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{membership.child?.name}</p>
          <p className="text-muted-foreground truncate text-xs">{membership.plan?.name}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Guardian',
      cell: (membership) => (
        <div className="min-w-0">
          <Link
            to={`/customers/${membership.customerId}`}
            className="hover:text-primary truncate text-sm hover:underline"
          >
            {membership.customer?.name}
          </Link>
          <a
            href={telHref(membership.customer?.phone)}
            className="text-muted-foreground hover:text-primary tabular flex items-center gap-1 text-xs"
          >
            <Phone className="size-3" />
            {formatPhone(membership.customer?.phone)}
          </a>
        </div>
      ),
    },
    {
      key: 'startDate',
      header: 'Started',
      sortable: true,
      hideOnMobile: true,
      cell: (membership) => <span className="tabular text-sm">{formatBusinessDate(membership.startDate)}</span>,
    },
    {
      key: 'endDate',
      header: 'Ends',
      sortable: true,
      cell: (membership) => <span className="tabular text-sm">{formatBusinessDate(membership.endDate)}</span>,
    },
    {
      key: 'visitCount',
      header: 'Visits',
      numeric: true,
      sortable: true,
      hideOnMobile: true,
      cell: (membership) => <span className="tabular text-sm">{membership.visitCount ?? 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (membership) => (
        <MembershipStatusBadge
          status={membership.status}
          daysRemaining={membership.daysRemaining}
          expiringSoon={membership.expiringSoon}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      numeric: true,
      cell: (membership) => (
        <div className="flex justify-end gap-2">
          {/* Reprinting a card is the everyday reason someone opens this list,
              so it is a button rather than something behind a menu. */}
          <Button variant="ghost" size="sm" onClick={() => setShowingCard(membership.id)}>
            <QrCode /> Card
          </Button>
          {membership.status !== 'CANCELLED' ? (
            <Button variant="outline" size="sm" onClick={() => setRenewing(membership)}>
              <RefreshCw /> Renew
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memberships"
        description="Filter by the expiry window to get this week's follow-up calls."
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
              placeholder="Guardian, child or phone…"
            />
            <SelectFilter
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setExpiringWithin(undefined);
                setPage(1);
              }}
              options={[
                { value: 'ACTIVE' as const, label: 'Active' },
                { value: 'EXPIRED' as const, label: 'Expired' },
                { value: 'CANCELLED' as const, label: 'Cancelled' },
              ]}
            />
            <SelectFilter
              label="Expiring"
              value={expiringWithin}
              onChange={(value) => {
                setExpiringWithin(value);
                setPage(1);
              }}
              options={EXPIRY_WINDOWS}
              allLabel="Any time"
            />
            <ClearFilters
              show={hasFilters}
              onClear={() => {
                setSearch('');
                setStatus('ACTIVE');
                setExpiringWithin(undefined);
                setPage(1);
              }}
            />
          </FilterBar>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(membership) => membership.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        sort={sort}
        onSortChange={(column) => {
          setSort((current) => ({
            column: column as MembershipSortColumn,
            order: current.column === column && current.order === 'asc' ? 'desc' : 'asc',
          }));
          setPage(1);
        }}
        emptyTitle="No memberships"
        emptyDescription={
          expiringWithin
            ? 'Nothing expires in that window — good news.'
            : hasFilters
              ? 'Nothing matches those filters.'
              : 'Memberships appear here once a membership plan is sold.'
        }
      />

      <RenewDialog
        membership={renewing}
        onOpenChange={(open) => !open && setRenewing(null)}
        onRenewed={() => setRenewing(null)}
      />

      <MembershipQrDialog
        membershipId={showingCard}
        onOpenChange={(open) => !open && setShowingCard(null)}
      />

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <CalendarClock className="size-3.5" />
        Renewing early starts the new term the day after the current one ends, so no paid days are lost.
      </p>
    </div>
  );
}
