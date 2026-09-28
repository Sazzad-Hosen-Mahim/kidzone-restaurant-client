import type { ApiEnvelope, Paginated, PaginatedMeta, ResponseMeta } from '@/types/api';

/**
 * Shared plumbing for endpoint definitions: unwrapping the envelope, turning a
 * list response into `{ items, meta }`, and building query strings without
 * sending `undefined` keys.
 */

export function transformEnvelope<T>(response: ApiEnvelope<T>): T {
  return response.data;
}

const EMPTY_META: PaginatedMeta = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

export function transformList<T>(response: ApiEnvelope<T[]>): Paginated<T> {
  return {
    items: response.data,
    meta: toPaginatedMeta(response.meta, response.data.length),
    ...(response.meta.summary ? { summary: response.meta.summary } : {}),
  };
}

function toPaginatedMeta(meta: ResponseMeta, itemCount: number): PaginatedMeta {
  if (meta.total === undefined) {
    // A non-paginated list still needs a meta block so callers can treat every
    // list identically.
    return { ...EMPTY_META, total: itemCount, totalPages: itemCount > 0 ? 1 : 0, limit: itemCount };
  }
  return {
    page: meta.page ?? 1,
    limit: meta.limit ?? 25,
    total: meta.total,
    totalPages: meta.totalPages ?? 0,
    hasNextPage: meta.hasNextPage ?? false,
    hasPreviousPage: meta.hasPreviousPage ?? false,
  };
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

/**
 * Builds a query string, dropping empty values.
 *
 * This matters more than it looks: the API runs `forbidNonWhitelisted`
 * validation, and sending `?status=` with an empty value is a 400 rather than
 * "no filter".
 */
export function toQueryString(params: QueryParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Tags every row of a list plus a LIST sentinel, the standard RTK Query shape. */
export function listTags<T extends { id: string }, Tag extends string>(
  tag: Tag,
  result: Paginated<T> | T[] | undefined,
) {
  const items = Array.isArray(result) ? result : (result?.items ?? []);
  return [
    ...items.map((item) => ({ type: tag, id: item.id }) as const),
    { type: tag, id: 'LIST' } as const,
  ];
}
