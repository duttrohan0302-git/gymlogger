import { useState } from 'react'
import { Plus, Check, ChevronRight, ChevronLeft, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS, SPLIT_TEMPLATES, makeUser } from '../data/defaultData'

function UserAvatar({ name, size = 'lg' }) {
  const s = size === 'lg' ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-base'
  return (
    <div className={`${s} rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0`}>
      <span className="text-brand font-bold">{name[0].toUpperCase()}</span>
    </div>
  )
}

export default function UserSelect() {
  const { state, dispatch } = useStore()
  const users = state.fullData?.users || []
  const exercises = state.fullData?.exercises || []

  const [step, setStep] = useState('pick') // 'pick' | 'name' | 'split' | 'exercises'
  const [name, setName] = useState('')
  const [template, setTemplate] = useState(null)
  // dayExercises: { [dayId]: Set<exerciseId> }
  const [dayExercises, setDayExercises] = useState({})
  const [dayIdx, setDayIdx] = useState(0)
  const [muscleFilter, setMuscleFilter] = useState(null)

  const days = template?.days || []
  const currentDay = days[dayIdx]

  const toggleExercise = (dayId, exId) => {
    setDayExercises(prev => {
      const s = new Set(prev[dayId] || [])
      s.has(exId) ? s.delete(exId) : s.add(exId)
      return { ...prev, [dayId]: s }
    })
  }

  const finish = () => {
    const map = {}
    for (const [dayId, set] of Object.entries(dayExercises)) map[dayId] = [...set]
    const user = makeUser(name.trim(), days, map)
    dispatch({ type: 'ADD_USER', user })
  }

  // ── Step: pick user ────────────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <div className="min-h-screen bg-gray-900 px-4 pt-16 pb-8 max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-1">Who's training?</h1>
        <p className="text-sm text-gray-500 mb-8">Select your profile to continue</p>

        <div className="space-y-3 mb-6">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_USER', userId: user.id })}
              className="w-full bg-gray-800 rounded-2xl px-5 py-4 flex items-center gap-4 text-left active:scale-95 transition-transform border border-gray-700"
            >
              <UserAvatar name={user.name} />
              <div className="flex-1">
                <p className="text-base font-semibold text-white">{user.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{user.sessions?.length || 0} sessions logged</p>
              </div>
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          ))}
        </div>

        <button
          onClick={() => setStep('name')}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-gray-700 text-gray-400 active:border-brand active:text-brand transition-colors"
        >
          <Plus size={18} /> Add User
        </button>
      </div>
    )
  }

  // ── Step: name ─────────────────────────────────────────────────────────────
  if (step === 'name') {
    return (
      <div className="min-h-screen bg-gray-900 px-4 pt-16 max-w-md mx-auto">
        <button onClick={() => setStep('pick')} className="text-gray-400 mb-8 flex items-center gap-1">
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">What's your name?</h1>
        <p className="text-sm text-gray-500 mb-8">You can change this later</p>

        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && setStep('split')}
          placeholder="Your name…"
          className="w-full bg-gray-800 text-white text-lg rounded-2xl px-5 py-4 outline-none border border-gray-700 focus:border-brand placeholder-gray-600 mb-6"
        />

        <button
          onClick={() => setStep('split')}
          disabled={!name.trim()}
          className="w-full bg-brand text-black font-bold py-4 rounded-2xl text-base disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    )
  }

  // ── Step: split template ───────────────────────────────────────────────────
  if (step === 'split') {
    return (
      <div className="min-h-screen bg-gray-900 px-4 pt-16 pb-8 max-w-md mx-auto">
        <button onClick={() => setStep('name')} className="text-gray-400 mb-8 flex items-center gap-1">
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="text-2xl font-bold text-white mb-1">Pick a split</h1>
        <p className="text-sm text-gray-500 mb-6">Choose how you want to structure your week</p>

        <div className="space-y-3">
          {SPLIT_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => {
                setTemplate(t)
                setDayExercises({})
                setDayIdx(0)
                setMuscleFilter(null)
                setStep('exercises')
              }}
              className="w-full bg-gray-800 rounded-2xl px-5 py-4 text-left active:scale-95 transition-transform border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-base font-semibold text-white">{t.name}</p>
                <span className="text-xs text-gray-500">{t.description}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.days.map(d => (
                  <div key={d.id} className="flex items-center gap-1 bg-gray-700 rounded-lg px-2 py-1">
                    <div className="flex gap-0.5">
                      {d.muscleGroups.slice(0, 3).map(g => (
                        <span key={g} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[g] }} />
                      ))}
                      {d.muscleGroups.length > 3 && <span className="text-[9px] text-gray-400">+{d.muscleGroups.length - 3}</span>}
                    </div>
                    <span className="text-[11px] text-gray-300">{d.name}</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step: exercise selection ───────────────────────────────────────────────
  if (step === 'exercises' && currentDay) {
    const muscleGroups = currentDay.muscleGroups
    const selected = dayExercises[currentDay.id] || new Set()
    const inDay = e => muscleGroups.includes(e.muscleGroup) || e.extraMuscleGroups?.some(g => muscleGroups.includes(g))
    const inFilter = e => !muscleFilter || e.muscleGroup === muscleFilter || e.extraMuscleGroups?.includes(muscleFilter)
    const visibleExercises = exercises.filter(e => inDay(e) && inFilter(e))
    const isLast = dayIdx === days.length - 1

    return (
      <div className="min-h-screen bg-gray-900 flex flex-col max-w-md mx-auto">
        {/* Header */}
        <div className="px-4 pt-12 pb-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => dayIdx === 0 ? setStep('split') : setDayIdx(i => i - 1)} className="text-gray-400">
              <ChevronLeft size={20} />
            </button>
            <span className="text-xs text-gray-500">Day {dayIdx + 1} of {days.length}</span>
            <button onClick={isLast ? finish : () => setDayIdx(i => i + 1)} className="text-brand text-sm font-semibold">
              {isLast ? 'Finish' : 'Skip'}
            </button>
          </div>
          <h2 className="text-lg font-bold text-white mt-2">{currentDay.name}</h2>
          <p className="text-xs text-gray-500 mb-3">Select your go-to exercises (optional)</p>

          {/* Muscle filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setMuscleFilter(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !muscleFilter ? 'bg-brand/20 border-brand text-brand' : 'border-gray-700 text-gray-400'
              }`}
            >
              All
            </button>
            {muscleGroups.map(g => (
              <button
                key={g}
                onClick={() => setMuscleFilter(muscleFilter === g ? null : g)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  muscleFilter === g ? 'border-transparent text-black' : 'border-gray-700 text-gray-400'
                }`}
                style={muscleFilter === g ? { backgroundColor: MUSCLE_COLORS[g] } : {}}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: muscleFilter === g ? 'rgba(0,0,0,0.4)' : MUSCLE_COLORS[g] }} />
                {MUSCLE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1 pb-32">
          {visibleExercises.map(ex => {
            const on = selected.has(ex.id)
            return (
              <button
                key={ex.id}
                onClick={() => toggleExercise(currentDay.id, ex.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/60 text-left active:bg-gray-800"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-brand border-brand' : 'border-gray-600'}`}>
                  {on && <Check size={11} strokeWidth={3} className="text-black" />}
                </div>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MUSCLE_COLORS[ex.muscleGroup] }} />
                <div>
                  <p className="text-sm text-white">{ex.name}</p>
                  <p className="text-xs text-gray-500">{MUSCLE_LABELS[ex.muscleGroup]}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800 max-w-md mx-auto">
          <button
            onClick={isLast ? finish : () => setDayIdx(i => i + 1)}
            className="w-full bg-brand text-black font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            {isLast ? (
              <><Check size={18} /> Finish Setup</>
            ) : (
              <>Next: {days[dayIdx + 1]?.name} <ChevronRight size={18} /></>
            )}
          </button>
          {selected.size > 0 && (
            <p className="text-center text-xs text-gray-500 mt-2">{selected.size} exercise{selected.size !== 1 ? 's' : ''} selected</p>
          )}
        </div>
      </div>
    )
  }

  return null
}
