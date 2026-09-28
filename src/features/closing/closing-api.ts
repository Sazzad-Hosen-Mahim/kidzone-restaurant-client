import { api } from '@/app/api';
import { listTags, transformEnvelope, transformList, toQueryString, type QueryParams } from '@/app/query-helpers';
import type { ClosingPreview, DayClosing, Paginated, Section } from '@/types/api';

/** The path segment the API expects. */
export type SectionSlug = 'kidzone' | 'restaurant';

export function sectionSlug(section: Section): SectionSlug {
  return section === 'KIDZONE' ? 'kidzone' : 'restaurant';
}

export interface ClosingListQuery extends QueryParams {
  page?: number;
  limit?: number;
  section?: Section;
  from?: string;
  to?: string;
  onlyDifferences?: boolean;
}

export const closingApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** What the till should hold, computed from payment rows. */
    getClosingPreview: build.query<ClosingPreview, { section: SectionSlug; date?: string }>({
      query: ({ section, date }) => `/closing/${section}/preview${toQueryString({ date })}`,
      transformResponse: transformEnvelope<ClosingPreview>,
      providesTags: ['Closing'],
    }),

    closeDay: build.mutation<
      DayClosing,
      { section: SectionSlug; date?: string; countedCash: number; notes?: string }
    >({
      query: ({ section, ...body }) => ({ url: `/closing/${section}`, method: 'POST', body }),
      transformResponse: transformEnvelope<DayClosing>,
      invalidatesTags: ['Closing', 'AuditLog', 'Dashboard'],
    }),

    reopenDay: build.mutation<DayClosing, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/closing/${id}/reopen`, method: 'POST', body: { reason } }),
      transformResponse: transformEnvelope<DayClosing>,
      invalidatesTags: ['Closing', 'AuditLog'],
    }),

    listClosings: build.query<Paginated<DayClosing>, ClosingListQuery | void>({
      query: (params) => `/closing${toQueryString(params ?? {})}`,
      transformResponse: transformList<DayClosing>,
      providesTags: (result) => listTags('Closing', result),
    }),
  }),
});

export const {
  useGetClosingPreviewQuery,
  useCloseDayMutation,
  useReopenDayMutation,
  useListClosingsQuery,
} = closingApi;
