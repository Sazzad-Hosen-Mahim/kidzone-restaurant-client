import { api } from '@/app/api';
import { toQueryString, type QueryParams } from '@/app/query-helpers';
import type {
  ApiEnvelope,
  CashierPerformance,
  CategoryBreakdown,
  CrossSectionReport,
  DashboardData,
  DiscountsVoidsReport,
  HourlyReport,
  KidZoneSummary,
  MembersReport,
  PaymentMethodsReport,
  PlanBreakdown,
  RangeKey,
  ReportPeriod,
  RestaurantSummary,
  RevenueTrend,
  Section,
  TopItemsReport,
  UtilizationReport,
  VisitsReport,
} from '@/types/api';

/**
 * Report queries.
 *
 * Every report endpoint returns its resolved period in `meta.period`, and the
 * UI needs that as much as the numbers — it is what the date-range header
 * shows, and what tells the user that "this month" means the 1st to today.
 * So these endpoints keep both rather than unwrapping to `data` alone.
 */
export interface ReportResult<T> {
  data: T;
  period: ReportPeriod;
}

export interface ReportQuery extends QueryParams {
  range?: RangeKey;
  from?: string;
  to?: string;
}

function withPeriod<T>(response: ApiEnvelope<T>): ReportResult<T> {
  return {
    data: response.data,
    period:
      response.meta.period ??
      // Only the dashboard omits a period; a placeholder keeps the type honest
      // without forcing every consumer to null-check.
      ({ range: 'today', from: '', to: '', days: 1, previous: { from: '', to: '' }, timezone: 'Asia/Dhaka' } as ReportPeriod),
  };
}

export interface SectionReportQuery extends ReportQuery {
  section?: Section;
}

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ------------------------------------------------------------- Kid Zone
    kidZoneSummary: build.query<ReportResult<KidZoneSummary>, ReportQuery>({
      query: (params) => `/reports/kidzone/summary${toQueryString(params)}`,
      transformResponse: withPeriod<KidZoneSummary>,
      providesTags: ['Report'],
    }),

    kidZoneRevenueTrend: build.query<ReportResult<RevenueTrend>, ReportQuery>({
      query: (params) => `/reports/kidzone/revenue-trend${toQueryString(params)}`,
      transformResponse: withPeriod<RevenueTrend>,
      providesTags: ['Report'],
    }),

    kidZoneByPlan: build.query<ReportResult<{ plans: PlanBreakdown[] }>, ReportQuery>({
      query: (params) => `/reports/kidzone/by-plan${toQueryString(params)}`,
      transformResponse: withPeriod<{ plans: PlanBreakdown[] }>,
      providesTags: ['Report'],
    }),

    kidZoneVisits: build.query<ReportResult<VisitsReport>, ReportQuery>({
      query: (params) => `/reports/kidzone/visits${toQueryString(params)}`,
      transformResponse: withPeriod<VisitsReport>,
      providesTags: ['Report'],
    }),

    kidZonePeakHours: build.query<ReportResult<import('@/types/api').PeakHoursReport>, ReportQuery>({
      query: (params) => `/reports/kidzone/peak-hours${toQueryString(params)}`,
      transformResponse: withPeriod<import('@/types/api').PeakHoursReport>,
      providesTags: ['Report'],
    }),

    kidZoneUtilization: build.query<
      ReportResult<UtilizationReport>,
      ReportQuery & { lowUsageThreshold?: number }
    >({
      query: (params) => `/reports/kidzone/membership-utilization${toQueryString(params)}`,
      transformResponse: withPeriod<UtilizationReport>,
      providesTags: ['Report'],
    }),

    kidZoneMembers: build.query<ReportResult<MembersReport>, ReportQuery>({
      query: (params) => `/reports/kidzone/members${toQueryString(params)}`,
      transformResponse: withPeriod<MembersReport>,
      providesTags: ['Report', 'Membership'],
    }),

    // ----------------------------------------------------------- Restaurant
    restaurantSummary: build.query<ReportResult<RestaurantSummary>, ReportQuery>({
      query: (params) => `/reports/restaurant/summary${toQueryString(params)}`,
      transformResponse: withPeriod<RestaurantSummary>,
      providesTags: ['Report'],
    }),

    restaurantRevenueTrend: build.query<ReportResult<RevenueTrend>, ReportQuery>({
      query: (params) => `/reports/restaurant/revenue-trend${toQueryString(params)}`,
      transformResponse: withPeriod<RevenueTrend>,
      providesTags: ['Report'],
    }),

    restaurantTopItems: build.query<ReportResult<TopItemsReport>, ReportQuery & { limit?: number }>({
      query: (params) => `/reports/restaurant/top-items${toQueryString(params)}`,
      transformResponse: withPeriod<TopItemsReport>,
      providesTags: ['Report'],
    }),

    restaurantByCategory: build.query<ReportResult<{ categories: CategoryBreakdown[] }>, ReportQuery>({
      query: (params) => `/reports/restaurant/by-category${toQueryString(params)}`,
      transformResponse: withPeriod<{ categories: CategoryBreakdown[] }>,
      providesTags: ['Report'],
    }),

    restaurantHourly: build.query<ReportResult<HourlyReport>, ReportQuery>({
      query: (params) => `/reports/restaurant/hourly${toQueryString(params)}`,
      transformResponse: withPeriod<HourlyReport>,
      providesTags: ['Report'],
    }),

    cashierPerformance: build.query<ReportResult<{ cashiers: CashierPerformance[] }>, ReportQuery>({
      query: (params) => `/reports/restaurant/cashier-performance${toQueryString(params)}`,
      transformResponse: withPeriod<{ cashiers: CashierPerformance[] }>,
      providesTags: ['Report'],
    }),

    // --------------------------------------------------------------- Shared
    paymentMethods: build.query<ReportResult<PaymentMethodsReport>, SectionReportQuery>({
      query: (params) => `/reports/payment-methods${toQueryString(params)}`,
      transformResponse: withPeriod<PaymentMethodsReport>,
      providesTags: ['Report'],
    }),

    discountsVoids: build.query<ReportResult<DiscountsVoidsReport>, SectionReportQuery>({
      query: (params) => `/reports/discounts-voids${toQueryString(params)}`,
      transformResponse: withPeriod<DiscountsVoidsReport>,
      providesTags: ['Report'],
    }),

    crossSection: build.query<ReportResult<CrossSectionReport>, ReportQuery>({
      query: (params) => `/reports/cross-section${toQueryString(params)}`,
      transformResponse: withPeriod<CrossSectionReport>,
      providesTags: ['Report'],
    }),

    // ------------------------------------------------------------ Dashboard
    dashboard: build.query<DashboardData, void>({
      query: () => '/dashboard/combined',
      transformResponse: (response: ApiEnvelope<DashboardData>) => response.data,
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useKidZoneSummaryQuery,
  useKidZoneRevenueTrendQuery,
  useKidZoneByPlanQuery,
  useKidZoneVisitsQuery,
  useKidZonePeakHoursQuery,
  useKidZoneUtilizationQuery,
  useKidZoneMembersQuery,
  useRestaurantSummaryQuery,
  useRestaurantRevenueTrendQuery,
  useRestaurantTopItemsQuery,
  useRestaurantByCategoryQuery,
  useRestaurantHourlyQuery,
  useCashierPerformanceQuery,
  usePaymentMethodsQuery,
  useDiscountsVoidsQuery,
  useCrossSectionQuery,
  useDashboardQuery,
} = reportsApi;
