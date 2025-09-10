<template>
  <nav class="navbar navbar-expand-md navbar-light bg-body fixed-top border-bottom">
    <div class="container-fluid">
      <router-link to="/" class="navbar-brand">
        <img style="max-width: 40px;" src="/src/assets/icon.svg" alt="logo">
        MTG Collection Tracker
      </router-link>
      <button class="navbar-toggler" type="button" @click="isOpen = !isOpen" aria-controls="navbarNav"
              :aria-expanded="isOpen" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div id="navbarNav" class="collapse navbar-collapse" :class="{ show: isOpen }">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <router-link to="/" class="nav-link" :class="{ active: route.name === 'home' }">
              Dashboard
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/decks" class="nav-link" :class="{ active: isDecksRoute }">
              Decks
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/cards" class="nav-link" :class="{ active: route.name === 'cards' }">
              Cards
            </router-link>
          </li>
          <li class="nav-item">
            <router-link to="/import/cardmarket" class="nav-link" :class="{ active: route.name === 'cardmarket-import' }">
              Cardmarket Import
            </router-link>
          </li>
        </ul>
        <div class="d-flex align-items-center">
          <ImportStatusIndicator />
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import ThemeSwitcher from './ThemeSwitcher.vue';
import ImportStatusIndicator from './ImportStatusIndicator.vue';

// Route
const route = useRoute();

// Check if current route is related to decks
const isDecksRoute = computed(() => {
  return route.name === 'decks' || route.name === 'deck-detail' || route.name === 'deck-import';
});

// Navbar toggle state
const isOpen = ref(false);
</script>

<style scoped>
/* Fix for navbar fixed positioning being overridden by .navbar's position: relative */
.navbar.fixed-top {
  position: fixed !important;
}
</style>