import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import PipelineConfig from './pages/PipelineConfig.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/pipeline"   element={<PipelineConfig />} />
        <Route path="/membres"    element={<PipelineConfig />} />
        <Route path="/marketing"  element={<PipelineConfig />} />
        <Route path="/*"        element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
