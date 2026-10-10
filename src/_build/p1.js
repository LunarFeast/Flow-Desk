/* ============================================================
   声笔系列码打字练习工具 · 从零重写版
   取码/构词依据：
     - %APPDATA%\Rime\lua\sbxlm\core.lua（方案族判定 word_rules）
     - 各 *.dict.yaml 的 encoder.rules（length_equal/length_in_range + formula）
     - sbxlm.yaml 公共前置（page_size/alternative_select_keys/recognizer/bindings）
     - https://sbxlm.github.io/about/（顶功/字词分流/字母选重/动态码长/扩展编码）
   架构约定：所有编码一律从词典（store.dict）取；公式只用于对照解释，
   不用于生成编码。象码专属分类（单字 1-14、简码词 15-19 等）仅用于 sbxm。
   ============================================================ */

/* ================= 全局状态 ================= */
const PAGE_SIZE = 6;
/* 选重键随方案：数字选重（象码/飞天/双拼 23789、猛码 12345）空格+数字；
   字母选重（飞码/飞讯/飞简/简码 aeuio）空格+aeuio。store.selectKeys 在追溯时解析 */
function selectKeyArr(){return [' ',...(store.selectKeys||'23789')];}
function isLetterSelect(){return /[a-z]/.test(store.selectKeys||'23789');}
/* 解析当前方案选重键：schema 自写优先（取最后一个），否则用 sbxlm.yaml prelude（默认 _aeuio） */
function resolveSelectKeys(){
  const own=[...(store.schemaText||'').matchAll(/alternative_select_keys:\s*"([^"]+)"/g)].map(x=>x[1]);
  if(own.length)return own[own.length-1].replace(/^_/,'');
  const sets=(store.sbxlm&&store.sbxlm.selectKeysSets)||[];
  if(sets.length)return sets[sets.length-1].replace(/^_/,'');
  return 'aeuio';
}
const store = {
  dict:new Map(), xmLens:new Map(), charLens:new Map(), xmChars:new Map(), cf:new Map(), strokes:new Map(), radicals:new Map(), entryWeight:new Map(),
  strokeMap:{a:";",e:"'",u:",",i:".",o:"/"},
  sbxlm:{},
  charFreq:new Map(),
  config:{filter_strength:3,max_code_length:8,random_strength:"seq",enable_filtering:false,spec:{}},
  switches:[], opt:{}, schemeSettings:{},
  practiceMode:"word_full", practiceIntensity:"full", tfIntensity:"full", currentInput:"", targetWord:"",
  candidatePage:0, selectedIndex:0,
  practice:{total:0,err:0}, wordList:[], sortedWordList:[], practiceIndex:-1,
  /* 大词典候选查表：{exact:Map<完整编码,词[]>, pre:Map<前3码,词[]>}，没建表就是 null；_idxDirty 是「词典变了、表还没建」 */
  dictIndex:null, _idxDirty:false,
  textPracticeContent:[], textPracticeIndex:0,
  errorLog:[], stat:{codeErr:0,selErr:0,back:0,select:0,keys:0},
  /* 历次累计基线（不含本次）：导出时 历次 = 基线 + 本次，落库时写入合计 */
  lifeBase:{total:0,err:0,codeErr:0,selErr:0,back:0,select:0,keys:0,up:0,wrong:0},
  sessionStart:0,
  schemaText:'', schemaId:'', dictName:'', schemeName:'', poppingRules:[], tfRules:[], tfSelectRules:[],
  /* 编码变换专项：当前模拟状态与键绑定 */
  tf:{buf:'',cur:0,out:'',pick:0,log:[]},
  recPaused:false, pausedMs:0, pauseStart:0,
  rimeFiles:new Map(), rimeFolder:'', traced:new Map(), encoderRules:new Map(), selectKeys:'23789'
};

/* ================= 模式判定 ================= */
function isWordMode(){const m=store.practiceMode;return m==='word_full'||m==='word_simple'||m==='transform';}
function isTextMode(){const m=store.practiceMode;return m==='text_follow'||m==='text_free';}
/* 记录是否计入练习统计：暂停后所有计数器停止累加；首次计入时记下本次练习的开始时刻 */
function rec(){
  if(store.recPaused)return false;
  if(!store.sessionStart)store.sessionStart=Date.now();
  return true;
}
function statBack(){if(!rec())return;store.stat.back++;updateStatPanel();}
function statSelect(){if(!rec())return;store.stat.select++;updateStatPanel();}
function statKey(){if(!rec())return;store.stat.keys++;}
/* 已用时长：只扣除本次计时开始之后累计的暂停时长（base 为计时开始时的 store.pausedMs） */
function elapsedMs(startTs,base){
  if(!startTs)return 0;
  const held=store.pausedMs-(base||0)+(store.recPaused&&store.pauseStart?Date.now()-store.pauseStart:0);
  return Math.max(0,Date.now()-startTs-held);
}
/* 提示强度 0..4：full 全提示 → none 无提示 */
function hintLv(){return {full:0,low:1,mid:2,high:3,none:4}[store.practiceIntensity]||0;}
/* 编码变换专项的提示强度是它专享的 3 档，不与字词/文本模式共用、不做任何映射 */
const TF_INTENSITIES=[['full','全提示'],['normal','仅提示常规编码'],['none','无编码提示']];
const WORD_INTENSITIES=[['full','全提示'],['low','低'],['mid','中'],['high','高'],['none','无提示']];
function tfHintLv(){const v=store.tfIntensity;return v==='none'||v==='normal'?v:'full';}
function hasSimpleCodes(){return store.encoderRules.size>0;}
function refreshModeOptions(){const o=practiceModeSel.querySelector('option[value="word_simple"]');if(o)o.style.display=hasSimpleCodes()?'':'none';}

/* 内嵌：25亿字语料汉字字频表（2025，14975字，格式 字 频次|字 频次） */
/*__CHARFREQ__*/
function loadCharFreq(){
  store.charFreq.clear();
  for(const p of CHARFREQ_RAW.split('|')){
    const m=p.trim().match(/^(.)\s+(\d+)$/);
    if(m)store.charFreq.set(m[1],+m[2]);
  }
}
/* 词频 = 各字频对数的平均，用于出题排序与候选次序 */
function wordFreqScore(word){
  const chars=[...word];let s=0,n=0;
  for(const c of chars){const f=store.charFreq.get(c);if(f){s+=Math.log(f);n++;}}
  return n?s/n:0;
}
/* 随机强度：seq 原序；rev 逆序；rare 低频专项（后 30% 倒序）；low/mid/high 按位置扰动 */
function applyOrder(base,strength){
  const a=base.slice();
  if(strength==='rev'){a.reverse();return a;}
  if(strength==='rare'){
    const cut=Math.floor(a.length*0.7);
    const head=a.slice(0,cut),tail=a.slice(cut).reverse();
    return head.concat(tail);
  }
  const amp={low:0.08,mid:0.25,high:0.6}[strength];
  if(amp===undefined)return a;
  const n=a.length,key=new Array(n);
  for(let i=0;i<n;i++)key[i]=i+(Math.random()-0.5)*2*amp*n;
  const idx=[...a.keys()].sort((x,y)=>key[x]-key[y]);
  return idx.map(i=>a[i]);
}
/* ================= 方案个性化开关（对齐 lua context:get_option） =================
   store.switches：从 schema yaml 的 switches 解析，二态为 {name}，多态为 {options[]}；
   store.opt：练习器内的开关状态，键为 switch 名，值为布尔。多态组内互斥（同 Rime）。 */
function hasSwitch(name){return (store.switches||[]).some(s=>s.names.includes(name));}
function opt(name){return !!store.opt[name];}
/* 词组过滤用的逐字码长表：象码用 xm_lens.txt，其余方案用 char_lens.txt（auto_length.lua:450-451） */
function lensTable(){return isXmScheme()?store.xmLens:store.charLens;}
/* 各方案模式下词组在出题序列中的目标占比 */
function targetPhraseRatio(){
  if(opt('pure_char'))return 0;
  if(opt('pro_char'))return {3:0.6,4:0.45,5:0.25,6:0.15}[+store.config.filter_strength]||0.4;
  return 0.6;
}
/* pro_char 单字模式过滤：词组各字全码长度之和 > filter_strength 才保留（对齐 auto_length:459,473）
   前提是该方案 enable_filtering，且码长表已加载 */
function phraseKept(word){
  if(!opt('pro_char'))return true;
  if(!store.config.enable_filtering)return true;
  const lens=lensTable();
  if(!lens.size)return true;
  const cs=[...word];
  if(cs.length>3)return true;              /* auto_length 只对二、三字词做码长和过滤 */
  let sum=0;
  for(const c of cs){
    const l=lens.get(c);
    if(l===undefined)return false;
    sum+=l;
  }
  return sum>store.config.filter_strength;
}
/* 出题序列：按字频降序拆成单字/词组两列，按目标占比均匀交错，最后套随机强度 */
function buildSortedList(){
  const scored=store.wordList
    .map(w=>[w,wordFreqScore(w)])
    .sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const chars=scored.filter(w=>[...w].length===1);
  let phrases=scored.filter(w=>[...w].length>=2);
  if(opt('pure_char'))phrases=[];
  else if(opt('pro_char'))phrases=phrases.filter(phraseKept);
  const ratio=targetPhraseRatio();
  const merged=[];let ci=0,pi=0;
  while(ci<chars.length||pi<phrases.length){
    const expectPhrase=merged.length*ratio;
    if(pi<phrases.length&&(pi<expectPhrase||ci>=chars.length)){merged.push(phrases[pi++]);}
    else if(ci<chars.length){merged.push(chars[ci++]);}
    else if(pi<phrases.length){merged.push(phrases[pi++]);}
  }
  store.sortedWordList=applyOrder(merged,store.config.random_strength);
  store.practiceIndex=-1;
}

/* ================= DOM 引用 ================= */
const inputEl=document.getElementById('input-area');
const candBar=document.getElementById('candidate-bar');
const targetWordEl=document.getElementById('targetWord');
const hintCodeEl=document.getElementById('hintCode');
const wordFeedbackEl=document.getElementById('wordFeedback');
const cfHintEl=document.getElementById('cfHint');
const modeTipEl=document.getElementById('modeTip');
const imeWarnEl=document.getElementById('imeWarn');
const pageInfoEl=document.getElementById('pageInfo');
const practiceModeSel=document.getElementById('practiceMode');
const wordPanel=document.getElementById('wordPanel');
const textPanel=document.getElementById('textPanel');
const textLayoutSel=document.getElementById('textLayoutSel');
const textLayout=document.getElementById('textLayout');
const textView=document.getElementById('textView');
const textInputEl=document.getElementById('text-input');
const textStatsEl=document.getElementById('textStats');
const randomStrengthSel=document.getElementById('randomStrength');
const practiceIntensitySel=document.getElementById('practiceIntensity');

/* ================= 文件与持久化基础 ================= */
function readFileAsText(file){
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(file,'utf-8');});
}
const idb={
  db:null,
  open(){return new Promise((res,rej)=>{
    const r=indexedDB.open('rime_practice',1);
    r.onupgradeneeded=e=>e.target.result.createObjectStore('kv');
    r.onsuccess=e=>{this.db=e.target.result;res();};
    r.onerror=rej;
  })},
  get(k){return new Promise((res,rej)=>{const rq=this.db.transaction('kv').objectStore('kv').get(k);rq.onsuccess=()=>res(rq.result);rq.onerror=rej;})},
  set(k,v){return new Promise((res,rej)=>{const t=this.db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=rej;})},
  del(k){return new Promise((res,rej)=>{const t=this.db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=res;t.onerror=rej;})}
};
function bindFileCard(card,onLoad){
  const key=card.dataset.key;
  const input=card.querySelector('input[type=file]');
  const btn=card.querySelector('.pick-btn');
  const status=card.querySelector('.file-status');
  btn.addEventListener('click',()=>input.click());
  const unbtn=card.querySelector('.unload-btn');
  if(unbtn)unbtn.addEventListener('click',()=>unloadFile(key));
  input.addEventListener('change',async()=>{
    const file=input.files[0];
    if(!file){card.classList.remove('loaded');status.textContent='未选择文件';await idb.del('file_'+key);return;}
    card.classList.add('loaded');
    status.textContent='✅ '+file.name;
    const text=await readFileAsText(file);
    await idb.set('file_'+key,{name:file.name,text});
    if(onLoad)await onLoad(text,file.name);
  });
}
/* 卸载单个文件：删 IndexedDB 缓存、清对应内存数据、复位卡片 */
async function unloadFile(key){
  await idb.del('file_'+key);
  switch(key){
    case 'schema': store.poppingRules=[]; store.schemeName=''; store.switches=[];store.opt={};store.buildText='';
      if(typeof renderSchemeControls==='function')renderSchemeControls(); updateSchemeName(); break;
    case 'dict': store.dict.clear();store.wordList=[];store.sortedWordList=[];store.entryWeight.clear();clearDictIndex();store.practiceIndex=-1; break;
    case 'xmLens': store.xmLens.clear(); break;
    case 'xmChars': store.xmChars.clear(); break;
    case 'cf': store.cf.clear(); break;
    case 'strokes': store.strokes.clear(); break;
    case 'strokeMap': store.strokeMap=Object.assign({},DEFAULT_STROKE_MAP); break;
    case 'sbxlm': store.sbxlm={}; break;
    case 'textPractice': store.textPracticeContent=[]; break;
  }
  const card=document.querySelector('.file-card[data-key="'+key+'"]');
  if(card){card.classList.remove('loaded');
    card.querySelector('.file-status').textContent=
      key==='strokeMap'?"未选择（用原版 折; 横' 撇, 竖. 捺/）":'未选择文件';}
  if(key==='dict')nextWord();
  renderCandidate();
  if(isTextMode()&&key==='textPractice')applyPanels();
}

/* ================= 词典与数据表解析 =================
   dict.yaml 词条行格式：词<Tab>编码[<Tab>权重[<Tab>造词码]]
   第2列才是可直接输入的真实编码；第4列 stem 仅供造词，不作为候选编码。 */
function clearDict(){store.dict.clear();store.wordList=[];store.entryWeight.clear();clearDictIndex();}
function addDictYaml(text){
  let cnt=0;
  for(let line of text.split(/\r?\n/)){
    line=line.trim();
    if(!line||line.startsWith('#')||line.startsWith('%'))continue;
    const parts=line.split(/\t+/).map(s=>s.trim());
    if(parts.length<2)continue;
    const word=parts[0], code=parts[1];
    if(!code)continue;
    if(!store.dict.has(word))store.dict.set(word,[]);
    const arr=store.dict.get(word);
    if(!arr.includes(code)){arr.push(code);cnt++;}
    store.entryWeight.set(word+'\t'+code,(parseFloat(parts[2])||0));
  }
  return cnt;
}
function finalizeDict(){
  store.wordList=[];
  for(const [w,arr] of store.dict){
    arr.sort((a,b)=>a.length-b.length);   // 简码在前、全码在后
    store.wordList.push(w);
  }
  /* 装一个词库文件就收尾一次，好几个文件连着装就会重复建表 —— 这里只标脏，第一次查候选再建 */
  store.dictIndex=null;store._idxDirty=true;
  buildSortedList();
}
/* ================= 大词典候选查表 =================
   词典一到二十万词条以上，候选那三处全表扫就变成每次按键扫完整个 Map。按阈值建两张表：
     exact —— 完整编码 → 词数组（等码查询：静态码候选、精确候选、一简字）
     pre   —— 编码前 3 码 → 词数组（前缀查询：输入满 3 码时按桶取）
   建表按词典原序写入，所以查表出来的先后和全表扫一模一样；命中之后调用方照样逐码复核，
   两条路径不可能分叉。小词典（43k 那档）不建表，一切照旧。
   同一个词的多个编码不会重复（装词典时按词去重），所以 exact 直接 push；
   pre 桶里同一个词可能因为「简码+全码同前缀」撞进同一桶，先用 Set 收、建完结成数组 ——
   用 includes 去重在十万级的桶上是平方级开销，建一次表能卡死半天。 */
const DICT_INDEX_MIN=200000;
function buildDictIndex(){
  let entries=0;
  for(const arr of store.dict.values())entries+=arr.length;
  if(entries<=DICT_INDEX_MIN){store.dictIndex=null;return;}
  const exact=new Map(), sets=new Map(), pre=new Map();
  for(const [word,codes] of store.dict){
    for(const c of codes){
      if(!c)continue;
      let a=exact.get(c);
      if(!a){a=[];exact.set(c,a);}
      a.push(word);
      if(c.length<3)continue;
      const p=c.slice(0,3);
      let s=sets.get(p);
      if(!s){s=new Set();sets.set(p,s);}
      s.add(word);
    }
  }
  for(const [p,s] of sets)pre.set(p,[...s]);
  store.dictIndex={exact,pre};
}
/* 要表的时候再建：标脏 → 第一次查询建好 → 之后一直复用 */
function dictIndex(){
  if(store._idxDirty){store._idxDirty=false;buildDictIndex();}
  return store.dictIndex;
}
function clearDictIndex(){store.dictIndex=null;store._idxDirty=false;}
/* 按查询键取命中过的词；没建表、或者问的是 1-2 码前缀（表只分 3 码桶，覆盖不到）时返回 null */
function indexedWords(kind,key){
  const ix=dictIndex();
  if(!ix)return null;
  if(kind==='pre'){
    if(key.length<3)return null;
    return ix.pre.get(key.slice(0,3))||[];
  }
  return ix.exact.get(key)||[];
}
/* 查表命中的词还原成 [词, 编码数组]，形状和全表扫一致，调用方只在开头换一个可迭代对象 */
function dictPairsFor(kind,key){
  const w=indexedWords(kind,key);
  return w?w.map(word=>[word,store.dict.get(word)]):store.dict.entries();
}
function parseDictYaml(text){clearDict();addDictYaml(text);finalizeDict();}
function parseTwoCol(text,map,valFn){
  map.clear();
  for(const line of text.split(/\r?\n/)){
    const [a,b]=line.split(/\t/);
    if(a&&b)map.set(a.trim(),valFn?valFn(b.trim()):b.trim());
  }
}
/* 拆字表（sbxmcf.txt）：兼容「序号 字 拆字串」与「字 拆字串」两种行式 */
function parseCf(text){
  store.cf.clear();
  for(const line of text.split(/\r?\n/)){
    const parts=line.split(/\t/);
    if(parts.length<2)continue;
    let char,cf;
    if(/^\d+$/.test(parts[0].trim())){char=parts[1]?parts[1].trim():'';cf=parts.slice(2).join(' ').trim();}
    else{char=parts[0].trim();cf=parts.slice(1).join(' ').trim();}
    if(char&&cf)store.cf.set(char,cf);
  }
}
