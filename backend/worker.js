const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_SECONDS = 4 * 60 * 60;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function base64Utf8(value) {
  const bytes = encoder.encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function decodeBase64Utf8(value) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return decoder.decode(bytes);
}
function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean).concat([
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:4173', 'http://127.0.0.1:4173',
  ]);
}
function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(request, env))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
async function hmacKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function createSession(username, env) {
  const payload = base64url(encoder.encode(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const key = await hmacKey(env);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return payload + '.' + base64url(signature);
}
async function verifySession(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  try {
    const key = await hmacKey(env);
    const ok = await crypto.subtle.verify('HMAC', key, fromBase64url(parts[1]), encoder.encode(parts[0]));
    if (!ok) return false;
    const payload = JSON.parse(decoder.decode(fromBase64url(parts[0])));
    return payload.sub === env.ADMIN_USERNAME && Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
function repoPath(env) {
  return String(env.GITHUB_PATH || 'public/soc-playbooks-backup.json').split('/').map(encodeURIComponent).join('/');
}
function githubHeaders(env) {
  if (!env.GITHUB_TOKEN) throw new Error('Missing GITHUB_TOKEN secret.');
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SOC-Playbook-Studio-API',
  };
}
function repoUrl(env, query = '') {
  if (!env.GITHUB_OWNER || !env.GITHUB_REPO) throw new Error('Set GITHUB_OWNER and GITHUB_REPO in Worker variables.');
  return `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${repoPath(env)}${query}`;
}
async function readRepoFile(env) {
  const response = await fetch(repoUrl(env, `?ref=${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`), { headers: githubHeaders(env) });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub read failed (${response.status}). ${response.status === 404 ? 'Check repository, branch, and GITHUB_PATH.' : detail.slice(0, 300)}`);
  }
  const file = await response.json();
  if (!file.content) throw new Error('GitHub returned no file content.');
  const content = decodeBase64Utf8(file.content);
  let data;
  try { data = JSON.parse(content); } catch { throw new Error('The repository playbook file is not valid JSON.'); }
  return { data, sha: file.sha };
}
function validatePlaybooks(payload) {
  const playbooks = payload && payload.playbooks;
  if (!Array.isArray(playbooks) || playbooks.length < 1 || playbooks.length > 500) return 'playbooks must be an array containing 1–500 entries.';
  const ids = new Set();
  for (const [index, p] of playbooks.entries()) {
    if (!p || typeof p !== 'object' || !p.id || !p.name || !p.category || !p.description || !Array.isArray(p.fields) || typeof p.template !== 'string') return `Playbook ${index + 1} has an invalid structure.`;
    if (String(p.name).length > 150 || String(p.description).length > 5000 || p.template.length > 20000 || p.fields.length > 150) return `Playbook ${index + 1} exceeds a size limit.`;
    if (ids.has(String(p.id))) return `Duplicate playbook ID: ${p.id}`;
    ids.add(String(p.id));
    if (!p.fields.every(f => f && typeof f.key === 'string')) return `Playbook ${index + 1} contains an invalid field.`;
  }
  if (payload.settings !== undefined) {
    if (!payload.settings || typeof payload.settings !== 'object' || !payload.settings.features || typeof payload.settings.features !== 'object') return 'settings.features must be an object.';
    const allowedFeatures = ['parser', 'workspace', 'library', 'apps', 'caseTools'];
    for (const key of allowedFeatures) if (typeof payload.settings.features[key] !== 'boolean') return `settings.features.${key} must be boolean.`;
  }
  return null;
}
async function writeRepoFile(env, payload) {
  const current = await readRepoFile(env);
  const document = {
    format: 'SOC Playbook Studio',
    version: 1,
    updatedAt: new Date().toISOString(),
    settings: { features: Object.fromEntries(['parser', 'workspace', 'library', 'apps', 'caseTools'].map(key => [key, payload.settings?.features?.[key] ?? true])) },
    playbooks: payload.playbooks,
  };
  const content = JSON.stringify(document, null, 2) + '\n';
  const response = await fetch(repoUrl(env), {
    method: 'PUT',
    headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'chore(playbooks): update shared playbook JSON',
      content: base64Utf8(content),
      sha: current.sha,
      branch: env.GITHUB_BRANCH || 'main',
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = result.message || `HTTP ${response.status}`;
    if (response.status === 409 || response.status === 422) throw new Error(`GitHub rejected the update (${detail}). Refresh the shared JSON and retry; another update may have landed first.`);
    throw new Error(`GitHub write failed (${response.status}): ${detail}. Confirm the token has Contents: Read and write permission.`);
  }
  return { document, commit: result.commit?.sha || null };
}
async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, service: 'SOC Playbook Studio API' });
  if (url.pathname === '/api/login' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return json({ error: 'Admin credentials are not configured on the API.' }, 503);
    if (body.username !== env.ADMIN_USERNAME || body.password !== env.ADMIN_PASSWORD) return json({ error: 'Incorrect username or password.' }, 401);
    return json({ token: await createSession(env.ADMIN_USERNAME, env), expiresIn: SESSION_SECONDS });
  }
  if (url.pathname === '/api/playbooks' && request.method === 'GET') {
    try { const { data } = await readRepoFile(env); return json(data); }
    catch (e) { return json({ error: e.message }, 502); }
  }
  if (url.pathname === '/api/playbooks' && request.method === 'PUT') {
    if (!(await verifySession(request, env))) return json({ error: 'Admin session invalid or expired. Sign in again.' }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Request body must be valid JSON.' }, 400); }
    const validation = validatePlaybooks(body);
    if (validation) return json({ error: validation }, 400);
    try { const result = await writeRepoFile(env, body); return json({ ok: true, updatedAt: result.document.updatedAt, commit: result.commit, playbooks: result.document.playbooks }); }
    catch (e) { return json({ error: e.message }, 502); }
  }
  return json({ error: 'Not found.' }, 404);
}
export default {
  async fetch(request, env) {
    try { return withCors(await handle(request, env), request, env); }
    catch (e) { return withCors(json({ error: e.message || 'Unexpected server error.' }, 500), request, env); }
  },
};
