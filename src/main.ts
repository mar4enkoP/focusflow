import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Root from './Root.vue'
import { createErrorRecovery } from './errorRecovery'
import { startWorkspace } from './workspace'
import './assets/main.scss'

const recovery = createErrorRecovery()
const app = createApp(Root, { recovery })
const stopErrors = recovery.install(app)

const pinia = createPinia()
app.use(pinia)
let stopWorkspace: (() => Promise<void>) | undefined
try {
  stopWorkspace = startWorkspace(pinia)
} catch (error) {
  recovery.report(error, 'Workspace startup failed')
}
let disposed = false
function dispose() {
  if (disposed) return
  disposed = true
  stopErrors()
  void stopWorkspace?.()
}
app.onUnmount(dispose)
if (import.meta.hot) import.meta.hot.dispose(dispose)

app.mount('#app')
