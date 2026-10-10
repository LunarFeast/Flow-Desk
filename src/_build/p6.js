/* ================= 外观与字体：2026-10-08 起一概跟随 Flow-Desk =================
   口 = 「打字练习取消独立外观、独立字体设置，跟随全局外观、字体」。
   这一头从前自己管四件事，全部撤掉：
   1 自己的一套配色：内置 light/dark 两张表，加上从 weasel.yaml / weasel.custom.yaml 里读出来的那些主题，
     再外加一份 analyzeScheme（把输入法那十几个角色色换算成网页用途色、保证可读对比）。换算那一份早就搬进了
     共享的配色引擎（src\_shared\sh-color.js，宿主此刻吃的就是它），练习器再算一遍是第二套真相。
     现在色号一个都不钉，整格继承宿主 Theme.apply 写在真根元素上的那一批。
   2 自己钉的两档圆角：lookApply() 往 documentElement 写 --radius / --ctl-radius。搬进宿主之后那是整张
     Flow-Desk 的根，练习器一开就把宿主的卡片档、控件档顶掉。圆角名已经直接改成宿主那两个
     （--r-card 卡片 / --r-btn·--r-pill 控件，见 rp-base.html 底样式那一段），这一头不再钉。
   3 自己的字号滑杆：从前它把 --base-fs 钉到根上。现在这一格的字号 = 底样式那条兜底 14px × --vsc，
     --vsc 由宿主量这一张卡片那一格算出来（rp-kernel.mjs 的 RP_ADAPTER），卡片越大字越大。
   4 自己的字体设置：中文字体、英文编码区各挂一张 @font-face（文件尾那段动态字体加载跟着一起撤）。
     现在正文吃宿主的 --fd-font，等宽那几处（公式、按键、编码区）吃宿主的 --fd-mono，字重吃 --fd-weight。
   圆角和配色从前画在 documentElement 上，那是「独立」那几年的写法，也正是它盖住宿主的原因。 */
/* 三栏就是这一页的三张卡片：挂一次 data-look，共享外观层（sh-look.js）那张样式表就接管它们的底、
   影子和纹理 —— 和宿主里任何一张卡片同一个画法，不再另立一套表面。 */
document.querySelectorAll('.col').forEach(el => el.setAttribute('data-look',''));

/* ================= 设置与记录持久化 ================= */
/* 历次 = 落库基线 + 本次（含本次，累计到落库时刻）；每次落库写合计，基线本身不含本次 */
function flushLifetime(){
  const c=sessionStats(),b=store.lifeBase;
  return idb.set('lifetime',{total:b.total+c.vol,err:b.err+(c.countsWrong?c.err:0),
    codeErr:b.codeErr+c.codeErr,selErr:b.selErr+c.selErr,back:b.back+c.back,
    select:b.select+c.select,keys:b.keys+c.keys,up:b.up+c.vol});
}
function saveSettings(){
  flushLifetime();
  return idb.set('settings',{
    practiceMode:store.practiceMode,practiceIntensity:store.practiceIntensity,
    tfIntensity:store.tfIntensity,
    random_strength:store.config.random_strength
  });
}
/* 导出：一条一项数据的纯文本记录（错误明细同样逐条列出，供导入还原） */
function recordText(){
  const det=(store.errorLog||[]).map(x=>'错误明细：目标「'+(x.target||'—')+'」｜上屏「'+(x.selected||'无')
    +'」｜输入「'+(x.input||'无')+'」｜原因：'+(x.reason||'未记录'));
  return recordExportLines().concat(det.length?[''].concat(det):[]).join('\r\n');
}
document.getElementById('exportBtn').addEventListener('click',()=>{
  const blob=new Blob([recordText()],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rime练习记录.txt';a.click();URL.revokeObjectURL(a.href);
});
document.getElementById('importBtn').addEventListener('click',()=>document.getElementById('importRecFile').click());
function pickNum(text,label){
  const m=text.match(new RegExp(label+'[：:]?\\s*([0-9][0-9.,]*)'));
  return m?Math.round(parseFloat(m[1].replace(/,/g,''))):0;
}
/* 导入：新版分条 txt 与旧版 json 都认 */
function importRecordText(text){
  const vol=pickNum(text,'本次练习量');
  const rate=(text.match(/本次正确率：\s*([0-9.]+)%/)||[])[1];
  const err=rate!==undefined&&rate!==''?Math.round(vol*(1-Math.min(100,parseFloat(rate))/100)):0;
  store.practice.total=vol;store.practice.err=err;
  store.stat.codeErr=pickNum(text,'本次编码打错');
  store.stat.selErr=pickNum(text,'本次选重选错');
  store.stat.back=pickNum(text,'回退/修改');
  store.stat.keys=pickNum(text,'本次击键');
  store.stat.select=pickNum(text,'选重按键');
  store.errorLog=text.split(/\r?\n/).filter(l=>/^错误明细：/.test(l)).map(l=>{
    const f=l.replace(/^错误明细：/,'').split('｜');
    const g=i=>((f[i]||'').match(/[「"]([^」"]*)[」"]/)||[])[1]||'';
    return {target:g(0),selected:g(1)==='无'?'':g(1),input:g(2)==='无'?'':g(2),
      reason:(f[3]||'').replace(/^原因：/,'')};
  });
}
/* 导出已改为分条纯文本，导入同时接受新 txt 与旧 json */
document.getElementById('importRecFile').accept='.txt,.json';
document.getElementById('importRecFile').addEventListener('change',async e=>{  const f=e.target.files[0];if(!f)return;
  const text=await readFileAsText(f);
  if(/^\s*\{/.test(text)){
    const obj=JSON.parse(text);
    Object.assign(store.practice,obj.practice||{});
    Object.assign(store.stat,obj.stat||{});
    store.errorLog=obj.errorLog||[];
  }else importRecordText(text);
  updateStatPanel();
});
document.getElementById('restoreClose').addEventListener('click',()=>document.getElementById('restoreTip').style.display='none');

/* ================= 练习记录开关：暂停·重启 / 清空 =================
   只影响累加器与错误日志，不动已上屏文本和当前练习词。 */
function resetRecord(){
  store.practice={total:0,err:0};
  store.stat={codeErr:0,selErr:0,back:0,select:0,keys:0};
  store.errorLog=[];
  updateStatPanel();
}
function setRecPaused(p){
  if(p===store.recPaused)return;
  if(p){store.recPaused=true;store.pauseStart=Date.now();}
  else{store.pausedMs+=Date.now()-store.pauseStart;store.pauseStart=0;store.recPaused=false;}
  updateRecUi();
}
function updateRecUi(){
  const el=document.getElementById('recState');
  if(el){
    el.textContent=store.recPaused?'⏸ 记录已暂停：统计与错误日志不再累加，计时暂停':'● 正在记录';
    el.style.color=store.recPaused?'#b03030':'';
  }
  const tb=document.getElementById('recToggleBtn');
  if(tb){
    tb.textContent=store.recPaused?'重启记录':'暂停记录';
    tb.classList.toggle('paused',store.recPaused);
  }
}
/* 记录按钮样式：2×2 网格、按钮文字单行 */
const REC_BTN_CSS=[
  '.record-stat .rec-line{margin:0 0 3px;}',
  '.record-stat .rec-line b{color:var(--accent-text,var(--accent));font-weight:700;}',
  '.record-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px;}',
  '.record-btns button{white-space:nowrap;font-size:0.8571rem;padding:7px 6px;border:var(--bw) solid var(--card-border);',
  'background:var(--btn-bg);border-radius:var(--r-btn,5px);cursor:pointer;color:var(--text);text-align:center;',
  'transition:background .15s,border-color .15s;}',
  '.record-btns button:hover{background:var(--accent-light);border-color:var(--accent);}',
  '.record-btns #recToggleBtn{font-weight:600;border-color:var(--accent);}',
  '.record-btns #recToggleBtn.paused{background:var(--accent);color:var(--sel-text,#fff);}'
].join('');
function initRecordButtons(){
  const host=document.querySelector('.record-btns');
  if(!host||document.getElementById('recToggleBtn'))return;
  if(!document.getElementById('recBtnStyle')){
    const st=document.createElement('style');st.id='recBtnStyle';st.textContent=REC_BTN_CSS;
    document.head.appendChild(st);
  }
  const tip=document.createElement('div');
  tip.id='recState';tip.className='col-desc';tip.textContent='● 正在记录';
  host.insertAdjacentElement('beforebegin',tip);
  host.insertAdjacentHTML('afterbegin',
    '<button id="recToggleBtn">暂停记录</button><button id="recClearBtn">清空当前记录</button>');
  document.getElementById('recToggleBtn').addEventListener('click',()=>{
    setRecPaused(!store.recPaused);
  });
  document.getElementById('recClearBtn').addEventListener('click',resetRecord);
  updateRecUi();
}

/* ================= 中栏布局：编码内容块在上、输入框居中、候选预览在下 =================
   整页与中栏都不滚动；编码内容块（每组取码方法+详细编码+简码/全码）块多时自动横向分布；
   只有文本模式的目标文本框保留框内滚动。外壳 HTML/CSS 只读，样式在此注入。 */
const MID_COL_CSS=[
  '#midCol{overflow:hidden;display:flex;flex-direction:column;}',
  '#wordPanel,#textPanel{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;}',
  '#wordPanel[hidden],#textPanel[hidden]{display:none;}',
  '#wordPanel>.group-title,#wordPanel>.section-sub{flex:0 0 auto;margin-top:0;}',
  '#wordPanel .section-sub{margin-top:10px;}',
  /* 编码块 → 输入框 → 候选预览依次紧跟，不撑开固定间距 */
  '#wordPanel .target-line{flex:0 0 auto;}',
  '#wordPanel #input-area,#wordPanel .word-feedback,#wordPanel .ime-warn,#wordPanel .page-info{flex:0 0 auto;}',
  '#wordPanel #input-area{margin:10px 0 8px;}',
  '#candidate-bar{overflow:hidden;}',
  /* 编码内容块：宽度=内部编码行不换行完整展示的宽度，取码方法标题可换行，
     同排块等高（align-items:stretch），一排放不下自动换到下一排 */
  '.explain-box{display:flex;flex-wrap:wrap;align-items:stretch;align-content:flex-start;gap:7px 10px;}',
  '.explain-box>.rule-group{flex:0 0 auto;width:min-content;max-width:100%;margin:0;padding:6px 9px;',
  'display:flex;flex-direction:column;}',
  '.explain-box>.rule-group>*{flex:0 0 auto;}',
  '.explain-box>:not(.rule-group){flex:0 0 100%;}',
  '.explain-box .keymap-grid{gap:0 12px;grid-template-columns:max-content max-content;}',
  '.explain-box .explain-row{white-space:nowrap;}',
  /* 变换专项：变换指引为灰色正文，只对编码与键名着色加粗 */
  '.tf-guide{color:var(--text-light);font-weight:400;font-size:0.9286rem;line-height:1.9;}',
  '.tf-guide b{color:var(--accent-text,var(--accent));font-weight:700;}',
  '.tf-guide b.ec-count{color:var(--text);font-weight:700;}',
  /* 低提示档（练习强度=中）：块内部横向单行，块与块竖向排开；顺带修掉 1fr 造成的块宽塌陷 */
  '.explain-box .keymap-single{grid-template-columns:max-content;}',
  '.explain-box.compact{flex-direction:column;align-items:flex-start;gap:5px;}',
  '.explain-box.compact>.rule-group{flex-direction:row;align-items:baseline;flex-wrap:nowrap;',
  'width:auto;max-width:100%;gap:10px;padding:5px 9px;}',
  '.explain-box.compact .rule-kind{white-space:nowrap;margin-bottom:0;}',
  '.explain-box.compact .keymap-single{display:flex;flex-direction:row;flex-wrap:nowrap;gap:1px;}',
  '.explain-box.compact .rule-note{white-space:nowrap;}',
  /* 文本模式：原文框与输入框定死各占 50%（上下布局=上下各半，左右布局=左右各半），
     框体不超出页面，超出文字在框内滚动 */
  '#textPanel #textLayoutRow,#textPanel #textRestartBtn,#textPanel>#textTarget{flex:0 0 auto;}',
  '#textPanel .text-layout{flex:1 1 auto;min-height:0;}',
  '#textPanel .text-view{flex:1 1 50%;min-height:0;max-height:none;overflow:auto;}',
  '#textPanel .text-input-col{flex:1 1 50%;min-height:0;}',
  '#textPanel #text-input{height:100%;min-height:0;max-height:none;resize:none;overflow:auto;flex:1 1 auto;}',
  /* 自由模式：没有原文框与目标框，输入框占满页面，超出在框内滚动 */
  '#textPanel.free .text-view,#textPanel.free>#textTarget{display:none;}',
  '#textPanel.free .text-input-col{flex:1 1 100%;}',
  /* 打字机测高用的镜像层（不可见，不参与布局） */
  '.ta-mirror{position:absolute;top:0;left:-9999px;visibility:hidden;pointer-events:none;',
  'white-space:pre-wrap;overflow-wrap:break-word;}',
  /* 窗口自适应：以新的浏览器窗口为 100%，字号、列宽、内边距按 --vsc 同比重算 */
  'html{font-size:calc(var(--base-fs,14px) * var(--vsc,1));}',
  'body{padding:calc(14px * var(--vsc,1));}',
  '.layout{grid-template-columns:clamp(230px,18vw,470px) minmax(0,1fr) clamp(230px,17.5vw,470px);}',
  '.col{padding:calc(14px * var(--vsc,1));}'
].join('');
(function(){
  const cols=document.querySelectorAll('.layout > .col');
  const mid=cols.length>1?cols[1]:null;
  if(!mid)return;
  mid.id='midCol';
  const st=document.createElement('style');st.id='midColStyle';st.textContent=MID_COL_CSS;
  document.head.appendChild(st);
})();
/* 缩放系数：以 1560×900 为 1.0，窗口变化时所有框体按新的窗口尺寸重算相对大小 */
function applyViewportScale(){
  const s=Math.min(innerWidth/1560,innerHeight/900);
  document.documentElement.style.setProperty('--vsc',Math.min(1.35,Math.max(0.8,s)).toFixed(3));
}
addEventListener('resize',()=>{applyViewportScale();if(typeof typewriterScroll==='function')typewriterScroll();});
applyViewportScale();

/* ================= 启动：恢复上次会话 ================= */
/* 外壳是只读文件，按钮的位置与增删只能从 JS 动 DOM：
   「加载输入法文件」移到「一键重载」左边，「卸载词库与规则」整节点移除 */
function applyShellButtons(){
  const load=document.getElementById('traceDictBtn'),reload=document.getElementById('reloadAllBtn'),unload=document.getElementById('unloadTracedBtn');
  if(load&&reload&&reload.parentNode&&load.parentNode!==reload.parentNode)reload.parentNode.insertBefore(load,reload);
  if(unload)unload.remove();
}
/* 「方案文件」那块的介绍文字按用户定稿走，只此一句，不按开法分支 */
const SCHEMA_DIR_TIP='点击"加载输入法文件"，进入Rime的用户文件夹并点击选择此文件夹，系统将按方案自动找到并加载全部词典与lua规则。全程仅在本地读取和加载。';
function applyPanelTips(){
  for(const t of document.querySelectorAll('.group-title')){
    if(t.textContent.indexOf('方案文件') < 0) continue;
    const d=t.nextElementSibling;
    if(d&&d.classList.contains('col-desc')){ d.textContent=SCHEMA_DIR_TIP; d.title=SCHEMA_DIR_TIP; }
    return;
  }
}
async function init(){
  store._booting=true;
  applyShellButtons();
  applyPanelTips();
  await idb.open();
  loadCharFreq();
  /* 历次累计基线必须在任何一次落库（flushLifetime）之前取回，否则首次保存会把本次重复计入 */
  store.lifeBase=Object.assign(store.lifeBase,(await idb.get('lifetime'))||{});
  const settings=await idb.get('settings');
  const restored=[];
  /* 方案个性化开关状态：必须在方案 schema 恢复（会触发 applySchemeSpec）之前取回 */
  store.schemeSettings=(await idb.get('schemeSettings'))||{};
  /* 词库这一层先吃缓存：一次 IndexedDB 读，不碰磁盘，所以界面能立刻摆出来。
     头一次（还没有缓存）才走 restoreRimeDir 真读盘。 */
  let booted=null,dirState='none';
  if(window.showDirectoryPicker){
    booted=await bootRimeCache();
    if(booted)dirState='cached';else dirState=await restoreRimeDir(false);
  }
  /* 先恢复方案基础（追溯前提） */
  const schemaRec0=await idb.get('file_schema');
  if(schemaRec0){
    const card0=document.querySelector('.file-card[data-key=schema]');
    card0.classList.add('loaded');card0.querySelector('.file-status').textContent='✅ '+schemaRec0.name;
    await fileHandlers.schema(schemaRec0.text,schemaRec0.name);restored.push(schemaRec0.name);
  }
  if(dirState==='granted')restored.push('Rime 目录（已自动读取）');
  else if(dirState==='cached')restored.push('Rime 目录');
  else{
    if(dirState==='gesture')showRestoreDirBtn(true);
    const rf=await idb.get('rimeFiles');
    if(rf&&rf.files){
      store.rimeFiles=new Map(Object.entries(rf.files));
      store.rimeFolder=rf.folder;store.largeFiles=rf.large||[];
      store.luaFiles=new Map();
      for(const [p,tx] of store.rimeFiles){if(/(^|\/)lua\//.test(p)||/\.lua$/i.test(p)||/sbxlm\.(yaml|yml)$/i.test(p)){store.luaFiles.set(p,tx);routeLuaFile(p.split('/').pop(),tx);}}
      store._traceReport=traceFromSchema();renderTrace();
      restored.push('Rime 文件夹'+(rf.folder?('：'+rf.folder):''));
    }
  }
  for(const key of ['textPractice']){
    const rec=await idb.get('file_'+key);
    if(rec){
      const card=document.querySelector(`.file-card[data-key=${key}]`);
      card.classList.add('loaded');
      card.querySelector('.file-status').textContent='✅ '+rec.name;
      await fileHandlers[key](rec.text,rec.name);restored.push(rec.name);
    }
  }
  if(settings){
    let _pm=settings.practiceMode;if(_pm==='word')_pm='word_full';else if(_pm==='text')_pm='text_follow';
    store.practiceMode=_pm||'word_full';
    store.practiceIntensity=settings.practiceIntensity||'full';
    store.tfIntensity=(settings.tfIntensity==='normal'||settings.tfIntensity==='none')?settings.tfIntensity:'full';
    store.config.random_strength=settings.random_strength||'seq';
    practiceModeSel.value=store.practiceMode;
    practiceIntensitySel.value=store.practiceIntensity;
    randomStrengthSel.value=store.config.random_strength;
  }else{
    /* 第一次进入练习器：字词全量 + 全提示 + 完全顺序 */
    applyPracticeDefaults();
  }
  /* settings 在词典恢复后才应用，据此重建出题顺序 */
  if(store.dict.size){
    buildSortedList();
    if(store.practiceMode==='transform'){store.transformList=buildTransformList();showTransform(0);}
    else if(isWordMode())nextWord();
  }
  if(restored.length||settings){
    document.getElementById('restoreText').textContent=
      '已恢复上次会话设置'+(restored.length?'：'+restored.join('、'):'')+
      '；练习模式='+practiceModeSel.options[practiceModeSel.selectedIndex].text+'。';
    document.getElementById('restoreTip').style.display='block';
  }
  store._booting=false;
  /* 画面到手，加载提示这一页就翻过去了：后面那拍灌词典是后台补货，不再盖板子 */
  loadDone();
  initRecordButtons();
  applyPanels();updateStatPanel();renderCandidate();checkIme();
  /* 到这一步界面已经画出来了，才去磁盘比一次指纹、把词典灌进来（第 13 条：界面先出、词典后台灌）。
     缓存命中时这一拍一个文件都不读；变了的那几个才读，读完重灌一遍词典。 */
  if(booted){
    const st=booted;booted=null;
    requestAnimationFrame(()=>{ syncRimeAndDict(st).then(s=>{ if(s!=='none')updateStatPanel(); }); });
  }
}
init();
