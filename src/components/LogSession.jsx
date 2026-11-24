import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, X, Check, Loader } from 'lucide-react'
import { useStore, getLastSession, genId, localDate, loadDraft, saveDraft, clearDraft } from '../lib/store'
import { matchDay, sessionGroups, exerciseMap } from '../lib/sessions'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'
import AddExerciseSheet from './AddExerciseSheet'
import NumberInput from './NumberInput'

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
          onClick={() => onChange({ ...set, weight: Math.max(0, Math.round(((set.weight || 0) - 2.5) * 100) / 100) })}
        >−</button>
        <NumberInput
          value={set.weight}
          placeholder="kg / BW"
          onChange={weight => onChange({ ...set, weight })}
          className="flex-1 bg-transparent text-center text-white text-base font-semibold py-2 w-0 min-w-0 outline-none"
        />
        <button
          className="px-2.5 py-2 text-gray-400 text-lg leading-none active:text-white"
          onClick={() => onChange({ ...set, weight: Math.round(((set.weight || 0) + 2.5) * 100) / 100 })}
        >+</button>
      </div>
      <span className="text-xs text-gray-600">×</span>
      {/* Reps */}
      <div className="flex items-center bg-gray-900 rounded-lg overflow-hidden w-28">
        <button
          className="px-2.5 py-2 text-gray-400 text-lg leading-none active:text-white"
          onClick={() => onChange({ ...set, reps: Math.max(0, (set.reps || 0) - 1) })}
        >−</button>
        <NumberInput
          integer
          value={set.reps}
          placeholder="reps"
          onChange={reps => onChange({ ...set, reps })}
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

function ExerciseCard({ exerciseId, sets, sessionNote, exercises, sessions, onChange, onNoteChange, onRemove }) {
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
            <div className="mt-1.5 pl-4 flex items-center flex-wrap gap-1.5">
              <span className="text-[10px] text-gray-600">{formatDate(last.date)}</span>
              {last.sets.filter(s => s.weight != null || s.reps != null).map((s, i) => (
                <span key={i} className="text-[11px] bg-gray-700 text-gray-300 rounded-md px-2 py-0.5 font-mono">
                  {s.weight || 'BW'}<span className="text-gray-500">×</span>{s.reps ?? '—'}
                </span>
              ))}
            </div>
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
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={addSet}
              className="flex items-center gap-1.5 text-brand text-sm py-1"
            >
              <Plus size={15} /> Add Set
            </button>
          </div>
          <input
            type="text"
            value={sessionNote}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Note for this exercise…"
            className="mt-2 w-full bg-gray-900 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 outline-none"
          />
        </div>
      )}
    </div>
  )
}


export default function LogSession({ splitDay, onDone, onBack }) {
  const { state, dispatch } = useStore()
  const { data } = state
  const sessions = data.sessions || []
  const exercises = data.exercises || []
  const muscleGroups = splitDay.muscleGroups
  const userId = state.activeUserId
  const exById = useMemo(() => exerciseMap(exercises), [exercises])
  const splitDays = (data.splits?.find(s => s.isActive) || data.splits?.[0])?.days || [splitDay]

  // Restore an in-progress workout if the app was closed / reloaded mid-session
  const [restored, setRestored] = useState(() => loadDraft(userId, splitDay.id))

  // Draft: array of { exerciseId, sets[] }
  const [draft, setDraft] = useState(() => restored?.draft || freshDraft())
  function freshDraft() {
    // Prefill from the last session that was actually this kind of day
    // (matched on exercises trained, not on the button that was tapped)
    const lastMatchingSession = sessions.find(s => matchDay(s, splitDays, exById)?.id === splitDay.id)
    if (lastMatchingSession) {
      return lastMatchingSession.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets.map(s => ({ ...s, note: s.note || '' })),
      }))
    }
    if (splitDay.defaultExerciseIds?.length) {
      return splitDay.defaultExerciseIds.map(id => ({
        exerciseId: id,
        sets: [{ weight: null, reps: null, note: '' }],
        note: '',
      }))
    }
    return []
  }

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bodyWeight, setBodyWeight] = useState(restored?.bodyWeight ?? null)
  const [sessionNotes, setSessionNotes] = useState(restored?.sessionNotes ?? '')
  const [sessionDate, setSessionDate] = useState(restored?.sessionDate ?? localDate())
  const touched = useRef(!!restored)

  useEffect(() => {
    if (!touched.current) return
    saveDraft(userId, splitDay.id, { draft, bodyWeight, sessionNotes, sessionDate })
  }, [draft, bodyWeight, sessionNotes, sessionDate, userId, splitDay.id])

  // Mark as touched on any user edit so the draft gets persisted
  const edit = fn => (...args) => { touched.current = true; return fn(...args) }

  const discard = () => {
    if (touched.current && !confirm('Discard this workout? Nothing will be saved.')) return
    clearDraft(userId, splitDay.id)
    onBack()
  }

  const updateExercise = useCallback((exerciseId, sets) => {
    setDraft(d => d.map(e => e.exerciseId === exerciseId ? { ...e, sets } : e))
  }, [])

  const updateExerciseNote = useCallback((exerciseId, note) => {
    setDraft(d => d.map(e => e.exerciseId === exerciseId ? { ...e, note } : e))
  }, [])

  const removeExercise = useCallback((exerciseId) => {
    setDraft(d => d.filter(e => e.exerciseId !== exerciseId))
  }, [])

  const addExercise = useCallback((exerciseId) => {
    const last = getLastSession(sessions, exerciseId)
    const sets = last?.sets.map(s => ({ ...s })) || [{ weight: null, reps: null, note: '' }]
    setDraft(d => [...d, { exerciseId, sets, note: '' }])
  }, [sessions])

  const save = () => {
    const filledExercises = draft
      .map(e => ({ ...e, sets: e.sets.filter(s => s.weight != null || s.reps != null) }))
      .filter(e => e.sets.length > 0)
    if (filledExercises.length === 0) {
      alert('Log at least one set before finishing.')
      return
    }

    setSaving(true)
    const session = {
      id: genId(),
      date: sessionDate || localDate(),
      dayId: splitDay.id,
      dayName: splitDay.name,
      bodyWeight: bodyWeight || null,
      exercises: filledExercises,
      notes: sessionNotes.trim(),
    }
    // Record what was actually trained, not just the day button that was tapped
    session.muscleGroups = sessionGroups(session, exById)
    dispatch({ type: 'ADD_SESSION', session })
    clearDraft(userId, splitDay.id)
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
        <button onClick={discard} aria-label="Discard workout" className="text-gray-400 active:text-white">
          <X size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{splitDay.name}</h1>
          <input
            type="date"
            value={sessionDate}
            onChange={edit(e => setSessionDate(e.target.value))}
            className="bg-transparent text-xs text-gray-400 outline-none mt-0.5 cursor-pointer"
          />
        </div>
        <div className="flex items-center bg-gray-800 rounded-xl overflow-hidden">
          <NumberInput
            value={bodyWeight}
            onChange={edit(setBodyWeight)}
            placeholder="BW kg"
            className="bg-transparent text-white text-sm py-2 px-3 w-20 outline-none"
          />
        </div>
      </div>

      <div className="px-4 pt-4">
        {restored && (
          <div className="flex items-center gap-2 text-xs text-brand bg-brand/10 rounded-xl px-3 py-2 mb-4">
            <span className="flex-1">
              Resumed unfinished workout
              {restored.sessionDate && restored.sessionDate !== localDate() ? ` from ${formatDate(restored.sessionDate)}` : ''}
            </span>
            <button
              onClick={() => {
                if (!confirm('Throw away the unfinished workout and start fresh?')) return
                clearDraft(userId, splitDay.id)
                touched.current = false
                setRestored(null)
                setDraft(freshDraft())
                setBodyWeight(null)
                setSessionNotes('')
                setSessionDate(localDate())
              }}
              className="font-semibold underline flex-shrink-0"
            >
              Start fresh
            </button>
          </div>
        )}
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
                  sessionNote={e.note || ''}
                  exercises={exercises}
                  sessions={sessions}
                  onChange={edit(sets => updateExercise(e.exerciseId, sets))}
                  onNoteChange={edit(note => updateExerciseNote(e.exerciseId, note))}
                  onRemove={edit(() => removeExercise(e.exerciseId))}
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
                sessionNote={e.note || ''}
                exercises={exercises}
                sessions={sessions}
                onChange={edit(sets => updateExercise(e.exerciseId, sets))}
                onNoteChange={edit(note => updateExerciseNote(e.exerciseId, note))}
                onRemove={edit(() => removeExercise(e.exerciseId))}
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

        <textarea
          value={sessionNotes}
          onChange={edit(e => setSessionNotes(e.target.value))}
          placeholder="Session notes (how you felt, anything unusual…)"
          rows={2}
          className="w-full bg-gray-800 rounded-2xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 outline-none resize-none mb-4"
        />
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
          existing={draft.map(e => e.exerciseId)}
          onAdd={edit(addExercise)}
          onClose={() => setShowAddSheet(false)}
          dispatch={dispatch}
        />
      )}
    </div>
  )
}
