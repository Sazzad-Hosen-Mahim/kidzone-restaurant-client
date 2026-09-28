import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageHeader, EmptyState, ErrorState } from '@/components/shared/page';
import { Money } from '@/components/shared/money';
import {
  MembershipStatusBadge,
  SaleStatusBadge,
  VerificationBadge,
} from '@/components/shared/status-badge';
import { useGetCustomerQuery } from './customers-api';
import { useAuth } from '@/features/auth/use-auth';
import { formatBusinessDate, formatMinutes, formatTime } from '@/lib/dates';
import { formatPhone, telHref } from '@/lib/phone';
import { ArrowLeft, CalendarCheck, Lock, Mail, MapPin, Phone, Printer, TriangleAlert, UtensilsCrossed } from 'lucide-react';

/**
 * One customer, with whatever history the caller's role allows.
 *
 * A restaurant cashier gets the guardian and their restaurant orders; the
 * `kidZone` block simply is not in the response for them, and no child record
 * is loaded at all. The UI reflects that rather than rendering empty sections.
 */
export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuth();

  const { data: customer, isLoading, error, refetch } = useGetCustomerQuery(id ?? '', { skip: !id });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;
  if (!customer) return null;

  const kidZone = customer.kidZone;

  return (
    <div className="space-y-6">
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 mb-2">
          <ArrowLeft /> Back
        </Button>
        <PageHeader
          title={customer.name}
          description={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <a href={telHref(customer.phone)} className="hover:text-primary tabular inline-flex items-center gap-1">
                <Phone className="size-3.5" /> {formatPhone(customer.phone)}
              </a>
              {customer.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="size-3.5" /> {customer.email}
                </span>
              ) : null}
              {customer.address ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {customer.address}
                </span>
              ) : null}
            </span>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {kidZone ? (
          <SpendTile label="Kid Zone spend" value={kidZone.totalSpent} count={`${kidZone.sales.length} sales`} />
        ) : null}
        <SpendTile
          label="Restaurant spend"
          value={customer.restaurant.totalSpent}
          count={`${customer.restaurant.orderCount} orders`}
        />
        {kidZone ? (
          <SpendTile
            label="Total"
            value={kidZone.totalSpent + customer.restaurant.totalSpent}
            count="across both sections"
            emphasis
          />
        ) : null}
      </div>

      {!can.viewChildData ? (
        <Alert>
          <Lock />
          <AlertTitle>Kid Zone data is not shown</AlertTitle>
          <AlertDescription>
            Children, memberships and visits are Kid Zone records. Your role sees the guardian and their restaurant
            orders.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue={kidZone ? 'children' : 'orders'}>
        <TabsList>
          {kidZone ? <TabsTrigger value="children">Children</TabsTrigger> : null}
          {kidZone ? <TabsTrigger value="memberships">Memberships</TabsTrigger> : null}
          {kidZone ? <TabsTrigger value="visits">Visits</TabsTrigger> : null}
          {kidZone ? <TabsTrigger value="kidzone-sales">Kid Zone sales</TabsTrigger> : null}
          <TabsTrigger value="orders">Restaurant orders</TabsTrigger>
        </TabsList>

        {kidZone ? (
          <TabsContent value="children" className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(customer.children ?? []).map((child) => (
                <Card key={child.id}>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="font-medium">{child.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {child.ageYears} years old · born {formatBusinessDate(child.dateOfBirth)}
                      </p>
                    </div>

                    {child.medicalNotes ? (
                      <p className="text-warning-foreground dark:text-warning bg-warning/10 flex items-start gap-1.5 rounded-md p-2 text-xs">
                        <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                        {child.medicalNotes}
                      </p>
                    ) : null}

                    <Separator />

                    <div className="text-muted-foreground text-xs">
                      <p className="font-medium">Emergency contact</p>
                      <p>{child.emergencyContactName}</p>
                      <p className="tabular">{formatPhone(child.emergencyContactPhone)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(customer.children ?? []).length === 0 ? (
                <Card className="sm:col-span-2 lg:col-span-3">
                  <CardContent>
                    <EmptyState title="No children on file" description="They are added when a plan is sold." />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </TabsContent>
        ) : null}

        {kidZone ? (
          <TabsContent value="memberships" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarCheck className="size-4" /> Memberships
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kidZone.memberships.length === 0 ? (
                  <EmptyState title="No memberships" />
                ) : (
                  kidZone.memberships.map((membership) => (
                    <div
                      key={membership.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{membership.plan?.name}</p>
                        <p className="text-muted-foreground tabular text-xs">
                          {membership.child?.name} · {formatBusinessDate(membership.startDate)} –{' '}
                          {formatBusinessDate(membership.endDate)}
                        </p>
                      </div>
                      <MembershipStatusBadge status={membership.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {kidZone ? (
          <TabsContent value="visits" className="pt-4">
            <Card>
              <CardContent className="space-y-2">
                {kidZone.visits.length === 0 ? (
                  <EmptyState title="No visits yet" />
                ) : (
                  kidZone.visits.map((visit) => (
                    <div
                      key={visit.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {visit.child?.name} · <span className="tabular">{visit.gatepassNo}</span>
                        </p>
                        <p className="text-muted-foreground tabular text-xs">
                          {formatBusinessDate(visit.businessDate)} · {formatTime(visit.checkInAt)}
                          {visit.checkOutAt ? ` – ${formatTime(visit.checkOutAt)}` : ' · still inside'}
                          {visit.overtimeMinutes > 0 ? ` · ${formatMinutes(visit.overtimeMinutes)} over` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {visit.overtimeCharge > 0 ? (
                          <Money value={visit.overtimeCharge} className="text-destructive text-sm" />
                        ) : null}
                        <VerificationBadge method={visit.verificationMethod} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {kidZone ? (
          <TabsContent value="kidzone-sales" className="pt-4">
            <Card>
              <CardContent className="space-y-2">
                {kidZone.sales.length === 0 ? (
                  <EmptyState title="No Kid Zone sales" />
                ) : (
                  kidZone.sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{sale.planNameSnapshot}</p>
                        <p className="text-muted-foreground tabular text-xs">
                          {sale.receiptNo} · {formatBusinessDate(sale.businessDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Money value={sale.totalAmount} className="text-sm" />
                        <SaleStatusBadge status={sale.status} />
                        <Button asChild variant="ghost" size="icon" aria-label="Receipt">
                          <Link to={`/receipts/kidzone/${sale.id}`}>
                            <Printer className="size-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="orders" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UtensilsCrossed className="size-4" /> Restaurant orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customer.restaurant.orders.length === 0 ? (
                <EmptyState
                  title="No restaurant orders"
                  description="Orders appear here when a phone number is attached at the till."
                />
              ) : (
                customer.restaurant.orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="tabular truncate text-sm font-medium">{order.receiptNo}</p>
                      <p className="text-muted-foreground tabular text-xs">
                        {formatBusinessDate(order.businessDate)}
                        {order.tableNo ? ` · table ${order.tableNo}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Money value={order.totalAmount} className="text-sm" />
                      <SaleStatusBadge status={order.status} />
                      <Button asChild variant="ghost" size="icon" aria-label="Receipt">
                        <Link to={`/receipts/restaurant/${order.id}`}>
                          <Printer className="size-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SpendTile({
  label,
  value,
  count,
  emphasis,
}: {
  label: string;
  value: number;
  count: string;
  emphasis?: boolean;
}) {
  return (
    <Card className={emphasis ? 'border-primary/40' : undefined}>
      <CardContent>
        <p className="text-muted-foreground text-xs">{label}</p>
        <Money value={value} className="text-xl font-semibold" />
        <p className="text-muted-foreground text-xs">{count}</p>
      </CardContent>
    </Card>
  );
}
