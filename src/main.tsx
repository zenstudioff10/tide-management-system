import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// no StrictMode: a second mount would open a second WebGL context and a second
// hydrate against the same file
createRoot(document.getElementById('root')!).render(<App />)
