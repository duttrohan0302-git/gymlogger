import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { readFile, writeFile } from './github'
import { EMPTY_DATA } from '../data/defaultData'

const StoreContext = createContext(null)

const DATA_PATH = 'data/workouts.json'
const LS_DATA = 'gymlogger_data'
const LS_SHA = 'gymlogger_sha'
const LS_TOKEN = 'gymlogger_token'
const LS_REPO = 'gymlogger_repo'

function getLS(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function setLS(key, val) {
  try { localStorage.setItem(key, val) } catch {}
}

function parseLS() {
  try { return JSON.parse(getLS(LS_DATA)) } catch { return null }
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOADED':
      return { ...state, data: action.data, loading: false, error: null }
    case 'SET_LOADING':
      return { ...state, loading: action.value }
    case 'SET_ERROR':
      return { ...state, error: action.message, loading: false, syncing: false }
    case 'SET_SYNCING':
      return { ...state, syncing: action.value }
    case 'SET_CONFIG':
      return { ...state, token: action.token, repo: action.repo, loading: true, error: null }
    case 'ADD_SESSION': {
      const sessions = [action.session, ...state.data.sessions]
      return { ...state, data: { ...state.data, sessions }, dirty: true }
    }
    case 'UPDATE_SESSION': {
      const sessions = state.data.sessions.map(s => s.id === action.session.id ? action.session : s)
      return { ...state, data: { ...state.data, sessions }, dirty: true }
    }
    case 'DELETE_SESSION': {
      const sessions = state.data.sessions.filter(s => s.id !== action.id)
      return { ...state, data: { ...state.data, sessions }, dirty: true }
    }
    case 'UPDATE_MUSCLE_NOTE': {
      const muscleGroupNotes = { ...state.data.muscleGroupNotes, [action.group]: action.notes }
      return { ...state, data: { ...state.data, muscleGroupNotes }, dirty: true }
    }
    case 'ADD_EXERCISE': {
      const exercises = [...state.data.exercises, action.exercise]
      return { ...state, data: { ...state.data, exercises }, dirty: true }
    }
    case 'LOG_BODY_WEIGHT': {
      const bodyWeightLog = [action.entry, ...state.data.bodyWeightLog]
      return { ...state, data: { ...state.data, bodyWeightLog }, dirty: true }
    }
    case 'UPDATE_DATA':
      return { ...state, data: action.data, dirty: true }
    case 'MARK_CLEAN':
      return { ...state, dirty: false }
    default:
      return state
  }
}

const SEED_URL = `${import.meta.env.BASE_URL}data/workouts.json`

export function StoreProvider({ children }) {
  const cachedData = parseLS()
  const hasConfig = !!(getLS(LS_TOKEN) && getLS(LS_REPO))
  const [state, dispatch] = useReducer(reducer, {
    data: cachedData || EMPTY_DATA,
    token: getLS(LS_TOKEN) || '',
    repo: getLS(LS_REPO) || '',
    loading: !cachedData, // always show loader on first visit — seed or GitHub
    syncing: false,
    dirty: false,
    error: null,
  })

  const shaRef = useRef(getLS(LS_SHA))
  const syncingRef = useRef(false)

  // On first load: fetch from GitHub if configured, else load the seed file from the repo
  useEffect(() => {
    if (cachedData) {
      // Already have cached data — if GitHub configured, still refresh in background
      if (state.token && state.repo) {
        readFile(state.token, state.repo, DATA_PATH)
          .then(result => {
            if (result) {
              shaRef.current = result.sha
              setLS(LS_SHA, result.sha)
              setLS(LS_DATA, JSON.stringify(result.content))
              dispatch({ type: 'LOADED', data: result.content })
            }
          })
          .catch(() => {}) // silent — we already have cached data
      }
      dispatch({ type: 'SET_LOADING', value: false })
      return
    }

    if (state.token && state.repo) {
      // Fetch fresh from GitHub
      readFile(state.token, state.repo, DATA_PATH)
        .then(result => {
          if (result) {
            shaRef.current = result.sha
            setLS(LS_SHA, result.sha)
            setLS(LS_DATA, JSON.stringify(result.content))
            dispatch({ type: 'LOADED', data: result.content })
          } else {
            dispatch({ type: 'SET_LOADING', value: false })
          }
        })
        .catch(err => dispatch({ type: 'SET_ERROR', message: err.message }))
    } else {
      // No GitHub config — load the seed file served from the repo
      fetch(SEED_URL)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setLS(LS_DATA, JSON.stringify(data))
            dispatch({ type: 'LOADED', data })
          } else {
            dispatch({ type: 'SET_LOADING', value: false })
          }
        })
        .catch(() => dispatch({ type: 'SET_LOADING', value: false }))
    }
  }, []) // run once on mount

  // Persist to localStorage on data change
  useEffect(() => {
    if (state.data) setLS(LS_DATA, JSON.stringify(state.data))
  }, [state.data])

  const sync = useCallback(async () => {
    if (!state.token || !state.repo || syncingRef.current) return
    syncingRef.current = true
    dispatch({ type: 'SET_SYNCING', value: true })
    try {
      const sha = await writeFile(
        state.token, state.repo, DATA_PATH,
        state.data, shaRef.current,
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
  }, [state.token, state.repo, state.data])

  // Auto-sync when dirty
  useEffect(() => {
    if (state.dirty) sync()
  }, [state.dirty])

  const setConfig = useCallback((token, repo) => {
    setLS(LS_TOKEN, token)
    setLS(LS_REPO, repo)
    // Clear cache so reload fetches fresh from GitHub
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

// Selectors
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
