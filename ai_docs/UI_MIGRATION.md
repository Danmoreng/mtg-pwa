Here’s a comprehensive, step-by-step implementation guide to add **Bootstrap 5 (Sass)** and **Reka UI** to your Vue 3 PWA MTG app. It’s tailored to your repo’s current layout and build (Vite + Vue 3 + TypeScript + PWA), and includes concrete file paths, code, and change steps your Qwen agent can execute.

> Context from your repo this guide relies on:
>
> * Global CSS is imported from `src/main.ts` via `./style.css`.&#x20;
> * `src/style.css` currently imports your design tokens from `src/ui/tokens.css`.&#x20;
> * Build uses Vite; PWA is configured in `vite.config.ts`.&#x20;

---

# Bootstrap 5 (Sass) + Reka UI Integration Guide (Vue 3 + Vite)

## 0) Goals

* Add **Bootstrap 5 Sass** so you can:

  * Customize Bootstrap variables at build time and only include the parts you need.
  * Keep your existing design tokens and map them to Bootstrap CSS variables.
* Add **Reka UI** (the renamed Radix Vue primitives) for accessible, headless components (dialogs, menus, popovers, etc.) with auto-imports in Vite. ([GitHub][1], [reka-ui.com][2])

---

## 1) Install packages

Run in project root:

```bash
# Core UI libs
npm i bootstrap reka-ui

# Build-time Sass compiler
npm i -D sass

# Auto-import Reka UI components in Vue SFCs
npm i -D unplugin-vue-components
```

* `reka-ui` is the official rename of Radix Vue; it exposes Vue headless primitives. ([GitHub][1], [reka-ui.com][2])
* `unplugin-vue-components` + `RekaResolver` auto-imports Reka components so you don’t have to write manual imports. ([reka-ui.com][3])

> Optional (only if you plan to use Bootstrap JS behaviors instead of Reka UI for some parts):
> `npm i @popperjs/core` (Bootstrap’s JS tooltips/dropdowns depend on it). If you stick to Reka UI behaviors, you can skip Bootstrap JS entirely.

---

## 2) Add project structure for styles

Create a new folder:

```
src/styles/
  main.scss                 # entry for all global styles (replaces direct import of style.css)
  bootstrap/_variables.scss # your Bootstrap Sass variable overrides (compile-time)
  bootstrap/_partials.scss  # curated imports from Bootstrap to keep bundle small
  bootstrap-theme.css       # runtime CSS variable bridge from your tokens -> Bootstrap CSS vars
```

### 2.1 `src/styles/bootstrap/_variables.scss`

> Use this to set Bootstrap **Sass** options before importing Bootstrap. Keep it minimal; prefer runtime CSS variables (next section) for color theming so tokens continue to drive the UI.

```scss
// src/styles/bootstrap/_variables.scss

// Enable CSS variables generation for many Bootstrap tokens.
$enable-csscustom-properties: true;

// Typography & radius (compile-time examples)
$font-family-sans-serif: system-ui, -apple-system, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
$border-radius: .375rem; // match your --radius-md
$border-radius-lg: .5rem;
$border-radius-sm: .25rem;

// Spacing scale (optional – Bootstrap has its own; keep default unless you need parity)
```

> **Why not set colors here?** Sass variables are resolved at build time; your tokens are **CSS variables**. To keep a single source of truth and allow runtime theming, map your tokens to Bootstrap’s **CSS vars** instead (next file).

### 2.2 `src/styles/bootstrap-theme.css`

> This bridges your existing tokens (e.g. `--color-primary`) to Bootstrap 5’s runtime CSS variables like `--bs-primary`, `--bs-body-bg`, etc. Bootstrap 5.3+ ships many CSS vars used by components; overriding them keeps your token system intact.

```css
/* src/styles/bootstrap-theme.css */

:root {
  /* Brand & state colors */
  --bs-primary: var(--color-primary);
  --bs-secondary: var(--color-secondary);
  --bs-success: var(--color-success);
  --bs-warning: var(--color-warning);
  --bs-danger: var(--color-error);

  /* Base surfaces & text */
  --bs-body-bg: var(--color-background);
  --bs-body-color: var(--color-text);

  /* Borders & shadows (optional) */
  --bs-border-color: var(--color-border);
}

/* Optional: dark theme hook
html[data-bs-theme='dark'] {
  --bs-body-bg: #0b1220;
  --bs-body-color: #e5e7eb;
  --bs-primary: #60a5fa;
} */
```

Your current tokens live in `src/ui/tokens.css`; keep them as your single design source.&#x20;

### 2.3 `src/styles/bootstrap/_partials.scss`

> Import only what you need from Bootstrap to reduce CSS size.

```scss
// src/styles/bootstrap/_partials.scss

// Order matters: functions → variables → maps → mixins → root → reboot → utilities → components
@import "bootstrap/scss/functions";
@import "./variables";              // your overrides before Bootstrap variables
@import "bootstrap/scss/variables";
@import "bootstrap/scss/maps";
@import "bootstrap/scss/mixins";
@import "bootstrap/scss/root";

// Base & utilities
@import "bootstrap/scss/reboot";
@import "bootstrap/scss/type";
@import "bootstrap/scss/containers";
@import "bootstrap/scss/grid";
@import "bootstrap/scss/utilities";

// Components you actually want
@import "bootstrap/scss/buttons";
@import "bootstrap/scss/forms";
@import "bootstrap/scss/dropdown";
@import "bootstrap/scss/nav";
@import "bootstrap/scss/navbar";
@import "bootstrap/scss/modal";
@import "bootstrap/scss/alert";

// Generate utility classes
@import "bootstrap/scss/utilities/api";
```

### 2.4 `src/styles/main.scss`

> This becomes your single global stylesheet. It **imports your current CSS** and tokens first, then adds Bootstrap and the theme bridge.

```scss
/* src/styles/main.scss */

/* 1) Keep your existing base CSS (it imports tokens.css) */
@import "../style.css";     /* style.css → imports ./ui/tokens.css */ /* ← do not delete that file yet */

/* 2) Map tokens to Bootstrap runtime variables */
@import "./bootstrap-theme.css";

/* 3) Bootstrap (curated partials) */
@import "./bootstrap/_partials.scss";

/* 4) App-wide additions or overrides (optional)
:root {
  /* example: tighten headings if you want */
  /* --bs-heading-color: var(--color-text); */
}
```

> `src/style.css` currently imports `./ui/tokens.css`. Keep that intact for now and let `main.scss` include it.&#x20;

---

## 3) Wire styles into the app

Update `src/main.ts` to import the new `main.scss` (and remove the direct `./style.css` import since it’s now pulled in by `main.scss`):

```diff
// src/main.ts
-import './style.css'
+import './styles/main.scss'
```

This file is where your global styles are currently imported.&#x20;

> No Vite config change is required for Sass beyond installing `sass`. Vite detects `.scss` and compiles it.

---

## 4) Enable Reka UI auto-imports in Vite

Add the components plugin with the Reka resolver. Edit `vite.config.ts`:

```diff
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
+import Components from 'unplugin-vue-components/vite'
+import RekaResolver from 'reka-ui/resolver'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
+   Components({
+     dts: true,              // generates components.d.ts for TS IntelliSense
+     resolvers: [RekaResolver()],
+   }),
    VitePWA({
      // ...your existing PWA config
    }),
  ],
  // ...rest of config
})
```

The `RekaResolver()` setup is per the official docs. ([reka-ui.com][3])

---

## 5) Use Bootstrap classes + Reka UI behaviors (examples)

Reka UI provides **unstyled, accessible** behavior. You style with Bootstrap classes. For example, a dropdown menu:

```vue
<!-- Example: Dropdown using Reka + Bootstrap styles -->
<script setup lang="ts">
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem } from 'reka-ui'
// With the Vite resolver, you can omit these imports if you prefer auto-imports.
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <button type="button" class="btn btn-primary">
        Actions
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent class="dropdown-menu show p-1">
        <DropdownMenuItem class="dropdown-item">Edit</DropdownMenuItem>
        <DropdownMenuItem class="dropdown-item">Duplicate</DropdownMenuItem>
        <DropdownMenuItem class="dropdown-item text-danger">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
/* Optional: tweak Bootstrap menu sizing in your component */
.dropdown-menu { min-width: 12rem; }
</style>
```

A modal dialog with Bootstrap styles:

```vue
<script setup lang="ts">
import { DialogRoot, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose } from 'reka-ui'
</script>

<template>
  <DialogRoot>
    <DialogTrigger as-child>
      <button class="btn btn-outline-primary">Open dialog</button>
    </DialogTrigger>

    <DialogPortal>
      <DialogOverlay class="modal-backdrop fade show"></DialogOverlay>

      <DialogContent class="modal d-block" role="dialog">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <DialogTitle class="modal-title">Confirm</DialogTitle>
              <DialogClose as-child>
                <button class="btn-close" aria-label="Close"></button>
              </DialogClose>
            </div>
            <div class="modal-body">
              Use Bootstrap structure and spacing utilities here.
            </div>
            <div class="modal-footer">
              <DialogClose as-child><button class="btn btn-secondary">Cancel</button></DialogClose>
              <button class="btn btn-primary">Continue</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
```

> Reka UI install & migration docs (for confirmation/advanced options): ([reka-ui.com][2])

---

## 6) Apply Bootstrap globally, keep component styles “scoped” safely

* Your components sometimes use `<style scoped>`. That’s fine—Bootstrap classes still work because they’re global classes, while your scoped rules get attribute-scoped by Vue. (Don’t place Bootstrap **variable overrides** inside scoped blocks; keep them global in `main.scss`.)

---

## 7) Optional: Theming & dark mode

* Bootstrap 5.3+ supports theming by toggling `data-bs-theme` on `html`/`body`. Combine with your tokens:

```ts
// e.g., in a store or a theme toggle composable
document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light')
```

* Add a dark token block in `bootstrap-theme.css` (see commented snippet) to keep Bootstrap in lockstep with your tokens.

---

## 8) Keep CSS lean

* You already split imports with `_partials.scss`. Remove any Bootstrap component imports you won’t use to keep CSS small.
* If you later need more components (e.g., `accordion`, `tabs`), add their partials in `_partials.scss`.

---

## 9) Update navigation/layout to use Bootstrap utilities (incrementally)

Your `App.vue` renders a `Navigation` component and a `<main>` area.&#x20;
You can progressively enhance layout with Bootstrap grid/spacing utilities without rewriting components:

```vue
<!-- App.vue (template excerpt) -->
<template>
  <div id="app" class="container-lg py-3">
    <Navigation />
    <main class="py-4">
      <router-view />
    </main>
  </div>
</template>
```

(Your current `#app` and `main` padding are in component-scoped CSS; replace with Bootstrap utilities as you migrate.)&#x20;

---

## 10) Verify PWA build still works

Your PWA is configured via `vite-plugin-pwa` in `vite.config.ts`. Run a full build to ensure CSS paths are emitted into `docs/` as before:

```bash
npm run build
npm run preview
```

The PWA build config and output dir are already set (`docs/`).&#x20;

---

## 11) Commit plan (Qwen-friendly tasks)

1. **Add dependencies** (Section 1).
2. **Create style files** (Section 2):

   * `src/styles/main.scss`
   * `src/styles/bootstrap/_variables.scss`
   * `src/styles/bootstrap/_partials.scss`
   * `src/styles/bootstrap-theme.css`
3. **Switch entry stylesheet** in `src/main.ts` to `./styles/main.scss`.&#x20;
4. **Configure Reka auto-imports** in `vite.config.ts` with `Components({ resolvers: [RekaResolver()] })`. ([reka-ui.com][3])
5. **Smoke-test**: use the sample Reka UI dropdown or dialog in any page (e.g., your `Navigation` or a view) and style with Bootstrap classes.
6. **Build & preview**: ensure no regressions in PWA output (`docs/`) and that CSS is applied.

---

## 12) FAQ / Gotchas

* **Can I keep only Bootstrap utilities (no components)?** Yes—remove component partials from `_partials.scss` and keep `reboot`, `type`, `grid`, and `utilities` + `utilities/api`.
* **Will Bootstrap styles fight with my tokens?** No—your tokens remain the source of truth; `bootstrap-theme.css` maps them to Bootstrap’s CSS variables at runtime.
* **Why Reka UI if Bootstrap has JS?** Reka UI primitives are **headless + accessible**, idiomatic for Vue, and you avoid pulling in Bootstrap’s JavaScript. You style them with Bootstrap classes.

---

## 13) References

* Reka UI (formerly Radix Vue) – **install & auto-import resolver**. ([reka-ui.com][3])
* **Rename/migration** information confirming Reka UI is the successor to Radix Vue. ([GitHub][1], [reka-ui.com][2])
* Your repo’s **global CSS import** and **tokens** locations used by this guide.&#x20;
* Your repo’s **main.ts** entry and PWA/Vite configuration. &#x20;

---

### Done.

If you want, I can also generate the exact PR as a patch (new files + diffs) so your Qwen agent can apply it directly.

[1]: https://github.com/unovue/reka-ui?utm_source=chatgpt.com "GitHub - unovue/reka-ui: An open-source UI component library for ..."
[2]: https://reka-ui.com/docs/guides/migration?utm_source=chatgpt.com "Migration - Radix Vue to Reka UI"
[3]: https://reka-ui.com/docs/overview/installation?utm_source=chatgpt.com "Installation | Reka UI"
