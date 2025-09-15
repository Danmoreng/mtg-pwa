import { defineStore } from 'pinia';
import { cardRepository, settingRepository } from '../data/repos';
import { Money } from '../core/Money';
import type { Card, PricePoint } from '../data/db';
import db from '../data/db';

type Finish = 'nonfoil' | 'foil';

interface CardsState {
  cards: Record<string, Card>;
  /** display price used by the grid (chosen by card.finish) */
  cardPrices: Record<string, Money>;
  /** cache of both finishes for each card id */
  cardLatest: Record<string, { nonfoil?: Money; foil?: Money }>;
  /** cached AllIdentifiers map (scryfallId/oracleId -> uuid) */
  idMap: Record<string, string> | null;

  loading: boolean;
  loadingPrices: boolean;
  error: string | null;
}

const ID_MAP_SETTING_KEY = 'mtgjson.idMap.v1';
const providerRank: Record<string, number> = {
  'mtgjson.cardmarket': 3,
  'cardmarket.priceguide': 2,
  'scryfall': 1,
};

export const useCardsStore = defineStore('cards', {
  state: (): CardsState => ({
    cards: {},
    cardPrices: {},
    cardLatest: {},
    idMap: null,

    loading: false,
    loadingPrices: false,
    error: null,
  }),

  getters: {
    getCardById: (state) => (id: string) => state.cards[id],
    getAllCards: (state) => Object.values(state.cards),
    getCardsBySet: (state) => (setCode: string) =>
      Object.values(state.cards).filter((c) => c.setCode === setCode),
    /** grid uses this for sorting/filtering */
    getCardPrice: (state) => (cardId: string) => state.cardPrices[cardId] || null,
    /** handy getters for the two finishes (used by the badges) */
    getLatestNonfoil: (state) => (cardId: string) => state.cardLatest[cardId]?.nonfoil || null,
    getLatestFoil: (state) => (cardId: string) => state.cardLatest[cardId]?.foil || null,
  },

  actions: {
    // ------------------- core loads -------------------

    async loadCards() {
      this.loading = true; this.error = null;
      try {
        const cards = await cardRepository.getAll();
        this.cards = cards.reduce((acc, c) => { acc[c.id] = c; return acc; }, {} as Record<string, Card>);
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load cards';
        console.error('Error loading cards:', e);
      } finally {
        this.loading = false;
      }
    },

    /** Preload AllIdentifiers map once */
    async ensureIdMap() {
      if (this.idMap) return;
      try {
        this.idMap = await settingRepository.get(ID_MAP_SETTING_KEY) ?? null;
      } catch (e) {
        console.warn('[cardsStore] Could not load id map', e);
        this.idMap = null;
      }
    },

    /** Resolve MTGJSON uuid for a card if available (lowercased) */
    uuidForCard(card: Card): string | null {
      const m = this.idMap;
      if (!m) return null;
      const u = m[card.id] || (card.oracleId ? m[card.oracleId] : undefined);
      return u ? String(u).toLowerCase() : null;
    },

    /** Compute latest money for a finish from a list of price points; merges providers */
    _pickLatestForFinish(points: Array<Pick<PricePoint, 'finish'|'date'|'asOf'|'provider'|'priceCent'|'currency'>>, finish: Finish): Money | null {
      const toISO = (d: any) => { try { return new Date(d).toISOString().slice(0,10); } catch { return undefined; } };
      const byDate: Record<string, { priceCent: number; currency: string; rank: number; asOfTs: number }> = {};
      for (const p of points) {
        const f = (p.finish ?? 'nonfoil') as Finish;
        if (f !== finish) continue;
        const date = p.date ?? (p.asOf ? toISO(p.asOf) : undefined);
        if (!date) continue;
        const rank = providerRank[p.provider ?? ''] ?? 0;
        const asOfTs = p.asOf ? new Date(p.asOf as any).getTime() : 0;

        const prev = byDate[date];
        if (!prev || rank > prev.rank || (rank === prev.rank && asOfTs > prev.asOfTs)) {
          byDate[date] = { priceCent: p.priceCent, currency: p.currency ?? 'EUR', rank, asOfTs };
        }
      }
      const dates = Object.keys(byDate);
      if (!dates.length) return null;
      const latestDate = dates.sort((a,b) => a.localeCompare(b)).at(-1)!;
      const best = byDate[latestDate];
      return new Money(best.priceCent, best.currency);
    },

    /** Load latest (nonfoil + foil) for a single card id, cache, and set display price */
    async loadLatestForCard(cardId: string) {
      const card = this.cards[cardId];
      if (!card) return;

      // Query only by Scryfall ID since all price points now use Scryfall IDs
      const rows = await db.price_points.where('cardId').equals(cardId).toArray();
      const canonical = rows.map((pp) => ({
        date: pp.date,
        asOf: pp.asOf,
        provider: pp.provider,
        finish: (pp.finish ?? 'nonfoil') as Finish,
        priceCent: pp.priceCent,
        currency: pp.currency ?? 'EUR',
      }));

      const nonfoil = this._pickLatestForFinish(canonical, 'nonfoil');
      const foil    = this._pickLatestForFinish(canonical, 'foil');

      // cache both finishes
      this.cardLatest[cardId] = { nonfoil: nonfoil || undefined, foil: foil || undefined };

      // choose display price: prefer the card's finish, else any available
      const display = (card.finish === 'foil' ? foil : nonfoil) || foil || nonfoil || null;
      if (display) this.cardPrices[cardId] = display;
      else delete this.cardPrices[cardId];
    },

    /** Load latest prices for *all* cards (used by overview & sorting). Batched with small concurrency. */
    async loadCardPrices() {
      this.loadingPrices = true; this.error = null;
      try {
        // ensure cards present
        if (!Object.keys(this.cards).length) await this.loadCards();
        await this.ensureIdMap();

        const all = Object.values(this.cards);
        const CONC = 8;
        for (let i = 0; i < all.length; i += CONC) {
          const slice = all.slice(i, i + CONC);
          await Promise.all(slice.map((c) => this.loadLatestForCard(c.id)));
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load card prices';
        console.error('Error loading card prices:', e);
      } finally {
        this.loadingPrices = false;
      }
    },

    /** Lazy: fetch full price history only when needed (modal). */
    async getPriceHistory(cardId: string): Promise<PricePoint[]> {
      const card = this.cards[cardId];
      if (!card) return [];

      // Query only by Scryfall ID since all price points now use Scryfall IDs
      const toISO = (d: any) => { try { return new Date(d).toISOString().slice(0, 10); } catch { return undefined; } };

      const rows = await db.price_points.where('cardId').equals(cardId).toArray();
      return rows
        .map((pp) => ({ ...pp, date: pp.date ?? (pp.asOf ? toISO(pp.asOf) : undefined) }))
        .filter((pp) => typeof pp.date === 'string')
        .sort((a, b) => (a.date as string).localeCompare(b.date as string));
    },

    async loadCardsAndPrices() {
      await this.loadCards();
      await this.loadCardPrices();
    },

    // CRUD passthrough (unchanged)
    async addCard(card: Card) { await cardRepository.add(card); this.cards[card.id] = card; },
    async updateCard(id: string, card: Partial<Card>) {
      await cardRepository.update(id, card);
      if (this.cards[id]) this.cards[id] = { ...this.cards[id], ...card } as Card;
    },
    async removeCard(id: string) {
      await cardRepository.delete(id);
      delete this.cards[id];
      delete this.cardPrices[id];
      delete this.cardLatest[id];
    },
  },
});