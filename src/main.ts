import { createApp } from 'vue'
import './styles/main.scss'
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

// Initialize automatic price updates
async function initApp() {
  try {
    // Check if we need to update prices on app start
    await AutomaticPriceUpdateService.schedulePriceUpdate();
  } catch (error) {
    console.error('Error initializing automatic price updates:', error);
  }
  
  // Mount the app
  app.use(router).mount('#app');
}

// Initialize the app
initApp();
