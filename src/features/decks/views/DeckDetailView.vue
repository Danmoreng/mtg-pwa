<template>
  <div class="container py-4">
    <!-- Loading / Error -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border" role="status" aria-hidden="true"></div>
      <div class="mt-2">Loading deck…</div>
    </div>

    <div v-else-if="!deck" class="text-center py-5">
      <p class="mb-3">Deck not found.</p>
      <router-link to="/decks" class="btn btn-outline-secondary">← Back to Decks</router-link>
    </div>

    <!-- Deck Detail -->
    <div v-else>
      <!-- Top bar: back + actions -->
      <div class="d-flex align-items-center justify-content-between mb-3">
        <router-link to="/decks" class="btn btn-link px-0">
          ← Back to Decks
        </router-link>
        <div class="d-flex gap-2">
          <button
              @click="toggleFaceCardSelection"
              :class="['btn', isSelectingFaceCard ? 'btn-glass-warning' : 'btn-glass-primary']"
          >
            {{ isSelectingFaceCard ? 'Cancel Select Mode' : 'Select Face Card' }}
          </button>
          <button
              v-if="deck.faceCardId"
              @click="clearFaceCard"
              class="btn btn-glass-secondary"
          >
            Remove Face Card
          </button>
          <button @click="openDeleteModal" class="btn btn-glass-danger">
            Delete Deck
          </button>
        </div>
      </div>

      <!-- Header: title + meta -->
      <div class="card shadow-sm mb-4">
        <div class="card-body">
          <!-- Title -->
          <div class="d-flex align-items-start justify-content-between">
            <div class="w-100">
              <h1
                  v-if="!isEditingTitle"
                  @click="startEditingTitle"
                  class="h3 mb-2 editable"
                  title="Click to edit title"
              >
                {{ deck.name }}
                <span class="ms-2 small text-muted">✏️</span>
              </h1>

              <div v-else class="d-flex align-items-center flex-nowrap gap-2">
                <!-- Keep buttons on one line via input-group and max width -->
                <div class="input-group input-group-lg w-auto" style="max-width: 480px;">
                  <input
                      ref="titleInput"
                      v-model="editedTitle"
                      @keyup.enter="saveTitle"
                      @keyup.esc="cancelEditingTitle"
                      type="text"
                      class="form-control"
                      placeholder="Deck title"
                  />
                  <button @click="saveTitle" class="btn btn-primary">Save</button>
                  <button @click="cancelEditingTitle" class="btn btn-outline-secondary">Cancel</button>
                </div>
              </div>

              <!-- Meta -->
              <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                <span v-if="deck.platform" class="badge text-uppercase bg-info text-dark">
                  {{ deck.platform }}
                </span>
                <small class="text-muted">Imported: {{ formatDate(deck.importedAt) }}</small>
                <small v-if="faceCard" class="text-success d-inline-flex align-items-center">
                  <span class="me-1">★</span> Face card set
                </small>
              </div>
            </div>
          </div>

          <!-- Select mode hint -->
          <div v-if="isSelectingFaceCard" class="alert alert-warning mt-3 py-2 mb-0">
            Select mode is active — click a card below to set it as the face card.
          </div>
        </div>
      </div>

      <!-- Cards list -->
      <div>
        <h2 class="h5 mb-3">Cards in Deck</h2>
        <div v-if="deckCards.length === 0" class="text-center py-5 text-muted">
          No cards found in this deck.
        </div>

        <div
            v-else
            class="row row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 row-cols-xxl-6 g-3"
        >
          <div
              v-for="deckCard in deckCards"
              :key="deckCard.id"
              class="col"
          >
            <div
                class="position-relative h-100"
                :class="{
                'border border-success rounded': deckCard.cardId === deck.faceCardId,
                'cursor-pointer': isSelectingFaceCard
              }"
                role="button"
                @click="isSelectingFaceCard ? handleFaceCardSelection(deckCard.cardId) : null"
            >
              <!-- CardComponent should render without our extra borders -->
              <CardComponent
                  :card="getCardDetails(deckCard.cardId)"
                  :disable-modal="isSelectingFaceCard"
              />

              <!-- Star badge when selected as face -->
              <span
                  v-if="deckCard.cardId === deck.faceCardId"
                  class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-success"
                  title="Face card"
              >
                ★
                <span class="visually-hidden">Face card</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div> <!-- /deck detail -->
    <!-- Delete confirmation modal -->
    <div
        v-if="showDeleteModal"
        class="modal fade show"
        tabindex="-1"
        style="display: block;"
        aria-modal="true"
        role="dialog"
        aria-labelledby="deleteDeckLabel"
        @click.self="closeDeleteModal"
    >
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="deleteDeckLabel" class="modal-title">Delete this deck?</h5>
            <button type="button" class="btn-close" aria-label="Close" @click="closeDeleteModal"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">
              You’re about to delete <strong>{{ deck?.name }}</strong>. This action cannot be undone.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-secondary" :disabled="deleting" @click="closeDeleteModal">
              Cancel
            </button>
            <button class="btn btn-danger" :disabled="deleting" @click="confirmDelete">
          <span
              v-if="deleting"
              class="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
          ></span>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="showDeleteModal" class="modal-backdrop fade show"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import db from '../../../data/db';
import CardComponent from '../../../components/CardComponent.vue';

type Deck = {
  id: string;
  name: string;
  platform?: string;
  importedAt?: string | Date;
  faceCardId?: string;
};

type DeckCard = { id: string; deckId: string; cardId: string };
type Card = {
  id: string;
  name: string;
  set?: string;
  setCode?: string;
  imageUrl?: string;
  number?: string;
  lang?: string;
  finish?: string;
};

const route = useRoute();
const router = useRouter();

const deck = ref<Deck | null>(null);
const deckCards = ref<DeckCard[]>([]);
const cards = ref<Record<string, Card>>({});
const loading = ref(true);

const isEditingTitle = ref(false);
const editedTitle = ref('');
const titleInput = ref<HTMLInputElement | null>(null);

const isSelectingFaceCard = ref(false);

const showDeleteModal = ref(false);
const deleting = ref(false);


const placeholder = 'https://placehold.co/200x280?text=Card+Image';

const faceCard = computed<Card | null>(() => {
  if (!deck.value?.faceCardId) return null;
  return getCardDetails(deck.value.faceCardId);
});

const formatDate = (d?: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
};

const getCardDetails = (cardId: string): Card => {
  return (
      cards.value[cardId] || {
        id: cardId,
        name: 'Unknown Card',
        set: 'Unknown Set',
        setCode: '???',
        number: '???',
        lang: 'en',
        finish: 'nonfoil',
        imageUrl: placeholder
      }
  );
};

// Title editing
const startEditingTitle = () => {
  if (!deck.value) return;
  isEditingTitle.value = true;
  editedTitle.value = deck.value.name;
  nextTick(() => {
    titleInput.value?.focus();
    titleInput.value?.select();
  });
};

const saveTitle = async () => {
  if (!deck.value) { isEditingTitle.value = false; return; }
  const next = editedTitle.value.trim();
  if (!next || next === deck.value.name) { isEditingTitle.value = false; return; }

  try {
    await db.decks.update(deck.value.id, { name: next });
    deck.value.name = next;
  } catch (err) {
    console.error('Error updating deck title:', err);
    alert('Failed to update deck title. Please try again.');
  } finally {
    isEditingTitle.value = false;
  }
};

const cancelEditingTitle = () => {
  isEditingTitle.value = false;
  editedTitle.value = deck.value?.name ?? '';
};

// Face card selection
const toggleFaceCardSelection = () => {
  isSelectingFaceCard.value = !isSelectingFaceCard.value;
};

const handleFaceCardSelection = async (cardId: string) => {
  await selectFaceCard(cardId);
  isSelectingFaceCard.value = false;
};

const selectFaceCard = async (cardId: string) => {
  if (!deck.value) return;
  try {
    await db.decks.update(deck.value.id, { faceCardId: cardId });
    deck.value.faceCardId = cardId;
  } catch (err) {
    console.error('Error updating face card:', err);
    alert('Failed to update face card. Please try again.');
  }
};

const clearFaceCard = async () => {
  if (!deck.value) return;
  try {
    await db.decks.update(deck.value.id, { faceCardId: undefined });
    deck.value.faceCardId = undefined;
  } catch (err) {
    console.error('Error clearing face card:', err);
    alert('Failed to clear face card. Please try again.');
  }
};

// Modal handlers
const openDeleteModal = () => { showDeleteModal.value = true; };
const closeDeleteModal = () => { if (!deleting.value) showDeleteModal.value = false; };

// Replace the old deleteDeck() implementation with this confirm action
const confirmDelete = async () => {
  if (!deck.value || deleting.value) return;
  deleting.value = true;
  try {
    await db.deck_cards.where('deckId').equals(deck.value.id).delete();
    await db.decks.delete(deck.value.id);
    closeDeleteModal();
    router.push('/decks');
  } catch (err) {
    console.error('Error deleting deck:', err);
    alert('Failed to delete deck. Please try again.');
  } finally {
    deleting.value = false;
  }
};


// Data load
const loadDeck = async () => {
  try {
    const deckId = route.params.id as string;

    const deckData = await db.decks.get(deckId);
    if (!deckData) return;

    deck.value = deckData as Deck;
    editedTitle.value = deckData.name;

    const cardsInDeck = await db.deck_cards.where('deckId').equals(deckId).toArray();
    deckCards.value = cardsInDeck as DeckCard[];

    const cardIds = cardsInDeck.map(c => c.cardId).filter(Boolean);
    if (cardIds.length) {
      const details = await db.cards.where('id').anyOf(cardIds).toArray();
      cards.value = Object.fromEntries(details.map((c: Card) => [c.id, c]));
    }
  } catch (err) {
    console.error('Error loading deck:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(loadDeck);
</script>

<style scoped>
.editable { cursor: pointer; }
.cursor-pointer { cursor: pointer; }
</style>
