import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  KeyRound,
  AlertCircle,
  X,
  CheckCircle2,
  Globe,
  QrCode,
  UserPlus
} from 'lucide-react';
import { Session, StaffRole, StaffUser } from '../../types';
import { hashPinWithSalt, isKnownWeakPin, saveSession, validateProductionPin } from '../../services/security';
import { getVisibleDemoPinRoles, MASTER_OWNER_EMAIL } from '../../services/cloudSyncService';
import { Language } from '../../utils/translations';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface LoginModalProps {
  isOpen: boolean;
  staffUsers: StaffUser[];
  currentSession: Session | null;
  lang: Language;
  onLoginSuccess: (session: Session) => void;
  onClose?: () => void;
  isMandatory?: boolean;
  ownerControlLocked?: boolean;
  cloudUserEmail?: string | null;
  isGoogleAuthLoading?: boolean;
  cloudAuthError?: string | null;
  onGoogleSignIn?: () => Promise<void> | void;
  onRotateStaffPin?: (staffId: string, newPin: string) => Promise<StaffUser | null> | void;
  onAcceptInviteCode?: (params: {
    inviteCode: string;
    username: string;
    fullName: string;
    pin: string;
  }) => Promise<{ success: boolean; error?: string; staffUser?: StaffUser }>;
  onOpenDownloadPortal?: () => void;
  onOpenMobileQR?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  staffUsers,
  currentSession,
  lang,
  onLoginSuccess,
  onClose,
  isMandatory = false,
  ownerControlLocked = true,
  cloudUserEmail = null,
  isGoogleAuthLoading = false,
  cloudAuthError = null,
  onGoogleSignIn,
  onRotateStaffPin,
  onAcceptInviteCode,
  onOpenDownloadPortal,
  onOpenMobileQR
}) => {
  const initialInviteParam =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('invite') || '').trim().toUpperCase()
      : '';
  const activeStaffUsers = staffUsers.filter((s) => s.isActive !== false);
  const [loginMode, setLoginMode] = useState<'signin' | 'invite'>(() =>
    initialInviteParam ? 'invite' : 'signin'
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    activeStaffUsers[0]?.id || staffUsers[0]?.id || ''
  );
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDemoPins, setShowDemoPins] = useState(false);
  const [pendingRotationStaff, setPendingRotationStaff] = useState<StaffUser | null>(null);
  const [rotationNewPin, setRotationNewPin] = useState('');
  const [rotationConfirmPin, setRotationConfirmPin] = useState('');
  const [isRotatingPin, setIsRotatingPin] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState(initialInviteParam);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePin, setInvitePin] = useState('');
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);

  if (!isOpen) return null;

  const trimmedIdentifier = staffIdentifier.trim().toLowerCase();
  const matchedByIdentifier = trimmedIdentifier
    ? staffUsers.find(
        (s) =>
          s.username.toLowerCase() === trimmedIdentifier ||
          (s.email && s.email.toLowerCase() === trimmedIdentifier) ||
          s.name.toLowerCase() === trimmedIdentifier
      )
    : undefined;

  const selectedStaff = ownerControlLocked
    ? matchedByIdentifier
    : staffUsers.find((s) => s.id === selectedStaffId) ||
      activeStaffUsers[0] ||
      staffUsers[0];

  const visibleDemoPinRoles = getVisibleDemoPinRoles(ownerControlLocked);
  const isEmbeddedWebView =
    typeof navigator !== 'undefined' &&
    /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger/i.test(navigator.userAgent || '');

  const handleKeypadPress = (val: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + val);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (ownerControlLocked && !trimmedIdentifier) {
      setErrorMsg(
        lang === 'ne'
          ? 'कृपया Admin ले दिएको Username वा Email प्रविष्ट गर्नुहोस्।'
          : 'Please enter your Admin-assigned Username or Email.'
      );
      return;
    }

    if (!selectedStaff) {
      setErrorMsg(
        lang === 'ne'
          ? 'यो खाता भेटिएन। कृपया Google बाट लग-इन गर्नुहोस् वा Admin सँग सम्पर्क गर्नुहोस्।'
          : 'Staff account not found. Use Google Sign-In or check your Admin-assigned username.'
      );
      return;
    }

    if (!pin.trim()) {
      setErrorMsg(lang === 'ne' ? 'कृपया PIN कोड प्रविष्ट गर्नुहोस्।' : 'Please enter security PIN.');
      return;
    }

    if (selectedStaff.isActive === false) {
      setErrorMsg(
        lang === 'ne'
          ? 'यो कर्मचारी खाता Owner द्वारा निष्क्रिय गरिएको छ।'
          : 'This staff account has been disabled by the Owner.'
      );
      setPin('');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const computedHash = await hashPinWithSalt(pin.trim(), selectedStaff.salt);
      if (computedHash === selectedStaff.pinHash) {
        if (
          ownerControlLocked &&
          onRotateStaffPin &&
          (selectedStaff.mustChangePin === true || isKnownWeakPin(pin.trim()))
        ) {
          setPendingRotationStaff(selectedStaff);
          setPin('');
          setRotationNewPin('');
          setRotationConfirmPin('');
          setErrorMsg('');
          return;
        }
        const session = saveSession(selectedStaff, 120);
        onLoginSuccess(session);
        setPin('');
        setStaffIdentifier('');
      } else {
        setErrorMsg(lang === 'ne' ? 'गलत PIN कोड! कृपया पुनः प्रयास गर्नुहोस्।' : 'Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch {
      setErrorMsg('Authentication error. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmPinRotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRotationStaff || !onRotateStaffPin) return;
    const trimmed = rotationNewPin.trim();
    if (trimmed !== rotationConfirmPin.trim()) {
      setErrorMsg(lang === 'ne' ? 'दुवै नयाँ PIN कोड मिलेनन्।' : 'Confirmation PIN does not match.');
      return;
    }
    const check = await validateProductionPin(trimmed, staffUsers, { excludeStaffId: pendingRotationStaff.id });
    if (!check.isValid) {
      setErrorMsg(check.error || 'Weak or duplicate PIN rejected.');
      return;
    }
    setIsRotatingPin(true);
    setErrorMsg('');
    try {
      const updatedUser = (await onRotateStaffPin(pendingRotationStaff.id, trimmed)) || pendingRotationStaff;
      const session = saveSession(updatedUser, 120);
      setPendingRotationStaff(null);
      setRotationNewPin('');
      setRotationConfirmPin('');
      setStaffIdentifier('');
      onLoginSuccess(session);
    } catch {
      setErrorMsg('Failed to update security PIN.');
    } finally {
      setIsRotatingPin(false);
    }
  };

  const handleSubmitInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAcceptInviteCode) return;
    const code = inviteCodeInput.trim().toUpperCase();
    const uname = inviteUsername.trim();
    const fname = inviteFullName.trim();
    const p = invitePin.trim();
    if (!code || !uname || !fname || p.length < 4) {
      setErrorMsg(
        lang === 'ne'
          ? 'कृपया Invite Code, पूरा नाम, Username र कम्तीमा ४ अंकको PIN राख्नुहोस्।'
          : 'Please enter Invite Code, Full Name, Username, and at least a 4-digit PIN.'
      );
      return;
    }
    const pinCheck = await validateProductionPin(p, staffUsers);
    if (!pinCheck.isValid) {
      setErrorMsg(pinCheck.error || 'Please choose a stronger unique 4–8 digit PIN.');
      return;
    }
    setIsAcceptingInvite(true);
    setErrorMsg('');
    try {
      const res = await onAcceptInviteCode({
        inviteCode: code,
        username: uname,
        fullName: fname,
        pin: p
      });
      if (res.success && res.staffUser) {
        const session = saveSession(res.staffUser, 120);
        setInviteCodeInput('');
        setInviteFullName('');
        setInviteUsername('');
        setInvitePin('');
        setLoginMode('signin');
        onLoginSuccess(session);
      } else {
        setErrorMsg(res.error || 'Invalid or expired invitation code.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to accept invitation.');
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  const roleColorMap: Record<StaffRole, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-900 border-purple-300 font-extrabold',
    OWNER: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
    ADMIN: 'bg-rose-50 text-rose-800 border-rose-300',
    MANAGER: 'bg-purple-50 text-purple-800 border-purple-300',
    CASHIER: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    WAITER: 'bg-blue-50 text-blue-800 border-blue-300',
    KITCHEN: 'bg-amber-50 text-amber-800 border-amber-300',
    RECEPTIONIST: 'bg-cyan-50 text-cyan-800 border-cyan-300',
    HOUSEKEEPING: 'bg-slate-100 text-slate-800 border-slate-300',
    ACCOUNTANT: 'bg-indigo-50 text-indigo-800 border-indigo-300',
    INVENTORY_STAFF: 'bg-teal-50 text-teal-800 border-teal-300',
    STAFF: 'bg-slate-100 text-slate-800 border-slate-300'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 my-auto">
        {/* Top Header - Fixed */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {lang === 'ne' ? 'कर्मचारी प्रमाणिकरण तथा लग-इन' : 'Staff Access & Authentication'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {ownerControlLocked
                  ? (lang === 'ne' ? 'Admin द्वारा तोकिएको भूमिकामा मात्र लग-इन अनुमति छ' : 'Single Admin-Assigned Role Enforced')
                  : 'Role-Based Access Control (RBAC) System'}
              </p>
            </div>
          </div>
          {!isMandatory && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close login modal"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Scrollable Form Body */}
        {pendingRotationStaff ? (
          <form onSubmit={handleConfirmPinRotation} className="p-5 overflow-y-auto flex-1 space-y-4 min-h-0">
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-amber-950 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-amber-700" />
                <span>
                  {lang === 'ne' ? 'सुरक्षा PIN परिवर्तन अनिवार्य छ' : 'Production Security: Change Default PIN'}
                </span>
              </div>
              <p className="text-[11px] text-amber-900">
                {lang === 'ne'
                  ? `${pendingRotationStaff.name} खातामा अझै डिफल्ट वा कमजोर PIN प्रयोग भएको छ। अगाडि बढ्न ४–८ अंकको नयाँ सुरक्षित PIN राख्नुहोस्।`
                  : `Account "${pendingRotationStaff.name}" is using a factory-default or weak PIN. Set a unique 4–8 digit PIN to continue.`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ne' ? 'नयाँ सुरक्षित PIN (४–८ अंक):' : 'New Strong PIN (4–8 digits):'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                required
                value={rotationNewPin}
                onChange={(e) => {
                  setRotationNewPin(e.target.value.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                placeholder="••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center tracking-widest text-base"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ne' ? 'नयाँ PIN पुनः प्रविष्ट गर्नुहोस्:' : 'Confirm New PIN:'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                required
                value={rotationConfirmPin}
                onChange={(e) => {
                  setRotationConfirmPin(e.target.value.replace(/\D/g, ''));
                  setErrorMsg('');
                }}
                placeholder="••••••"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center tracking-widest text-base"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPendingRotationStaff(null);
                  setErrorMsg('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
              >
                {lang === 'ne' ? 'पछाडि' : 'Back'}
              </button>
              <button
                type="submit"
                disabled={rotationNewPin.length < 4 || isRotatingPin}
                className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-sm"
              >
                {isRotatingPin
                  ? (lang === 'ne' ? 'सुरक्षित गर्दै...' : 'Updating PIN...')
                  : (lang === 'ne' ? 'नयाँ PIN सेभ गरी लग-इन गर्नुहोस्' : 'Save New PIN & Unlock')}
              </button>
            </div>
          </form>
        ) : (
        <div className="overflow-y-auto flex-1 min-h-0 flex flex-col">
          {onAcceptInviteCode && (
            <div className="px-4 pt-3 pb-1 flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('signin');
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                  loginMode === 'signin'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {lang === 'ne' ? 'Google / PIN लग-इन' : 'Google / PIN Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('invite');
                  setErrorMsg('');
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border inline-flex items-center justify-center gap-1.5 transition-colors ${
                  loginMode === 'invite'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{lang === 'ne' ? 'Invite Code राख्नुहोस्' : 'Have Invite Code?'}</span>
              </button>
            </div>
          )}

          {loginMode === 'invite' && onAcceptInviteCode ? (
            <form onSubmit={handleSubmitInviteCode} className="p-4 space-y-3">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-950 leading-relaxed">
                {lang === 'ne'
                  ? 'Owner ले दिएको Invitation Code (जस्तै INV-XXXXXX) राख्नुहोस् — तपाईंको तोकिएको भूमिका (Role) अनुसार सिधै ड्यासबोर्ड खुल्नेछ।'
                  : 'Enter your Admin-issued Invitation Code (e.g. INV-XXXXXX) to activate your account and open your assigned role dashboard.'}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'निमन्त्रणा कोड (Invite Code) *' : 'Invitation Code *'}
                </label>
                <input
                  type="text"
                  required
                  value={inviteCodeInput}
                  onChange={(e) => {
                    setInviteCodeInput(e.target.value.toUpperCase());
                    setErrorMsg('');
                  }}
                  placeholder="INV-XXXXXX"
                  className="w-full px-3 py-2 text-xs font-mono font-bold tracking-wider bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'पूरा नाम *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteFullName}
                    onChange={(e) => {
                      setInviteFullName(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="Sita Gurung"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'Username *' : 'Username *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteUsername}
                    onChange={(e) => {
                      setInviteUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
                      setErrorMsg('');
                    }}
                    placeholder="sita"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'आफ्नो सुरक्षा PIN सेट गर्नुहोस् (४–८ अंक) *' : 'Create Your Security PIN (4–8 digits) *'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={invitePin}
                  onChange={(e) => {
                    setInvitePin(e.target.value.replace(/\D/g, ''));
                    setErrorMsg('');
                  }}
                  placeholder="••••••"
                  className="w-full px-3 py-2 text-sm font-mono text-center tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isAcceptingInvite}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {isAcceptingInvite
                    ? (lang === 'ne' ? 'सक्रिय गर्दै...' : 'Activating Account...')
                    : (lang === 'ne' ? 'Invite स्वीकार गरी ड्यासबोर्ड खोल्नुहोस्' : 'Accept Invite & Open Role Dashboard')}
                </span>
              </button>
            </form>
          ) : (
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Google Cloud Sync & Master Owner / Invited Staff Login */}
          {onGoogleSignIn && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{lang === 'ne' ? 'Google खाता लग-इन (Owner र स्टाफ)' : 'Google Sign-In (Owner & Invited Staff)'}</span>
                </div>
                {cloudUserEmail && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="truncate max-w-[120px]">{cloudUserEmail}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={isGoogleAuthLoading}
                onClick={() => onGoogleSignIn()}
                className="w-full py-2.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 rounded-xl font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  {isGoogleAuthLoading
                    ? (lang === 'ne' ? 'Google प्रमाणित गर्दै...' : 'Connecting Google...')
                    : (lang === 'ne' ? 'Google बाट लग-इन गर्नुहोस्' : 'Continue with Google')}
                </span>
              </button>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                {lang === 'ne'
                  ? `App Creator वा Business Owner ले तपाईंको Gmail लाई जुन भूमिका (Role) दिनुभएको छ, सोही भूमिकामा मात्र स्वचालित लग-इन हुनेछ।`
                  : `Signing in with Google logs in the App Creator (${MASTER_OWNER_EMAIL}) with global SUPER_ADMIN sync, or locks client terminals to their assigned role.`}
              </p>

              {isEmbeddedWebView && (
                <div className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {lang === 'ne'
                      ? 'Messenger भित्र Google लग-इन र App Install चल्दैन — माथि ⋮ थिचेर "Open in Chrome" गर्नुहोस्।'
                      : 'Google Sign-In & Install do not work inside Messenger browser — tap ⋮ and choose "Open in Chrome" or Safari.'}
                  </span>
                </div>
              )}

              {cloudAuthError && (
                <div className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{cloudAuthError}</span>
                </div>
              )}
            </div>
          )}

          {/* Staff Identification: Hidden cards when Owner Control Lock is ON */}
          {ownerControlLocked ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ne' ? 'तपाईंको Username वा Email (Admin ले दिएको):' : 'Staff Username or Email (Assigned by Admin):'}
              </label>
              <input
                type="text"
                autoComplete="username"
                value={staffIdentifier}
                onChange={(e) => {
                  setStaffIdentifier(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={lang === 'ne' ? 'उदा. waiter, cashier, ram...' : 'e.g. waiter, cashier, manager...'}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                {lang === 'ne'
                  ? 'प्रत्येक कर्मचारीले आफ्नो तोकिएको खाता र पिनबाट मात्र लग-इन गर्न सक्छन्।'
                  : 'Staff cards & other role shortcuts are hidden for security. You can only log into your assigned account.'}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ne' ? 'कर्मचारी तथा पद रोज्नुहोस् (Select Staff Member):' : 'Select Staff Member:'}
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {staffUsers.map((user) => {
                  const isSelected = selectedStaff?.id === user.id;
                  const isDisabled = user.isActive === false;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        setSelectedStaffId(user.id);
                        setPin('');
                        setErrorMsg('');
                      }}
                      className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        isDisabled
                          ? 'opacity-45 bg-slate-100 border-slate-200 cursor-not-allowed'
                          : isSelected
                          ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs text-slate-900 block leading-tight truncate">
                          {user.name}
                        </span>
                        {user.nepaliName && (
                          <span className="text-[10px] text-slate-500 block leading-tight truncate mt-0.5">
                            {user.nepaliName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${roleColorMap[user.role]}`}>
                          {user.role}
                        </span>
                        {isDisabled && (
                          <span className="text-[9px] font-bold text-rose-600">Disabled</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PIN Input & Dots */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                {lang === 'ne' ? 'सुरक्षा PIN कोड (Enter PIN):' : 'Security PIN:'}
              </label>
              {selectedStaff && !ownerControlLocked && (
                <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Role: {selectedStaff.role}
                </span>
              )}
            </div>

            {/* PIN Display Dots (4 to 6 digits) */}
            <div className="flex justify-center items-center gap-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
              {Array.from({ length: Math.max(4, pin.length) }).slice(0, 6).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                    pin.length > idx
                      ? 'bg-slate-900 border-slate-900 scale-110'
                      : 'border-slate-300 bg-white'
                  }`}
                />
              ))}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Keypad - Compact */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    if (k === 'C') setPin('');
                    else if (k === '⌫') handleBackspace();
                    else handleKeypadPress(k);
                  }}
                  className={`py-2 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                    k === 'C'
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      : k === '⌫'
                      ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      : 'bg-white border border-slate-200 text-slate-900 hover:bg-slate-100 shadow-2xs'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Unprivileged Testing PIN Helper — Hidden completely when Owner Control Lock is ON */}
            {visibleDemoPinRoles.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowDemoPins(p => !p)}
                  className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 underline"
                >
                  <KeyRound className="h-3 w-3" />
                  <span>{showDemoPins ? 'Hide Staff Shortcuts' : (lang === 'ne' ? 'स्टाफ परीक्षण पिनहरू हेर्नुहोस्' : 'View Staff Demo PINs')}</span>
                </button>
                {showDemoPins && (
                  <div className="mt-1 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold mb-1">
                      {lang === 'ne' ? '१-क्लिक स्टाफ चयन (Owner PIN गोप्य राखिएको छ):' : '1-Click Staff Quick Fill (Owner PIN stays confidential):'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono-num text-slate-700">
                      {visibleDemoPinRoles.map((demo) => (
                        <button
                          key={demo.role}
                          type="button"
                          onClick={() => {
                            const found = staffUsers.find(s => s.role === demo.role && s.isActive !== false);
                            if (found) setSelectedStaffId(found.id);
                            setPin(demo.pin);
                            setErrorMsg('');
                          }}
                          className="px-2 py-1 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded text-left flex items-center justify-between transition-colors shadow-2xs"
                        >
                          <span className="font-semibold text-slate-800">{demo.label}:</span>
                          <span className="font-bold text-emerald-800">{demo.pin}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit & Explicit Cancel Row */}
          <div className="flex items-center gap-2 pt-1">
            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
              >
                {lang === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
              </button>
            )}
            <button
              type="submit"
              disabled={pin.length < 4 || isVerifying}
              className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{isVerifying ? (lang === 'ne' ? 'प्रमाणित गर्दै...' : 'Verifying...') : (lang === 'ne' ? 'लग-इन गर्नुहोस् (Unlock)' : 'Unlock Assigned Role')}</span>
            </button>
          </div>
        </form>
          )}
        </div>
        )}

        {/* Security Guidance Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>{lang === 'ne' ? 'सुरक्षित SHA-256 प्रमाणिकरण' : 'Encrypted SHA-256 Authentication'}</span>
          </span>
          <div className="flex items-center gap-2">
            <PWAInstallButton lang={lang} compact />
            {onOpenMobileQR && (
              <button
                type="button"
                onClick={onOpenMobileQR}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 hover:text-slate-950 bg-white border border-slate-300 px-2 py-1 rounded-lg shadow-2xs transition-colors"
              >
                <QrCode className="h-3 w-3 text-emerald-700" />
                <span>{lang === 'ne' ? 'मोबाइल QR' : 'Mobile QR'}</span>
              </button>
            )}
            {onOpenDownloadPortal && (
              <button
                type="button"
                onClick={onOpenDownloadPortal}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline"
              >
                {lang === 'ne' ? 'डाउनलोड पेज' : 'Download Page'}
              </button>
            )}
            <span className="text-slate-400">
              {lang === 'ne' ? 'पिन गोप्य राख्नुहोस्' : 'Confidential PIN'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
