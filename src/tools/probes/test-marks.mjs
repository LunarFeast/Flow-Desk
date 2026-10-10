/* 外29 第 58 轮自检 · 标记色进方案（作者这一轮点名的三条）：
   一、「标记色改了，换方案标记色跟着换，只不过如果新的方案没有单独选择标记色，会沿用之前的标记色」
   二、「检测当前所有文件启用的标记色共有多少个，换新的方案时如果标记色不足/选择的少于个数，提醒用户
       “当前方案标记色数量少于使用中标记色数量，继续启用可能导致部分标记同色”，允许用户选择
       继续启用（接受同色）、添加颜色（补足数量）、替换当前标记色（用上一套数量充足的标记色替换掉目标方案的标记色）、
       取消切换（整体换回上一个方案）」
   三、「标记色可以取色器+色号自由设色，只不过标记色的色号不会自动进入色卡」
   规矩照这一仓的来：真源码一颗一颗切进 node:vm 跑，只在边界使替身（数据库 / 弹窗 / 写盘 / 取色控件），
   每一条都把数到的东西打印出来（不许哑），最后咬两口 —— 把承重那一句改坏，判法必须不过。 */
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = 'D:/Programs/Flow-Desk/';
const rd = p => fs.readFileSync(ROOT + p, 'utf8');
const 源 = {
  packs:rd('src/_shared/sh-packs.js'), look:rd('src/_shared/sh-look.js'),
  font:rd('src/_shared/sh-font.js'),
  shell:rd('src/_fd/src/fd3-shell.js'), lib:rd('src/_fd/src/fd3-lib.js'), ui:rd('src/_fd/src/fd4-builtin.js'),
};
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 切一颗顶层声明（跳过字符串、注释和正则字面量；函数看到配对的大括号，常量看到浅层的分号） ---------- */
function 扫过(s, i){
  const c = s[i], d = s[i + 1];
  if(c === '/' && d === '/'){ const n = s.indexOf('\n', i); return n < 0 ? s.length : n; }
  if(c === '/' && d === '*'){ const n = s.indexOf('*/', i + 2); return n < 0 ? s.length : n + 2; }
  if(c === '"' || c === "'" || c === '`'){
    let k = i + 1;
    while(k < s.length){ if(s[k] === '\\'){ k += 2; continue; } if(s[k] === c) return k + 1; k++; }
    return s.length;
  }
  if(c === '/'){        /* 正则字面量：里头那些引号、括号不算数（/^".*"$/.test(t) 就是这么写的） */
    let k = i + 1, 方 = false;
    while(k < s.length){
      const x = s[k];
      if(x === '\\'){ k += 2; continue; }
      if(x === '\n') break;
      if(方){ if(x === ']') 方 = false; k++; continue; }
      if(x === '['){ 方 = true; k++; continue; }
      if(x === '/') return k + 1;
      k++;
    }
    return i + 1;
  }
  return i;
}
const 正则位 = c => c === undefined || '(,=:[!&|?{};+\n'.includes(c);
function 切(src, 名){
  const 起 = new RegExp('^(?:const|let|var|function|async[ \\t]+function)[ \\t]+' + 名 + '(?![\\w$])', 'm').exec(src);
  if(!起) throw new Error('切不到这一颗：' + 名);
  const 函数 = /function/.test(起[0]);
  let i = 起.index + 起[0].length, d = 0, 开过 = false, 前 = ' ';
  while(i < src.length){
    const c = src[i];
    if(c === '/' || c === '"' || c === "'" || c === '`'){
      const n = (c === '/' && !正则位(前)) ? i + 1 : 扫过(src, i);
      if(n === i){ 前 = c; i++; } else { i = n; 前 = '/'; }
      continue;
    }
    if(c === '{' || c === '[' || c === '('){ d++; 开过 = true; }
    else if(c === '}' || c === ']' || c === ')'){ d--; if(函数 && c === '}' && d === 0 && 开过) return src.slice(起.index, i + 1); }
    else if(!函数 && c === ';' && d === 0) return src.slice(起.index, i + 1);
    if(!/\s/.test(c)) 前 = c;
    i++;
  }
  if(!函数 && d === 0) return src.slice(起.index);
  throw new Error(名 + ' 没收尾');
}
const 抓 = (份, 名单) => 名单.map(n => 切(源[份], n)).join('\n');

/* ---------- 边界替身（这一张页里真身吃的是存档 / 数据库 / 弹窗，切进虚拟机只能给它这些） ---------- */
const 替 = `
var window = { FD_MARKS:null };
var 根元素 = { style:{ setProperty(k, v){ this[k] = v; }, removeProperty(k){ delete this[k]; } } };
var document = { documentElement:根元素 };
var console = { warn(m){ (this.警 = this.警 || []).push(m); }, log(){} };
var toast = (m, bad) => { (this.报话 = this.报话 || []).push([m, !!bad]); };
var Bus = { emit(n){ (this.播 = this.播 || []).push(n); } };
var Shell = { render(){ (this.重画 = (this.重画 || 0) + 1); }, refreshSoon(){}, fitGrid(){} };
var Theme = { cfg:{ mode:'material', tex:'', texGray:false, wallImg:'', font:'', fontLangs:{}, radiusCard:5, radiusCtl:5, gap:0 },
  save(){}, apply(){ this.上色 = (this.上色 || 0) + 1; }, tokens(){ return {}; } };
var Palette = { items:[], cur:null, data:{ cur:'' }, select(){}, hexesOf(){ return []; } };
var Settings = { get(k, d){ return d; }, set(){} };
var LibStore = { 问过:[], 存过:[], files:{},
  async fetchRaw(n){ this.问过.push(n); return Object.prototype.hasOwnProperty.call(this.files, n) ? this.files[n] : null; },
  async putRaw(n, t){ this.files[n] = t; this.存过.push(n); return { ok:true }; } };
var LookStore = { data:{ cur:'x', lookCur:'', marks:null }, 存盘:0, save(){ this.存盘++; } };
var Ico = { table:{}, url(n){ return this.table[n] || ''; } };
var ImgLib = { list:[], find(n){ return this.list.find(x => x.名字 === n) || null; } };
var IDB = { 表:{}, 炸:false,
  async keys(db, store, pre){ if(this.炸) throw new Error('这台机器不让用数据库'); const t = this.表[db] || {}; return Object.keys(t).filter(k => !pre || String(k).startsWith(pre)); },
  async get(db, store, k){ if(this.炸) throw new Error('这台机器不让用数据库'); return (this.表[db] || {})[k]; } };
var CardPool = { items:[], ready:true, 叫过:0, count(){ return this.items.length; },
  hexOf(c){ return (c.colors && c.colors[0] && c.colors[0].raw) || ''; },
  hex(s){ const v = String(s || '').trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : ''; },
  addAll(){ this.叫过++; return 0; } };
var CV = { hslOf(x){ const v = String(x || ''); return [parseInt(v.slice(1, 3), 16) || 0, 50, 50]; } };
var FF_LANGS = [{ k:'zh', name:'中文简体' }];
var tokensOf = () => ({ tokens:{} });
var PRESETS = {};
/* 页面那一头 h() 返回的是真元素；这里给一个够用的替身：能装孩子、能 innerHTML='' 清空、能读写 value。
   添够再切 每一笔都靠 draw() 重刷同一个 box（不是再开一个窗口），所以清空 + 装孩子必须真生效 */
var h = (tag, at, kids) => {
  const el = { tag, at:at || {}, kids:[], value:(at && at.value) || '',
    appendChild(x){ this.kids.push(x); return x; } };
  Object.defineProperty(el, 'innerHTML', { get(){ return ''; }, set(v){ if(v === '') el.kids = []; } });
  for(const x of kids === undefined ? [] : (Array.isArray(kids) ? kids : [kids])) el.kids.push(x);
  return el;
};
var Modal = { 开:[], 关(){ this.开 = []; }, close(){ this.开 = []; }, open(t, b, bts){ this.开.push({ 题:t, 身:b, 钮:bts || [] }); }, 最近(){ return this.开[this.开.length - 1]; } };
var icoMarkup = n => 'ico:' + n;
var colorChip = (hex, onPick) => ({ tag:'chip', hex, onPick });
var markPoolDlg = (cur, onPick) => { (this.挑过 = this.挑过 || []).push([cur, onPick]); };
`;
const 名单 = {
  packs:['MARK_MIN', 'ACCENT_N', 'markHexes', 'markCount', 'markBase', 'markVar', 'markIndexOf', 'markSlots'],
  look:['CUSTOM_TEX', 'lookTexSet', 'lookTex', 'lookTexName', 'LOOK_MODES', 'LOOK_DEFAULT', 'lookMode'],
  font:['FF_WEIGHT_CN', 'ffWeightName'],
  shell:['MARK_SEED_BACK', 'marksNorm', 'Marks', 'clampRadius'],
  lib:['LOOKS_FILE', 'LOOK_HEAD', 'LOOK_GAP_AUTO', 'LOOK_GAP', 'lookGap', 'LOOK_TEX_WAYS', 'lookTexWay', 'LOOK_MD', 'LOOK_SEED',
    'ffLangMap', 'ffLangText', 'marksText', 'marksOf', 'lookModeByName', 'lookTexByName', 'lookWeight', 'LibYml', 'imgWallName', 'LookLib'],
  ui:['marksInUse', 'marksGuard', '添够再切'],
};
const 全码 = Object.keys(名单).map(份 => 抓(份, 名单[份])).join('\n');
const 台 = (改) => {
  let 码 = 全码;
  if(改){ if(!码.includes(改[0])) throw new Error('咬口没咬到：源码里没有那一句 —— ' + 改[0].slice(0, 46)); 码 = 码.replace(改[0], 改[1]); }
  const 沙 = {}; vm.createContext(沙); vm.runInContext(替, 沙); vm.runInContext(码, 沙);
  /* 宿主向组件那一头递当前这一串的接口（真身是 fd3-shell.js 顶上那句 window.FD_MARKS = { hexes… }）：
     markHexes() 全靠它问数，这里不接就等于少了「当前有几个」这一把尺，绕回那一步会按配色那 5 个位算 */
  沙.window.FD_MARKS = { hexes: () => 沙.Marks.hexes() };
  /* 顶层 const 不会挂到 global 上（虚拟机这一头也一样），补一句把它们递出来 —— 真身是同一批对象，改得动 */
  vm.runInContext('this.件 = { Marks, LookLib, LibYml, marksNorm, marksText, marksOf, marksInUse, marksGuard, ' +
    '添够再切, MARK_MIN, MARK_MAX, ACCENT_N, markIndexOf, markCount, LOOK_HEAD, LOOKS_FILE, LOOK_SEED };', 沙);
  return Object.assign(沙, 沙.件);
};
const A = 台();
if(!A.marksInUse || !A.marksGuard || !A.添够再切 || !A.Marks || !A.LookLib) throw new Error('该切的没切进来');

/* ---------- 一、文件里那一栏：写出去、读回来、手工改的脏写法 ---------- */
const 三串 = ['#3b6cb5', '#5ea36a', '#c1663f'];
const 裸 = (n, 色) => ({ 方案名:n, 标记色:色 || [], 配色:'RP 明亮', 外观模式:'质感', 纹理:'无', 纹理用法:'直接使用',
  背景图:'无', 分组:'', 按语言:{}, 字体:'', 卡片圆角:5, 控件圆角:5, 间距:0, 作者:'' });
const 段 = A.LookLib.fields(裸('甲', 三串));
ok('1 写出去那一栏是一条分号隔开的串：' + 段.标记色, 段.标记色 === '#3b6cb5;#5ea36a;#c1663f');
const 文件 = A.LibYml.emit(A.LOOK_HEAD, [{ name:'甲', fields:段 }], ['配色', '标记色']);
ok('2 落到文件里那一行被裹上引号（# 在 YAML 里是行尾说明的开头，不裹整栏就没了）：' + ((/^  标记色:.*$/m.exec(文件) || [''])[0]),
  /^  标记色: "#3b6cb5;#5ea36a;#c1663f"$/m.test(文件));
const 读回 = A.LookLib.scheme(A.LibYml.parse(文件)[0]);
ok('3 写出去再读回来三个色号一个不丢、次序不变（' + 读回.标记色.join(' ') + '）', 读回.标记色.join(',') === 三串.join(','));
const 脏 = A.LookLib.scheme(A.LibYml.parse('甲:\n  标记色: 3b6cb5;#abc;#3B6CB5;#111111;随便写的;#222222\n')[0]);
ok('4 他拿记事本改文件时那些写法照旧洗：漏 # 的、三位简写、大写的、随便写的都不算，重复只留一个（' + 脏.标记色.join(' ') + '）',
  脏.标记色.join(',') === '#3b6cb5,#111111,#222222');
const 空栏 = A.LookLib.scheme(A.LibYml.parse('甲:\n  标记色:\n')[0]);
ok('5 那一栏空着 = 没单独选过（不是「选了零个」）：读回来是长度 ' + 空栏.标记色.length + ' 的数组',
  Array.isArray(空栏.标记色) && 空栏.标记色.length === 0);
const 多 = A.LookLib.scheme(A.LibYml.parse('甲:\n  标记色: "' + Array.from({ length:26 }, (x, i) => '#' + String(i + 1).padStart(6, '0')).join(';') + '"\n')[0]);
ok('6 文件里一口气写 26 个：截到 ' + 多.标记色.length + ' 个（上限 ' + A.MARK_MAX + '），不报错也不整段作废', 多.标记色.length === A.MARK_MAX);
const 表头 = A.LookLib.text();
ok('7 表头那一串里 标记色 紧跟在 配色 后面（中间只隔着外34 图12 新添的 明暗，写和读同一份名单），说明那一段把「分号隔开」和「空着 = 沿用」都写了：' +
   ((/^\s*\['配色'[^\]]*\]/m.exec(抓('lib', ['LookLib'])) || [''])[0].replace(/\s+/g, ' ').slice(0, 60)) + '…',
  /^\s*\['配色', '明暗', '标记色',/m.test(抓('lib', ['LookLib'])) && 表头.includes('分号隔开') && 表头.includes('没单独选过'));

/* ---------- 二、跟着方案走 / 沿用（真 Marks + 真 LookLib.pick 那一整条路） ---------- */
const 甲 = 裸('甲', 三串.slice()), 乙 = 裸('乙'), 丙 = 裸('丙', ['#010101', '#020202', '#030303', '#040404']);
A.LookLib.ready = true; A.LookLib.list = [甲, 乙, 丙]; A.LookLib.cur = '甲';
A.LookStore.data.marks = null; A.LibStore.files[A.LOOKS_FILE] = '';
A.Marks.live = ['#999999', '#888888', '#777777'];
A.LookLib.pick('甲');
ok('8 甲自己钉过三个 → 屏幕上就是它那一串（' + A.Marks.hexes().join(' ') + '）', A.Marks.hexes().join(',') === 三串.join(','));
A.Marks.live = ['#aaaaaa', '#bbbbbb', '#cccccc'];
A.LookLib.pick('乙');
ok('9 切到乙（那一栏空着）= 沿用：屏幕上还是刚才那一串（' + A.Marks.hexes().join(' ') + '），而且没替他写进文件（乙那一栏依然 ' + 乙.标记色.length + ' 个）',
  A.Marks.hexes().join(',') === '#aaaaaa,#bbbbbb,#cccccc' && 乙.标记色.length === 0);
A.LookLib.pick('丙');
ok('10 切到丙（钉过四个）跟着换成它那一串（' + A.Marks.hexes().join(' ') + '）', A.Marks.hexes().length === 4 && A.Marks.hexes()[3] === '#040404');
const 根 = A.根元素.style;
ok('11 根元素上那串 --mark-N 写的就是那一个色号，一个字不派生（--mark-1 = ' + 根['--mark-1'] + '，--mark-4 = ' + 根['--mark-4'] + '）',
  根['--mark-1'] === '#010101' && 根['--mark-4'] === '#040404');
const 上盘 = A.LibStore.存过.length;
A.Marks.set(0, '#EEEEEE');
ok('12 他在界面上动一笔才钉上：丙那一栏第 1 个变成 ' + 丙.标记色[0] + '，写盘多走 ' + (A.LibStore.存过.length - 上盘) + ' 回',
  丙.标记色[0] === '#eeeeee' && A.LibStore.存过.length > 上盘);
const 加前 = 丙.标记色.length;
A.Marks.add('#123456'); const 加后 = 丙.标记色.length; A.Marks.remove(加后 - 1);
ok('13 加一个再撤掉一个，方案那一栏跟着走回来（' + 加前 + ' → ' + 加后 + ' → ' + 丙.标记色.length + '）', 加后 === 加前 + 1 && 丙.标记色.length === 加前);
A.Marks.remove(2); A.Marks.remove(1); A.Marks.remove(0);
ok('14 剩下 ' + A.MARK_MIN + ' 个时再撤就不许：丙那一栏停在 ' + 丙.标记色.length + ' 个，报的那句是「' + (A.报话.slice(-1)[0] || [''])[0] + '」',
  丙.标记色.length === A.MARK_MIN && /最少/.test((A.报话.slice(-1)[0] || [''])[0]));
const 池前 = A.CardPool.items.length;
A.Marks.set(1, '#777777'); A.Marks.add('#888888');
ok('15 改过、加过之后色卡一个字没被添（色卡 ' + A.CardPool.items.length + ' 个 · CardPool 被叫 ' + A.CardPool.叫过 +
   ' 回）—— 作者那条「标记色的色号不会自动进入色卡」就是这一句',
  A.CardPool.items.length === 池前 && A.CardPool.叫过 === 0);

/* ---------- 三、开机那三选一 + 顶上那一节让位 ---------- */
A.LookStore.data = { cur:'x', lookCur:'', marks:{ colors:['#ff0000', '#00ff00', '#0000ff'] } };
A.LookLib.ready = true; A.LookLib.cur = '甲'; 甲.标记色 = []; A.Marks.live = []; A.LookStore.存盘 = 0;
A.Marks.boot();
ok('16 开机第一回：这一套没钉过、外观存档顶上那一节有（从前所有方案共用一串）→ 认下来沿用（' + A.Marks.hexes().join(' ') + '）；' +
   '认完那一节当场抹掉（现在 marks = ' + JSON.stringify(A.LookStore.data.marks) + '，存盘走 ' + A.LookStore.存盘 + ' 回）',
  A.Marks.hexes().join(',') === '#ff0000,#00ff00,#0000ff' && A.LookStore.data.marks === null && A.LookStore.存盘 === 1);
甲.标记色 = ['#0a0a0a', '#0b0b0b', '#0c0c0c'];
A.LookStore.data.marks = { colors:['#ff0000', '#00ff00', '#0000ff'] };
A.Marks.boot();
ok('17 这一套自己钉过的优先：顶上那一节再写什么都不认（屏幕上 ' + A.Marks.hexes().join(' ') + '）',
  A.Marks.hexes().join(',') === '#0a0a0a,#0b0b0b,#0c0c0c');
A.LookLib.ready = false; A.Marks.live = [];
A.LookStore.data.marks = { colors:['#ff0000', '#00ff00', '#0000ff'] };
A.Marks.boot();
ok('18 方案文件这一趟没认下来时绝不动顶上那一节（那是他唯一的存底）：那一节还在不在 = ' + (!!A.LookStore.data.marks) +
   '，屏幕上 ' + A.Marks.hexes().join(' '), !!A.LookStore.data.marks && A.Marks.hexes().join(',') === '#ff0000,#00ff00,#0000ff');
A.LookLib.ready = true; A.LookStore.data.marks = null; A.Marks.live = []; 甲.标记色 = [];
A.Marks.boot();
ok('19 两头都没有（新机器）才照当前配色落一串种子：屏幕上 ' + A.Marks.hexes().length + ' 个（' + A.Marks.hexes().join(' ') + '）',
  A.Marks.hexes().length >= A.MARK_MIN);

/* ---------- 四、数「当前所有文件真用着几个」 ---------- */
const 串 = i => 'var(--mark-' + i + ', var(--slot-' + (((i - 1) % 5) + 1) + '))';
A.Marks.live = Array.from({ length:8 }, (x, i) => '#' + String(i + 1).padStart(6, '0'));
A.IDB.表 = {
  'wnw-docs':{
    'board.b1':{ nodes:[{ fill:串(1), line:'' }, { fill:串(4), line:串(7) }], links:[{ c:串(2) }], groups:[{ c:串(8) }] },
    'board.b2':{ nodes:[{ fill:串(3) }], links:[], groups:[] },
    'book.1':{ cover:'var(--slot-3)' }, 'chapter.9':{ c:'var(--slot-1)' },
  },
  'wnw-state':{ 'hl-rules':[{ slot:5, st:'' }, { slot:1, st:串(6) }], 'hl-kw':[] },
};
ok('20 函数层真跑：两家板子（填充 / 边框 / 连线 / 分组）+ 高亮规则（编号那一路、取值串那一路各一条）摊开数到 ' +
   (await A.marksInUse()) + ' 个编号（当前一串 ' + A.Marks.count() + ' 个）', (await A.marksInUse()) === 8);
A.IDB.表 = { 'wnw-docs':{ 'board.b1':{ nodes:[{ fill:串(2), line:串(2) }], links:[{ c:串(2) }], groups:[] },
  'book.1':{ cover:'var(--slot-3)' }, 'book.2':{ cover:'var(--slot-1)' } }, 'wnw-state':{} };
ok('21 三处都只用第 2 号 + 两本书封面那种 --slot-N 一律不算：数到 ' + (await A.marksInUse()) +
   ' 个（书封面吃的是配色强调位，跟着配色走，不是标记色）', (await A.marksInUse()) === 1);
A.IDB.炸 = true;
const 坏 = await A.marksInUse();
A.IDB.炸 = false;
ok('22 数据库开不起来时不悄悄放行：回的是当前这一串的长度 ' + 坏 + '（宁可多问一句）', 坏 === A.Marks.count());
const 多板 = {}; for(let i = 0; i < 40; i++) 多板['board.x' + i] = { nodes:[{ fill:串(1) }, { fill:串(1) }], links:[], groups:[] };
A.IDB.表 = { 'wnw-docs':多板, 'wnw-state':{} };
ok('23 四十家板子各只写第 1 号 → 数到 ' + (await A.marksInUse()) + ' 个（重复的不多算）', (await A.marksInUse()) === 1);
A.IDB.表 = { 'wnw-docs':{ 'board.b1':{ nodes:[{ fill:串(9) }, { fill:串(12) }], links:[], groups:[] } }, 'wnw-state':{} };
const 绕回 = await A.marksInUse();
ok('24 存档里写着第 9、12 号而当前只有 8 个：绕回之后各算一格 → 数到 ' + 绕回 + ' 个（同色就是这么撞出来的）', 绕回 === 2);
A.Marks.live = ['#aaa', '#bbb', '#ccc', '#ddd', '#eee'];
A.IDB.表 = { 'wnw-docs':{ 'board.b1':{ nodes:[{ fill:'var(--slot-4)' }, { fill:'var(--slot-4)' }], links:[], groups:[] } }, 'wnw-state':{} };
ok('25 老存档那种 var(--slot-N) 也认（markIndexOf 那一头本来就把它当老写法）：数到 ' + (await A.marksInUse()) + ' 个', (await A.marksInUse()) === 1);

/* ---------- 五、那四颗按钮（真 marksGuard 跑起来逐颗点） ---------- */
const 走过 = [];
const 钮名 = d => (d.钮 || []).map(b => String(b.kids[0]));
const 找钮 = (d, 头) => (d.钮 || []).find(b => String(b.kids[0]).indexOf(头) === 0);
const 切了 = () => { A.LookLib.pick('乙'); 走过.push('切了'); };
const 退回 = () => 走过.push('退回');
function 复位(乙的, 在用几个, 上一串){
  甲.标记色 = 上一串.slice(); 乙.标记色 = 乙的 ? 乙的.slice() : [];
  A.LookLib.cur = '甲'; A.LookLib.list = [甲, 乙];
  A.Marks.live = Array.from({ length:在用几个 }, (x, i) => 上一串[i % 上一串.length]);
  A.IDB.表 = { 'wnw-docs':{ 'board.b1':{ nodes:Array.from({ length:在用几个 }, (x, i) => ({ fill:串(i + 1) })), links:[], groups:[] } }, 'wnw-state':{} };
  A.Modal.开 = []; A.报话.length = 0; 走过.length = 0; A.LibStore.存过.length = 0;
}
复位(['#111111', '#222222', '#333333'], 5, ['#aaa', '#bbb', '#ccc', '#ddd', '#eee']);
await A.marksGuard('乙', 切了, 退回);
const 问 = A.Modal.最近();
ok('26 乙只有 3 个、真用着 5 个 → 开口问。题目「' + 问.题 + '」，正文照作者那句一字不差：「' + 问.身.kids[0].kids[0] + '」',
  问.题 === '标记色不够' && 问.身.kids[0].kids[0] === '当前方案标记色数量少于使用中标记色数量，继续启用可能导致部分标记同色');
const 四 = 钮名(问);
ok('27 四颗按钮就是他写的四条，次序也照他写的：' + 四.join(' ｜ '),
  四.length === 4 && 四[0] === '继续启用（接受同色）' && 四[1] === '添加颜色（补足数量）' && 四[2] === '替换当前标记色' && 四[3] === '取消切换');
ok('28 第二行把数目摆出来给人判：「' + 问.身.kids[1].kids[0] + '」',
  /乙」自己选了 3 个/.test(问.身.kids[1].kids[0]) && /真用着的有 5 个/.test(问.身.kids[1].kids[0]));
复位(['#111111', '#222222', '#333333'], 5, ['#aaa', '#bbb', '#ccc', '#ddd', '#eee']);
await A.marksGuard('乙', 切了, 退回); 找钮(A.Modal.最近(), '继续启用').at.onclick();
ok('29 按「继续启用」：切了一趟（走过 = ' + 走过.join(',') + '），乙那一栏一个字没改（还是 ' + 乙.标记色.length + ' 个），屏幕上换成 ' +
   A.Marks.hexes().join(' ') + '（撞色就撞成这样，程序不偷偷补）',
  走过.join(',') === '切了' && 乙.标记色.length === 3 && A.Marks.hexes().join(',') === '#111111,#222222,#333333');
复位(['#111111', '#222222', '#333333'], 5, ['#aaa', '#bbb', '#ccc', '#ddd', '#eee']);
await A.marksGuard('乙', 切了, 退回); 找钮(A.Modal.最近(), '取消切换').at.onclick();
ok('30 按「取消切换」：一整趟不切（走过 = ' + 走过.join(',') + '，cur = ' + A.LookLib.cur + '），乙那一栏没动，报的那句是「' + (A.报话.slice(-1)[0] || [''])[0] + '」',
  走过.join(',') === '退回' && 乙.标记色.length === 3 && A.LookLib.cur === '甲');
复位(['#111111', '#222222', '#333333'], 5, ['#aaa', '#bbb', '#ccc', '#ddd', '#eee']);
await A.marksGuard('乙', 切了, 退回); 找钮(A.Modal.最近(), '替换当前标记色').at.onclick();
ok('31 按「替换当前标记色」：刚才那一串五个整个钉进乙那一套（' + 乙.标记色.join(' ') + '），写盘 ' + A.LibStore.存过.length +
   ' 回，然后切（走过 = ' + 走过.join(',') + '）',
  乙.标记色.join(',') === '#aaa,#bbb,#ccc,#ddd,#eee' && 走过.join(',') === '切了' && A.LibStore.存过.length >= 1);
复位(['#111111'], 5, ['#aaa', '#bbb', '#ccc', '#ddd', '#eee']);
A.IDB.表 = { 'wnw-docs':{ 'board.b1':{ nodes:[1, 2, 3, 4, 5, 9, 12, 20].map(i => ({ fill:串(i) })), links:[], groups:[] } }, 'wnw-state':{} };
const 封顶 = await A.marksInUse();
await A.marksGuard('乙', 切了, 退回);
const 那 = 找钮(A.Modal.最近(), '替换当前标记色');
ok('32 「在用」这个数封顶封在当前这一串的长度上（存档里写了 8 个编号、摊开只数到 ' + 封顶 + ' 个 = 屏幕上 ' + A.Marks.count() +
   ' 个），所以替换那一条永远够用：按不动那一档 disabled = ' + (那.at.disabled === undefined ? '没有这一档' : 那.at.disabled) +
   '，说明写的是「' + 那.at.title + '」',
  封顶 === A.Marks.count() && 那.at.disabled === undefined && /屏幕上这一串（5 个）/.test(那.at.title));
复位(['#111111', '#222222', '#333333'], 5, ['#aaa', '#bbb', '#ccc', '#ddd', '#eee']);
await A.marksGuard('乙', 切了, 退回); 找钮(A.Modal.最近(), '添加颜色').at.onclick();
const 添 = A.Modal.最近();
ok('33 按「添加颜色」开的是「' + 添.题 + '」，第一行「' + 添.身.kids[0].kids[0] + '」，两颗按钮（' + 钮名(添).join(' ｜ ') + '）',
  添.题 === '给这一套添够标记色' && /已有 3 个/.test(添.身.kids[0].kids[0]) && /还差 2 个/.test(添.身.kids[0].kids[0]) && 钮名(添).length === 2);
A.报话.length = 0;
找钮(添, '添够了').at.onclick();
ok('34 还不够就按「添够了，切过去」：不写盘、不切（走过 ' + 走过.length + ' 趟、乙那一栏 ' + 乙.标记色.length + ' 个），报的那句是「' +
   (A.报话.slice(-1)[0] || [''])[0] + '」',
  走过.length === 0 && 乙.标记色.length === 3 && /还差 2 个/.test((A.报话.slice(-1)[0] || [''])[0]));
/* 添够再切 那一屏：draw() 每次把同一个 box 的孩子重刷一遍（不是再开一个窗口），所以「读此刻这一屏」
   只用对着 添.身 这一个盒子看，看到的永远是最新那一版 */
const 头行 = () => 添.身.kids[0].kids[0];
const 那一排 = () => 添.身.kids.find(k => k.at && k.at.class === 'fd-marks');
const 添行 = () => 添.身.kids.find(k => k.at && k.at.class === 'fd-row');
const 串了 = () => ((那一排() || {}).kids || []).map(r => r.kids[1].hex);
const 钮里 = 头 => 添行().kids.filter(k => k.tag === 'button').find(b => String(b.kids[0]).indexOf(头) === 0);
钮里('加一个起点色').at.onclick();
ok('35 按一回「加一个起点色」，那一行跟着改成「' + 头行() + '」（同一个窗口重刷 ' + A.Modal.开.length + ' 回，不是叠两层）',
  /已有 4 个/.test(头行()) && /还差 1 个/.test(头行()) && A.Modal.开.length === 1);
钮里('加一个起点色').at.onclick();
ok('36 再按一回到 5 个：「' + 头行() + '」（两回给的是 ' + 串了().slice(3).join(' 和 ') + '，不是同一个色）',
  /已有 5 个 · 够了/.test(头行()) && new Set(串了()).size === 串了().length);
A.挑过 = []; A.报话.length = 0;
钮里('从色卡挑一个添上').at.onclick();
A.挑过.slice(-1)[0][1]('#3b6cb5');
ok('37 从色卡挑一个这一串里已经有的：不进（还是 ' + 串了().length + ' 个），报的是「' + (A.报话.slice(-1)[0] || [''])[0] + '」',
  串了().length === 5 && /已经有 #3b6cb5 了/.test((A.报话.slice(-1)[0] || [''])[0]));
A.挑过.slice(-1)[0][1]('#00ff88');
ok('38 再挑一个没有的：进来了，那一行改成「' + 头行() + '」', /已有 6 个/.test(头行()));
走过.length = 0;
找钮(添, '添够了').at.onclick();
ok('39 添够之后按「切过去」：六个（' + 乙.标记色.join(' ') + '）钉进乙那一套并切了（走过 = ' + 走过.join(',') + '，六个里互不相同的有 ' +
   new Set(乙.标记色).size + ' 个）',
  乙.标记色.length === 6 && new Set(乙.标记色).size === 6 && 走过.join(',') === '切了');
复位(['#111111', '#222222', '#333333', '#444444', '#555555'], 5, ['#aaa', '#bbb', '#ccc']);
await A.marksGuard('乙', 切了, 退回);
ok('40 乙自己就有 5 个、在用 5 个 → 不开口直接走（弹窗 ' + A.Modal.开.length + ' 个，走过 = ' + 走过.join(',') + '）',
  A.Modal.开.length === 0 && 走过.join(',') === '切了');
复位([], 5, ['#aaa', '#bbb', '#ccc']);
await A.marksGuard('乙', 切了, 退回);
ok('41 乙那一栏空着（没单独选过）→ 也不开口：沿用嘛，够不够不是问题（弹窗 ' + A.Modal.开.length + ' 个，走过 = ' + 走过.join(',') + '）',
  A.Modal.开.length === 0 && 走过.join(',') === '切了');

/* ---------- 六、界面那三条定色路 + 挑色只吃一家（现场数源码） ---------- */
const 那一屏 = (/function markSection\(\)\{[\s\S]*?\n  \}/.exec(源.ui) || [''])[0];
ok('42 三条路都在每一格边上：取色器 ' + (那一屏.match(/colorChip/g) || []).length + ' 处、手写色号那只框 ' +
   (那一屏.match(/h\('input'/g) || []).length + ' 处、「色卡」那一枚 ' + (那一屏.match(/markPoolDlg\(hex/g) || []).length +
   ' 处；色号那一格走的是同一把尺（CardPool.hex ' + (那一屏.match(/CardPool\.hex\(/g) || []).length + ' 处）',
  (那一屏.match(/colorChip/g) || []).length === 1 && (那一屏.match(/h\('input'/g) || []).length === 1
  && (那一屏.match(/markPoolDlg\(hex/g) || []).length === 1 && (那一屏.match(/CardPool\.hex\(/g) || []).length === 1);
const 挑屏 = (/function markPoolDlg\(cur, onPick\)\{[\s\S]*?\n\}/.exec(源.ui) || [''])[0];
ok('43 挑色只吃色卡那一份（两条循环：一条从 CardPool 收色、一条把收来的摆成点）；第二个东西 Marks.pool 在四份源码里提到 ' +
   (([源.lib, 源.shell, 源.ui, 源.look].join('')).match(/Marks\.pool/g) || []).length + ' 处',
  (挑屏.match(/for\(const/g) || []).length === 2 && /CardPool\.items/.test(挑屏) && !/Marks\.pool/.test(源.ui + 源.shell));
const 那一路 = (/const switchScheme = name => \{[\s\S]*?\n  \};/.exec(源.ui) || [''])[0];
ok('44 换方案那一路真的接上了问话：marksGuard ' + (那一路.match(/marksGuard/g) || []).length + ' 处，「取消切换」那一条交回的是把下拉收回原样（schemeSel.draw ' +
   (那一路.match(/schemeSel\.draw/g) || []).length + ' 处）',
  /marksGuard\(name, go, 退回\)/.test(那一路) && /const 退回 = \(\) => schemeSel\.draw\(\)/.test(那一路));
/* 洗掉注释、留下代码和给人看的字符串（用上面那把扫过同一把尺，正则字面量不算注释） */
function 洗白(s){
  let out = '', i = 0, 前 = ' ';
  while(i < s.length){
    const c = s[i];
    if(c === '/' && (s[i + 1] === '/' || s[i + 1] === '*')){ i = 扫过(s, i); 前 = ' '; continue; }
    if(c === '"' || c === "'" || c === '`'){ const n = 扫过(s, i); out += s.slice(i, n); i = n; 前 = '"'; continue; }
    if(c === '/' && 正则位(前)){ const n = 扫过(s, i); out += (n === i ? '/' : s.slice(i, n)); i = n > i ? n : i + 1; 前 = '/'; continue; }
    out += c; if(!/\s/.test(c)) 前 = c; i++;
  }
  return out;
}
const 代码 = 洗白([源.lib, 源.shell, 源.ui, 源.look, 源.packs, rd('src/pack/uitext.cjs')].join('\n'));
const 原文 = [源.lib, 源.shell, 源.ui, 源.look, 源.packs, rd('src/pack/uitext.cjs')].join('\n');
ok('45 界面上那三处说法都改口了：第 4 页那块小标题是「色卡」（不是从前那个「颜色」），文件说明里那一栏叫 标记色；' +
   '两个旧名字在代码和给人看的字符串里各数到 ' + ((代码.match(/色卡池/g) || []).length) + ' / ' + ((代码.match(/配色库/g) || []).length) +
   ' 处（只剩注释里引作者原话那 ' + ((原文.match(/色卡池/g) || []).length - (代码.match(/色卡池/g) || []).length) + ' 处）',
  /gPal = group\('色卡'\)/.test(源.ui) && /'配色', '明暗', '标记色'/.test(抓('lib', ['LookLib']))
  && !/色卡池/.test(代码) && !/配色库/.test(代码) && /统一一下，就叫色卡/.test(原文));

/* ---------- 七、咬三口：把承重那三句各改坏一遍 ---------- */
let 咬沿用 = '', 咬不问 = '', 咬重 = '';
try{
  const 沙 = 台(['if(!out.length) return false;', '']);
  沙.LookLib.ready = true; 沙.LookLib.list = [裸('乙')]; 沙.LookLib.cur = '乙';
  沙.Marks.live = ['#aaaaaa', '#bbbbbb', '#cccccc'];
  沙.LookLib.apply(沙.LookLib.list[0], { noRender:true });
  咬沿用 = String(沙.Marks.hexes().length);
}catch(e){ 咬沿用 = '抛了：' + ((e && e.message) || e); }
try{
  const 沙 = 台(['if(那一串.length >= 在用){ go(); return; }', '']);
  沙.LookLib.ready = true;
  沙.LookLib.list = [Object.assign(裸('够'), { 标记色:['#111111', '#222222', '#333333', '#444444', '#555555'] })];
  沙.LookLib.cur = '甲'; 沙.Marks.live = ['#aaa', '#bbb', '#ccc', '#ddd', '#eee'];
  沙.IDB.表 = { 'wnw-docs':{ 'board.b1':{ nodes:[{ fill:串(1) }], links:[], groups:[] } }, 'wnw-state':{} };
  let 走了 = 0;
  await 沙.marksGuard('够', () => { 走了++; }, () => {});
  咬不问 = 沙.Modal.开.length + ' 个窗 / 切了 ' + 走了 + ' 趟';
}catch(e){ 咬不问 = '抛了：' + ((e && e.message) || e); }
try{
  /* 把「这一串里已经有这个色了就不再添」那一道滤掉：从色卡挑一个重复的色，那一串就多出一格同色 */
  const 沙 = 台(['const 占 = (hex, 跳) => 串.some((x, j) => String(x).toLowerCase() === String(hex).toLowerCase() && j !== 跳);',
    'const 占 = () => false;']);
  沙.LookLib.ready = true;
  沙.LookLib.list = [Object.assign(裸('乙'), { 标记色:['#111111', '#222222', '#333333'] })];
  沙.LookLib.cur = '甲'; 沙.Marks.live = ['#aaa', '#bbb', '#ccc', '#ddd', '#eee'];
  沙.IDB.表 = { 'wnw-docs':{ 'board.b1':{ nodes:[1, 2, 3, 4, 5].map(i => ({ fill:串(i) })), links:[], groups:[] } }, 'wnw-state':{} };
  await 沙.marksGuard('乙', () => {}, () => {});
  找钮(沙.Modal.最近(), '添加颜色').at.onclick();
  const 屏 = 沙.Modal.最近();
  const 排 = () => 屏.身.kids.find(k => k.at && k.at.class === 'fd-marks');
  屏.身.kids.find(k => k.at && k.at.class === 'fd-row').kids.filter(k => k.tag === 'button')
    .find(b => String(b.kids[0]).indexOf('从色卡挑一个添上') === 0).at.onclick();
  沙.挑过.slice(-1)[0][1]('#111111');
  咬重 = 排().kids.map(r => r.kids[1].hex).join(' ') + '（' + 排().kids.length + ' 格、互不相同 ' + new Set(排().kids.map(r => r.kids[1].hex)).size + ' 个）';
}catch(e){ 咬重 = '抛了：' + ((e && e.message) || e); }
ok('46 咬得住三处：摘掉「空着就沿用」那一句 → 切到没钉过的那一套时屏幕上剩 ' + 咬沿用 + ' 个（第 9 条那种判法立刻不过）；' +
   '摘掉「够就不问」那一句 → 明明够也 ' + 咬不问 + '（第 40 条那种判法立刻不过）；' +
   '摘掉「重色不再添」那一道 → 从色卡挑一个已有的色真添进去了：' + 咬重 + '（第 37 条那种判法立刻不过）。' +
   '三样都反着来才不过，说明这三条断的是真事、不是自造的假场景',
  咬沿用 === '0' && 咬不问 === '1 个窗 / 切了 0 趟' && /互不相同 3 个/.test(咬重));

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
