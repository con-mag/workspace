(() => {
  'use strict';
  const K = window.KNOWLEDGE || { knowledge: [], ideas: [], terms: [], sources: [], playbook: [], standards: [] };
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const APP = window.APP_CONFIG || {};
  const API_BASE = String(APP.API_BASE || '/api').replace(/\/$/, '');
  const POLL_MS = Number(APP.POLL_MS || 15000);
  const CLOUD_CONFIGURED = !!API_BASE;
  const LOCAL_KEY = 'central-workspace-local-v5';
  const SESSION_KEY = 'central-workspace-session-v2';
  const baseClients = [{id:'retaj-ali',name:'ريتاج علي',code:'RA',status:'نشط',description:'كاتبة — إدارة صفحة فيسبوك',path:'clients/ريتاج علي',createdAt:'2026-09-01',baseline:true}];
  const baseProjects = [{id:'project-retaj-facebook',clientId:'retaj-ali',name:'إدارة صفحة فيسبوك',status:'نشط',startDate:'2026-09-01',endDate:'2027-04-30',description:'إدارة استراتيجية ومحتوى ونشر وتحليل لصفحة Facebook.',createdAt:'2026-09-01',baseline:true}];
  let custom={entries:[],projects:[],knowledge:[],ideas:[],sources:[]};
  let clients=[...baseClients], projects=[...baseProjects];
  let currentRoute='home', openClient=null, currentPath='', selectedFile=null, folderCache=new Map(), clientMetaCache=new Map(), folderSort='number';
  let remoteReady=false, pollTimer=null, pollBusy=false, mutationBusy=false, remoteFingerprint='';
  const uniqueById=arr=>{const m=new Map();for(const x of arr||[]){if(x?.id)m.set(x.id,x)}return [...m.values()]};

  function loadLocalState(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')}catch{return {}}}
  function localSave(){try{localStorage.setItem(LOCAL_KEY,JSON.stringify({custom,clients,projects}))}catch(e){console.warn('Local state save:',e)}}
  let localDbPromise=null;
  function localDb(){
    if(localDbPromise)return localDbPromise;
    localDbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('IndexedDB غير متاح في هذا المتصفح'));
      const req=indexedDB.open('central-workspace-files-v2',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('items'))db.createObjectStore('items',{keyPath:'key'})};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('تعذر فتح التخزين المحلي'));
    });return localDbPromise;
  }
  async function localList(clientId,parent=''){const db=await localDb();return new Promise((resolve,reject)=>{const req=db.transaction('items','readonly').objectStore('items').getAll();req.onsuccess=()=>{const p=String(parent||'').replace(/^\/+|\/+$/g,'');resolve((req.result||[]).filter(x=>x.clientId===clientId&&x.parent===p).map(x=>({...x,source:'local'})))};req.onerror=()=>reject(req.error)})}
  async function localAll(clientId){const db=await localDb();return new Promise((resolve,reject)=>{const req=db.transaction('items','readonly').objectStore('items').getAll();req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.clientId===clientId));req.onerror=()=>reject(req.error)})}
  async function localGet(key){const db=await localDb();return new Promise((resolve,reject)=>{const req=db.transaction('items','readonly').objectStore('items').get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}
  async function localPut(item){const db=await localDb();return new Promise((resolve,reject)=>{const req=db.transaction('items','readwrite').objectStore('items').put(item);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
  async function localRemove(key){const db=await localDb();return new Promise((resolve,reject)=>{const req=db.transaction('items','readwrite').objectStore('items').delete(key);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})}
  function localKey(clientId,path){return `${clientId}::${String(path||'').replace(/^\/+|\/+$/g,'')}`}
  function mimeFor(name){const ext=(name.split('.').pop()||'').toLowerCase();return ({txt:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',html:'text/html',css:'text/css',js:'text/javascript',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',mp4:'video/mp4',webm:'video/webm'})[ext]||'application/octet-stream'}
  function session(){try{const o=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(o?.expiresAt>Date.now())return o.token;sessionStorage.removeItem(SESSION_KEY)}catch{}return ''}
  function setSession(token,expiresAt){sessionStorage.setItem(SESSION_KEY,JSON.stringify({token,expiresAt:Number(expiresAt||Date.now()+8*60*60*1000)}))}
  function clearSession(){sessionStorage.removeItem(SESSION_KEY)}
  function notifySave(text){const b=$('#saveBanner'),t=$('#saveBannerText');if(!b||!t)return;t.textContent=text;b.classList.add('show');clearTimeout(notifySave.timer);notifySave.timer=setTimeout(()=>b.classList.remove('show'),2600)}
  function toast(text){const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3000)}
  function setSync(text,cloud){$('#syncText').textContent=text;$('#syncState').textContent=cloud?'حفظ مشترك + مزامنة':'محلي';$('#syncPill').classList.toggle('cloud',!!cloud);$('#systemNumber').textContent=cloud?'SYNC':'LOCAL';$('#systemDesc').textContent=cloud?'البيانات محفوظة عبر واجهة API آمنة، والأجهزة ترى النسخة المشتركة نفسها.':'الموقع يعمل محليًا؛ اربط API الحفظ المشترك ليعمل بين الأجهزة.';$('#saveNote').textContent=cloud?'الحفظ والمزامنة المشتركان يعملان.':'الحفظ المشترك غير متاح حاليًا.'}
  function hasCloud(){return CLOUD_CONFIGURED}
  function cloudError(e){
    if(e?.status===401)return 'جلسة التعديل غير صالحة أو انتهت. أدخل كلمة المرور مرة أخرى.';
    if(e?.status===403)return 'الخادم رفض العملية. تحقق من إعدادات API وصلاحيات GitHub.';
    if(e?.status===404)return 'واجهة الحفظ غير موجودة. تحقق من عنوان API_BASE ونشر الـAPI.';
    if(e?.status===409)return 'حدث تعارض مع تغيير آخر. أعد المحاولة.';
    if(e?.status===422)return `تم رفض البيانات: ${e.message}`;
    if(e instanceof TypeError)return 'تعذر الوصول إلى واجهة الحفظ. تحقق من الاتصال وإعدادات CORS.';
    return e?.message||'خطأ غير معروف';
  }
  function apiUrl(action,params={}){const u=new URL(API_BASE,location.href);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null)u.searchParams.set(k,String(v))});return u.toString()}
  async function apiFetch(action,{method='GET',params={},body=null,auth=false,raw=false,retry=0}={}){
    const headers={'Accept':'application/json'};
    if(body!==null)headers['Content-Type']='application/json';
    if(auth){const t=session();if(!t){const e=new Error('Unauthorized');e.status=401;throw e}headers.Authorization=`Bearer ${t}`}
    let r;
    try{r=await fetch(apiUrl(action,params),{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'})}
    catch(e){if(retry<2){await new Promise(x=>setTimeout(x,500*(retry+1)));return apiFetch(action,{method,params,body,auth,raw,retry:retry+1})}throw e}
    if(raw){if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;throw e}return r.blob()}
    const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
    if(!r.ok){const e=new Error(data.error||`HTTP ${r.status}`);e.status=r.status;e.data=data;throw e}
    return data;
  }
  async function ghContents(path){const r=await apiFetch('tree',{params:{path:String(path||'').replace(/^\/+|\/+$/g,'')}});return r.data||[]}
  async function ghFile(path){const r=await apiFetch('file',{params:{path:String(path||'').replace(/^\/+|\/+$/g,'')}});const d=r.data||{};return {...d,contentBase64:String(d.contentBase64||'').replace(/\s/g,'')}}
  async function ghRaw(path){return apiFetch('raw',{params:{path:String(path||'').replace(/^\/+|\/+$/g,'')},auth:true,raw:true})}
  async function ghWrite(path,contentBase64,message,sha='',attempt=0){
    try{return (await apiFetch('update_file',{method:'POST',auth:true,body:{path,contentBase64:String(contentBase64||''),sha,message}})).data}
    catch(e){if(e.status===409&&attempt<2){const fresh=await ghFile(path);return ghWrite(path,contentBase64,message,fresh.sha,attempt+1)}throw e}
  }
  async function ghCreate(path,contentBase64,message){
    try{await ghFile(path);throw new Error('يوجد ملف بهذا الاسم بالفعل. اختر اسمًا آخر.')}
    catch(e){if(e.status!==404)throw e}
    return (await apiFetch('create_file',{method:'POST',auth:true,body:{path,contentBase64:String(contentBase64||''),message}})).data
  }
  async function ghDelete(path,sha=''){return (await apiFetch('delete_path',{method:'POST',auth:true,body:{path,sha}})).data}
  async function ghRename(path,newPath){return (await apiFetch('rename_path',{method:'POST',auth:true,body:{path,newPath}})).data}
  async function ensureLogin(){
    if(session())return true;
    return new Promise(resolve=>{
      const mc=$('#modalContent'),modal=$('#modal');
      mc.innerHTML=`<div class="password-box"><div class="password-icon">⌁</div><h2>صلاحية التعديل</h2><p>أدخل كلمة مرور المدير للمتابعة.</p><div class="field"><label>كلمة المرور</label><input id="adminPass" class="password-input" type="password" inputmode="numeric" maxlength="64" autocomplete="off" placeholder="••••"></div><div class="modal-actions"><button class="primary-btn" id="passOk">متابعة</button><button class="ghost-btn" id="passCancel">إلغاء</button></div></div>`;
      modal.classList.add('show');setTimeout(()=>$('#adminPass')?.focus(),30);
      const close=()=>{modal.classList.remove('show');resolve(false)};$('#passCancel').onclick=close;
      $('#passOk').onclick=async()=>{const pass=String($('#adminPass')?.value||'');if(!pass)return;try{const r=await apiFetch('login',{method:'POST',body:{password:pass}});setSession(r.token,r.expiresAt);modal.classList.remove('show');resolve(true)}catch(e){toast(e.status===401?'كلمة المرور غير صحيحة.':`تعذر تسجيل الدخول: ${cloudError(e)}`);$('#adminPass').select()}};
      $('#adminPass').onkeydown=e=>{if(e.key==='Enter')$('#passOk').click();if(e.key==='Escape')close()};
    });
  }
  async function mutateGithub(action,payload={}){
    if(!(await ensureLogin()))throw new Error('cancelled');
    while(mutationBusy)await new Promise(resolve=>setTimeout(resolve,80));
    mutationBusy=true;
    try{
      let r;
      if(action==='create_file')r=await ghCreate(payload.path,payload.contentBase64,`Add ${payload.path}`);
      else if(action==='update_file')r=await ghWrite(payload.path,payload.contentBase64,`Update ${payload.path}`,payload.sha||'');
      else if(action==='create_folder')r=await ghCreate(payload.path,btoa(''),`Create ${payload.path}`);
      else if(action==='delete_path')r=await ghDelete(payload.path,payload.sha||'');
      else if(action==='rename_path')r=await ghRename(payload.path,payload.newPath);
      else if(action==='mutate_data')r=await mutateData(payload.kind,payload.operation,payload.item);
      else throw new Error('عملية غير مدعومة');
      remoteReady=true;notifySave('تم الحفظ بنجاح');return r;
    }finally{mutationBusy=false}
  }
  async function mutateData(kind,operation,item){
    const allowed=['entries','projects','knowledge','ideas','sources'];if(!allowed.includes(kind))throw new Error('نوع بيانات غير مسموح');
    const r=await apiFetch('mutate_data',{method:'POST',auth:true,body:{kind,operation,item}});return r.data;
  }

  function normalizeClientIdFromPath(path){return `client:${path}`}
  function clientPath(id){const c=clients.find(x=>x.id===id);return c?.path||`clients/${c?.name||''}`}
  function fileType(name){const ext=(name.split('.').pop()||'').toLowerCase();if(['txt','md','csv','json','html','css','js','ts','xml','yaml','yml'].includes(ext))return 'نص';if(['docx','doc'].includes(ext))return 'Word';if(['xlsx','xls'].includes(ext))return 'Excel';if(ext==='pdf')return 'PDF';if(['png','jpg','jpeg','webp','gif','svg'].includes(ext))return 'صورة';if(['mp4','mov','webm'].includes(ext))return 'فيديو';return ext||'ملف'}
  function fileIcon(kind,folder=false){
    const svg=(body)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    if(folder)return svg('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M3.5 9h17"/>');
    if(kind==='PDF')return svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M8 15h8M8 18h6"/>');
    if(kind==='Word')return svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="m8 12 1.2 5 1.4-3.5L12 17l1.2-5"/>');
    if(kind==='Excel')return svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8v8M12 8v8M16 8v8M8 12h8"/>');
    if(kind==='صورة')return svg('<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.4"/><path d="m6 17 4-4 3 3 2-2 3 3"/>');
    if(kind==='فيديو')return svg('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>');
    if(kind==='نص')return svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M8 13h8M8 16h6"/>');
    return svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>');
  }
  function folderSortKey(name){const m=String(name).match(/^(\d+)/);return m?Number(m[1]):999999;}


  async function refreshCloud(){
    if(!CLOUD_CONFIGURED){remoteReady=false;setSync('محلي',false);return}
    setSync('جاري الاتصال',false);
    try{
      const root=await ghContents('clients');
      const dirs=(Array.isArray(root)?root:[]).filter(x=>x.type==='dir'&&!x.name.startsWith('.'));
      const remoteClients=[];
      for(const d of dirs){
        let meta={};
        try{const f=await ghFile(`${d.path}/.client.json`);if(f.contentBase64)meta=JSON.parse(utf8b64(f.contentBase64))||{}}catch{}
        remoteClients.push({id:normalizeClientIdFromPath(d.path),name:meta.name||d.name,code:meta.code||String(d.name).slice(0,2),status:meta.status||'نشط',description:meta.description||'مساحة عميل',path:d.path,createdAt:meta.createdAt||'',baseline:false});
        clientMetaCache.set(d.path,meta);
      }
      clients=remoteClients;
      try{const f=await ghFile('data/custom.json');custom=JSON.parse(utf8b64(f.contentBase64||''))||{entries:[],projects:[],knowledge:[],ideas:[],sources:[]};}catch{custom={entries:[],projects:[],knowledge:[],ideas:[],sources:[]}}
      projects=uniqueById([...baseProjects.map(x=>{const c=clients.find(y=>y.name==='ريتاج علي');return x.name==='إدارة صفحة فيسبوك'&&c?{...x,clientId:c.id}:x}),...(custom.projects||[])]);
      const fingerprint=JSON.stringify({clients:clients.map(x=>[x.id,x.name,x.path]),projects,custom});
      const changed=fingerprint!==remoteFingerprint; remoteFingerprint=fingerprint;remoteReady=true;folderCache.clear();localSave();setSync('مشترك',true);if(changed||currentRoute==='clients'||openClient){renderRoute(currentRoute);if(openClient)await renderClient(openClient)}
    }catch(e){remoteReady=false;setSync('غير متصل',false);console.warn('GitHub sync:',e);toast(`تعذر الاتصال بـGitHub: ${cloudError(e)}`)}
  }
  function startPolling(){if(!CLOUD_CONFIGURED)return;clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(pollBusy||mutationBusy)return;pollBusy=true;try{await refreshCloud()}finally{pollBusy=false}},POLL_MS)}

  function go(route){currentRoute=route;openClient=null;currentPath='';selectedFile=null;location.hash=route;$$('.route').forEach(r=>r.classList.toggle('active',r.dataset.routeView===route));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route===route));renderRoute(route);window.scrollTo({top:0,behavior:'smooth'});if(innerWidth<861)$('#sidebar').classList.remove('open')}
  function goClient(id,path='',file=null){openClient=id;currentRoute='client';currentPath=path||'';selectedFile=file;location.hash=`client/${encodeURIComponent(id)}${path?`/${encodeURIComponent(path)}`:''}`;$$('.route').forEach(r=>r.classList.toggle('active',r.dataset.routeView==='client'));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route==='clients'));renderClient(id);window.scrollTo({top:0,behavior:'smooth'});if(innerWidth<861)$('#sidebar').classList.remove('open')}

  function renderHome(){
    const dashboard=[['knowledge','book','قاعدة المعرفة','المبادئ والاستراتيجية والقياس.'],['playbook','layers','دليل التشغيل','كيف تتحول المعرفة إلى سير عمل.'],['ideas','spark','مختبر الأفكار','زوايا نشر قابلة لإعادة الاستخدام.'],['analytics','chart','القياس والتحليل','من الأرقام إلى القرار.'],['clients','users','مكتبة العملاء','مساحات مستقلة لكل عميل.'],['projects','brief','المشروعات','المشروعات والحالات الجارية.'],['dictionary','type','المصطلحات','المعنى والنطق والاستخدام.'],['sources','link','غرفة المصادر','مراجع رسمية ومتخصصة.']];
    $('#dashboardCards').innerHTML=dashboard.map(x=>`<a class="dash-card" href="#${x[0]}" data-go="${x[0]}"><div class="dc-top"><i data-icon="${x[1]}"></i><span class="tag">فتح</span></div><h3>${x[2]}</h3><p>${x[3]}</p></a>`).join('');
    $('#clientCount').textContent=clients.length;$('#projectCount').textContent=projects.length;$('#ideaCount').textContent=(K.ideas||[]).length+(custom.ideas||[]).length;$('#homeClients').innerHTML=clients.slice(0,3).map(c=>`<article class="client-card" data-client="${esc(c.id)}"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description||'مساحة عميل')}</p></div><span class="mini-status">${esc(c.status||'نشط')}</span></article>`).join('')||empty('لا توجد عملاء.');
    $$('[data-icon]',$('#dashboardCards')).forEach(el=>el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[el.dataset.icon]||''}</svg>`);$$('.dash-card').forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.go)});$$('[data-client]',$('#homeClients')).forEach(x=>x.onclick=()=>goClient(x.dataset.client));
  }
  function renderKnowledge(){const filter=$('#knowledgeFilters');const levels=[...new Set((K.knowledge||[]).map(x=>x.level))].sort((a,b)=>a-b);filter.innerHTML=`<button class="chip active" data-level="all">الكل</button>`+levels.map(l=>`<button class="chip" data-level="${l}">المستوى ${l}</button>`).join('');const list=[...(K.knowledge||[]),...(custom.knowledge||[])];const draw=(lvl='all')=>{$('#knowledgeGrid').innerHTML=list.filter(x=>lvl==='all'||String(x.level)===String(lvl)).map(x=>`<article class="knowledge-card"><div class="card-topline"><span class="tag level-tag">المستوى ${esc(x.level||'—')}</span><span class="tag">${esc(x.type||'مادة')}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.body||x.content||'')}</p>${x.take?`<div class="take">${esc(x.take)}</div>`:''}${x.id?.startsWith('custom-')?`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="knowledge" data-id="${esc(x.id)}">تعديل</button><button class="danger-btn" data-delete-custom="knowledge" data-id="${esc(x.id)}">حذف الإضافة</button></div>`:''}</article>`).join('')||empty('لا توجد مواد.');$('#knowledgeCount').textContent=`${list.length} مادة`};draw();$$('[data-level]',filter).forEach(b=>b.onclick=()=>{$$('[data-level]',filter).forEach(x=>x.classList.remove('active'));b.classList.add('active');draw(b.dataset.level)});bindDeleteCustom($('#knowledgeGrid'))}
  function renderPlaybook(){$('#playbookGrid').innerHTML=(K.playbook||[]).map(x=>`<article class="playbook-card"><span class="eyebrow">PLAYBOOK</span><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p><ol>${x.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></article>`).join('')}
  function renderIdeas(){const filter=$('#ideasGrid'), type=$$('.chip[data-idea-filter]');const all=[...(K.ideas||[]).map((x,i)=>({id:`builtin-${i}`,title:x[0],kind:x[1],desc:x[2],formats:x.slice(3),builtin:true})),...(custom.ideas||[])];const draw=f=>{filter.innerHTML=all.filter(x=>f==='all'||x.kind===f).map(x=>`<article class="idea-card"><div class="card-topline"><span class="tag">${esc(x.kind||'فكرة')}</span>${x.builtin?'':'<span class="tag">إضافتك</span>'}</div><h3>${esc(x.title)}</h3><p>${esc(x.desc||'')}</p>${x.formats?`<div class="take">${x.formats.map(esc).join(' · ')}</div>`:''}${x.builtin?'':`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="ideas" data-id="${esc(x.id)}">تعديل</button><button class="danger-btn" data-delete-custom="ideas" data-id="${esc(x.id)}">حذف الإضافة</button></div>`}</article>`).join('')||empty('لا توجد أفكار.');bindDeleteCustom(filter)};draw('all');type.forEach(b=>b.onclick=()=>{type.forEach(x=>x.classList.remove('active'));b.classList.add('active');draw(b.dataset.ideaFilter)})}
  function renderAnalytics(){const total=(K.knowledge||[]).length;$('#metricCards').innerHTML=[['المعرفة الأساسية',total,'مادة منظمة'],['العملاء',clients.length,'مساحات فعلية'],['المشروعات',projects.length,'حالات حالية'],['الأفكار',((K.ideas||[]).length+(custom.ideas||[]).length),'بنك قابل للتوسع']].map(x=>`<div class="metric"><div class="m-label">${x[0]}</div><div class="m-value">${x[1]}</div><div class="m-note">${x[2]}</div></div>`).join('');const ds=[['وصول مرتفع + متابعة منخفضة','افصل بين قوة الاكتشاف وضعف التحويل إلى متابعة؛ راجع الصفحة والتموضع والدعوة للإجراء.'],['حفظ مرتفع + مشاركة منخفضة','قد يكون المحتوى مرجعيًا أكثر من كونه قابلًا للنقل الاجتماعي.'],['تفاعل جيد + وصول منخفض','اختبر ملاءمة الموضوع والتغليف قبل تغيير الاستراتيجية كلها.'],['منشور واحد قوي جدًا','اعتبره إشارة تستحق التكرار والاختبار، لا قاعدة نهائية.']];$('#diagnosisList').innerHTML=ds.map(d=>`<div class="diagnosis"><b>${d[0]}</b><span>${d[1]}</span></div>`).join('')}

  function renderClients(){
    const q=String($('#clientSearch')?.value||'').trim().toLowerCase();const list=clients.filter(c=>!q||`${c.name} ${c.description}`.toLowerCase().includes(q));$('#clientLibraryCount').textContent=`${list.length} عميل`;
    $('#clientsGrid').innerHTML=list.map(c=>`<article class="client-large"><div class="client-ident"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description||'مساحة العميل')}</p></div></div><div class="client-meta"><span class="meta-pill">${esc(c.status||'نشط')}</span><span class="meta-pill">ملفات قابلة للإدارة</span><span class="meta-pill">مزامنة مشتركة</span></div><p class="client-description">هذه ليست بطاقة تعريف؛ الضغط عليها يفتح مساحة العمل الفعلية للعميل، ومنها تدخل إلى المجلدات والملفات وتضيف أو تعدل أو تحذف.</p><div class="client-large-actions"><button class="primary-btn" data-open-client="${esc(c.id)}">فتح مساحة العميل ←</button><button class="ghost-btn" data-edit-client="${esc(c.id)}">تعديل</button><button class="danger-btn" data-delete-client="${esc(c.id)}">حذف العميل</button></div></article>`).join('')||empty('لا توجد عملاء مطابقة للبحث.');$$('[data-open-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();goClient(b.dataset.openClient)});$$('[data-edit-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();editClient(b.dataset.editClient)});$$('[data-delete-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();deleteClient(b.dataset.deleteClient)});
  }
  async function editClient(id){
    const c=clients.find(x=>x.id===id);if(!c)return;
    if(!(await ensureLogin()))return;
    const modal=$('#modal');
    $('#modalContent').innerHTML=`<h2>تعديل العميل</h2><p>يمكنك تعديل بيانات العميل. تغيير الاسم يعيد تسمية مساحة العميل نفسها.</p><form id="editClientForm"><div class="form-grid"><div class="field"><label>اسم العميل</label><input name="name" value="${esc(c.name)}" required></div><div class="field"><label>الاختصار</label><input name="code" maxlength="8" value="${esc(c.code||'')}"></div><div class="field"><label>الحالة</label><input name="status" value="${esc(c.status||'نشط')}"></div><div class="field full"><label>الوصف</label><textarea name="description" required>${esc(c.description||'')}</textarea></div></div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ التعديلات</button><button class="ghost-btn" type="button" id="cancelEditClient">إلغاء</button></div></form>`;
    modal.classList.add('show');$('#cancelEditClient').onclick=()=>modal.classList.remove('show');
    $('#editClientForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const name=String(fd.get('name')||'').trim();if(!name||/[\\/]/.test(name))return toast('اسم العميل غير صالح.');const meta={name,code:String(fd.get('code')||name.slice(0,2)).trim(),status:String(fd.get('status')||'نشط').trim()||'نشط',description:String(fd.get('description')||'').trim(),createdAt:c.createdAt||new Date().toISOString().slice(0,10)};try{
      const newPath=`clients/${name}`;
      if(newPath!==c.path){await mutateGithub('rename_path',{path:c.path,newPath});}
      const metaFilePath=`${newPath}/.client.json`;
      let oldMeta=null;try{oldMeta=await ghFile(metaFilePath)}catch(e){if(e.status!==404)throw e}
      if(oldMeta)await ghWrite(metaFilePath,b64utf8(JSON.stringify(meta,null,2)),`Update client metadata ${name}`,oldMeta.sha);else await ghCreate(metaFilePath,b64utf8(JSON.stringify(meta,null,2)),`Create client metadata ${name}`);
      modal.classList.remove('show');await refreshCloud();toast('تم تعديل بيانات العميل بنجاح.');
    }catch(err){toast(`تعذر تعديل العميل: ${err.message}`)}};
  }
  async function deleteClient(id){const c=clients.find(x=>x.id===id);if(!c||c.baseline)return;if(!confirm(`سيتم حذف مساحة «${c.name}» وملفاتها من المستودع. هل أنت متأكد؟`))return;try{await mutateGithub('delete_path',{path:c.path});clients=clients.filter(x=>x.id!==id);projects=projects.filter(p=>p.clientId!==id);localSave();renderClients();toast('تم حذف مساحة العميل.')}catch(e){toast(`تعذر الحذف: ${e.message}`)}}

  function renderProjects(){const all=projects.map(p=>{const c=clients.find(x=>x.id===p.clientId);return {...p,clientName:c?.name||'عام'}});$('#projectsGrid').innerHTML=all.map(p=>`<article class="project-card"><div class="card-topline"><span class="tag level-tag">${esc(p.status||'نشط')}</span><span class="tag">${esc(p.clientName)}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><div class="take">${esc(p.startDate||'—')} → ${esc(p.endDate||'—')}</div>${p.baseline?'':`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="projects" data-id="${esc(p.id)}">تعديل</button><button class="danger-btn" data-delete-custom="projects" data-id="${esc(p.id)}">حذف الإضافة</button></div>`}</article>`).join('')||empty('لا توجد مشروعات.');bindDeleteCustom($('#projectsGrid'))}
  function renderDictionary(){const list=K.terms||[];$('#termGrid').innerHTML=list.map(x=>`<article class="term-card"><div class="term-en">${esc(x[0])}</div><div class="term-pron">النطق: ${esc(x[1])}</div><div class="term-meaning"><b>${esc(x[2])}</b><br>${esc(x[3])}</div></article>`).join('')}
  function renderSources(){$('#sourceGrid').innerHTML=[...(K.sources||[]),...(custom.sources||[]).map(x=>[x.title,x.kind||'إضافة',x.content,x.url,x.id])].map(x=>`<article class="source-card"><div class="card-topline"><span class="tag">${esc(x[1]||'مصدر')}</span>${x[4]?'':'<span class="tag">أساسي</span>'}</div><h3>${esc(x[0])}</h3><p>${esc(x[2]||'')}</p>${x[3]?`<div style="margin-top:9px"><a href="${esc(x[3])}" target="_blank" rel="noopener">فتح المصدر ↗</a></div>`:''}${x[4]?`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="sources" data-id="${esc(x[4])}">تعديل</button><button class="danger-btn" data-delete-custom="sources" data-id="${esc(x[4])}">حذف الإضافة</button></div>`:''}</article>`).join('')||empty('لا توجد مصادر.') ;bindDeleteCustom($('#sourceGrid'))}
  function renderStandards(){$('#standardsGrid').innerHTML=(K.standards||[]).map(x=>`<article class="standard-card"><span class="eyebrow">STANDARD</span><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></article>`).join('')}

  async function getFolderEntries(clientId,path=''){
    const clean=String(path||'').replace(/^\/+|\/+$/g,'');
    const key=`${clientId}::${clean}`;
    if(folderCache.has(key))return folderCache.get(key);

    if(hasCloud()){
      const p=clean?`${clientPath(clientId)}/${clean}`:clientPath(clientId);
      const raw=await ghContents(p);
      const arr=(Array.isArray(raw)?raw:[]).filter(x=>x.name!=='.client.json'&&x.name!=='.keep'&&!x.name.startsWith('.'));
      const out=arr.map(x=>({name:x.name,type:x.type==='dir'?'folder':'file',path:x.path.replace(`${clientPath(clientId)}/`,''),sha:x.sha,size:x.size||0,download_url:x.download_url,html_url:x.html_url,source:'github'}));
      folderCache.set(key,out);return out;
    }

    // Static template + browser-local additions.
    const tree=await loadStaticTree();
    const base=tree.map(p=>p.replace(/\/$/,'')).filter(Boolean);
    const prefix=clean?clean+'/':'';
    const set=new Map();
    for(const p of base){
      const n=p.startsWith(prefix)?p.slice(prefix.length):null;
      if(!n)continue;
      const parts=n.split('/'),name=parts[0],childPath=prefix+name;
      if(parts.length===1)set.set(name,{name,type:p.endsWith('/')?'folder':'file',path:childPath,size:0,source:'static'});
      else set.set(name,{name,type:'folder',path:childPath,size:0,source:'static'});
    }
    try{
      const locals=await localList(clientId,clean);
      for(const x of locals)set.set(x.name,{name:x.name,type:x.type,path:x.path,size:x.size||0,source:'local',key:x.key,mime:x.mime});
    }catch{}
    const out=[...set.values()].sort((a,b)=>{if(a.type!==b.type)return a.type==='folder'?-1:1;if(folderSort==='name')return a.name.localeCompare(b.name,'ar',{numeric:true,sensitivity:'base'});return folderSortKey(a.name)-folderSortKey(b.name)||a.name.localeCompare(b.name,'ar',{numeric:true,sensitivity:'base'});});
    folderCache.set(key,out);return out;
  }
  let staticTreeCache=null;async function loadStaticTree(){if(staticTreeCache)return staticTreeCache;try{const r=await fetch('data/retaj-tree.json',{cache:'no-store'});staticTreeCache=await r.json();return staticTreeCache}catch{return []}}
  async function isBaselinePath(path){
    try{ const tree=await loadStaticTree(); const clean=String(path||'').replace(/^\/+|\/+$/g,''); return tree.some(x=>String(x).replace(/\/$/,'')===clean); }catch{return false}
  }
  async function renderClient(id){
    const c=clients.find(x=>x.id===id);if(!c){go('clients');return}
    if(c.name==='ريتاج علي'&&!staticTreeCache) await loadStaticTree();
    const entries=await getFolderEntries(id,currentPath);
    const folders=entries.filter(x=>x.type==='folder').length, files=entries.filter(x=>x.type==='file').length;
    const breadcrumbs=currentPath?currentPath.split('/'):[];
    const crumbHtml=[`<button class="crumb-btn" data-client-root="${esc(id)}">الجذر</button>`].concat(breadcrumbs.map((seg,i)=>`<span class="crumb-sep">/</span><button class="crumb-btn" data-client-path="${esc(breadcrumbs.slice(0,i+1).join('/'))}">${esc(seg)}</button>`)).join('');
    const project=projects.find(p=>p.clientId===id);
    const baselinePath=(p)=>c.name==='ريتاج علي'&&staticTreeCache?.some(x=>String(x).replace(/\/$/,'')===String(p).replace(/\/$/,''));
    $('#clientPage').innerHTML=`<div class="client-header"><div><div class="client-breadcrumb"><button type="button" id="backClients">← مكتبة العملاء</button><span>/</span><span>${esc(c.name)}</span></div><div class="client-title"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h1>${esc(c.name)}</h1><p>${esc(c.description||'مساحة العميل')} ${project?`· ${esc(project.name)}`:''}</p></div></div></div><div class="client-tools"><button class="ghost-btn" id="refreshClient">↻ تحديث</button><button class="primary-btn" data-add="client-file" data-client="${esc(id)}" data-parent="${esc(currentPath)}">＋ ملف</button><button class="ghost-btn" data-add="client-folder" data-client="${esc(id)}" data-parent="${esc(currentPath)}">＋ مجلد</button></div></div><div class="client-statbar"><div class="client-stat"><b>${folders}</b><span>مجلدات هنا</span></div><div class="client-stat"><b>${files}</b><span>ملفات هنا</span></div><div class="client-stat"><b>${hasCloud()?'متصل':'محلي'}</b><span>مصدر البيانات</span></div><div class="client-stat"><b>${project?'1':'0'}</b><span>مشروع نشط</span></div></div><div class="save-state"><span>${hasCloud()?'<span class="good">● الحفظ المشترك والمزامنة عبر GitHub فعّالان.</span>':'● الوضع المحلي: التغييرات لن تنتقل إلى الأجهزة الأخرى.'}</span><span>${hasCloud()?'تحديث دوري + تحديث يدوي':'غير متصل'}</span></div><div class="folder-toolbar"><div class="breadcrumbs">${crumbHtml}</div><div class="folder-controls"><span class="muted-count">${currentPath||'الجذر'}</span><button type="button" class="sort-btn" id="folderSort" title="تغيير ترتيب المجلدات">↕ ترتيب: ${folderSort==='number'?'رقمي':'حسب الاسم'}</button></div></div><div class="file-grid" id="fileGrid">${entries.map(e=>{const isBaseline=baselinePath(e.path);const canEdit=!isBaseline;const canDelete=!isBaseline;return `<article class="file-card ${e.type==='folder'?'folder':''}" data-entry-path="${esc(e.path)}" data-entry-type="${e.type}" tabindex="0" role="${e.type==='folder'?'button':'link'}" aria-label="${esc(e.type==='folder'?'فتح المجلد '+e.name:'معاينة '+e.name)}"><div class="card-tools">${canEdit?`<button class="edit-x" data-rename-path="${esc(e.path)}" data-rename-type="${e.type}" title="إعادة تسمية" aria-label="إعادة تسمية ${esc(e.name)}">✎</button>`:''}<button class="remove-x ${canDelete?'':'protected'}" data-delete-path="${esc(e.path)}" data-protected="${isBaseline?'1':'0'}" title="${canDelete?'حذف':'عنصر أساسي — لا يمكن حذفه'}" aria-label="${canDelete?'حذف '+esc(e.name):'العنصر الأساسي '+esc(e.name)}">×</button></div><span class="kind">${e.type==='folder'?'مجلد':esc(fileType(e.name))}</span><div class="big-icon">${fileIcon(fileType(e.name),e.type==='folder')}</div><div><h3 title="${esc(e.name)}">${esc(e.name)}</h3><p>${e.type==='folder'?'فتح المجلد':'اضغط للمعاينة'}</p></div></article>`}).join('')||`<div class="client-empty"><div><div class="big-icon" style="margin:auto">${fileIcon('نص')}</div><strong>هذا المجلد فارغ</strong><p>أضف ملفًا أو أنشئ مجلدًا جديدًا من الأزرار أعلاه.</p></div></div>`}</div><div id="fileViewer" class="file-viewer" hidden></div>`;
    $('#backClients').onclick=()=>go('clients');
    $('#refreshClient').onclick=async()=>{folderCache.clear();await renderClient(id);toast('تم تحديث مساحة العميل.')};
    bindAddButtons($('#clientPage'));
    $$('[data-entry-path]',$('#fileGrid')).forEach(card=>{
      const open=()=>{const p=card.dataset.entryPath,t=card.dataset.entryType;if(t==='folder')goClient(id,p);else{selectedFile=p;renderSelectedFile(id,p)}};
      card.onclick=e=>{if(e.target.closest('[data-delete-path]'))return;open()};
      card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('[data-delete-path]')){e.preventDefault();open()}};
    });
    $$('[data-client-root]',$('#clientPage')).forEach(b=>b.onclick=()=>goClient(id,''));
    $$('[data-client-path]',$('#clientPage')).forEach(b=>b.onclick=()=>goClient(id,b.dataset.clientPath));
    $$('[data-delete-path]',$('#fileGrid')).forEach(b=>b.onclick=async e=>{e.stopPropagation();if(b.dataset.protected==='1'){toast('هذا العنصر جزء من قالب العميل الأساسي ولا يمكن حذفه.');return}await deleteClientPath(id,b.dataset.deletePath)});
    $$('[data-rename-path]',$('#fileGrid')).forEach(b=>b.onclick=async e=>{e.stopPropagation();if(b.dataset.renamePath&&b.dataset.renamePath.includes('/.keep'))return;await renameClientPath(id,b.dataset.renamePath,b.dataset.renameType)});
    $('#folderSort').onclick=async()=>{folderSort=folderSort==='number'?'name':'number';folderCache.clear();await renderClient(id)};
  }
  async function renderSelectedFile(clientId,path){
    const viewer=$('#fileViewer');if(!viewer)return;
    const name=path.split('/').pop(),kind=fileType(name),ext=(name.split('.').pop()||'').toLowerCase();
    const textable=['txt','md','csv','json','html','css','js','ts','xml','yaml','yml'].includes(ext);
    const closeViewer=()=>{selectedFile=null;viewer.hidden=true;viewer.innerHTML='';if(window.__centralPreviewUrl){URL.revokeObjectURL(window.__centralPreviewUrl);window.__centralPreviewUrl=''}};
    let blob=null,meta=null,source='';
    try{
      if(hasCloud()){
        meta=await ghFile(`${clientPath(clientId)}/${path}`);
        blob=await ghRaw(`${clientPath(clientId)}/${path}`);
        source='مشترك';
      }else{
        meta=await localGet(localKey(clientId,path));
        if(meta?.blob)blob=meta.blob;
        source='محلي';
      }
      if(!blob)throw new Error('تعذر تحميل الملف.');
      if(window.__centralPreviewUrl)URL.revokeObjectURL(window.__centralPreviewUrl);
      const url=URL.createObjectURL(blob);window.__centralPreviewUrl=url;
      let body='';
      if(textable){
        const content=await blob.text();
        body=`<textarea id="fileEditor" class="file-editor" spellcheck="false">${esc(content)}</textarea>`;
      }else if(ext==='pdf'){
        body=`<div class="preview-stage pdf-stage"><object class="file-open-frame" data="${url}" type="application/pdf"><iframe class="file-open-frame" src="${url}" title="${esc(name)}"></iframe></object><div class="preview-fallback"><strong>إذا لم يظهر الـPDF داخل المتصفح:</strong><span>استخدم التحميل أو افتحه في تبويب مستقل.</span></div></div>`;
      }else if(['docx','doc'].includes(ext)){
        body=`<div id="docxPreview" class="docx-preview"><div class="preview-loading">جارٍ تجهيز معاينة Word…</div></div>`;
      }else if(['png','jpg','jpeg','webp','gif','svg'].includes(ext)){
        body=`<img class="file-preview-image" src="${url}" alt="${esc(name)}">`;
      }else if(['mp4','mov','webm'].includes(ext)){
        body=`<video class="file-preview-video" src="${url}" controls playsinline></video>`;
      }else{
        body=`<div class="binary-open"><div class="big-icon" style="margin:auto">${fileIcon(kind)}</div><h3>هذا الملف لا يملك عارضًا داخليًا.</h3><p>لكن يمكنك تنزيله أو فتحه خارجيًا.</p></div>`;
      }
      const editable=textable;
      const googleTypes=['pdf','docx','doc','xlsx','xls','pptx','ppt'];
      const canGoogle=hasCloud()&&googleTypes.includes(ext)&&meta?.download_url;
      const downloadLabel=textable?'تحميل الملف':'تحميل / تنزيل الملف';
      const googleBtn=canGoogle?`<button class="ghost-btn" id="googleViewBtn">فتح عبر Google Drive / Docs</button>`:'';
      viewer.hidden=false;
      viewer.innerHTML=`<div class="viewer-head"><div><h2>${esc(name)}</h2><p>${esc(path)}</p></div><div class="viewer-head-actions"><span class="tag">${esc(source)} · ${esc(kind)}</span><button type="button" class="viewer-close" id="closeViewer" title="إغلاق المعاينة" aria-label="إغلاق المعاينة">×</button></div></div><div class="viewer-body">${body}<div class="viewer-actions">${editable?'<button class="primary-btn" id="saveFileBtn">حفظ التعديلات</button>':''}<a class="primary-btn" id="downloadFileBtn" href="${url}" download="${esc(name)}">↓ ${downloadLabel}</a><button class="ghost-btn" id="openFileBtn">فتح في تبويب جديد</button>${googleBtn}<button class="danger-btn" id="deleteFileBtn">حذف الملف</button></div><div class="path-line">${esc(path)}</div></div>`;
      $('#closeViewer').onclick=closeViewer;
      $('#openFileBtn').onclick=()=>window.open(url,'_blank','noopener');
      if(canGoogle){$('#googleViewBtn').onclick=()=>{const g=`https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(meta.download_url)}`;window.open(g,'_blank','noopener')}}
      if(editable){if(hasCloud())$('#saveFileBtn').onclick=()=>saveTextFile(clientId,path,meta);else $('#saveFileBtn').onclick=()=>saveLocalTextFile(clientId,path,meta)}
      $('#deleteFileBtn').onclick=async()=>{closeViewer();await deleteClientPath(clientId,path)};
      if(['docx','doc'].includes(ext)){
        if(ext==='doc'&&!window.mammoth){$('#docxPreview').innerHTML='<div class="preview-error">ملفات DOC القديمة لا يمكن تحويلها دائمًا إلى HTML داخل المتصفح. استخدم زر «فتح عبر Google Drive / Docs» أو التحميل.</div>'}
        else if(window.mammoth){
          try{const arrayBuffer=await blob.arrayBuffer();const result=await window.mammoth.convertToHtml({arrayBuffer});$('#docxPreview').innerHTML=result.value||'<div class="preview-empty">لا يوجد محتوى قابل للعرض.</div>';}
          catch(e){$('#docxPreview').innerHTML=`<div class="preview-error">تعذر إنشاء معاينة Word. استخدم «فتح عبر Google Drive / Docs» أو التحميل.<br><small>${esc(e.message||'خطأ غير معروف')}</small></div>`}
        }
      }
      viewer.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){
      viewer.hidden=false;viewer.innerHTML=`<div class="viewer-head"><div><h2>${esc(name)}</h2><p>${esc(path)}</p></div><button type="button" class="viewer-close" id="closeViewer" aria-label="إغلاق المعاينة">×</button></div><div class="viewer-body"><div class="preview-error">تعذر تحميل المعاينة: ${esc(e.message||'خطأ غير معروف')}</div><div class="viewer-actions"><button class="ghost-btn" id="retryPreview">إعادة المحاولة</button></div></div>`;$('#closeViewer').onclick=closeViewer;$('#retryPreview').onclick=()=>renderSelectedFile(clientId,path);
    }
  }
  async function renameClientPath(clientId,path,type){
    if(!(await ensureLogin()))return;
    const oldName=path.split('/').pop();
    const next=prompt(`اكتب الاسم الجديد لـ «${oldName}»`,oldName);
    if(next===null)return;
    const newName=String(next).trim();
    if(!newName||newName===oldName||/[\\/]/.test(newName)){if(newName&&/[\\/]/.test(newName))toast('الاسم غير صالح.');return}
    if(newName.startsWith('.')){toast('لا تستخدم اسمًا يبدأ بنقطة.');return}
    const parent=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
    const newPath=parent?`${parent}/${newName}`:newName;
    try{
      if(hasCloud()){
        await mutateGithub('rename_path',{path:`${clientPath(clientId)}/${path}`,newPath:`${clientPath(clientId)}/${newPath}`});
      }else{
        const all=await localAll(clientId),targets=all.filter(x=>x.path===path||x.path.startsWith(path+'/'));
        if(!targets.length)throw new Error('العنصر غير موجود محليًا.');
        for(const x of targets){const suffix=x.path===path?'':x.path.slice(path.length+1);const np=suffix?`${newPath}/${suffix}`:newPath;await localPut({...x,key:localKey(clientId,np),path:np,parent:np.includes('/')?np.slice(0,np.lastIndexOf('/')):''}) ;if(x.key!==localKey(clientId,np))await localRemove(x.key)}
      }
      folderCache.clear();await renderClient(clientId);toast('تمت إعادة التسمية بنجاح.');
    }catch(e){toast(`تعذر تغيير الاسم: ${e.message}`)}
  }
  async function saveLocalTextFile(clientId,path,item){
    if(!(await ensureLogin()))return;
    try{const value=$('#fileEditor').value;const blob=new Blob([value],{type:item.mime||mimeFor(path)});await localPut({...item,blob,size:blob.size,updatedAt:new Date().toISOString()});folderCache.clear();toast('تم حفظ الملف محليًا.')}catch(e){toast(`تعذر الحفظ: ${e.message}`)}
  }
  async function saveTextFile(clientId,path,f){if(!(await ensureLogin()))return;try{await mutateGithub('update_file',{path:`${clientPath(clientId)}/${path}`,contentBase64:bytesToBase64(new TextEncoder().encode($('#fileEditor').value).buffer),sha:f?.sha||''});folderCache.clear();await renderClient(clientId);toast('تم حفظ التعديلات.')}catch(e){toast(`تعذر الحفظ: ${e.message}`)}}
  async function deleteClientPath(clientId,path){
    if(!(await ensureLogin()))return;
    if(!confirm(`سيتم حذف «${path.split('/').pop()}». هل تريد المتابعة؟`))return;
    try{
      if(hasCloud()) await mutateGithub('delete_path',{path:`${clientPath(clientId)}/${path}`});
      else {
        const item=await localGet(localKey(clientId,path));
        if(item?.type==='folder'){
          const all=await localAll(clientId);
          for(const x of all.filter(x=>x.path===path||x.path.startsWith(path+'/')))await localRemove(x.key);
        }else await localRemove(localKey(clientId,path));
      }
      folderCache.clear();selectedFile=null;await renderClient(clientId);toast(hasCloud()?'تم الحذف.':'تم الحذف محليًا.');
    }catch(e){toast(`تعذر الحذف: ${e.message}`)}
  }

  function addChoice(){return `<h2>إضافة إلى المركز</h2><p>كل إضافة قابلة للإزالة لاحقًا. الحفظ المشترك يتم مباشرة إلى GitHub.</p><div class="add-choice-grid"><button class="add-choice" data-choice="client"><b>عميل</b><span>مساحة جديدة داخل مكتبة العملاء.</span></button><button class="add-choice" data-choice="project"><b>مشروع</b><span>مشروع جديد وربطه بعميل.</span></button><button class="add-choice" data-choice="knowledge"><b>معرفة</b><span>مادة جديدة لقاعدة المعرفة.</span></button><button class="add-choice" data-choice="idea"><b>فكرة</b><span>فكرة جديدة لمختبر الأفكار.</span></button><button class="add-choice" data-choice="source"><b>مصدر</b><span>مرجع جديد.</span></button><button class="add-choice" data-choice="entry"><b>سجل</b><span>ملاحظة أو قرار أو مهمة.</span></button></div>`}
  function addForm(type,extra={}){
    const file=type==='client-file',folder=type==='client-folder',client=type==='client',project=type==='project',source=type==='source';const title={client:'إضافة عميل',project:'إضافة مشروع',knowledge:'إضافة مادة معرفية',idea:'إضافة فكرة',source:'إضافة مصدر',entry:'إضافة سجل','client-file':'إضافة ملف إلى مساحة العميل','client-folder':'إضافة مجلد'}[type]||'إضافة';
    if(file)return `<h2>${title}</h2><p>يمكنك إنشاء TXT/MD مباشرة أو رفع DOCX/PDF/XLSX وغيرها من الملفات المسموح بها.</p><form id="addForm"><div class="form-grid"><div class="field"><label>اسم الملف</label><input name="name" value="${esc(extra.nameHint||'')}" required placeholder="خطة سبتمبر.txt أو خطة سبتمبر.docx"></div><div class="field"><label>مجلد الأب</label><input name="parent" value="${esc(extra.parent||'')}" placeholder="اتركه فارغًا للجذر"></div><div class="field full upload-box"><label>رفع ملف فعلي</label><input name="upload" type="file" accept=".txt,.md,.docx,.doc,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.svg,.mp4,.webm"></div><div class="field full"><label>محتوى نصي (للملفات النصية)</label><textarea name="content" placeholder="يُستخدم إذا لم ترفع ملفًا فعليًا…"></textarea></div></div><div class="modal-actions"><button class="primary-btn" type="submit">إنشاء وحفظ</button><button class="ghost-btn" type="button" id="cancelForm">إلغاء</button></div></form>`;
    if(folder)return `<h2>${title}</h2><p>المجلدات الحقيقية في Git تُنشأ بملف داخلي مخفي حتى يبقى المجلد موجودًا.</p><form id="addForm"><div class="form-grid"><div class="field"><label>اسم المجلد</label><input name="name" required></div><div class="field"><label>مجلد الأب</label><input name="parent" value="${esc(extra.parent||'')}" placeholder="الجذر"></div></div><div class="modal-actions"><button class="primary-btn" type="submit">إنشاء المجلد</button><button class="ghost-btn" type="button" id="cancelForm">إلغاء</button></div></form>`;
    const clientOptions=clients.map(c=>`<option value="${esc(c.id)}" ${extra.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');return `<h2>${title}</h2><p>${source?'أضف مرجعًا إلى غرفة المصادر.':project?'أضف مشروعًا إلى عميل.':'اكتب المادة ثم احفظها في المركز.'}</p><form id="addForm"><div class="form-grid"><div class="field"><label>${client?'اسم العميل':project?'اسم المشروع':'العنوان'}</label><input name="title" required></div>${client?'<div class="field"><label>اختصار</label><input name="code" maxlength="8" placeholder="RA"></div>':project?`<div class="field"><label>العميل</label><select name="clientId">${clientOptions}</select></div>`:source?'<div class="field"><label>نوع المصدر</label><select name="kind"><option>رسمي</option><option>عربي</option><option>بحثي</option><option>تطبيقي</option></select></div>':'<div class="field"><label>التصنيف</label><input name="type" placeholder="مبدأ / قرار / ملاحظة"></div>'}${project?'<div class="field"><label>البداية</label><input name="startDate" type="date"></div><div class="field"><label>النهاية</label><input name="endDate" type="date"></div>':''}<div class="field full"><label>${client||project?'الوصف':'المحتوى'}</label><textarea name="content" required></textarea></div>${source?'<div class="field full"><label>الرابط</label><input name="url" type="url" placeholder="https://..."></div>':''}${!client&&!project?'<div class="field full"><label>الوسوم</label><input name="tags" placeholder="استراتيجية، محتوى، تحليل"></div>':''}</div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ الإضافة</button><button class="ghost-btn" type="button" id="cancelForm">إلغاء</button></div></form>`;
  }
  async function showAdd(type,extra={}){if(type==='global'){const modal=$('#modal');$('#modalContent').innerHTML=addChoice();modal.classList.add('show');$$('[data-choice]',$('#modalContent')).forEach(b=>b.onclick=()=>{modal.classList.remove('show');showAdd(b.dataset.choice,extra)});return}if(!(await ensureLogin()))return;const modal=$('#modal');$('#modalContent').innerHTML=addForm(type,extra);modal.classList.add('show');$('#cancelForm').onclick=()=>modal.classList.remove('show');$('#addForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);try{if(type==='client-file'){
        const name=String(fd.get('name')||'').trim();const parent=String(fd.get('parent')||'').trim().replace(/^\/+|\/+$/g,'');
        if(!name||/[\\/]/.test(name))throw new Error('اسم الملف غير صالح');
        const path=parent?`${parent}/${name}`:name;const up=fd.get('upload');
        if(hasCloud()){
          const remotePath=`${clientPath(extra.clientId)}/${path}`;let b64;
          if(up&&up.size){if(up.size>4*1024*1024)throw new Error('حد الملف 4MB في هذه النسخة');b64=bytesToBase64(await up.arrayBuffer())}
          else b64=bytesToBase64(new TextEncoder().encode(String(fd.get('content')||'')).buffer);
          await mutateGithub('create_file',{path:remotePath,contentBase64:b64});
        }else{
          const blob=up&&up.size?new Blob([await up.arrayBuffer()],{type:up.type||mimeFor(name)}):new Blob([String(fd.get('content')||'')],{type:mimeFor(name)});
          if(blob.size>4*1024*1024)throw new Error('حد الملف 4MB في هذه النسخة');
          await localPut({key:localKey(extra.clientId,path),clientId:extra.clientId,name,type:'file',path,parent,size:blob.size,mime:blob.type,blob,createdAt:new Date().toISOString()});
        }
        modal.classList.remove('show');folderCache.clear();await refreshCloud();if(openClient===extra.clientId)await renderClient(extra.clientId);toast(hasCloud()?'تمت إضافة الملف إلى المستودع.':'تمت إضافة الملف محليًا إلى هذا المتصفح.');return
      }
      if(type==='client-folder'){
        const n=String(fd.get('name')||'').trim();const p=String(fd.get('parent')||'').trim().replace(/^\/+|\/+$/g,'');
        if(!n||/[\\/]/.test(n))throw new Error('اسم المجلد غير صالح');
        const folderPath=p?`${p}/${n}`:n;
        if(hasCloud())await mutateGithub('create_folder',{path:`${clientPath(extra.clientId)}/${folderPath}/.keep`});
        else await localPut({key:localKey(extra.clientId,folderPath),clientId:extra.clientId,name:n,type:'folder',path:folderPath,parent:p,size:0,createdAt:new Date().toISOString()});
        modal.classList.remove('show');folderCache.clear();currentPath=folderPath;await refreshCloud();if(openClient===extra.clientId)await renderClient(extra.clientId);toast(hasCloud()?'تم إنشاء المجلد.':'تم إنشاء المجلد محليًا.');return
      }
      if(type==='client'){
        const name=String(fd.get('title')||'').trim(); const code=String(fd.get('code')||name.slice(0,2)).trim(); const description=String(fd.get('content')||'').trim();
        if(!name)throw new Error('اسم العميل مطلوب'); if(/[\\/]/.test(name))throw new Error('اسم العميل لا يمكن أن يحتوي على / أو \\');
        const path=`clients/${name}`; const meta={name,code,status:'نشط',description,createdAt:new Date().toISOString().slice(0,10)};
        if(!hasCloud())throw new Error('الحفظ المشترك غير مهيأ. تحقق من API_BASE ونشر واجهة الحفظ ثم أعد تحميل الموقع.');
        try{await ghCreate(`${path}/.keep`,btoa(''),`Create client ${name}`);await ghCreate(`${path}/.client.json`,b64utf8(JSON.stringify(meta,null,2)),`Create client metadata ${name}`)}catch(err){try{await recursiveDelete(path)}catch{}throw err}
        modal.classList.remove('show');await refreshCloud();goClient(normalizeClientIdFromPath(path), '');toast('تمت إضافة العميل ومساحته بنجاح.');return;
      }
      const id=`custom-${uid()}`;let item={id,title:String(fd.get('title')||''),content:String(fd.get('content')||''),createdAt:new Date().toISOString()};let kind='entries';if(type==='project'){item={...item,name:item.title,clientId:fd.get('clientId')||null,status:'نشط',startDate:fd.get('startDate')||'',endDate:fd.get('endDate')||'',description:item.content};kind='projects'}else if(type==='idea'){item={...item,title:item.title,kind:'discovery',desc:item.content,formats:['نص','كاروسيل']};kind='ideas'}else if(type==='knowledge'){item={...item,level:1,category:'إضافة',body:item.content,type:fd.get('type')||'مادة',take:''};kind='knowledge'}else if(type==='source'){item={...item,title:item.title,kind:fd.get('kind')||'عام',content:item.content,url:fd.get('url')||''};kind='sources'}else item={...item,type:fd.get('type')||'سجل',tags:fd.get('tags')||''};await mutateGithub('mutate_data',{kind,operation:'add',item});custom[kind]=[item,...(custom[kind]||[])];if(kind==='projects')projects=uniqueById([...baseProjects,...custom.projects]);localSave();modal.classList.remove('show');renderRoute(currentRoute);toast('تم حفظ الإضافة ويمكن حذفها لاحقًا.');}catch(err){toast(`تعذر الحفظ: ${err.message}`)}}}
  function bytesToBase64(buf){let binary='';const bytes=new Uint8Array(buf);const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}
  function base64ToBytes(b64){const clean=String(b64||'').replace(/\s/g,'');const binary=atob(clean);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out}
  function base64ToBlob(b64,mime='application/octet-stream'){return new Blob([base64ToBytes(b64)],{type:mime})}
  async function editCustom(kind,id){
    const item=(custom[kind]||[]).find(x=>x.id===id);if(!item)return;if(!(await ensureLogin()))return;
    const modal=$('#modal');
    let html='';
    if(kind==='projects')html=`<h2>تعديل المشروع</h2><form id="editCustomForm"><div class="form-grid"><div class="field"><label>اسم المشروع</label><input name="title" value="${esc(item.name||item.title||'')}" required></div><div class="field"><label>العميل</label><select name="clientId">${clients.map(c=>`<option value="${esc(c.id)}" ${c.id===item.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>البداية</label><input name="startDate" type="date" value="${esc(item.startDate||'')}"></div><div class="field"><label>النهاية</label><input name="endDate" type="date" value="${esc(item.endDate||'')}"></div><div class="field full"><label>الوصف</label><textarea name="content" required>${esc(item.description||item.content||'')}</textarea></div></div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ</button><button class="ghost-btn" type="button" id="cancelEditCustom">إلغاء</button></div></form>`;
    else if(kind==='knowledge')html=`<h2>تعديل المادة المعرفية</h2><form id="editCustomForm"><div class="form-grid"><div class="field"><label>العنوان</label><input name="title" value="${esc(item.title||'')}" required></div><div class="field"><label>التصنيف</label><input name="type" value="${esc(item.type||'مادة')}"></div><div class="field full"><label>المحتوى</label><textarea name="content" required>${esc(item.body||item.content||'')}</textarea></div></div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ</button><button class="ghost-btn" type="button" id="cancelEditCustom">إلغاء</button></div></form>`;
    else if(kind==='ideas')html=`<h2>تعديل الفكرة</h2><form id="editCustomForm"><div class="form-grid"><div class="field"><label>العنوان</label><input name="title" value="${esc(item.title||'')}" required></div><div class="field full"><label>الوصف</label><textarea name="content" required>${esc(item.desc||'')}</textarea></div><div class="field full"><label>الصيغ</label><input name="formats" value="${esc((item.formats||[]).join('، '))}"></div></div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ</button><button class="ghost-btn" type="button" id="cancelEditCustom">إلغاء</button></div></form>`;
    else if(kind==='sources')html=`<h2>تعديل المصدر</h2><form id="editCustomForm"><div class="form-grid"><div class="field"><label>العنوان</label><input name="title" value="${esc(item.title||'')}" required></div><div class="field"><label>النوع</label><input name="kind" value="${esc(item.kind||'عام')}"></div><div class="field full"><label>المحتوى</label><textarea name="content" required>${esc(item.content||'')}</textarea></div><div class="field full"><label>الرابط</label><input name="url" value="${esc(item.url||'')}" type="url"></div></div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ</button><button class="ghost-btn" type="button" id="cancelEditCustom">إلغاء</button></div></form>`;
    else return;
    modal.innerHTML=modal.innerHTML; $('#modalContent').innerHTML=html;modal.classList.add('show');$('#cancelEditCustom').onclick=()=>modal.classList.remove('show');
    $('#editCustomForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);let next={...item};if(kind==='projects')next={...item,name:String(fd.get('title')||'').trim(),title:String(fd.get('title')||'').trim(),clientId:fd.get('clientId')||null,startDate:fd.get('startDate')||'',endDate:fd.get('endDate')||'',description:String(fd.get('content')||'').trim(),content:String(fd.get('content')||'').trim()};if(kind==='knowledge')next={...item,title:String(fd.get('title')||'').trim(),type:String(fd.get('type')||'مادة').trim(),body:String(fd.get('content')||'').trim(),content:String(fd.get('content')||'').trim()};if(kind==='ideas')next={...item,title:String(fd.get('title')||'').trim(),desc:String(fd.get('content')||'').trim(),formats:String(fd.get('formats')||'').split(/[,،]/).map(x=>x.trim()).filter(Boolean)};if(kind==='sources')next={...item,title:String(fd.get('title')||'').trim(),kind:String(fd.get('kind')||'عام').trim(),content:String(fd.get('content')||'').trim(),url:String(fd.get('url')||'').trim()};if(!next.title&&!next.name)throw new Error('العنوان مطلوب');try{await mutateGithub('mutate_data',{kind,operation:'update',item:next});custom[kind]=(custom[kind]||[]).map(x=>x.id===id?next:x);if(kind==='projects')projects=uniqueById([...baseProjects,...custom.projects]);localSave();modal.classList.remove('show');renderRoute(currentRoute);toast('تم حفظ التعديلات.')}catch(err){toast(`تعذر التعديل: ${err.message}`)}};
  }
  async function bindDeleteCustom(root){$$('[data-edit-custom]',root).forEach(b=>b.onclick=async()=>{await editCustom(b.dataset.editCustom,b.dataset.id)});$$('[data-delete-custom]',root).forEach(b=>b.onclick=async()=>{const kind=b.dataset.deleteCustom,id=b.dataset.id;if(!confirm('حذف هذه الإضافة نهائيًا من المركز؟'))return;try{await mutateGithub('mutate_data',{kind,operation:'delete',item:{id}});custom[kind]=(custom[kind]||[]).filter(x=>x.id!==id);if(kind==='projects')projects=uniqueById([...baseProjects,...custom.projects]);localSave();renderRoute(currentRoute);toast('تم حذف الإضافة.')}catch(e){toast(`تعذر الحذف: ${e.message}`)}})}

  function bindAddButtons(root=document){$$('[data-add]',root).forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=e=>{e.stopPropagation();showAdd(b.dataset.add,{clientId:b.dataset.client,parent:b.dataset.parent,projectId:b.dataset.project,nameHint:b.dataset.nameHint})}})}
  function renderRoute(route){if(route==='home')renderHome();if(route==='knowledge')renderKnowledge();if(route==='playbook')renderPlaybook();if(route==='ideas')renderIdeas();if(route==='analytics')renderAnalytics();if(route==='clients')renderClients();if(route==='projects')renderProjects();if(route==='dictionary')renderDictionary();if(route==='sources')renderSources();if(route==='standards')renderStandards();bindAddButtons()}

  function allSearchItems(){const items=[];(K.knowledge||[]).forEach(x=>items.push({kind:'معرفة',title:x.title,desc:x.body,route:'knowledge'}));(K.ideas||[]).forEach(x=>items.push({kind:'فكرة',title:x[0],desc:x[2],route:'ideas'}));(K.terms||[]).forEach(x=>items.push({kind:'مصطلح',title:x[0],desc:`${x[2]} — ${x[3]}`,route:'dictionary'}));(K.sources||[]).forEach(x=>items.push({kind:'مصدر',title:x[0],desc:x[2],route:'sources'}));clients.forEach(c=>items.push({kind:'عميل',title:c.name,desc:c.description,action:()=>goClient(c.id)}));projects.forEach(p=>items.push({kind:'مشروع',title:p.name,desc:p.description,route:'projects'}));(custom.knowledge||[]).forEach(x=>items.push({kind:'إضافة معرفة',title:x.title,desc:x.body,route:'knowledge'}));(custom.ideas||[]).forEach(x=>items.push({kind:'إضافة فكرة',title:x.title,desc:x.desc,route:'ideas'}));(custom.sources||[]).forEach(x=>items.push({kind:'إضافة مصدر',title:x.title,desc:x.content,route:'sources'}));return items}
  function initSearch(){const input=$('#searchInput'),res=$('#searchResults');const draw=()=>{const q=input.value.trim().toLowerCase();if(!q){res.classList.remove('show');res.innerHTML='';return}const hits=allSearchItems().filter(x=>`${x.title} ${x.desc||''} ${x.kind}`.toLowerCase().includes(q)).slice(0,30);res.innerHTML=hits.map((x,i)=>`<div class="search-item" data-search-index="${i}"><div class="si-icon">${esc(x.kind.slice(0,1))}</div><div><h4>${esc(x.title)}</h4><p>${esc(x.kind)} — ${esc(String(x.desc||'').slice(0,135))}</p></div></div>`).join('')||`<div class="search-item"><div><h4>لا توجد نتيجة</h4><p>جرّب مصطلحًا مختلفًا.</p></div></div>`;res.classList.add('show');$$('[data-search-index]',res).forEach((el,i)=>{el.onclick=()=>{const x=hits[i];res.classList.remove('show');input.value='';x.action?x.action():x.route&&go(x.route)}})};input.oninput=draw;input.onfocus=draw;$('#clearSearch').onclick=()=>{input.value='';res.classList.remove('show');input.focus()};document.addEventListener('click',e=>{if(!$('#searchWrap').contains(e.target))res.classList.remove('show')});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus()}})}
  function bindGoButtons(root=document){$$('[data-go]',root).forEach(b=>{if(b.dataset.goBound)return;b.dataset.goBound='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const route=b.dataset.go;if(route)go(route)})})}
  function initTheme(){const saved=localStorage.getItem('central-theme');const use=saved||'light';document.documentElement.classList.toggle('dark',use==='dark');$('#themeToggle').onclick=()=>{const d=!document.documentElement.classList.contains('dark');document.documentElement.classList.toggle('dark',d);localStorage.setItem('central-theme',d?'dark':'light')}}
  function boot(){const b=$('#boot'),status=$('#boot-status'),f=$('#fingerprint');const open=async()=>{b.classList.add('scanning');status.textContent='جارٍ فتح المساحة…';await new Promise(r=>setTimeout(r,260));status.textContent='تم التحقق';b.classList.add('hide')};f.onclick=open;f.onpointerdown=e=>f.setPointerCapture?.(e.pointerId);f.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')open()};setTimeout(()=>{status.textContent='المساحة جاهزة — المس البصمة';},900)}

  $('#mobileMenu').onclick=()=>$('#sidebar').classList.add('open');$('#closeSide').onclick=()=>$('#sidebar').classList.remove('open');$('#syncPill').onclick=async()=>{if(!hasCloud()){toast('تحقق من إعداد API الحفظ ثم أعد تحميل الموقع.');return}await refreshCloud();};$('#addGlobal').onclick=()=>showAdd('global');$('#sideAdd').onclick=()=>showAdd('global');$('#modalClose').onclick=()=>$('#modal').classList.remove('show');$('.modal-backdrop')?.addEventListener('click',()=>$('#modal').classList.remove('show'));
  $('#clientSearch')?.addEventListener('input',renderClients);
  window.addEventListener('hashchange',()=>{const h=decodeURIComponent(location.hash.slice(1)||'home');if(h.startsWith('client/')){const pieces=h.split('/');const id=pieces[1];const path=pieces.slice(2).filter(Boolean).join('/');goClient(id,path)}else go(h)});

  // Local first, then cloud.
  const l=loadLocalState();if(l.custom)custom={...custom,...l.custom};if(!CLOUD_CONFIGURED){if(l.clients?.length)clients=l.clients;if(l.projects?.length)projects=l.projects;}
  initSearch();initTheme();bindGoButtons();boot();setSync('محلي',false);
  // حالة واضحة أثناء أول اتصال بدل إظهار 'محلي' لحظيًا رغم وجود التوكن.
  if(CLOUD_CONFIGURED)setSync('جاري الاتصال',false);
  const initialHash=decodeURIComponent(location.hash.slice(1)||'home');
  if(initialHash.startsWith('client/')){const pieces=initialHash.split('/');goClient(pieces[1],pieces.slice(2).filter(Boolean).join('/'))}else go(initialHash);
  bindAddButtons();
  if(CLOUD_CONFIGURED){refreshCloud().then(startPolling)}else{setSync('محلي',false)}
})();
