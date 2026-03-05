import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminAIAssistant from './admin-ai-assistant.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminAIAssistant />
  </StrictMode>
)