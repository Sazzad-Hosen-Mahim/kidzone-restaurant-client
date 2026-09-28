import { formatTaka } from '@/lib/money';

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/**
 * A chart tooltip that speaks the app's money format.
 *
 * Recharts' default renders a bare number, which for a revenue chart plotted in
 * taka is genuinely ambiguous — is that poisha? taka? — so every money chart
 * passes `money` and gets ৳ with proper grouping.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  money,
  suffix,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  /** Values are taka (charts plot taka, not poisha). */
  money?: boolean;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-lg border p-2.5 text-xs shadow-md">
      {label !== undefined ? <p className="mb-1.5 font-medium">{label}</p> : null}

      <div className="space-y-1">
        {payload.map((entry, index) => {
          const numeric = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                {entry.color ? (
                  <span className="size-2 rounded-full" style={{ background: entry.color }} />
                ) : null}
                <span className="text-muted-foreground">{entry.name ?? entry.dataKey}</span>
              </span>
              <span className="tabular font-medium">
                {money ? formatTaka(Math.round(numeric * 100)) : numeric.toLocaleString('en-US')}
                {suffix ?? ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
