import { describe, it, expect } from 'vitest';
import { Money } from './Money';

describe('Money', () => {
  it('should create a Money object with correct cents', () => {
    const money = new Money(100, 'EUR');
    expect(money.getCents()).toBe(100);
    expect(money.getDecimal()).toBe(1);
    expect(money.getCurrency()).toBe('EUR');
  });

  it('should parse string values correctly', () => {
    const money = Money.parse('1.50', 'EUR');
    expect(money.getCents()).toBe(150);
  });

  it('should parse string values with currency symbols', () => {
    const money = Money.parse('€1,50', 'EUR');
    expect(money.getCents()).toBe(150);
  });

  it('should add two Money objects correctly', () => {
    const money1 = new Money(100, 'EUR');
    const money2 = new Money(50, 'EUR');
    const result = money1.add(money2);
    expect(result.getCents()).toBe(150);
  });

  it('should subtract two Money objects correctly', () => {
    const money1 = new Money(100, 'EUR');
    const money2 = new Money(50, 'EUR');
    const result = money1.subtract(money2);
    expect(result.getCents()).toBe(50);
  });

  it('should format money correctly', () => {
    const money = new Money(150, 'EUR');
    expect(money.format('de-DE')).toBe('1,50\xa0€');
  });
});