import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceQueryService } from '../../src/features/pricing/PriceQueryService';
import { pricePointRepository } from '../../src/data/repos';

describe('PriceQueryService', () => {
  // Mock price point data
  const mockPricePoints = [
    {
      id: 'card1:scryfall:nonfoil:2023-01-01',
      cardId: 'card1',
      provider: 'scryfall',
      finish: 'nonfoil',
      date: '2023-01-01',
      currency: 'EUR',
      priceCent: 1000, // 10 EUR
      asOf: new Date('2023-01-01')
    },
    {
      id: 'card1:mtgjson.cardmarket:nonfoil:2023-01-01',
      cardId: 'card1',
      provider: 'mtgjson.cardmarket',
      finish: 'nonfoil',
      date: '2023-01-01',
      currency: 'EUR',
      priceCent: 1200, // 12 EUR
      asOf: new Date('2023-01-01')
    },
    {
      id: 'card1:cardmarket.priceguide:nonfoil:2023-01-01',
      cardId: 'card1',
      provider: 'cardmarket.priceguide',
      finish: 'nonfoil',
      date: '2023-01-01',
      currency: 'EUR',
      priceCent: 1100, // 11 EUR
      asOf: new Date('2023-01-01')
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sort price points by provider precedence', () => {
    // Test the private method through the public interface
    const sorted = (PriceQueryService as any).sortPricePointsByPrecedence([...mockPricePoints]);
    
    // cardmarket.priceguide should have highest precedence
    expect(sorted[0].provider).toBe('cardmarket.priceguide');
    // mtgjson.cardmarket should have middle precedence
    expect(sorted[1].provider).toBe('mtgjson.cardmarket');
    // scryfall should have lowest precedence
    expect(sorted[2].provider).toBe('scryfall');
  });

  it('should return correct precedence rank', () => {
    expect(PriceQueryService.getSourcePrecedence('cardmarket.priceguide')).toBe(0);
    expect(PriceQueryService.getSourcePrecedence('mtgjson.cardmarket')).toBe(1);
    expect(PriceQueryService.getSourcePrecedence('scryfall')).toBe(2);
    expect(PriceQueryService.getSourcePrecedence('unknown')).toBe(Infinity);
  });

  it('should return the latest price with the highest precedence', async () => {
    vi.spyOn(pricePointRepository, 'getByCardId').mockResolvedValue(mockPricePoints);

    const latestPrice = await PriceQueryService.getLatestPriceForCard('card1');

    expect(latestPrice).not.toBeNull();
    expect(latestPrice?.provider).toBe('cardmarket.priceguide');
    expect(latestPrice?.price.getCents()).toBe(1100);
  });
});