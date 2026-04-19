import { describe, expect, it, vi } from 'vitest';
import { ImportService } from '@/features/imports/ImportService';
import { ScryfallProvider } from '@/features/pricing/ScryfallProvider';
import * as ImportPipelines from '@/features/imports/ImportPipelines';
import { getDb } from '@/data/init';

describe('ImportService Cardmarket product fallback', () => {
  it('uses synthetic cm:<productId> card IDs when Scryfall cannot resolve Cardmarket product IDs', async () => {
    const importSellsSpy = vi
      .spyOn(ImportPipelines, 'importCardmarketSells')
      .mockResolvedValue([]);

    const getByCardmarketIdSpy = vi
      .spyOn(ScryfallProvider, 'getByCardmarketId')
      .mockResolvedValue(null);

    const hydrateCardSpy = vi
      .spyOn(ScryfallProvider, 'hydrateCard')
      .mockResolvedValue({
        id: 'wrong-regular-card-id',
        set_name: 'Magic: The Gathering—Avatar: The Last Airbender',
        set: 'tla',
        collector_number: '261',
      });

    const getImageUrlSpy = vi
      .spyOn(ScryfallProvider, 'getImageUrlById')
      .mockResolvedValue(null);

    const getPricesSpy = vi
      .spyOn(ScryfallProvider, 'getPricesForCard')
      .mockResolvedValue({ nonfoil: null, foil: null, etched: null });

    await ImportService.importCardmarketArticles([
      {
        shipmentId: 'shipment-1',
        dateOfPurchase: '2026-01-05 12:00:00',
        productId: '999999',
        name: 'Art Series: The Walls of Ba Sing Se (V.2)',
        localizedProductName: 'Art Series: The Walls of Ba Sing Se (V.2)',
        expansion: 'Magic: The Gathering Avatar: The Last Airbender: Extras',
        category: 'Magic Single',
        amount: '1',
        price: 4.5,
        total: 4.5,
        currency: 'EUR',
        comments: '',
        direction: 'sale',
        lineNumber: 1,
        finish: 'nonfoil',
        language: 'en',
      },
    ]);

    expect(getByCardmarketIdSpy).toHaveBeenCalledWith('999999');
    expect(hydrateCardSpy).not.toHaveBeenCalled();
    expect(getImageUrlSpy).not.toHaveBeenCalled();
    expect(getPricesSpy).not.toHaveBeenCalled();

    expect(importSellsSpy).toHaveBeenCalledTimes(1);
    const firstCallOrderLines = importSellsSpy.mock.calls[0][0];
    expect(firstCallOrderLines).toHaveLength(1);
    expect(firstCallOrderLines[0].cardId).toBe('cm:999999');

    const db = getDb();
    const syntheticCard = await db.cards.get('cm:999999');
    expect(syntheticCard).toBeDefined();
    expect(syntheticCard?.name).toBe('Art Series: The Walls of Ba Sing Se (V.2)');
    expect(syntheticCard?.set).toBe('Magic: The Gathering Avatar: The Last Airbender: Extras');
    expect(syntheticCard?.cardmarketId).toBe(999999);
  }, 15000);

  it('resolves Art Series cards via order-description collector number when Cardmarket ID lookup fails', async () => {
    const importSellsSpy = vi
      .spyOn(ImportPipelines, 'importCardmarketSells')
      .mockResolvedValue([]);

    vi.spyOn(ScryfallProvider, 'getByCardmarketId').mockResolvedValue(null);

    const getBySetAndCollectorSpy = vi
      .spyOn(ScryfallProvider, 'getBySetAndCollector')
      .mockImplementation(async (setCode, collectorNumber) => {
        if (setCode === 'atla' && collectorNumber === 'A38') {
          return {
            id: 'atla-art-38',
            set: 'atla',
            set_name: 'Magic: The Gathering Avatar: The Last Airbender: Extras',
            collector_number: 'A38',
            name: 'The Walls of Ba Sing Se // The Walls of Ba Sing Se',
            lang: 'en',
          };
        }
        return null;
      });

    const hydrateCardSpy = vi
      .spyOn(ScryfallProvider, 'hydrateCard')
      .mockResolvedValue(null);

    vi.spyOn(ScryfallProvider, 'getImageUrlById').mockResolvedValue(null);
    vi.spyOn(ScryfallProvider, 'getPricesForCard').mockResolvedValue({ nonfoil: null, foil: null, etched: null });

    const db = getDb();
    const now = new Date('2026-01-15T10:26:35.000Z');
    await db.cm_orders.put({
      id: '1251362262',
      direction: 'sale',
      orderDate: now,
      currency: 'EUR',
      articleCount: 1,
      merchandiseCents: 499,
      shippingCents: 155,
      totalCents: 654,
      descriptionRaw: '1x Art Series: The Walls of Ba Sing Se (V.2) (Avatar: The Last Airbender: Extras) - A38 - Tip Card - NM - English - 4,99 EUR',
      productIdsRaw: '858458',
      sourceFileId: 'test-file',
      sourceLineNumber: 8,
      createdAt: now,
      updatedAt: now,
      username: 'test-user',
    });

    await ImportService.importCardmarketArticles([
      {
        shipmentId: '1251362262',
        dateOfPurchase: '2026-01-15 10:26:35',
        productId: '858458',
        name: 'Art Series: The Walls of Ba Sing Se (V.2)',
        localizedProductName: 'Art Series: The Walls of Ba Sing Se (V.2)',
        expansion: 'Avatar: The Last Airbender: Extras',
        category: 'Magic Single',
        amount: '1',
        price: 4.99,
        total: 4.99,
        currency: 'EUR',
        comments: '',
        direction: 'sale',
        lineNumber: 8,
        finish: 'nonfoil',
        language: 'en',
      },
    ]);

    expect(getBySetAndCollectorSpy).toHaveBeenCalledWith('atla', 'A38');
    expect(hydrateCardSpy).not.toHaveBeenCalled();

    expect(importSellsSpy).toHaveBeenCalledTimes(1);
    const firstCallOrderLines = importSellsSpy.mock.calls[0][0];
    expect(firstCallOrderLines).toHaveLength(1);
    expect(firstCallOrderLines[0].cardId).toBe('atla-art-38');

    const importedCard = await db.cards.get('atla-art-38');
    expect(importedCard).toBeDefined();
    expect(importedCard?.setCode).toBe('atla');
    expect(importedCard?.number).toBe('A38');
    expect(importedCard?.cardmarketId).toBe(858458);
  }, 15000);
});
