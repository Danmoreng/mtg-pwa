import { Money } from '../../core/Money';

// Scryfall API provider for card pricing and images
export class ScryfallProvider {
  private static readonly BASE_URL = 'https://api.scryfall.com';
  private static lastRequestTime = 0;
  private static readonly RATE_LIMIT_DELAY = 100; // 100ms between requests

  // Enforce rate limiting by delaying requests if needed
  private static async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      const delay = this.RATE_LIMIT_DELAY - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Get the price of a card by Scryfall ID
  static async getPriceById(scryfallId: string): Promise<Money | null> {
    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.BASE_URL}/cards/${scryfallId}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const eurPrice = data.prices?.eur;

      if (!eurPrice) {
        return null;
      }

      return Money.parse(eurPrice, 'EUR');
    } catch (error) {
      console.error('Error fetching price from Scryfall:', error);
      return null;
    }
  }

  // Get the price of a card by set code and collector number
  static async getPriceBySetAndNumber(setCode: string, collectorNumber: string): Promise<Money | null> {
    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.BASE_URL}/cards/${setCode}/${collectorNumber}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const eurPrice = data.prices?.eur;

      if (!eurPrice) {
        return null;
      }

      return Money.parse(eurPrice, 'EUR');
    } catch (error) {
      console.error('Error fetching price from Scryfall:', error);
      return null;
    }
  }

  // Get the image URL for a card by Scryfall ID
  static async getImageUrlById(scryfallId: string): Promise<{ front: string; back: string; layout: string } | null> {
    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.BASE_URL}/cards/${scryfallId}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Handle double-faced cards
      if ((data.layout === 'transform' || data.layout === 'modal_dfc' || data.layout === 'reversible_card') && data.card_faces && data.card_faces.length === 2) {
        return {
          front: data.card_faces[0].image_uris?.normal || data.card_faces[0].image_uris?.large || data.card_faces[0].image_uris?.small || '',
          back: data.card_faces[1].image_uris?.normal || data.card_faces[1].image_uris?.large || data.card_faces[1].image_uris?.small || '',
          layout: data.layout,
        };
      } else if (data.image_uris) {
        // For single-faced cards, return the normal image URL
        return {
            front: data.image_uris.normal || data.image_uris.large || data.image_uris.small || '',
            back: '',
            layout: data.layout || 'normal',
        };
      } else if (data.card_faces && data.card_faces.length > 0 && data.card_faces[0].image_uris) {
        // For other multi-faced cards (e.g., split, flip), return the front face image
        return {
            front: data.card_faces[0].image_uris.normal || data.card_faces[0].image_uris.large || data.card_faces[0].image_uris.small || '',
            back: '',
            layout: data.layout || 'normal',
        };
      }

      // Use the normal image for single-faced cards
      return {
        front: data.image_uris?.normal || data.image_uris?.large || data.image_uris?.small || '',
        back: '',
        layout: data.layout || 'normal',
      };
    } catch (error) {
      console.error('Error fetching image from Scryfall:', error);
      return null;
    }
  }

  // Get the image URL for a card by set code and collector number
  static async getImageUrlBySetAndNumber(setCode: string, collectorNumber: string): Promise<{ front: string; back: string; layout: string } | null> {
    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.BASE_URL}/cards/${setCode}/${collectorNumber}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Handle double-faced cards
      if ((data.layout === 'transform' || data.layout === 'modal_dfc' || data.layout === 'reversible_card') && data.card_faces && data.card_faces.length === 2) {
        return {
          front: data.card_faces[0].image_uris?.normal || data.card_faces[0].image_uris?.large || data.card_faces[0].image_uris?.small || '',
          back: data.card_faces[1].image_uris?.normal || data.card_faces[1].image_uris?.large || data.card_faces[1].image_uris?.small || '',
          layout: data.layout,
        };
      } else if (data.image_uris) {
        // For single-faced cards, return the normal image URL
        return {
            front: data.image_uris.normal || data.image_uris.large || data.image_uris.small || '',
            back: '',
            layout: data.layout || 'normal',
        };
      } else if (data.card_faces && data.card_faces.length > 0 && data.card_faces[0].image_uris) {
        // For other multi-faced cards (e.g., split, flip), return the front face image
        return {
            front: data.card_faces[0].image_uris.normal || data.card_faces[0].image_uris.large || data.card_faces[0].image_uris.small || '',
            back: '',
            layout: data.layout || 'normal',
        };
      }

      // Use the normal image for single-faced cards
      return {
        front: data.image_uris?.normal || data.image_uris?.large || data.image_uris?.small || '',
        back: '',
        layout: data.layout || 'normal',
      };
    } catch (error) {
      console.error('Error fetching image from Scryfall:', error);
      return null;
    }
  }

  // Get card data by Cardmarket ID
  static async getByCardmarketId(cardmarketId: string): Promise<any> {
    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      // First, get the card by Cardmarket ID using the dedicated endpoint
      const response = await fetch(`${this.BASE_URL}/cards/cardmarket/${cardmarketId}`);
      
      if (!response.ok) {
        console.error(`Scryfall API error for cardmarket_id ${cardmarketId}: ${response.status} ${response.statusText}`);
        try {
          const errorText = await response.text();
          console.error(`Scryfall API error details: ${errorText}`);
        } catch (e) {
          console.error('Could not read error response body');
        }
        return null;
      }

      // Return the card data
      return await response.json();
    } catch (error) {
      console.error('Error fetching card by Cardmarket ID from Scryfall:', error);
      return null;
    }
  }

  // Get card data by multiple Cardmarket IDs using batch collection endpoint
  static async getByCardmarketIds(cardmarketIds: string[]): Promise<any[]> {
    try {
      // If no IDs provided, return empty array
      if (!cardmarketIds || cardmarketIds.length === 0) {
        return [];
      }
      
      // If only one ID, use the dedicated endpoint for simplicity
      if (cardmarketIds.length === 1) {
        const card = await this.getByCardmarketId(cardmarketIds[0]);
        return card ? [card] : [];
      }
      
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      // Use batch collection endpoint for multiple IDs
      const response = await fetch(`${this.BASE_URL}/cards/collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifiers: cardmarketIds.map(id => ({ cardmarket_id: id }))
        })
      });
      
      if (!response.ok) {
        console.error(`Scryfall API error for batch cardmarket_ids: ${response.status} ${response.statusText}`);
        try {
          const errorText = await response.text();
          console.error(`Scryfall API error details: ${errorText}`);
        } catch (e) {
          console.error('Could not read error response body');
        }
        // Fall back to individual lookups
        return await this.getByCardmarketIdsIndividually(cardmarketIds);
      }
      
      // Parse the response
      const data = await response.json();
      
      // Return the cards that were found
      return data.data || [];
    } catch (error) {
      console.error('Error fetching cards by Cardmarket IDs from Scryfall:', error);
      // Fall back to individual lookups
      return await this.getByCardmarketIdsIndividually(cardmarketIds);
    }
  }
  
  // Fallback method for individual Cardmarket ID lookups
  private static async getByCardmarketIdsIndividually(cardmarketIds: string[]): Promise<any[]> {
    const cards = [];
    
    // Process each Cardmarket ID individually
    for (const cardmarketId of cardmarketIds) {
      const card = await this.getByCardmarketId(cardmarketId);
      if (card) {
        cards.push(card);
      }
    }
    
    return cards;
  }

  // Hydrate a card with Scryfall data
  static async hydrateCard(cardData: { 
    scryfall_id?: string; 
    name?: string; 
    setCode?: string; 
    collectorNumber?: string;
    version?: string;
  }): Promise<any> {
    try {
      // If we already have a Scryfall ID, use it directly
      if (cardData.scryfall_id) {
        // Enforce rate limiting
        await this.enforceRateLimit();
        
        const response = await fetch(`${this.BASE_URL}/cards/${cardData.scryfall_id}`);
        if (response.ok) {
          return await response.json();
        }
      }

      // Try to search by set code and collector number
      if (cardData.setCode && cardData.collectorNumber) {
        // Enforce rate limiting
        await this.enforceRateLimit();
        
        const response = await fetch(`${this.BASE_URL}/cards/${cardData.setCode}/${cardData.collectorNumber}`);
        if (response.ok) {
          return await response.json();
        }
      }

      // Otherwise, try to search by name and set
      if (cardData.name && cardData.setCode) {
        // Enforce rate limiting
        await this.enforceRateLimit();
        
        // First try exact name match
        let response = await fetch(`${this.BASE_URL}/cards/named?exact=${encodeURIComponent(cardData.name)}&set=${encodeURIComponent(cardData.setCode)}`);
        if (response.ok) {
          return await response.json();
        }
        
        // If that fails and we have version info, try searching with "include_variations=true"
        if (cardData.version) {
          await this.enforceRateLimit();
          response = await fetch(`${this.BASE_URL}/cards/named?exact=${encodeURIComponent(cardData.name)}&set=${encodeURIComponent(cardData.setCode)}&include_variations=true`);
          if (response.ok) {
            const data = await response.json();
            // If we get multiple results, we might want to filter for the specific version
            // For now, we'll just return the first result
            return data;
          }
        }
        
        // If that fails, try a fuzzy search
        await this.enforceRateLimit();
        response = await fetch(`${this.BASE_URL}/cards/named?fuzzy=${encodeURIComponent(cardData.name)}&set=${encodeURIComponent(cardData.setCode)}`);
        if (response.ok) {
          return await response.json();
        }
      }

      return null;
    } catch (error) {
      console.error('Error hydrating card with Scryfall data:', error);
      return null;
    }
  }
}