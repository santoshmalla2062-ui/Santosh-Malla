import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  ExternalLink,
  Printer,
  QrCode,
  UtensilsCrossed,
  X
} from 'lucide-react';
import { BusinessSettings, MenuItem, TableRoom } from '../../types';
import { Language } from '../../utils/translations';
import { buildDigitalMenuUrl, resolveDefaultPublicAppUrl } from '../../utils/distribution';
import { sanitizeBusinessLogoUrl } from '../../utils/imageUtils';

interface DigitalMenuQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  settings: BusinessSettings;
  menuItems: MenuItem[];
  tablesRooms: TableRoom[];
  lang: Language;
  onPreviewMenu?: (tableName?: string) => void;
}

export const DigitalMenuQRModal: React.FC<DigitalMenuQRModalProps> = ({
  isOpen,
  onClose,
  businessId,
  settings,
  menuItems,
  tablesRooms,
  lang,
  onPreviewMenu
}) => {
  const diningTables = useMemo(
    () => tablesRooms.filter((tr) => tr.type === 'table' || tr.type === 'cottage'),
    [tablesRooms]
  );

  const [selectedTableName, setSelectedTableName] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const publicBaseUrl = useMemo(() => {
    if (settings.publicAppUrl) return settings.publicAppUrl;
    if (typeof window !== 'undefined') {
      return resolveDefaultPublicAppUrl(window.location.origin, '/');
    }
    return resolveDefaultPublicAppUrl();
  }, [settings.publicAppUrl]);

  const menuUrl = useMemo(
    () =>
      buildDigitalMenuUrl({
        baseUrl: publicBaseUrl,
        businessId,
        tableName: selectedTableName || undefined,
        businessName: settings.businessName,
        currencySymbol: settings.currencySymbol,
        menuItems
      }),
    [publicBaseUrl, businessId, selectedTableName, settings.businessName, settings.currencySymbol, menuItems]
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    QRCode.toDataURL(menuUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
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
  }, [isOpen, menuUrl]);

  if (!isOpen) return null;

  const businessLogo = sanitizeBusinessLogoUrl(settings.logoUrl);
  const availableMenuCount = menuItems.filter((m) => m.isAvailable !== false).length;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(menuUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none">
        {/* Header (hidden when printing) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {lang === 'ne' ? 'टेबल QR डिजिटल मेनु' : 'Table QR Digital Menu'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {availableMenuCount} {lang === 'ne' ? 'उपलब्ध परिकारहरू' : 'available menu items'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close QR Menu modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Table Picker (hidden when printing) */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-1.5 print:hidden">
          <label className="block text-[11px] font-bold text-slate-700">
            {lang === 'ne' ? 'टेबल छान्नुहोस् (Table Stand Label):' : 'Select Table Label (Optional):'}
          </label>
          <select
            value={selectedTableName}
            onChange={(e) => setSelectedTableName(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          >
            <option value="">{lang === 'ne' ? 'सबै टेबल / मुख्य काउन्टर' : 'General Menu (All Tables / Counter)'}</option>
            {diningTables.map((t) => (
              <option key={t.id} value={t.code ? `${t.code} · ${t.name}` : t.name}>
                {t.code ? `${t.code} · ${t.name}` : t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Printable Table Tent Card */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100/70 print:bg-white print:p-6">
          <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 w-full max-w-xs text-center shadow-sm space-y-3 print:shadow-none">
            <div className="flex flex-col items-center gap-1.5">
              {businessLogo ? (
                <img
                  src={businessLogo}
                  alt={settings.businessName || 'CAFE HOST'}
                  className="h-12 w-12 rounded-xl object-contain border border-slate-200 p-1"
                />
              ) : (
                <div className="h-11 w-11 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
              )}
              <h4 className="text-base font-black text-slate-950 tracking-tight uppercase">
                {settings.businessName || 'CAFE HOST'}
              </h4>
              {settings.tagline && (
                <p className="text-[11px] text-slate-500">{settings.tagline}</p>
              )}
            </div>

            {selectedTableName && (
              <div className="inline-block px-3 py-1 bg-amber-100 border border-amber-300 text-amber-950 rounded-lg text-xs font-black tracking-wide">
                {selectedTableName}
              </div>
            )}

            <div className="flex justify-center py-1">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Scan for Digital Menu"
                  className="w-48 h-48 rounded-xl border border-slate-200 p-1.5 bg-white"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="pt-1 border-t border-dashed border-slate-300">
              <p className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                {lang === 'ne' ? 'डिजिटल मेनु हेर्न स्क्यान गर्नुहोस्' : 'Scan for Digital Menu'}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {lang === 'ne'
                  ? 'मोबाइल क्यामेराबाट स्क्यान गरी परिकार र मूल्य हेर्नुहोस्'
                  : 'Point phone camera to browse today’s dishes & prices'}
              </p>
            </div>
          </div>

          {availableMenuCount === 0 && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 text-center print:hidden">
              {lang === 'ne'
                ? 'मेनु खाली छ। पहिले POS बाट परिकार थप्नुहोस्।'
                : 'No menu items added yet. Add dishes in Menu Manager so guests see your full menu.'}
            </p>
          )}
        </div>

        {/* Footer Actions (hidden when printing) */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? (lang === 'ne' ? 'कपी भयो' : 'Copied') : (lang === 'ne' ? 'लिंक कपी' : 'Copy Link')}</span>
            </button>
            {onPreviewMenu && (
              <button
                type="button"
                onClick={() => onPreviewMenu(selectedTableName || undefined)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{lang === 'ne' ? 'मेनु हेर्नुहोस्' : 'Preview Menu'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl transition-colors shadow-2xs"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>{lang === 'ne' ? 'QR कार्ड प्रिन्ट' : 'Print QR Card'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
