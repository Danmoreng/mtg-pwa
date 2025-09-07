<script setup lang="ts">
import Navigation from './components/Navigation.vue';
</script>

<template>
  <Navigation />
  <main class="container-lg" style="padding-top: calc(var(--app-navbar-h) + 1.5rem); padding-bottom: 1.5rem;">
    <router-view />
  </main>
</template>

<style scoped>
</style>
