import { api } from '@/app/api';
import { listTags, transformEnvelope, transformList, toQueryString, type QueryParams } from '@/app/query-helpers';
import type {
  AuditLogEntry,
  Paginated,
  Role,
  SettingDescriptor,
  Settings,
  SmsLogEntry,
  SmsStatus,
  SmsType,
  User,
} from '@/types/api';

export interface UserListQuery extends QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface CreateUserRequest {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: Role;
}

export type UpdateUserRequest = Partial<Omit<CreateUserRequest, 'password'>> & { isActive?: boolean };

export interface AuditQuery extends QueryParams {
  page?: number;
  limit?: number;
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface SmsLogQuery extends QueryParams {
  page?: number;
  limit?: number;
  status?: SmsStatus;
  type?: SmsType;
  search?: string;
}

export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    // ---------------------------------------------------------------- users
    listUsers: build.query<Paginated<User>, UserListQuery | void>({
      query: (params) => `/users${toQueryString(params ?? {})}`,
      transformResponse: transformList<User>,
      providesTags: (result) => listTags('User', result),
    }),

    getUser: build.query<User, string>({
      query: (id) => `/users/${id}`,
      transformResponse: transformEnvelope<User>,
      providesTags: (_r, _e, id) => [{ type: 'User', id }],
    }),

    createUser: build.mutation<User, CreateUserRequest>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      transformResponse: transformEnvelope<User>,
      invalidatesTags: [{ type: 'User', id: 'LIST' }],
    }),

    updateUser: build.mutation<User, { id: string; body: UpdateUserRequest }>({
      query: ({ id, body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      transformResponse: transformEnvelope<User>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'User', id }, { type: 'User', id: 'LIST' }],
    }),

    deactivateUser: build.mutation<User, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      transformResponse: transformEnvelope<User>,
      invalidatesTags: (_r, _e, id) => [{ type: 'User', id }, { type: 'User', id: 'LIST' }],
    }),

    /** Returns `generatedPassword` only when the server generated one. */
    resetUserPassword: build.mutation<{ generatedPassword?: string }, { id: string; newPassword?: string }>({
      query: ({ id, newPassword }) => ({
        url: `/users/${id}/reset-password`,
        method: 'POST',
        body: newPassword ? { newPassword } : {},
      }),
      transformResponse: transformEnvelope<{ generatedPassword?: string }>,
      invalidatesTags: (_r, _e, { id }) => [{ type: 'User', id }],
    }),

    // ------------------------------------------------------------- settings
    getSettings: build.query<Settings, void>({
      query: () => '/settings',
      transformResponse: transformEnvelope<Settings>,
      providesTags: ['Settings'],
    }),

    getSettingsSchema: build.query<SettingDescriptor[], void>({
      query: () => '/settings/schema',
      transformResponse: transformEnvelope<SettingDescriptor[]>,
    }),

    updateSettings: build.mutation<Settings, Partial<Settings>>({
      query: (body) => ({ url: '/settings', method: 'PATCH', body }),
      transformResponse: transformEnvelope<Settings>,
      // VAT, service charge and the discount cap feed the POS pricing preview
      // and the reports, so a settings change has to invalidate both.
      invalidatesTags: ['Settings', 'Report', 'Dashboard', 'MenuBoard'],
    }),

    // ---------------------------------------------------------------- audit
    listAuditLogs: build.query<Paginated<AuditLogEntry>, AuditQuery | void>({
      query: (params) => `/audit-logs${toQueryString(params ?? {})}`,
      transformResponse: transformList<AuditLogEntry>,
      providesTags: ['AuditLog'],
    }),

    // ----------------------------------------------------------------- jobs
    listSmsLog: build.query<Paginated<SmsLogEntry>, SmsLogQuery | void>({
      query: (params) => `/jobs/sms-log${toQueryString(params ?? {})}`,
      transformResponse: transformList<SmsLogEntry>,
      providesTags: ['SmsLog'],
    }),

    runExpireMemberships: build.mutation<{ expired: number }, void>({
      query: () => ({ url: '/jobs/run/expire-memberships', method: 'POST' }),
      transformResponse: transformEnvelope<{ expired: number }>,
      invalidatesTags: ['Membership', 'Report', 'Dashboard'],
    }),

    runExpiryReminders: build.mutation<{ queued: number; skipped: number }, void>({
      query: () => ({ url: '/jobs/run/expiry-reminders', method: 'POST' }),
      transformResponse: transformEnvelope<{ queued: number; skipped: number }>,
      invalidatesTags: ['SmsLog'],
    }),

    runCleanup: build.mutation<{ otpCodes: number; refreshTokens: number }, void>({
      query: () => ({ url: '/jobs/run/cleanup', method: 'POST' }),
      transformResponse: transformEnvelope<{ otpCodes: number; refreshTokens: number }>,
    }),

    runBackup: build.mutation<
      { file: string; sizeBytes: number; durationMs: number; uploaded: boolean; prunedLocal: string[] },
      void
    >({
      query: () => ({ url: '/jobs/run/backup', method: 'POST' }),
      transformResponse:
        transformEnvelope<{
          file: string;
          sizeBytes: number;
          durationMs: number;
          uploaded: boolean;
          prunedLocal: string[];
        }>,
      invalidatesTags: ['AuditLog'],
    }),
  }),
});

export const {
  useListUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useResetUserPasswordMutation,
  useGetSettingsQuery,
  useGetSettingsSchemaQuery,
  useUpdateSettingsMutation,
  useListAuditLogsQuery,
  useListSmsLogQuery,
  useRunExpireMembershipsMutation,
  useRunExpiryRemindersMutation,
  useRunCleanupMutation,
  useRunBackupMutation,
} = adminApi;
