import { describe, it, expect } from 'vitest';
import { normalizeFingerprint, type NormalizedKey } from '@/utils/normalization';

describe('Normalization Utilities', () => {
  describe('normalizeFingerprint', () => {
    it('should normalize basic card information', () => {
      const input = {
        cardId: 'test-card-id',
        setCode: 'DOM',
        number: '123',
        lang: 'english',
        finish: 'foil'
      };
      
      const result: NormalizedKey = normalizeFingerprint(input);
      
      expect(result.cardId).toBe('test-card-id');
      expect(result.setCode).toBe('DOM');
      expect(result.number).toBe('123');
      expect(result.lang).toBe('EN');
      expect(result.finish).toBe('foil');
      expect(result.fingerprint).toBe('DOM:123:EN:foil');
    });

    it('should handle number with letter suffix', () => {
      const input = {
        setCode: 'DOM',
        number: '123a',
        lang: 'EN',
        finish: 'nonfoil'
      };
      
      const result: NormalizedKey = normalizeFingerprint(input);
      
      expect(result.number).toBe('123a');
      expect(result.fingerprint).toBe('DOM:123a:EN:nonfoil');
    });

    it('should handle number with denominator', () => {
      const input = {
        setCode: 'DOM',
        number: '123/360',
        lang: 'EN',
        finish: 'nonfoil'
      };
      
      const result: NormalizedKey = normalizeFingerprint(input);
      
      expect(result.number).toBe('123');
      expect(result.fingerprint).toBe('DOM:123:EN:nonfoil');
    });

    it('should normalize boolean finish values', () => {
      const input1 = {
        setCode: 'DOM',
        number: '123',
        lang: 'EN',
        finish: true
      };
      
      const result1: NormalizedKey = normalizeFingerprint(input1);
      expect(result1.finish).toBe('foil');
      
      const input2 = {
        setCode: 'DOM',
        number: '123',
        lang: 'EN',
        finish: false
      };
      
      const result2: NormalizedKey = normalizeFingerprint(input2);
      expect(result2.finish).toBe('nonfoil');
    });

    it('should handle etched finish', () => {
      const input = {
        setCode: 'DOM',
        number: '123',
        lang: 'EN',
        finish: 'etched foil'
      };
      
      const result: NormalizedKey = normalizeFingerprint(input);
      
      expect(result.finish).toBe('etched');
      expect(result.fingerprint).toBe('DOM:123:EN:etched');
    });

    it('should fallback to name-based fingerprint when set/number missing', () => {
      const input = {
        name: 'Lightning Bolt',
        lang: 'EN',
        finish: 'foil'
      };
      
      const result: NormalizedKey = normalizeFingerprint(input);
      
      expect(result.fingerprint).toBe('name:lightning-bolt:EN:foil');
    });

    it('should handle unknown cards with timestamp-based fingerprint', () => {
      const input = {
        lang: 'EN',
        finish: 'nonfoil'
      };
      
      const result: NormalizedKey = normalizeFingerprint(input);
      
      expect(result.fingerprint).toMatch(/^unknown:\d+:EN:nonfoil$/);
    });

    it('should use default values for missing fields', () => {
      const input = {
        setCode: 'DOM',
        number: '123'
      };
      
      const result: NormalizedKey = normalizeFingerprint(input);
      
      expect(result.lang).toBe('EN');
      expect(result.finish).toBe('nonfoil');
      expect(result.fingerprint).toBe('DOM:123:EN:nonfoil');
    });
  });
});