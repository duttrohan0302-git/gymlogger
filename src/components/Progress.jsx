import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import { useStore } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

const LINE_COLORS = ['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#eab308', '#06b6d4']
const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']

const METRICS = [
  { id: 'weight', label: 'Weight', unit: 'kg' },
  { id: 'reps', label: 'Reps', unit: 'reps' },
  { id: 'volume', label: 'Volume', unit: 'kg·r' },
  { id: 'both', label: 'W+R', unit: '' },
]

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getHistory(sessions, exerciseId) {
  return sessions
    .filter(s => s.exercises?.some(e => e.exerciseId === exerciseId))
    .map(s => {
      const ex = s.exercises.find(e => e.exerciseId === exerciseId)
      const valid = ex.sets.filter(st => st.weight != null && st.reps != null)
      if (!valid.length) return null
      const bestSet = valid.reduce((b, st) => st.weight > (b?.weight ?? -1) ? st : b, null)
      const totalVolume = Math.round(valid.reduce((sum, st) => sum + st.weight * st.reps, 0))
      return { date: s.date, weight: bestSet.weight, reps: bestSet.reps, volume: totalVolume }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs shadow-xl min-w-36">
      <p className="text-gray-400 mb-2 font-medium">{formatDate(label)}</p>
      {payload.map((p, i) => p.value != null && (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-white font-semibold ml-1">
            {p.value}{metric.id === 'reps' ? 'r' : metric.id === 'volume' ? 'v' : 'kg'}
            {p.name.endsWith('(reps)') ? 'r' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

function MiniExerciseChart({ exercise, sessions, metric, color }) {
  const history = useMemo(() => getHistory(sessions, exercise.id), [sessions, exercise.id])

  const chartData = useMemo(() => history.map(h => {
    if (metric.id === 'both') return { date: h.date, w: h.weight, r: h.reps }
    return {
      date: h.date,
      v: metric.id === 'weight' ? h.weight : metric.id === 'reps' ? h.reps : h.volume,
    }
  }), [history, metric])

  const pr = useMemo(() => history.reduce((best, e) => {
    const val = metric.id === 'weight' ? e.weight : metric.id === 'reps' ? e.reps : e.volume
    const bval = best ? (metric.id === 'weight' ? best.weight : metric.id === 'reps' ? best.reps : best.volume) : -1
    return val > bval ? e : best
  }, null), [history, metric])

  const latest = history[history.length - 1]
  const latestVal = latest
    ? (metric.id === 'weight' ? `${latest.weight}kg` : metric.id === 'reps' ? `${latest.reps}r` : `${latest.volume}`)
    : null

  if (!history.length) return null

  return (
    <div className="bg-gray-800 rounded-2xl p-4 mb-3">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{exercise.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {latestVal && (
              <span className="text-xs text-gray-400">
                Last: <span className="text-gray-300 font-medium">{latestVal}</span>
                <span className="text-gray-600 ml-1">{formatDate(latest.date)}</span>
              </span>
            )}
          </div>
        </div>
        {pr && metric.id !== 'both' && (
          <div className="text-right ml-3 flex-shrink-0">
            <p className="text-[10px] text-brand uppercase font-semibold tracking-wider">PR</p>
            <p className="text-base font-bold text-white">
              {metric.id === 'weight' ? `${pr.weight}kg` : metric.id === 'reps' ? `${pr.reps}r` : pr.volume}
            </p>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={chartData} margin={{ top: 4, right: metric.id === 'both' ? 32 : 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6b7280"
            tick={{ fontSize: 9, fill: '#6b7280' }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 9, fill: '#6b7280' }} width={32}
            tickFormatter={v => metric.id === 'both' ? `${v}k` : v} />
          {metric.id === 'both' && (
            <YAxis yAxisId="right" orientation="right" stroke="#6b7280"
              tick={{ fontSize: 9, fill: '#6b7280' }} width={28} tickFormatter={v => `${v}r`} />
          )}
          <Tooltip content={<CustomTooltip metric={metric} />} />
          {metric.id === 'both' ? (
            <>
              <Line yAxisId="left" type="monotone" dataKey="w" name="weight (kg)"
                stroke={color} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />
              <Line yAxisId="right" type="monotone" dataKey="r" name="reps (reps)"
                stroke="#6b7280" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />
            </>
          ) : (
            <Line yAxisId="left" type="monotone" dataKey="v" name={exercise.name}
              stroke={color} strokeWidth={2.5}
              dot={{ r: 3, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />
          )}
        </LineChart>
      </ResponsiveContainer>

      {metric.id === 'both' && (
        <div className="flex gap-4 mt-2 pt-2 border-t border-gray-700">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-gray-400">kg (left axis)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 border-t-2 border-dashed border-gray-500" />
            <span className="text-[11px] text-gray-400">reps (right axis)</span>
          </div>
        </div>
      )}
    </div>
  )
}

function ExercisePickerSheet({ exercises, sessions, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const grouped = useMemo(() => {
    if (query) return [{ group: null, items: exercises.filter(e => e.name.toLowerCase().includes(query.toLowerCase())) }]
    return MUSCLE_ORDER.map(group => ({ group, items: exercises.filter(e => e.muscleGroup === group) })).filter(g => g.items.length)
  }, [exercises, query])
  const hasData = id => sessions.some(s => s.exercises?.some(e => e.exerciseId === id))

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-semibold text-white flex-1">Select Exercise</h2>
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>
        <div className="flex items-center bg-gray-800 rounded-xl px-3 gap-2">
          <Search size={15} className="text-gray-500" />
          <input autoFocus type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search…" className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder-gray-600" />
          {query && <button onClick={() => setQuery('')} className="text-gray-500"><X size={14} /></button>}
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {grouped.map(({ group, items }) => (
          <div key={group || 'search'}>
            {group && (
              <div className="flex items-center gap-2 px-4 pt-5 pb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[group] }} />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{MUSCLE_LABELS[group]}</span>
              </div>
            )}
            {items.map(ex => {
              const active = hasData(ex.id)
              return (
                <button key={ex.id} onClick={() => { onSelect(ex.id); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 text-left active:bg-gray-800">
                  <div className="flex-1">
                    <p className={`text-sm ${active ? 'text-white' : 'text-gray-500'}`}>{ex.name}</p>
                  </div>
                  {active && <span className="text-[10px] text-brand font-medium">data</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Progress() {
  const { state } = useStore()
  const { data } = state
  const sessions = data.sessions || []
  const exercises = data.exercises || []
  const movementGroups = data.movementGroups || []

  const [viewMode, setViewMode] = useState('exercise') // 'exercise' | 'muscle'
  const [selectedExId, setSelectedExId] = useState(null)
  const [selectedMuscle, setSelectedMuscle] = useState(null)
  const [groupView, setGroupView] = useState(false)
  const [metric, setMetric] = useState(METRICS[0])
  const [showPicker, setShowPicker] = useState(false)

  const selectedEx = exercises.find(e => e.id === selectedExId)
  const movGroup = selectedEx ? movementGroups.find(g => g.exerciseIds.includes(selectedEx.id)) : null

  // Exercises with data for selected muscle group
  const muscleExercises = useMemo(() => {
    if (!selectedMuscle) return []
    return exercises
      .filter(e => e.muscleGroup === selectedMuscle)
      .filter(e => sessions.some(s => s.exercises?.some(ex => ex.exerciseId === e.id)))
  }, [selectedMuscle, exercises, sessions])

  // For single exercise mode
  const chartLines = useMemo(() => {
    if (!selectedEx) return []
    if (groupView && movGroup) {
      return movGroup.exerciseIds
        .map(id => exercises.find(e => e.id === id))
        .filter(Boolean)
        .filter(e => sessions.some(s => s.exercises?.some(ex => ex.exerciseId === e.id)))
    }
    return [selectedEx]
  }, [selectedEx, groupView, movGroup, exercises, sessions])

  const allHistory = useMemo(() => {
    const h = {}
    for (const ex of chartLines) h[ex.id] = getHistory(sessions, ex.id)
    return h
  }, [chartLines, sessions])

  const chartData = useMemo(() => {
    if (!chartLines.length) return []
    const allDates = [...new Set(Object.values(allHistory).flatMap(h => h.map(p => p.date)))].sort()
    return allDates.map(date => {
      const point = { date }
      for (const ex of chartLines) {
        const entry = allHistory[ex.id]?.find(p => p.date === date)
        if (metric.id === 'both') {
          point[`${ex.id}_w`] = entry?.weight ?? null
          point[`${ex.id}_r`] = entry?.reps ?? null
        } else {
          point[ex.id] = entry
            ? metric.id === 'weight' ? entry.weight : metric.id === 'reps' ? entry.reps : entry.volume
            : null
        }
      }
      return point
    })
  }, [chartLines, allHistory, metric])

  const pr = useMemo(() => {
    if (!selectedEx) return null
    const h = getHistory(sessions, selectedEx.id)
    if (!h.length) return null
    return h.reduce((best, e) => {
      const val = metric.id === 'weight' ? e.weight : metric.id === 'reps' ? e.reps : e.volume
      const bval = best ? (metric.id === 'weight' ? best.weight : metric.id === 'reps' ? best.reps : best.volume) : -1
      return val > bval ? e : best
    }, null)
  }, [selectedEx, sessions, metric])

  const hasSelection = viewMode === 'exercise' ? !!selectedEx : !!selectedMuscle

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Progress</h1>

        {/* View mode toggle */}
        <div className="flex bg-gray-800 rounded-xl p-1 mb-4">
          {[['exercise', 'Exercise'], ['muscle', 'Muscle Group']].map(([id, label]) => (
            <button key={id} onClick={() => setViewMode(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${viewMode === id ? 'bg-brand text-black' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Muscle group picker (muscle mode) */}
        {viewMode === 'muscle' && (
          <div className="flex flex-wrap gap-2 mb-4">
            {MUSCLE_ORDER.map(g => (
              <button key={g} onClick={() => setSelectedMuscle(g)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium transition-colors ${
                  selectedMuscle === g ? 'border-transparent text-black' : 'border-gray-700 text-gray-400'
                }`}
                style={selectedMuscle === g ? { backgroundColor: MUSCLE_COLORS[g] } : {}}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedMuscle === g ? 'rgba(0,0,0,0.4)' : MUSCLE_COLORS[g] }} />
                {MUSCLE_LABELS[g]}
              </button>
            ))}
          </div>
        )}

        {/* Exercise picker (exercise mode) */}
        {viewMode === 'exercise' && (
          <button onClick={() => setShowPicker(true)}
            className="w-full flex items-center bg-gray-800 rounded-xl px-4 py-3.5 mb-4 text-left">
            {selectedEx ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MUSCLE_COLORS[selectedEx.muscleGroup] }} />
                <span className="text-sm text-white font-medium">{selectedEx.name}</span>
                <span className="text-xs text-gray-500 ml-1">{MUSCLE_LABELS[selectedEx.muscleGroup]}</span>
              </div>
            ) : (
              <span className="text-sm text-gray-500 flex-1">Select an exercise…</span>
            )}
            <Search size={16} className="text-gray-500" />
          </button>
        )}

        {showPicker && (
          <ExercisePickerSheet exercises={exercises} sessions={sessions}
            onSelect={id => { setSelectedExId(id); setGroupView(false) }}
            onClose={() => setShowPicker(false)} />
        )}

        {/* Metric selector — shown whenever something is selected */}
        {hasSelection && (
          <div className="flex bg-gray-800 rounded-xl p-1 mb-4">
            {METRICS.map(m => (
              <button key={m.id} onClick={() => setMetric(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${metric.id === m.id ? 'bg-brand text-black' : 'text-gray-500'}`}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        {/* MUSCLE GROUP MODE — stacked individual charts */}
        {viewMode === 'muscle' && selectedMuscle && (
          <>
            {muscleExercises.length === 0 ? (
              <div className="bg-gray-800 rounded-2xl p-8 text-center">
                <p className="text-gray-600 text-sm">No data logged yet for {MUSCLE_LABELS[selectedMuscle]}</p>
              </div>
            ) : (
              muscleExercises.map((ex, i) => (
                <MiniExerciseChart
                  key={ex.id}
                  exercise={ex}
                  sessions={sessions}
                  metric={metric}
                  color={LINE_COLORS[i % LINE_COLORS.length]}
                />
              ))
            )}
          </>
        )}

        {/* EXERCISE MODE — single exercise chart */}
        {viewMode === 'exercise' && selectedEx && (
          <>
            {/* Controls row */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {movGroup && (
                    <button onClick={() => setGroupView(v => !v)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${groupView ? 'bg-brand/20 border-brand text-brand' : 'border-gray-700 text-gray-500'}`}>
                      {groupView ? '✓ ' : ''}{movGroup.name}
                    </button>
                  )}
                </div>
                {pr && !groupView && (
                  <div className="text-right">
                    <p className="text-[10px] text-brand uppercase font-semibold tracking-wider">PR</p>
                    <p className="text-lg font-bold text-white">
                      {metric.id === 'weight' ? `${pr.weight}kg` : metric.id === 'reps' ? `${pr.reps}r` : `${pr.volume}`}
                    </p>
                    <p className="text-[11px] text-gray-500">{formatDate(pr.date)}</p>
                  </div>
                )}
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="bg-gray-800 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: metric.id === 'both' ? 36 : 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6b7280"
                      tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" stroke="#6b7280" tick={{ fontSize: 10, fill: '#6b7280' }} width={36}
                      tickFormatter={v => metric.id === 'both' ? `${v}kg` : v} />
                    {metric.id === 'both' && (
                      <YAxis yAxisId="right" orientation="right" stroke="#6b7280"
                        tick={{ fontSize: 10, fill: '#6b7280' }} width={36} tickFormatter={v => `${v}r`} />
                    )}
                    <Tooltip content={<CustomTooltip metric={metric} />} />
                    {metric.id === 'both' ? (
                      chartLines.map((ex, i) => [
                        <Line key={`${ex.id}_w`} yAxisId="left" type="monotone" dataKey={`${ex.id}_w`}
                          name={`${ex.name} (kg)`} stroke={LINE_COLORS[i * 2 % LINE_COLORS.length]}
                          strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />,
                        <Line key={`${ex.id}_r`} yAxisId="right" type="monotone" dataKey={`${ex.id}_r`}
                          name={`${ex.name} (reps)`} stroke={LINE_COLORS[(i * 2 + 1) % LINE_COLORS.length]}
                          strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />,
                      ])
                    ) : (
                      chartLines.map((ex, i) => (
                        <Line key={ex.id} yAxisId="left" type="monotone" dataKey={ex.id} name={ex.name}
                          stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.5}
                          dot={{ r: 3, fill: LINE_COLORS[i % LINE_COLORS.length], strokeWidth: 0 }}
                          activeDot={{ r: 5 }} connectNulls={false} />
                      ))
                    )}
                  </LineChart>
                </ResponsiveContainer>

                {/* Legend for grouped view */}
                {(chartLines.length > 1 || metric.id === 'both') && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-gray-700">
                    {metric.id === 'both' ? chartLines.map((ex, i) => [
                      <div key={`${ex.id}_w`} className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: LINE_COLORS[i * 2 % LINE_COLORS.length] }} />
                        <span className="text-[11px] text-gray-400">{ex.name} kg</span>
                      </div>,
                      <div key={`${ex.id}_r`} className="flex items-center gap-1.5">
                        <span className="w-3 border-t-2 border-dashed" style={{ borderColor: LINE_COLORS[(i * 2 + 1) % LINE_COLORS.length] }} />
                        <span className="text-[11px] text-gray-400">{ex.name} reps</span>
                      </div>,
                    ]) : chartLines.map((ex, i) => (
                      <div key={ex.id} className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
                        <span className="text-[11px] text-gray-400">{ex.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl p-8 text-center">
                <p className="text-gray-600 text-sm">No data logged yet</p>
              </div>
            )}
          </>
        )}

        {!hasSelection && (
          <div className="py-16 text-center">
            <p className="text-gray-600 text-sm">
              {viewMode === 'muscle' ? 'Tap a muscle group above' : 'Select an exercise to see your progress'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
