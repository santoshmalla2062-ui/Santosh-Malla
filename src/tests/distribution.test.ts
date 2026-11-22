import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARED_APP_URL,
  DEV_APP_URL,
  sanitizePublicBaseUrl,
  resolveDefaultPublicAppUrl,
  buildAppDirectUrl,
  buildAppDownloadUrl,
  buildWebsiteDownloadSnippet,
  isDownloadRouteRequested,
  sanitizeAndroidApkUrl
} from '../utils/distribution';

test('Distribution: Sanitizes valid custom domain URLs and rejects unsafe URI schemes', () => {
  assert.equal(sanitizePublicBaseUrl('pos.mycafe.com/'), 'https://pos.mycafe.com');
  assert.equal(sanitizePublicBaseUrl('https://cafe.example.com/app/download'), 'https://cafe.example.com/app');
  assert.equal(sanitizePublicBaseUrl('javascript:alert(1)'), '');
  assert.equal(sanitizePublicBaseUrl('data:text/html,xss'), '');
});

test('Distribution: Prefers live custom origin when hosted publicly and falls back to SHARED_APP_URL in dev/local', () => {
  assert.equal(resolveDefaultPublicAppUrl('http://localhost:3000'), SHARED_APP_URL);
  assert.equal(resolveDefaultPublicAppUrl(DEV_APP_URL), SHARED_APP_URL);
  assert.equal(resolveDefaultPublicAppUrl('https://pos.myrestaurant.com'), 'https://pos.myrestaurant.com');
  assert.equal(
    resolveDefaultPublicAppUrl('https://owner.github.io', '/himalayan-breeze/'),
    'https://owner.github.io/himalayan-breeze'
  );
  assert.equal(resolveDefaultPublicAppUrl('https://owner.github.io', '/'), 'https://owner.github.io');
});

test('Distribution: Builds clean direct & ?download=1 URLs and XSS-safe embeddable HTML snippet', () => {
  assert.equal(
    buildAppDirectUrl('https://pos.myrestaurant.com/download'),
    'https://pos.myrestaurant.com/'
  );
  assert.equal(
    buildAppDownloadUrl('https://pos.myrestaurant.com'),
    'https://pos.myrestaurant.com/?download=1'
  );
  assert.equal(
    buildAppDownloadUrl('https://pos.myrestaurant.com', 'biz-annapurna-coffee'),
    'https://pos.myrestaurant.com/?download=1&biz=biz-annapurna-coffee'
  );
  assert.equal(
    buildAppDirectUrl('https://pos.myrestaurant.com', 'biz-annapurna-coffee'),
    'https://pos.myrestaurant.com/?biz=biz-annapurna-coffee'
  );

  const snippet = buildWebsiteDownloadSnippet(
    'https://pos.myrestaurant.com/?download=1',
    'Cafe "Breeze" <Script>',
    'en'
  );
  assert.ok(snippet.includes('href="https://pos.myrestaurant.com/?download=1"'));
  assert.ok(snippet.includes('Cafe &quot;Breeze&quot; &lt;Script&gt;'));
  assert.equal(snippet.includes('<Script>'), false);
});

test('Distribution: Detects ?download=1, ?install=1, and /download routes accurately', () => {
  assert.equal(isDownloadRouteRequested('?download=1', '/'), true);
  assert.equal(isDownloadRouteRequested('?install=1', '/'), true);
  assert.equal(isDownloadRouteRequested('', '/download'), true);
  assert.equal(isDownloadRouteRequested('', '/app/install/'), true);
  assert.equal(isDownloadRouteRequested('?tab=pos', '/'), false);
  assert.equal(isDownloadRouteRequested('?download=0', '/'), false);
});

test('Distribution: Sanitizes Android .APK URLs, converts Google Drive links, and appends &apk= cleanly', () => {
  assert.equal(sanitizeAndroidApkUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeAndroidApkUrl('data:application/octet-stream,abc'), '');
  assert.equal(
    sanitizeAndroidApkUrl('https://cdn.myhotel.com/himalayan-breeze.apk'),
    'https://cdn.myhotel.com/himalayan-breeze.apk'
  );
  assert.equal(
    sanitizeAndroidApkUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing'),
    'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUv'
  );
  assert.equal(
    sanitizeAndroidApkUrl('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv'),
    'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUv'
  );

  const withApk = buildAppDownloadUrl(
    'https://pos.myrestaurant.com',
    'biz-1',
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing'
  );
  assert.ok(withApk.startsWith('https://pos.myrestaurant.com/?download=1&biz=biz-1&apk='));
  assert.ok(decodeURIComponent(withApk).includes('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUv'));
});

