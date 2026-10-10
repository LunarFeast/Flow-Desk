/* ============================================================
   接线与可达自查（外29 第 40 轮）：只报，不动任何东西。

     node src/tools/selfcheck.mjs                 六节全跑
     node src/tools/selfcheck.mjs 3               只跑第三节
     node src/tools/selfcheck.mjs 5 --probes "别处的探针目录"

   探针原件住在 src\tools\probes\（第五、六节默认去那一格跑它们）；
   那一格里 mk-*.mjs 生成的 *.html 是产物，.gitignore 关掉了，别把它们当源码改。

   为什么要这一台：2026-10-07 晚上源码第一次生成进产物，作者当场报了四条毛病，四条是同一个盲区长出来的 ——
   我那些自检一律在测「代码里写了什么」，没有一条测「真页面上有没有人走到那条路」：
     · 顶栏糊：样式在、函数在、调用点在，判的却是「卡片占够 576 格」，出厂最大一张才 56 格 —— 这条路一辈子走不到；
       探针里是我自己 classList.add('dim') 把条件造出来，再去量计算值，所以年年 PASS；
     · 历史版本：开窗之前先 await 一笔读档，那一步吃的桥名字（FD_APP.pageFileExists）是同批才加进 preload 的，
       壳落后一步就是 undefined → 弹窗永远不开，调用点不 catch，一句提示都没有；
     · 月视图：子日程被摊平成各自一条粗条，`.sch-sub` 那排细条只在树视图和日详情里画 —— 探针只喂了 renderTree；
     · 书内查找·替换：标题写着两件事，底下只有三个替换按钮，查找那一半从初始提交起就没做过。
   audit.mjs 管的是"同一份东西多处不一致"，这四条一条都不在它射程里，所以补了这一台。

   这台能查的是静态那一半（接线、阈值、名字、死路、探针生死、弹窗点过没有）；查不了"真点一下会不会开"——
   那一半写进 AGENTS.md 的「真页面冒烟」那一条，不许拿这台当替身。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/* 不扫的：产物、安装包、存档、浏览器缓存，以及第三方和建页模板（它们里的 class 不是我们界面的状态） */
const SKIP = new Set(['node_modules', '.git', 'dist', 'update', '备份', 'locales', 'resources', 'pages',
  'userdata-fd', 'userdata-rp', 'userdata-wnw', 'logs', 'gen-logs', '_vendor', '_build']);
const ONLY = process.argv.find((x, i) => i >= 2 && /^[1-6]$/.test(x));
const PA = process.argv.indexOf('--probes');
/* 探针从 2026-10-07 起住在仓里（src\tools\probes\）：搬进来之前它们躺在会话临时目录，
   那一格换个会话就换个名字，结果 mk-fd4-test 哑了半天没人发现。不给 --probes 就默认这一格。 */
const PROBES = PA >= 0 ? process.argv[PA + 1] : path.join(ROOT, 'src', 'tools', 'probes');

const out = [];
let hits = 0;
const say = s => out.push(s);
function head(t){ say(''); say('── ' + t + ' ' + '─'.repeat(Math.max(0, 54 - t.length))); }
function bad(line){ hits++; say('  ! ' + line); }
function warn(line){ say('  ? ' + line); }
function ok(line){ say('  · ' + line); }
function walk(dir, base){
  const res = [];
  for(const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes:true })){
    const rel = dir + '/' + e.name, shown = (base ? base + '/' : '') + e.name;
    if(e.isDirectory()){ if(SKIP.has(e.name)) continue; res.push(...walk(rel, shown)); continue; }
    if(e.isFile() && /\.(js|mjs|cjs|html)$/.test(e.name)) res.push({ rel, shown });
  }
  return res;
}
const FILES = walk('src', '').concat(walk('data/plugins', 'data/plugins'))
  .filter(f => !/(^|[/\\])tools[/\\]/.test(f.rel))
  /* 为写内核那颗产物是 src\_wnw\src\ 那二十份拼出来的一份复制（同步 GitHub 第 4 条之后由
     node src\_wnw\build-kernel.mjs 出，.gitignore 已经关了它）—— 扫它等于把同一批源码数两遍，
     每一节都会报双份。源码那二十份照旧逐个扫。 */
  .filter(f => ['src/_wnw/wnw-kernel.js', 'src/_wcustom/wnw-custom-kernel.js']
    .indexOf(f.rel.replace(/\\/g, '/')) < 0);
const SRC = FILES.map(f => ({ ...f, text: fs.readFileSync(path.join(ROOT, f.rel), 'utf8') }));
const rel = f => f.rel.replace(/\\/g, '/');
const at = (f, line) => rel(f) + ':' + line;
function all(re){
  const got = [];
  for(const f of SRC){ const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m; while((m = r.exec(f.text))) got.push({ f, m, line: f.text.slice(0, m.index).split('\n').length }); }
  return got;
}
const has = nm => new RegExp('[\\s{(=.]' + nm + '\\s*[:(=]').test;   /* 名字被真用/真定义出来的几种写法 */

/* 运行时的界面源码那几棵（样式表只可能住在这些里面；建页模板和第三方不算） */
/* 注释挖空（长度不变，行号还对得上）：从前拿注释里的旧写法当证据，报过一条假案 ——
   fd3-shell.js:1975 那句「这里以前自己写过 html[data-fx=…]」正是要撤的写法，不是还在用的。 */
function mask(t){
  return t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
          .replace(/[ \t]*\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '));
}
for(const f of SRC) f.text = mask(f.text);
const UI = SRC.filter(f => /^src\/(_fd|_wnw|_shared|_wcustom)\//.test(rel(f)) || /^data\/plugins\//.test(rel(f)));

/* ============ 一、界面状态：挂的人 ↔ 读的人，两头都要有 ============ */
if(!ONLY || ONLY === '1'){
  head('一、界面状态接了线没有（挂 class / 钉 data-* 的人，和样式表里读它的人）');
  const cssText = UI.map(f => f.text).join('\n');
  const writes = new Map(), reads = new Map();
  const put = (m, k, where) => { if(!m.has(k)) m.set(k, []); m.get(k).push(where); };
  /* 谁挂上去的：JS 那三种写法把整段表达式吃下来（含 `+ (x ? ' expanded' : '')` 这种拼法），
     HTML 标签里 `class="…"` 只取引号内那一段 —— 从前两种都没管，报了 6 条假案。 */
  const grabCls = (re, one) => {
    for(const f of UI){
      const r = new RegExp(re.source, 'g');
      let m0;
      while((m0 = r.exec(f.text))){
        const line = f.text.slice(0, m0.index).split('\n').length;
        const toks = [];
        if(one) toks.push(m0[1]);
        else {
          /* 从这一处往后吃一段表达式，只取引号里面那段（引号外的变量名、三元判断一律不算 class） */
          let i = m0.index + m0[0].length, depth = 0, q = '', cur = '';
          for(; i < f.text.length && i - m0.index < 400; i++){
            const ch = f.text[i];
            if(q){ if(ch === q){ toks.push(cur); cur = ''; q = ''; } else cur += ch; continue; }
            if(ch === "'" || ch === '"'){ q = ch; continue; }
            if(ch === '(' || ch === '[' || ch === '{') depth++;
            else if(ch === ')' || ch === ']' || ch === '}'){ if(!depth) break; depth--; }
            else if(!depth && (ch === ',' || ch === ';')) break;
          }
        }
        for(const t of toks) for(const c of t.split(/[\s,]+/)) if(/^[a-z][\w-]*$/.test(c)) put(writes, 'c:' + c, at(f, line));
      }
    }
  };
  grabCls(/classList\.(?:add|toggle|remove)\(|\bclassName\s*(?:=|\+=)|\bsetAttribute\(\s*'class'\s*,|class\s*:\s*(?=['"])/, false);
  grabCls(/class\s*=\s*"([^"]*)"/, true);
  for(const g of all(/dataset\.([A-Za-z][\w]*)\s*=/g)) put(writes, 'a:data-' + g.m[1].replace(/[A-Z]/g, x => '-' + x.toLowerCase()), at(g.f, g.line));
  for(const g of all(/setAttribute\(\s*'(data-[\w-]+)'/g)) put(writes, 'a:' + g.m[1], at(g.f, g.line));
  for(const g of all(/'(data-[a-z][\w-]*)'\s*:/g)) put(writes, 'a:' + g.m[1], at(g.f, g.line));
  for(const g of all(/\b(data-[a-z][\w-]*)\s*=\s*"/g)) put(writes, 'a:' + g.m[1], at(g.f, g.line));
  /* 样式表读哪些状态：只算「这一段往后到下一个 { 或 , 之间，只出现选择器用得着的字符」的位置 ——
     `this.tap.live`、`[...this.live]`、`closest('[data-card]')` 这类 JS 取成员 / DOM 查询，
     从前被当成选择器读，一口气报了 7 条假案。 */
  const selLike = text => /^[\s.,#:>\w-]*[,{]/.test(text);
  const clsRe = /\.([a-z][\w-]*)\.(on|off|dim|active|open|closed|full|going|expanded|collapsed|done|pending|hot|cold|live|dead|new|old)\b/g;
  const hovRe = /\.([a-z][\w-]*):(?:hover|focus|checked|disabled)\s*[,{]/g;
  const attrRe = /\[(data-[a-z][\w-]*)\s*[=~\]]/g;
  for(const g of all(clsRe)) if(selLike(g.f.text.slice(g.m.index + g.m[0].length, g.m.index + g.m[0].length + 240))) put(reads, 'c:' + g.m[2], at(g.f, g.line));
  for(const g of all(hovRe)) put(reads, 'c:' + g.m[1], at(g.f, g.line));
  for(const g of all(attrRe)) if(selLike(g.f.text.slice(g.m.index + g.m[0].length, g.m.index + g.m[0].length + 240))) put(reads, 'a:' + g.m[1], at(g.f, g.line));
  let n = 0;
  for(const [k, where] of [...reads].sort()){
    if(!writes.has(k)){ bad('样式表读「' + k + '」这一档状态，页面里没有任何地方挂它 —— 这条规则永远不生效（读在 ' + where.slice(0, 2).join(' ') + '）'); n++; }
  }
  let m = 0;
  for(const [k, where] of [...writes].sort()){
    if(reads.has(k)) continue;
    const probe = k.startsWith('a:') ? k.slice(2) : '.' + k.slice(2);
    if(cssText.includes(probe)) continue;                     /* 样式表里以别的形式读过（组合选择器之类） */
    if(/^(c:)?(fd|wnw|sh|sch)-/.test(k) || k.length < 4) continue;
    m++;
  }
  ok('页面挂出去的状态 ' + writes.size + ' 档、样式表读的状态 ' + reads.size + ' 档：样式读着没人挂 ' + n + ' 处，挂出去样式不读 ' + m + ' 处（后者多是 JS 自己读或纯标记，只数不报）');
}

/* ============ 二、出厂数据代进去，这条界面状态够不够得着 ============ */
if(!ONLY || ONLY === '2'){
  head('二、拿出厂数据代一遍：那些"够大 / 够多才生效"的条件，出厂够不够得着');
  const shell = SRC.find(f => /fd3-shell\.js$/.test(f.rel));
  /* 这三个名字现在挤在同一行上（`const GRID_COLS = 64, GRID_ROWS = 36, GRID_PAD = 0.5;`），
     所以只认「名字 = 数」，不认前面有没有 const —— 带 const 的那版把第三个名字漏掉，整节被跳过。 */
  const grab = nm => shell && new RegExp(nm + '\\s*=\\s*([\\d.]+)').exec(shell.text);
  const lineOf = nm => shell ? shell.text.split('\n').findIndex(l => new RegExp(nm + '\\s*=').test(l)) + 1 : 0;
  const area = grab('EXPAND_AREA'), cols = grab('GRID_COLS'), rows = grab('GRID_ROWS');
  if(!area || !cols || !rows) warn('没在 ' + rel(shell || { rel:'?' }) + ' 里找全 EXPAND_AREA / GRID_COLS / GRID_ROWS 这三个名字，这一节跳过（它们改名了，这台也要跟着改）');
  else {
    const need = Math.floor(+cols[1] * +rows[1] * +area[1]);
    const csPath = path.join(ROOT, 'data', 'card-size.yaml');
    let max = 0, who = '', count = 0;
    /* 那一份的真实形状：每张卡两行 `出厂: 7 × 8` / `你要:`（空的就按出厂）—— 用「你要」那一行，
       因为作者手填过的大小才是出厂桌面上真摆出来的那个数。 */
    const num = s => { const m = /(\d+)\s*[×x*,]\s*(\d+)/.exec(s || ''); return m ? +m[1] * +m[2] : 0; };
    if(fs.existsSync(csPath)){
      let cur = null;
      const flush = () => { if(cur){ const a = num(cur.yao) || num(cur.chu); if(a){ count++; if(a > max){ max = a; who = cur.name + '（' + a + ' 格）'; } } } cur = null; };
      for(const line of fs.readFileSync(csPath, 'utf8').split(/\r?\n/)){
        if(/^\s*#/.test(line) || !line.trim()) continue;
        const m0 = /^\s{2}(\S.*?)\s*:\s*$/.exec(line);
        if(m0){ flush(); cur = { name: m0[1].trim(), chu:'', yao:'' }; continue; }
        if(!cur) continue;
        const g = /^\s{4}(出厂|你要)\s*:\s*(.*)$/.exec(line);
        if(g){ if(g[1] === '你要') cur.yao = g[2]; else cur.chu = g[2]; }
      }
      flush();
    }
    else warn('没有 ' + path.join('data', 'card-size.yaml') + ' 这一份，这一节白跑');
    /* 这道闸现在卡着哪几个函数：从每个 `  函数名(){` 起做一遍花括号配平，把范围圈出来 */
    const gated = [];
    const re = /^  ([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm;
    let mm;
    while((mm = re.exec(shell.text))){
      let d = 0, i = mm.index + mm[0].length - 1;
      for(; i < shell.text.length; i++){
        if(shell.text[i] === '{') d++;
        else if(shell.text[i] === '}'){ d--; if(!d) break; }
      }
      const body = shell.text.slice(mm.index, i);
      if(!/>=\s*(?:full\b|GRID_COLS\s*\*\s*GRID_ROWS\s*\*\s*EXPAND_AREA)/.test(body)) continue;
      const line = shell.text.slice(0, mm.index).split('\n').length;
      gated.push({ name:mm[1], at:rel(shell) + ':' + line });
    }
    /* 每一处都得在这儿交代一句「除了这个出厂够不到的数，界面上还有哪条路走得到它」；
       没交代的 = 只挂着这一道闸，功能等于没做。加一处新的阈值闸，这台就逼着写一句。 */
    const 交代过 = {
      dimTop:'封面那层（#fdCover 没 hidden）开着也算 —— ⛶ 那个按钮出厂就点得到（外29 第 43 轮改的）',
      cardFor:'只决定卡片自己那枚 .expanded 类和 放大 按钮显隐，不是任何功能的唯一入口（用户手拉、手填大小才走得到）',
      bindDrag:'同上：拖大拖小过这一档时换 expanded 这一枚类，拖本来就是给用户手拉的口子，不是哪条功能的唯一入口',
    };
    if(!count) warn('card-size.yaml 里一张卡的大小都没数到（那份的形状改了，这台要跟着改）');
    else if(!gated.length) warn('这一版里再没有「占够 ' + need + ' 格」那种闸了 —— 这一节的名单可以整块撤（先确认不是改名绕过去了）');
    else for(const g of gated){
      if(交代过[g.name]){ ok(g.at + '（' + g.name + '）要占够 ' + need + ' 格，出厂最大 ' + max + ' 格（' + who + '）—— 交代过别的口子：' + 交代过[g.name]); continue; }
      bad(g.at + '（' + g.name + '）的生效条件是「占够 ' + need + ' 格」，而按 card-size.yaml 最大的一张只有 ' + max + ' 格 —— ' +
        '出厂走不到，这台又不知道界面上还有没有别的路（没在 selfcheck 第二节那张交代表里）。功能等于没做，' +
        '而任何"自己把 class 挂上再量计算值"的探针都会 PASS');
    }
  }
}

/* ============ 三、桥的名字：页面点的、preload 给的、组件白名单列的 ============ */
if(!ONLY || ONLY === '3'){
  head('三、FD_APP 那张桥：页面点的名 preload 给不给、组件白名单对不对得上、minShell 有没有人执行');
  const pre = SRC.find(f => /preload\.cjs$/.test(f.rel));
  const preText = pre ? pre.text : '';
  const names = new Set();
  for(const g of all(/FD_APP\.([A-Za-z][\w]*)/g)) names.add(g.m[1]);
  const where = nm => all(new RegExp('FD_APP\\.' + nm + '\\b', 'g')).map(g => at(g.f, g.line)).slice(0, 2).join(' ');
  let miss = 0;
  for(const nm of [...names].sort()){
    /* preload 里给名字的三种写法：obj 里 `x(` / `x:`，以及往后挂上去的 `window.FD_APP.x =` */
    if(!new RegExp('[\\s{(=.]' + nm + '\\s*[:(=]').test(preText)){
      bad('页面点了 FD_APP.' + nm + '（' + where(nm) + '），' + rel(pre || { rel:'preload 没扫到' }) + ' 里没有这个名字 —— 壳落后一步这里就是 undefined');
      miss++;
    }
  }
  if(!miss) ok('页面点到的 ' + names.size + ' 个桥名字，preload 全给得出');
  const load = SRC.find(f => /sh-load\.js$/.test(f.rel));
  const deny = load && /const APP_DENY\s*=\s*\[([\s\S]*?)\]/.exec(load.text);
  if(!deny) warn('没在 ' + rel(load || { rel:'sh-load.js' }) + ' 里找到 APP_DENY 那张表（它是数组还是 Set 改了形状，这台要跟着改）');
  else {
    const list = [...deny[1].matchAll(/'([\w]+)'/g)].map(x => x[1]);
    for(const nm of list) if(!new RegExp('[\\s{(=.]' + nm + '\\s*[:(=]').test(preText))
      bad('APP_DENY 里点了「' + nm + '」，preload 压根没这个名字 —— 白名单里写个不存在的名字，等于那道地板没写');
    for(const nm of names) if(!list.includes(nm) && /(PageFile|PageBytes|dirTree|dataWrite|dataRead|compWrite|compDelete)/.test(nm))
      bad('页面用的「' + nm + '」没进 APP_DENY —— 组件说明书点名就能拿它往页面树追加字节');
    ok('APP_DENY 列了 ' + list.length + ' 个名字，页面一共点到 ' + names.size + ' 个');
  }
  /* manifest 的 minShell：打包那一头算最低外壳，运行时那一头有没有人挡一道？ */
  const mans = fs.readdirSync(path.join(ROOT, 'data', 'plugins')).map(d => path.join(ROOT, 'data', 'plugins', d, 'manifest.json')).filter(p => fs.existsSync(p));
  const runtime = all(/minShell/).filter(g => !/[/\\]pack[/\\]/.test(g.f.rel) && !/manifest\.json$/.test(g.f.rel));
  if(mans.length && !runtime.length) bad(mans.length + ' 份 manifest.json 写了 minShell，打包那一头（src\\pack\\publish.mjs）算了最低外壳，可**运行时这一头一处都不读** —— 「装着的壳比源码旧」这件事，程序里没有任何一道闸会报，只会表现成某个按钮点了没反应');
  else ok('minShell：' + mans.length + ' 份写着，运行时 ' + runtime.length + ' 处读');
}

/* ============ 四、定义了但全仓没人走（拿函数名冒充功能） ============ */
if(!ONLY || ONLY === '4'){
  head('四、函数和方法：全仓只有一处提到的，是没人走的路（候选 —— 靠变量名点的那种调不出来，得人确认）');
  const WHITE = new Set(['init','boot','render','mount','unmount','update','draw','apply','save','load','parse','emit','on','off',
    'fields','entry','text','adopt','check','pick','get','set','run','start','stop','close','open','remove','add','list','data',
    'ready','name','use','fetch','plan','write','reload','renamed','mergeMissing','persist','snapshot','count','groups','items','cur','tokens','select','record','main']);
  const seen = new Map();
  for(const g of all(/^\s*(?:async\s+)?function\s+([A-Za-z][\w$]*)\s*\(/gm)) if(!WHITE.has(g.m[1]) && !seen.has(g.m[1])) seen.set(g.m[1], at(g.f, g.line));
  for(const g of all(/^  (?:async\s+)?([A-Za-z][\w$]*)\s*\((?:[\w$,:{}\s'"]*)\)\s*\{/gm)){
    const nm = g.m[1];
    if(WHITE.has(nm) || /^(if|for|while|switch|catch|return|else|get|set|constructor)$/.test(nm)) continue;
    if(!seen.has(nm)) seen.set(nm, at(g.f, g.line));
  }
  let dead = 0, dyn = 0;
  for(const [nm, def] of [...seen].sort()){
    const re = new RegExp('\\b' + nm.replace(/\$/g, '\\$') + '\\b', 'g');
    const hits2 = all(re).filter(u => def !== at(u.f, u.line));
    if(hits2.length) continue;
    /* 这棵树里大量用 `this[id]()`、Views.get('panel-' + x)、ctx.xxx 这类点名 —— 名字出现在任何字符串里就降级成「疑似」 */
    const inString = all(new RegExp("['\"`]" + nm + "['\"`]", 'g')).length;
    if(inString){ warn(nm + ' 只有一处定义、没有直接调用，但被字符串点名过（' + inString + ' 处）—— 可能是 this[...] 那种动态调用，人工确认'); dyn++; continue; }
    bad(nm + ' 定义在 ' + def + '，全仓再没有第二处提到它'); dead++;
  }
  ok('扫出 ' + seen.size + ' 个名字：零调用 ' + dead + ' 个，另有 ' + dyn + ' 个疑似（动态点名，得人看）');
}

/* ============ 五、自检脚本自己的生死 ============ */
if(!ONLY || ONLY === '5'){
  head('五、每台自检脚本：跑了几条断言、有没有哑（0 条断言的绿不算绿）');
 try{
  if(!PROBES || !fs.existsSync(path.resolve(PROBES)))
    { warn('探针那一格（' + path.join('src', 'tools', 'probes') + '）不在，这一节跳过'); }
  else {
    const dir = path.resolve(PROBES);
    const list = fs.readdirSync(dir).filter(x => /^(test|gate|klog)-[\w-]+\.mjs$/.test(x)).sort();
    let dead = 0, mute = 0, noData = 0, liar = 0, retired = 0;
    for(const x of list){
      let so = '', code = 0;
      try{ so = execFileSync(process.execPath, [path.join(dir, x)], { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch(e){ code = e.status === undefined ? -1 : e.status; so = String(e.stdout || '') + String(e.stderr || ''); }
      const m = /(\d+)\s*过\s*(\d+)\s*不过/.exec(so);
      const n = m ? +m[1] + +m[2]
        : (so.match(/PASS|FAIL|✓|✗/g) || []).length;
      if(code === 77){
        warn(x + ' 自己报了作废：' + (String(so).split(/\r?\n/).find(l => /作废/.test(l)) || '没写原因').slice(0, 160));
        retired++; continue;
      }
      if(code !== 0){
        const enoent = /ENOENT[^\n]*?open '([^']+)'/.exec(so);
        if(enoent){ warn(x + ' 这一轮跑不了：它要读「' + path.basename(enoent[1]) + '」那份数据不在（' + enoent[1] + '）—— 量测台缺数据不算哑，但它给不出任何证据'); noData++; continue; }
        bad(x + ' 抛了（退出码 ' + code + '）：' + (String(so).split(/\r?\n/).find(l => /Error|error|不合规|不找|没圈住|没找到|没抓到|找不着|找不到/.test(l)) || '没抓到那一句').slice(0, 130));
        dead++; continue;
      }
      /* 说的和报的对不对得上：嘴里念着「N 不过 / RESULT: FAIL」却退出 0 的台，拿它的绿当证据就是假的 ——
         2026-10-07 那次「戊组图13」那台就是这么把三条没改口的断言混过去的。 */
      const 说过 = (m && +m[2] > 0) || /RESULT: *FAIL/.test(so) || /(^|\n)\s*(FAIL|✗)/.test(so);
      if(说过){ bad(x + ' 退出码 0，可它自己嘴里念着「不过」—— 这台说的和报的对不上，它的绿不算绿（先修它的退出码，再修它报的那几条）'); liar++; }
      else if(!n){
        /* 脚本自己有没有断言用的词：量测台（只报数字）不该被当成哑 */
        const mine = fs.readFileSync(path.join(dir, x), 'utf8');
        if(!/PASS|FAIL|✓|✗|assert|\d+\s*过/.test(mine)){ ok(x + ' 是量测台：只报数字、不断言，不按哑判'); continue; }
        bad(x + ' 退出码 0 却一条断言都没报 —— 这台是哑的，或它的断言在浏览器那一侧（那种不能拿退出码当证据）'); mute++; continue;
      }
      else ok(x + ' 跑通 · ' + (m ? m[1] + ' 过 ' + m[2] + ' 不过' : n + ' 条（按 PASS/FAIL/✓ 数）'));
    }
    ok('一共 ' + list.length + ' 台：抛了 ' + dead + '、说的和报的对不上 ' + liar + '、哑 ' + mute + '、缺数据跑不了 ' + noData + '、自己报作废 ' + retired);
  }
 }catch(e){ bad('这一节自己崩了：' + ((e && e.message) || e) + ' —— 这台是被验的那几份源码带着改口的，跟着修它（崩了不等于全过）'); }
}

/* ============ 六、界面入口清点：每一个弹窗，有没有任何自检真点过 ============ */
if(!ONLY || ONLY === '6'){
  head('六、界面入口：每一个弹窗和面板，自检里有没有人真点过一次');
  /* 入口的长相：`function xxDlg(`、`const xxDlg = `、以及 `Dlg` 结尾挂在对象上的方法 */
  const doors = new Map();
  const RE_DOOR = [
    /^\s*(?:async\s+)?function\s+([a-z]\w*Dlg)\s*\(/gm,          /* 独立函数 */
    /^\s*(?:async\s+)?([a-z]\w*Dlg)\s*\([^)]*\)\s*\{/gm,          /* 对象上的方法 */
    /\bconst\s+([a-z]\w*Dlg)\s*=\s*(?:async\s*)?(?:\(|function)/g  /* 挂在变量上的 */
  ];
  for(const re of RE_DOOR) for(const g of all(re)) if(!doors.has(g.m[1])) doors.set(g.m[1], at(g.f, g.line));
  /* 探针那头：给了 --probes 就真去读那些脚本（含它们生成的 html），名字出现在里面才算点过 */
  let probeText = '';
  if(PROBES && fs.existsSync(path.resolve(PROBES))){
    const dir = path.resolve(PROBES);
    for(const x of fs.readdirSync(dir)){
      if(!/^(test|gate|klog|mk)-[\w.-]+\.(mjs|js|html)$/.test(x)) continue;
      try{ probeText += fs.readFileSync(path.join(dir, x), 'utf8') + '\n'; }catch(e){}
    }
  }
  const untested = [];
  for(const [nm, def] of [...doors].sort()){
    const called = new RegExp('\\b' + nm + '\\s*\\(').test(probeText) || new RegExp("['\"`]" + nm + "['\"`]").test(probeText);
    if(!called) untested.push(nm + '（' + def + '）');
  }
  if(!probeText) warn('界面上一共 ' + doors.size + ' 个弹窗入口；探针那一格（' + path.join('src', 'tools', 'probes') + '）读不到，这一节给不出「哪几个从没被点过」');
  else if(untested.length){
    bad(untested.length + ' / ' + doors.size + ' 个弹窗在任何自检脚本里都没出现过 —— 这些入口出厂什么样没人知道，只能靠你在真页面上点：' +
      untested.slice(0, 24).join('、') + (untested.length > 24 ? '……共 ' + untested.length + ' 个' : ''));
  } else ok('' + doors.size + ' 个弹窗入口，探针里全部点过');
}

console.log(out.join('\n'));
console.log('\n共 ' + hits + ' 件要人看一眼。这台工具什么都不改。');
process.exit(0);
