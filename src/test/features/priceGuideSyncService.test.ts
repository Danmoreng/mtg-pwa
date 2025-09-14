import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceGuideSyncService } from '../../src/features/pricing/PriceGuideSyncService';
import { WorkerManager } from '../../src/workers/WorkerManager';

// Mock the WorkerManager
vi.mock('../../src/workers/WorkerManager', () => ({
  WorkerManager: {
    createWorker: vi.fn(),
    terminateWorker: vi.fn()
  }
}));

describe('PriceGuideSyncService', () => {
  const mockWorker = {
    onmessage: null as Function | null,
    onerror: null as Function | null,
    postMessage: vi.fn(),
    terminate: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (WorkerManager.createWorker as jest.Mock).mockReturnValue(mockWorker);
  });

  it('should sync Price Guide data correctly', async () => {
    const mockResult = { success: true, processedCards: 50 };
    
    // Simulate worker completion
    setTimeout(() => {
      if (mockWorker.onmessage) {
        mockWorker.onmessage({ data: { type: 'priceGuideSyncComplete', ...mockResult } });
      }
    }, 0);

    const result = await PriceGuideSyncService.syncPriceGuide();
    
    expect(WorkerManager.createWorker).toHaveBeenCalledWith('./priceGuideSync.ts');
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: 'syncPriceGuide'
    });
    expect(result).toEqual(mockResult);
  });

  it('should handle worker errors', async () => {
    // Simulate worker error
    setTimeout(() => {
      if (mockWorker.onerror) {
        mockWorker.onerror(new Error('Worker error'));
      }
    }, 0);

    const result = await PriceGuideSyncService.syncPriceGuide();
    
    expect(result.success).toBe(false);
    expect(result.message).toBe('Worker error');
  });
});