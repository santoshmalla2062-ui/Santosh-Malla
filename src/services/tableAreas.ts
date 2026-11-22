import { TableRoom } from '../types';

export function resolveTableArea(table: TableRoom): string {
  const explicit = (table.area || '').trim();
  if (explicit) return explicit;

  const combined = `${table.name || ''} ${table.nepaliName || ''}`.toLowerCase();
  if (combined.includes('indoor') || combined.includes('cafe') || combined.includes('भित्री')) {
    return 'Indoor Cafe';
  }
  if (combined.includes('lake') || combined.includes('lounge') || combined.includes('लेकसाइड')) {
    return 'Lakeside';
  }
  if (combined.includes('terrace') || combined.includes('balcony') || combined.includes('roof') || combined.includes('छत')) {
    return 'Terrace';
  }
  if (combined.includes('garden') || combined.includes('बगैँचा')) {
    return 'Garden';
  }
  return 'Main Hall';
}

export function deriveBusinessTableAreas(tables: TableRoom[], savedAreas?: string[]): string[] {
  const diningTables = (tables || []).filter(t => t.type === 'table' || t.type === 'takeaway');
  const seenLower = new Set<string>();
  const result: string[] = [];

  const pushUnique = (name?: string) => {
    const clean = (name || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seenLower.has(key)) return;
    seenLower.add(key);
    result.push(clean);
  };

  if (Array.isArray(savedAreas)) {
    savedAreas.forEach(pushUnique);
    // Include any explicit table.area assigned to existing tables (excluding legacy 'General' fallback unless no saved area exists)
    diningTables.forEach((t) => {
      if (t.area && t.area.trim()) {
        pushUnique(t.area);
      }
    });
    return result;
  }

  // Default for businesses that haven't customized areas yet:
  // derive strictly from areas actually present in their dining tables (no fake/unused zone tabs).
  diningTables.forEach((t) => {
    pushUnique(resolveTableArea(t));
  });
  return result;
}

export function addBusinessArea(
  currentAreas: string[],
  rawName: string
): { areas: string[]; error?: string } {
  const clean = rawName.trim();
  if (!clean) {
    return { areas: currentAreas, error: 'Area name cannot be empty.' };
  }
  if (clean.length > 40) {
    return { areas: currentAreas, error: 'Area name must be 40 characters or fewer.' };
  }
  const exists = currentAreas.some(a => a.trim().toLowerCase() === clean.toLowerCase());
  if (exists) {
    return { areas: currentAreas, error: `Area "${clean}" already exists.` };
  }
  return { areas: [...currentAreas, clean] };
}

export function renameBusinessArea(
  currentAreas: string[],
  tables: TableRoom[],
  oldName: string,
  rawNewName: string
): { areas: string[]; tables: TableRoom[]; error?: string } {
  const cleanOld = oldName.trim();
  const cleanNew = rawNewName.trim();
  if (!cleanNew) {
    return { areas: currentAreas, tables, error: 'New area name cannot be empty.' };
  }
  if (cleanNew.length > 40) {
    return { areas: currentAreas, tables, error: 'Area name must be 40 characters or fewer.' };
  }
  const duplicate = currentAreas.some(
    a => a.trim().toLowerCase() === cleanNew.toLowerCase() && a.trim().toLowerCase() !== cleanOld.toLowerCase()
  );
  if (duplicate) {
    return { areas: currentAreas, tables, error: `Area "${cleanNew}" already exists.` };
  }

  const nextAreas: string[] = [];
  const seen = new Set<string>();
  const sourceAreas = currentAreas.length > 0 ? currentAreas : [cleanOld];
  for (const area of sourceAreas) {
    const mapped = area.trim().toLowerCase() === cleanOld.toLowerCase() ? cleanNew : area.trim();
    if (mapped && !seen.has(mapped.toLowerCase())) {
      seen.add(mapped.toLowerCase());
      nextAreas.push(mapped);
    }
  }

  const nowIso = new Date().toISOString();
  const nextTables = tables.map((tbl) => {
    if (tbl.type !== 'table' && tbl.type !== 'takeaway') return tbl;
    const tblArea = resolveTableArea(tbl);
    if (tblArea.toLowerCase() === cleanOld.toLowerCase()) {
      return { ...tbl, area: cleanNew, updatedAt: nowIso };
    }
    return tbl;
  });

  return { areas: nextAreas, tables: nextTables };
}

export function removeBusinessArea(
  currentAreas: string[],
  tables: TableRoom[],
  areaToRemove: string,
  reassignToArea?: string
): { areas: string[]; tables: TableRoom[] } {
  const targetLower = areaToRemove.trim().toLowerCase();
  const nextAreas = currentAreas.filter(a => a.trim().toLowerCase() !== targetLower);
  const cleanFallback = (reassignToArea || '').trim() || nextAreas[0] || 'Main Hall';
  const nowIso = new Date().toISOString();

  const nextTables = tables.map((tbl) => {
    if (tbl.type !== 'table' && tbl.type !== 'takeaway') return tbl;
    const tblArea = resolveTableArea(tbl);
    if (tblArea.toLowerCase() === targetLower) {
      return { ...tbl, area: cleanFallback, updatedAt: nowIso };
    }
    return tbl;
  });

  return { areas: nextAreas, tables: nextTables };
}
