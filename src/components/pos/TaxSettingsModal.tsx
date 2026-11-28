import React, { useState } from 'react';
import { X, Percent, Check, Settings2, ShieldCheck, HelpCircle, DollarSign, Building } from 'lucide-react';
import { BusinessSettings } from '../../types';
import { Language } from '../../utils/translations';
import { NumberInput } from '../common/NumberInput';

interface TaxSettingsModalProps {
  settings: BusinessSettings;
  lang: Language;
  onClose: () => void;
  onSave: (updatedSettings: BusinessSettings) => void;
}

export const TaxSettingsModal: React.FC<TaxSettingsModalProps> = ({
  settings,
  lang,
  onClose,
  onSave
}) => {
  const [enableVat, setEnableVat] = useState(settings.enableVat);
  const [vatRate, setVatRate] = useState(settings.vatRatePercent || 13);
  const [enableSC, setEnableSC] = useState(settings.enableServiceCharge);
  const [scRate, setScRate] = useState(settings.serviceChargePercent || 10);
  const [panNumber, setPanNumber] = useState(settings.panVatNumber || '');

  // Quick Preset Helper
  const applyPreset = (preset: 'none' | 'sc_only' | 'vat_only' | 'both') => {
    switch (preset) {
      case 'none':
        setEnableVat(false);
        setEnableSC(false);
        break;
      case 'sc_only':
        setEnableVat(false);
        setEnableSC(true);
        setScRate(10);
        break;
      case 'vat_only':
        setEnableVat(true);
        setVatRate(13);
        setEnableSC(false);
        break;
      case 'both':
        setEnableVat(true);
        setVatRate(13);
        setEnableSC(true);
        setScRate(10);
        break;
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: BusinessSettings = {
      ...settings,
      enableVat,
      vatRatePercent: Number(vatRate) || 0,
      enableServiceCharge: enableSC,
      serviceChargePercent: Number(scRate) || 0,
      panVatNumber: panNumber.trim()
    };
    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight">
                {lang === 'ne' ? 'भ्याट तथा सर्भिस चार्ज सेटिङ (Tax & Charges)' : 'VAT & Service Charge Settings'}
              </h3>
              <p className="text-[11px] text-slate-300">
                {lang === 'ne' 
                  ? 'एडमिन वा म्यानेजरले बिलमा लागु हुने भ्याट र सर्भिस चार्ज निर्धारण वा बन्द गर्न सक्ने ठाउँ।' 
                  : 'Admin or Manager can enable, disable, or update VAT and Service Charge rates.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-xs">
          
          {/* Quick Presets */}
          <div>
            <label className="block font-bold text-slate-700 mb-2 uppercase text-[10px] tracking-wider">
              {lang === 'ne' ? '⚡ द्रुत प्रिसेट (Quick Presets):' : '⚡ Quick Presets:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('none')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  !enableVat && !enableSC
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30 font-bold'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <p className="font-extrabold text-xs">🚫 {lang === 'ne' ? 'कुनै कर/शुल्क नलाग्ने' : 'No Tax (0% VAT, 0% SC)'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{lang === 'ne' ? 'साना क्याफे/काउन्टरका लागि' : 'Direct menu price only'}</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('sc_only')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  !enableVat && enableSC
                    ? 'border-amber-600 bg-amber-50 text-amber-950 ring-2 ring-amber-500/30 font-bold'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <p className="font-extrabold text-xs">🍽️ {lang === 'ne' ? '१०% सर्भिस चार्ज मात्र' : '10% SC Only (No VAT)'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{lang === 'ne' ? 'कर्मचारी सेवा शुल्क मात्र' : 'Service charge only'}</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('vat_only')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  enableVat && !enableSC
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/30 font-bold'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <p className="font-extrabold text-xs">🏛️ {lang === 'ne' ? '१३% भ्याट मात्र' : '13% VAT Only (No SC)'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{lang === 'ne' ? 'सरकारी कर मात्र' : 'Government VAT only'}</p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('both')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  enableVat && enableSC
                    ? 'border-purple-600 bg-purple-50 text-purple-950 ring-2 ring-purple-500/30 font-bold'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <p className="font-extrabold text-xs">🏨 {lang === 'ne' ? '१०% SC + १३% भ्याट' : 'Both (10% SC + 13% VAT)'}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{lang === 'ne' ? 'रिसोर्ट/ठूला रेस्टुरेन्ट' : 'Full hospitality billing'}</p>
              </button>
            </div>
          </div>

          {/* Detailed Toggle 1: Service Charge */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-extrabold text-slate-900 block text-xs">
                  {lang === 'ne' ? '१०% रेस्टुरेन्ट सर्भिस चार्ज (Service Charge)' : 'Service Charge (SC)'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {lang === 'ne' 
                    ? 'डाइन-इन अर्डरहरूमा लागु हुने सेवा शुल्क।' 
                    : 'Added only to dine-in table bills.'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSC}
                  onChange={(e) => setEnableSC(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {enableSC && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-600">दर (Rate %):</span>
                <NumberInput
                  min={0}
                  max={50}
                  value={scRate}
                  onValueChange={(val) => setScRate(val)}
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono-num font-bold text-xs"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>
            )}
          </div>

          {/* Detailed Toggle 2: Government VAT */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-extrabold text-slate-900 block text-xs">
                  {lang === 'ne' ? '१३% मूल्य अभिवृद्धि कर (Government VAT)' : 'Value Added Tax (VAT)'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {lang === 'ne' 
                    ? 'यदि तपाईंको व्यवसाय भ्याटमा दर्ता छैन भने यसलाई बन्द गर्न सक्नुहुन्छ।' 
                    : 'Turn off if your cafe/business is only PAN registered (non-VAT).'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableVat}
                  onChange={(e) => setEnableVat(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {enableVat && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-600">भ्याट दर (VAT Rate %):</span>
                <NumberInput
                  min={0}
                  max={50}
                  value={vatRate}
                  onValueChange={(val) => setVatRate(val)}
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded font-mono-num font-bold text-xs"
                />
                <span className="text-slate-500 font-bold">% (Nepal Standard: 13%)</span>
              </div>
            )}
          </div>

          {/* PAN / VAT Number */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {lang === 'ne' ? 'PAN / VAT दर्ता नम्बर (PAN/VAT No):' : 'PAN / VAT Number:'}
            </label>
            <input
              type="text"
              placeholder="e.g. 681294821"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono-num font-bold"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-200 rounded-lg"
            >
              {lang === 'ne' ? 'रद्द' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-black text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm"
            >
              {lang === 'ne' ? 'सेभ गर्नुहोस् (Save Settings)' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
