import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BUSINESS_LOGO_DATA_URL_LENGTH,
  MAX_MENU_IMAGE_DATA_URL_LENGTH,
  MAX_PAYMENT_QR_DATA_URL_LENGTH,
  isValidBusinessLogoUrl,
  isValidMenuImageUrl,
  isValidPaymentQrDataUrl,
  sanitizeBusinessLogoUrl,
  sanitizeMenuImageUrl,
  sanitizePaymentQrDataUrl
} from '../utils/imageUtils';

test('isValidPaymentQrDataUrl accepts valid raster base64 QR data URLs', () => {
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const validJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==';
  const validWebp = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

  assert.equal(isValidPaymentQrDataUrl(validPng), true);
  assert.equal(isValidPaymentQrDataUrl(validJpg), true);
  assert.equal(isValidPaymentQrDataUrl(validWebp), true);
  assert.equal(sanitizePaymentQrDataUrl(`  ${validPng}  `), validPng);
});

test('isValidPaymentQrDataUrl rejects SVG, javascript URLs, external HTTP URLs, and oversized payloads', () => {
  assert.equal(isValidPaymentQrDataUrl(undefined), false);
  assert.equal(isValidPaymentQrDataUrl(''), false);
  assert.equal(isValidPaymentQrDataUrl('javascript:alert(1)'), false);
  assert.equal(isValidPaymentQrDataUrl('https://evil.example.com/qr.png'), false);
  assert.equal(isValidPaymentQrDataUrl('data:image/svg+xml;base64,PHN2Zy8+'), false);
  assert.equal(isValidPaymentQrDataUrl('data:text/html;base64,PGgxPkZha2U8L2gxPg=='), false);

  const oversized = 'data:image/png;base64,' + 'A'.repeat(MAX_PAYMENT_QR_DATA_URL_LENGTH + 10);
  assert.equal(isValidPaymentQrDataUrl(oversized), false);
  assert.equal(sanitizePaymentQrDataUrl(oversized), undefined);
});

test('isValidBusinessLogoUrl accepts compressed raster data URIs, HTTPS URLs, and relative asset paths', () => {
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(isValidBusinessLogoUrl(validPng), true);
  assert.equal(sanitizeBusinessLogoUrl(`  ${validPng}  `), validPng);

  assert.equal(isValidBusinessLogoUrl('https://cdn.example.com/logo.png'), true);
  assert.equal(isValidBusinessLogoUrl('/assets/logo.png'), true);
  assert.equal(sanitizeBusinessLogoUrl('  https://cdn.example.com/logo.png  '), 'https://cdn.example.com/logo.png');
});

test('isValidBusinessLogoUrl blocks SVG, javascript:, protocol-relative, whitespace, and oversized logos', () => {
  assert.equal(isValidBusinessLogoUrl(undefined), false);
  assert.equal(isValidBusinessLogoUrl(''), false);
  assert.equal(isValidBusinessLogoUrl('javascript:alert(1)'), false);
  assert.equal(isValidBusinessLogoUrl('//evil.example.com/logo.png'), false);
  assert.equal(isValidBusinessLogoUrl('data:image/svg+xml;base64,PHN2Zy8+'), false);
  assert.equal(isValidBusinessLogoUrl('data:text/html;base64,PGgxPkZha2U8L2gxPg=='), false);
  assert.equal(isValidBusinessLogoUrl('https://example.com/bad logo.png'), false);

  const oversizedLogo = 'data:image/png;base64,' + 'A'.repeat(MAX_BUSINESS_LOGO_DATA_URL_LENGTH + 10);
  assert.equal(isValidBusinessLogoUrl(oversizedLogo), false);
  assert.equal(sanitizeBusinessLogoUrl(oversizedLogo), undefined);
});

test('isValidMenuImageUrl enforces size limits and blocks unsafe schemes', () => {
  const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal(isValidMenuImageUrl(validPng), true);
  assert.equal(sanitizeMenuImageUrl(`  ${validPng}  `), validPng);
  assert.equal(isValidMenuImageUrl('https://cdn.example.com/momo.webp'), true);
  assert.equal(isValidMenuImageUrl('javascript:alert(1)'), false);
  assert.equal(isValidMenuImageUrl('data:image/svg+xml;base64,PHN2Zy8+'), false);

  const oversizedMenu = 'data:image/jpeg;base64,' + 'A'.repeat(MAX_MENU_IMAGE_DATA_URL_LENGTH + 10);
  assert.equal(isValidMenuImageUrl(oversizedMenu), false);
  assert.equal(sanitizeMenuImageUrl(oversizedMenu), undefined);
});

