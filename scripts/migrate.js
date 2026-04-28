#!/usr/bin/env node
/**
 * Parses the Gym logbook.md and outputs data/workouts.json
 * Usage: node scripts/migrate.js "/path/to/Gym logbook.md"
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')

// ---- Exercise ID mapping (lowercased header → id) ----
const HEADER_MAP = {
  // Back
  'chest supported horizontal row': 'chest_supported_row',
  'lat pull down': 'lat_pulldown',
  'facepulls': 'facepulls',
  'facepulls(feels like i m not feeling it anymore)': 'facepulls',
  'rear delt machine (difficult to maintain form, still do it)': 'rear_delt_machine',
  'rear delt machine': 'rear_delt_machine',
  'back extension': 'back_extension',
  'diverging lat pulldown': 'diverging_lat_pulldown',
  'diverging seated row': 'diverging_seated_row',
  'low rows sitting v bar': 'low_rows_v_bar',
  'dumbbel shrugs': 'dumbbell_shrugs',
  'dumbbell shrugs': 'dumbbell_shrugs',
  // Biceps
  'cable unilateral curl( weaker left arm)': 'cable_unilateral_curl',
  'cable unilateral curl': 'cable_unilateral_curl',
  'inclined sitting curl dumbbell(use number 3 bench position)': 'inclined_curl_db',
  'inclined sitting curl dumbbell': 'inclined_curl_db',
  'preacher curl single arm': 'preacher_curl',
  'rope hammer curl': 'rope_hammer_curl',
  'cross body hammer curl': 'cross_body_hammer_curl',
  'sitting hammer curl': 'sitting_hammer_curl',
  // Shoulders
  'shoulder press dumbbell': 'shoulder_press_db',
  "cable lateral raise single arm (let's do high reps low weight)": 'cable_lateral_raise',
  'cable lateral raise single arm': 'cable_lateral_raise',
  'archer pull single arm': 'archer_pull',
  'machine shoulder press': 'machine_shoulder_press',
  'lateral raise dumbbell': 'lateral_raise_db',
  'rear delt using dual cable': 'rear_delt_dual_cable',
  // Abs
  'abs crunch rope': 'abs_crunch_rope',
  'rotary torso': 'rotary_torso',
  'hanging leg raises': 'hanging_leg_raises',
  // Chest
  'inclined dumbbell press': 'inclined_db_press',
  'chest press machine': 'chest_press_machine',
  'pec fly machine': 'pec_fly_machine',
  'bench press(not including barbell)': 'bench_press',
  'bench press': 'bench_press',
  'dumbbell press': 'dumbbell_press',
  'supine press': 'supine_press',
  'cable fly high to low': 'cable_fly',
  'smith machine': 'smith_machine_chest',
  // Triceps
  'triceps overhead single arm': 'tricep_overhead_single',
  'tricep overhead rope extension': 'tricep_overhead_rope',
  'tricep straight bar push down': 'tricep_straight_bar',
  'tricep single arm extension (use the handle normally not sideways)': 'tricep_single_arm_ext',
  'tricep single arm extension': 'tricep_single_arm_ext',
  'weighted dips': 'weighted_dips',
  'tricep triangle long bar overhead exension': 'tricep_triangle_overhead',
  'tricep triangle long bar overhead extension': 'tricep_triangle_overhead',
  // Legs
  'bulgarian split squat(bar two from bottom or the cuboid box).. other knee thoda aage': 'bulgarian_split_squat',
  'bulgarian split squat': 'bulgarian_split_squat',
  'stand knee raise and then go down': 'stand_knee_raise',
  'barbell squat(each side)': 'barbell_squat',
  'barbell squat': 'barbell_squat',
  'hip thirst one leg up': 'hip_thrust_single_leg',
  'hip thrust one leg up': 'hip_thrust_single_leg',
  'hack squat machine(starting resistance of 47.6 kg ) keep legs lower for quads': 'hack_squat',
  'hack squat machine': 'hack_squat',
  'rdl dumbbell': 'rdl_dumbbell',
  'leg press (sitting position, pin in 6th hole)': 'leg_press_sitting',
  'leg press lying down(starting resistance 75.7 kgs)': 'leg_press_lying',
  'leg press lying down': 'leg_press_lying',
  'leg curl': 'leg_curl',
  'leg extension': 'leg_extension',
  'calves (sitting starting resistance - 11.3 kgs, standing- 27.3 kgs)': 'calves',
  'calves': 'calves',
  'hip abductor': 'hip_abductor',
}

// Section header → muscle group
const SECTION_MAP = {
  'back': 'back',
  'biceps': 'biceps',
  'shoulder': 'shoulders',
  'abs': 'abs',
  'chest': 'chest',
  'triceps': 'triceps',
  'leg day': 'legs',
}

const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 }

function parseDate(raw) {
  const text = raw.trim()
  const m = text.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)/i)
  if (!m) return null
  const day = parseInt(m[1])
  const month = MONTHS[m[2].toLowerCase().slice(0, 3)]
  if (!day || !month) return null
  return `2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function parseCell(raw) {
  const text = raw.trim()
  if (!text || text === '---' || /^-+$/.test(text)) return null

  const isBW = /\bBW\b/i.test(text)
  let weight = isBW ? 0 : null
  if (!isBW) {
    const wm = text.match(/([\d.]+)\s*(?:kgs?|kg)/i)
    if (wm) weight = parseFloat(wm[1])
  }

  const rm = text.match(/(\d+)\s*(?:reps?|rep)/i)
  const reps = rm ? parseInt(rm[1]) : null

  // Extract notes: strip weight/reps patterns and common units
  let note = text
    .replace(/([\d.]+)\s*(?:kgs?|kg)/gi, '')
    .replace(/(\d+)\s*(?:reps?|rep)/gi, '')
    .replace(/\bBW\b/gi, '')
    .replace(/[()]/g, ' ')
    .replace(/x\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, '')

  if (weight === null && reps === null && !isBW) return null

  return { weight, reps, note: note || '' }
}

function lookupExerciseId(header) {
  const key = header.toLowerCase().trim()
  if (HEADER_MAP[key]) return HEADER_MAP[key]
  // Fuzzy: try without parenthetical suffix
  const stripped = key.replace(/\s*\(.*?\)\s*/g, '').trim()
  if (HEADER_MAP[stripped]) return HEADER_MAP[stripped]
  // Try prefix match
  for (const [k, v] of Object.entries(HEADER_MAP)) {
    if (key.startsWith(k.split('(')[0].trim()) || k.startsWith(stripped)) return v
  }
  console.warn(`  ⚠ Unknown header: "${header}"`)
  return null
}

function parseTable(lines) {
  // Find table lines (start with |)
  const tableLines = lines.filter(l => l.trim().startsWith('|') && l.trim().length > 1)
  if (tableLines.length < 2) return []

  // Parse header row (first table line)
  const headerRow = tableLines[0].split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1)
  // Skip separator row
  const dataLines = tableLines.slice(2) // skip header + separator

  // Map column index → exerciseId (skip col 0 which is date)
  const colMap = headerRow.slice(1).map(h => lookupExerciseId(h))

  const sessions = [] // [{ date, exercises: { exerciseId: [set,...] } }]
  let currentDate = null
  let currentSession = null

  for (const line of dataLines) {
    const cols = line.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1)
    if (!cols.length) continue

    const dateStr = cols[0].trim()
    const date = dateStr ? parseDate(dateStr) : null

    if (date) {
      if (currentSession) sessions.push(currentSession)
      currentDate = date
      currentSession = { date, exercises: {} }
    }

    if (!currentSession) continue

    // Parse exercise cells (cols 1..)
    for (let i = 0; i < colMap.length; i++) {
      const exId = colMap[i]
      if (!exId) continue
      const cell = cols[i + 1]
      if (!cell) continue
      const set = parseCell(cell)
      if (!set) continue
      if (!currentSession.exercises[exId]) currentSession.exercises[exId] = []
      currentSession.exercises[exId].push(set)
    }
  }
  if (currentSession) sessions.push(currentSession)
  return sessions
}

async function main() {
  const mdPath = process.argv[2]
  if (!mdPath) {
    console.error('Usage: node scripts/migrate.js "/path/to/Gym logbook.md"')
    process.exit(1)
  }

  const content = readFileSync(mdPath, 'utf8')
  const lines = content.split('\n')

  // Split into sections
  let currentSection = null
  const sections = {} // muscleGroup → lines[]

  for (const line of lines) {
    const trimmed = line.trim()
    // Detect section header (single word / "Leg day" that matches SECTION_MAP, not a table row)
    if (!trimmed.startsWith('|') && trimmed.length > 0) {
      const lower = trimmed.toLowerCase()
      for (const [k, v] of Object.entries(SECTION_MAP)) {
        if (lower === k || lower.startsWith(k)) {
          currentSection = v
          if (!sections[currentSection]) sections[currentSection] = []
          break
        }
      }
    }
    if (currentSection) {
      if (!sections[currentSection]) sections[currentSection] = []
      sections[currentSection].push(line)
    }
  }

  // Parse each section
  const allByDate = {} // date → { muscleGroups: Set, exercises: { exId: [sets] } }

  for (const [muscleGroup, sectionLines] of Object.entries(sections)) {
    console.log(`Parsing ${muscleGroup}…`)
    const sessions = parseTable(sectionLines)
    console.log(`  Found ${sessions.length} sessions`)

    for (const s of sessions) {
      if (!allByDate[s.date]) {
        allByDate[s.date] = { muscleGroups: new Set(), exercises: {} }
      }
      allByDate[s.date].muscleGroups.add(muscleGroup)
      for (const [exId, sets] of Object.entries(s.exercises)) {
        allByDate[s.date].exercises[exId] = sets
      }
    }
  }

  // Build sessions array
  const sessions = Object.entries(allByDate)
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([date, { muscleGroups, exercises }]) => ({
      id: `migrated-${date}-${Math.random().toString(36).slice(2,6)}`,
      date,
      muscleGroups: [...muscleGroups],
      bodyWeight: null,
      exercises: Object.entries(exercises).map(([exerciseId, sets]) => ({ exerciseId, sets })),
      notes: '',
    }))

  console.log(`\nTotal: ${sessions.length} merged sessions across all muscle groups`)

  // Import default data from src
  let base
  try {
    const mod = await import('../src/data/defaultData.js')
    base = { ...mod.EMPTY_DATA }
  } catch (e) {
    console.warn('Could not load defaultData, using minimal base:', e.message)
    base = { version: 1, splits: [], exercises: [], movementGroups: [], muscleGroupNotes: {}, sessions: [], bodyWeightLog: [] }
  }

  base.sessions = sessions

  const json = JSON.stringify(base, null, 2)
  const outPath = join(ROOT, 'data/workouts.json')
  const publicPath = join(ROOT, 'public/data/workouts.json')
  writeFileSync(outPath, json)
  writeFileSync(publicPath, json)
  console.log(`\n✓ Written to ${outPath}`)
  console.log(`✓ Copied to ${publicPath}`)
}

main().catch(console.error)
