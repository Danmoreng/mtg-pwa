import { describe, it, expect } from 'vitest';

// Enhanced collector number parsing function (copy of what we implemented in ImportService)
const extractCollectorNumber = (name: string): string => {
  // Enhanced regex to handle various collector number formats:
  // - Standard: "- 167 -"
  // - With letters: "- 167a -"
  // - Roman numerals: "- IV -"
  // - With special characters: "- 167★ -"
  const patterns = [
    /-\s*(\d+[a-zA-Z★]*)\s*-/i,  // Standard with optional letters/special chars
    /-\s*([IVXLCDM]+)\s*-/i,     // Roman numerals
    /\s+(\d+[a-zA-Z★]*)\s*$/i,   // At end of name with space
    /\((\d+[a-zA-Z★]*)\)/i       // In parentheses
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return '';
};

describe('Collector Number Parser', () => {
  it('should extract standard collector numbers', () => {
    expect(extractCollectorNumber('Lightning Bolt - 167 -')).toBe('167');
    expect(extractCollectorNumber('Counterspell - 45 -')).toBe('45');
  });

  it('should extract collector numbers with letters', () => {
    expect(extractCollectorNumber('Lightning Bolt - 167a -')).toBe('167a');
    expect(extractCollectorNumber('Counterspell - 45b -')).toBe('45b');
  });

  it('should extract Roman numerals', () => {
    expect(extractCollectorNumber('Plains - IV -')).toBe('IV');
    expect(extractCollectorNumber('Swamp - VI -')).toBe('VI');
  });

  it('should extract collector numbers with special characters', () => {
    expect(extractCollectorNumber('Black Lotus - 1★ -')).toBe('1★');
    expect(extractCollectorNumber('Mox Ruby - 2★ -')).toBe('2★');
  });

  it('should extract collector numbers at the end of names', () => {
    expect(extractCollectorNumber('Lightning Bolt 167')).toBe('167');
    expect(extractCollectorNumber('Counterspell 45')).toBe('45');
  });

  it('should extract collector numbers in parentheses', () => {
    expect(extractCollectorNumber('Lightning Bolt (167)')).toBe('167');
    expect(extractCollectorNumber('Counterspell (45)')).toBe('45');
  });

  it('should return empty string when no collector number is found', () => {
    expect(extractCollectorNumber('Lightning Bolt')).toBe('');
    expect(extractCollectorNumber('Counterspell')).toBe('');
  });
});