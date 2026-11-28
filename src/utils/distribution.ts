export const GITHUB_PAGES_URL =
  'https://santoshmalla2062-ui.github.io/Santosh-Malla';

export const SHARED_APP_URL = GITHUB_PAGES_URL;

export const DEV_APP_URL =
  'https://ais-dev-ggorgk5h6owhq22zwzdgxh-666001801875.asia-southeast1.run.app';

export const DEFAULT_ANDROID_APK_URL =
  'https://drive.google.com/uc?export=download&id=1CLnOe7tdTQYTcgsbV9RrPKSDrgKqz_Ws';

export function sanitizePublicBaseUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  // Explicitly block unsafe URI schemes before auto-prefixing
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return '';
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    const cleanPath = parsed.pathname.replace(/\/(download|install)\/?$/i, '').replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return '';
  }
}

export function isLocalOrDevPreviewUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return true;
  const lower = rawUrl.toLowerCase();
  return (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('ais-dev-') ||
    lower.includes('ais-pre-')
  );
}

export function resolveDefaultPublicAppUrl(currentOrigin?: string, basePath?: string): string {
  const cleanOrigin = sanitizePublicBaseUrl(currentOrigin || '');
  if (!cleanOrigin || isLocalOrDevPreviewUrl(cleanOrigin)) {
    return SHARED_APP_URL;
  }
  const envBase =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL
      : undefined;
  const resolvedBase = (basePath ?? envBase ?? '/').trim();
  const cleanSubpath = resolvedBase.replace(/^\/+|\/+$/g, '');
  return cleanSubpath ? `${cleanOrigin}/${cleanSubpath}` : cleanOrigin;
}

export function buildAppDirectUrl(baseUrl: string, businessId?: string): string {
  const cleanBase = sanitizePublicBaseUrl(baseUrl) || SHARED_APP_URL;
  if (businessId && /^[a-zA-Z0-9_-]{2,128}$/.test(businessId.trim())) {
    return `${cleanBase}/?biz=${encodeURIComponent(businessId.trim())}`;
  }
  return `${cleanBase}/`;
}

export function buildStaffInviteUrl(params: {
  baseUrl: string;
  businessId?: string;
  inviteCode?: string;
  email?: string;
  name?: string;
}): string {
  const cleanBase = sanitizePublicBaseUrl(params.baseUrl) || SHARED_APP_URL;
  const query: string[] = [];
  if (params.businessId && /^[a-zA-Z0-9_-]{2,128}$/.test(params.businessId.trim())) {
    query.push(`biz=${encodeURIComponent(params.businessId.trim())}`);
  }
  if (params.inviteCode && params.inviteCode.trim()) {
    query.push(`invite=${encodeURIComponent(params.inviteCode.trim().toUpperCase())}`);
  }
  if (params.email && params.email.trim()) {
    query.push(`email=${encodeURIComponent(params.email.trim().toLowerCase())}`);
  }
  if (params.name && params.name.trim()) {
    query.push(`name=${encodeURIComponent(params.name.trim().slice(0, 60))}`);
  }
  return query.length > 0 ? `${cleanBase}/?${query.join('&')}` : `${cleanBase}/`;
}

export function sanitizeAndroidApkUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return '';
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }

    // Auto-convert Google Drive share links into direct download URLs for mobile QR scanning
    if (parsed.hostname.toLowerCase() === 'drive.google.com') {
      const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const idParam = parsed.searchParams.get('id');
      const fileId = fileMatch?.[1] || idParam;
      if (fileId && /^[a-zA-Z0-9_-]{8,128}$/.test(fileId)) {
        return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
      }
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

export function buildAppDownloadUrl(
  baseUrl: string,
  businessId?: string,
  apkUrl?: string
): string {
  const cleanBase = sanitizePublicBaseUrl(baseUrl) || SHARED_APP_URL;
  const params: string[] = ['download=1'];
  if (businessId && /^[a-zA-Z0-9_-]{2,128}$/.test(businessId.trim())) {
    params.push(`biz=${encodeURIComponent(businessId.trim())}`);
  }
  const cleanApk = apkUrl ? sanitizeAndroidApkUrl(apkUrl) : '';
  if (cleanApk) {
    params.push(`apk=${encodeURIComponent(cleanApk)}`);
  }
  return `${cleanBase}/?${params.join('&')}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildWebsiteDownloadSnippet(
  downloadUrl: string,
  businessName: string,
  lang: 'en' | 'ne' = 'en'
): string {
  const safeHref = escapeHtml(buildAppDownloadUrl(downloadUrl.replace(/\/\?download=1$/i, '')));
  const safeBrand = escapeHtml(businessName.trim() || 'Himalayan Breeze POS');
  const ctaText =
    lang === 'ne'
      ? `${safeBrand} — मोबाइल एप Download गर्नुहोस्`
      : `Download ${safeBrand} App`;
  const subText =
    lang === 'ne'
      ? 'Android, iPhone र Computer मा तुरुन्तै चल्ने'
      : 'Works on Android, iPhone & Desktop';

  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:10px;padding:12px 20px;background:#059669;color:#ffffff;font-family:system-ui,-apple-system,sans-serif;font-size:15px;font-weight:700;border-radius:12px;text-decoration:none;box-shadow:0 4px 12px rgba(5,150,105,0.25);">
  <span>&#11015;</span>
  <span>${ctaText}<br/><small style="font-size:11px;font-weight:500;opacity:0.9;">${subText}</small></span>
</a>`;
}

export function isDownloadRouteRequested(search: string, pathname: string): boolean {
  try {
    const params = new URLSearchParams(search || '');
    const dl = (params.get('download') || '').toLowerCase();
    const inst = (params.get('install') || '').toLowerCase();
    if (dl === '1' || dl === 'true' || inst === '1' || inst === 'true') {
      return true;
    }
  } catch {
    // Fallback to pathname check
  }
  return /\/(download|install)\/?$/i.test(pathname || '');
}

export interface CompactDigitalMenuItem {
  n: string; // name
  c: string; // category
  p: number; // price
  o?: number; // offerPrice
  d?: string; // short description
}

export interface CompactDigitalMenuPayload {
  bn: string; // businessName
  cur: string; // currencySymbol
  items: CompactDigitalMenuItem[];
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64Url: string): Uint8Array {
  const padded = b64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64Url.length + 3) % 4);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

export function encodeCompactMenuPayload(payload: CompactDigitalMenuPayload): string {
  try {
    const compact: CompactDigitalMenuPayload = {
      bn: (payload.bn || 'CAFE HOST').slice(0, 60),
      cur: (payload.cur || 'Rs.').slice(0, 6),
      items: (payload.items || []).slice(0, 50).map((it) => ({
        n: String(it.n || '').slice(0, 48),
        c: String(it.c || 'snacks').slice(0, 24),
        p: Math.round((Number(it.p) || 0) * 100) / 100,
        ...(typeof it.o === 'number' && it.o > 0 && it.o < it.p ? { o: Math.round(it.o * 100) / 100 } : {}),
        ...(it.d ? { d: String(it.d).slice(0, 50) } : {})
      }))
    };
    const json = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(json);
    return bytesToBase64Url(bytes);
  } catch {
    return '';
  }
}

export function decodeCompactMenuPayload(encoded?: string | null): CompactDigitalMenuPayload | null {
  if (!encoded || typeof encoded !== 'string') return null;
  try {
    const bytes = base64UrlToBytes(encoded.trim());
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<CompactDigitalMenuPayload>;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      bn: typeof parsed.bn === 'string' && parsed.bn.trim() ? parsed.bn.trim() : 'CAFE HOST',
      cur: typeof parsed.cur === 'string' && parsed.cur.trim() ? parsed.cur.trim() : 'Rs.',
      items: parsed.items
        .filter((it) => it && typeof it.n === 'string' && it.n.trim())
        .map((it) => ({
          n: String(it.n).trim(),
          c: typeof it.c === 'string' ? it.c : 'snacks',
          p: Number(it.p) || 0,
          ...(typeof it.o === 'number' && it.o > 0 ? { o: Number(it.o) } : {}),
          ...(typeof it.d === 'string' && it.d.trim() ? { d: it.d.trim() } : {})
        }))
    };
  } catch {
    return null;
  }
}

export function buildDigitalMenuUrl(params: {
  baseUrl: string;
  businessId?: string;
  tableName?: string;
  businessName?: string;
  currencySymbol?: string;
  menuItems?: { name: string; category: string; price: number; isAvailable?: boolean; isOffer?: boolean; offerPrice?: number; description?: string }[];
}): string {
  const cleanBase = sanitizePublicBaseUrl(params.baseUrl) || SHARED_APP_URL;
  const query: string[] = ['menu=1'];
  if (params.businessId && /^[a-zA-Z0-9_-]{2,128}$/.test(params.businessId.trim())) {
    query.push(`biz=${encodeURIComponent(params.businessId.trim())}`);
  }
  if (params.tableName && params.tableName.trim()) {
    query.push(`table=${encodeURIComponent(params.tableName.trim().slice(0, 40))}`);
  }
  const availableItems = (params.menuItems || []).filter((m) => m.isAvailable !== false);
  if (availableItems.length > 0) {
    const encoded = encodeCompactMenuPayload({
      bn: params.businessName || 'CAFE HOST',
      cur: params.currencySymbol || 'Rs.',
      items: availableItems.map((m) => ({
        n: m.name,
        c: m.category,
        p: m.price,
        ...(m.isOffer && typeof m.offerPrice === 'number' ? { o: m.offerPrice } : {}),
        ...(m.description ? { d: m.description } : {})
      }))
    });
    if (encoded && encoded.length <= 1400) {
      query.push(`m=${encoded}`);
    }
  }
  return `${cleanBase}/?${query.join('&')}`;
}

export function isDigitalMenuRouteRequested(search: string): boolean {
  try {
    const params = new URLSearchParams(search || '');
    const menuFlag = (params.get('menu') || '').toLowerCase();
    return menuFlag === '1' || menuFlag === 'true';
  } catch {
    return false;
  }
}

