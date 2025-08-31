import { ScryfallProvider } from '../pricing/ScryfallProvider';

// Type for card fingerprint
export interface CardFingerprint {
  name: string;
  setCode: string;
  collectorNumber: string;
  finish: string;
  language: string;
}

// Entity linker to resolve card fingerprints to Scryfall IDs
export class EntityLinker {
  // Normalize a card fingerprint for comparison
  static normalizeFingerprint(fingerprint: CardFingerprint): CardFingerprint {
    return {
      name: fingerprint.name.trim().toLowerCase(),
      setCode: fingerprint.setCode.trim().toLowerCase(),
      collectorNumber: fingerprint.collectorNumber.trim().toLowerCase(),
      finish: fingerprint.finish.trim().toLowerCase(),
      language: fingerprint.language.trim().toLowerCase()
    };
  }

  // Compare two fingerprints
  static compareFingerprints(a: CardFingerprint, b: CardFingerprint): boolean {
    const normalizedA = this.normalizeFingerprint(a);
    const normalizedB = this.normalizeFingerprint(b);
    
    return (
      normalizedA.name === normalizedB.name &&
      normalizedA.setCode === normalizedB.setCode &&
      normalizedA.collectorNumber === normalizedB.collectorNumber &&
      normalizedA.finish === normalizedB.finish &&
      normalizedA.language === normalizedB.language
    );
  }

  // Resolve a fingerprint to a Scryfall ID
  static async resolveFingerprint(fingerprint: CardFingerprint): Promise<string | null> {
    try {
      // Try to get card by set code and collector number first
      const cardData = await ScryfallProvider.hydrateCard({
        name: fingerprint.name,
        setCode: fingerprint.setCode,
        collectorNumber: fingerprint.collectorNumber
      });

      if (cardData && cardData.id) {
        return cardData.id;
      }

      return null;
    } catch (error) {
      console.error('Error resolving fingerprint:', error);
      return null;
    }
  }
}