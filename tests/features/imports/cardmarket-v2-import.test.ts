import { describe, expect, it } from 'vitest';
import { CardmarketV2ImportService } from '@/features/imports/CardmarketV2ImportService';
import { getDb } from '@/data/init';

describe('CardmarketV2ImportService', () => {
  it('imports canonical order/article/ledger data and links orders to ledger refs', async () => {
    const fileContents = {
      'Sold Orders-byPurchaseDate-2025-04-01_2025-04-30.csv':
        'sold-orders-april',
      'Sold Articles-byPurchaseDate-2025-04-01_2025-04-30.csv':
        'sold-articles-april',
      'Transaction Summary-2025-04-01_2025-05-01.csv':
        'transaction-summary-april',
    };

    const fileTypes = {
      'Sold Orders-byPurchaseDate-2025-04-01_2025-04-30.csv': 'sold-orders',
      'Sold Articles-byPurchaseDate-2025-04-01_2025-04-30.csv': 'sold-articles',
      'Transaction Summary-2025-04-01_2025-05-01.csv': 'transactions',
    };

    const parsedData = {
      'sold-orders': [
        {
          __sourceFileName: 'Sold Orders-byPurchaseDate-2025-04-01_2025-04-30.csv',
          orderId: '1204820806',
          direction: 'sale',
          dateOfPurchase: '2025-04-04 22:51:30',
          username: 'Korzeniewski7',
          name: 'Matthias Korzeniewski',
          street: 'Zehentstadelweg 7',
          city: '81247 München',
          country: 'Germany',
          isProfessional: '',
          vatNumber: '',
          articleCount: '1',
          merchandiseValue: 19.99,
          shipmentCosts: 3.95,
          commission: 1.0,
          trusteeServiceFee: 0,
          totalValue: 23.94,
          currency: 'EUR',
          description:
            '1x Elspeth, Storm Slayer (V.1) (Tarkir: Dragonstorm: Extras) - 398 - Mythic - NM - English - 19,99 EUR',
          productId: '818001',
          localizedProductName: 'Elspeth, Storm Slayer (V.1)',
          lineNumber: 3,
        },
      ],
      'sold-articles': [
        {
          __sourceFileName:
            'Sold Articles-byPurchaseDate-2025-04-01_2025-04-30.csv',
          shipmentId: '1204820806',
          dateOfPurchase: '2025-04-04 22:51:30',
          productId: '818001',
          name: 'Elspeth, Storm Slayer (V.1)',
          localizedProductName: 'Elspeth, Storm Slayer (V.1)',
          expansion: 'Tarkir: Dragonstorm: Extras',
          category: 'Magic Single',
          amount: '1',
          price: 19.99,
          total: 19.99,
          currency: 'EUR',
          comments: '',
          lineNumber: 3,
        },
      ],
      transactions: [
        {
          __sourceFileName: 'Transaction Summary-2025-04-01_2025-05-01.csv',
          transactionId: '763185004',
          date: '09.04.2025 17:37:56',
          category: 'Sales',
          type: 'Sales',
          counterpart: 'Korzeniewski7',
          reference: '1204820806',
          amount: 23.94,
          startingBalance: 134.94,
          closingBalance: 158.88,
          currency: 'EUR',
          lineNumber: 10,
        },
        {
          __sourceFileName: 'Transaction Summary-2025-04-01_2025-05-01.csv',
          transactionId: '763185006',
          date: '09.04.2025 17:37:57',
          category: 'Fees',
          type: 'Commissions',
          counterpart: 'Cardmarket',
          reference: '1204820806',
          amount: -1.0,
          startingBalance: 158.88,
          closingBalance: 157.88,
          currency: 'EUR',
          lineNumber: 11,
        },
        {
          __sourceFileName: 'Transaction Summary-2025-04-01_2025-05-01.csv',
          transactionId: '798072858',
          date: '24.06.2025 10:35:24',
          category: 'Credit',
          type: 'Deposits',
          counterpart: '-',
          reference: 'DE801004XXX500-3505639-2025-06-23',
          amount: 100.0,
          startingBalance: -16.65,
          closingBalance: 83.35,
          currency: 'EUR',
          lineNumber: 33,
        },
      ],
    };

    const summary1 = await CardmarketV2ImportService.importFromWizardPayload({
      parsedData,
      fileContents,
      fileTypes,
    });

    expect(summary1.importedFiles).toBe(3);
    expect(summary1.skippedFiles).toBe(0);
    expect(summary1.upsertedOrders).toBe(1);
    expect(summary1.upsertedOrderLines).toBe(1);
    expect(summary1.upsertedLedgerTransactions).toBe(3);
    expect(summary1.upsertedOrderLedgerLinks).toBe(2);

    const db = getDb();
    expect(await db.cm_import_files.count()).toBe(3);
    expect(await db.cm_orders.count()).toBe(1);
    expect(await db.cm_order_parties.count()).toBe(1);
    expect(await db.cm_order_lines.count()).toBe(1);
    expect(await db.cm_ledger_transactions.count()).toBe(3);
    expect(await db.cm_order_ledger_links.count()).toBe(2);

    const depositTx = await db.cm_ledger_transactions.get('798072858');
    expect(depositTx?.reference).toBe('DE801004XXX500-3505639-2025-06-23');
    const depositLinks = await db.cm_order_ledger_links
      .where('ledgerTransactionId')
      .equals('798072858')
      .toArray();
    expect(depositLinks).toHaveLength(0);

    const summary2 = await CardmarketV2ImportService.importFromWizardPayload({
      parsedData,
      fileContents,
      fileTypes,
    });

    expect(summary2.importedFiles).toBe(0);
    expect(summary2.skippedFiles).toBe(3);
    expect(await db.cm_import_files.count()).toBe(3);
    expect(await db.cm_orders.count()).toBe(1);
    expect(await db.cm_order_lines.count()).toBe(1);
    expect(await db.cm_ledger_transactions.count()).toBe(3);
    expect(await db.cm_order_ledger_links.count()).toBe(2);
  });
});
