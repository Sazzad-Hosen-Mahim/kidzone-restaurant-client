import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CardsSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/shared/page";
import { Money } from "@/components/shared/money";
import { Pill } from "@/components/shared/status-badge";
import { MetricTile } from "@/components/shared/metric-tile";
import { ChartTooltipContent } from "@/components/shared/chart-tooltip";
import { useDashboardQuery } from "@/features/reports/reports-api";
import {
  formatBusinessDate,
  formatBusinessDateShort,
  formatMinutes,
  formatTime,
} from "@/lib/dates";
import { formatTakaCompact, poishaToTaka } from "@/lib/money";
import { formatPhone, telHref } from "@/lib/phone";
import {
  CalendarClock,
  DoorOpen,
  Phone,
  RefreshCw,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";

/**
 * The owner's dashboard.
 *
 * One request rather than six: the API assembles today's figures, the live
 * floor, the expiring memberships, the top dishes and the seven-day trend in a
 * single call, which is what makes this screen usable as a wall display.
 *
 * Polled slowly — revenue for the day does not need a five-second refresh, and
 * this is often left open on a screen all day.
 */
export function DashboardPage() {
  const { data, isLoading, isFetching, error, refetch } = useDashboardQuery(
    undefined,
    {
      pollingInterval: 120_000,
      refetchOnFocus: true,
    },
  );

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <CardsSkeleton />
      </div>
    );
  }

  const trend = data.last7Days.map((day) => ({
    label: formatBusinessDateShort(day.businessDate),
    kidZone: poishaToTaka(day.kidZoneRevenue),
    restaurant: poishaToTaka(day.restaurantRevenue),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`${formatBusinessDate(data.businessDate)} · ${data.timezone}`}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? "animate-spin" : undefined} />{" "}
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Combined revenue"
          metric={data.today.combined.revenue}
          money
          emphasis
          comparisonLabel="vs yesterday"
        />
        <MetricTile
          label="Kid Zone"
          metric={data.today.kidZone.revenue}
          money
          comparisonLabel="vs yesterday"
        />
        <MetricTile
          label="Restaurant"
          metric={data.today.restaurant.revenue}
          money
          comparisonLabel="vs yesterday"
        />
        <MetricTile
          label="Transactions"
          metric={data.today.combined.transactions}
          comparisonLabel="vs yesterday"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Last 7 days</CardTitle>
            <CardDescription>Revenue by section, in taka.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
                >
                  <defs>
                    <linearGradient
                      id="kidZoneFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-1)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="restaurantFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--chart-2)"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--chart-2)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) =>
                      formatTakaCompact(value * 100)
                    }
                    width={64}
                  />
                  <RechartsTooltip content={<ChartTooltipContent money />} />

                  <Area
                    type="monotone"
                    dataKey="kidZone"
                    name="Kid Zone"
                    stroke="var(--chart-1)"
                    fill="url(#kidZoneFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="restaurant"
                    name="Restaurant"
                    stroke="var(--chart-2)"
                    fill="url(#restaurantFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="text-muted-foreground mt-2 flex items-center justify-center gap-4 text-xs">
              <LegendDot color="var(--chart-1)" label="Kid Zone" />
              <LegendDot color="var(--chart-2)" label="Restaurant" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="size-4" /> Top dishes today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.topDishesToday.length === 0 ? (
              <EmptyState title="Nothing sold yet" className="py-8" />
            ) : (
              data.topDishesToday.map((dish, index) => (
                <div key={dish.itemName} className="flex items-center gap-3">
                  <span className="bg-muted text-muted-foreground tabular flex size-6 shrink-0 items-center justify-center rounded text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {dish.itemName}
                    </p>
                    <p className="text-muted-foreground tabular text-xs">
                      {dish.quantity} sold
                    </p>
                  </div>
                  <Money value={dish.revenue} className="shrink-0 text-sm" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className={
            data.liveFloor.overtimeVisitCount > 0
              ? "border-destructive/40"
              : undefined
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <DoorOpen className="size-4" /> On the floor
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link to="/kidzone/floor">Open board</Link>
              </Button>
            </CardTitle>
            <CardDescription>
              <span className="tabular">{data.liveFloor.activeVisitCount}</span>{" "}
              inside
              {data.liveFloor.overtimeVisitCount > 0 ? (
                <>
                  {" · "}
                  <span className="text-destructive font-medium">
                    {data.liveFloor.overtimeVisitCount} in overtime,{" "}
                    <Money value={data.liveFloor.owedOvertimeTotal} /> owed
                  </span>
                </>
              ) : null}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            {data.liveFloor.visits.length === 0 ? (
              <EmptyState title="Nobody is inside" className="py-6" />
            ) : (
              data.liveFloor.visits.slice(0, 6).map((visit) => (
                <div
                  key={visit.visitId}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {visit.childName}
                    </p>
                    <p className="text-muted-foreground tabular truncate text-xs">
                      {visit.planName} · in at {formatTime(visit.checkInAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {visit.isOvertime ? (
                      <>
                        <Pill tone="danger">Overtime</Pill>
                        <p className="text-destructive tabular mt-0.5 text-xs">
                          <Money value={visit.owedOvertime} symbol={false} />{" "}
                          owed
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground tabular text-xs">
                        {visit.remainingMinutes === null
                          ? formatMinutes(visit.elapsedMinutes) + " in"
                          : formatMinutes(visit.remainingMinutes) + " left"}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4" /> Expiring this week
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link to="/kidzone/memberships">All memberships</Link>
              </Button>
            </CardTitle>
            <CardDescription>
              {formatBusinessDate(data.membershipsExpiringThisWeek.weekStart)} –{" "}
              {formatBusinessDate(data.membershipsExpiringThisWeek.weekEnd)} ·
              the follow-up call list
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-2">
            {data.membershipsExpiringThisWeek.count === 0 ? (
              <EmptyState title="Nothing expires this week" className="py-6" />
            ) : (
              data.membershipsExpiringThisWeek.memberships.map((membership) => (
                <div
                  key={membership.membershipId}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {membership.childName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {membership.customerName} · {membership.planName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground tabular text-xs">
                      {formatBusinessDate(membership.endDate, "d MMM")}
                    </span>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      aria-label={`Call ${membership.customerName}`}
                    >
                      <a
                        href={telHref(membership.customerPhone)}
                        title={formatPhone(membership.customerPhone)}
                      >
                        <Phone className="size-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {data.liveFloor.overtimeVisitCount > 0 ? (
        <Card className="border-destructive/40 bg-destructive/[0.03]">
          <CardContent className="flex flex-wrap items-center gap-3">
            <TriangleAlert className="text-destructive size-5 shrink-0" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-medium">
                {data.liveFloor.overtimeVisitCount} visit
                {data.liveFloor.overtimeVisitCount === 1 ? " is" : "s are"} over
                time
              </span>
              <span className="text-muted-foreground">
                {" "}
                — <Money value={data.liveFloor.owedOvertimeTotal} /> to collect
                at check-out.
              </span>
            </p>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <Button asChild size="sm">
              <Link to="/kidzone/floor">Go to the floor</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
