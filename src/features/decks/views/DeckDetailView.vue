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
        <div class="deck-title-container">
          <h1 v-if="!isEditingTitle" @click="startEditingTitle" class="editable-title">
            {{ deck.name }}
            <span class="edit-icon">✏️</span>
          </h1>
          <div v-else class="title-edit-form">
            <input 
              v-model="editedTitle" 
              @keyup.enter="saveTitle" 
              @blur="saveTitle"
              @keyup.esc="cancelEditingTitle"
              ref="titleInput"
              class="title-input"
            />
            <div class="title-edit-buttons">
              <button @click="saveTitle" class="btn btn-sm btn-primary">Save</button>
              <button @click="cancelEditingTitle" class="btn btn-sm btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
        <p class="deck-meta">
          <span class="platform">{{ deck.platform }}</span>
          <span class="date">Imported: {{ formatDate(deck.importedAt) }}</span>
        </p>
        <div class="deck-actions">
          <button @click="deleteDeck" class="btn btn-sm btn-danger">Delete Deck</button>
        </div>
      </div>
      
      <!-- Face card selection -->
      <div class="face-card-section">
        <h3>Deck Face Card</h3>
        <div v-if="faceCard" class="face-card-display">
          <div class="card-preview">
            <img 
              :src="faceCard.imageUrl || 'https://placehold.co/200x280?text=Card+Image'" 
              :alt="faceCard.name"
              class="card-image"
            />
            <div class="card-info">
              <h4>{{ faceCard.name }}</h4>
              <p>{{ faceCard.set }} ({{ faceCard.setCode }})</p>
              <button @click="clearFaceCard" class="btn btn-sm btn-secondary">Remove Face Card</button>
            </div>
          </div>
        </div>
        <div v-else class="no-face-card">
          <p>No face card selected.</p>
        </div>
        <button @click="openFaceCardSelector" class="btn btn-primary">Select Face Card</button>
      </div>
      
      <div class="cards-section">
        <h2>Cards in Deck</h2>
        <div v-if="deckCards.length === 0" class="empty-state">
          <p>No cards found in this deck.</p>
        </div>
        <div v-else class="cards-grid">
          <div 
            v-for="deckCard in deckCards" 
            :key="deckCard.id"
            class="card-selector"
            :class="{ 'selected-as-face': deckCard.cardId === deck.faceCardId }"
          >
            <div @click.stop="selectFaceCard(deckCard.cardId)">
              <CardComponent
                :card="getCardDetails(deckCard.cardId)"
              />
            </div>
          </div>
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
  
  <!-- Face Card Selector Modal -->
  <div v-if="showFaceCardSelector" class="modal fade show d-block" @click="closeFaceCardSelector">
    <div class="modal-dialog modal-xl" @click.stop>
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Select Face Card</h5>
          <button type="button" class="btn-close" @click="closeFaceCardSelector"></button>
        </div>
        <div class="modal-body">
          <div class="search-container mb-3">
            <input 
              v-model="faceCardSelectorSearch" 
              type="text" 
              class="form-control" 
              placeholder="Search cards by name..."
            />
          </div>
          <div v-if="filteredDeckCards().length === 0" class="text-center py-5">
            <p>No cards found.</p>
          </div>
          <div v-else class="row g-3">
            <div 
              v-for="deckCard in filteredDeckCards()" 
              :key="deckCard.id"
              class="col-xl-2 col-lg-3 col-md-4 col-sm-6"
            >
              <div 
                class="card-selector"
                :class="{ 'selected': deckCard.cardId === deck?.faceCardId }"
                @click="selectFaceCard(deckCard.cardId)"
              >
                <div class="card-image-container">
                  <img 
                    :src="getCardDetails(deckCard.cardId).imageUrl || 'https://placehold.co/200x280?text=Card+Image'" 
                    :alt="getCardDetails(deckCard.cardId).name"
                    class="card-image"
                  />
                </div>
                <div class="card-name">{{ getCardDetails(deckCard.cardId).name }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeFaceCardSelector">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import db from '../../../data/db';
import CardComponent from '../../../components/CardComponent.vue';

// Route
const route = useRoute();
const router = useRouter();

// Reactive state
const deck = ref<any>(null);
const deckCards = ref<any[]>([]);
const cards = ref<Record<string, any>>({});
const loading = ref(true);
const isEditingTitle = ref(false);
const editedTitle = ref('');
const titleInput = ref<HTMLInputElement | null>(null);
const showFaceCardSelector = ref(false);
const faceCardSelectorSearch = ref('');

// Computed property for face card
const faceCard = ref<any>(null);

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

// Start editing title
const startEditingTitle = () => {
  isEditingTitle.value = true;
  editedTitle.value = deck.value.name;
  nextTick(() => {
    if (titleInput.value) {
      titleInput.value.focus();
      titleInput.value.select();
    }
  });
};

// Save title
const saveTitle = async () => {
  if (!deck.value || !editedTitle.value.trim()) {
    isEditingTitle.value = false;
    return;
  }

  try {
    // Update deck name in database
    await db.decks.update(deck.value.id, { name: editedTitle.value.trim() });
    
    // Update local state
    deck.value.name = editedTitle.value.trim();
    
    // Exit edit mode
    isEditingTitle.value = false;
  } catch (error) {
    console.error('Error updating deck title:', error);
    alert('Failed to update deck title. Please try again.');
  }
};

// Cancel editing title
const cancelEditingTitle = () => {
  isEditingTitle.value = false;
  editedTitle.value = '';
};

// Select face card
const selectFaceCard = async (cardId: string) => {
  if (!deck.value) return;

  try {
    // Update deck with new face card ID
    await db.decks.update(deck.value.id, { faceCardId: cardId });
    
    // Update local state
    deck.value.faceCardId = cardId;
    
    // Update face card display
    faceCard.value = getCardDetails(cardId);
    
    // Close the selector modal
    showFaceCardSelector.value = false;
  } catch (error) {
    console.error('Error updating face card:', error);
    alert('Failed to update face card. Please try again.');
  }
};

// Clear face card
const clearFaceCard = async () => {
  if (!deck.value) return;

  try {
    // Remove face card ID from deck
    await db.decks.update(deck.value.id, { faceCardId: undefined });
    
    // Update local state
    deck.value.faceCardId = undefined;
    faceCard.value = null;
  } catch (error) {
    console.error('Error clearing face card:', error);
    alert('Failed to clear face card. Please try again.');
  }
};

// Open face card selector modal
const openFaceCardSelector = () => {
  showFaceCardSelector.value = true;
  faceCardSelectorSearch.value = '';
};

// Close face card selector modal
const closeFaceCardSelector = () => {
  showFaceCardSelector.value = false;
  faceCardSelectorSearch.value = '';
};

// Filter deck cards based on search term
const filteredDeckCards = () => {
  if (!faceCardSelectorSearch.value) {
    return deckCards.value;
  }
  
  const searchTerm = faceCardSelectorSearch.value.toLowerCase();
  return deckCards.value.filter(deckCard => {
    const card = getCardDetails(deckCard.cardId);
    return card.name.toLowerCase().includes(searchTerm);
  });
};

// Delete deck
const deleteDeck = async () => {
  if (!deck.value) return;

  if (!confirm(`Are you sure you want to delete the deck "${deck.value.name}"? This action cannot be undone.`)) {
    return;
  }

  try {
    // Delete deck cards first
    await db.deck_cards.where('deckId').equals(deck.value.id).delete();
    
    // Delete deck
    await db.decks.delete(deck.value.id);
    
    // Navigate back to decks list
    router.push('/decks');
  } catch (error) {
    console.error('Error deleting deck:', error);
    alert('Failed to delete deck. Please try again.');
  }
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
    
    // Set edited title for editing
    editedTitle.value = deckData.name;
    
    // Get deck cards
    const cardsInDeck = await db.deck_cards.where('deckId').equals(deckId).toArray();
    deckCards.value = cardsInDeck;
    
    // Get card details
    const cardIds = cardsInDeck.map(card => card.cardId).filter(id => id);
    if (cardIds.length > 0) {
      const cardDetails = await db.cards.where('id').anyOf(cardIds).toArray();
      cards.value = Object.fromEntries(cardDetails.map(card => [card.id, card]));
      
      // Set face card if one is selected
      if (deckData.faceCardId) {
        faceCard.value = getCardDetails(deckData.faceCardId);
      }
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

.deck-title-container {
  margin: 0 0 var(--space-sm);
}

.editable-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  cursor: pointer;
  display: inline-block;
  position: relative;
}

.editable-title:hover .edit-icon {
  opacity: 1;
}

.edit-icon {
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: var(--space-xs);
  font-size: var(--font-size-base);
  vertical-align: middle;
}

.title-input {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  padding: var(--space-xs);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-xs);
  width: 100%;
  max-width: 500px;
}

.title-edit-buttons {
  display: flex;
  gap: var(--space-xs);
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

.deck-actions {
  margin-bottom: var(--space-xl);
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

.deck-header {
  margin-bottom: var(--space-xl);
  position: relative;
  z-index: 10;
}

.face-card-section {
  margin-bottom: var(--space-xl);
  position: relative;
  z-index: 1;
  clear: both;
  max-width: 250px;
  margin-left: auto;
}

.cards-section h2,
.face-card-section h3 {
  margin: var(--space-xl) 0 var(--space-md);
  font-size: var(--font-size-xl);
}

.face-card-display {
  max-width: 150px;
  margin-bottom: var(--space-lg);
}

.card-preview {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  width: 150px;
}

.card-preview .card-image {
  width: 100%;
  height: auto;
  max-height: 210px;
  object-fit: contain;
  display: block;
}

.card-preview .card-info {
  padding: var(--space-sm);
}

.card-preview .card-info h4 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-base);
}

.card-preview .card-info p {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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

/* Face Card Selector Modal */
.search-container {
  max-width: 400px;
  margin: 0 auto;
}

.card-selector {
  cursor: pointer;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  transition: all 0.2s;
  background: var(--color-surface);
  overflow: hidden;
  position: relative;
}

.card-selector:hover {
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-selector.selected {
  border-color: var(--color-success);
  box-shadow: 0 0 0 2px var(--color-success);
}

/* Add this line to fix the modal selector */
.card-selector.selected-as-face,
.card-selector.selected {
  border-color: var(--color-success);
  box-shadow: 0 0 0 2px var(--color-success);
}

.card-selector.selected-as-face::after {
  content: "★";
  position: absolute;
  top: 5px;
  right: 5px;
  background: var(--color-success);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  z-index: 10;
}

.card-image-container {
  width: 100%;
  padding-bottom: 140%; /* Aspect ratio for card images */
  position: relative;
  overflow: hidden;
}

.card-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-name {
  padding: var(--space-xs);
  font-size: var(--font-size-xs);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>