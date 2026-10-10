/* ================= 编码变换专项 =================
   变换逻辑不自造：读取方案 key_binder 中带 match 的 send_sequence（Tab / Shift+空格 /
   撇号 / 分号），加上 speller/popping 里 accept 为大写字母的顶屏规则，
   用 composing 解释器在本地重放 —— 光标 {Home}{Right}{Left}、插入字符、
   {space} 上屏"光标前那一段"的首选候选（键序里的裸数字＝选第 N 个候选）。
   出题 = 按规则自身的提交切分拼码（每段都取词典候选），跑通才收录，
   所以"变换"与"常规"两条键序必然得到同一串上屏文本；
   出好的题按变换方式分桶、桶内洗牌、桶间轮转，相邻两题不重复同一种变换。 */
function parseSeq(sq){
  const out=[];const re=/\{([^}]+)\}|([\s\S])/g;let m;
  while((m=re.exec(sq||''))){if(m[1])out.push({op:m[1]});else out.push({lit:m[2]});}
  return out;
}
function newTf(){return {buf:'',cur:0,out:'',pick:0,pg:0,log:[]};}
function tfInsert(st,ch){st.buf=st.buf.slice(0,st.cur)+ch+st.buf.slice(st.cur);st.cur++;}
/* 上屏"光标之前"那一段：光标停在最后时整段上屏（对应键序末尾那个 {space}）；
   段尾的分词符（' ; 等）不是编码的一部分，查词前先去掉 */
function tfCommitSeg(st){
  if(!st.buf)return true;
  const seg=st.cur>0?st.buf.slice(0,st.cur):st.buf;
  const key=seg.replace(/[';,./]+$/,'');
  if(!key)return false;
  const idx=st.pg*PAGE_SIZE+(st.pick||0);
  const c=(tfLookup(key)||[])[idx];
  if(!c)return false;
  st.out+=c.word;
  st.log.push({seg,key,pick:st.pick||0,pg:st.pg,word:c.word});
  st.buf=st.buf.slice(seg.length);st.cur=st.buf.length;st.pick=0;st.pg=0;
  return true;
}
/* 只建模练习端能真实重放的动作；出现 Left/End/Shift+… 等未建模动作即判定失败，该规则不参与出题 */
function tfRun(st,tok){
  if(tok.lit!==undefined){
    const ch=tok.lit;
    if(/^[0-9]$/.test(ch)){
      const n=+ch;
      if(!n)return false;
      /* send 里的裸数字＝选第 N 个候选（无理数选），与方案选重键是字母还是数字无关 */
      st.pick=n-1;return true;
    }
    tfInsert(st,ch);return true;
  }
  switch(tok.op){
    case 'Home':st.cur=0;return true;
    case 'Right':st.cur=Math.min(st.buf.length,st.cur+1);return true;
    case 'Left':st.cur=Math.max(0,st.cur-1);return true;
    case 'space':return tfCommitSeg(st);
    case 'apostrophe':tfInsert(st,"'");return true;
    /* 方案常用 {Page_Down}<数字> 实现"无理数选"：翻页等价于练习端的 Tab 翻页 */
    case 'Page_Down':st.pg++;return true;
    case 'Page_Up':st.pg=Math.max(0,st.pg-1);return true;
    default:return false;
  }
}
function tfExec(st,seq){for(const tok of seq)if(!tfRun(st,tok))return false;return true;}
const TF_LABEL={Tab:'Tab','Shift+space':'Shift+空格',"'":"撇号",';':'分号'};
const TF_KEYS=['空格','Tab','Shift+空格','撇号','分号'];
function tfLabel(a){return TF_LABEL[a]||a;}
/* 出题期间的候选查询缓存：一次出题要模拟成百上千个码，同一前缀（b / d5 / kr…）反复出现，
   不去重会把全词典扫描重复做几万次。每次重新出题/换开关都清空，保证与当前开关一致。 */
let _tfCache=new Map();
function tfLookup(key){
  if(_tfVirtual)return _TF_VIRT;
  let v=_tfCache.get(key);
  if(v===undefined){v=getFilteredCandidates(key)||[];_tfCache.set(key,v);}
  return v;
}
/* 长度推演用的虚拟候选：任何编码段都算取得到首选，用来问出"这条规则会在哪些位置切段上屏" */
let _tfVirtual=false;
const _TF_VIRT=[{word:'字'},{word:'字'},{word:'字'},{word:'字'},{word:'字'},{word:'字'}];
/* 变换后仍需按一次空格才出字的规则：补这次空格（计入变换键序），只排除"变换＝常规、只是多按一个键"的空转题 */
function tfTrivial(st,code){
  return st.log.length===1&&st.log[0].key===code&&!st.log[0].pick&&!st.log[0].pg&&[...st.out].length===1;
}
/* 用规则 r 完整推演编码 code：残留编码、有未建模动作、上屏不足两字都算失败。
   编码里的数字是词典码的一部分（无理码），直接进组合串；键序里的数字才是选重键。 */
function tfSimulate(r,code){
  const st=newTf();
  for(const ch of code)tfInsert(st,ch);
  if(!tfExec(st,parseSeq(r.seq)))return null;
  if(st.buf&&!tfCommitSeg(st))return null;
  if(st.buf)return null;
  if([...st.out].length<2)return null;
  if(tfTrivial(st,code))return null;
  return st;
}
/* 只取"切段长度"：把规则跑一遍（候选用虚拟值），得到该码长下规则实际的提交切分，如 [2,3] */
function tfLenPlan(r,len){
  const st=newTf();
  for(let i=0;i<len;i++)tfInsert(st,'b');
  _tfVirtual=true;
  let ok=tfExec(st,parseSeq(r.seq));
  if(ok&&st.buf)ok=tfCommitSeg(st);
  _tfVirtual=false;
  if(!ok||st.buf||st.log.length<2)return null;
  const plan=st.log.map(x=>x.key.length);
  return plan.reduce((a,b)=>a+b,0)===len?plan:null;
}
/* 顶屏（popping）推演：prefix>0 顶屏前 prefix 位首选，无 prefix 则整段顶屏；顶屏恒走首选 */
function tfPopCommit(st,prefix){
  if(!st.buf)return false;
  const n=(typeof prefix==='number'&&prefix>0)?Math.min(prefix,st.buf.length):st.buf.length;
  const key=st.buf.slice(0,n);
  const c=(tfLookup(key)||[])[st.pg*PAGE_SIZE];
  if(!c)return false;
  st.out+=c.word;
  st.log.push({seg:key,key,pick:0,pg:0,word:c.word});
  st.buf=st.buf.slice(n);st.cur=st.buf.length;st.pick=0;st.pg=0;
  return true;
}
/* 顶屏题：编码串 code 命中规则 → 按 letter 的大写顶屏 → 剩余编码并入该字母 → 空格上屏 */
function tfSimPop(r,code,letter){
  const st=newTf();
  for(const ch of code)tfInsert(st,ch);
  if(!tfPopCommit(st,r.prefix))return null;
  tfInsert(st,letter.toLowerCase());
  if(!tfCommitSeg(st))return null;
  if(st.buf)return null;
  if([...st.out].length<2)return null;
  return st;
}
/* 可出题的大写顶屏规则：strategy=append/ignore 不顶屏，非大写字母的 accept 不算变换题型 */
function tfPopRules(){
  return (store.poppingRules||[]).filter(r=>r.accept==='[A-Z]'&&!r.strategy&&(!r.when||optionActive(r.when))&&r.match);
}
/* 出题用的码表索引：只收字母与数字组成、长度合规、当前开关下可见的词典码，按词典原序（≈词频序）。
   开关或方案一变即失效重建，避免每条规则都全词典扫描。 */
function tfCodeIndex(){
  const sig=store.schemaId+'|'+store.dict.size+'|'+JSON.stringify(store.opt);
  if(store._tfSig===sig)return store._tfCodes;
  const arr=[];
  for(const [word,codes] of store.dict){
    if(!passSwitches(word))continue;
    for(const code of codes)if(code.length<=8&&/^[a-z0-9]+$/.test(code))arr.push({word,code});
  }
  store._tfSig=sig;store._tfCodes=arr;
  return arr;
}
/* 该方案自己的数选键：把"翻 p 页选第 q 个"还原成用户实际按下的那一个键。
   pg=0 时首页首选就是空格、选重就是字面数字，本来就准确，不需要替换。 */
function tfSelectKeyFor(key,pg,pick){
  if(!pg)return null;
  const want=pick?selectKeyArr()[pick]:'';
  for(const s of (store.tfSelectRules||[])){
    if(s.pg!==pg||s.pick!==want)continue;
    if(!preg(s.match).test(key))continue;
    return s.accept;
  }
  return null;
}
const TF_SEG_NAME=n=>n===1?'一简':n===2?'二简':n===3?'三简':n+'码';
/* 变换方式名：按本次变换一次上屏的几段、每段码长与字/词命名，如「二简字+二简字 → Shift+空格」 */
function tfKind(segs,accept){
  return segs.map(s=>TF_SEG_NAME(s.key.length)+([...s.word].length>1?'词':'字')).join('+')+' → '+accept;
}
function tfItem(r,code,st,combo,pop){
  const normal=[],segs=[];
  for(const s of st.log){
    normal.push(...[...s.key]);
    const sk=tfSelectKeyFor(s.key,s.pg,s.pick);
    if(sk!==null)normal.push(sk);
    else{
      for(let p=0;p<s.pg;p++)normal.push('Tab');
      normal.push(s.pick?selectKeyArr()[s.pick]:'空格');
    }
    segs.push({key:s.key,pick:s.pick,pg:s.pg,word:s.word});
  }
  const accept=pop?TF_POP_LABEL:tfLabel(r.accept);
  const trans=pop?[...code,pop.letter.toUpperCase(),'空格']:[...code,tfLabel(r.accept)];
  return {word:st.out,code,normal,trans,segs,combo:!!combo,accept,kind:tfKind(segs,accept),
    letter:pop?pop.letter:'',
    note:'变换指引：键入 '+code+' 后按 '+accept+'，'+segs.length+' 段一次上屏（常规 '+normal.length+' 键 → 变换 '+trans.length+' 键，'+(combo?'组合编码':'词典编码')+'）'};
}
/* 出题池：词典真实编码按码长分组（当前开关下可见、词典原序≈词频序） */
function tfPoolsByLen(){
  const sig=store.schemaId+'|'+store.dict.size+'|'+JSON.stringify(store.opt);
  if(store._tfLenSig===sig)return store._tfLenPools;
  const by={};
  for(const it of tfCodeIndex()){
    const L=it.code.length;
    if(!by[L])by[L]=[];
    if(by[L].length<TF_POOL_CAP)by[L].push(it.code);
  }
  store._tfLenSig=sig;store._tfLenPools=by;
  return by;
}
/* 按规则自己的提交切分（如 [2,3]）逐段拼码：外层轮转首段、同一首段凑满 quota 就换下一个，
   保证组合题既覆盖多个声母，又必然落在规则的切分位上（三段以上的规则只有这样才拼得出来） */
function tfEachPlan(pools,r,quota,take,stop){
  for(let len=2;len<=8;len++){
    const plan=tfLenPlan(r,len);
    if(!plan||plan.length<2)continue;
    const lists=plan.map(n=>pools[n]||[]);
    if(lists.some(l=>!l.length))continue;
    let tried=0;
    for(const head of lists[0]){
      if(stop()||tried>=TF_PLAN_TRIED)break;
      let per=0;
      const walk=(d,acc)=>{
        if(d===lists.length){tried++;if(take(acc))per++;return stop()||per>=quota||tried>=TF_PLAN_TRIED;}
        for(const seg of lists[d]){
          if(stop()||per>=quota||tried>=TF_PLAN_TRIED)return true;
          if(walk(d+1,acc+seg))return true;
        }
        return false;
      };
      walk(1,head);
    }
  }
}
/* 顶屏题：取码长为 prefix 的词典码做前段，再取一个词典码 tail，把它的末位当作触发大写字母 */
function tfPopEach(pools,r,take,stop){
  const re=preg(r.match),prefix=(typeof r.prefix==='number'&&r.prefix>0)?r.prefix:0;
  const heads=prefix?(pools[prefix]||[]):(pools[2]||[]).concat(pools[3]||[]);
  if(!heads.length)return;
  const tails=[];
  for(let n=prefix?2:1;n<=5;n++)for(const c of (pools[n]||[]))tails.push(c);
  let tried=0;
  for(const a of heads){
    if(stop()||tried>=TF_PLAN_TRIED)break;
    let per=0;
    for(const b of tails){
      if(stop()||per>=TF_QUOTA||tried>=TF_PLAN_TRIED)break;
      const code=prefix?a+b.slice(0,-1):a, letter=prefix?b.slice(-1):b;
      if(code.length>8||letter.length!==1||!re.test(code))continue;
      tried++;
      if(take(code,letter))per++;
    }
  }
}
const TF_TAKE=30, TF_TRIED=120, TF_QUOTA=60, TF_PLAN_TRIED=2400, TF_POOL_CAP=80;
const TF_POP_LABEL='大写顶屏';
function buildTransformList(){
  const rules=store.tfRules||[],index=tfCodeIndex(),pools=tfPoolsByLen(),buckets=[];
  const seen=new Set();
  _tfCache=new Map();
  for(const r of rules){
    const re=preg(r.match),group=[];
    const hit=(code,combo)=>{
      if(!re.test(code))return false;
      const sim=tfSimulate(r,code);
      if(!sim||seen.has(sim.out))return false;
      seen.add(sim.out);group.push(tfItem(r,code,sim,combo));
      return true;
    };
    let tried=0;
    for(const it of index){
      if(group.length>=TF_TAKE||tried>=TF_TRIED)break;
      if(!re.test(it.code))continue;
      tried++;
      hit(it.code,false);
    }
    const stop=()=>group.length>=TF_TAKE+TF_QUOTA;
    tfEachPlan(pools,r,Math.max(2,Math.ceil(TF_QUOTA/Math.min(list0(pools,r),TF_POOL_CAP))),hit,stop);
    /* 单段规则（只需再按一次空格上屏）拼不出组合码，词典扫描也不该只取前 120 条：
       这类规则的可用题往往排在很后面（要选到第 N 个候选才有差异） */
    if(!group.length)for(const it of index){
      if(group.length>=TF_TAKE)break;
      if(!re.test(it.code))continue;
      hit(it.code,false);
    }
    if(group.length)buckets.push(group);
  }
  for(const r of tfPopRules()){
    const group=[];
    tfPopEach(pools,r,(code,letter)=>{
      /* 答题时走 checkPopping 的规则序：只有这条真正生效时才出题，避免出题/答题两套判定分叉 */
      if(checkPopping(code,letter.toUpperCase())!==r)return false;
      const sim=tfSimPop(r,code,letter);
      if(!sim||seen.has(sim.out))return false;
      seen.add(sim.out);group.push(tfItem(r,code,sim,true,{letter}));
      return true;
    },()=>group.length>=TF_QUOTA);
    if(group.length)buckets.push(group);
  }
  return tfWeave(buckets);
}
function list0(pools,r){let n=0;for(let len=2;len<=8;len++){const p=tfLenPlan(r,len);if(p&&p.length>=2)n=Math.max(n,(pools[p[0]]||[]).length);}return n||1;}
/* 穿插出题：桶＝一条变换规则（同一 accept 键下往往有多条规则，如简码/词组）。
   发牌优先换 accept 键，其次换规则；候选里取"剩余量接近最大值"的一批随机发，
   兼顾各方式题量均衡与顺序随机。 */
function tfWeave(buckets){
  const bs=buckets.filter(b=>b.length).map(b=>{
    const a=b.slice();
    for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}
    return {items:a,accept:a[0].accept};
  });
  const total=bs.reduce((n,b)=>n+b.items.length,0);
  const out=[];
  const stage=(list)=>{
    if(!list.length)return null;
    const mx=Math.max(...list.map(b=>b.items.length));
    const pick=list.filter(b=>b.items.length>=mx*0.7);
    return pick[Math.floor(Math.random()*pick.length)];
  };
  while(out.length<total){
    const lastItem=out.length?out[out.length-1]:null;
    const nonEmpty=bs.filter(b=>b.items.length);
    if(!nonEmpty.length)break;
    /* 优先换变换键；换不了（该键题量占多数）时至少换一种变换方式 */
    let list=lastItem?nonEmpty.filter(b=>b.accept!==lastItem.accept):nonEmpty;
    if(!list.length&&lastItem)list=nonEmpty.filter(b=>b.items[0].kind!==lastItem.kind);
    const b=stage(list)||stage(nonEmpty);
    out.push(b.items.shift());
  }
  return out;
}
/* 变换专项按键：与出题走同一个解释器 */
function tfApply(st,seq){
  const cp={buf:st.buf,cur:st.cur,out:st.out,pick:st.pick,pg:st.pg,log:st.log.slice()};
  if(!tfExec(cp,seq))return false;
  Object.assign(st,cp);st.log=cp.log;
  return true;
}
function tfOnKey(e){
  const st=store.tf;let k=e.key;
  if(k==='Backspace'){
    e.preventDefault();
    if(st.cur>0){st.buf=st.buf.slice(0,st.cur-1)+st.buf.slice(st.cur);st.cur--;statBack();}
    else if(st.log.length){
      const last=st.log.pop();
      st.out=st.out.slice(0,st.out.length-[...last.word].length);
      st.buf=last.seg+st.buf;st.cur=last.seg.length;statBack();
    }
    tfSync();return;
  }
  if(k==='Tab'||k==="'"||k===';'||(k===' '&&e.shiftKey)){
    e.preventDefault();
    const accept=k==='Tab'?'Tab':(k===' '?'Shift+space':k);
    const r=(store.tfRules||[]).find(x=>x.accept===accept&&preg(x.match).test(st.buf));
    if(r)tfApply(st,parseSeq(r.seq));
    else if(k==="'"||k===';')tfInsert(st,k);
    tfSync();return;
  }
  if(k===' '){e.preventDefault();tfCommitSeg(st);tfSync();return;}
  if(k==='Enter'){e.preventDefault();tfFinish();return;}
  /* 数字在变换专项里是词典码的一部分（无理码含 14560），按字面进组合串 */
  if(/^[0-9]$/.test(k)){e.preventDefault();tfInsert(st,k);tfSync();return;}
  if(/^[A-Za-z]$/.test(k)){
    e.preventDefault();
    /* 大写字母：按 popping 规则顶屏（有 prefix 顶前缀位、无 prefix 顶整段首选），再以小写继续 */
    if(/[A-Z]/.test(k)){
      const r=checkPopping(st.buf,k);
      if(r&&!r.strategy)tfPopCommit(st,r.prefix);
      k=k.toLowerCase();
    }
    tfInsert(st,k);tfSync();return;
  }
}
/* 候选区是这一串里最重的一块（词典扫查 + 整片重渲染）：从前它排在判定前头，
   判定那句话被顶到它后面 —— 按下变换键「卡一下才判对错」就出在这一步。
   现在判定当场画、候选区合并进单独一趟再重画：只排一次队，画的时候读最新状态
   （答错重置后队列里那次读到的是空串，反而比原来的同步渲染更对）。 */
let tfCandPending=false;
function renderCandidateSoon(){
  if(tfCandPending)return;
  tfCandPending=true;
  setTimeout(()=>{ tfCandPending=false; renderCandidate(); },0);
}
function tfSync(){
  const t=store.transformTarget,st=store.tf;
  inputEl.value=st.buf;store.currentInput=st.buf;
  store.candidatePage=0;store.selectedIndex=0;
  try{inputEl.setSelectionRange(st.cur,st.cur);}catch(err){}
  /* 判定先画：按下变换键的同一拍里就把「已上屏 / 对 / 错」写到屏上，不等候选区 */
  if(t&&wordFeedbackEl){
    const bad=st.out&&!t.word.startsWith(st.out);
    wordFeedbackEl.className='word-feedback'+(st.out?(bad?' bad':''):'');
    wordFeedbackEl.textContent=st.out?('已上屏：'+st.out):'';
  }
  renderCandidateSoon();
  if(!t)return;
  if(st.out===t.word){
    validateTransform(true);nextTransform();
    /* 与字词练习一致：切换下一题后保留 ✓，直到用户下一次输入才清除 */
    if(wordFeedbackEl){wordFeedbackEl.className='word-feedback good';wordFeedbackEl.textContent='✓ 编码变换正确';}
    return;
  }
  if(st.out&&!t.word.startsWith(st.out)){
    validateTransform(false);
    store.tf=newTf();inputEl.value='';store.currentInput='';
  }
}
function tfFinish(){
  const t=store.transformTarget,st=store.tf;
  if(!t){nextTransform();return;}
  if(st.out===t.word)validateTransform(true);
  else if(st.out)validateTransform(false);
  nextTransform();
}
function showTransform(i){
  if(!store.transformList||!store.transformList.length)store.transformList=buildTransformList();
  const row=document.getElementById('hintCodeRow'),cfRow=document.getElementById('cfHintRow');
  if(!store.transformList.length){
    store.transformTarget=null;store.transformIndex=0;store.tf=newTf();
    targetWordEl.textContent='—';
    if(row)row.style.display='none';if(cfRow)cfRow.style.display='none';
    document.getElementById('explainLine').innerHTML=
      '<div class="explain-box"><div class="rule-kind">当前方案没有可在练习端模拟的变换键绑定（key_binder 中无 match + send_sequence 规则）。</div></div>';
    inputEl.value='';store.currentInput='';renderCandidate();
    return;
  }
  if(i>=store.transformList.length){store.transformList=buildTransformList();i=0;}
  const t=store.transformList[i];
  store.transformIndex=i;store.transformTarget=t;store.tf=newTf();
  targetWordEl.textContent=t.word;
  if(row)row.style.display='none';if(cfRow)cfRow.style.display='none';
  document.getElementById('explainLine').innerHTML=explainTransform(t);
  inputEl.value='';store.currentInput='';
  if(wordFeedbackEl){wordFeedbackEl.textContent='';wordFeedbackEl.className='word-feedback';}
  renderCandidateSoon();
}
function nextTransform(){showTransform((store.transformIndex||0)+1);}
function validateTransform(ok){
  if(rec()){
    store.practice.total++;
    if(!ok){store.practice.err++;store.errorLog.push({target:store.transformTarget?store.transformTarget.word:'',input:store.tf.buf,selected:store.tf.out,reason:'变换上屏与目标不一致'});}
  }
  if(wordFeedbackEl){
    wordFeedbackEl.className='word-feedback '+(ok?'good':'bad');
    wordFeedbackEl.textContent=ok?'✓ 编码变换正确':'✗ 变换上屏与目标不一致';
  }
  updateStatPanel();
}
/* 变换专项提示：只有「变换指引」和「常规」两条；
   全提示=两条都显示，仅提示常规编码=隐去变换指引，无编码提示=两条都隐去。
   t.kind（变换方式）只用于内部分桶与自检，题目上不显示。 */
function explainTransform(t){
  const fmt=keys=>keys.map(k=>TF_KEYS.includes(k)
    ?'<span class="tk-sp">'+esc(k)+'</span>'
    :'<b class="ec-key">'+esc(k)+'</b>').join('');
  const lv=tfHintLv();
  let h='<div class="explain-box">';
  if(lv==='full'){
    h+='<div class="tf-guide">变换指引：'+(t.letter
      ?'键入 <b>'+esc(t.code)+'</b> 后把 <b>'+esc(t.letter.toUpperCase())+'</b> 打成大写顶屏，'+t.segs.length+' 段一次上屏（常规 <b class="ec-count">'+t.normal.length+'</b> 键 → 变换 <b class="ec-count">'+t.trans.length+'</b> 键，'+(t.combo?'组合编码':'词典编码')+'）'
      :'键入 <b>'+esc(t.code)+'</b> 后按 <b>'+esc(t.accept)+'</b>，'+t.segs.length+' 段一次上屏（常规 <b class="ec-count">'+t.normal.length+'</b> 键 → 变换 <b class="ec-count">'+t.trans.length+'</b> 键，'+(t.combo?'组合编码':'词典编码')+'）')
      +'</div>';
  }
  if(lv!=='none')h+='<div class="explain-row"><span class="lbl">常规：</span>'+fmt(t.normal)+'</div>';
  h+='</div>';
  return h;
}
/* 模式提示：单一来源，切换/恢复/刷新面板时都走这里，避免分支互相覆盖 */
function modeTipText(){
  const sn=store.schemeName||'当前';
  const REFRESH='如果提示没有即时更新，请F5/Ctrl R手动刷新。';
  const ENTER='无论是否输入，按下Enter 可以快速切换到下一个练习词。';
  switch(store.practiceMode){
    case 'transform':return '当前练习模式为【'+sn+'】字词练习的【编码变换】模式，请切换到英文输入进行练习。\n你仅能使用【组合变换编码】，其他编码（常规输入编码）将暂时被视为错误项。\n'+ENTER+'\n'+REFRESH;
    case 'word_simple':return '当前练习模式为【'+sn+'】字词练习的【简码】模式，请切换到英文输入进行练习。\n你仅能使用简码，其他编码（全码）将暂时被视为错误项。\n'+ENTER+'\n'+REFRESH;
    case 'word_full':return '当前练习模式为【'+sn+'】字词练习的【全量】模式，请切换到英文输入进行练习。\n'+ENTER+'\n'+REFRESH;
    case 'text_follow':return '当前练习模式为【'+sn+'】文本练习的【跟打】模式，请切换到【'+sn+'】的中文输入进行练习。\n你需要载入跟打文本，才能开始跟打练习。\n'+REFRESH;
    default:return '当前练习模式为【'+sn+'】文本练习的【自由】模式，请切换到【'+sn+'】的中文输入进行练习。\n自由模式无提示、无核对，仅测速。\n'+REFRESH;
  }
}
function updateModeTip(){if(!modeTipEl)return;modeTipEl.style.whiteSpace='pre-line';modeTipEl.textContent=modeTipText();}
/* 第一次进入练习器、或选择方案文件后第一次进入新方案的练习页面：
   练习模式=字词全量、练习强度=全提示、随机强度=完全顺序 */
function applyPracticeDefaults(){
  store.practiceMode='word_full';
  store.practiceIntensity='full';
  store.tfIntensity='full';
  store.config.random_strength='seq';
  practiceModeSel.value='word_full';
  practiceIntensitySel.value='full';
  randomStrengthSel.value='seq';
  updateModeTip();applyPanels();
  saveSettings();
}
practiceModeSel.addEventListener('change',async e=>{
  store.practiceMode=e.target.value;
  updateModeTip();
  if(store.practiceMode==='text_free'){store.practiceIntensity='none';practiceIntensitySel.value='none';}
  applyPanels();
  if(isWordMode()&&store.dict.size){
    if(store.practiceMode==='transform'){store.transformList=buildTransformList();showTransform(0);}
    else nextWord();
  }
  await saveSettings();
});
/* ===================== 方案个性化设置区 =====================
   控件全部来自当前 schema 的 switches（yaml 里没有的开关一律不显示），
   标签优先用 yaml 的 states，缺失时用下表兜底。
   info:1 的开关只影响顶屏时序/整句，英文练习端无法真实模拟，
   故只在文本跟打/自由端只读展示当前态；ascii_mode/ascii_punct/auto_inline/show_es 不显示。 */
const SW_SPEC={
  'zh_trad':{label:'简繁',labels:['简体','繁体'],note:'zh_trad'},
  'pro_char':{label:'字词模式',labels:['词组','单字'],note:'pro_char'},
  'pro_word|pro_char':{label:'字词模式',labels:['词组','单字'],note:'pro_word / pro_char'},
  'pro_word|pro_char|delayed_pop':{label:'字词模式',labels:['词组','单字','延顶'],note:'pro_word / pro_char / delayed_pop'},
  'pure_char':{label:'纯单',labels:['关','开'],note:'pure_char（仅象码）'},
  'delayed_pop':{label:'延顶',labels:['关','开'],note:'delayed_pop',info:1},
  'third_pop':{label:'三码顶',labels:['关','开'],note:'third_pop',info:1},
  'slow_pop|fast_pop|rapid_pop':{label:'顶速',labels:['慢顶','快顶','速顶'],note:'slow_pop / fast_pop / rapid_pop',info:1},
  'fast_pop':{label:'快顶',labels:['关','开'],note:'fast_pop',info:1},
  'is_buffered':{label:'输入缓冲',labels:['关','开'],note:'is_buffered',info:1},
  'is_enhanced':{label:'增强编码',labels:['常规','增强'],note:'is_enhanced'},
  'enhanced_char':{label:'增强单字',labels:['关','开'],note:'enhanced_char（仅简码）'},
  'single_display':{label:'单字显示',labels:['关','开'],note:'single_display'},
  'is_hidden':{label:'提示模式',labels:['显示提示','隐藏提示'],note:'is_hidden'},
  'hide|rational|irrational|both':{label:'提示模式',labels:['隐藏','有理','无理','两者'],note:'hide / rational / irrational / both'},
  'hide|rational|irrational|both|neither':{label:'提示模式',labels:['隐藏','有理','无理','两者','都不'],note:'… / neither'},
  'hide|rational|irrational|both|punct':{label:'提示模式',labels:['隐藏','有理','无理','两者','标点'],note:'… / punct'},
  'free|fixed|popping':{label:'整句模式',labels:['自由','固定','顶功'],note:'free / fixed / popping',info:1},
  'free|fixed|popping|mixed':{label:'整句模式',labels:['自由','固定','顶功','混合'],note:'… / mixed',info:1},
  'postpone':{label:'上屏次序',labels:['前置','后置'],note:'postpone',info:1},
  'back_insert':{label:'回插',labels:['关','开'],note:'back_insert',info:1},
  'tab_word|space_word|none_word':{label:'多字上词',labels:['Tab 上词','空格上词','不上词'],note:'tab_word / space_word / none_word'}
};
const CTL_STYLE='width:100%;padding:5px 8px;border:var(--bw) solid var(--card-border);border-radius:var(--r-btn,5px);background:var(--input-bg);color:var(--text);font:inherit;';
/* 旧的“方案模式/过滤强度”固定下拉由上面的动态控件区取代 */
for(const id of ['modeSelect','filterStrength']){
  const el0=document.getElementById(id),row=el0&&el0.closest('.param-row');
  if(row)row.style.display='none';
}
function filterStrengthApplies(){
  const c=store.config.spec||{};
  return c.enable_filtering===true;
}
function ctlBox(){
  let box=document.getElementById('schemeCtlBox');
  if(box)return box;
  const anchor=document.getElementById('randomStrengthRow');
  if(!anchor)return null;
  box=document.createElement('div');
  box.id='schemeCtlBox';
  anchor.insertAdjacentElement('afterend',box);
  box.addEventListener('change',async e=>{
    const sel=e.target;
    if(sel.dataset.sw){
      const g=(store.switches||[]).find(x=>x.key===sel.dataset.sw);
      if(g)setOptAt(g,+sel.value);
    }else if(sel.dataset.cfg==='filter_strength'){
      store.config.filter_strength=Math.min(6,Math.max(3,+sel.value));
    }else return;
    buildSortedList();renderCandidate();
    if(store.practiceMode==='transform'){store.transformList=buildTransformList();showTransform(0);}
    else if(isWordMode()&&store.dict.size&&store.targetWord)nextWord();
    renderSchemeControls();
    await saveSchemeSettings();
  });
  return box;
}
function switchLabels(g,sp){
  const need=g.binary?2:g.names.length;
  return (g.states&&g.states.length>=need)?g.states.slice(0,need):sp.labels;
}
function switchIndex(g){
  return g.binary?(store.opt[g.names[0]]?1:0):Math.max(0,g.names.findIndex(n=>store.opt[n]));
}
function switchDefault(g){
  return g.binary?(g.reset===1?1:0):(typeof g.reset==='number'?g.reset:0);
}
function renderSchemeControls(){
  const box=ctlBox();
  if(!box)return;
  const groups=(store.switches||[]).filter(g=>SW_SPEC[g.key]);
  const ro=isTextMode();
  const ctls=ro?[]:groups.filter(g=>!SW_SPEC[g.key].info);
  const infos=ro?[]:groups.filter(g=>SW_SPEC[g.key].info);
  let h='';
  if(store.schemaId||ctls.length){
    h+='<div class="group-title">🎛 方案个性化设置'+(store.schemeName?(' · '+esc(store.schemeName)):'')+'</div>';
    h+='<div class="col-desc">'+(ro
      ?'练习器无法调整输入法的设置，输入状态以本地输入法设置为准。'
      :'字词练习的本质是模拟输入过程、外显输入编码，部分设置在这个模拟过程里体现不出来。')+'</div>';
    if(ro){
      const lines=groups.map(g=>{
        const sp=SW_SPEC[g.key];
        return esc(sp.label)+' '+esc(switchLabels(g,sp)[switchIndex(g)]||'');
      });
      if(filterStrengthApplies())lines.push('过滤强度 '+store.config.filter_strength);
      h+='<div class="col-desc">'+(lines.length?lines.join('　'):'该方案没有个性化开关。')+'</div>';
    }else{
      if(!ctls.length&&!filterStrengthApplies())h+='<div class="col-desc">该方案没有可在练习端切换的个性化开关。</div>';
      for(const g of ctls){
        const sp=SW_SPEC[g.key],labels=switchLabels(g,sp);
        const need=g.binary?2:g.names.length,cur=switchIndex(g),def=switchDefault(g);
        let opts='';
        for(let i=0;i<need;i++)opts+='<option value="'+i+'"'+(i===cur?' selected':'')+'>'+esc(labels[i]||'')+(i===def?'（方案默认）':'')+'</option>';
        h+='<div class="param-row"><label>'+sp.label+'<span style="opacity:.55;font-size:.857em"> '+esc(sp.note)+'</span></label>'
          +'<select data-sw="'+esc(g.key)+'" style="'+CTL_STYLE+'">'+opts+'</select></div>';
      }
      if(filterStrengthApplies()){
        const fs=store.config.filter_strength,def=(store.config.spec||{}).filter_strength||4;
        h+='<div class="param-row"><label>过滤强度<span style="opacity:.55;font-size:.857em"> filter_strength</span></label>'
          +'<select data-cfg="filter_strength" style="'+CTL_STYLE+'">'
          +[3,4,5,6].map(v=>'<option value="'+v+'"'+(v===fs?' selected':'')+'>'+v+(v===def?'（方案默认）':'')+(v===3?'（不过滤）':'')+'</option>').join('')
          +'</select></div>';
      }
      if(infos.length){
        h+='<div class="col-desc" style="margin-top:2px;">时序开关（仅展示）：'
          +infos.map(g=>esc(SW_SPEC[g.key].label)+' '+esc(switchLabels(g,SW_SPEC[g.key])[switchIndex(g)]||'关')).join('　')+'</div>';
      }
    }
    const tot=(store.poppingRules||[]).length;
    if(tot){
      const live=store.poppingRules.filter(r=>optionActive(r.when)).length;
      h+='<div class="col-desc" style="margin-top:2px;">顶屏规则 '+tot+' 条，当前开关组合下起作用的 '+live+' 条。</div>';
    }
    const c=store.config.spec||{};
    const rd=[];
    if(c.max_code_length)rd.push('最长码 '+c.max_code_length);
    if(c.max_phrase_length)rd.push('词组最长 '+c.max_phrase_length+' 字');
    if(c.single_selection!==null&&c.single_selection!==undefined)rd.push('单字选重 '+(c.single_selection?'开':'关'));
    if(c.forced_selection!==null&&c.forced_selection!==undefined)rd.push('强制选重 '+(c.forced_selection?'开':'关'));
    if(rd.length)h+='<div class="col-desc scheme-spec-readout" id="schemeSpecReadout" style="display:none;">部署参数：'+rd.join('　')+'</div>';
  }
  box.innerHTML=h;
  applySpecReadout();
}
/* 部署参数只读行仅在文本跟打/自由端显示 */
function applySpecReadout(){
  const el=document.getElementById('schemeSpecReadout');
  if(el)el.style.display=isTextMode()?'block':'none';
}
async function saveSchemeSettings(){
  if(!store.schemaId)return;
  store.schemeSettings[store.schemaId]={opt:Object.assign({},store.opt),filter_strength:store.config.filter_strength};
  await idb.set('schemeSettings',store.schemeSettings);
}
function restoreSchemeSettings(){
  const saved=store.schemaId&&store.schemeSettings[store.schemaId];
  if(saved&&saved.opt){
    for(const g of store.switches)for(const n of g.names)if(n in saved.opt)store.opt[n]=!!saved.opt[n];
    if(saved.filter_strength)store.config.filter_strength=Math.min(6,Math.max(3,+saved.filter_strength));
  }
}

/* ===================== 文本跟打引擎 ===================== */
/* 文本候选：前缀匹配基础上补 sxs 静态拆分组合（对齐 auto_length.translate_by_split）：
   仅当无任何前缀延续候选时，才用 前两码首选+其余首选 的组合 */
function getTextCandidates(seg){
  const base=getFilteredCandidates(seg);
  if(base.length===0
     && !opt('pure_char')
     && /^[bpmfdtnlgkhjqxzcsrywv][a-z][bpmfdtnlgkhjqxzcsrywv]/.test(seg)){
    const c1=(getFilteredCandidates(seg.slice(0,2))[0]||{}).word;
    const c2=(getFilteredCandidates(seg.slice(2))[0]||{}).word;
    if(c1&&c2)return [{word:c1+c2,codes:[seg],_split:true}];
  }
  return base;
}
/* 被动监听：真实中文输入法在 textarea 打字，工具不拦截按键，只记录按键流并对比上屏文本 */
const PAGE_CHARS=1000, OVERLAP=60;
const textState={raw:'',pageStart:0,startTs:0,pausedBase:0,composing:false,compStartRel:0,
  keyBuffer:'',keys:0,backspaces:0,enters:0,selection:0,
  revisions:0,wrongChars:0,wordUp:0,charUp:0,phraseCount:0,phraseErr:0};
function initTextEngine(raw){
  textState.raw=(raw||'').replace(/\r/g,'');
  Object.assign(textState,{pageStart:0,startTs:0,pausedBase:0,composing:false,compStartRel:0,
    keyBuffer:'',keys:0,backspaces:0,enters:0,selection:0,
    revisions:0,wrongChars:0,wordUp:0,charUp:0,phraseCount:0,phraseErr:0});
  textInputEl.value='';
  if(isTextMode())renderText();
}
function pageExpected(){return [...textState.raw.slice(textState.pageStart,textState.pageStart+PAGE_CHARS)];}
function relPos(){return [...textInputEl.value].length;}
function globalPos(){return textState.pageStart+relPos();}
/* 下一目标：从光标起跳过非标点，取词典中能整词打出的最长词（与真实分词一致） */
function currentTargetWord(){
  const chars=[...textState.raw];let i=globalPos();
  while(i<chars.length&&!/[\u4e00-\u9fff]/.test(chars[i]))i++;
  if(i>=chars.length)return '';
  let best=chars[i];
  for(let L=Math.min(8,chars.length-i);L>=2;L--){
    const cand=chars.slice(i,i+L).join('');
    if(store.dict.has(cand)){best=cand;break;}
  }
  return best;
}
function esc(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function renderTextView(){
  if(!textState.raw){textView.textContent='请先在左栏加载文本练习素材 txt。';return;}
  const exp=pageExpected(),act=[...textInputEl.value];
  const target=currentTargetWord(),tlen=[...target].length,curStart=act.length;
  let html='';
  for(let i=0;i<exp.length;i++){
    let cls;
    if(i<curStart)cls=(act[i]===exp[i])?'tv-done':'tv-wrong';
    else if(i<curStart+tlen)cls='tv-wordcur';
    else cls='tv-future';
    html+='<span class="'+cls+'">'+esc(exp[i])+'</span>';
  }
  textView.innerHTML=html;
}
/* 跟打目标全方位提示（拆字/构词规则/编码合集），复用字词模式解释 */
function renderTextTarget(){
  const el=document.getElementById('textTarget');
  if(!el)return;
  const target=currentTargetWord();
  if(!target){el.innerHTML='';return;}
  let codes=[];
  try{codes=[...new Set(groupsForWord(target).map(g=>g.code))];}catch(e){codes=[];}
  const lv=store.practiceMode==='text_free'?4:hintLv();
  let h='<div style="font-size:0.9286rem;line-height:1.9;background:var(--card-bg);border:var(--bw) solid var(--card-border);border-radius:var(--r-card,8px);padding:10px 12px;">';
  h+='<div class="section-sub" style="margin:0 0 4px;">练习目标</div>';
  h+='<div><span class="lbl">待输入目标：</span><b style="font-size:1.4286rem">'+esc(target)+'</b></div>';
  if(lv<4&&store.cf.size>0)h+='<div><span class="lbl">拆字提示：</span>'+buildCfHtml(target)+'</div>';
  h+=explainWord(target);
  if(lv<1)h+='<div><span class="lbl">编码合集：</span>'+codes.map(esc).join('，')+'</div>';
  h+='</div>';
  el.innerHTML=h;
}
function renderStats(){
  const ms=textState.startTs?elapsedMs(textState.startTs,textState.pausedBase):0;
  const mins=textState.startTs?Math.max(1/60,ms/60000):1/60;
  const done=globalPos();
  const avgLen=done?textState.keys/Math.max(1,done):0;
  const keyAcc=textState.keys?(textState.keys-textState.backspaces)/textState.keys*100:100;
  const wordRate=done?textState.wordUp/done*100:0;
  const cells=[
    ['速度',textState.startTs?Math.round(done/mins):0],['击键',textState.startTs?Math.round(textState.keys/mins):0],
    ['码长',avgLen.toFixed(2)],['字数',done],
    ['时间',textState.startTs?Math.round(ms/1000)+'s':'0s'],
    ['回改',textState.revisions],['退格',textState.backspaces],['回车',textState.enters],
    ['键数',textState.keys],['选重',textState.selection],
    ['键准',Math.round(keyAcc)+'%'],['打词',Math.round(wordRate)+'%']
  ];
  /* 自由模式相对跟打模式少一项：不统计错字 */
  if(store.practiceMode!=='text_free')cells.push(['错字',textState.wrongChars]);
  textStatsEl.innerHTML=cells.map(c=>'<div class="ts-cell">'+c[0]+'<b>'+c[1]+'</b></div>').join('');
}
/* 打字机滚动：输入框里当前行保持在框内约 50% 高度——前 50% 逐行往下打，超过后整体上滚 */
let _taMirror=null;
function caretLineTop(ta){
  if(!_taMirror){_taMirror=document.createElement('div');_taMirror.className='ta-mirror';document.body.appendChild(_taMirror);}
  const cs=getComputedStyle(ta),m=_taMirror;
  ['fontFamily','fontSize','lineHeight','letterSpacing','padding','whiteSpace','wordBreak','textTransform'].forEach(k=>{m.style[k]=cs[k];});
  m.style.boxSizing='border-box';m.style.width=ta.clientWidth+'px';
  const pos=typeof ta.selectionStart==='number'?ta.selectionStart:ta.value.length;
  m.textContent=ta.value.slice(0,pos);
  const mark=document.createElement('span');mark.textContent='​';m.appendChild(mark);
  const top=mark.offsetTop;
  m.textContent='';
  return top;
}
function typewriterScroll(){
  if(!textInputEl||textPanel.hidden)return;
  const top=caretLineTop(textInputEl),h=textInputEl.clientHeight;
  const want=Math.max(0,top-h*0.5);
  if(Math.abs(textInputEl.scrollTop-want)>1)textInputEl.scrollTop=want;
  syncOriginalScroll();
}
/* 原文框同步：按当前页已打字的比例定位，让原文里对应的那一行也停在框内 50% 高度。
   （输入框只装已上屏的字，用输入框自身的滚动比例会把原文直接推到页底，故按比例定位到页内位置） */
function syncOriginalScroll(){
  const ov=textView.scrollHeight-textView.clientHeight;
  if(ov<=0){textView.scrollTop=0;return;}
  const pageLen=Math.max(1,[...pageExpected()].length);
  const ratio=Math.min(1,Math.max(0,relPos()/pageLen));
  const want=Math.max(0,Math.min(ov,ratio*textView.scrollHeight-textView.clientHeight*0.5));
  if(Math.abs(textView.scrollTop-want)>1)textView.scrollTop=want;
}
function renderText(){renderTextView();renderTextTarget();renderStats();typewriterScroll();}
/* 练习强度下拉：变换模式专享 3 档（读写 store.tfIntensity），其余模式 5 档（读写 store.practiceIntensity），
   两套取值各自独立、互不映射 */
function syncIntensityOptions(){
  const tf=store.practiceMode==='transform';
  const scope=tf?'tf':'word';
  if(practiceIntensitySel.dataset.scope!==scope){
    const list=tf?TF_INTENSITIES:WORD_INTENSITIES;
    practiceIntensitySel.innerHTML=list.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('');
    practiceIntensitySel.dataset.scope=scope;
  }
  practiceIntensitySel.value=tf?store.tfIntensity:store.practiceIntensity;
}
function applyPanels(){
  const iw=isWordMode(),it=isTextMode(),free=store.practiceMode==='text_free';
  wordPanel.hidden=!iw;textPanel.hidden=!it;
  /* 自由模式：没有原文框与目标框，输入框独占整页高度 */
  textPanel.classList.toggle('free',free);
  refreshModeOptions();
  updateModeTip();
  document.getElementById('randomStrengthRow').style.display=iw?'':'none';
  if(free)store.practiceIntensity='none';
  syncIntensityOptions();
  practiceIntensitySel.disabled=free;
  document.getElementById('textLayoutRow').style.display=free?'none':'';
  document.getElementById('textTarget').style.display=free?'none':'';
  document.getElementById('textView').style.display=free?'none':'';
  document.getElementById('textStatsWrap').style.display=it?'block':'none';
  renderSchemeControls();
  applySpecReadout();
  if(it){
    if(free){if(textState.raw!=='')initTextEngine('');else renderStats();}
    else renderText();
  }
}
function startTimer(){
  if(!textState.startTs&&!store.recPaused){textState.startTs=Date.now();textState.pausedBase=store.pausedMs;}
}
/* compositionend：一段真实候选上屏，对比原文，统计正确/错误与打词率 */
function analyzePhrase(){
  const act=[...textInputEl.value],prev=textState.compStartRel;
  const up=act.slice(prev).join('');
  if(!up)return;
  const ulen=[...up].length;
  if(store.practiceMode==='text_free'){if(rec()){textState.phraseCount++;textState.charUp+=ulen;}renderStats();return;}
  const exp=textState.raw.slice(textState.pageStart+prev,textState.pageStart+act.length);
  if(!rec())return;
  textState.phraseCount++;
  if(up===exp){if(ulen>1)textState.wordUp+=ulen;else textState.charUp++;}
  else{
    textState.phraseErr++;
    let wc=0;const upa=[...up],expa=[...exp];
    for(let i=0;i<ulen;i++){if(upa[i]!==expa[i])wc++;}
    textState.wrongChars+=wc;
  }
}
/* 长文本分页：接近 PAGE_CHARS 翻下一页，保留 OVERLAP 字过渡 */
function checkPageTurn(){
  const rel=relPos();
  if(rel>=PAGE_CHARS-OVERLAP && textState.pageStart+PAGE_CHARS<textState.raw.length){
    textState.pageStart+=PAGE_CHARS-OVERLAP;
    textInputEl.value=textState.raw.slice(textState.pageStart,textState.pageStart+OVERLAP);
    renderText();
  }
}
/* —— 被动监听：不 preventDefault，只记录按键流 —— */
textInputEl.addEventListener('compositionstart',()=>{
  textState.composing=true;textState.compStartRel=relPos();textState.keyBuffer='';startTimer();
});
textInputEl.addEventListener('compositionend',()=>{
  textState.composing=false;analyzePhrase();textState.keyBuffer='';checkPageTurn();renderText();
});
textInputEl.addEventListener('input',()=>{
  startTimer();
  if(!textState.composing)renderText();
});
textInputEl.addEventListener('keydown',e=>{
  startTimer();
  if(!rec())return;
  const k=e.key;
  if(k==='Backspace'){
    if(textState.composing)textState.backspaces++;   /* 删未上屏编码 */
    else textState.revisions++;                      /* 删已上屏内容 */
    textState.keys++;
  }else if(k==='Enter'){textState.enters++;textState.keys++;}
  else if(k===' '){textState.keys++;}
  else if(/^[a-zA-Z]$/.test(k)){
    textState.keyBuffer+=k.toLowerCase();textState.keys++;
    if(textState.composing&&/[0-9]/.test(k))textState.selection++;  /* 数字挑重码 = 选重 */
  }else if(k.length===1)textState.keys++;
});
textLayoutSel.addEventListener('change',e=>{
  textLayout.classList.toggle('row',e.target.value==='row');
  typewriterScroll();
});
/* 打字机跟随：光标移动即重算，手动滚动输入框时只让原文按比例跟上 */
textInputEl.addEventListener('keyup',typewriterScroll);
textInputEl.addEventListener('scroll',syncOriginalScroll);
document.getElementById('textRestartBtn').addEventListener('click',()=>{initTextEngine(textState.raw);});
/* 速度/时间随时间变化，秒级刷新 */
setInterval(()=>{if(isTextMode()&&!textPanel.hidden)renderStats();},1000);
randomStrengthSel.addEventListener('change',async e=>{store.config.random_strength=e.target.value;buildSortedList();nextWord();await saveSettings();});
practiceIntensitySel.addEventListener('change',async e=>{
  const v=e.target.value;
  if(store.practiceMode==='transform'){
    /* 变换专项的提示级别独立保存，只换提示，不清空当前已输入、不重新出题 */
    store.tfIntensity=v;
    if(store.transformTarget)document.getElementById('explainLine').innerHTML=explainTransform(store.transformTarget);
  }else{
    store.practiceIntensity=v;
    if(store.practiceMode==='text_follow')renderTextTarget();
    else if(isWordMode()&&store.targetWord&&store.targetWord!=='—')showTarget(store.targetWord);
  }
  await saveSettings();});

inputEl.addEventListener('input',e=>{
  store.currentInput=e.target.value;
  store.candidatePage=0;store.selectedIndex=0;
  if(wordFeedbackEl)wordFeedbackEl.textContent='';
  checkIme();renderCandidate();
});

/* ================= 键盘：选重键上屏 / Tab 翻页 / Enter 结束 ================= */
inputEl.addEventListener('keydown',e=>{
  /* 流畅度口径需要击键总数：字词/简码/变换模式在此统一计数（可打印键） */
  if(e.key&&e.key.length===1)statKey();
  /* 编码变换专项：整套键序由变换解释器接管，不走常规选重/翻页逻辑 */
  if(store.practiceMode==='transform'){tfOnKey(e);return;}
  const {all,page}=getPage();
  /* 退格：上屏前删编码，计入退格统计 */
  if(e.key==='Backspace'){
    if(inputEl.value)statBack();
    return;
  }
  /* 空格：上屏第 1 候选并结束 */
  if(e.key===' '){
    e.preventDefault();
    if(page.length){validateInput(page[0]);nextWord();saveSettings();}
    return;
  }
  /* Enter：唯一候选直接结束；多候选提示按选择键 */
  if(e.key==='Enter'){
    e.preventDefault();
    if(all.length===1){validateInput(all[0]);nextWord();saveSettings();}
    else if(all.length>1){
      pageInfoEl.style.color='#b03030';
      pageInfoEl.textContent='当前有多个候选，请按选择键上屏：空格(第1)、'+[...selectKeyArr().slice(1)].join('、')+'（Tab 翻页）';
    }else{validateInput(null);nextWord();saveSettings();}
    return;
  }
  /* 选择键（数字或字母选重）上屏对应候选 */
  if(e.key!==' '&&selectKeyArr().includes(e.key)){
    const pos=selectKeyArr().indexOf(e.key);
    if(page[pos]){e.preventDefault();statSelect();validateInput(page[pos]);nextWord();saveSettings();}
    return;
  }
  /* Tab / Shift+Tab 翻页 */
  if(e.key==='Tab'){
    e.preventDefault();
    const pages=Math.max(1,Math.ceil(all.length/PAGE_SIZE));
    if(e.shiftKey)store.candidatePage=(store.candidatePage-1+pages)%pages;
    else store.candidatePage=(store.candidatePage+1)%pages;
    store.selectedIndex=0;renderCandidate();
  }
});

/* ================= IME 英文状态检测（字词练习） ================= */
function checkIme(){
  if(!isWordMode()){imeWarnEl.style.display='none';return;}
  const v=inputEl.value;
  const bad=[...v].find(ch=>ch.charCodeAt(0)>0x2000 && (ch.charCodeAt(0)>0x2fff));
  if(bad){
    imeWarnEl.textContent='检测到中文/全角字符“'+bad+'”，请切换到英文（半角 EN）输入状态后再练习。';
    imeWarnEl.style.display='block';
  }else imeWarnEl.style.display='none';
}
inputEl.addEventListener('compositionstart',()=>{
  if(isWordMode()){
    imeWarnEl.textContent='检测到中文输入法组合状态，请按 Shift 切换到英文（EN）输入。';
    imeWarnEl.style.display='block';
  }
});
