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


# Second half, ChatGPT review after first implementation

Here’s a thorough repo review of the Bootstrap + Reka UI integration, what’s working, what’s breaking (e.g., your fixed navbar), and a concrete migration plan with exact code changes.

# What’s already in good shape

* You switched the global entry to Sass: `src/main.ts` now imports `./styles/main.scss`. ✔️&#x20;
* You created a curated Bootstrap partials file and a runtime theme bridge (`bootstrap-theme.css`). ✔️ &#x20;
* Your navigation now uses Bootstrap classes (`navbar navbar-expand-md … fixed-top …`). ✔️&#x20;

# Key issues & how to fix them

## 1) Why the navbar isn’t “fixed”

**Root cause:** the `.fixed-top` helper class doesn’t exist in your compiled CSS because the Bootstrap **helpers** partial isn’t imported. (You currently import `reboot`, `type`, `containers`, `grid`, `utilities`, and some components, but **not** `helpers`.)&#x20;

### Fix

Add helpers to your Sass partials:

```diff
// src/styles/bootstrap/_partials.scss

 // Base & utilities
 @import "bootstrap/scss/reboot";
 @import "bootstrap/scss/type";
 @import "bootstrap/scss/containers";
 @import "bootstrap/scss/grid";
 @import "bootstrap/scss/utilities";
+@import "bootstrap/scss/helpers";       // ← gives you .fixed-top, .sticky-top, etc.

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

Also add top padding so content isn’t hidden under the fixed bar. You currently work around with a `.pt-5` on a wrapper; set it globally instead:

```scss
/* src/styles/main.scss – after your imports */
:root { --app-navbar-h: 56px; } /* tweak as needed */
body { padding-top: calc(var(--app-navbar-h) + 0.5rem); }
```

(Your current `App.vue` version shows an inner wrapper with `pt-5`; make this global and remove the duplicate inner `#app` id, see next section.)&#x20;

## 2) Duplicate `#app` and layout responsibilities

In `App.vue` there’s a version with an inner `div id="app"` and manual padding/centering that conflicts with Bootstrap’s container utilities. Remove the **duplicate** `id="app"` and let Bootstrap handle spacing/layout. &#x20;

### Fix (suggested `App.vue` shell)

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import Navigation from './components/Navigation.vue'
</script>

<template>
  <Navigation />
  <main class="container-lg py-4">
    <router-view />
  </main>
</template>

<style scoped></style>
```

Also drop the old global centering/padding in `src/style.css` that fights the new layout (it still sets `#app` width/padding).&#x20;

## 3) Navbar toggler relies on Bootstrap JS (which you didn’t enable)

Your nav uses `data-bs-toggle="collapse"` and `data-bs-target="#navbarNav"`. That requires Bootstrap’s JS bundle (and Popper) to be loaded globally—or you need to control the collapse in Vue/Reka. Right now there’s no Bootstrap JS initialization, so the toggler won’t work on mobile.&#x20;

### Option A — Keep it “headless” (no Bootstrap JS)

Control the collapsed state with Vue and just add/remove the `show` class:

```vue
<!-- src/components/Navigation.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute()
const isOpen = ref(false)
const isDecksRoute = computed(() => ['decks','deck-detail','deck-import'].includes(String(route.name)))
</script>

<template>
  <nav class="navbar navbar-expand-md navbar-light bg-body fixed-top border-bottom">
    <div class="container-fluid">
      <router-link to="/" class="navbar-brand">MTG Tracker</router-link>

      <button class="navbar-toggler" type="button" @click="isOpen = !isOpen" aria-controls="navbarNav"
              :aria-expanded="isOpen" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <div id="navbarNav" class="collapse navbar-collapse" :class="{ show: isOpen }">
        <ul class="navbar-nav">
          <li class="nav-item">
            <router-link to="/" class="nav-link" :class="{ active: route.name === 'home' }">Dashboard</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/decks" class="nav-link" :class="{ active: isDecksRoute }">Decks</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/cards" class="nav-link" :class="{ active: route.name === 'cards' }">Cards</router-link>
          </li>
          <li class="nav-item">
            <router-link to="/import/cardmarket" class="nav-link" :class="{ active: route.name === 'cardmarket-import' }">
              Cardmarket Import
            </router-link>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
```

### Option B — Enable Bootstrap JS

Install `@popperjs/core` and import Bootstrap’s JS once (e.g., in `main.ts`). This is heavier than A and you already use Reka UI, so I suggest sticking to Option A. (Your guide earlier mentioned Popper as optional).&#x20;

## 4) `_variables.scss` contains **CSS variables**, not Sass variables

Your `src/styles/bootstrap/_variables.scss` currently declares a `:root { … }` block of CSS variables. That’s fine for theming—but it **doesn’t** configure Bootstrap’s Sass options (which must use `$something` variables before importing Bootstrap). Move the `:root` block into `bootstrap-theme.css` (that’s the file already meant for runtime CSS vars), and keep `_variables.scss` minimal or set true Sass options there if needed. &#x20;

> TL;DR keep **runtime** color mapping in `bootstrap-theme.css`; keep `_variables.scss` for **compile-time** options (typography, radii, enabling features), or leave it mostly empty.

## 5) Lots of custom component CSS still overrides Bootstrap’s look

Many components and views still use bespoke classes and token-based styles (`.lots-list`, `.transaction-item`, `.card-details-section`, `.text-input`, etc.). These will always “feel” off-theme until mapped to Bootstrap **components** and **utilities**.  &#x20;

### What to migrate next (priority order)

1. **Cards**
   `CardComponent.vue` uses custom `.card-component`, `.card-image`, `.card-info` etc. Replace with Bootstrap’s `.card`, `.card-img-top`, `.card-body`, `.card-title`, `.card-text`.&#x20;
   **Example skeleton:**

   ```vue
   <div class="card h-100" @click="openModal">
     <img :src="card.imageUrl || fallback" :alt="card.name" class="card-img-top" @error="handleImageError" />
     <div class="card-body">
       <h5 class="card-title">{{ card.name }}</h5>
       <p class="card-text text-body-secondary">{{ card.set }} #{{ card.collectorNumber }}</p>
       <!-- ownership chips → use .badge bg-success / bg-danger / etc. -->
     </div>
   </div>
   ```

2. **Forms** (imports, deck builder, search)
   Replace custom inputs/labels with `.form-label`, `.form-control`, `.form-text`, `.input-group`, and use grid for layout. Your `DeckImportView.vue` currently uses a custom `.text-input`.&#x20;
   **Example:**

   ```vue
   <div class="mb-3">
     <label for="deck-name" class="form-label">Deck Name</label>
     <input id="deck-name" v-model="deckName" type="text" class="form-control" placeholder="Enter a name" />
     <div class="form-text">This helps you find your deck later.</div>
   </div>
   ```

3. **Lists, summaries & “chips”**
   Replace `.lots-list` and `.transaction-item` with `.list-group` / `.list-group-item` and badges (`.badge bg-success|danger|warning`). Use `row`/`col` utilities for the grid-like sections.&#x20;

4. **Detail sections**
   `.card-details-section`, `.metadata-item`, etc. → use `.row g-3` + `.col` and `.table` where appropriate. Border lines can be done with `.border-bottom` and spacing utilities.&#x20;

5. **Buttons**
   Remove token-styled `button` rules in `src/style.css` and standardize on `.btn`, `.btn-primary|secondary|outline-*`. (Those global `button` rules override Bootstrap’s look.)&#x20;

6. **Typography & spacing**
   Replace custom font-size/spacing tokens in components with Bootstrap utilities (`.fs-6`, `.fw-semibold`, `.text-body-secondary`, `mb-3`, `py-2`, etc.). This drastically reduces custom CSS and unifies the look.

## 6) Demo component looks good—keep it as reference

`BootstrapRekaDemo.vue` correctly composes Reka primitives with Bootstrap classes for dropdowns and modals; use it as a pattern while migrating other interactive bits.&#x20;

---

# Concrete patch list (copy/paste to your agent)

1. **Enable helpers** (fixes `.fixed-top`):

```diff
// src/styles/bootstrap/_partials.scss
- @import "bootstrap/scss/utilities";
+ @import "bootstrap/scss/utilities";
+ @import "bootstrap/scss/helpers";
```



2. **Global body padding for fixed nav**:

```diff
/* src/styles/main.scss */
 @import "../style.css";
 @import "./bootstrap-theme.css";
 @import "./bootstrap/_partials.scss";

+:root { --app-navbar-h: 56px; }
+body { padding-top: calc(var(--app-navbar-h) + 0.5rem); }
```

3. **Clean `App.vue` shell** (remove inner `#app`, rely on Bootstrap container):

```diff
-<template>
-  <div>
-    <Navigation />
-    <div id="app" class="pt-5">
-      <div class="container-lg">
-        <router-view />
-      </div>
-    </div>
-  </div>
-</template>
+<template>
+  <Navigation />
+  <main class="container-lg py-4">
+    <router-view />
+  </main>
+</template>
```



4. **Navbar toggler without Bootstrap JS**:

* Replace `data-bs-toggle` approach with the Vue-controlled version shown above.&#x20;

5. **Normalize theming files**:

* Move any `:root { --color-... }` blocks from `_variables.scss` into `bootstrap-theme.css`. Keep `_variables.scss` for Sass-only options.&#x20;

6. **Purge custom global `button`/`#app` rules** from `src/style.css` that clash with Bootstrap. Keep tokens import; defer layout/spacing to Bootstrap utilities. &#x20;

7. **Component-by-component migration (examples)**:

* `CardComponent.vue` → Bootstrap `.card` structure.&#x20;
* `DeckImportView.vue`, `CsvImportView.vue` → `.form-label`, `.form-control`, grid.&#x20;
* Replace list sections (`.lots-list`, `.transactions-list`) with `.list-group`.&#x20;

---

# Quick audit checklist (run & verify)

* [ ] Navbar stays fixed and spans full width (helpers imported)
* [ ] Body has top padding; content no longer hidden under nav
* [ ] Mobile nav toggles open/closed without Bootstrap JS
* [ ] No duplicate `#app` and no global center/padding fighting Bootstrap
* [ ] Buttons look Bootstrap-y everywhere (no global `button` overrides)
* [ ] Forms use `.form-control` & `.form-label` consistently
* [ ] Cards/lists/tables replaced with Bootstrap components/utilities
* [ ] Theme colors flow through `bootstrap-theme.css` and look consistent in light/dark
* [ ] Build still OK (`npm run build && npm run preview`)&#x20;

If you want, I can generate a patch (git diff) that performs items 1–6 automatically and a search-and-replace plan for the components.&#x20;


Short answer: your approach is right. Keep **Bootstrap for styling (classes/Sass)** and use **Reka-UI for the behavior & accessibility**. Don’t bring in Bootstrap’s JS unless you have a very specific reason. Here’s the decision rule I recommend:

## What to use where

**Use plain Bootstrap classes only** for:

* Layout & spacing: `.container`, `.row`, `.col-*`, `gap-*`, `p*/m*`.
* Typography & colors: `.fw-*`, `.text-*`, `.bg-*`.
* Presentational components: `.card`, `.badge`, `.alert`, `.table`, `.list-group`, `.btn`, `.form-control`, `.form-label`.

**Use Reka-UI + Bootstrap classes** for anything interactive (behavior, focus, ARIA):

* **Dialog/modals** → `Dialog*` + Bootstrap’s modal markup/classes.
* **Menus / dropdowns** → `DropdownMenu*` + `.dropdown-menu`, `.dropdown-item`.
* **Popover/tooltip/hovercard** → `Popover*` / `Tooltip*` styled with Bootstrap variables.
* **Accordion/Collapsible, Tabs, Select, Switch, Toast** → Reka primitives styled with Bootstrap.
* **Navbar collapse** → manage open/close with Vue state or Reka `Collapsible*`; **don’t** use `data-bs-*` (that expects Bootstrap JS).

**Avoid mixing Bootstrap JS** with Reka-UI: it duplicates behavior, breaks focus management, and hurts bundle size.

---

## Why this is the “clean” combo

* **Accessibility & keyboard support**: Reka gives you correct roles, focus trapping, typeahead, etc., out of the box.
* **Styling consistency**: Bootstrap Sass + your token bridge keeps color/spacing/typography unified via classes and CSS variables.
* **No double state**: Vue + Reka control state; you’re not fighting Bootstrap’s data attributes and DOM mutation.

---

## Practical patterns (quick recipes)

**1) Navbar (collapse without Bootstrap JS)**

* Keep `.navbar`, `.navbar-expand-*`, `.fixed-top`.
* Toggle a `show` class on the collapse container with Vue/Ref **or** use Reka `CollapsibleRoot/Trigger/Content`.
* Ensure `helpers` partial is imported so `.fixed-top` exists.
* Add `body { padding-top: 56px; }` (or compute via CSS var) to keep content from hiding under the bar.

**2) Dialog**

* `DialogRoot` / `DialogTrigger` / `DialogContent` for behavior.
* Inside, use Bootstrap’s modal structure: `.modal`, `.modal-dialog`, `.modal-content`, `.modal-header`, `.modal-body`, `.modal-footer`.
* Style overlay with `.modal-backdrop` class (or a tiny custom class that matches Bootstrap’s look).

**3) Dropdown menu**

* `DropdownMenuRoot/Trigger/Content/Item` for behavior.
* Add `.dropdown-menu show` to the content, `.dropdown-item` to items; use Bootstrap utilities for paddings/width.

**4) Forms**

* Use `.form-label`, `.form-control`, `.form-check`, `.input-group` classes everywhere.
* Reka components (e.g., `Select`, `Checkbox`, `Switch`) get those classes for consistent appearance; keep behavior from Reka.

---

## Do / Don’t checklist for a consistent codebase

**Do**

* Import Bootstrap’s **helpers** partial so classes like `.fixed-top` and `.sticky-top` exist.
* Keep **all interactivity** on Reka (or plain Vue) and **remove** `data-bs-toggle/target` attributes.
* Map your tokens → Bootstrap CSS vars at runtime (your `bootstrap-theme.css`).
* Replace custom global `button`/`input` styles with Bootstrap’s utility/classes.
* Convert custom components to Bootstrap structures (e.g., cards/lists/tables) to reduce bespoke CSS.

**Don’t**

* Don’t import Bootstrap JS bundle unless strictly needed (e.g., Carousel you decide not to rebuild with Reka).
* Don’t place Bootstrap variable overrides inside scoped component styles—keep them global.
* Don’t keep duplicate layout wrappers (`#app` sizing, custom paddings) that fight `.container` and spacing utilities.

---

## TL;DR

* **Yes**: it’s correct to use Bootstrap classes plainly for visuals.
* **Best practice**: pair those classes with **Reka-UI** primitives for anything interactive.
* **Avoid** Bootstrap JS when using Reka—stick to one behavior system to keep accessibility solid and the app consistent.
