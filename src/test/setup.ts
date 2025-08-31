import { vi } from 'vitest'

// Mock indexedDB
const mockIndexedDB = () => {
  return {
    open: vi.fn().mockReturnValue({
      set onsuccess(cb: (event: { target: { result: any } }) => void) {
        cb({ target: { result: this.result } })
      },
      set onerror(cb: (event: { target: { error: Error } }) => void) {
        cb({ target: { error: new Error('IDB error') } })
      },
      result: {
        createObjectStore: vi.fn().mockReturnValue({
          createIndex: vi.fn()
        }),
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            add: vi.fn().mockResolvedValue(1),
            put: vi.fn().mockResolvedValue(1),
            get: vi.fn().mockResolvedValue(undefined),
            getAll: vi.fn().mockResolvedValue([]),
            delete: vi.fn().mockResolvedValue(undefined),
            where: vi.fn().mockReturnThis(),
            equals: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(undefined),
            toArray: vi.fn().mockResolvedValue([])
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