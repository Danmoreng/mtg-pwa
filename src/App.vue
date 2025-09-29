<script setup lang="ts">
import Navigation from './components/Navigation.vue';
import GlobalAlerts from "./components/GlobalAlerts.vue";
</script>

<template>
  <Navigation />
  <GlobalAlerts />
  <main class="container-lg" style="padding-top: calc(var(--app-navbar-h, 48px) + 1rem); padding-bottom: 1.5rem;">
    <router-view />
  </main>
</template>

<style scoped>
</style>
