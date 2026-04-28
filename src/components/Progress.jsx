import { useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import { useStore } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

const LINE_COLORS = ['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#eab308']
const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']

const METRICS = [
  { id: 'weight', label: 'Weight', unit: 'kg' },
  { id: 'reps', label: 'Reps', unit: 'reps' },
  { id: 'volume', label: 'Volume', unit: 'kg·r' },
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
      const totalReps = valid.reduce((sum, st) => sum + st.reps, 0)
      return { date: s.date, weight: bestSet.weight, reps: bestSet.reps, totalReps, volume: totalVolume }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs shadow-xl min-w-32">
      <p className="text-gray-400 mb-2">{formatDate(label)}</p>
      {payload.map((p, i) => {
        const entry = p.payload
        return (
          <div key={i} className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-white font-semibold">{p.value}{metric.unit === 'reps' ? ' reps' : metric.unit === 'kg·r' ? ' kg·r' : 'kg'}</span>
            </div>
            {metric.id === 'weight' && entry.reps && (
              <p className="text-gray-500 pl-4">{entry.reps} reps</p>
            )}
            {metric.id === 'reps' && entry.weight && (
              <p className="text-gray-500 pl-4">@ {entry.weight}kg</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ExercisePickerSheet({ exercises, sessions, onSelect, onClose }) {
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    if (query) {
      return [{
        group: null,
        items: exercises.filter(e => e.name.toLowerCase().includes(query.toLowerCase())),
      }]
    }
    return MUSCLE_ORDER.map(group => ({
      group,
      items: exercises.filter(e => e.muscleGroup === group),
    })).filter(g => g.items.length > 0)
  }, [exercises, query])

  const hasData = (id) => sessions.some(s => s.exercises?.some(e => e.exerciseId === id))

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-base font-semibold text-white flex-1">Select Exercise</h2>
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>
        <div className="flex items-center bg-gray-800 rounded-xl px-3 gap-2">
          <Search size={15} className="text-gray-500" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder-gray-600"
          />
          {query && <button onClick={() => setQuery('')} className="text-gray-500"><X size={14} /></button>}
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {grouped.map(({ group, items }) => (
          <div key={group || 'search'}>
            {group && (
              <div className="flex items-center gap-2 px-4 pt-5 pb-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[group] }} />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {MUSCLE_LABELS[group]}
                </span>
              </div>
            )}
            {items.map(ex => {
              const active = hasData(ex.id)
              return (
                <button
                  key={ex.id}
                  onClick={() => { onSelect(ex.id); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-800/40 text-left active:bg-gray-800"
                >
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

  const [selectedExId, setSelectedExId] = useState(null)
  const [groupView, setGroupView] = useState(false)
  const [metric, setMetric] = useState(METRICS[0])
  const [showPicker, setShowPicker] = useState(false)

  const selectedEx = exercises.find(e => e.id === selectedExId)
  const movGroup = selectedEx ? movementGroups.find(g => g.exerciseIds.includes(selectedEx.id)) : null

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
        if (entry) {
          point[ex.id] = metric.id === 'weight' ? entry.weight
            : metric.id === 'reps' ? entry.reps
            : entry.volume
          // store full entry for tooltip
          point[`_${ex.id}`] = entry
        } else {
          point[ex.id] = null
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

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Progress</h1>

        {/* Exercise selector */}
        <button
          onClick={() => setShowPicker(true)}
          className="w-full flex items-center bg-gray-800 rounded-xl px-4 py-3.5 mb-4 text-left"
        >
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

        {showPicker && (
          <ExercisePickerSheet
            exercises={exercises}
            sessions={sessions}
            onSelect={id => { setSelectedExId(id); setGroupView(false) }}
            onClose={() => setShowPicker(false)}
          />
        )}

        {selectedEx && (
          <>
            {/* PR card */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {movGroup && (
                    <button
                      onClick={() => setGroupView(v => !v)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        groupView ? 'bg-brand/20 border-brand text-brand' : 'border-gray-700 text-gray-500'
                      }`}
                    >
                      {groupView ? '✓ ' : ''}{movGroup.name} group
                    </button>
                  )}
                </div>
                {pr && (
                  <div className="text-right">
                    <p className="text-[10px] text-brand uppercase font-semibold tracking-wider">PR</p>
                    <p className="text-xl font-bold text-white">
                      {metric.id === 'weight' ? `${pr.weight}kg`
                        : metric.id === 'reps' ? `${pr.reps} reps`
                        : `${pr.volume} kg·r`}
                    </p>
                    <p className="text-[11px] text-gray-500">{formatDate(pr.date)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Metric toggle */}
            <div className="flex bg-gray-800 rounded-xl p-1 mb-3">
              {METRICS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMetric(m)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    metric.id === m.id ? 'bg-brand text-black' : 'text-gray-500'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Chart */}
            {chartData.length > 0 ? (
              <div className="bg-gray-800 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      stroke="#6b7280"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#6b7280"
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      width={36}
                      tickFormatter={v => metric.id === 'reps' ? v : `${v}`}
                    />
                    <Tooltip content={<CustomTooltip metric={metric} />} />
                    {chartLines.map((ex, i) => (
                      <Line
                        key={ex.id}
                        type="monotone"
                        dataKey={ex.id}
                        name={ex.name}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: LINE_COLORS[i % LINE_COLORS.length], strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>

                {chartLines.length > 1 && (
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-700">
                    {chartLines.map((ex, i) => (
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
                <p className="text-gray-600 text-sm">No data logged for this exercise yet</p>
              </div>
            )}
          </>
        )}

        {!selectedEx && (
          <div className="py-16 text-center">
            <p className="text-gray-600 text-sm">Select an exercise to see your progress</p>
          </div>
        )}
      </div>
    </div>
  )
}
