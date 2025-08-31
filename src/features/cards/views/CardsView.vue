<template>
  <div class="cards-view">
    <div class="header">
      <h1>Cards</h1>
      <div class="search-box">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search cards..." 
          class="search-input"
        />
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      Loading cards...
    </div>
    
    <div v-else-if="filteredCards.length === 0" class="empty-state">
      <p v-if="searchQuery">No cards match your search.</p>
      <p v-else>You don't have any cards in your collection yet.</p>
    </div>
    
    <div v-else class="cards-grid">
      <div 
        v-for="card in filteredCards" 
        :key="card.id" 
        class="card-item"
      >
        <div class="card-image">
          <div v-if="card.imageUrl" class="image-placeholder">
            <img :src="card.imageUrl" :alt="card.name" />
          </div>
          <div v-else class="image-placeholder">
            <span>No Image</span>
          </div>
        </div>
        <div class="card-details">
          <h2>{{ card.name }}</h2>
          <p class="card-set">{{ card.set }} #{{ card.number }}</p>
          <p class="card-holdings">Owned: {{ getHoldingQuantity(card.id) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import db from '../../../data/db';

// Reactive state
const cards = ref<any[]>([]);
const holdings = ref<Record<string, number>>({});
const loading = ref(true);
const searchQuery = ref('');

// Filter cards based on search query
const filteredCards = computed(() => {
  if (!searchQuery.value) {
    return cards.value;
  }
  
  const query = searchQuery.value.toLowerCase();
  return cards.value.filter(card => 
    card.name.toLowerCase().includes(query) ||
    card.set.toLowerCase().includes(query) ||
    card.number.includes(query)
  );
});

// Get holding quantity for a card
const getHoldingQuantity = (cardId: string) => {
  return holdings.value[cardId] || 0;
};

// Load cards and holdings
const loadCards = async () => {
  try {
    // Get all cards
    const allCards = await db.cards.toArray();
    cards.value = allCards;
    
    // Get holdings for each card
    const allHoldings = await db.holdings.toArray();
    const holdingTotals: Record<string, number> = {};
    
    for (const holding of allHoldings) {
      if (holding.cardId) {
        holdingTotals[holding.cardId] = (holdingTotals[holding.cardId] || 0) + holding.quantity;
      }
    }
    
    holdings.value = holdingTotals;
  } catch (error) {
    console.error('Error loading cards:', error);
  } finally {
    loading.value = false;
  }
};

// Load cards when component mounts
onMounted(() => {
  loadCards();
});
</script>

<style scoped>
.cards-view {
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

.search-box {
  flex: 0 0 300px;
}

.search-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.loading,
.empty-state {
  text-align: center;
  padding: var(--space-xl);
}

.empty-state p {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
  margin: 0;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.card-item {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.card-image {
  height: 200px;
  background: var(--color-background);
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.image-placeholder img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.card-details {
  padding: var(--space-md);
}

.card-details h2 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-lg);
  line-height: 1.3;
}

.card-set {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.card-holdings {
  margin: 0;
  font-weight: var(--font-weight-bold);
}
</style>