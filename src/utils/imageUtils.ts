export const MAX_PAYMENT_QR_DATA_URL_LENGTH = 200_000; // ~150KB binary ceiling to keep Firestore settings doc compact
export const MAX_PAYMENT_QR_UPLOAD_FILE_BYTES = 8 * 1024 * 1024; // 8MB raw file limit before client-side resize

const SAFE_IMAGE_DATA_URL_REGEX =
  /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;

/**
 * Validates that a payment QR image string is a safe, bounded raster base64 data URI.
 * Explicitly blocks SVG (scriptable XML), javascript:, external URLs, or oversized payloads.
 */
export function isValidPaymentQrDataUrl(value?: string | null): value is string {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_PAYMENT_QR_DATA_URL_LENGTH) return false;
  return SAFE_IMAGE_DATA_URL_REGEX.test(trimmed);
}

/**
 * Sanitizes an incoming payment QR image string, returning undefined if unsafe or oversized.
 */
export function sanitizePaymentQrDataUrl(value?: string | null): string | undefined {
  if (!isValidPaymentQrDataUrl(value)) return undefined;
  return value.trim();
}

/**
 * Reads an uploaded QR image File in the browser, draws it onto a clean white
 * square-bounded canvas (maxDimension px) to ensure transparent QR PNGs remain
 * scannable and stay compact (~30-90KB) for multi-device Firestore cloud sync.
 */
export async function compressPaymentQrImageFile(
  file: File,
  maxDimension: number = 420
): Promise<string> {
  if (!file) {
    throw new Error('No image file selected.');
  }
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported file type. Please upload a PNG, JPG, or WebP QR photo.');
  }
  if (file.size > MAX_PAYMENT_QR_UPLOAD_FILE_BYTES) {
    throw new Error('QR image file is too large (max 8 MB).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read uploaded QR image.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    if (!isValidPaymentQrDataUrl(rawDataUrl)) {
      throw new Error('Invalid QR image format or size.');
    }
    return rawDataUrl;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const imageEl = new Image();
    imageEl.onload = () => resolve(imageEl);
    imageEl.onerror = () => reject(new Error('Invalid or corrupted image file.'));
    imageEl.src = rawDataUrl;
  });

  const srcWidth = img.naturalWidth || img.width || maxDimension;
  const srcHeight = img.naturalHeight || img.height || maxDimension;
  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas is unavailable for image processing.');
  }

  // Paint crisp white background so transparent QR PNGs always remain dark-on-white scannable
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Try PNG first for sharp QR edges; fall back to JPEG if PNG exceeds sync budget
  let output = canvas.toDataURL('image/png');
  if (!isValidPaymentQrDataUrl(output)) {
    output = canvas.toDataURL('image/jpeg', 0.85);
  }
  if (!isValidPaymentQrDataUrl(output)) {
    output = canvas.toDataURL('image/jpeg', 0.65);
  }
  if (!isValidPaymentQrDataUrl(output)) {
    throw new Error('Processed QR image exceeds cloud sync size limit. Please use a simpler QR image.');
  }

  return output;
}

export const MAX_BUSINESS_LOGO_DATA_URL_LENGTH = 100_000; // ~75KB binary ceiling to keep cloud sync channel compact
export const MAX_BUSINESS_LOGO_UPLOAD_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_BUSINESS_LOGO_EXTERNAL_URL_LENGTH = 2048;

export const MAX_MENU_IMAGE_DATA_URL_LENGTH = 120_000; // ~90KB binary ceiling for uploaded dish photos
export const MAX_MENU_IMAGE_UPLOAD_FILE_BYTES = 8 * 1024 * 1024;

/**
 * Validates that a business logo string is either a safe bounded raster base64 data URI
 * or a safe http(s)/relative image URL. Explicitly blocks SVG XML, javascript:, data:text/html,
 * control characters, and oversized payloads.
 */
export function isValidBusinessLogoUrl(value?: string | null): value is string {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  if (/^data:/i.test(trimmed)) {
    if (trimmed.length > MAX_BUSINESS_LOGO_DATA_URL_LENGTH) return false;
    return SAFE_IMAGE_DATA_URL_REGEX.test(trimmed);
  }

  if (trimmed.length > MAX_BUSINESS_LOGO_EXTERNAL_URL_LENGTH || /\s/.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return !/^\/\//.test(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes an incoming business logo URL/data URI, returning undefined if unsafe or oversized.
 */
export function sanitizeBusinessLogoUrl(value?: string | null): string | undefined {
  if (!isValidBusinessLogoUrl(value)) return undefined;
  return value.trim();
}

/**
 * Validates that a menu item / room photo string is either a safe bounded raster base64 data URI
 * (<= MAX_MENU_IMAGE_DATA_URL_LENGTH) or a safe http(s)/relative image URL.
 */
export function isValidMenuImageUrl(value?: string | null): value is string {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return false;

  if (/^data:/i.test(trimmed)) {
    if (trimmed.length > MAX_MENU_IMAGE_DATA_URL_LENGTH) return false;
    return SAFE_IMAGE_DATA_URL_REGEX.test(trimmed);
  }

  if (trimmed.length > MAX_BUSINESS_LOGO_EXTERNAL_URL_LENGTH || /\s/.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return !/^\/\//.test(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes a menu item or room image URL/data URI, returning undefined if unsafe or oversized.
 */
export function sanitizeMenuImageUrl(value?: string | null): string | undefined {
  if (!isValidMenuImageUrl(value)) return undefined;
  return value.trim();
}

/**
 * Reads an uploaded menu dish photo in the browser and compresses it to a compact
 * WebP/JPEG data URL (<= 120KB) so menu items never bloat Firestore sync channels.
 */
export async function compressMenuImageFile(
  file: File,
  maxDimension: number = 400
): Promise<string> {
  if (!file) {
    throw new Error('No image file selected.');
  }
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported file type. Please upload a PNG, JPG, or WebP photo.');
  }
  if (file.size > MAX_MENU_IMAGE_UPLOAD_FILE_BYTES) {
    throw new Error('Dish image file is too large (max 8 MB).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read uploaded image.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    const sanitized = sanitizeMenuImageUrl(rawDataUrl);
    if (!sanitized) {
      throw new Error('Image format or size exceeds limit.');
    }
    return sanitized;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const imageEl = new Image();
    imageEl.onload = () => resolve(imageEl);
    imageEl.onerror = () => reject(new Error('Invalid or corrupted image file.'));
    imageEl.src = rawDataUrl;
  });

  const srcWidth = img.naturalWidth || img.width || maxDimension;
  const srcHeight = img.naturalHeight || img.height || maxDimension;
  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas is unavailable for image processing.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  let output = canvas.toDataURL('image/webp', 0.82);
  if (!isValidMenuImageUrl(output)) {
    output = canvas.toDataURL('image/jpeg', 0.82);
  }
  if (!isValidMenuImageUrl(output)) {
    output = canvas.toDataURL('image/jpeg', 0.65);
  }
  if (!isValidMenuImageUrl(output)) {
    throw new Error('Processed photo exceeds cloud sync size limit. Please use a smaller image.');
  }

  return output;
}

/**
 * Reads an uploaded business logo image File in the browser and resizes it to a compact
 * square-bounded image (default 256px) for instant UI rendering, thermal receipts, and cloud sync.
 * Preserves transparent backgrounds (PNG/WebP) when within sync size budget.
 */
export async function compressBusinessLogoImageFile(
  file: File,
  maxDimension: number = 256
): Promise<string> {
  if (!file) {
    throw new Error('No logo image file selected.');
  }
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported file type. Please upload a PNG, JPG, or WebP logo image.');
  }
  if (file.size > MAX_BUSINESS_LOGO_UPLOAD_FILE_BYTES) {
    throw new Error('Logo image file is too large (max 8 MB).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read uploaded logo image.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read logo file.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    const sanitized = sanitizeBusinessLogoUrl(rawDataUrl);
    if (!sanitized) {
      throw new Error('Invalid logo image format or size.');
    }
    return sanitized;
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const imageEl = new Image();
    imageEl.onload = () => resolve(imageEl);
    imageEl.onerror = () => reject(new Error('Invalid or corrupted image file.'));
    imageEl.src = rawDataUrl;
  });

  const srcWidth = img.naturalWidth || img.width || maxDimension;
  const srcHeight = img.naturalHeight || img.height || maxDimension;
  const scale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser canvas is unavailable for image processing.');
  }

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Preserve transparency via PNG first, then WebP if needed
  let output = canvas.toDataURL('image/png');
  if (!isValidBusinessLogoUrl(output)) {
    output = canvas.toDataURL('image/webp', 0.85);
  }
  if (!isValidBusinessLogoUrl(output)) {
    // Composite over white if still too big for transparent encoding
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    output = canvas.toDataURL('image/jpeg', 0.86);
  }
  if (!isValidBusinessLogoUrl(output)) {
    output = canvas.toDataURL('image/jpeg', 0.68);
  }
  if (!isValidBusinessLogoUrl(output)) {
    throw new Error('Processed logo image exceeds cloud sync size limit. Please use a simpler logo.');
  }

  return output;
}

