import { createRoot } from 'react-dom/client'
import { isTauri } from '@tauri-apps/api/core'
import './index.css'
import App from './App'

// the hidden title bar's traffic lights only exist in the desktop window.
// The web build reserves no corner for them.
if (isTauri()) document.documentElement.dataset.tauri = ''

// no StrictMode: a second mount would open a second WebGL context and a second
// hydrate against the same file
createRoot(document.getElementById('root')!).render(<App />)
