/*import { describe, it, expect, vi } from 'vitest';
import { ScryfallProvider } from '../../features/pricing/ScryfallProvider';

// Mock the fetch function
global.fetch = vi.fn();

describe('ScryfallProvider Batch Lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should use batch endpoint for multiple Cardmarket IDs', async () => {
    // Mock successful batch response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { id: 'card1', name: 'Lightning Bolt' },
          { id: 'card2', name: 'Counterspell' }
        ]
      })
    });

    const cardmarketIds = ['12345', '67890'];
    const result = await ScryfallProvider.getByCardmarketIds(cardmarketIds);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/collection',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifiers: [
            { cardmarket_id: '12345' },
            { cardmarket_id: '67890' }
          ]
        })
      }
    );
    
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('card1');
    expect(result[1].id).toBe('card2');
  });

  it('should fall back to individual lookups when batch fails', async () => {
    // Mock failed batch response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request'
    });
    
    // Mock individual successful responses
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'card1', name: 'Lightning Bolt' })
    });
    
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'card2', name: 'Counterspell' })
    });

    const cardmarketIds = ['12345', '67890'];
    const result = await ScryfallProvider.getByCardmarketIds(cardmarketIds);

    // Should have called fetch 3 times (1 for batch, 2 for individual)
    expect(global.fetch).toHaveBeenCalledTimes(3);
    
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('card1');
    expect(result[1].id).toBe('card2');
  });

  it('should use individual endpoint for single Cardmarket ID', async () => {
    // Mock successful individual response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'card1', name: 'Lightning Bolt' })
    });

    const cardmarketIds = ['12345'];
    const result = await ScryfallProvider.getByCardmarketIds(cardmarketIds);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.scryfall.com/cards/cardmarket/12345'
    );
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('card1');
  });
});
*/