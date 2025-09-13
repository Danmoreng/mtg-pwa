import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScryfallProvider } from '../../features/pricing/ScryfallProvider';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ScryfallProvider', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Reset rate limiting
    ScryfallProvider['lastRequestTime'] = 0;
  });

  describe('getPricesByIds', () => {
    it('should return empty array when no IDs are provided', async () => {
      const result = await ScryfallProvider.getPricesByIds([]);
      
      expect(result).toEqual([]);
    });

    it('should return empty array when null IDs are provided', async () => {
      const result = await ScryfallProvider.getPricesByIds(null as any);
      
      expect(result).toEqual([]);
    });

    it('should use individual lookup when only one ID is provided', async () => {
      // Mock the getPriceById method to return a mock price
      const mockGetPriceById = vi.spyOn(ScryfallProvider as any, 'getPriceById');
      mockGetPriceById.mockResolvedValueOnce({
        getCents: () => 100,
        getCurrency: () => 'EUR'
      });
      
      const result = await ScryfallProvider.getPricesByIds(['card-1']);
      
      expect(mockGetPriceById).toHaveBeenCalledWith('card-1');
      expect(result).toEqual([{ 'card-1': { eur: 1 } }]);
    });

    it('should use batch endpoint when multiple IDs are provided', async () => {
      // Mock successful batch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              id: 'card-1',
              prices: {
                eur: '1.50',
                eur_foil: '3.00'
              }
            },
            {
              id: 'card-2',
              prices: {
                eur: '2.00'
              }
            }
          ]
        })
      });
      
      const result = await ScryfallProvider.getPricesByIds(['card-1', 'card-2']);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/collection',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            identifiers: [
              { id: 'card-1' },
              { id: 'card-2' }
            ]
          })
        }
      );
      
      expect(result).toEqual([
        { 'card-1': { eur: 1.5, eur_foil: 3 } },
        { 'card-2': { eur: 2 } }
      ]);
    });

    it('should fall back to individual lookups when batch request fails', async () => {
      // Mock failed batch response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });
      
      // Mock individual fetch calls for fallback
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'card-1',
            prices: { eur: '1.50' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'card-2',
            prices: { eur: '2.00' }
          })
        });
      
      const result = await ScryfallProvider.getPricesByIds(['card-1', 'card-2']);
      
      // Should call fetch 3 times: 1 for batch (failed) + 2 for individual
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual([
        { 'card-1': { eur: 1.5 } },
        { 'card-2': { eur: 2 } }
      ]);
    });

    it('should handle errors in individual lookups during fallback', async () => {
      // Mock failed batch response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });
      
      // Mock individual fetch calls with one failure
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            id: 'card-2',
            prices: { eur: '2.00' }
          })
        });
      
      const result = await ScryfallProvider.getPricesByIds(['card-1', 'card-2']);
      
      // Should call fetch 3 times: 1 for batch (failed) + 2 for individual
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual([
        { 'card-2': { eur: 2 } }
      ]);
    });
  });
});