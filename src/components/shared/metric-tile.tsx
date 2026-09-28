import { Card, CardContent } from '@/components/ui/card';
import { Money } from './money';
import { cn } from '@/lib/utils';
import type { ComparedMetric } from '@/types/api';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * A headline number with its period-on-period change.
 *
 * The API returns `{ current, previous, change }` for every summary metric, and
 * showing the change is the whole point: a revenue figure on its own does not
 * tell anyone whether today was good.
 *
 * `change: null` means the previous period was zero — there is no baseline, so
 * it says "new" rather than an infinite percentage.
 */
export function MetricTile({
  label,
  metric,
  money,
  emphasis,
  comparisonLabel = 'vs previous',
  /** Set when a rise is bad news, e.g. discounts or voids. */
  inverse,
  className,
}: {
  label: string;
  metric: ComparedMetric;
  money?: boolean;
  emphasis?: boolean;
  comparisonLabel?: string;
  inverse?: boolean;
  className?: string;
}) {
  const { current, change } = metric;

  const direction = change === null ? 'new' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  const good = direction === 'up' ? !inverse : direction === 'down' ? Boolean(inverse) : null;

  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  return (
    <Card className={cn(emphasis && 'border-primary/40', className)}>
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-xs">{label}</p>

        <p className={cn('tabular font-semibold', emphasis ? 'text-2xl' : 'text-xl')}>
          {money ? <Money value={current} /> : current.toLocaleString('en-US')}
        </p>

        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          {direction === 'new' ? (
            <span className="text-primary">No figure for the previous period</span>
          ) : (
            <>
              <Icon
                className={cn(
                  'size-3',
                  good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
                )}
              />
              <span
                className={cn(
                  'tabular font-medium',
                  good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
                )}
              >
                {change === 0 ? 'no change' : `${Math.abs(change ?? 0).toFixed(1)}%`}
              </span>
              <span>{comparisonLabel}</span>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
