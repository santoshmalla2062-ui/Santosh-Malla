export interface NumericDraftOptions {
  allowDecimal?: boolean;
  allowNegative?: boolean;
}

export interface ParseNumericDraftOptions {
  emptyValue?: number;
  integer?: boolean;
  min?: number;
  max?: number;
}

/**
 * Sanitizes a user's live numeric text draft without forcing an empty string back to "0"
 * and while stripping redundant leading zeros (e.g. "01000" -> "1000", while keeping "0", "0.", "0.5").
 */
export function sanitizeNumericDraft(
  raw: string,
  options: NumericDraftOptions = {}
): string {
  const { allowDecimal = true, allowNegative = false } = options;
  if (!raw) return '';

  let cleaned = '';
  let hasDecimal = false;
  let hasSign = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch >= '0' && ch <= '9') {
      cleaned += ch;
    } else if (ch === '.' && allowDecimal && !hasDecimal) {
      hasDecimal = true;
      cleaned += '.';
    } else if (ch === '-' && allowNegative && !hasSign && cleaned.length === 0) {
      hasSign = true;
      cleaned += '-';
    }
  }

  if (!cleaned || cleaned === '-') return cleaned;

  const isNegative = cleaned.startsWith('-');
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;

  // Strip redundant leading zeros before digits (e.g. "01000" -> "1000", "00" -> "0", "00.5" -> "0.5")
  // Preserve "0", "0.", "0.5", "."
  const normalizedUnsigned = unsigned.replace(/^0+(?=\d)/, '');

  return isNegative ? `-${normalizedUnsigned}` : normalizedUnsigned;
}

/**
 * Parses a sanitized numeric draft into a finite number.
 * Returns `emptyValue` (default 0) when the draft is empty or an incomplete prefix like "-" or ".".
 */
export function parseNumericDraft(
  draft: string,
  options: ParseNumericDraftOptions = {}
): number {
  const { emptyValue = 0, integer = false, min, max } = options;
  if (!draft || draft === '-' || draft === '.' || draft === '-.') {
    return emptyValue;
  }

  const parsed = integer ? parseInt(draft, 10) : parseFloat(draft);
  if (!Number.isFinite(parsed)) {
    return emptyValue;
  }

  let result = parsed;
  if (min !== undefined && Number.isFinite(min) && result < min) {
    result = min;
  }
  if (max !== undefined && Number.isFinite(max) && result > max) {
    result = max;
  }
  return result;
}

export function formatNumericValue(
  value: number | '' | null | undefined,
  blankWhenZero = false
): string {
  if (value === '' || value === null || value === undefined || !Number.isFinite(value)) {
    return '';
  }
  if (blankWhenZero && value === 0) {
    return '';
  }
  return String(value);
}
