import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Globe,
  Link2,
  Copy,
  Check,
  Code2,
  QrCode,
  Download,
  Eye,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Language } from '../../utils/translations';
import {
  SHARED_APP_URL,
  buildAppDownloadUrl,
  buildWebsiteDownloadSnippet,
  isLocalOrDevPreviewUrl,
  resolveDefaultPublicAppUrl,
  sanitizePublicBaseUrl
} from '../../utils/distribution';
import { PWAInstallButton } from './PWAInstallButton';

interface WebsiteLinkKitCardProps {
  businessName: string;
  lang: Language;
  onPreviewDownloadPage?: () => void;
}

export const WebsiteLinkKitCard: React.FC<WebsiteLinkKitCardProps> = ({
  businessName,
  lang,
  onPreviewDownloadPage
}) => {
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const isRunningOnDevOrigin = isLocalOrDevPreviewUrl(currentOrigin);

  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() =>
    resolveDefaultPublicAppUrl(currentOrigin)
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const cleanedBaseUrl = useMemo(() => sanitizePublicBaseUrl(customBaseUrl), [customBaseUrl]);
  const downloadUrl = useMemo(() => buildAppDownloadUrl(customBaseUrl), [customBaseUrl]);
  const htmlSnippet = useMemo(
    () => buildWebsiteDownloadSnippet(downloadUrl, businessName, lang),
    [downloadUrl, businessName, lang]
  );

  const isSelectedUrlDev = isLocalOrDevPreviewUrl(cleanedBaseUrl || customBaseUrl);
  const isSelectedUrlAiStudioShared = (cleanedBaseUrl || '').includes('ais-pre-');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(downloadUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [downloadUrl]);

  const handleCopyText = async (text: string, type: 'link' | 'html') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } else {
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2500);
      }
    } catch {
      // Clipboard API unavailable in non-secure / restricted browser
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4 text-xs">
      {/* Header Row */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-indigo-950 text-sm">
              {lang === 'ne'
                ? 'आफ्नो वेबसाइटमा राख्ने Download Link र HTML बटन'
                : 'Website Download Link, Embed Button & QR Kit'}
            </h4>
            <p className="text-[11px] text-indigo-800 mt-0.5 leading-relaxed">
              {lang === 'ne'
                ? 'यो लिंक वा HTML बटन तपाईंको वेबसाइटमा राख्नुहोस् — जो कोहीले क्लिक गरेर Android, iPhone वा Computer मा सिधै एप डाउनलोड (Install) गर्न सक्छन्।'
                : 'Place this link or HTML button on your website so anyone can click and install the app on Android, iPhone, or Desktop.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PWAInstallButton lang={lang} compact />
          {onPreviewDownloadPage && (
            <button
              type="button"
              onClick={onPreviewDownloadPage}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shadow-2xs transition-colors"
            >
              <Eye className="h-3.5 w-3.5 text-emerald-400" />
              <span>{lang === 'ne' ? 'Download पेज हेर्नुहोस्' : 'Preview Download Page'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Host Selector & Custom Website Domain Input */}
      <div className="p-3.5 bg-white rounded-xl border border-indigo-100 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="font-bold text-slate-800 text-[11px]">
            {lang === 'ne'
              ? '१. एप होस्ट भएको URL छान्नुहोस् (वा आफ्नै वेबसाइटको डोमेन लेख्नुहोस्):'
              : '1. Select Public App Host URL (or type your own hosted URL):'}
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setCustomBaseUrl(SHARED_APP_URL)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                cleanedBaseUrl === SHARED_APP_URL
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {lang === 'ne' ? 'सार्वजनिक Share URL' : 'Published Share URL'}
            </button>
            {currentOrigin && (
              <button
                type="button"
                onClick={() => setCustomBaseUrl(currentOrigin)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                  cleanedBaseUrl === sanitizePublicBaseUrl(currentOrigin)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {lang === 'ne' ? 'हालको ब्राउजर URL' : 'Current Preview URL'}
              </button>
            )}
          </div>
        </div>

        <input
          type="url"
          value={customBaseUrl}
          onChange={(e) => setCustomBaseUrl(e.target.value)}
          placeholder="https://app.yourwebsite.com"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
        />

        {isSelectedUrlAiStudioShared && isRunningOnDevOrigin && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {lang === 'ne'
                ? 'महत्त्वपूर्ण: वेबसाइटमा राख्नुअघि Google AI Studio को माथि दायाँपट्टि रहेको "Share App" बटन एकचोटी थिचेर एप पब्लिस गर्नुहोस्, नत्र यो लिंकले 404 देखाउँछ।'
                : 'Important: Click "Share App" in the top-right of Google AI Studio before publishing this link on your website so visitors do not see 404.'}
            </span>
          </div>
        )}

        {isSelectedUrlDev && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {lang === 'ne'
                ? 'सावधान: यो "ais-dev" वा localhost टेस्टिङ लिंक हो — तपाईंको वेबसाइटका सबै आगन्तुकका लागि "सार्वजनिक Share URL" वा आफ्नै होस्टिङ (Firebase Hosting / Vercel / Netlify) राख्नुहोस्।'
                : 'Note: Dev preview URLs are temporary for testing. Use the Published Share URL or host the build on your own website domain for public visitors.'}
            </span>
          </div>
        )}
      </div>

      {/* Step 2 & Step 4 Layout: Link + HTML Snippet on left, QR PNG on right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {/* Direct Download URL */}
          <div className="p-3.5 bg-white rounded-xl border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>
                  {lang === 'ne'
                    ? '२. वेबसाइटमा राख्ने सीधा Download लिंक:'
                    : '2. Direct Website Download Link:'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleCopyText(downloadUrl, 'link')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs transition-colors"
              >
                {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedLink ? (lang === 'ne' ? 'लिंक कपी भयो!' : 'Copied!') : (lang === 'ne' ? 'लिंक कपी गर्नुहोस्' : 'Copy Link')}</span>
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={downloadUrl}
              onFocus={(e) => e.target.select()}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-800 select-all"
            />
          </div>

          {/* Ready-to-Paste Website HTML Snippet */}
          <div className="p-3.5 bg-white rounded-xl border border-indigo-100 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>
                  {lang === 'ne'
                    ? '३. वेबसाइटको HTML / WordPress मा Paste गर्ने बटन कोड:'
                    : '3. Copy-Paste HTML Button Code for Your Website:'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleCopyText(htmlSnippet, 'html')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-2xs transition-colors"
              >
                {copiedHtml ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copiedHtml ? (lang === 'ne' ? 'HTML कपी भयो!' : 'HTML Copied!') : (lang === 'ne' ? 'HTML कोड कपी गर्नुहोस्' : 'Copy HTML Code')}</span>
              </button>
            </div>

            <pre className="p-2.5 bg-slate-900 text-emerald-300 rounded-lg text-[10px] font-mono overflow-x-auto leading-relaxed">
              {htmlSnippet}
            </pre>
          </div>
        </div>

        {/* Step 4: Scannable QR Code + Download PNG */}
        <div className="p-3.5 bg-white rounded-xl border border-indigo-100 flex flex-col items-center justify-between text-center space-y-2.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
            <QrCode className="h-3.5 w-3.5 text-indigo-600" />
            <span>{lang === 'ne' ? '४. मोबाइल स्क्यान QR कोड' : '4. Scan to Download QR'}</span>
          </div>

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Download App QR Code"
              className="w-36 h-36 rounded-xl border border-slate-200 p-1 bg-white shadow-2xs"
            />
          ) : (
            <div className="w-36 h-36 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[11px]">
              QR Loading...
            </div>
          )}

          <p className="text-[10px] text-slate-500 leading-snug">
            {lang === 'ne'
              ? 'वेबसाइट वा काउन्टरमा राख्न PNG डाउनलोड गर्नुहोस्'
              : 'Download QR image for your website or counter'}
          </p>

          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download="himalayan-breeze-download-qr.png"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] shadow-2xs transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>{lang === 'ne' ? 'QR PNG डाउनलोड' : 'Download QR PNG'}</span>
            </a>
          )}
        </div>
      </div>

      {/* Helpful Technical Clarification */}
      <details className="p-3 bg-white/80 rounded-xl border border-indigo-100 text-[11px] text-slate-700">
        <summary className="font-bold text-indigo-950 cursor-pointer flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          <span>
            {lang === 'ne'
              ? 'आफ्नै डोमेन (yourwebsite.com) मा राख्ने र Android .APK बनाउने जानकारी'
              : 'Hosting on your own domain & creating an optional Android .APK'}
          </span>
        </summary>
        <ul className="mt-2 space-y-1.5 pl-5 list-disc leading-relaxed text-slate-600">
          <li>
            {lang === 'ne'
              ? 'आफ्नै वेबसाइट डोमेनमा App चलाउँदा Google साइन-इन चल्न Firebase Console -> Authentication -> Settings -> Authorized Domains मा आफ्नो वेबसाइट डोमेन थप्नुहोस्।'
              : 'If you host the built app on your own website domain, add your domain to Firebase Console -> Authentication -> Settings -> Authorized Domains for Google Sign-In.'}
          </li>
          <li>
            {lang === 'ne'
              ? 'यो लिंकले Android, iPhone र PC मा प्ले स्टोरबिनै App Install गराउँछ। यदि वेबसाइटमा सिधै .apk फाइल नै राख्ने हो भने, यो एपलाई Firebase Hosting / Vercel / Netlify वा आफ्नै पब्लिक डोमेनमा होस्ट गरेर त्यो पब्लिक URL बाट pwabuilder.com मा १ मिनेटमै Android .apk प्याकेज तयार गर्न सकिन्छ (ais-pre लिंकमा pwabuilder ले लगइन पर्खाल भेट्टाउँछ)।'
              : 'This link installs natively on Android, iPhone, and Desktop. To generate a downloadable .apk via pwabuilder.com, host the build on a public domain (such as Firebase Hosting, Vercel, or Netlify) rather than an auth-gated AI Studio preview URL.'}
          </li>
        </ul>
      </details>
    </div>
  );
};
