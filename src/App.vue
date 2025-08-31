<script setup lang="ts">
// App shell logic will be added here
import Navigation from './components/Navigation.vue';
</script>

<template>
  <div id="app">
    <Navigation />
    <main>
      <router-view />
    </main>
  </div>
</template>

<style scoped>
#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0;
  text-align: center;
}

main {
  padding: var(--space-lg);
}
</style>
