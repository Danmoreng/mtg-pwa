import { createApp } from 'vue'
import './styles/index.scss'
import App from './App.vue'
import router from './app/router'
import { createPinia } from 'pinia'
import { AutomaticPriceUpdateService } from './features/pricing/AutomaticPriceUpdateService'
import { registerSW } from 'virtual:pwa-register'

registerSW({
    immediate: true,
    onRegistered(r) { console.log('SW registered', r) },
    onRegisterError(e) { console.error('SW registration error', e) },
})

const app = createApp(App)

// Install Pinia for state management
const pinia = createPinia()
app.use(pinia)

// Initialize automatic price updates in the background (non-blocking)
async function initApp() {
  // Mount the app immediately without waiting for price updates
  app.use(router).mount('#app');
  
  // Schedule price updates in the background after app is mounted
  try {
    // Add a small delay to ensure UI is ready
    setTimeout(async () => {
      await AutomaticPriceUpdateService.schedulePriceUpdate();
    }, 1000);
  } catch (error) {
    console.error('Error initializing automatic price updates:', error);
  }
}

// Initialize the app
initApp();
