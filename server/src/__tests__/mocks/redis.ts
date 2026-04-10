const store = new Map<string, string>();
/** Expiry time (ms since epoch), if set */
const expiresAt = new Map<string, number>();

function isExpired(key: string): boolean {
  const exp = expiresAt.get(key);
  if (exp == null) return false;
  if (Date.now() >= exp) {
    store.delete(key);
    expiresAt.delete(key);
    return true;
  }
  return false;
}

export const redisMock = {
  get: jest.fn((key: string) => {
    if (isExpired(key)) return Promise.resolve(null);
    return Promise.resolve(store.get(key) ?? null);
  }),
  set: jest.fn((key: string, value: string, ...args: unknown[]) => {
    store.set(key, value);
    if (args[0] === 'EX' && typeof args[1] === 'number') {
      expiresAt.set(key, Date.now() + (args[1] as number) * 1000);
    }
    return Promise.resolve('OK');
  }),
  del: jest.fn((...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (store.delete(key)) count++;
      expiresAt.delete(key);
    }
    return Promise.resolve(count);
  }),
  keys: jest.fn((pattern: string) => {
    const prefix = pattern.replace('*', '');
    const matched = [...store.keys()].filter((k) => k.startsWith(prefix));
    return Promise.resolve(matched);
  }),
  scan: jest.fn((_cursor: string, ..._args: unknown[]) => {
    return Promise.resolve(['0', [] as string[]]);
  }),
  ping: jest.fn(() => Promise.resolve('PONG')),
  incr: jest.fn((key: string) => {
    if (isExpired(key)) {
      store.delete(key);
      expiresAt.delete(key);
    }
    const val = parseInt(store.get(key) ?? '0', 10) + 1;
    store.set(key, val.toString());
    return Promise.resolve(val);
  }),
  expire: jest.fn((key: string, seconds: number) => {
    if (!store.has(key)) return Promise.resolve(0);
    expiresAt.set(key, Date.now() + seconds * 1000);
    return Promise.resolve(1);
  }),
  ttl: jest.fn((key: string) => {
    if (!store.has(key)) return Promise.resolve(-2);
    const exp = expiresAt.get(key);
    if (exp == null) return Promise.resolve(-1);
    const left = Math.ceil((exp - Date.now()) / 1000);
    if (left <= 0) {
      store.delete(key);
      expiresAt.delete(key);
      return Promise.resolve(-2);
    }
    return Promise.resolve(left);
  }),
  quit: jest.fn(() => Promise.resolve('OK')),
};

export function clearRedisStore() {
  store.clear();
  expiresAt.clear();
}

jest.mock('../../config/redis', () => ({
  getRedisClient: () => redisMock,
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
}));
