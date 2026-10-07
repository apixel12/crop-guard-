import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ModelProvider } from './hooks/useModels'
import { installNetworkGuard } from './utils/networkGuard'
import '@fontsource/public-sans/latin-400.css'
import '@fontsource/public-sans/latin-500.css'
import '@fontsource/public-sans/latin-600.css'
import '@fontsource/public-sans/latin-700.css'
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
