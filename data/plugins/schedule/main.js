/* ============================================================
   FD 日程 v0.3 · ES module 一份定义
   单一"日程"树（原事项 / 待办 / 长期任务合并），含主日程最多 5 层
   月历是张表格：日期靠同一套细线隔成格子，甘特色条照旧横跨日期格，子轨道高度相对均分
   周视图另开一档：列是周一到周日，行是时间刻度，日程卡叠在自己那段时间上
   日程条一律双色 —— 开头一道深色粗线取主题强调色，后面是这一条自己色位调出的浅色填充
   卡面太矮塞不下整张月历时，铺的是本周那七列迷你竖条
   标签 = 颜色 + 自定义文字，日历上缩成色条内部的圆点，详情看全称
   ----------
   宿主的 h / Settings / Store / Bus / Modal / Cover 全从 ctx 拿：
   init 收到那份组件上下文记在模块作用域 P（这一家函数多，不一个个往下传），
   挂载和封面那条路再把宿主挂载时现给的 mctx 并进来用 C。
   ============================================================ */
let P = null;

/* 删之前那一句问的是宿主给的 C.ask（框由 Flow-Desk 搭，✕ 和「取消」都算不删）——
   从前这一家自己抄了一枚 ask，便签和金句还各抄一枚，三份逐字相同，要改排版得改四处。 */

const SCH_REL = 'schedule.json';
const LANE_MAX = 10;
const MAX_DEPTH = 5;
/* 卡面高度低于这几格就换七列迷你竖条（月历最多 6 行周再加表头，塞不下） */
const MONTH_MIN_ROWS = 8;
/* 只填了开始时间、没填结束时间的，周视图里按这个时长画 */
const DEF_MIN = 60;
/* 小卡那七列每列最多摞几条，多出来的并进末尾一条「+n」 */
const MINI_MAX = 8;

/* ---------- 大卡那两档（外29 第 53 轮，作者的话：「卡片小时可以这样简略，大时做一档/几档显眼/详细一些的展示」）
   判定吃的是这一张卡在桌面上占的那一格（w × h 格数），不另起一套量像素的口径 —— 外壳算格子只有一处。
   第一档 = 出厂那一张（7 × 8 = 56 格）：样子一个字不动，还是简略那一版。
   第二档 显眼（占够 150 格，且高够 10 格）：条上的字、日期号、色位圆点一起按 --sch-big 放大，轨道多给两行。
   第三档 详细（占够 300 格，且高够 13 格）：在显眼之上，标签从圆点换成带名字的短签，
            父条那枚完成度补上「完成几 / 共几 项」，每一天在日期号后面写当天压着几条。
   高也要够那一档：只有宽没有高（比如 38 × 8）放不出这两档要的东西 —— 条本来就跟着行高长，
   字和圆点放大反而会挤掉行。再往上没有第四档：卡面拉到多大都还是这一张月历（外33 第 3 条起，
   外壳那一格「占够四分之一就算展开」对日程不成立），全套视图只走 ⛶。 */
const TIERS = [
  { at:0,   minH:0,  lanes:LANE_MAX },
  { at:150, minH:10, lanes:LANE_MAX + 2 },
  { at:300, minH:13, lanes:LANE_MAX + 4 }
];
function tierOf(w, h){
  const area = (w || 0) * (h || 0), rows = h || 0;
  let t = 0;
  for(let k = 1; k < TIERS.length; k++) if(area >= TIERS[k].at && rows >= TIERS[k].minH) t = k;
  return t;
}
function laneMax(t){ return TIERS[t].lanes; }
/* 放大档自己不吃 fitBox 那一档缩放（--fit 只管间距和圆角），字和圆点归 --sch-big 这个类管，口径一处 */
const TIER_CLASS = ['', 'sch-t2', 'sch-t3'];

const WEEKDAY_STYLES = [
  { id:'one',   name:'单字',  names:['日','一','二','三','四','五','六'] },
  { id:'two',   name:'双字',  names:['周日','周一','周二','周三','周四','周五','周六'] },
  { id:'three', name:'三字',  names:['星期日','星期一','星期二','星期三','星期四','星期五','星期六'] },
  { id:'en',    name:'英文',  names:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
  { id:'ens',   name:'缩写',  names:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] }
];
function weekdayStyle(){ return WEEKDAY_STYLES.find(s => s.id === P.settings.get('weekdayStyle', 'one')) || WEEKDAY_STYLES[0]; }
function weekdayLabels(weekStart){
  const st = weekdayStyle();
  return Array.from({ length:7 }, (_, i) => st.names[(weekStart + i) % 7]);
}
function weekdayOf(ds){ const w = P.settings.get('weekStart', 1); return weekdayLabels(w)[(P.parseDate(ds).getDay() - w + 7) % 7]; }
/* slotColor（色位）在底座 _shared/sh-packs.js：便签那一侧也借它，不能跟着日程包一起走 */

function newNode(title, start, end){
  return { id:'s' + Date.now().toString(36) + Math.floor(Math.random()*1e4).toString(36),
    title:title || '(未命名)', start, end:end || start, time:'', endT:'', note:'',
    slot:0, tags:[], children:[], done:false, progress:0, at:Date.now() };
}
/* 旧数据（events / plans / tasks）迁成树 */
function migrateSch(o){
  const items = [];
  (o.events || []).forEach(e => { const n = newNode(e.title, e.start, e.end || e.start); n.time = e.time || ''; n.endT = e.endT || ''; n.note = e.note || ''; n.slot = e.slot || 0; items.push(n); });
  (o.tasks || []).forEach(t => {
    const n = newNode(t.title, t.start, t.end || t.start); n.note = t.note || ''; n.slot = t.slot || 0; n.progress = t.progress || 0;
    n.children = (t.subs || []).map(s => { const c = newNode(s.title, t.start, t.end || t.start); c.done = !!s.done; return c; });
    items.push(n);
  });
  (o.plans || []).forEach(p => { const n = newNode(p.text, p.date, p.date); n.done = !!p.done; items.push(n); });
  return { items, tags:Array.isArray(o.tags) ? o.tags : [] };
}
async function loadSch(){
  const s = await P.store.loadJSON(SCH_REL, null);
  if(s && Array.isArray(s.items)){ if(!Array.isArray(s.tags)) s.tags = []; return s; }
  if(s && (Array.isArray(s.events) || Array.isArray(s.tasks) || Array.isArray(s.plans))){
    const m = migrateSch(s); P.store.saveJSON(SCH_REL, m); return m;
  }
  const fresh = { items:[], tags:[] };
  P.store.saveJSON(SCH_REL, fresh);
  return fresh;
}
function saveSch(s){ P.store.saveJSON(SCH_REL, s); }

/* ---------- 树的算法：日期取并集、进度自下折算 ---------- */
function eachNode(list, fn, depth, parent){
  for(const n of list){
    fn(n, depth || 1, parent || null);
    if(Array.isArray(n.children) && n.children.length) eachNode(n.children, fn, (depth || 1) + 1, n);
  }
}
function nodeRange(n){
  if(Array.isArray(n.children) && n.children.length){
    let a = '', b = '';
    for(const c of n.children){ const r = nodeRange(c); if(!a || r.start < a) a = r.start; if(!b || r.end > b) b = r.end; }
    return { start:a, end:b };
  }
  return { start:n.start, end:n.end || n.start };
}
function nodeProgress(n){
  if(Array.isArray(n.children) && n.children.length)
    return Math.round(n.children.reduce((s, c) => s + nodeProgress(c), 0) / n.children.length);
  return n.done ? 100 : (n.progress || 0);
}
/* 子日程完成度长什么样（外26 第 13 条定的展示要求，外27 图13 追问「展示呢？还是只有那个百分数」）：
   一个子一条横向细条，条里填到哪就是它完成多少；那个百分数不再单摆，数写在每一条自己的悬停说明里。
   这一档用在两处：主日程树、「这天压着哪些日程」。
   月视图那条甘特是另一套画法（外29 第 42 轮）：父级一整条 + 下级挤在条底当细条，
   由 ganttBar 里的 subInBar 画，不读 subBars 这个函数。 */
function subBars(h, n){
  const kids = (n.children || []).filter(Boolean);
  if(!kids.length) return null;
  return h('span', { class:'sch-sub',
    title:'这一条里有 ' + kids.length + ' 个子日程：一个子一条细条，条里填到哪就是它完成多少' },
    kids.map(c => h('i', { class:nodeProgress(c) >= 100 ? 'full' : '',
      title:(c.title || '子日程') + ' ｜ ' + nodeProgress(c) + '%' },
      h('b', { style:'width:' + Math.max(0, Math.min(100, nodeProgress(c))) + '%' }))));
}
/* 一条日程真正占着的那一段时间：日期还是 nodeRange 那套并集，钟点跟着一起并 ——
   填了钟点的子日程里取最早的那个开始、最晚的那个结束，一条也没填就不留钟点（画出去是全天）。
   并出来跨天时不留钟点：外面那一层跨天只写日期，挂个钟点反而骗人。 */
function nodeSpan(n){
  const kids = Array.isArray(n.children) ? n.children : [];
  if(!kids.length) return { start:n.start, end:n.end || n.start, time:n.time || '', endT:n.endT || '' };
  const rs = kids.map(nodeSpan);
  let start = '', end = '';
  for(const r of rs){ if(!start || r.start < start) start = r.start; if(!end || r.end > end) end = r.end; }
  let time = '', endT = '';
  if(start === end) for(const r of rs){
    if(r.time && (!time || r.time < time)) time = r.time;
    const t = r.endT || r.time;
    if(t && (!endT || t > endT)) endT = t;
  }
  return { start, end, time, endT };
}
/* 并出来的这一段要落回父日程自己那四个字段才算数：日历条的悬停标题、周视图那张卡、
   当日详情那一行读的都是 n.time / n.endT 这份快照（日期那层有 nodeRange 现算兜着，钟点没有），
   改完子日程不回头并一次，外面那一层就还挂着旧时间；「＋加一个子日程」拿 n.start 当起点，
   旧日期也会被这份快照重新带回日历上。 */
function syncSpan(n){
  if(!Array.isArray(n.children) || !n.children.length) return;
  const r = nodeSpan(n);
  /* 并出来是空的（子日程里有哪条没填日期）就不往父日程身上写，免得把好好的存值抹成空格 */
  if(!r.start) return;
  n.start = r.start; n.end = r.end || r.start; n.time = r.time; n.endT = r.endT;
}
/* 整棵树走一遍：动过的可能是第三层的子日程，上面几层都得跟着并 */
function syncSpans(items){
  for(const n of items || []){ syncSpans(n.children); syncSpan(n); }
}
function findNode(s, id){
  let hit = null;
  eachNode(s.items, (n, d, p) => { if(n.id === id) hit = { node:n, depth:d, parent:p }; });
  return hit;
}
function tagOf(s, id){ return s.tags.find(t => t.id === id); }

const SCH = { cursor:new Date(new Date().getFullYear(), new Date().getMonth(), 1), sel:'', fullMode:'m',
  wc:new Date(new Date().getFullYear(), new Date().getMonth(), 1), nowTimer:null,
  /* 外13：格子那一层选中色跟着「当日详情开着没」走，不再跟着 sel 常驻 ——
     sel 是「新建/完整日程默认落在哪天」的工作日期，面板一关，选中色就该跟着走。 */
  view:'' };
function dstr(d){ return P ? P.fmtDate(d) : new Date(d).toISOString().slice(0, 10); }
function todayStr(){ return dstr(new Date()); }
function monthCells(y, m, weekStart){
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const shift = (first.getDay() - weekStart + 7) % 7;
  const cells = [];
  for(let i = 0; i < shift; i++) cells.push(null);
  for(let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
  while(cells.length % 7) cells.push(null);
  return cells;
}
function monthWeeks(y, m, weekStart){
  const cells = monthCells(y, m, weekStart);
  const weeks = [];
  for(let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  /* 末尾整周都是补白的就不占行 */
  while(weeks.length && !weeks[weeks.length - 1].some(d => d)) weeks.pop();
  return weeks;
}

/* ---------- 按周走的那一段：周视图和卡面上的七列迷你竖条都从这里取日期 ---------- */
function weekAnchor(d, weekStart){ return P.addDays(d, -((d.getDay() - weekStart + 7) % 7)); }
function weekDates(anchor, weekStart){
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  return Array.from({ length:7 }, (_, i) => P.addDays(a, i));
}
function shiftWeek(C, n){
  SCH.wc = P.addDays(SCH.wc, n * 7);
  /* 翻周顺手把月历的月份也带过去，两处不必各走各的 */
  SCH.cursor = new Date(SCH.wc.getFullYear(), SCH.wc.getMonth(), 1);
  C.bus.emit('schedule');
}
function backToThisWeek(C){
  const t = new Date();
  SCH.wc = weekAnchor(t, C.settings.get('weekStart', 1));
  SCH.cursor = new Date(t.getFullYear(), t.getMonth(), 1);
  SCH.sel = todayStr();
  C.bus.emit('schedule');
}
function dShort(d){ return (d.getMonth() + 1) + '/' + d.getDate(); }
function weekRangeLabel(days){ return dShort(days[0]) + ' - ' + dShort(days[6]); }
/* 一天的那一段时间：没填开始时间的算全天，填了开始没填结束的按 60 分钟画 */
function evSpan(n){
  if(!n.time) return null;
  const a = +n.time.slice(0, 2) * 60 + +n.time.slice(3, 5);
  let b = n.endT ? +n.endT.slice(0, 2) * 60 + +n.endT.slice(3, 5) : a + DEF_MIN;
  if(!(b > a)) b = Math.min(a + DEF_MIN, 1440);
  return { a, b };
}

function calHeader(s, C){
  const h = C.el, ic = C.icon;
  const c = SCH.cursor;
  /* 「今天」「＋」跟着日期导航排在左边一组。
     搁在右边正好压在卡片右上角那一排按钮（改代码 / 设置 / 换强调色 …）底下，
     鼠标一悬停就被它们盖住，点着的是上面那一排。 */
  return h('div', { class:'fd-row', style:'flex:0 0 auto;gap:2px' }, [
    h('button', { class:'fd-tool', 'data-nodrag':'1', title:'上一月', html:ic('prev'), onclick:() => { c.setMonth(c.getMonth() - 1); C.bus.emit('schedule'); } }),
    h('b', { style:'font-size:1em;min-width:6.4em;text-align:center' }, c.getFullYear() + ' 年 ' + (c.getMonth() + 1) + ' 月'),
    h('button', { class:'fd-tool', 'data-nodrag':'1', title:'下一月', html:ic('next'), onclick:() => { c.setMonth(c.getMonth() + 1); C.bus.emit('schedule'); } }),
    h('button', { class:'fd-tool', 'data-nodrag':'1', onclick:() => { const t = new Date(); SCH.cursor = new Date(t.getFullYear(), t.getMonth(), 1); SCH.sel = todayStr(); C.bus.emit('schedule'); } }, '今天'),
    h('button', { class:'fd-tool', 'data-nodrag':'1', title:'新建日程', html:ic('plus'), onclick:() => editNode(s, C, SCH.sel) }),
    h('span', { style:'flex:1' })]);
}
/* 月历：每周一个相对定位的行，日期格铺满，甘特条叠在下半部 */
function monthGrid(s, C, weeks, tier){
  const h = C.el;
  const weekStart = C.settings.get('weekStart', 1);
  const labels = weekdayLabels(weekStart);
  const g = h('div', { class:'sch-cal', style:'display:grid;grid-template-rows:auto repeat(' + weeks.length + ',minmax(0,1fr));gap:0;flex:1;min-height:0' });
  const head = h('div', { style:'display:grid;grid-template-columns:repeat(7,1fr);border-bottom:var(--line)' });
  labels.forEach((n, i) => head.appendChild(h('div', { style:'font-size:calc(.72em * var(--sch-big,1));text-align:center;padding:calc(1px * var(--fit,1)) 0;overflow:hidden;white-space:nowrap;color:' +
    (i >= 5 ? 'var(--accent)' : 'var(--text-light)') + ';' + (i < 6 ? 'border-right:var(--line);' : '') }, n)));
  g.appendChild(head);
  weeks.forEach((wk, r) => g.appendChild(weekRow(s, C, wk, r === weeks.length - 1, tier)));
  return g;
}
/* 日期号：今天的那一个坐在主题色的圆片里（图8），其余是淡色数字 */
function dayNum(txt, isToday, tier){
  const h = P.el;
  if(!txt) return h('span');
  return h('span', { style:'display:inline-flex;align-items:center;justify-content:center;min-width:1.5em;height:1.5em;border-radius:50%;' +
    'font-size:calc(.72em * var(--sch-big,1));line-height:1;font-variant-numeric:tabular-nums;' +
    (isToday ? 'font-weight:700;background:var(--accent);color:var(--sel-text);' : 'color:var(--text-light)') }, txt);
}
function weekRow(s, C, wk, isLast, tier){
  const h = C.el;
  const real = wk.filter(Boolean);
  const wStart = dstr(real[0]), wEnd = dstr(real[real.length - 1]);
  const row = h('div', { style:'position:relative;min-height:0' });
  const days = h('div', { style:'position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,1fr)' });
  wk.forEach((d, i) => {
    const ds = d ? dstr(d) : '';
    const isToday = ds === todayStr(), on = ds === SCH.view;
    const kids = ds ? topOn(s, ds).length : 0;
    days.appendChild(h('div', { title:ds, class:'sch-cell' + (i === 6 ? ' edgeR' : '') + (isLast ? ' edgeB' : '') + (d ? '' : ' off'),
      style:ds ? 'background:' + (on ? 'var(--accent-light)' : isToday ? 'color-mix(in srgb,var(--candidate-bg) 80%,transparent)' : 'transparent') + ';' : '',
      onclick:() => { if(!ds) return; SCH.sel = ds; openDayDetail(s, C, ds); } },
      [dayNum(d ? String(d.getDate()) : '', isToday, tier),
        /* 第三档：日期号后面直接写当天压着几条（顶层，子日程的日期已并进父日程）—— 不必悬停、不必点开那天 */
        (tier >= 2 && d && kids) ? h('span', { class:'sch-cnt' }, String(kids)) : null].filter(Boolean)));
  });
  row.appendChild(days);
  const bars = weekBars(s, wk, wStart, wEnd);
  const lanes = packLanes(bars, laneMax(tier || 0));
  if(lanes.length){
    const box = h('div', { class:'sch-lanes', style:'top:calc(1.7em + 5px);bottom:2px' });
    for(const ln of lanes){
      const lane = h('div', { class:'sch-lane' });
      for(const b of ln) lane.appendChild(ganttBar(s, C, b, ln.length, tier));
      box.appendChild(lane);
    }
    row.appendChild(box);
  }
  return row;
}
/* 周那一档的抬头：上一周 / 「10/26 - 11/1」 / 下一周 / 回到本周 */
function weekNav(s, C, days, opt){
  const h = C.el, ic = C.icon;
  const o = opt || {};
  return h('div', { class:'fd-row', style:'flex:0 0 auto;gap:2px' }, [
    h('button', { class:'fd-tool', 'data-nodrag':'1', title:'上一周', html:ic('prev'), onclick:() => shiftWeek(C, -1) }),
    h('b', { style:'font-size:1em;min-width:6.4em;text-align:center' }, weekRangeLabel(days)),
    h('button', { class:'fd-tool', 'data-nodrag':'1', title:'下一周', html:ic('next'), onclick:() => shiftWeek(C, 1) }),
    h('span', { style:'flex:1' }),
    h('button', { class:'fd-tool', 'data-nodrag':'1', onclick:() => backToThisWeek(C) }, o.backText || '回到本周'),
    o.newBtn ? h('button', { class:'fd-tool', 'data-nodrag':'1', title:'新建日程', html:ic('plus'), onclick:() => editNode(s, C, SCH.sel) }) : null
  ].filter(Boolean));
}
function weekBars(s, wk, wStart, wEnd){
  const out = [];
  /* 月格里只铺最上面那一层（外29 第 42 轮，按作者一再重申的那句「父级整条 + 子日程是内部细条」改回来）：
     上一版把子日程也各自摊成一条粗条，几条同头的日程在格子里挤成一排平行粗条 —— 那是错的画法。
     现在一条日程占一条，条按它自己并出来的日期范围铺开；它的下级进这一条自己那一整段里当细条。
     压在一起的那些仍由 packLanes 分行。 */
  const pos = {};
  wk.forEach((d, i) => { if(d) pos[dstr(d)] = i; });
  for(const it of s.items){
    const r = nodeRange(it);
    if(r.end < wStart || r.start > wEnd) continue;
    const l = r.start < wStart ? 0 : pos[r.start], rr = r.end > wEnd ? 6 : pos[r.end];
    if(l === undefined || rr === undefined || l < 0 || rr < 0 || l > rr) continue;
    out.push({ it, l, r:rr, openL:r.start < wStart, openR:r.end > wEnd, subs:subFracs(it, pos, l, rr) });
  }
  return out.sort((a,b) => a.l - b.l || (b.r - b.l) - (a.r - a.l));
}
/* 直接下级在父条那一段里的位置：按它自己并出来的日期范围换算成父条宽度里的百分比，
   跨到父条外面那头的夹到边上 —— 10-03→10-07 和 10-03→10-10 就该看出长短不一样。 */
function subFracs(n, pos, l, r){
  const span = r - l + 1, got = [];
  for(const c of (Array.isArray(n.children) ? n.children : [])){
    if(!c) continue;
    const cr = nodeRange(c);
    let a = pos[cr.start], b = pos[cr.end];
    if(a === undefined || a < l) a = l;
    if(b === undefined || b > r) b = r;
    if(b < a) b = a;
    got.push({ it:c, a:(a - l) / span, b:(b - l + 1) / span });
  }
  return got;
}
/* 贪心分行；超出这一档的行数上限并进最后一行，用 +n 表示。
   上限由卡多大给（laneMax(档)）：小卡 10 行封顶，大卡多给两到四行 —— 大卡的空地方本来就多，
   再按 10 行藏就等于白拉大。 */
function packLanes(bars, max){
  const cap = max || LANE_MAX;
  const lanes = [];
  const rest = [];
  for(const b of bars){
    let idx = lanes.findIndex(ln => !ln.some(x => b.l <= x.r && b.r >= x.l));
    if(idx < 0){ if(lanes.length >= cap - 1){ rest.push(b); continue; } lanes.push([]); idx = lanes.length - 1; }
    lanes[idx].push(b);
  }
  if(rest.length){
    const fake = { it:{ title:'+' + rest.length + ' 项', tags:[], fake:true, count:rest.length }, l:0, r:6, openL:false, openR:false, rest };
    lanes.push([fake]);
  }
  return lanes;
}
function ganttBar(s, C, b, laneCount, tier){
  const h = C.el, ic = C.icon;
  if(b.it.fake){
    return h('div', { class:'sch-bar going', style:'left:0;right:0;background:color-mix(in srgb,var(--text) 12%,var(--face-solid,var(--card-bg)));' +
      'color:var(--text);justify-content:center;font-size:.7em',
      onclick:ev => { ev.stopPropagation(); openDayDetail(s, C, SCH.sel || todayStr()); }, html:ic('plus') + ' 更多' });
  }
  const it = b.it;
  const kids = (Array.isArray(it.children) ? it.children : []).filter(Boolean);
  const left = (b.l / 7 * 100).toFixed(3), width = ((b.r - b.l + 1) / 7 * 100).toFixed(3);
  const el = h('div', { class:'sch-bar' + (b.openL ? ' going' : '') + (kids.length ? ' parent' : ''), title:barTitle(s, it), 'data-nodrag':'1',
    /* 深色粗线那道归 .sch-bar（取主题强调色），这里只铺同色位调出来的浅色 + 按这块底推过的字色 */
    style:'left:' + left + '%;width:' + width + '%;background:' + barTint(C, it.slot) + ';color:' + barText(it.slot) + ';' +
      (laneCount > 4 ? 'padding:0 2px;gap:1px;' : '') +
      (b.openL ? 'border-top-left-radius:0;border-bottom-left-radius:0;' : '') +
      (b.openR ? 'border-top-right-radius:0;border-bottom-right-radius:0;' : '') });
  const p = Math.max(0, Math.min(100, nodeProgress(it)));
  /* 条里那一截深色 = 这一条自己的完成度，但只给底下没人的那一条画（外29 第 42 轮按作者的话分档）：
     走满整条深色、一笔没动整条浅。
     但凡底下还有子日程，这一条就走父日程那一档 —— 整条浅色打底、开头那道深色竖线照旧，
     完成度写在文字后面那枚小标签上，下级由条里那一排细条各自表（不再拿一整截深色压在字底下）。 */
  if(!kids.length && p > 0) el.appendChild(h('i', { class:'sch-fill', style:'width:' + p + '%', 'aria-hidden':'true' }));
  if(b.openL) el.appendChild(h('span', { style:'opacity:.7', html:ic('caretLeft') }));
  el.appendChild(h('span', { style:'overflow:hidden;text-overflow:ellipsis;flex:1' }, it.title));
  /* 第三档那枚完成度多带一句「完成几 / 共几 项」：条本来就有地方，光一个百分数还得自己换算 */
  if(kids.length) el.appendChild(h('i', { class:'sch-pct' }, (tier || 0) >= 2 ?
    p + '% · ' + kids.filter(k => nodeProgress(k) >= 100).length + '/' + kids.length + ' 项' : p + '%'));
  (it.tags || []).forEach(tid => {
    const t = tagOf(s, tid); if(!t) return;
    /* 第三档：标签不再是只认颜色的圆点，名字直接写在条上（悬停那一句还在） */
    if((tier || 0) >= 2){ el.appendChild(h('span', { class:'sch-tag', style:'--c:' + t.color, title:t.name }, t.name)); return; }
    el.appendChild(h('i', { class:'sch-dot', style:'background:' + t.color }));
  });
  if(b.openR) el.appendChild(h('span', { style:'opacity:.7', html:ic('caretRight') }));
  if(kids.length) el.appendChild(subInBar(h, s, C, it, b.subs || [], el));
  el.onclick = ev => { ev.stopPropagation(); editNode(s, C, it.start, it); };
  return el;
}
/* 父条里那一排细条：一个直接下级一根，按它自己的日期在父条宽度里铺开。
   根子自己底下还有人的，吃父日程那一档的缩影（浅底 + 开头一道深色小竖线）；
   最下级那一根就是浅/深：一笔没动浅、做完深，中间那一档在里头填到哪算哪。
   同一头上撞在一起的几根不许叠成一坨（2026-10-07 真页面上量到的：四个同日期子日程都是 left:0;width:100%，
   看着只有一条）—— 按重叠分排往上摞，最多三排，超出并进最后一排。
   点这一根直接开这一条子日程的编辑窗，不必绕到树视图。 */
const SUB_ROWS = 3;
function subInBar(h, s, C, parent, subs, el){
  const rows = [];
  for(const sb of subs){
    let r = rows.findIndex(iv => !iv.some(x => sb.a < x.b && sb.b > x.a));
    if(r < 0){ if(rows.length >= SUB_ROWS) r = rows.length - 1; else { rows.push([]); r = rows.length - 1; } }
    rows[r].push(sb);
  }
  const n = rows.length || 1, tall = n === 1;
  const hh = tall ? 4 : n * 3 - 1;
  /* 排数多于样式里那一档预留的 5px 时，把这一条自己底下让出来的高度现算上去（字和细条不叠） */
  if(el && !tall) el.style.paddingBottom = (hh + 2) + 'px';
  const box = h('div', { class:'sch-inbar', style:'height:' + hh + 'px' });
  rows.forEach((row, r) => {
    for(const sb of row){
      const p = Math.max(0, Math.min(100, nodeProgress(sb.it)));
      const has = (Array.isArray(sb.it.children) ? sb.it.children : []).filter(Boolean).length > 0;
      const bar = h('i', { class:(has ? 'has ' : '') + (p >= 100 ? 'full' : ''),
        style:'left:' + (sb.a * 100).toFixed(2) + '%;width:' + Math.max(1.5, (sb.b - sb.a) * 100).toFixed(2) + '%' +
          ';bottom:' + (tall ? 0 : r * 3) + 'px' + (tall ? '' : ';height:2px'),
        title:sb.it.title + ' ｜ ' + p + '%' + (has ? ' ｜ 底下还有 ' + sb.it.children.filter(Boolean).length + ' 项' : '') +
          (n > 1 ? ' ｜ 同一段上挤了 ' + n + ' 排' : ''),
        onclick:ev => { ev.stopPropagation(); editNode(s, C, sb.it.start || parent.start, sb.it); } });
      if(p > 0 && p < 100) bar.appendChild(h('b', { style:'width:' + p + '%' }));
      box.appendChild(bar);
    }
  });
  return box;
}
function barTitle(s, it){
  if(it.fake) return '还有 ' + it.count + ' 条，点日期看全部';
  const r = nodeRange(it);
  const tg = (it.tags || []).map(id => { const t = tagOf(s, id); return t ? t.name : ''; }).filter(Boolean).join(' / ');
  return it.title + ' · ' + r.start + (r.end !== r.start ? ' → ' + r.end : '') + (tg ? ' · ' + tg : '');
}
/* 这天压着哪些日程 —— 只数顶层，子日程的日期已经并进父日程 */
function topOn(s, day){
  return s.items.filter(n => { const r = nodeRange(n); return day >= r.start && day <= r.end; });
}
/* ---------- 日程条的浅色填充、条上的字、色位圆点 ----------
   这三样都不再拿 --card-bg 当底：--card-bg 是没往墨色掺过、也没经过外观模式合成的
   那个卡片色，而字真正压在的是合成后那一块面。外观层（sh-look 的 readable()）会把
   「合成后的面 + 这一条自己的色位掺 18%」算成 --slot-N-bar 发下来，条上的字跟着给一份
   --slot-N-bar-text（按这块底推到 4.5），色位圆点给 --slot-N-dot（按与所在面 3:1 推过）。
   哪一档取不到就退回老算式，底至少换成 --face-solid（就是合成后那块面）。
   深色粗线那道（.sch-bar 的 border-left）和它的圆角照旧归样式里的主题强调色，一个字不碰。 */
function slotIdx(slot){ return ((slot || 0) % 5) + 1; }
function barTint(C, slot){ const i = slotIdx(slot);
  return 'var(--slot-' + i + '-bar,color-mix(in srgb,' + C.slotColor(slot) + ' 18%,var(--face-solid,var(--card-bg))))'; }
function barText(slot){ return 'var(--slot-' + slotIdx(slot) + '-bar-text,var(--text))'; }
function dotColor(C, slot){ const i = slotIdx(slot); return 'var(--slot-' + i + '-dot,' + C.slotColor(slot) + ')'; }

/* ---------- 卡面太矮塞不下整张月历时：本周七列迷你竖条，一列一天 ---------- */
function miniWeek(s, C){
  const h = C.el;
  const weekStart = C.settings.get('weekStart', 1);
  const days = weekDates(SCH.wc, weekStart);
  const labels = weekdayLabels(weekStart);
  const box = h('div', { style:'display:flex;flex-direction:column;gap:calc(2px * var(--fit,1));height:100%;min-height:0' });
  box.appendChild(weekNav(s, C, days, { backText:'本周', newBtn:true }));
  const grid = h('div', { class:'sch-mini' });
  days.forEach((d, i) => {
    const ds = dstr(d), isToday = ds === todayStr(), on = ds === SCH.view;
    const items = topOn(s, ds);
    const col = h('div', { class:'sch-mcol' + (i === 6 ? ' edgeR' : ''),
      title:ds + ' ' + labels[i] + (items.length ? ' · ' + items.length + ' 项' : ' · 还没有安排'),
      style:'background:' + (on ? 'var(--accent-light)' : isToday ? 'color-mix(in srgb,var(--candidate-bg) 80%,transparent)' : 'transparent') + ';',
      onclick:() => { SCH.sel = ds; openDayDetail(s, C, ds); } });
    col.appendChild(h('div', { style:'display:flex;justify-content:center;flex:0 0 auto' }, dayNum(String(d.getDate()), isToday)));
    col.appendChild(h('div', { style:'font-size:.64em;text-align:center;line-height:1.2;color:var(--text-light);flex:0 0 auto;white-space:nowrap' }, labels[i]));
    items.slice(0, MINI_MAX).forEach(it => col.appendChild(h('div', { class:'sch-mbar', title:barTitle(s, it), style:'background:' + barTint(C, it.slot) })));
    if(items.length > MINI_MAX)
      col.appendChild(h('div', { class:'sch-mbar going', title:'还有 ' + (items.length - MINI_MAX) + ' 条，点这一列看全部',
        style:'background:color-mix(in srgb,var(--text) 12%,var(--face-solid,var(--card-bg)))' }));
    grid.appendChild(col);
  });
  box.appendChild(grid);
  return box;
}

/* ---------- 周视图：列是周一到周日，行是时间刻度 ---------- */
const WEEK_HOUR = 40;
function weekTable(s, C){
  const h = C.el;
  const weekStart = C.settings.get('weekStart', 1);
  const days = weekDates(SCH.wc, weekStart);
  const ds = days.map(dstr);
  const labels = weekdayLabels(weekStart);
  const box = h('div', { class:'sch-weekv', style:'display:grid;gap:8px' });
  box.appendChild(weekNav(s, C, days, {}));

  /* 跨天的、还有没填开始时间的都摊进「全天」那一行；填了开始时间的才落到时间格里 */
  const band = [];
  const timed = days.map(() => []);
  let h0 = 7, h1 = 22;
  const pos = {}; ds.forEach((d, i) => { pos[d] = i; });
  for(const it of s.items){
    const r = nodeRange(it);
    if(r.end < ds[0] || r.start > ds[6]) continue;
    let l = ds.indexOf(r.start); if(l < 0) l = 0;
    let rr = ds.indexOf(r.end); if(rr < 0) rr = 6;
    const sp = r.start === r.end ? evSpan(it) : null;
    /* 全天那一行跟月格那一档吃同一套画法：这一层只铺最上面那一条，条底那一排细条 = 它的直接下级（同一个 subFracs 算出来的） */
    if(sp){ timed[l].push({ it, a:sp.a, b:sp.b }); h0 = Math.min(h0, Math.floor(sp.a / 60)); h1 = Math.max(h1, Math.ceil(sp.b / 60)); }
    else band.push({ it, l, r:rr, openL:r.start < ds[0], openR:r.end > ds[6], subs:subFracs(it, pos, l, rr) });
  }
  const total = (h1 - h0) * WEEK_HOUR;
  const gutter = '4.2em';

  /* 全天那一行：这一周里没有开始时间的、还有跨天的都摊在这儿；一条都没有就不占这一行 */
  if(band.length){
    const bandRow = h('div', { style:'display:grid;grid-template-columns:' + gutter + ' repeat(7,1fr);border:var(--line);border-radius:var(--r-card,5px);overflow:hidden' });
    bandRow.appendChild(h('div', { class:'fd-hint', style:'font-size:.72em;text-align:right;padding:3px 6px 0 0;border-right:var(--line)' }, '全天'));
    const bandBox = h('div', { style:'position:relative;grid-column:2/8' });
    const lanes = packLanes(band);
    lanes.forEach(ln => {
      const lane = h('div', { class:'sch-lane', style:'height:20px;flex:0 0 auto' });
      for(const b of ln){
        const bar = ganttBar(s, C, b, lanes.length);
        bar.style.top = '2px'; bar.style.bottom = '2px';
        lane.appendChild(bar);
      }
      bandBox.appendChild(lane);
    });
    bandRow.appendChild(bandBox);
    box.appendChild(bandRow);
  }

  /* 时间格 */
  const grid = h('div', { style:'display:grid;grid-template-columns:' + gutter + ' repeat(7,1fr);position:relative' });
  const head = h('div', { style:'display:grid;grid-template-columns:' + gutter + ' repeat(7,1fr);border-bottom:var(--line)' });
  head.appendChild(h('div', { style:'border-right:var(--line)' }));
  days.forEach((d, i) => {
    const t = ds[i] === todayStr(), on = ds[i] === SCH.view;
    head.appendChild(h('div', { title:ds[i], style:'text-align:center;padding:2px 0;cursor:pointer;overflow:hidden;white-space:nowrap;' +
      'border-right:' + (i < 6 ? 'var(--line)' : 'none') + ';' +
      'background:' + (on ? 'var(--accent-light)' : 'transparent'),
      onclick:() => { SCH.sel = ds[i]; openDayDetail(s, C, ds[i]); } }, [
      h('div', { style:'font-size:.72em;' + (i >= 5 ? 'color:var(--accent-text,var(--accent));' : 'color:var(--text-light);') }, labels[i]),
      h('div', { style:'display:flex;justify-content:center' }, dayNum(String(d.getDate()), t))]));
  });
  box.appendChild(head);
  box.appendChild(grid);

  /* 左边的时间刻度 */
  const scale = h('div', { style:'border-right:var(--line)' });
  for(let hh = h0; hh < h1; hh++)
    scale.appendChild(h('div', { class:'sch-thour', style:'height:' + WEEK_HOUR + 'px;font-size:.68em;color:var(--text-light);text-align:right;padding:0 5px;line-height:1.4' },
      String(hh).padStart(2, '0') + ':00'));
  grid.appendChild(scale);

  days.forEach((d, i) => {
    const col = h('div', { class:'sch-tcol' + (i === 6 ? ' edgeR' : ''), style:'height:' + total + 'px;cursor:pointer', title:ds[i] });
    for(let hh = h0; hh < h1; hh++) col.appendChild(h('div', { class:'sch-thour', style:'height:' + WEEK_HOUR + 'px' }));
    col.onclick = () => { SCH.sel = ds[i]; openDayDetail(s, C, ds[i]); };
    packDayLanes(timed[i]).forEach(e => col.appendChild(timeCard(s, C, e, h0, timed[i].laneN)));
    grid.appendChild(col);
  });

  /* 「现在」这条线 */
  const ti = ds.indexOf(todayStr());
  if(ti >= 0){
    const line = h('div', { class:'sch-tnow', style:'display:none' }, [h('i'), h('b')]);
    grid.appendChild(line);
    const place = () => {
      const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
      const y = (m - h0 * 60) / 60 * WEEK_HOUR;
      if(m < h0 * 60 || m > h1 * 60 || y > total){ line.style.display = 'none'; return; }
      line.style.display = ''; line.style.top = y + 'px';
      line.lastChild.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    place();
    if(SCH.nowTimer) clearInterval(SCH.nowTimer);
    SCH.nowTimer = setInterval(place, 30000);
  }
  return box;
}
/* 同一天里重叠的并排分栏：按开始时间排，能接在前面那条结束的后面就接着站 */
function packDayLanes(list){
  const ends = [];
  for(const e of list.sort((a, b) => a.a - b.a || (b.b - b.a) - (a.b - a.a))){
    let k = ends.findIndex(x => x <= e.a);
    if(k < 0){ ends.push(e.b); k = ends.length - 1; } else ends[k] = e.b;
    e.lane = k;
  }
  list.laneN = Math.max(1, ends.length);
  return list;
}
function timeCard(s, C, e, h0, laneN){
  const h = C.el;
  const it = e.it;
  const top = (e.a - h0 * 60) / 60 * WEEK_HOUR;
  const height = Math.max((e.b - e.a) / 60 * WEEK_HOUR - 2, 20);
  const w = 100 / laneN;
  const el = h('div', { class:'sch-tcard', title:barTitle(s, it), 'data-nodrag':'1',
    style:'top:' + top.toFixed(2) + 'px;height:' + height.toFixed(2) + 'px;left:calc(' + (e.lane * w).toFixed(3) + '% + 2px);' +
      'width:calc(' + w.toFixed(3) + '% - 4px);background:' + barTint(C, it.slot) + ';' +
      (height < 34 ? 'padding:0 4px;' : '') });
  el.onclick = ev => { ev.stopPropagation(); editNode(s, C, it.start, it); };
  el.appendChild(h('div', { style:'color:var(--accent-text,var(--accent));font-size:.72em;line-height:1.25;white-space:nowrap' },
    it.time + (it.endT ? ' - ' + it.endT : '')));
  el.appendChild(h('div', { style:'font-weight:700;font-size:.82em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' +
    (it.done ? ';text-decoration:line-through;color:var(--text-light)' : '') }, it.title));
  if(height >= 48){
    const tg = (it.tags || []).map(id => tagOf(s, id)).filter(Boolean);
    if(tg.length) el.appendChild(h('div', { style:'display:flex;gap:3px;margin-top:1px' },
      tg.map(t => h('i', { class:'sch-dot', title:t.name, style:'background:' + t.color }))));
  }
  return el;
}

/* ---------- 当日详情视图 ---------- */
function openDayDetail(s, C, ds){
  const h = C.el, ic = C.icon;
  /* 选中色只活在这一张面板开着的那段时间：进来点亮那一天，面板一关（关闭/取消/保存/Esc 都算）
     就当场撤掉并重画日历 —— 外13 说的「关掉对话框后那一格还亮着」就是从前没有这一笔清账。 */
  SCH.view = ds; C.bus.emit('schedule');
  const wrap = h('div', { style:'display:grid;gap:12px;min-width:min(560px,88vw);max-height:70vh;overflow:auto' });
  wrap.appendChild(h('div', { style:'font-weight:700;font-size:1.1429em' }, ds + ' ' + weekdayStyle().names[P.parseDate(ds).getDay()] + (ds === todayStr() ? ' · 今天' : '')));
  const list = h('div', { style:'display:grid;gap:6px' });
  const draw = () => {
    list.innerHTML = '';
    const on = topOn(s, ds);
    if(!on.length) list.appendChild(h('div', { class:'fd-hint' }, '这天还没有安排'));
    for(const n of on){
      const r = nodeRange(n);
      const hit = findNode(s, n.id);
      /* 这一天的每一条日程是一张卡：挂 data-look 让它吃外观层算完的那块卡面。
         只靠自己那圈边框分行，在质感那一档边框宽度是 0，几条日程会连成一片。 */
      const row = h('div', { 'data-look':'', style:'border:var(--bw) solid var(--card-border);border-radius:var(--r-card,5px);padding:7px 10px;display:grid;gap:5px' });
      row.appendChild(h('div', { class:'fd-row', style:'align-items:center' }, [
        h('span', { style:'width:9px;height:9px;border-radius:50%;background:' + dotColor(C, n.slot) + ';flex:0 0 auto' }),
        h('b', { style:'flex:1;' + (n.done ? 'text-decoration:line-through;color:var(--text-light)' : '') }, n.title),
        h('span', { class:'fd-hint' }, r.start === r.end ? (n.time ? n.time + (n.endT ? ' - ' + n.endT : '') : '全天') : r.start.slice(5) + ' → ' + r.end.slice(5)),
        h('button', { class:'fd-tool', onclick:() => editNode(s, C, ds, n, draw) }, '编辑')]));
      const meta = [];
      const 子条 = (Array.isArray(n.children) && n.children.length) ? subBars(h, n) : null;
      if(子条) meta.push('子日程 ' + n.children.length + ' 项');
      else if(n.children) meta.push('进度 ' + nodeProgress(n) + '%');
      if(hit && hit.depth > 1) meta.push('第 ' + hit.depth + ' 层');
      if(meta.length) row.appendChild(h('div', { class:'fd-hint' }, meta.join(' · ')));
      /* 完成度摆细条不摆百分数（外27 图13）：一个子一条，条里填到哪就是它完成多少 */
      if(子条) row.appendChild(h('div', { class:'fd-row' }, [子条]));
      if((n.tags || []).length) row.appendChild(h('div', { class:'fd-row', style:'flex-wrap:wrap;gap:5px' },
        n.tags.map(id => { const t = tagOf(s, id); return t ? h('span', { 'data-look-edge':'', style:'display:inline-flex;align-items:center;gap:4px;font-size:.7857em;' +
          'border-radius:var(--r-pill,5px);padding:1px 8px' }, [
          h('i', { class:'sch-dot', style:'background:' + t.color }), t.name]) : null; }).filter(Boolean)));
      if(n.note) row.appendChild(h('div', { style:'white-space:pre-wrap;font-size:.8571em' }, n.note));
      list.appendChild(row);
    }
  };
  draw();
  wrap.appendChild(list);
  const quick = h('input', { class:'fd-input', placeholder:'加一条这天的日程，回车确认' });
  quick.addEventListener('keydown', e => {
    if(e.key !== 'Enter' || !quick.value.trim()) return;
    const n = newNode(quick.value.trim(), ds, ds); n.slot = s.items.length % 5;
    s.items.push(n); saveSch(s); C.bus.emit('schedule'); quick.value = ''; draw();
  });
  wrap.appendChild(quick);
  C.dialog.open('日程详情 · ' + ds, wrap, [
    h('button', { class:'fd-btn', html:ic('plus') + ' 完整日程', onclick:() => editNode(s, C, ds) }),
    h('span', { style:'flex:1' }),
    h('button', { class:'fd-btn primary', onclick:() => C.dialog.close() }, '保存')],
    () => { SCH.view = ''; C.bus.emit('schedule'); });
}

/* ---------- 日程编辑器（含子日程树，最多 5 层） ----------
   onDone：这一条保存 / 删除之后，把点进来的那一张框也重画一遍 —— 父日程的编辑框
   是从子日程的编辑框退回来的（宿主的对话框还的是同一批活节点），不重画就还是旧样子。 */
function editNode(s, C, day, exist, onDone){
  const h = C.el, ic = C.icon;
  const hit = exist ? findNode(s, exist.id) : null;
  const depth = hit ? hit.depth : 1;
  const rec = exist || newNode('', day, day);
  if(!Array.isArray(rec.children)) rec.children = [];
  if(!Array.isArray(rec.tags)) rec.tags = [];
  const title = h('input', { class:'fd-input', value:rec.title, placeholder:'日程名称' });
  /* 这四个框别再用 .fd-input 那句 width:100%：一行里挤着四个框加四个名字，
     谁都想要 100%，结果谁都被压 —— 名字里的「开始」「结束」就被压成两行。
     日期要装下 2026-10-04 和日历小图标，时间只装 --:-- 和时钟小图标，各给各的宽度。 */
  const DBOX = 'flex:0 0 auto;width:104px', TBOX = 'flex:0 0 auto;width:82px';
  const start = h('input', { class:'fd-input', type:'date', value:rec.start, style:DBOX });
  const end = h('input', { class:'fd-input', type:'date', value:rec.end || rec.start, style:DBOX });
  const time = h('input', { class:'fd-input', type:'time', value:rec.time || '', style:TBOX });
  const endT = h('input', { class:'fd-input', type:'time', value:rec.endT || '', style:TBOX });
  const note = h('textarea', { class:'fd-input', rows:'2', placeholder:'备注（可空）' }); note.value = rec.note || '';
  const isParent = rec.children.length > 0;
  const rangeLine = h('div', { class:'fd-hint' });
  const slot = h('div', { class:'fd-row' });
  const drawSlots = () => { slot.innerHTML = ''; for(let i = 0; i < 5; i++) slot.appendChild(h('button', { class:'fd-dot' + (rec.slot === i ? ' on' : ''),
    type:'button', style:'background:' + dotColor(C, i), title:'第 ' + (i + 1) + ' 号色位：这条日程在周条上的颜色',
    onclick:() => { rec.slot = i; drawSlots(); } })); };
  drawSlots();
  /* 标签多选 */
  const tagBox = h('div', { class:'fd-row', style:'flex-wrap:wrap;gap:5px' });
  const drawTags = () => {
    tagBox.innerHTML = '';
    for(const tid of rec.tags){
      const t = tagOf(s, tid); if(!t) continue;
      tagBox.appendChild(h('span', { style:'display:inline-flex;align-items:center;gap:4px;font-size:.7857em;border-radius:var(--r-pill,5px);padding:2px 8px;' +
        'background:color-mix(in srgb,' + t.color + ' 22%,transparent);border:var(--bw) solid ' + t.color }, [
        h('i', { class:'sch-dot', style:'background:' + t.color }), t.name,
        h('button', { class:'fd-tool', style:'padding:0 2px', title:'去掉这个标签', html:ic('close'), onclick:() => { rec.tags = rec.tags.filter(x => x !== tid); drawTags(); } })]));
    }
    const pick = h('select', { class:'fd-input', style:'width:auto;max-width:11em' }, [h('option', { value:'' }, '＋ 选标签…')].concat(
      s.tags.map(t => h('option', { value:t.id }, t.name))));
    pick.onchange = () => { if(pick.value && rec.tags.indexOf(pick.value) < 0) rec.tags.push(pick.value); drawTags(); };
    tagBox.appendChild(pick);
    const add = h('input', { class:'fd-input', style:'width:auto;max-width:11em', placeholder:'新建标签，回车保存' });
    add.addEventListener('keydown', e => {
      if(e.key !== 'Enter' || !add.value.trim()) return;
      /* 新标签的默认色走宿主的色位「具体色号」出口 ctx.slotHex(i)：用户没亲手改过之前，
         新建一个就接上他在 设置·外观 里自己挑的那一串标记色（编号跟 slotColor 一样从 0 数、绕回）。
         标签色存的是色号本身（存下后能单独改，老存档里的色号照旧能用），所以读的是这个数而不是
         slotColor 那句 CSS 取值串；取不到时兜底成一个合法色号是宿主的事，这里只管拿数存。 */
      const t = { id:'g' + Date.now().toString(36), name:add.value.trim(), color:C.slotHex(s.tags.length) };
      s.tags.push(t); rec.tags.push(t.id); add.value = ''; drawTags(); C.bus.emit('schedule');
    });
    tagBox.appendChild(add);
  };
  drawTags();
  /* 子日程 */
  const subList = h('div', { style:'display:grid;gap:4px' });
  /* 动过子日程，就把这一条对外那一段重新并一次，并把框里那四个格子跟着对上：
     光并数据不改格子，这张框里还写着上一版的起止；光改格子不并数据，外面那一层照旧是旧的。 */
  const showSpan = () => {
    syncSpan(rec);
    start.value = rec.start; end.value = rec.end || rec.start;
    time.value = rec.time || ''; endT.value = rec.endT || '';
  };
  const backFromChild = () => { showSpan(); drawSubs(); drawMeta(); };
  const drawSubs = () => {
    subList.innerHTML = '';
    rec.children.forEach((c, i) => {
      const cb = h('input', { type:'checkbox' }); cb.checked = !!c.done;
      cb.onchange = () => { c.done = cb.checked; drawSubs(); drawMeta(); };
      subList.appendChild(h('div', { class:'fd-row', style:'padding-left:' + Math.min(4, i) * 0 + 'px' }, [
        h('span', { class:'fd-hint', style:'width:1.2em' }, '·'), cb,
        h('span', { style:'flex:1' + (c.done ? ';text-decoration:line-through;color:var(--text-light)' : '') }, c.title),
        h('span', { class:'fd-hint' }, nodeRange(c).start === nodeRange(c).end ? '' : nodeRange(c).start.slice(5) + '→' + nodeRange(c).end.slice(5)),
        h('button', { class:'fd-tool', onclick:() => editNode(s, C, c.start, c, backFromChild) }, '编辑'),
        h('button', { class:'fd-tool', title:'删掉这个子日程', html:ic('close'), onclick:async () => {
          if(!await C.ask('删掉子日程「' + c.title + '」？父日程那一段日期和进度是这几条并出来的，抽掉一条会跟着重算。', '删除')) return;
          rec.children.splice(i, 1); showSpan(); drawSubs(); drawMeta();
        } })]));
    });
    const add = h('input', { class:'fd-input', placeholder:'加一个子日程，回车（含本条最多 ' + MAX_DEPTH + ' 层）' });
    add.addEventListener('keydown', e => {
      if(e.key !== 'Enter' || !add.value.trim()) return;
      const r = nodeRange(rec);
      const c = newNode(add.value.trim(), rec.start || r.start, rec.end || r.end);
      /* 新子日程先接父日程现在这一段：日期本来就是这么接的，钟点也得跟着接。
         不接的话「添一条没钟点的子日程」会把外面那层的钟点并成空 —— 父日程的钟点
         现在是子日程并出来的，没一条带钟点就等于全天。 */
      c.time = rec.time || ''; c.endT = rec.endT || '';
      rec.children.push(c);
      add.value = ''; showSpan(); drawSubs(); drawMeta();
    });
    subList.appendChild(depth >= MAX_DEPTH ? h('div', { class:'fd-hint' }, '已经到第 ' + MAX_DEPTH + ' 层，不能再加子日程') : add);
  };
  const pct = h('b', { style:'min-width:3.2em;text-align:right' }, nodeProgress(rec) + '%');
  const rng = h('input', { type:'range', min:'0', max:'100', value:String(nodeProgress(rec)), style:'flex:1',
    oninput:e => { rec.progress = +e.target.value; rec.children = []; pct.textContent = rec.progress + '%'; } });
  const drawMeta = () => {
    const r = nodeRange(rec);
    pct.textContent = nodeProgress(rec) + '%';
    rangeLine.textContent = isParent ? '日期、钟点与进度由子日程自动算：' + r.start + (r.end !== r.start ? ' → ' + r.end : '') : '';
    rng.style.display = isParent ? 'none' : '';
  };
  drawSubs(); drawMeta();
  const body = h('div', { style:'display:grid;gap:10px;min-width:min(520px,88vw)' }, [
    title,
    h('div', { class:'fd-row', style:'white-space:nowrap' }, [h('span',{class:'fd-hint'},'起'), start, h('span',{class:'fd-hint'},'止'), end,
      h('span',{class:'fd-hint'},'开始'), time, h('span',{class:'fd-hint'},'结束'), endT]),
    rangeLine,
    isParent ? h('div', { class:'fd-row' }, [h('span',{class:'fd-hint'},'进度'), pct]) :
      h('div', { class:'fd-row' }, [h('span',{class:'fd-hint'},'进度'), rng, pct]),
    h('div', { class:'fd-row' }, [h('span',{class:'fd-hint'},'色条'), slot, h('span',{class:'fd-hint'},'标签'), tagBox]),
    h('div', { class:'fd-hint' }, '子日程'),
    subList,
    note]);
  const foot = [];
  if(exist) foot.push(h('button', { class:'fd-btn danger', onclick:async () => {
    if(!await C.ask('删掉「' + rec.title + '」这条日程？' +
      (rec.children.length ? '\n底下那 ' + rec.children.length + ' 个子日程跟着一起没。' : '') +
      '\n日程库没有回收站，删了捞不回来。', '删除')) return;
    const p = hit && hit.parent;
    if(p) p.children = p.children.filter(x => x.id !== rec.id);
    else s.items = s.items.filter(x => x.id !== rec.id);
    /* 删掉的要是某条日程最后一个子日程，上面那几层占的那一段得重新并一遍再重画 */
    syncSpans(s.items);
    saveSch(s); C.bus.emit('schedule'); if(onDone) onDone(); C.dialog.close();
  }}, '删除'));
  foot.push(h('span', { style:'flex:1' }));
  foot.push(h('button', { class:'fd-btn', onclick:() => C.dialog.close() }, '取消'));
  foot.push(h('button', { class:'fd-btn primary', onclick:() => {
    rec.title = title.value.trim() || '(未命名)';
    rec.start = start.value || day;
    rec.end = end.value || rec.start;
    if(rec.end < rec.start) rec.end = rec.start;
    rec.time = time.value; rec.endT = endT.value; rec.note = note.value.trim();
    if(!hit){ rec.slot = s.items.length % 5; s.items.push(rec); }
    /* 这一条自己可能就是别人的子日程：改完它的起止 / 钟点，上面几层那一段要跟着重新并，
       并完再 saveSch + 广播 —— 顺序反过来外面那一层画的就是还没并的旧值。
       带子日程的那一条认的是子日程并上来的那一段，这里框里手动敲的日期让位子日程。 */
    syncSpans(s.items);
    saveSch(s); C.bus.emit('schedule'); if(onDone) onDone(); C.dialog.close();
  }}, '保存'));
  C.dialog.open((exist ? '编辑日程' : '新建日程') + (depth > 1 ? ' · 第 ' + depth + ' 层' : ''), body, foot);
  setTimeout(() => title.focus(), 30);
}
/* ---------- 放大视图：⛶ 封面和展开卡共用一份 ---------- */
function scheduleFullNode(C, onTitle){
  const h = C.el, ic = C.icon;
  const host = h('div', { style:C.fullStyle });
  const render = async () => {
    const s = await loadSch();
    const title = SCH.fullMode === 'w'
      ? '日程 · 周视图（' + weekRangeLabel(weekDates(SCH.wc, P.settings.get('weekStart', 1))) + '）'
      : '日程 · ' + SCH.cursor.getFullYear() + ' 年 ' + (SCH.cursor.getMonth() + 1) + ' 月';
    if(onTitle) onTitle(title);
    host.innerHTML = '';
    host.appendChild(h('div', { class:'fd-row', style:'gap:10px' }, [
      C.segCtrl([{v:'m', t:'月视图'}, {v:'w', t:'周视图'}, {v:'y', t:'年视图'}, {v:'t', t:'全部树'}], () => SCH.fullMode, v => { SCH.fullMode = v; render(); }),
      /* 周视图自己带「上一周 / 10月26日 - 11月1日 / 下一周 / 回到本周」那一排，这里就不再叠一月历抬头 */
      SCH.fullMode === 'w' ? null : calHeader(s, C),
      h('button', { class:'fd-btn mini', html:ic('plus') + ' 新建', onclick:() => editNode(s, C, SCH.sel) })].filter(Boolean)));
    /* 底部留一道内间距：月 / 周 / 年 / 全部树四种视图的最后一行都不贴着卡片底边 */
    const main = h('div', { style:'flex:1;min-height:0;overflow:auto;padding-bottom:14px' });
    host.appendChild(main);
    /* 切走周视图就把「现在」那条线的定时停掉：那条线只活在周视图里，留着定时等于空转 */
    if(SCH.fullMode !== 'w' && SCH.nowTimer){ clearInterval(SCH.nowTimer); SCH.nowTimer = null; }
    if(SCH.fullMode === 'y') renderYear(main, s);
    else if(SCH.fullMode === 't') renderTree(main, s, C);
    else if(SCH.fullMode === 'w') main.appendChild(weekTable(s, C));
    else renderFullMonth(main, s, C);
  };
  C.bus.on('schedule', render);
  render();
  return { node:host, dispose(){
    if(SCH.nowTimer){ clearInterval(SCH.nowTimer); SCH.nowTimer = null; }
    C.bus.map['schedule'] = (C.bus.map['schedule'] || []).filter(f => f !== render);
  } };
}
function openScheduleFull(C){
  let f;
  f = scheduleFullNode(C, title => {
    /* 标题跟着全览那一档走：只在封面里铺着的确实是这张日程卡时才改，
       摸封面的活儿归宿主的 ctx.cover，组件不碰宿主的 DOM 节点 */
    const body = C.cover.body();
    if(body && f.node && body.contains(f.node)) C.cover.setTitle(title);
  });
  C.cover.openNode('日程 · ' + SCH.cursor.getFullYear() + ' 年 ' + (SCH.cursor.getMonth() + 1) + ' 月',
    C.coverWrap(f.node), () => { f.dispose(); C.bus.emit('schedule'); });
}
function renderFullMonth(main, s, C){
  const h = C.el;
  const weeks = monthWeeks(SCH.cursor.getFullYear(), SCH.cursor.getMonth(), C.settings.get('weekStart', 1));
  const box = h('div', { class:'sch-cal', style:'display:grid;grid-template-rows:auto repeat(' + weeks.length + ',minmax(84px,1fr));gap:0;height:100%' });
  const head = h('div', { style:'display:grid;grid-template-columns:repeat(7,1fr);border-bottom:var(--line)' });
  weekdayLabels(C.settings.get('weekStart', 1)).forEach((n, i) => head.appendChild(h('div', { style:'text-align:center;font-size:.8571em;padding:2px 0;' +
    (i < 6 ? 'border-right:var(--line);' : '') + 'color:' + (i >= 5 ? 'var(--accent)' : 'var(--text-light)') }, n)));
  box.appendChild(head);
  main.appendChild(box);
  weeks.forEach((wk, r) => {
    const row = weekRow(s, C, wk, r === weeks.length - 1);
    row.style.minHeight = '84px';
    box.appendChild(row);
  });
}
function renderTree(main, s, C){
  const h = C.el, ic = C.icon;
  if(!s.items.length){ main.appendChild(h('div', { class:'fd-empty' }, '还没有日程')); return; }
  const wrap = h('div', { style:'display:grid;gap:4px' });
  const drawNode = (n, depth, parent) => {
    const r = nodeRange(n);
    const bar = h('div', { class:'fd-row', style:'padding:5px 8px;border:var(--bw) solid var(--card-border);border-radius:var(--r-card,5px);margin-left:' + (depth - 1) * 22 + 'px' }, [
      h('span', { style:'width:8px;height:8px;border-radius:50%;background:' + dotColor(C, n.slot) }),
      h('span', { style:'flex:1' + (n.done ? ';text-decoration:line-through;color:var(--text-light)' : '') }, n.title),
      /* 主日程里直接看见每一个子日程完成到哪（外26 第 13 条）：一个子一条横向细条，条里的填充就是完成度。
         有子日程就只摆细条，右边那个百分数撤掉（外27 图13：那个数难看）—— 数在每一条自己的悬停说明里。 */
      subBars(h, n),
      h('span', { class:'fd-hint' }, r.start === r.end ? r.start.slice(5) : r.start.slice(5) + ' → ' + r.end.slice(5)),
      (n.children || []).length ? null : h('span', { class:'fd-hint', style:'width:3.4em;text-align:right',
        title:'完成度 ' + nodeProgress(n) + '%' }, nodeProgress(n) + '%'),
      (n.tags || []).map(id => { const t = tagOf(s, id); return t ? h('i', { class:'sch-dot', title:t.name, style:'background:' + t.color }) : null; }),
      depth < MAX_DEPTH ? h('button', { class:'fd-tool', title:'加子日程', html:ic('plus'), onclick:() => {
        /* 添了子日程，这一条对外那一段就换成由子日程并出来，并完再存再重画。
           新子日程接上父日程现在那一段（钟点也接）：不接就等于添了一条全天的，
           外面那层的钟点会被并成空。 */
        n.children = n.children || [];
        const c = newNode('子日程', n.start, n.end); c.time = n.time || ''; c.endT = n.endT || '';
        n.children.push(c); syncSpans(s.items); saveSch(s); C.bus.emit('schedule'); renderTree(main, s, C);
      } }) : null,
      h('button', { class:'fd-tool', onclick:() => editNode(s, C, n.start, n) }, '编辑')].flat());
    wrap.appendChild(bar);
    (n.children || []).forEach(c => drawNode(c, depth + 1, n));
  };
  s.items.forEach(n => drawNode(n, 1, null));
  main.appendChild(wrap);
}
function renderYear(main, s){
  const h = P.el;
  const y = SCH.cursor.getFullYear();
  const weekStart = P.settings.get('weekStart', 1);
  const grid = h('div', { style:'display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px' });
  const count = ds => topOn(s, ds).length;
  for(let m = 0; m < 12; m++){
    const box = h('div', { style:'cursor:pointer', onclick:() => { SCH.cursor = new Date(y, m, 1); SCH.fullMode = 'm'; P.bus.emit('schedule'); } }, [
      h('div', { style:'font-weight:700;margin-bottom:4px' }, (m + 1) + ' 月'),
      h('div', { style:'display:grid;grid-template-columns:repeat(7,1fr);gap:2px' }, monthCells(y, m, weekStart).map(d => {
        if(!d) return h('div');
        const ds = dstr(d), n = count(ds);
        return h('div', { title:ds + (n ? ' · ' + n + ' 项' : ''), style:'aspect-ratio:1;border-radius:var(--r-btn,5px);display:flex;align-items:center;justify-content:center;background:' +
          (n ? 'var(--accent)' : 'color-mix(in srgb,var(--text) 8%,transparent)') },
          h('span', { style:'font-size:.6429em;color:' + (n ? 'var(--sel-text)' : 'var(--text-light)') }, String(d.getDate())));
      }))]);
    grid.appendChild(box);
  }
  main.appendChild(grid);
}

/* ---------- 标签编辑器：从前的「设置 · 组件 · 日程 · 标签」那一行，
   现在摆进这一家自己的齿轮对话框 ---------- */
function tagEditor(C){
  const h = C.el, ic = C.icon;
  const box = h('div', { style:'display:grid;gap:6px' });
  const draw = async () => {
    const s = await loadSch();
    box.innerHTML = '';
    s.tags.forEach((t, i) => {
      const name = h('input', { class:'fd-input', value:t.name, style:'max-width:180px' });
      name.addEventListener('change', () => { t.name = name.value.trim() || t.name; saveSch(s); });
      const col = h('input', { type:'color', value:t.color, style:'width:34px;height:26px;border:0;background:transparent' });
      col.addEventListener('change', () => { t.color = col.value; saveSch(s); C.bus.emit('schedule'); });
      box.appendChild(h('div', { class:'fd-row' }, [col, name,
        h('button', { class:'fd-tool', title:'删掉这个标签', html:ic('close'), onclick:async () => {
          if(!await C.ask('删掉标签「' + t.name + '」？打上过这一个的日程会跟着少这道标记。', '删除')) return;
          s.tags.splice(i,1); saveSch(s); C.bus.emit('schedule'); draw();
        } })]));
    });
    box.appendChild(h('button', { class:'fd-btn mini', style:'justify-self:start', onclick:() => {
      s.tags.push({ id:'t' + Date.now().toString(36), name:'新标签', color:'#7aa7e8' }); saveSch(s); draw();
    }, html:ic('plus') + ' 加一个标签' }));
  };
  draw();
  return box;
}

export default {
  noName:true, minW:5, minH:6, def:{ w:7, h:8 },
  /* 外壳那一条「占够整张桌面四分之一就算展开」对这一家不成立（外33 第 3 条）：
     从前日程拉到 17.5 × 35 = 612 格就被当成展开，卡面里的月历直接换成全套视图、顶栏名字跟着糊一层，
     但他只是想把手里这一张拉大一点 —— 卡片大小归他拖，全览只走 ⛶ 那一个钮。 */
  noExpanded:true,
  init(ctx){ P = ctx; ctx.style(SCH_CSS); SCH.sel = todayStr(); SCH.view = ''; SCH.wc = weekAnchor(new Date(), P.settings.get('weekStart', 1)); },
  expand(ctx){ openScheduleFull(Object.assign({}, ctx, P)); },
  /* 这一家的设置：原来寄在「设置 · 组件」那一档的四行，现在收回自己的齿轮对话框 */
  settings(C){
    const c = Object.assign({}, C, P);
    const h = c.el;
    /* 改完广播一声，日程卡自己重画；时钟那一格由外壳的下一次滴答接走 */
    const set = (k, v) => { c.settings.set(k, v); c.bus.emit('schedule'); };
    c.dialog.open('设置 · ' + c.pack.name, h('div', { style:'display:grid;gap:12px;min-width:min(520px,88vw)' }, [
      h('div', { class:'fd-row' }, [h('span', { class:'fd-hint' }, '星期标识'),
        c.segCtrl(WEEKDAY_STYLES.map(s => ({ v:s.id, t:s.name })), () => c.settings.get('weekdayStyle', 'one'), v => set('weekdayStyle', v))]),
      h('div', { class:'fd-row' }, [h('span', { class:'fd-hint' }, '周起始'),
        c.segCtrl([{v:1,t:'周一'},{v:0,t:'周日'}], () => c.settings.get('weekStart', 1), v => set('weekStart', v))]),
      h('div', { class:'fd-row' }, [h('span', { class:'fd-hint' }, '显示第几周'),
        c.segCtrl([{v:true,t:'显示'},{v:false,t:'不显示'}], () => c.settings.get('showWeek', true), v => set('showWeek', v))]),
      h('div', { class:'fd-hint' }, '标签'),
      tagEditor(c)
    ]), [h('button', { class:'fd-btn primary', onclick:() => c.dialog.close() }, '保存')]);
  },
  async mount(body, ctx){
    const C = Object.assign({}, ctx, P);
    /* 从前这一处还有一条「C.expanded 就直接铺全套视图」的路，外33 第 3 条按他说的取消了：
       卡面多大都画月历（三档由 tierOf 跟着格子数走），全套视图只归 ⛶ 那一个钮（openScheduleFull）。 */
    const s = await loadSch();
    let box = null;
    const draw = () => {
      body.innerHTML = '';
      const rows = C.item ? C.item.h : MONTH_MIN_ROWS;
      /* 档跟着这一张卡自己占的那一格走：拉大拉小由外壳重排一次（bindDrag 那句 render），这里现算现画 */
      const tier = C.item ? tierOf(C.item.w, C.item.h) : 0;
      box = C.el('div', { class:'fd-fit ' + TIER_CLASS[tier], style:'display:flex;flex-direction:column;height:100%;gap:calc(2px * var(--fit,1));padding-bottom:calc(6px * var(--fit,1))' });
      if(rows < MONTH_MIN_ROWS){
        /* 矮卡塞不下整张月历（最多 6 行周再加表头），这一档铺本周七列迷你竖条 */
        box.appendChild(miniWeek(s, C));
      } else {
        box.appendChild(calHeader(s, C));
        box.appendChild(monthGrid(s, C, monthWeeks(SCH.cursor.getFullYear(), SCH.cursor.getMonth(), C.settings.get('weekStart', 1)), tier));
      }
      body.appendChild(box);
      /* 卡拉高就整张月历一起放大，格子等比变高、铺满卡面 */
      C.fitBox(box, { max:1.45 });
    };
    C.bus.on('schedule', draw);
    draw();
    return { unmount(){
      C.bus.map['schedule'] = (C.bus.map['schedule'] || []).filter(f => f !== draw);
      if(box && box._fitRO) box._fitRO.unobserve(box);
    } };
  }
};

/* 这一家的长相自己带（审查第 15 条）：这七条从前写在壳子 `src\_fd\src\fd3-shell.js` 里，
   等于「日程改一个字面的样子也得生成一次页面」—— 组件是运行时读活的，样式就该跟着组件走。
   同一家其余那些 `.sch-*` 还留在壳子里，那是一整摊搬家的事，不在这条里顺手搬。
   子日程完成度（外26 第 13 条）：一个子一条横向细条（有宽度，不是线条），条里填充到哪就是那一子完成了多少，
   走满换成一枚完成色 —— 用在主日程树和「这天压着哪些日程」两处。甘特条那一档（外29 第 42 轮按作者的话定死）：
   父级一整条浅色 + 开头一道深色竖线 + 文字后一枚完成度，下级挤在这一条自己那一整段里当细条；
   底下没人的那一条才用整条双色（.sch-fill）表示它自己的完成度。 */
const SCH_CSS = `
.sch-sub{display:flex;flex-direction:column;gap:3px;flex:1 1 6em;min-width:5em;max-width:14em;}
.sch-sub>i{display:block;height:7px;border-radius:3px;overflow:hidden;background:var(--candidate-bg,#eef0f4);}
.sch-sub>i>b{display:block;height:100%;border-radius:3px;background:var(--accent);}
.sch-sub>i.full>b{background:var(--ok,#2e8b57);}
/* 甘特条里那一截深色：只给底下没人的那一条画 —— 宽度就是这一条自己的完成度，压在字底下（DOM 里排在字前面）。
   整条深色 = 完成，整条浅色 = 一笔没动。底下有人的那一档不吃这一截，完成度写在文字后面那枚小标签上。 */
.sch-fill{position:absolute;left:0;top:0;bottom:0;background:var(--ok,#2e8b57);pointer-events:none;}
/* 父条那两样（外29 第 42 轮）：文字后面一枚完成度小标签，条底一排细条 = 它的直接下级。
   细条的底色是「往正文掺了一点」而不是某处写死的灰，浅色底深色底都看得见；
   里头那一截走 .sch-sub 同一套算式（accent 填、走满换完成色），底下有人的那根补一道深色小竖线。
   父条让出底下 5px 给这一排，字和细条不叠在一起。 */
.sch-pct{flex:0 0 auto;font-style:normal;font-size:.72em;opacity:.85;padding:0 3px;border-radius:3px;
  background:color-mix(in srgb,var(--text) 12%,transparent);}
.sch-bar.parent{padding-bottom:5px;}
.sch-inbar{position:absolute;left:3px;right:2px;bottom:1px;height:4px;}
.sch-inbar>i{position:absolute;height:4px;border-radius:2px;overflow:hidden;cursor:pointer;
  background:color-mix(in srgb,var(--text) 20%,transparent);}
.sch-inbar>i>b{display:block;height:100%;background:var(--accent);}
.sch-inbar>i.full{background:var(--ok,#2e8b57);}
.sch-inbar>i.has{border-left:2px solid var(--accent);}
/* ---------- 大卡那两档（外29 第 53 轮）----------
   --sch-big 是这一家唯一的一个放大系数：条上的字（.sch-bar 的 font-size）、色位圆点、日期号、
   星期抬头都乘它，数值只在这一处给，不在每一处各抄一份。矮卡那两档不吃它（类根本没挂上，取默认 1）。 */
.sch-t2{--sch-big:1.18;}
.sch-t3{--sch-big:1.34;}
/* 第三档：日期号后面那一枚当天条数 —— 跟日期号同一个字号档，不再另起一套数 */
.sch-cnt{margin-left:.35em;font-size:calc(.66em * var(--sch-big,1));font-variant-numeric:tabular-nums;
  color:var(--text-light);align-self:center;}
/* 第三档：标签由圆点换成带名字的短签。左边那一枚色位是 .sch-tag::before，
   颜色由 JS 现给（--c），底色往正文掺一点、不写死灰 —— 墨色外观模式下同样看得见。 */
.sch-tag{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  display:inline-flex;align-items:center;gap:.3em;padding:0 .4em;border-radius:calc(3px * var(--fit,1));
  font-size:calc(.86em * var(--sch-big,1));background:color-mix(in srgb,var(--text) 12%,transparent);}
.sch-tag::before{content:'';flex:0 0 auto;width:calc(6px * var(--sch-big,1));height:calc(6px * var(--sch-big,1));
  border-radius:50%;background:var(--c,var(--accent));}
`;
