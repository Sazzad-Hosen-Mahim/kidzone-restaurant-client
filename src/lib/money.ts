/**
 * Money.
 *
 * The API speaks **poisha** (1 BDT = 100 poisha) as integers, and so does this
 * app internally. Taka only ever appears at the edges: rendered for a human, or
 * parsed from something a human typed. Nothing in between holds a float.
 */

/** Round half away from zero, matching the backend exactly. */
export function roundPoisha(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Cannot round a non-finite amount: ${value}`);
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** 25000 -> "250.00" */
export function poishaToTakaString(poisha: number): string {
  const negative = poisha < 0;
  const abs = Math.abs(Math.trunc(poisha));
  return `${negative ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Poisha as a decimal number of taka — for charts, never for arithmetic. */
export function poishaToTaka(poisha: number): number {
  return poisha / 100;
}

/** 250.5 -> 25050 */
export function takaToPoisha(taka: number): number {
  return roundPoisha(taka * 100);
}

/**
 * Bangladeshi digit grouping: the last three digits, then pairs.
 * 1234567 -> "12,34,567"
 */
function groupBdDigits(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

export interface FormatTakaOptions {
  /** Prefix with the ৳ sign. Default true. */
  symbol?: boolean;
  /** Show the poisha part. Default true. */
  decimals?: boolean;
  /** Prefix a non-negative amount with `+`. Useful for a cash difference. */
  signed?: boolean;
}

/**
 * The one function that turns poisha into something a person reads.
 * 123456700 -> "৳12,34,567.00"
 */
export function formatTaka(poisha: number | null | undefined, options: FormatTakaOptions = {}): string {
  const { symbol = true, decimals = true, signed = false } = options;
  if (poisha === null || poisha === undefined || !Number.isFinite(poisha)) return symbol ? '৳—' : '—';

  const negative = poisha < 0;
  const [whole, fraction] = poishaToTakaString(Math.abs(poisha)).split('.');
  const grouped = groupBdDigits(whole);

  const sign = negative ? '-' : signed ? '+' : '';
  const body = decimals ? `${grouped}.${fraction}` : grouped;

  return `${sign}${symbol ? '৳' : ''}${body}`;
}

/** Compact form for dashboard tiles: ৳12.3L, ৳4.5K. */
export function formatTakaCompact(poisha: number): string {
  const taka = Math.abs(poisha) / 100;
  const sign = poisha < 0 ? '-' : '';

  // Lakh and crore are how amounts are actually spoken here.
  if (taka >= 10_000_000) return `${sign}৳${(taka / 10_000_000).toFixed(2)}Cr`;
  if (taka >= 100_000) return `${sign}৳${(taka / 100_000).toFixed(2)}L`;
  if (taka >= 1_000) return `${sign}৳${(taka / 1_000).toFixed(1)}K`;
  return formatTaka(poisha);
}

/**
 * Parses what someone typed into a taka field, returning poisha.
 * Accepts "250", "250.5", "1,250.75", "৳250". Returns null if unparseable.
 */
export function parseTakaInput(input: string): number | null {
  const cleaned = input.replace(/[৳,\s]/g, '').trim();
  if (cleaned === '' || cleaned === '-') return null;
  if (!/^-?\d*\.?\d{0,2}$/.test(cleaned)) return null;
  const taka = Number(cleaned);
  return Number.isFinite(taka) ? takaToPoisha(taka) : null;
}

export function sumPoisha(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * The percentage a discount represents, to one decimal.
 * Display only — the server does the authoritative limit check in exact
 * integer arithmetic, because 10.01% must fail a 10% cap even though it
 * renders as "10%".
 */
export function discountPercent(subtotal: number, discountAmount: number): number {
  if (subtotal <= 0) return discountAmount > 0 ? 100 : 0;
  return Math.round((discountAmount / subtotal) * 1000) / 10;
}

/**
 * The restaurant bill, computed exactly as the backend does, for live preview
 * while the cashier is still building the order.
 *
 * Order of operations: subtotal → discount → service charge → VAT, each
 * rounded once. The server recomputes all of this from its own prices; this is
 * a preview, and the payment step sends only the tendered amounts.
 */
export function priceOrder(input: {
  lines: Array<{ unitPrice: number; quantity: number }>;
  discountAmount?: number;
  serviceChargePercent: number;
  vatPercent: number;
}): {
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  serviceChargeAmount: number;
  vatAmount: number;
  totalAmount: number;
} {
  const subtotal = sumPoisha(input.lines.map((line) => line.unitPrice * line.quantity));
  const discountAmount = Math.min(input.discountAmount ?? 0, subtotal);
  const taxableBase = subtotal - discountAmount;
  const serviceChargeAmount = roundPoisha((taxableBase * input.serviceChargePercent) / 100);
  const vatAmount = roundPoisha(((taxableBase + serviceChargeAmount) * input.vatPercent) / 100);

  return {
    subtotal,
    discountAmount,
    taxableBase,
    serviceChargeAmount,
    vatAmount,
    totalAmount: taxableBase + serviceChargeAmount + vatAmount,
  };
}
