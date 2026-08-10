import { describe, expect, it } from 'vitest';
import {
  extractMoxfieldDeckId,
  normalizeMoxfieldDeckData,
  parseDeckTextLine,
} from '@/features/decks/DeckImportService';

describe('DeckImportService helpers', () => {
  it('extracts deck ID from a valid Moxfield URL', () => {
    const deckId = extractMoxfieldDeckId('https://moxfield.com/decks/bYGjxmQzeEW8B3sVHT7S3g');
    expect(deckId).toBe('bYGjxmQzeEW8B3sVHT7S3g');
  });

  it('rejects non-moxfield URLs', () => {
    expect(() => extractMoxfieldDeckId('https://example.com/decks/abc')).toThrow('moxfield.com');
  });

  it('parses deck text lines with alphanumeric collector numbers and foil marker', () => {
    const parsed = parseDeckTextLine('1 Art Series: The Walls of Ba Sing Se (ATLA) A38 *F*');
    expect(parsed).not.toBeNull();
    expect(parsed?.quantity).toBe(1);
    expect(parsed?.cardName).toBe('Art Series: The Walls of Ba Sing Se');
    expect(parsed?.setCode).toBe('atla');
    expect(parsed?.collectorNumber).toBe('A38');
    expect(parsed?.finish).toBe('foil');
  });

  it('normalizes Moxfield API payload into import entries', () => {
    const payload = normalizeMoxfieldDeckData(
      {
        name: 'Avatar Art Test',
        commanders: {
          cmdr: {
            quantity: 1,
            card: {
              id: '11111111-1111-4111-8111-111111111111',
              name: 'Aang',
              set: 'atla',
              collector_number: '1',
              lang: 'en',
            },
          },
        },
        mainboard: {
          main: {
            quantity: 2,
            finish: 'nonfoil',
            card: {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'The Walls of Ba Sing Se // The Walls of Ba Sing Se',
              set: 'atla',
              collector_number: 'A38',
              lang: 'en',
            },
          },
        },
        sideboard: {
          side: {
            quantity: 1,
            card: {
              id: '33333333-3333-4333-8333-333333333333',
              name: 'Counterspell',
              set: 'mh1',
              collector_number: '44',
            },
          },
        },
      },
      'https://moxfield.com/decks/bYGjxmQzeEW8B3sVHT7S3g'
    );

    expect(payload.name).toBe('Avatar Art Test');
    expect(payload.platform).toBe('moxfield');
    expect(payload.commander).toBe('Aang');
    expect(payload.entries).toHaveLength(3);
    expect(payload.entries.find(entry => entry.isCommander)?.cardName).toBe('Aang');
    expect(payload.entries.find(entry => entry.role === 'side')?.cardName).toBe('Counterspell');
  });
});
