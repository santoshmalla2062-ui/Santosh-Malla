/**
 * Timezone-safe order timestamp helpers.
 *
 * Historically some handlers formatted UTC dates via
 * `new Date().toISOString().replace('T', ' ').substring(0, 16)`, which
 * stripped the trailing 'Z'. In non-UTC timezones (e.g. Nepal UTC+05:45),
 * `new Date("YYYY-MM-DD HH:MM")` parsed that UTC timestamp as local time,
 * adding an artificial +5h 45m (345m) offset to freshly dispatched KOTs.
 */

const LEGACY_UTC_SPACE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/;

export function nowIsoString(): string {
  return new Date().toISOString();
}

export function parseOrderTimestampMs(ts?: string): number {
  if (!ts || typeof ts !== 'string') return NaN;
  const trimmed = ts.trim();
  if (!trimmed) return NaN;

  // Normalize legacy `.toISOString().replace('T', ' ').substring(0, 16|19)` back to UTC ISO
  if (LEGACY_UTC_SPACE_RE.test(trimmed)) {
    return Date.parse(trimmed.replace(' ', 'T') + 'Z');
  }

  return Date.parse(trimmed);
}

export function parseOrderDate(ts?: string): Date {
  const ms = parseOrderTimestampMs(ts);
  if (Number.isNaN(ms)) return new Date();
  return new Date(ms);
}

export function getElapsedMinutes(ts?: string, nowMs: number = Date.now()): number {
  const parsed = parseOrderTimestampMs(ts);
  if (Number.isNaN(parsed)) return 0;
  const diffMs = nowMs - parsed;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

export function formatElapsedTime(ts?: string, nowMs: number = Date.now()): string {
  const parsed = parseOrderTimestampMs(ts);
  if (Number.isNaN(parsed)) return 'Just now';
  const diffMs = nowMs - parsed;
  if (diffMs < 60000) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function isOrderKotExpired(
  order: { status?: string; kotStatus?: string; kotSentAt?: string; createdAt?: string },
  nowMs: number = Date.now(),
  maxRetentionMs: number = 24 * 60 * 60 * 1000
): boolean {
  if (order.status && order.status !== 'active') return false;
  if (order.kotStatus === 'expired') return true;
  const isUnaccepted =
    order.kotSentAt &&
    (!order.kotStatus ||
      order.kotStatus === 'sent_to_kitchen' ||
      order.kotStatus === 'new' ||
      order.kotStatus === 'pending');
  if (!isUnaccepted) return false;
  const sentMs = parseOrderTimestampMs(order.kotSentAt);
  if (Number.isNaN(sentMs)) return false;
  return nowMs - sentMs >= maxRetentionMs;
}
