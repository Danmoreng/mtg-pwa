import type { Card, InventoryAdjustment, InventoryLot } from '../../data/db';
import type MtgTrackerDb from '../../data/db';
import { getDb } from '../../data/init';
import { ScryfallProvider } from '../pricing/ScryfallProvider';
import {
  AccountingCommandService,
  type CorrectInventoryQuantityCommand,
  type CreateManualInventoryCommand,
} from './AccountingCommandService';
import { AccountingProjectionCoordinator } from './AccountingProjectionCoordinator';
import type { CostBasisStatus } from './AccountingTypes';

export interface ManualCardLookupInput {
  scryfallId?: string;
  name?: string;
  setCode?: string;
  collectorNumber?: string;
}

export interface CreateManualInventoryInput {
  cardId: string;
  quantity: number;
  finish: InventoryLot['finish'];
  language: string;
  condition: string;
  costBasisStatus: CostBasisStatus;
  totalCostCent?: number;
  occurredAt: Date;
}

function newId(): string {
  return crypto.randomUUID();
}

export class ManualInventoryService {
  private readonly db: MtgTrackerDb;
  private readonly commands: AccountingCommandService;
  private readonly projections: AccountingProjectionCoordinator;

  constructor(db: MtgTrackerDb = getDb()) {
    this.db = db;
    this.commands = new AccountingCommandService(db);
    this.projections = new AccountingProjectionCoordinator(db);
  }

  async findCards(query: string, limit = 25): Promise<Card[]> {
    const normalized = query.trim().toLowerCase();
    const cards = await this.db.cards.toArray();
    if (!normalized) return cards.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
    return cards
      .filter(card =>
        card.name.toLowerCase().includes(normalized) ||
        card.set.toLowerCase().includes(normalized) ||
        card.setCode.toLowerCase() === normalized ||
        card.number.toLowerCase() === normalized
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  async resolveAndSaveCard(input: ManualCardLookupInput): Promise<Card> {
    if (
      !input.scryfallId &&
      !(input.name?.trim() && input.setCode?.trim()) &&
      !(input.setCode?.trim() && input.collectorNumber?.trim())
    ) {
      throw new Error('Enter a Scryfall ID, set/collector number, or card name/set.');
    }
    const hydrated = await ScryfallProvider.hydrateCard({
      scryfall_id: input.scryfallId,
      name: input.name,
      setCode: input.setCode,
      collectorNumber: input.collectorNumber,
    });
    if (!hydrated?.id) throw new Error('Scryfall could not resolve this printing.');
    const existing = await this.db.cards.get(hydrated.id);
    if (existing) return existing;
    const images = await ScryfallProvider.getImageUrlById(hydrated.id);
    const now = new Date();
    const card: Card = {
      id: hydrated.id,
      oracleId: hydrated.oracle_id || '',
      name: hydrated.name || input.name || 'Unknown card',
      set: hydrated.set_name || input.setCode || 'Unknown set',
      setCode: String(hydrated.set || input.setCode || '').toLowerCase(),
      number: String(hydrated.collector_number || input.collectorNumber || ''),
      lang: String(hydrated.lang || 'en').toLowerCase(),
      finish: 'nonfoil',
      layout: images?.layout || hydrated.layout || 'normal',
      imageUrl: images?.front || '',
      imageUrlBack: images?.back || '',
      cardmarketId:
        typeof hydrated.cardmarket_id === 'number' ? hydrated.cardmarket_id : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.cards.add(card);
    return card;
  }

  async createInventory(input: CreateManualInventoryInput): Promise<InventoryLot> {
    const id = newId();
    const sourceRef = `manual:inventory:${id}`;
    const command: CreateManualInventoryCommand = {
      acquisitionId: `acquisition:${sourceRef}`,
      lotId: `lot:${sourceRef}`,
      lotSourceId: `lot-source:${sourceRef}`,
      sourceRef,
      cardId: input.cardId,
      quantity: input.quantity,
      allocatedCostCent: input.totalCostCent,
      costBasisStatus: input.costBasisStatus,
      finish: input.finish,
      language: input.language,
      condition: input.condition,
      occurredAt: input.occurredAt,
    };
    const lot = await this.commands.createManualInventory(command);
    await this.projections.projectAfterInventoryChange();
    return lot;
  }

  async correctRemainingQuantity(
    input: Omit<CorrectInventoryQuantityCommand, 'id' | 'sourceRef'>
  ): Promise<InventoryAdjustment> {
    const id = newId();
    const adjustment = await this.commands.correctRemainingQuantity({
      ...input,
      id: `adjustment:${id}`,
      sourceRef: `manual:adjustment:${id}`,
    });
    await this.projections.projectAfterInventoryChange();
    return adjustment;
  }

  async reverseAdjustment(adjustmentId: string, note?: string): Promise<InventoryAdjustment> {
    const id = newId();
    const now = new Date();
    const reversal = await this.commands.reverseAdjustment(adjustmentId, {
      id: `adjustment:${id}`,
      sourceRef: `manual:adjustment:${id}`,
      effectiveAt: now,
      confirmedAt: now,
      note,
    });
    await this.projections.projectAfterInventoryChange();
    return reversal;
  }
}
