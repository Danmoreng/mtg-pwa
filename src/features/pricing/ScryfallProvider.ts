import { Money } from '../../core/Money';

// Scryfall API provider for card pricing and images
export class ScryfallProvider {
  private static readonly BASE_URL = 'https://api.scryfall.com';
  private static lastRequestTime = 0;
  private static readonly RATE_LIMIT_DELAY = 100; // 100ms between requests
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

  // Get cached data if it exists and is not expired
  private static getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    
    if (cached) {
      const now = Date.now();
      if (now - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      } else {
        // Remove expired cache entry
        this.cache.delete(key);
      }
    }
    
    return null;
  }

  // Set data in cache
  private static setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Get the price of a card by Scryfall ID
  static async getPriceById(scryfallId: string): Promise<Money | null> {
    const cacheKey = `price:${scryfallId}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
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

      const price = Money.parse(eurPrice, 'EUR');
      
      // Cache the result
      this.setCachedData(cacheKey, price);
      
      return price;
    } catch (error) {
      console.error('Error fetching price from Scryfall:', error);
      return null;
    }
  }

  // Get the price of a card by set code and collector number
  static async getPriceBySetAndNumber(setCode: string, collectorNumber: string): Promise<Money | null> {
    const cacheKey = `price:${setCode}:${collectorNumber}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
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

      const price = Money.parse(eurPrice, 'EUR');
      
      // Cache the result
      this.setCachedData(cacheKey, price);
      
      return price;
    } catch (error) {
      console.error('Error fetching price from Scryfall:', error);
      return null;
    }
  }

  // Get the image URL for a card by Scryfall ID
  static async getImageUrlById(scryfallId: string): Promise<string | null> {
    const cacheKey = `image:${scryfallId}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.BASE_URL}/cards/${scryfallId}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      // Use the normal image (about 488x680 pixels)
      const imageUrl = data.image_uris?.normal || data.image_uris?.large || data.image_uris?.small || null;
      
      // Cache the result
      this.setCachedData(cacheKey, imageUrl);
      
      return imageUrl;
    } catch (error) {
      console.error('Error fetching image from Scryfall:', error);
      return null;
    }
  }

  // Get the image URL for a card by set code and collector number
  static async getImageUrlBySetAndNumber(setCode: string, collectorNumber: string): Promise<string | null> {
    const cacheKey = `image:${setCode}:${collectorNumber}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      const response = await fetch(`${this.BASE_URL}/cards/${setCode}/${collectorNumber}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      // Use the normal image (about 488x680 pixels)
      const imageUrl = data.image_uris?.normal || data.image_uris?.large || data.image_uris?.small || null;
      
      // Cache the result
      this.setCachedData(cacheKey, imageUrl);
      
      return imageUrl;
    } catch (error) {
      console.error('Error fetching image from Scryfall:', error);
      return null;
    }
  }

  // Hydrate a card with Scryfall data
  static async hydrateCard(cardData: any): Promise<any> {
    // Create a cache key based on the card data
    let cacheKey = 'hydrate:';
    if (cardData.scryfall_id) {
      cacheKey += `id:${cardData.scryfall_id}`;
    } else if (cardData.setCode && cardData.collectorNumber) {
      cacheKey += `set:${cardData.setCode}:${cardData.collectorNumber}`;
    } else if (cardData.name && cardData.setCode) {
      cacheKey += `named:${cardData.name}:${cardData.setCode}`;
    } else {
      // If we don't have enough data to create a cache key, don't cache
      return this.hydrateCardWithoutCache(cardData);
    }
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const data = await this.hydrateCardWithoutCache(cardData);
      
      // Cache the result if we have data
      if (data) {
        this.setCachedData(cacheKey, data);
      }
      
      return data;
    } catch (error) {
      console.error('Error hydrating card with Scryfall data:', error);
      return null;
    }
  }

  // Hydrate a card with Scryfall data without caching
  private static async hydrateCardWithoutCache(cardData: any): Promise<any> {
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
        
        const response = await fetch(`${this.BASE_URL}/cards/named?exact=${encodeURIComponent(cardData.name)}&set=${encodeURIComponent(cardData.setCode)}`);
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