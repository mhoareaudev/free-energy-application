import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SpreadsheetProvider } from './context/SpreadsheetContext'
import { NotificationProvider } from './context/NotificationContext'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import StyleBar from './components/StyleBar'
import FormulaBar from './components/FormulaBar'
import Spreadsheet from './components/Spreadsheet'
import SheetTabs from './components/SheetTabs'
import VTRequestModal from './components/VTRequestModal'
import AdminPanel from './components/AdminPanel'
import NomenclatureStock from './components/NomenclatureStock'
import Tickets from './pages/Tickets'
import Dashboard from './pages/Dashboard'
import Mailing from './pages/Mailing'
import Contacts from './pages/dossiers/Contacts'
import Entreprises from './pages/dossiers/Entreprises'
import Transactions from './pages/dossiers/Transactions'
import Login from './pages/Login'
import './styles/global.css'
import './App.css'

function AppContent() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [showVTModal, setShowVTModal] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [activePage, setActivePage] = useState(
    () => location.state?.activePage || 'dashboard'
  )

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Chargement...</p>
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <NotificationProvider>
      <SpreadsheetProvider>
        <div className="app-layout">
          <Sidebar
            activePage={activePage}
            setActivePage={setActivePage}
            onOpenAdmin={() => setShowAdminPanel(true)}
          />

          <div className="app-main">
            <TopBar />

            <div className="app-content">
              {activePage === 'dashboard' && <Dashboard />}

              {activePage === 'contacts'         && <Contacts />}
              {activePage === 'entreprises'      && <Entreprises />}
              {activePage === 'transactions' && <Transactions />}

              {activePage === 'dossiers' && (
                <div className="dossiers-page">
                  <StyleBar />
                  <FormulaBar />
                  <Spreadsheet />
                  <SheetTabs />
                </div>
              )}

              {activePage === 'nomenclatures' && <NomenclatureStock />}
              {activePage === 'tickets'       && <Tickets />}
              {activePage === 'mailing'       && <Mailing />}
            </div>
          </div>
        </div>

        <VTRequestModal
          isOpen={showVTModal}
          onClose={() => setShowVTModal(false)}
        />
        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
        />
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
