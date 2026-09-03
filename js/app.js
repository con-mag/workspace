(() => {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const K = window.KNOWLEDGE || { knowledge: [], ideas: [], terms: [], sources: [], playbook: [], standards: [] };
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const API = String(CFG.API_BASE || '').replace(/\/$/, '');
  const LOCAL_KEY = 'central-workspace-local-v3';
  const SESSION_KEY = 'central-workspace-session';

  const icons = {
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    book:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5V19a2 2 0 0 0 2 2"/>',
    layers:'<path d="m12 3 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/>',
    spark:'<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="m20 4 .6 2.4L23 7l-2.4.6L20 10l-.6-2.4L17 7l2.4-.6z"/>',
    chart:'<path d="M4 19V5M4 19h16"/><path d="m7 15 4-5 3 3 5-7"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    brief:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18"/>',
    type:'<path d="M4 5h16M4 12h16M4 19h10"/>',
    link:'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>',
    shield:'<path d="M12 3 20 6v6c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6z"/><path d="m8 12 2.5 2.5L16 9"/>',
    pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>'
  };
  $$('[data-icon]').forEach(el => el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[el.dataset.icon]||''}</svg>`);

  const baseClients = [{id:'retaj-ali',name:'ريتاج علي',code:'RA',status:'نشط',description:'كاتبة — إدارة صفحة فيسبوك',path:'clients/ريتاج علي',createdAt:'2026-09-01',baseline:true}];
  const baseProjects = [{id:'project-retaj-facebook',clientId:'retaj-ali',name:'إدارة صفحة فيسبوك',status:'نشط',startDate:'2026-09-01',endDate:'2027-04-30',description:'إدارة استراتيجية ومحتوى ونشر وتحليل لصفحة Facebook.',createdAt:'2026-09-01',baseline:true}];
  let custom={entries:[],projects:[],knowledge:[],ideas:[],sources:[]};
  let clients=[...baseClients], projects=[...baseProjects];
  let currentRoute='home', openClient=null, currentPath='', selectedFile=null, folderCache=new Map(), clientMetaCache=new Map(), folderSort='number';
  let remoteReady=false, pollTimer=null, pollBusy=false, remoteFingerprint='';

  function localGet(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')}catch{return {}}}
  function localSave(){localStorage.setItem(LOCAL_KEY,JSON.stringify({custom,clients,projects}))}
  function session(){try{const o=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null'); if(o?.expiresAt>Date.now()) return o.token; sessionStorage.removeItem(SESSION_KEY)}catch{} return ''}
  function setSession(data){if(data?.token)sessionStorage.setItem(SESSION_KEY,JSON.stringify(data))}
  function clearSession(){sessionStorage.removeItem(SESSION_KEY)}
  function hasCloud(){return !!API && remoteReady}
  // Browser-local file workspace (used when no API is configured).
  // This keeps uploaded files as real Blobs in IndexedDB instead of bloating localStorage.
  let localDbPromise=null;
  function localDb(){
    if(localDbPromise)return localDbPromise;
    localDbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('IndexedDB غير متاح في هذا المتصفح'));
      const req=indexedDB.open('central-workspace-files-v1',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('items'))db.createObjectStore('items',{keyPath:'key'})};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('تعذر فتح التخزين المحلي'));
    });return localDbPromise;
  }
  async function localList(clientId,parent=''){
    const db=await localDb();return new Promise((resolve,reject)=>{
      const tx=db.transaction('items','readonly'),store=tx.objectStore('items'),req=store.getAll();
      req.onsuccess=()=>{const prefix=`${clientId}::`;const p=String(parent||'').replace(/^\/+|\/+$/g,'');resolve((req.result||[]).filter(x=>x.key.startsWith(prefix)&&x.parent===p).map(x=>({...x,source:'local'})))};
      req.onerror=()=>reject(req.error);
    });
  }
  async function localAll(clientId){
    const db=await localDb();return new Promise((resolve,reject)=>{
      const r=db.transaction('items','readonly').objectStore('items').getAll();
      r.onsuccess=()=>resolve((r.result||[]).filter(x=>x.clientId===clientId));
      r.onerror=()=>reject(r.error);
    });
  }
  async function localGet(key){
    const db=await localDb();return new Promise((resolve,reject)=>{const r=db.transaction('items','readonly').objectStore('items').get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)});
  }
  async function localPut(item){
    const db=await localDb();return new Promise((resolve,reject)=>{const r=db.transaction('items','readwrite').objectStore('items').put(item);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  }
  async function localRemove(key){
    const db=await localDb();return new Promise((resolve,reject)=>{const r=db.transaction('items','readwrite').objectStore('items').delete(key);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)});
  }
  function localKey(clientId,path){return `${clientId}::${String(path||'').replace(/^\/+|\/+$/g,'')}`}
  function mimeFor(name){
    const ext=(name.split('.').pop()||'').toLowerCase();
    return ({txt:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',html:'text/html',css:'text/css',js:'text/javascript',
      docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',
      xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',pdf:'application/pdf',
      png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',mp4:'video/mp4',webm:'video/webm'})[ext]||'application/octet-stream';
  }
  function notifySave(text){const b=$('#saveBanner'),t=$('#saveBannerText'); if(!b||!t)return; t.textContent=text;b.classList.add('show');clearTimeout(notifySave.timer);notifySave.timer=setTimeout(()=>b.classList.remove('show'),2600)}
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2700)}
  function setSync(text,cloud){$('#syncText').textContent=text;$('#syncState').textContent=cloud?'حفظ مشترك + مزامنة':'محلي';$('#syncPill').classList.toggle('cloud',!!cloud);$('#systemNumber').textContent=cloud?'SYNC':'LOCAL';$('#systemDesc').textContent=cloud?'البيانات محفوظة في GitHub عبر واجهة API، والأجهزة ترى النسخة المشتركة نفسها.':'الموقع يعمل محليًا؛ اربط واجهة API ليصبح الحفظ مشتركًا بين الأجهزة.';$('#saveNote').textContent=cloud?'الحفظ والمزامنة المشتركان يعملان.':'لم تُربط واجهة الحفظ المشتركة بعد.'}
  async function apiGet(action, params={}){if(!API) throw new Error('API not configured');const u=new URL(API);u.searchParams.set('action',action);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store'});const d=await r.json();if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);return d.data}
  async function apiPost(payload){if(!API) throw new Error('API not configured');const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',...(session()?{'Authorization':`Bearer ${session()}`}:{})},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||`HTTP ${r.status}`);return d}
  async function ensureLogin(){
    if(session()) return true;
    return new Promise(resolve=>{
      const mc=$('#modalContent'), modal=$('#modal');
      const apiMissing=!API;
      mc.innerHTML=`<div class="password-box"><div class="password-icon">⌁</div><h2>صلاحية التعديل</h2><p>${apiMissing?'أدخل كلمة مرور المدير لإضافة أو تعديل أو حذف أي شيء.':'الإضافة والحذف والتعديل تتم من خلال واجهة خادمية محمية.'}</p><div class="field"><label>كلمة المرور</label><input id="adminPass" class="password-input" type="password" inputmode="numeric" maxlength="32" autocomplete="off" placeholder="••••"></div><div class="modal-actions"><button class="primary-btn" id="passOk">متابعة</button><button class="ghost-btn" id="passCancel">إلغاء</button></div></div>`;
      modal.classList.add('show');
      setTimeout(()=>$('#adminPass')?.focus(),30);
      const close=()=>{modal.classList.remove('show');resolve(false)};
      $('#passCancel').onclick=close;
      $('#passOk').onclick=async()=>{
        const pass=String($('#adminPass')?.value||'');
        if(apiMissing){
          if(pass==='1122'){ modal.classList.remove('show'); resolve(true); }
          else { toast('كلمة المرور غير صحيحة.'); $('#adminPass').select(); }
          return;
        }
        try{
          const r=await apiPost({action:'login',password:pass});
          setSession(r); modal.classList.remove('show'); resolve(true);
        }catch(e){
          const msg=String(e?.message||'');
          toast(msg.includes('Unauthorized')?'كلمة المرور غير صحيحة.':'تعذر التحقق: '+msg);
          $('#adminPass').select();
        }
      };
      $('#adminPass').onkeydown=e=>{if(e.key==='Enter')$('#passOk').click();if(e.key==='Escape')close()};
    });
  }
  async function mutateGithub(action,payload={}){if(!(await ensureLogin()))throw new Error('cancelled');const r=await apiPost({action,...payload});remoteReady=true;notifySave('تم الحفظ على المركز المشترك');return r}

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
    if(!API){remoteReady=false;setSync('محلي',false);return}
    try{
      const root=await apiGet('tree',{path:'clients'});
      const dirs=(Array.isArray(root)?root:[]).filter(x=>x.type==='dir' && !x.name.startsWith('.'));
      const remoteClients=[];
      for(const d of dirs){
        let meta={}; try{meta=await apiGet('file',{path:`${d.path}/.client.json`})||{}; meta=meta.content?JSON.parse(meta.content):{};}catch{}
        remoteClients.push({id:normalizeClientIdFromPath(d.path),name:meta.name||d.name,code:meta.code||String(d.name).slice(0,2),status:meta.status||'نشط',description:meta.description||'مساحة عميل',path:d.path,createdAt:meta.createdAt||'',baseline:d.name==='ريتاج علي'});
        if(meta)clientMetaCache.set(d.path,meta);
      }
      clients=remoteClients.length?remoteClients:baseClients;
      const retajRemote=clients.find(x=>x.name==='ريتاج علي');
      const normalizedBaseProjects=baseProjects.map(x=>x.name==='إدارة صفحة فيسبوك'&&retajRemote?{...x,clientId:retajRemote.id}:x);
      projects=normalizedBaseProjects;
      try{const d=await apiGet('data');custom={...custom,...d};projects=[...normalizedBaseProjects,...(d.projects||[])];}catch{}
      const fingerprint=JSON.stringify({clients:clients.map(x=>[x.id,x.name,x.path]),projects,custom:custom.entries?.map(x=>x.id)});
      remoteReady=true;remoteFingerprint=fingerprint;folderCache.clear();localSave();setSync('مشترك',true);renderRoute(currentRoute);if(openClient)await renderClient(openClient);notifySave('تم تحديث المركز من GitHub');
    }catch(e){remoteReady=false;setSync('محلي',false);console.warn(e)}
  }
  function startPolling(){if(!API)return;clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(pollBusy)return;pollBusy=true;try{await refreshCloud()}finally{pollBusy=false}},Math.max(10000,Number(CFG.POLL_MS||15000)))}

  function go(route){currentRoute=route;openClient=null;currentPath='';selectedFile=null;location.hash=route;$$('.route').forEach(r=>r.classList.toggle('active',r.dataset.routeView===route));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route===route));renderRoute(route);window.scrollTo({top:0,behavior:'smooth'});if(innerWidth<861)$('#sidebar').classList.remove('open')}
  function goClient(id,path='',file=null){openClient=id;currentRoute='client';currentPath=path||'';selectedFile=file;location.hash=`client/${encodeURIComponent(id)}${path?`/${encodeURIComponent(path)}`:''}`;$$('.route').forEach(r=>r.classList.toggle('active',r.dataset.routeView==='client'));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route==='clients'));renderClient(id);window.scrollTo({top:0,behavior:'smooth'});if(innerWidth<861)$('#sidebar').classList.remove('open')}

  function renderHome(){
    const dashboard=[['knowledge','book','قاعدة المعرفة','المبادئ والاستراتيجية والقياس.'],['playbook','layers','دليل التشغيل','كيف تتحول المعرفة إلى سير عمل.'],['ideas','spark','مختبر الأفكار','زوايا نشر قابلة لإعادة الاستخدام.'],['analytics','chart','القياس والتحليل','من الأرقام إلى القرار.'],['clients','users','مكتبة العملاء','مساحات مستقلة لكل عميل.'],['projects','brief','المشروعات','المشروعات والحالات الجارية.'],['dictionary','type','المصطلحات','المعنى والنطق والاستخدام.'],['sources','link','غرفة المصادر','مراجع رسمية ومتخصصة.']];
    $('#dashboardCards').innerHTML=dashboard.map(x=>`<a class="dash-card" href="#${x[0]}" data-go="${x[0]}"><div class="dc-top"><i data-icon="${x[1]}"></i><span class="tag">فتح</span></div><h3>${x[2]}</h3><p>${x[3]}</p></a>`).join('');
    $('#clientCount').textContent=clients.length;$('#projectCount').textContent=projects.length;$('#ideaCount').textContent=(K.ideas||[]).length+(custom.ideas||[]).length;$('#homeClients').innerHTML=clients.slice(0,3).map(c=>`<article class="client-card" data-client="${esc(c.id)}"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description||'مساحة عميل')}</p></div><span class="mini-status">${esc(c.status||'نشط')}</span></article>`).join('')||empty('لا توجد عملاء.');
    $$('[data-icon]',$('#dashboardCards')).forEach(el=>el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[el.dataset.icon]||''}</svg>`);$$('.dash-card').forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.go)});$$('[data-client]',$('#homeClients')).forEach(x=>x.onclick=()=>goClient(x.dataset.client));
  }
  function renderKnowledge(){const filter=$('#knowledgeFilters');const levels=[...new Set((K.knowledge||[]).map(x=>x.level))].sort((a,b)=>a-b);filter.innerHTML=`<button class="chip active" data-level="all">الكل</button>`+levels.map(l=>`<button class="chip" data-level="${l}">المستوى ${l}</button>`).join('');const list=[...(K.knowledge||[]),...(custom.knowledge||[])];const draw=(lvl='all')=>{$('#knowledgeGrid').innerHTML=list.filter(x=>lvl==='all'||String(x.level)===String(lvl)).map(x=>`<article class="knowledge-card"><div class="card-topline"><span class="tag level-tag">المستوى ${esc(x.level||'—')}</span><span class="tag">${esc(x.type||'مادة')}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.body||x.content||'')}</p>${x.take?`<div class="take">${esc(x.take)}</div>`:''}${x.id?.startsWith('custom-')?`<div class="viewer-actions"><button class="danger-btn" data-delete-custom="knowledge" data-id="${esc(x.id)}">حذف الإضافة</button></div>`:''}</article>`).join('')||empty('لا توجد مواد.');$('#knowledgeCount').textContent=`${list.length} مادة`};draw();$$('[data-level]',filter).forEach(b=>b.onclick=()=>{$$('[data-level]',filter).forEach(x=>x.classList.remove('active'));b.classList.add('active');draw(b.dataset.level)});bindDeleteCustom($('#knowledgeGrid'))}
  function renderPlaybook(){$('#playbookGrid').innerHTML=(K.playbook||[]).map(x=>`<article class="playbook-card"><span class="eyebrow">PLAYBOOK</span><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p><ol>${x.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></article>`).join('')}
  function renderIdeas(){const filter=$('#ideasGrid'), type=$$('.chip[data-idea-filter]');const all=[...(K.ideas||[]).map((x,i)=>({id:`builtin-${i}`,title:x[0],kind:x[1],desc:x[2],formats:x.slice(3),builtin:true})),...(custom.ideas||[])];const draw=f=>{filter.innerHTML=all.filter(x=>f==='all'||x.kind===f).map(x=>`<article class="idea-card"><div class="card-topline"><span class="tag">${esc(x.kind||'فكرة')}</span>${x.builtin?'':'<span class="tag">إضافتك</span>'}</div><h3>${esc(x.title)}</h3><p>${esc(x.desc||'')}</p>${x.formats?`<div class="take">${x.formats.map(esc).join(' · ')}</div>`:''}${x.builtin?'':`<div class="viewer-actions"><button class="danger-btn" data-delete-custom="ideas" data-id="${esc(x.id)}">حذف الإضافة</button></div>`}</article>`).join('')||empty('لا توجد أفكار.');bindDeleteCustom(filter)};draw('all');type.forEach(b=>b.onclick=()=>{type.forEach(x=>x.classList.remove('active'));b.classList.add('active');draw(b.dataset.ideaFilter)})}
  function renderAnalytics(){const total=(K.knowledge||[]).length;$('#metricCards').innerHTML=[['المعرفة الأساسية',total,'مادة منظمة'],['العملاء',clients.length,'مساحات فعلية'],['المشروعات',projects.length,'حالات حالية'],['الأفكار',((K.ideas||[]).length+(custom.ideas||[]).length),'بنك قابل للتوسع']].map(x=>`<div class="metric"><div class="m-label">${x[0]}</div><div class="m-value">${x[1]}</div><div class="m-note">${x[2]}</div></div>`).join('');const ds=[['وصول مرتفع + متابعة منخفضة','افصل بين قوة الاكتشاف وضعف التحويل إلى متابعة؛ راجع الصفحة والتموضع والدعوة للإجراء.'],['حفظ مرتفع + مشاركة منخفضة','قد يكون المحتوى مرجعيًا أكثر من كونه قابلًا للنقل الاجتماعي.'],['تفاعل جيد + وصول منخفض','اختبر ملاءمة الموضوع والتغليف قبل تغيير الاستراتيجية كلها.'],['منشور واحد قوي جدًا','اعتبره إشارة تستحق التكرار والاختبار، لا قاعدة نهائية.']];$('#diagnosisList').innerHTML=ds.map(d=>`<div class="diagnosis"><b>${d[0]}</b><span>${d[1]}</span></div>`).join('')}

  function renderClients(){
    const q=String($('#clientSearch')?.value||'').trim().toLowerCase();const list=clients.filter(c=>!q||`${c.name} ${c.description}`.toLowerCase().includes(q));$('#clientLibraryCount').textContent=`${list.length} عميل`;
    $('#clientsGrid').innerHTML=list.map(c=>`<article class="client-large"><div class="client-ident"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description||'مساحة العميل')}</p></div></div><div class="client-meta"><span class="meta-pill">${esc(c.status||'نشط')}</span><span class="meta-pill">ملفات قابلة للإدارة</span><span class="meta-pill">مزامنة مشتركة</span></div><p class="client-description">هذه ليست بطاقة تعريف؛ الضغط عليها يفتح مساحة العمل الفعلية للعميل، ومنها تدخل إلى المجلدات والملفات وتضيف أو تعدل أو تحذف.</p><div class="client-large-actions"><button class="primary-btn" data-open-client="${esc(c.id)}">فتح مساحة العميل ←</button>${c.baseline?'':`<button class="danger-btn" data-delete-client="${esc(c.id)}">حذف العميل</button>`}</div></article>`).join('')||empty('لا توجد عملاء مطابقة للبحث.');$$('[data-open-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();goClient(b.dataset.openClient)});$$('[data-delete-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();deleteClient(b.dataset.deleteClient)});
  }
  async function deleteClient(id){const c=clients.find(x=>x.id===id);if(!c||c.baseline)return;if(!confirm(`سيتم حذف مساحة «${c.name}» وملفاتها من المستودع. هل أنت متأكد؟`))return;try{await mutateGithub('delete_path',{path:c.path});clients=clients.filter(x=>x.id!==id);projects=projects.filter(p=>p.clientId!==id);localSave();renderClients();toast('تم حذف مساحة العميل.')}catch(e){toast(`تعذر الحذف: ${e.message}`)}}

  function renderProjects(){const all=projects.map(p=>{const c=clients.find(x=>x.id===p.clientId);return {...p,clientName:c?.name||'عام'}});$('#projectsGrid').innerHTML=all.map(p=>`<article class="project-card"><div class="card-topline"><span class="tag level-tag">${esc(p.status||'نشط')}</span><span class="tag">${esc(p.clientName)}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><div class="take">${esc(p.startDate||'—')} → ${esc(p.endDate||'—')}</div>${p.baseline?'':`<div class="viewer-actions"><button class="danger-btn" data-delete-custom="projects" data-id="${esc(p.id)}">حذف الإضافة</button></div>`}</article>`).join('')||empty('لا توجد مشروعات.');bindDeleteCustom($('#projectsGrid'))}
  function renderDictionary(){const list=K.terms||[];$('#termGrid').innerHTML=list.map(x=>`<article class="term-card"><div class="term-en">${esc(x[0])}</div><div class="term-pron">النطق: ${esc(x[1])}</div><div class="term-meaning"><b>${esc(x[2])}</b><br>${esc(x[3])}</div></article>`).join('')}
  function renderSources(){$('#sourceGrid').innerHTML=[...(K.sources||[]),...(custom.sources||[]).map(x=>[x.title,x.kind||'إضافة',x.content,x.url,x.id])].map(x=>`<article class="source-card"><div class="card-topline"><span class="tag">${esc(x[1]||'مصدر')}</span>${x[4]?'':'<span class="tag">أساسي</span>'}</div><h3>${esc(x[0])}</h3><p>${esc(x[2]||'')}</p>${x[3]?`<div style="margin-top:9px"><a href="${esc(x[3])}" target="_blank" rel="noopener">فتح المصدر ↗</a></div>`:''}${x[4]?`<div class="viewer-actions"><button class="danger-btn" data-delete-custom="sources" data-id="${esc(x[4])}">حذف الإضافة</button></div>`:''}</article>`).join('')||empty('لا توجد مصادر.') ;bindDeleteCustom($('#sourceGrid'))}
  function renderStandards(){$('#standardsGrid').innerHTML=(K.standards||[]).map(x=>`<article class="standard-card"><span class="eyebrow">STANDARD</span><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></article>`).join('')}

  async function getFolderEntries(clientId,path=''){
    const clean=String(path||'').replace(/^\/+|\/+$/g,'');
    const key=`${clientId}::${clean}`;
    if(folderCache.has(key))return folderCache.get(key);

    if(hasCloud()){
      const p=clean?`${clientPath(clientId)}/${clean}`:clientPath(clientId);
      const raw=await apiGet('tree',{path:p});
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
    if(c.name==='ريتاج علي'&&!staticTreeCache) await loadStaticTree(); const entries=await getFolderEntries(id,currentPath);const folders=entries.filter(x=>x.type==='folder').length, files=entries.filter(x=>x.type==='file').length;
    const breadcrumbs=currentPath?currentPath.split('/'):[];const crumbHtml=[`<button class="crumb-btn" data-client-root="${esc(id)}">الجذر</button>`].concat(breadcrumbs.map((seg,i)=>`<span class="crumb-sep">/</span><button class="crumb-btn" data-client-path="${esc(breadcrumbs.slice(0,i+1).join('/'))}">${esc(seg)}</button>`)).join('');
    const project=projects.find(p=>p.clientId===id);
    $('#clientPage').innerHTML=`<div class="client-header"><div><div class="client-breadcrumb"><button type="button" id="backClients">← مكتبة العملاء</button><span>/</span><span>${esc(c.name)}</span></div><div class="client-title"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h1>${esc(c.name)}</h1><p>${esc(c.description||'مساحة العميل')} ${project?`· ${esc(project.name)}`:''}</p></div></div></div><div class="client-tools"><button class="ghost-btn" id="refreshClient">↻ تحديث</button><button class="primary-btn" data-add="client-file" data-client="${esc(id)}" data-parent="${esc(currentPath)}">＋ ملف</button><button class="ghost-btn" data-add="client-folder" data-client="${esc(id)}" data-parent="${esc(currentPath)}">＋ مجلد</button></div></div><div class="client-statbar"><div class="client-stat"><b>${folders}</b><span>مجلدات هنا</span></div><div class="client-stat"><b>${files}</b><span>ملفات هنا</span></div><div class="client-stat"><b>${hasCloud()?'متصل':'محلي'}</b><span>مصدر البيانات</span></div><div class="client-stat"><b>${project?'1':'0'}</b><span>مشروع نشط</span></div></div><div class="save-state"><span>${hasCloud()?'<span class="good">● الحفظ المشترك والمزامنة عبر API فعّالان.</span>':'● الوضع المحلي: التغييرات لن تنتقل إلى الأجهزة الأخرى.'}</span><span>${hasCloud()?'تحديث دوري + تحديث يدوي':'غير متصل'}</span></div><div class="folder-toolbar"><div class="breadcrumbs">${crumbHtml}</div><div class="folder-controls"><span class="muted-count">${currentPath||'الجذر'}</span><button type="button" class="sort-btn" id="folderSort" title="تغيير ترتيب المجلدات">↕ ترتيب: ${folderSort==='number'?'رقمي':'حسب الاسم'}</button></div></div><div class="file-grid" id="fileGrid">${entries.map(e=>`<article class="file-card ${e.type==='folder'?'folder':''}" data-entry-path="${esc(e.path)}" data-entry-type="${e.type}">${hasCloud()&&e.source==='github'&&!(c.name==='ريتاج علي'&&staticTreeCache?.some(x=>String(x).replace(/\/$/,'')===e.path))?`<button class="remove-mini" data-delete-path="${esc(e.path)}" title="حذف هذا العنصر" aria-label="حذف ${esc(e.name)}">حذف</button>`:''}<span class="kind">${e.type==='folder'?'مجلد':esc(fileType(e.name))}</span><div class="big-icon">${fileIcon(fileType(e.name),e.type==='folder')}</div><div><h3 title="${esc(e.name)}">${esc(e.name)}</h3><p>${e.type==='folder'?'فتح المجلد':'ملف محفوظ'}</p></div></article>`).join('')||`<div class="client-empty"><div><div class="big-icon" style="margin:auto">${fileIcon('نص')}</div><strong>هذا المجلد فارغ</strong><p>أضف ملفًا أو أنشئ مجلدًا جديدًا من الأزرار أعلاه.</p></div></div>`}</div>`;
    $('#backClients').onclick=()=>go('clients');$('#refreshClient').onclick=async()=>{folderCache.clear();await renderClient(id);toast('تم تحديث مساحة العميل.')};bindAddButtons($('#clientPage'));
    $$('[data-entry-path]',$('#fileGrid')).forEach(card=>card.onclick=e=>{if(e.target.closest('[data-delete-path]'))return;const p=card.dataset.entryPath,t=card.dataset.entryType;if(t==='folder')goClient(id,p);});
    $$('[data-client-root]',$('#clientPage')).forEach(b=>b.onclick=()=>goClient(id,''));$$('[data-client-path]',$('#clientPage')).forEach(b=>b.onclick=()=>goClient(id,b.dataset.clientPath));$$('[data-delete-path]',$('#fileGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();deleteClientPath(id,b.dataset.deletePath)}); $('#folderSort').onclick=async()=>{folderSort=folderSort==='number'?'name':'number';folderCache.clear();await renderClient(id)};
  }
  async function renderSelectedFile(clientId,path){
    const viewer=$('#fileViewer');if(!viewer)return;
    const name=path.split('/').pop(),kind=fileType(name),ext=(name.split('.').pop()||'').toLowerCase();
    const textable=['txt','md','csv','json','html','css','js','ts','xml','yaml','yml'].includes(ext);

    if(hasCloud()){
      let f=null;try{f=await apiGet('file',{path:`${clientPath(clientId)}/${path}`})}catch{}
      if(f){
        const isImage=kind==='صورة',isPdf=kind==='PDF';
        viewer.innerHTML=`<div class="viewer-head"><div><h2>${esc(name)}</h2><p>${esc(path)}</p></div><span class="tag">${esc(kind)}</span></div><div class="viewer-body">
          ${textable?`<textarea id="fileEditor" class="file-editor">${esc(f.content||'')}</textarea>`:
          isImage?`<img class="file-preview-image" src="${esc(f.download_url||f.html_url||'')}" alt="${esc(name)}">`:
          isPdf?`<iframe class="file-open-frame" src="${esc(f.download_url||f.html_url||'')}" title="${esc(name)}"></iframe>`:
          `<div class="binary-open"><div class="big-icon" style="margin:auto">${fileIcon(kind)}</div><h3>${esc(kind)} — ملف فعلي</h3><p>يمكن فتحه أو تنزيله من المستودع.</p></div>`}
          <div class="viewer-actions">${textable?'<button class="primary-btn" id="saveFileBtn">حفظ التعديلات</button>':''}<button class="danger-btn" id="deleteFileBtn">حذف الملف</button></div><div class="path-line">${esc(f.path||path)}</div></div>`;
        if(textable)$('#saveFileBtn').onclick=()=>saveTextFile(clientId,path,f);
        $('#deleteFileBtn').onclick=()=>deleteClientPath(clientId,path);return;
      }
    }

    const local=await localGet(localKey(clientId,path)).catch(()=>null);
    if(local&&local.type==='file'){
      let content='',url='';
      try{url=URL.createObjectURL(local.blob);if(textable)content=await local.blob.text()}catch{}
      viewer.innerHTML=`<div class="viewer-head"><div><h2>${esc(name)}</h2><p>${esc(path)}</p></div><span class="tag">محلي · ${esc(kind)}</span></div><div class="viewer-body">
        ${textable?`<textarea id="fileEditor" class="file-editor">${esc(content)}</textarea>`:
        kind==='صورة'?`<img class="file-preview-image" src="${url}" alt="${esc(name)}">`:
        kind==='PDF'?`<iframe class="file-open-frame" src="${url}" title="${esc(name)}"></iframe>`:
        `<div class="binary-open"><div class="big-icon" style="margin:auto">${fileIcon(kind)}</div><h3>${esc(kind)} — ملف محلي</h3><p>هذا الملف محفوظ في متصفحك ويمكن تنزيله أو فتحه.</p></div>`}
        <div class="viewer-actions">${textable?'<button class="primary-btn" id="saveFileBtn">حفظ التعديلات</button>':''}<button class="danger-btn" id="deleteFileBtn">حذف الملف</button></div><div class="path-line">${esc(path)}</div></div>`;
      if(textable)$('#saveFileBtn').onclick=()=>saveLocalTextFile(clientId,path,local);
      $('#deleteFileBtn').onclick=()=>deleteClientPath(clientId,path);return;
    }

    const localUrl=`clients/${encodeURIComponent('ريتاج علي')}/${path.split('/').map(encodeURIComponent).join('/')}`;
    viewer.innerHTML=`<div class="viewer-head"><div><h2>${esc(name)}</h2><p>${esc(path)}</p></div><span class="tag">${esc(kind)}</span></div><div class="viewer-body"><div class="viewer-note">هذا ملف من القالب الأصلي للمشروع. يمكنك إنشاء نسخة قابلة للتحرير أو رفع نسخة جديدة من الزر «＋ ملف».</div><div class="viewer-actions">${textable?'<button class="primary-btn" id="createRemoteCopy">إنشاء نسخة قابلة للتحرير</button>':''}</div><div class="path-line">${esc(path)}</div></div>`;
    if(textable)$('#createRemoteCopy').onclick=()=>showAdd('client-file',{clientId,parent:currentPath,nameHint:name});
  }
  async function saveLocalTextFile(clientId,path,item){
    if(!(await ensureLogin()))return;
    try{const value=$('#fileEditor').value;const blob=new Blob([value],{type:item.mime||mimeFor(path)});await localPut({...item,blob,size:blob.size,updatedAt:new Date().toISOString()});folderCache.clear();toast('تم حفظ الملف محليًا.')}catch(e){toast(`تعذر الحفظ: ${e.message}`)}
  }
  async function saveTextFile(clientId,path,f){if(!(await ensureLogin()))return;try{await mutateGithub('update_file',{path:`${clientPath(clientId)}/${path}`,contentBase64:bytesToBase64(new TextEncoder().encode($('#fileEditor').value).buffer),sha:f.sha});toast('تم حفظ التعديلات.')}catch(e){toast(`تعذر الحفظ: ${e.message}`)}}
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

  function addChoice(){return `<h2>إضافة إلى المركز</h2><p>كل إضافة قابلة للإزالة لاحقًا. الحفظ المشترك يتم عبر واجهة API محمية.</p><div class="add-choice-grid"><button class="add-choice" data-choice="client"><b>عميل</b><span>مساحة جديدة داخل مكتبة العملاء.</span></button><button class="add-choice" data-choice="project"><b>مشروع</b><span>مشروع جديد وربطه بعميل.</span></button><button class="add-choice" data-choice="knowledge"><b>معرفة</b><span>مادة جديدة لقاعدة المعرفة.</span></button><button class="add-choice" data-choice="idea"><b>فكرة</b><span>فكرة جديدة لمختبر الأفكار.</span></button><button class="add-choice" data-choice="source"><b>مصدر</b><span>مرجع جديد.</span></button><button class="add-choice" data-choice="entry"><b>سجل</b><span>ملاحظة أو قرار أو مهمة.</span></button></div>`}
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
        modal.classList.remove('show');folderCache.clear();await renderClient(extra.clientId);toast(hasCloud()?'تمت إضافة الملف إلى المستودع.':'تمت إضافة الملف محليًا إلى هذا المتصفح.');return
      }
      if(type==='client-folder'){
        const n=String(fd.get('name')||'').trim();const p=String(fd.get('parent')||'').trim().replace(/^\/+|\/+$/g,'');
        if(!n||/[\\/]/.test(n))throw new Error('اسم المجلد غير صالح');
        const folderPath=p?`${p}/${n}`:n;
        if(hasCloud())await mutateGithub('create_folder',{path:`${clientPath(extra.clientId)}/${folderPath}/.keep`});
        else await localPut({key:localKey(extra.clientId,folderPath),clientId:extra.clientId,name:n,type:'folder',path:folderPath,parent:p,size:0,createdAt:new Date().toISOString()});
        modal.classList.remove('show');folderCache.clear();currentPath=folderPath;await renderClient(extra.clientId);toast(hasCloud()?'تم إنشاء المجلد.':'تم إنشاء المجلد محليًا.');return
      }
      const id=uid();let item={id,title:String(fd.get('title')||''),content:String(fd.get('content')||''),createdAt:new Date().toISOString()};let kind='entries';if(type==='project'){item={...item,name:item.title,clientId:fd.get('clientId')||null,status:'نشط',startDate:fd.get('startDate')||'',endDate:fd.get('endDate')||'',description:item.content};kind='projects'}else if(type==='idea'){item={...item,title:item.title,kind:'discovery',desc:item.content,formats:['نص','كاروسيل']};kind='ideas'}else if(type==='knowledge'){item={...item,level:1,category:'إضافة',body:item.content,type:fd.get('type')||'مادة',take:''};kind='knowledge'}else if(type==='source'){item={...item,title:item.title,kind:fd.get('kind')||'عام',content:item.content,url:fd.get('url')||''};kind='sources'}else item={...item,type:fd.get('type')||'سجل',tags:fd.get('tags')||''};await mutateGithub('mutate_data',{kind,operation:'add',item});custom[kind]=[item,...(custom[kind]||[])];if(kind==='projects')projects=[...baseProjects,...custom.projects];localSave();modal.classList.remove('show');renderRoute(currentRoute);toast('تم حفظ الإضافة ويمكن حذفها لاحقًا.');}catch(err){toast(`تعذر الحفظ: ${err.message}`)}}}
  function bytesToBase64(buf){let binary='';const bytes=new Uint8Array(buf);const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(binary)}
  async function bindDeleteCustom(root){$$('[data-delete-custom]',root).forEach(b=>b.onclick=async()=>{const kind=b.dataset.deleteCustom,id=b.dataset.id;if(!confirm('حذف هذه الإضافة نهائيًا من المركز؟'))return;try{await mutateGithub('mutate_data',{kind,operation:'delete',item:{id}});custom[kind]=(custom[kind]||[]).filter(x=>x.id!==id);if(kind==='projects')projects=[...baseProjects,...custom.projects];localSave();renderRoute(currentRoute);toast('تم حذف الإضافة.')}catch(e){toast(`تعذر الحذف: ${e.message}`)}})}

  function bindAddButtons(root=document){$$('[data-add]',root).forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=e=>{e.stopPropagation();showAdd(b.dataset.add,{clientId:b.dataset.client,parent:b.dataset.parent,projectId:b.dataset.project,nameHint:b.dataset.nameHint})}})}
  function renderRoute(route){if(route==='home')renderHome();if(route==='knowledge')renderKnowledge();if(route==='playbook')renderPlaybook();if(route==='ideas')renderIdeas();if(route==='analytics')renderAnalytics();if(route==='clients')renderClients();if(route==='projects')renderProjects();if(route==='dictionary')renderDictionary();if(route==='sources')renderSources();if(route==='standards')renderStandards();bindAddButtons()}

  function allSearchItems(){const items=[];(K.knowledge||[]).forEach(x=>items.push({kind:'معرفة',title:x.title,desc:x.body,route:'knowledge'}));(K.ideas||[]).forEach(x=>items.push({kind:'فكرة',title:x[0],desc:x[2],route:'ideas'}));(K.terms||[]).forEach(x=>items.push({kind:'مصطلح',title:x[0],desc:`${x[2]} — ${x[3]}`,route:'dictionary'}));(K.sources||[]).forEach(x=>items.push({kind:'مصدر',title:x[0],desc:x[2],route:'sources'}));clients.forEach(c=>items.push({kind:'عميل',title:c.name,desc:c.description,action:()=>goClient(c.id)}));projects.forEach(p=>items.push({kind:'مشروع',title:p.name,desc:p.description,route:'projects'}));(custom.knowledge||[]).forEach(x=>items.push({kind:'إضافة معرفة',title:x.title,desc:x.body,route:'knowledge'}));(custom.ideas||[]).forEach(x=>items.push({kind:'إضافة فكرة',title:x.title,desc:x.desc,route:'ideas'}));(custom.sources||[]).forEach(x=>items.push({kind:'إضافة مصدر',title:x.title,desc:x.content,route:'sources'}));return items}
  function initSearch(){const input=$('#searchInput'),res=$('#searchResults');const draw=()=>{const q=input.value.trim().toLowerCase();if(!q){res.classList.remove('show');res.innerHTML='';return}const hits=allSearchItems().filter(x=>`${x.title} ${x.desc||''} ${x.kind}`.toLowerCase().includes(q)).slice(0,30);res.innerHTML=hits.map((x,i)=>`<div class="search-item" data-search-index="${i}"><div class="si-icon">${esc(x.kind.slice(0,1))}</div><div><h4>${esc(x.title)}</h4><p>${esc(x.kind)} — ${esc(String(x.desc||'').slice(0,135))}</p></div></div>`).join('')||`<div class="search-item"><div><h4>لا توجد نتيجة</h4><p>جرّب مصطلحًا مختلفًا.</p></div></div>`;res.classList.add('show');$$('[data-search-index]',res).forEach((el,i)=>{el.onclick=()=>{const x=hits[i];res.classList.remove('show');input.value='';x.action?x.action():x.route&&go(x.route)}})};input.oninput=draw;input.onfocus=draw;$('#clearSearch').onclick=()=>{input.value='';res.classList.remove('show');input.focus()};document.addEventListener('click',e=>{if(!$('#searchWrap').contains(e.target))res.classList.remove('show')});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus()}})}
  function initTheme(){const saved=localStorage.getItem('central-theme');const use=saved||'light';document.documentElement.classList.toggle('dark',use==='dark');$('#themeToggle').onclick=()=>{const d=!document.documentElement.classList.contains('dark');document.documentElement.classList.toggle('dark',d);localStorage.setItem('central-theme',d?'dark':'light')}}
  function boot(){const b=$('#boot'),status=$('#boot-status'),f=$('#fingerprint');const open=async()=>{b.classList.add('scanning');status.textContent='جارٍ فتح المساحة…';await new Promise(r=>setTimeout(r,260));status.textContent='تم التحقق';b.classList.add('hide')};f.onclick=open;f.onpointerdown=e=>f.setPointerCapture?.(e.pointerId);f.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')open()};setTimeout(()=>{status.textContent='المساحة جاهزة — المس البصمة';},900)}

  $('#mobileMenu').onclick=()=>$('#sidebar').classList.add('open');$('#closeSide').onclick=()=>$('#sidebar').classList.remove('open');$('#syncPill').onclick=()=>toast(hasCloud()?'الحفظ المشترك يعمل عبر API.':'لا يوجد حفظ مشترك حاليًا.');$('#addGlobal').onclick=()=>showAdd('global');$('#sideAdd').onclick=()=>showAdd('global');$('#modalClose').onclick=()=>$('#modal').classList.remove('show');$('.modal-backdrop')?.addEventListener('click',()=>$('#modal').classList.remove('show'));
  $('#clientSearch')?.addEventListener('input',renderClients);
  window.addEventListener('hashchange',()=>{const h=decodeURIComponent(location.hash.slice(1)||'home');if(h.startsWith('client/')){const pieces=h.split('/');const id=pieces[1];const path=pieces.slice(2).filter(Boolean).join('/');goClient(id,path)}else go(h)});

  // Local first, then cloud.
  const l=localGet();if(l.custom)custom={...custom,...l.custom};if(l.clients?.length&&!API)clients=l.clients;if(l.projects?.length&&!API)projects=l.projects;
  initSearch();initTheme();boot();setSync('محلي',false);
  const initialHash=decodeURIComponent(location.hash.slice(1)||'home');
  if(initialHash.startsWith('client/')){const pieces=initialHash.split('/');goClient(pieces[1],pieces.slice(2).filter(Boolean).join('/'))}else go(initialHash);
  bindAddButtons();
  if(API){refreshCloud().then(startPolling)}
})();
