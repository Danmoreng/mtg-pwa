import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Papa from 'papaparse';
import { ImportService } from '@/features/imports/ImportService';
import { ScryfallProvider } from '@/features/pricing/ScryfallProvider';
import { Money } from '@/core/Money';
import { cardRepository, cardLotRepository, scanRepository, transactionRepository } from '@/data/repos';
import { getDb } from '@/data/init';
import type { Card } from '@/data/db';
import type { BoxCost, ManaboxImportRow } from '@/features/imports/ImportPipelines';

const KNOWN_CARD_ID = 'bc1f42a2-fe11-45da-9552-069803b4068a';
const KNOWN_CARDMARKET_ID = 722537;

function fixturePath(name: string): string {
  return resolve(process.cwd(), 'examples', name);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(',', '.').replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadManaBoxRows(): ManaboxImportRow[] {
  const csv = readFileSync(fixturePath('test_manabox_mikaeus.csv'), 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });

  return parsed.data.map((row, index) => ({
    id: row['ManaBox ID'] || `manabox-${index}`,
    name: row['Name'] || '',
    expansion: row['Set code'] || '',
    number: row['Collector number'] || '',
    language: row['Language'] || 'en',
    foil: (row['Foil'] || '').toLowerCase() === 'foil',
    quantity: parseInt(row['Quantity'] || '1', 10) || 1,
    scannedAt: new Date('2025-08-10T10:00:00Z'),
    source: 'manabox',
    externalRef: `manabox:fixture:${index}:${row['ManaBox ID'] || index}`,
    scryfallId: row['Scryfall ID'] || undefined,
  }));
}

function loadSoldOrderRows(): Array<{
  orderId: string;
  direction: 'sale' | 'purchase';
  merchandiseValue: number;
  shipmentCosts: number;
  commission: number;
  totalValue: number;
  dateOfPurchase: string;
  username: string;
  country: string;
  city: string;
  articleCount: string;
  currency: string;
  lineNumber: number;
}> {
  const csv = readFileSync(fixturePath('Sold Orders-test_mikaeus.csv'), 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, delimiter: ';' });

  return parsed.data.map((row, index) => ({
    orderId: row['OrderID'] || '',
    direction: 'sale',
    merchandiseValue: parseCurrency(row['Merchandise Value'] || ''),
    shipmentCosts: parseCurrency(row['Shipment Costs'] || ''),
    commission: parseCurrency(row['Commission'] || ''),
    totalValue: parseCurrency(row['Total Value'] || ''),
    dateOfPurchase: row['Date of Purchase'] || '',
    username: row['Username'] || '',
    country: row['Country'] || '',
    city: row['City'] || '',
    articleCount: row['Article Count'] || '0',
    currency: row['Currency'] || 'EUR',
    lineNumber: index + 1,
  }));
}

function loadSoldArticleRows(): Array<{
  shipmentId: string;
  dateOfPurchase: string;
  productId: string;
  name: string;
  expansion: string;
  category: string;
  amount: string;
  price: number;
  total: number;
  currency: string;
  comments: string;
  direction: 'sale' | 'purchase';
  lineNumber: number;
  finish: string;
  language: string;
}> {
  const csv = readFileSync(fixturePath('Sold Articles-test_sells_mikaeus.csv'), 'utf8');
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, delimiter: ';' });

  return parsed.data.map((row, index) => ({
    shipmentId: row['Shipment nr.'] || '',
    dateOfPurchase: row['Date of purchase'] || '',
    productId: row['Product ID'] || '',
    name: row['Article'] || row['Localized Product Name'] || '',
    expansion: row['Expansion'] || '',
    category: row['Category'] || '',
    amount: row['Amount'] || '1',
    price: parseCurrency(row['Article Value'] || ''),
    total: parseCurrency(row['Total'] || ''),
    currency: row['Currency'] || 'EUR',
    comments: row['Comments'] || '',
    direction: 'sale',
    lineNumber: index + 1,
    finish: 'nonfoil',
    language: 'en',
  }));
}

async function seedKnownCard(): Promise<void> {
  const card: Card = {
    id: KNOWN_CARD_ID,
    oracleId: 'oracle-mikaeus',
    name: 'Mikaeus, the Unhallowed',
    set: 'Commander Masters',
    setCode: 'cmm',
    number: '173',
    lang: 'en',
    finish: 'nonfoil',
    layout: 'normal',
    imageUrl: '',
    imageUrlBack: '',
    cardmarketId: KNOWN_CARDMARKET_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await cardRepository.add(card);
}

describe('Import + Reconcile Integration', () => {
  beforeEach(() => {
    vi.spyOn(ScryfallProvider, 'getPricesForCard').mockResolvedValue({
      nonfoil: new Money(1244, 'EUR'),
      foil: new Money(1866, 'EUR'),
      etched: null,
    });

    vi.spyOn(ScryfallProvider, 'getByCardmarketId').mockResolvedValue({
      id: KNOWN_CARD_ID,
      oracle_id: 'oracle-mikaeus',
      set_name: 'Commander Masters',
      set: 'cmm',
      collector_number: '173',
      lang: 'en',
      cardmarket_id: KNOWN_CARDMARKET_ID,
      name: 'Mikaeus, the Unhallowed',
    });

    vi.spyOn(ScryfallProvider, 'getByCardmarketIds').mockResolvedValue([
      {
        id: KNOWN_CARD_ID,
        oracle_id: 'oracle-mikaeus',
        set_name: 'Commander Masters',
        set: 'cmm',
        collector_number: '173',
        lang: 'en',
        cardmarket_id: KNOWN_CARDMARKET_ID,
        name: 'Mikaeus, the Unhallowed',
      },
    ]);

    vi.spyOn(ScryfallProvider, 'getImageUrlById').mockResolvedValue({
      front: 'https://example.test/front.jpg',
      back: '',
      layout: 'normal',
    });

    vi.spyOn(ScryfallProvider, 'hydrateCard').mockResolvedValue({
      id: KNOWN_CARD_ID,
      oracle_id: 'oracle-mikaeus',
      set_name: 'Commander Masters',
      set: 'cmm',
      collector_number: '173',
      lang: 'en',
      cardmarket_id: KNOWN_CARDMARKET_ID,
      name: 'Mikaeus, the Unhallowed',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps ManaBox import idempotent for scans and lots', async () => {
    await seedKnownCard();

    const rows = loadManaBoxRows();
    const boxCost: BoxCost = { price: 1679, fees: 0, shipping: 0 };
    const happenedAt = new Date('2025-08-10T10:00:00Z');

    await ImportService.importManaboxScansWithBoxCost(rows, boxCost, happenedAt, 'manabox', 'fixture-box-1');
    await ImportService.importManaboxScansWithBoxCost(rows, boxCost, happenedAt, 'manabox', 'fixture-box-1');

    const db = getDb();
    const acquisitions = await db.acquisitions.toArray();
    const scans = await scanRepository.getAll();
    const lots = await cardLotRepository.getByCardId(KNOWN_CARD_ID);

    expect(acquisitions).toHaveLength(1);
    expect(scans).toHaveLength(2);
    expect(lots).toHaveLength(2);
    expect(scans.every((s) => Boolean(s.lotId))).toBe(true);
  });

  it('allocates Cardmarket sale to matching nonfoil lot and stays idempotent on re-import', async () => {
    await seedKnownCard();

    const rows = loadManaBoxRows();
    const boxCost: BoxCost = { price: 1679, fees: 0, shipping: 0 };
    const happenedAt = new Date('2025-08-10T10:00:00Z');
    await ImportService.importManaboxScansWithBoxCost(rows, boxCost, happenedAt, 'manabox', 'fixture-box-2');

    const orders = loadSoldOrderRows();
    const articles = loadSoldArticleRows();

    await ImportService.importCardmarketOrders(orders);
    await ImportService.importCardmarketArticles(articles);
    await ImportService.importCardmarketArticles(articles);

    const db = getDb();
    const sells = await db.transactions
      .where('kind')
      .equals('SELL')
      .and((tx) => tx.cardId === KNOWN_CARD_ID)
      .toArray();

    expect(sells).toHaveLength(1);
    expect(sells[0].lotId).toBeTruthy();

    const allocations = await db.sell_allocations.where('transactionId').equals(sells[0].id).toArray();
    expect(allocations).toHaveLength(1);
    expect(allocations[0].quantity).toBe(1);

    const allocatedLot = await cardLotRepository.getById(allocations[0].lotId);
    expect(allocatedLot?.finish).toBe('nonfoil');
    expect(allocatedLot?.language.toLowerCase()).toBe('en');

    const sellsByRef = await transactionRepository.getBySourceRef('cardmarket', 'cardmarket:order:1225032849:line:1');
    expect(sellsByRef).toHaveLength(1);
  });
});

