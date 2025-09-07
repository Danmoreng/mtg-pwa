<template>
  <div class="cards-view">
    <div class="header">
      <div class="controls">
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search cards..." 
            class="form-control"
          />
        </div>
        <div class="sort-controls">
          <select v-model="sortBy" class="form-select">
            <option value="name">Name</option>
            <option value="set">Set</option>
            <option value="price">Price</option>
            <option value="owned">Owned Quantity</option>
          </select>
          <button @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" class="btn btn-outline-primary">
            {{ sortDirection === 'asc' ? '↑' : '↓' }}
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="cardsStore.loading || cardsStore.loadingPrices" class="loading">
      Loading cards and prices...
    </div>
    
    <div v-else-if="sortedCards.length === 0" class="empty-state">
      <p v-if="searchQuery">No cards match your search.</p>
      <p v-else>You don't have any cards in your collection yet.</p>
    </div>
    
    <div v-else class="row g-4">
      <div 
        v-for="card in sortedCards" 
        :key="card.id" 
        class="col-xl-2 col-lg-3 col-md-4 col-sm-6"
      >
        <CardComponent :card="card" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import CardComponent from '../../../components/CardComponent.vue';
import { useCardsStore } from '../../../stores/cards';

// Use the cards store
const cardsStore = useCardsStore();

// Reactive state
const searchQuery = ref('');
const sortBy = ref('name'); // Default sort by name
const sortDirection = ref('asc'); // Default ascending

// Filter cards based on search query
const filteredCards = computed(() => {
  const allCards = cardsStore.getAllCards;
  if (!searchQuery.value) {
    return allCards;
  }
  
  const query = searchQuery.value.toLowerCase();
  return allCards.filter(card => 
    card.name.toLowerCase().includes(query) ||
    card.set.toLowerCase().includes(query) ||
    card.number.includes(query)
  );
});

// Sort cards based on selected criteria
const sortedCards = computed(() => {
  const cardsToSort = [...filteredCards.value];
  
  cardsToSort.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy.value) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'set':
        comparison = a.set.localeCompare(b.set);
        break;
      case 'price':
        {
          const priceA = cardsStore.getCardPrice(a.id)?.getCents() ?? 0;
          const priceB = cardsStore.getCardPrice(b.id)?.getCents() ?? 0;
          comparison = priceA - priceB;
        }
        break;
      case 'owned':
        // We can implement owned quantity sorting if needed
        comparison = 0;
        break;
      default:
        comparison = a.name.localeCompare(b.name);
    }
    
    return sortDirection.value === 'asc' ? comparison : -comparison;
  });
  
  return cardsToSort;
});

// Load cards and prices when component mounts
onMounted(() => {
  cardsStore.loadCardsAndPrices();
});
</script>

<style scoped>
.cards-view {
  padding: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  margin-bottom: var(--space-xl);
}

.header h1 {
  margin: 0 0 var(--space-md);
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
}

.search-box {
  flex: 1;
  max-width: 300px;
}

.sort-controls {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
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

.card-item {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
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

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.card-details {
  padding: var(--space-sm);
}

.card-details h2 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-base);
  line-height: 1.3;
}

.card-set {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.card-lots {
  margin: 0 0 var(--space-xxs);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
}

.card-quantity {
  margin: 0 0 var(--space-sm);
  font-weight: var(--font-weight-bold);
}

.card-prices {
  margin-top: var(--space-xs);
}

.price {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  margin-bottom: var(--space-xxs);
}

.price-label {
  color: var(--color-text-secondary);
}

.price-value {
  font-weight: var(--font-weight-bold);
}

.scryfall-price .price-value {
  color: var(--color-primary);
}

.cardmarket-price .price-value {
  color: var(--color-success);
}

.price-loading {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  font-style: italic;
}

@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-box {
    max-width: none;
  }
  
  .sort-controls {
    justify-content: space-between;
  }
}

</style>