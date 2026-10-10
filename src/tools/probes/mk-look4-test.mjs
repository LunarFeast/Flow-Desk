/* 外29 丁组 · 第 4 页「方案资源 · 图片」+ 标记色那一排 + 换方案那四选一 —— 这一页真点一遍（接线层）
   为什么还要再开一台：test-imglib.mjs / test-marks.mjs 那两台把 ImgLib、Marks、LookLib 搬进虚拟机跑通了数据那一头，
   可「界面上这些按钮按下去走不走得通、走错了报什么话」它一句没测 —— 那正是历史上最容易坏的一段
   （桥的名字对不上、调用点参数递错、认不到图还摆一条假选项）。虚拟机那两台吃的是替身元素，
   这一台吃的是真 DOM：取色片里那只 input[type=color]、色号那只框、色卡挑出来的圆点，都是浏览器真控件。
   切的全是源码真身，不是照抄一遍：
     · fd4-builtin.js 的 row / TexTest / imgDecodes / imgAccept / imgImport / imgLibSection / imgEmptyWord / 池尾
       / colorChip / markSection / markPoolDlg / marksInUse / marksGuard / 添够再切
     · fd3-lib.js 的 IMG_FILE / IMG_USES / IMG_HEAD / LibYml / imgUseOf / imgKey / imgUrl / imgBlob / imgWallName / ImgLib
     · fd3-shell.js 的 h（元素那一步全站都吃它）+ 那一整块界面 CSS（只剔带 ${} 的那一行）
   假货只交运行时够不着的那几样：文件选择框（递一张真生成的 8×8 PNG 文件）、图标那一层的清单（写了盘就补进表）、
   色卡（记账）、方案清单和当前这一串标记色（记账）、IndexedDB（递一张写好的板子）。
   生成物：src\tools\probes\mk-look4-test.html（.gitignore 已关掉，双击就能开，底下那一排按钮每一步都点得动）。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));
const REPO = 'D:/Programs/Flow-Desk';

const src = p => fs.readFileSync(path.join(REPO, p), 'utf8');
const LIB = src('src/_fd/src/fd3-lib.js');
const BUILT = src('src/_fd/src/fd4-builtin.js');
const SHELL = src('src/_fd/src/fd3-shell.js');
const PACKS = src('src/_shared/sh-packs.js');
const ICO = src('src/_shared/sh-ico.js');

function tillBrace(text, head){
  const i = text.indexOf(head);
  if(i < 0) throw new Error('没切到：' + head);
  let d = 0, j = text.indexOf('{', i);
  for(let k = j; k < text.length; k++){
    if(text[k] === '{') d++;
    else if(text[k] === '}'){ d--; if(!d) return text.slice(i, k + 1); }
  }
  throw new Error(head + ' 花括号没配平');
}
function tillLine(text, head){
  const i = text.indexOf(head);
  if(i < 0) throw new Error('没切到：' + head);
  const j = text.indexOf('\n', i);
  return text.slice(i, j + 1);
}

/* ---------- 一、界面 CSS：模板那一份 + fd3-shell.js 里那块字面量（同一个规矩：只剔嵌了 ${} 的那几行） ---------- */
const TPL = src('src/_fd/template.html');
const t0 = TPL.indexOf('<style>'), t1 = TPL.indexOf('</style>', t0);
if(t0 < 0 || t1 < 0) throw new Error('模板里没有 <style> 那一段');
const SHL = SHELL.split(/\r?\n/);
const c0 = SHL.findIndex(l => l.includes("h('style', { html:`"));
const c1 = SHL.findIndex((l, i) => i > c0 && /^\s*`\s*\}\)\);/.test(l));
if(c0 < 0 || c1 < 0) throw new Error('没圈住 fd3-shell.js 的 CSS 字面量');
const 剔 = [];
const 过 = ls => ls.filter(l => {
  if(l.indexOf('${') < 0) return true;
  剔.push(l.trim()); return false;
}).join('\n');
const CSS = 过([TPL.slice(t0 + 7, t1), 过(SHL.slice(c0 + 1, c1))]);
for(const 条 of ['.fd-dot{', '.fd-dots{', '.fd-input', '.fd-btn', '.fd-mark{', '.fd-marks{'])
  if(CSS.indexOf(条) < 0) throw new Error('切进来的 CSS 里没有「' + 条 + '」，这一页点出来会不像界面');

/* ---------- 二、真源码那几块 ---------- */
const PIECES = [
  /^const MARK_MIN = .*$/m.exec(PACKS)[0],
  /^const ACCENT_N = .*$/m.exec(PACKS)[0],
  tillBrace(PACKS, 'function markHexes(){'),
  tillLine(PACKS, 'function markCount()'),
  tillBrace(PACKS, 'function markIndexOf(v){'),
  /* 图标那一层「撤掉这一个」那颗小叉要用：icoMarkup 底下压着 icoName / icoClass / icoInner / ICO_D 四样，
     从前只切了 icoMarkup 一颗，所以这一屏只要真摆出带图标的按钮就当场抛「icoName is not defined」 */
  tillLine(ICO, 'function cssName('),
  /const GLYPH_ALIAS = \{[\s\S]*?\};/.exec(ICO)[0],
  tillLine(ICO, 'function icoName('),
  tillBrace(ICO, 'function icoClass(n, extra){'),
  tillBrace(ICO, 'function icoInner(n){'),
  tillLine(ICO, 'function attrEsc('),
  /const ICO_D = \{[\s\S]*?\n\};/.exec(ICO)[0],
  tillBrace(ICO, 'function icoMarkup('),
  tillBrace(SHELL, 'function h(tag, props, kids)'),
  tillBrace(BUILT, 'function row(lbl, ctrl){'),
  /const 池尾 = [\s\S]*?;\n/.exec(BUILT)[0],
  tillBrace(BUILT, 'const TexTest = {'),
  tillBrace(BUILT, 'async function imgDecodes(file){'),
  tillBrace(BUILT, 'async function imgAccept(file, name, use){'),
  tillBrace(BUILT, 'async function imgImport(use, after){'),
  tillBrace(BUILT, 'function imgLibSection(after){'),
  tillBrace(BUILT, 'function imgEmptyWord(use){'),
  tillBrace(BUILT, 'function markPoolDlg(cur, onPick){'),
  tillBrace(BUILT, 'function colorChip(hex, onPick, title){'),
  tillBrace(BUILT, 'function markSection(){'),
  tillBrace(BUILT, 'async function marksInUse(){'),
  tillBrace(BUILT, 'async function marksGuard(name, go, 退回){'),
  tillBrace(BUILT, 'function 添够再切(name, 那一串, 在用, go, 退回){'),
  /^const IMG_PICK = .*$/m.exec(BUILT)[0],
  /^const IMG_FILE = .*$/m.exec(LIB)[0],
  /const IMG_USES = \[[\s\S]*?\];/.exec(LIB)[0],
  /const IMG_HEAD = \[[\s\S]*?\]\.join\('\\n'\);/.exec(LIB)[0],
  tillBrace(LIB, 'const LibYml = {'),
  tillBrace(LIB, 'function imgUseOf(v){'),
  tillBrace(LIB, 'function imgKey(file){'),
  tillBrace(LIB, 'function imgUrl(t){'),
  /^const imgBlobs = \{\};$/m.exec(LIB)[0],
  tillBrace(LIB, 'async function imgBlob(t){'),
  tillBrace(LIB, 'function imgWallName(nm){'),
  tillBrace(LIB, 'const ImgLib = {')
];
/* 切出来先自查一遍：这一段里要真有新加的那几样，切错了这一页就白点 */
const 合 = PIECES.join('\n');
for(const 件 of ["ImgLib.putBytes(base + ext", "ImgLib.add(name, base + ext, use, '')", "ImgLib.byUse(u.k)",
  "for(const c of CardPool.items) push(CardPool.hexOf(c))", "从色卡挑一个颜色", "markPoolDlg(hex",
  "三条路都可使", "type:'color'", "当前方案标记色数量少于使用中标记色数量", "这一串里已经有 ' + hex"])
  if(!合.includes(件)) throw new Error('切进来的源码里没有「' + 件 + '」—— 切错了，这台不算测过');

/* ---------- 三、假货：只补运行时够不着的那三样 ---------- */
const STUB = `
/* 界面文字清单那一层：这一页不读 data\\\\ui-text.yaml，原句照过（h 里那两枚属性要吃它） */
const Txt = { out:s => String(s), pageNow:'' };
let rowSeq = 0;
/* 文件选择框：按队列递一张真生成的 PNG 文件（imgDecodes / TexTest 吃的就是这张真图） */
let 挑队 = [];
async function pickFile(){ if(!挑队.length) return null; return { file: 挑队.shift(), handle:null }; }
async function pickFiles(){ const x = await pickFile(); return x ? [x] : []; }
/* 图标那一层：主进程扫 data\\images\\ 递给页面那一张表，这里写了盘就补进表（和真广播同一个结果）。
   地址给一条 data: 的那一种：about:blank 取不到字节（浏览器根本不让 fetch 它），而「取色进池」那一步要 fetch 原图。 */
const 假图 = 'data:image/png;base64,iVBORw0KGgo=';
const 落盘 = [];
const Ico = { table:{}, url(n){ return this.table[n] || ''; }, has(n){ return !!this.table[n]; },
  /* 主进程那一层是「进了那个文件夹，按文件名念」，这里也照那样先把路径切成文件名再算键 */
  async reloadList(){ for(const p of 落盘){ const f = String(p).split(/[\\\\/]/).pop(); const k = imgKey(f); if(k) Ico.table['images-' + k] = 假图; } return true; } };
window.FD_APP = { async writePageBytes(p, bytes){ 落盘.push(p); return { ok:true }; } };
const Theme = { cfg:{}, apply(){ 上的++; } }; let 上的 = 0;
const Bus = { emit(){ 播的++; } }; let 播的 = 0;
const Shell = { refreshSoon(){ 排的++; }, gap:12, fitGrid(){} }; let 排的 = 0;
const LibStore = { files:{ 'images.yaml':'', 'looks.yaml':'' }, puts:[],
  async fetchRaw(n){ return Object.prototype.hasOwnProperty.call(this.files, n) ? this.files[n] : null; },
  async putRaw(n, t){ this.files[n] = t; this.puts.push(n); return { ok:true }; }, later(){ } };
function lookTexSet(list){ 喂的 = list; 喂的次数++; } let 喂的 = null, 喂的次数 = 0;
/* 取色那一步真解码要画图，这里交一份固定名单（断的是「取到的色有没有进池」那一段路）：
   每一趟交回两个老色加一个新色，所以第二回按下去报的应当是「进池 1 个」—— 老色不该重复攒 */
let 色号 = 0;
const ImageTheme = { async colors(){ 色号++;
  const g = (0x21 * 色号) % 256, 新 = '#' + g.toString(16).padStart(2, '0').repeat(3);
  return ['#3b6cb5', '#5ea36a', 新]; } };
const CardPool = { items:[{ code:'k1', colors:[{ raw:'#101010' }] }, { code:'k2', colors:[{ raw:'#aaaaaa' }] }],
  hexOf(c){ return (c.colors && c.colors[0] && c.colors[0].raw) || ''; }, count(){ return this.items.length; },
  /* 色号那一只框吃的是真身那把尺（#3b6cb5 / 3b6cb5 / 0x35A82A / rgb(...) / cmyk(...) 都认），
     这里只认前三种写法 —— 断的是「这只框的值有没有走通 CardPool.hex → Marks.set 那一段」，不是断认色本身 */
  hex(s){ const v = String(s || '').trim();
    const m = /^(?:#|0x)?([0-9a-f]{6})$/i.exec(v); return m ? '#' + m[1].toLowerCase() : ''; },
  addAll(list){ let 加 = 0;
    for(const x of list) if(!this.items.some(c => CardPool.hexOf(c) === x)){ this.items.push({ code:'x' + this.items.length, colors:[{ raw:x }] }); 加++; }
    return 加; } };
/* 标记色：这一台记账用的是新的那一套（每一套方案自己带一串，界面上动一笔就钉进那一套） */
const Marks = { 色:['#3b6cb5', '#5ea36a', '#c1663f'], 写过的:[],
  hexes(){ return this.色.slice(); }, count(){ return this.色.length; },
  set(i, hex){ this.写过的.push('set ' + i + '=' + hex);
    if(i >= 0 && i < this.色.length) this.色[i] = hex; else if(i === this.色.length) this.色.push(hex); return true; },
  add(hex){ if(this.色.length >= MARK_MAX) return false;
    const 起 = this.nextHex(); this.色.push(起); this.写过的.push('add ' + 起); return true; },
  remove(i){ if(this.色.length <= MARK_MIN) return false; this.色.splice(i, 1); this.写过的.push('remove ' + i); return true; },
  nextHex(排除){ const p = ['#3366cc', '#33aa66', '#cc6633', '#3399cc', '#99cc33'];
    const used = Array.isArray(排除) ? 排除 : this.色;
    return p.find(x => !used.includes(x)) || p[0]; },
  reseed(){ this.色 = ['#3366cc', '#33aa66', '#cc6633', '#9933cc', '#33aaaa']; this.写过的.push('reseed'); return this.色.slice(); } };
window.FD_MARKS = { hexes: () => Marks.hexes() };
/* 方案清单：两条，甲自己钉过五个、乙只钉过三个（够不上板子里真用着的五个 → 切过去要问那四选一） */
const LookLib = { cur:'甲', list:[{ 方案名:'甲', 标记色:['#3b6cb5', '#5ea36a', '#c1663f', '#8a5cb5', '#3a9aa3'] },
  { 方案名:'乙', 标记色:['#111111', '#222222', '#333333'] }], 存盘:0,
  get(){ return this.list.find(x => x.方案名 === this.cur) || null; }, saveNow(){ this.存盘++; return Promise.resolve({ ok:true }); } };
/* 存档那一条：一张板子真用着第 1…5 号标记色（marksInUse 走的是 IDB.keys/get 这两句） */
const IDB = { async keys(){ return ['board.b1']; },
  async get(){ return { nodes:[1, 2, 3, 4, 5].map(i => ({ fill:'var(--mark-' + i + ', var(--slot-1))', line:'' })),
    links:[], groups:[] }; } };
const CV = { hslOf(hex){ const n = parseInt(String(hex).slice(1), 16); return [((n >> 16) & 255) + ((n >> 8) & 255), (n >> 16) & 255]; } };
/* 弹框：真挂进文档（要的是「按下去有没有把这一屏摆出来」），确认那一句的答案由 架.答 给 */
const 架 = { 开:[], 答:true, 话:[] };
const Modal = { open(title, body, btns){ if(架.体) 架.体.remove(); const 壳 = h('div', { style:'position:fixed;left:8px;top:8px;right:8px;background:var(--card-bg,#fff);padding:10px;z-index:9' },
    [h('b', {}, title), body, h('div', { class:'fd-row' }, btns || [])]);
  document.body.appendChild(壳); 架.开.push({ title, 壳 }); 架.体 = 壳; },
  close(){ if(架.体) 架.体.remove(); 架.体 = null; } };
function toast(msg, urgent){ 架.话.push(String(msg) + (urgent ? '[警告脸]' : '')); }
async function fdAsk(q){ 架.开.push({ title:'确认框', 壳:null, 问:q }); return 架.答; }
`;

/* ---------- 四、驱动：每一步真按一遍，结果写进 window.R ---------- */
const DRIVE = `
const R = { 步:[], 错:[], 数:{} };
window.onerror = (m, f, l) => { R.错.push('未捕获：' + m + ' @' + l); };
window.addEventListener('unhandledrejection', e => { R.错.push('没接住的拒绝：' + ((e.reason && e.reason.message) || e.reason)); });
const 收尾 = () => { window.R = R; q('#结果').textContent = R.步.join('\\n'); q('#数').textContent = JSON.stringify(R.数, null, 1);
  q('#状态').textContent = '第 4 页那三块点完：' + R.步.filter(x => x.indexOf('PASS') === 0).length + ' 过 ' +
    R.步.filter(x => x.indexOf('FAIL') === 0).length + ' 不过 · 未捕获 ' + R.错.length + ' 条'; };
const q = s => document.querySelector(s);
const qs = s => [...document.querySelectorAll(s)];
const 记 = (k, v) => { R.数[k] = v; };
const 判 = (名, 对, 实) => R.步.push((对 ? 'PASS ' : 'FAIL ') + 名 + (实 === undefined ? '' : ' 〔' + 实 + '〕'));
async function 按(el){ if(!el) throw new Error('要按的东西不在场上'); el.click(); await new Promise(r => setTimeout(r, 30)); }
/* 弹窗不是同步出现的：导入那一步要先解码那张图（TexTest / imgDecodes），所以这里等它，最多等 1200 毫秒 */
async function 等到(条件, 顶){ const 到 = Date.now() + (顶 || 1200);
  while(Date.now() < 到){ const x = 条件(); if(x) return x; await new Promise(r => setTimeout(r, 20)); }
  return null; }
/* 造一张 8×8 的实心 PNG（边长落在 TexTest 认的那一档里，四条边和对面那条一模一样） */
async function 造图(名){
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
  const g = cv.getContext('2d'); g.fillStyle = '#3b6cb5'; g.fillRect(0, 0, 8, 8);
  const b = await new Promise(r => cv.toBlob(r, 'image/png'));
  return new File([b], 名, { type:'image/png' });
}
const 等 = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  /* 一、开机：三份库里那份图片库先认下来（清单里三种用途各一张） */
  LibStore.files['images.yaml'] = 'A石:\\n  图: img-a.png\\n  用途: 纹理·四方连续图\\n  作者:\\nB景:\\n  图: img-b.png\\n  用途: 背景图\\n  作者:\\nC材:\\n  图: img-c.png\\n  用途: 取色素材\\n  作者:\\n';
  Ico.table['images-img-a'] = 假图; Ico.table['images-img-b'] = 假图; Ico.table['images-img-c'] = 假图;
  await ImgLib.boot();
  记('开机认到几张', ImgLib.list.length);
  判('开机那一步认到三张、用途各归各的', ImgLib.list.length === 3 && ImgLib.byUse('背景图').length === 1,
    ImgLib.list.map(t => t.名字 + '=' + t.用途).join(' / '));

  /* 二、第 4 页那一块摆出来：三颗导入 + 三块各一行，每行三样 */
  const 块 = imgLibSection(() => { R.数.回调 ++ ; });
  q('#图').appendChild(块);
  const 导 = qs('#图 button').filter(b => /按.*导入/.test(b.textContent));
  记('导入按钮几颗', 导.length);
  判('三颗导入按钮都在场上，写的就是那三种用途', 导.length === 3, 导.map(b => b.textContent).join('、'));
  const 行 = () => qs('#图 .fd-row').filter(r => r.querySelector('select'));
  const 行中 = 名 => 行().find(r => r.querySelector('span') && r.querySelector('span').textContent.indexOf(名) === 0);
  记('图库几行', 行().length);
  判('库里三张就摆三行，每行一个改用途的下拉、一枚取色、一枚划掉', 行().length === 3
    && 行().every(r => r.querySelectorAll('button').length === 2), 行().length + ' 行');

  /* 三、取色进池：点 A石 那一行的「取色进池」 */
  const 池先 = CardPool.count();
  await 按(行中('A石').querySelector('button'));
  判('点「A石」那一行的取色进池：色卡从 ' + 池先 + ' 个变成 ' + CardPool.count() + ' 个，报话里带着这两个数',
    CardPool.count() > 池先 && /从「A石」取到 3 个色 · 进色卡 3 个/.test(架.话[架.话.length - 1] || ''), 架.话[架.话.length - 1]);

  /* 四、改用途：把 A石 那一行改成当背景图用（三块是按用途分的，所以这一行应当整行搬到背景那一块） */
  const 下 = 行中('A石').querySelector('select');
  下.value = '背景图';
  下.dispatchEvent(new Event('change'));
  await 等(40);
  判('改完用途，那一行搬到背景图那一块（背景 ' + ImgLib.byUse('背景图').length + ' 张、纹理 ' +
    ImgLib.byUse('纹理·四方连续图').length + ' 张），清单也写回了文件',
    ImgLib.byUse('背景图').length === 2 && ImgLib.byUse('纹理·四方连续图').length === 0 && /A石:[\\s\\S]*?用途: 背景图/.test(LibStore.files['images.yaml']),
    ImgLib.byUse('背景图').map(t => t.名字).join(',') + ' / 文件里 ' + (/用途: 背景图/.test(LibStore.files['images.yaml']) ? '写着背景图' : '没改'));

  /* 五、按「按纹理 / 四方连续图导入」走一整趟：选图 → 名字框 → 收下 → 落盘 + 进清单 + 这一行多出来 */
  const 导纹 = qs('#图 button').find(b => b.textContent.indexOf('纹理') >= 0);
  挑队 = [await 造图('我家 纹路.png')];
  const 架先 = 架.开.length;
  await 按(导纹);
  const 弹一 = await 等到(() => (架.开.length > 架先 ? 架.开[架.开.length - 1] : null));
  const 名框 = 弹一 && 弹一.壳 ? [...弹一.壳.querySelectorAll('input')].find(i => i.value === '我家 纹路') : null;
  判('导入弹窗开了（标题「' + (弹一 ? 弹一.title : '没开') + '」），名字默认写着源文件名去掉后缀那一段（' +
    (名框 ? 名框.value : '没有名字框') + '）',
    !!弹一 && /按纹理/.test(弹一.title || '') && !!名框, 架.话.length ? 架.话[架.话.length - 1] : '');
  const 库先 = ImgLib.list.length;
  const 话先 = 架.话.length;
  const 收下 = 弹一 && 弹一.壳 ? [...弹一.壳.querySelectorAll('.fd-btn.primary')].pop() : null;
  判('弹窗里那颗主按钮写的是「收下」（这张 8×8 的实心图四条边对得上，纹理那一路不该先问一句贴不贴得开）',
    !!收下 && 收下.textContent === '收下', 收下 ? 收下.textContent : '没有主按钮');
  await 按(收下);
  /* 收下那一步要写图、问图标那一层要清单、再写名单，前后半秒到一秒多 —— 等报话出来，不等固定毫秒数 */
  const 报一 = await 等到(() => (架.话.length > 话先 ? 架.话[架.话.length - 1] : null), 3000);
  记('收下之后库里几张', ImgLib.list.length);
  判('按下去库里多一张（' + 库先 + ' → ' + ImgLib.list.length + '），图真落到图库那一格（' + 落盘.join(',') + '，走的是 data/images/ 那一条），报话是「已收下」而且不带警告脸（图标那一层认到那张图了）',
    ImgLib.list.length === 库先 + 1 && 落盘.length === 1 && 落盘[0].indexOf('data/images/img-') === 0
    && 报一.indexOf('已收下「我家 纹路」') === 0 && 报一.indexOf('[警告脸]') < 0, 报一);
  判('新那一张落在纹理那一块（纹理 ' + ImgLib.byUse('纹理·四方连续图').length + ' 张），界面上重画出来的行数是 ' + 行().length,
    ImgLib.byUse('纹理·四方连续图').length === 1 && 行().length === ImgLib.list.length, 行().length);

  /* 五·补、绕过弹窗直接跑一遍 imgAccept：哪一步走不通，这一条会说出它卡在哪 */
  let 直测 = '';
  try{ const f = await 造图('直测.png'); const rr = await imgAccept(f, '直测一张', '背景图'); 直测 = JSON.stringify(rr); }
  catch(e){ 直测 = '抛了：' + ((e && e.message) || e); }
  判('直接跑一遍 imgAccept（落盘 → 等图标那一层认到 → 写清单）：' + 直测, /"ok":true/.test(直测), 直测.slice(0, 140));

  /* 六、取色素材那一颗：收下并取色（一次点击两件事） */
  const 导材 = qs('#图 button').find(b => b.textContent.indexOf('取色素材') >= 0);
  挑队 = [await 造图('色卡.png')];
  const 池二 = CardPool.count();
  const 架二 = 架.开.length, 话二 = 架.话.length;
  await 按(导材);
  const 弹二 = await 等到(() => (架.开.length > 架二 ? 架.开[架.开.length - 1] : null));
  const 并 = 弹二 && 弹二.壳 ? [...弹二.壳.querySelectorAll('.fd-btn.primary')].pop() : null;
  判('取色素材那颗按下去，弹窗标题是「按取色素材导入」、按钮写的是「收下并取色」（' + (并 ? 并.textContent : '没有主按钮') + '）',
    !!弹二 && 弹二.title === '按取色素材导入' && !!并 && 并.textContent === '收下并取色', 弹二 ? 弹二.title : '没开');
  await 按(并);
  const 报二 = await 等到(() => (架.话.length > 话二 ? 架.话[架.话.length - 1] : null), 3000);
  判('一趟下来库里多一张、色卡只多一个新色（池 ' + 池二 + ' → ' + CardPool.count() + '，两个老色不该重复攒），报话把两笔都报了',
    ImgLib.byUse('取色素材').length === 2 && CardPool.count() === 池二 + 1 && /取到 3 个色，进色卡 1 个/.test(报二 || ''),
    报二);

  /* 七、划掉一张：确认框问一句（抹掉已落盘的那一段记录才问），答「是」才动 */
  const 库三 = ImgLib.list.length, 盘三 = 落盘.length;
  const 划 = 行()[行().length - 1].querySelectorAll('button')[1];
  await 按(划);
  const 问过 = 架.开[架.开.length - 1];
  判('划掉之前先问一句，话里写清「图本身还留在数据里」', !!问过 && 问过.title === '确认框' && /还留在/.test(问过.问 || ''), (问过.问 || '').slice(0, 30));
  await 等(60);
  判('答「是」之后清单少一段（' + 库三 + ' → ' + ImgLib.list.length + '），但程序一张图都没删（落盘记录还是 ' + 落盘.length + ' 张，和动手前一样）',
    ImgLib.list.length === 库三 - 1 && 落盘.length === 盘三);

  /* 八、标记色那一排摆出来的样子：每一格三条路（取色片里那只原生取色器 + 色号那只框 + 「色卡」那一枚） */
  const 标 = markSection();
  q('#标').appendChild(标);
  const 格 = () => [...q('#标 .fd-marks').children];
  const 色号框 = r => r.querySelector('input.fd-input');
  const 取色器 = r => r.querySelector('input[type=color]');
  const 挑钮 = r => [...r.querySelectorAll('button')].find(b => b.textContent === '色卡');
  const 撤钮 = r => [...r.querySelectorAll('button')].find(b => b.title === '撤掉这一个');
  判('三格各摆一条：每格里取色器 ' + 格().filter(r => 取色器(r)).length + ' 只、色号框 ' + 格().filter(r => 色号框(r)).length +
    ' 只、「色卡」一枚 ' + 格().filter(r => 挑钮(r)).length + ' 个；这一串正好 ' + MARK_MIN + ' 个，所以撤掉那颗不摆（' +
    格().filter(r => 撤钮(r)).length + ' 个）',
    格().length === 3 && 格().every(r => 取色器(r) && 色号框(r) && 挑钮(r) && !撤钮(r))
    && 色号框(格()[0]).value === '#3b6cb5' && /三条路都可使/.test(qs('#标 .fd-hint').map(x => x.textContent).join(' ')),
    格().length + ' 格 · 第 1 格色号 ' + 色号框(格()[0]).value);

  /* 九、取色器那一条：拖动过程中只重画这一格（不写盘），松手那一下才写进 Marks */
  let r0 = 格()[0];
  取色器(r0).value = '#123456'; 取色器(r0).dispatchEvent(new Event('input'));
  r0 = 格()[0];
  判('取色器只拖了一下（input）：这一格的色号框跟着改成 ' + 色号框(r0).value + '，可 Marks 一个字没写（写过的 ' + Marks.写过的.length + ' 笔）',
    色号框(r0).value === '#123456' && Marks.写过的.length === 0, Marks.写过的.join(' / '));
  r0 = 格()[0]; 取色器(r0).value = '#123456'; 取色器(r0).dispatchEvent(new Event('change'));
  判('松手（change）那一下才落定：写了 ' + Marks.写过的.slice(-1)[0] + '，重画之后第 1 格是 ' + 色号框(格()[0]).value,
    /^set 0=#123456$/.test(Marks.写过的.slice(-1)[0] || '') && 色号框(格()[0]).value === '#123456', Marks.写过的.join(' / '));

  /* 十、色号那一只框：认不出来的原样退回，认得出来的（0x 那一种也认）走 Marks.set */
  let r1 = 格()[1];
  色号框(r1).value = '乱写的'; 色号框(r1).dispatchEvent(new Event('change'));
  判('色号框里写「乱写的」：报的是「' + (架.话.slice(-1)[0] || '') + '」，那一格还是 ' + 色号框(格()[1]).value + '，Marks 没多写一笔',
    /认不出来/.test(架.话.slice(-1)[0] || '') && 色号框(格()[1]).value === '#5ea36a' && Marks.写过的.length === 1, 架.话.slice(-1)[0]);
  r1 = 格()[1]; 色号框(r1).value = '0x35A82A'; 色号框(r1).dispatchEvent(new Event('change'));
  判('写 0x35A82A（同一把尺 CardPool.hex）：那一格换成 ' + 色号框(格()[1]).value + '，Marks 记的是 ' + Marks.写过的.slice(-1)[0],
    色号框(格()[1]).value === '#35a82a' && /^set 1=#35a82a$/.test(Marks.写过的.slice(-1)[0] || ''), Marks.写过的.join(' / '));

  /* 十一、「色卡」那一枚：只摊色卡那一份，挑中就当场换上 */
  const 池先二 = CardPool.count();
  await 按(挑钮(格()[2]));
  const 挑屏 = 架.开[架.开.length - 1];
  const 圆点 = 挑屏 && 挑屏.壳 ? 挑屏.壳.querySelectorAll('button.fd-dot') : [];
  判('按「色卡」开的是「' + (挑屏 ? 挑屏.title : '没开') + '」，摊了 ' + 圆点.length + ' 个圆点，说明写的是色卡上攒的 ' + 池先二 +
    ' 个（第二个来源 Marks.pool 早没了：' + (Marks.pool === undefined ? 'undefined' : typeof Marks.pool) + '）',
    !!挑屏 && 挑屏.title === '从色卡挑一个颜色' && 圆点.length >= 2
    && new RegExp('色卡上攒的 ' + 池先二 + ' 个').test(挑屏.壳.querySelector('.fd-hint').textContent), 圆点.length + ' 个');
  await 按(圆点[0]);
  判('挑中第一个圆点（' + 圆点[0].title + '）：第 3 格换上它（' + 色号框(格()[2]).value + '），窗口也收了',
    色号框(格()[2]).value === 圆点[0].title && !架.体, 色号框(格()[2]).value);

  /* 十二、加一个到 4 格 → 撤掉那颗才摆出来；撤掉要先问一句 */
  const 加一 = [...qs('#标 .fd-row button')].find(b => b.textContent === '加一个');
  await 按(加一);
  判('按「加一个」：这一串变 ' + 格().length + ' 格，每一格的撤掉那颗这才摆出来（' + 格().filter(r => 撤钮(r)).length + ' 枚）',
    格().length === 4 && 格().every(r => 撤钮(r)) && /add #/.test(Marks.写过的.slice(-1)[0] || ''), Marks.写过的.slice(-1)[0]);
  const 问先 = 架.开.length;
  await 按(撤钮(格()[3]));
  const 撤问 = 架.开[架.开.length - 1];
  判('按第 4 格的撤掉：先问一句「' + ((撤问 && 撤问.问) || '').slice(0, 26) + '…」', 架.开.length > 问先 && 撤问 && 撤问.title === '确认框' && /撤掉第 4 个/.test(撤问.问 || ''), 撤问 && 撤问.问);
  await 等(60);
  判('答「是」之后少一格（' + 格().length + ' 格），而且又回到 ' + MARK_MIN + ' 格那种「撤掉那颗不摆」的样子',
    格().length === 3 && 格().every(r => !撤钮(r)), 格().length + ' 格');

  /* 十三、色卡空着时那一句要说得下去（不是白屏也不是抛错），取色器和色号那两条照旧开着 */
  const 存 = CardPool.items.slice(); CardPool.items = [];
  const 话先二 = 架.话.length;
  await 按(挑钮(格()[0]));
  判('色卡空着按「色卡」：报的是「' + (架.话.slice(-1)[0] || '') + '」，没有开出空窗口（弹窗数 ' + 架.开.length + ' 没涨）',
    架.话.length > 话先二 && /色卡上还一个色也没有/.test(架.话.slice(-1)[0] || '') && /取色器、色号那一格/.test(架.话.slice(-1)[0] || ''), 架.话.slice(-1)[0]);
  CardPool.items = 存;

  /* 十三·补 —— 屏幕上这一串先加到 5 个：板子里真用着 5 个编号，凑不到 5 个就撞不出「不够」那一句 */
  await 按([...qs('#标 .fd-row button')].find(b => b.textContent === '加一个'));
  await 按([...qs('#标 .fd-row button')].find(b => b.textContent === '加一个'));
  判('再按两回「加一个」：屏幕上这一串凑到 ' + Marks.count() + ' 个（' + Marks.hexes().join(' ') + '），那一排跟着摆 ' + 格().length + ' 格',
    Marks.count() === 5 && 格().length === 5 && new Set(Marks.hexes()).size === 5, Marks.count() + ' 个');

  /* 十四、换方案那四选一（真 marksGuard → 真 DOM 上逐颗按） */
  const 用先 = await marksInUse();
  记('板子里真用着几个标记色', 用先);
  let 走了 = 0, 退过 = 0;
  const 乙一 = () => LookLib.list[1].标记色.slice();
  await marksGuard('乙', () => { 走了++; }, () => { 退过++; });
  const 问 = 架.开[架.开.length - 1];
  const 钮们 = 问 && 问.壳 ? [...问.壳.querySelectorAll('.fd-row button')] : [];
  判('用着 ' + 用先 + ' 个、乙只有 3 个 → 开口问。题目「' + (问 ? 问.title : '没开') + '」，四颗按钮照作者写的次序：' +
    钮们.map(b => b.textContent).join(' ｜ '),
    用先 === 5 && 问 && 问.title === '标记色不够' && 钮们.length === 4 &&
    钮们[0].textContent === '继续启用（接受同色）' && 钮们[1].textContent === '添加颜色（补足数量）' &&
    钮们[2].textContent === '替换当前标记色' && 钮们[3].textContent === '取消切换', 钮们.map(b => b.textContent).join(','));
  判('第三颗（替换）永远按得动（disabled = ' + 钮们[2].disabled + '），title 写的是「' + 钮们[2].title + '」',
    !钮们[2].disabled && /屏幕上这一串（5 个）/.test(钮们[2].title), 钮们[2].title);
  /* 十四·乙 —— 取消切换：一个字不动，退回去 */
  await 按(钮们[3]);
  判('按「取消切换」：不切（走过 ' + 走了 + ' 趟、退过 ' + 退过 + ' 趟），乙那一栏还是 ' + 乙一().length + ' 个，报的是「' + (架.话.slice(-1)[0] || '') + '」',
    走了 === 0 && 退过 === 1 && 乙一().length === 3 && /没切过去，还是「甲」/.test(架.话.slice(-1)[0] || ''), 架.话.slice(-1)[0]);
  /* 十四·丙 —— 继续启用：直接切，乙那一栏不被偷偷补 */
  await marksGuard('乙', () => { 走了++; }, () => { 退过++; });
  await 按([...架.体.querySelectorAll('.fd-row button')][0]);
  判('按「继续启用（接受同色）」：切了一趟（走过 ' + 走了 + '），乙那一栏一个字没改（' + 乙一().join(' ') + '）',
    走了 === 1 && 乙一().join(',') === '#111111,#222222,#333333', 乙一().join(' '));
  /* 十四·丁 —— 替换当前标记色：把屏幕上这一串整个钉进乙 */
  await marksGuard('乙', () => { 走了++; }, () => { 退过++; });
  await 按([...架.体.querySelectorAll('.fd-row button')][2]);
  判('按「替换当前标记色」：屏幕上那一串 ' + Marks.count() + ' 个整个钉进乙（' + 乙一().join(' ') + '），方案文件写盘 ' + LookLib.存盘 + ' 回',
    乙一().join(',') === Marks.hexes().join(',') && LookLib.存盘 >= 1 && 走了 === 2, 乙一().join(' ') + ' / 存盘 ' + LookLib.存盘);
  /* 十四·戊 —— 添加颜色：添够才让切，不够就 refuse */
  LookLib.list[1].标记色 = ['#111111', '#222222', '#333333'];
  await marksGuard('乙', () => { 走了++; }, () => { 退过++; });
  await 按([...架.体.querySelectorAll('.fd-row button')][1]);
  const 添屏 = 架.体;
  const 添格 = () => [...添屏.querySelectorAll('.fd-marks > div')];
  const 添头 = () => 添屏.querySelector('.fd-marks').previousElementSibling.textContent;
  判('按「添加颜色」开的是「给这一套添够标记色」，第一行「' + 添头() + '」，' + 添格().length + ' 格各带取色器 + 色号 + 色卡',
    /给这一套添够标记色/.test((添屏.querySelector('b') || {}).textContent || '') && /已有 3 个/.test(添头()) && /还差 2 个/.test(添头()) && 添格().length === 3, 添头());
  const 话先三 = 架.话.length;
  await 按([...添屏.querySelectorAll('.fd-row button')].find(b => b.textContent === '添够了，切过去'));
  判('还不够就按「添够了，切过去」：不切（走过还是 ' + 走了 + '），报的是「' + (架.话.slice(-1)[0] || '') + '」',
    架.话.length > 话先三 && /还差 2 个/.test(架.话.slice(-1)[0] || '') && 走了 === 2 && 乙一().length === 3, 架.话.slice(-1)[0]);
  const 起点 = [...添屏.querySelectorAll('.fd-row button')].find(b => b.textContent === '加一个起点色');
  await 按(起点); await 按([...添屏.querySelectorAll('.fd-row button')].find(b => b.textContent === '加一个起点色'));
  判('按两回「加一个起点色」：「' + 添头() + '」，六格里的色互不相同（' + 添格().map(r => r.querySelector('input[type=color]').value).join(' ') + '）',
    /已有 5 个 · 够了/.test(添头()) && 添格().length === 5 && new Set(添格().map(r => r.querySelector('input[type=color]').value)).size === 5, 添头());
  await 按([...添屏.querySelectorAll('.fd-row button')].find(b => b.textContent === '添够了，切过去'));
  判('添够之后按「切过去」：五个钉进乙那一套（' + 乙一().join(' ') + '，互不相同 ' + new Set(乙一()).size + ' 个）并切了（走过 ' + 走了 + '）',
    乙一().length === 5 && new Set(乙一()).size === 5 && 走了 === 3, 乙一().join(' '));

  判('这一整趟按下来一条未捕获异常也没有（' + R.错.length + ' 条）', R.错.length === 0, R.错.join(' | '));
  收尾();
})().catch(e => { 判('驱动自己断了（这一趟没跑完，不算测过）', false, (e && e.message) || String(e)); 收尾(); });
`;

const HTML = `<!doctype html>
<html lang="zh-Hans"><head><meta charset="utf-8"><title>丁组 · 方案资源那一屏（真点一遍）</title>
<style>
${CSS}
html,body{margin:0;padding:0;background:var(--page-bg,#f4f4f2);color:var(--text,#222);font:14px/1.5 system-ui,"Segoe UI",sans-serif}
.wrap{display:grid;gap:16px;padding:16px;max-width:1080px}
.sect{border-top:var(--hair,#ddd);padding-top:10px}
pre{white-space:pre-wrap;background:var(--card-bg,#fff);padding:10px;border:var(--bw,1px) solid var(--card-border,#ddd);border-radius:6px}
h2{font-size:15px;margin:0 0 6px}
</style></head>
<body>
<div class="wrap">
  <h2>外29 丁组 · 第 4 页「方案资源」里的图片三块 + 标记色那一排（三条路）+ 换方案那四选一 —— 这一页把每一步真按一遍</h2>
  <div id="状态" class="fd-hint">还在跑…</div>
  <div class="sect"><h2>① 图片那一块（三颗导入 + 已收的那几张）</h2><div id="图"></div></div>
  <div class="sect"><h2>② 标记色那一排（取色片 / 色号那一格 / 「色卡」那一枚 三条路）</h2><div id="标"></div></div>
  <div class="sect"><h2>③ 断言逐条（PASS / FAIL）</h2><pre id="结果">…</pre></div>
  <div class="sect"><h2>④ 现场数到的那些数</h2><pre id="数">…</pre></div>
</div>
<script>
${STUB}
${合}
${DRIVE}
</script>
</body></html>
`;

const 产物 = path.join(__HERE, 'mk-look4-test.html');
/* 写出去之前先过一道语法闸：这一段是拼出来的（真源码 + 假货 + 驱动），
   同名 const 撞一次就整页不跑 —— 浏览器那边只留一条红字，不如这里当场说清是哪一行 */
try{ new vm.Script(STUB + '\n' + 合 + '\n' + DRIVE, { filename:'mk-look4-内联脚本' }); }
catch(e){
  const 行 = String(e.stack || '').split('\n').find(l => /mk-look4-内联脚本:\d+/.test(l)) || '';
  throw new Error('拼出来的脚本语法不过：' + e.message + ' @ ' + 行.trim());
}
fs.writeFileSync(产物, HTML, 'utf8');
console.log('WROTE ' + 产物 + '  ' + Buffer.byteLength(HTML) + ' 字节  ' + HTML.split('\n').length + ' 行');
console.log('剔掉的 CSS 行数：' + 剔.length + ' —— 只剔嵌了 ${} 的那几行（模板里那几行是生成脚本要往里灌源码的口子）');
console.log(剔.map(x => '  · ' + x.slice(0, 72)).join('\n'));
console.log('切进来的真身块数：' + PIECES.length);
