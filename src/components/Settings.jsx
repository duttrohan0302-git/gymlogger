import { useState } from 'react'
import { ChevronLeft, Check, Loader, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../lib/store'
import { validateToken } from '../lib/github'
import { MUSCLE_COLORS } from '../data/defaultData'
import { localDate } from '../lib/store'
import SplitEditor from './SplitEditor'
import SplitDaysEditor from './SplitDaysEditor'

export default function Settings({ onBack, onSwitchUser }) {
  const { state, setConfig, dispatch } = useStore()
  const [token, setToken] = useState(state.token || '')
  const [repo, setRepo] = useState(state.repo || '')
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState(null) // null | 'checking' | 'ok' | string (error)
  const [importing, setImporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSplitEditor, setShowSplitEditor] = useState(false)
  const [showDaysEditor, setShowDaysEditor] = useState(false)

  const copySetupLink = () => {
    const base = window.location.origin + import.meta.env.BASE_URL
    const url = `${base}?r=${encodeURIComponent(state.repo)}&t=${encodeURIComponent(state.token)}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!token.trim() || !repo.trim()) {
      setStatus('Fill in both fields')
      return
    }
    setStatus('checking')
    try {
      await validateToken(token.trim(), repo.trim())
      setConfig(token.trim(), repo.trim())
      setStatus('ok')
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      setStatus(err.message)
    }
  }

  const activeUser = state.fullData.users?.find(u => u.id === state.activeUserId)

  const handleImportJSON = (e) => {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        if (Array.isArray(imported.users)) {
          // Full backup (all users)
          const n = imported.users.reduce((sum, u) => sum + (u.sessions?.length || 0), 0)
          if (confirm(`Replace ALL data with this backup?\n${imported.users.length} users, ${n} sessions. This overwrites everyone's data.`)) {
            dispatch({ type: 'REPLACE_ALL_DATA', data: imported })
            alert('Backup restored')
          }
        } else if (Array.isArray(imported.sessions)) {
          // Single-user / old-format file → only touches the current user
          if (confirm(`Replace ${activeUser?.name || 'your'}'s sessions with the ${imported.sessions.length} in this file? Other users are not affected.`)) {
            dispatch({ type: 'REPLACE_USER_DATA', data: imported })
            alert(`Imported ${imported.sessions.length} sessions`)
          }
        } else {
          alert('This file doesn\'t look like a GymLogger export')
        }
      } catch {
        alert('Invalid JSON file')
      }
      setImporting(false)
      input.value = '' // allow re-importing the same file
    }
    reader.readAsText(file)
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(state.fullData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gymlogger-backup-${localDate()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="text-gray-400 active:text-white">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        {/* GitHub sync */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-1">GitHub Sync</h2>
          <p className="text-xs text-gray-500 mb-4">
            Data is saved to <code className="text-brand">data/workouts.json</code> in your GitHub repo.
            Create a repo, then generate a Personal Access Token with <code className="text-brand">repo</code> scope.
          </p>

          <label className="block mb-3">
            <span className="text-xs text-gray-400 mb-1 block">Repository (owner/repo)</span>
            <input
              type="text"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="yourname/gymlogger"
              className="w-full bg-gray-900 text-white rounded-xl px-3 py-3 text-sm outline-none border border-gray-700 focus:border-brand"
            />
          </label>

          <label className="block mb-4">
            <span className="text-xs text-gray-400 mb-1 block">Personal Access Token</span>
            <div className="flex items-center bg-gray-900 rounded-xl border border-gray-700 focus-within:border-brand">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="ghp_…"
                className="flex-1 bg-transparent text-white px-3 py-3 text-sm outline-none"
              />
              <button onClick={() => setShowToken(v => !v)} className="px-3 text-gray-500">
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            onClick={handleSave}
            disabled={status === 'checking'}
            className="w-full bg-brand text-black font-semibold py-3.5 rounded-xl text-sm active:scale-95 transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === 'checking' ? (
              <><Loader size={16} className="animate-spin" /> Verifying…</>
            ) : status === 'ok' ? (
              <><Check size={16} /> Connected!</>
            ) : (
              'Save & Connect'
            )}
          </button>

          {status && status !== 'checking' && status !== 'ok' && (
            <p className="text-red-400 text-xs mt-2 text-center">{status}</p>
          )}

          {state.token && state.repo && (
            <button
              onClick={copySetupLink}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-700 text-sm text-gray-300 active:bg-gray-700 transition-colors"
            >
              {copied ? <><Check size={15} className="text-brand" /> Copied!</> : 'Copy setup link'}
            </button>
          )}
        </div>

        {/* Workout split */}
        {(() => {
          const activeSplit = state.data.splits?.find(s => s.isActive) || state.data.splits?.[0]
          return (
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Workout Split</h2>
                <div className="flex gap-4">
                  {activeSplit && (
                    <button onClick={() => setShowDaysEditor(true)} className="text-xs text-brand font-medium">
                      Edit days
                    </button>
                  )}
                  <button onClick={() => setShowSplitEditor(true)} className="text-xs text-gray-400 font-medium">
                    New from template
                  </button>
                </div>
              </div>
              {activeSplit ? (
                <div className="space-y-2">
                  {activeSplit.days.map(day => (
                    <div key={day.id} className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {day.muscleGroups.slice(0, 4).map(g => (
                          <span key={g} className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[g] }} />
                        ))}
                      </div>
                      <span className="text-sm text-gray-300">{day.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No split configured</p>
              )}
            </div>
          )
        })()}

        {/* Data management */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Data</h2>
          <div className="space-y-2">
            <button
              onClick={handleExportJSON}
              className="w-full text-left bg-gray-900 rounded-xl px-4 py-3 text-sm text-white active:bg-gray-700"
            >
              Export backup (all users)
            </button>
            <label className="block">
              <div className="w-full text-left bg-gray-900 rounded-xl px-4 py-3 text-sm text-white active:bg-gray-700 cursor-pointer">
                {importing ? 'Importing…' : 'Restore from backup…'}
              </div>
              <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Stats</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Sessions', state.data.sessions?.length || 0],
              ['Exercises', state.data.exercises?.length || 0],
              ['Body weights', state.data.bodyWeightLog?.length || 0],
            ].map(([label, val]) => (
              <div key={label} className="bg-gray-900 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">{val}</p>
                <p className="text-[11px] text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Users */}
        <div className="bg-gray-800 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Users</h2>
          <button
            onClick={onSwitchUser}
            className="w-full text-left bg-gray-900 rounded-xl px-4 py-3 text-sm text-white active:bg-gray-700"
          >
            Switch / Add User
          </button>
        </div>
      </div>
    </div>

    {showSplitEditor && <SplitEditor onClose={() => setShowSplitEditor(false)} />}
    {showDaysEditor && <SplitDaysEditor onClose={() => setShowDaysEditor(false)} />}
    </>
  )
}
