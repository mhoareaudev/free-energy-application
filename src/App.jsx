import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SpreadsheetProvider } from './context/SpreadsheetContext'
import { NotificationProvider } from './context/NotificationContext'
import TopBar from './components/TopBar'
import MenuBar from './components/MenuBar'
import StyleBar from './components/StyleBar'
import FormulaBar from './components/FormulaBar'
import Spreadsheet from './components/Spreadsheet'
import SheetTabs from './components/SheetTabs'
import VTRequestModal from './components/VTRequestModal'
import AdminPanel from './components/AdminPanel'
import Login from './pages/Login'
import './styles/global.css'
import './App.css'

function AppContent() {
  const { user, loading } = useAuth()
  const [showVTModal, setShowVTModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // Show loading state
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Chargement...</p>
      </div>
    )
  }

  // Require authentication
  if (!user) return <Login />

  return (
    <NotificationProvider>
    <SpreadsheetProvider>
      <div className="app">
        <TopBar
          onRequestVT={() => setShowVTModal(true)}
          onOpenAdmin={() => setShowAdminPanel(true)}
        />
        <MenuBar />
        <StyleBar />
        <FormulaBar />
        <Spreadsheet />
        <SheetTabs />

        <VTRequestModal
          isOpen={showVTModal}
          onClose={() => setShowVTModal(false)}
        />

        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
        />
      </div>
    </SpreadsheetProvider>
    </NotificationProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
