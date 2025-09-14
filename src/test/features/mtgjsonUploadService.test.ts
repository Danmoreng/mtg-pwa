import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MTGJSONUploadService } from '../../src/features/pricing/MTGJSONUploadService';
import { spawn, Worker } from 'threads';

// Mock the threads library
vi.mock('threads', () => ({
  spawn: vi.fn(),
  Worker: vi.fn()
}));

describe('MTGJSONUploadService', () => {
  const mockWorker = {
    upload: vi.fn(),
    terminate: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (spawn as jest.Mock).mockResolvedValue(mockWorker);
    (Worker as jest.Mock).mockImplementation(() => ({}));
  });

  it('should upload MTGJSON file correctly', async () => {
    const mockFile = new File(['{}'], 'AllPrices.json', { type: 'application/json' });
    const mockWantedIds = ['card-1', 'card-2'];
    const mockWrittenCount = 100;
    
    // Mock dependencies
    const mockCardRepository = {
      getAll: vi.fn().mockResolvedValue([{ id: 'card-1' }, { id: 'card-2' }])
    };
    
    // Mock the upload worker result
    mockWorker.upload.mockResolvedValue(mockWrittenCount);
    
    // Import with mocked dependencies
    vi.doMock('../../data/repos', () => ({
      cardRepository: mockCardRepository,
      pricePointRepository: {}
    }));
    
    // Since we can't easily mock the imports, we'll test the structure of the call
    await MTGJSONUploadService.upload(mockFile, vi.fn());
    
    // Verify spawn was called with timeout
    expect(spawn).toHaveBeenCalledWith(expect.anything(), { timeout: 300000 });
    
    // Verify upload was called with correct parameters
    expect(mockWorker.upload).toHaveBeenCalledWith(mockFile, mockWantedIds);
  });

  it('should handle worker errors', async () => {
    const mockFile = new File(['{}'], 'AllPrices.json', { type: 'application/json' });
    const mockError = new Error('Worker error');
    
    // Mock dependencies
    const mockCardRepository = {
      getAll: vi.fn().mockResolvedValue([])
    };
    
    // Mock the upload worker to throw an error
    mockWorker.upload.mockRejectedValue(mockError);
    
    // Mock console.error to prevent test output pollution
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Import with mocked dependencies
    vi.doMock('../../data/repos', () => ({
      cardRepository: mockCardRepository,
      pricePointRepository: {}
    }));
    
    // Test that the error is properly propagated
    await expect(MTGJSONUploadService.upload(mockFile, vi.fn())).rejects.toThrow(mockError);
    
    // Clean up
    consoleErrorSpy.mockRestore();
  });
});