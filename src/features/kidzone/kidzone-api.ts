import { api } from '@/app/api';
import { listTags, transformEnvelope, transformList, toQueryString, type QueryParams } from '@/app/query-helpers';
import type { CreateChildRequest } from '@/features/customers/customers-api';
import type {
  ActiveVisit,
  CheckInLookup,
  CheckInResult,
  KidZonePlan,
  KidZoneSale,
  Membership,
  MembershipStatus,
  OtpSendResult,
  Paginated,
  PaymentInput,
  PlanType,
  QrCard,
  SaleResult,
  SaleStatus,
  VerificationMethod,
  Visit,
  VisitStatus,
} from '@/types/api';

// ---------------------------------------------------------------------------
// Request shapes
// ---------------------------------------------------------------------------

export interface CustomerRef {
  id?: string;
  phone?: string;
  name?: string;
  email?: string;
  address?: string;
}

export interface ChildRef {
  id?: string;
  create?: CreateChildRequest;
}

export interface CreateSaleRequest {
  customer: CustomerRef;
  child: ChildRef;
  planId: string;
  discountAmount?: number;
  discountReason?: string;
  payments: PaymentInput[];
}

export interface RenewRequest {
  planId?: string;
  discountAmount?: number;
  discountReason?: string;
  payments: PaymentInput[];
}

export interface CreatePlanRequest {
  name: string;
  type: PlanType;
  price: number;
  durationDays?: number;
  sessionMinutes?: number;
  includesSnackBox?: boolean;
  requiresVerification?: boolean;
  overtimeBlockMinutes?: number;
  overtimeRatePerBlock?: number;
  gracePeriodMinutes?: number;
  sortOrder?: number;
}

export type UpdatePlanRequest = Partial<CreatePlanRequest> & { isActive?: boolean };

export interface SaleListQuery extends QueryParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  status?: SaleStatus;
  customerId?: string;
  childId?: string;
  planId?: string;
  search?: string;
}

export interface MembershipListQuery extends QueryParams {
  page?: number;
  limit?: number;
  status?: MembershipStatus;
  expiringWithinDays?: number;
  customerId?: string;
  childId?: string;
  planId?: string;
  search?: string;
  sort?: MembershipSortColumn;
  order?: 'asc' | 'desc';
}

export type MembershipSortColumn = 'startDate' | 'endDate' | 'visitCount' | 'status';

export interface VisitListQuery extends QueryParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  childId?: string;
  customerId?: string;
  membershipId?: string;
  status?: VisitStatus;
  verificationMethod?: VerificationMethod;
  search?: string;
}

/** Everything a completed sale touches, so one list can invalidate it all. */
const SALE_EFFECTS = [
  { type: 'KidZoneSale' as const, id: 'LIST' },
  { type: 'Membership' as const, id: 'LIST' },
  { type: 'Visit' as const, id: 'LIST' },
  'ActiveVisits' as const,
  { type: 'Customer' as const, id: 'LIST' },
  'Closing' as const,
  'Report' as const,
  'Dashboard' as const,
];

export const kidzoneApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ---------------------------------------------------------------- plans
    listPlans: build.query<Paginated<KidZonePlan>, QueryParams | void>({
      query: (params) => `/kidzone/plans${toQueryString(params ?? { limit: 100 })}`,
      transformResponse: transformList<KidZonePlan>,
      providesTags: (result) => listTags('Plan', result),
    }),

    getPlan: build.query<KidZonePlan, string>({
      query: (id) => `/kidzone/plans/${id}`,
      transformResponse: transformEnvelope<KidZonePlan>,
      providesTags: (_r, _e, id) => [{ type: 'Plan', id }],
    }),

    createPlan: build.mutation<KidZonePlan, CreatePlanRequest>({
      query: (body) => ({ url: '/kidzone/plans', method: 'POST', body }),
      transformResponse: transformEnvelope<KidZonePlan>,
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }],
    }),

    updatePlan: build.mutation<KidZonePlan, { id: string; body: UpdatePlanRequest }>({
      query: ({ id, body }) => ({ url: `/kidzone/plans/${id}`, method: 'PATCH', body }),
      transformResponse: transformEnvelope<KidZonePlan>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Plan', id }, { type: 'Plan', id: 'LIST' }],
    }),

    deletePlan: build.mutation<KidZonePlan, string>({
      query: (id) => ({ url: `/kidzone/plans/${id}`, method: 'DELETE' }),
      transformResponse: transformEnvelope<KidZonePlan>,
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }],
    }),

    // ---------------------------------------------------------------- sales
    createSale: build.mutation<SaleResult, CreateSaleRequest>({
      query: (body) => ({ url: '/kidzone/sales', method: 'POST', body }),
      transformResponse: transformEnvelope<SaleResult>,
      invalidatesTags: SALE_EFFECTS,
    }),

    listSales: build.query<Paginated<KidZoneSale>, SaleListQuery | void>({
      query: (params) => `/kidzone/sales${toQueryString(params ?? {})}`,
      transformResponse: transformList<KidZoneSale>,
      providesTags: (result) => listTags('KidZoneSale', result),
    }),

    getSale: build.query<KidZoneSale, string>({
      query: (id) => `/kidzone/sales/${id}`,
      transformResponse: transformEnvelope<KidZoneSale>,
      providesTags: (_r, _e, id) => [{ type: 'KidZoneSale', id }],
    }),

    voidSale: build.mutation<KidZoneSale, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/kidzone/sales/${id}/void`, method: 'POST', body: { reason } }),
      transformResponse: transformEnvelope<KidZoneSale>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'KidZoneSale', id }, ...SALE_EFFECTS, 'AuditLog'],
    }),

    // ---------------------------------------------------------- memberships
    listMemberships: build.query<Paginated<Membership>, MembershipListQuery | void>({
      query: (params) => `/kidzone/memberships${toQueryString(params ?? {})}`,
      transformResponse: transformList<Membership>,
      providesTags: (result) => listTags('Membership', result),
    }),

    getMembership: build.query<Membership, string>({
      query: (id) => `/kidzone/memberships/${id}`,
      transformResponse: transformEnvelope<Membership>,
      providesTags: (_r, _e, id) => [{ type: 'Membership', id }],
    }),

    /**
     * The printable card, including the gate credential.
     *
     * Deliberately **not** cached under the `Membership` tag and never
     * prefetched: every fetch writes an audit row, so it should happen when a
     * card is actually being shown and not because a list was refreshed.
     */
    getMembershipQr: build.query<QrCard, string>({
      query: (id) => `/kidzone/memberships/${id}/qr`,
      transformResponse: transformEnvelope<QrCard>,
      keepUnusedDataFor: 0,
    }),

    reissueMembershipQr: build.mutation<QrCard, { id: string; reason: string }>({
      query: ({ id, reason }) => ({
        url: `/kidzone/memberships/${id}/qr/reissue`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: transformEnvelope<QrCard>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Membership', id }, 'AuditLog'],
    }),

    renewMembership: build.mutation<SaleResult, { id: string; body: RenewRequest }>({
      query: ({ id, body }) => ({ url: `/kidzone/memberships/${id}/renew`, method: 'POST', body }),
      transformResponse: transformEnvelope<SaleResult>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Membership', id }, ...SALE_EFFECTS],
    }),

    // ------------------------------------------------------------- check-in
    checkInLookup: build.mutation<CheckInLookup, { phone: string }>({
      query: (body) => ({ url: '/kidzone/checkin/lookup', method: 'POST', body }),
      transformResponse: transformEnvelope<CheckInLookup>,
    }),

    sendOtp: build.mutation<OtpSendResult, { phone: string }>({
      query: (body) => ({ url: '/kidzone/checkin/otp/send', method: 'POST', body }),
      transformResponse: transformEnvelope<OtpSendResult>,
      invalidatesTags: ['SmsLog'],
    }),

    verifyOtp: build.mutation<
      CheckInResult,
      { phone: string; code: string; childId: string; membershipId: string }
    >({
      query: (body) => ({ url: '/kidzone/checkin/otp/verify', method: 'POST', body }),
      transformResponse: transformEnvelope<CheckInResult>,
      invalidatesTags: ['ActiveVisits', { type: 'Visit', id: 'LIST' }, 'Dashboard', 'Report'],
    }),

    checkInQr: build.mutation<CheckInResult, { qrToken: string; childId?: string }>({
      query: (body) => ({ url: '/kidzone/checkin/qr', method: 'POST', body }),
      transformResponse: transformEnvelope<CheckInResult>,
      invalidatesTags: ['ActiveVisits', { type: 'Visit', id: 'LIST' }, 'Dashboard', 'Report'],
    }),

    checkInManual: build.mutation<CheckInResult, { membershipId: string; childId?: string; reason: string }>({
      query: (body) => ({ url: '/kidzone/checkin/manual', method: 'POST', body }),
      transformResponse: transformEnvelope<CheckInResult>,
      invalidatesTags: ['ActiveVisits', { type: 'Visit', id: 'LIST' }, 'Dashboard', 'Report', 'AuditLog'],
    }),

    // --------------------------------------------------------------- visits
    /**
     * The live gate board. Polled rather than pushed: a session timer only
     * needs to be right to the minute, and a 30-second poll is far simpler to
     * reason about than a socket that has to survive a tablet going to sleep.
     */
    listActiveVisits: build.query<ActiveVisit[], void>({
      query: () => '/kidzone/visits/active',
      transformResponse: transformEnvelope<ActiveVisit[]>,
      providesTags: ['ActiveVisits'],
    }),

    listVisits: build.query<Paginated<Visit>, VisitListQuery | void>({
      query: (params) => `/kidzone/visits${toQueryString(params ?? {})}`,
      transformResponse: transformList<Visit>,
      providesTags: (result) => listTags('Visit', result),
    }),

    getVisit: build.query<Visit, string>({
      query: (id) => `/kidzone/visits/${id}`,
      transformResponse: transformEnvelope<Visit>,
      providesTags: (_r, _e, id) => [{ type: 'Visit', id }],
    }),

    checkOut: build.mutation<Visit, { id: string; payments?: PaymentInput[] }>({
      query: ({ id, payments }) => ({
        url: `/kidzone/visits/${id}/checkout`,
        method: 'POST',
        body: payments?.length ? { payments } : {},
      }),
      transformResponse: transformEnvelope<Visit>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Visit', id },
        { type: 'Visit', id: 'LIST' },
        'ActiveVisits',
        'Closing',
        'Report',
        'Dashboard',
      ],
    }),
  }),
});

export const {
  useListPlansQuery,
  useGetPlanQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
  useCreateSaleMutation,
  useListSalesQuery,
  useGetSaleQuery,
  useVoidSaleMutation,
  useListMembershipsQuery,
  useGetMembershipQuery,
  useGetMembershipQrQuery,
  useReissueMembershipQrMutation,
  useRenewMembershipMutation,
  useCheckInLookupMutation,
  useSendOtpMutation,
  useVerifyOtpMutation,
  useCheckInQrMutation,
  useCheckInManualMutation,
  useListActiveVisitsQuery,
  useListVisitsQuery,
  useGetVisitQuery,
  useCheckOutMutation,
} = kidzoneApi;
