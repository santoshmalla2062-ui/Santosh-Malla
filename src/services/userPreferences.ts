import { ActiveTab } from '../components/Navigation';

export interface UserPreferences {
  staffId: string;
  soundEnabled: boolean;
  defaultHomeTab: ActiveTab | 'auto';
  autoPrintReceipt: boolean;
  compactMode: boolean;
  keyboardShortcuts: boolean;
  favoriteItemIds: string[];
  theme: 'light' | 'system';
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'staffId'> = {
  soundEnabled: true,
  defaultHomeTab: 'auto',
  autoPrintReceipt: false,
  compactMode: false,
  keyboardShortcuts: true,
  favoriteItemIds: [],
  theme: 'light'
};

export function getUserPreferences(staffId?: string): UserPreferences {
  if (!staffId) {
    return { staffId: 'guest', ...DEFAULT_PREFERENCES };
  }

  try {
    const key = `himalayan_staff_prefs_${staffId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        staffId
      };
    }
  } catch (err) {
    console.warn('[UserPreferences] Failed to read from localStorage:', err);
  }

  return { staffId, ...DEFAULT_PREFERENCES };
}

export function saveUserPreferences(prefs: UserPreferences): void {
  if (!prefs.staffId) return;
  try {
    const key = `himalayan_staff_prefs_${prefs.staffId}`;
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[UserPreferences] Failed to persist to localStorage:', err);
  }
}

export function toggleFavoriteItem(staffId: string, itemId: string): UserPreferences {
  const current = getUserPreferences(staffId);
  const exists = current.favoriteItemIds.includes(itemId);
  const updatedFavorites = exists
    ? current.favoriteItemIds.filter(id => id !== itemId)
    : [...current.favoriteItemIds, itemId];

  const updated: UserPreferences = {
    ...current,
    favoriteItemIds: updatedFavorites
  };

  saveUserPreferences(updated);
  return updated;
}
