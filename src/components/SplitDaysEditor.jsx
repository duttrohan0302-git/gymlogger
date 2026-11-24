import { useState } from 'react'
import { X, Trash2, Plus, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { useStore, genId } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']

/** Edit the days of the active split in place: rename, change muscles, add/remove/reorder. */
export default function SplitDaysEditor({ onClose }) {
  const { state, dispatch } = useStore()
  const split = state.data.splits?.find(s => s.isActive) || state.data.splits?.[0]
  const [days, setDays] = useState(() => (split?.days || []).map(d => ({ ...d, muscleGroups: [...d.muscleGroups] })))

  const update = (i, patch) => setDays(ds => ds.map((d, j) => j === i ? { ...d, ...patch } : d))
  const toggleGroup = (i, g) => {
    const groups = days[i].muscleGroups
    update(i, { muscleGroups: groups.includes(g) ? groups.filter(x => x !== g) : MUSCLE_ORDER.filter(x => x === g || groups.includes(x)) })
  }
  const move = (i, dir) => setDays(ds => {
    const j = i + dir
    if (j < 0 || j >= ds.length) return ds
    const next = [...ds]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const remove = i => {
    if (!confirm(`Remove "${days[i].name || 'this day'}" from your split? Past workouts are kept.`)) return
    setDays(ds => ds.filter((_, j) => j !== i))
  }
  const add = () => setDays(ds => [...ds, {
    id: `${state.activeUserId}_day_${genId()}`, name: '', muscleGroups: [], defaultExerciseIds: [],
  }])

  const invalid = days.length === 0 || days.some(d => !d.name.trim() || d.muscleGroups.length === 0)

  const save = () => {
    if (invalid) return
    dispatch({
      type: 'UPDATE_SPLIT',
      split: { ...(split || { id: `${state.activeUserId}_split`, name: 'My Split' }), days: days.map(d => ({ ...d, name: d.name.trim() })) },
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-gray-900 z-[60] flex flex-col max-w-md mx-auto">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-gray-800">
        <button onClick={onClose} aria-label="Close" className="text-gray-400"><X size={22} /></button>
        <h2 className="text-lg font-bold text-white flex-1">Edit split days</h2>
        <button onClick={save} disabled={invalid}
          className="bg-brand text-black text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-40 flex items-center gap-1">
          <Check size={16} /> Save
        </button>
      </div>

      <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 px-4 py-4 space-y-3 pb-24">
        {days.map((day, i) => (
          <div key={day.id} className="bg-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={day.name}
                onChange={e => update(i, { name: e.target.value })}
                placeholder="Day name (e.g. Pull)"
                className="flex-1 min-w-0 bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm outline-none border border-gray-700 focus:border-brand"
              />
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 text-gray-500 disabled:opacity-20"><ChevronUp size={18} /></button>
              <button onClick={() => move(i, 1)} disabled={i === days.length - 1} aria-label="Move down" className="p-1.5 text-gray-500 disabled:opacity-20"><ChevronDown size={18} /></button>
              <button onClick={() => remove(i)} aria-label="Remove day" className="p-1.5 text-gray-600 active:text-red-400"><Trash2 size={16} /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {MUSCLE_ORDER.map(g => {
                const on = day.muscleGroups.includes(g)
                return (
                  <button key={g} onClick={() => toggleGroup(i, g)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? 'border-transparent text-black' : 'border-gray-700 text-gray-400'}`}
                    style={on ? { backgroundColor: MUSCLE_COLORS[g] } : {}}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: on ? 'rgba(0,0,0,0.4)' : MUSCLE_COLORS[g] }} />
                    {MUSCLE_LABELS[g]}
                  </button>
                )
              })}
            </div>
            {day.muscleGroups.length === 0 && <p className="text-[11px] text-yellow-500 mt-2">Pick at least one muscle group</p>}
          </div>
        ))}

        <button onClick={add}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-700 text-gray-500 active:border-brand active:text-brand">
          <Plus size={18} /> Add day
        </button>
        <p className="text-[11px] text-gray-600 text-center">Changing days doesn't touch past workouts; they're labelled by what you trained.</p>
      </div>
    </div>
  )
}
