import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, TableSkeleton } from './page';
import type { PaginatedMeta } from '@/types/api';
import type { QueryError } from '@/app/api-error';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  /** Stable key; also the sort column when `sortable` is set. */
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Right-aligns the column. Use for money and counts. */
  numeric?: boolean;
  sortable?: boolean;
  className?: string;
  /** Hidden below the `sm` breakpoint, for columns that are nice-to-have. */
  hideOnMobile?: boolean;
  /**
   * Shown in a totals row under this column. Set per column rather than as one
   * spanning cell so it stays aligned when `hideOnMobile` columns drop out.
   */
  footer?: React.ReactNode;
}

interface DataTableProps<T> {
  columns: Array<Column<T>>;
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: QueryError;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  meta?: PaginatedMeta;
  onPageChange?: (page: number) => void;
  sort?: { column: string; order: 'asc' | 'desc' };
  onSortChange?: (column: string) => void;
  /** Rendered under the last row, e.g. a totals line. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * The list table used throughout the app.
 *
 * Deliberately not a headless table library: every list here is server-paged,
 * server-sorted and server-filtered, so the client never needs to own row
 * models, and a thin wrapper over the shadcn table is easier to read than a
 * configuration object that does the same thing.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  isFetching,
  error,
  onRetry,
  onRowClick,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  meta,
  onPageChange,
  sort,
  onSortChange,
  footer,
  className,
}: DataTableProps<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading) return <TableSkeleton columns={columns.length} />;

  const isEmpty = !rows || rows.length === 0;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-hidden rounded-lg border">
        <div className="relative overflow-x-auto">
          {/* A refetch dims the table rather than replacing it with a skeleton,
              so the numbers a user is reading do not vanish under them. */}
          <Table className={cn('transition-opacity', isFetching && 'opacity-60')}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      column.numeric && 'text-right',
                      column.hideOnMobile && 'hidden sm:table-cell',
                      column.className,
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(column.key)}
                        className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
                      >
                        {column.header}
                        {sort?.column === column.key ? (
                          sort.order === 'asc' ? (
                            <ArrowUp aria-hidden className="size-3.5" />
                          ) : (
                            <ArrowDown aria-hidden className="size-3.5" />
                          )
                        ) : (
                          // Faint until used, so the header reads as clickable.
                          <ArrowUpDown aria-hidden className="size-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {isEmpty ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && 'cursor-pointer')}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          column.numeric && 'text-right',
                          column.hideOnMobile && 'hidden sm:table-cell',
                          column.className,
                        )}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
              {footer}
            </TableBody>

            {!isEmpty && columns.some((column) => column.footer !== undefined) ? (
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.numeric && 'text-right',
                        column.hideOnMobile && 'hidden sm:table-cell',
                        column.className,
                      )}
                    >
                      {column.footer}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </div>
      </div>

      {meta && onPageChange && meta.totalPages > 1 ? <Pagination meta={meta} onPageChange={onPageChange} /> : null}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta: PaginatedMeta; onPageChange: (page: number) => void }) {
  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">
        Showing <span className="tabular font-medium">{first}</span>–
        <span className="tabular font-medium">{last}</span> of{' '}
        <span className="tabular font-medium">{meta.total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!meta.hasPreviousPage}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft /> Previous
        </Button>
        <span className="text-muted-foreground px-1 text-sm tabular">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
