<template>
  <nav class="navbar navbar-expand-md navbar-light glass fixed-top">
    <div class="container-fluid">
      <router-link to="/" class="navbar-brand">
        <img style="max-width: 48px;" src="/icons/icon-256.png" alt="logo">
        MTG Collection Tracker
      </router-link>

      <button class="navbar-toggler" type="button" @click="toggle" aria-controls="navbarNav"
              :aria-expanded="isOpen" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div id="navbarNav" class="collapse navbar-collapse" :class="{ show: isOpen }">
        <ul class="navbar-nav me-auto" ref="navList" @mouseleave="snapToActive">
          <!-- Moving glass bubble (under links) -->
          <div class="nav-bubble" ref="bubble" aria-hidden="true"></div>

          <li class="nav-item">
            <router-link to="/" class="nav-link" :class="{ active: route.name === 'home' }"
                         @mouseenter="hover" @focusin="hover">Dashboard</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/decks" class="nav-link" :class="{ active: isDecksRoute }"
                         @mouseenter="hover" @focusin="hover">Decks</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/cards" class="nav-link" :class="{ active: route.name === 'cards' }"
                         @mouseenter="hover" @focusin="hover">Cards</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/import" class="nav-link" :class="{ active: route.path.startsWith('/import') }"
                         @mouseenter="hover" @focusin="hover">Data Import</router-link>
          </li>
        </ul>

        <div class="d-flex align-items-center">
          <ImportStatusIndicator />
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import ThemeSwitcher from './ThemeSwitcher.vue';
import ImportStatusIndicator from './ImportStatusIndicator.vue';

const route = useRoute();
const isDecksRoute = computed(() => route.name === 'decks' || route.name === 'deck-detail' || route.name === 'deck-import');
const isOpen = ref(false);
const toggle = () => { isOpen.value = !isOpen.value; };

const navList = ref<HTMLElement | null>(null);
const bubble = ref<HTMLElement | null>(null);
let ro: ResizeObserver | null = null;

function moveBubbleTo(el: HTMLElement) {
  const list = navList.value, bub = bubble.value; if (!list || !bub || !el) return;
  const listRect = list.getBoundingClientRect();
  const r = el.getBoundingClientRect();

  // Size: pill slightly larger than the link
  const padX = 12; // breathing room
  const height = Math.max(32, Math.round(r.height * 0.72));
  const width  = Math.max(r.width + padX * 2, 80);

  const x = (r.left - listRect.left) + list.scrollLeft - padX;
  const y = (r.top  - listRect.top)  + list.scrollTop + (r.height - height) / 2;

  bub.style.setProperty('--_x', `${x}px`);
  bub.style.setProperty('--_y', `${y}px`);
  bub.style.setProperty('--_w', `${width}px`);
  bub.style.setProperty('--_h', `${height}px`);
  bub.style.opacity = '1';

  // Tint from the hovered/active link color (fallback to Bootstrap primary)
  const accent = getComputedStyle(el).color || getComputedStyle(document.documentElement).getPropertyValue('--bs-primary') || '#0d6efd';
  bub.style.setProperty('--nav-accent', accent.trim());
}

function getActiveLink(): HTMLElement | null {
  return navList.value?.querySelector('.nav-link.active') as HTMLElement | null;
}

function snapToActive() {
  const el = getActiveLink();
  if (el) moveBubbleTo(el);
}

function hover(e: Event) {
  const link = (e.currentTarget as HTMLElement);
  if (link) moveBubbleTo(link);
}

function setupResizeObserver() {
  if (!navList.value) return;
  ro = new ResizeObserver(() => snapToActive());
  ro.observe(navList.value);
  window.addEventListener('resize', snapToActive, { passive: true });
}

onMounted(async () => {
  await nextTick();
  const el = getActiveLink() || (navList.value?.querySelector('.nav-link') as HTMLElement | null);
  if (el) moveBubbleTo(el);
  setupResizeObserver();
});

onBeforeUnmount(() => {
  if (ro && navList.value) ro.unobserve(navList.value);
  window.removeEventListener('resize', snapToActive);
});

watch(() => route.fullPath, () => nextTick().then(snapToActive));
watch(isOpen, () => nextTick().then(snapToActive));
</script>