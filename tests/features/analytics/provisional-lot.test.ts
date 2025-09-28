import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findOrCreateProvisionalLot, findLotsByIdentity } from '@/features/scans/ReconcilerService';
import { cardLotRepository } from '@/data/repos';
import type { CardLot } from '@/data/db';

// Mock the repository
vi.mock('@/data/repos', () => ({
  cardLotRepository: {
    add: vi.fn(),
    getById: vi.fn(),
    getByCardId: vi.fn(),
  }
}));

describe('findOrCreateProvisionalLot', () => {
  const mockIdentity = {
    cardId: 'card123',
    fingerprint: 'mtg:dom:1:nonfoil:en',
    finish: 'nonfoil',
    lang: 'en'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new provisional lot when none exists', async () => {
    // Setup: Simulate that no lot exists for this identity
    (cardLotRepository.getByCardId as vi.Mock).mockResolvedValue([]);
    
    // Mock the add and getById function to return a new lot
    const expectedNewLotId = 'lot_mock_id';
    const expectedNewLot: CardLot = {
      id: expectedNewLotId,
      cardId: 'card123',
      finish: 'nonfoil',
      language: 'en',
      quantity: 0,
      unitCost: 0,
      condition: 'Near Mint',
      foil: false,
      source: 'provisional',
      purchasedAt: new Date('2023-01-01'),
      acquisitionId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    (cardLotRepository.add as vi.Mock).mockResolvedValue(expectedNewLotId);
    (cardLotRepository.getById as vi.Mock).mockResolvedValue(expectedNewLot);

    // Call the function
    const result = await findOrCreateProvisionalLot(
      mockIdentity,
      new Date('2023-01-01'),
      'provisional',
      undefined
    );

    // Verify
    expect(cardLotRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'card123',
        finish: 'nonfoil',
        language: 'en',
        quantity: 0,
        purchasedAt: new Date('2023-01-01'),
        source: 'provisional',
        acquisitionId: undefined,
      })
    );
    expect(cardLotRepository.getById).toHaveBeenCalledWith(expectedNewLotId);
    expect(result).toEqual(expectedNewLot);
  });

  it('should reuse an existing provisional lot', async () => {
    // Setup: Simulate that a provisional lot already exists
    const existingLot: CardLot = {
      id: 'existing_lot_id',
      cardId: 'card123',
      finish: 'nonfoil',
      language: 'en',
      quantity: 0,
      unitCost: 0,
      condition: 'Near Mint',
      foil: false,
      source: 'provisional',
      purchasedAt: new Date('2023-01-01'),
      acquisitionId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    (cardLotRepository.getByCardId as vi.Mock).mockResolvedValue([existingLot]);

    // Call the function
    const result = await findOrCreateProvisionalLot(
      mockIdentity,
      new Date('2023-01-02'), // Different date but should find the existing one
      'provisional',
      undefined
    );

    // Verify that no new lot was created
    expect(cardLotRepository.add).not.toHaveBeenCalled();
    expect(result).toEqual(existingLot);
  });
});