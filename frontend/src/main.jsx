import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode removed — it causes Supabase auth lock warnings due to double-mounting
createRoot(document.getElementById('root')).render(<App />)
