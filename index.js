const crypto = require('crypto');

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const API_VERSION = '2026-03-10';
const DATA_PATH = 'data/custom.json';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const sessions = new Map();
const failures = new Map();

function originFor(req) {
  const incoming = req.headers.origin || '';
  if (ALLOWED_ORIGIN && incoming === ALLOWED_ORIGIN) return incoming;
  if (!ALLOWED_ORIGIN && incoming) return incoming;
  return ALLOWED_ORIGIN || '*';
}
function cors(req) {
  return {
    'Access-Control-Allow-Origin': originFor(req),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin'
  };
}
function json(req, data, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors(req), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function requireConfig() {
  if (!OWNER || !REPO || !TOKEN || !SESSION_SECRET || !ADMIN_PASSWORD || !ALLOWED_ORIGIN) throw new Error('API configuration is incomplete');
}
function normalizePath(path='') {
  let p = String(path).replace(/^\/+|\/+$/g,'');
  if (!p || p.includes('..') || /(^|\/)\.github(\/|$)/i.test(p)) throw new Error('Invalid path');
  return p;
}
function githubHeaders() {
  return {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${TOKEN}`,
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'central-workspace-api'
  };
}
async function gh(path, options={}) {
  requireConfig();
  const url = `https://api.github.com${path}`;
  const r = await fetch(url, { ...options, headers: { ...githubHeaders(), ...(options.headers||{}) } });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const message = data?.message || text || `GitHub API ${r.status}`;
    const e = new Error(message); e.status = r.status; throw e;
  }
  return data;
}
function b64url(v) { return Buffer.from(v).toString('base64url'); }
function fromB64url(v) { return Buffer.from(v, 'base64url').toString('utf8'); }
function sign(v) { return crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url'); }
function issueSession() {
  const payload = b64url(JSON.stringify({ sub:'admin', exp: Date.now()+8*60*60*1000, nonce:crypto.randomUUID() }));
  return `${payload}.${sign(payload)}`;
}
function validSession(token='') {
  if (!token || !SESSION_SECRET) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const p = JSON.parse(fromB64url(payload));
    return p.sub === 'admin' && Number(p.exp) > Date.now();
  } catch { return false; }
}
function clientIp(req) { return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'; }
function blocked(ip) {
  const v = failures.get(ip); if (!v) return false;
  if (Date.now() - v.start > 10*60*1000) { failures.delete(ip); return false; }
  return v.count >= 5;
}
function fail(ip) {
  const now=Date.now(); const v=failures.get(ip);
  if (!v || now-v.start > 10*60*1000) failures.set(ip,{count:1,start:now}); else v.count++;
}
function clearFail(ip){ failures.delete(ip); }
function auth(req, body) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i,'') || body?.token || '';
  if (!validSession(token)) throw Object.assign(new Error('Unauthorized'), { status:401 });
}
function assertClientPath(p) {
  const n=normalizePath(p);
  if (!/^clients\//.test(n)) throw new Error('Client paths only');
  return n;
}
async function getContents(path='') {
  const p=normalizePath(path||'');
  const endpoint=p ? `/repos/${OWNER}/${REPO}/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(BRANCH)}` : `/repos/${OWNER}/${REPO}/contents/?ref=${encodeURIComponent(BRANCH)}`;
  return gh(endpoint);
}
async function getFile(path) {
  const data=await getContents(path);
  if (Array.isArray(data)) throw Object.assign(new Error('Path is a directory'),{status:400});
  let content='';
  if (data.content && data.encoding==='base64') content=Buffer.from(data.content.replace(/\n/g,''),'base64').toString('utf8');
  return { ...data, decodedText: content };
}
async function getFileRawBase64(path) {
  const data=await getContents(path);
  if (Array.isArray(data)) throw Object.assign(new Error('Path is a directory'),{status:400});
  // Contents API may omit content for large files; use download URL as a fallback.
  if (data.content && data.encoding==='base64') return { ...data, base64:data.content.replace(/\n/g,'') };
  const r=await fetch(data.download_url, {headers:{'User-Agent':'central-workspace-api'}});
  if (!r.ok) throw new Error(`Unable to read ${path}`);
  const ab=await r.arrayBuffer();
  return { ...data, base64:Buffer.from(ab).toString('base64') };
}
async function putFile(path, base64, message, sha) {
  const body={message,content:base64,branch:BRANCH}; if(sha) body.sha=sha;
  return gh(`/repos/${OWNER}/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
async function deleteFile(path, sha, message) {
  return gh(`/repos/${OWNER}/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,sha,branch:BRANCH})});
}
async function listFilesRecursive(path, out=[]) {
  const items=await getContents(path);
  if (!Array.isArray(items)) { out.push(items); return out; }
  for (const item of items) {
    if (item.type==='dir') await listFilesRecursive(item.path,out); else out.push(item);
  }
  return out;
}
async function updateCustomData(mutator) {
  let current={entries:[],projects:[],knowledge:[],ideas:[],sources:[]};
  try { const f=await getFile(DATA_PATH); current=JSON.parse(f.decodedText||'{}'); } catch {}
  const next=mutator({...current});
  const encoded=Buffer.from(JSON.stringify(next,null,2),'utf8').toString('base64');
  let sha=''; try { sha=(await getContents(DATA_PATH)).sha; } catch {}
  await putFile(DATA_PATH,encoded,`chore(workspace): update shared data`,sha);
  return next;
}

async function handler(req) {
  if (req.method==='OPTIONS') return new Response('ok',{status:204,headers:cors(req)});
  try {
    const incomingOrigin = req.headers.get('origin') || '';
    if (ALLOWED_ORIGIN && incomingOrigin && incomingOrigin !== ALLOWED_ORIGIN) return json(req,{ok:false,error:'Origin not allowed'},403);
    if (req.method === 'POST' && !ALLOWED_ORIGIN) throw Object.assign(new Error('ALLOWED_ORIGIN is required for writes'),{status:500});
    const url=new URL(req.url);
    if (req.method==='GET') {
      const action=url.searchParams.get('action')||'health';
      if(action==='health') return json(req,{ok:true,storage:'github',repo:`${OWNER||'?'}/${REPO||'?'}`,branch:BRANCH});
      requireConfig();
      if(action==='tree') return json(req,{ok:true,data:await getContents(url.searchParams.get('path')||'')});
      if(action==='file') {
        const p=normalizePath(url.searchParams.get('path')||''); const f=await getFile(p);
        const ext=(p.split('.').pop()||'').toLowerCase();
        const textable=['txt','md','csv','json','html','css','js','ts','xml','yaml','yml'].includes(ext);
        return json(req,{ok:true,data:{path:p,name:f.name,sha:f.sha,size:f.size,download_url:f.download_url,html_url:f.html_url,content:textable?f.decodedText:'',textable,mime:ext}});
      }
      if(action==='raw') {
        const p=normalizePath(url.searchParams.get('path')||''); const f=await getContents(p);
        if(Array.isArray(f)) throw Object.assign(new Error('Path is a directory'),{status:400});
        return json(req,{ok:true,data:{download_url:f.download_url,html_url:f.html_url,sha:f.sha,size:f.size,name:f.name}});
      }
      if(action==='data') {
        try { const f=await getFile(DATA_PATH); return json(req,{ok:true,data:JSON.parse(f.decodedText||'{}')}); }
        catch { return json(req,{ok:true,data:{entries:[],projects:[],knowledge:[],ideas:[],sources:[]}}); }
      }
      throw Object.assign(new Error('Unknown GET action'),{status:400});
    }
    if(req.method==='POST') {
      const body=await req.json(); const action=body.action;
      if(action==='login') {
        const ip=clientIp(req); if(blocked(ip)) return json(req,{ok:false,error:'Too many attempts. Try again later.'},429);
        if(body.password!==ADMIN_PASSWORD){fail(ip);return json(req,{ok:false,error:'Unauthorized'},401)}
        clearFail(ip); const token=issueSession(); sessions.set(token,Date.now()+8*60*60*1000); return json(req,{ok:true,token,expiresAt:Date.now()+8*60*60*1000});
      }
      auth(req,body); requireConfig();
      if(action==='create_client') {
        const name=String(body.name||'').trim(); if(!name) throw new Error('Client name is required');
        const safe=name.replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').slice(0,100);
        const meta={name:safe,code:String(body.code||safe.slice(0,2)).slice(0,8),status:String(body.status||'نشط'),description:String(body.description||''),createdAt:new Date().toISOString()};
        const path=`clients/${safe}/.client.json`; await putFile(path,Buffer.from(JSON.stringify(meta,null,2),'utf8').toString('base64'),`feat(client): create ${safe}`);
        return json(req,{ok:true,data:{id:`client:${safe}`,path:`clients/${safe}`,...meta}});
      }
      if(action==='create_folder') {
        const p=assertClientPath(body.path); if(!p.endsWith('/.keep')) throw new Error('Invalid folder marker');
        await putFile(p,Buffer.from('','utf8').toString('base64'),`feat(client): create folder ${p.replace(/\/\.keep$/,'')}`); return json(req,{ok:true});
      }
      if(action==='create_file' || action==='update_file') {
        const p=assertClientPath(body.path); const b64=typeof body.contentBase64==='string'?body.contentBase64:null; if(b64===null) throw new Error('contentBase64 is required');
        const bytes=Buffer.from(b64,'base64'); if(bytes.length>MAX_UPLOAD_BYTES) throw new Error('File exceeds 4 MB safety limit');
        let sha=body.sha||'';
        if(action==='update_file'&&!sha) sha=(await getContents(p)).sha;
        if(action==='create_file'){ try { const existing=await getContents(p); if(!Array.isArray(existing)) throw Object.assign(new Error('File already exists; use update_file'),{status:409}); } catch(e){ if(e.status===409) throw e; } }
        const result=await putFile(p,b64,`${action==='update_file'?'update':'create'}(client): ${p}`,sha||undefined); return json(req,{ok:true,data:{path:p,sha:result.content?.sha,download_url:result.content?.download_url,html_url:result.content?.html_url}});
      }
      if(action==='delete_path') {
        const p=assertClientPath(body.path); const items=await listFilesRecursive(p,[]); // serial deletion avoids Contents API conflicts
        if(items.length===0){
          let meta; try{meta=await getContents(p)}catch{}
          if(meta?.sha) items.push(meta);
        }
        for(const item of items.sort((a,b)=>b.path.length-a.path.length)) await deleteFile(item.path,item.sha,`chore(client): delete ${item.path}`);
        return json(req,{ok:true,deleted:items.map(x=>x.path)});
      }
      if(action==='save_data') {
        const clean={
          entries:Array.isArray(body.data?.entries)?body.data.entries:[],
          projects:Array.isArray(body.data?.projects)?body.data.projects:[],
          knowledge:Array.isArray(body.data?.knowledge)?body.data.knowledge:[],
          ideas:Array.isArray(body.data?.ideas)?body.data.ideas:[],
          sources:Array.isArray(body.data?.sources)?body.data.sources:[]
        };
        const next=await updateCustomData(()=>clean); return json(req,{ok:true,data:next});
      }
      if(action==='mutate_data') {
        const kind=String(body.kind||''); const operation=String(body.operation||''); if(!['entries','projects','knowledge','ideas','sources'].includes(kind)) throw new Error('Invalid collection');
        const item=body.item||{}; const next=await updateCustomData(cur=>{cur[kind]=Array.isArray(cur[kind])?cur[kind]:[]; if(operation==='add') cur[kind]=[item,...cur[kind]]; else if(operation==='delete') cur[kind]=cur[kind].filter(x=>x.id!==item.id); else if(operation==='update') cur[kind]=cur[kind].map(x=>x.id===item.id?item:x); else throw new Error('Invalid operation'); return cur;});
        return json(req,{ok:true,data:next});
      }
      throw Object.assign(new Error('Unknown POST action'),{status:400});
    }
    return json(req,{ok:false,error:'Method not allowed'},405);
  } catch(e) {
    const status=e.status||500; return json(req,{ok:false,error:e.message||'Server error'},status);
  }
}

module.exports = async (req, res) => {
  try {
    const headers = new Headers(req.headers || {});
    const host = headers.get('host') || 'localhost';
    const init = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const body = req.body == null ? '' : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      init.body = body;
    }
    const request = new Request(`https://${host}${req.url || '/'}`, init);
    const response = await handler(request);
    res.statusCode = response.status;
    response.headers.forEach((v,k)=>res.setHeader(k,v));
    res.end(await response.text());
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({ok:false,error:e?.message||'Server error'}));
  }
};
