<template>
  <div class="deck-detail-view">
    <div v-if="loading" class="loading">
      Loading deck...
    </div>
    
    <div v-else-if="deck" class="deck-detail">
      <div class="deck-header">
        <router-link to="/decks" class="back-link">
          ← Back to Decks
        </router-link>
        <h1>{{ deck.name }}</h1>
        <p class="deck-meta">
          <span class="platform">{{ deck.platform }}</span>
          <span class="date">Imported: {{ formatDate(deck.importedAt) }}</span>
        </p>
      </div>
      
      <!-- Deck stats removed as they're no longer needed with the new card component -->
      
      <div class="cards-section">
        <h2>Cards in Deck</h2>
        <div v-if="deckCards.length === 0" class="empty-state">
          <p>No cards found in this deck.</p>
        </div>
        <div v-else class="cards-grid">
          <CardComponent
            v-for="deckCard in deckCards"
            :key="deckCard.id"
            :card="getCardDetails(deckCard.cardId)"
          />
        </div>
      </div>
    </div>
    
    <div v-else class="error">
      <p>Deck not found.</p>
      <router-link to="/decks" class="back-link">
        ← Back to Decks
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import db from '../../../data/db';
import CardComponent from '../../../components/CardComponent.vue';

// Route
const route = useRoute();

// Reactive state
const deck = ref<any>(null);
const deckCards = ref<any[]>([]);
const cards = ref<Record<string, any>>({});
const loading = ref(true);

// Format date
const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString();
};

// Get card details
const getCardDetails = (cardId: string) => {
  return cards.value[cardId] || {
    id: cardId,
    name: 'Unknown Card',
    set: 'Unknown Set',
    setCode: '???',
    number: '???',
    lang: 'en',
    finish: 'nonfoil',
    imageUrl: 'https://placehold.co/200x280?text=Card+Image'
  };
};

// Load deck data
const loadDeck = async () => {
  try {
    const deckId = route.params.id as string;
    
    // Get deck
    const deckData = await db.decks.get(deckId);
    if (!deckData) {
      return;
    }
    deck.value = deckData;
    
    // Get deck cards
    const cardsInDeck = await db.deck_cards.where('deckId').equals(deckId).toArray();
    deckCards.value = cardsInDeck;
    
    // Get card details
    const cardIds = cardsInDeck.map(card => card.cardId).filter(id => id);
    if (cardIds.length > 0) {
      const cardDetails = await db.cards.where('id').anyOf(cardIds).toArray();
      cards.value = Object.fromEntries(cardDetails.map(card => [card.id, card]));
    }
  } catch (error) {
    console.error('Error loading deck:', error);
  } finally {
    loading.value = false;
  }
};

// Load deck when component mounts
onMounted(() => {
  loadDeck();
});
</script>

<style scoped>
.deck-detail-view {
  padding: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
}

.loading,
.error {
  text-align: center;
  padding: var(--space-xl);
}

.back-link {
  display: inline-block;
  margin-bottom: var(--space-md);
  color: var(--color-primary);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.deck-header h1 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-2xl);
}

.deck-meta {
  display: flex;
  gap: var(--space-md);
  margin: 0 0 var(--space-xl);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.platform {
  background: var(--color-primary-light);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  text-transform: uppercase;
  font-weight: var(--font-weight-bold);
}

.deck-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.stat-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
}

.stat-value {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.cards-section h2 {
  margin: var(--space-xl) 0 var(--space-md);
  font-size: var(--font-size-xl);
}

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.card-grid-item {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card-grid-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.card-image-container {
  width: 100%;
  height: 280px;
  overflow: hidden;
  background-color: var(--color-border);
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-info {
  padding: var(--space-sm);
}

.card-name {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-base);
  line-height: 1.3;
}

.card-set {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.card-quantity {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.ownership-status {
  text-align: center;
}

.ownership-status span {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
}

.ownership-status .owned {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.ownership-status .missing {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.ownership-status .partial {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.ownership-status .unknown {
  background: var(--color-info-bg);
  color: var(--color-info);
}
</style>