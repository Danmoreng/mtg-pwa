import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScanMatchingService } from '../src/features/scans/ScanMatchingService';
import db from '../src/data/db';

// Mock database and repositories
vi.mock('../src/data/db', () => ({
  default: {
    scans: {
      where: vi.fn().mockReturnThis(),
      notEqual: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([])
    },
    transactions: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      count: vi.fn().mockResolvedValue(0),
      toArray: vi.fn().mockResolvedValue([])
    }
  }
}));

vi.mock('../src/data/repos', () => ({
  cardLotRepository: {
    getById: vi.fn(),
    update: vi.fn()
  },
  transactionRepository: {
    getByKind: vi.fn().mockResolvedValue([])
  },
  scanRepository: {
    update: vi.fn()
  }
}));

describe('ScanMatchingService with feature flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip legacy matcher when M3_RECONCILER_ONLY is true', async () => {
    // Set environment variable
    const originalEnv = process.env.M3_RECONCILER_ONLY;
    process.env.M3_RECONCILER_ONLY = 'true';

    // Spy on console.warn to verify the warning is shown
    const consoleSpy = vi.spyOn(console, 'warn');
    
    // Call the matchScansToSales method
    await ScanMatchingService.matchScansToSales();

    // Verify the warning was logged
    expect(consoleSpy).toHaveBeenCalledWith('M3_RECONCILER_ONLY is enabled, skipping legacy matcher');

    // Restore original environment
    process.env.M3_RECONCILER_ONLY = originalEnv;
    consoleSpy.mockRestore();
  });

  it('should run legacy matcher when M3_RECONCILER_ONLY is false', async () => {
    // Set environment variable
    const originalEnv = process.env.M3_RECONCILER_ONLY;
    process.env.M3_RECONCILER_ONLY = 'false';

    // Spy on console.warn to verify the warning is NOT shown
    const consoleSpy = vi.spyOn(console, 'warn');
    
    // Call the matchScansToSales method
    await ScanMatchingService.matchScansToSales();

    // Verify the warning was NOT logged (the legacy path should run)
    expect(consoleSpy).not.toHaveBeenCalledWith('M3_RECONCILER_ONLY is enabled, skipping legacy matcher');

    // Restore original environment
    process.env.M3_RECONCILER_ONLY = originalEnv;
    consoleSpy.mockRestore();
  });

  it('should run legacy matcher when M3_RECONCILER_ONLY is undefined', async () => {
    // Set environment variable to undefined
    const originalEnv = process.env.M3_RECONCILER_ONLY;
    delete process.env.M3_RECONCILER_ONLY;

    // Spy on console.warn to verify the warning is NOT shown
    const consoleSpy = vi.spyOn(console, 'warn');
    
    // Call the matchScansToSales method
    await ScanMatchingService.matchScansToSales();

    // Verify the warning was NOT logged (the legacy path should run)
    expect(consoleSpy).not.toHaveBeenCalledWith('M3_RECONCILER_ONLY is enabled, skipping legacy matcher');

    // Restore original environment
    process.env.M3_RECONCILER_ONLY = originalEnv;
    consoleSpy.mockRestore();
  });
});