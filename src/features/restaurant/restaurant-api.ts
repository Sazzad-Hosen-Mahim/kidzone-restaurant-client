import { api } from '@/app/api';
import { listTags, transformEnvelope, transformList, toQueryString, type QueryParams } from '@/app/query-helpers';
import type { MenuBoard, MenuCategory, MenuItem, Order, OrderStatus, Paginated, PaymentInput } from '@/types/api';

export interface CreateCategoryRequest {
  name: string;
  sortOrder?: number;
}

export type UpdateCategoryRequest = Partial<CreateCategoryRequest> & { isActive?: boolean };

export interface CreateMenuItemRequest {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  sortOrder?: number;
}

export type UpdateMenuItemRequest = Partial<CreateMenuItemRequest> & {
  isAvailable?: boolean;
  isActive?: boolean;
};

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  note?: string;
}

export interface CreateOrderRequest {
  items: OrderItemInput[];
  customerPhone?: string;
  customerName?: string;
  tableNo?: string;
  discountAmount?: number;
  discountReason?: string;
  payments: PaymentInput[];
}

export interface OrderListQuery extends QueryParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  status?: OrderStatus;
  cashierId?: string;
  customerId?: string;
  tableNo?: string;
  search?: string;
}

export interface MenuItemListQuery extends QueryParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  search?: string;
}

export const restaurantApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ----------------------------------------------------------------- menu
    getMenuBoard: build.query<MenuBoard, void>({
      query: () => '/restaurant/menu',
      transformResponse: transformEnvelope<MenuBoard>,
      providesTags: ['MenuBoard'],
    }),

    listCategories: build.query<MenuCategory[], void>({
      query: () => '/restaurant/categories',
      transformResponse: transformEnvelope<MenuCategory[]>,
      providesTags: (result) => listTags('MenuCategory', result),
    }),

    createCategory: build.mutation<MenuCategory, CreateCategoryRequest>({
      query: (body) => ({ url: '/restaurant/categories', method: 'POST', body }),
      transformResponse: transformEnvelope<MenuCategory>,
      invalidatesTags: [{ type: 'MenuCategory', id: 'LIST' }, 'MenuBoard'],
    }),

    updateCategory: build.mutation<MenuCategory, { id: string; body: UpdateCategoryRequest }>({
      query: ({ id, body }) => ({ url: `/restaurant/categories/${id}`, method: 'PATCH', body }),
      transformResponse: transformEnvelope<MenuCategory>,
      invalidatesTags: [{ type: 'MenuCategory', id: 'LIST' }, 'MenuBoard'],
    }),

    deleteCategory: build.mutation<MenuCategory, string>({
      query: (id) => ({ url: `/restaurant/categories/${id}`, method: 'DELETE' }),
      transformResponse: transformEnvelope<MenuCategory>,
      invalidatesTags: [{ type: 'MenuCategory', id: 'LIST' }, 'MenuBoard'],
    }),

    listMenuItems: build.query<Paginated<MenuItem>, MenuItemListQuery | void>({
      query: (params) => `/restaurant/menu-items${toQueryString(params ?? { limit: 100 })}`,
      transformResponse: transformList<MenuItem>,
      providesTags: (result) => listTags('MenuItem', result),
    }),

    getMenuItem: build.query<MenuItem, string>({
      query: (id) => `/restaurant/menu-items/${id}`,
      transformResponse: transformEnvelope<MenuItem>,
      providesTags: (_r, _e, id) => [{ type: 'MenuItem', id }],
    }),

    createMenuItem: build.mutation<MenuItem, CreateMenuItemRequest>({
      query: (body) => ({ url: '/restaurant/menu-items', method: 'POST', body }),
      transformResponse: transformEnvelope<MenuItem>,
      invalidatesTags: [{ type: 'MenuItem', id: 'LIST' }, 'MenuBoard'],
    }),

    updateMenuItem: build.mutation<MenuItem, { id: string; body: UpdateMenuItemRequest }>({
      query: ({ id, body }) => ({ url: `/restaurant/menu-items/${id}`, method: 'PATCH', body }),
      transformResponse: transformEnvelope<MenuItem>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'MenuItem', id }, { type: 'MenuItem', id: 'LIST' }, 'MenuBoard'],
    }),

    /**
     * The one menu change a cashier may make. Optimistic, because "86 the
     * biryani" is a decision made mid-service and the board should reflect it
     * the instant it is tapped.
     */
    setItemAvailability: build.mutation<MenuItem, { id: string; isAvailable: boolean }>({
      query: ({ id, isAvailable }) => ({
        url: `/restaurant/menu-items/${id}/availability`,
        method: 'PATCH',
        body: { isAvailable },
      }),
      transformResponse: transformEnvelope<MenuItem>,
      async onQueryStarted({ id, isAvailable }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          restaurantApi.util.updateQueryData('listMenuItems', { limit: 100 }, (draft) => {
            const item = draft.items.find((candidate) => candidate.id === id);
            if (item) item.isAvailable = isAvailable;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_r, _e, { id }) => [{ type: 'MenuItem', id }, 'MenuBoard'],
    }),

    deleteMenuItem: build.mutation<MenuItem, string>({
      query: (id) => ({ url: `/restaurant/menu-items/${id}`, method: 'DELETE' }),
      transformResponse: transformEnvelope<MenuItem>,
      invalidatesTags: [{ type: 'MenuItem', id: 'LIST' }, 'MenuBoard'],
    }),

    // --------------------------------------------------------------- orders
    createOrder: build.mutation<Order, CreateOrderRequest>({
      query: (body) => ({ url: '/restaurant/orders', method: 'POST', body }),
      transformResponse: transformEnvelope<Order>,
      invalidatesTags: [
        { type: 'Order', id: 'LIST' },
        { type: 'Customer', id: 'LIST' },
        'Closing',
        'Report',
        'Dashboard',
      ],
    }),

    listOrders: build.query<Paginated<Order>, OrderListQuery | void>({
      query: (params) => `/restaurant/orders${toQueryString(params ?? {})}`,
      transformResponse: transformList<Order>,
      providesTags: (result) => listTags('Order', result),
    }),

    getOrder: build.query<Order, string>({
      query: (id) => `/restaurant/orders/${id}`,
      transformResponse: transformEnvelope<Order>,
      providesTags: (_r, _e, id) => [{ type: 'Order', id }],
    }),

    voidOrder: build.mutation<Order, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/restaurant/orders/${id}/void`, method: 'POST', body: { reason } }),
      transformResponse: transformEnvelope<Order>,
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
        'Closing',
        'Report',
        'Dashboard',
        'AuditLog',
      ],
    }),
  }),
});

export const {
  useGetMenuBoardQuery,
  useListCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useListMenuItemsQuery,
  useGetMenuItemQuery,
  useCreateMenuItemMutation,
  useUpdateMenuItemMutation,
  useSetItemAvailabilityMutation,
  useDeleteMenuItemMutation,
  useCreateOrderMutation,
  useListOrdersQuery,
  useGetOrderQuery,
  useVoidOrderMutation,
} = restaurantApi;
