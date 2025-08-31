import { Money } from '../../core/Money';

// Scryfall API provider for card pricing
export class ScryfallProvider {
  private static readonly BASE_URL = 'https://api.scryfall.com';

  // Get the price of a card by Scryfall ID
  static async getPriceById(scryfallId: string): Promise<Money | null> {
    try {
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

  // Hydrate a card with Scryfall data
  static async hydrateCard(cardData: any): Promise<any> {
    try {
      // If we already have a Scryfall ID, use it directly
      if (cardData.scryfall_id) {
        const response = await fetch(`${this.BASE_URL}/cards/${cardData.scryfall_id}`);
        if (response.ok) {
          return await response.json();
        }
      }

      // Try to search by set code and collector number
      if (cardData.setCode && cardData.collectorNumber) {
        const response = await fetch(`${this.BASE_URL}/cards/${cardData.setCode}/${cardData.collectorNumber}`);
        if (response.ok) {
          return await response.json();
        }
      }

      // Otherwise, try to search by name and set
      if (cardData.name && cardData.setCode) {
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