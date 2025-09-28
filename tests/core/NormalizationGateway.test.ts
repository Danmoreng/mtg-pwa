import { describe, it, expect } from 'vitest';
import { NormalizationGateway } from '../src/core/Normalization';

describe('NormalizationGateway', () => {
  describe('normalizeFingerprint', () => {
    it('should normalize basic card information', () => {
      const input = {
        cardId: 'test-card-id',
        setCode: 'DOM',
        number: '123',
        lang: 'english',
        finish: 'foil'
      };
      
      const result = NormalizationGateway.normalizeFingerprint(input);
      
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
      
      const result = NormalizationGateway.normalizeFingerprint(input);
      
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
      
      const result = NormalizationGateway.normalizeFingerprint(input);
      
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
      
      const result1 = NormalizationGateway.normalizeFingerprint(input1);
      expect(result1.finish).toBe('foil');
      
      const input2 = {
        setCode: 'DOM',
        number: '123',
        lang: 'EN',
        finish: false
      };
      
      const result2 = NormalizationGateway.normalizeFingerprint(input2);
      expect(result2.finish).toBe('nonfoil');
    });

    it('should handle etched finish', () => {
      const input = {
        setCode: 'DOM',
        number: '123',
        lang: 'EN',
        finish: 'etched foil'
      };
      
      const result = NormalizationGateway.normalizeFingerprint(input);
      
      expect(result.finish).toBe('etched');
      expect(result.fingerprint).toBe('DOM:123:EN:etched');
    });

    it('should fallback to name-based fingerprint when set/number missing', () => {
      const input = {
        name: 'Lightning Bolt',
        lang: 'EN',
        finish: 'foil'
      };
      
      const result = NormalizationGateway.normalizeFingerprint(input);
      
      expect(result.fingerprint).toBe('name:lightning-bolt:EN:foil');
    });

    it('should handle unknown cards with timestamp-based fingerprint', () => {
      const input = {
        lang: 'EN',
        finish: 'nonfoil'
      };
      
      const result = NormalizationGateway.normalizeFingerprint(input);
      
      expect(result.fingerprint).toMatch(/^unknown:\d+:EN:nonfoil$/);
    });

    it('should use default values for missing fields', () => {
      const input = {
        setCode: 'DOM',
        number: '123'
      };
      
      const result = NormalizationGateway.normalizeFingerprint(input);
      
      expect(result.lang).toBe('EN');
      expect(result.finish).toBe('nonfoil');
      expect(result.fingerprint).toBe('DOM:123:EN:nonfoil');
    });
  });
  
  describe('mapFinish', () => {
    it('should map foil finishes correctly', () => {
      expect(NormalizationGateway.mapFinish('foil')).toBe('foil');
      expect(NormalizationGateway.mapFinish('Foil')).toBe('foil');
      expect(NormalizationGateway.mapFinish('FOIL')).toBe('foil');
    });
    
    it('should map nonfoil finishes correctly', () => {
      expect(NormalizationGateway.mapFinish('nonfoil')).toBe('nonfoil');
      expect(NormalizationGateway.mapFinish('non-foil')).toBe('nonfoil');
      expect(NormalizationGateway.mapFinish('Non-Foil')).toBe('nonfoil');
    });
    
    it('should map etched finishes correctly', () => {
      expect(NormalizationGateway.mapFinish('etched')).toBe('etched');
      expect(NormalizationGateway.mapFinish('etched foil')).toBe('etched');
      expect(NormalizationGateway.mapFinish('Etched Foil')).toBe('etched');
    });
  });
  
  describe('normalizeLang', () => {
    it('should normalize English language variants', () => {
      expect(NormalizationGateway.normalizeLang('english')).toBe('EN');
      expect(NormalizationGateway.normalizeLang('English')).toBe('EN');
      expect(NormalizationGateway.normalizeLang('EN')).toBe('EN');
    });
    
    it('should normalize German language variants', () => {
      expect(NormalizationGateway.normalizeLang('german')).toBe('DE');
      expect(NormalizationGateway.normalizeLang('German')).toBe('DE');
      expect(NormalizationGateway.normalizeLang('DE')).toBe('DE');
    });
    
    it('should normalize French language variants', () => {
      expect(NormalizationGateway.normalizeLang('french')).toBe('FR');
      expect(NormalizationGateway.normalizeLang('French')).toBe('FR');
      expect(NormalizationGateway.normalizeLang('FR')).toBe('FR');
    });
    
    it('should default to UNKNOWN for unrecognized languages', () => {
      expect(NormalizationGateway.normalizeLang('klingon')).toBe('UNKNOWN');
      expect(NormalizationGateway.normalizeLang('')).toBe('UNKNOWN');
    });
  });
});