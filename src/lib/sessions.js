import { MUSCLE_LABELS } from '../data/defaultData'

const MUSCLE_ORDER = ['back', 'biceps', 'chest', 'triceps', 'shoulders', 'abs', 'legs']

/**
 * Muscle groups actually trained in a session, derived from the logged exercises
 * (not from whichever split day was tapped). Falls back to the stored groups.
 */
export function sessionGroups(session, exerciseById) {
  const groups = new Set()
  for (const e of session.exercises || []) {
    const g = exerciseById.get(e.exerciseId)?.muscleGroup
    if (g) groups.add(g)
  }
  if (!groups.size) return session.muscleGroups || []
  return MUSCLE_ORDER.filter(g => groups.has(g))
}

/** The split day that best matches what was trained (Jaccard overlap of muscle groups). */
export function matchDay(session, days, exerciseById) {
  if (!days?.length) return null
  const trained = new Set(sessionGroups(session, exerciseById))
  if (!trained.size) return null
  let best = null
  let bestScore = 0
  for (const day of days) {
    const dayGroups = new Set(day.muscleGroups)
    const overlap = [...trained].filter(g => dayGroups.has(g)).length
    const union = new Set([...trained, ...dayGroups]).size
    const score = overlap / union
    // Tie-break (e.g. Legs vs Lower with identical groups): prefer the day that was tapped
    const tapped = session.dayId === day.id || (session.dayName && session.dayName === day.name)
    if (score > bestScore || (score === bestScore && score > 0 && tapped)) {
      best = day
      bestScore = score
    }
  }
  return bestScore >= 0.34 ? best : null
}

/** Human label for a session, e.g. "Pull" or "Back + Shoulders". */
export function sessionLabel(session, days, exerciseById) {
  const day = matchDay(session, days, exerciseById)
  if (day) return day.name
  return sessionGroups(session, exerciseById).map(g => MUSCLE_LABELS[g]).join(' + ') || 'Workout'
}

export function exerciseMap(exercises) {
  return new Map((exercises || []).map(e => [e.id, e]))
}
