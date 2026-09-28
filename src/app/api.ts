import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './base-query';

/**
 * The single RTK Query API slice. Every endpoint is injected from a feature
 * module so that each area of the app owns its own queries while sharing one
 * cache, one base query and one set of tags.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'User',
    'Settings',
    'AuditLog',
    'SmsLog',
    'Customer',
    'Child',
    'Plan',
    'KidZoneSale',
    'Membership',
    'Visit',
    'ActiveVisits',
    'MenuCategory',
    'MenuItem',
    'MenuBoard',
    'Order',
    'Closing',
    'Report',
    'Dashboard',
  ],
  // The live boards refetch on their own timers; everything else is
  // conservative, because a POS on a slow connection should not re-query the
  // menu every time the cashier alt-tabs.
  refetchOnMountOrArgChange: 30,
  refetchOnReconnect: true,
  endpoints: () => ({}),
});
