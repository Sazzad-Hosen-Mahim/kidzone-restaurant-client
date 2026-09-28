import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Search, X } from 'lucide-react';

/** A row of list filters that wraps sensibly on a narrow screen. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-end gap-2', className)}>{children}</div>;
}

export function SearchFilter({
  value,
  onChange,
  placeholder = 'Search…',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative min-w-[200px] flex-1', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 p-1"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * A from/to pair of business dates.
 *
 * Native date inputs, deliberately: staff on a tablet get the platform picker
 * they already know, and the value is a `YYYY-MM-DD` string, which is exactly
 * what the API wants — no parsing or timezone conversion in between.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  disabled,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="filter-from" className="text-xs">
          From
        </Label>
        <Input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => onChange({ from: event.target.value, to })}
          disabled={disabled}
          className="w-[150px]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-to" className="text-xs">
          To
        </Label>
        <Input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onChange({ from, to: event.target.value })}
          disabled={disabled}
          className="w-[150px]"
        />
      </div>
    </>
  );
}

/** A period filter: a month/year shortcut plus the from/to dates it fills in. */
export interface PeriodValue {
  year?: string;
  /** `01`–`12`. Only ever set together with `year`. */
  month?: string;
  from: string;
  to: string;
}

export const EMPTY_PERIOD: PeriodValue = { from: '', to: '' };

export function hasPeriod(period: PeriodValue): boolean {
  return Boolean(period.year || period.from || period.to);
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: format(new Date(2000, i, 1), 'MMMM'),
}));

/** The first and last business date of a year, or of one month in it. */
function periodRange(year: string, month?: string): { from: string; to: string } {
  if (!month) return { from: `${year}-01-01`, to: `${year}-12-31` };
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, '0')}` };
}

/**
 * Year and month pickers alongside the from/to dates.
 *
 * Month and year are shortcuts, not a second filter: choosing one writes the
 * matching dates into From/To, so the API still only sees `from`/`to` and the
 * inputs always show exactly what is being filtered. Editing a date by hand
 * clears the shortcut, since the range no longer is "that month".
 */
export function PeriodFilter({ value, onChange }: { value: PeriodValue; onChange: (value: PeriodValue) => void }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  if (value.year && !years.includes(value.year)) years.push(value.year);

  return (
    <>
      <SelectFilter
        label="Year"
        value={value.year}
        onChange={(year) =>
          onChange(year ? { year, month: value.month, ...periodRange(year, value.month) } : EMPTY_PERIOD)
        }
        options={years.map((year) => ({ value: year, label: year }))}
        triggerClassName="w-[110px]"
      />
      <SelectFilter
        label="Month"
        value={value.month}
        onChange={(month) => {
          // A month on its own means that month this year.
          const year = value.year ?? String(currentYear);
          onChange({ year, month, ...periodRange(year, month) });
        }}
        options={MONTH_OPTIONS}
        triggerClassName="w-[140px]"
      />
      <DateRangeFilter from={value.from} to={value.to} onChange={(range) => onChange(range)} />
    </>
  );
}

export function SelectFilter<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
  className,
  triggerClassName,
}: {
  label: string;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: Array<{ value: T; label: string }>;
  allLabel?: string;
  className?: string;
  triggerClassName?: string;
}) {
  const ALL = '__all__';

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">{label}</Label>
      <Select
        value={value ?? ALL}
        onValueChange={(next) => onChange(next === ALL ? undefined : (next as T))}
      >
        <SelectTrigger className={cn('w-[160px]', triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ClearFilters({ onClear, show }: { onClear: () => void; show: boolean }) {
  if (!show) return null;
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClear}>
      <X /> Clear filters
    </Button>
  );
}
