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

/**
 * Merge a remote copy into local data. Local wins for anything both sides have;
 * remote contributes sessions/users/exercises local doesn't know about. Deleted
 * session ids (tombstones) from either side stay deleted.
 */
export function mergeData(local, remote, activeUserId) {
  if (!remote) return local
  remote = migrate(remote)
  const localExIds = new Set((local.exercises || []).map(e => e.id))
  const exercises = [...(local.exercises || []), ...(remote.exercises || []).filter(e => !localExIds.has(e.id))]

  const remoteUsers = remote.users || []
  const users = (local.users || []).map(lu => {
    const ru = remoteUsers.find(u => u.id === lu.id)
    if (!ru) return lu
    // The user on this phone wins for their own data; for everyone else
    // (e.g. a partner logging on their own phone) the remote copy is newer.
    const mine = lu.id === activeUserId
    const [win, lose] = mine ? [lu, ru] : [ru, lu]
    const deleted = new Set([...(lu.deletedSessionIds || []), ...(ru.deletedSessionIds || [])])
    const winIds = new Set((win.sessions || []).map(s => s.id))
    const sessions = sortSessions([
      ...(win.sessions || []),
      ...(lose.sessions || []).filter(s => !winIds.has(s.id)),
    ].filter(s => !deleted.has(s.id)))
    const bwKey = e => `${e.date}|${e.weight}`
    const localBw = new Set((lu.bodyWeightLog || []).map(bwKey))
    const bodyWeightLog = [...(lu.bodyWeightLog || []), ...(ru.bodyWeightLog || []).filter(e => !localBw.has(bwKey(e)))]
    return { ...lose, ...win, sessions, bodyWeightLog, deletedSessionIds: [...deleted] }
  })
  const localUserIds = new Set(users.map(u => u.id))
  for (const ru of remoteUsers) if (!localUserIds.has(ru.id)) users.push(ru)

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
      const fullData = mergeData(state.fullData, action.data, state.activeUserId)
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
      const fullData = migrate(action.data) || { ...EMPTY_DATA }
      const user = fullData.users?.find(u => u.id === state.activeUserId) || fullData.users?.[0]
      const data = user ? buildUserView(fullData, user) : null
      return changed(state, { fullData, data, activeUserId: user?.id || null })
    }
    // Replace only the active user's data (import of a single-user / v1 file)
    case 'REPLACE_USER_DATA': {
      const d = action.data
      const patch = {
        sessions: sortSessions(d.sessions || []),
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
        } catch (err) {
          if (!isConflict(err)) throw err
          // Someone else (another device / user) wrote first: merge and retry.
          const remote = await readFile(token, repo, DATA_PATH)
          const merged = mergeData(fullData, remote?.content, stateRef.current.activeUserId)
          sha = await writeFile(token, repo, DATA_PATH, merged, remote?.sha, message)
          dispatch({ type: 'MERGE_REMOTE', data: remote?.content })
        }
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
            dispatch({ type: 'MERGE_REMOTE', data: result.content })
            sync()
          } else {
            dispatch({ type: 'LOADED', data: result.content, activeUserId })
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

  // Retry unsynced changes when the connection comes back or the app is reopened.
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === 'visible' && stateRef.current.rev > syncedRevRef.current) sync()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [sync])

  const setConfig = useCallback((token, repo) => {
    const sameRepo = getLS(LS_REPO) === repo
    setLS(LS_TOKEN, token)
    setLS(LS_REPO, repo)
    // Only a repo switch discards the local cache; a new token keeps unsynced workouts
    if (!sameRepo) {
      removeLS(LS_DATA)
      removeLS(LS_SHA)
      removeLS(LS_PENDING)
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
