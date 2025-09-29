<template>
  <div class="global-alerts">
    <transition-group name="alert" tag="div">
      <div
        v-for="alert in alertStore.alerts"
        :key="alert.id"
        class="alert"
        :class="`alert-${alert.type}`"
        role="alert"
      >
        <div class="d-flex justify-content-between">
          <div v-html="alert.message"></div>
          <button
            type="button"
            class="btn-close"
            @click="alertStore.removeAlert(alert.id)"
          ></button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useAlertStore } from '../stores/alerts';

const alertStore = useAlertStore();
</script>

<style scoped>
.global-alerts {
  position: fixed;
  top: calc(var(--app-navbar-h, 60px) + 1rem); /* Position below navbar */
  right: 1rem;
  width: 350px;
  max-width: calc(100% - 2rem);
  z-index: 1055; /* Higher than modal backdrop */
}

.alert-enter-active,
.alert-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.alert-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.alert-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
