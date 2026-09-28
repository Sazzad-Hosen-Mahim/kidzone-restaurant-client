import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { RoleBadge } from '@/components/shared/status-badge';
import { ClearFilters, DateRangeFilter, FilterBar, SearchFilter, SelectFilter } from '@/components/shared/filter-bar';
import { useListAuditLogsQuery } from './admin-api';
import { formatInstant, formatRelative } from '@/lib/dates';
import { useDebounced } from '@/hooks/use-debounced';
import type { AuditLogEntry } from '@/types/api';
import { ShieldCheck } from 'lucide-react';

/**
 * Actions worth grouping in the filter. The server accepts any action string;
 * these are the ones someone actually goes looking for.
 */
const NOTABLE_ACTIONS = [
  { value: 'SALE_VOIDED', label: 'Sale voided' },
  { value: 'ORDER_VOIDED', label: 'Order voided' },
  { value: 'DISCOUNT_APPLIED', label: 'Discount applied' },
  { value: 'MANUAL_CHECKIN', label: 'Manual check-in' },
  { value: 'PRICE_CHANGED', label: 'Price changed' },
  { value: 'SETTINGS_CHANGED', label: 'Settings changed' },
  { value: 'DAY_CLOSED', label: 'Day closed' },
  { value: 'DAY_REOPENED', label: 'Day reopened' },
  { value: 'USER_CREATED', label: 'User created' },
  { value: 'USER_DEACTIVATED', label: 'User deactivated' },
  { value: 'PASSWORD_RESET', label: 'Password reset' },
  { value: 'LOGIN_FAILED', label: 'Failed sign-in' },
];

/** Actions that warrant a red badge when scanning the list. */
const SENSITIVE = new Set([
  'SALE_VOIDED',
  'ORDER_VOIDED',
  'MANUAL_CHECKIN',
  'DAY_REOPENED',
  'USER_DEACTIVATED',
  'PASSWORD_RESET',
  'LOGIN_FAILED',
]);

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<string | undefined>();
  const [range, setRange] = useState({ from: '', to: '' });
  const debouncedSearch = useDebounced(search, 300);

  const query = useListAuditLogsQuery({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    action,
    from: range.from || undefined,
    to: range.to || undefined,
  });

  const [detail, setDetail] = useState<AuditLogEntry | null>(null);

  const columns: Array<Column<AuditLogEntry>> = [
    {
      key: 'createdAt',
      header: 'When',
      cell: (entry) => (
        <div>
          <p className="text-sm">{formatRelative(entry.createdAt)}</p>
          <p className="text-muted-foreground tabular text-xs">{formatInstant(entry.createdAt, 'd MMM, h:mm a')}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (entry) => (
        <Badge
          variant="outline"
          className={
            SENSITIVE.has(entry.action)
              ? 'border-transparent bg-destructive/12 text-destructive font-mono text-[11px]'
              : 'font-mono text-[11px]'
          }
        >
          {entry.action}
        </Badge>
      ),
    },
    {
      key: 'actor',
      header: 'Who',
      cell: (entry) =>
        entry.actor ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm">{entry.actor.name}</span>
            <RoleBadge role={entry.actor.role} />
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">system</span>
        ),
    },
    {
      key: 'entity',
      header: 'On',
      hideOnMobile: true,
      cell: (entry) => (
        <div className="min-w-0">
          <p className="text-sm">{entry.entityType}</p>
          {entry.entityId ? (
            <p className="text-muted-foreground truncate font-mono text-[10px]">{entry.entityId}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (entry) => <span className="text-muted-foreground line-clamp-2 text-sm">{entry.reason ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Append-only. There is no way to change or delete an entry, here or in the API."
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
              placeholder="Search the reason text…"
            />
            <SelectFilter
              label="Action"
              value={action}
              onChange={(value) => {
                setAction(value);
                setPage(1);
              }}
              options={NOTABLE_ACTIONS}
              allLabel="All actions"
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
              show={Boolean(search || action || range.from || range.to)}
              onClear={() => {
                setSearch('');
                setAction(undefined);
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
        rowKey={(entry) => entry.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={setDetail}
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle="No audit entries"
      />

      <AuditDetailDialog entry={detail} onOpenChange={(open) => !open && setDetail(null)} />

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ShieldCheck className="size-3.5" />
        Every discount, void, price change, manual check-in and settings change is recorded here with before and
        after values.
      </p>
    </div>
  );
}

function AuditDetailDialog({
  entry,
  onOpenChange,
}: {
  entry: AuditLogEntry | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!entry) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{entry.action}</DialogTitle>
          <DialogDescription>
            {entry.actor ? `${entry.actor.name} · ` : 'System · '}
            {formatInstant(entry.createdAt)}
            {entry.ip ? ` · ${entry.ip}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <Detail label="Entity" value={entry.entityType} />
            <Detail label="Entity id" value={entry.entityId ?? '—'} mono />
          </div>

          {entry.reason ? (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">Reason</p>
                <p>{entry.reason}</p>
              </div>
            </>
          ) : null}

          {entry.before || entry.after ? (
            <>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                <JsonBlock label="Before" value={entry.before} />
                <JsonBlock label="After" value={entry.after} />
              </div>
            </>
          ) : null}

          {entry.userAgent ? (
            <>
              <Separator />
              <Detail label="User agent" value={entry.userAgent} mono />
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
      <p className={mono ? 'font-mono text-xs break-all' : ''}>{value}</p>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <div>
        <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">{label}</p>
        <p className="text-muted-foreground text-xs italic">none</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-muted-foreground mb-1 text-xs tracking-wide uppercase">{label}</p>
      <pre className="bg-muted max-h-64 overflow-auto rounded-md p-2 text-[11px] whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
