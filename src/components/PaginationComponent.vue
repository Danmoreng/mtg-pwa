<template>
  <nav v-if="totalPages > 1" class="pagination-controls">
    <ul class="pagination justify-content-center">
      <li class="page-item" :class="{ disabled: currentPage === 1 }">
        <a class="page-link" href="#" @click.prevent="goToPage(currentPage - 1)">Previous</a>
      </li>
      
      <li 
        v-for="page in visiblePages" 
        :key="page" 
        class="page-item" 
        :class="{ active: page === currentPage }"
      >
        <a class="page-link" href="#" @click.prevent="goToPage(page)">{{ page }}</a>
      </li>
      
      <li class="page-item" :class="{ disabled: currentPage === totalPages }">
        <a class="page-link" href="#" @click.prevent="goToPage(currentPage + 1)">Next</a>
      </li>
    </ul>
    
    <div class="pagination-info text-center mt-2">
      Showing {{ startIndex + 1 }}-{{ Math.min(endIndex, totalItems) }} of {{ totalItems }} items
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  maxVisiblePages?: number;
}>();

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void;
}>();

const totalPages = computed(() => Math.ceil(props.totalItems / props.itemsPerPage));

const maxVisiblePages = computed(() => props.maxVisiblePages || 5);

const visiblePages = computed(() => {
  const pages = [];
  const half = Math.floor(maxVisiblePages.value / 2);
  
  let start = Math.max(1, props.currentPage - half);
  let end = Math.min(totalPages.value, start + maxVisiblePages.value - 1);
  
  // Adjust start if we're near the end
  if (end - start + 1 < maxVisiblePages.value) {
    start = Math.max(1, end - maxVisiblePages.value + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});

const startIndex = computed(() => (props.currentPage - 1) * props.itemsPerPage);
const endIndex = computed(() => props.currentPage * props.itemsPerPage);

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value && page !== props.currentPage) {
    emit('update:currentPage', page);
  }
};
</script>

<style scoped>
.pagination-controls {
  margin-top: var(--space-lg);
}

.pagination {
  margin-bottom: 0;
}

.page-link {
  color: var(--color-primary);
}

.page-item.active .page-link {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.page-item.disabled .page-link {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.pagination-info {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>