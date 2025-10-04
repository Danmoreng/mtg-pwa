
import MtgTrackerDb from '../../data/db';

export class BoxValuationService {
  private db: MtgTrackerDb;

  constructor(db: MtgTrackerDb) {
    this.db = db;
  }

  public async calculateBoxValue(acquisitionId: string) {
    const acquisition = await this.db.acquisitions.get(acquisitionId);

    if (!acquisition || acquisition.kind !== 'box') {
      throw new Error('Acquisition not found or is not a box.');
    }

    const cardLots = await this.db.card_lots.where({ acquisitionId }).toArray();

    const cardIds = [...new Set(cardLots.map(lot => lot.cardId))];

    const latestPrices = await this.db.price_points
      .where('cardId').anyOf(cardIds)
      .and(item => item.provider === 'scryfall') // Or other preferred provider
      .toArray();

    const priceMap = new Map<string, {priceCent: number, asOf: Date}>();
    for (const price of latestPrices) {
        const existing = priceMap.get(price.cardId);
        if (!existing || new Date(price.asOf) > new Date(existing.asOf)) {
            priceMap.set(price.cardId, { priceCent: price.priceCent, asOf: price.asOf });
        }
    }

    let unsoldValue = 0;
    let totalCurrentValue = 0;

    for (const lot of cardLots) {
      const currentPrice = priceMap.get(lot.cardId)?.priceCent || 0;
      const disposedQuantity = lot.disposedQuantity || 0;
      const remainingQuantity = lot.quantity - disposedQuantity;

      if (remainingQuantity > 0) {
        unsoldValue += remainingQuantity * currentPrice;
      }

      totalCurrentValue += lot.quantity * currentPrice;
    }

    const lotIds = cardLots.map(lot => lot.id);

    const sellTransactions = await this.db.transactions
        .where('lotId').anyOf(lotIds)
        .and(tx => tx.kind === 'SELL' && tx.cardId !== null) // Filter out order headers (where cardId is null)
        .toArray();

    const soldValue = sellTransactions.reduce((acc, tx) => acc + (tx.unitPrice * tx.quantity), 0);

    const result = {
      boxPrice: acquisition.totalCostCent || 0,
      unsoldValue,
      soldValue,
      totalCurrentValue,
    };

    return result;
  }
}
