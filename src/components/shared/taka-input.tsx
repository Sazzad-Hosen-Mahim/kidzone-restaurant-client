import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { parseTakaInput, poishaToTakaString } from '@/lib/money';

interface TakaInputProps {
  /** Poisha. */
  value: number;
  onChange: (poisha: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  autoFocus?: boolean;
}

/**
 * A money field that talks poisha to its parent and taka to the user.
 *
 * While the field has focus it shows exactly what was typed, so "12." or an
 * empty box is not rewritten under the cursor. The rest of the time it shows
 * the parent's value formatted — which is how a "set exact amount" button, or
 * a total that changed elsewhere, appears here immediately.
 *
 * The draft is *derived* during render rather than synced by an effect: an
 * effect would re-render a second time on every keystroke and on every change
 * of the total behind it.
 */
export function TakaInput({
  value,
  onChange,
  placeholder = '0.00',
  className,
  disabled,
  id,
  autoFocus,
  ...rest
}: TakaInputProps) {
  const generatedId = useId();

  // null means "not being edited" — show the parent's value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value ? poishaToTakaString(value) : '');

  return (
    <div className={cn('relative', className)}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        ৳
      </span>
      <Input
        id={id ?? generatedId}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        className="tabular pl-7 text-right"
        value={text}
        onFocus={() => setDraft(value ? poishaToTakaString(value) : '')}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const next = event.target.value;
          // Allow the in-between states a person types through.
          if (next !== '' && !/^\d*\.?\d{0,2}$/.test(next.replace(/,/g, ''))) return;
          setDraft(next);
          onChange(parseTakaInput(next) ?? 0);
        }}
        {...rest}
      />
    </div>
  );
}
