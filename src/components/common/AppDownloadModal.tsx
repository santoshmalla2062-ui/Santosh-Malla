import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Share2,
  MoreVertical,
  ArrowRight,
  ShieldCheck,
  WifiOff,
  Receipt,
  ChefHat,
  Hotel,
  Copy,
  Check,
  X,
  Link2,
  Package
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Language } from '../../utils/translations';
import {
  buildAppDownloadUrl,
  resolveDefaultPublicAppUrl,
  sanitizeAndroidApkUrl
} from '../../utils/distribution';

interface AppDownloadModalProps {
  isOpen: boolean;
  businessName: string;
  tagline?: string;
  lang: Language;
  androidApkUrl?: string;
  onLanguageChange?: (lang: Language) => void;
  onContinueToApp: () => void;
  isSignedInSession?: boolean;
}

export const AppDownloadModal: React.FC<AppDownloadModalProps> = ({
  isOpen,
  businessName,
  tagline,
  lang,
  androidApkUrl,
  onLanguageChange,
  onContinueToApp,
  isSignedInSession = false
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isEmbeddedWebView, install } = usePWAInstall();
  const [installSuccessMsg, setInstallSuccessMsg] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);

  if (!isOpen) return null;

  const currentUrl =
    typeof window !== 'undefined' ? window.location.href : '';
  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const bizParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('biz') || undefined
      : undefined;
  const apkParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('apk') || undefined
      : undefined;
  const effectiveApkUrl = sanitizeAndroidApkUrl(apkParam || androidApkUrl || '');
  const shareableInstallUrl = buildAppDownloadUrl(
    resolveDefaultPublicAppUrl(currentOrigin),
    bizParam,
    effectiveApkUrl || undefined
  );

  const handleCopyShareableUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareableInstallUrl);
      setCopiedPublicLink(true);
      setTimeout(() => setCopiedPublicLink(false), 2500);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  const handleInstallClick = async () => {
    const accepted = await install();
    if (accepted) {
      setInstallSuccessMsg(true);
    }
  };

  const handleCopyCurrentUrl = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Clipboard blocked in restricted browser contexts
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Branded Hero Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <img
                src="/pwa-192x192.png"
                alt={businessName}
                className="h-14 w-14 rounded-2xl border border-white/15 shadow-lg bg-slate-800 shrink-0"
              />
              <div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded-md mb-1">
                  {lang === 'ne' ? 'आधिकारिक मोबाइल र डेस्कटप एप' : 'Official POS & Resort App'}
                </span>
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight leading-snug text-white">
                  {businessName || 'Himalayan Breeze POS'}
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  {tagline ||
                    (lang === 'ne'
                      ? 'Android, iPhone र Computer मा सिधै इन्स्टल गर्नुहोस्'
                      : 'Install directly on Android, iPhone & Desktop')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onLanguageChange && (
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => onLanguageChange('ne')}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      lang === 'ne' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    नेपाली
                  </button>
                  <button
                    type="button"
                    onClick={() => onLanguageChange('en')}
                    className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                      lang === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={onContinueToApp}
                aria-label="Close download page"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Core Capabilities Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-800 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Receipt className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>{lang === 'ne' ? 'POS बिलिङ' : 'POS Billing'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <ChefHat className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>{lang === 'ne' ? 'लाइभ KOT' : 'Live KOT'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Hotel className="h-3.5 w-3.5 text-sky-400 shrink-0" />
              <span>{lang === 'ne' ? 'रिसोर्ट / टेबल' : 'Rooms & Tables'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <WifiOff className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>{lang === 'ne' ? 'अफलाइन सपोर्ट' : 'Offline Ready'}</span>
            </div>
          </div>
        </div>

        {/* Body Install Actions */}
        <div className="p-5 sm:p-6 space-y-4">
          {isEmbeddedWebView && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2.5 text-xs">
              <div className="flex items-start gap-2 text-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {lang === 'ne'
                      ? 'Messenger / Facebook ब्राउजरबाट सिधै इन्स्टल हुँदैन'
                      : 'In-App Browser Detected (Messenger / Facebook / Instagram)'}
                  </p>
                  <p className="text-amber-900 mt-1 leading-relaxed">
                    {lang === 'ne'
                      ? 'माथि दायाँमा रहेको तीन थोप्ला (⋮) थिचेर "Open in Chrome" वा "Open in Safari" छान्नुहोस्, अनि तुरुन्तै एप डाउनलोड हुन्छ।'
                      : 'Tap the ⋮ menu in the top corner and select "Open in Chrome" (Android) or "Open in Safari" (iPhone) to install cleanly.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCurrentUrl}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 font-bold text-amber-950 transition-colors"
              >
                {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>
                  {copiedUrl
                    ? lang === 'ne'
                      ? 'लिंक कपी भयो — अब Chrome मा Paste गर्नुहोस्'
                      : 'Link Copied — Paste in Chrome or Safari'
                    : lang === 'ne'
                    ? 'Chrome मा खोल्न लिंक कपी गर्नुहोस्'
                    : 'Copy Link to Open in Chrome / Safari'}
                </span>
              </button>
            </div>
          )}

          {effectiveApkUrl && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-2">
              <a
                href={effectiveApkUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2.5 transition-all"
              >
                <Package className="h-5 w-5 shrink-0" />
                <span>
                  {lang === 'ne'
                    ? 'Android .APK फाइल डाउनलोड गर्नुहोस्'
                    : 'Download Android .APK Installer'}
                </span>
              </a>
              <p className="text-[11px] text-center text-emerald-900">
                {lang === 'ne'
                  ? 'डाउनलोड भएपछि फाइल खोलेर "Install" थिच्नुहोस् (Unknown sources अनुमति अन गर्नुहोस्)।'
                  : 'Open the downloaded .apk file and tap Install on your Android phone.'}
              </p>
            </div>
          )}

          {isInstalled || installSuccessMsg ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>
                  {lang === 'ne'
                    ? 'एप तपाईंको डिभाइसमा इन्स्टल भइसकेको छ!'
                    : 'App Installed on Your Device!'}
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {lang === 'ne'
                  ? 'अब तपाईं होम स्क्रिनको आइकनबाट वा तलको बटन थिचेर सिधै POS र क्लाउड सिंक चलाउन सक्नुहुन्छ।'
                  : 'Launch anytime from your home screen icon or continue directly into the app below.'}
              </p>
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleInstallClick()}
                className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2.5 transition-all"
              >
                <Download className="h-5 w-5 shrink-0" />
                <span>
                  {lang === 'ne'
                    ? 'अहिले नै मोबाइल / PC मा Download गर्नुहोस्'
                    : 'Download & Install App Now'}
                </span>
              </button>
              <p className="text-[11px] text-center text-slate-500">
                {lang === 'ne'
                  ? 'ब्राउजरले सिधै तपाईंको होम स्क्रिनमा एप राखिदिनेछ (कुनै Play Store चाहिँदैन)।'
                  : 'Installs cleanly onto your Home Screen or Desktop with offline support.'}
              </p>
            </div>
          ) : isIOS ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  {lang === 'ne'
                    ? 'iPhone / iPad (Safari) मा इन्स्टल गर्ने तरिका'
                    : 'How to Install on iPhone / iPad (Safari)'}
                </span>
              </div>
              <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>
                  {lang === 'ne' ? (
                    <>
                      तल Safari बारमा रहेको <strong className="inline-flex items-center gap-1 text-slate-900"><Share2 className="h-3.5 w-3.5 text-blue-600" /> Share</strong> बटनमा थिच्नुहोस्।
                    </>
                  ) : (
                    <>
                      Tap the <strong className="inline-flex items-center gap-1 text-slate-900"><Share2 className="h-3.5 w-3.5 text-blue-600" /> Share</strong> button in Safari&apos;s toolbar.
                    </>
                  )}
                </li>
                <li>
                  {lang === 'ne' ? (
                    <>
                      तल स्क्रोल गरी <strong>&ldquo;Add to Home Screen&rdquo;</strong> छान्नुहोस् र माथि <strong>Add</strong> थिच्नुहोस्।
                    </>
                  ) : (
                    <>
                      Scroll down, tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>, then tap <strong>Add</strong>.
                    </>
                  )}
                </li>
              </ol>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                {isAndroid ? (
                  <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <Monitor className="h-4 w-4 text-emerald-600 shrink-0" />
                )}
                <span>
                  {isAndroid
                    ? lang === 'ne'
                      ? 'Android Chrome मा इन्स्टल गर्ने २ सजिलो चरण'
                      : '2-Step Install on Android Chrome'
                    : lang === 'ne'
                    ? 'कम्प्युटर (Chrome / Edge) मा इन्स्टल गर्ने तरिका'
                    : 'Install on Desktop (Chrome / Edge)'}
                </span>
              </div>
              <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-4 leading-relaxed">
                {isAndroid ? (
                  <>
                    <li>
                      {lang === 'ne' ? (
                        <>
                          माथि दायाँपट्टि रहेको <strong className="inline-flex items-center gap-0.5 text-slate-900"><MoreVertical className="h-3.5 w-3.5" /> Chrome मेनु</strong> थिच्नुहोस्।
                        </>
                      ) : (
                        <>
                          Tap the <strong className="inline-flex items-center gap-0.5 text-slate-900"><MoreVertical className="h-3.5 w-3.5" /> Chrome menu</strong> in the top-right corner.
                        </>
                      )}
                    </li>
                    <li>
                      {lang === 'ne' ? (
                        <>
                          <strong>&ldquo;Install app&rdquo;</strong> वा <strong>&ldquo;Add to Home screen&rdquo;</strong> मा थिचेर Install गर्नुहोस्।
                        </>
                      ) : (
                        <>
                          Tap <strong>&ldquo;Install app&rdquo;</strong> (or <strong>&ldquo;Add to Home screen&rdquo;</strong>) to place it on your phone.
                        </>
                      )}
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      {lang === 'ne'
                        ? 'एड्रेस बारको दायाँ छेउमा देखिने Install आइकन (वा Chrome ⋮ -> Cast, save, and share -> Install page as app) थिच्नुहोस्।'
                        : 'Click the Install icon in the address bar (or browser menu -> Install app).'}
                    </li>
                    <li>
                      {lang === 'ne'
                        ? 'Install थिच्नेबित्तिकै Windows / Mac मा सिधै एप खुल्नेछ।'
                        : 'Click Install to launch in its own standalone desktop window.'}
                    </li>
                  </>
                )}
              </ol>
            </div>
          )}

          {/* Shareable App Link & Android .APK Export Option */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5 text-indigo-600" />
                <span>
                  {lang === 'ne'
                    ? 'स्टाफलाई पठाउने App Install लिंक'
                    : 'Shareable App Install Link'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleCopyShareableUrl()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors"
              >
                {copiedPublicLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>
                  {copiedPublicLink
                    ? lang === 'ne' ? 'लिंक कपी भयो!' : 'Copied!'
                    : lang === 'ne' ? 'लिंक कपी गर्नुहोस्' : 'Copy Link'}
                </span>
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={shareableInstallUrl}
              onFocus={(e) => e.target.select()}
              className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg font-mono text-[10px] text-slate-800 select-all"
            />
            <details className="text-[11px] text-slate-700 pt-0.5">
              <summary className="cursor-pointer font-bold text-indigo-900 flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>
                  {lang === 'ne'
                    ? 'छुट्टै Android .APK फाइल कसरी बनाउने? (१ मिनेट)'
                    : 'Need an Android .APK installer file? (1-Minute Guide)'}
                </span>
              </summary>
              <ol className="mt-2 space-y-1.5 list-decimal pl-4 text-slate-600 leading-relaxed">
                <li>
                  {lang === 'ne'
                    ? 'Android Chrome मा माथिको लिंक खोलेर "Install app" थिच्दा प्ले स्टोर वा छुट्टै APK बिना नै सिधै मोबाइलमा असली एप बन्छ।'
                    : 'Fastest way: Open the link in Android Chrome and tap "Install app" — Android creates a native standalone app without needing an .apk file.'}
                </li>
                <li>
                  {lang === 'ne'
                    ? 'नोट: Google AI Studio को "ais-pre-..." लिंकमा बाहिरी क्रलर (जस्तै pwabuilder.com) पस्न नपाउने भएकोले त्यहाँ "Missing Name" त्रुटि आउँछ।'
                    : 'Note: External tools like pwabuilder.com cannot bypass AI Studio authentication on "ais-pre-..." URLs (which triggers a "Missing Name" error).'}
                </li>
                <li>
                  {lang === 'ne'
                    ? 'यदि छुट्टै .apk फाइल नै बनाउने हो भने, build ("dist/") लाई Firebase Hosting / Vercel / Netlify वा आफ्नै पब्लिक वेबसाइटमा होस्ट गरेर त्यो पब्लिक URL pwabuilder.com मा हाल्नुहोस्।'
                    : 'To build a standalone .apk with pwabuilder.com, deploy the "dist/" folder to a public host (e.g. Firebase Hosting, Vercel, or Netlify) and paste that public URL into pwabuilder.com.'}
                </li>
              </ol>
            </details>
          </div>

          {/* Security Clarity Note */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              {lang === 'ne'
                ? 'एप सबैले डाउनलोड गर्न मिल्छ, तर व्यापारको बिलिङ र हिसाब Owner ले अनुमति दिएका कर्मचारी (Google / Invite Code / PIN) ले मात्र आ-आफ्नो Role अनुसार हेर्न पाउँछन्।'
                : 'Anyone can download and install this app; actual business data stays protected by Owner-approved Google, Invite Code & PIN role access.'}
            </span>
          </div>

          {/* Continue Action */}
          <button
            type="button"
            onClick={onContinueToApp}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <span>
              {isSignedInSession
                ? lang === 'ne'
                  ? 'ड्यासबोर्डमा फर्कनुहोस्'
                  : 'Return to Workspace'
                : lang === 'ne'
                ? 'एप खोल्नुहोस् / Staff Sign In गर्नुहोस्'
                : 'Open Web App / Staff Sign In'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
