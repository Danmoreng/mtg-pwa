<template>
  <!-- This component now redirects to the new wizard -->
  <div class="redirect-message">
    <p>Redirecting to the new ManaBox Import Wizard...</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(() => {
  // Redirect to the new wizard
  router.push('/import/manabox');
});
</script>

<style scoped>
.redirect-message {
  padding: var(--space-lg);
  text-align: center;
}
</style>
</template>