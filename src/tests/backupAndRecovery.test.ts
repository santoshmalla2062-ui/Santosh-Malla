import test from 'node:test';
import assert from 'node:assert/strict';
import './testEnv';
import { 
  saveTenantAppState, 
  loadTenantAppState, 
  TENANT_STORAGE_PREFIX 
} from '../services/tenantStorage';
import { getInitialAppState } from '../services/storage';
import { AppState } from '../types';

test('Backup & Recovery: JSON export and restore integrity', () => {
  localStorage.clear();
  const testBizId = 'biz-backup-test';

  const originalState: AppState = getInitialAppState();
  originalState.businessId = testBizId;
  originalState.settings.businessId = testBizId;
  originalState.settings.businessName = 'Himalayan Ridge Backup Cafe';
  originalState.menuItems = [
    {
      id: 'm-test-1',
      code: 'BAK-01',
      name: 'Backup Test Dish',
      nepaliName: 'ब्याकअप परिकार',
      category: 'bakery',
      price: 450,
      costPrice: 150,
      isAvailable: true
    }
  ];

  // 1. Save original state
  saveTenantAppState(testBizId, originalState);

  // 2. Simulate Export operation (JSON serialize)
  const loadedForExport = loadTenantAppState(testBizId);
  const exportedJson = JSON.stringify(loadedForExport, null, 2);
  assert.ok(exportedJson.length > 100, 'Exported JSON must contain state data');

  // 3. Verify structure of backup payload
  const parsedBackup = JSON.parse(exportedJson);
  assert.strictEqual(parsedBackup.settings.businessName, 'Himalayan Ridge Backup Cafe');
  assert.strictEqual(parsedBackup.menuItems[0].name, 'Backup Test Dish');
  assert.ok(Array.isArray(parsedBackup.tablesRooms), 'Backup must include tablesRooms array');
  assert.ok(Array.isArray(parsedBackup.inventoryItems), 'Backup must include inventoryItems array');
  assert.ok(Array.isArray(parsedBackup.orders), 'Backup must include orders array');

  // 4. Simulate Restore operation into new partition or after wipe
  localStorage.clear();
  const restoredBizId = 'biz-restored-target';
  const cleanRestoredState = {
    ...parsedBackup,
    businessId: restoredBizId,
    settings: {
      ...parsedBackup.settings,
      businessId: restoredBizId
    }
  };
  saveTenantAppState(restoredBizId, cleanRestoredState);

  // 5. Verify restored state fidelity
  const verifiedState = loadTenantAppState(restoredBizId);
  assert.strictEqual(verifiedState.settings.businessName, 'Himalayan Ridge Backup Cafe');
  assert.strictEqual(verifiedState.menuItems.length, 1);
  assert.strictEqual(verifiedState.menuItems[0].price, 450);
});

test('Backup & Recovery: Reject malformed or cross-tenant corrupt states', () => {
  localStorage.clear();
  const legitimateBizId = 'biz-safe-partition';
  const initialState = getInitialAppState();
  initialState.businessId = legitimateBizId;
  initialState.settings.businessId = legitimateBizId;
  saveTenantAppState(legitimateBizId, initialState);

  // Attempt to save state belonging to "foreign-tenant" into "biz-safe-partition"
  const maliciousState: AppState = {
    ...initialState,
    businessId: 'foreign-hostile-tenant' // Mismatched tenant tag
  };

  const saveResult = saveTenantAppState(legitimateBizId, maliciousState);
  assert.strictEqual(saveResult, false, 'State with mismatched tenant ID must be rejected by partition guard');

  // Ensure legitimate state was not overwritten
  const currentSafeState = loadTenantAppState(legitimateBizId);
  assert.strictEqual(currentSafeState.businessId, legitimateBizId, 'Safe partition must remain intact');
});
