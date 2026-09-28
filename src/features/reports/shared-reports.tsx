import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Money } from '@/components/shared/money';
import { DataTable, type Column } from '@/components/shared/data-table';
import { ChartTooltipContent } from '@/components/shared/chart-tooltip';
import { Pill, paymentMethodLabel } from '@/components/shared/status-badge';
import { SelectFilter } from '@/components/shared/filter-bar';
import { ReportCard, ReportGrid, usePeriodSync } from './report-section';
import { toRangeQuery, type RangeState } from './range-picker';
import { useCrossSectionQuery, useDiscountsVoidsQuery, usePaymentMethodsQuery } from './reports-api';
import { formatBusinessDate, formatInstant } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { poishaToTaka } from '@/lib/money';
import type { DiscountRow, ReportPeriod, Section, VoidRow } from '@/types/api';

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function SharedReports({
  range,
  onPeriodResolved,
}: {
  range: RangeState;
  onPeriodResolved: (period: ReportPeriod) => void;
}) {
  const [section, setSection] = useState<Section | undefined>();
  const params = { ...toRangeQuery(range), ...(section ? { section } : {}) };
  const rangeOnly = toRangeQuery(range);

  const methods = usePaymentMethodsQuery(params);
  const oversight = useDiscountsVoidsQuery(params);
  const cross = useCrossSectionQuery(rangeOnly);

  usePeriodSync(methods.data?.period, onPeriodResolved);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SelectFilter
          label="Section"
          value={section}
          onChange={setSection}
          options={[
            { value: 'KIDZONE' as const, label: 'Kid Zone' },
            { value: 'RESTAURANT' as const, label: 'Restaurant' },
          ]}
          allLabel="Both sections"
        />
      </div>

      <ReportGrid>
        <ReportCard
          title="Payment methods"
          description="From payment rows, so a split bill counts once per tender."
          exportPath="/reports/payment-methods"
          exportName="payment-methods"
          exportParams={params}
          isLoading={methods.isLoading}
          isFetching={methods.isFetching}
          error={methods.error}
          onRetry={() => void methods.refetch()}
        >
          {methods.data ? (
            methods.data.data.methods.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Nothing was taken in this period.</p>
            ) : (
              <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={methods.data.data.methods.map((method) => ({
                          name: paymentMethodLabel(method.method),
                          value: poishaToTaka(method.total),
                        }))}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {methods.data.data.methods.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltipContent money />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {methods.data.data.methods.map((method, index) => (
                    <div key={method.method} className="flex items-center gap-2 text-sm">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate">{paymentMethodLabel(method.method)}</span>
                      <span className="text-muted-foreground tabular text-xs">{method.share}%</span>
                      <Money value={method.total} className="shrink-0" />
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                    <span>Total</span>
                    <Money value={methods.data.data.total} />
                  </div>
                </div>
              </div>
            )
          ) : null}
        </ReportCard>

        <ReportCard
          title="Cross-section customers"
          description="Guardians who used both sides of the business — what a combo offer rests on."
          exportPath="/reports/cross-section"
          exportName="cross-section-customers"
          exportParams={rangeOnly}
          isLoading={cross.isLoading}
          isFetching={cross.isFetching}
          error={cross.error}
          onRetry={() => void cross.refetch()}
        >
          {cross.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Used both" value={cross.data.data.summary.crossSectionCustomers} emphasis />
                <Stat label="Kid Zone" value={cross.data.data.summary.kidZoneCustomers} />
                <Stat label="Restaurant" value={cross.data.data.summary.restaurantCustomers} />
              </div>

              <p className="text-muted-foreground text-sm">
                <span className="text-foreground tabular font-medium">
                  {cross.data.data.summary.crossoverRate}%
                </span>{' '}
                of Kid Zone customers also ate here, spending{' '}
                <Money value={cross.data.data.summary.averageSpendPerCustomer} /> on average across both.
              </p>

              <div className="space-y-1.5">
                {cross.data.data.customers.slice(0, 6).map((customer) => (
                  <Link
                    key={customer.customerId}
                    to={`/customers/${customer.customerId}`}
                    className="hover:bg-accent flex items-center justify-between gap-2 rounded-lg border p-2.5 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{customer.name}</p>
                      <p className="text-muted-foreground tabular truncate text-xs">
                        {formatPhone(customer.phone)} · KZ <Money value={customer.kidZoneSpend} symbol={false} /> ·
                        RS <Money value={customer.restaurantSpend} symbol={false} />
                      </p>
                    </div>
                    <Money value={customer.totalSpend} className="shrink-0 text-sm font-medium" />
                  </Link>
                ))}
                {cross.data.data.customers.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center text-sm">
                    Nobody used both sections in this period. Remember a restaurant order only counts here if a phone
                    was attached at the till.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </ReportCard>
      </ReportGrid>

      <ReportCard
        title="Discounts and voids"
        description="The two ways money leaves without a customer complaining. Every one, with who and why."
        exportPath="/reports/discounts-voids"
        exportName="discounts-and-voids"
        exportParams={params}
        isLoading={oversight.isLoading}
        isFetching={oversight.isFetching}
        error={oversight.error}
        onRetry={() => void oversight.refetch()}
      >
        {oversight.data ? (
          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-4">
              <Stat label="Discounts" value={oversight.data.data.totals.discountCount} />
              <StatMoney label="Discount value" value={oversight.data.data.totals.discountAmount} />
              <Stat label="Voids" value={oversight.data.data.totals.voidCount} />
              <StatMoney label="Voided value" value={oversight.data.data.totals.voidAmount} />
            </div>

            {oversight.data.data.byStaff.length > 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">By staff member</p>
                {oversight.data.data.byStaff.map((staff) => (
                  <div key={staff.staffId} className="flex flex-wrap items-center gap-3 rounded-lg border p-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{staff.name}</span>
                    {staff.discountCount > 0 ? (
                      <span className="text-muted-foreground">
                        {staff.discountCount} discount{staff.discountCount === 1 ? '' : 's'} ·{' '}
                        <Money value={staff.discountAmount} />
                      </span>
                    ) : null}
                    {staff.voidCount > 0 ? (
                      <span className="text-destructive">
                        {staff.voidCount} void{staff.voidCount === 1 ? '' : 's'} ·{' '}
                        <Money value={staff.voidAmount} />
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Discounts</p>
              <DataTable
                columns={DISCOUNT_COLUMNS}
                rows={oversight.data.data.discounts}
                rowKey={(row) => `${row.section}-${row.id}`}
                emptyTitle="No discounts in this period"
              />
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">Voids</p>
              <DataTable
                columns={VOID_COLUMNS}
                rows={oversight.data.data.voids}
                rowKey={(row) => `${row.section}-${row.id}`}
                emptyTitle="No voids in this period"
              />
            </div>
          </div>
        ) : null}
      </ReportCard>
    </div>
  );
}

function SectionPill({ section }: { section: Section }) {
  return (
    <Pill tone={section === 'KIDZONE' ? 'info' : 'muted'}>{section === 'KIDZONE' ? 'Kid Zone' : 'Restaurant'}</Pill>
  );
}

const DISCOUNT_COLUMNS: Array<Column<DiscountRow>> = [
  { key: 'section', header: 'Section', cell: (row) => <SectionPill section={row.section} /> },
  {
    key: 'receiptNo',
    header: 'Receipt',
    cell: (row) => (
      <div>
        <p className="tabular text-sm">{row.receiptNo}</p>
        <p className="text-muted-foreground text-xs">{formatBusinessDate(row.businessDate)}</p>
      </div>
    ),
  },
  {
    key: 'by',
    header: 'Given by',
    hideOnMobile: true,
    cell: (row) => <span className="text-sm">{row.by?.name ?? '—'}</span>,
  },
  {
    key: 'discountAmount',
    header: 'Discount',
    numeric: true,
    cell: (row) => (
      <div>
        <Money value={row.discountAmount} className="font-medium" />
        <p className="text-muted-foreground tabular text-xs">{row.discountPercent}%</p>
      </div>
    ),
  },
  {
    key: 'reason',
    header: 'Reason',
    cell: (row) => <span className="text-muted-foreground line-clamp-2 text-sm">{row.reason ?? '—'}</span>,
  },
];

const VOID_COLUMNS: Array<Column<VoidRow>> = [
  { key: 'section', header: 'Section', cell: (row) => <SectionPill section={row.section} /> },
  {
    key: 'receiptNo',
    header: 'Receipt',
    cell: (row) => (
      <div>
        <p className="tabular text-sm">{row.receiptNo}</p>
        <p className="text-muted-foreground text-xs">{formatBusinessDate(row.businessDate)}</p>
      </div>
    ),
  },
  {
    key: 'voidedBy',
    header: 'Voided by',
    hideOnMobile: true,
    cell: (row) => (
      <div>
        <p className="text-sm">{row.voidedBy?.name ?? '—'}</p>
        <p className="text-muted-foreground text-xs">{row.at ? formatInstant(row.at, 'd MMM, h:mm a') : ''}</p>
      </div>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    numeric: true,
    cell: (row) => <Money value={row.amount} className="text-destructive font-medium" />,
  },
  {
    key: 'reason',
    header: 'Reason',
    cell: (row) => <span className="text-muted-foreground line-clamp-2 text-sm">{row.reason ?? '—'}</span>,
  },
];

function Stat({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border p-2.5 text-center ${emphasis ? 'border-primary/40' : ''}`}>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="tabular text-lg font-semibold">{value.toLocaleString('en-US')}</p>
    </div>
  );
}

function StatMoney({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-2.5 text-center">
      <p className="text-muted-foreground text-xs">{label}</p>
      <Money value={value} className="text-lg font-semibold" />
    </div>
  );
}
