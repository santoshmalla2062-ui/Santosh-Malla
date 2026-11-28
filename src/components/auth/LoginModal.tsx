import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  AlertCircle,
  X,
  CheckCircle2,
  QrCode,
  UserPlus,
  Eye,
  EyeOff,
  Languages,
  ArrowLeft,
  Mail,
  Loader2
} from 'lucide-react';
import { Session, StaffInvitation, StaffRole, StaffUser } from '../../types';
import { hashPinWithSalt, isKnownWeakPin, saveSession, validateProductionPin } from '../../services/security';
import { getVisibleDemoPinRoles, isMasterOwnerEmail } from '../../services/cloudSyncService';
import { Language } from '../../utils/translations';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface LoginModalProps {
  isOpen: boolean;
  staffUsers: StaffUser[];
  currentSession: Session | null;
  lang: Language;
  businessName?: string;
  businessLogoUrl?: string;
  onLanguageChange?: (lang: Language) => void;
  onLoginSuccess: (session: Session) => void;
  onClose?: () => void;
  isMandatory?: boolean;
  ownerControlLocked?: boolean;
  cloudUserEmail?: string | null;
  isGoogleAuthLoading?: boolean;
  isCloudConnecting?: boolean;
  cloudAuthError?: string | null;
  pendingInvitations?: StaffInvitation[];
  onGoogleSignIn?: () => Promise<void> | void;
  onEmailPasswordSignIn?: (
    email: string,
    password: string,
    rememberMe: boolean
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  onEmailPasswordSignUp?: (
    email: string,
    password: string,
    fullName: string,
    rememberMe: boolean
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  onSendPasswordReset?: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  onRotateStaffPin?: (staffId: string, newPin: string) => Promise<StaffUser | null> | void;
  onAcceptInviteCode?: (params: {
    inviteCode: string;
    username: string;
    fullName: string;
    pin: string;
  }) => Promise<{ success: boolean; error?: string; staffUser?: StaffUser }>;
  onOpenDownloadPortal?: () => void;
  onOpenMobileQR?: () => void;
  onClearCloudAuthError?: () => void;
}

const deriveUsernameFromInput = (nameOrEmail: string): string => {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  return base
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 24);
};

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  staffUsers,
  lang,
  businessName = 'CAFe Host',
  businessLogoUrl,
  onLanguageChange,
  onLoginSuccess,
  onClose,
  isMandatory = false,
  ownerControlLocked = true,
  cloudUserEmail = null,
  isGoogleAuthLoading = false,
  isCloudConnecting = false,
  cloudAuthError = null,
  pendingInvitations = [],
  onGoogleSignIn,
  onEmailPasswordSignIn,
  onEmailPasswordSignUp,
  onSendPasswordReset,
  onRotateStaffPin,
  onAcceptInviteCode,
  onOpenDownloadPortal,
  onOpenMobileQR,
  onClearCloudAuthError
}) => {
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { invite: '', email: '', name: '' };
    }
    try {
      const sp = new URLSearchParams(window.location.search);
      return {
        invite: (sp.get('invite') || '').trim().toUpperCase(),
        email: (sp.get('email') || '').trim().toLowerCase(),
        name: (sp.get('name') || '').trim()
      };
    } catch {
      return { invite: '', email: '', name: '' };
    }
  }, []);

  const rememberedEmail = useMemo(() => {
    if (urlParams.email && !isMasterOwnerEmail(urlParams.email)) return urlParams.email;
    try {
      const stored = (localStorage.getItem('hb_remembered_login_email') || '').trim();
      if (isMasterOwnerEmail(stored)) {
        localStorage.removeItem('hb_remembered_login_email');
        return '';
      }
      return stored;
    } catch {
      return '';
    }
  }, [urlParams.email]);

  const activeStaffUsers = staffUsers.filter((s) => s.isActive !== false);

  const [loginMode, setLoginMode] = useState<'email' | 'signup' | 'pin' | 'invite' | 'forgot'>(() =>
    urlParams.invite ? 'invite' : 'email'
  );

  // Email / Password state
  const [emailInput, setEmailInput] = useState(rememberedEmail);
  const [passwordInput, setPasswordInput] = useState('');
  const [signupFullName, setSignupFullName] = useState(urlParams.name);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState(rememberedEmail);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  // Staff PIN state
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    activeStaffUsers[0]?.id || staffUsers[0]?.id || ''
  );
  const [staffIdentifier, setStaffIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showDemoPins, setShowDemoPins] = useState(false);

  // Mandatory PIN rotation state
  const [pendingRotationStaff, setPendingRotationStaff] = useState<StaffUser | null>(null);
  const [rotationNewPin, setRotationNewPin] = useState('');
  const [rotationConfirmPin, setRotationConfirmPin] = useState('');
  const [isRotatingPin, setIsRotatingPin] = useState(false);

  // Invite code activation state (pre-filled from ?invite=&email=&name= deep link)
  const initialInviteName =
    urlParams.name || (urlParams.email ? urlParams.email.split('@')[0] : '');
  const [inviteCodeInput, setInviteCodeInput] = useState(urlParams.invite);
  const [inviteFullName, setInviteFullName] = useState(initialInviteName);
  const [inviteUsername, setInviteUsername] = useState(() =>
    initialInviteName ? deriveUsernameFromInput(initialInviteName) : ''
  );
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [invitePin, setInvitePin] = useState('');
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);

  // Safe exact-code match (only evaluates when full code is entered — zero enumeration risk)
  const matchedPendingInvite = useMemo(() => {
    const cleanCode = inviteCodeInput.trim().toUpperCase();
    if (cleanCode.length < 8) return undefined;
    return pendingInvitations.find(
      (inv) => inv.inviteCode.toUpperCase() === cleanCode && inv.status === 'PENDING'
    );
  }, [inviteCodeInput, pendingInvitations]);

  useEffect(() => {
    if (matchedPendingInvite) {
      if (!inviteFullName && matchedPendingInvite.emailOrPhone.includes('@')) {
        const suggested = matchedPendingInvite.emailOrPhone.split('@')[0];
        setInviteFullName(suggested);
        if (!usernameManuallyEdited) {
          setInviteUsername(deriveUsernameFromInput(suggested));
        }
      }
    }
  }, [matchedPendingInvite, inviteFullName, usernameManuallyEdited]);

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
  const userAgentStr = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isSocialInAppWebView = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger/i.test(userAgentStr);
  const isAndroidApkWebView = !isSocialInAppWebView && /;\s*wv\)/i.test(userAgentStr);
  const isEmbeddedWebView = isSocialInAppWebView || isAndroidApkWebView;

  const clearErrors = () => {
    setErrorMsg('');
    onClearCloudAuthError?.();
  };

  const switchMode = (next: 'email' | 'signup' | 'pin' | 'invite' | 'forgot') => {
    setLoginMode(next);
    clearErrors();
    setInfoMsg('');
    if (next === 'forgot' && !resetEmailInput && emailInput) {
      setResetEmailInput(emailInput);
    }
  };

  const handleKeypadPress = (val: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + val);
      clearErrors();
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    clearErrors();
  };

  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !passwordInput) {
      setErrorMsg(
        lang === 'ne'
          ? 'कृपया Email ID र Password प्रविष्ट गर्नुहोस्।'
          : 'Please enter your Email ID and Password.'
      );
      return;
    }
    if (!onEmailPasswordSignIn) {
      setErrorMsg(
        lang === 'ne'
          ? 'इमेल लग-इन उपलब्ध छैन। कृपया Google वा Staff PIN प्रयोग गर्नुहोस्।'
          : 'Email sign-in is unavailable. Please use Google Sign-In or Staff PIN.'
      );
      return;
    }

    setIsEmailLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await onEmailPasswordSignIn(cleanEmail, passwordInput, rememberMe);
      if (res.success) {
        if (res.message) setInfoMsg(res.message);
        setPasswordInput('');
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign in failed. Please try again.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleEmailSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    const cleanName = signupFullName.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg(
        lang === 'ne' ? 'कृपया सही Email ID राख्नुहोस्।' : 'Please enter a valid Email ID.'
      );
      return;
    }
    if (passwordInput.length < 6) {
      setErrorMsg(
        lang === 'ne'
          ? 'पासवर्ड कम्तीमा ६ अक्षरको राख्नुहोस्।'
          : 'Password must be at least 6 characters.'
      );
      return;
    }
    if (!onEmailPasswordSignUp) return;

    setIsEmailLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await onEmailPasswordSignUp(cleanEmail, passwordInput, cleanName, rememberMe);
      if (res.success) {
        setInfoMsg(
          res.message ||
            (lang === 'ne'
              ? 'खाता बन्यो! इनबक्सको लिंक क्लिक गरी Sign In बाट लग-इन गर्नुहोस्।'
              : 'Account created! Verify the link in your inbox, then sign in.')
        );
        setPasswordInput('');
        setLoginMode('email');
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not create email login.');
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg(
        lang === 'ne'
          ? 'कृपया सही Email ID प्रविष्ट गर्नुहोस्।'
          : 'Please enter a valid Email ID.'
      );
      return;
    }
    if (!onSendPasswordReset) return;

    setIsSendingReset(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await onSendPasswordReset(cleanEmail);
      if (res.success) {
        setInfoMsg(
          res.message ||
            (lang === 'ne'
              ? `पासवर्ड रिसेट लिंक ${cleanEmail} मा पठाइयो। कृपया इमेल जाँच गर्नुहोस्।`
              : `Password reset link sent to ${cleanEmail}. Check your inbox.`)
        );
      } else {
        setErrorMsg(res.error || 'Could not send password reset email.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send reset link.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (ownerControlLocked && !trimmedIdentifier) {
      setErrorMsg(
        lang === 'ne'
          ? 'कृपया Admin वा Manager ले दिएको Username वा Email प्रविष्ट गर्नुहोस्।'
          : 'Please enter your Admin or Manager-assigned Username or Email.'
      );
      return;
    }

    if (!selectedStaff) {
      setErrorMsg(
        lang === 'ne'
          ? 'यो खाता भेटिएन। कृपया Email/Google लग-इन वा Admin/Manager सँग सम्पर्क गर्नुहोस्।'
          : 'Staff account not found. Check your assigned username or sign in via Email/Google.'
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
          ? 'यो कर्मचारी खाता Owner वा Manager द्वारा निष्क्रिय गरिएको छ।'
          : 'This staff account has been disabled by Admin/Manager.'
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
        setErrorMsg(
          lang === 'ne' ? 'गलत PIN कोड! कृपया पुनः प्रयास गर्नुहोस्।' : 'Incorrect PIN. Please try again.'
        );
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
    const check = await validateProductionPin(trimmed, staffUsers, {
      excludeStaffId: pendingRotationStaff.id
    });
    if (!check.isValid) {
      setErrorMsg(check.error || 'Weak or duplicate PIN rejected.');
      return;
    }
    setIsRotatingPin(true);
    setErrorMsg('');
    try {
      const updatedUser =
        (await onRotateStaffPin(pendingRotationStaff.id, trimmed)) || pendingRotationStaff;
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
    const fname = inviteFullName.trim();
    const uname = (inviteUsername.trim() || deriveUsernameFromInput(fname)).trim();
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
        setLoginMode('email');
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

  const displayError = errorMsg || cloudAuthError;
  const emailBusy = isEmailLoading || isCloudConnecting;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-100/95 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-[430px] my-auto flex flex-col items-center">
        {/* Main Centered Dine Track Style Card */}
        <div className="relative w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 px-6 sm:px-8 pt-8 pb-6 space-y-5">
          {/* Optional Close Button when switching accounts */}
          {!isMandatory && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close login modal"
              className="absolute right-4 top-4 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          {/* Top Circular Brand Emblem + Headline */}
          <div className="flex flex-col items-center text-center space-y-3">
            {businessLogoUrl ? (
              <div className="h-16 w-16 rounded-full bg-orange-500 p-1 shadow-md shadow-orange-500/20 flex items-center justify-center overflow-hidden">
                <img
                  src={businessLogoUrl}
                  alt={businessName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full rounded-full object-cover bg-white"
                />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-slate-900 p-0.5 shadow-md shadow-slate-900/20 flex items-center justify-center overflow-hidden border border-amber-500/30">
                <img
                  src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
                  alt={businessName || 'CAFe Host'}
                  referrerPolicy="no-referrer"
                  className="h-full w-full rounded-xl object-cover"
                />
              </div>
            )}

            <div className="space-y-1 max-w-xs">
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {pendingRotationStaff
                  ? lang === 'ne'
                    ? 'नयाँ सुरक्षा PIN सेट गर्नुहोस्'
                    : 'Update Security PIN'
                  : loginMode === 'forgot'
                  ? lang === 'ne'
                    ? 'पासवर्ड रिसेट गर्नुहोस्'
                    : 'Reset Password'
                  : loginMode === 'invite'
                  ? lang === 'ne'
                    ? 'निमन्त्रणा स्वीकार गर्नुहोस्'
                    : 'Join with Invite'
                  : loginMode === 'signup'
                  ? lang === 'ne'
                    ? `${businessName} खाता सेटअप`
                    : `Activate Email Login`
                  : lang === 'ne'
                  ? `${businessName} मा लग-इन`
                  : `Log In to ${businessName}`}
              </h2>
              <p className="text-sm text-slate-500 leading-snug">
                {pendingRotationStaff
                  ? lang === 'ne'
                    ? 'अगाडि बढ्न बलियो व्यक्तिगत PIN बनाउनुहोस्।'
                    : 'Set a unique personal PIN to continue.'
                  : loginMode === 'forgot'
                  ? lang === 'ne'
                    ? 'पासवर्ड रिसेट लिंक पाउन इमेल प्रविष्ट गर्नुहोस्।'
                    : 'Enter your registered email to receive a reset link.'
                  : loginMode === 'invite'
                  ? lang === 'ne'
                    ? 'आफ्नो PIN सेट गरेर तुरुन्त ड्यासबोर्ड खोल्नुहोस्।'
                    : 'Set your quick POS PIN to activate your role immediately.'
                  : loginMode === 'signup'
                  ? lang === 'ne'
                    ? 'Admin/Manager ले अनुमति दिएको इमेलमा पासवर्ड बनाउनुहोस्।'
                    : 'Create a password for your Admin/Manager-invited email.'
                  : lang === 'ne'
                  ? 'फेरि स्वागत छ। सेवा सुरु गर्न साइन इन गर्नुहोस्।'
                  : 'Welcome back. Sign in to pick up the service.'}
              </p>
            </div>
          </div>

          {isCloudConnecting && !displayError && (
            <div className="flex items-center gap-2.5 text-xs font-semibold text-orange-900 bg-orange-50 px-3.5 py-2.5 rounded-2xl border border-orange-200">
              <Loader2 className="h-4 w-4 shrink-0 text-orange-500 animate-spin" />
              <span className="truncate">
                {cloudUserEmail && !isMasterOwnerEmail(cloudUserEmail)
                  ? lang === 'ne'
                    ? `${cloudUserEmail} को कार्यक्षेत्र जोडिँदैछ...`
                    : `Restoring workspace for ${cloudUserEmail}...`
                  : lang === 'ne'
                  ? 'कार्यक्षेत्र जोडिँदैछ...'
                  : 'Restoring workspace...'}
              </span>
            </div>
          )}

          {/* Clean Mode Switcher for Email Auth (Sign In vs First-Time Email Setup) */}
          {!pendingRotationStaff && (loginMode === 'email' || loginMode === 'signup') && onEmailPasswordSignUp && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => switchMode('email')}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                  loginMode === 'email'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'ne' ? 'साइन इन (Sign In)' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                  loginMode === 'signup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'ne' ? 'नयाँ इमेल सेटअप' : 'First-Time Email'}
              </button>
            </div>
          )}

          {/* Mandatory PIN Rotation Flow */}
          {pendingRotationStaff ? (
            <form onSubmit={handleConfirmPinRotation} className="space-y-4 pt-1">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 leading-relaxed">
                {lang === 'ne'
                  ? `${pendingRotationStaff.name} खातामा डिफल्ट वा कमजोर PIN प्रयोग भएको छ। कृपया ४–८ अंकको नयाँ PIN राख्नुहोस्।`
                  : `Account "${pendingRotationStaff.name}" is using a default or weak PIN. Set a unique 4–8 digit PIN to unlock.`}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  {lang === 'ne' ? 'नयाँ PIN (४–८ अंक)' : 'New PIN (4–8 digits)'}
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
                  className="w-full min-h-[46px] px-4 py-3 border-2 border-slate-200 focus:border-orange-500 focus:outline-none rounded-2xl font-mono text-center tracking-widest text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  {lang === 'ne' ? 'नयाँ PIN पुनः राख्नुहोस्' : 'Confirm New PIN'}
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
                  className="w-full min-h-[46px] px-4 py-3 border-2 border-slate-200 focus:border-orange-500 focus:outline-none rounded-2xl font-mono text-center tracking-widest text-base"
                />
              </div>

              {displayError && (
                <div className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 p-3 rounded-2xl border border-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPendingRotationStaff(null);
                    setErrorMsg('');
                  }}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-semibold text-sm transition-colors"
                >
                  {lang === 'ne' ? 'पछाडि' : 'Back'}
                </button>
                <button
                  type="submit"
                  disabled={rotationNewPin.length < 4 || isRotatingPin}
                  className="flex-1 min-h-[44px] py-2.5 px-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-45 text-white rounded-full font-semibold text-sm shadow-sm transition-colors"
                >
                  {isRotatingPin
                    ? lang === 'ne' ? 'सुरक्षित गर्दै...' : 'Saving...'
                    : lang === 'ne' ? 'PIN सेभ गरी लग-इन' : 'Save PIN & Continue'}
                </button>
              </div>
            </form>
          ) : loginMode === 'email' ? (
            /* PRIMARY VIEW — Fast Email & Google Login */
            <form onSubmit={handleEmailLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email-id"
                  className="block text-sm font-semibold text-slate-800 mb-1.5"
                >
                  {lang === 'ne' ? 'इमेल ID (Email ID)' : 'Email ID'}
                </label>
                <input
                  id="login-email-id"
                  type="email"
                  autoComplete="email"
                  autoFocus={!emailInput}
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    clearErrors();
                    setInfoMsg('');
                  }}
                  placeholder="you@restaurant.com"
                  className="w-full min-h-[46px] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-semibold text-slate-800 mb-1.5"
                >
                  {lang === 'ne' ? 'पासवर्ड (Password)' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    autoFocus={Boolean(emailInput)}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      clearErrors();
                      setInfoMsg('');
                    }}
                    placeholder={lang === 'ne' ? 'आफ्नो पासवर्ड राख्नुहोस्' : 'Enter your password'}
                    className="w-full min-h-[46px] pl-4 pr-12 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me + Forgot Password Row */}
              <div className="flex items-center justify-between text-sm pt-0.5">
                <label className="inline-flex items-center gap-2.5 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-slate-300 text-orange-500 accent-orange-500 focus:ring-orange-500 cursor-pointer"
                  />
                  <span className="text-slate-700 font-medium">
                    {lang === 'ne' ? 'मलाई सम्झनुहोस्' : 'Remember Me'}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="min-h-[36px] text-orange-500 hover:text-orange-600 font-semibold transition-colors whitespace-nowrap"
                >
                  {lang === 'ne' ? 'पासवर्ड बिर्सनुभयो?' : 'Forgot Password?'}
                </button>
              </div>

              {/* Alerts */}
              {isEmbeddedWebView && (
                <div className="flex items-start gap-2 text-xs font-medium text-amber-900 bg-amber-50 p-3 rounded-2xl border border-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {isAndroidApkWebView
                      ? lang === 'ne'
                        ? 'Android App WebView भित्र Google पपअप रोकिएमा माथिको Email र Password (वा "नयाँ इमेल सेटअप") बाट लग-इन गर्नुहोस्।'
                        : 'If Google Sign-In popup is restricted inside the Android App WebView, sign in directly with Email & Password above (or tap "First-Time Email").'
                      : lang === 'ne'
                      ? 'Messenger भित्र Google लग-इन र App Install चल्दैन — माथि ⋮ थिचेर "Open in Chrome" गर्नुहोस्।'
                      : 'Google Sign-In & App Install do not work inside Messenger — tap ⋮ and open in Chrome or Safari.'}
                  </span>
                </div>
              )}

              {displayError && (
                <div className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 p-3 rounded-2xl border border-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              {infoMsg && (
                <div className="flex items-start gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{infoMsg}</span>
                </div>
              )}

              {/* Primary Orange Log In Button */}
              <button
                type="submit"
                disabled={emailBusy}
                className="w-full min-h-[48px] bg-orange-500 hover:bg-orange-600 active:scale-[0.99] disabled:opacity-60 text-white rounded-full font-semibold text-base shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
              >
                {emailBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {isCloudConnecting
                    ? lang === 'ne' ? 'कार्यस्थल खुल्दैछ...' : 'Opening Workspace...'
                    : isEmailLoading
                    ? lang === 'ne' ? 'लग-इन हुँदैछ...' : 'Logging in...'
                    : lang === 'ne' ? 'लग-इन गर्नुहोस्' : 'Log in'}
                </span>
              </button>

              {/* Google Sign-In Option */}
              {onGoogleSignIn && (
                <>
                  <div className="relative flex items-center py-0.5">
                    <div className="flex-grow border-t border-slate-200" />
                    <span className="shrink-0 mx-3 text-xs text-slate-400 font-medium">
                      {lang === 'ne' ? 'वा' : 'or'}
                    </span>
                    <div className="flex-grow border-t border-slate-200" />
                  </div>

                  <button
                    type="button"
                    disabled={isGoogleAuthLoading || isCloudConnecting}
                    onClick={() => onGoogleSignIn()}
                    className="w-full min-h-[44px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-full font-semibold text-sm transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>
                      {isGoogleAuthLoading || isCloudConnecting
                        ? lang === 'ne' ? 'Google जोडिँदैछ...' : 'Connecting Google...'
                        : lang === 'ne' ? 'Google बाट १-क्लिक लग-इन' : 'Continue with Google'}
                    </span>
                  </button>
                </>
              )}

              {/* Floor Staff PIN & Invite Switcher Footer */}
              <div className="pt-3 border-t border-slate-100 text-center space-y-2">
                <p className="text-sm text-slate-600 leading-relaxed">
                  {lang === 'ne' ? 'फ्लोरमा अर्डर लिँदै हुनुहुन्छ? ' : 'Taking orders on the floor? '}
                  <button
                    type="button"
                    onClick={() => switchMode('pin')}
                    className="text-orange-500 hover:text-orange-600 font-semibold transition-colors"
                  >
                    {lang === 'ne' ? 'आफ्नो Staff PIN बाट लग-इन गर्नुहोस्' : 'Log in with your staff PIN'}
                  </button>
                </p>
                {onAcceptInviteCode && (
                  <div>
                    <button
                      type="button"
                      onClick={() => switchMode('invite')}
                      className="min-h-[36px] text-xs font-semibold text-slate-600 hover:text-orange-600 underline transition-colors"
                    >
                      {lang === 'ne' ? 'Invite Code छ? यहाँ सक्रिय गर्नुहोस्' : 'Have an Invite Code? Activate here'}
                    </button>
                  </div>
                )}
              </div>
            </form>
          ) : loginMode === 'signup' ? (
            /* FIRST-TIME INVITED EMAIL PASSWORD SETUP */
            <form onSubmit={handleEmailSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  {lang === 'ne' ? 'तपाईंको पूरा नाम' : 'Full Name'}
                </label>
                <input
                  type="text"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  placeholder={lang === 'ne' ? 'उदा. सीता गुरुङ' : 'e.g. Sita Gurung'}
                  className="w-full min-h-[44px] px-4 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  {lang === 'ne' ? 'निमन्त्रित इमेल (Invited Email) *' : 'Invited Email ID *'}
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    clearErrors();
                  }}
                  placeholder="staff@restaurant.com"
                  className="w-full min-h-[44px] px-4 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  {lang === 'ne' ? 'नयाँ पासवर्ड राख्नुहोस् (६+ अक्षर) *' : 'Create Password (6+ chars) *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      clearErrors();
                    }}
                    placeholder={lang === 'ne' ? 'कम्तीमा ६ अक्षर' : 'At least 6 characters'}
                    className="w-full min-h-[44px] pl-4 pr-12 py-2.5 text-sm bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {displayError && (
                <div className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 p-3 rounded-2xl border border-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isEmailLoading}
                className="w-full min-h-[48px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-full font-semibold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isEmailLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>
                  {isEmailLoading
                    ? lang === 'ne' ? 'खाता बन्दैछ...' : 'Creating Login...'
                    : lang === 'ne' ? 'इमेल पासवर्ड सेट गरी पठाउनुहोस्' : 'Set Password & Verify Email'}
                </span>
              </button>
            </form>
          ) : loginMode === 'forgot' ? (
            /* FORGOT PASSWORD VIEW */
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  {lang === 'ne' ? 'दर्ता गरिएको इमेल (Registered Email)' : 'Registered Email ID'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={resetEmailInput}
                    onChange={(e) => {
                      setResetEmailInput(e.target.value);
                      clearErrors();
                      setInfoMsg('');
                    }}
                    placeholder="you@restaurant.com"
                    className="w-full min-h-[46px] pl-10 pr-4 py-3 text-sm bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                {lang === 'ne'
                  ? 'नोट: यदि तपाईं PIN-मात्र प्रयोग गर्ने स्टाफ हुनुहुन्छ भने Admin वा Manager बाट नयाँ PIN रिसेट गराउनुहोस्।'
                  : 'Note: Staff who sign in with a PIN only can ask their Admin or Manager to reset their PIN.'}
              </p>

              {displayError && (
                <div className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 p-3 rounded-2xl border border-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              {infoMsg && (
                <div className="flex items-start gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-3 rounded-2xl border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingReset}
                className="w-full min-h-[48px] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-full font-semibold text-sm shadow-md shadow-orange-500/20 transition-all"
              >
                {isSendingReset
                  ? lang === 'ne' ? 'लिंक पठाउँदै...' : 'Sending reset link...'
                  : lang === 'ne' ? 'रिसेट लिंक पठाउनुहोस्' : 'Send Password Reset Link'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('email')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-500 hover:text-orange-600 min-h-[40px]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{lang === 'ne' ? 'Email लग-इनमा फर्कनुहोस्' : 'Back to Email Login'}</span>
                </button>
              </div>
            </form>
          ) : loginMode === 'invite' && onAcceptInviteCode ? (
            /* FAST INVITE CODE ACTIVATION VIEW */
            <form onSubmit={handleSubmitInviteCode} className="space-y-3.5">
              {matchedPendingInvite ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === 'ne'
                      ? `कोड मान्य छ · भूमिका: ${matchedPendingInvite.role} (${businessName})`
                      : `Invite verified · Assigned Role: ${matchedPendingInvite.role}`}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl p-3 leading-relaxed">
                  {lang === 'ne'
                    ? 'Admin वा Manager ले दिएको कोड (INV-XXXXXX) र आफ्नो ४–८ अंकको PIN राखी तुरुन्त खाता खोल्नुहोस्।'
                    : 'Enter the code from your Admin or Manager (INV-XXXXXX) and set a PIN to open your dashboard immediately.'}
                </p>
              )}

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
                    clearErrors();
                  }}
                  placeholder="INV-XXXXXX"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono font-bold tracking-wider bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'तपाईंको पूरा नाम *' : 'Full Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteFullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInviteFullName(val);
                      if (!usernameManuallyEdited) {
                        setInviteUsername(deriveUsernameFromInput(val));
                      }
                      clearErrors();
                    }}
                    placeholder={lang === 'ne' ? 'सीता गुरुङ' : 'Sita Gurung'}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
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
                      setUsernameManuallyEdited(true);
                      setInviteUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''));
                      clearErrors();
                    }}
                    placeholder="sita"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ne'
                    ? 'आफ्नो सुरक्षा PIN सेट गर्नुहोस् (४–८ अंक) *'
                    : 'Set Quick POS PIN (4–8 digits) *'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  autoFocus={Boolean(urlParams.invite && inviteFullName)}
                  value={invitePin}
                  onChange={(e) => {
                    setInvitePin(e.target.value.replace(/\D/g, ''));
                    clearErrors();
                  }}
                  placeholder="••••••"
                  className="w-full min-h-[46px] px-3.5 py-2.5 text-base font-mono text-center tracking-widest bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                />
              </div>

              {displayError && (
                <div className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 p-2.5 rounded-2xl border border-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isAcceptingInvite}
                className="w-full min-h-[48px] bg-orange-500 hover:bg-orange-600 disabled:opacity-45 text-white rounded-full font-semibold text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  {isAcceptingInvite
                    ? lang === 'ne' ? 'सक्रिय गर्दै...' : 'Activating...'
                    : lang === 'ne' ? 'सक्रिय गरी भित्र जानुहोस्' : 'Activate & Open Workspace'}
                </span>
              </button>

              <div className="pt-1 text-center space-y-1">
                <button
                  type="button"
                  onClick={() => switchMode('email')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 min-h-[36px]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>
                    {lang === 'ne'
                      ? 'Email / Google बाट लग-इन गर्न फर्कनुहोस्'
                      : 'Sign in with Email or Google instead'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* STAFF PIN KEYPAD VIEW */
            <form onSubmit={handlePinSubmit} className="space-y-3.5">
              {ownerControlLocked ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'ne'
                      ? 'तपाईंको Username वा Email (Admin / Manager ले दिएको):'
                      : 'Staff Username or Email (Assigned by Admin / Manager):'}
                  </label>
                  <input
                    type="text"
                    autoComplete="username"
                    value={staffIdentifier}
                    onChange={(e) => {
                      setStaffIdentifier(e.target.value);
                      clearErrors();
                    }}
                    placeholder={lang === 'ne' ? 'उदा. waiter, cashier, ram...' : 'e.g. waiter, cashier, ram...'}
                    className="w-full min-h-[46px] px-3.5 py-2.5 text-sm font-medium bg-white border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {lang === 'ne' ? 'कर्मचारी रोज्नुहोस्:' : 'Select Staff Member:'}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
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
                            clearErrors();
                          }}
                          className={`min-h-[44px] p-2 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            isDisabled
                              ? 'opacity-45 bg-slate-100 border-slate-200 cursor-not-allowed'
                              : isSelected
                              ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20'
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-bold text-xs text-slate-900 block leading-tight truncate">
                            {user.name}
                          </span>
                          <div className="flex items-center justify-between mt-1">
                            <span
                              className={`inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${roleColorMap[user.role]}`}
                            >
                              {user.role}
                            </span>
                            {isDisabled && <span className="text-[9px] font-bold text-rose-600">Disabled</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PIN Dots & Keypad */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    {lang === 'ne' ? 'सुरक्षा PIN कोड:' : 'Staff PIN:'}
                  </label>
                  {selectedStaff && !ownerControlLocked && (
                    <span className="text-xs text-orange-700 font-bold">{selectedStaff.role}</span>
                  )}
                </div>

                <div className="flex justify-center items-center gap-3 py-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                  {Array.from({ length: Math.max(4, pin.length) })
                    .slice(0, 6)
                    .map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                          pin.length > idx
                            ? 'bg-orange-500 border-orange-500 scale-110'
                            : 'border-slate-300 bg-white'
                        }`}
                      />
                    ))}
                </div>

                {displayError && (
                  <div className="flex items-start gap-2 text-xs font-semibold text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{displayError}</span>
                  </div>
                )}

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
                      className={`min-h-[44px] py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        k === 'C'
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          : k === '⌫'
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-white border border-slate-200 text-slate-900 hover:bg-orange-50/50 shadow-2xs'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {/* Unprivileged Demo PINs — strictly hidden when Owner Control Lock is ON */}
                {visibleDemoPinRoles.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDemoPins((p) => !p)}
                      className="text-[11px] text-slate-500 hover:text-orange-600 flex items-center gap-1 underline"
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>
                        {showDemoPins
                          ? lang === 'ne' ? 'स्टाफ सर्टकट लुकाउनुहोस्' : 'Hide Staff Shortcuts'
                          : lang === 'ne' ? 'स्टाफ परीक्षण पिनहरू हेर्नुहोस्' : 'View Staff Demo PINs'}
                      </span>
                    </button>
                    {showDemoPins && (
                      <div className="mt-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 text-[10px] space-y-1">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono-num">
                          {visibleDemoPinRoles.map((demo) => (
                            <button
                              key={demo.role}
                              type="button"
                              onClick={() => {
                                const found = staffUsers.find(
                                  (s) => s.role === demo.role && s.isActive !== false
                                );
                                if (found) setSelectedStaffId(found.id);
                                setPin(demo.pin);
                                setErrorMsg('');
                              }}
                              className="px-2 py-1 bg-white hover:bg-orange-50 border border-slate-200 rounded-lg text-left flex items-center justify-between"
                            >
                              <span className="font-semibold text-slate-800">{demo.label}:</span>
                              <span className="font-bold text-orange-600">{demo.pin}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={pin.length < 4 || isVerifying}
                className="w-full min-h-[46px] bg-orange-500 hover:bg-orange-600 disabled:opacity-45 text-white rounded-full font-semibold text-sm shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {isVerifying
                    ? lang === 'ne' ? 'प्रमाणित गर्दै...' : 'Verifying...'
                    : lang === 'ne' ? 'PIN बाट लग-इन गर्नुहोस्' : 'Log in with PIN'}
                </span>
              </button>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => switchMode('email')}
                  className="inline-flex items-center gap-1 font-semibold text-orange-500 hover:text-orange-600 min-h-[36px] whitespace-nowrap"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>{lang === 'ne' ? 'Email लग-इन' : 'Back to Email Login'}</span>
                </button>
                {onAcceptInviteCode && (
                  <button
                    type="button"
                    onClick={() => switchMode('invite')}
                    className="font-semibold text-slate-600 hover:text-orange-600 underline min-h-[36px] whitespace-nowrap"
                  >
                    {lang === 'ne' ? 'Invite Code?' : 'Have Invite Code?'}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Bottom Language Switcher */}
          <div className="pt-2 flex items-center justify-center gap-2.5">
            <Languages className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <div className="inline-flex items-center p-1 rounded-xl border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => onLanguageChange?.('en')}
                className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange?.('ne')}
                className={`min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  lang === 'ne'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                नेपाली
              </button>
            </div>
          </div>
        </div>

        {/* Utility Bar Underneath Card */}
        {(onOpenMobileQR || onOpenDownloadPortal) && (
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap text-xs text-slate-500">
            <PWAInstallButton lang={lang} compact />
            {onOpenMobileQR && (
              <button
                type="button"
                onClick={onOpenMobileQR}
                className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600 font-semibold shadow-2xs transition-colors whitespace-nowrap"
              >
                <QrCode className="h-3.5 w-3.5 text-orange-500" />
                <span>{lang === 'ne' ? 'मोबाइल QR' : 'Mobile QR'}</span>
              </button>
            )}
            {onOpenDownloadPortal && (
              <button
                type="button"
                onClick={onOpenDownloadPortal}
                className="min-h-[38px] px-2 font-semibold text-slate-600 hover:text-orange-600 underline transition-colors whitespace-nowrap"
              >
                {lang === 'ne' ? 'डाउनलोड पेज' : 'Download Page'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
