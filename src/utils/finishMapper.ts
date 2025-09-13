// Utility functions for mapping finishes between different systems

// Map a source finish string to our standard finish types
export function mapFinish(sourceFinish: string): 'nonfoil' | 'foil' | 'etched' {
  const normalized = sourceFinish.toLowerCase();
  
  if (normalized.includes('foil') && !normalized.includes('etched')) {
    return 'foil';
  } else if (normalized.includes('etched')) {
    return 'etched';
  } else {
    return 'nonfoil';
  }
}

// Map Scryfall finish values to our standard finish types
export function mapScryfallFinish(scryfallFinish: string): 'nonfoil' | 'foil' | 'etched' {
  switch (scryfallFinish.toLowerCase()) {
    case 'foil':
      return 'foil';
    case 'etched':
      return 'etched';
    case 'nonfoil':
    default:
      return 'nonfoil';
  }
}