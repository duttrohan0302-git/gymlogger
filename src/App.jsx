import { useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import BottomNav from './components/BottomNav'
import Home from './components/Home'
import LogSession from './components/LogSession'
import Progress from './components/Progress'
import History from './components/History'
import Settings from './components/Settings'
import { MUSCLE_COLORS } from './data/defaultData'

function DayPicker({ onSelect }) {
  const { state } = useStore()
  const activeSplit = state.data.splits?.find(s => s.isActive) || state.data.splits?.[0]

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-1">Log Workout</h1>
        <p className="text-sm text-gray-500 mb-6">Pick today's session</p>
        <div className="space-y-3">
          {(activeSplit?.days || []).map(day => (
            <button
              key={day.id}
              onClick={() => onSelect(day)}
              className="w-full flex items-center gap-4 bg-gray-800 rounded-2xl px-5 py-4 text-left active:scale-95 transition-transform border border-gray-700"
            >
              <div className="flex gap-1.5">
                {day.muscleGroups.map(g => (
                  <span key={g} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[g] }} />
                ))}
              </div>
              <span className="text-base font-semibold text-white">{day.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

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
    if (s !== 'log') setActiveSplitDay(null)
  }

  const startSession = (splitDay) => {
    setActiveSplitDay(splitDay)
    setScreen('log')
  }

  return (
    <div className="max-w-md mx-auto relative">
      {screen === 'home' && <Home onStartSession={startSession} onNavigate={navigate} />}

      {screen === 'log' && !activeSplitDay && <DayPicker onSelect={startSession} />}
      {screen === 'log' && activeSplitDay && (
        <LogSession
          splitDay={activeSplitDay}
          onDone={() => navigate('home')}
          onBack={() => { setActiveSplitDay(null) }}
        />
      )}

      {screen === 'progress' && <Progress />}
      {screen === 'history' && <History />}
      {screen === 'settings' && <Settings onBack={() => navigate('home')} />}

      {!(screen === 'log' && activeSplitDay) && (
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
