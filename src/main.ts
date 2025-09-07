import { createApp } from 'vue'
import './styles/main.scss'
import App from './App.vue'
import router from './app/router'
import { createPinia } from 'pinia'

const app = createApp(App)

// Install Pinia for state management
const pinia = createPinia()
app.use(pinia)

app.use(router).mount('#app')
