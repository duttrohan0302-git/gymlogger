import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function SessionCard({ session, exercises, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  const groups = session.muscleGroups || []
  const exCount = session.exercises?.length || 0

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden mb-3">
      <div className="px-4 py-3.5 flex items-center gap-3" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            {groups.map(g => MUSCLE_LABELS[g]).join(' + ')}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(session.date)} · {exCount} exercises</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {groups.map(g => (
              <span key={g} className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[g] }} />
            ))}
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700/50 px-4 py-3">
          {session.bodyWeight && (
            <p className="text-xs text-gray-500 mb-3">Body weight: <span className="text-white">{session.bodyWeight}kg</span></p>
          )}
          <div className="space-y-3">
            {(session.exercises || []).map((ex, i) => {
              const exercise = exercises.find(e => e.id === ex.exerciseId)
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {exercise && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[exercise.muscleGroup] }} />
                    )}
                    <p className="text-xs font-semibold text-gray-300">{exercise?.name || ex.exerciseId}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ex.sets.map((s, j) => (
                      <span key={j} className="text-xs bg-gray-700 rounded-lg px-2 py-1 text-gray-300">
                        {s.weight != null ? `${s.weight}kg` : '—'} × {s.reps ?? '—'}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => onDelete(session.id)}
            className="mt-4 flex items-center gap-1.5 text-red-500 text-xs active:text-red-400"
          >
            <Trash2 size={13} /> Delete session
          </button>
        </div>
      )}
    </div>
  )
}

export default function History() {
  const { state, dispatch } = useStore()
  const { data } = state
  const sessions = data.sessions || []
  const exercises = data.exercises || []

  const deleteSession = (id) => {
    if (confirm('Delete this session?')) {
      dispatch({ type: 'DELETE_SESSION', id })
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-1">History</h1>
        <p className="text-sm text-gray-500 mb-6">{sessions.length} sessions logged</p>

        {sessions.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-600 text-sm">No sessions yet</p>
          </div>
        )}

        {sessions.map(s => (
          <SessionCard
            key={s.id}
            session={s}
            exercises={exercises}
            onDelete={deleteSession}
          />
        ))}
      </div>
    </div>
  )
}
