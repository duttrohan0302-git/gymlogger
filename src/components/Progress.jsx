import { useState, useMemo } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useStore, getExerciseHistory } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

const LINE_COLORS = ['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#eab308']

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">{formatDate(label)}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="text-white font-semibold">{p.value}kg</span>
        </div>
      ))}
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
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const filtered = useMemo(() => {
    if (!query) return exercises
    return exercises.filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
  }, [exercises, query])

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

  const chartData = useMemo(() => {
    if (!chartLines.length) return []
    const allHistory = {}
    for (const ex of chartLines) {
      allHistory[ex.id] = getExerciseHistory(sessions, ex.id)
    }
    const allDates = [...new Set(Object.values(allHistory).flatMap(h => h.map(p => p.date)))].sort()
    return allDates.map(date => {
      const point = { date }
      for (const ex of chartLines) {
        const entry = allHistory[ex.id]?.find(p => p.date === date)
        point[ex.id] = entry?.maxWeight ?? null
      }
      return point
    })
  }, [chartLines, sessions])

  const prEntry = useMemo(() => {
    if (!selectedEx) return null
    const history = getExerciseHistory(sessions, selectedEx.id)
    if (!history.length) return null
    return history.reduce((best, h) => (!best || (h.maxWeight || 0) > (best.maxWeight || 0)) ? h : best, null)
  }, [selectedEx, sessions])

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Progress</h1>

        {/* Search / Select exercise */}
        <div
          className="flex items-center bg-gray-800 rounded-xl px-3 gap-2 mb-4"
          onClick={() => setShowSearch(true)}
        >
          <Search size={16} className="text-gray-500" />
          <div className="flex-1 py-3 text-sm text-left">
            {selectedEx ? (
              <span className="text-white">{selectedEx.name}</span>
            ) : (
              <span className="text-gray-500">Select an exercise…</span>
            )}
          </div>
          <ChevronDown size={16} className="text-gray-500" />
        </div>

        {showSearch && (
          <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-3">
                <Search size={16} className="text-gray-500" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search exercises…"
                  className="flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder-gray-600"
                />
                <button onClick={() => setShowSearch(false)} className="text-gray-400 text-sm pl-2">Cancel</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.map(ex => {
                const hasData = sessions.some(s => s.exercises?.some(e => e.exerciseId === ex.id))
                return (
                  <button
                    key={ex.id}
                    onClick={() => { setSelectedExId(ex.id); setShowSearch(false); setGroupView(false) }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-800/60 text-left active:bg-gray-800"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MUSCLE_COLORS[ex.muscleGroup] }} />
                    <div className="flex-1">
                      <p className={`text-sm ${hasData ? 'text-white' : 'text-gray-500'}`}>{ex.name}</p>
                      <p className="text-xs text-gray-600">{MUSCLE_LABELS[ex.muscleGroup]}</p>
                    </div>
                    {hasData && <span className="text-[10px] text-brand">data</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {selectedEx && (
          <>
            {/* Exercise header + PR */}
            <div className="bg-gray-800 rounded-2xl p-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[selectedEx.muscleGroup] }} />
                    <span className="text-xs text-gray-400">{MUSCLE_LABELS[selectedEx.muscleGroup]}</span>
                  </div>
                  <h2 className="text-base font-bold text-white">{selectedEx.name}</h2>
                </div>
                {prEntry && (
                  <div className="text-right">
                    <p className="text-[10px] text-brand uppercase font-semibold tracking-wider">PR</p>
                    <p className="text-lg font-bold text-white">{prEntry.maxWeight}kg</p>
                    <p className="text-[11px] text-gray-500">{formatDate(prEntry.date)}</p>
                  </div>
                )}
              </div>

              {movGroup && (
                <button
                  onClick={() => setGroupView(v => !v)}
                  className={`mt-3 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    groupView
                      ? 'bg-brand/20 border-brand text-brand'
                      : 'border-gray-700 text-gray-500'
                  }`}
                >
                  {groupView ? '✓ ' : ''}{movGroup.name} group view
                </button>
              )}
            </div>

            {/* Chart */}
            {chartData.length > 0 ? (
              <div className="bg-gray-800 rounded-2xl p-4">
                <p className="text-xs text-gray-500 mb-4">Best set weight per session (kg)</p>
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
                      tickFormatter={v => `${v}`}
                      width={32}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {chartLines.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                    {chartLines.map((ex, i) => (
                      <Line
                        key={ex.id}
                        type="monotone"
                        dataKey={ex.id}
                        name={ex.name}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3, fill: LINE_COLORS[i % LINE_COLORS.length] }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl p-8 text-center">
                <p className="text-gray-600 text-sm">No data logged yet for this exercise</p>
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
