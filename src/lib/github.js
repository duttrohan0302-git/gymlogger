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
  const res = await fetch(`${BASE}/repos/${repo}/contents/${path}`, { headers: headers(token) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`)
  const data = await res.json()
  return { content: JSON.parse(b64Decode(data.content)), sha: data.sha }
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
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`GitHub write failed: ${err.message || res.status}`)
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
