import { useState } from 'react'
import { ChevronLeft, Check, Loader, Eye, EyeOff } from 'lucide-react'
import { useStore } from '../lib/store'
import { validateToken } from '../lib/github'
import { EMPTY_DATA } from '../data/defaultData'

export default function Settings({ onBack }) {
  const { state, setConfig, dispatch } = useStore()
  const [token, setToken] = useState(state.token || '')
  const [repo, setRepo] = useState(state.repo || '')
  const [showToken, setShowToken] = useState(false)
  const [status, setStatus] = useState(null) // null | 'checking' | 'ok' | string (error)
  const [importing, setImporting] = useState(false)

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

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result)
        dispatch({ type: 'UPDATE_DATA', data: { ...EMPTY_DATA, ...imported } })
        alert(`Imported ${imported.sessions?.length || 0} sessions`)
      } catch {
        alert('Invalid JSON file')
      }
      setImporting(false)
    }
    reader.readAsText(file)
  }

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gymlogger-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
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
        </div>

        {/* Data management */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Data</h2>
          <div className="space-y-2">
            <button
              onClick={handleExportJSON}
              className="w-full text-left bg-gray-900 rounded-xl px-4 py-3 text-sm text-white active:bg-gray-700"
            >
              Export workouts.json
            </button>
            <label className="block">
              <div className="w-full text-left bg-gray-900 rounded-xl px-4 py-3 text-sm text-white active:bg-gray-700 cursor-pointer">
                {importing ? 'Importing…' : 'Import workouts.json'}
              </div>
              <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
            </label>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gray-800 rounded-2xl p-4">
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
      </div>
    </div>
  )
}
