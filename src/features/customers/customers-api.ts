import { api } from '@/app/api';
import { listTags, transformEnvelope, transformList, toQueryString, type QueryParams } from '@/app/query-helpers';
import type { Child, Customer, CustomerDetail, Gender, Paginated, RedactedChild } from '@/types/api';

export interface CustomerListQuery extends QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type UpdateCustomerRequest = Partial<CreateCustomerRequest> & { isActive?: boolean };

export interface CreateChildRequest {
  name: string;
  dateOfBirth: string;
  gender?: Gender;
  medicalNotes?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export type UpdateChildRequest = Partial<CreateChildRequest> & { isActive?: boolean };

export const customersApi = api.injectEndpoints({
  endpoints: (build) => ({
    listCustomers: build.query<Paginated<Customer>, CustomerListQuery | void>({
      query: (params) => `/customers${toQueryString(params ?? {})}`,
      transformResponse: transformList<Customer>,
      providesTags: (result) => listTags('Customer', result),
    }),

    /**
     * One customer with their history. What comes back depends on the caller's
     * role: a restaurant cashier gets the guardian and their orders, with no
     * `kidZone` block and no child records at all.
     */
    getCustomer: build.query<CustomerDetail, string>({
      query: (id) => `/customers/${id}`,
      transformResponse: transformEnvelope<CustomerDetail>,
      providesTags: (_r, _e, id) => [{ type: 'Customer', id }],
    }),

    createCustomer: build.mutation<Customer, CreateCustomerRequest>({
      query: (body) => ({ url: '/customers', method: 'POST', body }),
      transformResponse: transformEnvelope<Customer>,
      invalidatesTags: [{ type: 'Customer', id: 'LIST' }],
    }),

    updateCustomer: build.mutation<Customer, { id: string; body: UpdateCustomerRequest }>({
      query: ({ id, body }) => ({ url: `/customers/${id}`, method: 'PATCH', body }),
      transformResponse: transformEnvelope<Customer>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Customer', id }, { type: 'Customer', id: 'LIST' }],
    }),

    deactivateCustomer: build.mutation<Customer, string>({
      query: (id) => ({ url: `/customers/${id}`, method: 'DELETE' }),
      transformResponse: transformEnvelope<Customer>,
      invalidatesTags: (_r, _e, id) => [{ type: 'Customer', id }, { type: 'Customer', id: 'LIST' }],
    }),

    listChildren: build.query<Array<Child | RedactedChild>, string>({
      query: (customerId) => `/customers/${customerId}/children`,
      transformResponse: transformEnvelope<Array<Child | RedactedChild>>,
      providesTags: (_r, _e, customerId) => [{ type: 'Child', id: customerId }],
    }),

    createChild: build.mutation<Child, { customerId: string; body: CreateChildRequest }>({
      query: ({ customerId, body }) => ({ url: `/customers/${customerId}/children`, method: 'POST', body }),
      transformResponse: transformEnvelope<Child>,
      invalidatesTags: (_r, _e, { customerId }) => [
        { type: 'Child', id: customerId },
        { type: 'Customer', id: customerId },
      ],
    }),

    updateChild: build.mutation<Child, { customerId: string; childId: string; body: UpdateChildRequest }>({
      query: ({ customerId, childId, body }) => ({
        url: `/customers/${customerId}/children/${childId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: transformEnvelope<Child>,
      invalidatesTags: (_r, _e, { customerId }) => [
        { type: 'Child', id: customerId },
        { type: 'Customer', id: customerId },
      ],
    }),

    deactivateChild: build.mutation<Child, { customerId: string; childId: string }>({
      query: ({ customerId, childId }) => ({
        url: `/customers/${customerId}/children/${childId}`,
        method: 'DELETE',
      }),
      transformResponse: transformEnvelope<Child>,
      invalidatesTags: (_r, _e, { customerId }) => [
        { type: 'Child', id: customerId },
        { type: 'Customer', id: customerId },
      ],
    }),
  }),
});

export const {
  useListCustomersQuery,
  useLazyListCustomersQuery,
  useGetCustomerQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeactivateCustomerMutation,
  useListChildrenQuery,
  useCreateChildMutation,
  useUpdateChildMutation,
  useDeactivateChildMutation,
} = customersApi;
