<template>
  <nav class="navbar navbar-expand-md navbar-light bg-body fixed-top border-bottom">
    <div class="container-fluid">
      <router-link to="/" class="navbar-brand">
        MTG Tracker
      </router-link>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" 
              aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav">
          <li class="nav-item">
            <router-link to="/" class="nav-link" :class="{ active: $route.name === 'home' }">
              Dashboard
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/decks" class="nav-link" :class="{ active: isDecksRoute }">
              Decks
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/cards" class="nav-link" :class="{ active: $route.name === 'cards' }">
              Cards
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/import/cardmarket" class="nav-link" :class="{ active: $route.name === 'cardmarket-import' }">
              Cardmarket Import
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

// Route
const route = useRoute();

// Check if current route is related to decks
const isDecksRoute = computed(() => {
  return route.name === 'decks' || route.name === 'deck-detail' || route.name === 'deck-import';
});
</script>

<style scoped>
</style>