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

function getLS(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function setLS(key, val) {
  try { localStorage.setItem(key, val) } catch {}
}

function parseLS() {
  try { return JSON.parse(getLS(LS_DATA)) } catch { return null }
}

// Migrate v1 data to v2
function migrate(raw) {
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

function reducer(state, action) {
  switch (action.type) {
    case 'LOADED': {
      const fullData = migrate(action.data) || { ...EMPTY_DATA }
      if (!fullData.exercises?.length) fullData.exercises = EXERCISES
      if (!fullData.movementGroups?.length) fullData.movementGroups = MOVEMENT_GROUPS
      const userId = action.activeUserId
      const user = fullData.users?.find(u => u.id === userId) || fullData.users?.[0]
      const data = user ? buildUserView(fullData, user) : null
      return { ...state, fullData, data, activeUserId: user?.id || null, loading: false, error: null }
    }
    case 'SET_LOADING':
      return { ...state, loading: action.value }
    case 'SET_ERROR':
      return { ...state, error: action.message, loading: false, syncing: false }
    case 'SET_SYNCING':
      return { ...state, syncing: action.value }
    case 'SET_CONFIG':
      return { ...state, token: action.token, repo: action.repo, loading: true, error: null }
    case 'SET_ACTIVE_USER': {
      if (!action.userId) return { ...state, data: null, activeUserId: null }
      const user = state.fullData.users?.find(u => u.id === action.userId)
      if (!user) return state
      return { ...state, data: buildUserView(state.fullData, user), activeUserId: action.userId }
    }
    case 'ADD_USER': {
      const user = action.user
      const fullData = { ...state.fullData, users: [...(state.fullData.users || []), user] }
      return { ...state, fullData, data: buildUserView(fullData, user), activeUserId: user.id, dirty: true }
    }
    case 'ADD_SESSION': {
      const sessions = [action.session, ...state.data.sessions]
      const fullData = patchUser(state.fullData, state.activeUserId, { sessions })
      return { ...state, data: { ...state.data, sessions }, fullData, dirty: true }
    }
    case 'UPDATE_SESSION': {
      const sessions = state.data.sessions.map(s => s.id === action.session.id ? action.session : s)
      const fullData = patchUser(state.fullData, state.activeUserId, { sessions })
      return { ...state, data: { ...state.data, sessions }, fullData, dirty: true }
    }
    case 'DELETE_SESSION': {
      const sessions = state.data.sessions.filter(s => s.id !== action.id)
      const fullData = patchUser(state.fullData, state.activeUserId, { sessions })
      return { ...state, data: { ...state.data, sessions }, fullData, dirty: true }
    }
    case 'UPDATE_MUSCLE_NOTE': {
      const muscleGroupNotes = { ...state.data.muscleGroupNotes, [action.group]: action.notes }
      const fullData = patchUser(state.fullData, state.activeUserId, { muscleGroupNotes })
      return { ...state, data: { ...state.data, muscleGroupNotes }, fullData, dirty: true }
    }
    case 'ADD_EXERCISE': {
      const exercises = [...(state.fullData.exercises || []), action.exercise]
      const fullData = { ...state.fullData, exercises }
      return { ...state, data: { ...state.data, exercises }, fullData, dirty: true }
    }
    case 'LOG_BODY_WEIGHT': {
      const bodyWeightLog = [action.entry, ...state.data.bodyWeightLog]
      const fullData = patchUser(state.fullData, state.activeUserId, { bodyWeightLog })
      return { ...state, data: { ...state.data, bodyWeightLog }, fullData, dirty: true }
    }
    case 'UPDATE_DATA': {
      const fullData = migrate(action.data) || { ...EMPTY_DATA }
      const user = fullData.users?.find(u => u.id === state.activeUserId) || fullData.users?.[0]
      const data = user ? buildUserView(fullData, user) : null
      return { ...state, fullData, data, activeUserId: user?.id || state.activeUserId, dirty: true }
    }
    case 'MARK_CLEAN':
      return { ...state, dirty: false }
    default:
      return state
  }
}

const SEED_URL = `${import.meta.env.BASE_URL}data/workouts.json`

export function StoreProvider({ children }) {
  // Auto-configure from setup URL (?r=repo&t=token)
  const urlParams = new URLSearchParams(window.location.search)
  const urlRepo = urlParams.get('r')
  const urlToken = urlParams.get('t')
  if (urlRepo && urlToken) {
    setLS(LS_TOKEN, urlToken)
    setLS(LS_REPO, urlRepo)
    localStorage.removeItem(LS_DATA)
    localStorage.removeItem(LS_SHA)
    localStorage.removeItem(LS_ACTIVE_USER)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const cachedRaw = parseLS()
  const cachedData = migrate(cachedRaw)
  const savedUserId = getLS(LS_ACTIVE_USER)
  const initialUser = cachedData?.users?.find(u => u.id === savedUserId) || cachedData?.users?.[0]

  const [state, dispatch] = useReducer(reducer, {
    fullData: cachedData || { ...EMPTY_DATA },
    data: initialUser ? buildUserView(cachedData, initialUser) : null,
    activeUserId: initialUser?.id || null,
    token: getLS(LS_TOKEN) || '',
    repo: getLS(LS_REPO) || '',
    loading: !cachedRaw,
    syncing: false,
    dirty: false,
    error: null,
  })

  const shaRef = useRef(getLS(LS_SHA))
  const syncingRef = useRef(false)

  // Save active user to localStorage
  useEffect(() => {
    if (state.activeUserId) setLS(LS_ACTIVE_USER, state.activeUserId)
    else localStorage.removeItem(LS_ACTIVE_USER)
  }, [state.activeUserId])

  // Persist full data to localStorage
  useEffect(() => {
    if (state.fullData) setLS(LS_DATA, JSON.stringify(state.fullData))
  }, [state.fullData])

  // On first load: fetch from GitHub if configured, else load seed file
  useEffect(() => {
    const activeUserId = getLS(LS_ACTIVE_USER)
    if (cachedRaw) {
      if (state.token && state.repo) {
        readFile(state.token, state.repo, DATA_PATH)
          .then(result => {
            if (result) {
              shaRef.current = result.sha
              setLS(LS_SHA, result.sha)
              dispatch({ type: 'LOADED', data: result.content, activeUserId })
            }
          })
          .catch(() => {})
      }
      dispatch({ type: 'SET_LOADING', value: false })
      return
    }

    if (state.token && state.repo) {
      readFile(state.token, state.repo, DATA_PATH)
        .then(result => {
          if (result) {
            shaRef.current = result.sha
            setLS(LS_SHA, result.sha)
            dispatch({ type: 'LOADED', data: result.content, activeUserId })
          } else {
            dispatch({ type: 'SET_LOADING', value: false })
          }
        })
        .catch(err => dispatch({ type: 'SET_ERROR', message: err.message }))
    } else {
      fetch(SEED_URL)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            dispatch({ type: 'LOADED', data, activeUserId })
          } else {
            dispatch({ type: 'SET_LOADING', value: false })
          }
        })
        .catch(() => dispatch({ type: 'SET_LOADING', value: false }))
    }
  }, [])

  const sync = useCallback(async () => {
    if (!state.token || !state.repo || syncingRef.current) return
    syncingRef.current = true
    dispatch({ type: 'SET_SYNCING', value: true })
    try {
      const sha = await writeFile(
        state.token, state.repo, DATA_PATH,
        state.fullData, shaRef.current,
        `gym update ${new Date().toISOString().slice(0, 10)}`
      )
      shaRef.current = sha
      setLS(LS_SHA, sha)
      dispatch({ type: 'MARK_CLEAN' })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', message: err.message })
    } finally {
      syncingRef.current = false
      dispatch({ type: 'SET_SYNCING', value: false })
    }
  }, [state.token, state.repo, state.fullData])

  useEffect(() => {
    if (state.dirty) sync()
  }, [state.dirty])

  const setConfig = useCallback((token, repo) => {
    setLS(LS_TOKEN, token)
    setLS(LS_REPO, repo)
    localStorage.removeItem(LS_DATA)
    localStorage.removeItem(LS_SHA)
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
