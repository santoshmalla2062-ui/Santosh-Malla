export const SHARED_APP_URL =
  'https://ais-pre-ggorgk5h6owhq22zwzdgxh-666001801875.asia-southeast1.run.app';

export const DEV_APP_URL =
  'https://ais-dev-ggorgk5h6owhq22zwzdgxh-666001801875.asia-southeast1.run.app';

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
    lower.includes('ais-dev-')
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
