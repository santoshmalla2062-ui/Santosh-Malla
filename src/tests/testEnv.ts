// Mock localStorage / sessionStorage and window in Node environment for headless test execution
export class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
}

export function setupTestEnvironment() {
  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
  if (typeof globalThis.localStorage === 'undefined') {
    (globalThis as any).localStorage = new LocalStorageMock();
  }
  if (typeof globalThis.sessionStorage === 'undefined') {
    (globalThis as any).sessionStorage = new LocalStorageMock();
  }
}

setupTestEnvironment();
