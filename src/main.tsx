import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ModelProvider } from './hooks/useModels'
import { installNetworkGuard } from './utils/networkGuard'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/chivo-mono/latin-400.css'
import '@fontsource/chivo-mono/latin-600.css'
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
