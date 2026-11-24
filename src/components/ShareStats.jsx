import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Share2, Download } from 'lucide-react'
import { localDate } from '../lib/store'
import { MUSCLE_LABELS, MUSCLE_COLORS } from '../data/defaultData'

// Shareable stats card, drawn on a canvas on the phone. Only numbers go in —
// never notes, body weight, or anyone else's data.

const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']
const W = 1080, H = 1350

const PERIODS = [
  ['week', 'This week'],
  ['month', 'This month'],
  ['30d', 'Last 30 days'],
  ['year', 'This year'],
  ['all', 'All time'],
]

function periodStart(id) {
  const now = new Date()
  if (id === 'week') { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localDate(d) }
  if (id === 'month') return localDate(now).slice(0, 8) + '01'
  if (id === '30d') { const d = new Date(now); d.setDate(d.getDate() - 29); return localDate(d) }
  if (id === 'year') return `${now.getFullYear()}-01-01`
  return '0000-00-00'
}

const fmt = d => { const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }

function computeStats(sessions, exercises, period) {
  const exById = new Map(exercises.map(e => [e.id, e]))
  const start = periodStart(period)
  const inPeriod = sessions.filter(s => s.date >= start)
  let sets = 0, volume = 0
  const muscle = {}
  for (const s of inPeriod) for (const e of s.exercises || []) {
    const info = exById.get(e.exerciseId)
    for (const st of e.sets) {
      if (st.reps == null) continue
      sets++
      volume += (st.weight || 0) * st.reps
      if (info) muscle[info.muscleGroup] = (muscle[info.muscleGroup] || 0) + 1
    }
  }
  // PRs set during the period: heaviest best set beating everything before it
  const best = new Map()
  const prs = new Map()
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.exercises || []) {
      const valid = e.sets.filter(st => st.reps != null).map(st => ({ w: st.weight ?? 0, r: st.reps }))
      if (!valid.length) continue
      const top = valid.reduce((b, st) => (st.w > b.w || (st.w === b.w && st.r > b.r)) ? st : b)
      const prev = best.get(e.exerciseId)
      const isPR = prev && (top.w > prev.w || (top.w === prev.w && top.r > prev.r))
      if (!prev || isPR) best.set(e.exerciseId, top)
      if (isPR && s.date >= start) prs.set(e.exerciseId, { name: exById.get(e.exerciseId)?.name || e.exerciseId, ...top, date: s.date })
    }
  }
  const days = inPeriod.length ? Math.max(1, Math.round((new Date(localDate()) - new Date(period === 'all' ? inPeriod.at(-1).date : start)) / 864e5) + 1) : 1
  return {
    workouts: inPeriod.length,
    sets,
    volume: Math.round(volume),
    perWeek: (inPeriod.length / Math.max(1, days / 7)).toFixed(1),
    muscle: MUSCLE_ORDER.map(g => ({ g, n: muscle[g] || 0 })),
    prs: [...prs.values()].sort((a, b) => b.date.localeCompare(a.date)),
    first: inPeriod.at(-1)?.date,
    start: period === 'all' ? null : start,
  }
}

function draw(canvas, stats, opts) {
  const c = canvas.getContext('2d')
  canvas.width = W; canvas.height = H
  const font = (size, weight = 400) => `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
  // background
  const g = c.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#111827'); g.addColorStop(1, '#0b1220')
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  c.fillStyle = '#10b981'; c.fillRect(0, 0, W, 10)

  let y = 110
  c.fillStyle = '#10b981'; c.font = font(34, 700); c.fillText('GYMLOGGER', 80, y)
  c.fillStyle = '#9ca3af'; c.font = font(34, 500)
  const label = PERIODS.find(p => p[0] === opts.period)[1] + (opts.name ? ` · ${opts.name}` : '')
  c.textAlign = 'right'; c.fillText(label, W - 80, y); c.textAlign = 'left'

  // headline numbers
  y = 260
  const tiles = [
    [String(stats.workouts), 'workouts'],
    [String(stats.sets), 'sets'],
    [opts.period === 'week' ? `${(stats.volume / 1000).toFixed(1)}t` : stats.perWeek, opts.period === 'week' ? 'lifted' : 'per week'],
  ]
  tiles.forEach(([v, l], i) => {
    const x = 80 + i * 310
    c.fillStyle = '#ffffff'; c.font = font(110, 800); c.fillText(v, x, y)
    c.fillStyle = '#6b7280'; c.font = font(32, 500); c.fillText(l, x + 4, y + 50)
  })

  y = 400
  if (opts.muscles) {
    c.fillStyle = '#9ca3af'; c.font = font(30, 700); c.fillText('SETS PER MUSCLE', 80, y)
    y += 30
    const max = Math.max(1, ...stats.muscle.map(m => m.n))
    for (const m of stats.muscle) {
      y += 58
      c.fillStyle = '#d1d5db'; c.font = font(32, 500); c.fillText(MUSCLE_LABELS[m.g], 80, y)
      c.fillStyle = '#1f2937'; roundRect(c, 300, y - 26, 600, 30, 15); c.fill()
      if (m.n) { c.fillStyle = MUSCLE_COLORS[m.g]; roundRect(c, 300, y - 26, Math.max(30, 600 * m.n / max), 30, 15); c.fill() }
      c.fillStyle = '#ffffff'; c.font = font(32, 700); c.textAlign = 'right'; c.fillText(String(m.n), W - 80, y); c.textAlign = 'left'
    }
    y += 70
  }

  if (opts.prs) {
    c.fillStyle = '#9ca3af'; c.font = font(30, 700); c.fillText(`🏆  PRs${stats.prs.length ? '' : ': none this time'}`, 80, y)
    const list = stats.prs.slice(0, opts.muscles ? 4 : 9)
    for (const pr of list) {
      y += 62
      c.fillStyle = '#e5e7eb'; c.font = font(34, 500)
      let name = pr.name
      while (c.measureText(name).width > 640 && name.length > 4) name = name.slice(0, -2)
      if (name !== pr.name) name += '…'
      c.fillText(name, 80, y)
      c.fillStyle = '#10b981'; c.font = font(34, 700); c.textAlign = 'right'
      c.fillText(`${pr.w || 'BW'} × ${pr.r}`, W - 80, y); c.textAlign = 'left'
    }
    if (stats.prs.length > list.length) { y += 50; c.fillStyle = '#6b7280'; c.font = font(28, 500); c.fillText(`+ ${stats.prs.length - list.length} more`, 80, y) }
  }

  c.fillStyle = '#4b5563'; c.font = font(26, 500)
  const footer = stats.start ? `${fmt(stats.start)} – ${fmt(localDate())}` : stats.first ? `since ${fmt(stats.first)}` : ''
  c.fillText(footer, 80, H - 60)
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath()
}

export default function ShareStats({ sessions, exercises, userName, onClose }) {
  const canvasRef = useRef(null)
  const [period, setPeriod] = useState('month')
  const [muscles, setMuscles] = useState(true)
  const [prs, setPrs] = useState(true)
  const [showName, setShowName] = useState(false)
  const [busy, setBusy] = useState(false)

  const stats = useMemo(() => computeStats(sessions, exercises, period), [sessions, exercises, period])

  useEffect(() => {
    if (canvasRef.current) draw(canvasRef.current, stats, { period, muscles, prs, name: showName ? userName : '' })
  }, [stats, period, muscles, prs, showName, userName])

  const share = async () => {
    setBusy(true)
    try {
      const blob = await new Promise(r => canvasRef.current.toBlob(r, 'image/png'))
      const file = new File([blob], `gym-stats-${localDate()}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My gym stats' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = file.name; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch { /* share cancelled */ }
    setBusy(false)
  }

  const Toggle = ({ on, set, label }) => (
    <button onClick={() => set(!on)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${on ? 'border-brand text-brand bg-brand/10' : 'border-gray-700 text-gray-500'}`}>
      {on ? '✓ ' : ''}{label}
    </button>
  )

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col max-w-md mx-auto">
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 border-b border-gray-800">
        <button onClick={onClose} aria-label="Close" className="text-gray-400"><X size={22} /></button>
        <h2 className="text-lg font-bold text-white flex-1">Share stats</h2>
      </div>
      <div className="overflow-y-auto flex-1 px-4 py-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
          {PERIODS.map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${period === id ? 'bg-brand text-black' : 'bg-gray-800 text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Toggle on={muscles} set={setMuscles} label="Sets per muscle" />
          <Toggle on={prs} set={setPrs} label="PRs" />
          {userName && <Toggle on={showName} set={setShowName} label="My name" />}
        </div>
        <canvas ref={canvasRef} className="w-full rounded-2xl border border-gray-800" style={{ aspectRatio: `${W} / ${H}` }} />
        <p className="text-[11px] text-gray-600 text-center mt-3">Only numbers are included: no notes, body weight or other people&apos;s data.</p>
      </div>
      <div className="p-4 border-t border-gray-800">
        <button onClick={share} disabled={busy}
          className="w-full bg-brand text-black font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-50">
          {navigator.canShare ? <Share2 size={18} /> : <Download size={18} />}
          {navigator.canShare ? 'Share image' : 'Download image'}
        </button>
      </div>
    </div>
  )
}
