import React, { useState } from 'react';
import { Download, Smartphone, X, Share2 } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';
import { Language } from '../../utils/translations';

interface PWAInstallButtonProps {
  lang?: Language;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang = 'ne', compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title={lang === 'ne' ? 'मोबाइल वा डेस्कटपमा एप इन्स्टल गर्नुहोस्' : 'Install app to Home Screen'}
        className={`inline-flex items-center gap-1.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        }`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>{lang === 'ne' ? 'मोबाइल एप Install' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors ${
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>{lang === 'ne' ? 'iPhone मा राख्नुहोस्' : 'Install on iPhone'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-3 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  <span>{lang === 'ne' ? 'iPhone / iPad मा एप राख्ने तरिका' : 'Install on iPhone / iPad'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="text-xs text-slate-700 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>
                  {lang === 'ne' ? (
                    <>
                      तल Safari को <strong className="inline-flex items-center gap-1 text-slate-900"><Share2 className="h-3 w-3" /> Share</strong> बटनमा थिच्नुहोस्।
                    </>
                  ) : (
                    <>
                      Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                    </>
                  )}
                </li>
                <li>
                  {lang === 'ne' ? (
                    <>
                      तल स्क्रोल गरी <strong>Add to Home Screen</strong> मा थिचेर <strong>Add</strong> गर्नुहोस्।
                    </>
                  ) : (
                    <>
                      Scroll down and tap <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                    </>
                  )}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 py-2 text-xs font-bold text-white transition-colors"
              >
                {lang === 'ne' ? 'बुझें (Close)' : 'Got It'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{ lang?: Language }> = ({ lang = 'ne' }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg border border-amber-400">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>{lang === 'ne' ? 'अफलाइन मोड — क्यास डेटा चल्दैछ' : 'Offline Mode — Cached data active'}</span>
    </div>
  );
};
