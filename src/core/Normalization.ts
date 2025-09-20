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
  // Use the logic from the new normalizeFingerprint function
  const normalizedKey = newNormalizeFingerprint({ lang: sourceLang });
  return normalizedKey.lang;
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