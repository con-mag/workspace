const crypto = require("crypto");

const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || "main";
const TOKEN = process.env.GITHUB_TOKEN;
const PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const gh = async (path, options = {}) => {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  if (!r.ok) throw new Error(data.message || `GitHub HTTP ${r.status}`);
  return data;
};

function configured() {
  return OWNER && REPO && TOKEN && PASSWORD && SESSION_SECRET;
}
function safePath(p) {
  p = String(p || "").replace(/^\/+|\/+$/g, "");
  if (!p || p.includes("..") || p.includes("\\") || p.startsWith(".github")) {
    throw new Error("مسار غير مسموح");
  }
  if (!(p === "clients" || p.startsWith("clients/") || p === "data/custom.json")) {
    throw new Error("المسار خارج مساحة المركز");
  }
  return p;
}
function b64utf8(s) { return Buffer.from(s, "utf8").toString("base64"); }
function utf8b64(s) { return Buffer.from(String(s).replace(/\n/g, ""), "base64").toString("utf8"); }

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  try {
    const [body, sig] = String(token || "").split(".");
    if (!body || !sig) return false;
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.exp > Date.now();
  } catch { return false; }
}
function auth(req) {
  const h = req.headers.authorization || "";
  if (!verify(h.replace(/^Bearer\s+/i, ""))) {
    const e = new Error("Unauthorized"); e.status = 401; throw e;
  }
}

async function contents(path) {
  return gh(path + `?ref=${encodeURIComponent(BRANCH)}`);
}
async function commitFile(path, contentBase64, message, sha) {
  const body = { message, content: contentBase64, branch: BRANCH };
  if (sha) body.sha = sha;
  return gh(path, { method: "PUT", body: JSON.stringify(body) });
}
async function recursiveDelete(path) {
  const item = await contents(path);
  if (Array.isArray(item)) {
    for (const child of item) await recursiveDelete(child.path);
    return;
  }
  await gh(path, { method: "DELETE", body: JSON.stringify({
    message: `Delete ${path}`, branch: BRANCH, sha: item.sha
  })});
}

async function handle(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!configured()) return res.status(500).json({ok:false,error:"API environment is not configured"});

  try {
    const method = req.method;
    const q = req.query || {};
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }
    const action = method === "GET" ? q.action : body.action;

    if (action === "login" && method === "POST") {
      const given = String(body.password || "");
      const a = Buffer.from(given), b = Buffer.from(String(PASSWORD));
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ok:false,error:"Unauthorized"});
      }
      const token = sign({exp: Date.now() + 8 * 60 * 60 * 1000});
      return res.status(200).json({ok:true,token,expiresAt:Date.now()+8*60*60*1000});
    }

    if (action === "tree" && method === "GET") {
      const p = safePath(q.path || "clients");
      const data = await contents(p);
      if (!Array.isArray(data)) throw new Error("المسار ليس مجلدًا");
      return res.status(200).json({ok:true,data:data.map(x=>({
        name:x.name,type:x.type,path:x.path,sha:x.sha,size:x.size||0,
        download_url:x.download_url,html_url:x.html_url
      }))});
    }

    if (action === "file" && method === "GET") {
      const p = safePath(q.path);
      const data = await contents(p);
      if (Array.isArray(data)) throw new Error("المسار مجلد");
      const content = data.content ? utf8b64(data.content) : "";
      let parsed = content;
      if (p.endsWith(".client.json") || p === "data/custom.json") {
        try { parsed = JSON.parse(content); } catch {}
      }
      return res.status(200).json({ok:true,data:{
        name:data.name,path:data.path,sha:data.sha,size:data.size||0,
        download_url:data.download_url,html_url:data.html_url,content:parsed
      }});
    }

    if (action === "data" && method === "GET") {
      try {
        const f = await contents("data/custom.json");
        const parsed = JSON.parse(utf8b64(f.content || ""));
        return res.status(200).json({ok:true,data:parsed});
      } catch {
        return res.status(200).json({ok:true,data:{entries:[],projects:[],knowledge:[],ideas:[],sources:[]}});
      }
    }

    auth(req);

    if (action === "create_file" && method === "POST") {
      const p = safePath(body.path);
      const result = await commitFile(p, String(body.contentBase64 || ""), `Add ${p}`);
      return res.status(200).json({ok:true,data:result});
    }

    if (action === "update_file" && method === "POST") {
      const p = safePath(body.path);
      if (!body.sha) throw new Error("SHA مطلوب لتحديث الملف");
      const result = await commitFile(p, String(body.contentBase64 || ""), `Update ${p}`, body.sha);
      return res.status(200).json({ok:true,data:result});
    }

    if (action === "create_folder" && method === "POST") {
      const p = safePath(body.path);
      const result = await commitFile(p, b64utf8(""), `Create ${p}`);
      return res.status(200).json({ok:true,data:result});
    }

    if (action === "delete_path" && method === "POST") {
      const p = safePath(body.path);
      await recursiveDelete(p);
      return res.status(200).json({ok:true});
    }

    if (action === "mutate_data" && method === "POST") {
      const f = await contents("data/custom.json");
      const current = JSON.parse(utf8b64(f.content || ""));
      const kind = String(body.kind || "");
      const allowed = ["entries","projects","knowledge","ideas","sources"];
      if (!allowed.includes(kind)) throw new Error("نوع بيانات غير مسموح");
      current[kind] = Array.isArray(current[kind]) ? current[kind] : [];
      if (body.operation === "add") current[kind].unshift(body.item);
      else if (body.operation === "delete") current[kind] = current[kind].filter(x => x.id !== body.item?.id);
      else throw new Error("عملية غير مسموحة");
      const result = await commitFile("data/custom.json", b64utf8(JSON.stringify(current,null,2)), "Update custom data", f.sha);
      return res.status(200).json({ok:true,data:result});
    }

    return res.status(400).json({ok:false,error:"Action not supported"});
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ok:false,error:e.message || "Internal error"});
  }
}

module.exports = async (req,res) => {
  if (!req.query) req.query = {};
  return handle(req,res);
};
