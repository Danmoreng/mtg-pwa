import { vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Set up Pinia for tests
setActivePinia(createPinia())

// Mock indexedDB
const mockIndexedDB = () => {
  const stores: Record<string, any[]> = {};
  
  return {
    open: vi.fn().mockReturnValue({
      set onsuccess(cb: (event: { target: { result: any } }) => void) {
        cb({ target: { result: this.result } })
      },
      set onerror(cb: (event: { target: { error: Error } }) => void) {
        cb({ target: { error: new Error('IDB error') } })
      },
      result: {
        createObjectStore: vi.fn().mockImplementation((name) => {
          stores[name] = [];
          return {
            createIndex: vi.fn(),
            add: vi.fn().mockImplementation((item) => {
              stores[name].push(item);
              return Promise.resolve(item.id || Date.now());
            }),
            put: vi.fn().mockImplementation((item) => {
              const index = stores[name].findIndex((i: any) => i.id === item.id);
              if (index >= 0) {
                stores[name][index] = { ...stores[name][index], ...item };
              } else {
                stores[name].push(item);
              }
              return Promise.resolve(item.id || Date.now());
            }),
            get: vi.fn().mockImplementation((id) => {
              const item = stores[name].find((i: any) => i.id === id);
              return Promise.resolve(item);
            }),
            getAll: vi.fn().mockImplementation(() => {
              return Promise.resolve(stores[name]);
            }),
            where: vi.fn().mockReturnThis(),
            equals: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(() => {
              return Promise.resolve(stores[name][0]);
            }),
            toArray: vi.fn().mockImplementation(() => {
              return Promise.resolve(stores[name]);
            }),
            clear: vi.fn().mockImplementation(() => {
              stores[name] = [];
              return Promise.resolve();
            }),
            delete: vi.fn().mockImplementation((id) => {
              const index = stores[name].findIndex((i: any) => i.id === id);
              if (index >= 0) {
                stores[name].splice(index, 1);
              }
              return Promise.resolve();
            }),
            count: vi.fn().mockImplementation(() => {
              return Promise.resolve(stores[name].length);
            })
          };
        }),
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockImplementation((name) => {
            return {
              add: vi.fn().mockImplementation((item) => {
                if (!stores[name]) stores[name] = [];
                stores[name].push(item);
                return Promise.resolve(item.id || Date.now());
              }),
              put: vi.fn().mockImplementation((item) => {
                if (!stores[name]) stores[name] = [];
                const index = stores[name].findIndex((i: any) => i.id === item.id);
                if (index >= 0) {
                  stores[name][index] = { ...stores[name][index], ...item };
                } else {
                  stores[name].push(item);
                }
                return Promise.resolve(item.id || Date.now());
              }),
              get: vi.fn().mockImplementation((id) => {
                if (!stores[name]) stores[name] = [];
                const item = stores[name].find((i: any) => i.id === id);
                return Promise.resolve(item);
              }),
              getAll: vi.fn().mockImplementation(() => {
                return Promise.resolve(stores[name] || []);
              }),
              where: vi.fn().mockReturnThis(),
              equals: vi.fn().mockReturnThis(),
              first: vi.fn().mockImplementation(() => {
                return Promise.resolve(stores[name] ? stores[name][0] : undefined);
              }),
              toArray: vi.fn().mockImplementation(() => {
                return Promise.resolve(stores[name] || []);
              }),
              clear: vi.fn().mockImplementation(() => {
                if (stores[name]) stores[name] = [];
                return Promise.resolve();
              }),
              delete: vi.fn().mockImplementation((id) => {
                if (!stores[name]) stores[name] = [];
                const index = stores[name].findIndex((i: any) => i.id === id);
                if (index >= 0) {
                  stores[name].splice(index, 1);
                }
                return Promise.resolve();
              }),
              count: vi.fn().mockImplementation(() => {
                return Promise.resolve(stores[name] ? stores[name].length : 0);
              })
            };
          })
        }),
        close: vi.fn()
      }
    }),
    deleteDatabase: vi.fn().mockReturnValue({
      set onsuccess(cb: () => void) {
        cb()
      }
    })
  }
}

// Mock window.indexedDB
Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB()
})