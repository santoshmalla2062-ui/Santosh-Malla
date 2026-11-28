import React, { useEffect, useState, useRef } from 'react';
import { NumberInput } from '../common/NumberInput';
import { 
  Building, 
  ShieldCheck, 
  Download, 
  Upload, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  UserCheck,
  KeyRound,
  Lock,
  Plus,
  X,
  ShieldAlert,
  ExternalLink,
  Users,
  Layers,
  CreditCard,
  Receipt,
  Percent,
  Bell,
  History,
  ArrowRight,
  Sparkles,
  Check,
  Smartphone,
  QrCode,
  Edit2,
  Printer,
  Usb,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { AppState, BusinessSettings, BusinessTenant, IrdComplianceSettings, PrinterSettings, Session, StaffRole, StaffUser, AppModule } from '../../types';
import { Language, TRANSLATIONS } from '../../utils/translations';
import { compressBusinessLogoImageFile, sanitizeBusinessLogoUrl } from '../../utils/imageUtils';
import { exportBackupJSON } from '../../services/storage';
import {
  canActorAssignRole,
  canActorManageStaff,
  canActorManageStaffMember,
  createStaffAccount,
  getAssignableRolesForActor,
  hasPermission,
  hashPinWithSalt,
  validateBackupJSON,
  validateProductionPin,
  AppAction,
  getDefaultRolePermissions
} from '../../services/security';
import { ALL_APP_MODULES, DEFAULT_PAYMENT_METHODS, DEFAULT_RECEIPT_SETTINGS } from '../../services/tenantStorage';
import { buildEscPosReceiptBytes, openCashDrawerHardware, sendEscPosToHardware } from '../../services/escposPrinter';
import { getNepalFiscalYear } from '../../services/irdCompliance';
import { MobileAccessQRPanel } from '../common/MobileAccessQRModal';

export type SettingsSection = 
  | 'profile'
  | 'staff'
  | 'roles'
  | 'modules'
  | 'payments'
  | 'receipt'
  | 'taxes'
  | 'notifications'
  | 'security'
  | 'audit'
  | 'mobile_access'
  | 'backup';

interface SettingsViewProps {
  settings: BusinessSettings;
  appState: AppState;
  lang: Language;
  currentSession?: Session | null;
  activeBusiness?: BusinessTenant;
  onUpdateBusiness?: (businessId: string, updates: Partial<BusinessTenant>) => void;
  onUpdateSettings: (newSettings: BusinessSettings) => void;
  onRestoreBackup: (importedState: AppState) => void;
  onResetSampleData: () => void;
  onUpdateStaffUsers?: (users: StaffUser[]) => void;
  onNavigateToBusinessAdmin?: (tab?: string) => void;
  onOpenMobileQR?: () => void;
  onOpenDownloadPortal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  appState,
  lang,
  currentSession,
  activeBusiness,
  onUpdateBusiness,
  onUpdateSettings,
  onRestoreBackup,
  onResetSampleData,
  onUpdateStaffUsers,
  onNavigateToBusinessAdmin,
  onOpenMobileQR,
  onOpenDownloadPortal
}) => {
  const t = TRANSLATIONS[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const userRole = currentSession?.role;
  const [activeSubTab, setActiveSubTab] = useState<SettingsSection>('profile');
  const [formData, setFormData] = useState<BusinessSettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);

  useEffect(() => {
    setFormData({ ...settings });
    setLogoUploadError(null);
    setLogoPreviewFailed(false);
  }, [
    settings.businessId,
    settings.logoUrl,
    settings.enableVat,
    settings.vatRatePercent,
    settings.enableServiceCharge,
    settings.serviceChargePercent,
    settings.currencySymbol,
    settings.fonepayMerchantName,
    settings.paymentMethodsConfig
  ]);

  // Staff creation modal
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newNepaliName, setNewNepaliName] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('WAITER');
  const [newPin, setNewPin] = useState('');

  // Reset PIN modal
  const [resetPinTarget, setResetPinTarget] = useState<StaffUser | null>(null);
  const [newSecretPin, setNewSecretPin] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [hardwareStatusMsg, setHardwareStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const activePrinterSettings: PrinterSettings = formData.printerSettings || {
    connectionType: 'browser',
    paperWidth: '80mm',
    baudRate: 9600,
    bridgeUrl: 'http://127.0.0.1:9100/print',
    autoPrintReceipt: false,
    autoPrintKot: false,
    autoOpenCashDrawerOnCash: false,
    drawerKickPin: 0
  };

  const activeIrdSettings: IrdComplianceSettings = formData.irdSettings || {
    fiscalYearLabel: getNepalFiscalYear(),
    cbmsEnabled: false,
    cbmsEndpoint: '',
    cbmsUsername: '',
    strictTaxInvoiceLock: true
  };

  // Edit Staff Profile modal & confirmation states
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [editStaffError, setEditStaffError] = useState<string | null>(null);
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState<StaffUser | null>(null);

  // Confirmation modal for sample data reset
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Section Configurations with strict Permission Mappings
  const SECTIONS: {
    id: SettingsSection;
    label: string;
    nepaliLabel: string;
    icon: React.ElementType;
    requiredAction: AppAction;
    description: string;
    adminSuiteTab?: string;
  }[] = [
    { 
      id: 'profile', 
      label: 'Business Profile', 
      nepaliLabel: 'व्यापार प्रोफाइल', 
      icon: Building, 
      requiredAction: 'MANAGE_BUSINESS_PROFILE', 
      description: 'Business name, contacts, address, PAN/VAT, branding',
      adminSuiteTab: 'profile'
    },
    { 
      id: 'staff', 
      label: 'Users & Staff', 
      nepaliLabel: 'कर्मचारी व्यवस्थापन', 
      icon: Users, 
      requiredAction: 'MANAGE_BUSINESS_STAFF', 
      description: 'Staff accounts, roles, active status, PIN management',
      adminSuiteTab: 'staff'
    },
    { 
      id: 'roles', 
      label: 'Roles & Permissions', 
      nepaliLabel: 'भूमिका र अनुमति', 
      icon: ShieldCheck, 
      requiredAction: 'MANAGE_ROLES_PERMISSIONS', 
      description: 'Business-scoped RBAC matrix across 11 staff positions',
      adminSuiteTab: 'roles'
    },
    { 
      id: 'modules', 
      label: 'Modules', 
      nepaliLabel: 'मोड्युल व्यवस्थापन', 
      icon: Layers, 
      requiredAction: 'MANAGE_BUSINESS_MODULES', 
      description: 'Enable or disable POS, Tables, Rooms, KDS, Inventory',
      adminSuiteTab: 'modules'
    },
    { 
      id: 'payments', 
      label: 'Payment Methods', 
      nepaliLabel: 'भुक्तानी विधिहरू', 
      icon: CreditCard, 
      requiredAction: 'MANAGE_PAYMENT_METHODS', 
      description: 'Configure Cash, Card, Bank, Fonepay QR, eSewa, Khalti',
      adminSuiteTab: 'payments'
    },
    { 
      id: 'receipt', 
      label: 'Receipt Settings', 
      nepaliLabel: 'रसिद सेटिङ', 
      icon: Receipt, 
      requiredAction: 'MANAGE_RECEIPT_SETTINGS', 
      description: 'Receipt format, PAN/VAT, headers, footers & live preview',
      adminSuiteTab: 'receipt'
    },
    { 
      id: 'taxes', 
      label: 'Tax & Charges', 
      nepaliLabel: 'कर तथा शुल्क', 
      icon: Percent, 
      requiredAction: 'MODIFY_TAX_CONFIG', 
      description: 'VAT %, Service Charge %, Currency formatting',
      adminSuiteTab: 'taxes'
    },
    { 
      id: 'notifications', 
      label: 'Notifications', 
      nepaliLabel: 'सूचना तथा घण्टी', 
      icon: Bell, 
      requiredAction: 'MANAGE_BUSINESS_PROFILE', 
      description: 'Sound chimes, low stock alerts, end-of-day summary dispatch',
      adminSuiteTab: 'notifications'
    },
    { 
      id: 'security', 
      label: 'Security', 
      nepaliLabel: 'सुरक्षा नियन्त्रण', 
      icon: Lock, 
      requiredAction: 'MANAGE_ROLES_PERMISSIONS', 
      description: 'Session auto-locks, supervisor PINs & data isolation',
      adminSuiteTab: 'security'
    },
    { 
      id: 'audit', 
      label: 'Audit Logs', 
      nepaliLabel: 'अडिट लगहरू', 
      icon: History, 
      requiredAction: 'VIEW_BUSINESS_AUDIT', 
      description: 'Immutable chronological operations log for this business',
      adminSuiteTab: 'audit'
    },
    { 
      id: 'mobile_access', 
      label: 'Mobile & QR Access', 
      nepaliLabel: 'मोबाइल र QR कोड', 
      icon: QrCode, 
      requiredAction: 'VIEW_TAB_SETTINGS', 
      description: 'Scannable QR code & web app link for mobile install'
    },
    { 
      id: 'backup', 
      label: 'Backup & Persistence', 
      nepaliLabel: 'डेटा ब्याकअप', 
      icon: Download, 
      requiredAction: 'EXPORT_DATA', 
      description: 'JSON state export, cryptographic verify & restore'
    }
  ];

  const currentSectionMeta = SECTIONS.find(s => s.id === activeSubTab) || SECTIONS[0];
  const canAccessCurrentSection = userRole ? hasPermission(userRole, currentSectionMeta.requiredAction) : false;
  const canModifyConfig = userRole ? hasPermission(userRole, 'MODIFY_TAX_CONFIG') : false;
  const canManageProfile = userRole ? hasPermission(userRole, 'MANAGE_BUSINESS_PROFILE') : false;
  const canManagePaymentMethods = userRole ? hasPermission(userRole, 'MANAGE_PAYMENT_METHODS') : false;
  const canManageStaff = canActorManageStaff(userRole) || (userRole ? hasPermission(userRole, 'MANAGE_BUSINESS_STAFF') : false);
  const canImportBackup = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'SUPER_ADMIN';
  const assignableRoles = getAssignableRolesForActor(userRole);

  // Available business roles
  const defaultRoles: { role: StaffRole; label: string }[] = [
    { role: 'OWNER', label: 'BUSINESS OWNER' },
    { role: 'ADMIN', label: 'BUSINESS ADMIN' },
    { role: 'MANAGER', label: 'MANAGER' },
    { role: 'CASHIER', label: 'CASHIER' },
    { role: 'WAITER', label: 'WAITER' },
    { role: 'KITCHEN', label: 'KITCHEN' },
    { role: 'RECEPTIONIST', label: 'RECEPTIONIST' },
    { role: 'HOUSEKEEPING', label: 'HOUSEKEEPING' },
    { role: 'ACCOUNTANT', label: 'ACCOUNTANT' },
    { role: 'INVENTORY_STAFF', label: 'INVENTORY STAFF' },
    { role: 'STAFF', label: 'STAFF' }
  ];
  const assignableRoleOptions = defaultRoles.filter(r => assignableRoles.includes(r.role));

  const handleLogoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!canManageProfile) {
      setLogoUploadError('Permission denied: Only Owner or Admin can change the business logo.');
      return;
    }
    setLogoUploadError(null);
    setIsUploadingLogo(true);
    try {
      const compressedDataUrl = await compressBusinessLogoImageFile(file, 256);
      setLogoPreviewFailed(false);
      setFormData(prev => ({ ...prev, logoUrl: compressedDataUrl }));
    } catch (err: any) {
      setLogoUploadError(err?.message || 'Could not process logo image.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageProfile) {
      setNotification({ type: 'error', message: 'Permission denied: Only Owner or Admin can update business profiles.' });
      return;
    }
    const rawLogo = formData.logoUrl?.trim();
    const cleanLogoUrl = sanitizeBusinessLogoUrl(rawLogo);
    if (rawLogo && !cleanLogoUrl) {
      setNotification({
        type: 'error',
        message: 'Invalid logo URL. Please upload an image file or enter a valid https:// image URL.'
      });
      return;
    }

    const updatedSettings: BusinessSettings = {
      ...formData,
      logoUrl: cleanLogoUrl
    };
    onUpdateSettings(updatedSettings);
    if (activeBusiness && onUpdateBusiness) {
      onUpdateBusiness(activeBusiness.businessId, {
        businessName: formData.businessName,
        nepaliBusinessName: formData.nepaliBusinessName,
        tagline: formData.tagline,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        panVatNumber: formData.panVatNumber,
        logo: cleanLogoUrl
      });
    }
    setSaveSuccess(true);
    setNotification({ type: 'success', message: lang === 'ne' ? 'सेटिङहरू सफलतापूर्वक सेभ भए।' : 'Settings saved successfully.' });
    setTimeout(() => {
      setSaveSuccess(false);
      setNotification(null);
    }, 3500);
  };

  const handleTaxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canModifyConfig) {
      setNotification({ type: 'error', message: 'Permission denied: Only Owner, Admin, or Manager can update tax rates.' });
      return;
    }
    const updatedSettings: BusinessSettings = {
      ...appState.settings,
      enableVat: formData.enableVat,
      vatRatePercent: Number(formData.vatRatePercent) || 0,
      enableServiceCharge: formData.enableServiceCharge,
      serviceChargePercent: Number(formData.serviceChargePercent) || 0,
      currencySymbol: formData.currencySymbol || 'Rs.',
      fonepayMerchantName: formData.fonepayMerchantName,
      irdSettings: formData.irdSettings
    };
    onUpdateSettings(updatedSettings);
    setSaveSuccess(true);
    setNotification({ type: 'success', message: lang === 'ne' ? 'कर र शुल्क सेटिङ सेभ भयो!' : 'Tax & service charge policy saved!' });
    setTimeout(() => {
      setSaveSuccess(false);
      setNotification(null);
    }, 3500);
  };

  const handleTogglePaymentMethod = (paymentId: string) => {
    if (!canManagePaymentMethods) {
      setNotification({ type: 'error', message: 'Permission denied: Only authorized roles can modify payment channels.' });
      return;
    }
    const currentMethods = appState.settings.paymentMethodsConfig || DEFAULT_PAYMENT_METHODS;
    const nextMethods = currentMethods.map(pm =>
      pm.id === paymentId ? { ...pm, enabled: !pm.enabled } : pm
    );
    const updatedSettings: BusinessSettings = {
      ...appState.settings,
      paymentMethodsConfig: nextMethods
    };
    setFormData(prev => ({ ...prev, paymentMethodsConfig: nextMethods }));
    onUpdateSettings(updatedSettings);
    setNotification({
      type: 'success',
      message: lang === 'ne' ? 'भुक्तानी माध्यमको अवस्था अपडेट भयो।' : 'Payment channel status updated.'
    });
    setTimeout(() => setNotification(null), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canImportBackup) {
      setNotification({ type: 'error', message: 'Permission denied: Only Administrator can import and restore backups.' });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = JSON.parse(event.target?.result as string);
        const check = validateBackupJSON(rawJson);
        if (check.isValid && check.cleanState) {
          onRestoreBackup(check.cleanState);
          setNotification({ type: 'success', message: lang === 'ne' ? 'ब्याकअप प्रमाणित र सफलतापूर्वक रिस्टोर भयो।' : 'Backup cryptographically verified and restored successfully!' });
        } else {
          setNotification({ type: 'error', message: check.error || 'Invalid or corrupted backup JSON file.' });
        }
      } catch {
        setNotification({ type: 'error', message: 'Failed to parse JSON file.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleToggleStaffActive = (staffId: string) => {
    if (!canManageStaff || !onUpdateStaffUsers) return;
    const target = appState.staffUsers.find(s => s.id === staffId);
    if (!target || !canActorManageStaffMember(userRole, target.role)) {
      setNotification({ type: 'error', message: `Permission denied: ${userRole || 'Staff'} cannot modify ${target?.role || 'this'} account.` });
      return;
    }
    const updated = appState.staffUsers.map(s => {
      if (s.id === staffId) {
        return { ...s, isActive: !s.isActive };
      }
      return s;
    });
    onUpdateStaffUsers(updated);
    setNotification({ type: 'success', message: 'Staff status updated.' });
    setTimeout(() => setNotification(null), 2500);
  };

  const handleConfirmDeleteStaff = () => {
    if (!confirmDeleteStaff || !canManageStaff || !onUpdateStaffUsers) {
      setConfirmDeleteStaff(null);
      return;
    }
    if (confirmDeleteStaff.id === currentSession?.staffId) {
      setNotification({
        type: 'error',
        message: lang === 'ne'
          ? 'हाल लग-इन भएको आफ्नै खाता हटाउन मिल्दैन।'
          : 'You cannot remove the currently signed-in account.'
      });
      setConfirmDeleteStaff(null);
      return;
    }
    if (!canActorManageStaffMember(userRole, confirmDeleteStaff.role)) {
      setNotification({
        type: 'error',
        message: `Permission denied: ${userRole || 'Staff'} cannot remove ${confirmDeleteStaff.role} account.`
      });
      setConfirmDeleteStaff(null);
      return;
    }
    const removedName = confirmDeleteStaff.name;
    const updated = appState.staffUsers.filter(s => s.id !== confirmDeleteStaff.id);
    onUpdateStaffUsers(updated);
    setConfirmDeleteStaff(null);
    setNotification({
      type: 'success',
      message: lang === 'ne'
        ? `${removedName} को खाता सफलतापूर्वक हटाइयो।`
        : `${removedName} removed from staff list.`
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStaff || !onUpdateStaffUsers) return;
    if (!canActorAssignRole(userRole, newRole)) {
      const msg = `Permission denied: ${userRole || 'Staff'} cannot create ${newRole} accounts.`;
      setPinModalError(msg);
      setNotification({ type: 'error', message: msg });
      return;
    }
    if (!newUsername.trim() || !newName.trim() || newPin.trim().length < 4) {
      const msg = lang === 'ne'
        ? 'कृपया युजरनेम, नाम र कम्तीमा ४ अंकको PIN राख्नुहोस्।'
        : 'Please provide valid username, name, and 4–8 digit PIN.';
      setPinModalError(msg);
      setNotification({ type: 'error', message: msg });
      return;
    }

    const pinCheck = await validateProductionPin(newPin.trim(), appState.staffUsers);
    if (!pinCheck.isValid) {
      setPinModalError(pinCheck.error || 'Weak or duplicate PIN is not allowed.');
      setNotification({ type: 'error', message: pinCheck.error || 'Weak or duplicate PIN is not allowed.' });
      return;
    }
    setPinModalError(null);

    try {
      const newStaff = await createStaffAccount(
        newUsername.trim(),
        newName.trim(),
        newNepaliName.trim() || newName.trim(),
        newRole,
        newPin.trim(),
        undefined,
        activeBusiness?.businessId
      );
      newStaff.mustChangePin = false;
      newStaff.lastPinChangedAt = new Date().toISOString();
      onUpdateStaffUsers([...appState.staffUsers, newStaff]);
      setShowAddStaffModal(false);
      setNewUsername('');
      setNewName('');
      setNewNepaliName('');
      setNewPin('');
      setPinModalError(null);
      setNotification({ type: 'success', message: `Staff account ${newStaff.name} created.` });
      setTimeout(() => setNotification(null), 3000);
    } catch {
      const msg = 'Failed to create staff account.';
      setPinModalError(msg);
      setNotification({ type: 'error', message: msg });
    }
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStaff || !onUpdateStaffUsers || !resetPinTarget) return;
    if (!canActorManageStaffMember(userRole, resetPinTarget.role)) {
      const msg = `Permission denied: ${userRole || 'Staff'} cannot reset PIN for ${resetPinTarget.role}.`;
      setPinModalError(msg);
      setNotification({ type: 'error', message: msg });
      return;
    }
    const pinCheck = await validateProductionPin(newSecretPin.trim(), appState.staffUsers, { excludeStaffId: resetPinTarget.id });
    if (!pinCheck.isValid) {
      setPinModalError(pinCheck.error || 'Weak or duplicate PIN is not allowed.');
      setNotification({ type: 'error', message: pinCheck.error || 'Weak or duplicate PIN is not allowed.' });
      return;
    }
    setPinModalError(null);

    try {
      const newHash = await hashPinWithSalt(newSecretPin.trim(), resetPinTarget.salt);
      const changedAt = new Date().toISOString();
      const updated = appState.staffUsers.map(s => {
        if (s.id === resetPinTarget.id) {
          return { ...s, pinHash: newHash, mustChangePin: false, lastPinChangedAt: changedAt };
        }
        return s;
      });
      onUpdateStaffUsers(updated);
      const targetName = resetPinTarget.name;
      setResetPinTarget(null);
      setNewSecretPin('');
      setPinModalError(null);
      setNotification({
        type: 'success',
        message: lang === 'ne'
          ? `${targetName} को नयाँ PIN सफलतापूर्वक सेभ भयो।`
          : `New PIN saved for ${targetName}.`
      });
      setTimeout(() => setNotification(null), 3000);
    } catch {
      const msg = 'Error updating staff PIN.';
      setPinModalError(msg);
      setNotification({ type: 'error', message: msg });
    }
  };

  const handleEditStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !onUpdateStaffUsers) return;
    const original = appState.staffUsers.find(s => s.id === editingStaff.id);
    if (!original) {
      setEditStaffError('Staff account not found.');
      return;
    }
    const roleChanged = editingStaff.role !== original.role;
    const allowed = roleChanged
      ? canActorAssignRole(userRole, editingStaff.role, original.role)
      : canActorManageStaffMember(userRole, original.role);

    if (!allowed) {
      const msg = roleChanged
        ? `Permission denied: ${userRole || 'Staff'} cannot assign role ${editingStaff.role}.`
        : `Permission denied: ${userRole || 'Staff'} cannot edit ${original.role}.`;
      setEditStaffError(msg);
      setNotification({ type: 'error', message: msg });
      return;
    }
    setEditStaffError(null);
    const updated = appState.staffUsers.map(s => s.id === editingStaff.id ? editingStaff : s);
    onUpdateStaffUsers(updated);
    setNotification({
      type: 'success',
      message: lang === 'ne' 
        ? `${editingStaff.name} को विवरण सुरक्षित भयो।` 
        : `Staff profile for ${editingStaff.name} updated successfully.`
    });
    setEditingStaff(null);
    setTimeout(() => setNotification(null), 3000);
  };

  const businessAuditLogs = (appState.auditLogs || []).filter(
    l => !l.businessId || l.businessId === activeBusiness?.businessId
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Active Business Integration Header */}
      {activeBusiness && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
              <Building className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-white">{activeBusiness.businessName}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {activeBusiness.businessType.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10">
                  Tenant ID: {activeBusiness.businessId}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Data isolation active. All orders, tables, rooms, folios, inventory, and ledgers are securely scoped to this enterprise.
              </p>
            </div>
          </div>
          {onNavigateToBusinessAdmin && (
            <button
              type="button"
              onClick={() => onNavigateToBusinessAdmin('dashboard')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shrink-0"
            >
              <span>Owner Admin Suite</span>
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Top Header & Settings Description */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {lang === 'ne' ? 'व्यापार सेटिङ तथा सुरक्षा व्यवस्थापन' : 'Business Settings & Enterprise Governance'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'ne' 
              ? '१० वटा आवश्यक खण्डहरू: प्रोफाइल, कर्मचारी, भूमिका, मोड्युल, भुक्तानी, रसिद, कर, सूचना, सुरक्षा र अडिट' 
              : 'Complete 10-section management: Profile, Staff, Roles, Modules, Payments, Receipts, Taxes, Notifications, Security & Audits'}
          </p>
        </div>
        <div className="text-xs text-slate-600 flex items-center gap-2">
          <span className="text-slate-400">Current Role:</span>
          <span className="font-extrabold uppercase px-2.5 py-1 rounded bg-slate-100 text-slate-900 border border-slate-200">
            {userRole || 'GUEST'}
          </span>
        </div>
      </div>

      {/* 10-Section Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isSelected = activeSubTab === sec.id;
            const hasAuth = userRole ? hasPermission(userRole, sec.requiredAction) : false;

            return (
              <button
                key={sec.id}
                onClick={() => setActiveSubTab(sec.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{lang === 'ne' ? sec.nepaliLabel : sec.label}</span>
                {!hasAuth && (
                  <span title="Restricted access for current role">
                    <Lock className="h-3 w-3 text-amber-500" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Notification Banner */}
      {notification && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border animate-in fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ACCESS DENIED CARD IF UNAUTHORIZED ROLE ATTEMPTS ACCESS */}
      {!canAccessCurrentSection ? (
        <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-8 text-center space-y-3 animate-in fade-in">
          <div className="h-12 w-12 rounded-full bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-rose-950">Access Denied: Section Restricted</h3>
          <p className="text-xs text-rose-800 max-w-md mx-auto">
            Your current session role <span className="font-bold font-mono">({userRole || 'GUEST'})</span> is not authorized to access or modify <strong>{currentSectionMeta.label}</strong> for {activeBusiness?.businessName || 'this business'}.
          </p>
          <p className="text-[11px] text-rose-600">
            Required Permission Action: <code className="bg-rose-100 px-2 py-0.5 rounded font-mono text-[10px]">{currentSectionMeta.requiredAction}</code>
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('profile')}
              className="px-4 py-2 bg-white text-rose-800 border border-rose-300 rounded-xl text-xs font-bold hover:bg-rose-50 transition-colors"
            >
              Return to Safe Overview
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* SECTION 1: BUSINESS PROFILE */}
          {activeSubTab === 'profile' && (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden animate-in fade-in duration-150">
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {lang === 'ne' ? 'क्याफे / रेस्टुरेन्ट / रिसोर्ट विवरण' : 'Business Profile & Commercial Identity'}
                    </h3>
                    <p className="text-xs text-slate-500">Legal business identity, registered address, tax identity, and contacts</p>
                  </div>
                  {onNavigateToBusinessAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigateToBusinessAdmin('profile')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                    >
                      <span>Open in Owner Suite</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="h-20 w-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                      {sanitizeBusinessLogoUrl(formData.logoUrl) && !logoPreviewFailed ? (
                        <img
                          src={sanitizeBusinessLogoUrl(formData.logoUrl)}
                          alt={formData.businessName || 'Business Logo'}
                          onError={() => setLogoPreviewFailed(true)}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon className="h-6 w-6 mb-0.5" />
                          <span className="text-[10px] font-semibold">No Logo</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">
                          {lang === 'ne' ? 'व्यवसायको लोगो (Business Logo)' : 'Business Logo & Receipt Stamp'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Shown in header, sidebar, business switcher, and printed bills. Upload PNG, JPG, or WebP (auto-compressed for cloud sync).
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleLogoFileSelected}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={!canManageProfile || isUploadingLogo}
                          onClick={() => logoFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>
                            {isUploadingLogo
                              ? 'Compressing...'
                              : formData.logoUrl
                              ? lang === 'ne' ? 'लोगो बदल्नुहोस् (Replace)' : 'Replace Logo Photo'
                              : lang === 'ne' ? 'लोगो अपलोड गर्नुहोस् (Upload)' : 'Upload Logo Photo'}
                          </span>
                        </button>

                        {formData.logoUrl && (
                          <button
                            type="button"
                            disabled={!canManageProfile}
                            onClick={() => {
                              setLogoPreviewFailed(false);
                              setLogoUploadError(null);
                              setFormData(prev => ({ ...prev, logoUrl: undefined }));
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{lang === 'ne' ? 'हटाउनुहोस्' : 'Remove'}</span>
                          </button>
                        )}
                      </div>

                      <div className="pt-1">
                        {formData.logoUrl?.startsWith('data:') ? (
                          <p className="text-[11px] font-semibold text-emerald-700">
                            ✓ Custom logo photo ready — click Save Changes below to apply across devices.
                          </p>
                        ) : (
                          <input
                            type="url"
                            disabled={!canManageProfile}
                            value={formData.logoUrl || ''}
                            onChange={(e) => {
                              setLogoPreviewFailed(false);
                              setLogoUploadError(null);
                              setFormData(prev => ({ ...prev, logoUrl: e.target.value }));
                            }}
                            placeholder="Or paste logo image URL (https://...)"
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] focus:ring-2 focus:ring-emerald-500"
                          />
                        )}
                      </div>

                      {logoUploadError && (
                        <p className="text-[11px] font-semibold text-rose-600">{logoUploadError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Business Name (English) *</label>
                    <input
                      type="text"
                      required
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">नेपाली नाम (Nepali Name)</label>
                    <input
                      type="text"
                      value={formData.nepaliBusinessName}
                      onChange={(e) => setFormData({ ...formData, nepaliBusinessName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tagline / Subtitle</label>
                    <input
                      type="text"
                      value={formData.tagline}
                      onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">PAN / VAT Number *</label>
                    <input
                      type="text"
                      required
                      value={formData.panVatNumber}
                      onChange={(e) => setFormData({ ...formData, panVatNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Phone Number(s) *</label>
                    <input
                      type="text"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Official Email Address *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">Physical Address *</label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'मानक चेक-इन समय (Hotel Check-In)' : 'Hotel Standard Check-In Time'}
                    </label>
                    <input
                      type="time"
                      value={formData.hotelCheckInTime || '14:00'}
                      onChange={(e) => setFormData({ ...formData, hotelCheckInTime: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ne' ? 'मानक चेक-आउट समय (Hotel Check-Out)' : 'Hotel Standard Check-Out Time'}
                    </label>
                    <input
                      type="time"
                      value={formData.hotelCheckOutTime || '12:00'}
                      onChange={(e) => setFormData({ ...formData, hotelCheckOutTime: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div>
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {lang === 'ne' ? 'सेटिङ सुरक्षित भयो!' : 'Profile Saved Successfully!'}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
                >
                  <Save className="h-4 w-4" />
                  <span>{lang === 'ne' ? 'प्रोफाइल सेभ गर्नुहोस्' : 'Save Business Profile'}</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 2: USERS & STAFF */}
          {activeSubTab === 'staff' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden animate-in fade-in duration-150">
              <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {lang === 'ne' ? 'कर्मचारी तथा भूमिका व्यवस्थापन (RBAC)' : 'Staff Governance & User Accounts'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Authorized team members for {activeBusiness?.businessName}. Passwords are salted with SHA-256.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onNavigateToBusinessAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigateToBusinessAdmin('staff')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                    >
                      <span>Owner Staff Hub</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {canManageStaff && (
                    <button
                      type="button"
                      onClick={() => {
                        setPinModalError(null);
                        setShowAddStaffModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                    >
                      <Plus className="h-4 w-4 text-emerald-400" />
                      <span>Add Staff</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Salted Hash</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {appState.staffUsers.map((staff) => {
                      const isSelfSession = staff.id === currentSession?.staffId;
                      return (
                      <tr key={staff.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900">{staff.name}</span>
                            {isSelfSession && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                                {lang === 'ne' ? 'तपाईं (चालू)' : 'You'}
                              </span>
                            )}
                            {staff.mustChangePin && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Default PIN · Rotate
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">@{staff.username} {staff.nepaliName ? `· ${staff.nepaliName}` : ''}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold uppercase px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                            {staff.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            staff.isActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${staff.isActive ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                            {staff.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {staff.pinHash.substring(0, 10)}... (SHA-256)
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {canManageStaff && canActorManageStaffMember(userRole, staff.role) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditStaffError(null);
                                  setEditingStaff(staff);
                                }}
                                className="px-2.5 py-1 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 border border-indigo-200 rounded-lg font-semibold text-[11px]"
                              >
                                {lang === 'ne' ? 'सच्याउने' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPinModalError(null);
                                  setResetPinTarget(staff);
                                  setNewSecretPin('');
                                }}
                                className="px-2.5 py-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-lg font-semibold text-[11px]"
                              >
                                {lang === 'ne' ? 'PIN बदल्ने' : 'Change PIN'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStaffActive(staff.id)}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] ${
                                  staff.isActive ? 'text-amber-700 hover:bg-amber-50 border border-amber-200' : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                                }`}
                              >
                                {staff.isActive ? 'Disable' : 'Enable'}
                              </button>
                              {!isSelfSession && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteStaff(staff)}
                                  title={lang === 'ne' ? 'हटाउनुहोस्' : 'Remove staff'}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded-lg font-semibold text-[11px]"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>{lang === 'ne' ? 'हटाउने' : 'Remove'}</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-400">
                              {lang === 'ne' ? 'उच्च पद सुरक्षित' : 'Protected Role'}
                            </span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 3: ROLES & PERMISSIONS */}
          {activeSubTab === 'roles' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Role-Based Access Control (RBAC)</h3>
                  <p className="text-xs text-slate-500">Business-scoped permission matrix across 11 default hospitality roles</p>
                </div>
                {onNavigateToBusinessAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBusinessAdmin('roles')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>Open Interactive Matrix</span>
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {defaultRoles.map(({ role, label }) => {
                  const perms = getDefaultRolePermissions(role);
                  return (
                    <div key={role} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 uppercase text-[11px]">{label}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {perms.length} Perms
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {role === 'CASHIER' ? 'POS orders, billing, payments, guest folios & receipts' :
                         role === 'KITCHEN' ? 'Kitchen KDS monitor, order tickets & cooking dispatch' :
                         role === 'RECEPTIONIST' ? 'Resort bookings, guest check-in/out & room folios' :
                         role === 'HOUSEKEEPING' ? 'Room cleaning statuses & maintenance inspection' :
                         role === 'ACCOUNTANT' ? 'Daily closing, expenses, financial audits & reports' :
                         role === 'INVENTORY_STAFF' ? 'Stock tracking, reorders & purchase receipts' :
                         'Hospitality front-desk, dining service and operational duties'}
                      </p>
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1">
                        {perms.slice(0, 3).map(p => (
                          <span key={p} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                            {p.replace('VIEW_TAB_', '').replace('MANAGE_', '')}
                          </span>
                        ))}
                        {perms.length > 3 && (
                          <span className="text-[9px] text-slate-500 self-center">+{perms.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 4: MODULE TOGGLING */}
          {activeSubTab === 'modules' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Enterprise Module Configuration</h3>
                  <p className="text-xs text-slate-500">Active feature modules enabled for {activeBusiness?.businessName} ({activeBusiness?.businessType})</p>
                </div>
                {onNavigateToBusinessAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBusinessAdmin('modules')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>Toggle Modules in Owner Suite</span>
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {ALL_APP_MODULES.map((mod) => {
                  const isEnabled = !activeBusiness?.enabledModules || activeBusiness.enabledModules.includes(mod);
                  return (
                    <div key={mod} className={`p-4 rounded-xl border flex items-center justify-between ${
                      isEnabled ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60'
                    }`}>
                      <div>
                        <h4 className="font-bold uppercase tracking-wider text-[11px]">{mod.replace(/_/g, ' ')}</h4>
                        <span className="text-[10px] text-slate-500">
                          {isEnabled ? 'Available in Navigation' : 'Disabled for this business'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {isEnabled ? 'Active' : 'Off'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 5: PAYMENT METHODS */}
          {activeSubTab === 'payments' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Configured Payment Methods</h3>
                  <p className="text-xs text-slate-500">Cash, card, direct bank transfer, Fonepay QR, eSewa, and Khalti digital channels</p>
                </div>
                {onNavigateToBusinessAdmin && canManagePaymentMethods && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBusinessAdmin('payments')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>{lang === 'ne' ? 'भुक्तानी र QR व्यवस्थापन खोल्नुहोस्' : 'Manage Channels & QR'}</span>
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {(appState.settings.paymentMethodsConfig || DEFAULT_PAYMENT_METHODS).map((pm) => (
                  <div key={pm.id} className="p-4 border border-slate-200 rounded-xl space-y-2.5 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 truncate">{pm.name}</span>
                      {canManagePaymentMethods ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePaymentMethod(pm.id)}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded shrink-0 border transition-colors ${
                            pm.enabled
                              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300'
                          }`}
                          title={lang === 'ne' ? 'चालु/बन्द गर्न क्लिक गर्नुहोस्' : 'Click to toggle Enabled/Disabled'}
                        >
                          {pm.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                          pm.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {pm.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      {pm.qrImageDataUrl && (
                        <img
                          src={pm.qrImageDataUrl}
                          alt={`${pm.name} QR`}
                          referrerPolicy="no-referrer"
                          className="h-11 w-11 rounded-lg border border-slate-300 bg-white p-0.5 object-contain shrink-0"
                        />
                      )}
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-[11px] text-slate-500">
                          Channel: <span className="font-mono uppercase font-semibold text-slate-700">{pm.type}</span>
                        </div>
                        {pm.accountDetails && (
                          <p className="text-[11px] font-mono text-slate-600 truncate">{pm.accountDetails}</p>
                        )}
                        {pm.qrImageDataUrl && (
                          <span className="inline-block text-[10px] font-semibold text-emerald-700">
                            ✓ QR Photo Uploaded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 6: RECEIPT SETTINGS */}
          {activeSubTab === 'receipt' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Receipt & Invoice Styling</h3>
                  <p className="text-xs text-slate-500">Receipt headers, terms & conditions, PAN/VAT formatting, and thermal print previews</p>
                </div>
                {onNavigateToBusinessAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBusinessAdmin('receipt')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>Customize in Owner Suite</span>
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-xs">
                <div className="space-y-4">
                  <div className="p-4 border border-slate-200 rounded-xl space-y-2 bg-slate-50">
                    <span className="text-slate-500 block text-[11px]">Header Title</span>
                    <p className="font-bold text-slate-900">{formData.businessName}</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-xl space-y-2 bg-slate-50">
                    <span className="text-slate-500 block text-[11px]">PAN / VAT Registration</span>
                    <p className="font-mono font-bold text-slate-900">{formData.panVatNumber || 'N/A'}</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-xl space-y-2 bg-slate-50">
                    <span className="text-slate-500 block text-[11px]">Footer Message</span>
                    <p className="text-slate-700 italic">{formData.receiptFooterMessage}</p>
                  </div>
                  <div className="p-4 border border-slate-200 rounded-xl space-y-2.5 bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {lang === 'ne' ? 'प्रिन्ट बिलमा लोगो देखाउनुहोस्' : 'Show Business Logo on Bills & Invoices'}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {sanitizeBusinessLogoUrl(formData.logoUrl)
                            ? 'Logo will appear at the top of 58mm/80mm receipts & invoices.'
                            : 'Upload your business logo in the Business Profile tab first.'}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.receiptSettings?.showLogo ?? true}
                        disabled={!canManageProfile}
                        onChange={(e) => {
                          const nextReceiptSettings = {
                            ...DEFAULT_RECEIPT_SETTINGS,
                            ...formData.receiptSettings,
                            showLogo: e.target.checked
                          };
                          const updated = { ...formData, receiptSettings: nextReceiptSettings };
                          setFormData(updated);
                          onUpdateSettings(updated);
                        }}
                        className="h-4 w-4 text-emerald-600 rounded shrink-0"
                      />
                    </div>
                  </div>

                  {/* ESC/POS Thermal Printer & Cash Drawer Hardware Bridge */}
                  <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <Printer className="h-4 w-4 text-emerald-700" />
                        <h4 className="font-bold text-slate-900">
                          {lang === 'ne' ? 'थर्मल प्रिन्टर र क्यास ड्रअर ब्रिज (ESC/POS)' : 'Thermal Printer & Cash Drawer Bridge (ESC/POS)'}
                        </h4>
                      </div>
                      <Usb className="h-4 w-4 text-slate-400" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Connection Mode</label>
                        <select
                          value={activePrinterSettings.connectionType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              printerSettings: { ...activePrinterSettings, connectionType: e.target.value as PrinterSettings['connectionType'] }
                            })
                          }
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="browser">Browser Print Dialog (Standard)</option>
                          <option value="web_serial">Direct USB/Serial (Web Serial ESC/POS)</option>
                          <option value="web_usb">Direct USB Thermal (WebUSB ESC/POS)</option>
                          <option value="network_bridge">Local LAN / Print Bridge Daemon (HTTP)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Paper Width</label>
                        <select
                          value={activePrinterSettings.paperWidth}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              printerSettings: { ...activePrinterSettings, paperWidth: e.target.value as '58mm' | '80mm' }
                            })
                          }
                          className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-semibold"
                        >
                          <option value="80mm">80mm Thermal (48 columns)</option>
                          <option value="58mm">58mm Mini Thermal (32 columns)</option>
                        </select>
                      </div>

                      {activePrinterSettings.connectionType === 'web_serial' && (
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Serial Baud Rate</label>
                          <select
                            value={activePrinterSettings.baudRate || 9600}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                printerSettings: { ...activePrinterSettings, baudRate: Number(e.target.value) }
                              })
                            }
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg bg-white font-mono"
                          >
                            <option value={9600}>9600 bps</option>
                            <option value={19200}>19200 bps</option>
                            <option value={38400}>38400 bps</option>
                            <option value={115200}>115200 bps</option>
                          </select>
                        </div>
                      )}

                      {activePrinterSettings.connectionType === 'network_bridge' && (
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-slate-700 mb-1">Local Thermal Bridge Endpoint URL</label>
                          <input
                            type="url"
                            value={activePrinterSettings.bridgeUrl || 'http://127.0.0.1:9100/print'}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                printerSettings: { ...activePrinterSettings, bridgeUrl: e.target.value }
                              })
                            }
                            placeholder="http://127.0.0.1:9100/print"
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(activePrinterSettings.autoOpenCashDrawerOnCash)}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              printerSettings: { ...activePrinterSettings, autoOpenCashDrawerOnCash: e.target.checked }
                            })
                          }
                          className="h-4 w-4 text-emerald-600 rounded"
                        />
                        <span className="font-semibold text-slate-800">Auto-kick RJ11 Cash Drawer on Cash Settlement</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(activePrinterSettings.autoPrintReceipt)}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              printerSettings: { ...activePrinterSettings, autoPrintReceipt: e.target.checked }
                            })
                          }
                          className="h-4 w-4 text-emerald-600 rounded"
                        />
                        <span className="font-semibold text-slate-800">Auto-send ESC/POS Receipt immediately on Checkout</span>
                      </label>
                    </div>

                    {hardwareStatusMsg && (
                      <div className={`p-2 rounded-lg text-[11px] font-semibold border ${hardwareStatusMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                        {hardwareStatusMsg.text}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSettings({ ...formData, printerSettings: activePrinterSettings });
                          setHardwareStatusMsg({ ok: true, text: 'Thermal printer & drawer bridge settings saved.' });
                        }}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold flex items-center gap-1.5"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Hardware Settings</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const testOrder: any = {
                            id: 'test-print',
                            invoiceNo: 'TEST-0001',
                            tableRoomName: 'Counter Test',
                            orderType: 'takeaway',
                            items: [{ id: 't1', menuItemId: 'm1', name: 'Test Thermal Print', category: 'coffee', price: 100, quantity: 1 }],
                            subtotal: 100,
                            discountPercent: 0,
                            discountAmount: 0,
                            serviceChargeAmount: 0,
                            vatAmount: 13,
                            grandTotal: 113,
                            paidAmount: 113,
                            dueAmount: 0,
                            paymentMethod: 'cash',
                            paymentStatus: 'paid',
                            createdAt: new Date().toISOString(),
                            status: 'completed'
                          };
                          const bytes = buildEscPosReceiptBytes(testOrder, { ...formData, printerSettings: activePrinterSettings }, { width: activePrinterSettings.paperWidth });
                          const res = await sendEscPosToHardware(bytes, activePrinterSettings);
                          setHardwareStatusMsg({ ok: res.ok, text: res.message });
                        }}
                        className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold"
                      >
                        Test ESC/POS Print
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const res = await openCashDrawerHardware(activePrinterSettings);
                          setHardwareStatusMsg({ ok: res.ok, text: res.message });
                        }}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg font-bold"
                      >
                        Test Drawer Kick
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thermal Bill Preview matching Naulo Hospitality photo layout */}
                <div className="p-4 bg-white border border-slate-300 rounded-xl font-mono text-[11px] max-w-xs mx-auto shadow-md text-black space-y-2">
                  <div className="text-right text-[10px] text-slate-500 font-mono">
                    bill-165
                  </div>
                  <div className="text-center pb-1">
                    {(formData.receiptSettings?.showLogo ?? true) && sanitizeBusinessLogoUrl(formData.logoUrl) && !logoPreviewFailed && (
                      <div className="flex justify-center mb-1">
                        <img
                          src={sanitizeBusinessLogoUrl(formData.logoUrl)}
                          alt={formData.businessName || 'Business Logo'}
                          onError={() => setLogoPreviewFailed(true)}
                          className="max-h-12 max-w-[120px] w-auto h-auto object-contain grayscale contrast-125"
                        />
                      </div>
                    )}
                    <p className="font-black text-xs uppercase tracking-tight">{formData.businessName || 'NAULO HOSPITALITY'}</p>
                    <p className="text-[10px] text-slate-700">{formData.address || 'Pulchowk, Lalitpur'}</p>
                    <p className="text-[10px] text-slate-700">Tel: {formData.phone || '9861157870'}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider mt-1">ESTIMATE</p>
                    <p className="text-[9px] text-slate-600 italic">Not a tax invoice</p>
                  </div>
                  <div className="border-b border-dashed border-slate-400" />
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">Printed</span>
                      <span className="font-medium">2083 Kartik 23, 12:18 PM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">Order</span>
                      <span>#1042</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">Type</span>
                      <span className="font-bold">TAKEAWAY#MURTI</span>
                    </div>
                  </div>
                  <div className="border-b border-dashed border-slate-400" />
                  <div className="grid grid-cols-12 font-bold text-[10px] pb-0.5">
                    <span className="col-span-1">SN</span>
                    <span className="col-span-5">Item</span>
                    <span className="col-span-2 text-right">Rate</span>
                    <span className="col-span-1 text-center">Qty</span>
                    <span className="col-span-3 text-right">Amount</span>
                  </div>
                  <div className="space-y-0.5 text-[10px]">
                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-1 text-slate-600">1</span>
                      <span className="col-span-5 font-medium leading-tight">Chicken Kimbap</span>
                      <span className="col-span-2 text-right">350.00</span>
                      <span className="col-span-1 text-center font-bold">1</span>
                      <span className="col-span-3 text-right font-semibold">Rs.350.00</span>
                    </div>
                    <div className="grid grid-cols-12 items-start">
                      <span className="col-span-1 text-slate-600">2</span>
                      <span className="col-span-5 font-medium leading-tight">Prawn Kimbap</span>
                      <span className="col-span-2 text-right">590.00</span>
                      <span className="col-span-1 text-center font-bold">1</span>
                      <span className="col-span-3 text-right font-semibold">Rs.590.00</span>
                    </div>
                  </div>
                  <div className="border-b border-dashed border-slate-400" />
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>Rs.940.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service (0%)</span>
                      <span>Rs.0.00</span>
                    </div>
                    <div className="flex justify-between font-black text-xs pt-0.5 text-black">
                      <span>GRAND TOTAL</span>
                      <span>Rs.940.00</span>
                    </div>
                  </div>
                  <div className="border-b border-dashed border-slate-400" />
                  <div className="space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span>Cash</span>
                      <span>Rs.940.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash received</span>
                      <span>Rs.940.00</span>
                    </div>
                  </div>
                  <div className="border-b border-dashed border-slate-400" />
                  <div className="flex justify-between text-[10px]">
                    <span>Cashier</span>
                    <span className="font-semibold">Binay Raut</span>
                  </div>
                  <div className="text-center text-[10px] text-slate-700 pt-1">
                    {formData.receiptFooterMessage || 'Thank you, please come again'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: TAX & CHARGES */}
          {activeSubTab === 'taxes' && (
            <form onSubmit={handleTaxSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden animate-in fade-in duration-150">
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Tax & Charges Policy</h3>
                    <p className="text-xs text-slate-500">Configure legal VAT and hospitality service charge percentage rates for {activeBusiness?.businessName}</p>
                  </div>
                  {onNavigateToBusinessAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigateToBusinessAdmin('taxes')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                    >
                      <span>Open in Owner Suite</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* VAT */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">मूल्य अभिवृद्धि कर (VAT)</label>
                      <input
                        type="checkbox"
                        checked={formData.enableVat}
                        onChange={(e) => setFormData({ ...formData, enableVat: e.target.checked })}
                        className="h-4 w-4 text-emerald-600 rounded"
                      />
                    </div>
                    {formData.enableVat && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-slate-600">VAT Rate (%):</span>
                        <NumberInput
                          min={0}
                          max={100}
                          value={formData.vatRatePercent}
                          onValueChange={(val) => setFormData({ ...formData, vatRatePercent: val })}
                          className="w-20 px-2.5 py-1 bg-white border border-slate-300 rounded font-mono font-bold"
                        />
                        <span className="text-slate-500 font-bold">%</span>
                      </div>
                    )}
                  </div>

                  {/* Service Charge */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">सेवा शुल्क (Service Charge)</label>
                      <input
                        type="checkbox"
                        checked={formData.enableServiceCharge}
                        onChange={(e) => setFormData({ ...formData, enableServiceCharge: e.target.checked })}
                        className="h-4 w-4 text-emerald-600 rounded"
                      />
                    </div>
                    {formData.enableServiceCharge && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-slate-600">Rate (%):</span>
                        <NumberInput
                          min={0}
                          max={100}
                          value={formData.serviceChargePercent}
                          onValueChange={(val) => setFormData({ ...formData, serviceChargePercent: val })}
                          className="w-20 px-2.5 py-1 bg-white border border-slate-300 rounded font-mono font-bold"
                        />
                        <span className="text-slate-500 font-bold">%</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Currency Symbol</label>
                    <input
                      type="text"
                      value={formData.currencySymbol}
                      onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Fonepay Merchant Name</label>
                    <input
                      type="text"
                      value={formData.fonepayMerchantName}
                      onChange={(e) => setFormData({ ...formData, fonepayMerchantName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Nepal IRD Annex-5 & CBMS Integration Panel */}
                  <div className="sm:col-span-2 p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="font-bold text-indigo-950">Nepal IRD Annex-5 & CBMS Real-Time Sync</h4>
                        <p className="text-[11px] text-indigo-800">Configure Fiscal Year (Shrawan–Ashadh), automated Credit Note on void, and optional CBMS API bridge</p>
                      </div>
                      <label className="flex items-center gap-2 font-bold text-indigo-950 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(activeIrdSettings.cbmsEnabled)}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              irdSettings: { ...activeIrdSettings, cbmsEnabled: e.target.checked }
                            })
                          }
                          className="h-4 w-4 text-indigo-600 rounded"
                        />
                        <span>Enable Live CBMS API Sync</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Nepal Fiscal Year (BS)</label>
                        <input
                          type="text"
                          value={activeIrdSettings.fiscalYearLabel}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              irdSettings: { ...activeIrdSettings, fiscalYearLabel: e.target.value }
                            })
                          }
                          placeholder="e.g. 2083/84"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">CBMS API Username</label>
                        <input
                          type="text"
                          value={activeIrdSettings.cbmsUsername || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              irdSettings: { ...activeIrdSettings, cbmsUsername: e.target.value }
                            })
                          }
                          placeholder="IRD CBMS username"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">CBMS Sync Endpoint URL</label>
                        <input
                          type="url"
                          value={activeIrdSettings.cbmsEndpoint || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              irdSettings: { ...activeIrdSettings, cbmsEndpoint: e.target.value }
                            })
                          }
                          placeholder="https://cbms.ird.gov.np/api/..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div>
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {lang === 'ne' ? 'सेटिङ सुरक्षित भयो!' : 'Tax Policy Saved!'}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-2xs"
                >
                  <Save className="h-4 w-4" />
                  <span>{lang === 'ne' ? 'कर दर सेभ गर्नुहोस्' : 'Save Tax Policy'}</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 8: NOTIFICATIONS */}
          {activeSubTab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Notifications & Alerts Preferences</h3>
                  <p className="text-xs text-slate-500">Audio feedback chimes, kitchen KDS bells, and automated inventory threshold alerts</p>
                </div>
                {onNavigateToBusinessAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBusinessAdmin('notifications')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>Configure in Owner Suite</span>
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Terminal Sound Effects</h4>
                    <p className="text-slate-500 text-[11px]">Audio feedback on billing, payments, and errors</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Active</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Kitchen KOT Bell Chime</h4>
                    <p className="text-slate-500 text-[11px]">Audible chime when food ticket is sent to KDS</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Active</span>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Low Stock Inventory Warnings</h4>
                    <p className="text-slate-500 text-[11px]">Alert floor managers when stock reaches reorder point</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Active</span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 9: SECURITY */}
          {activeSubTab === 'security' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Security Governance & Data Partitioning</h3>
                  <p className="text-xs text-slate-500">Terminal session lockouts, supervisor PIN verifications, and enterprise partition status</p>
                </div>
                {onNavigateToBusinessAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBusinessAdmin('security')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>Open Security Center</span>
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <span>Multi-Tenant Enterprise Isolation Enforced</span>
                  </div>
                  <p className="text-emerald-800 text-[11px]">
                    Partition: <code className="font-bold font-mono text-emerald-950">{activeBusiness?.businessId}</code> ({activeBusiness?.businessName})
                  </p>
                  <p className="text-emerald-700 text-[11px]">
                    Cross-tenant leakage is prevented at storage, query, and backend rule levels.
                  </p>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-900">Session Auto-Lock</h4>
                  <p className="text-slate-500 text-[11px]">POS Terminal locks automatically after 60 minutes of inactivity to protect cashier drawers.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-900">High-Risk Operations Protection</h4>
                  <p className="text-slate-500 text-[11px]">Bill discounts, voiding submitted items, and final cash closing require supervisor authorization.</p>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 10: AUDIT LOGS */}
          {activeSubTab === 'audit' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Security & Operations Audit Trail</h3>
                  <p className="text-xs text-slate-500">Immutable chronological record of events performed inside {activeBusiness?.businessName}</p>
                </div>
                {onNavigateToBusinessAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigateToBusinessAdmin('audit')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <span>Open Full Audit View</span>
                    <ArrowRight className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Staff Actor</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {businessAuditLogs.slice(0, 15).map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {log.staffName} ({log.role})
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-700 font-semibold">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-sm truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            log.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            log.severity === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {log.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {businessAuditLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No audit trail records yet for this business.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECTION 11: MOBILE ACCESS & DOWNLOAD QR CODE */}
          {activeSubTab === 'mobile_access' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs animate-in fade-in duration-150">
              <MobileAccessQRPanel
                businessName={activeBusiness?.businessName || settings.businessName}
                lang={lang}
                androidApkUrl={settings.androidApkUrl}
                publicAppUrl={settings.publicAppUrl}
                onSaveAndroidApkUrl={(apkUrl) =>
                  onUpdateSettings({
                    ...settings,
                    androidApkUrl: apkUrl || undefined
                  })
                }
                onSavePublicAppUrl={(publicUrl) =>
                  onUpdateSettings({
                    ...settings,
                    publicAppUrl: publicUrl || undefined
                  })
                }
                onOpenDownloadPortal={onOpenDownloadPortal}
                onOpenFullscreenModal={onOpenMobileQR}
              />
            </div>
          )}

          {/* SECTION 12: DATA PERSISTENCE & BACKUP */}
          {activeSubTab === 'backup' && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-6 shadow-2xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-700 flex items-center justify-center text-white">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {lang === 'ne' ? 'डेटा सुरक्षा तथा ब्याकअप (Data Persistence)' : 'Data Persistence & Backup'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {lang === 'ne' ? 'तपाईंको सबै बिल, स्टक र ग्राहक विवरणहरू कम्प्युटरमा स्वतः सेभ भइरहन्छ।' : 'All POS orders, inventory, and customer khata are continuously saved in local storage.'}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-white px-3 py-1 rounded-md border border-emerald-300 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Auto-Save Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {/* Export Backup Button */}
                <button
                  type="button"
                  onClick={() => exportBackupJSON(appState)}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs hover:border-emerald-500"
                >
                  <Download className="h-4 w-4 text-emerald-700" />
                  <span>{t.exportBackup}</span>
                </button>

                {/* Import Backup Button */}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    disabled={!canImportBackup}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={!canImportBackup}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs hover:border-emerald-500"
                  >
                    <Upload className="h-4 w-4 text-indigo-600" />
                    <span>{t.importBackup}</span>
                  </button>
                </div>

                {/* Clear Demo Data Button */}
                <button
                  type="button"
                  disabled={!canImportBackup}
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-rose-50 disabled:opacity-40 text-rose-700 border border-slate-300 rounded-xl text-xs font-semibold transition-all shadow-2xs hover:border-rose-300"
                >
                  <RotateCcw className="h-4 w-4 text-rose-600" />
                  <span>{lang === 'ne' ? 'सबै डेमो डेटा हटाउनुहोस्' : 'Clear Demo Data (Clean Start)'}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: ADD STAFF */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">Add New Staff Account ({activeBusiness?.businessName})</h4>
              <button
                type="button"
                onClick={() => {
                  setShowAddStaffModal(false);
                  setPinModalError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateStaffSubmit} className="p-5 space-y-3.5 text-xs">
              {pinModalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">
                  {pinModalError}
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Username (login id) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sita_cashier"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Sita Sharma"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">नेपाली नाम</label>
                  <input
                    type="text"
                    placeholder="सीता शर्मा"
                    value={newNepaliName}
                    onChange={(e) => setNewNepaliName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as StaffRole)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    {assignableRoleOptions.map(r => (
                      <option key={r.role} value={r.role}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Security PIN (4–8 digits) *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    required
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value.replace(/\D/g, ''));
                      setPinModalError(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center tracking-widest text-sm"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStaffModal(false);
                    setPinModalError(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET STAFF PIN */}
      {resetPinTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h4 className="font-bold text-sm">
                {lang === 'ne' ? 'PIN परिवर्तन गरी सेभ गर्नुहोस्' : 'Change & Save New PIN'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setResetPinTarget(null);
                  setPinModalError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResetPinSubmit} className="p-5 space-y-3.5 text-xs">
              <p className="text-slate-600">
                {lang === 'ne'
                  ? <>प्रयोगकर्ता <strong className="text-slate-900">{resetPinTarget.name}</strong> ({resetPinTarget.role}) को नयाँ PIN सेट गर्नुहोस्।</>
                  : <>Setting new security PIN for <strong className="text-slate-900">{resetPinTarget.name}</strong> ({resetPinTarget.role}).</>}
              </p>
              {pinModalError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">
                  {pinModalError}
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">New Strong PIN (4–8 digits, no defaults) *</label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  maxLength={8}
                  placeholder="••••••"
                  value={newSecretPin}
                  onChange={(e) => {
                    setNewSecretPin(e.target.value.replace(/\D/g, ''));
                    setPinModalError(null);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-center tracking-widest text-lg"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetPinTarget(null);
                    setPinModalError(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {lang === 'ne' ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={newSecretPin.length < 4}
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-xl shadow-2xs"
                >
                  {lang === 'ne' ? 'नयाँ PIN सेभ गर्नुहोस्' : 'Save New PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STAFF DETAILS */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-emerald-400" />
                <h4 className="font-bold text-sm">
                  {lang === 'ne' ? 'स्टाफ/प्रयोगकर्ता विवरण सम्पादन' : 'Edit Staff / User Profile'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingStaff(null);
                  setEditStaffError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditStaffSubmit} className="p-5 space-y-3.5 text-xs">
              {editStaffError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-semibold">
                  {editStaffError}
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'युजरनेम (परिवर्तन गर्न नमिल्ने):' : 'Username (Immutable):'}
                </label>
                <input
                  type="text"
                  disabled
                  value={editingStaff.username}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'पूरा नाम (अंग्रेजीमा) *' : 'Full Name (English) *'}
                </label>
                <input
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'नेपाली नाम (Nepali Name - ऐच्छिक)' : 'Nepali Name (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder="जस्तै: विकास तामाङ"
                  value={editingStaff.nepaliName || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, nepaliName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {lang === 'ne' ? 'पद / भूमिका (Assigned Role) *' : 'Assigned Role *'}
                </label>
                <select
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value as StaffRole })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white"
                >
                  {defaultRoles
                    .filter(r => r.role === editingStaff.role || assignableRoles.includes(r.role))
                    .map(r => (
                      <option key={r.role} value={r.role}>{r.label}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'फोन नम्बर' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={editingStaff.phone || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ne' ? 'इमेल' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={editingStaff.role === 'SUPER_ADMIN' ? '' : (editingStaff.email || '')}
                    onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaff(null);
                    setEditStaffError(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {lang === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-2xs"
                >
                  {lang === 'ne' ? 'परिवर्तन सुरक्षित गर्नुहोस्' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM STAFF REMOVAL */}
      {confirmDeleteStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-700 font-bold text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{lang === 'ne' ? 'कर्मचारी खाता हटाउने पुष्टि' : 'Confirm Staff Removal'}</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {lang === 'ne'
                ? <>के तपाईं <strong className="text-slate-900">{confirmDeleteStaff.name}</strong> (@{confirmDeleteStaff.username} · {confirmDeleteStaff.role}) को खाता स्थायी रूपमा हटाउन चाहनुहुन्छ? सबै डिभाइसबाट यो खाता हट्नेछ।</>
                : <>Are you sure you want to remove <strong className="text-slate-900">{confirmDeleteStaff.name}</strong> (@{confirmDeleteStaff.username} · {confirmDeleteStaff.role})? This removes the account across all synced devices.</>}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmDeleteStaff(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                {lang === 'ne' ? 'रद्द गर्नुहोस्' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteStaff}
                className="px-4 py-2 font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl"
              >
                {lang === 'ne' ? 'हटाउनुहोस्' : 'Remove Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET DATA CONFIRMATION */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200 p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-700 font-bold text-sm">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Confirm Demo Data Reset</span>
            </div>
            <p className="text-slate-600">
              Are you sure you want to reset all records to the original default sample data? All newly added orders and transactions will be cleared.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetSampleData();
                  setShowResetConfirm(false);
                  setNotification({ type: 'success', message: 'Sample data reset completed.' });
                }}
                className="px-4 py-2 font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
