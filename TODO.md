# UI Overhaul TODO

This document outlines the plan for overhauling the application's UI. The goal is to simplify the visual components, improve usability, and fix layout issues while retaining a clean, modern aesthetic.

## 1. Global Alert System (DONE)

**Problem:** Alerts were coupled with the `ImportStatusIndicator` component and appeared incorrectly within the navbar. They were not reusable for other application events.

**Solution:** A new, decoupled global alert system was implemented.
- **Created `src/stores/alerts.ts`:** A dedicated Pinia store to manage a global list of alerts (`success`, `danger`, `info`, etc.).
- **Created `src/components/GlobalAlerts.vue`:** A new component that renders alerts from the store. It is positioned correctly in the top-right corner, below the navbar.
- **Integrated into `App.vue`:** The `<GlobalAlerts />` component was added to the main `App.vue` layout, making it available on all pages.
- **Refactored `ImportStatusIndicator.vue`:** The component no longer handles alert rendering. It now only displays the import progress bar and uses the `useAlertStore` to dispatch a notification when an import completes or fails.

## 2. Navbar Simplification

**Problem:** The navbar feels too large, and the "bubble" hover effect is overly complex and potentially distracting.

**Solution:**
- **Reduce Height:**
  - In `src/styles/_glass.scss`, decrease the `--bs-navbar-padding-y` value for `.navbar.glass`.
  - In `src/styles/_components.scss`, reduce the `--app-navbar-h` variable for `.navbar .nav-link`.
- **Simplify Hover/Active State:**
  - **Remove the bubble:** Delete the `.nav-bubble` div from `src/components/Navigation.vue`.
  - **Remove bubble logic:** Delete the associated JavaScript logic (`moveBubbleTo`, `snapToActive`, `hover`, `ResizeObserver`, etc.) from the `<script>` section of `Navigation.vue`.
  - **Remove bubble CSS:** Delete the `.nav-bubble` and related styles from `src/styles/_components.scss`.
  - **Implement a simpler indicator:** Use a simple background color, a border-bottom, or a change in font weight for the `.nav-link.active` and `.nav-link:hover` states. This can be done with a few lines of CSS.

## 3. Modal Dialog Redesign

**Problem:** The glass effect on the modal content is distracting. The content itself should be clear and legible.

**Solution:**
- **Apply Glass to Backdrop:**
  - Remove the `.glass` class from `.modal-content` where it is used.
  - Apply the glass effect to the modal backdrop (`.modal-backdrop`). Bootstrap's default modal backdrop has a class, and we can target it.
  - In a global stylesheet (like `_components.scss`), add:
    ```scss
    .modal-backdrop {
      @include glass-surface(rgb(var(--glass-bg-soft)));
      // Override default opacity if needed
      --bs-backdrop-opacity: 1;
    }
    ```
- **Ensure Solid Modal Content:**
  - Make sure `.modal-content` has a solid background color (e.g., `var(--bs-body-bg)` or a card background color).
  - Remove the custom glass-related styles from `.modal-content.glass` in `src/styles/_components.scss`.

## 4. Glass Button Simplification

**Problem:** The CSS for `.btn-glass` is excessively complex, using multiple pseudo-elements and advanced CSS features that are hard to maintain.

**Solution:**
- **Define a simpler style:** Create a new, simpler `.btn-glass` style that relies on a single background, a simple border, and a subtle `box-shadow`.
- **Replace the existing CSS:** In `src/styles/_components.scss`, replace the entire "Neon Glass Buttons" section with the simplified version.
- **New Style Definition (Example):**
  ```scss
  .btn-glass {
    @include glass-surface(rgb(var(--glass-bg-soft)));
    border: 1px solid rgba(var(--glass-border-light));
    color: var(--bs-body-color);
    transition: background-color 0.2s ease, transform 0.2s ease;

    &:hover {
      background-color: rgba(var(--glass-border-light), 0.5);
      transform: translateY(-1px);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }
  ```
- **Keep color variants:** The existing system for generating color variants (`.btn-glass-primary`, etc.) can be adapted to modify the `border-color` or add a subtle `background-color` tint in the new, simpler design.

## Implementation Order

1.  **Alerts:** Start here, as it's a clear bug fix.
2.  **Navbar:** Simplify the navbar next, as it sets the stage for the overall look.
3.  **Buttons & Modals:** Tackle these two component redesigns. They can be done in any order.
4.  **Review:** Do a final pass to ensure all changes are consistent and visually coherent.
