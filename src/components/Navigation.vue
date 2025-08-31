<template>
  <nav class="main-nav">
    <div class="nav-container">
      <router-link to="/" class="nav-logo">
        MTG Tracker
      </router-link>
      <ul class="nav-links">
        <li>
          <router-link to="/" class="nav-link" :class="{ active: $route.name === 'home' }">
            Dashboard
          </router-link>
        </li>
        <li>
          <router-link to="/decks" class="nav-link" :class="{ active: isDecksRoute }">
            Decks
          </router-link>
        </li>
        <li>
          <router-link to="/cards" class="nav-link" :class="{ active: $route.name === 'cards' }">
            Cards
          </router-link>
        </li>
        <li>
          <router-link to="/import/csv" class="nav-link" :class="{ active: $route.name === 'csv-import' }">
            Import CSV
          </router-link>
        </li>
      </ul>
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
.main-nav {
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-lg);
}

.nav-logo {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  text-decoration: none;
  padding: var(--space-md) 0;
}

.nav-links {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--space-md);
}

.nav-link {
  display: block;
  padding: var(--space-md) var(--space-sm);
  text-decoration: none;
  color: var(--color-text);
  border-radius: var(--radius-md);
  transition: background-color 0.2s;
}

.nav-link:hover {
  background: var(--color-background);
}

.nav-link.active {
  background: var(--color-primary);
  color: white;
}
</style>