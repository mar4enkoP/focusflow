import { shallowRef, type App } from 'vue'

export function createErrorRecovery() {
  const failure = shallowRef(false)
  const attempts = shallowRef(0)
  function report(error: unknown, context: string) {
    // One report per failure screen prevents cascading render/unmount errors from
    // creating log floods. No telemetry or user snapshots leave this device.
    if (failure.value) return
    failure.value = true
    console.error('[FocusFlow] ' + context, error)
  }
  function retry() {
    if (!failure.value || attempts.value >= 2) return
    attempts.value += 1
    failure.value = false
  }
  function install(app: App, target: Window = window) {
    const previous = app.config.errorHandler
    app.config.errorHandler = (error, _instance, info) => report(error, 'Vue: ' + info)
    const rejection = (event: PromiseRejectionEvent) => {
      report(event.reason, 'Unhandled promise rejection')
      event.preventDefault() // Handled visibly and logged above.
    }
    const runtime = (event: ErrorEvent) => report(event.error ?? event.message, 'Browser error')
    target.addEventListener('unhandledrejection', rejection)
    target.addEventListener('error', runtime)
    return () => {
      app.config.errorHandler = previous
      target.removeEventListener('unhandledrejection', rejection)
      target.removeEventListener('error', runtime)
    }
  }
  return { failure, attempts, report, retry, install }
}
export type ErrorRecovery = ReturnType<typeof createErrorRecovery>
