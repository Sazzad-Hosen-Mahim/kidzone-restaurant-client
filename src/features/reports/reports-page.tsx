import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page';
import { RangePicker, defaultRange, type RangeState } from './range-picker';
import { KidZoneReports } from './kidzone-reports';
import { RestaurantReports } from './restaurant-reports';
import { SharedReports } from './shared-reports';
import { useAuth } from '@/features/auth/use-auth';
import type { ReportPeriod } from '@/types/api';

/**
 * The reporting area.
 *
 * One period control at the top drives every tab, because the question a person
 * is asking — "how did last month go?" — does not change when they switch from
 * the Kid Zone to the restaurant.
 *
 * Which tabs exist depends on the role: a Kid Zone manager sees only the Kid
 * Zone, a cashier only the restaurant, and the shared reports are admin-only.
 */
export function ReportsPage() {
  const { can } = useAuth();
  const [range, setRange] = useState<RangeState>(defaultRange);
  const [period, setPeriod] = useState<ReportPeriod | undefined>();

  const tabs = [
    can.viewKidZoneReports ? 'kidzone' : null,
    can.viewRestaurantReports ? 'restaurant' : null,
    can.viewAllReports ? 'shared' : null,
  ].filter((tab): tab is string => tab !== null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Voided transactions are excluded from revenue and reported separately."
      />

      <RangePicker value={range} onChange={setRange} period={period} />

      <Tabs defaultValue={tabs[0]}>
        {tabs.length > 1 ? (
          <TabsList>
            {can.viewKidZoneReports ? <TabsTrigger value="kidzone">Kid Zone</TabsTrigger> : null}
            {can.viewRestaurantReports ? <TabsTrigger value="restaurant">Restaurant</TabsTrigger> : null}
            {can.viewAllReports ? <TabsTrigger value="shared">Both sections</TabsTrigger> : null}
          </TabsList>
        ) : null}

        {can.viewKidZoneReports ? (
          <TabsContent value="kidzone" className="pt-4">
            <KidZoneReports range={range} onPeriodResolved={setPeriod} />
          </TabsContent>
        ) : null}

        {can.viewRestaurantReports ? (
          <TabsContent value="restaurant" className="pt-4">
            <RestaurantReports range={range} onPeriodResolved={setPeriod} />
          </TabsContent>
        ) : null}

        {can.viewAllReports ? (
          <TabsContent value="shared" className="pt-4">
            <SharedReports range={range} onPeriodResolved={setPeriod} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
