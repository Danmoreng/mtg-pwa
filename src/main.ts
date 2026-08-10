import { createApp } from 'vue'
import './styles/index.scss'
import App from './App.vue'
import router from './app/router'
import { createPinia } from 'pinia'
import { AutomaticPriceUpdateService } from './features/pricing/AutomaticPriceUpdateService'
import { registerSW } from 'virtual:pwa-register'
import { dbPromise } from './data/init'

// Avoid SW registration issues in Vite dev server and keep local dev deterministic.
if (import.meta.env.PROD) {
  registerSW({
      immediate: true,
      onRegistered(r) { console.log('SW registered', r) },
      onRegisterError(e) { console.error('SW registration error', e) },
  })
}

const app = createApp(App)

// Install Pinia for state management
const pinia = createPinia()
app.use(pinia)

// Initialize automatic price updates in the background (non-blocking)
async function initApp() {
  // The V2 database is a deliberate fresh baseline. Initialization must never
  // silently delete data; failures are surfaced instead.
  await dbPromise;
  
  // Mount the app
  app.use(router).mount('#app');
  
  // Schedule price updates in the background after app is mounted
  try {
    // Add a small delay to ensure UI is ready
    setTimeout(async () => {
      await AutomaticPriceUpdateService.schedulePriceUpdate();
    }, 1000);
  } catch (error) {
    console.error('Error initializing automatic price updates:', error instanceof Error ? error : new Error(String(error)));
  }
}

// Initialize the app
initApp();
