const store = new Map<string, string>();

export const redisMock = {
  get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  set: jest.fn((key: string, value: string, ..._args: unknown[]) => {
    store.set(key, value);
    return Promise.resolve('OK');
  }),
  del: jest.fn((...keys: string[]) => {
    let count = 0;
    for (const key of keys) {
      if (store.delete(key)) count++;
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
    const val = parseInt(store.get(key) ?? '0', 10) + 1;
    store.set(key, val.toString());
    return Promise.resolve(val);
  }),
  expire: jest.fn(() => Promise.resolve(1)),
  ttl: jest.fn(() => Promise.resolve(60)),
  quit: jest.fn(() => Promise.resolve('OK')),
};

export function clearRedisStore() {
  store.clear();
}

jest.mock('../../config/redis', () => ({
  getRedisClient: () => redisMock,
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
}));
