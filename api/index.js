const crypto = require('crypto');

const OWNER = String(process.env.GITHUB_OWNER || '').trim();
const REPO = String(process.env.GITHUB_REPO || '').trim();
const BRANCH = String(process.env.GITHUB_BRANCH || 'main').trim();
const TOKEN = String(process.env.GITHUB_TOKEN || '').trim();
const PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || '').trim();
const ALLOWED_ORIGIN = String(process.env.ALLOWED_ORIGIN || '*').trim();
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 4 * 1024 * 1024);

function configured() { return !!(OWNER && REPO && TOKEN && PASSWORD && SESSION_SECRET); }
function safePath(p) {
  p = String(p || '').replace(/^\/+|\/+$/g, '');
  if (!p || p.includes('..') || p.includes('\\') || p.startsWith('.github')) throw httpError(400, 'مسار غير مسموح');
  if (!(p === 'clients' || p.startsWith('clients/') || p === 'data/custom.json')) throw httpError(403, 'المسار خارج مساحة المركز');
  return p;
}
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
function b64utf8(s) { return Buffer.from(String(s), 'utf8').toString('base64'); }
function utf8b64(s) { return Buffer.from(String(s).replace(/\s/g, ''), 'base64').toString('utf8'); }
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token) {
  try {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return false;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return Number(payload.exp) > Date.now();
  } catch { return false; }
}
function auth(req) {
  const header = req.headers?.authorization || '';
  if (!verify(header.replace(/^Bearer\s+/i, ''))) throw httpError(401, 'Unauthorized');
}
function ghUrl(path) {
  const encoded = String(path).split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${encoded}`;
}
async function gh(path, options = {}, attempt = 0) {
  const query = options.query ? `?${options.query}` : '';
  let response;
  try {
    response = await fetch(ghUrl(path) + query, {
      method: options.method || 'GET',
      body: options.body,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (e) {
    if (attempt < 2) { await new Promise(r => setTimeout(r, 500 * (attempt + 1))); return gh(path, options, attempt + 1); }
    throw e;
  }
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) {
    const e = httpError(response.status, data.message || `GitHub HTTP ${response.status}`);
    e.data = data;
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
      await new Promise(r => setTimeout(r, 700 * (attempt + 1)));
      return gh(path, options, attempt + 1);
    }
    throw e;
  }
  return data;
}
async function contents(path) { return gh(path, { query: `ref=${encodeURIComponent(BRANCH)}` }); }
async function commitFile(path, contentBase64, message, sha = '') {
  const body = { message, content: String(contentBase64 || ''), branch: BRANCH };
  if (sha) body.sha = sha;
  return gh(path, { method: 'PUT', body: JSON.stringify(body) });
}
async function getFileBase64(path, item) {
  if (item?.content) return String(item.content).replace(/\s/g, '');
  if (!item?.download_url) throw new Error('تعذر الوصول إلى محتوى الملف');
  const r = await fetch(item.download_url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github.raw' } });
  if (!r.ok) throw httpError(r.status, `تعذر تحميل الملف (${r.status})`);
  return Buffer.from(await r.arrayBuffer()).toString('base64');
}
async function recursiveDelete(path) {
  const item = await contents(path);
  if (Array.isArray(item)) {
    for (const child of item) await recursiveDelete(child.path);
    return;
  }
  await gh(item.path, { method: 'DELETE', body: JSON.stringify({ message: `Delete ${item.path}`, branch: BRANCH, sha: item.sha }) });
}
async function recursiveRename(oldPath, newPath) {
  const item = await contents(oldPath);
  if (Array.isArray(item)) {
    if (!item.length) await commitFile(`${newPath}/.keep`, b64utf8(''), `Rename ${oldPath} to ${newPath}`);
    for (const child of item) {
      const suffix = child.path.slice(oldPath.length).replace(/^\//, '');
      await recursiveRename(child.path, `${newPath}/${suffix}`);
    }
  } else {
    const content = await getFileBase64(oldPath, item);
    await commitFile(newPath, content, `Rename ${oldPath} to ${newPath}`);
  }
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch {} }
  return {};
}
async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!configured()) return res.status(500).json({ ok: false, error: 'API environment is not configured' });

  try {
    const body = await readBody(req);
    const q = req.query || {};
    const action = req.method === 'GET' ? q.action : body.action;

    if (action === 'login' && req.method === 'POST') {
      const given = String(body.password || '');
      const a = Buffer.from(given), b = Buffer.from(PASSWORD);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw httpError(401, 'Unauthorized');
      const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
      return res.status(200).json({ ok: true, token: sign({ exp: expiresAt }), expiresAt });
    }

    if (action === 'tree' && req.method === 'GET') {
      const p = safePath(q.path || 'clients');
      const data = await contents(p);
      if (!Array.isArray(data)) throw httpError(400, 'المسار ليس مجلدًا');
      return res.status(200).json({ ok: true, data: data.map(x => ({ name:x.name, type:x.type, path:x.path, sha:x.sha, size:x.size||0, download_url:x.download_url, html_url:x.html_url })) });
    }

    if (action === 'file' && req.method === 'GET') {
      const p = safePath(q.path);
      const data = await contents(p);
      if (Array.isArray(data)) throw httpError(400, 'المسار مجلد');
      let contentBase64 = data.content ? String(data.content).replace(/\s/g, '') : '';
      if (!contentBase64 && data.download_url) {
        const raw = await fetch(data.download_url, { headers: { Authorization:`Bearer ${TOKEN}`, Accept:'application/vnd.github.raw' } });
        if (raw.ok) contentBase64 = Buffer.from(await raw.arrayBuffer()).toString('base64');
      }
      let parsed = contentBase64 ? utf8b64(contentBase64) : '';
      if (p.endsWith('.client.json') || p === 'data/custom.json') { try { parsed = JSON.parse(parsed); } catch {} }
      return res.status(200).json({ ok:true, data:{ name:data.name, path:data.path, sha:data.sha, size:data.size||0, download_url:data.download_url, html_url:data.html_url, content:parsed, contentBase64 } });
    }

    if (action === 'data' && req.method === 'GET') {
      try {
        const f = await contents('data/custom.json');
        return res.status(200).json({ ok:true, data:JSON.parse(utf8b64(f.content||'')) });
      } catch {
        return res.status(200).json({ ok:true, data:{entries:[],projects:[],knowledge:[],ideas:[],sources:[]} });
      }
    }

    auth(req);

    if (action === 'raw' && req.method === 'GET') {
      const p = safePath(q.path);
      const data = await contents(p);
      if (Array.isArray(data) || !data.download_url) throw httpError(400, 'تعذر الوصول إلى الملف');
      const raw = await fetch(data.download_url, { headers:{ Authorization:`Bearer ${TOKEN}`, Accept:'application/vnd.github.raw' } });
      if (!raw.ok) throw httpError(raw.status, `تعذر تحميل الملف (${raw.status})`);
      const buf = Buffer.from(await raw.arrayBuffer());
      res.setHeader('Content-Type', raw.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Cache-Control', 'private, no-store');
      return res.end(buf);
    }

    if (['create_file','update_file'].includes(action) && req.method === 'POST') {
      const p = safePath(body.path);
      const content = String(body.contentBase64 || '');
      const estimatedBytes = Math.floor(content.length * 3 / 4);
      if (estimatedBytes > MAX_UPLOAD_BYTES) throw httpError(413, `حجم الملف أكبر من الحد المسموح (${MAX_UPLOAD_BYTES} بايت)`);
      if (action === 'update_file' && !body.sha) throw httpError(400, 'SHA مطلوب لتحديث الملف');
      if (action === 'create_file') {
        try { await contents(p); throw httpError(409, 'يوجد عنصر بهذا الاسم بالفعل'); } catch(e) { if (e.status === 409) throw e; if (e.status !== 404) throw e; }
      }
      const result = await commitFile(p, content, String(body.message || `${action === 'create_file' ? 'Add' : 'Update'} ${p}`), body.sha || '');
      return res.status(200).json({ ok:true, data:result });
    }

    if (action === 'create_folder' && req.method === 'POST') {
      const p = safePath(body.path);
      const result = await commitFile(p, b64utf8(''), `Create ${p}`);
      return res.status(200).json({ ok:true, data:result });
    }

    if (action === 'delete_path' && req.method === 'POST') {
      const p = safePath(body.path);
      await recursiveDelete(p);
      return res.status(200).json({ ok:true });
    }

    if (action === 'rename_path' && req.method === 'POST') {
      const oldPath = safePath(body.path), newPath = safePath(body.newPath);
      if (oldPath === newPath) return res.status(200).json({ ok:true });
      if (newPath.startsWith(oldPath + '/')) throw httpError(400, 'لا يمكن نقل عنصر إلى داخله');
      try { await contents(newPath); throw httpError(409, 'يوجد عنصر بهذا الاسم بالفعل'); } catch(e) { if (e.status === 409) throw e; if (e.status !== 404) throw e; }
      await recursiveRename(oldPath, newPath);
      await recursiveDelete(oldPath);
      return res.status(200).json({ ok:true });
    }

    if (action === 'mutate_data' && req.method === 'POST') {
      const kind = String(body.kind || '');
      const allowed = ['entries','projects','knowledge','ideas','sources'];
      if (!allowed.includes(kind)) throw httpError(400, 'نوع بيانات غير مسموح');
      for (let attempt = 0; attempt < 3; attempt++) {
        const f = await contents('data/custom.json');
        const current = JSON.parse(utf8b64(f.content || ''));
        current[kind] = Array.isArray(current[kind]) ? current[kind] : [];
        if (body.operation === 'add') current[kind].unshift(body.item);
        else if (body.operation === 'delete') current[kind] = current[kind].filter(x => x.id !== body.item?.id);
        else if (body.operation === 'update') current[kind] = current[kind].map(x => x.id === body.item?.id ? body.item : x);
        else throw httpError(400, 'عملية غير مسموحة');
        try {
          const result = await commitFile('data/custom.json', b64utf8(JSON.stringify(current, null, 2)), `Update custom data (${kind})`, f.sha);
          return res.status(200).json({ ok:true, data:result });
        } catch (e) {
          if (e.status === 409 && attempt < 2) { await new Promise(r => setTimeout(r, 250 * (attempt + 1))); continue; }
          throw e;
        }
      }
    }

    throw httpError(400, 'Action not supported');
  } catch (e) {
    const status = Number(e.status) || 500;
    return res.status(status).json({ ok:false, error:e.message || 'Internal error' });
  }
}

module.exports = async (req, res) => handler(req, res);
