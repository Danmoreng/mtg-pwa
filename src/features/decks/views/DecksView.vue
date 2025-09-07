<template>
  <div class="decks-view">
    <div class="header">
      <h1>Decks</h1>
      <router-link to="/import/deck" class="btn btn-primary">
        Import Deck
      </router-link>
    </div>
    
    <div v-if="loading" class="loading">
      Loading decks...
    </div>
    
    <div v-else-if="decks.length === 0" class="empty-state">
      <p>You haven't imported any decks yet.</p>
      <router-link to="/import/deck" class="btn btn-primary">
        Import Your First Deck
      </router-link>
    </div>
    
    <div v-else class="row g-4">
      <div 
        v-for="deck in decks" 
        :key="deck.id" 
        class="col-lg-4 col-md-6"
      >
        <div class="deck-card h-100" @click="viewDeck(deck.id)">
          <h2>{{ deck.name }}</h2>
          <p class="deck-info">
            <span class="platform">{{ deck.platform }}</span>
            <span class="date">{{ formatDate(deck.importedAt) }}</span>
          </p>
          <p class="card-count">{{ getCardCount(deck.id) }} cards</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import db from '../../../data/db';

// Router
const router = useRouter();

// Reactive state
const decks = ref<any[]>([]);
const loading = ref(true);
const cardCounts = ref<Record<string, number>>({});

// Format date
const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString();
};

// Get card count for a deck
const getCardCount = (deckId: string) => {
  return cardCounts.value[deckId] || 0;
};

// View deck details
const viewDeck = (deckId: string) => {
  router.push(`/decks/${deckId}`);
};

// Load decks
const loadDecks = async () => {
  try {
    // Get all decks
    const allDecks = await db.decks.toArray();
    decks.value = allDecks;
    
    // Get card counts for each deck
    for (const deck of allDecks) {
      const count = await db.deck_cards.where('deckId').equals(deck.id).count();
      cardCounts.value[deck.id] = count;
    }
  } catch (error) {
    console.error('Error loading decks:', error);
  } finally {
    loading.value = false;
  }
};

// Load decks when component mounts
onMounted(() => {
  loadDecks();
});
</script>

<style scoped>
.decks-view {
  padding: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
}

.header h1 {
  margin: 0;
}

.loading,
.empty-state {
  text-align: center;
  padding: var(--space-xl);
}

.empty-state p {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-lg);
}

.deck-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.deck-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.deck-card h2 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-xl);
}

.deck-info {
  display: flex;
  justify-content: space-between;
  margin: 0 0 var(--space-md);
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

.card-count {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}
</style>