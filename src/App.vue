<script setup lang="ts">
// App shell logic will be added here
import Navigation from './components/Navigation.vue';
</script>

<template>
  <div>
    <Navigation />
    <div id="app" class="pt-5">
      <div class="container-lg">
        <router-view />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
