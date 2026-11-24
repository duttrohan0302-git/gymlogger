import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip } from 'recharts'
import { exerciseTimeline, learnProgression, e1rm } from '../lib/progression'

function formatDate(d) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
const avg = a => a.reduce((x, y) => x + y, 0) / a.length

/** History and insights for one exercise — shown while logging. */
export default function ExerciseInsights({ exerciseId, variant, positionToday, sessions }) {

  const info = useMemo(() => {
    const tl = exerciseTimeline(sessions, exerciseId, variant)
    if (!tl.length) return null
    const learned = learnProgression(tl)
    let best = null
    for (const t of tl) for (const st of t.sets) {
      const v = e1rm(st.w, st.r)
      if (!best || v > best.v) best = { ...st, v, date: t.date }
    }
    // Position effect: top weight when done early (#1-2) vs later (#3+)
    const recent = []
    for (const s of sessions) {
      const pos = s.exercises?.findIndex(e => e.exerciseId === exerciseId && (!variant || e.variant === variant))
      if (pos == null || pos < 0) continue
      const ex = s.exercises[pos]
      const top = Math.max(0, ...ex.sets.map(st => st.weight ?? 0))
      recent.push({ date: s.date, pos: pos + 1, top, ex })
      if (recent.length >= 12) break
    }
    const early = recent.filter(r => r.pos <= 2).map(r => r.top)
    const late = recent.filter(r => r.pos >= 3).map(r => r.top)
    const position = early.length >= 2 && late.length >= 2 && avg(early) > 0
      ? Math.round((avg(late) / avg(early) - 1) * 100)
      : null
    return { tl, learned, best, recent: recent.slice(0, 6), position, chart: tl.slice(-12).map(t => ({ date: t.date, top: t.top })) }
  }, [sessions, exerciseId, variant])


  const insights = []
  if (info?.learned) {
    const l = info.learned
    if (l.sessionsPerStep) insights.push(`You usually add ${l.step} kg after ~${l.sessionsPerStep} session${l.sessionsPerStep > 1 ? 's' : ''}, once you reach about ${l.repCeiling} reps.`)
    if (l.stuck) insights.push(`⚠️ Stuck: ${l.currentRun} sessions at the same weight (usually ~${l.sessionsPerStep}). Try a drop set, a different rep range, or a small jump.`)
    else if (l.currentRun > 1) insights.push(`${l.currentRun} sessions at this weight so far.`)
    if (l.pace === 'slow') insights.push('This one moves slowly for you, so small jumps and extra reps are progress too.')
  }
  if (info?.position != null && Math.abs(info.position) >= 5) {
    insights.push(`Done 3rd or later, you lift ${Math.abs(info.position)}% ${info.position < 0 ? 'less' : 'more'} than when it's 1st or 2nd.${positionToday >= 3 && info.position < 0 ? ` It's #${positionToday} today, so go easy on the comparison.` : ''}`)
  }
  if (info?.best) insights.push(`Best set: ${info.best.w || 'BW'} × ${info.best.r} (${formatDate(info.best.date)}), ≈ ${Math.round(info.best.v)} kg 1RM.`)

  return (
    <div className="bg-gray-900 rounded-xl p-3 mb-3 space-y-3">
      {!info && <p className="text-xs text-gray-500">No history yet. This is your first time logging it{variant ? ` (${variant})` : ''}.</p>}

      {info?.chart.length > 1 && (
        <ResponsiveContainer width="100%" height={70}>
          <LineChart data={info.chart} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip content={({ active, payload }) => active && payload?.length ? (
              <div className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[10px] text-white">
                {formatDate(payload[0].payload.date)}: {payload[0].value || 'BW'} kg
              </div>
            ) : null} />
            <Line type="monotone" dataKey="top" stroke="#10b981" strokeWidth={2} dot={{ r: 2, strokeWidth: 0, fill: '#10b981' }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      {insights.length > 0 && (
        <ul className="space-y-1">
          {insights.map((t, i) => <li key={i} className="text-[11px] text-gray-300 leading-snug">• {t}</li>)}
        </ul>
      )}

      {info?.recent.length > 0 && (
        <div className="space-y-1.5">
          {info.recent.map(r => (
            <div key={r.date + r.pos}>
              <div className="flex items-center flex-wrap gap-1">
                <span className="text-[10px] text-gray-500 w-12">{formatDate(r.date)}</span>
                <span className="text-[9px] text-gray-600 w-5">#{r.pos}</span>
                {r.ex.sets.map((st, j) => (
                  <span key={j} className="text-[10px] font-mono bg-gray-800 text-gray-300 rounded px-1.5 py-0.5">
                    {st.weight || 'BW'}×{st.reps ?? '—'}
                  </span>
                ))}
                {r.ex.variant && <span className="text-[9px] text-gray-500">{r.ex.variant}</span>}
              </div>
              {r.ex.note && <p className="text-[10px] text-gray-500 italic pl-[4.25rem]">{r.ex.note}</p>}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
