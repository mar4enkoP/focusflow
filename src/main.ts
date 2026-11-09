import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { startWorkspace } from './workspace'
import './assets/main.scss'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
const stopWorkspace = startWorkspace(pinia)
if (import.meta.hot) import.meta.hot.dispose(() => void stopWorkspace())

app.mount('#app')
