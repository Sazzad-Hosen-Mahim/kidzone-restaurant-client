import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataTable, type Column } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page';
import { SmsStatusBadge, Pill } from '@/components/shared/status-badge';
import { ClearFilters, FilterBar, SearchFilter, SelectFilter } from '@/components/shared/filter-bar';
import {
  useListSmsLogQuery,
  useRunBackupMutation,
  useRunCleanupMutation,
  useRunExpireMembershipsMutation,
  useRunExpiryRemindersMutation,
} from './admin-api';
import { errorMessage, type QueryError } from '@/app/api-error';
import { formatInstant, formatRelative } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { useDebounced } from '@/hooks/use-debounced';
import type { SmsLogEntry, SmsStatus, SmsType } from '@/types/api';
import { CalendarX, DatabaseBackup, Loader2, MessageSquare, Play, Trash2 } from 'lucide-react';

/**
 * Operations.
 *
 * The scheduled jobs all run on their own timers; these buttons exist for the
 * times something needed doing outside its slot. Every job is idempotent, which
 * the descriptions say plainly — an operator should not have to guess whether
 * pressing a button twice sends two reminders.
 */
export function OperationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="SMS &amp; jobs" description="The delivery log, and the scheduled jobs run by hand." />
      <JobCards />
      <SmsLog />
    </div>
  );
}

function JobCards() {
  const [expire, expireState] = useRunExpireMembershipsMutation();
  const [reminders, remindersState] = useRunExpiryRemindersMutation();
  const [cleanup, cleanupState] = useRunCleanupMutation();
  const [backup, backupState] = useRunBackupMutation();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <JobCard
        icon={CalendarX}
        title="Expire memberships"
        schedule="Runs at 00:05 every day"
        description="Marks memberships whose end date has passed as expired. Only touches rows that are genuinely past due, so running it again changes nothing."
        isLoading={expireState.isLoading}
        error={expireState.error}
        onRun={async () => {
          const result = await expire().unwrap().catch(() => null);
          if (result) {
            toast.success(
              result.expired === 0
                ? 'Nothing to expire'
                : `${result.expired} membership${result.expired === 1 ? '' : 's'} expired`,
            );
          }
        }}
      />

      <JobCard
        icon={MessageSquare}
        title="Expiry reminders"
        schedule="Runs at 10:00 every day"
        description="Texts guardians whose membership ends on one of the configured reminder days. Idempotent per membership per day — a second run sends nothing."
        isLoading={remindersState.isLoading}
        error={remindersState.error}
        onRun={async () => {
          const result = await reminders().unwrap().catch(() => null);
          if (result) {
            toast.success(`${result.queued} reminder${result.queued === 1 ? '' : 's'} queued`, {
              description:
                result.skipped > 0 ? `${result.skipped} already went out today and were skipped.` : undefined,
            });
          }
        }}
      />

      <JobCard
        icon={Trash2}
        title="Clean up"
        schedule="Runs hourly"
        description="Removes expired check-in codes and stale refresh tokens."
        isLoading={cleanupState.isLoading}
        error={cleanupState.error}
        onRun={async () => {
          const result = await cleanup().unwrap().catch(() => null);
          if (result) {
            toast.success('Cleanup finished', {
              description: `${result.otpCodes} code(s) and ${result.refreshTokens} token(s) removed.`,
            });
          }
        }}
      />

      <JobCard
        icon={DatabaseBackup}
        title="Database backup"
        schedule="Runs at 03:00 every day"
        description="Takes a compressed pg_dump, uploads it if S3 storage is configured, then applies the retention policy. The result is written to the audit log either way."
        isLoading={backupState.isLoading}
        error={backupState.error}
        onRun={async () => {
          const result = await backup().unwrap().catch(() => null);
          if (result) {
            toast.success('Backup complete', {
              description: `${result.file} · ${(result.sizeBytes / 1024 / 1024).toFixed(1)} MB${
                result.uploaded ? ' · uploaded' : ''
              }`,
            });
          }
        }}
      />
    </div>
  );
}

function JobCard({
  icon: Icon,
  title,
  schedule,
  description,
  onRun,
  isLoading,
  error,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  schedule: string;
  description: string;
  onRun: () => Promise<void>;
  isLoading: boolean;
  error: QueryError;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" /> {title}
        </CardTitle>
        <CardDescription>{schedule}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">{description}</p>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not run</AlertTitle>
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={() => void onRun()}>
          {isLoading ? <Loader2 className="animate-spin" /> : <Play />}
          Run now
        </Button>
      </CardContent>
    </Card>
  );
}

function SmsLog() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SmsStatus | undefined>();
  const [type, setType] = useState<SmsType | undefined>();
  const debouncedSearch = useDebounced(search, 300);

  const query = useListSmsLogQuery({
    page,
    limit: 25,
    search: debouncedSearch || undefined,
    status,
    type,
  });

  const columns: Array<Column<SmsLogEntry>> = [
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
      key: 'phone',
      header: 'To',
      cell: (entry) => <span className="tabular text-sm">{formatPhone(entry.phone)}</span>,
    },
    { key: 'type', header: 'Type', cell: (entry) => <Pill tone="muted">{entry.type.replace(/_/g, ' ')}</Pill> },
    {
      key: 'message',
      header: 'Message',
      cell: (entry) => <span className="text-muted-foreground line-clamp-2 text-sm">{entry.message}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (entry) => (
        <div className="space-y-1">
          <SmsStatusBadge status={entry.status} />
          {entry.attempts > 1 ? (
            <p className="text-muted-foreground tabular text-xs">{entry.attempts} attempts</p>
          ) : null}
          {entry.error ? <p className="text-destructive line-clamp-2 text-xs">{entry.error}</p> : null}
        </div>
      ),
    },
    {
      key: 'provider',
      header: 'Provider',
      hideOnMobile: true,
      cell: (entry) => <span className="text-muted-foreground font-mono text-xs">{entry.provider}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">SMS delivery log</h2>

      <Card>
        <CardContent>
          <FilterBar>
            <SearchFilter
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Phone number…"
            />
            <SelectFilter
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                { value: 'SENT' as const, label: 'Sent' },
                { value: 'QUEUED' as const, label: 'Queued' },
                { value: 'FAILED' as const, label: 'Failed' },
              ]}
            />
            <SelectFilter
              label="Type"
              value={type}
              onChange={(value) => {
                setType(value);
                setPage(1);
              }}
              options={[
                { value: 'OTP' as const, label: 'OTP' },
                { value: 'GATEPASS' as const, label: 'Gatepass' },
                { value: 'EXPIRY_REMINDER' as const, label: 'Expiry reminder' },
                { value: 'RECEIPT' as const, label: 'Receipt' },
                { value: 'OTHER' as const, label: 'Other' },
              ]}
            />
            <ClearFilters
              show={Boolean(search || status || type)}
              onClear={() => {
                setSearch('');
                setStatus(undefined);
                setType(undefined);
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
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle="No messages"
        emptyDescription="Every SMS the system tries to send is recorded here, whether it arrived or not."
      />
    </div>
  );
}
