/**
 * Bangladeshi mobile numbers.
 *
 * The API accepts any commonly typed form and always returns E.164
 * (`+8801XXXXXXXXX`). This module mirrors its validation so a cashier gets an
 * inline error while typing rather than a round trip, and renders the local
 * form (`01712-345678`) because that is how a number is read aloud here.
 */

export const BD_MOBILE_E164 = /^\+8801[3-9]\d{8}$/;

/** Normalises to E.164, or null if it is not a valid Bangladeshi mobile. */
export function normalizeBdPhone(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;

  let digits = input.trim().replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('00880')) digits = digits.slice(5);
  else if (digits.startsWith('880')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  const candidate = `+880${digits}`;
  return BD_MOBILE_E164.test(candidate) ? candidate : null;
}

export function isValidBdPhone(input: string | null | undefined): boolean {
  return normalizeBdPhone(input) !== null;
}

/** `+8801712345678` -> `01712-345678`. Falls back to the input if unparseable. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const normalized = normalizeBdPhone(phone);
  if (!normalized) return phone;
  const national = `0${normalized.slice(4)}`;
  return `${national.slice(0, 5)}-${national.slice(5)}`;
}

/** A `tel:` href, which matters on the tablet the floor staff actually use. */
export function telHref(phone: string | null | undefined): string | undefined {
  const normalized = normalizeBdPhone(phone);
  return normalized ? `tel:${normalized}` : undefined;
}

export const PHONE_HELP = 'e.g. 01712345678';
export const PHONE_ERROR = 'Enter a valid Bangladeshi mobile number';
