import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from './app/providers'
import { Toaster } from './components/ui/Toast'
import { AppRoutes } from './routes/AppRoutes'

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
        <Toaster />
      </BrowserRouter>
    </AppProviders>
  )
}

export default App
