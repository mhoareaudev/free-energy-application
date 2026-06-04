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
import AssistantAdmin from './pages/AssistantAdmin'
import Calendrier from './pages/Calendrier'
import AssistantChat from './components/AssistantChat'
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
  const [showAdminPanel,    setShowAdminPanel]    = useState(false)
  const [showAssistant,     setShowAssistant]     = useState(false)
  const [assistantMessages, setAssistantMessages] = useState([
    { role: 'assistant', text: 'Bonjour ! Je suis l\'assistant Free Energy. Posez-moi une question sur l\'application 😊' }
  ])
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
            onOpenAssistant={() => setShowAssistant(p => !p)}
          />

          {showAssistant && (
            <AssistantChat
              onClose={() => setShowAssistant(false)}
              messages={assistantMessages}
              setMessages={setAssistantMessages}
            />
          )}

          <div className="app-main">
            <TopBar onOpenAssistant={() => setShowAssistant(p => !p)} />

            <div className="app-content">
              {activePage === 'dashboard' && <Dashboard onNavigate={setActivePage} />}

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
              {activePage === 'calendrier'       && <Calendrier />}
              {activePage === 'mailing'         && <Mailing />}
              {activePage === 'assistant-admin' && <AssistantAdmin />}
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
