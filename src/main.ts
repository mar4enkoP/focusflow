import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { installPersistence } from './persistence'
import './assets/main.scss'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
installPersistence(pinia)

app.mount('#app')
