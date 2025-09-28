import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutomaticPriceUpdateService } from '@/features/pricing/AutomaticPriceUpdateService';
import { settingRepository } from '@/data/repos';
import { PriceUpdateService } from '@/features/pricing/PriceUpdateService';

// Mock the dependencies
vi.mock('@/data/repos', () => {
  const actual = vi.importActual('@/data/repos');
  return {
    settingRepository: {
      get: vi.fn(),
      set: vi.fn()
    },
    valuationRepository: {
      getAll: vi.fn(),
      add: vi.fn()
    },
    sellAllocationRepository: {
      getByLotId: vi.fn()
    },
    cardLotRepository: {
      getByAcquisitionId: vi.fn()
    },
    transactionRepository: {
      getById: vi.fn()
    },
    ...actual
  };
});

vi.mock('@/features/pricing/PriceUpdateService', () => ({
  PriceUpdateService: {
    syncPrices: vi.fn()
  }
}));

// Simple mock for the import status store
let mockImportStatusStore: any;

vi.mock('@/stores/importStatus', async () => {
  const actual = await vi.importActual('@/stores/importStatus');
  return {
    ...actual,
    useImportStatusStore: () => mockImportStatusStore
  };
});

describe('AutomaticPriceUpdateService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Initialize the mock store
    mockImportStatusStore = {
      imports: [],
      addImport: vi.fn(),
      updateImport: vi.fn(),
      completeImport: vi.fn(),
      removeImport: vi.fn(),
      clearCompletedImports: vi.fn(),
      getActiveImports: vi.fn().mockReturnValue([]),
      getCompletedImports: vi.fn().mockReturnValue([])
    };
    
    // Set up default mock implementation for addImport
    mockImportStatusStore.addImport.mockImplementation((importData) => {
      return importData.id || 'import-id';
    });
  });

  describe('needsPriceUpdate', () => {
    it('should return true when no last update timestamp exists', async () => {
      (settingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await AutomaticPriceUpdateService.needsPriceUpdate();

      expect(result).toBe(true);
      expect(settingRepository.get).toHaveBeenCalledWith('last_price_update_timestamp');
    });

    it('should return true when more than 24 hours have passed since last update', async () => {
      const twentyFiveHoursAgo = new Date(Date.now() - (25 * 60 * 60 * 1000)).toISOString();
      (settingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(twentyFiveHoursAgo);

      const result = await AutomaticPriceUpdateService.needsPriceUpdate();

      expect(result).toBe(true);
    });

    it('should return false when less than 24 hours have passed since last update', async () => {
      const twelveHoursAgo = new Date(Date.now() - (12 * 60 * 60 * 1000)).toISOString();
      (settingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(twelveHoursAgo);

      const result = await AutomaticPriceUpdateService.needsPriceUpdate();

      expect(result).toBe(false);
    });

    it('should return true when there is an error checking the last update time', async () => {
      (settingRepository.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error'));

      const result = await AutomaticPriceUpdateService.needsPriceUpdate();

      expect(result).toBe(true);
    });
  });

  describe('updatePrices', () => {
    it('should update prices and record the update time', async () => {
      (PriceUpdateService.syncPrices as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (settingRepository.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await AutomaticPriceUpdateService.updatePrices();

      expect(PriceUpdateService.syncPrices).toHaveBeenCalled();
      expect(settingRepository.set).toHaveBeenCalledWith(
        'last_price_update_timestamp',
        expect.any(String)
      );
    });

    it('should throw an error when price update fails', async () => {
      (PriceUpdateService.syncPrices as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      await expect(AutomaticPriceUpdateService.updatePrices()).rejects.toThrow('Network error');
    });

    it('should create import status and track progress during price updates', async () => {
      // Mock the syncPrices to call the progress callback
      (PriceUpdateService.syncPrices as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
        if (callback) {
          callback(1, 2); // 1 out of 2
          callback(2, 2); // 2 out of 2
        }
        return Promise.resolve();
      });
      (settingRepository.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      // Set up mock to return a specific ID
      const testImportId = 'test-import-id';
      mockImportStatusStore.addImport.mockImplementation((importData) => {
        return testImportId;
      });

      await AutomaticPriceUpdateService.updatePrices();

      // Verify import status interactions
      expect(mockImportStatusStore.addImport).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'pricing',
        name: 'Price Updates',
        status: 'pending',
        progress: 0,
        totalItems: 0,
        processedItems: 0
      });

      // Verify progress updates
      expect(mockImportStatusStore.updateImport).toHaveBeenCalledTimes(2);
      expect(mockImportStatusStore.updateImport).toHaveBeenNthCalledWith(1, testImportId, {
        status: 'processing',
        progress: 50, // 1 out of 2 = 50%
        totalItems: 2,
        processedItems: 1
      });
      expect(mockImportStatusStore.updateImport).toHaveBeenNthCalledWith(2, testImportId, {
        status: 'processing',
        progress: 100, // 2 out of 2 = 100%
        totalItems: 2,
        processedItems: 2
      });

      // Verify completion
      expect(mockImportStatusStore.completeImport).toHaveBeenCalledWith(testImportId);
    });

    it('should mark import as failed when price update throws an error', async () => {
      const errorMessage = 'Network error';
      (PriceUpdateService.syncPrices as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(errorMessage));

      // Set up mock to return a specific ID
      const testImportId = 'test-import-id';
      mockImportStatusStore.addImport.mockImplementation((importData) => {
        return testImportId;
      });

      await expect(AutomaticPriceUpdateService.updatePrices()).rejects.toThrow(errorMessage);

      // Verify import status interactions
      expect(mockImportStatusStore.addImport).toHaveBeenCalledWith({
        id: expect.any(String),
        type: 'pricing',
        name: 'Price Updates',
        status: 'pending',
        progress: 0,
        totalItems: 0,
        processedItems: 0
      });

      // Verify failure
      expect(mockImportStatusStore.completeImport).toHaveBeenCalledWith(testImportId, errorMessage);
    });
  });

  describe('getLastUpdateTime', () => {
    it('should return the last update time when it exists', async () => {
      const timestamp = new Date().toISOString();
      (settingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(timestamp);

      const result = await AutomaticPriceUpdateService.getLastUpdateTime();

      expect(result).toEqual(new Date(timestamp));
    });

    it('should return null when no last update time exists', async () => {
      (settingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await AutomaticPriceUpdateService.getLastUpdateTime();

      expect(result).toBeNull();
    });

    it('should return null when there is an error getting the last update time', async () => {
      (settingRepository.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error'));

      const result = await AutomaticPriceUpdateService.getLastUpdateTime();

      expect(result).toBeNull();
    });
  });

  describe('getNextUpdateTime', () => {
    it('should return the current time when no last update exists', async () => {
      (settingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await AutomaticPriceUpdateService.getNextUpdateTime();

      expect(result).toBeInstanceOf(Date);
    });

    it('should return 24 hours after the last update time', async () => {
      const lastUpdate = new Date('2023-01-01T12:00:00Z');
      const expectedNextUpdate = new Date('2023-01-02T12:00:00Z');
      (settingRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(lastUpdate.toISOString());

      const result = await AutomaticPriceUpdateService.getNextUpdateTime();

      expect(result).toEqual(expectedNextUpdate);
    });
  });
});