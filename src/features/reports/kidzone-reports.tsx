import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/shared/money';
import { MetricTile } from '@/components/shared/metric-tile';
import { ChartTooltipContent } from '@/components/shared/chart-tooltip';
import { ReportCard, ReportGrid, RankedRows, usePeriodSync } from './report-section';
import { toRangeQuery, type RangeState } from './range-picker';
import {
  useKidZoneByPlanQuery,
  useKidZoneMembersQuery,
  useKidZonePeakHoursQuery,
  useKidZoneRevenueTrendQuery,
  useKidZoneSummaryQuery,
  useKidZoneUtilizationQuery,
  useKidZoneVisitsQuery,
} from './reports-api';
import { formatBusinessDate, formatHour, formatPeriod, DAY_NAMES_SHORT } from '@/lib/dates';
import { formatTakaCompact, poishaToTaka } from '@/lib/money';
import { formatPhone, telHref } from '@/lib/phone';
import { cn } from '@/lib/utils';
import type { ReportPeriod } from '@/types/api';
import { Phone } from 'lucide-react';

export function KidZoneReports({
  range,
  onPeriodResolved,
}: {
  range: RangeState;
  onPeriodResolved: (period: ReportPeriod) => void;
}) {
  const params = toRangeQuery(range);

  const summary = useKidZoneSummaryQuery(params);
  const trend = useKidZoneRevenueTrendQuery(params);
  const byPlan = useKidZoneByPlanQuery(params);
  const visits = useKidZoneVisitsQuery(params);
  const peak = useKidZonePeakHoursQuery(params);
  const utilization = useKidZoneUtilizationQuery(params);
  const members = useKidZoneMembersQuery(params);

  usePeriodSync(summary.data?.period, onPeriodResolved);

  const metrics = summary.data?.data;

  return (
    <div className="space-y-4">
      <ReportCard
        title="Summary"
        description="Each figure against the equivalent preceding period."
        exportPath="/reports/kidzone/summary"
        exportName="kid-zone-summary"
        exportParams={params}
        isLoading={summary.isLoading}
        isFetching={summary.isFetching}
        error={summary.error}
        onRetry={() => void summary.refetch()}
      >
        {metrics ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Revenue" metric={metrics.revenue} money emphasis />
            <MetricTile label="Sales" metric={metrics.salesCount} />
            <MetricTile label="New memberships" metric={metrics.newMemberships} />
            <MetricTile label="Renewals" metric={metrics.renewals} />
            <MetricTile label="Sessions sold" metric={metrics.sessionsSold} />
            <MetricTile label="Visits" metric={metrics.visits} />
            <MetricTile label="Overtime revenue" metric={metrics.overtimeRevenue} money />
            <MetricTile label="Average sale" metric={metrics.averageSaleValue} money />
            <MetricTile label="Discounts given" metric={metrics.discounts} money inverse />
            <div className="bg-muted/40 rounded-xl border p-4">
              <p className="text-muted-foreground text-xs">Voided</p>
              <p className="tabular text-xl font-semibold">{metrics.voids.count}</p>
              <p className="text-muted-foreground text-xs">
                <Money value={metrics.voids.total} /> excluded from revenue
              </p>
            </div>
          </div>
        ) : null}
      </ReportCard>

      <ReportCard
        title="Revenue over time"
        description={
          trend.data?.data.granularity === 'month'
            ? 'By month — the range is long enough that daily points would be unreadable.'
            : 'By day. Days with no trade are shown as zero rather than skipped.'
        }
        exportPath="/reports/kidzone/revenue-trend"
        exportName="kid-zone-revenue-trend"
        exportParams={params}
        isLoading={trend.isLoading}
        isFetching={trend.isFetching}
        error={trend.error}
        onRetry={() => void trend.refetch()}
      >
        {trend.data ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trend.data.data.points.map((point) => ({
                  label: formatPeriod(point.period, trend.data!.data.granularity),
                  revenue: poishaToTaka(point.revenue),
                  sales: point.count,
                }))}
                margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => formatTakaCompact(value * 100)}
                  width={64}
                />
                <Tooltip content={<ChartTooltipContent money />} cursor={{ fill: 'var(--muted)' }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </ReportCard>

      <ReportGrid>
        <ReportCard
          title="By plan"
          description="Grouped on the plan name as it was sold."
          exportPath="/reports/kidzone/by-plan"
          exportName="kid-zone-by-plan"
          exportParams={params}
          isLoading={byPlan.isLoading}
          isFetching={byPlan.isFetching}
          error={byPlan.error}
          onRetry={() => void byPlan.refetch()}
        >
          <RankedRows
            rows={byPlan.data?.data.plans ?? []}
            rowKey={(plan) => plan.planName}
            primary={(plan) => plan.planName}
            secondary={(plan) => `${plan.count} sold · ${plan.revenueShare}% of revenue`}
            value={(plan) => <Money value={plan.revenue} />}
            share={(plan) => plan.revenueShare}
          />
        </ReportCard>

        <ReportCard
          title="Visits"
          description="Members versus one-time sessions. A visit from a voided sale is not counted."
          exportPath="/reports/kidzone/visits"
          exportName="kid-zone-visits"
          exportParams={params}
          isLoading={visits.isLoading}
          isFetching={visits.isFetching}
          error={visits.error}
          onRetry={() => void visits.refetch()}
        >
          {visits.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Figure label="Member" value={visits.data.data.totals.member} />
                <Figure label="Session" value={visits.data.data.totals.session} />
                <Figure label="Total" value={visits.data.data.totals.total} emphasis />
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={visits.data.data.points.map((point) => ({
                      label: formatBusinessDate(point.period, 'd MMM'),
                      Member: point.member,
                      Session: point.session,
                    }))}
                    margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Member" stackId="visits" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Session" stackId="visits" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </ReportCard>
      </ReportGrid>

      <ReportCard
        title="Peak hours"
        description="Check-ins by day and hour, in the business timezone."
        exportPath="/reports/kidzone/peak-hours"
        exportName="kid-zone-peak-hours"
        exportParams={params}
        isLoading={peak.isLoading}
        isFetching={peak.isFetching}
        error={peak.error}
        onRetry={() => void peak.refetch()}
      >
        {peak.data ? <PeakHeatmap report={peak.data.data} /> : null}
      </ReportCard>

      <ReportGrid>
        <ReportCard
          title="Low-usage memberships"
          description="Paying but rarely coming — the ones to call before they decide not to renew."
          exportPath="/reports/kidzone/membership-utilization"
          exportName="kid-zone-membership-utilization"
          exportParams={params}
          isLoading={utilization.isLoading}
          isFetching={utilization.isFetching}
          error={utilization.error}
          onRetry={() => void utilization.refetch()}
        >
          {utilization.data ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Average across all active memberships:{' '}
                <span className="tabular text-foreground font-medium">
                  {utilization.data.data.averageVisitsPerWeek}
                </span>{' '}
                visits a week.
              </p>

              <RankedRows
                rows={utilization.data.data.lowUsage.slice(0, 8)}
                rowKey={(row) => row.membershipId}
                primary={(row) => row.childName}
                secondary={(row) => `${row.customerName} · ${row.planName} · ends ${formatBusinessDate(row.endDate)}`}
                value={(row) => (
                  <span className="tabular text-sm">
                    {row.visits} visit{row.visits === 1 ? '' : 's'}
                  </span>
                )}
                emptyLabel="Every active member is using their membership."
              />
            </div>
          ) : null}
        </ReportCard>

        <ReportCard
          title="Members"
          description="Expiring soon, and those who lapsed without renewing."
          exportPath="/reports/kidzone/members"
          exportName="kid-zone-members"
          exportParams={params}
          isLoading={members.isLoading}
          isFetching={members.isFetching}
          error={members.error}
          onRetry={() => void members.refetch()}
        >
          {members.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Figure label="Active" value={members.data.data.activeCount} emphasis />
                <Figure label="Expiring 7d" value={members.data.data.expiringIn7Days} />
                <Figure label="Expiring 30d" value={members.data.data.expiringIn30Days} />
              </div>

              <div>
                <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
                  Lapsed without renewing ({members.data.data.lapsedCount})
                </p>
                <CallList
                  rows={members.data.data.lapsedWithoutRenewal.slice(0, 6).map((row) => ({
                    id: row.membershipId,
                    name: row.childName,
                    detail: `${row.customerName} · expired ${row.daysSinceExpiry}d ago · ${row.totalVisits} visits`,
                    phone: row.customerPhone,
                  }))}
                  emptyLabel="Nobody has lapsed in the last 30 days."
                />
              </div>
            </div>
          ) : null}
        </ReportCard>
      </ReportGrid>
    </div>
  );
}

function Figure({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={cn('rounded-lg border p-2.5', emphasis && 'border-primary/40')}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="tabular text-lg font-semibold">{value.toLocaleString('en-US')}</p>
    </div>
  );
}

function CallList({
  rows,
  emptyLabel,
}: {
  rows: Array<{ id: string; name: string; detail: string; phone: string }>;
  emptyLabel: string;
}) {
  if (rows.length === 0) return <p className="text-muted-foreground py-4 text-center text-sm">{emptyLabel}</p>;

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.name}</p>
            <p className="text-muted-foreground truncate text-xs">{row.detail}</p>
          </div>
          <a
            href={telHref(row.phone)}
            className="text-primary tabular inline-flex shrink-0 items-center gap-1 text-xs hover:underline"
          >
            <Phone className="size-3" />
            {formatPhone(row.phone)}
          </a>
        </div>
      ))}
    </div>
  );
}

/**
 * The day × hour heatmap.
 *
 * Hours with no visits at any point in the period are dropped from the axis, so
 * a business open 10:00–22:00 does not render twelve empty columns.
 */
function PeakHeatmap({ report }: { report: import('@/types/api').PeakHoursReport }) {
  const hours = Array.from({ length: 24 }, (_, hour) => hour).filter((hour) =>
    report.grid.some((cell) => cell.hour === hour && cell.visits > 0),
  );

  if (report.totalVisits === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">No check-ins in this period.</p>;
  }

  const max = Math.max(...report.grid.map((cell) => cell.visits), 1);
  const lookup = new Map(report.grid.map((cell) => [`${cell.dayOfWeek}:${cell.hour}`, cell.visits]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        {report.busiestDay ? (
          <Badge variant="outline">Busiest day: {report.busiestDay.dayName} ({report.busiestDay.visits})</Badge>
        ) : null}
        {report.busiestHour ? (
          <Badge variant="outline">
            Busiest hour: {formatHour(report.busiestHour.hour)} ({report.busiestHour.visits})
          </Badge>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-0.5 text-center">
          <thead>
            <tr>
              <th className="text-muted-foreground w-10 text-xs font-normal" />
              {hours.map((hour) => (
                <th key={hour} className="text-muted-foreground text-[10px] font-normal">
                  {hour}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_NAMES_SHORT.map((dayName, dayIndex) => (
              <tr key={dayName}>
                <td className="text-muted-foreground pr-1 text-right text-[11px]">{dayName}</td>
                {hours.map((hour) => {
                  const visits = lookup.get(`${dayIndex}:${hour}`) ?? 0;
                  const intensity = visits / max;
                  return (
                    <td key={hour} className="p-0">
                      <div
                        title={`${dayName} ${formatHour(hour)}: ${visits} visit${visits === 1 ? '' : 's'}`}
                        className="tabular flex h-7 items-center justify-center rounded text-[10px]"
                        style={{
                          backgroundColor:
                            visits === 0 ? 'var(--muted)' : `color-mix(in oklab, var(--chart-1) ${Math.round(intensity * 100)}%, transparent)`,
                          color: intensity > 0.55 ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                        }}
                      >
                        {visits || ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { Cell };
