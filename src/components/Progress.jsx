import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, X, Trophy, ChevronRight, ChevronLeft, Share2 } from 'lucide-react'
import ShareStats from './ShareStats'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar,
} from 'recharts'
import { useStore, localDate } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

const LINE_COLORS = ['#10b981', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899', '#eab308', '#06b6d4']
const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']

const METRICS = [
  { id: 'weight', label: 'Weight', unit: 'kg' },
  { id: 'reps', label: 'Reps', unit: 'reps' },
  { id: 'volume', label: 'Volume', unit: 'kg·r' },
  { id: 'e1rm', label: '1RM', unit: 'kg' },
  { id: 'both', label: 'W+R', unit: '' },
]

function formatDate(d) {
  if (!d) return ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Value of a history point for a metric
const metricVal = (h, id) => id === 'weight' ? h.weight : id === 'reps' ? h.reps : id === 'e1rm' ? h.e1rm : h.volume

// variant: null = all, '__none' = sessions without a variant, otherwise that variant
const variantMatch = (e, variant) => !variant || (variant === '__none' ? !e.variant : e.variant === variant)

function getHistory(sessions, exerciseId, variant = null) {
  return sessions
    .filter(s => s.exercises?.some(e => e.exerciseId === exerciseId && variantMatch(e, variant)))
    .map(s => {
      const pos = s.exercises.findIndex(e => e.exerciseId === exerciseId && variantMatch(e, variant))
      const ex = s.exercises[pos]
      // Bodyweight exercises have reps but no weight: count them as 0 kg
      const valid = ex.sets.filter(st => st.reps != null).map(st => ({ ...st, weight: st.weight ?? 0 }))
      if (!valid.length) return null
      const bestSet = valid.reduce((b, st) =>
        (!b || st.weight > b.weight || (st.weight === b.weight && st.reps > b.reps)) ? st : b, null)
      const totalVolume = Math.round(valid.reduce((sum, st) => sum + st.weight * st.reps, 0))
      // Epley estimated 1-rep max, best set of the session
      const e1rm = Math.round(Math.max(...valid.map(st => st.weight * (1 + st.reps / 30))) * 2) / 2
      return { date: s.date, sessionId: s.id, weight: bestSet.weight, reps: bestSet.reps, volume: totalVolume, e1rm, pos: pos + 1, variant: ex.variant || null }
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
      <p className="text-gray-400 mb-2 font-medium">{formatDate(label)}{pt.pos ? ` · exercise #${pt.pos}` : ''}</p>
      {pt.weight != null && (
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Weight</span>
          <span className="text-white font-semibold">{pt.weight ? `${pt.weight}kg` : 'BW'}</span>
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
        { label: 'PR Weight', value: prWeight.weight ? `${prWeight.weight}kg` : 'BW', sub: formatDate(prWeight.date) },
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

function HistoryTable({ history, onRowClick }) {
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
            <th className="text-center pb-2.5 text-gray-500 font-semibold" title="Position in the workout">#</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">Wt</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">Reps</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">W×R</th>
            <th className="text-right pb-2.5 text-gray-500 font-semibold">Vol</th>
            {onRowClick && <th className="w-4" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(entry => {
            const wtPR  = entry.weight === prWeightVal
            const repPR = entry.reps   === prRepsVal
            const volPR = entry.volume === prVolVal
            return (
              <tr key={entry.sessionId}
                className={`border-b border-gray-800/60 ${onRowClick ? 'active:bg-gray-700/40 cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(entry.sessionId)}>
                <td className="py-2.5 text-gray-400 pr-2">
                  {formatDate(entry.date)}
                  {entry.variant && <span className="block text-[9px] text-gray-600">{entry.variant}</span>}
                </td>
                <td className={`py-2.5 text-center font-mono ${entry.pos > 2 ? 'text-yellow-600' : 'text-gray-600'}`}>{entry.pos}</td>
                <td className={`py-2.5 text-right font-mono ${wtPR ? 'text-brand font-bold' : 'text-white'}`}>
                  {entry.weight || 'BW'}
                </td>
                <td className={`py-2.5 text-right font-mono ${repPR ? 'text-brand font-bold' : 'text-white'}`}>
                  {entry.reps}
                </td>
                <td className="py-2.5 text-right font-mono text-gray-300">
                  {entry.weight || 'BW'}×{entry.reps}
                </td>
                <td className={`py-2.5 text-right font-mono ${volPR ? 'text-brand font-bold' : 'text-gray-500'}`}>
                  {entry.volume}
                </td>
                {onRowClick && (
                  <td className="py-2.5 pl-2 text-gray-600 text-right">›</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Mini card (muscle group mode) ─────────────────────────────────────────────

function MiniExerciseCard({ exercise, sessions, metric, color, viewType, onEditSession }) {
  const history = useMemo(() => getHistory(sessions, exercise.id), [sessions, exercise.id])

  const findSession = date => sessions.find(s => s.date === date && s.exercises?.some(e => e.exerciseId === exercise.id))

  const chartData = useMemo(() => history.map(h => ({
    date: h.date,
    v: metricVal(h, metric.id),
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
              Last: <span className="text-gray-300">{latest.weight ? `${latest.weight}kg` : 'BW'} × {latest.reps}r</span>
              <span className="ml-1 text-gray-600">{formatDate(latest.date)}</span>
            </p>
          )}
        </div>
        <span className="text-[10px] text-gray-600 ml-2">{history.length} sessions</span>
      </div>

      {viewType === 'graph' ? (
        <>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: metric.id === 'both' ? 32 : 8, left: 0, bottom: 4 }}
              onClick={d => {
                if (!onEditSession || !d?.activeLabel) return
                const s = findSession(d.activeLabel)
                if (s) onEditSession(s.id)
              }}
              style={{ cursor: onEditSession ? 'pointer' : 'default' }}
            >
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
        <HistoryTable
          history={history}
          onRowClick={onEditSession ? sessionId => onEditSession(sessionId) : null}
        />
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

// ── Overview (shown before anything is selected) ──────────────────────────────

// Leg exercises split into the muscles they mainly train (by name, so custom exercises work too).
// Main muscle = 1 set, secondary = 0.5. Anything unmatched only counts toward the Legs total.
const LEG_PARTS = [['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['glutes', 'Glutes'], ['calves', 'Calves']]
function legParts(name = '') {
  const n = name.toLowerCase()
  if (/calf|calves/.test(n)) return { calves: 1 }
  if (/hip thrust|glute|kickback|abductor/.test(n)) return { glutes: 1 }
  if (/leg curl|rdl|romanian|deadlift/.test(n)) return /rdl|romanian|deadlift/.test(n) ? { hamstrings: 1, glutes: 0.5 } : { hamstrings: 1 }
  if (/leg extension|hack squat|leg press/.test(n)) return { quads: 1 }
  if (/squat|lunge/.test(n)) return { quads: 1, glutes: 0.5 }
  return {}
}

function weekStart(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)) // Monday
  return localDate(dt)
}

const addDays = (dateStr, n) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + n))
}

function Chips({ options, value, onChange }) {
  return (
    <div className="flex bg-gray-900 rounded-lg p-0.5">
      {options.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`px-2 py-1 rounded-md text-[10px] font-semibold ${value === id ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Overview({ sessions, exercises, onPickExercise }) {
  const exById = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises])
  const [weekRange, setWeekRange] = useSessionState('ovWeeks', '8w')   // '8w' | '6m' | 'all'
  const [muscleOffset, setMuscleOffset] = useState(0)                   // 0 = this week, 1 = last week…
  const [prMode, setPrMode] = useSessionState('ovPRs', 'recent')        // 'recent' | 'all'

  const today = localDate()
  const thisWeek = weekStart(today)
  const firstWeek = sessions.length ? weekStart(sessions.reduce((m, s) => s.date < m ? s.date : m, sessions[0].date)) : thisWeek
  const maxOffset = Math.max(0, Math.round((new Date(thisWeek) - new Date(firstWeek)) / (7 * 864e5)))

  // ── Workouts per week (chosen range) ──
  const weeks = useMemo(() => {
    const n = weekRange === '8w' ? 8 : weekRange === '6m' ? 26 : maxOffset + 1
    const out = []
    for (let i = n - 1; i >= 0; i--) out.push({ week: addDays(thisWeek, -7 * i), count: 0 })
    const byWeek = new Map(out.map(w => [w.week, w]))
    for (const s of sessions) { const w = byWeek.get(weekStart(s.date)); if (w) w.count++ }
    return out
  }, [sessions, weekRange, thisWeek, maxOffset])

  // ── PRs: progression of heaviest best set per exercise ──
  const prData = useMemo(() => {
    const cutoffDt = new Date(); cutoffDt.setDate(cutoffDt.getDate() - 30)
    const cutoff = localDate(cutoffDt)
    const best = new Map()
    const latestPR = new Map()
    const chrono = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    for (const s of chrono) {
      for (const ex of s.exercises || []) {
        const valid = ex.sets.filter(st => st.reps != null).map(st => ({ ...st, weight: st.weight ?? 0 }))
        if (!valid.length) continue
        const top = valid.reduce((b, st) => (st.weight > b.weight || (st.weight === b.weight && st.reps > b.reps)) ? st : b)
        const prev = best.get(ex.exerciseId)
        const isPR = prev && (top.weight > prev.weight || (top.weight === prev.weight && top.reps > prev.reps))
        if (!prev || isPR) best.set(ex.exerciseId, { weight: top.weight, reps: top.reps, date: s.date })
        if (isPR && s.date >= cutoff) latestPR.set(ex.exerciseId, { exerciseId: ex.exerciseId, date: s.date, weight: top.weight, reps: top.reps, prevWeight: prev.weight, prevReps: prev.reps })
      }
    }
    const recent = [...latestPR.values()].sort((a, b) => b.date.localeCompare(a.date))
    // All-time: every exercise's best, grouped by muscle
    const all = MUSCLE_ORDER.map(g => ({
      group: g,
      items: [...best.entries()]
        .filter(([id]) => exById.get(id)?.muscleGroup === g)
        .map(([id, b]) => ({ exerciseId: id, ...b }))
        .sort((a, b) => (exById.get(a.exerciseId)?.name || '').localeCompare(exById.get(b.exerciseId)?.name || '')),
    })).filter(g => g.items.length)
    return { recent, all }
  }, [sessions, exById])

  // ── Sets per muscle for the chosen week vs the 4 weeks before it ──
  const muscle = useMemo(() => {
    const wStart = addDays(thisWeek, -7 * muscleOffset)
    const wEnd = addDays(wStart, 7)
    const pStart = addDays(wStart, -28)
    const setsThis = {}, setsPrev = {}
    for (const s of sessions) {
      const bucket = s.date >= wStart && s.date < wEnd ? setsThis : s.date >= pStart && s.date < wStart ? setsPrev : null
      if (!bucket) continue
      for (const e of s.exercises || []) {
        const info = exById.get(e.exerciseId)
        if (!info) continue
        const n = e.sets.filter(st => st.reps != null).length
        bucket[info.muscleGroup] = (bucket[info.muscleGroup] || 0) + n
        for (const g of info.extraMuscleGroups || []) bucket[g] = (bucket[g] || 0) + n * 0.5
        if (info.muscleGroup === 'legs') {
          for (const [part, w] of Object.entries(legParts(info.name))) bucket[`legs:${part}`] = (bucket[`legs:${part}`] || 0) + n * w
        }
      }
    }
    const row = (key, label, sub, color) => ({
      key, label, sub, color,
      thisWeek: Math.round((setsThis[key] || 0) * 2) / 2,
      avg: Math.round(((setsPrev[key] || 0) / 4) * 2) / 2,
    })
    const rows = MUSCLE_ORDER.flatMap(g => g === 'legs'
      ? [row(g, MUSCLE_LABELS[g], false, MUSCLE_COLORS[g]), ...LEG_PARTS.map(([p, l]) => row(`legs:${p}`, l, true, MUSCLE_COLORS[g]))]
      : [row(g, MUSCLE_LABELS[g], false, MUSCLE_COLORS[g])])
    const workouts = sessions.filter(s => s.date >= wStart && s.date < wEnd).length
    return { rows, wStart, workouts }
  }, [sessions, exById, thisWeek, muscleOffset])

  // ── Regular exercises (last 60 days) ──
  const top = useMemo(() => {
    const c60 = addDays(today, -60)
    const freq = new Map()
    for (const s of sessions) {
      if (s.date < c60) continue
      for (const ex of s.exercises || []) freq.set(ex.exerciseId, (freq.get(ex.exerciseId) || 0) + 1)
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [sessions, today])

  if (!sessions.length) {
    return <p className="text-gray-600 text-sm text-center py-16">Log your first workout to see progress here</p>
  }

  const avgPerWeek = (weeks.reduce((n, w) => n + w.count, 0) / weeks.length).toFixed(1)
  const muscleWeekLabel = muscleOffset === 0 ? 'This week' : muscleOffset === 1 ? 'Last week' : `Week of ${formatDate(muscle.wStart)}`

  const PRRow = ({ pr, showPrev }) => {
    const ex = exById.get(pr.exerciseId)
    return (
      <button onClick={() => onPickExercise(pr.exerciseId)}
        className="w-full flex items-center gap-2 py-2.5 border-b border-gray-700/50 last:border-0 text-left active:opacity-70">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: MUSCLE_COLORS[ex?.muscleGroup] }} />
        <span className="text-sm text-white flex-1 truncate">{ex?.name || pr.exerciseId}</span>
        <span className="text-xs font-mono text-brand">{pr.weight || 'BW'}×{pr.reps}</span>
        {showPrev
          ? <span className="text-[10px] text-gray-600 font-mono">was {pr.prevWeight || 'BW'}×{pr.prevReps}</span>
          : <span className="text-[10px] text-gray-600">{formatDate(pr.date)}</span>}
        <ChevronRight size={14} className="text-gray-600" />
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[['This week', sessions.filter(s => s.date >= thisWeek).length], ['This month', sessions.filter(s => s.date.startsWith(today.slice(0, 7))).length], ['Total', sessions.length]].map(([label, val]) => (
          <div key={label} className="bg-gray-800 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-white">{val}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Workouts per week</p>
            <p className="text-[10px] text-gray-600 mt-0.5">avg {avgPerWeek} / week</p>
          </div>
          <Chips options={[['8w', '8 wk'], ['6m', '6 mo'], ['all', 'All']]} value={weekRange} onChange={setWeekRange} />
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={weeks} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="week" tickFormatter={formatDate} stroke="#6b7280" tick={{ fontSize: 9, fill: '#6b7280' }}
              interval={weekRange === '8w' ? 1 : 'preserveStartEnd'} minTickGap={24} />
            <YAxis allowDecimals={false} stroke="#6b7280" tick={{ fontSize: 9, fill: '#6b7280' }} />
            <Tooltip cursor={{ fill: '#37415155' }} content={({ active, payload }) => active && payload?.length ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white">
                Week of {formatDate(payload[0].payload.week)}: {payload[0].value}
              </div>
            ) : null} />
            <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sets per muscle</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setMuscleOffset(o => Math.min(maxOffset, o + 1))} disabled={muscleOffset >= maxOffset}
              aria-label="Previous week" className="p-1 text-gray-400 disabled:opacity-20"><ChevronLeft size={18} /></button>
            <span className="text-[11px] text-white w-28 text-center">{muscleWeekLabel}</span>
            <button onClick={() => setMuscleOffset(o => Math.max(0, o - 1))} disabled={muscleOffset === 0}
              aria-label="Next week" className="p-1 text-gray-400 disabled:opacity-20"><ChevronRight size={18} /></button>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mb-3">{muscle.workouts} workout{muscle.workouts === 1 ? '' : 's'} · | = avg of 4 weeks before · shaded = 10–20</p>
        {muscle.rows.map(m => {
          const max = 24
          const pct = v => `${Math.min(100, (v / max) * 100)}%`
          return (
            <div key={m.key} className={`flex items-center gap-2 ${m.sub ? 'mb-1.5' : 'mb-2'}`}>
              <span className={`text-[11px] w-20 ${m.sub ? 'text-gray-500 pl-3' : 'text-gray-400'}`}>{m.label}</span>
              <div className={`relative flex-1 bg-gray-900 rounded-full overflow-hidden ${m.sub ? 'h-2' : 'h-3'}`}>
                <div className="absolute inset-y-0 bg-gray-700/50" style={{ left: pct(10), width: `${(10 / max) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(m.thisWeek), backgroundColor: m.color, opacity: m.sub ? 0.7 : 1 }} />
                {m.avg > 0 && <div className="absolute inset-y-0 w-0.5 bg-white/70" style={{ left: pct(m.avg) }} />}
              </div>
              <span className={`text-[11px] font-mono w-8 text-right ${m.sub ? 'text-gray-400' : 'text-white'}`}>{m.thisWeek}</span>
            </div>
          )
        })}
      </div>

      <div className="bg-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Trophy size={13} className="text-yellow-500" /> {prMode === 'recent' ? 'PRs · last 30 days' : 'All-time bests'}
          </p>
          <Chips options={[['recent', '30 days'], ['all', 'All-time']]} value={prMode} onChange={setPrMode} />
        </div>
        {prMode === 'recent' ? (
          prData.recent.length
            ? prData.recent.map(pr => <PRRow key={pr.exerciseId} pr={pr} showPrev />)
            : <p className="text-xs text-gray-600 py-2">No new PRs in the last 30 days.</p>
        ) : (
          prData.all.map(g => (
            <div key={g.group} className="mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider mt-2 mb-0.5" style={{ color: MUSCLE_COLORS[g.group] }}>{MUSCLE_LABELS[g.group]}</p>
              {g.items.map(pr => <PRRow key={pr.exerciseId} pr={pr} />)}
            </div>
          ))
        )}
      </div>

      {top.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your regular exercises</p>
          <div className="flex flex-wrap gap-2">
            {top.map(([id, n]) => {
              const ex = exById.get(id)
              return (
                <button key={id} onClick={() => onPickExercise(id)}
                  className="flex items-center gap-1.5 bg-gray-700/60 rounded-full px-3 py-1.5 text-xs text-gray-200 active:bg-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: MUSCLE_COLORS[ex?.muscleGroup] }} />
                  {ex?.name || id}
                  <span className="text-gray-500">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Remember Progress selections while the app is open (e.g. after editing a session)
function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try { const v = sessionStorage.getItem(`gymlogger_progress_${key}`); return v != null ? JSON.parse(v) : initial } catch { return initial }
  })
  useEffect(() => {
    try { sessionStorage.setItem(`gymlogger_progress_${key}`, JSON.stringify(value)) } catch { /* ignore */ }
  }, [key, value])
  return [value, setValue]
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Progress({ onEditSession }) {
  const { state } = useStore()
  const { data } = state
  const sessions = data.sessions || []
  const exercises = data.exercises || []
  const movementGroups = data.movementGroups || []

  const [viewMode, setViewMode] = useSessionState('viewMode', 'exercise') // 'exercise' | 'muscle'
  const [viewType, setViewType] = useSessionState('viewType', 'graph')    // 'graph' | 'table'
  const [selectedExId, setSelectedExId] = useSessionState('exercise', null)
  const [selectedMuscle, setSelectedMuscle] = useSessionState('muscle', null)
  const [groupView, setGroupView] = useSessionState('groupView', false)
  const [metricId, setMetricId] = useSessionState('metric', METRICS[0].id)
  const metric = METRICS.find(m => m.id === metricId) || METRICS[0]
  const setMetric = m => setMetricId(m.id)
  const [showPicker, setShowPicker] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const userName = state.fullData.users?.find(u => u.id === state.activeUserId)?.name || ''
  // Variants: 'all' = combined line, 'split' = one line per variant, or a single variant
  const [variantView, setVariantView] = useSessionState('variantView', 'all')

  const selectedEx = exercises.find(e => e.id === selectedExId)
  const movGroup = selectedEx ? movementGroups.find(g => g.exerciseIds.includes(selectedEx.id)) : null

  const muscleExercises = useMemo(() => {
    if (!selectedMuscle) return []
    return exercises
      .filter(e => e.muscleGroup === selectedMuscle)
      .filter(e => sessions.some(s => s.exercises?.some(ex => ex.exerciseId === e.id)))
  }, [selectedMuscle, exercises, sessions])

  const variants = useMemo(() => {
    if (!selectedEx) return []
    const vs = new Set()
    let untagged = false
    for (const s of sessions) for (const e of s.exercises || []) {
      if (e.exerciseId !== selectedEx.id) continue
      if (e.variant) vs.add(e.variant); else untagged = true
    }
    return vs.size ? [...vs, ...(untagged ? ['__none'] : [])] : []
  }, [selectedEx, sessions])
  const variantLabel = v => v === '__none' ? 'Untagged' : v
  const activeVariant = variants.includes(variantView) ? variantView : null

  const chartLines = useMemo(() => {
    if (!selectedEx) return []
    if (!groupView && variants.length && variantView === 'split') {
      return variants.map(v => ({ id: `${selectedEx.id}__${v}`, name: `${selectedEx.name} · ${variantLabel(v)}`, baseId: selectedEx.id, variant: v }))
    }
    if (!groupView && activeVariant) {
      return [{ id: `${selectedEx.id}__${activeVariant}`, name: selectedEx.name, baseId: selectedEx.id, variant: activeVariant }]
    }
    if (groupView && movGroup) {
      return movGroup.exerciseIds
        .map(id => exercises.find(e => e.id === id))
        .filter(Boolean)
        .filter(e => sessions.some(s => s.exercises?.some(ex => ex.exerciseId === e.id)))
    }
    return [selectedEx]
  }, [selectedEx, groupView, movGroup, exercises, sessions, variants, variantView, activeVariant])

  const allHistory = useMemo(() => {
    const h = {}
    for (const ex of chartLines) h[ex.id] = getHistory(sessions, ex.baseId || ex.id, ex.variant || null)
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
          point[ex.id] = entry ? metricVal(entry, metric.id) : null
        }
        point[`${ex.id}_weight`] = entry?.weight ?? null
        point[`${ex.id}_reps`]   = entry?.reps   ?? null
      }
      if (chartLines.length === 1) {
        const entry = allHistory[chartLines[0].id]?.find(p => p.date === date)
        point.weight = entry?.weight ?? null
        point.reps   = entry?.reps   ?? null
        point.pos    = entry?.pos    ?? null
      }
      return point
    })
  }, [chartLines, allHistory, metric])

  const singleHistory = useMemo(() =>
    selectedEx ? getHistory(sessions, selectedEx.id, activeVariant) : []
  , [selectedEx, sessions, activeVariant])

  const hasSelection = viewMode === 'exercise' ? !!selectedEx : !!selectedMuscle

  // Back to the overview: header arrow, or the phone's back gesture
  const clearSelection = useCallback(() => {
    setSelectedExId(null)
    setSelectedMuscle(null)
    setGroupView(false)
  }, [])
  const markSelected = () => {
    try { if (!window.history.state?.gymProgressSel) window.history.pushState({ gymProgressSel: true }, '') } catch { /* ignore */ }
  }
  const goBack = () => {
    if (window.history.state?.gymProgressSel) window.history.back() // popstate clears
    else clearSelection()
  }
  useEffect(() => {
    window.addEventListener('popstate', clearSelection)
    return () => window.removeEventListener('popstate', clearSelection)
  }, [clearSelection])

  // Restored a selection (e.g. back from editing a session): re-arm the phone's back gesture.
  // Leaving Progress: remove our history entry so the next back press isn't swallowed.
  useEffect(() => {
    if (hasSelection) markSelected()
    return () => {
      try {
        if (window.history.state?.gymProgressSel) window.history.back()
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-2 mb-4">
          {hasSelection && (
            <button onClick={goBack} aria-label="Back to overview" className="text-gray-400 active:text-white -ml-1 p-1">
              <ChevronLeft size={24} />
            </button>
          )}
          <h1 className="text-2xl font-bold text-white flex-1">Progress</h1>
          {!hasSelection && sessions.length > 0 && (
            <button onClick={() => setShowShare(true)} className="flex items-center gap-1.5 text-xs text-brand font-semibold bg-brand/10 rounded-full px-3 py-1.5">
              <Share2 size={14} /> Share
            </button>
          )}
        </div>
        {showShare && <ShareStats sessions={sessions} exercises={exercises} userName={userName} onClose={() => setShowShare(false)} />}

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
              <button key={g} onClick={() => { markSelected(); setSelectedMuscle(g) }}
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

        {viewMode === 'exercise' && selectedEx && variants.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
            {[['all', 'Combined'], ...variants.map(v => [v, variantLabel(v)]), ['split', 'Separate lines']].map(([id, label]) => (
              <button key={id} onClick={() => setVariantView(id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${variantView === id ? 'border-brand text-brand bg-brand/10' : 'border-gray-700 text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {showPicker && (
          <ExercisePickerSheet exercises={exercises} sessions={sessions}
            onSelect={id => { markSelected(); setSelectedExId(id); setGroupView(false); setVariantView('all') }}
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
                onEditSession={onEditSession}
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
                  <HistoryTable
                    history={singleHistory}
                    onRowClick={onEditSession ? sessionId => onEditSession(sessionId) : null}
                  />
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
                        const val = metricVal(e, metric.id)
                        const bval = best ? metricVal(best, metric.id) : -1
                        return val > bval ? e : best
                      }, null)
                      if (!pr) return null
                      return (
                        <div className="text-right">
                          <p className="text-[10px] text-brand uppercase font-semibold tracking-wider">PR</p>
                          <p className="text-lg font-bold text-white">
                            {metric.id === 'weight' ? (pr.weight ? `${pr.weight}kg` : 'BW') : metric.id === 'reps' ? `${pr.reps}r` : metric.id === 'e1rm' ? `${pr.e1rm}kg` : pr.volume}
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
                      <LineChart
                        data={chartData}
                        margin={{ top: 5, right: metric.id === 'both' ? 36 : 10, left: 0, bottom: 5 }}
                        onClick={d => {
                          if (!onEditSession || !d?.activeLabel) return
                          const ids = new Set(chartLines.map(e => e.id))
                          const s = sessions.find(s => s.date === d.activeLabel && s.exercises?.some(e => ids.has(e.exerciseId)))
                          if (s) onEditSession(s.id)
                        }}
                        style={{ cursor: onEditSession ? 'pointer' : 'default' }}
                      >
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
          <Overview
            sessions={sessions}
            exercises={exercises}
            onPickExercise={id => { markSelected(); setViewMode('exercise'); setSelectedExId(id); setGroupView(false); setVariantView('all') }}
          />
        )}
      </div>
    </div>
  )
}
