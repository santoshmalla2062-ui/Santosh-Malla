import React, { useEffect, useRef, useState } from 'react';
import {
  formatNumericValue,
  parseNumericDraft,
  sanitizeNumericDraft
} from '../../utils/numberInput';

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: number | '' | null | undefined;
  onValueChange: (value: number) => void;
  /** Value emitted while the user leaves the input empty during editing (defaults to 0). */
  emptyValue?: number;
  /** Show empty input instead of "0" when blurred and numeric value is 0. */
  blankWhenZero?: boolean;
  /** Allow decimal input (defaults to true unless integer is true). */
  allowDecimal?: boolean;
  /** Integer-only input (sets inputMode="numeric" and disallows decimal point). */
  integer?: boolean;
  /** Allow negative numbers (auto-enabled if min < 0). */
  allowNegative?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
}

function toFiniteNumber(v: number | string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Controlled numeric input that preserves an empty draft while editing (preventing
 * deleted values from snapping back to "0" and causing "01000" leading-zero glitches).
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onValueChange,
  emptyValue = 0,
  blankWhenZero = false,
  allowDecimal = true,
  integer = false,
  allowNegative,
  min,
  max,
  step: _step,
  onFocus,
  onBlur,
  inputMode,
  ...rest
}) => {
  const numericMin = toFiniteNumber(min);
  const numericMax = toFiniteNumber(max);
  const resolvedAllowDecimal = integer ? false : allowDecimal;
  const resolvedAllowNegative =
    allowNegative ?? (numericMin !== undefined && numericMin < 0);

  const [rawText, setRawText] = useState<string>(() =>
    formatNumericValue(value, blankWhenZero)
  );
  const rawTextRef = useRef<string>(rawText);

  const isFocusedRef = useRef(false);
  const lastEmittedRef = useRef<number | '' | null | undefined>(value);
  const prevPropRef = useRef<number | '' | null | undefined>(value);

  useEffect(() => {
    const prevProp = prevPropRef.current;
    prevPropRef.current = value;

    if (!isFocusedRef.current) {
      const next = formatNumericValue(value, blankWhenZero);
      rawTextRef.current = next;
      setRawText(next);
      lastEmittedRef.current = value;
      return;
    }

    // While focused, never clobber an intentionally cleared draft or the user's live typing
    // if the parent simply echoed/clamped what we just emitted.
    if (rawTextRef.current === '') {
      return;
    }

    if (value !== prevProp && value !== lastEmittedRef.current) {
      const next = formatNumericValue(value, blankWhenZero);
      rawTextRef.current = next;
      setRawText(next);
      lastEmittedRef.current = value;
    }
  }, [value, blankWhenZero]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextDraft = sanitizeNumericDraft(e.target.value, {
      allowDecimal: resolvedAllowDecimal,
      allowNegative: resolvedAllowNegative
    });
    rawTextRef.current = nextDraft;
    setRawText(nextDraft);

    const parsed = parseNumericDraft(nextDraft, {
      emptyValue,
      integer,
      // Only clamp max on live change if needed; never clamp min during typing so users can clear & retype
      max: numericMax
    });
    lastEmittedRef.current = parsed;
    onValueChange(parsed);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;

    const finalNumeric = parseNumericDraft(rawTextRef.current, {
      emptyValue:
        numericMin !== undefined && emptyValue < numericMin ? numericMin : emptyValue,
      integer,
      min: numericMin,
      max: numericMax
    });

    if (finalNumeric !== value) {
      lastEmittedRef.current = finalNumeric;
      onValueChange(finalNumeric);
    }

    const formatted = formatNumericValue(finalNumeric, blankWhenZero);
    rawTextRef.current = formatted;
    setRawText(formatted);
    onBlur?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={inputMode ?? (integer ? 'numeric' : 'decimal')}
      value={rawText}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};

export default NumberInput;
