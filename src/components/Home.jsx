import { useMemo, useState } from 'react'
import { Settings, CloudOff, Cloud, Loader, AlertCircle, ChevronRight, ChevronDown, StickyNote, Pencil, Check } from 'lucide-react'
import { useStore, loadDraft, listDrafts, clearDraft } from '../lib/store'
import { matchDay, sessionLabel, sessionGroups, exerciseMap } from '../lib/sessions'
import { MUSCLE_COLORS } from '../data/defaultData'

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

export default function Home({ onStartSession, onNavigate, onEditSession }) {
  const { state, dispatch, sync } = useStore()
  const { data, syncing, error, token, repo } = state
  const pending = state.rev > state.syncedRev

  const activeSplit = data.splits?.find(s => s.isActive) || data.splits?.[0]
  const days = activeSplit?.days || []
  const exById = useMemo(() => exerciseMap(data.exercises), [data.exercises])
  const recentSessions = (data.sessions || []).slice(0, 3)

  // Last session per split day, matched on what was actually trained
  const lastByDay = useMemo(() => {
    const out = {}
    for (const s of data.sessions || []) {
      const day = matchDay(s, days, exById)
      if (day && !out[day.id]) out[day.id] = s.date
    }
    return out
  }, [data.sessions, days, exById])

  const isConfigured = !!(token && repo)

  // Unfinished workouts (autosaved drafts) — shown until finished or discarded
  const [draftsVersion, setDraftsVersion] = useState(0)
  const drafts = useMemo(() => listDrafts(state.activeUserId), [state.activeUserId, draftsVersion])
  const draftDay = d => days.find(x => x.id === d.dayId) || d.splitDay
  const discardDraft = d => {
    const name = draftDay(d)?.name || 'workout'
    if (!confirm(`Discard your unfinished ${name}? It will be lost.`)) return
    clearDraft(state.activeUserId, d.dayId)
    setDraftsVersion(v => v + 1)
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">GymLogger</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {syncing ? (
              <><Loader size={12} className="text-brand animate-spin" /><span className="text-xs text-gray-400">Saving…</span></>
            ) : isConfigured && (pending || error) ? (
              <button onClick={sync} className="flex items-center gap-1.5">
                <AlertCircle size={12} className="text-yellow-500" />
                <span className="text-xs text-yellow-500">Not synced · tap to retry</span>
              </button>
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
          <div className="flex gap-4 mt-2">
            {isConfigured && <button onClick={sync} className="text-xs text-red-300 font-semibold">Retry</button>}
            <button onClick={() => dispatch({ type: 'CLEAR_ERROR' })} className="text-xs text-red-400/70">Dismiss</button>
          </div>
        </div>
      )}

      {drafts.map(d => {
        const day = draftDay(d)
        const sets = (d.draft || []).reduce((n, e) => n + e.sets.filter(s => s.weight != null || s.reps != null).length, 0)
        return (
          <div key={d.dayId} className="mx-4 mb-4 p-4 rounded-2xl bg-brand/10 border border-brand/40">
            <p className="text-sm font-semibold text-white">Unfinished {day?.name || 'workout'}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {d.sessionDate ? formatDate(d.sessionDate) : ''}{d.sessionDate ? ' · ' : ''}{(d.draft || []).length} exercises · {sets} sets — not saved yet
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => day && onStartSession(day)}
                disabled={!day}
                className="flex-1 bg-brand text-black text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-40"
              >
                Resume &amp; finish
              </button>
              <button
                onClick={() => discardDraft(d)}
                className="px-4 text-sm text-gray-400 border border-gray-700 rounded-xl active:bg-gray-800"
              >
                Discard
              </button>
            </div>
          </div>
        )
      })}

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
          {days.map(day => {
            const inProgress = !!loadDraft(state.activeUserId, day.id)
            return (
            <button
              key={day.id}
              onClick={() => onStartSession(day)}
              className={`relative bg-gray-800 rounded-2xl p-4 text-left active:scale-95 transition-transform border ${inProgress ? 'border-brand/60' : 'border-gray-700'}`}
            >
              {inProgress && (
                <span className="absolute top-3 right-3 text-[10px] font-semibold text-brand uppercase tracking-wide">
                  In progress
                </span>
              )}
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
              <p className="text-[11px] text-gray-500 mt-1">
                {lastByDay[day.id] ? daysSince(lastByDay[day.id]) : 'Not done yet'}
              </p>
            </button>
            )
          })}
        </div>
      </div>

      <GeneralNotes value={data.generalNotes} onSave={notes => dispatch({ type: 'UPDATE_GENERAL_NOTES', notes })} />

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className="px-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent</h2>
          <div className="space-y-2">
            {recentSessions.map(session => {
              const groups = sessionGroups(session, exById)
              const exCount = session.exercises?.length || 0
              return (
                <button
                  key={session.id}
                  onClick={() => onEditSession?.(session.id)}
                  className="w-full text-left bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between active:bg-gray-700"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {sessionLabel(session, days, exById)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(session.date)} · {exCount} exercises
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {groups.map(g => (
                        <span key={g} className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[g] }} />
                      ))}
                    </div>
                    <ChevronRight size={14} className="text-gray-600" />
                  </div>
                </button>
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

/** Personal notes: one collapsed line on Home, tap to read or edit. */
function GeneralNotes({ value, onSave }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const firstLine = (value || '').split('\n').find(l => l.trim()) || ''

  const startEdit = () => { setText(value || ''); setEditing(true); setOpen(true) }
  const save = () => { onSave(text); setEditing(false) }

  return (
    <div className="mx-4 mb-6 rounded-xl bg-gray-800/60 border border-gray-800">
      <button onClick={() => value ? setOpen(o => !o) : startEdit()} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <StickyNote size={14} className="text-gray-500 flex-shrink-0" />
        <span className={`flex-1 min-w-0 text-xs truncate ${value ? 'text-gray-400' : 'text-gray-600'}`}>
          {open ? 'My notes' : (firstLine || 'Add notes: general reminders, rules you follow…')}
        </span>
        {value && <ChevronDown size={14} className={`text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <div className="px-3 pb-3">
          {editing ? (
            <>
              <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={6}
                placeholder="e.g. 2 heavy sets, 1 light set"
                className="w-full bg-gray-900 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none resize-y border border-gray-700 focus:border-brand" />
              <div className="flex justify-end gap-3 mt-2">
                <button onClick={() => { setEditing(false); if (!value) setOpen(false) }} className="text-xs text-gray-500 px-2 py-1.5">Cancel</button>
                <button onMouseDown={e => e.preventDefault()} onClick={save} className="flex items-center gap-1 text-xs font-semibold text-black bg-brand rounded-lg px-3 py-1.5"><Check size={13} /> Save</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{value}</p>
              <button onClick={startEdit} className="flex items-center gap-1 text-[11px] text-gray-500 mt-2"><Pencil size={11} /> Edit</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
