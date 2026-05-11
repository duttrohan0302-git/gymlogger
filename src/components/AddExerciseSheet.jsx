import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']

function CreateExerciseForm({ initialName, onCreated, onCancel, dispatch }) {
  const [name, setName] = useState(initialName)
  const [muscleGroup, setMuscleGroup] = useState('')
  const [notes, setNotes] = useState('')

  const submit = () => {
    if (!name.trim() || !muscleGroup) return
    const id = `custom_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`
    const exercise = { id, name: name.trim(), muscleGroup, movementGroupId: null, notes: notes.trim() }
    dispatch({ type: 'ADD_EXERCISE', exercise })
    onCreated(id)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-white">New Exercise</span>
        <button onClick={onCancel} className="text-gray-400"><X size={18} /></button>
      </div>

      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Exercise name"
        className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none mb-3 placeholder-gray-600"
      />

      <p className="text-xs text-gray-500 mb-2">Muscle group</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {MUSCLE_ORDER.map(g => (
          <button
            key={g}
            onClick={() => setMuscleGroup(g)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              muscleGroup === g ? 'border-brand text-brand bg-brand/10' : 'border-gray-700 text-gray-400'
            }`}
          >
            {MUSCLE_LABELS[g]}
          </button>
        ))}
      </div>

      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none mb-4 placeholder-gray-600"
      />

      <button
        onClick={submit}
        disabled={!name.trim() || !muscleGroup}
        className="w-full bg-brand text-black font-semibold py-3.5 rounded-xl text-sm disabled:opacity-40"
      >
        Create & Add
      </button>
    </div>
  )
}

export default function AddExerciseSheet({ exercises, existing, onAdd, onClose, dispatch }) {
  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [creating, setCreating] = useState(false)

  const inGroup = (e, g) => e.muscleGroup === g || e.extraMuscleGroups?.includes(g)

  const filtered = exercises.filter(e => {
    if (existing.includes(e.id)) return false
    if (query) return e.name.toLowerCase().includes(query.toLowerCase())
    if (selectedGroup) return inGroup(e, selectedGroup)
    return true
  })

  if (creating) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
        <div className="bg-gray-900 w-full rounded-t-3xl" onClick={e => e.stopPropagation()}>
          <CreateExerciseForm
            initialName={query}
            dispatch={dispatch}
            onCreated={id => { onAdd(id); onClose() }}
            onCancel={() => setCreating(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
      <div className="bg-gray-900 w-full rounded-t-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-white">Add Exercise</span>
            <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
          </div>
          <div className="flex items-center bg-gray-800 rounded-xl px-3 gap-2 mb-3">
            <Search size={16} className="text-gray-500" />
            <input
              autoFocus
              type="text"
              placeholder="Search exercises…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="bg-transparent flex-1 py-2.5 text-sm text-white outline-none placeholder-gray-600"
            />
            {query && <button onClick={() => setQuery('')} className="text-gray-500"><X size={14} /></button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedGroup(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !selectedGroup ? 'bg-brand/20 border-brand text-brand' : 'border-gray-700 text-gray-400'
              }`}
            >
              All
            </button>
            {MUSCLE_ORDER.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(selectedGroup === g ? null : g)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  selectedGroup === g ? 'border-transparent text-black' : 'border-gray-700 text-gray-400'
                }`}
                style={selectedGroup === g ? { backgroundColor: MUSCLE_COLORS[g] } : {}}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: selectedGroup === g ? 'rgba(0,0,0,0.4)' : MUSCLE_COLORS[g] }}
                />
                {MUSCLE_LABELS[g]}
              </button>
            ))}
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
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-800"
          >
            <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
            <p className="text-sm text-brand">
              {query ? `Create "${query}"` : 'Create new exercise…'}
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
