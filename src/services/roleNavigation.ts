import { AppModule, StaffRole } from '../types';
import { ActiveTab } from '../components/Navigation';
import { AppAction, hasPermission } from './security';

export interface RoleHomeConfig {
  role: StaffRole;
  defaultTab: ActiveTab;
  tabLabelEn: string;
  tabLabelNe: string;
  descriptionEn: string;
  descriptionNe: string;
}

const DEFAULT_MODULES: AppModule[] = [
  'pos',
  'tables_rooms',
  'resort',
  'kds',
  'inventory',
  'customers',
  'day_closing',
  'reports',
  'settings'
];

/**
 * Returns the primary home screen configuration for any employee role.
 * Respects enabled business modules (e.g. if resort module is disabled, falls back to restaurant tabs).
 */
export function getHomeConfigForRole(
  role: StaffRole = 'CASHIER',
  enabledModules: AppModule[] = DEFAULT_MODULES
): RoleHomeConfig {
  const hasResort = enabledModules.includes('resort');
  const hasInventory = enabledModules.includes('inventory');

  switch (role) {
    case 'SUPER_ADMIN':
    case 'OWNER':
    case 'ADMIN':
      return {
        role,
        defaultTab: 'business_admin',
        tabLabelEn: 'Control Center & Operations',
        tabLabelNe: 'नियन्त्रण केन्द्र र सञ्चालन',
        descriptionEn: 'Full business overview, revenue, staff permissions, and operations',
        descriptionNe: 'सम्पूर्ण व्यापार अवलोकन, आम्दानी, कर्मचारी अधिकार, र सञ्चालन'
      };

    case 'MANAGER':
      return {
        role,
        defaultTab: 'dashboard',
        tabLabelEn: 'Manager Operations Dashboard',
        tabLabelNe: 'व्यवस्थापक सञ्चालन ड्यासबोर्ड',
        descriptionEn: 'Daily operations, active orders, live stock, and staff activity',
        descriptionNe: 'दैनिक सञ्चालन, चालु अर्डर, मौज्दात र कर्मचारी गतिविधि'
      };

    case 'CASHIER':
      return {
        role,
        defaultTab: 'pos',
        tabLabelEn: 'POS Billing Terminal',
        tabLabelNe: 'POS बिलिङ टर्मिनल',
        descriptionEn: 'Point of sale, fast billing, active tickets, and payment settlement',
        descriptionNe: 'बिक्री विन्दु, द्रुत बिलिङ, चालु टिकट, र भुक्तानी फछ्र्यौट'
      };

    case 'WAITER':
      return {
        role,
        defaultTab: 'tables_rooms',
        tabLabelEn: 'Dining Tables & KOT',
        tabLabelNe: 'डाइनिङ टेबल र KOT',
        descriptionEn: 'Table occupancy, live order taking, table transfer, and KOT dispatch',
        descriptionNe: 'टेबलको अवस्था, प्रत्यक्ष अर्डर लिने, टेबल सार्ने, र KOT पठाउने'
      };

    case 'KITCHEN':
      return {
        role,
        defaultTab: 'kds',
        tabLabelEn: 'Kitchen Display System (KDS)',
        tabLabelNe: 'किचन डिस्प्ले प्रणाली (KDS)',
        descriptionEn: 'Live kitchen orders, preparation status, cooking timer, and dish ready signals',
        descriptionNe: 'भान्साको प्रत्यक्ष अर्डर, पकाउने समय, र परिकार तयार संकेत'
      };

    case 'RECEPTIONIST':
      return {
        role,
        defaultTab: hasResort ? 'resort' : 'pos',
        tabLabelEn: hasResort ? 'Resort Front Desk & Reservations' : 'POS Billing',
        tabLabelNe: hasResort ? 'रिसोर्ट फ्रन्ट डेस्क र बुकिङ' : 'POS बिलिङ',
        descriptionEn: 'Guest check-in, check-out, room availability, and room folio charges',
        descriptionNe: 'पाहुनाको चेक-इन, चेक-आउट, कोठाको उपलब्धता, र कोठा शुल्क'
      };

    case 'HOUSEKEEPING':
      return {
        role,
        defaultTab: hasResort ? 'resort' : 'tables_rooms',
        tabLabelEn: hasResort ? 'Housekeeping & Room Maintenance' : 'Floor Cleanliness',
        tabLabelNe: hasResort ? 'हाउसकिपिङ र कोठा सरसफाइ' : 'भुइँ सरसफाइ',
        descriptionEn: 'Room cleaning tasks, dirty room updates, and maintenance requests',
        descriptionNe: 'कोठा सरसफाइ कार्य, फोहोर कोठाको अवस्था, र मर्मत अनुरोध'
      };

    case 'INVENTORY_STAFF':
      return {
        role,
        defaultTab: hasInventory ? 'inventory' : 'pos',
        tabLabelEn: 'Inventory & Stock Management',
        tabLabelNe: 'सामान मौज्दात र स्टक व्यवस्थापन',
        descriptionEn: 'Raw materials, recipe ingredients, low-stock alerts, and stock entries',
        descriptionNe: 'कच्चा पदार्थ, रेसिपी सामग्री, कम मौज्दात चेतावनी, र स्टक दाखिला'
      };

    case 'ACCOUNTANT':
      return {
        role,
        defaultTab: 'day_closing',
        tabLabelEn: 'Financial Closing & Khata Audit',
        tabLabelNe: 'दैनिक हिसाब बन्द र खाता अडिट',
        descriptionEn: 'Day closing records, daily expenses, Khata credit dues, and financial reports',
        descriptionNe: 'दैनिक क्लोजिङ रेकर्ड, खर्च विवरण, उधारो खाता, र वित्तीय प्रतिवेदन'
      };

    case 'STAFF':
    default:
      return {
        role,
        defaultTab: 'pos',
        tabLabelEn: 'Service Terminal',
        tabLabelNe: 'सेवा टर्मिनल',
        descriptionEn: 'Standard service point of sale and order assist',
        descriptionNe: 'साधारण सेवा पोइन्ट अफ सेल'
      };
  }
}

/**
 * Returns true if the user's role is permitted to access the requested tab.
 * Enforces role permissions on the backend/logic layer, not just UI visibility.
 */
export function isTabPermittedForRole(
  tab: ActiveTab,
  role?: StaffRole,
  enabledModules: AppModule[] = DEFAULT_MODULES
): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN' || role === 'OWNER') return true;

  // Module check first
  if (tab === 'resort' && !enabledModules.includes('resort')) {
    return false;
  }
  if (tab === 'inventory' && !enabledModules.includes('inventory')) {
    return false;
  }

  const DEFAULT_MODULES_CHECK = enabledModules || DEFAULT_MODULES;
  if (tab === 'billing' && !DEFAULT_MODULES_CHECK.includes('billing') && !DEFAULT_MODULES_CHECK.includes('pos')) {
    return false;
  }

  const tabActionMap: Record<ActiveTab, AppAction> = {
    dashboard: 'VIEW_TAB_DASHBOARD',
    pos: 'VIEW_TAB_POS',
    billing: 'VIEW_TAB_BILLING',
    tables_rooms: 'VIEW_TAB_TABLES',
    resort: 'VIEW_TAB_RESORT',
    kds: 'VIEW_TAB_KDS',
    inventory: 'VIEW_TAB_INVENTORY',
    customers: 'VIEW_TAB_CUSTOMERS',
    day_closing: 'VIEW_TAB_DAY_CLOSING',
    reports: 'VIEW_TAB_REPORTS',
    settings: 'VIEW_TAB_SETTINGS',
    business_admin: 'VIEW_TAB_BUSINESS_ADMIN'
  };

  const requiredAction = tabActionMap[tab];
  if (!requiredAction) return true;

  return hasPermission(role, requiredAction);
}
