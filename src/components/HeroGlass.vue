<template>
  <div class="glass-hero" :class="{ 'glass-hero-accent': accent }">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
interface Props {
  accent?: boolean;
}

withDefaults(defineProps<Props>(), {
  accent: false
});
</script>

<style scoped>
.glass-hero {
  background: linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0.45));
  border: 1px solid rgba(255,255,255,0.7);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 14px 40px rgba(0,0,0,0.08);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)) contrast(var(--glass-con));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)) contrast(var(--glass-con));
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
}

[data-bs-theme="dark"] .glass-hero {
  background: linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0.08));
  border-color: rgba(255,255,255,0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 14px 40px rgba(0,0,0,0.5);
}

.glass-hero-accent {
  background: 
    linear-gradient(to bottom, rgba(255,255,255,0.75), rgba(255,255,255,0.45)),
    radial-gradient(120% 160% at 0% 0%, color-mix(in hsl, var(--bs-primary) 22%, transparent), transparent 60%);
}

[data-bs-theme="dark"] .glass-hero-accent {
  background: 
    linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0.08)),
    radial-gradient(120% 160% at 0% 0%, color-mix(in hsl, var(--bs-primary) 18%, transparent), transparent 60%);
}

.glass-hero::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent 12%, color-mix(in hsl, var(--bs-primary) 42%, transparent) 50%, transparent 88%) top / 100% 2px no-repeat,
    linear-gradient(90deg, transparent 12%, color-mix(in hsl, var(--bs-primary) 28%, transparent) 50%, transparent 88%) bottom / 100% 2px no-repeat;
}

[data-bs-theme="dark"] .glass-hero::after {
  background:
    linear-gradient(90deg, transparent 12%, color-mix(in hsl, var(--bs-primary) 55%, transparent) 50%, transparent 88%) top / 100% 2px no-repeat,
    linear-gradient(90deg, transparent 12%, color-mix(in hsl, var(--bs-primary) 40%, transparent) 50%, transparent 88%) bottom / 100% 2px no-repeat;
}
</style>