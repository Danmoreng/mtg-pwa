<template>
  <div class="data-import-view">
    <h1>Data Import</h1>
    <p>Import your collection and price data from various sources.</p>

    <ul class="nav nav-tabs">
      <li class="nav-item">
        <router-link to="/import/cardmarket" class="nav-link" active-class="active">
          Cardmarket CSV
        </router-link>
      </li>
      <li class="nav-item">
        <router-link to="/import/mtgjson" class="nav-link" active-class="active">
          MTGJSON Prices
        </router-link>
      </li>
      <li class="nav-item">
        <router-link to="/import/price-guide" class="nav-link" active-class="active">
          Cardmarket Price Guide
        </router-link>
      </li>
      <li class="nav-item">
        <router-link to="/import/manabox" class="nav-link" active-class="active">
          ManaBox Scans
        </router-link>
      </li>
    </ul>

    <div class="tab-content pt-3">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
// No script needed for this layout component
</script>

<style scoped>
.data-import-view {
  padding: var(--space-lg);
  max-width: 1000px;
  margin: 0 auto;
}
</style>
