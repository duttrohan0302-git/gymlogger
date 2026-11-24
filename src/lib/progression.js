// Learns, per exercise, how you actually progress — and turns that into PRs and hints.

const median = arr => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Epley estimated one-rep max */
export const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0)

function matches(entry, variant) {
  return !variant || (entry.variant || null) === variant
}

/** Chronological per-session summary for one exercise: top weight and the reps done at it. */
export function exerciseTimeline(sessions, exerciseId, variant = null) {
  const out = []
  for (const s of sessions) {
    const ex = s.exercises?.find(e => e.exerciseId === exerciseId && matches(e, variant))
    if (!ex) continue
    const sets = ex.sets.filter(st => st.reps != null).map(st => ({ w: st.weight ?? 0, r: st.reps }))
    if (!sets.length) continue
    const top = Math.max(...sets.map(st => st.w))
    out.push({ date: s.date, top, repsAtTop: sets.filter(st => st.w === top).map(st => st.r), sets })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * How this exercise progresses for you:
 *  - step: your usual weight jump
 *  - repCeiling: reps you typically reach at a weight before moving up
 *  - sessionsPerStep: how many sessions you usually stay at a weight
 */
export function learnProgression(timeline) {
  if (timeline.length < 4) return null
  const ups = []
  const repsBeforeUp = []
  const runLengths = []
  let run = 1
  for (let i = 1; i < timeline.length; i++) {
    const prev = timeline[i - 1]
    const cur = timeline[i]
    const delta = Math.round((cur.top - prev.top) * 100) / 100
    // Ignore huge jumps (gym/machine changes, typos) when learning the usual step
    if (delta > 0 && prev.top > 0 && delta / prev.top <= 0.25) {
      ups.push(delta)
      repsBeforeUp.push(Math.max(...prev.repsAtTop))
      runLengths.push(run)
      run = 1
    } else if (delta === 0) {
      run++
    } else {
      run = 1
    }
  }
  // Recent steps reflect the machine/dumbbells you're using now (e.g. after a gym change)
  const rawStep = median(ups.slice(-4)) || (timeline.at(-1).top >= 40 ? 5 : 2.5)
  const step = Math.max(0.5, Math.round(rawStep * 4) / 4)
  const repCeiling = Math.round(median(repsBeforeUp) || 12)
  const sessionsPerStep = median(runLengths) != null ? Math.round(median(runLengths)) : null
  let pace = null
  if (sessionsPerStep != null) pace = sessionsPerStep <= 2 ? 'fast' : sessionsPerStep <= 4 ? 'steady' : 'slow'
  // Stuck: at the same weight much longer than usual
  const stuck = sessionsPerStep != null && run >= Math.max(4, sessionsPerStep * 2 + 1)
  return { step, repCeiling, sessionsPerStep, pace, currentRun: run, ups: ups.length, stuck }
}

/** Suggestion for today based on last session + learned pattern. */
export function progressionHint(sessions, exerciseId, variant = null) {
  const tl = exerciseTimeline(sessions, exerciseId, variant)
  const learned = learnProgression(tl)
  if (!learned) return null
  const last = tl.at(-1)
  if (last.top === 0) {
    // Bodyweight: progress on reps
    return { ...learned, text: `Aim for ${Math.max(...last.repsAtTop) + 1}+ reps`, kind: 'reps' }
  }
  const minReps = Math.min(...last.repsAtTop)
  if (minReps >= learned.repCeiling) {
    const next = Math.round((last.top + learned.step) * 100) / 100
    return { ...learned, text: `Try ${next} kg`, kind: 'up' }
  }
  return { ...learned, text: `Stay at ${last.top} kg, aim for ${minReps + 1} reps`, kind: 'reps' }
}

/** Best-ever numbers for PR checks while logging. */
export function personalBests(sessions, exerciseId, variant = null) {
  const tl = exerciseTimeline(sessions, exerciseId, variant)
  if (!tl.length) return null
  let maxW = -1
  const all = []
  for (const t of tl) for (const st of t.sets) { all.push(st); if (st.w > maxW) maxW = st.w }
  return { maxW, all }
}

/** Is this set a PR? Returns 'weight' | 'reps' | null */
export function isPR(set, bests) {
  if (!bests || set.reps == null) return null
  const w = set.weight ?? 0
  if (w > bests.maxW) return 'weight'
  // Rep PR: more reps than ever at this weight or heavier
  const bestReps = Math.max(0, ...bests.all.filter(st => st.w >= w).map(st => st.r))
  if (set.reps > bestReps && bestReps > 0) return 'reps'
  return null
}
