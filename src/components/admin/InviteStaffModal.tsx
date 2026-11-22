import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Phone, 
  Send, 
  Check, 
  Copy, 
  ShieldCheck, 
  AlertCircle, 
  UserPlus, 
  KeyRound,
  ArrowRight,
  Link2
} from 'lucide-react';
import { StaffInvitation, StaffRole, StaffUser } from '../../types';
import { acceptStaffInvitation, createStaffInvitation } from '../../services/tenantStorage';
import { canActorAssignRole, getAssignableRolesForActor } from '../../services/security';
import { buildAppDownloadUrl, resolveDefaultPublicAppUrl } from '../../utils/distribution';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  currentStaff: { id: string; name: string };
  actorRole?: StaffRole;
  onInvitationCreated: (invitation: StaffInvitation) => void;
  onStaffActivated?: (newStaff: StaffUser) => void;
}

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({
  isOpen,
  onClose,
  businessId,
  businessName,
  currentStaff,
  actorRole,
  onInvitationCreated,
  onStaffActivated
}) => {
  const assignableRoles = getAssignableRolesForActor(actorRole || 'ADMIN');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [selectedRole, setSelectedRole] = useState<StaffRole>(() =>
    assignableRoles.includes('WAITER') ? 'WAITER' : (assignableRoles[0] || 'STAFF')
  );
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<StaffInvitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fast-acceptance state for demo/testing
  const [showFastAccept, setShowFastAccept] = useState(false);
  const [acceptUsername, setAcceptUsername] = useState('');
  const [acceptFullName, setAcceptFullName] = useState('');
  const [acceptPin, setAcceptPin] = useState('1234');
  const [accepting, setAccepting] = useState(false);

  if (!isOpen) return null;

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      setError('Please provide an email address or mobile phone number.');
      return;
    }
    if (actorRole && !canActorAssignRole(actorRole, selectedRole)) {
      setError(`Permission denied: ${actorRole} cannot invite staff with role ${selectedRole}.`);
      return;
    }

    try {
      const invite = createStaffInvitation(
        businessId,
        businessName,
        emailOrPhone.trim(),
        selectedRole,
        currentStaff
      );
      setCreatedInvite(invite);
      onInvitationCreated(invite);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate staff invitation.');
    }
  };

  const handleCopyCode = () => {
    if (!createdInvite) return;
    navigator.clipboard.writeText(createdInvite.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyInviteLink = () => {
    if (!createdInvite) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const baseDownload = buildAppDownloadUrl(resolveDefaultPublicAppUrl(origin), businessId);
    const fullInviteUrl = `${baseDownload}&invite=${encodeURIComponent(createdInvite.inviteCode)}`;
    navigator.clipboard.writeText(fullInviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleFastAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdInvite) return;
    if (!acceptUsername.trim() || !acceptFullName.trim() || !acceptPin.trim()) {
      setError('Username, full name and 4-digit PIN are required.');
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const res = await acceptStaffInvitation(
        businessId,
        createdInvite.inviteCode,
        acceptUsername.trim(),
        acceptFullName.trim(),
        acceptPin.trim()
      );

      if (res.success && res.staffUser) {
        if (onStaffActivated) {
          onStaffActivated(res.staffUser);
        }
        onClose();
      } else {
        setError(res.error || 'Failed to activate staff member.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error accepting invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const allRolesCatalog: { role: StaffRole; label: string; desc: string }[] = [
    { role: 'ADMIN', label: 'Business Administrator', desc: 'All business modules, staff management & configurations' },
    { role: 'MANAGER', label: 'Branch Manager', desc: 'Full business operations, staff scheduling, discounts & day close' },
    { role: 'CASHIER', label: 'Cashier / Counter Staff', desc: 'POS billing, receipts, cash collection & KOT routing' },
    { role: 'WAITER', label: 'Floor Service Staff', desc: 'Table ordering, KOT entry & room charge requests' },
    { role: 'KITCHEN', label: 'Kitchen & Bar Chef', desc: 'Kitchen display screen, order readiness & KOT status' },
    { role: 'RECEPTIONIST', label: 'Front Desk Reception', desc: 'Room booking, guest check-in, folios & settlements' },
    { role: 'HOUSEKEEPING', label: 'Housekeeping Staff', desc: 'Room cleaning status, linen changes & inspections' },
    { role: 'ACCOUNTANT', label: 'Accountant', desc: 'Expenses, day closes, ledger audits & tax exports' },
    { role: 'INVENTORY_STAFF', label: 'Inventory Controller', desc: 'Stock in/out, purchase bills & supplier logs' },
    { role: 'STAFF', label: 'General Staff', desc: 'Basic floor POS order taking & table checks' }
  ];
  const rolesList = allRolesCatalog.filter(r => assignableRoles.includes(r.role));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Invite Staff Member</h2>
              <p className="text-xs text-slate-500">
                Grant role-scoped access strictly to <span className="font-semibold text-slate-700">{businessName}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!createdInvite ? (
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recipient Email or Mobile Number *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text"
                    required
                    placeholder="staff@example.com or 98XXXXXXXX"
                    value={emailOrPhone}
                    onChange={e => {
                      setEmailOrPhone(e.target.value);
                      if (error) setError(null);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assigned Staff Role *
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {rolesList.map(r => (
                    <div
                      key={r.role}
                      onClick={() => setSelectedRole(r.role)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start justify-between transition-all ${
                        selectedRole === r.role 
                          ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-400' 
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900">{r.label}</p>
                        <p className="text-[11px] text-slate-500 leading-normal">{r.desc}</p>
                      </div>
                      <input 
                        type="radio" 
                        name="role_selection" 
                        checked={selectedRole === r.role} 
                        onChange={() => setSelectedRole(r.role)} 
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Cross-business access is strictly prevented</span>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Generate Invitation</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
                <Check className="h-7 w-7 text-emerald-600 mx-auto" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Invitation Created Successfully!
                </h3>
                <p className="text-xs text-slate-600">
                  Share this secure invitation code with {createdInvite.emailOrPhone}
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className="font-mono text-base font-extrabold text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs tracking-wider">
                    {createdInvite.inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                    title="Copy invite code"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors shadow-2xs"
                    title="Copy app + invite link"
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
                    <span>{copiedLink ? 'Link Copied' : 'Copy Link'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 text-left leading-relaxed mt-2">
                  <strong>Note:</strong> This code is not emailed automatically — copy the code or link and share it manually. On another mobile phone, use <strong>Mobile Gmail Sync (Authorize Gmail)</strong> in the Security tab so it syncs via Cloud.
                </p>
              </div>

              {/* Fast Acceptance Demo Action */}
              {!showFastAccept ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">Test Immediate Activation</span>
                    <span className="text-[11px] text-slate-500">Simulate staff accepting this invitation right now</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowFastAccept(true);
                      setAcceptFullName(createdInvite.emailOrPhone.split('@')[0] || 'New Staff');
                      setAcceptUsername(createdInvite.emailOrPhone.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'staff');
                    }}
                    className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-100/70 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <span>Activate Now</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleFastAccept} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-indigo-600" />
                    <span>Set Staff Login Credentials</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Username *</label>
                      <input 
                        type="text" 
                        required 
                        value={acceptUsername} 
                        onChange={e => setAcceptUsername(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs" 
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Full Name *</label>
                      <input 
                        type="text" 
                        required 
                        value={acceptFullName} 
                        onChange={e => setAcceptFullName(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Security PIN (4-Digits) *</label>
                    <input 
                      type="password" 
                      maxLength={6} 
                      required 
                      value={acceptPin} 
                      onChange={e => setAcceptPin(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono tracking-widest" 
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowFastAccept(false)}
                      className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={accepting}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                    >
                      {accepting ? 'Activating...' : 'Complete & Add to Roster'}
                    </button>
                  </div>
                </form>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
