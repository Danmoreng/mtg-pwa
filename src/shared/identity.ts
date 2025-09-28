/**
 * Parse identity from cardFingerprint string
 * @param fp - card fingerprint in format game:set:number[:foil][:lang]
 * @returns object with game, set, number, foil, and optional lang properties
 */
export function parseIdentity(fp: string): { game: string; set: string; number: string; foil: boolean; lang?: string } {
  if (!fp) {
    throw new Error('Card fingerprint cannot be empty');
  }
  
  const parts = fp.split(':');
  
  // Expected format: game:set:number[:foil][:lang]
  // At minimum, we need game, set, and number
  if (parts.length < 3) {
    throw new Error(`Invalid card fingerprint format: ${fp}. Expected at least game:set:number`);
  }
  
  const [game, set, number, ...rest] = parts;
  
  // Determine if it's foil based on the next part
  let isFoil = false;
  let lang: string | undefined;
  
  if (rest.length > 0) {
    // Check if the next part is a foil indicator
    const maybeFoil = rest[0];
    if (maybeFoil.toLowerCase() === 'foil' || maybeFoil.toLowerCase() === 'f') {
      isFoil = true;
      // If there's another part after foil, it's the language
      if (rest.length > 1) {
        lang = rest[1].toLowerCase();
      }
    } else {
      // Otherwise, it's the language
      lang = maybeFoil.toLowerCase();
    }
  }
  
  return {
    game,
    set,
    number,
    foil: isFoil,
    lang
  };
}