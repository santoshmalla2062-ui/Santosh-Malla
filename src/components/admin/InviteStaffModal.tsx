import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Mail,
  Send,
  Check,
  Copy,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  KeyRound,
  ArrowRight,
  Link2,
  Share2,
  User,
  QrCode,
  CloudCheck,
  MessageSquare
} from 'lucide-react';
import { StaffInvitation, StaffRole, StaffUser } from '../../types';
import { acceptStaffInvitation, createStaffInvitation } from '../../services/tenantStorage';
import {
  canActorAssignRole,
  getAssignableRolesForActor,
  validateProductionPin
} from '../../services/security';
import { createCloudStaffInvite } from '../../services/cloudSyncService';
import { buildStaffInviteUrl, resolveDefaultPublicAppUrl } from '../../utils/distribution';
import { Language } from '../../utils/translations';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  currentStaff: { id: string; name: string };
  actorRole?: StaffRole;
  lang?: Language;
  existingStaffUsers?: StaffUser[];
  cloudSyncConnected?: boolean;
  cloudOwnerUid?: string | null;
  onInvitationCreated: (invitation: StaffInvitation) => void;
  onCloudInviteCreated?: () => void;
  onStaffActivated?: (newStaff: StaffUser) => void;
}

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({
  isOpen,
  onClose,
  businessId,
  businessName,
  currentStaff,
  actorRole,
  lang = 'en',
  existingStaffUsers = [],
  cloudSyncConnected = false,
  cloudOwnerUid = null,
  onInvitationCreated,
  onCloudInviteCreated,
  onStaffActivated
}) => {
  const assignableRoles = getAssignableRolesForActor(actorRole || 'ADMIN');
  const [staffNameInput, setStaffNameInput] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<StaffRole>(() =>
    assignableRoles.includes('WAITER') ? 'WAITER' : assignableRoles[0] || 'STAFF'
  );
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<StaffInvitation | null>(null);
  const [createdStaffName, setCreatedStaffName] = useState('');
  const [cloudSynced, setCloudSynced] = useState(false);
  const [cloudSyncNote, setCloudSyncNote] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedType, setCopiedType] = useState<'code' | 'link' | 'msg' | null>(null);

  // Quick on-device activation state
  const [showFastAccept, setShowFastAccept] = useState(false);
  const [acceptUsername, setAcceptUsername] = useState('');
  const [acceptFullName, setAcceptFullName] = useState('');
  const [acceptPin, setAcceptPin] = useState('');
  const [accepting, setAccepting] = useState(false);

  const isNe = lang === 'ne';

  const directInviteUrl = useMemo(() => {
    if (!createdInvite) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const baseUrl = resolveDefaultPublicAppUrl(origin);
    const contact = createdInvite.emailOrPhone.trim();
    return buildStaffInviteUrl({
      baseUrl,
      businessId,
      inviteCode: createdInvite.inviteCode,
      email: contact.includes('@') ? contact : undefined,
      name: createdStaffName || undefined
    });
  }, [createdInvite, businessId, createdStaffName]);

  useEffect(() => {
    let active = true;
    if (!directInviteUrl) {
      setQrDataUrl('');
      return () => {
        active = false;
      };
    }
    QRCode.toDataURL(directInviteUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
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
  }, [directInviteUrl]);

  if (!isOpen) return null;

  const isEmailContact = emailOrPhone.trim().includes('@');
  const canAutoSyncCloud = Boolean(cloudSyncConnected && cloudOwnerUid && isEmailContact);

  const resetAndClose = () => {
    setCreatedInvite(null);
    setCreatedStaffName('');
    setStaffNameInput('');
    setEmailOrPhone('');
    setError(null);
    setCloudSynced(false);
    setCloudSyncNote(null);
    setShowFastAccept(false);
    setAcceptPin('');
    onClose();
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const contact = emailOrPhone.trim();
    const cleanName = staffNameInput.trim();
    if (!contact) {
      setError(
        isNe
          ? 'कृपया कर्मचारीको Email वा मोबाइल नम्बर राख्नुहोस्।'
          : 'Please enter the staff email address or mobile number.'
      );
      return;
    }
    if (actorRole && !canActorAssignRole(actorRole, selectedRole)) {
      setError(
        isNe
          ? `अनुमति छैन: ${actorRole} ले ${selectedRole} भूमिका दिन मिल्दैन।`
          : `Permission denied: ${actorRole} cannot invite staff with role ${selectedRole}.`
      );
      return;
    }

    setIsCreating(true);
    setError(null);
    setCloudSynced(false);
    setCloudSyncNote(null);

    try {
      const invite = createStaffInvitation(
        businessId,
        businessName,
        contact,
        selectedRole,
        currentStaff
      );

      let syncedToCloud = false;
      let syncWarning: string | null = null;
      if (contact.includes('@') && cloudSyncConnected && cloudOwnerUid) {
        try {
          await createCloudStaffInvite({
            businessId,
            ownerUid: cloudOwnerUid,
            email: contact,
            staffName: cleanName || contact.split('@')[0] || 'Staff Member',
            role: selectedRole,
            actorRole
          });
          syncedToCloud = true;
          onCloudInviteCreated?.();
        } catch (cloudErr: any) {
          syncWarning =
            cloudErr?.message ||
            (isNe
              ? 'कोड बन्यो, तर Cloud Email सिंक अस्थायी रूपमा रोकियो।'
              : 'Invite code created, but Cloud Email sync could not be saved.');
        }
      }

      const derivedName =
        cleanName || (contact.includes('@') ? contact.split('@')[0] : 'New Staff');
      const derivedUser = (cleanName || (contact.includes('@') ? contact.split('@')[0] : contact))
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, '')
        .slice(0, 24) || 'staff';

      setCreatedStaffName(cleanName);
      setAcceptFullName(derivedName);
      setAcceptUsername(derivedUser);
      setCloudSynced(syncedToCloud);
      setCloudSyncNote(syncWarning);
      setCreatedInvite(invite);
      onInvitationCreated(invite);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate staff invitation.');
    } finally {
      setIsCreating(false);
    }
  };

  const buildShareMessage = () => {
    if (!createdInvite) return '';
    const displayRecipient = createdStaffName || createdInvite.emailOrPhone;
    const isEmail = createdInvite.emailOrPhone.includes('@');
    if (isNe) {
      return `नमस्ते ${displayRecipient},\n"${businessName}" मा तपाईंलाई ${createdInvite.role} भूमिकामा आमन्त्रण गरिएको छ।\n\n१) यो लिंक खोल्नुहोस्:\n${directInviteUrl}\n\n२) निमन्त्रणा कोड: ${createdInvite.inviteCode}${
        isEmail
          ? `\nवा यही इमेल (${createdInvite.emailOrPhone}) बाट Google / Email लग-इन गर्नुहोस्।`
          : ''
      }`;
    }
    return `Hi ${displayRecipient},\nYou're invited to "${businessName}" as ${createdInvite.role}.\n\n1) Open your quick join link:\n${directInviteUrl}\n\n2) Invite Code: ${createdInvite.inviteCode}${
      isEmail
        ? `\nOr sign in directly with Google / Email using ${createdInvite.emailOrPhone}.`
        : ''
    }`;
  };

  const copyText = async (value: string, type: 'code' | 'link' | 'msg') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setError(isNe ? 'क्लिपबोर्डमा कपी गर्न सकिएन।' : 'Could not copy to clipboard.');
    }
  };

  const handleNativeShare = async () => {
    if (!createdInvite) return;
    const message = buildShareMessage();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${businessName} — Staff Invite (${createdInvite.role})`,
          text: message,
          url: directInviteUrl
        });
        return;
      } catch {
        // User dismissed share sheet; fallback to clipboard
      }
    }
    await copyText(message, 'msg');
  };

  const handleFastAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdInvite) return;
    const uname = acceptUsername.trim();
    const fname = acceptFullName.trim();
    const p = acceptPin.trim();
    if (!uname || !fname || !p) {
      setError(
        isNe
          ? 'Username, पूरा नाम र कम्तीमा ४ अंकको PIN राख्नुहोस्।'
          : 'Username, full name, and 4–8 digit PIN are required.'
      );
      return;
    }

    const pinCheck = await validateProductionPin(p, existingStaffUsers);
    if (!pinCheck.isValid) {
      setError(pinCheck.error || 'Choose a stronger unique 4–8 digit PIN.');
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const res = await acceptStaffInvitation(
        businessId,
        createdInvite.inviteCode,
        uname,
        fname,
        p
      );

      if (res.success && res.staffUser) {
        onStaffActivated?.(res.staffUser);
        resetAndClose();
      } else {
        setError(res.error || 'Failed to activate staff member.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error accepting invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const allRolesCatalog: { role: StaffRole; label: string; neLabel: string; desc: string }[] = [
    {
      role: 'ADMIN',
      label: 'Business Admin',
      neLabel: 'प्रशासक (Admin)',
      desc: 'Full workspace, staff & tax setup'
    },
    {
      role: 'MANAGER',
      label: 'Branch Manager',
      neLabel: 'म्यानेजर (Manager)',
      desc: 'Floor ops, discounts, day close & staff roles'
    },
    {
      role: 'CASHIER',
      label: 'Cashier',
      neLabel: 'क्यासियर (Cashier)',
      desc: 'POS billing, receipts & cash settlement'
    },
    {
      role: 'WAITER',
      label: 'Waiter / Service',
      neLabel: 'वेटर (Waiter)',
      desc: 'Tables, KOT orders & room charge'
    },
    {
      role: 'KITCHEN',
      label: 'Kitchen / Bar',
      neLabel: 'किचेन (Kitchen)',
      desc: 'KDS order preparation & readiness'
    },
    {
      role: 'RECEPTIONIST',
      label: 'Front Desk',
      neLabel: 'रिसेप्सन (Front Desk)',
      desc: 'Rooms, guest check-in & folios'
    },
    {
      role: 'HOUSEKEEPING',
      label: 'Housekeeping',
      neLabel: 'हाउसकिपिङ',
      desc: 'Room cleaning status & maintenance'
    },
    {
      role: 'ACCOUNTANT',
      label: 'Accountant',
      neLabel: 'लेखापाल (Accountant)',
      desc: 'Expenses, ledgers, day close & reports'
    },
    {
      role: 'INVENTORY_STAFF',
      label: 'Inventory Staff',
      neLabel: 'स्टक कर्मचारी',
      desc: 'Stock in/out & supplier entries'
    },
    {
      role: 'STAFF',
      label: 'General Staff',
      neLabel: 'सामान्य स्टाफ',
      desc: 'Basic POS floor order access'
    }
  ];
  const rolesList = allRolesCatalog.filter((r) => assignableRoles.includes(r.role));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={resetAndClose}
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isNe ? 'नयाँ स्टाफ निमन्त्रणा (Invite Staff)' : 'Invite Staff Member'}
              </h2>
              <p className="text-xs text-slate-500">
                {businessName}
                <span aria-hidden="true"> · </span>
                {actorRole || 'ADMIN'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close invite modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!createdInvite ? (
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {isNe ? 'कर्मचारीको नाम' : 'Staff Full Name'}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isNe ? 'उदा. सीता गुरुङ' : 'e.g. Sita Gurung'}
                      value={staffNameInput}
                      onChange={(e) => setStaffNameInput(e.target.value)}
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    {isNe ? 'इमेल वा मोबाइल नम्बर *' : 'Email or Mobile Number *'}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="staff@gmail.com / 98XXXXXXXX"
                      value={emailOrPhone}
                      onChange={(e) => {
                        setEmailOrPhone(e.target.value);
                        if (error) setError(null);
                      }}
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border-2 border-slate-200 rounded-2xl focus:border-orange-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {isEmailContact && (
                <div className="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
                  <CloudCheck
                    className={`h-4 w-4 shrink-0 ${
                      canAutoSyncCloud ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <span>
                    {canAutoSyncCloud
                      ? isNe
                        ? 'यो Gmail मा Cloud Access र छिटो Invite Code दुवै एकैपटक सक्रिय हुनेछन्।'
                        : 'Both Cloud Email/Google sign-in and a quick Invite Code will activate together.'
                      : isNe
                      ? 'स्थानीय Invite Code तयार हुनेछ (मोबाइल Cloud सिंक जोड्न Google लग-इन गर्नुहोस्)।'
                      : 'Creates a quick Invite Code now (connect Cloud Sync to also pre-authorize Gmail login).'}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  {isNe ? 'भूमिका (Role) छान्नुहोस् *' : 'Select Staff Role *'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {rolesList.map((r) => {
                    const active = selectedRole === r.role;
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => setSelectedRole(r.role)}
                        className={`min-h-[52px] p-3 rounded-2xl border-2 text-left transition-all flex items-start justify-between gap-2 ${
                          active
                            ? 'border-orange-500 bg-orange-50/70'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 truncate">
                            {isNe ? r.neLabel : r.label}
                          </p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                            {r.desc}
                          </p>
                        </div>
                        <span
                          className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            active ? 'border-orange-500 bg-orange-500' : 'border-slate-300'
                          }`}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    {isNe
                      ? `${businessName} मा मात्र सीमित पहुँच`
                      : `Scoped strictly to ${businessName}`}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-full shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {isCreating
                      ? isNe ? 'बनाउँदैछ...' : 'Creating...'
                      : isNe ? 'निमन्त्रणा बनाउनुहोस्' : 'Create Invitation'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Ready Invite Summary Card with QR & 1-Tap Copy */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                {qrDataUrl ? (
                  <div className="bg-white p-2 rounded-2xl border border-slate-200 shrink-0 flex flex-col items-center">
                    <img
                      src={qrDataUrl}
                      alt="Staff Invite QR Code"
                      className="h-28 w-28 object-contain"
                    />
                    <span className="text-[10px] font-semibold text-slate-500 mt-1 inline-flex items-center gap-1">
                      <QrCode className="h-3 w-3 text-orange-500" />
                      {isNe ? 'स्क्यान गरी जोइन' : 'Scan to Join'}
                    </span>
                  </div>
                ) : null}

                <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                  <div className="text-xs text-slate-500 font-medium">
                    {createdStaffName || createdInvite.emailOrPhone}
                    <span aria-hidden="true"> · </span>
                    <span className="font-bold text-slate-900">{createdInvite.role}</span>
                    {cloudSynced && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="text-emerald-700 font-bold">
                          {isNe ? 'Cloud Email सक्रिय' : 'Cloud Email Active'}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">
                    {isNe ? 'निमन्त्रणा तयार छ!' : 'Staff Invitation Ready!'}
                  </h3>

                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-mono text-lg font-extrabold text-slate-900 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 tracking-wider tabular-nums">
                      {createdInvite.inviteCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(createdInvite.inviteCode, 'code')}
                      className="min-h-[40px] px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      {copiedType === 'code' ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>{isNe ? 'कपी भयो' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{isNe ? 'कोड कपी' : 'Copy Code'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {cloudSyncNote && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  {cloudSyncNote}
                </div>
              )}

              {/* 1-Tap Share Action Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => copyText(buildShareMessage(), 'msg')}
                  className="min-h-[44px] px-3 py-2 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {copiedType === 'msg' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  <span>
                    {copiedType === 'msg'
                      ? isNe ? 'मेसेज कपी भयो' : 'Message Copied'
                      : isNe ? 'WhatsApp मेसेज कपी' : 'Copy Invite Message'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => copyText(directInviteUrl, 'link')}
                  className="min-h-[44px] px-3 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  {copiedType === 'link' ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Link2 className="h-4 w-4 text-orange-500" />
                  )}
                  <span>
                    {copiedType === 'link'
                      ? isNe ? 'लिंक कपी भयो' : 'Link Copied'
                      : isNe ? 'डाइरेक्ट लिंक कपी' : 'Copy Join Link'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="min-h-[44px] px-3 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-full transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Share2 className="h-4 w-4 text-orange-500" />
                  <span>{isNe ? 'सिधै पठाउनुहोस्' : 'Share Invite'}</span>
                </button>
              </div>

              {/* Quick Local POS Activation */}
              {!showFastAccept ? (
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {isNe ? 'यही डिभाइसमा तुरुन्त PIN सेट गर्ने?' : 'Activating on this POS tablet now?'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {isNe
                        ? 'स्टाफको Username र 4-अंकको PIN यहीँ बाट तुरुन्त खोल्नुहोस्।'
                        : 'Assign a Username and PIN right here for immediate floor login.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFastAccept(true)}
                    className="min-h-[40px] inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3.5 py-2 rounded-full transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{isNe ? 'तुरुन्त सक्रिय' : 'Activate Now'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleFastAccept}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                >
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-orange-500" />
                    <span>
                      {isNe ? 'स्टाफको PIN र Username सेट गर्नुहोस्' : 'Set Staff POS Login'}
                    </span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {isNe ? 'पूरा नाम *' : 'Full Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={acceptFullName}
                        onChange={(e) => setAcceptFullName(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-xs focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {isNe ? 'Username *' : 'Username *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={acceptUsername}
                        onChange={(e) =>
                          setAcceptUsername(
                            e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '')
                          )
                        }
                        className="w-full min-h-[40px] px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-xs font-mono focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {isNe ? 'सुरक्षा PIN (४–८ अंक) *' : 'Security PIN (4–8 digits) *'}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      required
                      placeholder="••••••"
                      value={acceptPin}
                      onChange={(e) => setAcceptPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full min-h-[40px] px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-sm font-mono tracking-widest focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowFastAccept(false)}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                      {isNe ? 'रद्द' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={accepting}
                      className="min-h-[38px] px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-2xs whitespace-nowrap"
                    >
                      {accepting
                        ? isNe ? 'सक्रिय गर्दै...' : 'Activating...'
                        : isNe ? 'सेभ गरी रोस्टरमा थप्नुहोस्' : 'Complete & Add to Roster'}
                    </button>
                  </div>
                </form>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="min-h-[40px] px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
                >
                  {isNe ? 'बन्द गर्नुहोस्' : 'Done'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
