import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Plus, Trash2, X, Check, Loader, ArrowUp, ArrowDown, Link2, Trophy } from 'lucide-react'
import { useStore, getLastSession, genId, localDate, loadDraft, saveDraft, clearDraft } from '../lib/store'
import { matchDay, sessionGroups, exerciseMap } from '../lib/sessions'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'
import AddExerciseSheet from './AddExerciseSheet'
import NumberInput from './NumberInput'
import { progressionHint, personalBests, isPR } from '../lib/progression'

/** Drop superset ids that no longer link two neighbouring exercises */
function cleanSupersets(list) {
  return list.map((e, i) => {
    if (!e.superset) return e
    const linked = list[i - 1]?.superset === e.superset || list[i + 1]?.superset === e.superset
    return linked ? e : { ...e, superset: undefined }
  })
}

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function SetRow({ set, index, pr, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`text-xs w-5 text-right ${pr ? 'text-yellow-400' : 'text-gray-600'}`} title={pr ? `${pr} PR` : undefined}>
        {pr ? <Trophy size={13} className="inline" /> : index + 1}
      </span>
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

/** Variants used before for this exercise (e.g. "Smith", "Standing"), most recent first */
function knownVariants(sessions, exerciseId) {
  const seen = []
  for (const s of sessions) {
    const v = s.exercises?.find(e => e.exerciseId === exerciseId)?.variant
    if (v && !seen.includes(v)) seen.push(v)
  }
  return seen
}

function ExerciseCard({ item, index, total, exercises, sessions, linkedPrev, linkedNext, onChange, onRemove, onMove, onToggleLink }) {
  const [expanded, setExpanded] = useState(true)
  const [addingVariant, setAddingVariant] = useState(false)
  const [variantText, setVariantText] = useState('')
  const { exerciseId, sets, variant } = item
  const exercise = exercises.find(e => e.id === exerciseId)
  const variants = useMemo(() => knownVariants(sessions, exerciseId), [sessions, exerciseId])
  // History for this variant if one is picked and has history, else all
  const scoped = variant && variants.includes(variant) ? variant : null
  const scopedSessions = useMemo(
    () => scoped ? sessions.filter(s => s.exercises?.some(e => e.exerciseId === exerciseId && e.variant === scoped)) : sessions,
    [sessions, exerciseId, scoped]
  )
  const last = getLastSession(scopedSessions, exerciseId)
  const hint = useMemo(() => progressionHint(sessions, exerciseId, scoped), [sessions, exerciseId, scoped])
  const bests = useMemo(() => personalBests(sessions, exerciseId, scoped), [sessions, exerciseId, scoped])

  if (!exercise) return null

  const setSets = next => onChange({ sets: next })
  const updateSet = (i, newSet) => setSets(sets.map((s, idx) => idx === i ? newSet : s))
  const addSet = () => {
    const prev = sets[sets.length - 1] || { weight: null, reps: null, note: '' }
    setSets([...sets, { ...prev, note: '' }])
  }
  const deleteSet = i => setSets(sets.filter((_, idx) => idx !== i))

  const paceText = hint?.sessionsPerStep
    ? `You usually move up every ~${hint.sessionsPerStep} session${hint.sessionsPerStep > 1 ? 's' : ''} (+${hint.step} kg)`
    : null

  return (
    <div className={`bg-gray-800 overflow-hidden ${linkedPrev ? 'rounded-b-2xl' : 'rounded-2xl'} ${linkedNext ? 'rounded-b-none' : 'mb-3'} ${linkedPrev || linkedNext ? 'border-l-4 border-purple-500' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3.5" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 font-mono w-4">{index + 1}</span>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MUSCLE_COLORS[exercise.muscleGroup] }} />
            <span className="text-sm font-semibold text-white truncate">{exercise.name}</span>
            {variant && <span className="text-[10px] text-gray-400 bg-gray-700 rounded px-1.5 py-0.5 flex-shrink-0">{variant}</span>}
          </div>
          {last && (
            <div className="mt-1.5 pl-6 flex items-center flex-wrap gap-1.5">
              <span className="text-[10px] text-gray-600">{formatDate(last.date)}</span>
              {last.sets.filter(s => s.weight != null || s.reps != null).map((s, i) => (
                <span key={i} className="text-[11px] bg-gray-700 text-gray-300 rounded-md px-2 py-0.5 font-mono">
                  {s.weight || 'BW'}<span className="text-gray-500">×</span>{s.reps ?? '—'}
                </span>
              ))}
            </div>
          )}
          {hint && (
            <p className={`mt-1 pl-6 text-[11px] ${hint.kind === 'up' ? 'text-brand' : 'text-gray-400'}`}>
              {hint.kind === 'up' ? '↑ ' : '→ '}{hint.text}
              {hint.stuck && <span className="text-yellow-500"> · stuck {hint.currentRun} sessions, try a drop set or a new rep range</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up" className="p-1 text-gray-500 disabled:opacity-20"><ArrowUp size={15} /></button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down" className="p-1 text-gray-500 disabled:opacity-20"><ArrowDown size={15} /></button>
          <button onClick={onRemove} aria-label="Remove exercise" className="p-1 text-gray-700 active:text-red-400"><X size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          {exercise.notes ? <p className="text-[11px] text-yellow-600 mb-2 italic">{exercise.notes}</p> : null}
          {paceText && <p className="text-[10px] text-gray-600 mb-2">{paceText}{hint.pace === 'slow' ? ' · slow mover, small jumps' : ''}</p>}

          {/* Variant chips */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {variants.map(v => (
              <button key={v} onClick={() => onChange({ variant: variant === v ? null : v })}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${variant === v ? 'border-brand text-brand bg-brand/10' : 'border-gray-700 text-gray-500'}`}>
                {v}
              </button>
            ))}
            {variant && !variants.includes(variant) && (
              <button onClick={() => onChange({ variant: null })} className="text-[11px] px-2.5 py-1 rounded-full border border-brand text-brand bg-brand/10">{variant} ×</button>
            )}
            {addingVariant ? (
              <input autoFocus value={variantText} onChange={e => setVariantText(e.target.value)}
                onBlur={() => { if (variantText.trim()) onChange({ variant: variantText.trim() }); setAddingVariant(false); setVariantText('') }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                placeholder="e.g. Smith, wide grip"
                className="text-[11px] bg-gray-900 rounded-full px-2.5 py-1 text-white outline-none w-32" />
            ) : (
              <button onClick={() => setAddingVariant(true)} className="text-[11px] px-2.5 py-1 rounded-full border border-dashed border-gray-700 text-gray-500">
                + variant
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-700/50">
            {sets.map((set, i) => (
              <SetRow key={i} set={set} index={i} pr={isPR(set, bests)}
                onChange={s => updateSet(i, s)} onDelete={() => deleteSet(i)} />
            ))}
          </div>
          <div className="flex items-center justify-between mt-2">
            <button onClick={addSet} className="flex items-center gap-1.5 text-brand text-sm py-1">
              <Plus size={15} /> Add Set
            </button>
            {index < total - 1 && (
              <button onClick={onToggleLink} className={`flex items-center gap-1 text-xs py-1 ${linkedNext ? 'text-purple-400' : 'text-gray-500'}`}>
                <Link2 size={13} /> {linkedNext ? 'Unlink superset' : 'Superset with next'}
              </button>
            )}
          </div>
          <input
            type="text"
            value={item.note || ''}
            onChange={e => onChange({ note: e.target.value })}
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
        ...(ex.variant ? { variant: ex.variant } : {}),
        ...(ex.superset ? { superset: ex.superset } : {}),
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
    saveDraft(userId, splitDay.id, { draft, bodyWeight, sessionNotes, sessionDate, splitDay })
  }, [draft, bodyWeight, sessionNotes, sessionDate, userId, splitDay])

  // Mark as touched on any user edit so the draft gets persisted
  const edit = fn => (...args) => { touched.current = true; return fn(...args) }

  const discard = () => {
    if (touched.current && !confirm('Discard this workout? Nothing will be saved.')) return
    clearDraft(userId, splitDay.id)
    onBack()
  }

  const patchExercise = useCallback((exerciseId, patch) => {
    setDraft(d => d.map(e => e.exerciseId === exerciseId ? { ...e, ...patch } : e))
  }, [])

  const removeExercise = useCallback((exerciseId) => {
    setDraft(d => cleanSupersets(d.filter(e => e.exerciseId !== exerciseId)))
  }, [])

  const moveExercise = useCallback((index, dir) => {
    setDraft(d => {
      const j = index + dir
      if (j < 0 || j >= d.length) return d
      const next = [...d]
      ;[next[index], next[j]] = [next[j], next[index]]
      // A moved exercise leaves its superset
      next[j] = { ...next[j], superset: undefined }
      return cleanSupersets(next)
    })
  }, [])

  const toggleLink = useCallback((index) => {
    setDraft(d => {
      const a = d[index], b = d[index + 1]
      if (!b) return d
      const next = [...d]
      if (a.superset && a.superset === b.superset) {
        next[index + 1] = { ...b, superset: undefined }
      } else {
        const id = a.superset || genId()
        next[index] = { ...a, superset: id }
        next[index + 1] = { ...b, superset: id }
      }
      return cleanSupersets(next)
    })
  }, [])

  const addExercise = useCallback((exerciseId) => {
    const last = getLastSession(sessions, exerciseId)
    const sets = last?.sets.map(s => ({ ...s })) || [{ weight: null, reps: null, note: '' }]
    const lastVariant = sessions.find(s => s.exercises?.some(e => e.exerciseId === exerciseId))
      ?.exercises.find(e => e.exerciseId === exerciseId)?.variant
    setDraft(d => [...d, { exerciseId, sets, note: '', ...(lastVariant ? { variant: lastVariant } : {}) }])
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
        {/* Muscle group reminders */}
        {muscleGroups.map(g => data.muscleGroupNotes?.[g] ? (
          <div key={g} className="flex gap-2 bg-yellow-900/20 border border-yellow-800/40 rounded-xl px-3 py-2 mb-2">
            <span className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: MUSCLE_COLORS[g] }} />
            <p className="text-[11px] text-yellow-500/80"><span className="font-semibold">{MUSCLE_LABELS[g]}:</span> {data.muscleGroupNotes[g]}</p>
          </div>
        ) : null)}

        {/* Exercises in the order you do them — use ↑↓ to reorder */}
        <div className="mt-3">
          {draft.map((e, i) => {
            const linkedPrev = i > 0 && e.superset && draft[i - 1].superset === e.superset
            const linkedNext = i < draft.length - 1 && e.superset && draft[i + 1].superset === e.superset
            return (
              <div key={e.exerciseId}>
                {e.superset && !linkedPrev && (
                  <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-1 pl-1">Superset</p>
                )}
                <ExerciseCard
                  item={e}
                  index={i}
                  total={draft.length}
                  exercises={exercises}
                  sessions={sessions}
                  linkedPrev={linkedPrev}
                  linkedNext={linkedNext}
                  onChange={edit(patch => patchExercise(e.exerciseId, patch))}
                  onRemove={edit(() => removeExercise(e.exerciseId))}
                  onMove={edit(dir => moveExercise(i, dir))}
                  onToggleLink={edit(() => toggleLink(i))}
                />
              </div>
            )
          })}
        </div>

        <button
          onClick={() => setShowAddSheet(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-700 text-gray-500 active:border-brand active:text-brand mb-4"
        >
          <Plus size={18} /> Add Exercise
        </button>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Workout note</p>
        <textarea
          value={sessionNotes}
          onChange={edit(e => setSessionNotes(e.target.value))}
          placeholder="How it went, energy, anything unusual…"
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
