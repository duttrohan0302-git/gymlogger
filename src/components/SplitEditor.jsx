import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS, SPLIT_TEMPLATES } from '../data/defaultData'

export default function SplitEditor({ onClose }) {
  const { state, dispatch } = useStore()
  const exercises = state.data.exercises || []

  const [step, setStep] = useState('template') // 'template' | 'exercises'
  const [template, setTemplate] = useState(null)
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

  const save = () => {
    const uid = state.activeUserId
    const map = {}
    for (const [dayId, set] of Object.entries(dayExercises)) map[dayId] = [...set]
    const splitDays = days.map(day => ({
      ...day,
      id: `${uid}_${day.id}`,
      defaultExerciseIds: map[day.id] || [],
    }))
    dispatch({
      type: 'UPDATE_SPLIT',
      split: { id: `${uid}_split_${Date.now()}`, name: template.name, isActive: true, days: splitDays },
    })
    onClose()
  }

  // ── Template picker ────────────────────────────────────────────────────────
  if (step === 'template') {
    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col max-w-md mx-auto">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-gray-800">
          <button onClick={onClose} className="text-gray-400"><X size={22} /></button>
          <h2 className="text-lg font-bold text-white flex-1">Change Split</h2>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
          {SPLIT_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => { setTemplate(t); setDayExercises({}); setDayIdx(0); setMuscleFilter(null); setStep('exercises') }}
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

  // ── Exercise selection ─────────────────────────────────────────────────────
  if (step === 'exercises' && currentDay) {
    const muscleGroups = currentDay.muscleGroups
    const selected = dayExercises[currentDay.id] || new Set()
    const isLast = dayIdx === days.length - 1
    const inDay = e => muscleGroups.includes(e.muscleGroup) || e.extraMuscleGroups?.some(g => muscleGroups.includes(g))
    const inFilter = e => !muscleFilter || e.muscleGroup === muscleFilter || e.extraMuscleGroups?.includes(muscleFilter)
    const visibleExercises = exercises.filter(e => inDay(e) && inFilter(e))

    return (
      <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col max-w-md mx-auto">
        <div className="px-4 pt-12 pb-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => dayIdx === 0 ? setStep('template') : setDayIdx(i => i - 1)}
              className="text-gray-400"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-xs text-gray-500">Day {dayIdx + 1} of {days.length}</span>
            <button onClick={isLast ? save : () => setDayIdx(i => i + 1)} className="text-brand text-sm font-semibold">
              {isLast ? 'Save' : 'Skip'}
            </button>
          </div>
          <h2 className="text-lg font-bold text-white mt-2">{currentDay.name}</h2>
          <p className="text-xs text-gray-500 mb-3">Select default exercises for this day</p>

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

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800 max-w-md mx-auto">
          <button
            onClick={isLast ? save : () => setDayIdx(i => i + 1)}
            className="w-full bg-brand text-black font-bold py-4 rounded-2xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            {isLast ? (
              <><Check size={18} /> Save Split</>
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
