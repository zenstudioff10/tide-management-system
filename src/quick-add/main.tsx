import { createRoot } from 'react-dom/client'
import '../index.css'
import './quick-add.css'
import { QuickAddWindow } from './QuickAddWindow'

createRoot(document.getElementById('root')!).render(<QuickAddWindow />)
