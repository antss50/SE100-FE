import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { USE_MOCK } from './lib/api-client'

async function bootstrap() {
  if (USE_MOCK) {
    const { installMockGlobals } = await import('./mocks')
    installMockGlobals()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void bootstrap()
