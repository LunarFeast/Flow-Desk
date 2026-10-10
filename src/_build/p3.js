/* ================= 方案族模型（依据 lua/sbxlm/core.lua） =================
   core.lua 中的方案判定函数逐字对应：
     xm(id)=sbxm; ft(id)=sbft|sbmf; xmft=id∈{sbxm,sbft,sbfm}
     mm(id)=sbmm; feixi=id∈{sbfd,sbfm,sbfx,sbfj,sbfy}; jm(id)=sbjm;
     sp(id)=sbzr|sbxh; yp=id=sbyp; py=id=sbpy; jp=id=sbjp
   word_rules 的家族分支：jm / fm|fd|fy|sp|xx / fx|fj / mm / xm。
   说明文字一律从当前词典 encoder.rules 的 formula 现场推导，不硬编码他方案规则。 */
const FAMILY_OF={
  sbxm:'xm', sbft:'ft', sbmf:'ft',
  sbmm:'mm',
  sbfm:'fm', sbfd:'fm', sbfy:'fm',
  sbfx:'fx', sbfj:'fx',
  sbjm:'jm', sbjp:'jm',
  sbzr:'sp', sbxh:'sp',
  sbyp:'py', sbpy:'py', sbzz:'py', sbhz:'py',
  sbfc:'rev', bihua:'stroke', zhlf:'two'
};
/* 单字编码中“每个键是什么”的角色判定（各方案共用：首码=声母；aeuio=笔画；数字/符号=笔画的变体书写） */
const INIT_SET="bpmfdtnlgkhjqxzcsrywv";
const STROKE_SET="aeuio";
const DIGIT_SET="23789";
const SYM_SET=";',./";
const isInit=k=>INIT_SET.includes(k);
const isStrokeK=k=>STROKE_SET.includes(k);
const isDigitK=k=>DIGIT_SET.includes(k);
const isSymK=k=>SYM_SET.includes(k);
const STROKE_NAME={a:"折",e:"横",u:"撇",i:"竖",o:"捺"};
const ORD=['一','二','三','四','五','六','七','八','九','十','十一','十二'];
const DEFAULT_STROKE_MAP={a:";",e:"'",u:",",i:".",o:"/"};
/* 原版符号映射（auto_length.lua）与数字映射 */
const ORIG_SYM={a:";",e:"'",u:",",i:".",o:"/"};
const DIGIT_MAP={a:"2",e:"3",u:"7",i:"8",o:"9"};
function symForStroke(s){return (store.strokeMap&&store.strokeMap[s])||ORIG_SYM[s]||'';}
function digitForStroke(s){return DIGIT_MAP[s]||'';}
function symToStroke(sym){for(const s in ORIG_SYM)if(symForStroke(s)===sym)return s;return '';}
function digitToStroke(d){for(const s in DIGIT_MAP)if(DIGIT_MAP[s]===d)return s;return '';}
/* 本地 auto_length 的 stroke_map 若与原版不同，简码笔画引导会失效 */
function isStrokeModified(){
  if(!store.strokeMap)return false;
  for(const s in ORIG_SYM){if(store.strokeMap[s]!==ORIG_SYM[s])return true;}
  return false;
}
/* 解析 auto_length.lua 符号版 stroke_map（数字版 23789 不匹配） */
function parseStrokeMap(text){
  const re=/\["([aeuio])"\]\s*=\s*"([;',./])"/g;let m,got={};
  while((m=re.exec(text)))got[m[1]]=m[2];
  store.strokeMap=Object.assign({},DEFAULT_STROKE_MAP,got);
  if(store.targetWord)showTarget(store.targetWord);
}
/* 解析 sbxlm.yaml 公共前置：页大小、选重键序列、recognizer 模式、key_binder 绑定 */
function parseSbxlm(text){
  const r=store.sbxlm;
  const ps=text.match(/page_size:\s*(\d+)/);if(ps)r.pageSize=+ps[1];
  r.selectKeysSets=[];
  const skRe=/alternative_select_keys:\s*"([^"]+)"/g;let m;
  while((m=skRe.exec(text)))r.selectKeysSets.push(m[1]);
  const scp=text.match(/select_comment_pattern:\s*"([^"]+)"/);if(scp)r.selectCommentPattern=scp[1];
  r.recognizer={};
  const rec=text.match(/recognizer:[\s\S]*?\n\s*patterns:([\s\S]*?)\n[a-z_]+:/);
  if(rec){
    const pe=/^\s*([a-z_]+):\s*['"]([^'"]*)['"]/gm;let q;
    while((q=pe.exec(rec[1])))r.recognizer[q[1]]=q[2];
  }
  r.bindings=parseBindings(text);
}
/* key_binder：单行 { when, accept, send } 与多行 match/accept/send 两种写法 */
function parseBindings(text){
  const out=[];
  const kv=s=>{const o={};s.split(',').forEach(p=>{const i=p.indexOf(':');if(i>=0)o[p.slice(0,i).trim()]=p.slice(i+1).trim().replace(/^["']|["']$/g,'');});return o;};
  let m;const single=/- \{([^}]+)\}/g;
  while((m=single.exec(text))){const b=kv(m[1]);if(b.accept)out.push(b);}
  const lines=text.split('\n');let cur=null;
  const flush=()=>{if(cur&&cur.accept)out.push(cur);cur=null;};
  for(const ln of lines){
    if(/^\s*-\s+(match|when):/.test(ln)){flush();cur=kv(ln.replace(/^\s*-\s+/,''));}
    else if(cur&&/^\s+[a-z_]+:/.test(ln)){
      const s2=ln.trim();const i=s2.indexOf(':');
      cur[s2.slice(0,i).trim()]=s2.slice(i+1).trim().replace(/^["']|["']$/g,'');
    }
  }
  flush();
  return out;
}
/* 取某个键的整块文本。rootOnly=true 时只认顶格键，
   用于只在 translator: / speller: 块内查值，避免误读子翻译器 */
function blockOf(text,key,rootOnly){
  const lines=(text||'').split(/\r?\n/);
  const head=new RegExp('^\\s*["\']?'+key+'["\']?\\s*:\\s*(#.*)?$');
  for(let i=0;i<lines.length;i++){
    const ln=lines[i],ind=ln.search(/\S/);
    if(ind<0||!head.test(ln))continue;
    if(rootOnly&&ind!==0)continue;
    const out=[];
    for(let j=i+1;j<lines.length;j++){
      const l2=lines[j];
      if(/^\s*$/.test(l2)||/^\s*#/.test(l2)){out.push(l2);continue;}
      if(l2.search(/\S/)<=ind)break;
      out.push(l2);
    }
    return out.join('\n');
  }
  return '';
}
function topBlock(text,key){return blockOf(text,key,true);}
/* popping 规则的权威位置是 speller/popping（popping.lua:40 config:get_list("speller/popping")），
   build 合并后的 schema 里那里才是全量。根 schema 常用 __include/__patch 引用，
   展开后才含条目，因此按优先级取第一个"真正含条目"的块。 */
function poppingBlock(text){
  const cands=[blockOf(topBlock(text,'speller'),'popping',false),topBlock(text,'popping'),blockOf(text,'popping',false)];
  const hasItem=c=>/-\s*(\{|[a-z_]+\s*:)/.test(c||'');
  for(const c of cands)if(hasItem(c))return c;
  return cands[0]||'';
}
/* 解析 switches：二态 {name} 与多态 {options:[…]} 都归一为 names[] */
function parseSwitches(text){
  const lines=(text||'').split(/\r?\n/);
  const out=[];let inSw=false,cur=null;
  const push=()=>{if(cur&&cur.names.length)out.push(cur);cur=null;};
  for(const raw of lines){
    if(/^switches:/.test(raw)){inSw=true;continue;}
    if(inSw){
      if(/^\s*$/.test(raw)||/^\s*#/.test(raw))continue;
      if(raw.search(/\S/)===0){inSw=false;break;}
      const item=raw.match(/^\s*-\s+(\w+)\s*:\s*(.*)$/);
      const cont=raw.match(/^\s+(\w+)\s*:\s*(.*)$/);
      if(item){
        push();
        const k=item[1],v=stripQ(item[2]);
        if(k==='name')cur={names:[v],binary:true};
        else if(k==='options')cur={names:parseArr(v),binary:false};
      }else if(cont&&cur){
        const k=cont[1],v=stripQ(cont[2]);
        if(k==='reset')cur.reset=+v;
        else if(k==='states')cur.states=parseArr(v);
      }
    }
  }
  push();
  for(const s of out){
    s.key=s.names.join('|');
    if(!s.states)s.states=[];
  }
  return out;
}
function stripQ(s){return (s||'').trim().replace(/^["']|["']$/g,'');}
function parseArr(v){
  v=(v||'').trim().replace(/^\[|\]$/g,'');
  return v.split(',').map(x=>x.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
}
/* 方案部署期参数：过滤开关与强度、词组最长码、单字显示、强制选重、码长上限 */
function parseSchemeConfig(text){
  const tr=topBlock(text,'translator'),sp=topBlock(text,'speller');
  const num=(blk,k)=>{const m=(blk||'').match(new RegExp('\\n\\s*'+k+':\\s*(\\d+)'));return m?+m[1]:null;};
  const bool=(blk,k)=>{const m=(blk||'').match(new RegExp('\\n\\s*'+k+':\\s*(true|false)'));return m?m[1]==='true':null;};
  return {
    filter_strength:num(tr,'filter_strength'),
    enable_filtering:bool(tr,'enable_filtering'),
    max_phrase_length:num(tr,'max_phrase_length'),
    single_selection:bool(tr,'single_selection'),
    forced_selection:bool(tr,'forced_selection'),
    max_code_length:num(sp,'max_code_length')
  };
}
/* 依据 recognizer patterns 判断输入所属反查/辅助模式 */
function recognizeMode(input){
  const rec=store.sbxlm.recognizer||{};
  for(const tag in rec){
    try{if(new RegExp(rec[tag]).test(input))return tag;}catch(e){}
  }
  return 'abc';
}
/* 解析 schema 的 popping 规则（match/accept/when/prefix/strategy）。
   兼容三种写法：根 schema 的块式（- match: "…"，各键一行）、根 schema 的 __include:、
   build/schema.yaml 的行内流式（- {accept: "…", match: "…"}）；
   popping 既可能在顶层，也可能嵌在 speller: 之下（小鹤/自然）。 */
function parsePopping(text){
  const body=poppingBlock(text||'').split(/\r?\n/);
  const rules=[];let cur=null;
  const push=()=>{if(cur){if(cur.prefix!==undefined)cur.prefix=+cur.prefix;rules.push(cur);}cur=null;};
  for(const ln of body){
    const flow=ln.match(/^\s*-\s*\{(.*)\}\s*$/);
    if(flow){
      push();cur={};
      for(const part of splitFlow(flow[1])){
        const kv=part.match(/^\s*(\w+)\s*:\s*(.*)$/);
        if(kv)cur[kv[1]]=kv[2].replace(/^"|"$/g,'').trim();
      }
      continue;
    }
    const item=ln.match(/^\s*-\s+(\w+)\s*:\s*(.*)$/);
    if(item){push();cur={};cur[item[1]]=item[2].replace(/^"|"$/g,'').trim();continue;}
    const kv=ln.match(/^\s+(\w+)\s*:\s*(.*)$/);
    if(kv&&cur)cur[kv[1]]=kv[2].replace(/^"|"$/g,'').trim();
  }
  push();
  return rules;
}
/* 行内流式映射按逗号切分，但不能切断引号内的逗号（如 [^ aeuio;,']） */
function splitFlow(s){
  const out=[];let buf='',q=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='"')q=!q;
    if(c===','&&!q){out.push(buf);buf='';continue;}
    buf+=c;
  }
  if(buf.trim())out.push(buf);
  return out;
}
function preg(p){try{return new RegExp('^(?:'+p+')$');}catch(e){return {test:()=>false};}}
/* 开关是否生效：always/composing/has_menu/paging 是 Rime 的段状态，不是开关 */
function optionActive(name){
  if(!name||name==='always'||name==='composing'||name==='has_menu'||name==='paging')return true;
  return opt(name);
}
/* 顶屏判定：命中 popping 规则则顶屏，strategy=append 只追加 */
function checkPopping(seg,inc){
  for(const r of store.poppingRules){
    if(r.when&&!optionActive(r.when))continue;
    if(!preg(r.match).test(seg))continue;
    if(!preg(r.accept).test(inc))continue;
    return r;
  }
  return null;
}
/* 单字信息：全码=词典中最长码（并列取末位，对齐权重）；s=声母，g=次码 */
function charInfo(c){
  const codes=store.dict.get(c)||[];
  let maxLen=0;codes.forEach(x=>{if(x.length>maxLen)maxLen=x.length;});
  const longest=codes.filter(x=>x.length===maxLen);
  const full=longest.length?longest[longest.length-1]:'';
  const strokeStr=store.strokes.get(c)||'';
  return {c,s:full[0]||'',g:full[1]||'',firstStroke:strokeStr[0]||'',full};
}
/* 递归展开 schema __include，取 alphabet/engine 判断大类 */
function resolvedSchemaText(){
  let t=store.schemaText||'';const got=new Set();
  const grab=name=>{if(got.has(name))return '';got.add(name);
    if(store.rimeFiles){for(const [p,tx] of store.rimeFiles){if(p.endsWith(name+'.schema.yaml'))return tx;}}
    return '';};
  const re=/__include:\s*([\w-]+)\.schema\.yaml/g;let m,extra='';
  while((m=re.exec(t)))extra+='\n'+grab(m[1]);
  return t+'\n'+extra;
}
/* 建立方案模型：family（方案族）、kind（形码/拼音/笔画/反查/两分）、alphabet */
function buildSchemeModel(){
  const text=resolvedSchemaText();
  const al=(text.match(/alphabet:\s*["']?([a-z;,'./0-9]+)/i)||[])[1]||'';
  const onlyStroke=al&&[...al].every(c=>'aeuio;'.includes(c));
  const hasAuto=/auto_length/.test(text);
  const hasScript=/script_translator/.test(text);
  const sid=(store.schemaId||'').trim();
  const fam=FAMILY_OF[sid]||'';
  let kind;
  if(fam==='stroke'||(onlyStroke&&!sid))kind='stroke';
  else if(fam==='two')kind='two';
  else if(fam==='rev')kind='rev';
  else if(fam==='py'||(!fam&&hasScript&&!hasAuto))kind='pinyin';
  else kind='shape';
  store.schemeModel={id:sid,family:fam||(kind==='shape'?'shape':kind),kind,alphabet:al,
    firstKind:kind==='stroke'?'stroke':(fam==='mm'?'root':'initial')};
}
function schemeModel(){return store.schemeModel||{family:'',kind:'shape',firstKind:'initial'};}
function schemeFamily(){return schemeModel().family;}
function schemeKind(){return schemeModel().kind;}
function firstKind(){return schemeModel().firstKind;}
/* 象码专属单字/简码规则只适用于 sbxm（dict name 兜底） */
function isXmScheme(){
  const sid=(store.schemaId||'').trim();
  if(sid==='sbxm')return true;
  if(!sid&&store.dictName==='sbxm')return true;
  return false;
}
/* 该方案单字全码最长限制（about：单字最长四码/词组六码，各方案 max_code_length 以 schema 为准） */

/* ================= 候选与判定 ================= */
/* 静态编码正则（对齐 translator/disable_user_dict_for_patterns）：单声母/声+码/声+两码/声+码+两笔；
   静态码精确匹配，其余走自动码长的动态前缀匹配 */
const STATIC_PATTERNS=[
  /^[bpmfdtnlgkhjqxzcsrywv]$/,
  /^[bpmfdtnlgkhjqxzcsrywv][a-z]'?$/,
  /^[bpmfdtnlgkhjqxzcsrywv][a-z]{2}[;',./14560]?$/,
  /^[bpmfdtnlgkhjqxzcsrywv][a-z][aeuio]{2}$/
];
function isStaticCode(code){return STATIC_PATTERNS.some(r=>r.test(code));}
function entryWeight(word,code){return store.entryWeight.get(word+'\t'+code)||0;}
/* 开关对候选字词的共同过滤 */
function passSwitches(word){
  const len=[...word].length;
  if(len>1&&(opt('pure_char')||opt('single_display')))return false;
  if(len>=2&&opt('pro_char')&&!phraseKept(word))return false;
  return true;
}
/* 提示模式：象码等用 is_hidden 二态，飞系/简码/猛典用 hide|有理|无理|两者(|都不|标点) 多态 */
function hintGroup(){return (store.switches||[]).find(g=>g.names.includes('hide')||g.names.includes('is_hidden'))||null;}
function hintMode(){
  const g=hintGroup();
  if(!g)return 'show';
  const on=g.names.find(n=>store.opt[n]);
  /* 二态 is_hidden：开=隐藏，关=显示 */
  if(g.binary)return on?'hide':'show';
  return on||'hide';
}
function hintShown(){const m=hintMode();return m!=='hide'&&m!=='neither';}
/* 数选提示：飞系/简码在 s、sx、sxb 码位上提示 23789（有理）与 14560（无理）两组选重字词
   （hint.lua:416-449，须 is_enhanced 打开且未隐藏；象码不在此列） */
const HINT_N1=['2','3','7','8','9'],HINT_N2=['1','4','5','6','0'];
function firstWordFor(prefix){
  for(const [word,codes] of store.dict){
    if(!passSwitches(word))continue;
    if(codes.some(c=>c.startsWith(prefix)))return word;
  }
  return '';
}
function numberSelectHints(code){
  if(!hintGroup()||!hintShown()||isXmScheme()||!opt('is_enhanced'))return null;
  const S='[bpmfdtnlgkhjqxzcsrywv]';
  if(!new RegExp('^(?:'+S+'|'+S+'[a-z]|'+S+'[a-z][aeuio])$').test(code||''))return null;
  const m=hintMode(),out=[];
  for(let j=0;j<5;j++){
    const n1=HINT_N1[j],n2=HINT_N2[j];
    const w1=firstWordFor(code+n1);
    if(!w1)continue;
    const w2=firstWordFor(code+n2);
    if(m==='irrational'){if(w2)out.push({grp:'irr',key:n2,word:w2});}
    else if(m==='both'){out.push({grp:'rat',key:n1,word:w1});if(w2)out.push({grp:'irr',key:n2,word:w2});}
    else out.push({grp:'rat',key:n1,word:w1});
  }
  return out;
}
/* 标点提示（punct 态）：末位为声母时，提示该声母+结构符键对应的标点字（hint.lua:482-488） */
function punctHints(code){
  if(hintMode()!=='punct'||!code)return null;
  const last=code.slice(-1);
  if(!/^[bpmfdtnlgkhjqxzcsrywv]$/.test(last))return null;
  const out=[];
  for(const sym of ["'",',','/',';','.']){
    const w=firstWordFor(last+sym);
    if(w)out.push({key:sym,word:w});
  }
  return out;
}
function getFilteredCandidates(inputCode){
  if(!inputCode||store.dict.size===0)return [];
  const isStatic=isStaticCode(inputCode);
  const pre=inputCode.slice(0,3);
  const raw=[];
  for(const [word,codes] of dictPairsFor(isStatic?'exact':'pre',isStatic?inputCode:pre)){
    const hit=codes.filter(c=>isStatic?c===inputCode:c.startsWith(pre));
    if(hit.length)raw.push({word,codes:hit});
  }
  const out=[];
  for(const item of raw){
    if(!passSwitches(item.word))continue;
    out.push(item);
  }
  /* 排序对齐 Rime：词典权重优先，同权重按常用字频 */
  out.sort((a,b)=>{
    const wa=entryWeight(a.word,inputCode), wb=entryWeight(b.word,inputCode);
    if(wb!==wa)return wb-wa;
    return wordFreqScore(b.word)-wordFreqScore(a.word);
  });
  return out;
}
/* 无理简字：无任何二级简码等于全码前两码 */
function isWuliChar(c){
  const codes=store.dict.get(c);
  if(!codes)return false;
  let maxlen=0;codes.forEach(x=>{if(x.length>maxlen)maxlen=x.length;});
  const full=codes.filter(x=>x.length===maxlen).pop();
  const two=codes.filter(x=>x.length===2);
  if(!two||full.length<2)return false;
  const fp=full.slice(0,2);
  return !two.some(t=>t===fp);
}
function getPage(){
  const all=getFilteredCandidates(store.currentInput);
  const start=store.candidatePage*PAGE_SIZE;
  return {all,page:all.slice(start,start+PAGE_SIZE)};
}
function renderCandidate(){
  if(store.dict.size===0){candBar.textContent='候选文字预览区域（加载词典后显示候选字词）';pageInfoEl.textContent='';return;}
  if(/^[a-z]$/.test(store.currentInput)){renderSingleInitial(store.currentInput);return;}
  renderByCode(store.currentInput);
}
/* 候选预览按方案选重方式：数字选重（空格+数字+结构符+笔画筛选）/ 字母选重（空格+aeuio） */
function renderByCode(code){
  const lookupFirst=(prefix,exclude)=>{
    for(const [word,codes] of dictPairsFor('pre',prefix)){
      if(word===exclude)continue;
      if(!passSwitches(word))continue;
      if(codes.some(c=>c.startsWith(prefix)))return word;
    }
    return '';
  };
  const exact=[];
  for(const [word,codes] of dictPairsFor('exact',code)){if(codes.includes(code)&&passSwitches(word))exact.push(word);}
  exact.sort((a,b)=>entryWeight(b,code)-entryWeight(a,code));
  const keys=selectKeyArr();
  let h='<div class="cand-zone"><div class="cand-zone-title">输入候选</div>';
  if(!isLetterSelect()){
    const first=exact[0]||'';
    const isOriginal=['a','e','u','i','o'].every(k=>store.strokeMap[k]===DEFAULT_STROKE_MAP[k]);
    const phrases=[];
    if(isOriginal)for(const sym of [';',"'",',','/','.']){const w=lookupFirst(code+sym,first);if(w)phrases.push({word:w,sym});}
    if(first){
      const fcs=store.dict.get(first)||[];
      const jm=fcs.filter(c=>c.length<code.length).sort((a,b)=>a.length-b.length)[0]||'';
      h+=`<span class="candidate-item selected"><span class="candidate-num">空格</span>${first}${jm?`<span class="first-jianma">${jm}</span>`:''}</span>`;
    }
    phrases.forEach(p=>{h+=`<span class="candidate-item"><span class="candidate-num">${p.sym}</span>${p.word}</span>`;});
    if(!first&&!phrases.length)h+='<span class="cand-empty">无候选</span>';
    h+='</div><div class="cand-zone"><div class="cand-zone-title">追加笔画候选（按 aeuio 筛选）</div>';
    const strokeHints=[];
    for(const b of ['a','e','u','i','o']){const w=lookupFirst(code+b,first);if(w)strokeHints.push({word:w,b});}
    if(strokeHints.length)strokeHints.forEach(x=>{h+=`<span class="candidate-item"><span class="candidate-num">${x.b}</span>${x.word}</span>`;});
    else h+='<span class="cand-empty">（无）</span>';
    h+='</div>';
    pageInfoEl.textContent=`简码"空格"上屏；简词结构符(;',./)；追加笔画按 aeuio；笔画筛选后仍重码用数字 ${store.selectKeys}`;
  }else{
    if(exact.length){
      exact.slice(0,6).forEach((w,i)=>{
        const lbl=i===0?'空格':keys[i];
        h+=`<span class="candidate-item${i===0?' selected':''}"><span class="candidate-num">${lbl}</span>${w}</span>`;
      });
    }else h+='<span class="cand-empty">无候选</span>';
    h+='</div>';
    pageInfoEl.textContent=`候选按 空格、${[...store.selectKeys].join('、')} 选择（数字键不用于选重）`;
  }
  h+=hintZonesHtml(code);
  candBar.innerHTML=h;pageInfoEl.style.color='';
}
/* 数选提示 / 标点提示区（仅在方案有提示开关且当前态需要时出现） */
function hintZonesHtml(code){
  const nh=numberSelectHints(code)||[],ph=punctHints(code)||[];
  const zone=(title,items)=>{
    if(!items.length)return '';
    let h='<div class="cand-zone"><div class="cand-zone-title">'+esc(title)+'</div>';
    for(const x of items)h+=`<span class="candidate-item"><span class="candidate-num">${esc(x.key)}</span>${esc(x.word)}</span>`;
    return h+'</div>';
  };
  const rat=nh.filter(x=>x.grp!=='irr'),irr=nh.filter(x=>x.grp==='irr');
  switch(hintMode()){
    case 'irrational':return zone('数选提示·无理（14560）',irr);
    case 'both':return zone('数选提示·有理（23789）',rat)+zone('数选提示·无理（14560）',irr);
    case 'punct':return zone('标点提示',ph);
  }
  return zone('数选提示·有理（23789）',rat);
}
function renderSingleInitial(initial){
  let yijian='';
  for(const [word,codes] of dictPairsFor('exact',initial)){
    if([...word].length===1&&codes.includes(initial)){yijian=word;break;}
  }
  let h='<div class="cand-zone"><div class="cand-zone-title">输入候选</div>';
  if(yijian)h+=`<span class="candidate-item selected"><span class="candidate-num">空格</span>${yijian}</span>`;
  else h+='<span class="cand-empty">（该声母无一简字）</span>';
  h+='</div>';
  /* 单声母也是数选/标点提示的码位（hint.lua 的 s 位），一简字下面继续列出提示区 */
  h+=hintZonesHtml(initial);
  candBar.innerHTML=h;
  pageInfoEl.style.color='';
  pageInfoEl.textContent=`一简字按"空格"上屏；无理简字首码后不列出，但仍可按其简码直接输入`;
}
/* 目标当前排在第几候选：返回 {page,key} */
function findTargetRank(){
  const all=getFilteredCandidates(store.currentInput);
  const idx=all.findIndex(x=>x.word===store.targetWord);
  if(idx===-1)return null;
  const pos=idx%PAGE_SIZE;
  return {page:Math.floor(idx/PAGE_SIZE)+1,key:pos===0?'空格':selectKeyArr()[pos]};
}
/* 判定：编码必须是目标某个词典码的前缀；再看选词对不对 */
function validateInput(selected){
  if(!store.currentInput)return;
  const target=store.targetWord;
  let targetCodes=store.dict.get(target);
  if(store.practiceMode==='word_simple'&&targetCodes){const ml=Math.min(...targetCodes.map(c=>c.length));targetCodes=targetCodes.filter(c=>c.length===ml);}
  const count=rec();
  if(count)store.practice.total++;
  let errType=null;
  if(!targetCodes){
    errType='未知词，词典无编码';if(count)store.stat.codeErr++;
  }else{
    const prefixOk=targetCodes.some(c=>c.startsWith(store.currentInput));
    if(!prefixOk){
      errType='编码错误：输入不是目标的合法编码前缀';if(count)store.stat.codeErr++;
    }else if(selected&&selected.word===target){
      errType=null;
    }else{
      const rank=findTargetRank();
      errType='编码正确，但候选选错（重码）'+(rank?`，目标在第${rank.page}页按"${rank.key}"`:'目标未出现在候选');
      if(count)store.stat.selErr++;
    }
  }
  if(errType){
    if(count){store.practice.err++;store.errorLog.push({target,input:store.currentInput,selected:selected?selected.word:'',reason:errType});}
    wordFeedbackEl.className='word-feedback bad';
    wordFeedbackEl.textContent='✗ '+errType;
  }else{
    wordFeedbackEl.className='word-feedback good';
    wordFeedbackEl.textContent='✓ 编码与候选选择正确';
  }
  updateStatPanel();
}
/* 本次练习的统一口径：字词/变换按核对项计，文本跟打·自由按已上屏字数计；
   自由模式与跟打模式的差别只有一处——不统计错字，因此也不参与正确率。 */
function sessionStats(){
  const s=store.stat,p=store.practice;
  if(!isTextMode())
    return {mode:store.practiceMode,vol:p.total,err:p.err,codeErr:s.codeErr,selErr:s.selErr,
      back:s.back,select:s.select,keys:s.keys,wrong:0,countsWrong:true};
  const up=textState.charUp+textState.wordUp,free=store.practiceMode==='text_free';
  return {mode:store.practiceMode,vol:up,err:free?0:textState.wrongChars,codeErr:textState.phraseErr,
    selErr:0,back:textState.backspaces+textState.revisions,select:textState.selection,
    keys:textState.keys,wrong:free?0:textState.wrongChars,countsWrong:!free};
}
/* 历次 = 落库基线 + 本次（含本次，累计到导出时刻） */
function lifeTotals(){
  const b=store.lifeBase,c=sessionStats();
  return {vol:b.total+c.vol,err:b.err+(c.countsWrong?c.err:0),codeErr:b.codeErr+c.codeErr,
    selErr:b.selErr+c.selErr,back:b.back+c.back,select:b.select+c.select,keys:b.keys+c.keys,up:b.up+c.vol};
}
function rateOf(vol,err){return vol>0?(vol-err)/vol*100:null;}
function cmpLabel(cur,all,invert){
  if(cur===null||all===null)return '暂无可比数据';
  const d=cur-all;
  if(Math.abs(d)<1e-9)return '持平';
  const better=invert?d<0:d>0;
  return better?'更高':'更低';
}
function fmtTs(ts){
  const d=new Date(ts),z=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 '+z(d.getHours())+'时'+z(d.getMinutes())+'分'+z(d.getSeconds())+'秒';
}
/* 导出记录：分条文字，一条一项数据 */
function recordExportLines(){
  const c=sessionStats(),l=lifeTotals(),no=c.countsWrong?'':'不统计（自由模式不计错字）';
  const unit=isTextMode()?'字':'项';
  const codeRate=rateOf(c.vol,c.codeErr),lifeCodeRate=rateOf(l.vol,l.codeErr);
  const selRate=c.select>0?rateOf(c.select,c.selErr):null,lifeSelRate=l.select>0?rateOf(l.select,l.selErr):null;
  const flow=c.keys>0?rateOf(c.keys,c.back):null,lifeFlow=l.keys>0?rateOf(l.keys,l.back):null;
  return [
    '练习时间：'+fmtTs(store.sessionStart||Date.now())+' - '+fmtTs(Date.now()),
    '本次练习量：'+c.vol+' '+unit,
    '历次总练习量：'+l.vol+' '+unit,
    '本次正确率：'+(no||((rateOf(c.vol,c.err)||0).toFixed(2)+'%')),
    '历次总正确率：'+((rateOf(l.vol,l.err)||0).toFixed(2)+'%'),
    '本次输入正确率相对于整体：'+(no||cmpLabel(rateOf(c.vol,c.err),rateOf(l.vol,l.err))),
    '本次编码打错：'+c.codeErr+' 次',
    '历次编码打错：'+l.codeErr+' 次',
    '本次编码正确率相对于整体：'+cmpLabel(codeRate,lifeCodeRate),
    '本次选重选错：'+c.selErr+' 次',
    '历次选重选错：'+l.selErr+' 次',
    '本次选择正确率相对于整体：'+(c.select>0?cmpLabel(selRate,lifeSelRate):'本次未使用选重键'),
    '回退/修改：'+c.back+' 次（本次击键 '+c.keys+' 次，选重按键 '+c.select+' 次）',
    '本次输入流畅度相对于整体：'+cmpLabel(flow,lifeFlow),
  ];
}
/* 练习记录改为文字叙述：一句话一项数据，数字在渲染时加粗 */
function recordSentences(){
  const c=sessionStats(),log=store.errorLog||[];
  if(!c.vol&&!c.back&&!c.select)
    return ['本次练习还没有记录。开始输入后，这里会用文字汇总练习量、正确率、错误原因和操作情况。'];
  const rate=(rateOf(c.vol,c.err)||0).toFixed(2);
  const unit=isTextMode()?'字':'个练习项';
  const out=['本次共练习 '+c.vol+' '+unit+'，'+(c.err?'其中 '+c.err+' 处有误':'全部正确')+'，正确率 '+rate+'%。'];
  const e=[];
  if(c.codeErr)e.push('编码/上屏不符 '+c.codeErr+' 次');
  if(c.selErr)e.push('候选选错 '+c.selErr+' 次');
  out.push(e.length?'错误集中在：'+e.join('，')+'。':'没有出现编码或候选选择错误。');
  out.push((c.back||c.select)?'操作情况：退格/修改 '+c.back+' 次，选重 '+c.select+' 次。':'操作情况：全程未退格，也未使用选重键。');
  const last=log[log.length-1];
  if(last)out.push('最近一次错误：目标「'+(last.target||'—')+'」实际上屏「'+(last.selected||'无')+'」，原因为'+(last.reason||'未记录')+'。');
  return out;
}
function updateStatPanel(){
  const box=document.querySelector('.record-stat');
  if(!box)return;
  box.innerHTML=recordSentences()
    .map(t=>'<div class="rec-line">'+esc(t).replace(/(\d+(?:\.\d+)?%?)/g,'<b>$1</b>')+'</div>')
    .join('');
}
function resetInput(){
  store.currentInput='';store.candidatePage=0;store.selectedIndex=0;
  inputEl.value='';renderCandidate();
}
/* 拆字提示：各字一组，竖线分隔（cf 拆字表） */
function buildCfHtml(word){
  const groups=[...word].map(c=>{
    const cf=store.cf.get(c);
    return `<span class="cf-group">${cf||'？'}</span>`;
  });
  return groups.join('<span class="cf-sep">｜</span>');
}
