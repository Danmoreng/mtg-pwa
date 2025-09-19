<template>
  <button
    type="button"
    class="btn-icon"
    @click="toggleTheme"
    :aria-label="`Switch to ${currentTheme === 'light' ? 'dark' : 'light'} mode`"
  >
    <span v-if="currentTheme === 'dark'" class="icon-sun">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
    </span>
    <span v-else class="icon-moon">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
    </span>
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