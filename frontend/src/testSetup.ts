import { beforeEach, vi } from 'vitest';
// Node 25 exposes a native Storage placeholder; use isolated storage for DOM unit tests.
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(), key: (index: number) => [...data.keys()][index] ?? null, get length() { return data.size; } });
});
