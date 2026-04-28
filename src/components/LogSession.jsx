import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, X, Check, Search, Loader } from 'lucide-react'
import { useStore, getLastSession, genId } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function SetRow({ set, index, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-xs text-gray-600 w-5 text-right">{index + 1}</span>
      {/* Weight */}
      <div className="flex items-center bg-gray-900 rounded-lg overflow-hidden flex-1">
        <button
          className="px-2.5 py-2 text-gray-400 text-lg leading-none active:text-white"
          onClick={() => onChange({ ...set, weight: Math.max(0, (set.weight || 0) - 2.5) })}
        >−</button>
        <input
          type="number"
          value={set.weight ?? ''}
          placeholder="kg"
          onChange={e => onChange({ ...set, weight: e.target.value === '' ? null : parseFloat(e.target.value) })}
          className="flex-1 bg-transparent text-center text-white text-base font-semibold py-2 w-0 min-w-0 outline-none"
        />
        <button
          className="px-2.5 py-2 text-gray-400 text-lg leading-none active:text-white"
          onClick={() => onChange({ ...set, weight: (set.weight || 0) + 2.5 })}
        >+</button>
      </div>
      <span className="text-xs text-gray-600">×</span>
      {/* Reps */}
      <div className="flex items-center bg-gray-900 rounded-lg overflow-hidden w-28">
        <button
          className="px-2.5 py-2 text-gray-400 text-lg leading-none active:text-white"
          onClick={() => onChange({ ...set, reps: Math.max(0, (set.reps || 0) - 1) })}
        >−</button>
        <input
          type="number"
          value={set.reps ?? ''}
          placeholder="reps"
          onChange={e => onChange({ ...set, reps: e.target.value === '' ? null : parseInt(e.target.value) })}
          className="flex-1 bg-transparent text-center text-white text-base font-semibold py-2 w-0 min-w-0 outline-none"
        />
        <button
          className="px-2.5 py-2 text-gray-400 text-lg leading-none active:text-white"
          onClick={() => onChange({ ...set, reps: (set.reps || 0) + 1 })}
        >+</button>
      </div>
      <button onClick={onDelete} className="p-1.5 text-gray-700 active:text-red-400">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function ExerciseCard({ exerciseId, sets, exercises, sessions, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(true)
  const exercise = exercises.find(e => e.id === exerciseId)
  const last = getLastSession(sessions, exerciseId)

  if (!exercise) return null

  const updateSet = (i, newSet) => {
    const next = sets.map((s, idx) => idx === i ? newSet : s)
    onChange(next)
  }

  const addSet = () => {
    const prev = sets[sets.length - 1] || { weight: null, reps: null, note: '' }
    onChange([...sets, { ...prev, note: '' }])
  }

  const deleteSet = (i) => {
    onChange(sets.filter((_, idx) => idx !== i))
  }

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden mb-3">
      <div
        className="flex items-center justify-between px-4 py-3.5 active:bg-gray-750"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: MUSCLE_COLORS[exercise.muscleGroup] }}
            />
            <span className="text-sm font-semibold text-white truncate">{exercise.name}</span>
          </div>
          {last && (
            <p className="text-[11px] text-gray-500 mt-0.5 pl-4">
              {formatDate(last.date)}: {last.sets.filter(s => s.weight != null).map(s => `${s.weight}×${s.reps}`).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-xs text-gray-600">{sets.length} sets</span>
          {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="p-1 text-gray-700 active:text-red-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          {exercise.notes ? (
            <p className="text-[11px] text-yellow-600 mb-2 italic">{exercise.notes}</p>
          ) : null}
          <div className="divide-y divide-gray-700/50">
            {sets.map((set, i) => (
              <SetRow
                key={i}
                set={set}
                index={i}
                onChange={s => updateSet(i, s)}
                onDelete={() => deleteSet(i)}
              />
            ))}
          </div>
          <button
            onClick={addSet}
            className="mt-2 flex items-center gap-1.5 text-brand text-sm py-1"
          >
            <Plus size={15} /> Add Set
          </button>
        </div>
      )}
    </div>
  )
}

function AddExerciseSheet({ exercises, muscleGroups, existing, onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const filtered = exercises.filter(e => {
    const inGroup = muscleGroups.includes(e.muscleGroup)
    const notAdded = !existing.includes(e.id)
    const matchesSearch = e.name.toLowerCase().includes(query.toLowerCase())
    return notAdded && (query ? matchesSearch : inGroup || matchesSearch)
  })

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div className="bg-gray-900 w-full rounded-t-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-white">Add Exercise</span>
            <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
          </div>
          <div className="flex items-center bg-gray-800 rounded-xl px-3 gap-2">
            <Search size={16} className="text-gray-500" />
            <input
              autoFocus
              type="text"
              placeholder="Search exercises…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="bg-transparent flex-1 py-2.5 text-sm text-white outline-none placeholder-gray-600"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => { onAdd(ex.id); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/60 text-left active:bg-gray-800"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MUSCLE_COLORS[ex.muscleGroup] }} />
              <div>
                <p className="text-sm text-white">{ex.name}</p>
                <p className="text-xs text-gray-500">{MUSCLE_LABELS[ex.muscleGroup]}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-600 text-sm py-8">No exercises found</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LogSession({ splitDay, onDone, onBack }) {
  const { state, dispatch } = useStore()
  const { data } = state
  const sessions = data.sessions || []
  const exercises = data.exercises || []
  const muscleGroups = splitDay.muscleGroups

  // Draft: array of { exerciseId, sets[] }
  const [draft, setDraft] = useState(() => {
    // Find exercises from these muscle groups that were done in the last session for this day
    const lastMatchingSession = sessions.find(s =>
      muscleGroups.every(g => s.muscleGroups?.includes(g))
    )
    if (lastMatchingSession) {
      return lastMatchingSession.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.map(s => ({ ...s, note: s.note || '' })),
      }))
    }
    return []
  })

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bodyWeight, setBodyWeight] = useState('')

  const updateExercise = useCallback((exerciseId, sets) => {
    setDraft(d => d.map(e => e.exerciseId === exerciseId ? { ...e, sets } : e))
  }, [])

  const removeExercise = useCallback((exerciseId) => {
    setDraft(d => d.filter(e => e.exerciseId !== exerciseId))
  }, [])

  const addExercise = useCallback((exerciseId) => {
    const last = getLastSession(sessions, exerciseId)
    const sets = last?.sets.map(s => ({ ...s })) || [{ weight: null, reps: null, note: '' }]
    setDraft(d => [...d, { exerciseId, sets }])
  }, [sessions])

  const save = () => {
    const filledExercises = draft.filter(e => e.sets.some(s => s.weight != null || s.reps != null))
    if (filledExercises.length === 0) return

    setSaving(true)
    const session = {
      id: genId(),
      date: today(),
      muscleGroups,
      bodyWeight: bodyWeight ? parseFloat(bodyWeight) : null,
      exercises: filledExercises,
      notes: '',
    }
    dispatch({ type: 'ADD_SESSION', session })
    onDone()
  }

  // Group exercises by muscle group for display
  const byGroup = {}
  for (const g of muscleGroups) byGroup[g] = []
  const unGrouped = []
  for (const e of draft) {
    const ex = exercises.find(x => x.id === e.exerciseId)
    if (ex && muscleGroups.includes(ex.muscleGroup)) {
      byGroup[ex.muscleGroup].push(e)
    } else {
      unGrouped.push(e)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur flex items-center gap-3 px-4 pt-12 pb-4 border-b border-gray-800">
        <button onClick={onBack} className="text-gray-400 active:text-white">
          <X size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{splitDay.name}</h1>
          <p className="text-xs text-gray-500">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
        </div>
        <div className="flex items-center bg-gray-800 rounded-xl overflow-hidden">
          <input
            type="number"
            value={bodyWeight}
            onChange={e => setBodyWeight(e.target.value)}
            placeholder="BW kg"
            className="bg-transparent text-white text-sm py-2 px-3 w-20 outline-none"
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Exercises by muscle group */}
        {muscleGroups.map(group => {
          const groupExercises = byGroup[group] || []
          const note = data.muscleGroupNotes?.[group]
          return (
            <div key={group} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[group] }} />
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{MUSCLE_LABELS[group]}</h2>
              </div>
              {note && (
                <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-3 py-2 mb-3">
                  <p className="text-[11px] text-yellow-500/80">{note}</p>
                </div>
              )}
              {groupExercises.map(e => (
                <ExerciseCard
                  key={e.exerciseId}
                  exerciseId={e.exerciseId}
                  sets={e.sets}
                  exercises={exercises}
                  sessions={sessions}
                  onChange={sets => updateExercise(e.exerciseId, sets)}
                  onRemove={() => removeExercise(e.exerciseId)}
                />
              ))}
            </div>
          )
        })}

        {/* Ungroup (exercises from other muscle groups) */}
        {unGrouped.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Other</h2>
            {unGrouped.map(e => (
              <ExerciseCard
                key={e.exerciseId}
                exerciseId={e.exerciseId}
                sets={e.sets}
                exercises={exercises}
                sessions={sessions}
                onChange={sets => updateExercise(e.exerciseId, sets)}
                onRemove={() => removeExercise(e.exerciseId)}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => setShowAddSheet(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-700 text-gray-500 active:border-brand active:text-brand mb-4"
        >
          <Plus size={18} /> Add Exercise
        </button>
      </div>

      {/* Save button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800 safe-bottom">
        <button
          onClick={save}
          disabled={saving || draft.length === 0}
          className="w-full bg-brand text-black font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Loader size={18} className="animate-spin" /> : <Check size={18} />}
          Finish Workout
        </button>
      </div>

      {showAddSheet && (
        <AddExerciseSheet
          exercises={exercises}
          muscleGroups={muscleGroups}
          existing={draft.map(e => e.exerciseId)}
          onAdd={addExercise}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </div>
  )
}
