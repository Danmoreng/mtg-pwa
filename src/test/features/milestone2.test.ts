// Test suite for Milestone 2 pricing features
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MTGJSONBackfillService } from '../../features/pricing/MTGJSONBackfillService';
import { PriceGuideSyncWorker } from '../../features/pricing/PriceGuideSyncWorker';
import { PriceQueryService } from '../../features/pricing/PriceQueryService';
import { PriceUpdateService } from '../../features/pricing/PriceUpdateService';
import { ValuationEngine } from '../../features/analytics/ValuationEngine';
import db from '../../data/db';
import { Money } from '../../core/Money';

describe('Milestone 2 Pricing Features', () => {
  beforeEach(async () => {
    // Clear the database before each test
    await db.price_points.clear();
    await db.cards.clear();
    await db.card_lots.clear();
    await db.transactions.clear();
    await db.valuations.clear();
  });

  describe('MTGJSONBackfillService', () => {
    it('should create price points with correct format', async () => {
      // Mock card data
      const mockCard = {
        id: 'test-card-id-1',
        name: 'Lightning Bolt',
        set: 'Alpha',
        setCode: 'LEA',
        number: '1',
        lang: 'en',
        finish: 'nonfoil'
      };

      // Add mock card to database
      await db.cards.add(mockCard);

      // Mock MTGJSON API response
      const mockPriceData = {
        data: {
          'test-card-id-1': {
            paper: {
              cardmarket: {
                retail: {
                  '2023-01-01': {
                    normal: 1.50,
                    foil: 5.75
                  },
                  '2023-01-02': {
                    normal: 1.55,
                    foil: 5.80
                  }
                }
              }
            }
          }
        }
      };

      // Mock the fetch function
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPriceData)
      });

      // Run backfill
      await MTGJSONBackfillService.processMTGJSONBackfill(mockPriceData);

      // Check that price points were created
      const pricePoints = await db.price_points.toArray();
      expect(pricePoints).toHaveLength(4); // 2 dates × 2 finishes

      // Check nonfoil price points
      const nonfoilPricePoints = pricePoints.filter(pp => pp.finish === 'nonfoil');
      expect(nonfoilPricePoints).toHaveLength(2);
      
      const jan1Nonfoil = nonfoilPricePoints.find(pp => pp.date === '2023-01-01');
      expect(jan1Nonfoil).toBeDefined();
      expect(jan1Nonfoil!.priceCent).toBe(150); // €1.50 in cents
      expect(jan1Nonfoil!.provider).toBe('mtgjson.cardmarket');

      const jan2Nonfoil = nonfoilPricePoints.find(pp => pp.date === '2023-01-02');
      expect(jan2Nonfoil).toBeDefined();
      expect(jan2Nonfoil!.priceCent).toBe(155); // €1.55 in cents

      // Check foil price points
      const foilPricePoints = pricePoints.filter(pp => pp.finish === 'foil');
      expect(foilPricePoints).toHaveLength(2);
      
      const jan1Foil = foilPricePoints.find(pp => pp.date === '2023-01-01');
      expect(jan1Foil).toBeDefined();
      expect(jan1Foil!.priceCent).toBe(575); // €5.75 in cents
      expect(jan1Foil!.provider).toBe('mtgjson.cardmarket');

      const jan2Foil = foilPricePoints.find(pp => pp.date === '2023-01-02');
      expect(jan2Foil).toBeDefined();
      expect(jan2Foil!.priceCent).toBe(580); // €5.80 in cents
    });
  });

  describe('PriceGuideSyncWorker', () => {
    it('should create price points with average data', async () => {
      // Mock card data
      const mockCard = {
        id: 'test-card-id-2',
        name: 'Black Lotus',
        set: 'Alpha',
        setCode: 'LEA',
        number: '1',
        lang: 'en',
        finish: 'nonfoil',
        cardmarketId: '12345'
      };

      // Add mock card to database
      await db.cards.add(mockCard);

      // Mock the Price Guide sync
      await PriceGuideSyncWorker.syncPriceGuide();

      // Check that price points were created
      const pricePoints = await db.price_points.toArray();
      expect(pricePoints.length).toBeGreaterThan(0);

      // Check that at least one price point has average data
      const pricePointWithAvg = pricePoints.find(pp => pp.avg7dCent !== undefined);
      expect(pricePointWithAvg).toBeDefined();
      expect(pricePointWithAvg!.avg1dCent).toBeDefined();
      expect(pricePointWithAvg!.avg7dCent).toBeDefined();
      expect(pricePointWithAvg!.avg30dCent).toBeDefined();
      expect(pricePointWithAvg!.provider).toBe('cardmarket.priceguide');
    });
  });

  describe('PriceQueryService', () => {
    it('should respect provider precedence', async () => {
      const cardId = 'test-card-id-3';
      
      // Create price points with different providers
      const scryfallPricePoint = {
        id: `${cardId}:scryfall:nonfoil:2023-01-01`,
        cardId: cardId,
        provider: 'scryfall' as const,
        finish: 'nonfoil' as const,
        date: '2023-01-01',
        currency: 'EUR' as const,
        priceCent: 100, // €1.00
        asOf: new Date('2023-01-01'),
        createdAt: new Date()
      };

      const mtgjsonPricePoint = {
        id: `${cardId}:mtgjson.cardmarket:nonfoil:2023-01-01`,
        cardId: cardId,
        provider: 'mtgjson.cardmarket' as const,
        finish: 'nonfoil' as const,
        date: '2023-01-01',
        currency: 'EUR' as const,
        priceCent: 150, // €1.50
        asOf: new Date('2023-01-01'),
        createdAt: new Date()
      };

      const priceGuidePricePoint = {
        id: `${cardId}:cardmarket.priceguide:nonfoil:2023-01-01`,
        cardId: cardId,
        provider: 'cardmarket.priceguide' as const,
        finish: 'nonfoil' as const,
        date: '2023-01-01',
        currency: 'EUR' as const,
        priceCent: 200, // €2.00
        asOf: new Date('2023-01-01'),
        createdAt: new Date()
      };

      // Add all price points
      await db.price_points.bulkAdd([
        scryfallPricePoint,
        mtgjsonPricePoint,
        priceGuidePricePoint
      ]);

      // Get the latest price - should be from Price Guide (highest precedence)
      const latestPrice = await PriceQueryService.getLatestPriceForCard(cardId);
      expect(latestPrice).toBeDefined();
      expect(latestPrice!.price.getCents()).toBe(200); // €2.00
      expect(latestPrice!.provider).toBe('cardmarket.priceguide');
    });

    it('should filter price points by finish and provider', async () => {
      const cardId = 'test-card-id-4';
      
      // Create price points with different finishes and providers
      const pricePoints = [
        {
          id: `${cardId}:scryfall:nonfoil:2023-01-01`,
          cardId: cardId,
          provider: 'scryfall' as const,
          finish: 'nonfoil' as const,
          date: '2023-01-01',
          currency: 'EUR' as const,
          priceCent: 100,
          asOf: new Date('2023-01-01'),
          createdAt: new Date()
        },
        {
          id: `${cardId}:scryfall:foil:2023-01-01`,
          cardId: cardId,
          provider: 'scryfall' as const,
          finish: 'foil' as const,
          date: '2023-01-01',
          currency: 'EUR' as const,
          priceCent: 200,
          asOf: new Date('2023-01-01'),
          createdAt: new Date()
        },
        {
          id: `${cardId}:mtgjson.cardmarket:nonfoil:2023-01-01`,
          cardId: cardId,
          provider: 'mtgjson.cardmarket' as const,
          finish: 'nonfoil' as const,
          date: '2023-01-01',
          currency: 'EUR' as const,
          priceCent: 150,
          asOf: new Date('2023-01-01'),
          createdAt: new Date()
        }
      ];

      // Add all price points
      await db.price_points.bulkAdd(pricePoints);

      // Get nonfoil price points only
      const nonfoilPricePoints = await PriceQueryService.getPricePointsForCard(cardId, {
        finish: 'nonfoil'
      });
      expect(nonfoilPricePoints).toHaveLength(2);
      expect(nonfoilPricePoints.every(pp => pp.finish === 'nonfoil')).toBe(true);

      // Get Scryfall price points only
      const scryfallPricePoints = await PriceQueryService.getPricePointsForCard(cardId, {
        provider: 'scryfall'
      });
      expect(scryfallPricePoints).toHaveLength(2);
      expect(scryfallPricePoints.every(pp => pp.provider === 'scryfall')).toBe(true);

      // Get foil price points only
      const foilPricePoints = await PriceQueryService.getPricePointsForCard(cardId, {
        finish: 'foil'
      });
      expect(foilPricePoints).toHaveLength(1);
      expect(foilPricePoints[0].finish).toBe('foil');
      expect(foilPricePoints[0].priceCent).toBe(200);
    });
  });

  describe('PriceUpdateService', () => {
    it('should create price points with new format', async () => {
      // Mock card data
      const mockCard = {
        id: 'test-card-id-5',
        name: 'Counterspell',
        set: 'Alpha',
        setCode: 'LEA',
        number: '50',
        lang: 'en',
        finish: 'nonfoil'
      };

      // Add mock card to database
      await db.cards.add(mockCard);

      // Mock Scryfall API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'test-card-id-5': {
            eur: 0.75,
            eur_foil: 3.50
          }
        })
      });

      // Run price sync
      await PriceUpdateService.syncPriceForCard('test-card-id-5');

      // Check that price points were created with new format
      const pricePoints = await db.price_points.toArray();
      expect(pricePoints).toHaveLength(2);

      const nonfoilPricePoint = pricePoints.find(pp => pp.finish === 'nonfoil');
      expect(nonfoilPricePoint).toBeDefined();
      expect(nonfoilPricePoint!.id).toMatch(/test-card-id-5:scryfall:nonfoil:/);
      expect(nonfoilPricePoint!.priceCent).toBe(75); // €0.75 in cents

      const foilPricePoint = pricePoints.find(pp => pp.finish === 'foil');
      expect(foilPricePoint).toBeDefined();
      expect(foilPricePoint!.id).toMatch(/test-card-id-5:scryfall:foil:/);
      expect(foilPricePoint!.priceCent).toBe(350); // €3.50 in cents
    });
  });

  describe('ValuationEngine', () => {
    it('should use provider precedence when calculating lot values', async () => {
      // Mock card and lot data
      const mockCard = {
        id: 'test-card-id-6',
        name: 'Ancestral Recall',
        set: 'Alpha',
        setCode: 'LEA',
        number: '10',
        lang: 'en',
        finish: 'nonfoil'
      };

      const mockLot = {
        id: 'test-lot-id-1',
        cardId: 'test-card-id-6',
        quantity: 1,
        unitCost: 1000, // €10.00
        condition: 'NM',
        language: 'en',
        foil: false,
        finish: 'nonfoil',
        source: 'purchase',
        purchasedAt: new Date(),
        currency: 'EUR',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add mock data to database
      await db.cards.add(mockCard);
      await db.card_lots.add(mockLot);

      // Create price points with different providers
      const pricePoints = [
        {
          id: `test-card-id-6:scryfall:nonfoil:${new Date().toISOString().split('T')[0]}`,
          cardId: 'test-card-id-6',
          provider: 'scryfall' as const,
          finish: 'nonfoil' as const,
          date: new Date().toISOString().split('T')[0],
          currency: 'EUR' as const,
          priceCent: 1000, // €10.00
          asOf: new Date(),
          createdAt: new Date()
        },
        {
          id: `test-card-id-6:cardmarket.priceguide:nonfoil:${new Date().toISOString().split('T')[0]}`,
          cardId: 'test-card-id-6',
          provider: 'cardmarket.priceguide' as const,
          finish: 'nonfoil' as const,
          date: new Date().toISOString().split('T')[0],
          currency: 'EUR' as const,
          priceCent: 2000, // €20.00 (higher value)
          asOf: new Date(),
          createdAt: new Date()
        }
      ];

      // Add price points
      await db.price_points.bulkAdd(pricePoints);

      // Calculate lot value - should use Price Guide price (higher precedence)
      const lotValue = await ValuationEngine.calculateLotValue(mockLot);
      expect(lotValue.getCents()).toBe(2000); // €20.00 (from Price Guide)
    });
  });
});