// 5) Normalization unification (remove duplication)
// Create core/Normalization.ts exporting:
// - normalizeFingerprint(input) (uses finishMapper + SetCodeResolver + collector number parser).
// - mapFinish(...), normalizeLang(...), resolveSetCode(...).

import { normalizeFingerprint as newNormalizeFingerprint, type NormalizedKey } from '../utils/normalization';
import { mapFinish as existingMapFinish } from '../utils/finishMapper';
import { resolveSetCode as existingResolveSetCode } from '../features/pricing/SetCodeResolver';

// Re-export the new normalizeFingerprint function
export { newNormalizeFingerprint as normalizeFingerprint };
export type { NormalizedKey };

// Create a gateway function that wraps existing functionality
export function mapFinish(sourceFinish: string): 'nonfoil' | 'foil' | 'etched' {
  return existingMapFinish(sourceFinish);
}

// For normalizeLang, we'll create a function based on the new normalization utility
export function normalizeLang(sourceLang: string): 'EN' | 'DE' | 'FR' | 'IT' | 'ES' | 'JA' | 'KO' | 'PT' | 'RU' | 'ZH' | 'HE' | 'LA' | 'GR' | 'AR' | 'UNKNOWN' {
  // Use the logic from the normalization utility directly
  if (!sourceLang) return 'UNKNOWN';
  
  const normalizedLang = sourceLang.trim().toUpperCase();
  const LANGUAGE_ALIASES: Record<string, 'EN' | 'DE' | 'FR' | 'IT' | 'ES' | 'JA' | 'KO' | 'PT' | 'RU' | 'ZH' | 'HE' | 'LA' | 'GR' | 'AR' | 'UNKNOWN'> = {
    'ENGLISH': 'EN',
    'GERMAN': 'DE',
    'FRENCH': 'FR',
    'ITALIAN': 'IT',
    'SPANISH': 'ES',
    'JAPANESE': 'JA',
    'KOREAN': 'KO',
    'PORTUGUESE': 'PT',
    'RUSSIAN': 'RU',
    'CHINESE': 'ZH',
    'HEBREW': 'HE',
    'LATIN': 'LA',
    'GREEK': 'GR',
    'ARABIC': 'AR'
  };
  
  // Check if it's directly a language code
  if (Object.values(LANGUAGE_ALIASES).includes(normalizedLang as any)) {
    return normalizedLang as any;
  }
  
  // Check if it's an alias
  if (LANGUAGE_ALIASES[normalizedLang]) {
    return LANGUAGE_ALIASES[normalizedLang];
  }
  
  // Check for lowercase aliases
  const lowerAlias = LANGUAGE_ALIASES[normalizedLang.toLowerCase()];
  if (lowerAlias) {
    return lowerAlias;
  }
  
  return 'UNKNOWN';
}

// Wrap the existing resolveSetCode function
export async function resolveSetCode(cardmarketName: string): Promise<string | null> {
  return await existingResolveSetCode(cardmarketName);
}

// Create a normalization gateway that provides a unified interface
export class NormalizationGateway {
  static normalizeFingerprint = newNormalizeFingerprint;
  static mapFinish = mapFinish;
  static normalizeLang = normalizeLang;
  static resolveSetCode = resolveSetCode;
}