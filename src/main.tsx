import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ModelProvider } from './hooks/useModels'
import { installNetworkGuard } from './utils/networkGuard'
import './styles.css'

installNetworkGuard()
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <ModelProvider>
    <main className="app">
      <App />
    </main>
  </ModelProvider>,
)
