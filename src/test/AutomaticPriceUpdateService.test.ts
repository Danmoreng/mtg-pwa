import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutomaticPriceUpdateService } from '../features/pricing/AutomaticPriceUpdateService';
import { settingRepository } from '../data/repos';
import { PriceUpdateService } from '../features/pricing/PriceUpdateService';

// Mock the dependencies
vi.mock('../data/repos', () => ({
  settingRepository: {
    get: vi.fn(),
    set: vi.fn()
  }
}));

vi.mock('../features/pricing/PriceUpdateService', () => ({
  PriceUpdateService: {
    syncPrices: vi.fn()
  }
}));

describe('AutomaticPriceUpdateService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
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