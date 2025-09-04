<template>
  <div class="cards-view">
    <div class="header">
      <div class="controls">
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search cards..." 
            class="search-input"
          />
        </div>
        <div class="sort-controls">
          <select v-model="sortBy" class="sort-select">
            <option value="name">Name</option>
            <option value="set">Set</option>
            <option value="price">Price</option>
            <option value="releasedAt">Release Date</option>
            <option value="owned">Owned Quantity</option>
          </select>
          <button @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'" class="sort-direction-button">
            {{ sortDirection === 'asc' ? '↑' : '↓' }}
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      Loading cards...
    </div>
    
    <div v-else-if="sortedCards.length === 0" class="empty-state">
      <p v-if="searchQuery">No cards match your search.</p>
      <p v-else>You don't have any cards in your collection yet.</p>
    </div>
    
    <div v-else class="cards-grid">
      <div 
        v-for="card in sortedCards" 
        :key="card.id" 
        class="card-item"
      >
        <div class="card-image-container">
          <img 
            v-if="card.imageUrl" 
            :src="card.imageUrl" 
            :alt="card.name"
            class="card-image"
            @error="handleImageError"
          />
          <div v-else class="image-placeholder">
            <span>No Image</span>
          </div>
        </div>
        <div class="card-details">
          <h2>{{ card.name }}</h2>
          <p class="card-set">{{ card.set }} #{{ card.number }}</p>
          <p class="card-lots">Owned: {{ getLotQuantity(card.id) }} lot(s)</p>
          <p class="card-quantity">Total: {{ getCardQuantity(card.id) }} card(s)</p>
          <div v-if="cardPrices[card.id]" class="card-prices">
            <div v-if="cardPrices[card.id].scryfall" class="price scryfall-price">
              <span class="price-label">Price:</span>
              <span class="price-value">{{ cardPrices[card.id]?.scryfall?.format('de-DE') || 'N/A' }}</span>
            </div>
          </div>
          <div v-else-if="loadingPrices" class="price-loading">
            Loading prices...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import db from '../../../data/db';
import { Money } from '../../../core/Money';

// Reactive state
const cards = ref<any[]>([]);
const lots = ref<Record<string, any[]>>({});
const cardPrices = ref<Record<string, { scryfall?: Money; cardmarket?: Money }>>({});
const loading = ref(true);
const loadingPrices = ref(false);
const searchQuery = ref('');
const sortBy = ref('name'); // Default sort by name
const sortDirection = ref('asc'); // Default ascending

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
          const priceA = cardPrices.value[a.id]?.scryfall?.getCents() ?? 0;
          const priceB = cardPrices.value[b.id]?.scryfall?.getCents() ?? 0;
          comparison = priceA - priceB;
        }
        break;
      case 'releasedAt':
        // Assuming we have a releasedAt field on the card
        const dateA = a.releasedAt ? new Date(a.releasedAt).getTime() : 0;
        const dateB = b.releasedAt ? new Date(b.releasedAt).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'owned':
        {
          const ownedA = getCardQuantity(a.id);
          const ownedB = getCardQuantity(b.id);
          comparison = ownedA - ownedB;
        }
        break;
      default:
        comparison = a.name.localeCompare(b.name);
    }
    
    return sortDirection.value === 'asc' ? comparison : -comparison;
  });
  
  return cardsToSort;
});

// Get lot quantity for a card
const getLotQuantity = (cardId: string) => {
  return lots.value[cardId] ? lots.value[cardId].length : 0;
};

// Get total card quantity for a card
const getCardQuantity = (cardId: string) => {
  if (!lots.value[cardId]) return 0;
  
  return lots.value[cardId].reduce((total, lot) => {
    // Only count lots that haven't been fully disposed
    if (!lot.disposedAt || (lot.disposedQuantity && lot.disposedQuantity < lot.quantity)) {
      const remainingQuantity = lot.disposedQuantity ? lot.quantity - lot.disposedQuantity : lot.quantity;
      return total + remainingQuantity;
    }
    return total;
  }, 0);
};

// Handle image error
const handleImageError = (event: any) => {
  event.target.src = 'https://placehold.co/200x280?text=Card+Image';
};

// Load prices for cards from the database
const loadCardPrices = async () => {
  if (cards.value.length === 0) return;
  
  loadingPrices.value = true;
  
  try {
    // Create an array of promises for price fetching from database
    const pricePromises = cards.value.map(async (card) => {
      try {
        // Fetch price points from database
        const pricePoints = await db.price_points.where('cardId').equals(card.id).toArray();
        
        // Find the most recent price point
        if (pricePoints.length > 0) {
          // Sort by date descending to get the most recent price
          pricePoints.sort((a, b) => b.asOf.getTime() - a.asOf.getTime());
          const latestPricePoint = pricePoints[0];
          
          const price = new Money(latestPricePoint.price, latestPricePoint.currency);
          
          return {
            cardId: card.id,
            prices: {
              scryfall: price,
              // We won't show Cardmarket prices separately since Scryfall already includes them
            }
          };
        }
        
        return {
          cardId: card.id,
          prices: {}
        };
      } catch (error) {
        console.error(`Error loading prices for card ${card.id}:`, error);
        return {
          cardId: card.id,
          prices: {}
        };
      }
    });
    
    // Wait for all price promises to resolve
    const priceResults = await Promise.all(pricePromises);
    
    // Update the cardPrices object
    const newCardPrices: Record<string, { scryfall?: Money; cardmarket?: Money }> = {};
    for (const result of priceResults) {
      newCardPrices[result.cardId] = result.prices;
    }
    
    cardPrices.value = newCardPrices;
  } catch (error) {
    console.error('Error loading card prices:', error);
  } finally {
    loadingPrices.value = false;
  }
};

// Load cards and lots
const loadCards = async () => {
  try {
    // Get all cards
    const allCards = await db.cards.toArray();
    cards.value = allCards;
    
    // Get lots for each card
    const allLots = await db.card_lots.toArray();
    const lotsByCard: Record<string, any[]> = {};
    
    for (const lot of allLots) {
      if (lot.cardId) {
        if (!lotsByCard[lot.cardId]) {
          lotsByCard[lot.cardId] = [];
        }
        lotsByCard[lot.cardId].push(lot);
      }
    }
    
    lots.value = lotsByCard;
  } catch (error) {
    console.error('Error loading cards:', error);
  } finally {
    loading.value = false;
  }
};

// Load cards and prices when component mounts
onMounted(() => {
  loadCards().then(() => {
    if (cards.value.length > 0) {
      loadCardPrices();
    }
  });
});

// Reload prices when cards change
watch(cards, () => {
  if (cards.value.length > 0 && !loadingPrices.value) {
    loadCardPrices();
  }
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

.sort-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.sort-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.sort-direction-button {
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  transition: background-color 0.2s;
}

.sort-direction-button:hover {
  background: var(--color-primary-dark);
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
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
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