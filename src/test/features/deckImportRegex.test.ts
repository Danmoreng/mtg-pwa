import { describe, it, expect } from 'vitest';

// Test the buggy regex pattern currently in DeckImportService
const buggyRegex = /^(\d+)\s+(.+?)\s*$([^)]+)$\s*(\d+)(?:\s*\*F\*\s*)?$/i;

// Test the correct regex pattern from DeckImportView
const correctRegex = /^(\d+)\s+(.+?)\s*\(([^)]+)\)\s*(\d+)(?:\s*\*F\*\s*)?$/i;

describe('Deck Text Regex Patterns', () => {
  // Test cases that should work with the correct regex
  const testCases = [
    '1 Captain America, First Avenger (SLD) 1726',
    '4 Lightning Bolt (MH1) 123',
    '2 Counterspell (MH1) 45 *F*',
    '1 Black Lotus (LEA) 232',
    '3 Brainstorm (MMQ) 67'
  ];

  it('should fail to match with buggy regex', () => {
    for (const testCase of testCases) {
      const match = testCase.match(buggyRegex);
      expect(match).toBeNull(); // The buggy regex should NOT match these cases
    }
  });

  it('should match correctly with correct regex', () => {
    for (const testCase of testCases) {
      const match = testCase.match(correctRegex);
      expect(match).not.toBeNull(); // The correct regex should match these cases
      
      if (match) {
        // Verify the groups are captured correctly
        const quantity = match[1];
        const cardName = match[2];
        const setCode = match[3];
        const collectorNumber = match[4];
        
        expect(quantity).toBeDefined();
        expect(cardName).toBeDefined();
        expect(setCode).toBeDefined();
        expect(collectorNumber).toBeDefined();
      }
    }
  });

  it('should extract correct values from test cases', () => {
    const testLine = '1 Captain America, First Avenger (SLD) 1726';
    const match = testLine.match(correctRegex);
    
    expect(match).not.toBeNull();
    if (match) {
      expect(match[1]).toBe('1'); // quantity
      expect(match[2]).toBe('Captain America, First Avenger'); // cardName
      expect(match[3]).toBe('SLD'); // setCode
      expect(match[4]).toBe('1726'); // collectorNumber
    }
  });
});