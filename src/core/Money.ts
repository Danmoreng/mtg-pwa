// Money utility for handling monetary values in cents
export class Money {
  private readonly cents: number;
  private readonly currency: string;

  constructor(cents: number, currency: string = 'EUR') {
    // Round to nearest cent to avoid floating point issues
    this.cents = Math.round(cents);
    this.currency = currency;
  }

  // Parse money from a string or number
  static parse(value: string | number, currency: string = 'EUR'): Money {
    if (typeof value === 'number') {
      return new Money(value * 100, currency);
    }

    // Remove currency symbols and spaces
    const cleaned = value.replace(/[€$£\s]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return new Money(isNaN(num) ? 0 : num * 100, currency);
  }

  // Get the value in cents
  getCents(): number {
    return this.cents;
  }

  // Get the value in decimal format
  getDecimal(): number {
    return this.cents / 100;
  }

  // Get the currency
  getCurrency(): string {
    return this.currency;
  }

  // Add two money values
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add Money values with different currencies');
    }
    return new Money(this.cents + other.cents, this.currency);
  }

  // Subtract two money values
  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract Money values with different currencies');
    }
    return new Money(this.cents - other.cents, this.currency);
  }

  // Multiply by a number
  multiply(factor: number): Money {
    return new Money(this.cents * factor, this.currency);
  }

  // Divide by a number
  divide(divisor: number): Money {
    return new Money(this.cents / divisor, this.currency);
  }

  // Format as a string
  format(locale: string = 'de-DE'): string {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return formatter.format(this.getDecimal());
  }

  // Check if the value is zero
  isZero(): boolean {
    return this.cents === 0;
  }

  // Check if the value is positive
  isPositive(): boolean {
    return this.cents > 0;
  }

  // Check if the value is negative
  isNegative(): boolean {
    return this.cents < 0;
  }
}