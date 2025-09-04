import { describe, it, expect, beforeEach } from 'vitest';
import { cardLotRepository } from '../../data/repos';
import db from '../../data/db';

describe('CardLot', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await db.card_lots.clear();
  });

  it('should create a new card lot', async () => {
    const lot = {
      id: 'test-lot-1',
      cardId: 'test-card-1',
      quantity: 3,
      unitCost: 1000, // 10.00 EUR in cents
      condition: 'NM',
      language: 'en',
      foil: false,
      finish: 'nonfoil',
      source: 'cardmarket',
      purchasedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const id = await cardLotRepository.add(lot);
    expect(id).toBe('test-lot-1');

    const retrievedLot = await cardLotRepository.getById('test-lot-1');
    expect(retrievedLot).toBeDefined();
    expect(retrievedLot?.cardId).toBe('test-card-1');
    expect(retrievedLot?.quantity).toBe(3);
    expect(retrievedLot?.unitCost).toBe(1000);
  });

  it('should retrieve lots by card ID', async () => {
    // Create multiple lots for the same card
    const lot1 = {
      id: 'test-lot-1',
      cardId: 'test-card-1',
      quantity: 2,
      unitCost: 1000,
      condition: 'NM',
      language: 'en',
      foil: false,
      finish: 'nonfoil',
      source: 'cardmarket',
      purchasedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const lot2 = {
      id: 'test-lot-2',
      cardId: 'test-card-1',
      quantity: 1,
      unitCost: 1500,
      condition: 'NM',
      language: 'en',
      foil: true,
      finish: 'foil',
      source: 'cardmarket',
      purchasedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cardLotRepository.add(lot1);
    await cardLotRepository.add(lot2);

    const lots = await cardLotRepository.getByCardId('test-card-1');
    expect(lots).toHaveLength(2);
    expect(lots[0].id).toBe('test-lot-1');
    expect(lots[1].id).toBe('test-lot-2');
  });

  it('should retrieve active lots by card ID', async () => {
    // Create an active lot (not disposed)
    const activeLot = {
      id: 'active-lot',
      cardId: 'test-card-1',
      quantity: 2,
      unitCost: 1000,
      condition: 'NM',
      language: 'en',
      foil: false,
      finish: 'nonfoil',
      source: 'cardmarket',
      purchasedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create a disposed lot
    const disposedLot = {
      id: 'disposed-lot',
      cardId: 'test-card-1',
      quantity: 1,
      unitCost: 1500,
      condition: 'NM',
      language: 'en',
      foil: true,
      finish: 'foil',
      source: 'cardmarket',
      purchasedAt: new Date(),
      disposedAt: new Date(),
      disposedQuantity: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cardLotRepository.add(activeLot);
    await cardLotRepository.add(disposedLot);

    const activeLots = await cardLotRepository.getActiveLotsByCardId('test-card-1');
    expect(activeLots).toHaveLength(1);
    expect(activeLots[0].id).toBe('active-lot');
  });

  it('should update a card lot', async () => {
    const lot = {
      id: 'test-lot-1',
      cardId: 'test-card-1',
      quantity: 3,
      unitCost: 1000,
      condition: 'NM',
      language: 'en',
      foil: false,
      finish: 'nonfoil',
      source: 'cardmarket',
      purchasedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cardLotRepository.add(lot);

    // Update the lot
    const updateResult = await cardLotRepository.update('test-lot-1', {
      quantity: 5,
      unitCost: 1200
    });

    expect(updateResult).toBe(1); // Number of updated records

    const updatedLot = await cardLotRepository.getById('test-lot-1');
    expect(updatedLot?.quantity).toBe(5);
    expect(updatedLot?.unitCost).toBe(1200);
  });

  it('should delete a card lot', async () => {
    const lot = {
      id: 'test-lot-1',
      cardId: 'test-card-1',
      quantity: 3,
      unitCost: 1000,
      condition: 'NM',
      language: 'en',
      foil: false,
      finish: 'nonfoil',
      source: 'cardmarket',
      purchasedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await cardLotRepository.add(lot);

    // Verify the lot exists
    const existingLot = await cardLotRepository.getById('test-lot-1');
    expect(existingLot).toBeDefined();

    // Delete the lot
    await cardLotRepository.delete('test-lot-1');

    // Verify the lot no longer exists
    const deletedLot = await cardLotRepository.getById('test-lot-1');
    expect(deletedLot).toBeUndefined();
  });
});