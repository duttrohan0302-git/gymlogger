const BASE = 'https://api.github.com'

function b64Encode(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

function b64Decode(b64) {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)))
  return new TextDecoder().decode(bytes)
}

function headers(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

export async function readFile(token, repo, path) {
  // no-store: GitHub sends max-age=60, and a cached (stale) sha causes write conflicts
  const url = `${BASE}/repos/${repo}/contents/${path}`
  const res = await fetch(url, { headers: headers(token), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw Object.assign(new Error(`GitHub read failed: ${res.status}`), { status: res.status })
  const data = await res.json()
  if (data.content) return { content: JSON.parse(b64Decode(data.content)), sha: data.sha }
  // Files over 1 MB come back with empty `content`; fetch the raw body instead
  const raw = await fetch(url, {
    headers: { ...headers(token), Accept: 'application/vnd.github.raw+json' },
    cache: 'no-store',
  })
  if (!raw.ok) throw Object.assign(new Error(`GitHub read failed: ${raw.status}`), { status: raw.status })
  return { content: await raw.json(), sha: data.sha }
}

export async function writeFile(token, repo, path, content, sha, message) {
  const body = {
    message,
    content: b64Encode(JSON.stringify(content, null, 2)),
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(`${BASE}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: headers(token),
    cache: 'no-store',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(`GitHub write failed: ${err.message || res.status}`), { status: res.status })
  }
  const data = await res.json()
  return data.content.sha
}

export async function validateToken(token, repo) {
  const res = await fetch(`${BASE}/repos/${repo}`, { headers: headers(token) })
  if (res.status === 401) throw new Error('Invalid token')
  if (res.status === 404) throw new Error('Repo not found — check owner/repo format')
  if (!res.ok) throw new Error(`Error: ${res.status}`)
  return true
}
