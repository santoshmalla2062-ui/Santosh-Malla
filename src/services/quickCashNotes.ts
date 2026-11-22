export const DEFAULT_QUICK_CASH_NOTES = [100, 200, 500, 1000, 1500, 2000, 5000] as const;

const QUICK_CASH_STORAGE_PREFIX = 'hb_quick_cash_notes_';

export function normalizeQuickCashNotes(values: unknown[]): number[] {
  const cleaned = values
    .map((v) => Math.round(Number(v) * 100) / 100)
    .filter((v) => Number.isFinite(v) && v > 0 && v <= 10_000_000);
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

export function loadQuickCashNotes(businessId?: string, settingsNotes?: number[]): number[] {
  const key = `${QUICK_CASH_STORAGE_PREFIX}${businessId || 'default'}`;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return normalizeQuickCashNotes(parsed);
        }
      }
    } catch {
      // Ignore storage parse failure and fallback cleanly
    }
  }
  if (Array.isArray(settingsNotes)) {
    return normalizeQuickCashNotes(settingsNotes);
  }
  return [...DEFAULT_QUICK_CASH_NOTES];
}

export function saveQuickCashNotes(notes: number[], businessId?: string): number[] {
  const normalized = normalizeQuickCashNotes(notes);
  const key = `${QUICK_CASH_STORAGE_PREFIX}${businessId || 'default'}`;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota failure
    }
  }
  return normalized;
}

export function clearSavedQuickCashNotesOverride(businessId?: string): void {
  const key = `${QUICK_CASH_STORAGE_PREFIX}${businessId || 'default'}`;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage failure
    }
  }
}

export function addCustomQuickCashNote(
  currentNotes: number[],
  rawInput: string | number
): { notes: number[]; added?: number; error?: string } {
  const parsed = Math.round(Number(rawInput) * 100) / 100;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { notes: currentNotes, error: 'Enter a valid amount greater than 0.' };
  }
  if (parsed > 10_000_000) {
    return { notes: currentNotes, error: 'Amount is too large.' };
  }
  const normalized = normalizeQuickCashNotes([...currentNotes, parsed]);
  return { notes: normalized, added: parsed };
}

export function removeQuickCashNote(currentNotes: number[], amountToRemove: number): number[] {
  return currentNotes.filter((n) => Math.abs(n - amountToRemove) >= 0.005);
}

export function buildQuickCashOptionsForPayable(
  exactPayable: number,
  configuredNotes: number[]
): number[] {
  const cleanExact = Math.max(0, Math.round(exactPayable * 100) / 100);
  const roundedWhole = Math.ceil(cleanExact);
  const candidates = [
    ...(cleanExact > 0 ? [cleanExact] : []),
    ...(roundedWhole > cleanExact ? [roundedWhole] : []),
    ...normalizeQuickCashNotes(configuredNotes)
  ];
  return candidates.filter(
    (amt, index, self) => amt >= cleanExact && self.findIndex((x) => Math.abs(x - amt) < 0.005) === index
  );
}
