import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findOrCreateProvisionalLot } from '../src/features/scans/ReconcilerService';
import { cardLotRepository } from '../src/data/repos';
import type { CardLot } from '../src/data/db';

// Mock the repository
vi.mock('../src/data/repos', () => ({
  cardLotRepository: {
    create: vi.fn(),
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
    
    // Mock the create function to return a new lot
    const expectedNewLot = {
      id: 'lot_mock_id',
      cardId: 'card123',
      cardFingerprint: 'mtg:dom:1:nonfoil:en',
      finish: 'nonfoil',
      language: 'en',
      quantity: 0,
      purchasedAt: new Date('2023-01-01'),
      source: 'provisional',
      acquisitionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    (cardLotRepository.create as vi.Mock).mockResolvedValue(expectedNewLot);

    // Call the function
    const result = await findOrCreateProvisionalLot(
      mockIdentity,
      new Date('2023-01-01'),
      'provisional',
      null
    );

    // Verify
    expect(cardLotRepository.getByCardId).toHaveBeenCalledWith('card123');
    expect(cardLotRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cardId: 'card123',
        cardFingerprint: 'mtg:dom:1:nonfoil:en',
        finish: 'nonfoil',
        language: 'en',
        quantity: 0,
        purchasedAt: new Date('2023-01-01'),
        source: 'provisional',
        acquisitionId: null,
      })
    );
    expect(result).toEqual(expectedNewLot);
  });

  it('should reuse an existing provisional lot', async () => {
    // Setup: Simulate that a provisional lot already exists
    const existingLot: CardLot = {
      id: 'existing_lot_id',
      cardId: 'card123',
      cardFingerprint: 'mtg:dom:1:nonfoil:en',
      finish: 'nonfoil',
      language: 'en',
      quantity: 0,
      purchasedAt: new Date('2023-01-01'),
      source: 'provisional',
      acquisitionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    (cardLotRepository.getByCardId as vi.Mock).mockResolvedValue([existingLot]);

    // Call the function
    const result = await findOrCreateProvisionalLot(
      mockIdentity,
      new Date('2023-01-02'), // Different date but should find the existing one
      'provisional',
      null
    );

    // Verify that no new lot was created
    expect(cardLotRepository.create).not.toHaveBeenCalled();
    expect(result).toEqual(existingLot);
  });
});