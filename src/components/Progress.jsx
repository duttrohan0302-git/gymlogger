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

// ── Tooltips ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pt = payload[0]?.payload
  if (!pt) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs shadow-xl min-w-32">
      <p className="text-gray-400 mb-2 font-medium">{formatDate(label)}</p>
      {pt.weight != null && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Weight</span>
          <span className="text-white font-semibold">{pt.weight}kg</span>
        </div>
      )}
      {pt.reps != null && (
        <div className="flex justify-between gap-4 mt-1">
          <span className="text-gray-400">Reps</span>
          <span className="text-white font-semibold">{pt.reps}</span>
        </div>
      )}
    </div>
  )
}

function MultiExTooltip({ active, payload, label, chartLines }) {
  if (!active || !payload?.length) return null
  const pt = payload[0]?.payload
  if (!pt) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs shadow-xl min-w-40">
      <p className="text-gray-400 mb-2 font-medium">{formatDate(label)}</p>
      {chartLines.map((ex, i) => {
        const w = pt[`${ex.id}_weight`]
        const r = pt[`${ex.id}_reps`]
        if (w == null && r == null) return null
        return (
          <div key={ex.id} className="mb-1.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
              <span className="text-gray-400 truncate">{ex.name}</span>
            </div>
            {w != null && <p className="pl-3 text-white font-semibold">{w}kg × {r}r</p>}
          </div>
        )
      })}
    </div>
  )
}

// ── Table components ──────────────────────────────────────────────────────────

function StatsBar({ history }) {
  if (!history.length) return null
  const prWeight = history.reduce((b, e) => e.weight > (b?.weight ?? -1) ? e : b, null)
  const prReps   = history.reduce((b, e) => e.reps   > (b?.reps   ?? -1) ? e : b, null)
  const prVol    = history.reduce((b, e) => e.volume  > (b?.volume  ?? -1) ? e : b, null)
  const avgVol   = Math.round(history.reduce((s, e) => s + e.volume, 0) / history.length)

  return (
    <div className="grid grid-cols-2 gap-2 mb-4">
      {[
        { label: 'PR Weight', value: `${prWeight.weight}kg`, sub: formatDate(prWeight.date) },
        { label: 'PR Reps',   value: prReps.reps,           sub: formatDate(prReps.date)   },
        { label: 'Sessions',  value: history.length,        sub: `since ${formatDate(history[0].date)}` },
        { label: 'Avg Vol',   value: avgVol,                sub: `best ${prVol.volume}` },
      ].map(({ label, value, sub }) => (
        <div key={label} className="bg-gray-700/50 rounded-xl p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-base font-bold text-white">{value}</p>
          <p className="text-[10px] text-gray-500 mt-0.5 truncate">{sub}</p>
        </div>
      ))}
    </div>
  )
}

function HistoryTable({ history }) {
  const rows = [...history].reverse()
  const prWeightVal = Math.max(...history.map(h => h.weight))
  const prRepsVal   = Math.max(...history.map(h => h.reps))
  const prVolVal    = Math.max(...history.map(h => h.volume))

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs min-w-[280px]">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left pb-2.5 text-gray-500 font-semibold">Date</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">Wt</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">Reps</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">W×R</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">Vol</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(entry => {
            const wtPR  = entry.weight === prWeightVal
            const repPR = entry.reps   === prRepsVal
            const volPR = entry.volume === prVolVal
            return (
              <tr key={entry.date} className="border-b border-gray-800/60">
                <td className="py-2.5 text-gray-400 pr-2">{formatDate(entry.date)}</td>
                <td className={`py-2.5 text-right font-mono ${wtPR ? 'text-brand font-bold' : 'text-white'}`}>
                  {entry.weight}
                </td>
                <td className={`py-2.5 text-right font-mono ${repPR ? 'text-brand font-bold' : 'text-white'}`}>
                  {entry.reps}
                </td>
                <td className="py-2.5 text-right font-mono text-gray-300">
                  {entry.weight}×{entry.reps}
                </td>
                <td className={`py-2.5 text-right font-mono ${volPR ? 'text-brand font-bold' : 'text-gray-500'}`}>
                  {entry.volume}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Mini card (muscle group mode) ─────────────────────────────────────────────

function MiniExerciseCard({ exercise, sessions, metric, color, viewType }) {
  const history = useMemo(() => getHistory(sessions, exercise.id), [sessions, exercise.id])

  const chartData = useMemo(() => history.map(h => ({
    date: h.date,
    v: metric.id === 'weight' ? h.weight : metric.id === 'reps' ? h.reps : h.volume,
    w: h.weight,
    r: h.reps,
    weight: h.weight,
    reps: h.reps,
  })), [history, metric])

  const latest = history[history.length - 1]

  if (!history.length) return null

  return (
    <div className="bg-gray-800 rounded-2xl p-4 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{exercise.name}</p>
          {latest && (
            <p className="text-xs text-gray-500 mt-0.5">
              Last: <span className="text-gray-300">{latest.weight}kg × {latest.reps}r</span>
              <span className="ml-1 text-gray-600">{formatDate(latest.date)}</span>
            </p>
          )}
        </div>
        <span className="text-[10px] text-gray-600 ml-2">{history.length} sessions</span>
      </div>

      {viewType === 'graph' ? (
        <>
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
              <Tooltip content={<ChartTooltip />} />
              {metric.id === 'both' ? (
                <>
                  <Line yAxisId="left" type="monotone" dataKey="w"
                    stroke={color} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls={false} />
                  <Line yAxisId="right" type="monotone" dataKey="r"
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
                <span className="text-[11px] text-gray-400">kg</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 border-t-2 border-dashed border-gray-500" />
                <span className="text-[11px] text-gray-400">reps</span>
              </div>
            </div>
          )}
        </>
      ) : (
        <HistoryTable history={history} />
      )}
    </div>
  )
}

// ── Exercise picker sheet ─────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export default function Progress() {
  const { state } = useStore()
  const { data } = state
  const sessions = data.sessions || []
  const exercises = data.exercises || []
  const movementGroups = data.movementGroups || []

  const [viewMode, setViewMode] = useState('exercise') // 'exercise' | 'muscle'
  const [viewType, setViewType] = useState('graph')    // 'graph' | 'table'
  const [selectedExId, setSelectedExId] = useState(null)
  const [selectedMuscle, setSelectedMuscle] = useState(null)
  const [groupView, setGroupView] = useState(false)
  const [metric, setMetric] = useState(METRICS[0])
  const [showPicker, setShowPicker] = useState(false)

  const selectedEx = exercises.find(e => e.id === selectedExId)
  const movGroup = selectedEx ? movementGroups.find(g => g.exerciseIds.includes(selectedEx.id)) : null

  const muscleExercises = useMemo(() => {
    if (!selectedMuscle) return []
    return exercises
      .filter(e => e.muscleGroup === selectedMuscle)
      .filter(e => sessions.some(s => s.exercises?.some(ex => ex.exerciseId === e.id)))
  }, [selectedMuscle, exercises, sessions])

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
        point[`${ex.id}_weight`] = entry?.weight ?? null
        point[`${ex.id}_reps`]   = entry?.reps   ?? null
      }
      if (chartLines.length === 1) {
        const entry = allHistory[chartLines[0].id]?.find(p => p.date === date)
        point.weight = entry?.weight ?? null
        point.reps   = entry?.reps   ?? null
      }
      return point
    })
  }, [chartLines, allHistory, metric])

  const singleHistory = useMemo(() =>
    selectedEx ? getHistory(sessions, selectedEx.id) : []
  , [selectedEx, sessions])

  const hasSelection = viewMode === 'exercise' ? !!selectedEx : !!selectedMuscle

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Progress</h1>

        {/* View mode: Exercise / Muscle Group */}
        <div className="flex bg-gray-800 rounded-xl p-1 mb-4">
          {[['exercise', 'Exercise'], ['muscle', 'Muscle Group']].map(([id, label]) => (
            <button key={id} onClick={() => setViewMode(id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${viewMode === id ? 'bg-brand text-black' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Muscle group pills */}
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

        {/* Exercise picker button */}
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

        {/* Controls row: Graph/Table + Metric (metric only in graph mode) */}
        {hasSelection && (
          <div className="flex gap-2 mb-4">
            <div className="flex bg-gray-800 rounded-xl p-1 flex-shrink-0">
              {[['graph', 'Graph'], ['table', 'Table']].map(([id, label]) => (
                <button key={id} onClick={() => setViewType(id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${viewType === id ? 'bg-brand text-black' : 'text-gray-500'}`}>
                  {label}
                </button>
              ))}
            </div>
            {viewType === 'graph' && (
              <div className="flex bg-gray-800 rounded-xl p-1 flex-1">
                {METRICS.map(m => (
                  <button key={m.id} onClick={() => setMetric(m)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${metric.id === m.id ? 'bg-gray-600 text-white' : 'text-gray-500'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MUSCLE GROUP MODE ── */}
        {viewMode === 'muscle' && selectedMuscle && (
          muscleExercises.length === 0 ? (
            <div className="bg-gray-800 rounded-2xl p-8 text-center">
              <p className="text-gray-600 text-sm">No data logged yet for {MUSCLE_LABELS[selectedMuscle]}</p>
            </div>
          ) : (
            muscleExercises.map((ex, i) => (
              <MiniExerciseCard
                key={ex.id}
                exercise={ex}
                sessions={sessions}
                metric={metric}
                color={LINE_COLORS[i % LINE_COLORS.length]}
                viewType={viewType}
              />
            ))
          )
        )}

        {/* ── EXERCISE MODE ── */}
        {viewMode === 'exercise' && selectedEx && (
          <>
            {viewType === 'table' ? (
              /* Table view */
              <div className="bg-gray-800 rounded-2xl p-4">
                <StatsBar history={singleHistory} />
                {singleHistory.length > 0 ? (
                  <HistoryTable history={singleHistory} />
                ) : (
                  <p className="text-gray-600 text-sm text-center py-4">No data yet</p>
                )}
              </div>
            ) : (
              /* Graph view */
              <>
                {/* Movement group toggle + PR */}
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
                    {!groupView && singleHistory.length > 0 && (() => {
                      const pr = singleHistory.reduce((best, e) => {
                        const val = metric.id === 'weight' ? e.weight : metric.id === 'reps' ? e.reps : e.volume
                        const bval = best ? (metric.id === 'weight' ? best.weight : metric.id === 'reps' ? best.reps : best.volume) : -1
                        return val > bval ? e : best
                      }, null)
                      if (!pr) return null
                      return (
                        <div className="text-right">
                          <p className="text-[10px] text-brand uppercase font-semibold tracking-wider">PR</p>
                          <p className="text-lg font-bold text-white">
                            {metric.id === 'weight' ? `${pr.weight}kg` : metric.id === 'reps' ? `${pr.reps}r` : pr.volume}
                          </p>
                          <p className="text-[11px] text-gray-500">{formatDate(pr.date)}</p>
                        </div>
                      )
                    })()}
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
                        <Tooltip content={chartLines.length > 1
                          ? <MultiExTooltip chartLines={chartLines} />
                          : <ChartTooltip />} />
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
