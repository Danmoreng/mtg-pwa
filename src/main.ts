import { createApp } from 'vue'
import './styles/main.scss'
import App from './App.vue'
import router from './app/router'
import { createPinia } from 'pinia'
import Dexie from 'dexie'
import { AutomaticPriceUpdateService } from './features/pricing/AutomaticPriceUpdateService'
import { registerSW } from 'virtual:pwa-register'
import { dbPromise } from './data/init'

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
  try {
    // Wait for the database to initialize
    await dbPromise;
  } catch (error) {
    // If there's an upgrade error related to schema changes, try deleting the database and recreating it
    if (error instanceof Error && error.name === 'UpgradeError' && error.message.includes('Not yet support for changing primary key')) {
      console.warn('Database schema error detected. Attempting to recreate database...');
      
      // Delete the existing database
      await Dexie.delete('MtgTrackerDb');
      
      // Reinitialize the database
      await dbPromise;
    } else {
      throw error; // Re-throw if it's a different error
    }
  }
  
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
