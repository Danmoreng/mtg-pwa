import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../data/init';
import type {
  CardmarketImportFileKind,
  CardmarketOrderLedgerLink,
} from '../../data/db';
import {
  cardmarketImportFileRepository,
  cardmarketLedgerTransactionRepository,
  cardmarketOrderLineRepository,
  cardmarketOrderPartyRepository,
  cardmarketOrderRepository,
} from '../../data/repos';
import { AccountingProjectionCoordinator } from '../accounting/AccountingProjectionCoordinator';

type WizardFileType =
  | 'transactions'
  | 'sold-orders'
  | 'purchased-orders'
  | 'sold-articles'
  | 'purchased-articles';

type ParsedRow = Record<string, unknown> & {
  lineNumber?: number;
  __sourceFileName?: string;
};

type ParsedDataByFileType = Partial<Record<WizardFileType, ParsedRow[]>>;

interface CardmarketV2ImportInput {
  parsedData: ParsedDataByFileType;
  fileContents: Record<string, string>;
  fileTypes: Record<string, string>;
}

interface CardmarketV2ImportSummary {
  importedFiles: number;
  skippedFiles: number;
  upsertedOrders: number;
  upsertedOrderParties: number;
  upsertedOrderLines: number;
  upsertedLedgerTransactions: number;
  upsertedOrderLedgerLinks: number;
}

const FILE_TYPE_TO_KIND: Record<WizardFileType, CardmarketImportFileKind> = {
  transactions: 'transaction_summary',
  'sold-orders': 'sold_orders',
  'purchased-orders': 'purchased_orders',
  'sold-articles': 'sold_articles',
  'purchased-articles': 'purchased_articles',
};

function parseIntStrict(value: unknown): number {
  const asString = String(value ?? '').trim();
  const parsed = Number.parseInt(asString, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseEuroToCents(value: unknown): number {
  if (value == null) return 0;

  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  let raw = String(value).trim();
  if (!raw) return 0;

  raw = raw.replace('€', '').replace(/\s+/g, '');
  const hasComma = raw.includes(',');
  const normalized = hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function parseCardmarketDate(raw: unknown): Date | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const isoMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/,
  );
  if (isoMatch) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = isoMatch;
    const parsed = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const deMatch = text.match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/,
  );
  if (deMatch) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = deMatch;
    const parsed = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss),
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(text);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function parsePeriodFromFileName(fileName: string): {
  periodStart?: string;
  periodEnd?: string;
} {
  const match = fileName.match(
    /(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.csv$/i,
  );
  if (!match) return {};
  return { periodStart: match[1], periodEnd: match[2] };
}

function isProfessionalFlag(raw: unknown): boolean {
  return String(raw ?? '').trim().toUpperCase() === 'X';
}

function parseOrderLineDescription(raw: unknown): {
  collectorNumber?: string;
  rarity?: string;
  condition?: string;
  language?: string;
  isFoil?: boolean;
} {
  const text = String(raw ?? '').trim();
  if (!text) return {};

  // Example:
  // 1x Card Name (Set) - 123 - Rare - NM - English - Foil - 1,99 EUR
  const pattern =
    /^\d+x\s+.+?\s+\(.+?\)\s+-\s+([^-]+?)\s+-\s+([^-]+?)\s+-\s+([^-]+?)\s+-\s+([^-]+?)(?:\s+-\s+(Foil))?\s+-\s+[0-9]+,[0-9]{2}\s+EUR$/i;
  const match = text.match(pattern);
  if (!match) return {};

  return {
    collectorNumber: match[1]?.trim(),
    rarity: match[2]?.trim(),
    condition: match[3]?.trim(),
    language: match[4]?.trim(),
    isFoil: Boolean(match[5]),
  };
}

async function hashText(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex}`;
  }

  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

function inferRelation(
  category: string,
  type: string,
): CardmarketOrderLedgerLink['relation'] {
  if (category === 'Sales' && type === 'Sales') return 'sale';
  if (category === 'Fees' && type === 'Commissions') return 'fee';
  if (category === 'Purchases' && type === 'Purchases') return 'purchase';
  if (category === 'Purchases' && type === 'Trustee service fees') {
    return 'trustee_fee';
  }
  return 'other';
}

export class CardmarketV2ImportService {
  static async importFromWizardPayload(
    input: CardmarketV2ImportInput,
  ): Promise<CardmarketV2ImportSummary> {
    const summary: CardmarketV2ImportSummary = {
      importedFiles: 0,
      skippedFiles: 0,
      upsertedOrders: 0,
      upsertedOrderParties: 0,
      upsertedOrderLines: 0,
      upsertedLedgerTransactions: 0,
      upsertedOrderLedgerLinks: 0,
    };

    const now = new Date();

    for (const [fileName, content] of Object.entries(input.fileContents)) {
      const rawType = input.fileTypes[fileName];
      if (
        rawType !== 'transactions' &&
        rawType !== 'sold-orders' &&
        rawType !== 'purchased-orders' &&
        rawType !== 'sold-articles' &&
        rawType !== 'purchased-articles'
      ) {
        continue;
      }

      const fileType = rawType as WizardFileType;
      const kind = FILE_TYPE_TO_KIND[fileType];
      const fileRows = (input.parsedData[fileType] ?? []).filter((row) => {
        const sourceName = String(row.__sourceFileName ?? '').trim();
        return sourceName ? sourceName === fileName : true;
      });

      const fileHash = await hashText(content);
      const existingImport = await cardmarketImportFileRepository.getBySourceAndHash(
        'cardmarket',
        fileHash,
      );
      if (existingImport) {
        summary.skippedFiles += 1;
        continue;
      }

      const { periodStart, periodEnd } = parsePeriodFromFileName(fileName);
      const fileId = uuidv4();
      await cardmarketImportFileRepository.add({
        id: fileId,
        source: 'cardmarket',
        kind,
        fileName,
        fileHash,
        periodStart,
        periodEnd,
        rowCount: fileRows.length,
        importedAt: now,
        createdAt: now,
      });
      summary.importedFiles += 1;

      if (fileType === 'sold-orders' || fileType === 'purchased-orders') {
        const direction = fileType === 'sold-orders' ? 'sale' : 'purchase';
        for (const row of fileRows) {
          const orderId = String(row.orderId ?? '').trim();
          const orderDate = parseCardmarketDate(row.dateOfPurchase);
          if (!orderId || !orderDate) continue;

          const existingOrder = await cardmarketOrderRepository.getById(orderId);
          await cardmarketOrderRepository.put({
            id: orderId,
            direction,
            orderDate,
            username: String(row.username ?? '').trim() || undefined,
            currency: String(row.currency ?? 'EUR').trim() || 'EUR',
            articleCount: parseIntStrict(row.articleCount),
            merchandiseCents: parseEuroToCents(row.merchandiseValue),
            shippingCents: parseEuroToCents(row.shipmentCosts),
            totalCents: parseEuroToCents(row.totalValue),
            commissionCents: parseEuroToCents(row.commission),
            trusteeFeeCents: parseEuroToCents(row.trusteeServiceFee),
            descriptionRaw: String(row.description ?? '').trim() || undefined,
            productIdsRaw: String(row.productId ?? '').trim() || undefined,
            localizedNamesRaw:
              String(row.localizedProductName ?? '').trim() || undefined,
            sourceFileId: fileId,
            sourceLineNumber: parseIntStrict(row.lineNumber),
            createdAt: existingOrder?.createdAt ?? now,
            updatedAt: now,
          });
          summary.upsertedOrders += 1;

          await cardmarketOrderPartyRepository.put({
            orderId,
            name: String(row.name ?? '').trim() || undefined,
            street: String(row.street ?? '').trim() || undefined,
            city: String(row.city ?? '').trim() || undefined,
            country: String(row.country ?? '').trim() || undefined,
            isProfessional:
              row.isProfessional == null || String(row.isProfessional).trim() === ''
                ? undefined
                : isProfessionalFlag(row.isProfessional),
            vatNumber: String(row.vatNumber ?? '').trim() || undefined,
            createdAt: existingOrder?.createdAt ?? now,
            updatedAt: now,
          });
          summary.upsertedOrderParties += 1;
        }
      }

      if (fileType === 'sold-articles' || fileType === 'purchased-articles') {
        const direction = fileType === 'sold-articles' ? 'sale' : 'purchase';
        for (const row of fileRows) {
          const orderId = String(row.shipmentId ?? '').trim();
          const purchasedAt = parseCardmarketDate(row.dateOfPurchase);
          if (!orderId || !purchasedAt) continue;

          const lineNo = parseIntStrict(row.lineNumber);
          const lineId = `${orderId}:${lineNo}`;
          const descriptionMeta = parseOrderLineDescription(row.description);

          await cardmarketOrderLineRepository.put({
            id: lineId,
            orderId,
            lineNo,
            direction,
            purchasedAt,
            productId: String(row.productId ?? '').trim(),
            articleName: String(row.name ?? '').trim(),
            localizedProductName:
              String(row.localizedProductName ?? '').trim() || undefined,
            expansion: String(row.expansion ?? '').trim() || undefined,
            category: String(row.category ?? '').trim() || undefined,
            quantity: parseIntStrict(row.amount),
            unitPriceCents: parseEuroToCents(row.price),
            lineTotalCents: parseEuroToCents(row.total),
            currency: String(row.currency ?? 'EUR').trim() || 'EUR',
            comments: String(row.comments ?? '').trim() || undefined,
            collectorNumber:
              descriptionMeta.collectorNumber ??
              (String(row.collectorNumber ?? '').trim() || undefined),
            rarity:
              descriptionMeta.rarity ??
              (String(row.rarity ?? '').trim() || undefined),
            condition:
              descriptionMeta.condition ??
              (String(row.condition ?? '').trim() || undefined),
            language:
              descriptionMeta.language ??
              (String(row.language ?? '').trim() || undefined),
            isFoil:
              descriptionMeta.isFoil ??
              (String(row.finish ?? '').trim().toLowerCase() === 'foil'
                ? true
                : undefined),
            descriptionRaw: String(row.description ?? '').trim() || undefined,
            sourceFileId: fileId,
            sourceLineNumber: lineNo,
            createdAt: now,
            updatedAt: now,
          });
          summary.upsertedOrderLines += 1;
        }
      }

      if (fileType === 'transactions') {
        for (const row of fileRows) {
          const happenedAt = parseCardmarketDate(row.date);
          const reference = String(row.reference ?? '').trim();
          if (!happenedAt || !reference) continue;

          const transactionId = String(row.transactionId ?? '').trim();
          const lineNo = parseIntStrict(row.lineNumber);
          const fallbackId = `line:${fileId}:${lineNo}`;
          const ledgerId = transactionId || fallbackId;

          await cardmarketLedgerTransactionRepository.put({
            id: ledgerId,
            happenedAt,
            category: String(row.category ?? '').trim(),
            type: String(row.type ?? '').trim(),
            counterpart: String(row.counterpart ?? '').trim(),
            reference,
            amountCents: parseEuroToCents(row.amount),
            currency: String(row.currency ?? 'EUR').trim() || 'EUR',
            startingBalanceCents: parseEuroToCents(row.startingBalance),
            closingBalanceCents: parseEuroToCents(row.closingBalance),
            sourceFileId: fileId,
            sourceLineNumber: lineNo,
            createdAt: now,
          });
          summary.upsertedLedgerTransactions += 1;
        }
      }
    }

    summary.upsertedOrderLedgerLinks = await this.linkOrdersToLedger();
    await new AccountingProjectionCoordinator(getDb()).projectAfterCardmarketImport();
    return summary;
  }

  private static async linkOrdersToLedger(): Promise<number> {
    const db = getDb();
    const orders = await db.cm_orders.toArray();
    if (orders.length === 0) return 0;

    const orderIds = new Set(orders.map((order) => order.id));
    const ledgerRows = await db.cm_ledger_transactions.toArray();
    const links: CardmarketOrderLedgerLink[] = [];
    const now = new Date();

    for (const row of ledgerRows) {
      if (!orderIds.has(row.reference)) continue;
      links.push({
        id: `${row.reference}:${row.id}`,
        orderId: row.reference,
        ledgerTransactionId: row.id,
        relation: inferRelation(row.category, row.type),
        createdAt: now,
      });
    }

    if (links.length === 0) return 0;
    await db.cm_order_ledger_links.bulkPut(links);
    return links.length;
  }
}
