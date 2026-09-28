import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Money } from '@/components/shared/money';
import { MetricTile } from '@/components/shared/metric-tile';
import { ChartTooltipContent } from '@/components/shared/chart-tooltip';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ReportCard, ReportGrid, RankedRows, usePeriodSync } from './report-section';
import { toRangeQuery, type RangeState } from './range-picker';
import {
  useCashierPerformanceQuery,
  useRestaurantByCategoryQuery,
  useRestaurantHourlyQuery,
  useRestaurantRevenueTrendQuery,
  useRestaurantSummaryQuery,
  useRestaurantTopItemsQuery,
} from './reports-api';
import { useAuth } from '@/features/auth/use-auth';
import { formatHour, formatPeriod } from '@/lib/dates';
import { formatTakaCompact, poishaToTaka } from '@/lib/money';
import type { CashierPerformance, ReportPeriod } from '@/types/api';

export function RestaurantReports({
  range,
  onPeriodResolved,
}: {
  range: RangeState;
  onPeriodResolved: (period: ReportPeriod) => void;
}) {
  const { can } = useAuth();
  const params = toRangeQuery(range);

  const summary = useRestaurantSummaryQuery(params);
  const trend = useRestaurantRevenueTrendQuery(params);
  const topItems = useRestaurantTopItemsQuery({ ...params, limit: 10 });
  const byCategory = useRestaurantByCategoryQuery(params);
  const hourly = useRestaurantHourlyQuery(params);
  const cashiers = useCashierPerformanceQuery(params, { skip: !can.viewAllReports });

  usePeriodSync(summary.data?.period, onPeriodResolved);

  const metrics = summary.data?.data;

  return (
    <div className="space-y-4">
      <ReportCard
        title="Summary"
        description="VAT and service charge are summed from the amounts stored on each order, not re-derived from today's settings."
        exportPath="/reports/restaurant/summary"
        exportName="restaurant-summary"
        exportParams={params}
        isLoading={summary.isLoading}
        isFetching={summary.isFetching}
        error={summary.error}
        onRetry={() => void summary.refetch()}
      >
        {metrics ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Revenue" metric={metrics.revenue} money emphasis />
            <MetricTile label="Orders" metric={metrics.orderCount} />
            <MetricTile label="Average order" metric={metrics.averageOrderValue} money />
            <MetricTile label="Items sold" metric={metrics.itemsSold} />
            <MetricTile label="Food and drink" metric={metrics.subtotal} money />
            <MetricTile label="Service charge" metric={metrics.serviceCharge} money />
            <MetricTile label="VAT collected" metric={metrics.vatCollected} money />
            <MetricTile label="Discounts given" metric={metrics.discounts} money inverse />
          </div>
        ) : null}
      </ReportCard>

      <ReportCard
        title="Revenue over time"
        exportPath="/reports/restaurant/revenue-trend"
        exportName="restaurant-revenue-trend"
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
                <Bar dataKey="revenue" name="Revenue" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </ReportCard>

      <ReportGrid>
        <ReportCard
          title="Top dishes"
          description="By quantity — what the kitchen should prep."
          exportPath="/reports/restaurant/top-items"
          exportName="restaurant-top-items"
          exportParams={{ ...params, limit: 10 }}
          isLoading={topItems.isLoading}
          isFetching={topItems.isFetching}
          error={topItems.error}
          onRetry={() => void topItems.refetch()}
        >
          <RankedRows
            rows={topItems.data?.data.byQuantity ?? []}
            rowKey={(item) => `q-${item.itemName}`}
            primary={(item) => item.itemName}
            secondary={(item) => item.categoryName}
            value={(item) => <span className="tabular text-sm">{item.quantity}</span>}
          />
        </ReportCard>

        <ReportCard
          title="Top earners"
          description="By revenue — what pays the rent. Rarely the same list."
          isLoading={topItems.isLoading}
          isFetching={topItems.isFetching}
          error={topItems.error}
          onRetry={() => void topItems.refetch()}
        >
          <RankedRows
            rows={topItems.data?.data.byRevenue ?? []}
            rowKey={(item) => `r-${item.itemName}`}
            primary={(item) => item.itemName}
            secondary={(item) => `${item.quantity} sold · ${item.categoryName}`}
            value={(item) => <Money value={item.revenue} />}
          />
        </ReportCard>
      </ReportGrid>

      <ReportGrid>
        <ReportCard
          title="By category"
          exportPath="/reports/restaurant/by-category"
          exportName="restaurant-by-category"
          exportParams={params}
          isLoading={byCategory.isLoading}
          isFetching={byCategory.isFetching}
          error={byCategory.error}
          onRetry={() => void byCategory.refetch()}
        >
          <RankedRows
            rows={byCategory.data?.data.categories ?? []}
            rowKey={(category) => category.categoryName}
            primary={(category) => category.categoryName}
            secondary={(category) => `${category.quantity} items · ${category.revenueShare}%`}
            value={(category) => <Money value={category.revenue} />}
            share={(category) => category.revenueShare}
          />
        </ReportCard>

        <ReportCard
          title="By hour of day"
          description="In the business timezone, so the lunch and dinner peaks land correctly."
          exportPath="/reports/restaurant/hourly"
          exportName="restaurant-hourly"
          exportParams={params}
          isLoading={hourly.isLoading}
          isFetching={hourly.isFetching}
          error={hourly.error}
          onRetry={() => void hourly.refetch()}
        >
          {hourly.data ? (
            <div className="space-y-2">
              {hourly.data.data.peakHour ? (
                <p className="text-muted-foreground text-sm">
                  Busiest at{' '}
                  <span className="text-foreground font-medium">{formatHour(hourly.data.data.peakHour.hour)}</span> —{' '}
                  {hourly.data.data.peakHour.orders} orders, <Money value={hourly.data.data.peakHour.revenue} />.
                </p>
              ) : null}

              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={hourly.data.data.hours
                      // Hours with nothing in them add noise, not information.
                      .filter((hour) => hour.orders > 0)
                      .map((hour) => ({ label: formatHour(hour.hour), orders: hour.orders }))}
                    margin={{ top: 4, right: 8, bottom: 0, left: -24 }}
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
                    <Bar dataKey="orders" name="Orders" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </ReportCard>
      </ReportGrid>

      {can.viewAllReports ? (
        <ReportCard
          title="Cashier performance"
          description="Orders, revenue, discounts and voids per cashier."
          exportPath="/reports/restaurant/cashier-performance"
          exportName="restaurant-cashier-performance"
          exportParams={params}
          isLoading={cashiers.isLoading}
          isFetching={cashiers.isFetching}
          error={cashiers.error}
          onRetry={() => void cashiers.refetch()}
        >
          <DataTable
            columns={CASHIER_COLUMNS}
            rows={cashiers.data?.data.cashiers}
            rowKey={(row) => row.cashierId}
            emptyTitle="No orders in this period"
          />
        </ReportCard>
      ) : null}
    </div>
  );
}

const CASHIER_COLUMNS: Array<Column<CashierPerformance>> = [
  { key: 'cashierName', header: 'Cashier', cell: (row) => <span className="font-medium">{row.cashierName}</span> },
  { key: 'orders', header: 'Orders', numeric: true, cell: (row) => <span className="tabular">{row.orders}</span> },
  { key: 'revenue', header: 'Revenue', numeric: true, cell: (row) => <Money value={row.revenue} /> },
  {
    key: 'averageOrderValue',
    header: 'Average',
    numeric: true,
    hideOnMobile: true,
    cell: (row) => <Money value={row.averageOrderValue} />,
  },
  {
    key: 'discounts',
    header: 'Discounts',
    numeric: true,
    hideOnMobile: true,
    cell: (row) => <Money value={row.discounts} />,
  },
  {
    key: 'voids',
    header: 'Voids',
    numeric: true,
    cell: (row) =>
      row.voidCount > 0 ? (
        <div>
          <span className="tabular text-destructive font-medium">{row.voidCount}</span>
          <p className="text-muted-foreground text-xs">
            <Money value={row.voidTotal} symbol={false} />
          </p>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];
