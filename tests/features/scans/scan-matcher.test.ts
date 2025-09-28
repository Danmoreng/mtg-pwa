import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScanMatchingService } from '@/features/scans/ScanMatchingService';
import * as Reconciler from '@/features/scans/ReconcilerService';

// Mock the reconciler service
vi.mock('@/features/scans/ReconcilerService', () => ({
  runFullReconciler: vi.fn()
}));

describe('ScanMatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run the new reconciler when matchScansToSales is called', async () => {
    // Spy on console.info to verify the message is shown
    const consoleSpy = vi.spyOn(console, 'info');
    
    // Call the matchScansToSales method
    await ScanMatchingService.matchScansToSales();

    // Verify the message was logged
    expect(consoleSpy).toHaveBeenCalledWith('Running new M3 reconciler');
    
    // Verify that the new reconciler was called
    expect(Reconciler.runFullReconciler).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});