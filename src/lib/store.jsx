import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { readFile, writeFile } from './github'
import { EMPTY_DATA, EXERCISES, MOVEMENT_GROUPS } from '../data/defaultData'

const StoreContext = createContext(null)

const DATA_PATH = 'data/workouts.json'
const LS_DATA = 'gymlogger_data'
const LS_SHA = 'gymlogger_sha'
const LS_TOKEN = 'gymlogger_token'
const LS_REPO = 'gymlogger_repo'
const LS_ACTIVE_USER = 'gymlogger_active_user'
// Set while local changes exist that haven't reached GitHub yet. Survives reloads,
// so an unsynced workout is never overwritten by the remote copy on next open.
const LS_PENDING = 'gymlogger_pending'
// The remote copy this phone last loaded or wrote: the common ancestor for merges
const LS_BASE = 'gymlogger_base'

function getLS(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function setLS(key, val) {
  try { localStorage.setItem(key, val) } catch { /* storage full / blocked */ }
}
function removeLS(key) {
  try { localStorage.removeItem(key) } catch { /* blocked */ }
}

function parseLS() {
  try { return JSON.parse(getLS(LS_DATA)) } catch { return null }
}

/** Today's date as YYYY-MM-DD in the phone's local timezone (toISOString is UTC). */
export function localDate(d = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Migrate v1 data to v2, and keep every user's sessions sorted newest-first
function migrate(raw) {
  const data = migrateRaw(raw)
  if (!data) return null
  return { ...data, users: (data.users || []).map(u => ({ ...u, sessions: sortSessions(u.sessions || []) })) }
}

function migrateRaw(raw) {
  if (!raw) return null
  if (raw.version === 2) return raw
  return {
    version: 2,
    exercises: raw.exercises?.length ? raw.exercises : EXERCISES,
    movementGroups: raw.movementGroups?.length ? raw.movementGroups : MOVEMENT_GROUPS,
    users: [
      {
        id: 'user_default',
        name: 'Rohan',
        splits: raw.splits || [],
        muscleGroupNotes: raw.muscleGroupNotes || {},
        sessions: raw.sessions || [],
        bodyWeightLog: raw.bodyWeightLog || [],
      },
    ],
  }
}

function buildUserView(fullData, user) {
  return {
    splits: user.splits || [],
    muscleGroupNotes: user.muscleGroupNotes || {},
    exerciseNotes: user.exerciseNotes || {},
    keyLifts: user.keyLifts || [],
    generalNotes: user.generalNotes || '',
    sessions: user.sessions || [],
    bodyWeightLog: user.bodyWeightLog || [],
    exercises: fullData.exercises?.length ? fullData.exercises : EXERCISES,
    movementGroups: fullData.movementGroups?.length ? fullData.movementGroups : MOVEMENT_GROUPS,
  }
}

function patchUser(fullData, userId, patch) {
  return {
    ...fullData,
    users: fullData.users.map(u => u.id === userId ? { ...u, ...patch } : u),
  }
}

/** Newest first; same-day sessions ordered by id (ids start with a timestamp). */
function sortSessions(sessions) {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)))
}

/** Drop sets with neither weight nor reps, and exercises left with no sets. */
function cleanSession(session) {
  const exercises = (session.exercises || [])
    .map(e => ({ ...e, sets: (e.sets || []).filter(s => s.weight != null || s.reps != null) }))
    .filter(e => e.sets.length > 0)
  return { ...session, exercises }
}

// Key-order-insensitive deep equality (JSON values only)
function same(a, b) {
  if (a === b) return true
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return a == b && a == null
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]))
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined)
  return ka.length === kb.length && ka.every(k => same(a[k], b[k]))
}

/**
 * Three-way pick. `base` is the remote copy this phone last saw. A side that
 * didn't change since then gives way to the side that did; if both changed,
 * `preferLocal` decides. Without a base we fall back to preferLocal.
 */
function pick3(baseV, localV, remoteV, hasBase, preferLocal) {
  if (same(localV, remoteV)) return localV
  if (hasBase) {
    if (same(localV, baseV)) return remoteV
    if (same(remoteV, baseV)) return localV
  }
  return preferLocal ? localV : remoteV
}

/** Merge two lists of records by id, item by item, three-way. */
function mergeById(baseList, localList, remoteList, hasBase, preferLocal, mergeItem) {
  const byId = list => new Map((list || []).map(x => [x.id, x]))
  const B = byId(baseList), L = byId(localList), R = byId(remoteList)
  const out = []
  for (const [id, l] of L) {
    const r = R.get(id), b = B.get(id)
    if (r === undefined) {
      // Missing remotely: removed there (keep removed unless we changed it) or new here
      if (hasBase && b !== undefined && same(l, b)) continue
      out.push(l)
    } else {
      out.push(mergeItem ? mergeItem(b, l, r) : pick3(b, l, r, hasBase && b !== undefined, preferLocal))
    }
  }
  for (const [id, r] of R) {
    if (L.has(id)) continue
    // Missing locally: deleted here (drop unless remote changed it) or new remotely
    const b = B.get(id)
    if (hasBase && b !== undefined && same(r, b)) continue
    out.push(r)
  }
  return out
}

/**
 * Merge a remote copy into local data.
 * With `base` (the remote copy this phone last loaded or wrote) it's a real
 * three-way merge: only what this phone actually changed overrides the remote,
 * so edits made elsewhere (another phone, or directly in the repo) survive a
 * stale app that was left open. Without a base: this phone wins for the active
 * user, the remote wins for everyone else. Tombstoned sessions stay deleted.
 */
export function mergeData(local, remote, activeUserId, base = null) {
  if (!remote) return local
  remote = migrate(remote)
  base = base ? migrate(base) : null
  const hasBase = !!base

  const exercises = mergeById(base?.exercises, local.exercises, remote.exercises, hasBase, true)

  const users = mergeById(base?.users, local.users, remote.users, hasBase, true, (bu, lu, ru) => {
    // The user on this phone wins conflicts for their own data; for everyone else
    // (e.g. a partner logging on their own phone) the remote copy wins.
    const mine = lu.id === activeUserId
    const hb = hasBase && !!bu
    bu = bu || {}
    const deleted = new Set([...(lu.deletedSessionIds || []), ...(ru.deletedSessionIds || [])])
    const sessions = sortSessions(
      mergeById(bu.sessions, lu.sessions, ru.sessions, hb, mine).filter(s => !deleted.has(s.id))
    )
    const bwKey = e => `${e.date}|${e.weight}`
    const localBw = new Set((lu.bodyWeightLog || []).map(bwKey))
    const bodyWeightLog = [...(lu.bodyWeightLog || []), ...(ru.bodyWeightLog || []).filter(e => !localBw.has(bwKey(e)))]
    const out = {}
    for (const k of new Set([...Object.keys(lu), ...Object.keys(ru)])) {
      out[k] = pick3(bu[k], lu[k], ru[k], hb, mine)
    }
    return { ...out, sessions, bodyWeightLog, deletedSessionIds: [...deleted] }
  })

  return { ...local, exercises, users }
}

function withUserView(state, fullData, userId = state.activeUserId) {
  const user = fullData.users?.find(u => u.id === userId)
  return { fullData, data: user ? buildUserView(fullData, user) : state.data }
}

// Every action that changes saved data bumps `rev`; sync runs until syncedRev catches up.
function changed(state, patch) {
  return { ...state, ...patch, rev: state.rev + 1 }
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOADED': {
      const fullData = migrate(action.data) || { ...EMPTY_DATA }
      if (!fullData.exercises?.length) fullData.exercises = EXERCISES
      if (!fullData.movementGroups?.length) fullData.movementGroups = MOVEMENT_GROUPS
      const userId = action.activeUserId
      const user = userId ? fullData.users?.find(u => u.id === userId) : null
      const data = user ? buildUserView(fullData, user) : null
      return { ...state, fullData, data, activeUserId: user?.id || null, loading: false, error: null }
    }
    case 'MERGE_REMOTE': {
      const fullData = mergeData(state.fullData, action.data, state.activeUserId, action.base)
      return { ...state, ...withUserView(state, fullData) }
    }
    case 'SET_LOADING':
      return { ...state, loading: action.value }
    case 'SET_ERROR':
      return { ...state, error: action.message, loading: false }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    case 'SET_SYNCING':
      return { ...state, syncing: action.value }
    case 'SYNCED':
      return { ...state, syncedRev: Math.max(state.syncedRev, action.rev), error: null }
    case 'SET_ACTIVE_USER': {
      if (!action.userId) return { ...state, data: null, activeUserId: null }
      const user = state.fullData.users?.find(u => u.id === action.userId)
      if (!user) return state
      return { ...state, data: buildUserView(state.fullData, user), activeUserId: action.userId }
    }
    case 'ADD_USER': {
      const user = action.user
      const fullData = { ...state.fullData, users: [...(state.fullData.users || []), user] }
      return changed(state, { fullData, data: buildUserView(fullData, user), activeUserId: user.id })
    }
    case 'ADD_SESSION': {
      const sessions = sortSessions([cleanSession(action.session), ...state.data.sessions])
      const patch = { sessions }
      if (action.session.bodyWeight) {
        patch.bodyWeightLog = [{ date: action.session.date, weight: action.session.bodyWeight }, ...state.data.bodyWeightLog]
      }
      const fullData = patchUser(state.fullData, state.activeUserId, patch)
      return changed(state, { data: { ...state.data, ...patch }, fullData })
    }
    case 'UPDATE_SESSION': {
      const updated = cleanSession(action.session)
      const sessions = sortSessions(state.data.sessions.map(s => s.id === updated.id ? updated : s))
      const fullData = patchUser(state.fullData, state.activeUserId, { sessions })
      return changed(state, { data: { ...state.data, sessions }, fullData })
    }
    case 'DELETE_SESSION': {
      const sessions = state.data.sessions.filter(s => s.id !== action.id)
      const user = state.fullData.users.find(u => u.id === state.activeUserId)
      const deletedSessionIds = [...(user?.deletedSessionIds || []), action.id]
      const fullData = patchUser(state.fullData, state.activeUserId, { sessions, deletedSessionIds })
      return changed(state, { data: { ...state.data, sessions }, fullData })
    }
    case 'UPDATE_SPLIT': {
      const splits = [{ ...action.split, isActive: true }]
      const fullData = patchUser(state.fullData, state.activeUserId, { splits })
      return changed(state, { data: { ...state.data, splits }, fullData })
    }
    case 'UPDATE_MUSCLE_NOTE': {
      const muscleGroupNotes = { ...state.data.muscleGroupNotes, [action.group]: action.notes }
      const fullData = patchUser(state.fullData, state.activeUserId, { muscleGroupNotes })
      return changed(state, { data: { ...state.data, muscleGroupNotes }, fullData })
    }
    // Personal, sticky note per exercise (e.g. "trying slower negatives")
    case 'UPDATE_EXERCISE_NOTE': {
      // An empty string is kept on purpose: it hides the exercise's old built-in note
      const exerciseNotes = { ...state.data.exerciseNotes, [action.exerciseId]: (action.note || '').trim() }
      const fullData = patchUser(state.fullData, state.activeUserId, { exerciseNotes })
      return changed(state, { data: { ...state.data, exerciseNotes }, fullData })
    }
    // One free-form note per user for general reminders (shown collapsed on Home)
    case 'UPDATE_GENERAL_NOTES': {
      const generalNotes = (action.notes || '').trim()
      const fullData = patchUser(state.fullData, state.activeUserId, { generalNotes })
      return changed(state, { data: { ...state.data, generalNotes }, fullData })
    }
    // Starred "key lifts" — pinned to the top of PRs
    case 'TOGGLE_KEY_LIFT': {
      const cur = state.data.keyLifts || []
      const keyLifts = cur.includes(action.exerciseId) ? cur.filter(id => id !== action.exerciseId) : [...cur, action.exerciseId]
      const fullData = patchUser(state.fullData, state.activeUserId, { keyLifts })
      return changed(state, { data: { ...state.data, keyLifts }, fullData })
    }
    case 'ADD_EXERCISE': {
      const exercises = [...(state.fullData.exercises || []), action.exercise]
      const fullData = { ...state.fullData, exercises }
      return changed(state, { data: { ...state.data, exercises }, fullData })
    }
    case 'LOG_BODY_WEIGHT': {
      const bodyWeightLog = [action.entry, ...state.data.bodyWeightLog]
      const fullData = patchUser(state.fullData, state.activeUserId, { bodyWeightLog })
      return changed(state, { data: { ...state.data, bodyWeightLog }, fullData })
    }
    // Replace everything (import of a full multi-user backup)
    case 'REPLACE_ALL_DATA': {
      const imported = migrate(action.data) || { ...EMPTY_DATA }
      // Tombstone sessions the backup doesn't have, so other phones can't merge them back
      const fullData = {
        ...imported,
        users: (imported.users || []).map(u => {
          const old = state.fullData.users?.find(o => o.id === u.id)
          if (!old) return u
          const keep = new Set((u.sessions || []).map(s => s.id))
          const dropped = (old.sessions || []).map(s => s.id).filter(id => !keep.has(id))
          return { ...u, deletedSessionIds: [...new Set([...(u.deletedSessionIds || []), ...dropped])] }
        }),
      }
      const user = fullData.users?.find(u => u.id === state.activeUserId) || fullData.users?.[0]
      const data = user ? buildUserView(fullData, user) : null
      // forceReplace: the next write overwrites GitHub instead of merging with it
      return changed(state, { fullData, data, activeUserId: user?.id || null, forceReplace: true })
    }
    case 'CLEAR_FORCE_REPLACE':
      return { ...state, forceReplace: false }
    // Replace only the active user's data (import of a single-user / v1 file)
    case 'REPLACE_USER_DATA': {
      const d = action.data
      const current = state.fullData.users?.find(u => u.id === state.activeUserId)
      const keep = new Set((d.sessions || []).map(s => s.id))
      const dropped = (current?.sessions || []).map(s => s.id).filter(id => !keep.has(id))
      const patch = {
        sessions: sortSessions(d.sessions || []),
        deletedSessionIds: [...new Set([...(current?.deletedSessionIds || []), ...dropped])],
        ...(d.splits?.length ? { splits: d.splits } : {}),
        ...(d.muscleGroupNotes ? { muscleGroupNotes: d.muscleGroupNotes } : {}),
        ...(d.bodyWeightLog ? { bodyWeightLog: d.bodyWeightLog } : {}),
      }
      let fullData = patchUser(state.fullData, state.activeUserId, patch)
      if (d.exercises?.length) {
        const known = new Set(fullData.exercises.map(e => e.id))
        fullData = { ...fullData, exercises: [...fullData.exercises, ...d.exercises.filter(e => !known.has(e.id))] }
      }
      return changed(state, withUserView(state, fullData))
    }
    default:
      return state
  }
}

const SEED_URL = `${import.meta.env.BASE_URL}data/workouts.json`

// Auto-configure from setup URL (?r=repo&t=token). Runs once at module load.
;(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const urlRepo = urlParams.get('r')
  const urlToken = urlParams.get('t')
  if (urlRepo && urlToken) {
    const sameRepo = getLS(LS_REPO) === urlRepo
    setLS(LS_TOKEN, urlToken)
    setLS(LS_REPO, urlRepo)
    // Keep unsynced local data when only the token changes
    if (!sameRepo) {
      removeLS(LS_DATA)
      removeLS(LS_SHA)
      removeLS(LS_PENDING)
      removeLS(LS_BASE)
      removeLS(LS_ACTIVE_USER)
    }
    window.history.replaceState({}, '', window.location.pathname)
  }
})()

function initState() {
  const cachedRaw = parseLS()
  const cachedData = migrate(cachedRaw)
  const savedUserId = getLS(LS_ACTIVE_USER)
  const initialUser = cachedData?.users?.find(u => u.id === savedUserId) || cachedData?.users?.[0]
  const pending = !!cachedData && getLS(LS_PENDING) === '1'
  return {
    fullData: cachedData || { ...EMPTY_DATA },
    data: initialUser ? buildUserView(cachedData, initialUser) : null,
    activeUserId: initialUser?.id || null,
    token: getLS(LS_TOKEN) || '',
    repo: getLS(LS_REPO) || '',
    loading: !cachedRaw,
    hadCache: !!cachedRaw,
    syncing: false,
    rev: pending ? 1 : 0,
    syncedRev: 0,
    error: null,
  }
}

const isConflict = err => err?.status === 409 || err?.status === 422

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  const stateRef = useRef(state)
  stateRef.current = state
  const shaRef = useRef(getLS(LS_SHA))
  const baseRef = useRef((() => { try { return JSON.parse(getLS(LS_BASE)) } catch { return null } })())
  const setBase = content => {
    baseRef.current = content
    if (content) setLS(LS_BASE, JSON.stringify(content)); else removeLS(LS_BASE)
  }
  const syncingRef = useRef(false)
  const syncedRevRef = useRef(0)
  // Writes wait for the startup read, so a slow read can't clobber a newer write
  const readyRef = useRef(!(state.token && state.repo))

  useEffect(() => {
    if (state.activeUserId) setLS(LS_ACTIVE_USER, state.activeUserId)
    else removeLS(LS_ACTIVE_USER)
  }, [state.activeUserId])

  useEffect(() => {
    if (state.fullData) setLS(LS_DATA, JSON.stringify(state.fullData))
  }, [state.fullData])

  useEffect(() => {
    if (state.rev > state.syncedRev) setLS(LS_PENDING, '1')
    else removeLS(LS_PENDING)
  }, [state.rev, state.syncedRev])

  const sync = useCallback(async () => {
    const { token, repo } = stateRef.current
    if (!token || !repo || syncingRef.current || !readyRef.current) return
    syncingRef.current = true
    dispatch({ type: 'SET_SYNCING', value: true })
    try {
      // Loop so edits made while a write is in flight are also pushed.
      while (stateRef.current.rev > syncedRevRef.current) {
        const { fullData, rev } = stateRef.current
        const message = `gym update ${localDate()}`
        let sha
        try {
          sha = await writeFile(token, repo, DATA_PATH, fullData, shaRef.current, message)
          setBase(fullData)
        } catch (err) {
          if (!isConflict(err)) throw err
          // Someone else (another device / user) wrote first: merge and retry.
          // Retry a few times in case both phones are syncing at the same moment.
          const force = stateRef.current.forceReplace
          for (let attempt = 1; ; attempt++) {
            const remote = await readFile(token, repo, DATA_PATH)
            const base = baseRef.current
            const toWrite = force ? fullData : mergeData(fullData, remote?.content, stateRef.current.activeUserId, base)
            try {
              sha = await writeFile(token, repo, DATA_PATH, toWrite, remote?.sha, message)
              if (!force) dispatch({ type: 'MERGE_REMOTE', data: remote?.content, base })
              setBase(toWrite)
              break
            } catch (e) {
              if (!isConflict(e) || attempt >= 3) throw e
            }
          }
        }
        if (stateRef.current.forceReplace) dispatch({ type: 'CLEAR_FORCE_REPLACE' })
        shaRef.current = sha
        setLS(LS_SHA, sha)
        syncedRevRef.current = rev
        dispatch({ type: 'SYNCED', rev })
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', message: `Not saved to GitHub yet — ${err.message}. Your data is safe on this phone.` })
    } finally {
      syncingRef.current = false
      dispatch({ type: 'SET_SYNCING', value: false })
    }
  }, [])

  // On first load: fetch from GitHub if configured, else load seed file
  useEffect(() => {
    const activeUserId = getLS(LS_ACTIVE_USER)
    const { token, repo, hadCache } = stateRef.current
    const hasPending = () => stateRef.current.rev > syncedRevRef.current

    if (token && repo) {
      readFile(token, repo, DATA_PATH)
        .then(result => {
          readyRef.current = true
          if (!result) { dispatch({ type: 'SET_LOADING', value: false }); sync(); return }
          shaRef.current = result.sha
          setLS(LS_SHA, result.sha)
          // Never clobber local changes that haven't been pushed — merge instead.
          if (hasPending()) {
            dispatch({ type: 'MERGE_REMOTE', data: result.content, base: baseRef.current })
            setBase(result.content)
            sync()
          } else {
            dispatch({ type: 'LOADED', data: result.content, activeUserId })
            setBase(result.content)
          }
        })
        .catch(err => {
          readyRef.current = true
          sync()
          if (hadCache) dispatch({ type: 'SET_LOADING', value: false })
          else dispatch({ type: 'SET_ERROR', message: err.message })
        })
      if (hadCache) dispatch({ type: 'SET_LOADING', value: false })
      return
    }

    if (hadCache) return
    fetch(SEED_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) dispatch({ type: 'LOADED', data, activeUserId })
        else dispatch({ type: 'SET_LOADING', value: false })
      })
      .catch(() => dispatch({ type: 'SET_LOADING', value: false }))
  }, [sync])

  useEffect(() => {
    if (state.rev > state.syncedRev) sync()
  }, [state.rev, state.syncedRev, sync])

  // When the app comes back to the foreground (a home-screen app can sit in memory
  // for days), pull what changed on GitHub meanwhile so we never work on a stale copy.
  const refreshingRef = useRef(false)
  const refresh = useCallback(async () => {
    const { token, repo } = stateRef.current
    if (!token || !repo || !readyRef.current || syncingRef.current || refreshingRef.current) return
    refreshingRef.current = true
    try {
      const result = await readFile(token, repo, DATA_PATH)
      if (!result || result.sha === shaRef.current || syncingRef.current) return
      shaRef.current = result.sha
      setLS(LS_SHA, result.sha)
      if (stateRef.current.rev > syncedRevRef.current) {
        dispatch({ type: 'MERGE_REMOTE', data: result.content, base: baseRef.current })
        setBase(result.content)
        sync()
      } else {
        dispatch({ type: 'LOADED', data: result.content, activeUserId: stateRef.current.activeUserId })
        setBase(result.content)
      }
    } catch { /* offline: keep working locally */ } finally {
      refreshingRef.current = false
    }
  }, [sync])

  // Retry unsynced changes when the connection comes back or the app is reopened.
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState !== 'visible') return
      if (stateRef.current.rev > syncedRevRef.current) sync()
      else refresh()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [sync, refresh])

  const setConfig = useCallback((token, repo) => {
    const sameRepo = getLS(LS_REPO) === repo
    setLS(LS_TOKEN, token)
    setLS(LS_REPO, repo)
    // Only a repo switch discards the local cache; a new token keeps unsynced workouts
    if (!sameRepo) {
      removeLS(LS_DATA)
      removeLS(LS_SHA)
      removeLS(LS_PENDING)
      removeLS(LS_BASE)
      baseRef.current = null
    }
  }, [])

  return (
    <StoreContext.Provider value={{ state, dispatch, sync, setConfig }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}

export function getLastSession(sessions, exerciseId) {
  for (const s of sessions) {
    const ex = s.exercises?.find(e => e.exerciseId === exerciseId)
    if (ex) return { date: s.date, sets: ex.sets }
  }
  return null
}

export function getExerciseHistory(sessions, exerciseId) {
  return sessions
    .filter(s => s.exercises?.some(e => e.exerciseId === exerciseId))
    .map(s => {
      const ex = s.exercises.find(e => e.exerciseId === exerciseId)
      const validSets = ex.sets.filter(st => st.weight != null && st.reps != null)
      const maxWeight = validSets.length ? Math.max(...validSets.map(st => st.weight)) : null
      const totalVolume = validSets.reduce((sum, st) => sum + st.weight * st.reps, 0)
      return { date: s.date, maxWeight, totalVolume, sets: ex.sets }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ── In-progress workout drafts (survive app reloads / phone locking) ─────────
const draftKey = (userId, dayId) => `gymlogger_draft_${userId}_${dayId}`
// Drafts never expire: they stay until the workout is finished or discarded,
// and Home reminds you about them every time the app opens.
export function loadDraft(userId, dayId) {
  try { return JSON.parse(getLS(draftKey(userId, dayId))) } catch { return null }
}
/** All unfinished workouts for a user: [{ dayId, splitDay, sessionDate, savedAt, ... }] */
export function listDrafts(userId) {
  const prefix = `gymlogger_draft_${userId}_`
  const out = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const d = loadDraft(userId, key.slice(prefix.length))
      if (d) out.push({ ...d, dayId: key.slice(prefix.length) })
    }
  } catch { /* storage blocked */ }
  return out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
}
export function saveDraft(userId, dayId, draft) {
  setLS(draftKey(userId, dayId), JSON.stringify({ ...draft, savedAt: Date.now() }))
}
export function clearDraft(userId, dayId) {
  removeLS(draftKey(userId, dayId))
}
