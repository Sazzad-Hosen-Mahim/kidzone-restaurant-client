import { Money } from './money';
import type { SalesSummary } from '@/types/api';

/**
 * The two halves of a sales/orders totals row: the label goes under the first
 * column, the amount under the Total column.
 *
 * Voided rows never count toward the total — a void is a reversal. The one
 * exception is a list filtered to voided rows only, where the voided amount
 * is the figure being asked for.
 */
function onlyVoided(summary: SalesSummary): boolean {
  return summary.count === 0 && summary.voidedCount > 0;
}

export function SalesSummaryLabel({ summary, noun }: { summary: SalesSummary | undefined; noun: string }) {
  if (!summary) return null;

  if (onlyVoided(summary)) {
    return (
      <div>
        <p className="font-semibold">Voided total</p>
        <p className="text-muted-foreground tabular text-xs font-normal">
          {summary.voidedCount} {plural(noun, summary.voidedCount)}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="font-semibold">Total</p>
      {/* Wraps rather than widening the first column for every row above it. */}
      <p className="text-muted-foreground tabular text-xs font-normal whitespace-normal">
        {summary.count} {plural(noun, summary.count)}
        {summary.voidedCount > 0 ? (
          <>
            {' '}
            · {summary.voidedCount} voided (<Money value={summary.voidedAmount} />) not included
          </>
        ) : null}
      </p>
    </div>
  );
}

export function SalesSummaryTotal({ summary }: { summary: SalesSummary | undefined }) {
  if (!summary) return null;
  return (
    <Money
      value={onlyVoided(summary) ? summary.voidedAmount : summary.totalAmount}
      className="text-base font-semibold"
    />
  );
}

function plural(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}
