import { useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import BottomNav from './components/BottomNav'
import Home from './components/Home'
import LogSession from './components/LogSession'
import Progress from './components/Progress'
import History from './components/History'
import Settings from './components/Settings'

function AppInner() {
  const { state } = useStore()
  const [screen, setScreen] = useState('home')
  const [activeSplitDay, setActiveSplitDay] = useState(null)

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  const navigate = (s) => {
    setScreen(s)
    setActiveSplitDay(null)
  }

  const startSession = (splitDay) => {
    setActiveSplitDay(splitDay)
    setScreen('log')
  }

  return (
    <div className="max-w-md mx-auto relative">
      {screen === 'home' && (
        <Home onStartSession={startSession} onNavigate={navigate} />
      )}
      {screen === 'log' && activeSplitDay && (
        <LogSession
          splitDay={activeSplitDay}
          onDone={() => navigate('home')}
          onBack={() => navigate('home')}
        />
      )}
      {screen === 'log' && !activeSplitDay && (
        // Landed on log tab without a day selected — show day picker
        <Home onStartSession={startSession} onNavigate={navigate} />
      )}
      {screen === 'progress' && <Progress />}
      {screen === 'history' && <History />}
      {screen === 'settings' && <Settings onBack={() => navigate('home')} />}

      {screen !== 'log' && (
        <BottomNav screen={screen} onNavigate={navigate} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}
