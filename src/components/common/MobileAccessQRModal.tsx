import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Smartphone,
  Share2,
  ExternalLink,
  AlertTriangle,
  X,
  Package
} from 'lucide-react';
import { Language } from '../../utils/translations';
import {
  SHARED_APP_URL,
  DEFAULT_ANDROID_APK_URL,
  buildAppDirectUrl,
  buildAppDownloadUrl,
  isLocalOrDevPreviewUrl,
  resolveDefaultPublicAppUrl,
  sanitizeAndroidApkUrl,
  sanitizePublicBaseUrl
} from '../../utils/distribution';
import { PWAInstallButton } from './PWAInstallButton';

export type QRTargetMode = 'download' | 'apk' | 'direct';

interface MobileAccessQRPanelProps {
  businessName: string;
  lang: Language;
  androidApkUrl?: string;
  onSaveAndroidApkUrl?: (apkUrl: string) => void;
  onOpenDownloadPortal?: () => void;
  onOpenFullscreenModal?: () => void;
  compactHeader?: boolean;
}

export const MobileAccessQRPanel: React.FC<MobileAccessQRPanelProps> = ({
  businessName,
  lang,
  androidApkUrl = '',
  onSaveAndroidApkUrl,
  onOpenDownloadPortal,
  onOpenFullscreenModal,
  compactHeader = false
}) => {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isRunningOnDevOrigin = isLocalOrDevPreviewUrl(currentOrigin);

  const [baseUrlInput, setBaseUrlInput] = useState<string>(() =>
    resolveDefaultPublicAppUrl(currentOrigin)
  );
  const [apkUrlInput, setApkUrlInput] = useState<string>(
    androidApkUrl || DEFAULT_ANDROID_APK_URL
  );
  const [savedApkFeedback, setSavedApkFeedback] = useState<boolean>(false);
  const [targetMode, setTargetMode] = useState<QRTargetMode>('download');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    setApkUrlInput(androidApkUrl || DEFAULT_ANDROID_APK_URL);
  }, [androidApkUrl]);

  const cleanedBaseUrl = useMemo(() => sanitizePublicBaseUrl(baseUrlInput), [baseUrlInput]);
  const cleanedApkUrl = useMemo(() => sanitizeAndroidApkUrl(apkUrlInput), [apkUrlInput]);
  const targetUrl = useMemo(() => {
    if (targetMode === 'apk') {
      return cleanedApkUrl;
    }
    if (targetMode === 'download') {
      return buildAppDownloadUrl(baseUrlInput, undefined, cleanedApkUrl || undefined);
    }
    return buildAppDirectUrl(baseUrlInput);
  }, [baseUrlInput, cleanedApkUrl, targetMode]);

  const isSelectedUrlDev = targetMode !== 'apk' && isLocalOrDevPreviewUrl(cleanedBaseUrl || baseUrlInput);
  const isSelectedUrlAiStudioShared = targetMode !== 'apk' && (cleanedBaseUrl || '').includes('ais-pre-');
  const canNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let active = true;
    setQrError(false);

    if (!targetUrl) {
      setQrDataUrl('');
      setQrError(targetMode !== 'apk');
      return () => {
        active = false;
      };
    }

    QRCode.toDataURL(targetUrl, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) {
          setQrDataUrl(url);
          setQrError(false);
        }
      })
      .catch(() => {
        if (active) {
          setQrDataUrl('');
          setQrError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [targetMode, targetUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setShareFeedback(
        lang === 'ne'
          ? 'लिंक बक्सबाट कपी गर्नुहोस्।'
          : 'Select and copy the URL manually from the box above.'
      );
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: businessName || 'Himalayan Breeze POS',
        text:
          lang === 'ne'
            ? `${businessName || 'Himalayan Breeze POS'} मोबाइल वा कम्प्युटरमा खोल्नुहोस् / डाउनलोड गर्नुहोस्:`
            : `Open or install ${businessName || 'Himalayan Breeze POS'} on your device:`,
        url: targetUrl
      });
    } catch {
      // User dismissed OS share sheet
    }
  };

  const handleSaveApkLink = () => {
    const normalized = sanitizeAndroidApkUrl(apkUrlInput);
    setApkUrlInput(normalized);
    if (onSaveAndroidApkUrl) {
      onSaveAndroidApkUrl(normalized);
    }
    setSavedApkFeedback(true);
    setTimeout(() => setSavedApkFeedback(false), 2500);
  };

  const downloadFilename = `${(businessName || 'himalayan-breeze')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'app'}-${targetMode === 'apk' ? 'apk-download' : targetMode === 'download' ? 'download' : 'access'}-qr.png`;

  return (
    <div className="space-y-5">
      {!compactHeader && (
        <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {lang === 'ne'
                ? 'मोबाइल पहुँच र एप डाउनलोड QR कोड'
                : 'Mobile Access & App Download QR Code'}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {lang === 'ne'
                ? 'फोनको क्यामेराबाट सिधै स्क्यान गरी Android, iPhone वा ट्याब्लेटमा एप खोल्नुहोस् र इन्स्टल गर्नुहोस्।'
                : 'Scan with any phone camera to open the web app or install directly on Android, iPhone, and tablets.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton lang={lang} />
            {onOpenFullscreenModal && (
              <button
                type="button"
                onClick={onOpenFullscreenModal}
                className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <QrCode className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{lang === 'ne' ? 'ठूलो QR स्क्रिन' : 'Open QR Modal'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Split: Scannable QR Code Left, Target Controls & Actions Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* High-Contrast Scannable QR Frame */}
        <div className="md:col-span-5 flex flex-col items-center text-center">
          <div className="w-full max-w-[260px] aspect-square bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code linking to ${targetUrl}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <div className="w-full h-full rounded-xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 p-4 text-slate-500">
                <QrCode className="h-10 w-10 text-slate-400" />
                <span className="text-xs font-medium">
                  {targetMode === 'apk' && !cleanedApkUrl
                    ? lang === 'ne'
                      ? 'दायाँ बाकसमा .APK फाइलको लिंक राख्नुहोस् — अनि QR बन्छ'
                      : 'Paste your hosted .APK URL on the right to generate direct APK QR'
                    : qrError
                    ? lang === 'ne'
                      ? 'मान्य URL लेख्नुहोस्'
                      : 'Enter a valid URL to render QR'
                    : lang === 'ne'
                    ? 'QR तयार हुँदैछ...'
                    : 'Generating QR code...'}
                </span>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-500 leading-relaxed max-w-[260px]">
            {targetMode === 'apk'
              ? lang === 'ne'
                ? 'स्क्यान गर्नेबित्तिकै Android फोनमा सिधै .APK डाउनलोड सुरु हुन्छ'
                : 'Scan with mobile camera to directly download the Android .APK file'
              : lang === 'ne'
              ? 'Chrome वा Safari मा सिधै खोल्न फोनको क्यामेरा QR तर्फ देखाउनुहोस्'
              : 'Point your mobile camera here to open & install without app store delays'}
          </p>

          <p className="mt-1.5 text-[11px] font-medium text-slate-500 flex items-center justify-center gap-1.5 flex-wrap">
            <span>Android Chrome</span>
            <span aria-hidden="true">·</span>
            <span>iPhone Safari</span>
            <span aria-hidden="true">·</span>
            <span>Desktop</span>
          </p>
        </div>

        {/* Right Column: Destination Mode, Host Selection & Actions */}
        <div className="md:col-span-7 space-y-4">
          {/* QR Destination Segmented Control */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              {lang === 'ne' ? 'स्क्यान गर्दा के खुल्ने?' : 'Destination When Scanned'}
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTargetMode('download')}
                className={`min-h-[40px] px-2.5 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                  targetMode === 'download'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'ne' ? 'एप डाउनलोड पेज' : 'Download Page'}
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('apk')}
                className={`min-h-[40px] px-2.5 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate flex items-center justify-center gap-1 ${
                  targetMode === 'apk'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="h-3.5 w-3.5 shrink-0" />
                <span>Android .APK</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('direct')}
                className={`min-h-[40px] px-2.5 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap truncate ${
                  targetMode === 'direct'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'ne' ? 'सीधा वेब एप (/)' : 'Direct App (/)'}
              </button>
            </div>
          </div>

          {targetMode === 'apk' ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor="qr-apk-url-input"
                  className="text-xs font-bold text-emerald-950 flex items-center gap-1.5"
                >
                  <Package className="h-3.5 w-3.5 text-emerald-700" />
                  <span>
                    {lang === 'ne'
                      ? 'Android .APK डाउनलोड लिंक (URL)'
                      : 'Android .APK Download Link (URL)'}
                  </span>
                </label>
                {cleanedApkUrl && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                    {lang === 'ne' ? 'सीधा डाउनलोड तयार' : 'Direct Download Ready'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="qr-apk-url-input"
                  type="url"
                  value={apkUrlInput}
                  onChange={(e) => setApkUrlInput(e.target.value)}
                  placeholder="https://drive.google.com/... वा https://domain.com/himalayan-breeze.apk"
                  className="flex-1 min-w-0 min-h-[40px] px-3 py-2 bg-white border border-emerald-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
                {onSaveAndroidApkUrl && (
                  <button
                    type="button"
                    onClick={handleSaveApkLink}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold whitespace-nowrap shrink-0 transition-colors"
                  >
                    {savedApkFeedback
                      ? lang === 'ne'
                        ? 'सेभ भयो!'
                        : 'Saved!'
                      : lang === 'ne'
                      ? 'लिंक सेभ'
                      : 'Save Link'}
                  </button>
                )}
              </div>

              <p className="text-[11px] text-emerald-900 leading-relaxed">
                {lang === 'ne'
                  ? 'Google Drive, GitHub Release, Firebase Storage वा आफ्नै वेबसाइटमा राखेको .apk लिंक यहाँ पेस्ट गर्नुहोस् (Google Drive लिंक आफैँ सीधा डाउनलोड लिंकमा बदलिन्छ)। सेभ गरेपछि QR स्क्यान गर्नेबित्तिकै मोबाइलमा .apk डाउनलोड हुन्छ।'
                  : 'Paste your .apk URL from Google Drive, GitHub Releases, Firebase Storage, or your website (Google Drive share links auto-convert to direct download). Scanning this QR immediately downloads the .apk on Android.'}
              </p>
            </div>
          ) : (
            /* Host Selector */
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor="qr-host-url-input"
                  className="text-xs font-semibold text-slate-800"
                >
                  {lang === 'ne' ? 'वेब एप लिंक (URL)' : 'Web App Host URL'}
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBaseUrlInput(SHARED_APP_URL)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      cleanedBaseUrl === SHARED_APP_URL
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {lang === 'ne' ? 'सार्वजनिक URL' : 'Published URL'}
                  </button>
                  {currentOrigin && (
                    <button
                      type="button"
                      onClick={() => setBaseUrlInput(currentOrigin)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                        cleanedBaseUrl === sanitizePublicBaseUrl(currentOrigin)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {lang === 'ne' ? 'हालको ब्राउजर' : 'Current URL'}
                    </button>
                  )}
                </div>
              </div>

              <input
                id="qr-host-url-input"
                type="url"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder="https://app.yourwebsite.com"
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono tabular-nums text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          )}

          {/* Active Encoded Link Readout */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-slate-500">
              {lang === 'ne' ? 'QR कोड भित्रको लिंक:' : 'Encoded QR Link'}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={targetUrl}
                placeholder={lang === 'ne' ? 'माथि .APK लिंक राख्नुहोस्...' : 'Paste URL above...'}
                onFocus={(e) => e.target.select()}
                aria-label="Encoded QR Code URL"
                className="flex-1 min-w-0 min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono tabular-nums text-[11px] text-slate-800 select-all"
              />
              <button
                type="button"
                disabled={!targetUrl}
                onClick={() => void handleCopyUrl()}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-xs whitespace-nowrap shrink-0 transition-colors"
              >
                {copiedUrl ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {copiedUrl
                    ? lang === 'ne'
                      ? 'कपी भयो'
                      : 'Copied'
                    : lang === 'ne'
                    ? 'लिंक कपी'
                    : 'Copy Link'}
                </span>
              </button>
            </div>
            {shareFeedback && (
              <p className="text-[11px] text-amber-800 font-medium">{shareFeedback}</p>
            )}
          </div>

          {/* Availability Notice for Shared vs Dev URLs */}
          {(isSelectedUrlDev || (isSelectedUrlAiStudioShared && isRunningOnDevOrigin)) && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-950 leading-relaxed">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                {isSelectedUrlDev
                  ? lang === 'ne'
                    ? 'यो टेस्टिङ / localhost लिंक भएकोले अरूको मोबाइलबाट नखुल्न सक्छ — बाहिरबाट खोल्न "सार्वजनिक URL" छान्नुहोस्।'
                    : 'Localhost / dev preview links are not reachable from external phones. Switch to Published URL for mobile scanning.'
                  : lang === 'ne'
                  ? 'यो सार्वजनिक लिंक सबै मोबाइलमा खुल्न माथि दायाँपट्टि रहेको "Share App" एकपटक पब्लिस गरेको हुनुपर्छ।'
                  : 'Make sure you have clicked "Share App" in the top-right once so the published link loads cleanly on mobile.'}
              </span>
            </div>
          )}

          {/* Action Buttons Row */}
          <div className="pt-2 border-t border-slate-200 flex items-center flex-wrap gap-2">
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download={downloadFilename}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{lang === 'ne' ? 'QR PNG डाउनलोड' : 'Download QR PNG'}</span>
              </a>
            )}

            {canNativeShare && targetUrl && (
              <button
                type="button"
                onClick={() => void handleNativeShare()}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <Share2 className="h-4 w-4 text-slate-600 shrink-0" />
                <span>{lang === 'ne' ? 'सेयर गर्नुहोस्' : 'Share Link'}</span>
              </button>
            )}

            {onOpenDownloadPortal && (
              <button
                type="button"
                onClick={onOpenDownloadPortal}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  {lang === 'ne' ? 'डाउनलोड पेज खोल्नुहोस्' : 'Open Download Page'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface MobileAccessQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  lang: Language;
  androidApkUrl?: string;
  onSaveAndroidApkUrl?: (apkUrl: string) => void;
  onOpenDownloadPortal?: () => void;
}

export const MobileAccessQRModal: React.FC<MobileAccessQRModalProps> = ({
  isOpen,
  onClose,
  businessName,
  lang,
  androidApkUrl,
  onSaveAndroidApkUrl,
  onOpenDownloadPortal
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-qr-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Clean Single-Row Modal Header */}
        <div className="px-5 py-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="mobile-qr-modal-title"
                className="text-sm sm:text-base font-bold text-white truncate"
              >
                {lang === 'ne'
                  ? 'मोबाइल पहुँच र एप डाउनलोड QR'
                  : 'Mobile Access & App Download QR'}
              </h2>
              <p className="text-xs text-slate-300 truncate">
                {businessName || 'Himalayan Breeze POS'}
                {' · '}
                {lang === 'ne' ? 'स्क्यान गरेर तुरुन्तै खोल्नुहोस् / .APK डाउनलोड गर्नुहोस्' : 'Scan to install or download .APK'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'ne' ? 'बन्द गर्नुहोस्' : 'Close QR modal'}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6">
          <MobileAccessQRPanel
            businessName={businessName}
            lang={lang}
            androidApkUrl={androidApkUrl}
            onSaveAndroidApkUrl={onSaveAndroidApkUrl}
            compactHeader
            onOpenDownloadPortal={
              onOpenDownloadPortal
                ? () => {
                    onClose();
                    onOpenDownloadPortal();
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};
