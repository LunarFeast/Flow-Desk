/* ================= 文件加载后的处理 ================= */
const fileHandlers={
  schema:(text)=>{
    store.schemaText=text;
    const nm=text.match(/^\s*name:\s*["']?([^"'\r\n]+)/m);
    if(nm){store.schemeName=nm[1].trim();updateSchemeName();}
    const sid=text.match(/schema_id:\s*([^\r\n]+)/);
    if(sid)store.schemaId=sid[1].trim();
    checkSchemeConsistency();
    /* 个性化开关、部署期参数、顶屏规则一律以 build/（__include/__patch 合并后）为准 */
    store.buildText=findBuildSchema(store.schemaId)||'';
    applySchemeSpec(store.buildText||text);
    if(!store._booting)applyPracticeDefaults();   /* 用户选择方案文件 = 新方案首次进入，回到默认练习态 */
    store.poppingRules=parsePopping(store.buildText||text);
    renderCandidate();
    if(store.rimeFiles.size&&!store._booting)retrace();   /* 已选过 Rime 文件夹：换方案自动重追溯 */
  },
  dict:(text)=>{
    const dn=text.match(/name:\s*["']?([^"'\r\n]+)/);
    if(dn)store.dictName=dn[1].trim();
    parseDictYaml(text);checkSchemeConsistency();nextWord();
  },
  xmLens:(text)=>{parseTwoCol(text,store.xmLens,v=>+v);renderCandidate();},
  xmChars:(text)=>{parseTwoCol(text,store.xmChars);},
  cf:(text)=>{parseCf(text);if(store.targetWord)showTarget(store.targetWord);},
  strokes:(text)=>{parseTwoCol(text,store.strokes);},
  strokeMap:(text)=>{parseStrokeMap(text);},
  sbxlm:(text)=>{parseSbxlm(text);renderCandidate();},
  textPractice:(text)=>{
    store.textPracticeContent=[...text.replace(/\s+/g,'')];
    initTextEngine(text);
  }
};
document.querySelectorAll('.file-card').forEach(card=>bindFileCard(card,fileHandlers[card.dataset.key]));

/* ========== 第一次启动的加载提示（第 14 条）==========
   头一次没有缓存：一百多个小文件挨个读盘，再把 20MB 级的拓展词库整份解析一遍，
   主线程一冻就是几秒，画面白着，看着跟没起来一样。
   这里在最外面盖一张与页面同底的，写清楚此刻在做什么、做到第几件。
   三条讲究：
   · 干活满 400 毫秒才露脸 —— 一眨眼就完的那种不该闪一下白屏。
   · 大文件解析是同步的，中间不让出一帧就一个字也画不出来，所以 loadStep 里等两帧再干活。
   · 只在"画面还没摆出来"这段里盖（init 期间 store._booting 为真），或他点了"恢复上次 Rime
     目录"那种自己等的场合（loadAllow）。开机第二拍灌词典是后台补货，画面都已经出来了，
     再拿一张板子盖住就成了添乱。 */
const LOAD={t0:0,msg:'',el:null,allow:false};
function loadPaint(){ if(LOAD.el) LOAD.el.textContent=LOAD.msg; }
function loadAllow(){ LOAD.allow=true; }
function loadCheck(){
  if(LOAD.el||!(store._booting||LOAD.allow))return;
  if(Date.now()-LOAD.t0<=400)return;
  LOAD.el=document.createElement('div');
  LOAD.shown=(LOAD.shown||0)+1;   /* 这一整开机亮过几回：探针据此判断"命中缓存不该亮板子" */
  LOAD.el.setAttribute('style','position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;'+
    'background:var(--page-bg);color:var(--text-light);font-size:calc(1.15em * var(--vsc,1))');
  loadPaint();
  document.body.appendChild(LOAD.el);
}
function loadSay(msg){
  if(!LOAD.t0)LOAD.t0=Date.now();
  LOAD.msg=msg;
  loadPaint();loadCheck();
}
/* 让出一帧给浏览器画：窗口被最小化时 requestAnimationFrame 会不响，
   所以拿 60 毫秒的闹钟一起等，谁先到算谁的，加载绝不能卡在这儿。 */
function nextFrame(){
  return new Promise(r=>{
    let done=false;
    const go=()=>{ if(done)return; done=true; clearTimeout(timer); r(); };
    const timer=setTimeout(go,60);
    requestAnimationFrame(go);
  });
}
async function loadStep(msg){
  loadSay(msg);
  await nextFrame();
  await nextFrame();
  loadCheck();
}
function loadDone(){ LOAD.t0=0;LOAD.msg='';LOAD.allow=false;if(LOAD.el){LOAD.el.remove();LOAD.el=null;} }

/* ========== Rime 用户文件夹加载 + 词库自动追溯 ==========
   全程本地读取：>3MB 的大词库不预读文本，只登记文件名，按需再读，避免卡顿。 */
store.luaFiles=new Map();store.largeFiles=[];
const LARGE_LIMIT=3*1048576;
const rimeFolderInput=document.getElementById('rimeFolderInput');
/* 按文件名把 lua/规则/数据表路由到对应解析器 */
function routeLuaFile(name,text){
  name=name.trim();
  if(/auto_length/i.test(name))return parseStrokeMap(text);
  if(/xm_lens/i.test(name))return parseTwoCol(text,store.xmLens,v=>+v);
  if(/char_lens/i.test(name)){parseTwoCol(text,store.charLens,v=>+v);renderCandidate();return;}
  if(/xm_chars/i.test(name))return parseTwoCol(text,store.xmChars);
  if(/sbxmcf/i.test(name))return parseCf(text);
  if(/(^|\/)radicals\.txt$/i.test(name))return parseTwoCol(text,store.radicals);
  if(/^strokes/i.test(name))return parseTwoCol(text,store.strokes);
  if(/sbxlm\.(yaml|yml)$/i.test(name))return parseSbxlm(text);
}
async function readDirRecursive(dir,base,out){
  for await(const [name,handle] of dir.entries()){
    const rel=base?base+'/'+name:name;
    if(handle.kind==='directory'){await readDirRecursive(handle,rel,out);}
    else if(/\.(lua|txt|yaml|yml)$/i.test(name)){
      loadSay('正在读 Rime 文件夹 · 第 '+(out.length+store.largeFiles.length+1)+' 个文件：'+name);
      const file=await handle.getFile();
      if(file.size>LARGE_LIMIT)store.largeFiles.push({path:rel,name});
      else out.push({path:rel,name:name,text:await readFileAsText(file)});
    }
  }
}
/* ========== 开机文件缓存（第 13 条）==========
   指过一次 Rime 目录之后，开机不再从头读盘：整棵树只做 stat，拿 路径→[大小,改期]
   和上次存的清单比，一样的文件直接用 IndexedDB 里那份文本，变了或新增加的才真读；
   清单一模一样就是一个字节都不读盘。
   代价：手改了文件但大小和修改时间都没变（罕见）这里看不出来，点一次「一键重载」绕开缓存。
   词典那一步（traceFromSchema + 拓展词库）最重，从开机这一拍里挪出去，画面出来之后再灌。 */
const RIME_EXT=['.lua','.txt','.yaml','.yml'],FP_KEY='rimeFp';
function winPath(root,rel){ return root.replace(/[\\/]+$/,'')+'\\'+rel.split('/').join('\\'); }
function fpMapOf(list){ const m={}; for(const e of list)m[e.path]=[e.size,e.mtime]; return m; }
function fpSame(a,b){
  if(!a||!b)return false;
  const ka=Object.keys(a); if(ka.length!==Object.keys(b).length)return false;
  for(const k of ka){ const x=a[k],y=b[k]; if(!y||x[0]!==y[0]||x[1]!==y[1])return false; }
  return true;
}
function isLuaish(p){ return /(^|\/)lua\//.test(p)||/\.lua$/i.test(p)||/sbxlm\.(yaml|yml)$/i.test(p); }
/* 把 store.rimeFiles 这一堆文本重新摊回各个解析器（lua、数据表、规则） */
function routeRimeTexts(){
  store.luaFiles=new Map();
  for(const [p,tx] of store.rimeFiles)if(isLuaish(p)){store.luaFiles.set(p,tx);routeLuaFile(p.split('/').pop(),tx);}
}
/* 目录树 + 缓存文本 → 追溯要的那份 items。force=一键重载那种，全部重读，不吃缓存。 */
async function collectRime(app,root,scanned,snap,fp,force){
  const items=[],large=[],files={};let read=0,hit=0,done=0;
  for(const e of scanned){
    loadSay('正在读 Rime 文件夹 · '+(++done)+'/'+scanned.length+'：'+e.name);
    if(e.size>LARGE_LIMIT){large.push({path:e.path,name:e.name});continue;}   /* 大词库只看登记，文本按需再读，一次都不提前搬 */
    const old=fp&&fp[e.path],snapFiles=snap&&snap.files;
    const useCache=!force&&old&&snapFiles&&typeof snapFiles[e.path]==='string'
      &&old[0]===e.size&&old[1]===e.mtime;
    let text;
    if(useCache){text=snapFiles[e.path];hit++;}
    else{text=await app.readText(winPath(root,e.path));read++;if(text==null)continue;}
    items.push({path:e.path,name:e.name,text});files[e.path]=text;
  }
  return {items,large,files,read,hit};
}
/* 开机第一拍：只吃 IndexedDB 里那份快照，把界面（方案、规则）先摆出来 */
async function bootRimeCache(){
  const app=hostApp(),root=await appRimeDir();
  if(!app||!root||typeof app.dirTree!=='function')return null;
  const snap=await idb.get('rimeFiles'),fp=await idb.get(FP_KEY);
  if(!snap||!snap.files||!fp||!fp.map)return null;
  store.rimeFiles=new Map(Object.entries(snap.files));
  store.rimeFolder=snap.folder||fp.folder||'';store.largeFiles=snap.large||[];
  store.rimeDir=app.openDir(root)||null;store.rimeRoot=root;store.rimeObjs=null;
  routeRimeTexts();
  renderSchemaSelect();
  return {app,root,snap,fp:fp.map};
}
/* 开机第二拍（画面出来之后）：stat 比一遍，有变化只重读变了的那几个，然后灌词典 */
async function syncRimeAndDict(st){
  const scanned=await st.app.dirTree(st.root,RIME_EXT);
  if(!scanned)return 'none';
  const now=fpMapOf(scanned);
  let state='cached';
  /* 大词库那份登记每次都按磁盘重算：缓存里存的是上次「已经读掉剩下几个」，
     直接拿来用会把这一轮该按需读的拓展词库整个漏掉（词典能少掉上百万词条）。 */
  store.largeFiles=scanned.filter(e=>e.size>LARGE_LIMIT).map(e=>({path:e.path,name:e.name}));
  if(!fpSame(st.fp,now)){
    state='refreshed';
    const r=await collectRime(st.app,st.root,scanned,st.snap,st.fp);
    await idb.set('rimeFiles',{folder:st.snap.folder,files:r.files,large:r.large});
    await idb.set(FP_KEY,{folder:st.snap.folder,map:now});
    store.rimeFiles=new Map(Object.entries(r.files));store.largeFiles=r.large;
    routeRimeTexts();renderSchemaSelect();
    /* 磁盘上变了的可能就是方案和编译产物：这一层也重新过一遍。
       _booting 是临时挡 fileHandlers.schema 自己去 retrace 的，词典统一在下面灌。 */
    store._booting=true;
    try{
      const rec=await idb.get('file_schema');
      if(rec)await fileHandlers.schema(rec.text,rec.name);
      else{
        const want=(await idb.get('schemaId'))||defaultSchemaId();
        if(want&&schemaList().some(s=>s.id===want))await pickSchema(want);
      }
    }finally{ store._booting=false; }
  }
  await loadRimeDicts();
  return state;
}
/* 词典这一步：追溯 + 拓展词库 + 建表，全部在这一个函数里，方便放到画面之后 */
async function loadRimeDicts(){
  await loadStep('正在追溯方案词库 · 把方案引到的那几本词典对出来');
  store._traceReport=traceFromSchema();
  await autoLoadExtended();
  renderTrace();
  if(store.dict.size){
    await loadStep('正在整理练习字表 · 共 '+store.dict.size+' 条');
    buildSortedList();
    if(store.practiceMode==='transform'){store.transformList=buildTransformList();showTransform(0);}
    else if(isWordMode())nextWord();
  }
  renderCandidate();
  if(store.targetWord)showTarget(store.targetWord);
  loadDone();
}
/* 大词库按路径取文本：app 版知道全路径，一次读到；句柄方式退回递归找同名文件 */
async function readRimePath(rel,fileName){
  const app=hostApp();
  if(app&&store.rimeRoot&&typeof app.readText==='function'){
    const t=await app.readText(winPath(store.rimeRoot,rel));
    if(t!=null)return t;
  }
  if(store.rimeDir)return await findTextInDir(store.rimeDir,fileName,'');
  if(store.rimeObjs&&store.rimeObjs.has(fileName))return await readFileAsText(store.rimeObjs.get(fileName));
  return '';
}
/* 在已加载文件中按“末尾文件名”查找（可在根目录、build、lua 等任意子目录） */
function findRimeFile(fileName){
  const target=fileName.toLowerCase();
  for(const [p,t] of store.rimeFiles){if(p.split('/').pop().toLowerCase()===target)return {path:p,text:t};}
  return null;
}
/* 取 build/<id>.schema.yaml：__include 与 __patch 已合并，是开关/参数/顶屏规则的权威形态 */
function findBuildSchema(sid){
  if(!sid||!store.rimeFiles)return '';
  const want=new RegExp('(^|/)build/'+sid+'\\.schema\\.yaml$','i');
  for(const [p,t] of store.rimeFiles){if(want.test(p))return t;}
  return '';
}
/* ===== 方案下拉：Rime 文件夹一加载就自动列全，不用再手动选 schema 文件 =====
   只认根目录下的 *.schema.yaml（build/ 里那份是编译产物，不重复列）；
   末尾带 2 的那几个是空/中转用的辅助方案，一律不列。
   选中后交把顶层那份原文丢给 fileHandlers.schema —— 它自己会去找 build/<id> 读合并后的形态。 */
function schemaList(){
  const out=[];
  for(const [p,text] of store.rimeFiles){
    if(p.includes('/'))continue;
    const m=p.match(/^(.+)\.schema\.yaml$/i);
    if(!m||/2$/.test(m[1]))continue;
    const nm=text.match(/^\s*name:\s*["']?([^"'\r\n]+)/m);
    out.push({ id:m[1], name:nm?nm[1].trim():m[1], text });
  }
  return out.sort((a,b)=>a.id<b.id?-1:1);
}
/* default.yaml 的 schema_list 是输入法真正启用的那几个方案，头一个就当开机默认 */
function defaultSchemaId(){
  const t=store.rimeFiles.get('build/default.yaml')||store.rimeFiles.get('default.yaml');
  if(!t)return '';
  const i=t.indexOf('schema_list:');
  if(i<0)return '';
  const m=t.slice(i).match(/schema:\s*\{?\s*([A-Za-z0-9_]+)/);
  return m?m[1]:'';
}
let schemaSel=null;
async function pickSchema(id){
  const it=schemaList().find(x=>x.id===id);
  if(!it)return;
  const fname=it.id+'.schema.yaml';
  await idb.set('file_schema',{name:fname,text:it.text});
  await idb.set('schemaId',it.id);
  const card=document.querySelector('.file-card[data-key=schema]');
  if(card){card.classList.add('loaded');card.querySelector('.file-status').textContent='✅ '+fname;}
  if(schemaSel&&[...schemaSel.options].some(o=>o.value===id))schemaSel.value=id;
  await fileHandlers.schema(it.text,fname);
}
function renderSchemaSelect(){
  const manual=document.querySelector('.file-card[data-key=schema]');
  const list=schemaList();
  if(!list.length){ if(schemaSel)schemaSel.remove(); schemaSel=null; if(manual)manual.style.display=''; return; }
  if(!schemaSel){
    schemaSel=document.createElement('select');
    schemaSel.id='schemaSel';
    const box=document.createElement('div');
    box.className='file-card';box.id='schemaSelCard';
    const head=document.createElement('div');head.className='file-card-head';
    const nm=document.createElement('span');nm.className='file-card-name';nm.textContent='方案';
    head.appendChild(nm);box.appendChild(head);box.appendChild(schemaSel);
    if(manual)manual.parentNode.insertBefore(box,manual);
    schemaSel.addEventListener('change',()=>pickSchema(schemaSel.value));
  }
  schemaSel.innerHTML=list.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'（'+s.id+'）</option>').join('');
  if(manual)manual.style.display='none';
  const cur=store.schemaId||'';
  if(list.some(s=>s.id===cur))schemaSel.value=cur;
  else if(cur)schemaSel.insertAdjacentHTML('afterbegin','<option value="'+esc(cur)+'">'+esc(cur)+'（手动选的文件）</option>'),schemaSel.value=cur;
  else if(!store._booting&&list.length)schemaSel.value=list[0].id;
}
/* 按 yaml 的 reset 初始化开关状态：
   二态（- name:）的 states[0] 表示"关"，故 reset=1 才是开；
   多态（- options:）的 states[i] 对应 options[i]，reset 是选中的下标 */
function initSwitchDefaults(){
  store.opt={};
  for(const g of store.switches){
    const r=(typeof g.reset==='number'&&g.reset>=0)?g.reset:0;
    if(g.binary)store.opt[g.names[0]]=(r===1);
    else g.names.forEach((n,k)=>{store.opt[n]=(k===r);});
  }
}
/* 设定某组开关的第 idx 态 */
function setOptAt(g,idx){
  if(g.binary)store.opt[g.names[0]]=(idx===1);
  else g.names.forEach((n,k)=>{store.opt[n]=(k===idx);});
}
/* 编码变换键绑定：从 build yaml 的 key_binder/bindings 取
   {match, accept, send_sequence} 三类（Tab / Shift+空格 / 撇号 / 分号）。
   含 Shift+方向键（整句选词扩展）的序列练习端无法模拟，直接跳过。 */
const TF_ACCEPTS=['Tab','Shift+space',"'",';'];
function parseTfBindings(text){
  const body=topBlock(text||'','key_binder');
  const lines=(blockOf(body,'bindings',false)||'').split(/\r?\n/);
  const out=[],sel=[],seen=new Set(),seenSel=new Set();
  for(const ln of lines){
    const flow=ln.match(/^\s*-\s*\{(.*)\}\s*$/);
    if(!flow)continue;
    const kv={};
    for(const part of splitFlow(flow[1])){
      const m=part.match(/^\s*(\w+)\s*:\s*(.*)$/);
      if(m)kv[m[1]]=m[2].replace(/^"|"$/g,'').trim();
    }
    if(!kv.match||!kv.send_sequence)continue;
    if(kv.when&&kv.when!=='composing')continue;
    if(/Shift\+/.test(kv.send_sequence))continue;
    const sig=kv.accept+'\t'+kv.match+'\t'+kv.send_sequence;
    if(TF_ACCEPTS.includes(kv.accept)){
      if(seen.has(sig))continue;   /* build yaml 里同一份 bindings 常被 __include 展开两次 */
      seen.add(sig);
      out.push({accept:kv.accept,match:kv.match,seq:kv.send_sequence});
      continue;
    }
    /* 数选键绑定：accept 是单个数字，seq 只有翻页 + 选重（如简拼 1 = {Page_Down}{space}）。
       专项练习里"常规输入"要还原成用户真正按的那一个键，而不是拆成 Tab + 空格。 */
    const sm=kv.send_sequence.match(/^(?:\{Page_Down\})+(?:\{space\}|[0-9])$/);
    if(!sm||/[A-Za-z]/.test(kv.accept)||seenSel.has(sig))continue;
    seenSel.add(sig);
    sel.push({accept:kv.accept,match:kv.match,
      pg:(kv.send_sequence.match(/\{Page_Down\}/g)||[]).length,
      pick:/\{space\}$/.test(kv.send_sequence)?'':kv.send_sequence.slice(-1)});
  }
  return {rules:out,selRules:sel};
}
/* 应用方案规格：开关表 + 部署期参数 + 控件重绘（用户保存过的值随后由 restoreSchemeSettings 覆盖） */
function applySchemeSpec(src){
  store.switches=parseSwitches(src);
  const tf=parseTfBindings(src);
  store.tfRules=tf.rules;store.tfSelectRules=tf.selRules;
  const c=parseSchemeConfig(src)||{};
  store.config.spec=c;
  store.config.enable_filtering=!!c.enable_filtering;
  const fs=c.filter_strength!==null&&c.filter_strength!==undefined?c.filter_strength:4;
  store.config.filter_strength=Math.min(6,Math.max(3,+fs||4));
  if(c.max_code_length)store.config.max_code_length=c.max_code_length;
  initSwitchDefaults();
  if(typeof restoreSchemeSettings==='function')restoreSchemeSettings();
  renderSchemeControls();
}
/* 解析词典 encoder.rules：length_equal: N 或 length_in_range: [a,b]（兼容官方文件里
   length_in_range: 3 这种缺方括号的写法）+ formula:"…" */
function parseEncoderRules(dictText,dictName){
  const rules=[];const enc=dictText.match(/encoder:[\s\S]*?(?:\n\.\.\.|$)/);
  if(enc){
    let cur=null;
    for(const ln of enc[0].split('\n')){
      const eq=ln.match(/length_equal:\s*(\d+)/),
            rg=ln.match(/length_in_range:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/)||ln.match(/length_in_range:\s*(\d+)/);
      const fm=ln.match(/formula:\s*"([^"]+)"/);
      if(eq)cur={lo:+eq[1],hi:+eq[1]};else if(rg)cur=rg[1]!==rg[2]?{lo:+rg[1],hi:+rg[2]}:{lo:+rg[1],hi:+rg[1]};
      if(fm&&cur){rules.push({...cur,formula:fm[1]});cur=null;}
    }
  }
  if(rules.length)store.encoderRules.set(dictName,rules);
  return rules;
}
/* 应用 Rime TableEncoder 公式：大写字母=字位（A=首字…Z=末字，超界归末字），小写=该字第几码 */
function applyEncoderFormula(formula,charFull){
  const n=charFull.length,out=[];let cur=-1;
  for(const ch of formula){
    if(/[A-Z]/.test(ch)){const i=ch.charCodeAt(0)-65;cur=i>=n?n-1:i;}
    else if(/[a-z]/.test(ch)){const i=ch.charCodeAt(0)-97;if(cur>=0&&charFull[cur]&&charFull[cur][i])out.push(charFull[cur][i]);}
  }
  return out.join('');
}
/* 公式逐键展开：记录每个输出键来自哪个字(wi)、哪个码位(ci)，只用于解释 */
function applyFormulaDetailed(formula,charFull){
  const out=[];let cur=-1,curU='';
  for(const ch of formula){
    if(/[A-Z]/.test(ch)){const i=ch.charCodeAt(0)-65;cur=i>=charFull.length?charFull.length-1:i;curU=ch;}
    else if(/[a-z]/.test(ch)){
      const ci=ch.charCodeAt(0)-97;
      if(cur>=0&&charFull[cur]&&charFull[cur][ci])out.push({k:charFull[cur][ci],wi:cur,ci,U:curU,L:String.fromCharCode(97+ci)});
    }
  }
  return out;
}
/* 取某长度区间的 encoder 公式（词典壳为准） */
function encoderFormulaFor(n){
  for(const [dn,rules] of store.encoderRules){
    for(const r of rules)if(n>=r.lo&&n<=r.hi)return {formula:r.formula,dict:dn};
  }
  return null;
}
/* 递归加载一个词典：先递归 import_tables，再登记 encoder 公式并追加词条 */
function resolveDict(name,seen,report){
  if(seen.has(name))return;seen.add(name);
  const f=findRimeFile(name+'.dict.yaml');
  if(!f){
    const want=(name+'.dict.yaml').toLowerCase();
    if(store.largeFiles.some(lf=>lf.name.toLowerCase()===want))return;  // 大词库稍后按需加载
    report.missing.push(name);return;
  }
  const imp=(f.text.match(/import_tables:[\s\S]*?(?=\n[a-z_]+:|\n\.\.\.|$)/)||[''])[0]
    .split('\n').slice(1).map(s=>s.replace(/^\s*-\s*/,'').trim()).filter(Boolean);
  imp.forEach(d=>resolveDict(d,seen,report));
  parseEncoderRules(f.text,name);
  const cnt=addDictYaml(f.text);
  store.traced.set(name,{path:f.path,count:cnt,imported:imp});
  report.loaded.push(name);
}
/* fixed 补充库：每行「编码 字词…」，转为词典条目 */
function addFixedFile(text){
  let cnt=0;
  for(const line of text.split(/\r?\n/)){
    const t=line.trim();if(!t||t.startsWith('#'))continue;
    const parts=t.split(/[\t ]+/);if(parts.length<2)continue;
    const code=parts[0];
    for(const w of parts.slice(1)){
      if(!store.dict.has(w))store.dict.set(w,[]);
      const arr=store.dict.get(w);if(!arr.includes(code)){arr.push(code);cnt++;}
    }
  }
  return cnt;
}
/* 递归展开 schema 的 __include 链（只跟 xxx.schema.yaml:/ 这类引用） */
function resolveSchemaIncludes(text,seen){
  if(!text)return '';
  seen=seen||new Set();
  const inc=text.match(/^\s*__include:\s*([\w-]+)\.schema\.yaml:\/(?:\s|$)/m);
  if(inc&&!seen.has(inc[1])){
    seen.add(inc[1]);
    let sub='';
    if(store.rimeFiles){for(const [p,tx] of store.rimeFiles){if(p.split('/').pop()===inc[1]+'.schema.yaml'){sub=tx;break;}}}
    if(sub){const resolved=resolveSchemaIncludes(sub,seen);return resolved+'\n'+text;}
  }
  return text;
}
/* 从当前 schema 追溯全部词库；返回 {loaded,missing,fixed} 报告 */
function traceFromSchema(){
  store.traced.clear();store.encoderRules.clear();clearDict();
  const report={loaded:[],missing:[],fixed:[]};const dictNames=[];
  /* 只取 translator: 主块内的 dictionary:，避免把子翻译器（bihua/sbfc 等）的词典卷进来 */
  const mainText=store.schemaText||'';
  const extractDictFromText=t=>{
    const merged=resolveSchemaIncludes(t);
    const lines=merged.split('\n');let inTr=false,trInd=-1;
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      if(!line.trim()||line.trim().startsWith('#'))continue;
      const ind=line.search(/\S/);if(ind<0)continue;
      if(inTr){
        if(ind<=trInd)break;
        if(ind>trInd&&!/^\s*__include:/.test(line)){
          const dm=line.match(/^\s*dictionary:\s*([A-Za-z0-9_.]+)/);
          if(dm)return{dict:dm[1],rest:lines.slice(i).join('\n')};
        }
      }else if(/^\s*translator:/.test(line)){inTr=true;trInd=ind;}
    }
    return null;
  };
  let result=extractDictFromText(mainText);
  if(result){
    dictNames.push(result.dict);
    const pk=result.rest.match(/packs:[\s\S]*?(?=\n\s*\S|\n\.\.\.|$)/);
    if(pk)pk[0].split('\n').slice(1).map(s=>s.replace(/^\s*-\s*/,'').trim()).filter(Boolean)
      .forEach(p=>{if(!dictNames.includes(p))dictNames.push(p);});
  }
  const seen=new Set();dictNames.forEach(n=>resolveDict(n,seen,report));
  const sid=store.schemaId||dictNames[0]||'';
  [...new Set([sid,dictNames[0]].filter(Boolean))].forEach(base=>{
    const ff=findRimeFile(base+'.fixed.txt');
    if(ff){const cnt=addFixedFile(ff.text);store.traced.set(base+'.fixed',{path:ff.path,count:cnt,imported:[]});report.fixed.push(base);}
  });
  store.selectKeys=resolveSelectKeys();
  store.buildText=findBuildSchema(sid)||'';
  applySchemeSpec(store.buildText||store.schemaText||'');
  store.poppingRules=parsePopping(store.buildText||store.schemaText||'');
  buildSchemeModel();
  finalizeDict();
  return report;
}
/* 追溯结果列表 */
function renderTrace(){
  const el=document.getElementById('traceList');let h='';
  if(store.rimeFolder)h+='<div class="lua-item folder">📁 '+store.rimeFolder+'（'+store.rimeFiles.size+' 个文件，lua '+store.luaFiles.size+'）</div>';
  const extLeft=store.largeFiles.filter(f=>extendedMatch(f.name));
  const rows=[];
  for(const [n,info] of store.traced)rows.push({loaded:true,n,info,file:(info.path||n).split(/[\\/]/).pop()});
  for(const f of extLeft)rows.push({loaded:false,file:f.name,large:f.name});
  if(rows.length){
    const baseDict=(store.schemaId||'').toLowerCase()+'.dict.yaml';
    rows.sort((a,b)=>{
      const ai=a.file.toLowerCase()===baseDict?0:1,bi=b.file.toLowerCase()===baseDict?0:1;
      if(ai!==bi)return ai-bi;
      return a.file.localeCompare(b.file);
    });
    h+='<div class="lua-item folder" style="margin-top:4px;">基础词典&拓展词库（'+rows.length+'）</div>';
    for(const r of rows){
      if(r.loaded){
        const imp=r.info.imported.length?'（import '+r.info.imported.join(', ')+'）':'';
        h+='<div class="lua-item">✅ '+r.n+' <span style="opacity:.7">'+r.info.count+' 条'+imp+'</span></div>';
      }else{
        h+='<div class="lua-item" data-load-large="'+r.large+'" style="cursor:pointer">⚪ '+r.file+'</div>';
      }
    }
  }
  if(store._traceReport&&store._traceReport.missing.length){
    h+='<div class="lua-item folder" style="color:#b04040;margin-top:4px;">未找到</div>';
    store._traceReport.missing.forEach(n=>{h+='<div class="lua-item" style="color:#b04040">⚠ '+n+'.dict.yaml</div>';});
  }
  if(!h)h='<div class="lua-item">尚未追溯词库</div>';
  el.innerHTML=h;
  el.querySelectorAll('[data-load-large]').forEach(node=>node.addEventListener('click',()=>loadLarge(node.dataset.loadLarge)));
}
/* 按需加载大词库：目录句柄方式走磁盘；回退方式用缓存的 File 对象 */
async function findTextInDir(dir,fileName,base){
  for await(const [n,h] of dir.entries()){
    const rel=base?base+'/'+n:n;
    if(h.kind==='directory'){const r=await findTextInDir(h,fileName,rel);if(r)return r;}
    else if(n===fileName)return await readFileAsText(await h.getFile());
  }
}
async function loadLarge(fileName){
  const rec=store.largeFiles.find(f=>f.name===fileName);
  let text=await readRimePath(rec&&rec.path?rec.path:fileName,fileName);
  if(!text)return alert('需重新选择 Rime 文件夹后才能加载该大词库。');
  const base=fileName.replace(/\.dict\.yaml$/i,'');
  parseEncoderRules(text,base);
  const cnt=addDictYaml(text);finalizeDict();
  store.traced.set(base,{path:fileName,count:cnt,imported:[]});
  store.largeFiles=store.largeFiles.filter(f=>f.name!==fileName);
  renderTrace();renderCandidate();nextWord();
}
/* 拓展词库识别：文件名首段=当前方案或已追溯词典名 */
function schemePrefixes(){
  const ps=[];
  if(store.schemaId)ps.push(store.schemaId);
  for(const n of store.traced.keys())if(!ps.includes(n))ps.push(n);
  return ps;
}
function extendedMatch(name){
  const first=name.split('.')[0].toLowerCase();
  return schemePrefixes().some(p=>p.toLowerCase()===first);
}
async function autoLoadExtended(){
  const matched=store.largeFiles.filter(f=>extendedMatch(f.name));
  for(const [i,f] of matched.entries()){
    await loadStep('正在解析拓展词库 · 第 '+(i+1)+'/'+matched.length+' 本：'+f.name);
    const text=await readRimePath(f.path||f.name,f.name);
    if(!text)continue;
    const base=f.name.replace(/\.dict\.yaml$/i,'');
    parseEncoderRules(text,base);
    const cnt=addDictYaml(text);finalizeDict();
    store.traced.set(base,{path:f.name,count:cnt,imported:[]});
    store.largeFiles=store.largeFiles.filter(x=>x.name!==f.name);
  }
}
/* 收下整个 Rime 文件夹：登记小文件 → 路由 lua/数据表 → 追溯词库 → 缓存
   fpMap 是这次扫出来的 路径→[大小,改期] 清单（app 版给得出），跟着快照一起存。 */
async function ingestRime(items,folder,dirHandle,objs,fpMap){
  store.rimeFiles=new Map();
  for(const it of items)store.rimeFiles.set(it.path,it.text);
  store.rimeFolder=folder;store.rimeDir=dirHandle||null;store.rimeObjs=objs||null;
  store.rimeRoot=(dirHandle&&typeof dirHandle._p==='string')?dirHandle._p:'';
  if(dirHandle&&typeof dirHandle._p!=='string'){try{await idb.set('rimeDirHandle',dirHandle);}catch(e){}}
  /* 方案下拉：文件夹一到位就顺手把这件事办了，用户不必再选文件。
     一个方案都没选过时，按输入法 default.yaml 里 schema_list 的头一个方案开。 */
  routeRimeTexts();
  renderSchemaSelect();
  if(!store.schemaText){
    const want=(await idb.get('schemaId'))||defaultSchemaId();
    if(want&&schemaList().some(s=>s.id===want))await pickSchema(want);
  }
  await loadStep('正在追溯方案词库 · 把方案引到的那几本词典对出来');
  store._traceReport=traceFromSchema();
  await autoLoadExtended();
  await idb.set('rimeFiles',{folder,files:Object.fromEntries(store.rimeFiles),large:store.largeFiles});
  /* 指纹清单跟快照一起存：app 版给得出（fpMap），别的开法给不出就删掉，免得下次吃到对不上的缓存 */
  if(fpMap)await idb.set(FP_KEY,{folder,map:fpMap});else await idb.del(FP_KEY);
  renderTrace();renderCandidate();
  if(store.targetWord)showTarget(store.targetWord);
  nextWord();
  loadDone();
}
/* 用缓存的 rimeFiles 重新追溯（切换方案无需重选文件夹） */
async function retrace(){
  if(store.rimeFiles.size){
    store._traceReport=traceFromSchema();await autoLoadExtended();renderTrace();renderCandidate();
    if(isWordMode()){if(store.targetWord&&store.targetWord!=='—')showTarget(store.targetWord);else nextWord();}
    else if(store.practiceMode==='text_follow')renderText();
  }
}
/* ===== 目录句柄持久化 =====
   选定过一次 Rime 文件夹后把句柄存入 IndexedDB；file:// 下沙箱不允许静默读盘，
   故 http(s) 下可自动恢复，file:// 或需授权时提示点一下“恢复上次 Rime 目录”。
   返回 'granted' / 'gesture' / 'none' */
/* app 版另记一份明文路径在 exe 旁边（rime-dir.json），开机直接重读，连句柄都不用。
   从前这一家在 Flow-Desk 的封面里是另一个窗口，preload 只注主框架，FD_APP 得从宿主窗口借；
   搬进同一张页之后桥就在自己身上，直接读。 */
function hostApp(){
  try{ if(window.FD_APP && typeof window.FD_APP.openDir === 'function') return window.FD_APP; }catch(e){}
  return null;
}
async function appRimeDir(){
  const app=hostApp();
  if(!app)return '';
  let p='';try{p=await app.rimeDir();}catch(e){return '';}
  return typeof p==='string'?p:'';
}
async function openAppRimeDir(){
  const p=await appRimeDir();
  if(!p)return null;
  try{return hostApp().openDir(p);}catch(e){return null;}
}
async function saveAppRimeDir(handle){
  const app=hostApp();
  if(!app||typeof app.setRimeDir!=='function'||typeof app.pathOf!=='function')return;
  const p=app.pathOf(handle);
  if(p){try{await app.setRimeDir(p);}catch(e){}}
}
/* 收下用户选的（或上次指过的）那个 Rime 目录。
   app 版走一次整树 stat，再拿指纹和缓存比：一样的文件不重读，变了的新增的才读盘；
   force（重新选目录、一键重载）就是明确说了要看磁盘上此刻的样子，全部重读。
   别的开法没有 stat 这条快路，仍旧 readDirRecursive 一个个读。 */
async function takeRimeDir(dir,force){
  const app=hostApp(),root=(app&&typeof app.pathOf==='function')?app.pathOf(dir):'';
  store.largeFiles=[];
  if(app&&root&&typeof app.dirTree==='function'){
    const scanned=await app.dirTree(root,RIME_EXT);
    const snap=force?null:await idb.get('rimeFiles');
    const fp=force?null:await idb.get(FP_KEY);
    const r=await collectRime(app,root,scanned||[],snap,fp&&fp.map,force);
    store.largeFiles=r.large;
    await ingestRime(r.items,dir.name,dir,null,fpMapOf(scanned||[]));
    return 'granted';
  }
  const out=[];await readDirRecursive(dir,'',out);
  await ingestRime(out,dir.name,dir,null,null);
  return 'granted';
}
async function restoreRimeDir(interactive,force){
  if(location.protocol==='file:'||!window.showDirectoryPicker)return 'none';
  const ad=await openAppRimeDir();
  if(ad)return await takeRimeDir(ad,force);
  let dir=null;try{dir=await idb.get('rimeDirHandle');}catch(e){dir=null;}
  if(!dir||typeof dir.queryPermission!=='function')return 'none';
  let perm='prompt';
  try{perm=await dir.queryPermission({mode:'read'});}catch(e){perm='prompt';}
  if(perm!=='granted'&&interactive){try{perm=await dir.requestPermission({mode:'read'});}catch(e){perm='denied';}}
  if(perm!=='granted')return perm==='prompt'?'gesture':'none';
  return await takeRimeDir(dir,force);
}
function showRestoreDirBtn(show){const b=document.getElementById('restoreDirBtn');if(b)b.style.display=show?'inline-block':'none';}
document.getElementById('restoreDirBtn').addEventListener('click',async()=>{
  loadAllow();
  const r=await restoreRimeDir(true);
  if(r==='granted'){showRestoreDirBtn(false);if(store.dict.size){buildSortedList();if(isWordMode())nextWord();}}
  loadDone();
});
/* “加载输入法文件”：file:// 直接走原生文件夹选择；https 优先 File System Access API */
document.getElementById('traceDictBtn').addEventListener('click',async()=>{
  if(!store.schemaText)return alert('请先在上方选好方案。');
  loadAllow();
  if(location.protocol==='file:'||!window.showDirectoryPicker){rimeFolderInput.click();loadDone();return;}
  let dir;
  try{dir=await window.showDirectoryPicker({id:'rime-root',mode:'read'});}
  catch(e){if(e&&e.name==='AbortError'){loadDone();return;}rimeFolderInput.click();loadDone();return;}
  await saveAppRimeDir(dir);
  await takeRimeDir(dir,true);showRestoreDirBtn(false);loadDone();
});
/* 回退方式：webkitdirectory，同时缓存 File 对象以便按需读大文件 */
rimeFolderInput.addEventListener('change',async()=>{
  loadAllow();
  let folder='';const items=[];const objs=new Map();store.largeFiles=[];
  for(const f of [...rimeFolderInput.files]){
    if(!/\.(lua|txt|yaml|yml)$/i.test(f.name))continue;
    const rel=f.webkitRelativePath||f.name;if(!folder)folder=rel.split('/')[0];
    const p=rel.split('/').slice(1).join('/')||f.name;objs.set(f.name,f);
    if(f.size>LARGE_LIMIT)store.largeFiles.push({path:p,name:f.name});
    else items.push({path:p,name:f.name,text:await readFileAsText(f)});
  }
  await ingestRime(items,folder,null,objs,null);showRestoreDirBtn(false);rimeFolderInput.value='';
});
/* 卸载词库与规则（保留方案基础、练习文本） */
document.getElementById('unloadTracedBtn').addEventListener('click',async()=>{
  if(!confirm('将卸载已追溯的全部词典、fixed、lua 规则（保留方案基础、练习文本）。是否继续？'))return;
  store.rimeFiles.clear();store.rimeFolder='';store.traced.clear();store.encoderRules.clear();store._traceReport=null;store.largeFiles=[];
  store.luaFiles.clear();store.dict.clear();store.wordList=[];store.sortedWordList=[];store.entryWeight.clear();clearDictIndex();
  store.xmLens.clear();store.xmChars.clear();store.cf.clear();store.strokes.clear();store.radicals.clear();
  store.strokeMap=Object.assign({},DEFAULT_STROKE_MAP);store.sbxlm={};
  store.rimeDir=null;store.rimeRoot='';
  await idb.del('rimeDirHandle');await idb.del('rimeFiles');await idb.del('schemaId');await idb.del(FP_KEY);showRestoreDirBtn(false);
  const app=hostApp();if(app&&typeof app.setRimeDir==='function'){try{await app.setRimeDir('');}catch(e){}}
  renderTrace();renderCandidate();nextWord();
});
/* 当前方案名显示 */
function updateSchemeName(){
  const el=document.getElementById('currentScheme');
  if(store.schemeName){
    el.textContent='当前方案：'+store.schemeName;el.style.display='block';
    document.title=store.schemeName+'打字练习';
  }
  else el.style.display='none';
}
/* schema_id 与词典 name 不一致时提醒 */
function checkSchemeConsistency(){
  const w=document.getElementById('schemeWarn');
  if(store.schemaId&&store.dictName&&store.schemaId.trim()!==store.dictName.trim()){
    w.textContent='⚠ 方案基础的 schema_id（'+store.schemaId+'）与词典开头的 name（'+store.dictName+'）不一致，请检查是否加载了相互匹配的方案与词典文件。';
    w.style.display='block';
  }else w.style.display='none';
}
/* 一键重载：这一条是「文件缓存看不出来改动」时的手动出口，绕开缓存重读磁盘 */
document.getElementById('reloadAllBtn').addEventListener('click',async()=>{
  let n=0,haveRf=false;
  const drr=await restoreRimeDir(true,true);
  if(drr==='granted'){haveRf=true;n++;}
  const rf=await idb.get('rimeFiles');
  if(!haveRf&&rf&&rf.files){
    store.rimeFiles=new Map(Object.entries(rf.files));
    store.rimeFolder=rf.folder;store.largeFiles=rf.large||[];
    store.luaFiles=new Map();
    for(const [p,tx] of store.rimeFiles){if(/(^|\/)lua\//.test(p)||/\.lua$/i.test(p)){store.luaFiles.set(p,tx);routeLuaFile(p.split('/').pop(),tx);}}
    haveRf=true;n++;
  }
  for(const key of ['schema']){
    const rec=await idb.get('file_'+key);
    if(rec){await fileHandlers[key](rec.text,rec.name);n++;}
  }
  if(haveRf&&!store.schemaText){store._traceReport=traceFromSchema();renderTrace();}
  if(store.dict.size){buildSortedList();if(isWordMode())nextWord();}
  renderCandidate();
  alert('已重新读取并应用 '+n+' 项已缓存文件（练习文本除外）。');
});
