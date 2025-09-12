<template>
  <button 
    type="button"
    :class="currentTheme === 'light' ? 'rounded-4 btn btn-outline-dark' : 'rounded-4 btn btn-outline-light'"
    @click="toggleTheme"
    :aria-label="`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`"
  >
    <span v-if="currentTheme === 'light'">🌑</span>
    <span v-else>☀️</span>
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// Reactive state for current theme
const currentTheme = ref<'light' | 'dark'>('light');

// Toggle theme function
const toggleTheme = () => {
  const newTheme = currentTheme.value === 'light' ? 'dark' : 'light';
  currentTheme.value = newTheme;
  // Set both data-theme and data-bs-theme for compatibility
  document.documentElement.setAttribute('data-theme', newTheme);
  document.documentElement.setAttribute('data-bs-theme', newTheme);
  localStorage.setItem('theme', newTheme);
};

// Initialize theme on component mount
onMounted(() => {
  // Check for saved theme in localStorage
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  
  // Check for system preference if no saved theme
  const systemPrefersDark = window.matchMedia && 
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Determine initial theme
  let initialTheme: 'light' | 'dark' = 'light';
  if (savedTheme) {
    initialTheme = savedTheme;
  } else if (systemPrefersDark) {
    initialTheme = 'dark';
  }
  
  // Apply theme
  currentTheme.value = initialTheme;
  // Set both data-theme and data-bs-theme for compatibility
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.setAttribute('data-bs-theme', initialTheme);
});
</script>

<style scoped>
/* We're using Bootstrap classes, so minimal custom styling needed */
</style>