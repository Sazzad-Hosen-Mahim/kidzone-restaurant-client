import { api } from '@/app/api';
import { transformEnvelope } from '@/app/query-helpers';
import type { ReceiptDocument } from '@/types/api';

export type ReceiptKind = 'kidzone' | 'restaurant' | 'gatepass';

export const receiptsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getReceipt: build.query<ReceiptDocument, { kind: ReceiptKind; id: string }>({
      query: ({ kind, id }) => `/receipts/${kind}/${id}`,
      transformResponse: transformEnvelope<ReceiptDocument>,
      // A receipt is a frozen document built entirely from snapshots, so it
      // never needs refetching once loaded.
      keepUnusedDataFor: 600,
    }),
  }),
});

export const { useGetReceiptQuery, useLazyGetReceiptQuery } = receiptsApi;
