import { cn } from '@/lib/utils';
import { formatTaka, formatTakaCompact, type FormatTakaOptions } from '@/lib/money';

interface MoneyProps extends FormatTakaOptions {
  /** Poisha. Always poisha. */
  value: number | null | undefined;
  className?: string;
  /** Lakh/crore shorthand, for dashboard tiles where space is tight. */
  compact?: boolean;
  /** Colour a negative amount red and a positive one green. For differences. */
  colored?: boolean;
}

/**
 * The only way money reaches the screen.
 *
 * Tabular figures are not cosmetic here: in a column of amounts, proportional
 * digits make magnitudes genuinely hard to compare at a glance, which is most
 * of what a till screen is for.
 */
export function Money({ value, className, compact, colored, ...options }: MoneyProps) {
  const text = compact && value !== null && value !== undefined ? formatTakaCompact(value) : formatTaka(value, options);

  return (
    <span
      className={cn(
        'tabular',
        colored && value !== null && value !== undefined && value !== 0
          ? value > 0
            ? 'text-success'
            : 'text-destructive'
          : undefined,
        className,
      )}
    >
      {text}
    </span>
  );
}
