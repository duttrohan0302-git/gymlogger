import { Settings, CloudOff, Cloud, Loader } from 'lucide-react'
import { useStore } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function daysSince(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const diff = Date.now() - new Date(y, m - 1, d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function Home({ onStartSession, onNavigate }) {
  const { state } = useStore()
  const { data, syncing, error, token, repo } = state

  const activeSplit = data.splits?.find(s => s.isActive) || data.splits?.[0]
  const recentSessions = (data.sessions || []).slice(0, 3)

  // Last session per split day
  const lastByDay = {}
  for (const s of data.sessions || []) {
    for (const day of activeSplit?.days || []) {
      if (!lastByDay[day.id] && day.muscleGroups.every(g => s.muscleGroups?.includes(g))) {
        lastByDay[day.id] = s.date
      }
    }
  }

  const isConfigured = !!(token && repo)

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GymLogger</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {syncing ? (
              <><Loader size={12} className="text-brand animate-spin" /><span className="text-xs text-gray-400">Saving…</span></>
            ) : isConfigured ? (
              <><Cloud size={12} className="text-brand" /><span className="text-xs text-gray-400">Synced</span></>
            ) : (
              <><CloudOff size={12} className="text-yellow-500" /><span className="text-xs text-yellow-500">Not connected</span></>
            )}
          </div>
        </div>
        <button
          onClick={() => onNavigate('settings')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 text-gray-400 active:bg-gray-700"
        >
          <Settings size={20} />
        </button>
      </div>

      {error && (
        <div className="mx-4 mb-4 p-3 rounded-lg bg-red-900/40 border border-red-800">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!isConfigured && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-yellow-900/30 border border-yellow-800">
          <p className="text-sm text-yellow-300 font-medium mb-1">Connect to GitHub</p>
          <p className="text-xs text-yellow-400/80">Go to Settings to save your data to GitHub.</p>
          <button
            onClick={() => onNavigate('settings')}
            className="mt-2 text-xs text-yellow-300 underline"
          >
            Open Settings →
          </button>
        </div>
      )}

      {/* Split days */}
      <div className="px-4 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Start Workout</h2>
        <div className="grid grid-cols-2 gap-3">
          {(activeSplit?.days || []).map(day => (
            <button
              key={day.id}
              onClick={() => onStartSession(day)}
              className="relative bg-gray-800 rounded-2xl p-4 text-left active:scale-95 transition-transform border border-gray-700"
            >
              <div className="flex gap-1 mb-2">
                {day.muscleGroups.map(g => (
                  <span
                    key={g}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: MUSCLE_COLORS[g] }}
                  />
                ))}
              </div>
              <p className="text-sm font-semibold text-white leading-tight">{day.name}</p>
              {lastByDay[day.id] && (
                <p className="text-[11px] text-gray-500 mt-1">{daysSince(lastByDay[day.id])}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="px-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent</h2>
          <div className="space-y-2">
            {recentSessions.map(session => {
              const groups = session.muscleGroups || []
              const exCount = session.exercises?.length || 0
              return (
                <div key={session.id} className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {groups.map(g => MUSCLE_LABELS[g]).join(' + ')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(session.date)} · {exCount} exercises
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {groups.map(g => (
                      <span key={g} className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[g] }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.sessions?.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-gray-600 text-sm">No sessions yet. Start your first workout above.</p>
        </div>
      )}
    </div>
  )
}
