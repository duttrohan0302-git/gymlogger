import { useMemo, useState } from 'react'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']
const PAGE = 20

const fmt = d => {
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m - 1, day)
  const sameYear = y === new Date().getFullYear()
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: '2-digit' }) })
}

/** Notes-style logbook: one muscle group, exercises as columns, dates as rows. */
export default function MuscleGrid({ sessions, exercises, group, setGroup }) {
  const [limit, setLimit] = useState(PAGE)

  const { columns, rows } = useMemo(() => {
    const exById = new Map(exercises.map(e => [e.id, e]))
    const inGroup = e => e && (e.muscleGroup === group || (e.extraMuscleGroups || []).includes(group))
    const lastUsed = new Map()
    const rows = []
    for (const s of sessions) {   // sessions are newest first
      const cells = {}
      for (const ex of s.exercises || []) {
        const info = exById.get(ex.exerciseId)
        if (!inGroup(info)) continue
        const sets = ex.sets.filter(st => st.reps != null)
        if (!sets.length) continue
        cells[ex.exerciseId] = { sets, variant: ex.variant, note: ex.note }
        if (!lastUsed.has(ex.exerciseId)) lastUsed.set(ex.exerciseId, s.date)
      }
      if (Object.keys(cells).length) rows.push({ id: s.id, date: s.date, cells })
    }
    // Columns: primary-muscle exercises first, each side most recently used first
    const columns = [...lastUsed.keys()]
      .map(id => exById.get(id))
      .sort((a, b) => ((a.muscleGroup !== group) - (b.muscleGroup !== group)) || lastUsed.get(b.id).localeCompare(lastUsed.get(a.id)))
    return { columns, rows }
  }, [sessions, exercises, group])

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
        {MUSCLE_ORDER.map(g => (
          <button key={g} onClick={() => { setGroup(g); setLimit(PAGE) }}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${group === g ? 'text-black' : 'bg-gray-800 text-gray-400'}`}
            style={group === g ? { backgroundColor: MUSCLE_COLORS[g] } : {}}>
            {MUSCLE_LABELS[g]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-16">No {MUSCLE_LABELS[group]?.toLowerCase()} workouts yet</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 border-y border-gray-800">
            <table className="text-[11px] border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-900 text-left text-gray-500 font-medium px-3 py-2 border-r border-gray-800">Date</th>
                  {columns.map(c => (
                    <th key={c.id} className="text-left font-semibold text-gray-300 px-3 py-2 align-bottom min-w-[84px] max-w-[110px] leading-tight">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map(r => (
                  <tr key={r.id} className="border-t border-gray-800">
                    <td className="sticky left-0 z-10 bg-gray-900 text-gray-400 px-3 py-2 align-top whitespace-nowrap border-r border-gray-800">{fmt(r.date)}</td>
                    {columns.map(c => {
                      const cell = r.cells[c.id]
                      return (
                        <td key={c.id} className="px-3 py-2 align-top whitespace-nowrap">
                          {cell && (
                            <>
                              {cell.sets.map((st, i) => (
                                <div key={i} className="text-gray-200 tabular-nums">
                                  {st.weight ? st.weight : 'BW'}<span className="text-gray-600"> × </span>{st.reps}
                                </div>
                              ))}
                              {cell.variant && <div className="text-brand/80 mt-0.5">{cell.variant}</div>}
                              {cell.note && <div className="text-gray-500 italic mt-0.5 whitespace-normal max-w-[110px]">{cell.note}</div>}
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-600 mt-2">kg × reps · swipe sideways for more exercises</p>
          {rows.length > limit && (
            <button onClick={() => setLimit(l => l + PAGE)}
              className="w-full mt-3 py-3 rounded-xl bg-gray-800 text-gray-400 text-sm active:bg-gray-700">
              Show older ({rows.length - limit} more)
            </button>
          )}
        </>
      )}
    </div>
  )
}
