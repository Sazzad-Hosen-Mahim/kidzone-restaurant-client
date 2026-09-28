import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader, ErrorState } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import { TakaInput } from '@/components/shared/taka-input';
import { DataTable, type Column } from '@/components/shared/data-table';
import { Pill, paymentMethodLabel } from '@/components/shared/status-badge';
import {
  sectionSlug,
  useCloseDayMutation,
  useGetClosingPreviewQuery,
  useListClosingsQuery,
  useReopenDayMutation,
  type SectionSlug,
} from './closing-api';
import { useAuth } from '@/features/auth/use-auth';
import { homeSectionFor } from '@/app/permissions';
import { errorMessage } from '@/app/api-error';
import { formatBusinessDate, formatInstant, todayBusinessDate } from '@/lib/dates';
import { PAYMENT_METHODS, type DayClosing, type PaymentMethod } from '@/types/api';
import { AlertCircle, CheckCircle2, Loader2, Lock, LockOpen } from 'lucide-react';

/**
 * Day-end closing.
 *
 * The expected figures come from the server's own count of the payment rows,
 * which is what actually reconciles against a physical drawer when a sale was
 * split between cash and bKash. The only thing the user supplies is what they
 * counted.
 */
export function ClosingPage() {
  const { can, role } = useAuth();

  const homeSection = homeSectionFor(role);
  const [section, setSection] = useState<SectionSlug>(homeSection ? sectionSlug(homeSection) : 'kidzone');
  const [date, setDate] = useState(todayBusinessDate());

  const preview = useGetClosingPreviewQuery({ section, date });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Day closing"
        description="Count the drawer, record the difference, and lock the day."
      />

      <div className="flex flex-wrap items-end gap-3">
        {/* Only an admin can switch sections; everyone else closes their own. */}
        {homeSection === null ? (
          <Tabs value={section} onValueChange={(value) => setSection(value as SectionSlug)}>
            <TabsList>
              <TabsTrigger value="kidzone">Kid Zone</TabsTrigger>
              <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="closing-date" className="text-xs">
            Business date
          </Label>
          <Input
            id="closing-date"
            type="date"
            value={date}
            max={todayBusinessDate()}
            onChange={(event) => setDate(event.target.value)}
            className="w-[170px]"
          />
        </div>
      </div>

      {preview.error ? <ErrorState error={preview.error} onRetry={() => void preview.refetch()} /> : null}
      {preview.isLoading ? <Skeleton className="h-96 w-full rounded-xl" /> : null}

      {preview.data ? <ClosingPanel section={section} date={date} preview={preview.data} /> : null}

      {can.reopenDay ? <ClosingHistory /> : null}
    </div>
  );
}

function ClosingPanel({
  section,
  date,
  preview,
}: {
  section: SectionSlug;
  date: string;
  preview: NonNullable<ReturnType<typeof useGetClosingPreviewQuery>['data']>;
}) {
  const { can } = useAuth();
  const [closeDay, { isLoading, error }] = useCloseDayMutation();
  const [countedCash, setCountedCash] = useState(0);
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  const difference = countedCash - preview.expectedCash;
  const methodsWithMoney = PAYMENT_METHODS.filter((method) => (preview.expectedByMethod[method] ?? 0) > 0);

  const submit = async () => {
    const result = await closeDay({ section, date, countedCash, notes: notes.trim() || undefined })
      .unwrap()
      .catch(() => null);

    if (result) {
      setConfirming(false);
      toast.success(`${section === 'kidzone' ? 'Kid Zone' : 'Restaurant'} closed for ${formatBusinessDate(date)}`, {
        description:
          result.difference === 0
            ? 'The drawer balanced exactly.'
            : `Difference recorded: ${result.difference > 0 ? 'over' : 'short'}.`,
      });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>What the till should hold</CardTitle>
          <CardDescription>
            Counted from the payment rows for {formatBusinessDate(date)}, so a split payment lands in the right
            place. Voided transactions are excluded.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Figure label="Sales" value={<Money value={preview.totalSales} />} />
            <Figure label="Transactions" value={<span className="tabular">{preview.transactionCount}</span>} />
            <Figure label="Discounts given" value={<Money value={preview.totalDiscounts} />} />
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">By payment method</p>
            {methodsWithMoney.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing was taken on this date.</p>
            ) : (
              methodsWithMoney.map((method) => (
                <div key={method} className="flex items-center justify-between gap-3 text-sm">
                  <span className={method === 'CASH' ? 'font-medium' : 'text-muted-foreground'}>
                    {paymentMethodLabel(method as PaymentMethod)}
                  </span>
                  <Money value={preview.expectedByMethod[method] ?? 0} />
                </div>
              ))
            )}
          </div>

          {preview.overtimeRevenue > 0 ? (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Of which overtime settled at check-out</span>
                <Money value={preview.overtimeRevenue} />
              </div>
            </>
          ) : null}

          {preview.voidCount > 0 ? (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Voided ({preview.voidCount}) — excluded from the totals above
                </span>
                <Money value={preview.totalVoids} className="text-destructive" />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {preview.isClosed ? (
          <ClosedPanel closing={preview.closing} canReopen={can.reopenDay} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Count the drawer</CardTitle>
              <CardDescription>Enter the cash you physically counted.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Expected cash</span>
                <Money value={preview.expectedCash} className="font-semibold" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="counted-cash">Counted cash</Label>
                <TakaInput id="counted-cash" value={countedCash} onChange={setCountedCash} disabled={isLoading} />
              </div>

              <div
                className={`flex items-center justify-between gap-3 rounded-lg p-3 text-sm ${
                  difference === 0 ? 'bg-success/10' : 'bg-destructive/10'
                }`}
              >
                <span className={difference === 0 ? 'text-success' : 'text-destructive'}>
                  {difference === 0 ? 'Balances exactly' : difference > 0 ? 'Over by' : 'Short by'}
                </span>
                {difference !== 0 ? (
                  <Money value={Math.abs(difference)} className="text-destructive font-semibold" />
                ) : (
                  <CheckCircle2 className="text-success size-4" />
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="closing-notes">Notes (optional)</Label>
                <Textarea
                  id="closing-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={difference !== 0 ? 'Explain the difference…' : 'Anything worth recording'}
                  rows={3}
                  maxLength={500}
                  disabled={isLoading}
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{errorMessage(error)}</AlertDescription>
                </Alert>
              ) : null}

              <Alert>
                <Lock />
                <AlertTitle>Closing locks this day</AlertTitle>
                <AlertDescription>
                  New sales, voids and check-ins dated {formatBusinessDate(date)} will be refused for this section
                  until an administrator reopens it.
                </AlertDescription>
              </Alert>

              <Button type="button" className="w-full" size="lg" onClick={() => setConfirming(true)}>
                <Lock /> Close the day
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Close {section === 'kidzone' ? 'the Kid Zone' : 'the restaurant'} for {formatBusinessDate(date)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {difference === 0
                ? 'The drawer balances. This locks the day against further changes.'
                : `A difference of ${difference > 0 ? 'over' : 'short'} will be recorded, and the day will be locked.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void submit();
              }}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin" /> : null}
              Close the day
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClosedPanel({ closing, canReopen }: { closing: DayClosing | null; canReopen: boolean }) {
  const [reopenDay, { isLoading, error }] = useReopenDayMutation();
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  if (!closing) return null;

  const submit = async () => {
    const result = await reopenDay({ id: closing.id, reason: reason.trim() }).unwrap().catch(() => null);
    if (result) {
      toast.success('Day reopened', { description: 'Writes for that date are accepted again.' });
      setOpen(false);
      setReason('');
    }
  };

  return (
    <Card className="border-success/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" /> Day closed
        </CardTitle>
        <CardDescription>
          Closed by {closing.closedBy?.name ?? 'staff'} on {formatInstant(closing.closedAt)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Expected cash</span>
            <Money value={closing.expectedCash} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Counted cash</span>
            <Money value={closing.countedCash} />
          </div>
          <Separator className="my-1.5" />
          <div className="flex items-center justify-between gap-3 font-medium">
            <span>Difference</span>
            {closing.difference === 0 ? (
              <Pill tone="success">Balanced</Pill>
            ) : (
              <Money value={closing.difference} colored signed />
            )}
          </div>
        </div>

        {closing.notes ? (
          <p className="bg-muted text-muted-foreground rounded-md p-2 text-xs">{closing.notes}</p>
        ) : null}

        {canReopen ? (
          open ? (
            <div className="space-y-2">
              <Label htmlFor="reopen-reason" className="text-xs">
                Why are you reopening it?
              </Label>
              <Textarea
                id="reopen-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="A cash sale was missed and has to be entered"
                rows={2}
                maxLength={300}
                autoFocus
              />
              {error ? <p className="text-destructive text-sm">{errorMessage(error)}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={reason.trim().length < 5 || isLoading}
                  onClick={() => void submit()}
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <LockOpen />}
                  Reopen
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
              <LockOpen /> Reopen this day
            </Button>
          )
        ) : (
          <p className="text-muted-foreground text-xs">Only an administrator can reopen a closed day.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ClosingHistory() {
  const [page, setPage] = useState(1);
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const query = useListClosingsQuery({ page, limit: 15, onlyDifferences: onlyDifferences || undefined });

  const columns: Array<Column<DayClosing>> = useMemo(
    () => [
      {
        key: 'businessDate',
        header: 'Date',
        cell: (closing) => <span className="tabular text-sm">{formatBusinessDate(closing.businessDate)}</span>,
      },
      {
        key: 'section',
        header: 'Section',
        cell: (closing) => (
          <Pill tone={closing.section === 'KIDZONE' ? 'info' : 'muted'}>
            {closing.section === 'KIDZONE' ? 'Kid Zone' : 'Restaurant'}
          </Pill>
        ),
      },
      {
        key: 'totalSales',
        header: 'Sales',
        numeric: true,
        cell: (closing) => <Money value={closing.totalSales} />,
      },
      {
        key: 'expectedCash',
        header: 'Expected',
        numeric: true,
        hideOnMobile: true,
        cell: (closing) => <Money value={closing.expectedCash} />,
      },
      {
        key: 'countedCash',
        header: 'Counted',
        numeric: true,
        hideOnMobile: true,
        cell: (closing) => <Money value={closing.countedCash} />,
      },
      {
        key: 'difference',
        header: 'Difference',
        numeric: true,
        cell: (closing) =>
          closing.difference === 0 ? (
            <Pill tone="success">Balanced</Pill>
          ) : (
            <Money value={closing.difference} colored signed className="font-medium" />
          ),
      },
      {
        key: 'closedBy',
        header: 'Closed by',
        hideOnMobile: true,
        cell: (closing) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{closing.closedBy?.name}</p>
            <p className="text-muted-foreground text-xs">{formatInstant(closing.closedAt, 'd MMM, h:mm a')}</p>
          </div>
        ),
      },
      {
        key: 'state',
        header: '',
        cell: (closing) => (closing.isReopened ? <Pill tone="warning">Reopened</Pill> : null),
      },
    ],
    [],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Closing history</h2>
        <Button
          type="button"
          variant={onlyDifferences ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setOnlyDifferences((current) => !current);
            setPage(1);
          }}
        >
          {onlyDifferences ? 'Showing differences only' : 'Show differences only'}
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(closing) => closing.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        emptyTitle={onlyDifferences ? 'Every till balanced' : 'No days closed yet'}
      />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
