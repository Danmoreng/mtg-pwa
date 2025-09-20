<template>
  <div class="noise-overlay" aria-hidden="true"></div>
</template>

<script setup lang="ts">
// Noise overlay component for adding subtle texture to glass surfaces
</script>

<style scoped>
.noise-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -40;
  opacity: 0.25;
  mix-blend-mode: soft-light;
  background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><filter id="n" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%25" height="100%25" filter="url(%23n)" opacity="0.9"/></svg>');
}
</style>