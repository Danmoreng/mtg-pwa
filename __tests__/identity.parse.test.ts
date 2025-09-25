import { describe, it, expect } from 'vitest';
import { parseIdentity } from '../src/shared/identity';

describe('identity parsing', () => {
  it('should parse basic fingerprint correctly', () => {
    const result = parseIdentity('mtg:dom:x');
    expect(result.game).toBe('mtg');
    expect(result.set).toBe('dom');
    expect(result.number).toBe('x');
    expect(result.foil).toBe(false);
    expect(result.lang).toBeUndefined();
  });

  it('should parse fingerprint with foil indicator', () => {
    const result = parseIdentity('mtg:dom:1:foil');
    expect(result.game).toBe('mtg');
    expect(result.set).toBe('dom');
    expect(result.number).toBe('1');
    expect(result.foil).toBe(true);
    expect(result.lang).toBeUndefined();
  });

  it('should parse fingerprint with foil shorthand', () => {
    const result = parseIdentity('mtg:dom:1:F');
    expect(result.game).toBe('mtg');
    expect(result.set).toBe('dom');
    expect(result.number).toBe('1');
    expect(result.foil).toBe(true);
    expect(result.lang).toBeUndefined();
  });

  it('should parse fingerprint with language', () => {
    const result = parseIdentity('mtg:dom:1:DE');
    expect(result.game).toBe('mtg');
    expect(result.set).toBe('dom');
    expect(result.number).toBe('1');
    expect(result.foil).toBe(false);
    expect(result.lang).toBe('de');
  });

  it('should parse fingerprint with foil and language', () => {
    const result = parseIdentity('mtg:dom:1:foil:DE');
    expect(result.game).toBe('mtg');
    expect(result.set).toBe('dom');
    expect(result.number).toBe('1');
    expect(result.foil).toBe(true);
    expect(result.lang).toBe('de');
  });

  it('should parse fingerprint with foil shorthand and language', () => {
    const result = parseIdentity('mtg:dom:1:F:FR');
    expect(result.game).toBe('mtg');
    expect(result.set).toBe('dom');
    expect(result.number).toBe('1');
    expect(result.foil).toBe(true);
    expect(result.lang).toBe('fr');
  });

  it('should handle malformed input with too few parts', () => {
    expect(() => parseIdentity('mtg:dom')).toThrow('Invalid card fingerprint format: mtg:dom. Expected at least game:set:number');
  });

  it('should handle empty input', () => {
    expect(() => parseIdentity('')).toThrow('Card fingerprint cannot be empty');
  });

  it('should handle null input', () => {
    expect(() => parseIdentity(null as any)).toThrow('Card fingerprint cannot be empty');
  });
});