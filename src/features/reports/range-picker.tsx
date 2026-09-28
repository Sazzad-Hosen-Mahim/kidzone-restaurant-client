import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/use-auth';
import { RANGE_LABELS, formatDateRange, todayBusinessDate } from '@/lib/dates';
import { RANGE_KEYS, type RangeKey, type ReportPeriod } from '@/types/api';
import { Lock } from 'lucide-react';

export interface RangeState {
  range: RangeKey;
  from: string;
  to: string;
}

export const defaultRange: RangeState = { range: 'today', from: '', to: '' };

/** The query parameters for a report, with empty values dropped. */
export function toRangeQuery(state: RangeState) {
  return state.range === 'custom'
    ? { range: 'custom' as const, from: state.from || undefined, to: state.to || undefined }
    : { range: state.range };
}

export function isRangeReady(state: RangeState): boolean {
  return state.range !== 'custom' || (Boolean(state.from) && Boolean(state.to) && state.from <= state.to);
}

/**
 * Period selector.
 *
 * Staff are restricted to today server-side — a manager needs to know how the
 * shift is going, but a month of revenue history is the owner's business. The
 * control reflects that by disabling the other options rather than letting the
 * user pick one and receive a 403.
 */
export function RangePicker({
  value,
  onChange,
  period,
}: {
  value: RangeState;
  onChange: (value: RangeState) => void;
  period?: ReportPeriod;
}) {
  const { can } = useAuth();
  const restricted = !can.historicalReports;

  const picker = (
    <Select
      value={value.range}
      disabled={restricted}
      onValueChange={(next) => onChange({ ...value, range: next as RangeKey })}
    >
      <SelectTrigger className="w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGE_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {RANGE_LABELS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Period</Label>
        {restricted ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5">
                {picker}
                <Lock className="text-muted-foreground size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Your role sees today's figures. Ask an administrator for historical reports.
            </TooltipContent>
          </Tooltip>
        ) : (
          picker
        )}
      </div>

      {value.range === 'custom' && !restricted ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="range-from" className="text-xs">
              From
            </Label>
            <Input
              id="range-from"
              type="date"
              value={value.from}
              max={value.to || todayBusinessDate()}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
              className="w-[150px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="range-to" className="text-xs">
              To
            </Label>
            <Input
              id="range-to"
              type="date"
              value={value.to}
              min={value.from || undefined}
              max={todayBusinessDate()}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
              className="w-[150px]"
            />
          </div>
        </>
      ) : null}

      {/* The resolved period matters: "this month" means the 1st to today, and
          the comparison is against the same stretch of last month. */}
      {period?.from ? (
        <div className="text-muted-foreground pb-2 text-xs">
          <p className="tabular">{formatDateRange(period.from, period.to)}</p>
          <p className="tabular">
            vs {formatDateRange(period.previous.from, period.previous.to)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function ExportButtons({
  onExport,
  busy,
  disabled,
}: {
  onExport: (format: 'xlsx' | 'pdf') => void;
  busy: 'xlsx' | 'pdf' | null;
  disabled?: boolean;
}) {
  const { can } = useAuth();
  if (!can.exportReports) return null;

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy !== null}
        onClick={() => onExport('xlsx')}
      >
        {busy === 'xlsx' ? 'Preparing…' : 'Excel'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy !== null}
        onClick={() => onExport('pdf')}
      >
        {busy === 'pdf' ? 'Preparing…' : 'PDF'}
      </Button>
    </div>
  );
}
