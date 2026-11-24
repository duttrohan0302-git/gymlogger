import { useState } from 'react'
import { ChevronLeft, Trash2, X, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { MUSCLE_COLORS } from '../data/defaultData'
import AddExerciseSheet from './AddExerciseSheet'
import NumberInput from './NumberInput'

export default function EditSession({ session, exercises, onSave, onBack, onDelete }) {
  const { dispatch } = useStore()
  const [draft, setDraft] = useState(() => ({
    ...session,
    exercises: session.exercises.map(e => ({
      ...e,
      sets: e.sets.map(s => ({ ...s })),
    })),
  }))
  const [showAddSheet, setShowAddSheet] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(session)
  const back = () => {
    if (dirty && !confirm('Discard your changes to this session?')) return
    onBack()
  }

  const exInfo = id => exercises.find(e => e.id === id)

  const updateSet = (exIdx, setIdx, field, val) =>
    setDraft(d => ({
      ...d,
      exercises: d.exercises.map((e, ei) => ei !== exIdx ? e : {
        ...e,
        sets: e.sets.map((s, si) => si !== setIdx ? s : {
          ...s,
          [field]: val,
        }),
      }),
    }))

  const addSet = exIdx =>
    setDraft(d => ({
      ...d,
      exercises: d.exercises.map((e, ei) => ei !== exIdx ? e : {
        ...e,
        sets: [...e.sets, {
          weight: e.sets[e.sets.length - 1]?.weight ?? null,
          reps:   e.sets[e.sets.length - 1]?.reps   ?? null,
          note: '',
        }],
      }),
    }))

  const removeSet = (exIdx, setIdx) =>
    setDraft(d => ({
      ...d,
      exercises: d.exercises.map((e, ei) => ei !== exIdx ? e : {
        ...e,
        sets: e.sets.filter((_, si) => si !== setIdx),
      }),
    }))

  const removeExercise = exIdx =>
    setDraft(d => ({ ...d, exercises: d.exercises.filter((_, ei) => ei !== exIdx) }))

  const addExercise = id =>
    setDraft(d => ({
      ...d,
      exercises: [...d.exercises, { exerciseId: id, sets: [{ weight: null, reps: null, note: '' }] }],
    }))

  return (
    <div className="min-h-screen bg-gray-900 overflow-x-hidden">
      {/* Sticky header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 px-4 pt-12 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={back} aria-label="Back" className="text-gray-400 -ml-1 p-1">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Editing session</p>
            <input
              type="date"
              value={draft.date}
              onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
              className="bg-transparent text-sm font-semibold text-white outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={() => {
              const hasSets = draft.exercises.some(e => e.sets.some(s => s.weight != null || s.reps != null))
              if (!hasSets) {
                if (onDelete && confirm('No sets left. Delete this session instead?')) onDelete(session.id)
                return
              }
              onSave({ ...draft, date: draft.date || session.date, notes: (draft.notes || '').trim() })
            }}
            className="bg-brand text-black text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform flex-shrink-0"
          >
            Save
          </button>
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-3">
        {draft.exercises.map((ex, exIdx) => {
          const info = exInfo(ex.exerciseId)
          return (
            <div key={`${ex.exerciseId}-${exIdx}`} className="bg-gray-800 rounded-2xl p-4">
              {/* Exercise header */}
              <div className="flex items-center gap-2 mb-3">
                {info && (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: MUSCLE_COLORS[info.muscleGroup] }} />
                )}
                <p className="text-sm font-semibold text-white flex-1 truncate">
                  {info?.name ?? ex.exerciseId}
                </p>
                <button onClick={() => removeExercise(exIdx)}
                  className="text-gray-600 active:text-red-400 p-1">
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Column labels */}
              <div className="flex items-center gap-2 mb-1.5 pl-5">
                <span className="flex-1 text-center text-[10px] text-gray-600 uppercase tracking-wider">kg</span>
                <span className="w-4" />
                <span className="flex-1 text-center text-[10px] text-gray-600 uppercase tracking-wider">reps</span>
                <span className="w-7" />
              </div>

              {/* Set rows */}
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-600 w-5 text-center">{setIdx + 1}</span>
                  <NumberInput
                    value={set.weight}
                    onChange={v => updateSet(exIdx, setIdx, 'weight', v)}
                    placeholder="—"
                    className="flex-1 w-0 min-w-0 bg-gray-700 rounded-xl px-3 py-2.5 text-sm text-white text-center font-mono outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-gray-600 text-sm">×</span>
                  <NumberInput
                    integer
                    value={set.reps}
                    onChange={v => updateSet(exIdx, setIdx, 'reps', v)}
                    placeholder="—"
                    className="flex-1 w-0 min-w-0 bg-gray-700 rounded-xl px-3 py-2.5 text-sm text-white text-center font-mono outline-none focus:ring-1 focus:ring-brand"
                  />
                  <button onClick={() => removeSet(exIdx, setIdx)}
                    className="text-gray-700 active:text-red-400 w-7 flex justify-center">
                    <X size={15} />
                  </button>
                </div>
              ))}

              <button onClick={() => addSet(exIdx)}
                className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 active:text-brand py-1">
                <Plus size={13} />
                Add set
              </button>

              <input
                type="text"
                value={ex.note || ''}
                onChange={e => setDraft(d => ({
                  ...d,
                  exercises: d.exercises.map((x, i) => i !== exIdx ? x : { ...x, note: e.target.value }),
                }))}
                placeholder="Note for this exercise…"
                className="mt-2 w-full bg-gray-900 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 outline-none"
              />
            </div>
          )
        })}

        {draft.exercises.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-gray-600 text-sm">No exercises in this session</p>
          </div>
        )}

        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Workout note</p>
          <textarea
            value={draft.notes || ''}
            onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
            placeholder="How it went, energy, anything unusual…"
            rows={3}
            className="w-full bg-gray-900 rounded-xl px-3 py-2.5 text-sm text-gray-300 placeholder-gray-600 outline-none resize-none"
          />
        </div>

        <button
          onClick={() => setShowAddSheet(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-700 text-gray-500 active:border-brand active:text-brand"
        >
          <Plus size={18} /> Add Exercise
        </button>

        {onDelete && (
          <button
            onClick={() => { if (confirm('Delete this whole session? This cannot be undone.')) onDelete(session.id) }}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm text-red-500 active:text-red-400"
          >
            <Trash2 size={15} /> Delete session
          </button>
        )}
      </div>

      {showAddSheet && (
        <AddExerciseSheet
          exercises={exercises}
          existing={draft.exercises.map(e => e.exerciseId)}
          onAdd={addExercise}
          onClose={() => setShowAddSheet(false)}
          dispatch={dispatch}
        />
      )}
    </div>
  )
}
