(() => {
  'use strict';
  const K = window.KNOWLEDGE || { knowledge: [], ideas: [], terms: [], sources: [], playbook: [], standards: [] };
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const icons = {
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/>',
    book:'<path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22z"/><path d="M5 4.5V20"/><path d="M9 6h6"/>',
    layers:'<path d="m12 3 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4"/><path d="m4 17 8 4 8-4"/>',
    spark:'<path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/>',
    chart:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8"/><path d="M17 15a5 5 0 0 1 4 5"/>',
    brief:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18M10 11v2h4v-2"/>',
    type:'<path d="M5 5h14M5 12h10M5 19h7"/>',
    link:'<path d="M10 13.5 14 10"/><path d="M7.5 16.5 6 18a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" transform="translate(2 -2)"/><path d="M16.5 7.5 18 6a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" transform="translate(-2 2)"/>',
    shield:'<path d="M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    arrow:'<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/>',
    folder:'<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M3.5 9h17"/>',
    download:'<path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/>',
    external:'<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
    eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/>',
    trash:'<path d="M4 7h16"/><path d="M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/>',
    edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  };
  const iconSvg = (name, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.file}</svg>`;
  function paintIcons(root=document){$$('[data-icon]',root).forEach(el=>el.innerHTML=iconSvg(el.dataset.icon));}

  const LOCAL_KEY = 'central-workspace-local-v5';
  const SESSION_KEY = 'central-workspace-session-v2';
  const APP_CONFIG = window.APP_CONFIG || {};
  const ADMIN_PASSWORD = String(APP_CONFIG.ADMIN_PASSWORD || '1122');

  const baseClients = [{id:'retaj-ali',name:'ريتاج علي',code:'RA',status:'نشط',description:'كاتبة — إدارة صفحة فيسبوك',path:'clients/ريتاج علي',createdAt:'2026-09-01',baseline:true}];
  const baseProjects = [{id:'project-retaj-facebook',clientId:'retaj-ali',name:'إدارة صفحة فيسبوك',status:'نشط',startDate:'2026-09-01',endDate:'2027-04-30',description:'إدارة استراتيجية ومحتوى ونشر وتحليل لصفحة Facebook.',createdAt:'2026-09-01',baseline:true}];
  let custom={entries:[],projects:[],knowledge:[],ideas:[],sources:[]};
  let clients=[...baseClients], projects=[...baseProjects];
  let currentRoute='home', openClient=null, currentPath='', selectedFile=null, folderCache=new Map(), clientMetaCache=new Map(), folderSort='number';
  let localReady=false;
  const uniqueById=arr=>{const m=new Map();for(const x of arr||[]){if(x?.id)m.set(x.id,x)}return [...m.values()]};

  function loadLocalState(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')}catch{return {}}}
  function localSave(){
    try{localStorage.setItem(LOCAL_KEY,JSON.stringify({custom,clients,projects}))}
    catch(e){console.warn('Local state save:',e)}
  }
  let localDbPromise=null;
  function localDb(){
    if(localDbPromise)return localDbPromise;
    localDbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('IndexedDB غير متاح في هذا المتصفح'));
      const req=indexedDB.open('central-workspace-local',1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('items'))db.createObjectStore('items',{keyPath:'key'})};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('تعذر فتح التخزين المحلي'));
    });
    return localDbPromise;
  }
  async function localList(clientId,parent=''){
    const db=await localDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('items','readonly').objectStore('items').getAll();
      req.onsuccess=()=>{const p=String(parent||'').replace(/^\/+|\/+$/g,'');resolve((req.result||[]).filter(x=>x.clientId===clientId&&x.parent===p).map(x=>({...x,source:'local'})))};
      req.onerror=()=>reject(req.error);
    });
  }
  async function localAll(clientId){
    const db=await localDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('items','readonly').objectStore('items').getAll();
      req.onsuccess=()=>resolve((req.result||[]).filter(x=>x.clientId===clientId));
      req.onerror=()=>reject(req.error);
    });
  }
  async function localGet(key){
    const db=await localDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('items','readonly').objectStore('items').get(key);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  }
  async function localPut(item){
    const db=await localDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('items','readwrite').objectStore('items').put(item);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function localRemove(key){
    const db=await localDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('items','readwrite').objectStore('items').delete(key);
      req.onsuccess=()=>resolve();
      req.onerror=()=>reject(req.error);
    });
  }
  function localKey(clientId,path){return `${clientId}::${String(path||'').replace(/^\/+|\/+$/g,'')}`}
  function mimeFor(name){
    const ext=(name.split('.').pop()||'').toLowerCase();
    return ({txt:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',html:'text/html',css:'text/css',js:'text/javascript',ts:'text/typescript',xml:'application/xml',yaml:'text/yaml',yml:'text/yaml',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',doc:'application/msword',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xls:'application/vnd.ms-excel',pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',svg:'image/svg+xml',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'})[ext]||'application/octet-stream';
  }
  function session(){
    try{const o=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(o?.expiresAt>Date.now())return o.token;sessionStorage.removeItem(SESSION_KEY)}catch{}
    return '';
  }
  function setSession(){sessionStorage.setItem(SESSION_KEY,JSON.stringify({token:'local-admin',expiresAt:Date.now()+8*60*60*1000}))}
  function notifySave(text){const b=$('#saveBanner'),t=$('#saveBannerText');if(!b||!t)return;t.textContent=text;b.classList.add('show');clearTimeout(notifySave.timer);notifySave.timer=setTimeout(()=>b.classList.remove('show'),2600)}
  function toast(text){const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),3000)}
  function setLocalStatus(text='محلي'){
    const localStatus=$('#localStatus'),systemNumber=$('#systemNumber'),systemDesc=$('#systemDesc'),saveNote=$('#saveNote');
    if(localStatus)localStatus.textContent=text;
    if(systemNumber)systemNumber.textContent='LOCAL';
    if(systemDesc)systemDesc.textContent='البيانات محفوظة محليًا على هذا الكمبيوتر، دون خادم أو مزامنة خارجية.';
    if(saveNote)saveNote.textContent='الحفظ المحلي مفعّل؛ البيانات تبقى محفوظة بعد إغلاق التطبيق.';
  }
  async function ensureLogin(){
    if(session())return true;
    return new Promise(resolve=>{
      const mc=$('#modalContent'),modal=$('#modal');
      mc.innerHTML=`<div class="password-box"><div class="password-icon">⌁</div><h2>صلاحية التعديل</h2><p>أدخل كلمة المرور للمتابعة.</p><div class="field"><label>كلمة المرور</label><input id="adminPass" class="password-input" type="password" inputmode="numeric" maxlength="64" autocomplete="off" placeholder="••••"></div><div class="modal-actions"><button class="primary-btn" id="passOk">متابعة</button><button class="ghost-btn" id="passCancel">إلغاء</button></div></div>`;
      modal.classList.add('show');setTimeout(()=>$('#adminPass')?.focus(),30);
      const close=()=>{modal.classList.remove('show');resolve(false)};
      $('#passCancel').onclick=close;
      $('#passOk').onclick=()=>{const pass=String($('#adminPass')?.value||'');if(pass===ADMIN_PASSWORD){setSession();modal.classList.remove('show');resolve(true)}else{toast('كلمة المرور غير صحيحة.');$('#adminPass').select()}};
      $('#adminPass').onkeydown=e=>{if(e.key==='Enter')$('#passOk').click();if(e.key==='Escape')close()};
    });
  }
  function clientFromStoredPath(path){
    const clean=String(path||'').replace(/^\/+|\/+$/g,'');
    const c=clients.find(x=>clean===x.path||clean.startsWith(`${x.path}/`));
    return c||null;
  }
  function relativeStoredPath(client,path){const base=client.path.replace(/^\/+|\/+$/g,'');const clean=String(path||'').replace(/^\/+|\/+$/g,'');return clean===base?'':clean.slice(base.length+1)}
  async function mutateLocal(action,payload={}){
    if(!(await ensureLogin()))throw new Error('cancelled');
    if(action!=='mutate_data')throw new Error('عملية محلية غير مدعومة');
    const allowed=['entries','projects','knowledge','ideas','sources'];
    if(!allowed.includes(payload.kind))throw new Error('نوع بيانات غير مسموح');
    custom[payload.kind]=Array.isArray(custom[payload.kind])?custom[payload.kind]:[];
    if(payload.operation==='add')custom[payload.kind].unshift(payload.item);
    else if(payload.operation==='delete')custom[payload.kind]=custom[payload.kind].filter(x=>x.id!==payload.item?.id);
    else if(payload.operation==='update')custom[payload.kind]=custom[payload.kind].map(x=>x.id===payload.item?.id?payload.item:x);
    else throw new Error('عملية غير مسموحة');
    if(payload.kind==='projects')projects=uniqueById([...baseProjects,...custom.projects]);
    localSave();notifySave('تم الحفظ محليًا');return true;
  }
  async function refreshLocal(){localReady=true;folderCache.clear();setLocalStatus('محلي');if(currentRoute==='clients'||openClient){renderRoute(currentRoute);if(openClient)await renderClient(openClient)}}
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


  function go(route){currentRoute=route;openClient=null;currentPath='';selectedFile=null;location.hash=route;$$('.route').forEach(r=>r.classList.toggle('active',r.dataset.routeView===route));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route===route));renderRoute(route);window.scrollTo({top:0,behavior:'smooth'});if(innerWidth<861)$('#sidebar').classList.remove('open')}
  function goClient(id,path='',file=null){openClient=id;currentRoute='client';currentPath=path||'';selectedFile=file;location.hash=`client/${encodeURIComponent(id)}${path?`/${encodeURIComponent(path)}`:''}`;$$('.route').forEach(r=>r.classList.toggle('active',r.dataset.routeView==='client'));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.route==='clients'));renderClient(id);window.scrollTo({top:0,behavior:'smooth'});if(innerWidth<861)$('#sidebar').classList.remove('open')}

  function renderHome(){
    const dashboard=[['knowledge','book','قاعدة المعرفة','المبادئ والاستراتيجية والقياس.'],['playbook','layers','دليل التشغيل','كيف تتحول المعرفة إلى سير عمل.'],['ideas','spark','مختبر الأفكار','زوايا نشر قابلة لإعادة الاستخدام.'],['analytics','chart','القياس والتحليل','من الأرقام إلى القرار.'],['clients','users','مكتبة العملاء','مساحات مستقلة لكل عميل.'],['projects','brief','المشروعات','المشروعات والحالات الجارية.'],['dictionary','type','المصطلحات','المعنى والنطق والاستخدام.'],['sources','link','غرفة المصادر','مراجع رسمية ومتخصصة.']];
    $('#dashboardCards').innerHTML=dashboard.map(x=>`<a class="dash-card" href="#${x[0]}" data-go="${x[0]}"><div class="dc-top"><i data-icon="${x[1]}"></i><span class="tag">فتح</span></div><h3>${x[2]}</h3><p>${x[3]}</p></a>`).join('');
    $('#clientCount').textContent=clients.length;$('#projectCount').textContent=projects.length;$('#ideaCount').textContent=(K.ideas||[]).length+(custom.ideas||[]).length;$('#homeClients').innerHTML=clients.slice(0,3).map(c=>`<article class="client-card" data-client="${esc(c.id)}"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description||'مساحة عميل')}</p></div><span class="mini-status">${esc(c.status||'نشط')}</span></article>`).join('')||empty('لا توجد عملاء.');
    paintIcons($('#dashboardCards'));$$('.dash-card').forEach(a=>a.onclick=e=>{e.preventDefault();go(a.dataset.go)});$$('[data-client]',$('#homeClients')).forEach(x=>x.onclick=()=>goClient(x.dataset.client));
  }
  function renderKnowledge(){const filter=$('#knowledgeFilters');const levels=[...new Set((K.knowledge||[]).map(x=>x.level))].sort((a,b)=>a-b);filter.innerHTML=`<button class="chip active" data-level="all">الكل</button>`+levels.map(l=>`<button class="chip" data-level="${l}">المستوى ${l}</button>`).join('');const list=[...(K.knowledge||[]),...(custom.knowledge||[])];const draw=(lvl='all')=>{$('#knowledgeGrid').innerHTML=list.filter(x=>lvl==='all'||String(x.level)===String(lvl)).map(x=>`<article class="knowledge-card"><div class="card-topline"><span class="tag level-tag">المستوى ${esc(x.level||'—')}</span><span class="tag">${esc(x.type||'مادة')}</span></div><h3>${esc(x.title)}</h3><p>${esc(x.body||x.content||'')}</p>${x.take?`<div class="take">${esc(x.take)}</div>`:''}${x.id?.startsWith('custom-')?`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="knowledge" data-id="${esc(x.id)}">تعديل</button><button class="danger-btn" data-delete-custom="knowledge" data-id="${esc(x.id)}">حذف الإضافة</button></div>`:''}</article>`).join('')||empty('لا توجد مواد.');$('#knowledgeCount').textContent=`${list.length} مادة`};draw();$$('[data-level]',filter).forEach(b=>b.onclick=()=>{$$('[data-level]',filter).forEach(x=>x.classList.remove('active'));b.classList.add('active');draw(b.dataset.level)});bindDeleteCustom($('#knowledgeGrid'))}
  function renderPlaybook(){$('#playbookGrid').innerHTML=(K.playbook||[]).map(x=>`<article class="playbook-card"><span class="eyebrow">PLAYBOOK</span><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p><ol>${x.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></article>`).join('')}
  function renderIdeas(){const filter=$('#ideasGrid'), type=$$('.chip[data-idea-filter]');const all=[...(K.ideas||[]).map((x,i)=>({id:`builtin-${i}`,title:x[0],kind:x[1],desc:x[2],formats:x.slice(3),builtin:true})),...(custom.ideas||[])];const draw=f=>{filter.innerHTML=all.filter(x=>f==='all'||x.kind===f).map(x=>`<article class="idea-card"><div class="card-topline"><span class="tag">${esc(x.kind||'فكرة')}</span>${x.builtin?'':'<span class="tag">إضافتك</span>'}</div><h3>${esc(x.title)}</h3><p>${esc(x.desc||'')}</p>${x.formats?`<div class="take">${x.formats.map(esc).join(' · ')}</div>`:''}${x.builtin?'':`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="ideas" data-id="${esc(x.id)}">تعديل</button><button class="danger-btn" data-delete-custom="ideas" data-id="${esc(x.id)}">حذف الإضافة</button></div>`}</article>`).join('')||empty('لا توجد أفكار.');bindDeleteCustom(filter)};draw('all');type.forEach(b=>b.onclick=()=>{type.forEach(x=>x.classList.remove('active'));b.classList.add('active');draw(b.dataset.ideaFilter)})}
  function renderAnalytics(){const total=(K.knowledge||[]).length;$('#metricCards').innerHTML=[['المعرفة الأساسية',total,'مادة منظمة'],['العملاء',clients.length,'مساحات فعلية'],['المشروعات',projects.length,'حالات حالية'],['الأفكار',((K.ideas||[]).length+(custom.ideas||[]).length),'بنك قابل للتوسع']].map(x=>`<div class="metric"><div class="m-label">${x[0]}</div><div class="m-value">${x[1]}</div><div class="m-note">${x[2]}</div></div>`).join('');const ds=[['وصول مرتفع + متابعة منخفضة','افصل بين قوة الاكتشاف وضعف التحويل إلى متابعة؛ راجع الصفحة والتموضع والدعوة للإجراء.'],['حفظ مرتفع + مشاركة منخفضة','قد يكون المحتوى مرجعيًا أكثر من كونه قابلًا للنقل الاجتماعي.'],['تفاعل جيد + وصول منخفض','اختبر ملاءمة الموضوع والتغليف قبل تغيير الاستراتيجية كلها.'],['منشور واحد قوي جدًا','اعتبره إشارة تستحق التكرار والاختبار، لا قاعدة نهائية.']];$('#diagnosisList').innerHTML=ds.map(d=>`<div class="diagnosis"><b>${d[0]}</b><span>${d[1]}</span></div>`).join('')}

  function renderClients(){
    const q=String($('#clientSearch')?.value||'').trim().toLowerCase();const list=clients.filter(c=>!q||`${c.name} ${c.description}`.toLowerCase().includes(q));$('#clientLibraryCount').textContent=`${list.length} عميل`;
    $('#clientsGrid').innerHTML=list.map(c=>`<article class="client-large"><div class="client-ident"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description||'مساحة العميل')}</p></div></div><div class="client-meta"><span class="meta-pill">${esc(c.status||'نشط')}</span><span class="meta-pill">ملفات قابلة للإدارة</span><span class="meta-pill">تخزين محلي</span></div><p class="client-description">هذه ليست بطاقة تعريف؛ الضغط عليها يفتح مساحة العمل الفعلية للعميل، ومنها تدخل إلى المجلدات والملفات وتضيف أو تعدل أو تحذف.</p><div class="client-large-actions"><button class="primary-btn" data-open-client="${esc(c.id)}">فتح مساحة العميل ←</button><button class="ghost-btn" data-edit-client="${esc(c.id)}">تعديل</button><button class="danger-btn" data-delete-client="${esc(c.id)}">حذف العميل</button></div></article>`).join('')||empty('لا توجد عملاء مطابقة للبحث.');$$('[data-open-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();goClient(b.dataset.openClient)});$$('[data-edit-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();editClient(b.dataset.editClient)});$$('[data-delete-client]',$('#clientsGrid')).forEach(b=>b.onclick=e=>{e.stopPropagation();deleteClient(b.dataset.deleteClient)});
  }
  async function editClient(id){
    const c=clients.find(x=>x.id===id);if(!c)return;
    if(!(await ensureLogin()))return;
    const modal=$('#modal');
    $('#modalContent').innerHTML=`<h2>تعديل العميل</h2><p>عدّل بيانات العميل. تغيير الاسم يعيد تنظيم مساحته المحلية مع الحفاظ على الملفات.</p><form id="editClientForm"><div class="form-grid"><div class="field"><label>اسم العميل</label><input name="name" value="${esc(c.name)}" required></div><div class="field"><label>الاختصار</label><input name="code" maxlength="8" value="${esc(c.code||'')}"></div><div class="field"><label>الحالة</label><input name="status" value="${esc(c.status||'نشط')}"></div><div class="field full"><label>الوصف</label><textarea name="description" required>${esc(c.description||'')}</textarea></div></div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ التعديلات</button><button class="ghost-btn" type="button" id="cancelEditClient">إلغاء</button></div></form>`;
    modal.classList.add('show');$('#cancelEditClient').onclick=()=>modal.classList.remove('show');
    $('#editClientForm').onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target);const name=String(fd.get('name')||'').trim();
      if(!name||/[\\/]/.test(name))return toast('اسم العميل غير صالح.');
      try{
        const oldPath=c.path,newPath=`clients/${name}`;
        if(newPath!==oldPath){
          const all=await localAll(c.id);
          for(const x of all){
            await localPut({...x});
          }
          c.path=newPath;
        }
        c.name=name;c.code=String(fd.get('code')||name.slice(0,2)).trim();c.status=String(fd.get('status')||'نشط').trim()||'نشط';c.description=String(fd.get('description')||'').trim();
        clients=clients.map(x=>x.id===id?c:x);localSave();
        modal.classList.remove('show');renderClients();toast('تم تعديل بيانات العميل بنجاح.');
      }catch(err){toast(`تعذر تعديل العميل: ${err.message}`)}
    };
  }
  async function deleteClient(id){
    const c=clients.find(x=>x.id===id);if(!c||c.baseline)return;
    if(!confirm(`سيتم حذف «${c.name}» وجميع ملفاته المحلية. هل أنت متأكد؟`))return;
    try{
      const all=await localAll(id);for(const x of all)await localRemove(x.key);
      clients=clients.filter(x=>x.id!==id);projects=projects.filter(p=>p.clientId!==id);custom.projects=(custom.projects||[]).filter(p=>p.clientId!==id);
      localSave();renderClients();toast('تم حذف مساحة العميل وملفاتها المحلية.');
    }catch(e){toast(`تعذر حذف العميل: ${e.message}`)}
  }

  function renderProjects(){const all=projects.map(p=>{const c=clients.find(x=>x.id===p.clientId);return {...p,clientName:c?.name||'عام'}});$('#projectsGrid').innerHTML=all.map(p=>`<article class="project-card"><div class="card-topline"><span class="tag level-tag">${esc(p.status||'نشط')}</span><span class="tag">${esc(p.clientName)}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><div class="take">${esc(p.startDate||'—')} → ${esc(p.endDate||'—')}</div>${p.baseline?'':`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="projects" data-id="${esc(p.id)}">تعديل</button><button class="danger-btn" data-delete-custom="projects" data-id="${esc(p.id)}">حذف الإضافة</button></div>`}</article>`).join('')||empty('لا توجد مشروعات.');bindDeleteCustom($('#projectsGrid'))}
  function renderDictionary(){const list=K.terms||[];$('#termGrid').innerHTML=list.map(x=>`<article class="term-card"><div class="term-en">${esc(x[0])}</div><div class="term-pron">النطق: ${esc(x[1])}</div><div class="term-meaning"><b>${esc(x[2])}</b><br>${esc(x[3])}</div></article>`).join('')}
  function renderSources(){$('#sourceGrid').innerHTML=[...(K.sources||[]),...(custom.sources||[]).map(x=>[x.title,x.kind||'إضافة',x.content,x.url,x.id])].map(x=>`<article class="source-card"><div class="card-topline"><span class="tag">${esc(x[1]||'مصدر')}</span>${x[4]?'':'<span class="tag">أساسي</span>'}</div><h3>${esc(x[0])}</h3><p>${esc(x[2]||'')}</p>${x[3]?`<div style="margin-top:9px"><a href="${esc(x[3])}" target="_blank" rel="noopener">فتح المصدر ↗</a></div>`:''}${x[4]?`<div class="viewer-actions"><button class="ghost-btn" data-edit-custom="sources" data-id="${esc(x[4])}">تعديل</button><button class="danger-btn" data-delete-custom="sources" data-id="${esc(x[4])}">حذف الإضافة</button></div>`:''}</article>`).join('')||empty('لا توجد مصادر.') ;bindDeleteCustom($('#sourceGrid'))}
  function renderStandards(){$('#standardsGrid').innerHTML=(K.standards||[]).map(x=>`<article class="standard-card"><span class="eyebrow">STANDARD</span><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p></article>`).join('')}

  async function getFolderEntries(clientId,path=''){
    const clean=String(path||'').replace(/^\/+|\/+$/g,'');
    const key=`${clientId}::${clean}`;
    if(folderCache.has(key))return folderCache.get(key);
    const c=clients.find(x=>x.id===clientId),set=new Map();
    if(c?.name==='ريتاج علي'){
      const tree=await loadStaticTree(),base=tree.map(p=>p.replace(/\/$/,'')).filter(Boolean),prefix=clean?clean+'/':'';
      for(const p of base){
        const n=p.startsWith(prefix)?p.slice(prefix.length):null;if(!n)continue;
        const parts=n.split('/'),name=parts[0],childPath=prefix+name;
        if(parts.length===1)set.set(name,{name,type:p.endsWith('/')?'folder':'file',path:childPath,size:0,source:'static'});
        else set.set(name,{name,type:'folder',path:childPath,size:0,source:'static'});
      }
    }
    try{
      const locals=await localList(clientId,clean);
      for(const x of locals)set.set(x.name,{name:x.name,type:x.type,path:x.path,size:x.size||0,source:'local',key:x.key,mime:x.mime});
    }catch(e){console.warn('Local storage read:',e)}
    const out=[...set.values()].sort((a,b)=>{
      if(a.type!==b.type)return a.type==='folder'?-1:1;
      if(folderSort==='name')return a.name.localeCompare(b.name,'ar',{numeric:true,sensitivity:'base'});
      return folderSortKey(a.name)-folderSortKey(b.name)||a.name.localeCompare(b.name,'ar',{numeric:true,sensitivity:'base'});
    });
    folderCache.set(key,out);return out;
  }
  const STATIC_TREE=["00 - مركز المشروع - Project Hub/","01 - الاستراتيجية - Strategy/","02 - البحث والرؤى - Research & Insights/","03 - المحتوى - Content/","04 - الإنتاج - Production/","04 - الإنتاج - Production/01 - قيد العمل/","04 - الإنتاج - Production/02 - للمراجعة/","04 - الإنتاج - Production/03 - معتمد/","04 - الإنتاج - Production/04 - نهائي/","05 - الأصول والمواد - Assets/","05 - الأصول والمواد - Assets/01 - صور/","05 - الأصول والمواد - Assets/02 - أغلفة الكتب/","05 - الأصول والمواد - Assets/03 - فيديوهات/","05 - الأصول والمواد - Assets/04 - ملفات التصميم الأصلية/","05 - الأصول والمواد - Assets/05 - مواد مرجعية/","06 - النشر - Publishing/","07 - التحليلات والتقارير - Analytics & Reporting/","07 - التحليلات والتقارير - Analytics & Reporting/التقارير/","08 - الإدارة والتواصل - Client Management/","09 - المقالات - Articles/","09 - المقالات - Articles/المقال 01/","09 - المقالات - Articles/المقال 02/","09 - المقالات - Articles/المقال 03/","10 - التجارب والتحسين - Experiments & Optimization/","11 - دراسة الحالة - Case Study/","11 - دراسة الحالة - Case Study/01 - نقطة البداية/","11 - دراسة الحالة - Case Study/02 - الاستراتيجية/","11 - دراسة الحالة - Case Study/03 - التنفيذ/","11 - دراسة الحالة - Case Study/04 - النتائج/","11 - دراسة الحالة - Case Study/05 - الأدلة/","11 - دراسة الحالة - Case Study/05 - الأدلة/التقارير/","11 - دراسة الحالة - Case Study/05 - الأدلة/لقطات الشاشة/","99- الأرشيف - Archive/"];
  let staticTreeCache=STATIC_TREE;
  async function loadStaticTree(){return staticTreeCache}
  async function renderClient(id){
    const c=clients.find(x=>x.id===id);if(!c){go('clients');return}
    if(c.name==='ريتاج علي'&&!staticTreeCache) await loadStaticTree();
    const entries=await getFolderEntries(id,currentPath);
    const folders=entries.filter(x=>x.type==='folder').length, files=entries.filter(x=>x.type==='file').length;
    const breadcrumbs=currentPath?currentPath.split('/'):[];
    const crumbHtml=[`<button class="crumb-btn" data-client-root="${esc(id)}">الجذر</button>`].concat(breadcrumbs.map((seg,i)=>`<span class="crumb-sep">/</span><button class="crumb-btn" data-client-path="${esc(breadcrumbs.slice(0,i+1).join('/'))}">${esc(seg)}</button>`)).join('');
    const project=projects.find(p=>p.clientId===id);
    const baselinePath=(p)=>c.name==='ريتاج علي'&&staticTreeCache?.some(x=>String(x).replace(/\/$/,'')===String(p).replace(/\/$/,''));
    $('#clientPage').innerHTML=`<div class="client-header"><div><div class="client-breadcrumb"><button type="button" id="backClients">← مكتبة العملاء</button><span>/</span><span>${esc(c.name)}</span></div><div class="client-title"><div class="avatar">${esc((c.code||c.name[0]||'C').slice(0,2))}</div><div><h1>${esc(c.name)}</h1><p>${esc(c.description||'مساحة العميل')} ${project?`· ${esc(project.name)}`:''}</p></div></div></div><div class="client-tools"><button class="ghost-btn" id="refreshClient">↻ تحديث</button><button class="primary-btn" data-add="client-file" data-client="${esc(id)}" data-parent="${esc(currentPath)}">＋ ملف</button><button class="ghost-btn" data-add="client-folder" data-client="${esc(id)}" data-parent="${esc(currentPath)}">＋ مجلد</button></div></div><div class="client-statbar"><div class="client-stat"><b>${folders}</b><span>مجلدات هنا</span></div><div class="client-stat"><b>${files}</b><span>ملفات هنا</span></div><div class="client-stat"><b>محلي</b><span>مصدر البيانات</span></div><div class="client-stat"><b>${project?'1':'0'}</b><span>مشروع نشط</span></div></div><div class="save-state"><span>${false?'<span class="good">● الحفظ المحلي المباشر فعّال.</span>':'● الوضع المحلي: التغييرات محفوظة على هذا الكمبيوتر فقط.'}</span><span>حفظ محلي مباشر</span></div><div class="folder-toolbar"><div class="breadcrumbs">${crumbHtml}</div><div class="folder-controls"><span class="muted-count">${currentPath||'الجذر'}</span><button type="button" class="sort-btn" id="folderSort" title="تغيير ترتيب المجلدات">↕ ترتيب: ${folderSort==='number'?'رقمي':'حسب الاسم'}</button></div></div><div class="file-grid" id="fileGrid">${entries.map(e=>{const isBaseline=baselinePath(e.path);const canEdit=!isBaseline;const canDelete=!isBaseline;return `<article class="file-card ${e.type==='folder'?'folder':''}" data-entry-path="${esc(e.path)}" data-entry-type="${e.type}" tabindex="0" role="${e.type==='folder'?'button':'link'}" aria-label="${esc(e.type==='folder'?'فتح المجلد '+e.name:'معاينة '+e.name)}"><div class="card-tools">${canEdit?`<button class="edit-x" data-rename-path="${esc(e.path)}" data-rename-type="${e.type}" title="إعادة تسمية" aria-label="إعادة تسمية ${esc(e.name)}">✎</button>`:''}<button class="remove-x ${canDelete?'':'protected'}" data-delete-path="${esc(e.path)}" data-protected="${isBaseline?'1':'0'}" title="${canDelete?'حذف':'عنصر أساسي — لا يمكن حذفه'}" aria-label="${canDelete?'حذف '+esc(e.name):'العنصر الأساسي '+esc(e.name)}">×</button></div><span class="kind">${e.type==='folder'?'مجلد':esc(fileType(e.name))}</span><div class="big-icon">${fileIcon(fileType(e.name),e.type==='folder')}</div><div><h3 title="${esc(e.name)}">${esc(e.name)}</h3><p>${e.type==='folder'?'فتح المجلد':'اضغط للمعاينة'}</p></div></article>`}).join('')||`<div class="client-empty"><div><div class="big-icon" style="margin:auto">${fileIcon('نص')}</div><strong>هذا المجلد فارغ</strong><p>أضف ملفًا أو أنشئ مجلدًا جديدًا من الأزرار أعلاه.</p></div></div>`}</div><div id="fileViewer" class="file-viewer" hidden></div>`;
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
  async function itemBlob(item){
    if(!item)return null;
    if(item.data instanceof ArrayBuffer)return new Blob([item.data],{type:item.mime||mimeFor(item.name||'file')});
    if(ArrayBuffer.isView(item.data))return new Blob([item.data],{type:item.mime||mimeFor(item.name||'file')});
    if(item.blob instanceof Blob)return item.blob;
    if(item.base64)return base64ToBlob(item.base64,item.mime||mimeFor(item.name||'file'));
    return null;
  }
  async function downloadLocalItem(item){
    const blob=await itemBlob(item);
    if(!blob||blob.size===0)throw new Error('الملف المخزن فارغ أو تالف. أعد رفعه من المصدر الأصلي.');
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=item.name||'download';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),15000);
  }
  async function openLocalItem(item){
    const blob=await itemBlob(item);
    if(!blob||blob.size===0)throw new Error('الملف المخزن فارغ أو تالف. أعد رفعه من المصدر الأصلي.');
    const url=URL.createObjectURL(blob);
    const win=window.open(url,'_blank','noopener');
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    if(!win)throw new Error('المتصفح منع فتح التبويب الجديد. اسمح بالنوافذ المنبثقة لهذا التطبيق.');
  }

  async function renderSelectedFile(clientId,path){
    const viewer=$('#fileViewer');if(!viewer)return;
    const name=path.split('/').pop(),kind=fileType(name),ext=(name.split('.').pop()||'').toLowerCase();
    const textable=['txt','md','csv','json','html','css','js','ts','xml','yaml','yml'].includes(ext);
    const closeViewer=()=>{selectedFile=null;viewer.hidden=true;viewer.innerHTML='';if(window.__centralPreviewUrl){URL.revokeObjectURL(window.__centralPreviewUrl);window.__centralPreviewUrl=''}};
    let blob=null,meta=null,source='';
    try{
      meta=await localGet(localKey(clientId,path));
      blob=await itemBlob(meta);
      source='محلي';
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
      const downloadLabel=textable?'تحميل الملف':'تحميل / تنزيل الملف';
      viewer.hidden=false;
      viewer.innerHTML=`<div class="viewer-head"><div><h2>${esc(name)}</h2><p>${esc(path)}</p></div><div class="viewer-head-actions"><span class="tag">${esc(source)} · ${esc(kind)}</span><button type="button" class="viewer-close" id="closeViewer" title="إغلاق المعاينة" aria-label="إغلاق المعاينة">×</button></div></div><div class="viewer-body">${body}<div class="viewer-actions">${editable?'<button class="primary-btn" id="saveFileBtn">حفظ التعديلات</button>':''}<button class="primary-btn" id="downloadFileBtn"><span class="btn-icon">${iconSvg('download')}</span> تحميل الملف</button><button class="ghost-btn" id="openFileBtn"><span class="btn-icon">${iconSvg('external')}</span> فتح في قارئ خارجي</button><button class="danger-btn" id="deleteFileBtn"><span class="btn-icon">${iconSvg('trash')}</span> حذف الملف</button></div><div class="path-line">${esc(path)}</div></div>`;
      $('#closeViewer').onclick=closeViewer;
      $('#downloadFileBtn').onclick=async()=>{try{await downloadLocalItem(meta);toast('بدأ تنزيل الملف.')}catch(err){toast(`تعذر التنزيل: ${err.message}`)}};
      $('#openFileBtn').onclick=async()=>{try{await openLocalItem(meta)}catch(err){toast(`تعذر فتح الملف خارجيًا: ${err.message}`)}};
      if(editable)$('#saveFileBtn').onclick=()=>saveLocalTextFile(clientId,path,meta);
      $('#deleteFileBtn').onclick=async()=>{closeViewer();await deleteClientPath(clientId,path)};
      if(['docx','doc'].includes(ext)){
        $('#docxPreview').innerHTML='<div class="preview-error">معاينة Word غير مدمجة لتقليل الاعتماديات. استخدم زر «تحميل / تنزيل الملف» لفتح الملف في Word أو التطبيق المناسب على جهازك.</div>';
      }
      viewer.scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){
      viewer.hidden=false;viewer.innerHTML=`<div class="viewer-head"><div><h2>${esc(name)}</h2><p>${esc(path)}</p></div><button type="button" class="viewer-close" id="closeViewer" aria-label="إغلاق المعاينة">×</button></div><div class="viewer-body"><div class="preview-error">تعذر تحميل المعاينة: ${esc(e.message||'خطأ غير معروف')}</div><div class="viewer-actions"><button class="ghost-btn" id="retryPreview">إعادة المحاولة</button></div></div>`;$('#closeViewer').onclick=closeViewer;$('#retryPreview').onclick=()=>renderSelectedFile(clientId,path);
    }
  }
  async function renameClientPath(clientId,path,type){
    if(!(await ensureLogin()))return;
    const oldName=path.split('/').pop(),next=prompt(`اكتب الاسم الجديد لـ «${oldName}»`,oldName);
    if(next===null)return;
    const newName=String(next).trim();
    if(!newName||newName===oldName||/[\\/]/.test(newName)){if(newName&&/[\\/]/.test(newName))toast('الاسم غير صالح.');return}
    if(newName.startsWith('.')){toast('لا تستخدم اسمًا يبدأ بنقطة.');return}
    const parent=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'',newPath=parent?`${parent}/${newName}`:newName;
    try{
      const all=await localAll(clientId),targets=all.filter(x=>x.path===path||x.path.startsWith(path+'/'));
      if(!targets.length)throw new Error('العنصر غير موجود محليًا.');
      if(await localGet(localKey(clientId,newPath)))throw new Error('يوجد عنصر بهذا الاسم بالفعل.');
      for(const x of targets){const suffix=x.path===path?'':x.path.slice(path.length+1),np=suffix?`${newPath}/${suffix}`:newPath;await localPut({...x,key:localKey(clientId,np),path:np,parent:np.includes('/')?np.slice(0,np.lastIndexOf('/')):''});if(x.key!==localKey(clientId,np))await localRemove(x.key)}
      folderCache.clear();await renderClient(clientId);toast('تمت إعادة التسمية بنجاح.');
    }catch(e){toast(`تعذر تغيير الاسم: ${e.message}`)}
  }
  async function saveLocalTextFile(clientId,path,item){
    if(!(await ensureLogin()))return;
    try{const value=$('#fileEditor').value;const blob=new Blob([value],{type:item.mime||mimeFor(path)});const data=await blob.arrayBuffer();await localPut({...item,data,size:blob.size,blob:undefined,updatedAt:new Date().toISOString()});folderCache.clear();toast('تم حفظ الملف محليًا.')}catch(e){toast(`تعذر الحفظ: ${e.message}`)}
  }
  async function deleteClientPath(clientId,path){
    if(!(await ensureLogin()))return;
    if(!confirm(`سيتم حذف «${path.split('/').pop()}». هل تريد المتابعة؟`))return;
    try{
      const item=await localGet(localKey(clientId,path));
      if(item?.type==='folder'){
        const all=await localAll(clientId);
        for(const x of all.filter(x=>x.path===path||x.path.startsWith(path+'/')))await localRemove(x.key);
      }else if(item)await localRemove(localKey(clientId,path));
      folderCache.clear();selectedFile=null;await renderClient(clientId);toast(false?'تم الحذف.':'تم الحذف محليًا.');
    }catch(e){toast(`تعذر الحذف: ${e.message}`)}
  }

  function addChoice(){return `<h2>إضافة إلى المركز</h2><p>كل إضافة قابلة للتعديل أو الحذف لاحقًا، وتحفظ محليًا على هذا الكمبيوتر.</p><div class="add-choice-grid"><button class="add-choice" data-choice="client"><b>عميل</b><span>مساحة جديدة داخل مكتبة العملاء.</span></button><button class="add-choice" data-choice="project"><b>مشروع</b><span>مشروع جديد وربطه بعميل.</span></button><button class="add-choice" data-choice="knowledge"><b>معرفة</b><span>مادة جديدة لقاعدة المعرفة.</span></button><button class="add-choice" data-choice="idea"><b>فكرة</b><span>فكرة جديدة لمختبر الأفكار.</span></button><button class="add-choice" data-choice="source"><b>مصدر</b><span>مرجع جديد.</span></button><button class="add-choice" data-choice="entry"><b>سجل</b><span>ملاحظة أو قرار أو مهمة.</span></button></div>`}
  function addForm(type,extra={}){
    const file=type==='client-file',folder=type==='client-folder',client=type==='client',project=type==='project',source=type==='source';const title={client:'إضافة عميل',project:'إضافة مشروع',knowledge:'إضافة مادة معرفية',idea:'إضافة فكرة',source:'إضافة مصدر',entry:'إضافة سجل','client-file':'إضافة ملف إلى مساحة العميل','client-folder':'إضافة مجلد'}[type]||'إضافة';
    if(file)return `<h2>${title}</h2><p>يمكنك إنشاء TXT/MD مباشرة أو رفع DOCX/PDF/XLSX وغيرها من الملفات المسموح بها.</p><form id="addForm"><div class="form-grid"><div class="field"><label>اسم الملف</label><input name="name" value="${esc(extra.nameHint||'')}" required placeholder="خطة سبتمبر.txt أو خطة سبتمبر.docx"></div><div class="field"><label>مجلد الأب</label><input name="parent" value="${esc(extra.parent||'')}" placeholder="اتركه فارغًا للجذر"></div><div class="field full upload-box"><label>رفع ملف فعلي</label><input name="upload" type="file" accept=".txt,.md,.docx,.doc,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp,.svg,.mp4,.webm"></div><div class="field full"><label>محتوى نصي (للملفات النصية)</label><textarea name="content" placeholder="يُستخدم إذا لم ترفع ملفًا فعليًا…"></textarea></div></div><div class="modal-actions"><button class="primary-btn" type="submit">إنشاء وحفظ</button><button class="ghost-btn" type="button" id="cancelForm">إلغاء</button></div></form>`;
    if(folder)return `<h2>${title}</h2><p>المجلدات تُحفظ مباشرة داخل التخزين المحلي للتطبيق.</p><form id="addForm"><div class="form-grid"><div class="field"><label>اسم المجلد</label><input name="name" required></div><div class="field"><label>مجلد الأب</label><input name="parent" value="${esc(extra.parent||'')}" placeholder="الجذر"></div></div><div class="modal-actions"><button class="primary-btn" type="submit">إنشاء المجلد</button><button class="ghost-btn" type="button" id="cancelForm">إلغاء</button></div></form>`;
    const clientOptions=clients.map(c=>`<option value="${esc(c.id)}" ${extra.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');return `<h2>${title}</h2><p>${source?'أضف مرجعًا إلى غرفة المصادر.':project?'أضف مشروعًا إلى عميل.':'اكتب المادة ثم احفظها في المركز.'}</p><form id="addForm"><div class="form-grid"><div class="field"><label>${client?'اسم العميل':project?'اسم المشروع':'العنوان'}</label><input name="title" required></div>${client?'<div class="field"><label>اختصار</label><input name="code" maxlength="8" placeholder="RA"></div>':project?`<div class="field"><label>العميل</label><select name="clientId">${clientOptions}</select></div>`:source?'<div class="field"><label>نوع المصدر</label><select name="kind"><option>رسمي</option><option>عربي</option><option>بحثي</option><option>تطبيقي</option></select></div>':'<div class="field"><label>التصنيف</label><input name="type" placeholder="مبدأ / قرار / ملاحظة"></div>'}${project?'<div class="field"><label>البداية</label><input name="startDate" type="date"></div><div class="field"><label>النهاية</label><input name="endDate" type="date"></div>':''}<div class="field full"><label>${client||project?'الوصف':'المحتوى'}</label><textarea name="content" required></textarea></div>${source?'<div class="field full"><label>الرابط</label><input name="url" type="url" placeholder="https://..."></div>':''}${!client&&!project?'<div class="field full"><label>الوسوم</label><input name="tags" placeholder="استراتيجية، محتوى، تحليل"></div>':''}</div><div class="modal-actions"><button class="primary-btn" type="submit">حفظ الإضافة</button><button class="ghost-btn" type="button" id="cancelForm">إلغاء</button></div></form>`;
  }
  async function showAdd(type,extra={}){
    if(type==='global'){
      const modal=$('#modal');$('#modalContent').innerHTML=addChoice();modal.classList.add('show');
      $$('[data-choice]',$('#modalContent')).forEach(b=>b.onclick=()=>{modal.classList.remove('show');showAdd(b.dataset.choice,extra)});return;
    }
    if(!(await ensureLogin()))return;
    const modal=$('#modal');$('#modalContent').innerHTML=addForm(type,extra);modal.classList.add('show');$('#cancelForm').onclick=()=>modal.classList.remove('show');
    $('#addForm').onsubmit=async e=>{
      e.preventDefault();const fd=new FormData(e.target);
      try{
        if(type==='client-file'){
          const name=String(fd.get('name')||'').trim(),parent=String(fd.get('parent')||'').trim().replace(/^\/+|\/+$/g,'');
          if(!name||/[\\/]/.test(name))throw new Error('اسم الملف غير صالح');
          const path=parent?`${parent}/${name}`:name,up=fd.get('upload');
          const blob=up&&up.size?new Blob([await up.arrayBuffer()],{type:up.type||mimeFor(name)}):new Blob([String(fd.get('content')||'')],{type:mimeFor(name)});const data=await blob.arrayBuffer();
          if(blob.size>20*1024*1024)throw new Error('حجم الملف يتجاوز 20MB');
          if(await localGet(localKey(extra.clientId,path)))throw new Error('يوجد ملف بهذا الاسم بالفعل.');
          await localPut({key:localKey(extra.clientId,path),clientId:extra.clientId,name,type:'file',path,parent,size:blob.size,mime:blob.type,data,createdAt:new Date().toISOString()});
          modal.classList.remove('show');folderCache.clear();await renderClient(extra.clientId);toast('تمت إضافة الملف محليًا.');return;
        }
        if(type==='client-folder'){
          const n=String(fd.get('name')||'').trim(),p=String(fd.get('parent')||'').trim().replace(/^\/+|\/+$/g,'');
          if(!n||/[\\/]/.test(n))throw new Error('اسم المجلد غير صالح');
          const folderPath=p?`${p}/${n}`:n;
          if(await localGet(localKey(extra.clientId,folderPath)))throw new Error('يوجد مجلد بهذا الاسم بالفعل.');
          await localPut({key:localKey(extra.clientId,folderPath),clientId:extra.clientId,name:n,type:'folder',path:folderPath,parent:p,size:0,createdAt:new Date().toISOString()});
          modal.classList.remove('show');folderCache.clear();currentPath=folderPath;await renderClient(extra.clientId);toast('تم إنشاء المجلد محليًا.');return;
        }
        if(type==='client'){
          const name=String(fd.get('title')||'').trim(),code=String(fd.get('code')||name.slice(0,2)).trim(),description=String(fd.get('content')||'').trim();
          if(!name)throw new Error('اسم العميل مطلوب');if(/[\\/]/.test(name))throw new Error('اسم العميل لا يمكن أن يحتوي على / أو \\');
          if(clients.some(c=>c.name===name))throw new Error('يوجد عميل بهذا الاسم بالفعل.');
          const id=`client:${uid()}`,meta={id,name,code,status:'نشط',description,path:`clients/${name}`,createdAt:new Date().toISOString().slice(0,10),baseline:false};
          clients=[...clients,meta];localSave();modal.classList.remove('show');renderRoute(currentRoute);goClient(id,'');toast('تمت إضافة العميل ومساحته محليًا.');return;
        }
        const id=`custom-${uid()}`;let item={id,title:String(fd.get('title')||''),content:String(fd.get('content')||''),createdAt:new Date().toISOString()};let kind='entries';
        if(type==='project')item={...item,name:item.title,clientId:fd.get('clientId')||null,status:'نشط',startDate:fd.get('startDate')||'',endDate:fd.get('endDate')||'',description:item.content};
        else if(type==='idea')item={...item,title:item.title,kind:'discovery',desc:item.content,formats:['نص','كاروسيل']};
        else if(type==='knowledge')item={...item,level:1,category:'إضافة',body:item.content,type:fd.get('type')||'مادة',take:''};
        else if(type==='source')item={...item,title:item.title,kind:fd.get('kind')||'عام',content:item.content,url:fd.get('url')||''};
        else item={...item,type:fd.get('type')||'سجل',tags:fd.get('tags')||''};
        if(type==='project')kind='projects';else if(type==='idea')kind='ideas';else if(type==='knowledge')kind='knowledge';else if(type==='source')kind='sources';
        await mutateLocal('mutate_data',{kind,operation:'add',item});modal.classList.remove('show');renderRoute(currentRoute);toast('تم الحفظ محليًا.');
      }catch(err){toast(`تعذر الحفظ: ${err.message}`)}
    };
  }

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
    $('#editCustomForm').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);let next={...item};if(kind==='projects')next={...item,name:String(fd.get('title')||'').trim(),title:String(fd.get('title')||'').trim(),clientId:fd.get('clientId')||null,startDate:fd.get('startDate')||'',endDate:fd.get('endDate')||'',description:String(fd.get('content')||'').trim(),content:String(fd.get('content')||'').trim()};if(kind==='knowledge')next={...item,title:String(fd.get('title')||'').trim(),type:String(fd.get('type')||'مادة').trim(),body:String(fd.get('content')||'').trim(),content:String(fd.get('content')||'').trim()};if(kind==='ideas')next={...item,title:String(fd.get('title')||'').trim(),desc:String(fd.get('content')||'').trim(),formats:String(fd.get('formats')||'').split(/[,،]/).map(x=>x.trim()).filter(Boolean)};if(kind==='sources')next={...item,title:String(fd.get('title')||'').trim(),kind:String(fd.get('kind')||'عام').trim(),content:String(fd.get('content')||'').trim(),url:String(fd.get('url')||'').trim()};if(!next.title&&!next.name)throw new Error('العنوان مطلوب');try{await mutateLocal('mutate_data',{kind,operation:'update',item:next});custom[kind]=(custom[kind]||[]).map(x=>x.id===id?next:x);if(kind==='projects')projects=uniqueById([...baseProjects,...custom.projects]);localSave();modal.classList.remove('show');renderRoute(currentRoute);toast('تم حفظ التعديلات.')}catch(err){toast(`تعذر التعديل: ${err.message}`)}};
  }
  async function bindDeleteCustom(root){$$('[data-edit-custom]',root).forEach(b=>b.onclick=async()=>{await editCustom(b.dataset.editCustom,b.dataset.id)});$$('[data-delete-custom]',root).forEach(b=>b.onclick=async()=>{const kind=b.dataset.deleteCustom,id=b.dataset.id;if(!confirm('حذف هذه الإضافة نهائيًا من المركز؟'))return;try{await mutateLocal('mutate_data',{kind,operation:'delete',item:{id}});custom[kind]=(custom[kind]||[]).filter(x=>x.id!==id);if(kind==='projects')projects=uniqueById([...baseProjects,...custom.projects]);localSave();renderRoute(currentRoute);toast('تم حذف الإضافة.')}catch(e){toast(`تعذر الحذف: ${e.message}`)}})}

  function bindAddButtons(root=document){$$('[data-add]',root).forEach(b=>{if(b.dataset.bound)return;b.dataset.bound='1';b.onclick=e=>{e.stopPropagation();showAdd(b.dataset.add,{clientId:b.dataset.client,parent:b.dataset.parent,projectId:b.dataset.project,nameHint:b.dataset.nameHint})}})}
  function renderRoute(route){if(route==='home')renderHome();if(route==='knowledge')renderKnowledge();if(route==='playbook')renderPlaybook();if(route==='ideas')renderIdeas();if(route==='analytics')renderAnalytics();if(route==='clients')renderClients();if(route==='projects')renderProjects();if(route==='dictionary')renderDictionary();if(route==='sources')renderSources();if(route==='standards')renderStandards();bindAddButtons()}

  function allSearchItems(){const items=[];(K.knowledge||[]).forEach(x=>items.push({kind:'معرفة',title:x.title,desc:x.body,route:'knowledge'}));(K.ideas||[]).forEach(x=>items.push({kind:'فكرة',title:x[0],desc:x[2],route:'ideas'}));(K.terms||[]).forEach(x=>items.push({kind:'مصطلح',title:x[0],desc:`${x[2]} — ${x[3]}`,route:'dictionary'}));(K.sources||[]).forEach(x=>items.push({kind:'مصدر',title:x[0],desc:x[2],route:'sources'}));clients.forEach(c=>items.push({kind:'عميل',title:c.name,desc:c.description,action:()=>goClient(c.id)}));projects.forEach(p=>items.push({kind:'مشروع',title:p.name,desc:p.description,route:'projects'}));(custom.knowledge||[]).forEach(x=>items.push({kind:'إضافة معرفة',title:x.title,desc:x.body,route:'knowledge'}));(custom.ideas||[]).forEach(x=>items.push({kind:'إضافة فكرة',title:x.title,desc:x.desc,route:'ideas'}));(custom.sources||[]).forEach(x=>items.push({kind:'إضافة مصدر',title:x.title,desc:x.content,route:'sources'}));return items}
  function initSearch(){const input=$('#searchInput'),res=$('#searchResults');const draw=()=>{const q=input.value.trim().toLowerCase();if(!q){res.classList.remove('show');res.innerHTML='';return}const hits=allSearchItems().filter(x=>`${x.title} ${x.desc||''} ${x.kind}`.toLowerCase().includes(q)).slice(0,30);res.innerHTML=hits.map((x,i)=>`<div class="search-item" data-search-index="${i}"><div class="si-icon">${esc(x.kind.slice(0,1))}</div><div><h4>${esc(x.title)}</h4><p>${esc(x.kind)} — ${esc(String(x.desc||'').slice(0,135))}</p></div></div>`).join('')||`<div class="search-item"><div><h4>لا توجد نتيجة</h4><p>جرّب مصطلحًا مختلفًا.</p></div></div>`;res.classList.add('show');$$('[data-search-index]',res).forEach((el,i)=>{el.onclick=()=>{const x=hits[i];res.classList.remove('show');input.value='';x.action?x.action():x.route&&go(x.route)}})};input.oninput=draw;input.onfocus=draw;$('#clearSearch').onclick=()=>{input.value='';res.classList.remove('show');input.focus()};document.addEventListener('click',e=>{if(!$('#searchWrap').contains(e.target))res.classList.remove('show')});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus()}})}
  function bindGoButtons(root=document){$$('[data-go]',root).forEach(b=>{if(b.dataset.goBound)return;b.dataset.goBound='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const route=b.dataset.go;if(route)go(route)})})}
  function initTheme(){document.documentElement.classList.remove('dark');localStorage.removeItem('central-theme')}
  function boot(){const b=$('#boot'),status=$('#boot-status'),f=$('#fingerprint');const open=async()=>{b.classList.add('scanning');status.textContent='جارٍ فتح المساحة…';await new Promise(r=>setTimeout(r,260));status.textContent='تم التحقق';b.classList.add('hide')};f.onclick=open;f.onpointerdown=e=>f.setPointerCapture?.(e.pointerId);f.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')open()};setTimeout(()=>{status.textContent='المساحة جاهزة — المس البصمة';},900)}

  $('#mobileMenu').onclick=()=>$('#sidebar').classList.add('open');$('#closeSide').onclick=()=>$('#sidebar').classList.remove('open');$('#addGlobal').onclick=()=>showAdd('global');$('#sideAdd').onclick=()=>showAdd('global');$('#modalClose').onclick=()=>$('#modal').classList.remove('show');$('.modal-backdrop')?.addEventListener('click',()=>$('#modal').classList.remove('show'));
  $('#clientSearch')?.addEventListener('input',renderClients);
  window.addEventListener('hashchange',()=>{const h=decodeURIComponent(location.hash.slice(1)||'home');if(h.startsWith('client/')){const pieces=h.split('/');const id=pieces[1];const path=pieces.slice(2).filter(Boolean).join('/');goClient(id,path)}else go(h)});  // Local-only state.
  const l=loadLocalState();
  if(l.custom)custom={...custom,...l.custom};
  if(l.clients?.length)clients=l.clients;
  if(l.projects?.length)projects=uniqueById([...baseProjects,...l.projects.filter(x=>!x.baseline)]);
  initSearch();initTheme();paintIcons();bindGoButtons();boot();setLocalStatus('محلي');
  const initialHash=decodeURIComponent(location.hash.slice(1)||'home');
  if(initialHash.startsWith('client/')){const pieces=initialHash.split('/');goClient(pieces[1],pieces.slice(2).filter(Boolean).join('/'))}else go(initialHash);
  bindAddButtons();
  refreshLocal();
})();
