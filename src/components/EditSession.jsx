import { useState } from 'react'
import { ChevronLeft, Trash2, X, Plus } from 'lucide-react'
import { MUSCLE_COLORS } from '../data/defaultData'

function formatLongDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function EditSession({ session, exercises, onSave, onBack }) {
  const [draft, setDraft] = useState(() => ({
    ...session,
    exercises: session.exercises.map(e => ({
      ...e,
      sets: e.sets.map(s => ({ ...s })),
    })),
  }))

  const exInfo = id => exercises.find(e => e.id === id)

  const updateSet = (exIdx, setIdx, field, val) =>
    setDraft(d => ({
      ...d,
      exercises: d.exercises.map((e, ei) => ei !== exIdx ? e : {
        ...e,
        sets: e.sets.map((s, si) => si !== setIdx ? s : {
          ...s,
          [field]: val === '' ? null : parseFloat(val),
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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Sticky header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 px-4 pt-12 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 -ml-1 p-1">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Editing session</p>
            <p className="text-sm font-semibold text-white truncate">{formatLongDate(session.date)}</p>
          </div>
          <button
            onClick={() => onSave(draft)}
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
                  <input
                    type="number" inputMode="decimal"
                    value={set.weight ?? ''}
                    onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                    placeholder="—"
                    className="flex-1 bg-gray-700 rounded-xl px-3 py-2.5 text-sm text-white text-center font-mono outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-gray-600 text-sm">×</span>
                  <input
                    type="number" inputMode="numeric"
                    value={set.reps ?? ''}
                    onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                    placeholder="—"
                    className="flex-1 bg-gray-700 rounded-xl px-3 py-2.5 text-sm text-white text-center font-mono outline-none focus:ring-1 focus:ring-brand"
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
            </div>
          )
        })}

        {draft.exercises.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-600 text-sm">No exercises in this session</p>
          </div>
        )}
      </div>
    </div>
  )
}
