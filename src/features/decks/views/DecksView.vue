<template>
  <div class="container py-4">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <h1 class="h3 mb-0">Decks</h1>
      <router-link to="/import/deck" class="btn btn-glass-primary">
        Import Deck
      </router-link>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status" aria-hidden="true"></div>
      <div class="mt-2">Loading decks…</div>
    </div>

    <!-- Empty state -->
    <div v-else-if="decks.length === 0" class="text-center py-5">
      <p class="text-muted mb-3">You haven't imported any decks yet.</p>
      <router-link to="/import/deck" class="btn btn-glass-primary">
        Import Your First Deck
      </router-link>
    </div>

    <!-- Deck grid -->
    <div v-else class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
      <div v-for="deck in decks" :key="deck.id" class="col">
        <div class="card h-100 shadow-sm border-0 overflow-hidden position-relative">
          <!-- Face card area: exact card ratio, no bars -->
          <div class="card-aspect position-relative overflow-hidden">
            <img
                :src="(getFaceCard(deck.id)?.imageUrl)"
                :alt="getFaceCard(deck.id)?.name || 'Face card'"
                class="w-100 h-100 d-block img-fit-cover rounded-4"
            />
          </div>

          <!-- Body -->
          <div class="card-body">
            <h2 class="h5 mb-1 text-truncate" :title="deck.name">{{ deck.name }}</h2>
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span v-if="deck.platform" class="badge bg-info text-dark text-uppercase">
                {{ deck.platform }}
              </span>
              <small class="text-muted">{{ formatDate(deck.importedAt) }}</small>
            </div>
            <div class="fw-semibold">{{ getCardCount(deck.id) }} cards</div>
            <router-link
                class="stretched-link"
                :to="`/decks/${deck.id}`"
                aria-label="Open deck"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getDb } from '../../../data/init';

type Deck = {
  id: string;
  name: string;
  platform?: string;
  importedAt?: string | Date;
  faceCardId?: string;
};

type Card = { id: string; name: string; imageUrl?: string };

const decks = ref<Deck[]>([]);
const loading = ref(true);
const cardCounts = ref<Record<string, number>>({});
const faceCards = ref<Record<string, Card>>({});

const formatDate = (d?: string | Date) => (d ? new Date(d).toLocaleDateString() : '—');
const getCardCount = (deckId: string) => cardCounts.value[deckId] ?? 0;
const getFaceCard = (deckId: string) => faceCards.value[deckId];

const loadDecks = async () => {
  try {
    const db = getDb();
    const allDecks = (await db.decks.toArray()) as Deck[];
    decks.value = allDecks;

    const countPromises = allDecks.map(async d => {
      const c = await db.deck_cards.where('deckId').equals(d.id).count();
      return [d.id, c] as const;
    });

    const facePromises = allDecks.map(async d => {
      if (!d.faceCardId) return [d.id, null] as const;
      const fc = await db.cards.get(d.faceCardId);
      return [d.id, fc ? ({ id: fc.id, name: fc.name, imageUrl: fc.imageUrl } as Card) : null] as const;
    });

    (await Promise.all(countPromises)).forEach(([id, c]) => (cardCounts.value[id] = c));
    (await Promise.all(facePromises)).forEach(([id, card]) => {
      if (card) faceCards.value[id] = card;
      else delete faceCards.value[id];
    });
  } catch (err) {
    console.error('Error loading decks:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(loadDecks);
</script>

<style scoped>
/* Ensures the image area matches real card proportions and fully fills */
.card-aspect { aspect-ratio: 63 / 88; }
.img-fit-cover { object-fit: cover; }
</style>
