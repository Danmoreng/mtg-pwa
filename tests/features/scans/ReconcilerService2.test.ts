import { describe, it, expect, beforeEach, vi } from 'vitest';
import { remainingQty } from '@/features/scans/ReconcilerService';

// Mock repositories
vi.mock('@/data/repos', async () => {
  const actual = await vi.importActual('@/data/repos');
  return {
    ...actual,
    cardLotRepository: {
      add: vi.fn().mockResolvedValue('mock-id'),
      getById: vi.fn().mockResolvedValue(null)
    },
    sellAllocationRepository: {
      add: vi.fn().mockResolvedValue('mock-id'),
      getByLotId: vi.fn().mockResolvedValue([])
    }
  };
});

describe('ReconcilerService2 - remainingQty function', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('remainingQty', () => {
    it('should return the initial quantity when there are no allocations', async () => {
      const mockLot = {
        id: 'lot1',
        cardId: 'card1',
        quantity: 10,
        unitCost: 100,
        condition: 'NM',
        language: 'en',
        foil: false,
        finish: 'nonfoil',
        source: 'test',
        purchasedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Mock the cardLotRepository to return the lot
      const { cardLotRepository } = await import('@/data/repos');
      (cardLotRepository.getById as vi.Mock).mockResolvedValue(mockLot);

      const remaining = await remainingQty('lot1');
      expect(remaining).toBe(10);
    });

    it('should subtract the allocated quantity', async () => {
      const mockLot = {
        id: 'lot1',
        cardId: 'card1',
        quantity: 10,
        unitCost: 100,
        condition: 'NM',
        language: 'en',
        foil: false,
        finish: 'nonfoil',
        source: 'test',
        purchasedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Mock the allocations
      const mockAllocations = [
        {
          id: 'alloc1',
          transactionId: 'tx1',
          lotId: 'lot1',
          quantity: 3,
          createdAt: new Date(),
        }
      ];
      
      // Mock repositories
      const { cardLotRepository, sellAllocationRepository } = await import('@/data/repos');
      (cardLotRepository.getById as vi.Mock).mockResolvedValue(mockLot);
      (sellAllocationRepository.getByLotId as vi.Mock).mockResolvedValue(mockAllocations);

      const remaining = await remainingQty('lot1');
      expect(remaining).toBe(7);
    });
  });
});