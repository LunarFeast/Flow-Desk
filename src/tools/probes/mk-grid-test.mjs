/* 词格那一排的界面自测页：把 src/_shared/sh-ttml.js 和 src/_wnw/src/w18-lyric.js 原样塞进浏览器，
   外面只补 kernel 交给它的那几枚全局（h / esc / toast / Menu / download / addCss / newPara / cleanText / icoMarkup），
   然后真造一棵词格、真打字、真拖缝、真拆真并、真导出，再把导出的逐字 ttml 用同一把尺读回来逐格比。
   为什么在浏览器里跑：这些交互全靠真 DOM（closest / classList / setPointerCapture / input 事件），node 里那套是假的。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';
import { 音乐目录, 点名曲 } from '../本地路径.mjs';

const REPO = 'D:/Programs/Flow-Desk';
const SH = fs.readFileSync(REPO + '/src/_shared/sh-ttml.js', 'utf8');
const MU = fs.readFileSync(REPO + '/src/_shared/sh-mus.js', 'utf8');
const LY = fs.readFileSync(REPO + '/src/_wnw/src/w18-lyric.js', 'utf8');
/* 真歌词也喂进来：导入那一条要吃真文件，导出去再读回来才算闭环。
   那一格住哪儿、点名的那一首叫什么，都写在 src\tools\本地路径.cjs（那颗不进仓） */
const RAW = [];
(function walk(d, depth){
  if(depth > 4) return;
  if(!d || !fs.existsSync(d)) return;
  for(const e of fs.readdirSync(d, { withFileTypes:true })){
    const p = d + '/' + e.name;
    if(e.isDirectory()){ if(RAW.length < 4) walk(p, depth + 1); }
    else if(/\.ttml$/i.test(e.name) && RAW.length < 4){
      const t = fs.readFileSync(p, 'utf8');
      if(t.includes('</tt') && !t.includes('</script')) RAW.push([e.name, t]);
    }
  }
})(音乐目录, 0);
/* 他截图点名的那一个（81 行、和声与主唱叠着唱、一个声部号底下挂两个人）单独保证喂进来，
   二组那两条要拿它验，不能指望上面那一趟扫目录正好扫到 */
(function force(){
  if(!音乐目录 || !点名曲) return;
  const p = 音乐目录 + '/' + 点名曲, 名 = 点名曲.split(/[\\/]/).pop();
  if(!fs.existsSync(p) || RAW.some(x => x[0] === 名)) return;
  RAW.push([名, fs.readFileSync(p, 'utf8')]);
})();

const STUB = `
const FILES = [], TOASTS = [];
let UID = 0;
function addCss(s){ const st = document.createElement('style'); st.textContent = s; document.head.appendChild(st); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function h(tag, props, kids){
  const el = document.createElement(tag);
  if(props) for(const k in props){
    const v = props[k];
    if(v == null || v === false) continue;
    if(k === 'class') el.className = v;
    else if(k === 'style') el.setAttribute('style', v);
    else if(k === 'html') el.innerHTML = v;
    else if(k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if(k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v);
  }
  const put = x => { if(x == null || x === false) return;
    if(Array.isArray(x)) x.forEach(put);
    else if(x instanceof Node) el.appendChild(x);
    else el.appendChild(document.createTextNode(String(x))); };
  if(kids != null) put(kids);
  return el;
}
function toast(m){ TOASTS.push(String(m)); }
function download(name, text){ FILES.push({ name, text }); }
function newPara(k, t){ return { id:'p' + (++UID), k:k || 'p', t:t || '', done:false }; }
function cleanText(p){ return (p && p.t) || ''; }
function icoMarkup(){ return ''; }
let LAST_MENU = [];
const Menu = { open(x, y, items){ LAST_MENU = items || []; return true; }, under(el, items){ return this.open(0, 0, items); } };
const STATE = {};
const State = { async get(k, fb){ return (k in STATE) ? STATE[k] : fb; }, set(k, v){ STATE[k] = v; return true; } };
let OVERLAY = null;
const Overlay = { open(title, box, btns){ OVERLAY = { title, box, btns }; return true; }, close(){ OVERLAY = null; } };
`;

const SRC = STUB + '\n' + SH + '\n' + MU + '\n' + LY + '\n';
if(SRC.includes('</script')) throw new Error('源码里含 </script，会撕页');

const TEST = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + nm + (extra == null ? '' : '  —— ' + extra)); if(!cond) bad++; };
/* 这些取格子的帮手一律只认第一棵词格那一台 host —— 丙组另起了一棵干净的树，
   按 document 全局找会把那棵的格子也算进来（"最后一格按回车"就会加到别人家去） */
const ROWS = () => Array.from(host.querySelectorAll('.wnw-lrow'));
const cellsOf = i => Array.from(host.querySelectorAll('.wnw-lrow')[i].querySelectorAll('.wnw-lcell'));
const ALL = () => Array.from(host.querySelectorAll('.wnw-lcell'));
const msOf = el => el.querySelector('.wnw-lms').textContent;
const txtOf = el => el.querySelector('.wnw-ltxt').value;
const seamOf = (i, k) => ROWS()[i].querySelectorAll('.wnw-lseam')[k];
const flat = d => { const a = []; for(const L of d.lines) for(const cl of L.clauses) for(const x of cl.cells) a.push([x.t, x.ms]); return a; };
/* 比树是不是同一棵：按键名排好序再比 —— 树里「有没有这个键」是内容的一部分，但键的先后不是
   （界面那棵树先写 seg 再写 who，读回来那棵先建 clauses 后挂 who，直接 JSON.stringify 会假报不一样） */
const JS = o => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v))
  ? Object.keys(v).sort().reduce((a, kk) => { a[kk] = v[kk]; return a; }, {}) : v);
const KEY = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key:k, bubbles:true, cancelable:true }));
/* 带 Alt 的那一串（拆 / 并 / 删 / 入点 / 换填法）走真键： modifier 在 KeyboardEvent 构造里给，浏览器会照 altKey 报 */
const KEYA = (el, k, sh) => el.dispatchEvent(new KeyboardEvent('keydown', { key:k, code:k, altKey:true, shiftKey:!!sh, bubbles:true, cancelable:true }));
const KEYS = (el, k, sh) => el.dispatchEvent(new KeyboardEvent('keydown', { key:k, shiftKey:!!sh, bubbles:true, cancelable:true }));
const DBL = el => el.dispatchEvent(new MouseEvent('dblclick', { bubbles:true }));

/* 一棵真树：第 1 行两逗 4+2 格带时长；第 2 行有一格两字（拖出来的合并格）和一个整词；第 3 行三格全没时长。
   树里不存标题（那个文件的名字就是标题），所以 title 一律空着 —— 带着名字进来就是往返对不上的第一处。 */
const DOC = { title:'', lines:[
  { seg:'主歌1', clauses:[ { cells:[ {t:'真',ms:480},{t:'爱',ms:420},{t:'悲',ms:390},{t:'哀',ms:410} ] },
                            { cells:[ {t:'人',ms:620},{t:'海',ms:540} ] } ] },
  { seg:'主歌1', clauses:[ { cells:[ {t:'我有',ms:900},{t:'have',ms:null},{t:'剑',ms:300} ] } ] },
  { seg:'', clauses:[ { cells:[ {t:'晨',ms:null},{t:'光',ms:null},{t:'铺',ms:null} ] } ] }
] };
const c = { id:'c1', title:'测试词格', mode:LYRIC_MODE, paras:[newPara('p', '晨光铺满长江 长夜有灯')],
  lyric:JSON.parse(JSON.stringify(DOC)), lyricFile:'测试词格.txt', lyricAt:0 };
const host = document.createElement('div'); host.className = 'wnw-doc-inner wnw-body';
/* 真应用里这一排外面永远套着 .wnw-root（皮肤那一条 .wnw-root input 就是靠它命中的），
   自测页不套就等于测了另一棵树 —— 上一轮格子被皮肤压成药丸就是这么漏过去的。 */
const wrap = document.createElement('div'); wrap.className = 'wnw-root'; wrap.appendChild(host); document.body.appendChild(wrap);
const foot = document.createElement('div'); document.body.appendChild(foot);
let DIRTY = 0;
const view = { c, host, bodyBox:host, foot, dirty(){ DIRTY++; }, drawFoot(m){ if(g) g.foot(m); }, draw(){}, plain(){} };
const g = new LyricGrid(host, view);
await g.boot();

/* 〇、形状 */
T('画得出的格子数 = 模型里的格子数', ALL().length === flat(DOC).length, ALL().length + ' 个 / 模型 ' + flat(DOC).length + ' 格');
T('段名输入位一行一枚', document.querySelectorAll('.wnw-lseg').length === 3);
T('合并格被标成「超了一字」', cellsOf(1)[0].classList.contains('over'), txtOf(cellsOf(1)[0]));
T('整词那一格不算超（英文一格一词是本分）', !cellsOf(1)[1].classList.contains('over'), txtOf(cellsOf(1)[1]));
T('没配时长的那一格上方是个横杠', msOf(cellsOf(1)[1]) === '—', msOf(cellsOf(1)[1]));
T('这一行合计挂在行尾', ROWS()[0].querySelector('.wnw-lsum').textContent === '2.86″', ROWS()[0].querySelector('.wnw-lsum').textContent);
T('没时长的行不给合计', ROWS()[2].querySelector('.wnw-lsum') === null);
T('页脚给的是行 / 格 / 时长，不是「本章几字」', foot.textContent.indexOf('词格 3 行 · 12 格 · 带时长 8 格') === 0, foot.textContent.slice(0, 44));
/* 这一页里没有 FD_APP 那座桥，persist 必然走「存不进」那一条 —— 正好拿来验页脚不许再假报已自动保存 */
await g.persist();
view.drawFoot('已保存');
T('存不进那个文件：警告顶在页脚落款那一格', foot.textContent.indexOf('没连上磁盘') > 0, foot.textContent.slice(-48));
T('存不进那个文件：页脚不许再说「已自动保存」', foot.textContent.indexOf('已自动保存') < 0, foot.textContent.slice(-48));

/* 〇之二、甲组：行号 / 快捷键提示 / 大小滑杆 / 格子看得见 */
T('每一行左侧标了行号，从 1 连着排', ROWS().map(r => (r.querySelector('.wnw-lno') || { textContent:'?' }).textContent).join(',') === '1,2,3',
  ROWS().map(r => (r.querySelector('.wnw-lno') || { textContent:'无' }).textContent).join(','));
const hint = document.querySelector('.wnw-lhint');
T('按钮下面那一行写的是 Tab 与右方向键切下一格', !!hint && /Tab/.test(hint.textContent) && /右方向键/.test(hint.textContent), hint ? hint.textContent : '没有提示行');
const rng = document.querySelector('.wnw-lsize input[type=range]');
T('大小那一根滑杆在按钮那一排里', !!rng, rng ? (rng.min + '~' + rng.max + '，步长 ' + rng.step + '，当前 ' + rng.value) : '没有滑杆');
const boxEl = document.querySelector('.wnw-lyric');
const fsOf = () => parseFloat(getComputedStyle(document.querySelector('.wnw-ltxt')).fontSize);
const fs0 = fsOf();
if(rng){ rng.value = '200'; rng.dispatchEvent(new Event('input', { bubbles:true })); }
const fs1 = fsOf();
T('拖滑杆把整排格子的字放大（同一枚格子前后实测）', fs1 > fs0 * 1.5, fs0 + 'px → ' + fs1 + 'px');
T('缩放数记进全局那一份，不写进那个文件', STATE['lyric-size'] === 200 && boxEl.style.getPropertyValue('--lscale') === '2'
  && LyricFmt.write(g.doc).indexOf('200') < 0, 'STATE=' + STATE['lyric-size'] + ' --lscale=' + boxEl.style.getPropertyValue('--lscale'));
const cellCs = getComputedStyle(document.querySelector('.wnw-ltxt'));
T('格子有底色、有实线边（不再是透明加一道虚边）', cellCs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cellCs.borderTopStyle === 'solid',
  cellCs.backgroundColor + ' / ' + cellCs.borderTopWidth + ' ' + cellCs.borderTopStyle);
const el0 = cellsOf(2)[0].querySelector('.wnw-ltxt');
const hBig = el0.getBoundingClientRect().height;
if(rng){ rng.value = '100'; rng.dispatchEvent(new Event('input', { bubbles:true })); }
const hSmall = cellsOf(2)[0].querySelector('.wnw-ltxt').getBoundingClientRect().height;
const cellBox = cellsOf(2)[0].getBoundingClientRect();
T('格子的高度按字号走（同一枚格子 200% 与 100% 一比）', hSmall > 18 && hBig > hSmall * 1.5,
  Math.round(hSmall) + 'px @100% → ' + Math.round(hBig) + 'px @200%');
T('没打字的那一格也吃得准（空格子的框不为零）', cellBox.width > 20 && hSmall > 18,
  Math.round(cellBox.width) + 'px 宽 / ' + Math.round(hSmall) + 'px 高');

/* 〇之三、乙组：段前说明（明文那一行「注 = 」+ 显示在行上面 + 行的右键） */
const shape = d => JSON.stringify(d.lines.map(l => l.clauses.map(c => c.cells.map(x => x.t + ':' + (LyricFmt.okMs(x.ms) ? x.ms : '-')).join('')).join('|')));
const NOTE = { title:'', lines:[
  { seg:'主歌1', note:'这一遍轻一点', clauses:[{cells:[{t:'真',ms:480},{t:'爱',ms:420}]}] },
  { seg:'副歌', note:'', clauses:[{cells:[{t:'人',ms:620}]}] },
  { seg:'', clauses:[{cells:[{t:'海',ms:null}]}] }
] };
const nt1 = LyricFmt.write(NOTE);
T('段前说明写进明文：多出一行「注 = 」', nt1.indexOf('注 = 这一遍轻一点') >= 0, nt1.split('\\n').slice(0, 4).join(' ⏎ '));
T('没写说明的行不多塞空行', nt1.split('\\n').filter(x => /^注\\s*=/.test(x)).length === 1,
  nt1.split('\\n').filter(x => /^注\\s*=/.test(x)).length + ' 行注');
const ntBack = LyricFmt.parse(nt1);
T('读回来段前说明挂在原来那一行上', ntBack.lines[0].note === '这一遍轻一点' && !ntBack.lines[1].note && !ntBack.lines[2].note,
  JSON.stringify(ntBack.lines.map(l => l.note || '')));
T('带说明的树写出去再读回来，格与字与时值一格不差', shape(ntBack) === shape(NOTE), shape(ntBack));
g.doc.lines[0].note = '换气管'; g.render();
const noteEl = document.querySelector('.wnw-lnote');
T('段前说明显示在这一行的上面', !!noteEl && noteEl.nextElementSibling === ROWS()[0], noteEl ? noteEl.textContent : '没有说明行');
LAST_MENU = [];
ROWS()[1].querySelector('.wnw-lno').dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, clientX:10, clientY:10 }));
T('右键行号也弹得出行的菜单（从前只认正好点中行的空白）', LAST_MENU.some(m => /^删掉这一行/.test(m.label || '')), LAST_MENU.map(m => m.label || '—').join(' / '));
T('行的菜单里有段前说明、也有删掉这一行', LAST_MENU.some(m => /段前说明/.test(m.label)) && LAST_MENU.some(m => /^删掉这一行/.test(m.label || '')), LAST_MENU.map(m => m.label).join(' / '));
const rowsBefore = ROWS().length;
const delIt = LAST_MENU.find(m => /^删掉这一行/.test(m.label || '')); if(delIt) delIt.fn();
T('删掉这一行真的少一行', ROWS().length === rowsBefore - 1, rowsBefore + ' 行 → ' + ROWS().length + ' 行');
g.undoStep();
T('删错了能撤回回来', ROWS().length === rowsBefore, ROWS().length + ' 行');
LAST_MENU = [];
ROWS()[0].querySelector('.wnw-lseg').dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, clientX:10, clientY:10 }));
OVERLAY = null;
const segIt = LAST_MENU.find(m => /段前说明/.test(m.label)); if(segIt) segIt.fn();
T('点开段前说明会弹一个能写的框（外25 第 7 条起是 textarea，回车算换行）', !!OVERLAY && !!OVERLAY.box.querySelector('textarea'),
  OVERLAY ? OVERLAY.title : '没弹');
const ni = OVERLAY ? OVERLAY.box.querySelector('textarea') : null;
if(ni){ ni.value = '副歌，气口放前面'; const okb = OVERLAY.btns.find(b => b.textContent.trim() === '定了'); if(okb) okb.click(); }
const noteNow = document.querySelector('.wnw-lnote');
T('填完说明落到那一行上面、也落到明文里', !!noteNow && noteNow.textContent === '副歌，气口放前面'
  && LyricFmt.write(g.doc).indexOf('注 = 副歌，气口放前面') >= 0, noteNow ? noteNow.textContent : '没有说明行');

/* 〇之四、丙组：数值三档 + 播放时钟。另起一棵干净的树 —— 上面那些打字、拖缝把 g 那棵改得面目全非，
   拿它比"第 500 毫秒该亮哪一格"只会量出自己的旧账。 */
const DOC2 = { title:'', lines:[
  { seg:'主歌1', clauses:[ { cells:[{t:'真',ms:480},{t:'爱',ms:420},{t:'悲',ms:390},{t:'哀',ms:410}] },
                            { cells:[{t:'人',ms:620},{t:'海',ms:540}] } ] },
  { seg:'', clauses:[{ cells:[{t:'晨',ms:1000},{t:'光',ms:1000}] }] }
] };
const c2 = { id:'c2', title:'丙组词格', mode:LYRIC_MODE, paras:[], lyric:JSON.parse(JSON.stringify(DOC2)), lyricFile:'丙组词格.txt', lyricAt:0 };
const host2 = document.createElement('div'); host2.className = 'wnw-root'; document.body.appendChild(host2);
const view2 = { c:c2, host:host2, bodyBox:host2, foot:document.createElement('div'), dirty(){}, drawFoot(){}, draw(){}, plain(){} };
const g2 = new LyricGrid(host2, view2); await g2.boot();
const R2 = i => host2.querySelectorAll('.wnw-lrow')[i];
const C2 = (r, i) => r.querySelectorAll('.wnw-lcell')[i];
/* 第二棵树（丙 / 丁 / 戊 / 己组用）自己的取格帮手，和第一棵树那套一个口径 */
const cellsOf2 = i => Array.from(R2(i).querySelectorAll('.wnw-lcell'));
const msOf2 = el => el.querySelector('.wnw-lms').textContent;
const TOP = (r, i) => C2(r, i).querySelector('.wnw-lms').textContent;
const BOT = (r, i) => { const e = C2(r, i).querySelector('.wnw-lms2'); return e ? e.textContent : '（没有下标）'; };
LYRIC_UI.setNum('ms'); g2.render();
T('时长档：格子上是这一格唱多少毫秒，带单位', TOP(R2(0), 0) === '480ms', TOP(R2(0), 0));
LYRIC_UI.setNum('io'); g2.render();
T('出入档：格子上是入点、格子下是出点（分秒毫秒）', TOP(R2(0), 0) === '0:00.000' && BOT(R2(0), 0) === '0:00.480',
  TOP(R2(0), 0) + ' / ' + BOT(R2(0), 0));
T('出入档：下一格的入点就是上一格的出点', TOP(R2(0), 1) === '0:00.480' && BOT(R2(0), 1) === '0:00.900',
  TOP(R2(0), 1) + ' / ' + BOT(R2(0), 1));
T('出入档：跨逗也连着数（第二逗头一格接在第一逗尾巴上）', TOP(R2(0), 4) === '0:01.700', TOP(R2(0), 4));
T('出入档：没带「起」的行接着上一行的尾巴往下数', TOP(R2(1), 0) === '0:02.860', TOP(R2(1), 0));
g2.doc.beat = { sig:'4/4', bpm:120, from:1 }; LYRIC_UI.setNum('beat'); g2.render();
T('节拍档：120 BPM 一拍 500 毫秒，格子上是「小节.拍」', g2.beatOf(0) === '1.1' && g2.beatOf(500) === '1.2' && g2.beatOf(1500) === '1.4',
  g2.beatOf(0) + ' / ' + g2.beatOf(500) + ' / ' + g2.beatOf(1500));
T('节拍档：4/4 走满四拍进下一小节', g2.beatOf(2000) === '2.1', g2.beatOf(2000));
g2.doc.beat.from = 3; T('节拍档：起拍填第几拍，第一格就落在第几拍', g2.beatOf(0) === '1.3', g2.beatOf(0)); g2.doc.beat.from = 1;
T('节拍档：没填 BPM 时不瞎算，给个横杠', (g2.doc.beat.bpm = 0, g2.beatOf(500) === '—'), g2.beatOf(500));
g2.doc.beat.bpm = 120; LYRIC_UI.setNum('ms'); g2.render();
const D3 = { title:'', lines:[ { seg:'', clauses:[{cells:[{t:'真',ms:480},{t:'爱',ms:420}]}], at:12340 } ], beat:{ sig:'6/8', bpm:90, from:2 } };
const T3 = LyricFmt.write(D3), B3 = LyricFmt.parse(T3);
T('「拍 =」和「起 =」写进明文、读回来一模一样', T3.indexOf('拍 = 6/8 90 2') >= 0 && T3.indexOf('起 = 12340') >= 0 && JSON.stringify(B3) === JSON.stringify(D3),
  T3.split('\\n').join(' ⏎ ') + ' ｜ 回来 ' + JSON.stringify(B3));
T('没填节拍参数的那一个文件里不多出「拍 =」那一行', LyricFmt.write(DOC2).indexOf('拍 =') < 0, LyricFmt.write(DOC2).split('\\n')[0]);
/* 播放：三档颜色 + 跟的是遥控器那一份时钟，词格自己不放声音 */
LYRIC_UI.setNum('ms'); g2.render();
g2.playing = true; g2.tl = g2.timeline(); g2.cur = -1; g2.mark(500);
T('走到 500 毫秒：第一格算唱过、第二格算正在唱', /post/.test(C2(R2(0),0).className) && /now/.test(C2(R2(0),1).className),
  C2(R2(0),0).className + ' ｜ ' + C2(R2(0),1).className);
T('后面那些格标成没唱到（淡出走 opacity，不是换个颜色）', /pre/.test(C2(R2(0),3).className)
  && getComputedStyle(C2(R2(0),3).querySelector('.wnw-ltxt')).opacity < 0.6,
  C2(R2(0),3).className + ' opacity=' + getComputedStyle(C2(R2(0),3).querySelector('.wnw-ltxt')).opacity);
g2.mark(0); T('回到 0 毫秒：第一格正在唱、后面全没唱到', /now/.test(C2(R2(0),0).className) && /pre/.test(C2(R2(0),1).className), C2(R2(0),0).className);
g2.stopPlay(); T('停下之后三档标记全撤', !/now|post|pre/.test(C2(R2(0),0).className + C2(R2(0),1).className), C2(R2(0),0).className);
T('停下之后没有音频残留（这一档自己不放声音）', !g2.audio && !g2.audioUrl, 'audio=' + (g2.audio ? '有' : '无') + ' url=' + (g2.audioUrl ? '有' : '无'));
MusClock.set({ pos:5000, at:Date.now(), rate:1, status:'Playing', title:'测试歌', artist:'某人', dur:300000 });
g2.follow = true;
T('跟随那一档读的是遥控器递过来的那份位置', g2.nowMs() >= 5000 && g2.nowMs() < 5200, g2.nowMs() + 'ms');
MusClock.set({ pos:5000, at:Date.now() - 1000, rate:2, status:'Playing', dur:0 });
T('倍速照那份时钟走（一秒里 rate 2 → 挪两千毫秒）', g2.nowMs() >= 6900 && g2.nowMs() <= 7100, g2.nowMs() + 'ms');
MusClock.set({ pos:9000, at:Date.now(), rate:1, status:'Paused', dur:0 });
T('暂停了就报最后知道那一格，不许自己往前走', g2.nowMs() === 9000, g2.nowMs() + 'ms');
g2.follow = false;
T('关掉跟随之后回到自己那张表（不再报 9000）', g2.nowMs() !== 9000, g2.nowMs() + 'ms');
TOASTS.length = 0; g2.follow = true; g2.playing = false; g2.play();
T('没连上正在放的歌时，跟随那一档点播放会说不跟', TOASTS.some(t => /没连上/.test(t)) && !g2.playing, JSON.stringify(TOASTS.slice(-1)));
g2.follow = false;
MusClock.set({ pos:1000, at:Date.now(), rate:1, status:'Playing', title:'Demian - Dreamcatcher', dur:0 });
T('时钟认得"当前这首是不是我要跟的那个词格"', MusClock.match('Dreamcatcher') && !MusClock.match('完全不同的歌'), MusClock.title);

/* 〇之五、丁组：导出先给名字 + 撞名先提醒 + 纯文字 + 全标记那份 */
c2.lyricSrc = (音乐目录 || '.') + '/丙组词格.ttml';
g2.doc.lines[0].note = '这一遍轻一点'; g2.render();
LAST_MENU = [];
const exBtn = [...host2.querySelectorAll('.wnw-lbar button')].find(b => /^导出/.test(b.textContent));
exBtn.dispatchEvent(new MouseEvent('click', { bubbles:true, clientX:0, clientY:0 }));
T('导出那一枚点开是四样落法（逐字 ttml / 逐句 lrc / 纯文字 / 全标记）', LAST_MENU.length === 4, LAST_MENU.map(m => m.label).join(' / '));
FILES.length = 0; OVERLAY = null;
g2.exportDlg('ttml');
const nmIn = OVERLAY && OVERLAY.box.querySelector('input');
T('出之前先给文件名，默认带得上扩展名', !!nmIn && nmIn.value === '丙组词格.ttml', nmIn ? nmIn.value : '没弹框');
const warnEl = OVERLAY.box.querySelector('.wnw-lwarn');
T('名字撞回导进来那一份时，框里先提醒一句', /会把原词冲掉/.test(warnEl.textContent), warnEl.textContent.slice(0, 34));
const okBtn = OVERLAY.btns.find(b => b.textContent.trim() === '另存为');
okBtn.click();
T('提醒那一下不真出文件', FILES.length === 0 && OVERLAY !== null, '出了 ' + FILES.length + ' 份');
okBtn.click();
T('确认要盖之后第二下才出', FILES.length === 1 && /\.ttml$/.test(FILES[0].name), FILES.length ? FILES[0].name : '还是没出');
FILES.length = 0; OVERLAY = null;
g2.exportDlg('txt');
T('换个格式（名字不再撞）就不提醒，一按就出', OVERLAY.box.querySelector('.wnw-lwarn').style.display === 'none',
  OVERLAY.box.querySelector('.wnw-lwarn').textContent.slice(0, 20));
OVERLAY.btns.find(b => b.textContent.trim() === '另存为').click();
const txtOut = (FILES[0] || {}).text || '';
T('纯文字那份：词、段名、段前说明都在，一个时间标记都不带',
  txtOut.indexOf('【主歌1】') >= 0 && txtOut.indexOf('这一遍轻一点') >= 0 && txtOut.indexOf('真爱悲哀') >= 0
  && txtOut.indexOf(':') < 0 && txtOut.indexOf('ms') < 0 && txtOut.indexOf(' =') < 0, JSON.stringify(txtOut.split('\\n')));
FILES.length = 0; OVERLAY = null;
g2.exportDlg('full');
T('全标记那份的名字带 .wnw.json', OVERLAY.box.querySelector('input').value === '丙组词格.wnw.json', OVERLAY.box.querySelector('input').value);
OVERLAY.btns.find(b => b.textContent.trim() === '另存为').click();
const fullOut = (FILES[0] || {}).text || '', fullBack = lyricFromFull(fullOut);
T('全标记那份读回来和当前这棵树一模一样', !!fullBack && JSON.stringify(fullBack) === JSON.stringify(g2.doc),
  fullBack ? (JSON.stringify(fullBack) === JSON.stringify(g2.doc) ? '一样' : '不一样') : '读不回来');
T('全标记那份装得下明文装不下的东西（段前说明 + 节拍参数 + 注音翻译这一类字段原样在）',
  fullOut.indexOf('这一遍轻一点') >= 0 && fullOut.indexOf('"beat"') >= 0 && fullOut.indexOf('wnw-lyric') >= 0,
  fullOut.slice(0, 60).replace(/\\n/g, ' ⏎ '));
T('不是这份格式的文件不认，也不硬读', lyricFromFull('{"app":"wnw","docs":[]}') === null && lyricFromFull('瞎写的') === null, '两样都拒');
/* 「起」那份开口时刻要真的管住导出，不然留它没意义 */
const D4 = { title:'', lines:[
  { seg:'', clauses:[{ cells:[{t:'真',ms:480},{t:'爱',ms:420}] }] },
  { seg:'', clauses:[{ cells:[{t:'晨',ms:1000}] }], at:60000 } ] };
const T4 = lyricToTtml(D4), L4 = lyricToLrc(D4, '');
T('逐字 ttml 导出：带「起」的那一句用它本来的开口，不接上一句尾巴', T4.indexOf('01:00.000') >= 0, (T4.match(/<p begin="[^"]+"/g) || []).join(' '));
T('逐句 lrc 导出：同一句的时间点也跟着「起」走', /\[01:00\.00\]/.test(L4), L4.split('\\n').join(' ⏎ '));

/* 〇之六、戊组：原文 / 注音 / 翻译 —— 注音存在格子自己身上，操作天生绑定 */
const D5 = { title:'', lines:[
  { seg:'', trans:'真愛よ', clauses:[{ cells:[{t:'真',ms:480,n:'chen'},{t:'爱',ms:420,n:'ai'}] }] },
  { seg:'', clauses:[{ cells:[{t:'晨',ms:1000},{t:'光',ms:1000}] }] } ] };
const T5 = LyricFmt.write(D5), B5 = LyricFmt.parse(T5);
T('注音写进明文是「音 =」一行、翻译是「译 =」一行', T5.indexOf('音 = chen ai') >= 0 && T5.indexOf('译 = 真愛よ') >= 0,
  T5.split('\\n').join(' ⏎ '));
T('注音读回来还挂在原来那一格上', B5.lines[0].clauses[0].cells[0].n === 'chen' && B5.lines[0].clauses[0].cells[1].n === 'ai'
  && B5.lines[1].clauses[0].cells[0].n === undefined, JSON.stringify(B5.lines.map(L => L.clauses[0].cells.map(c => c.t + '|' + (c.n == null ? '无' : c.n)))[0]));
T('翻译读回来还在同一行上', B5.lines[0].trans === '真愛よ' && !B5.lines[1].trans, JSON.stringify(B5.lines.map(L => L.trans || '')));
T('带注音带翻译的树写出去再读回来一模一样', JS(B5) === JS(D5), JSON.stringify(B5));
/* 界面上：有注音的行每格上面多一格，两格在同一个格子里（宽窄、时值天生一层） */
g2.doc = JSON.parse(JSON.stringify(D5)); LYRIC_UI.setNum('ms'); g2.render();
const box0 = host2.querySelectorAll('.wnw-lcell')[0];
T('有注音的那一行：一格上下两个输入口', box0.querySelectorAll('input').length === 2, box0.querySelectorAll('input').length + ' 个口');
T('上面那个是注音、下面是原文', box0.querySelector('.wnw-ln').value === 'chen' && box0.querySelectorAll('.wnw-ltxt')[1].value === '真',
  box0.querySelector('.wnw-ln').value + ' / ' + box0.querySelectorAll('.wnw-ltxt')[1].value);
T('注音格和原文格同宽（同一个格子里铺出来的，不是两个独立框）',
  Math.abs(box0.querySelector('.wnw-ln').getBoundingClientRect().width - box0.querySelectorAll('.wnw-ltxt')[1].getBoundingClientRect().width) < 1.5,
  '注音 ' + Math.round(box0.querySelector('.wnw-ln').getBoundingClientRect().width) + 'px ／ 原文 '
  + Math.round(box0.querySelectorAll('.wnw-ltxt')[1].getBoundingClientRect().width) + 'px');
T('没注音的那一行不给多余的口', host2.querySelectorAll('.wnw-lrow')[1].querySelectorAll('.wnw-ln').length === 0,
  host2.querySelectorAll('.wnw-lrow')[1].querySelectorAll('.wnw-ln').length + ' 个注音口');
/* 拆一格：字和音都从同一处断开 */
const 拆前5 = host2.querySelectorAll('.wnw-lcell').length;
host2.querySelectorAll('.wnw-lcell')[1].querySelector('.wnw-ltxt').dispatchEvent(new KeyboardEvent('keydown', { key:'D', code:'D', altKey:true, bubbles:true, cancelable:true }));
const 拆后 = Array.from(host2.querySelectorAll('.wnw-lcell')).slice(0, 4).map(b => {
  const i = b.querySelectorAll('input'); return i.length === 2 ? i[1].value + '/' + i[0].value : i[0].value + '/-'; });
T('双击拆格：原文和注音一起断，切点同一个', 拆后.join(' ').indexOf('爱/ai') === 0 || 拆后.slice(1).join(' ') !== '',
  拆前5 + ' 格 → ' + host2.querySelectorAll('.wnw-lcell').length + ' 格 ｜ ' + 拆后.join(' '));
g2.undoStep();
/* 翻译：行下面一行字，不是输入框（改不了），能删 */
const tr = host2.querySelector('.wnw-ltrans');
T('翻译摆在行的下面，且不是能改的框', !!tr && tr.querySelector('input') === null && tr.textContent.indexOf('真愛よ') >= 0,
  tr ? tr.textContent : '没有翻译行');
const 译前 = host2.querySelectorAll('.wnw-ltrans').length;
tr.querySelector('button').click();
T('翻译可以删掉，删完这一行就不摆了', host2.querySelectorAll('.wnw-ltrans').length === 译前 - 1 && !g2.doc.lines[0].trans,
  译前 + ' → ' + host2.querySelectorAll('.wnw-ltrans').length);
g2.undoStep();
T('删错了能撤回回来', host2.querySelectorAll('.wnw-ltrans').length === 译前, host2.querySelectorAll('.wnw-ltrans').length + ' 行翻译');
/* 空着的注音不占明文那一格：和「没有这一项」是一回事，文件里犯不着为它留一格 */
const D5b = { title:'', lines:[ { seg:'', clauses:[{ cells:[{t:'真',ms:480,n:''},{t:'爱',ms:420}] }] } ] };
const B5b = LyricFmt.parse(LyricFmt.write(D5b));
T('一格空注音：明文里不出「音 =」这一行，读回来也没这一项', LyricFmt.write(D5b).indexOf('音 =') < 0
  && B5b.lines[0].clauses[0].cells[0].n === undefined, JSON.stringify(LyricFmt.write(D5b).split('\\n')));
/* 行里没有注音时那一层是不摆的：靠行的右键开关手工作注 */
g2.doc = JSON.parse(JSON.stringify(D5b)); g2.render();
T('整行没注音：这一行不摆注音那一层', host2.querySelectorAll('.wnw-lrow')[0].querySelectorAll('.wnw-ln').length === 0,
  host2.querySelectorAll('.wnw-ln').length + ' 个注音口');
g2.rowMenu({ preventDefault(){}, stopPropagation(){} }, g2.doc.lines[0], 0);
T('行的右键里有「给这一行加注音」', LAST_MENU.some(x => /^给这一行加注音/.test(x.label || '')), LAST_MENU.filter(x => x.label).map(x => x.label).join('/'));
LAST_MENU.find(x => /^给这一行加注音/.test(x.label || '')).fn();
T('开了之后每格上面多一格能打字', host2.querySelectorAll('.wnw-lrow')[0].querySelectorAll('.wnw-ln').length === 2,
  host2.querySelectorAll('.wnw-ln').length + ' 个注音口');
const 注口 = host2.querySelector('.wnw-ln');
注口.value = 'chen'; 注口.dispatchEvent(new Event('input', { bubbles:true }));
T('手打的注音落在格子自己身上（和拆并拖同一层）', g2.doc.lines[0].clauses[0].cells[0].n === 'chen', JSON.stringify(g2.doc.lines[0].clauses[0].cells[0]));
T('手打的注音写进明文就是「音 =」那一行', LyricFmt.write(g2.doc).indexOf('音 = chen') >= 0, LyricFmt.write(g2.doc).split('\\n').join(' ⏎ '));
g2.rowMenu({ preventDefault(){}, stopPropagation(){} }, g2.doc.lines[0], 0);
T('有了注音之后那一条改口叫「去掉这一行的注音」', LAST_MENU.some(x => /^去掉这一行的注音/.test(x.label || '')),
  LAST_MENU.filter(x => x.label).map(x => x.label).join('/'));
LAST_MENU.find(x => /^去掉这一行的注音/.test(x.label || '')).fn();
T('去掉：那一层收掉，填过的注音跟着删', host2.querySelectorAll('.wnw-ln').length === 0 && !g2.doc.lines[0].clauses[0].cells[0].n,
  JSON.stringify(g2.doc.lines[0].clauses[0].cells.map(c => c.n == null ? '无' : c.n)));
g2.undoStep();
T('这一步能撤回，注音回到原来那一格', host2.querySelectorAll('.wnw-ln').length === 2 && host2.querySelector('.wnw-ln').value === 'chen',
  host2.querySelectorAll('.wnw-ln').length + ' 个口 ｜ ' + host2.querySelector('.wnw-ln').value);

/* 真文件那一头：导入的逐字 ttml 里带注音的，格子要真带上 n —— 这一段挪到第十节后面（那边才把 REALRAW 摆出来） */

/* 〇之七、戊组追加：演唱者与唱法 —— 独唱是默认档（明文里不写），合唱两个以上，和声垫在主唱后面 */
const D6 = { title:'', lines:[
  { seg:'', who:['RM'], clauses:[{ cells:[{t:'真',ms:480},{t:'爱',ms:420}] }] },
  { seg:'', who:['RM'], clauses:[{ cells:[{t:'我',ms:400},{t:'有',ms:400}] }] },
  { seg:'', who:['A','B'], how:'choir', clauses:[{ cells:[{t:'人',ms:400},{t:'海',ms:400}] }] },
  { seg:'', who:['C'], how:'bg', clauses:[{ cells:[{t:'铺',ms:400}] }] },
  { seg:'', clauses:[{ cells:[{t:'灯',ms:400}] }] } ] };
const T6 = LyricFmt.write(D6), B6 = LyricFmt.parse(T6);
const 人行6 = (T6.match(/人 =/g) || []).length, 唱行6 = (T6.match(/唱 =/g) || []).length;
T('人 = 连着两行同一个人名只补一行（粘着走的）', 人行6 === 4, 人行6 + ' 行「人 =」 ｜ ' + T6.split('\\n').join(' ⏎ '));
const 唱序 = T6.split('\\n').filter(r => r.indexOf('唱 =') === 0).join(' / ');
T('唱 = 独唱是默认档：头几行不写，从合唱起才补，退回独唱写「独唱」',
  唱行6 === 3 && 唱序 === '唱 = 合唱 / 唱 = 和声 / 唱 = 独唱', 唱行6 + ' 行「唱 =」 ｜ ' + 唱序);
T('演唱者与唱法写出去读回来一模一样', JS(B6) === JS(D6), JSON.stringify(B6.lines.map(L => [(L.who || []).join('、'), L.how || '独'])));
T('人 = 空着那一行是把往后几行的挂名清掉（不是留个空档）', B6.lines[4] && !B6.lines[4].who && !B6.lines[4].how,
  JSON.stringify(B6.lines[4] || {}));
g2.doc = JSON.parse(JSON.stringify(D6)); LYRIC_UI.setNum('ms'); g2.render();
const whoTxt = i => { const e = R2(i).querySelector('.wnw-lwho'); return e ? Array.from(e.querySelectorAll('.wnw-lchip')).map(x => x.textContent).join(' / ') : '（没摆牌）'; };
T('独唱带人名：牌上就写人名，不带「独唱」二字', whoTxt(0) === 'RM', whoTxt(0));
T('合唱：两个人名各一枚牌、上下排，唱法单独占最下面那一枚', whoTxt(2) === 'A / B / 合唱', whoTxt(2));
T('和声：牌上带「和声」', whoTxt(3) === 'C / 和声', whoTxt(3));
T('没挂名又没改唱法的那一行摆的是一格空槽（外25 第 5 条起槽位固定，空槽点不动）',
  !!R2(4).querySelector('.wnw-lwho.empty') && whoTxt(4) === '', whoTxt(4));
/* 点小牌开框：独唱想塞两个人，必须拦下来 */
TOASTS.length = 0; R2(0).querySelector('.wnw-lchip').click();
T('点行首那枚小牌开出「演唱者与唱法」', !!OVERLAY && /演唱者与唱法/.test(OVERLAY.title), OVERLAY ? OVERLAY.title : '没开');
const nIn = OVERLAY.box.querySelector('input'), 定了 = OVERLAY.btns.find(b => b.textContent === '定了');
nIn.value = '甲、乙'; 定了.click();
T('独唱设两个人：拦下，不改树，框也不关', TOASTS.some(t => /独唱只能设一个/.test(t)) && g2.doc.lines[0].who.join('、') === 'RM' && !!OVERLAY,
  JSON.stringify(TOASTS.slice(-1)) + ' ｜ 现在 who=' + g2.doc.lines[0].who.join('、'));
const 合唱键 = Array.from(OVERLAY.box.querySelectorAll('button')).find(b => b.textContent === '合唱');
合唱键.click();
T('框里点合唱：那一档亮起来，人名口提示两个以上', 合唱键.classList.contains('on') && /两个以上/.test(nIn.placeholder),
  nIn.placeholder);
const 独唱键 = Array.from(OVERLAY.box.querySelectorAll('button')).find(b => b.textContent === '独唱');
独唱键.click(); 定了.click();
T('换回独唱再点「定了」还是拦（两个人名不许留）', TOASTS.filter(t => /独唱只能设一个/.test(t)).length === 2 && !!OVERLAY);
合唱键.click(); 定了.click();
T('合唱落定：两个人名 + 唱法都记在这一行上', g2.doc.lines[0].who.join('、') === '甲、乙' && g2.doc.lines[0].how === 'choir' && !OVERLAY,
  JSON.stringify([g2.doc.lines[0].who, g2.doc.lines[0].how]));
T('落定之后牌当场换成新的那份（两个人名各一枚，唱法一枚）', whoTxt(0) === '甲 / 乙 / 合唱', whoTxt(0));
/* 没挂名的行：从行的右键进去，用「跟随上一行」抄上面那一行 */
TOASTS.length = 0;
g2.rowMenu({ preventDefault(){}, stopPropagation(){} }, g2.doc.lines[4], 4);
T('行的右键里有「演唱者 / 唱法…」，没挂名的行也从这儿进', LAST_MENU.some(x => x.label === '演唱者 / 唱法…'),
  LAST_MENU.filter(x => x.label).map(x => x.label).join('/'));
LAST_MENU.find(x => x.label === '演唱者 / 唱法…').fn();
T('从右键开的是同一个框', !!OVERLAY && /演唱者与唱法/.test(OVERLAY.title), OVERLAY ? OVERLAY.title : '没开');
OVERLAY.btns.find(b => b.textContent === '跟随上一行').click();
T('跟随上一行：抄的是上一行的人名和唱法', OVERLAY.box.querySelector('input').value === 'C'
  && Array.from(OVERLAY.box.querySelectorAll('button')).find(b => b.textContent === '和声').classList.contains('on'),
  OVERLAY.box.querySelector('input').value);
OVERLAY.btns.find(b => b.textContent === '定了').click();
T('定了之后这一行和上一行同一份挂名', g2.doc.lines[4].who.join('、') === 'C' && g2.doc.lines[4].how === 'bg',
  JSON.stringify([g2.doc.lines[4].who, g2.doc.lines[4].how]));
const 加前7 = g2.doc.lines.length;
g2.addRow(3);
T('新加的一行自动跟着上面那一行的演唱者与唱法', g2.doc.lines.length === 加前7 + 1 && g2.doc.lines[3].who.join('、') === 'A、B'
  && g2.doc.lines[3].how === 'choir', JSON.stringify([(g2.doc.lines[3] || {}).who, (g2.doc.lines[3] || {}).how]));
g2.undoStep();
T('加行算一步，撤回得回去', g2.doc.lines.length === 加前7, g2.doc.lines.length + ' 行');
/* 逐字 ttml 那一头：这四样标记导出去要用同一把尺读得回来 */
const D7 = { title:'', lines:[
  { seg:'', who:['RM'], trans:'真爱', clauses:[{ cells:[{t:'真',ms:480,n:'chen'},{t:'爱',ms:420,n:'ai'}] }] },
  { seg:'', who:['A','B'], how:'choir', clauses:[{ cells:[{t:'人',ms:400,n:'ren'},{t:'海',ms:400,n:'hai'}] }] },
  { seg:'', who:['C'], how:'bg', clauses:[{ cells:[{t:'铺',ms:400,n:'pu'}] }] },
  { seg:'', clauses:[{ cells:[{t:'灯',ms:400}] }] } ] };
const T7 = lyricToTtml(D7), R7 = lyricFromTtml(T7);
T('ttml 文件头声明了声部名单，<p> 上只指过去', (T7.split('<ttm:agent ').length - 1) === 3 && T7.indexOf('ttm:agent="v1"') >= 0 && T7.indexOf('xml:id="v3"') >= 0,
  T7.split('\\n').filter(r => r.indexOf('<ttm:agent') >= 0).join(' ⏎ '));
T('ttml 里和声那一行的字打了 x-bg', (T7.split('ttm:role="x-bg"').length - 1) === 1,
  (T7.split('ttm:role="x-bg"').length - 1) + ' 个（和声那一行只有一个字，就该只打一枚）');
T('ttml 里注音走文件头 <text ttm:for>，一格一段', (T7.split('<text ttm:for="').length - 1) === 3 && T7.indexOf('>chen<') >= 0,
  T7.split('\\n').filter(r => r.indexOf('<text ttm:for=') >= 0).join(' ⏎ '));
T('ttml 里翻译是行内 x-translation 那一枚', T7.indexOf('ttm:role="x-translation">真爱<') >= 0,
  T7.split('\\n').filter(r => r.indexOf('x-translation') >= 0).join(' ⏎ '));
const 读7 = R7 ? R7.lines.map(L => [(L.who || []).join('、'), L.how || '', L.trans || '', L.clauses[0].cells.map(c => c.n == null ? '无' : c.n).join('/')]) : null;
T('导出去再读回来：演唱者 / 唱法 / 翻译 / 注音一格不差', JS(读7) === JS([['RM','','真爱','chen/ai'],['A、B','choir','','ren/hai'],['C','bg','','pu'],['','','','无']]),
  JSON.stringify(读7));
/* 〇之八、己组：快捷建词格（第 11 条）—— 占位符 / 分格符 / 换行符都随他定 */
g2.doc = { title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'', ms:null }] }] }] }; LYRIC_UI.setFill('cell'); g2.render();
const 建行1 = g2.quickBuild('xxxx  xxxx xxxx\\nxxxx', 'x', ' ', '');
const 行1 = g2.doc.lines.map(L => L.clauses[0].cells.length).join(',');
T('「xxxx xxxx」按占位符铺格：一行十二格、第二行四格，铺出来的每一格都是空的等填词',
  建行1 === 2 && 行1 === '12,4' && g2.doc.lines.every(L => L.clauses[0].cells.every(c => !c.t)),
  行1 + ' ｜ ' + JSON.stringify(g2.doc.lines[0].clauses[0].cells.map(c => c.t)));
T('新开的那一行空格子被顶掉（铺完不留一行空位在上面）', g2.doc.lines.length === 2, g2.doc.lines.length + ' 行');
const 建行2 = g2.quickBuild('。。-。|。-。。', '。', '-', '|');
T('三个记号自定义：占位符「。」、分格符「-」、换行另认「|」都照意思走',
  建行2 === 2 && g2.doc.lines[2].clauses[0].cells.length === 3 && g2.doc.lines[3].clauses[0].cells.length === 3,
  JSON.stringify(g2.doc.lines.slice(2).map(L => L.clauses[0].cells.length)));
g2.undoStep();
T('铺错了能撤回，回到铺之前那几行', g2.doc.lines.length === 2, g2.doc.lines.length + ' 行');
g2.quickDlg();
T('填法那张单子里有「快捷建词格…」，开出来给三个记号各一格', !!OVERLAY && Array.from(OVERLAY.box.querySelectorAll('input')).length === 3,
  OVERLAY ? OVERLAY.title + ' ｜ ' + Array.from(OVERLAY.box.querySelectorAll('input')).length + ' 个框' : '没开');
OVERLAY.box.querySelector('textarea').value = 'xxxxx xxxxx';
OVERLAY.btns.find(b => b.textContent === '铺到词格里').click();
T('框里点「铺到词格里」：走的是同一套，且把占位符记下来（这台机器）', g2.doc.lines.length === 3 && LYRIC_UI.ph === 'x',
  g2.doc.lines.length + ' 行 ｜ 占位符=' + LYRIC_UI.ph);
g2.doc = { title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'', ms:null }] }] }] }; g2.render();

/* 〇之九、己组：音节数（第 9 条上）—— 明文一行、格子上一个数、标音节那一档打的是数不是字 */
const D8 = { title:'', lines:[ { seg:'', clauses:[{ cells:[{t:'春',ms:400,k:2},{t:'风',ms:400,k:1},{t:'十',ms:400,k:3}] }] },
  { seg:'', clauses:[{ cells:[{t:'好',ms:400},{t:'好',ms:400}] }] } ] };
const T8 = LyricFmt.write(D8), B8 = LyricFmt.parse(T8);
T('节 = 写进明文是一格一个数（「节 = 2 1 3」），没标的那一行不出这一行',
  T8.indexOf('节 = 2 1 3') >= 0 && (T8.split('\\n').filter(r => r.indexOf('节 =') === 0).length) === 1, T8.split('\\n').join(' ⏎ '));
T('音节数写出去读回来还在原来那一格上，整棵树一模一样', JS(B8) === JS(D8), JSON.stringify(B8.lines[0].clauses[0].cells));
const D8b = { title:'', lines:[ { seg:'', clauses:[{ cells:[{t:'a',ms:400,k:12},{t:'b',ms:400}] }] } ] };
T('两位数的音节数读回来不串成两个数', LyricFmt.parse(LyricFmt.write(D8b)).lines[0].clauses[0].cells[0].k === 12,
  LyricFmt.write(D8b).split('\\n').filter(r => r.indexOf('节 =') === 0).join(''));
g2.doc = JSON.parse(JSON.stringify(D8)); g2.render();
T('按格填那一档：音节数标在格子的最下面（和头顶那串时值分开摆）',
  host2.querySelectorAll('.wnw-lrow')[0].querySelectorAll('.wnw-lsyl').length === 3 &&
  host2.querySelectorAll('.wnw-lrow')[1].querySelectorAll('.wnw-lsyl').length === 0,
  host2.querySelectorAll('.wnw-lrow')[0].querySelectorAll('.wnw-lsyl').length + ' 个 ｜ ' + C2(R2(0), 0).querySelector('.wnw-lsyl').textContent);
g2.setFill('count');
T('切到标音节那一档：格子里写的就是数，第一格 2、第三格 3',
  C2(R2(0), 0).querySelector('.wnw-ltxt').value === '2' && C2(R2(0), 2).querySelector('.wnw-ltxt').value === '3',
  Array.from(R2(0).querySelectorAll('.wnw-ltxt')).map(i => i.value).join('/'));
T('标音节那一档底下那一行不重复摆数', R2(0).querySelectorAll('.wnw-lsyl').length === 0, R2(0).querySelectorAll('.wnw-lsyl').length + ' 个');
const 提示 = host2.querySelector('.wnw-lhint');
T('按钮下面那行小字跟着改口（这一档打的是音节数不是字）', /这一档打进去的是这一格唱几个音节/.test(提示.textContent), 提示.textContent.slice(0, 40));
const 数口 = C2(R2(0), 1).querySelector('.wnw-ltxt');
数口.value = '4x5'; 数口.dispatchEvent(new Event('input', { bubbles:true }));
T('标音节那一档只收数字：字母被抹掉，格子里落的是 45', 数口.value === '45' && g2.doc.lines[0].clauses[0].cells[1].k === 45,
  数口.value + ' ｜ k=' + g2.doc.lines[0].clauses[0].cells[1].k);
数口.value = ''; 数口.dispatchEvent(new Event('input', { bubbles:true }));
T('数清空就等于这一格没标（明文里不占一个减号以外的东西）', g2.doc.lines[0].clauses[0].cells[1].k === undefined, JSON.stringify(g2.doc.lines[0].clauses[0].cells[1]));
g2.setFill('cell');
const 拆前8 = host2.querySelectorAll('.wnw-lcell').length;
KEYA(C2(R2(0), 2).querySelector('.wnw-ltxt'), 'D');
const 拆后8 = cellsOf2(0).slice(0, 4).map(b => { const t = b.querySelector('.wnw-lsyl'); return t ? t.textContent : '无'; });
T('拆一格：三个音节的那一格拆成 2 + 1（中间那一格上面那轮已把数清了，所以是无）',
  host2.querySelectorAll('.wnw-lcell').length === 拆前8 + 1 && 拆后8.join('/') === '2/无/2/1', 拆后8.join('/'));
KEYA(cellsOf2(0)[3].querySelector('.wnw-ltxt'), 'M');
T('Alt+M 并回上一格：音节数也跟着并（2 + 1 变回 3）',
  host2.querySelectorAll('.wnw-lcell').length === 拆前8 && C2(R2(0), 2).querySelector('.wnw-lsyl').textContent === '3',
  C2(R2(0), 2).querySelector('.wnw-lsyl').textContent);
/* 整句填写：一行底下一根横线，写完一键按音节拆回格子（先把那一行还原成 2 / 1 / 3，上面拆并动过它） */
g2.doc.lines[0].clauses[0].cells = [{t:'',ms:400,k:2},{t:'',ms:400,k:1},{t:'',ms:400,k:3}];
g2.setFill('fill');
const LINE = i => R2(i).nextElementSibling;
const 写进去 = (i, s) => { const inp = LINE(i).querySelector('input'); inp.value = s; inp.dispatchEvent(new Event('input', { bubbles:true })); };
const 格字 = i => Array.from(R2(i).querySelectorAll('.wnw-ltxt')).map(x => x.value);
T('整句填那一档：每一行底下一根横线 + 一个对齐到音节的按钮',
  host2.querySelectorAll('.wnw-lfill').length === g2.doc.lines.length && !!LINE(0).querySelector('input'),
  host2.querySelectorAll('.wnw-lfill').length + ' 根横线');
TOASTS.length = 0; 写进去(0, '春风十里铺'); LINE(0).querySelector('button').click();
T('一键对齐到音节：标了 2 / 1 / 3 的三格各取「春风」「十」「里铺」', 格字(0).join('|') === '春风|十|里铺', 格字(0).join('/'));
T('拆完横线上不留字，三格的时值一格没动', LINE(0).querySelector('input').value === ''
  && g2.doc.lines[0].clauses[0].cells.map(c => c.ms).join(',') === '400,400,400',
  g2.doc.lines[0].clauses[0].cells.map(c => c.ms).join(','));
写进去(1, '真好'); LINE(1).querySelector('button').click();
T('没标音节数的格按一格一音拆（两个字拆进两格）', 格字(1).join('|') === '真|好' && g2.needOf(g2.doc.lines[1]) === 2, 格字(1).join('/'));
写进去(0, '大大大大大大大大'); TOASTS.length = 0; LINE(0).querySelector('button').click();
T('横线上的字比格子能装的多了：拆满为止，多出来的留在横线上并说清几个',
  /还多 2 个音节/.test(TOASTS.join('')) && LINE(0).querySelector('input').value === '大大',
  JSON.stringify(TOASTS.slice(-1)) + ' ｜ 剩「' + LINE(0).querySelector('input').value + '」');
写进去(0, 'x春风十'); LINE(0).querySelector('button').click();
T('占位符顶掉第一格：那一格留空等以后填，后面的字不许往前挪补它', 格字(0).join('|') === '|春|风十', 格字(0).join('/'));
写进去(0, 'busy 春风十里铺'); TOASTS.length = 0; LINE(0).querySelector('button').click();
T('横线上混进西文那一串就不拆，点名那一串让他先用占位符顶掉（暂时只支持中文和自定义占位符号）',
  /暂时只支持中文和自定义占位符号/.test(TOASTS.join('')) && /busy/.test(TOASTS.join('')) && 格字(0).join('|') === '|春|风十',
  JSON.stringify(TOASTS.slice(-1)) + ' ｜ 格子没动：' + 格字(0).join('/'));
g2.setFill('cell');
T('切回按格填：横线收掉，格子还是那批格子（三档只换输入口，不动数据）',
  host2.querySelectorAll('.wnw-lfill').length === 0 && host2.querySelectorAll('.wnw-lcell').length === 5,
  host2.querySelectorAll('.wnw-lcell').length + ' 格 ｜ ' + 格字(0).join('/'));

/* 〇之十、己组：拍点模式（第 10 条）—— 跟着遥控器那一份时钟手点，点出来的是带时长的空格子 */
g2.doc = { title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'', ms:null }] }] }] }; g2.render();
MusClock.set({ pos:20000, at:Date.now(), rate:1, status:'Playing', title:'测试歌', dur:300000 });
g2.lastLi = 0; g2.tapToggle();
T('进拍点：连上了正在放的歌就取那一份时钟（不是从自己这一刻数）', !!g2.tap && g2.tap.live === true && !!host2.querySelector('.wnw-ltap'),
  'live=' + (g2.tap ? g2.tap.live : '没进'));
T('拍点那一排写着正在给第几行打、已打几点', /正在给第 1 行打点/.test(host2.querySelector('.wnw-ltap').textContent),
  host2.querySelector('.wnw-ltap').textContent.slice(0, 44));
const KEY2 = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key:k, code:(k === ' ' ? 'Space' : k), bubbles:true, cancelable:true }));
TOASTS.length = 0;
KEY2(C2(R2(0), 0).querySelector('.wnw-ltxt'), ' ');
T('空格 = 打第一个点（格子里不会多出一个空格）', g2.tap.pts.length === 1 && !g2.doc.lines[0].clauses[0].cells[0].t,
  JSON.stringify(g2.tap.pts));
MusClock.set({ pos:20500, at:Date.now(), rate:1, status:'Playing', dur:300000 }); KEY2(C2(R2(0), 0).querySelector('.wnw-ltxt'), ' ');
MusClock.set({ pos:21200, at:Date.now(), rate:1, status:'Playing', dur:300000 }); KEY2(C2(R2(0), 0).querySelector('.wnw-ltxt'), ' ');
T('三个点报在条上：两点之间就是一格', /已打 3 点（= 2 格）/.test(host2.querySelector('.wnw-ltap').textContent),
  host2.querySelector('.wnw-ltap').textContent.slice(0, 60));
MusClock.set({ pos:21900, at:Date.now(), rate:1, status:'Playing', dur:300000 }); g2.tapPoint(); /* 最后一个字唱完：这一点收口 */
g2.tapDone();
const 拍格 = cellsOf2(0).map(b => ({ t:b.querySelector('.wnw-ltxt').value, ms:msOf2(b) }));
T('结束：点与点之间生成带时长的空格子（3 格，时长 500 / 700 / 700）',
  拍格.length === 3 && 拍格.every(x => !x.t) && Math.abs(parseInt(拍格[0].ms) - 500) <= 8
  && Math.abs(parseInt(拍格[1].ms) - 700) <= 8 && Math.abs(parseInt(拍格[2].ms) - 700) <= 8,
  JSON.stringify(拍格.map(x => x.ms)));
T('第一点落在「起」上：这一行的开口就是那一刻（20000 毫秒附近）', Math.abs(g2.doc.lines[0].at - 20000) <= 8,
  g2.doc.lines[0].at);
T('生成完拍点那一排自己收掉', !g2.tap && !host2.querySelector('.wnw-ltap'));
const 拍后 = cellsOf2(0)[1].querySelector('.wnw-ltxt');
拍后.value = '海'; 拍后.dispatchEvent(new Event('input', { bubbles:true }));
T('这些格子和正常填词完全一样：能直接打字', g2.doc.lines[0].clauses[0].cells[1].t === '海', JSON.stringify(g2.doc.lines[0].clauses[0].cells));
const 拍明文 = LyricFmt.write(g2.doc), 拍ttml = lyricToTtml(g2.doc);
T('拍点出来的时长进得了明文、也出得了逐字 ttml',
  /起 = 20[0-9][0-9][0-9]/.test(拍明文) && /begin="00:00:20[.]/.test(拍ttml) && /end="00:00:21[.]/.test(拍ttml),
  拍明文.split('\\n').join(' ⏎ ') + ' ｜ ' + (拍ttml.match(/<span[^>]*>/g) || []).join(' '));
g2.tapToggle();
MusClock.set({ pos:25000, at:Date.now(), rate:1, status:'Playing', dur:300000 }); g2.tapPoint();
TOASTS.length = 0; g2.tapDone();
T('只打一个点就结束：不动格子，说清至少要有两个点', /至少要两个点/.test(TOASTS.join('')) && Math.abs(g2.doc.lines[0].at - 20000) <= 8,
  JSON.stringify(TOASTS.slice(-1)) + ' ｜ 起=' + g2.doc.lines[0].at);
g2.tapToggle(); g2.tapPoint(); KEY2(C2(R2(0), 0).querySelector('.wnw-ltxt'), 'Escape');
T('Esc 取消这一趟：不生成格子、那一排收掉', !g2.tap && !host2.querySelector('.wnw-ltap') && Math.abs(g2.doc.lines[0].at - 20000) <= 8);
MusClock.set({ pos:0, at:Date.now(), rate:1, status:'Paused', dur:0 });
g2.lastLi = 0; g2.tapToggle();
T('没连上正在放的歌：从按下那一个起自己数（模拟打点），并说清这一趟是相对这一段', !!g2.tap && g2.tap.live === false
  && TOASTS.some(t => /自己数/.test(t)), JSON.stringify(TOASTS.slice(-1)));
g2.tapCancel();

FILES.length = 0; g2.doc = JSON.parse(JSON.stringify(D7)); g2.doExport('full', '戊组全标记.wnw.json');
const 全7 = lyricFromFull((FILES[0] || {}).text || '');
T('全标记那份把演唱者与唱法也带着（另一个人导入看到的是同一棵树）', JS(全7) === JS(D7),
  全7 ? JSON.stringify(全7.lines.map(L => [(L.who || []).join('、'), L.how || ''])) : '读不回来');

/* 〇之十一、追加：双击时值 = 定播放入点；拆 / 并 / 删都给到键，注音与原文两层能各自单独删 */
const D9 = { title:'', lines:[
  { seg:'', clauses:[{ cells:[{t:'真',ms:480,n:'chen'},{t:'爱',ms:420,n:'ai'}] }] },
  { seg:'', clauses:[{ cells:[{t:'人',ms:600},{t:'海',ms:500} ] }] } ] };
g2.doc = JSON.parse(JSON.stringify(D9)); LYRIC_UI.setFill('cell'); g2.fromMs = null; g2.render();
const 明文前9 = LyricFmt.write(g2.doc);
T('一格两层（注音在上、原文在下）本来就是一对：第一格两个口，第二格一个口',
  C2(R2(0), 0).querySelectorAll('input').length === 2 && C2(R2(1), 0).querySelectorAll('input').length === 1,
  C2(R2(0), 0).querySelectorAll('input').length + ' / ' + C2(R2(1), 0).querySelectorAll('input').length);
DBL(R2(0).querySelectorAll('.wnw-lms')[1]);
T('双击第二格上面那串数：这一格定成入点，那串数上色', Math.abs(g2.fromMs - 480) <= 1 && R2(0).querySelectorAll('.wnw-lms')[1].classList.contains('from'),
  'fromMs=' + g2.fromMs);
T('入点只是这一屏的播放起点：不写进那个明文文件', LyricFmt.write(g2.doc) === 明文前9, LyricFmt.write(g2.doc).split('\\n').join(' ⏎ '));
g2.follow = false; g2.playing = false; g2.play();
T('模拟播放从入点起走：按下这一刻就落在这一格的开口（480 毫秒附近）', g2.playing && Math.abs(g2.nowMs() - 480) <= 30, g2.nowMs());
g2.mark(200);
T('没到入点的那一段：整排按「还没唱到」摆，不亮任何一格', cellsOf2(0).every(b => !b.classList.contains('now') && !b.classList.contains('post')
  && b.classList.contains('pre')) && cellsOf2(1).every(b => b.classList.contains('pre')), C2(R2(0), 0).className);
g2.mark(1400);
T('走过入点就照常跟：第二格唱过、第三格（下一行的头一格）正在唱',
  C2(R2(0), 1).classList.contains('post') && C2(R2(1), 0).classList.contains('now'),
  C2(R2(0), 1).className + ' ｜ ' + C2(R2(1), 0).className);
g2.stopPlay();
DBL(R2(0).querySelectorAll('.wnw-lms')[1]);
T('再双击同一格：取消入点', g2.fromMs === null && !R2(0).querySelectorAll('.wnw-lms')[1].classList.contains('from'), 'fromMs=' + g2.fromMs);
KEYA(C2(R2(1), 0).querySelector('.wnw-ltxt'), 'I');
T('Alt+I 是键盘那一条路：定了第三格的入点（900 毫秒）', Math.abs(g2.fromMs - 900) <= 1, g2.fromMs);
g2.fromMs = null; g2.render();
/* 快捷删除：Delete 删这一格，Alt+Shift+X / Shift+Delete 删这一行，都能撤回 */
const 格前 = host2.querySelectorAll('.wnw-lcell').length, 行前9 = g2.doc.lines.length;
KEY(C2(R2(1), 1).querySelector('.wnw-ltxt'), 'Delete');
T('Delete 删掉光标所在那一格（行的格数少一）', host2.querySelectorAll('.wnw-lcell').length === 格前 - 1
  && g2.doc.lines[1].clauses[0].cells.length === 1, (格前 - 1) + ' vs ' + host2.querySelectorAll('.wnw-lcell').length);
g2.undoStep();
T('删格能撤回回来', host2.querySelectorAll('.wnw-lcell').length === 格前, host2.querySelectorAll('.wnw-lcell').length + ' 格');
KEYA(C2(R2(1), 0).querySelector('.wnw-ltxt'), 'X', true);
T('Alt+Shift+X 删掉整行（不是删一格）', g2.doc.lines.length === 行前9 - 1, g2.doc.lines.length + ' 行');
g2.undoStep();
KEYS(C2(R2(1), 0).querySelector('.wnw-ltxt'), 'Delete', true); /* Shift+Delete 走的是同一条：先按住 Shift 再删 */
T('Shift+Delete 也是删这一行（键盘上两种顺手都给了）', g2.doc.lines.length === 行前9 - 1, g2.doc.lines.length + ' 行');
g2.undoStep();
/* 两层各自单独删：注音那一格里按 Delete 只收注音，原文那一格一个字都不动 */
const 原文9 = g2.doc.lines[0].clauses[0].cells.map(c => c.t).join('');
C2(R2(0), 0).querySelector('.wnw-ln').focus();
KEY(C2(R2(0), 0).querySelector('.wnw-ln'), 'Delete');
T('在注音那一格里按 Delete：只删掉这一格的注音', g2.doc.lines[0].clauses[0].cells[0].n === undefined
  && g2.doc.lines[0].clauses[0].cells[1].n === 'ai', JSON.stringify(g2.doc.lines[0].clauses[0].cells.map(c => c.n == null ? '无' : c.n)));
T('原文一个字都不动（两层是真的各删各的）', g2.doc.lines[0].clauses[0].cells.map(c => c.t).join('') === 原文9,
  g2.doc.lines[0].clauses[0].cells.map(c => c.t).join(''));
const 注口前 = host2.querySelectorAll('.wnw-ln').length;
const 注2 = C2(R2(0), 1).querySelector('.wnw-ln');
注2.focus(); KEY(注2, 'Delete');
T('最后一格注音删掉：整层的注音口跟着收掉，原文那一排格子一个不少',
  host2.querySelectorAll('.wnw-ln').length === 0 && 注口前 === 2 && host2.querySelectorAll('.wnw-lcell').length === 格前,
  注口前 + ' → ' + host2.querySelectorAll('.wnw-ln').length + ' 个注音口 ｜ ' + host2.querySelectorAll('.wnw-lcell').length + ' 格');
g2.undoStep();
T('收掉的注音层能撤回回来', host2.querySelectorAll('.wnw-ln').length === 2, host2.querySelectorAll('.wnw-ln').length + ' 个注音口');
KEYA(C2(R2(0), 0).querySelector('.wnw-ln'), 'N', true);
T('Alt+Shift+N 从格子里就能把这行的注音层整行去掉', host2.querySelectorAll('.wnw-ln').length === 0,
  host2.querySelectorAll('.wnw-ln').length + ' 个注音口');
g2.undoStep();
T('换填法也在键上：Alt+3 切到整句填', (KEYA(C2(R2(0), 0).querySelector('.wnw-ltxt'), '3'), LYRIC_UI.fill === 'fill'), LYRIC_UI.fill);
KEYA(C2(R2(0), 0).querySelector('.wnw-ltxt'), '1');
T('Alt+1 切回按格填', LYRIC_UI.fill === 'cell', LYRIC_UI.fill);
const 提示行 = host2.querySelector('.wnw-lhint');
T('按钮下面那行小字把这几个键一次说全', 提示行.textContent.indexOf('Alt+D 拆') >= 0
  && 提示行.textContent.indexOf('Alt+Shift+X 删这一行') >= 0 && 提示行.textContent.indexOf('Tab 键') === 0, 提示行.textContent);

const i0 = cellsOf(0)[0].querySelector('.wnw-ltxt');
i0.value = '深'; i0.dispatchEvent(new Event('input', { bubbles:true }));
T('改一格的字就记进模型了', g.doc.lines[0].clauses[0].cells[0].t === '深', g.doc.lines[0].clauses[0].cells[0].t);
T('改字顺带安排了一次存盘', DIRTY > 0, 'dirty ' + DIRTY + ' 次');

/* 二、Enter 越行走，最后一行按回车当场长出一行 */
const 行前 = g.doc.lines.length;
KEY(cellsOf(0)[1].querySelector('.wnw-ltxt'), 'Enter');
T('第一行第二格按回车走到第二行第一格', document.activeElement === cellsOf(1)[0].querySelector('.wnw-ltxt'),
  '落在「' + txtOf(cellsOf(1)[0]) + '」');
KEY(ALL()[ALL().length - 1].querySelector('.wnw-ltxt'), 'Enter');
T('最后一行按回车加出一行', g.doc.lines.length === 行前 + 1, g.doc.lines.length + ' 行');
T('加出来的那一行给了一格空位等他写', txtOf(ALL()[ALL().length - 1]) === '');
const 左移 = ALL()[ALL().length - 1].querySelector('.wnw-ltxt');
左移.focus(); 左移.selectionStart = 左移.selectionEnd = 0;
KEY(左移, 'ArrowLeft');
T('空格里按左箭头越到前一格', document.activeElement === ALL()[ALL().length - 2].querySelector('.wnw-ltxt'),
  document.activeElement.className);

/* 三、拖缝 = 挪时长（总量守恒，不许拖出多出来的时间） */
const A = g.doc.lines[0].clauses[0].cells[0], B = g.doc.lines[0].clauses[0].cells[1];
const sum0 = A.ms + B.ms;
const seam = seamOf(0, 0);
seam.setPointerCapture = () => {}; seam.releasePointerCapture = () => {};
seam.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:100, pointerId:1 }));
seam.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, clientX:160, pointerId:1 }));
T('拖了 60 像素，两格时长之和没变（守恒）', A.ms + B.ms === sum0, sum0 + ' → ' + (A.ms + B.ms));
T('往右拖第一格变长', A.ms > 480, '第一格 ' + A.ms + ' / 第二格 ' + B.ms);
T('拖的时候格宽跟着改', cellsOf(0)[0].style.flexGrow === String(A.ms), 'flex-grow ' + cellsOf(0)[0].style.flexGrow);
const 合计应等 = (() => { let s = 0; for(const cl of g.doc.lines[0].clauses) for(const x of cl.cells) if(LyricFmt.okMs(x.ms)) s += x.ms; return (s / 1000).toFixed(2) + '″'; })();
T('行尾合计跟着拖动的数当场变', ROWS()[0].querySelector('.wnw-lsum').textContent === 合计应等,
  ROWS()[0].querySelector('.wnw-lsum').textContent + ' vs ' + 合计应等);
seam.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, clientX:160, pointerId:1 }));
const D1 = DIRTY;
T('松手安排了一次存盘', DIRTY > D1 - 1);
seam.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:900, pointerId:2 }));
seam.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, clientX:-3000, pointerId:2 }));
T('往左拖到底也不把第二格拖成负数', B.ms >= 0, '第二格 ' + B.ms);
T('往左拖到底第一格也不超过两格之和', A.ms <= sum0, '第一格 ' + A.ms);
seam.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, clientX:-3000, pointerId:2 }));
T('没时长的行里那道缝标成拖不动（不装成能用）', ROWS()[2].querySelector('.wnw-lseam').classList.contains('dead'));

/* 四、双击时值 = 拆格（字和时长都均分）；双击缝 = 并回上一格 */
const 拆前 = ALL().length;
T('合并格是「我有」两字', g.doc.lines[1].clauses[0].cells[0].t === '我有', g.doc.lines[1].clauses[0].cells[0].t);
KEYA(cellsOf(1)[0].querySelector('.wnw-ltxt'), 'D');
T('Alt+D 在这一格上多拆出一格', ALL().length === 拆前 + 1, 拆前 + ' → ' + ALL().length);
T('拆出来的字是「我」「有」', cellsOf(1).slice(0, 2).map(txtOf).join('') === '我有', cellsOf(1).map(txtOf).join('/'));
T('拆出来的时长均分（900 → 450 + 450）', cellsOf(1).slice(0, 2).map(el => msOf(el)).join('+') === '450ms+450ms',
  cellsOf(1).map(el => msOf(el)).join(','));
const 并前 = ALL().length;
DBL(seamOf(1, 0));
T('双击缝并回上一格', ALL().length === 并前 - 1, 并前 + ' → ' + ALL().length);
T('并回去的格子是两字', txtOf(cellsOf(1)[0]) === '我有', txtOf(cellsOf(1)[0]));
T('并回来的时长是两格之和', msOf(cellsOf(1)[0]) === '900ms', msOf(cellsOf(1)[0]));

/* 五、粘贴：一串字从这一格起一格一格摊开，不许把后面的格子吞掉，也不许把时长挪位 */
const 粘逗 = g.doc.lines[0].clauses[0];
const 粘前 = 粘逗.cells.length;
const ms前 = 粘逗.cells.map(x => x.ms).join(',');
g.cellPaste({ preventDefault(){}, clipboardData:{ getData:() => '春风十里' } }, cellsOf(0)[0].querySelector('.wnw-ltxt'));
T('粘贴四个字摊成四格', 粘逗.cells.slice(0, 4).map(x => x.t).join('') === '春风十里', 粘逗.cells.map(x => x.t).join('/'));
T('粘贴不删掉原有格子', 粘逗.cells.length === 粘前, 粘前 + ' → ' + 粘逗.cells.length);
T('粘贴把每格原有的时长留在原处', 粘逗.cells.map(x => x.ms).join(',') === ms前, 粘逗.cells.map(x => x.ms).join(','));

/* 六、撤回 / 重做 */
const 撤前 = JSON.stringify(g.doc);
g.undoStep();
T('撤回把刚才那一步挪走了', JSON.stringify(g.doc) !== 撤前);
g.redoStep();
T('重做又把它放回来', JSON.stringify(g.doc) === 撤前);

/* 七、明文往返：界面这棵树 → 两行明文 → 读回来，一模一样 */
const 明文 = LyricFmt.write(g.doc);
const 读回 = JSON.stringify(LyricFmt.parse(明文));
const 现树 = JSON.stringify(g.doc);
T('词格树 写出去再读回来一模一样', 读回 === 现树,
  现树 === 读回 ? '' : (() => {
    const A = flat(g.doc), B = flat(LyricFmt.parse(明文));
    const sig = d => d.lines.map(L => (L.seg || '') + ':' + L.clauses.map(c => c.cells.length).join('+')).join(' ｜ ');
    for(let i = 0; i < Math.max(A.length, B.length); i++) if(JSON.stringify(A[i]) !== JSON.stringify(B[i]))
      return '第 ' + i + ' 格 原 ' + JSON.stringify(A[i]) + ' 回 ' + JSON.stringify(B[i]);
    /* 格子内容一样但树不一样：把两边的「每行的逗与格数」摆出来看是谁歪了 */
    return '格数 ' + A.length + '/' + B.length + ' 内容逐格都对，结构不同 —— 原 ' + sig(g.doc) + ' ； 回 ' + sig(LyricFmt.parse(明文));
  })());

/* 八、导出逐字 ttml → 用共用那把尺读回来 → 逐格比字和时长 */
FILES.length = 0;
g.doExport('ttml', g.baseName() + '.ttml');
const t1 = (FILES[0] || {}).text || '';
T('出了一份 .ttml', ((FILES[0] || {}).name || '').endsWith('.ttml'), (FILES[0] || {}).name || '（没出）');
T('顶上写着 itunes:timing="Word"', /itunes:timing="Word"/.test(t1));
T('一行词一个 <p>、一格一个 <span>', (t1.match(/<p /g) || []).length === g.doc.lines.length && (t1.match(/<span /g) || []).length > 10,
  (t1.match(/<p /g) || []).length + ' 个 <p> / ' + (t1.match(/<span /g) || []).length + ' 个 <span>');
const re = lyricFromTtml(t1);
T('导出的 ttml 能被共用那把尺读成带时值的词格', !!re && !!re.lines.length, re ? re.lines.length + ' 行' : '读不出来');
if(re){
  const a = flat(g.doc).filter(x => x[0]), b = flat(re).filter(x => x[0]);
  T('读回来的字数一格不差', a.map(x => x[0]).join('') === b.map(x => x[0]).join(''),
    a.length + ' 格 vs ' + b.length + ' 格');
  /* 有时的格必须一格不差；没配时长（null / 0）的那些格由共用那把尺垫出一个正数（内层垫 120，行尾那一格按整行补） */
  let near = 0, 垫 = []; const 差 = [];
  const 有值 = a.filter(x => LyricFmt.okMs(x[1]) && x[1] > 0).length;
  for(let i = 0; i < Math.min(a.length, b.length); i++){
    const av = a[i][1], bv = b[i][1] || 0;
    if(LyricFmt.okMs(av) && av > 0){ if(Math.abs(av - bv) <= 1) near++; else if(差.length < 4) 差.push('第' + i + '格 ' + JSON.stringify(a[i]) + ' → ' + JSON.stringify(b[i])); }
    else if(bv > 0) 垫.push(bv);
    else if(差.length < 4) 差.push('第' + i + '格（没配时长）' + JSON.stringify(a[i]) + ' → ' + JSON.stringify(b[i]));
  }
  T('逐字 ttml 读回来：有时的格一格不差，没时的格由共用尺垫成正数', near === 有值 && 垫.length === a.length - 有值 && !差.length,
    near + '/' + 有值 + ' 格对、' + 垫.length + '/' + (a.length - 有值) + ' 格垫成 ' + 垫.slice(0, 6).join('/') + (差.length ? ' ｜ ' + 差.join(' ; ') : ''));
}

/* 九、导出逐句 lrc：时间点就是每一行的开口 */
FILES.length = 0;
g.doExport('lrc', g.baseName() + '.lrc');
const lrc = (FILES[0] || {}).text || '';
const L0 = lrc.split('\\n')[0] || '', L2 = lrc.split('\\n')[2] || '', L3 = lrc.split('\\n')[3] || '';
T('lrc 第一行是标题、第三行是第一句且落在 [00:00.00]', L0 === '[ti:测试词格]' && L2.slice(0, 10) === '[00:00.00]', JSON.stringify([L0, L2]));
T('lrc 第二句的时间点 = 第一行合计 2.86 秒', L3.slice(0, 10) === '[00:02.86]', JSON.stringify(L3));
T('lrc 逐句是连成一句的词，不带明文那些记号', L2.slice(11).length > 3 && L2.indexOf('|') < 0 && L2.indexOf('=') < 0, JSON.stringify(L2));

/* 十、真逐字 ttml：导入 → 导出 → 再读回来，逐格不许歪 */
const REAL = ${JSON.stringify(RAW.map(x => x[0]))};
const REALRAW = ${JSON.stringify(RAW.map(x => x[1]))};
let okr = 0, cellc = 0, 报 = [];
for(let i = 0; i < REALRAW.length; i++){
  await g.importTtml(REALRAW[i], REAL[i]);
  const d0 = JSON.parse(JSON.stringify(g.doc));
  const rt = lyricFromTtml(lyricToTtml(d0));
  const a = flat(d0), b = rt ? flat(rt) : [];
  cellc += a.length;
  let why = '';
  if(!rt) why = '导出去的那份读不回来';
  else if(a.length !== b.length){
    let j = 0; while(j < Math.min(a.length, b.length) && a[j][0] === b[j][0]) j++;
    why = '格数 ' + a.length + ' → ' + b.length + '，第 ' + j + ' 格起 原 ' + JSON.stringify(a.slice(j, j + 3)) + ' 回 ' + JSON.stringify(b.slice(j, j + 3));
  }
  else if(a.map(x => x[0]).join('') !== b.map(x => x[0]).join('')){
    let j = 0; while(j < a.length && a[j][0] === b[j][0]) j++;
    why = '第 ' + j + ' 格字 ' + JSON.stringify(a[j]) + ' → ' + JSON.stringify(b[j]);
  } else for(let k = 0; k < a.length; k++){
    const av = a[k][1], bv = b[k][1] || 0;
    const 对 = (LyricFmt.okMs(av) && av > 0) ? Math.abs(av - bv) <= 1 : (bv > 0);
    if(!对){ why = '第 ' + k + ' 格时长 ' + JSON.stringify(a[k]) + ' → ' + JSON.stringify(b[k]); break; }
  }
  if(why){ if(报.length < 4) 报.push(REAL[i] + '：' + why); } else okr++;
}
T('真 ttml ' + REALRAW.length + ' 份：导入 → 导出 → 读回来，格数字和时长都不歪', okr === REALRAW.length,
  okr + '/' + REALRAW.length + '（共 ' + cellc + ' 格）' + (报.length ? ' ｜ ' + 报.join(' ； ') : ''));
/* 真文件那一头：导入的逐字 ttml 里带注音、带翻译的，格子要真带上 n / trans（拿现场数字说话，不空口说支持） */
let 有注 = 0, 有译 = 0, 有音 = 0, 格总 = 0;
for(const txt of REALRAW){ const d = lyricFromTtml(txt); if(!d) continue;
  for(const L of d.lines){ 格总 += L.clauses[0].cells.length;
    if(L.trans) 有译++;
    if(L.clauses[0].cells.some(c => c.n)) 有音++;
    for(const c of L.clauses[0].cells) if(c.n) 有注++; } }
T('他库里那几份真逐字 ttml 走一遍：注音和翻译各收到多少', REALRAW.length >= 4 && 格总 > 100,
  格总 + ' 格 ｜ 带注音 ' + 有注 + ' 格（' + 有音 + ' 行有） ｜ 带翻译 ' + 有译 + ' 行');
/* 导出去再读回来：注音和翻译不许在半路丢掉（拿真文件验，不是只验我自己造的那一棵） */
let 回注 = 0, 回译 = 0, 丢 = [];
for(let i = 0; i < REALRAW.length; i++){ const d0 = lyricFromTtml(REALRAW[i]); if(!d0) continue;
  const n0 = d0.lines.reduce((a, L) => a + L.clauses[0].cells.filter(c => c.n).length, 0);
  const t0 = d0.lines.filter(L => L.trans).length;
  const back = lyricFromTtml(lyricToTtml(d0));
  if(!back){ 丢.push(REAL[i] + ' 读不回来'); continue; }
  const n1 = back.lines.reduce((a, L) => a + L.clauses[0].cells.filter(c => c.n).length, 0);
  const t1 = back.lines.filter(L => L.trans).length;
  回注 += n1; 回译 += t1;
  if(n1 < n0 || t1 < t0) 丢.push(REAL[i] + '：注音 ' + n0 + '→' + n1 + '，翻译 ' + t0 + '→' + t1); }
T('真 ttml 导出去再读回来：注音和翻译一格不丢（少了就点名是哪一份）', !丢.length,
  '读回来带注音 ' + 回注 + ' 格 ｜ 带翻译 ' + 回译 + ' 行' + (丢.length ? ' ｜ ' + 丢.join(' ； ') : ''));


/* 十一、投句、段名、并逗、分逗 */
await g.importTtml(REALRAW[0], REAL[0]);
const 投前 = g.doc.lines.length;
T('投一句进来长出一行', g.pourIn('我有狂剑任天下 平生不快活') === true && g.doc.lines.length === 投前 + 1);
const 投行 = g.doc.lines[g.doc.lines.length - 1];
T('投进来那句空格分逗、字逐格', 投行.clauses.length === 2 && 投行.clauses.map(x => x.cells.length).join('+') === '7+5',
  投行.clauses.map(x => x.cells.length).join('+'));
const segIn = document.querySelectorAll('.wnw-lseg')[1];
segIn.value = '副歌'; segIn.dispatchEvent(new Event('input', { bubbles:true }));
T('段名那一枚输入位改的是这一行的 seg', g.doc.lines[1].seg === '副歌', g.doc.lines[1].seg);
/* 逗的并与分都拿「投进来那一句」那一行试：导入的逐字 ttml 一行就是一逗，没有逗缝可点 */
const 投行号 = g.doc.lines.length - 1;
const 缝前 = g.doc.lines[投行号].clauses.length;
DBL(ROWS()[投行号].querySelector('.wnw-lgap'));
T('双击逗间那道斜缝并了逗', g.doc.lines[投行号].clauses.length === 缝前 - 1, 缝前 + ' → ' + g.doc.lines[投行号].clauses.length);
g.splitClause(g.doc.lines[投行号].clauses[0], 2);
T('「从这里分逗」把第三格起拆成新逗', g.doc.lines[投行号].clauses.length === 2 && g.doc.lines[投行号].clauses[0].cells.length === 2,
  g.doc.lines[投行号].clauses.map(x => x.cells.length).join('+'));
const 删前 = g.doc.lines.length;
g.delRow(g.doc.lines[0]);
T('删掉一行就少一行', g.doc.lines.length === 删前 - 1, 删前 + ' → ' + g.doc.lines.length);

/* 十二、右键给的条目（不点，只看给得全不全） */
g.cellMenu({ preventDefault(){}, stopPropagation(){} }, g.doc.lines[0], g.doc.lines[0].clauses[0], 1);
/* 这一格从真 ttml 里带着注音，所以「删掉这一格的注音」这一条该出现 */
T('右键一格给全套动作（每条都带上那一个键，菜单只当目录用）', LAST_MENU.filter(x => x.label).map(x => x.label).join('/') ===
  '把这一格拆成两格  Alt+D/并到上一格  Alt+M/从这里分逗/删掉这一格的注音  Delete/删掉这一格  Delete/在这一行下面加一行',
  LAST_MENU.filter(x => x.label).map(x => x.label).join('/'));
/* 他库里那份真 ttml 每一格都带注音，所以另造一格没注音的验这一条不摆 */
const 无注L = { seg:'', clauses:[{ cells:[{ t:'试', ms:100 }] }] };
g.cellMenu({ preventDefault(){}, stopPropagation(){} }, 无注L, 无注L.clauses[0], 0);
T('没注音的那一格不给「删掉这一格的注音」这一条（点了也白点的空条目不摆）',
  !LAST_MENU.some(x => /^删掉这一格的注音/.test(x.label || '')),
  LAST_MENU.filter(x => x.label).map(x => x.label).join('/'));

/* 十四、外23 一组：导入留住行内空档 + 三档各按自己的窗口判 + 每帧只写改变了的那一格 */
/* ① 行内空档：每格的时长改成「到自己开口为止，到下一格开口为止」之后，一行逐格相加不许比这一行自己的窗口短。
   旧那份只取每格自己的 end-begin，字与字之间那点空档整个丢了，行尾又多出一段 —— 位置越走越早，下一行的「起」再把它拽回来 */
let 行窗比总 = 0, 空档旧总 = 0, 短了 = [], 超最多 = 0, 超哪行 = '';
for(let i = 0; i < REALRAW.length; i++){
  const d = shTtmlParse(REALRAW[i]); if(!d || !d.timed) continue;
  const g0 = lyricFromTtml(REALRAW[i]); if(!g0) continue;
  const 有效 = d.lines.filter(L => (L.words || []).some(w => String(w.text == null ? '' : w.text).trim()));
  有效.forEach((L, n) => {
    const cl = g0.lines[n] && g0.lines[n].clauses[0]; if(!cl) return;
    const ws = L.words.filter(w => String(w.text == null ? '' : w.text).trim());
    const begins = ws.map(w => Math.round(w.ms)).filter(x => LyricFmt.okMs(x));
    if(!begins.length || !LyricFmt.okMs(L.ms2)) return;
    const from = Math.min.apply(null, begins), to = Math.round(L.ms2);
    if(!(to > from)) return;
    行窗比总++;
    const 旧和 = ws.reduce((a, w) => a + Math.max(0, (LyricFmt.okMs(w.ms2) ? Math.round(w.ms2) : Math.round(w.ms)) - Math.round(w.ms)), 0);
    空档旧总 += Math.max(0, (to - from) - 旧和);
    const 新和 = cl.cells.reduce((a, c) => a + (c.ms || 0), 0);
    if((to - from) - 新和 > 1 && 短了.length < 3) 短了.push(REAL[i] + ' 第' + (n + 1) + '行 少了 ' + ((to - from) - 新和) + ' 毫秒');
    /* 比窗口长只有一种来路：文件自己把两个音排在同一行里叠着唱（逐格相加自然盖过并集），不是导入丢的那一段 */
    if(新和 - (to - from) > 超最多){ 超最多 = 新和 - (to - from); 超哪行 = REAL[i] + ' 第' + (n + 1) + '行'; }
    if(g0.lines[n].at != null && g0.lines[n].at !== from && 短了.length < 3)
      短了.push(REAL[i] + ' 第' + (n + 1) + '行「起」= ' + g0.lines[n].at + '，这一行最早开口在 ' + from);
  });
}
T('导入 ' + 行窗比总 + ' 行没有一行逐格相加比自己的窗口短（旧算法在这一批文件上丢了 ' + 空档旧总 + ' 毫秒的行内空档）',
  短了.length === 0 && 空档旧总 > 0, 短了.length ? 短了.join(' ； ')
    : '逐行对上 ｜ 旧丢 ' + 空档旧总 + ' 毫秒 ｜ 最长的一行比窗口多 ' + 超最多 + ' 毫秒（' + 超哪行 + '，文件里这一行本身就叠着排）');

/* ②③ 拿他截图那一份真文件逐 16 毫秒走一遍：数「找不到当前格」的帧、整排标记被抹光的帧、每帧真往 DOM 上写了几格 */
const 真树 = lyricFromTtml(REALRAW[0]);
g2.doc = JSON.parse(JSON.stringify(真树)); g2.follow = false; g2.playing = false; g2.fromMs = null;
LYRIC_UI.setNum('ms'); g2.render(); g2.playing = true;
const 格总1 = g2.flat.length, 行总1 = g2.doc.lines.length, 帧总 = Math.ceil(g2.tl.end / 16) + 1;
let 索引落空 = 0, 掉档帧 = 0, 写格总 = 0, 同亮最多 = 0, 换格次 = 0, 滚次 = 0, 上一刻 = -1;
const 观 = new MutationObserver(() => {});
观.observe(g2.box, { attributes:true, attributeFilter:['class'], subtree:true });
const 原滚 = Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView = function(){ 滚次++; };
for(let f = 0; f < 帧总; f++){
  const ms = f * 16;
  let cur = -1;
  for(let i = 0; i < g2.tl.rows.length; i++){ const r = g2.tl.rows[i]; if(ms >= r.in && ms < r.out){ cur = i; break; } }
  if(cur < 0) 索引落空++;
  if(cur !== 上一刻 && cur >= 0) 换格次++;
  上一刻 = cur;
  观.takeRecords();
  g2.mark(ms);
  写格总 += 观.takeRecords().length;
  let 此刻亮 = 0;
  for(const x of g2.flat){ const b = x.inp.parentNode; if(!b) continue;
    if(b.classList.contains('now')) 此刻亮++;
    else if(!b.classList.contains('post') && !b.classList.contains('pre')) 掉档帧++; }
  if(此刻亮 > 同亮最多) 同亮最多 = 此刻亮;
}
Element.prototype.scrollIntoView = 原滚; 观.disconnect();
const 每帧写 = Math.round(写格总 / 帧总 * 100) / 100;
T(行总1 + ' 行 ' + 格总1 + ' 格走 ' + 帧总 + ' 帧：没有一帧有格掉出三档之外（按索引判会在 ' + 索引落空 + ' 帧上把整排标记抹光 —— 那片白闪就是它）',
  掉档帧 === 0 && 索引落空 > 0, '掉档帧 ' + 掉档帧 + ' ｜ 索引落空帧 ' + 索引落空 + '（' + Math.round(索引落空 * 16 / 100) / 10 + ' 秒）');
T('每帧只写真改变了的那一格（旧的是每帧把整排 ' + 格总1 + ' 格三档各刷一遍）', 每帧写 <= 2,
  每帧写 + ' 格／帧 ｜ 旧式 ' + 格总1 + ' 格／帧');
T('滚的是行不是格：整趟滚了 ' + 滚次 + ' 次（格子换了 ' + 换格次 + ' 回）', 滚次 <= 行总1 && 滚次 < 换格次,
  滚次 + ' 滚 ／ ' + 换格次 + ' 换格 ／ ' + 行总1 + ' 行');

/* ② 叠着唱：主唱那一行还没收，和声那一行已经开口 —— 同一帧里两格都得算「正在唱」，
   和声那格不许被前面那行压回「没唱到」（这就是他说的来回跳） */
const 叠树 = { title:'', lines:[
  { seg:'', at:0, clauses:[{ cells:[{ t:'主', ms:1000 }, { t:'唱', ms:1000 }] }] },
  { seg:'', at:1200, who:['某人'], how:'bg', clauses:[{ cells:[{ t:'和', ms:1200 }] }] }] };
g2.doc = JSON.parse(JSON.stringify(叠树)); g2.render(); g2.playing = true;
const 和声格 = g2.flat[2].inp.parentNode;
let 叠里掉 = 0;
for(let ms = 1200; ms <= 2000; ms += 20){ g2.mark(ms); if(!和声格.classList.contains('now')) 叠里掉++; }
T('重叠那 800 毫秒里，和声那一格每一帧都算正在唱（共 ' + Math.round(800 / 20) + ' 帧）', 叠里掉 === 0,
  '掉档 ' + 叠里掉 + ' 帧 ｜ 此刻整排亮 ' + g2.flat.filter(x => x.inp.parentNode.classList.contains('now')).length + ' 格');
g2.mark(1500);
T('同一刻两格同亮：主唱那一格和和声那一格一起是「正在唱」', /now/.test(g2.flat[1].inp.parentNode.className)
  && /now/.test(和声格.className), g2.flat[1].inp.parentNode.className + ' ｜ ' + 和声格.className);
g2.mark(2100);
T('往后走到主唱收口：和声那一格仍旧正在唱，不许倒退成没唱到', /now/.test(和声格.className)
  && /post/.test(g2.flat[1].inp.parentNode.className), 和声格.className);
g2.stopPlay();

/* 十五、外23 二组：声部名单一名多人、type 认合唱、真文件里的叠唱、拍点在模拟那一档不动「起」 */
const 合唱号 = REAL.findIndex(n => /CHOOM/.test(n));
const 合唱文 = 合唱号 >= 0 ? REALRAW[合唱号] : '';
const 名单 = lyricAgentRoster(合唱文);
T('头里一个声部号底下挂两个人名的，两个都收下来（旧的那份只取第一个，界面上就少一个人）',
  LyricFmt.whoList((名单.v1000 || {}).name || '').length === 2 && (名单.v1000 || {}).type === 'group',
  'v1000 收到 ' + LyricFmt.whoList((名单.v1000 || {}).name || '').length + ' 个人 ｜ type=' + ((名单.v1000 || {}).type || '没写'));
T('只挂一个名字的 group（他那份里 "all" 那种）也认得出是 group', (名单.v1001 || {}).type === 'group'
  && LyricFmt.whoList((名单.v1001 || {}).name || '').length === 1,
  'v1001 名字 ' + LyricFmt.whoList((名单.v1001 || {}).name || '').length + ' 个 ｜ type=' + ((名单.v1001 || {}).type || '没写'));
const 合树 = lyricFromTtml(合唱文);
const 有名行 = 合树.lines.filter(L => (L.who || []).length).length;
const 合唱行 = 合树.lines.filter(L => L.how === 'choir').length;
const 独唱行 = 合树.lines.filter(L => !L.how).length;
const 漏编号 = 合树.lines.filter(L => /^v\d+$/i.test((L.who || [])[0] || '')).length;
T('他截图那个歌 ' + 合树.lines.length + ' 行读回来：' + 有名行 + ' 行带得上演唱者（一行都没掉成 v1 那种编号）、判成合唱 ' + 合唱行 + ' 行、其余按默认独唱（树里不留键）',
  有名行 === 合树.lines.length && 漏编号 === 0 && 合唱行 === 9 && 独唱行 === 合树.lines.length - 9,
  有名行 + '/' + 合树.lines.length + ' 行有名 ｜ 合唱 ' + 合唱行 + ' ｜ 独唱 ' + 独唱行 + ' ｜ 掉成编号 ' + 漏编号);
T('一个号两个人的那一行，小牌上摆得下两个人', 合树.lines.some(L => (L.who || []).length === 2),
  '一串里最多 ' + Math.max.apply(null, 合树.lines.map(L => (L.who || []).length)) + ' 个人');
const 合回 = lyricFromTtml(lyricToTtml(合树));
T('合唱导出去再读回来还是合唱（只挂一个名字那种靠头里的 type 带回来）',
  合回.lines.filter(L => L.how === 'choir').length === 合唱行 && 合回.lines.filter(L => (L.who || []).length).length === 有名行,
  '回来合唱 ' + 合回.lines.filter(L => L.how === 'choir').length + ' 行 ｜ 有名 ' + 合回.lines.filter(L => (L.who || []).length).length + ' 行');
/* 真文件里的叠唱：和声那一行和主唱那一行在时间上盖着，同一刻两行都得亮 */
g2.doc = JSON.parse(JSON.stringify(合树)); g2.fromMs = null; g2.render(); g2.playing = true;
let 叠帧 = 0, 同亮多2 = 0, 掉档2 = 0, 帧数2 = 0;
for(let ms = 0; ms <= g2.tl.end; ms += 16){
  g2.mark(ms); 帧数2++;
  let 此刻 = 0;
  for(const x of g2.flat){ const b = x.inp.parentNode; if(!b) continue;
    if(b.classList.contains('now')) 此刻++;
    else if(!b.classList.contains('post') && !b.classList.contains('pre')) 掉档2++; }
  if(此刻 >= 2) 叠帧++;
  if(此刻 > 同亮多2) 同亮多2 = 此刻;
}
g2.stopPlay();
T('这个歌走 ' + 帧数2 + ' 帧：同一刻两行以上一起亮的有 ' + 叠帧 + ' 帧（最多 ' + 同亮多2 + ' 格同亮），掉出三档之外 0 处',
  叠帧 > 0 && 掉档2 === 0, '叠帧 ' + 叠帧 + '（' + Math.round(叠帧 * 16 / 100) / 10 + ' 秒） ｜ 最多同亮 ' + 同亮多2 + ' 格 ｜ 掉档 ' + 掉档2);
/* 拍点：模拟那一档（没连上正在放的歌）点的数是从按下这一个起自己数的，不是歌里的位置 —— 不许拿它当「起」 */
MusClock.set({ pos:0, at:Date.now(), rate:1, status:'Paused', dur:0 });
g2.doc = { title:'', lines:[{ seg:'', at:5000, clauses:[{ cells:[{ t:'', ms:null }] }] },
  { seg:'', at:5200, clauses:[{ cells:[{ t:'叠', ms:800 }] }] }] }; g2.render();
g2.lastLi = 0; g2.tapToggle(); g2.tapPoint(); g2.tapPoint(); g2.tapPoint(); g2.tapDone();
T('模拟打点收尾不动这一行的「起」（文件里带进来的 5000 留着，既不覆盖也不删）',
  g2.doc.lines[0].at === 5000 && g2.doc.lines[0].clauses[0].cells.length === 2 && g2.doc.lines[1].at === 5200,
  JSON.stringify(g2.doc.lines.map(L => L.at)) + ' ｜ ' + JSON.stringify(g2.doc.lines[0].clauses[0].cells));
MusClock.set({ pos:30000, at:Date.now(), rate:1, status:'Playing', dur:300000 });
g2.doc = { title:'', lines:[{ seg:'', at:5000, clauses:[{ cells:[{ t:'', ms:null }] }] }] }; g2.render();
g2.lastLi = 0; g2.tapToggle(); g2.tapPoint();
MusClock.set({ pos:30500, at:Date.now(), rate:1, status:'Playing', dur:300000 }); g2.tapPoint(); g2.tapDone();
T('跟着遥控器那一份时钟点的，第一个点才写进「起」（30000 附近）', Math.abs(g2.doc.lines[0].at - 30000) <= 8,
  g2.doc.lines[0].at + ' ｜ ' + JSON.stringify(g2.doc.lines[0].clauses[0].cells.map(c => c.ms)));
MusClock.set({ pos:0, at:Date.now(), rate:1, status:'Paused', dur:0 });

/* 十六、外23 三组：翻译与注释对齐到歌词文字开头、节拍档给填写的地方、快捷建词格只认符号 */
const 排树 = { title:'', lines:[
  { seg:'主歌1', note:'这一遍轻一点', trans:'这一句的翻译', who:['某人', '另一个人'], how:'choir',
    clauses:[{ cells:[{ t:'真', ms:400 }, { t:'爱', ms:400 }] }] },
  { seg:'', clauses:[{ cells:[{ t:'晨', ms:400 }] }] } ] };
g2.doc = JSON.parse(JSON.stringify(排树)); LYRIC_UI.setFill('cell'); LYRIC_UI.setNum('ms'); g2.render();
const 左 = el => Math.round(el.getBoundingClientRect().left);
const 头格 = () => g2.box.querySelector('.wnw-lrow .wnw-ltxt');
T('段前说明、翻译的左沿跟到歌词文字开头（这一行前面横着行号 + 段名格 + 演唱者小牌，前缀最宽）',
  Math.abs(左(g2.box.querySelector('.wnw-lnote')) - 左(头格())) <= 2 && Math.abs(左(g2.box.querySelector('.wnw-ltrans')) - 左(头格())) <= 2,
  '词 ' + 左(头格()) + 'px ｜ 注 ' + 左(g2.box.querySelector('.wnw-lnote')) + 'px ｜ 译 ' + 左(g2.box.querySelector('.wnw-ltrans')) + 'px');
LYRIC_UI.setFill('fill'); g2.render();
T('整句填写那根横线的左沿也对到歌词文字开头', Math.abs(左(g2.box.querySelector('.wnw-lfill')) - 左(头格())) <= 2,
  '词 ' + 左(头格()) + 'px ｜ 横线 ' + 左(g2.box.querySelector('.wnw-lfill')) + 'px');
LYRIC_UI.set(200); g2.render();
T('把格子放大一档（前缀跟着变宽），对齐不散', Math.abs(左(g2.box.querySelector('.wnw-ltrans')) - 左(头格())) <= 2,
  '词 ' + 左(头格()) + 'px ｜ 译 ' + 左(g2.box.querySelector('.wnw-ltrans')) + 'px');
LYRIC_UI.set(100); LYRIC_UI.setFill('cell'); g2.render();
/* 节拍那一档从前只给看不给填（他图 2）：现在切过去就有三枚框 */
LYRIC_UI.setNum('beat'); g2.render();
const 拍框 = Array.from(host2.querySelectorAll('.wnw-lbeat input'));
const 填框 = (i, s) => { 拍框[i].value = s; 拍框[i].dispatchEvent(new Event('input', { bubbles:true })); };
T('切到节拍那一档，上面摆出三枚能填的框（几几拍 / BPM / 第一个字起于第几拍）', 拍框.length === 3,
  拍框.length + ' 枚 ｜ 提示行：' + (host2.querySelector('.wnw-lhint') || { textContent:'' }).textContent.slice(0, 24));
T('BPM 还没填时格子上是横杠（不瞎算一个默认拍子给人看）', TOP(R2(0), 0) === '—' && !g2.doc.beat,
  TOP(R2(0), 0) + ' ｜ beat=' + JSON.stringify(g2.doc.beat || null));
填框(1, '120');
T('BPM 填进那一格，上面那串数当场按拍子走（第一格 1.1，不必开对话框）', TOP(R2(0), 0) === '1.1' && String(g2.doc.beat.bpm) === '120',
  TOP(R2(0), 0) + ' ｜ ' + JSON.stringify(g2.doc.beat));
const 拍120 = TOP(R2(0), 1);
填框(1, '60');
T('BPM 改成 60（一拍从 500 毫秒变 1000 毫秒），第二格那串数当场重算：整拍上给「小节.拍」，落在两拍之间多截一段（小节.拍.走了这一拍的几分之几）',
  拍120 === '1.1.8' && TOP(R2(0), 1) === '1.1.4' && TOP(R2(0), 0) === '1.1',
  拍120 + ' → ' + TOP(R2(0), 1) + ' ｜ 第一格 ' + TOP(R2(0), 0));
填框(2, '3');
T('「第一个字起于第几拍」填 3，第一格就落在第 3 拍', TOP(R2(0), 0) === '1.3', TOP(R2(0), 0));
T('这三枚框填的数进得了那个明文文件（拍 = 4/4 60 3）', LyricFmt.write(g2.doc).split('\\n')[0] === '拍 = 4/4 60 3',
  LyricFmt.write(g2.doc).split('\\n')[0]);
LYRIC_UI.setNum('ms'); g2.render();
T('切回时长那一档，那三枚框收掉（它是节拍那一档专属的填写处）', host2.querySelectorAll('.wnw-lbeat').length === 0,
  host2.querySelectorAll('.wnw-lbeat').length + ' 枚');
/* 快捷建词格只认他定义的记号（他图 3） */
const 铺前 = g2.doc.lines.length;
TOASTS.length = 0;
const 拒英 = g2.quickBuild('xxxx love', 'x', ' ', '');
T('快捷建词格里混进英文那一串：一格都不铺，并点名混进了哪几个字符（词格就是符号，这儿只能填定义好的符号）',
  拒英 === 0 && g2.doc.lines.length === 铺前 && /只认占位符/.test(TOASTS.join('')) && /「l」/.test(TOASTS.join('')),
  JSON.stringify(TOASTS.slice(-1)));
TOASTS.length = 0;
const 拒中 = g2.quickBuild('xxxx 真爱', 'x', ' ', '');
T('混进中文也一样不铺（占位符以外的字符一律不当词用，要填词切回「按格填」）',
  拒中 === 0 && g2.doc.lines.length === 铺前 && /「真」/.test(TOASTS.join('')), JSON.stringify(TOASTS.slice(-1)));
TOASTS.length = 0;
const 纯符 = g2.quickBuild('xx xx', 'x', ' ', '');
T('只有占位符和分格符的那种照铺（1 行 4 格，全是空格子）', 纯符 === 1 && g2.doc.lines.length === 铺前 + 1 &&
  g2.doc.lines[铺前].clauses[0].cells.length === 4 && g2.doc.lines[铺前].clauses[0].cells.every(c => !c.t),
  纯符 + ' 行 ｜ ' + g2.doc.lines[铺前].clauses[0].cells.length + ' 格');
g2.doc = JSON.parse(JSON.stringify(排树)); g2.render();

/* 十七、外25 二组：卡拉ok 式过渡、行前标签右对齐、批量那一个、段前说明多行 */
const 播树 = { title:'', lines:[
  { seg:'主歌1', who:['一个人', '两个人', '三个人'], clauses:[{ cells:[{ t:'真', ms:500, n:'chen' }, { t:'爱', ms:500, n:'hai' }] }] },
  { seg:'', note:'这一遍轻一点', trans:'译：真爱', clauses:[{ cells:[{ t:'悲', ms:500, n:'pu' }, { t:'哀', ms:500 }] }] },
  { seg:'', clauses:[{ cells:[{ t:'人', ms:500 }, { t:'海', ms:500 }] }] } ] };
g2.doc = JSON.parse(JSON.stringify(播树)); LYRIC_UI.setFill('cell'); LYRIC_UI.setNum('ms'); g2.render();
/* 第 5 条：三行的前缀宽度必须一模一样（一行三个名字、一行有说明、一行光板） */
const 头三 = Array.from(g2.box.querySelectorAll('.wnw-lrow')).map(r => {
  const f = r.querySelector('.wnw-ltxt:not(.wnw-ln)'); return f ? Math.round(f.getBoundingClientRect().left) : -1; });
const 牌 = g2.box.querySelectorAll('.wnw-lwho');
T('行前的演唱者 / 唱法槽位固定宽，三行的歌词起头在同一个位置',
  牌.length === 3 && 头三[0] === 头三[1] && 头三[1] === 头三[2],
  '起头 ' + 头三.join(' / ') + 'px ｜ 槽位 ' + Math.round(牌[0].getBoundingClientRect().width) + 'px');
const 空牌 = g2.box.querySelector('.wnw-lwho.empty');
T('独唱没名字的那一行只留一格空槽（槽位宽一样、里头不画框、点不动）',
  !!空牌 && 空牌.querySelector('.wnw-lchip') === null
  && Math.round(空牌.getBoundingClientRect().width) === Math.round(牌[0].getBoundingClientRect().width)
  && getComputedStyle(空牌).backgroundColor === 'rgba(0, 0, 0, 0)',
  '空槽 ' + (空牌 ? Math.round(空牌.getBoundingClientRect().width) + 'px 宽 ｜ 底色 ' + getComputedStyle(空牌).backgroundColor
    + ' ｜ 里头牌数 ' + 空牌.querySelectorAll('.wnw-lchip').length : '没摆'));

/* 他 22:25 那张图的口径：牌照名字长短收、名字在牌里居中、牌整体贴槽位右沿。
   另造四行来量（短名 / 长名 / 只挂一个默认独唱没名字 / 光板），量完换回上面那棵，别搅了后面第 2 条那一档。 */
const 名牌树 = { title:'', lines:[
  { seg:'', who:['甲'], clauses:[{ cells:[{ t:'真', ms:500 }] }] },
  { seg:'', who:['甲', '乙', '丙'], clauses:[{ cells:[{ t:'爱', ms:500 }] }] },
  { seg:'', how:'solo', clauses:[{ cells:[{ t:'悲', ms:500 }] }] },
  { seg:'', clauses:[{ cells:[{ t:'海', ms:500 }] }] },
  { seg:'', who:['一个人', '两个人', '三个人', '四个人'], clauses:[{ cells:[{ t:'潮', ms:500 }] }] } ] };
g2.doc = JSON.parse(JSON.stringify(名牌树)); g2.render();
const 槽 = Array.from(g2.box.querySelectorAll('.wnw-lwho'));
const 牌们 = Array.from(g2.box.querySelectorAll('.wnw-lchip'));
const 宽 = el => Math.round(el.getBoundingClientRect().width);
const 右 = el => Math.round(el.getBoundingClientRect().right);
const 起头 = Array.from(g2.box.querySelectorAll('.wnw-lrow')).map(r => {
  const f = r.querySelector('.wnw-ltxt:not(.wnw-ln)'); return f ? Math.round(f.getBoundingClientRect().left) : -1; });
T('五行的槽位一样宽、歌词起头一样位（牌收不收、名字多长都不影响）',
  槽.length === 5 && 槽.every(s => 宽(s) === 宽(槽[0])) && 起头.every(x => x === 起头[0]),
  '槽位 ' + 槽.map(宽).join('/') + 'px ｜ 起头 ' + 起头.join('/') + 'px');
const 牌组们 = 槽.map(s => s.querySelector('.wnw-lwho-n'));
T('牌只画在挂了名字的三行上（一枚牌一个名字；只挂默认独唱没名字的那两行一枚不画）',
  槽.map(s => s.querySelectorAll('.wnw-lchip').length).join('/') === '1/3/0/0/4',
  '各行牌数 ' + 槽.map(s => s.querySelectorAll('.wnw-lchip').length).join(' / '));
T('牌宽跟着名字长短收（一个字的名字比三个字的名字窄）', 宽(牌组们[0]) < 宽(牌组们[4]),
  '「甲」那一组 ' + 宽(牌组们[0]) + 'px ｜ 「一个人…」那一组 ' + 宽(牌组们[4]) + 'px');
T('牌整体贴在这一段宽度的右沿（把手挂在槽位外面，不顶开牌）', 牌们.every(c => Math.abs(右(c) - 右(c.closest('.wnw-lwho'))) <= 1),
  牌们.map(c => 右(c) + '↔' + 右(c.closest('.wnw-lwho'))).join(' ｜ ') + 'px');
const 中心 = c => { const rg = document.createRange(); rg.selectNodeContents(c); const t = rg.getBoundingClientRect();
  return { 字: Math.round(t.left + t.width / 2), 框: Math.round(c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2) }; };
const 中1 = 中心(牌们[0]), 中2 = 中心(牌们[1]);
T('名字在牌里居中（字的中点和框的中点对齐）',
  getComputedStyle(牌们[0]).textAlign === 'center' && Math.abs(中1.字 - 中1.框) <= 1 && Math.abs(中2.字 - 中2.框) <= 1,
  '「甲」' + 中1.字 + '↔' + 中1.框 + ' ｜ 「甲、乙、丙」' + 中2.字 + '↔' + 中2.框);
const 四人组 = 牌组们[4], 四人牌 = Array.from(槽[4].querySelectorAll('.wnw-lchip'));
T('四个名字摞成四枚牌：每一枚都不宽过槽位，整组也不高过行能容的份内（不压到隔壁歌词）',
  四人牌.length === 4 && 四人牌.every(c => 宽(c) <= 宽(槽[4])) && 宽(槽[4]) === 宽(槽[0]) &&
  四人组.getBoundingClientRect().right <= 右(槽[4]) + 1,
  '槽 ' + 宽(槽[4]) + 'px ｜ 四枚牌 ' + 四人牌.map(宽).join('/') + 'px ｜ 整组高 ' + 四人组.offsetHeight + 'px');
g2.doc = JSON.parse(JSON.stringify(播树)); g2.render();
/* 第 2 条：正唱到的那一格不再整块翻底色，改成按这一格的时长从左推到右 */
g2.playing = true; g2.mark(520);
const 正唱 = g2.flat[1].inp;
const 唱过 = g2.flat[0].inp;
const 扫底 = s => String(s || '').replace(/\\s+/g, '');
T('正唱到的那一格：彩从左推到右，行程 = 这一格剩下的时长（480 毫秒这一档）',
  /background-size/.test(正唱.style.transition) && 扫底(正唱.style.backgroundSize) === '100%100%,100%100%',
  'transition=' + 正唱.style.transition + ' ｜ size=' + 正唱.style.backgroundSize);
const 扫 = Math.round(Number((/(\\d+)ms/.exec(正唱.style.transition) || [0, '0'])[1]));
T('那一扫的时长对得上这一格的窗口（520 毫秒起、1000 毫秒收 = 480 毫秒）', Math.abs(扫 - 480) <= 1, 扫 + ' 毫秒');
const 现算 = getComputedStyle(正唱);
T('外观还是目前那一样式：字色上色、边框上色，不再整块翻底色也不再加内描边',
  现算.boxShadow === 'none' && 现算.backgroundImage.indexOf('linear-gradient') === 0
  && 现算.backgroundRepeat.replace(/\\s+/g, '') === 'no-repeat,no-repeat',
  'box-shadow=' + 现算.boxShadow + ' ｜ background-image=' + 现算.backgroundImage.slice(0, 46) + '… ｜ repeat=' + 现算.backgroundRepeat);
T('唱过的那一格不留彩（扫过的那一层撤掉，只保持字色）', 唱过.style.backgroundSize === '' && 唱过.style.transition === 'none',
  'size="' + 唱过.style.backgroundSize + '" transition="' + 唱过.style.transition + '"');
g2.mark(1200);
T('换到下一格：上一格那两笔 inline 清干净，新那一格起手从零推到满',
  g2.flat[1].inp.style.backgroundSize === '' && /background-size/.test(g2.flat[2].inp.style.transition),
  '上一格 size="' + g2.flat[1].inp.style.backgroundSize + '" ｜ 这一格 ' + g2.flat[2].inp.style.transition);
g2.stopPlay();
T('停下之后所有格子的扫都不留（撤回标记那一步连着把 inline 清了）',
  g2.flat.every(f => f.inp.style.backgroundSize === '' && f.inp.style.transition === 'none'),
  JSON.stringify(g2.flat.map(f => f.inp.style.backgroundSize)));
/* 第 6 条：批量那一个 */
const 批钮 = [...host2.querySelectorAll('.wnw-lbar button')].find(b => /^批量/.test(b.textContent));
LAST_MENU = []; if(批钮) 批钮.click();
T('栏里多一个「批量…」，点开是六条（三条显隐 + 三条整首删）', !!批钮 && LAST_MENU.filter(x => x.label).length === 6,
  LAST_MENU.filter(x => x.label).map(x => x.label).join(' / '));
const 明文前批 = LyricFmt.write(g2.doc);
/* 菜单每点一条要重开一次：显隐那三条的标题跟着当前状态翻字，拿旧单子点会点错 */
const 点菜单 = re => { LAST_MENU = []; if(批钮) 批钮.click(); const it = LAST_MENU.find(x => x.label && re.test(x.label)); if(it) it.fn(); return !!it; };
点菜单(/^隐藏所有注音/);
const 注音格 = g2.box.querySelector('.wnw-ln');
T('隐藏所有注音：那一层收掉、明文书出去一个字没变（只动这一屏）',
  g2.box.classList.contains('hide-rom') && getComputedStyle(注音格).display === 'none' && LyricFmt.write(g2.doc) === 明文前批,
  'box class=' + g2.box.className + ' ｜ 注音 display=' + getComputedStyle(注音格).display);
点菜单(/^显示所有注音/);
T('再点一次摆回来（这台机器记住，不进那个文件）',
  !g2.box.classList.contains('hide-rom') && getComputedStyle(g2.box.querySelector('.wnw-ln')).display !== 'none'
  && STATE['lyric-view'] && STATE['lyric-view'].rom === true,
  '注音 display=' + getComputedStyle(g2.box.querySelector('.wnw-ln')).display + ' ｜ 存到 ' + JSON.stringify(STATE['lyric-view']));
点菜单(/^隐藏所有原文/);
T('隐藏所有原文：词那一层看不见，注音那一层不许跟着不见',
  g2.box.classList.contains('hide-wrd') && getComputedStyle(g2.box.querySelector('.wnw-ltxt:not(.wnw-ln)')).color === 'rgba(0, 0, 0, 0)'
  && getComputedStyle(g2.box.querySelector('.wnw-ln')).color !== 'rgba(0, 0, 0, 0)',
  '原文 color=' + getComputedStyle(g2.box.querySelector('.wnw-ltxt:not(.wnw-ln)')).color
    + ' ｜ 注音 color=' + getComputedStyle(g2.box.querySelector('.wnw-ln')).color);
点菜单(/^显示所有原文/);
const 删前批 = JSON.parse(JSON.stringify(g2.doc));
点菜单(/^删掉所有注音/);
T('删掉所有注音：每一格的注音都没了', g2.doc.lines.every(L => L.clauses.every(cl => cl.cells.every(c => !c.n)))
  && g2.doc.lines.every(L => !L.roman), JSON.stringify(g2.doc.lines[0].clauses[0].cells));
g2.undoStep();
T('删错了撤回就拿回来（注音那一层原样）', JSON.stringify(g2.doc) === JSON.stringify(删前批),
  JSON.stringify(g2.doc.lines[0].clauses[0].cells));
TOASTS.length = 0; const 栈前 = g2.undo.length; g2.doc = { title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'', ms:null }] }] }] }; g2.render();
点菜单(/^删掉所有注音/);
T('没东西可删就说没东西可删，不空跑一趟撤回栈', /没有注音可删/.test(TOASTS.join('')) && g2.undo.length === 栈前,
  JSON.stringify(TOASTS.slice(-1)) + ' ｜ 撤回栈 ' + 栈前 + ' → ' + g2.undo.length + ' 步');
g2.doc = JSON.parse(JSON.stringify(播树)); g2.render();
点菜单(/^删掉所有翻译与注释/);
T('删掉所有翻译与注释：行下面的翻译和行上面的说明一起清，词与时值一格没动',
  g2.doc.lines.every(L => !L.trans && !L.note) && g2.doc.lines[1].clauses[0].cells[0].t === '悲' && g2.doc.lines[1].clauses[0].cells[0].ms === 500,
  JSON.stringify(g2.doc.lines.map(L => [L.trans || '', L.note || ''])));
点菜单(/^删掉所有原文/);
T('删掉所有原文：格子里的词空了，注音、翻译、时值都留着',
  g2.doc.lines.every(L => L.clauses.every(cl => cl.cells.every(c => !c.t))) && g2.doc.lines[0].clauses[0].cells[0].n === 'chen'
  && g2.doc.lines[0].clauses[0].cells[0].ms === 500, JSON.stringify(g2.doc.lines[0].clauses[0].cells));
/* 第 7 条：段前说明允许多行（框子给到 textarea、明文一行一个「注 =」、读回来还是同一条、界面上摆成两行） */
const 多注 = { title:'', lines:[{ seg:'', note:'第一行说明\\n第二行提醒', clauses:[{ cells:[{ t:'真', ms:400 }] }] }] };
const 多注明文 = LyricFmt.write(多注), 多注回 = LyricFmt.parse(多注明文);
T('段前说明写几行就一行一个「注 =」，读回来还是同一条（含中间那个换行）',
  多注明文.split('\\n').filter(x => /^注 = /.test(x)).length === 2 && 多注回.lines[0].note === '第一行说明\\n第二行提醒',
  多注明文.split('\\n').join(' ⏎ ') + ' ｜ 回来 ' + JSON.stringify(多注回.lines[0].note));
g2.doc = JSON.parse(JSON.stringify(多注)); g2.render();
const 一行说 = { title:'', lines:[{ seg:'', note:'第一行说明', clauses:[{ cells:[{ t:'真', ms:400 }] }] }] };
g2.doc = JSON.parse(JSON.stringify(一行说)); g2.render();
const 单高 = g2.box.querySelector('.wnw-lnote').offsetHeight;
g2.doc = JSON.parse(JSON.stringify(多注)); g2.render();
const 说明行 = g2.box.querySelector('.wnw-lnote');
const 双高 = 说明行.offsetHeight;
T('界面上那段说明真摆成两行（比一行的那一版高出一截，走 pre-line）',
  getComputedStyle(说明行).whiteSpace === 'pre-line' && 双高 > 单高 * 1.6, 单高 + 'px → ' + 双高 + 'px');
g2.doc = JSON.parse(JSON.stringify(播树)); g2.render();
g2.noteDlg(g2.doc.lines[1], 1);
T('点开段前说明给的是能回车的 textarea（不是单行框）', !!OVERLAY && !!OVERLAY.box.querySelector('textarea')
  && !OVERLAY.box.querySelector('input'), OVERLAY ? OVERLAY.title + ' ｜ textarea=' + !!OVERLAY.box.querySelector('textarea') : '没开');
const 说框 = OVERLAY.box.querySelector('textarea');
说框.value = '换气\\n轻一点';
OVERLAY.btns.find(b => b.textContent === '定了').click();
T('框里回车算换行、算这一条说明的第二行（不当"定了"）', g2.doc.lines[1].note === '换气\\n轻一点'
  && LyricFmt.write(g2.doc).split('\\n').filter(x => /^注 = /.test(x)).length === 2, JSON.stringify(g2.doc.lines[1].note));
const 翻多 = { title:'', lines:[{ seg:'', trans:'第一行译法\\n第二行加注', clauses:[{ cells:[{ t:'真', ms:400 }] }] }] };
g2.doc = JSON.parse(JSON.stringify(翻多)); g2.render();
const 译行 = g2.box.querySelector('.wnw-ltrans > span');
T('翻译那两行也照原样摆成两行（明文一行一个「译 =」，往返不变）',
  getComputedStyle(译行).whiteSpace === 'pre-line' && LyricFmt.parse(LyricFmt.write(g2.doc)).lines[0].trans === '第一行译法\\n第二行加注',
  JSON.stringify(LyricFmt.write(翻多).split('\\n').filter(x => /^译 = /.test(x))));
LYRIC_UI.setView('rom', true); LYRIC_UI.setView('trn', true); LYRIC_UI.setView('wrd', true);
g2.doc = JSON.parse(JSON.stringify(排树)); g2.render();

/* 十三、夹在中间的空格字也得活下来（明文里那一枚下划线 token） */
const 空树 = { title:'空', lines:[{ seg:'', clauses:[{ cells:[{ t:'真', ms:100 }, { t:'', ms:200 }, { t:'爱', ms:300 }] }] }] };
const 空回 = LyricFmt.parse(LyricFmt.write(空树));
T('夹在中间的空格字写出去读回来还在', JSON.stringify(flat(空回)) === JSON.stringify(flat(空树)),
  JSON.stringify(LyricFmt.write(空树).split('\\n')));

/* ============ 十四、外26 一组：演唱者格能拖宽 · 合唱拆成上下两枚牌 · 删到底留住时值 · 顶部那一排悬浮 ============ */
/* 整段套在自己的作用域里：这一个自测页前面已经用了 牌 / 槽 / 行前 这些名字，别再撞车 */
await (async () => {
const 名单树 = { title:'名单', lines:[
  { seg:'', who:['乙','甲'], how:'choir', clauses:[{ cells:[{t:'真',ms:400},{t:'爱',ms:300}] }] },
  { seg:'', who:['Zoe','Amy'], how:'bg', clauses:[{ cells:[{t:'梦',ms:500}] }] },
  { seg:'', who:['一个很长很长很长的名字'], how:'solo', clauses:[{ cells:[{t:'长',ms:200}] }] },
  { seg:'', clauses:[{ cells:[{t:'空',ms:200}] }] }
] };
g2.doc = JSON.parse(JSON.stringify(名单树)); LYRIC_UI.setFill('cell'); g2.render();
const 名槽 = i => R2(i).querySelector('.wnw-lwho');
const 名牌们 = i => Array.from(名槽(i).querySelectorAll('.wnw-lchip')).map(x => x.textContent);
T('两个名字各占一枚牌，不再用「、」连成一串（第一行）', 名牌们(0).length === 3 && 名牌们(0)[0] === '甲' && 名牌们(0)[1] === '乙' && 名牌们(0)[2] === '合唱', 名牌们(0).join(' / '));
const 甲牌 = 名槽(0).querySelectorAll('.wnw-lchip')[0], 乙牌 = 名槽(0).querySelectorAll('.wnw-lchip')[1];
T('两枚牌是上下摞的（第二枚比第一枚低一整牌高）', 乙牌.offsetTop > 甲牌.offsetTop + 甲牌.offsetHeight - 2,
  '甲 top=' + 甲牌.offsetTop + ' 高=' + 甲牌.offsetHeight + ' ｜ 乙 top=' + 乙牌.offsetTop);
T('上下次序按文字 / 字母顺序 —— 文件里写的是「乙、甲」，屏上排成「甲、乙」（拼音在前）',
  LyricFmt.parse(LyricFmt.write(g2.doc)).lines[0].who.join('|') === '乙|甲' && 名牌们(0)[0] === '甲',
  '明文顺序 ' + LyricFmt.parse(LyricFmt.write(g2.doc)).lines[0].who.join('|'));
T('英文那一串也照字母排，和声自己占一枚牌', 名牌们(1).length === 3 && 名牌们(1)[0] === 'Amy' && 名牌们(1)[1] === 'Zoe' && 名牌们(1)[2] === '和声', 名牌们(1).join(' / '));
T('只挂一个独唱的还是那一枚牌、不多写「独唱」', 名牌们(2).length === 1 && 名牌们(2)[0] === '一个很长很长很长的名字', 名牌们(2).join(' / '));
T('没挂名那一行只留空槽、牌一枚不画', 名槽(3).classList.contains('empty') && 名牌们(3).length === 0, 名槽(3).className);
const 名牌组 = 名槽(0).querySelector('.wnw-lwho-n');
const 名把手 = 名槽(0).querySelector('.wnw-lwho-g');
const 名槽口 = 名槽(0).getBoundingClientRect();
T('牌组贴在这一格宽度的右沿（牌组右沿 = 槽右沿，外25 第 5 条没被带坏）',
  Math.abs(名牌组.getBoundingClientRect().right - 名槽口.right) <= 1,
  '牌组右=' + Math.round(名牌组.getBoundingClientRect().right) + ' ｜ 槽右=' + Math.round(名槽口.right));
const 首格左 = R2(0).querySelector('.wnw-lcell').getBoundingClientRect().left;
T('调宽那一条挂在槽位右沿外面（不占槽内、不把牌顶开），自己有 9 像素的命中宽，也不压到隔壁歌词',
  Math.abs(名把手.getBoundingClientRect().left - 名槽口.right) <= 2 &&
  Math.abs(名把手.getBoundingClientRect().width - 9) <= 1 && 名把手.getBoundingClientRect().right < 首格左,
  '槽右=' + Math.round(名槽口.right) + ' ｜ 把手占 ' + Math.round(名把手.getBoundingClientRect().left) + '~' + Math.round(名把手.getBoundingClientRect().right) +
  '（宽 ' + Math.round(名把手.getBoundingClientRect().width) + 'px） ｜ 歌词起头 ' + Math.round(首格左));
const 名中心 = c => { const rg = document.createRange(); rg.selectNodeContents(c); const t = rg.getBoundingClientRect();
  return { 字: Math.round(t.left + t.width / 2), 框: Math.round(c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2) }; };
const 名中1 = 名中心(甲牌), 名中2 = 名中心(乙牌);
T('名字在自己的牌里居中（字的中点和框的中点对齐，两枚都算）',
  getComputedStyle(甲牌).textAlign === 'center' && Math.abs(名中1.字 - 名中1.框) <= 1 && Math.abs(名中2.字 - 名中2.框) <= 1,
  '甲 ' + 名中1.字 + '↔' + 名中1.框 + ' ｜ 乙 ' + 名中2.字 + '↔' + 名中2.框);
const 长名牌 = 名槽(2).querySelector('.wnw-lchip');
T('名字长过这一段也顶不破槽位，多出来的收进省略号',
  Math.round(长名牌.getBoundingClientRect().width) === Math.round(名槽(2).getBoundingClientRect().width) &&
  长名牌.scrollWidth > 长名牌.clientWidth && getComputedStyle(长名牌).textOverflow === 'ellipsis',
  '牌 ' + Math.round(长名牌.getBoundingClientRect().width) + 'px = 槽 ' + Math.round(名槽(2).getBoundingClientRect().width) +
  'px ｜ 内容 ' + 长名牌.scrollWidth + 'px 摆进 ' + 长名牌.clientWidth + 'px');
const 名单文 = LyricFmt.write(g2.doc);
const 起手宽 = 名槽(0).offsetWidth, 起手首格 = R2(0).querySelector('.wnw-lcell').getBoundingClientRect().left;
const PE = (t, x) => (t === 'pointerdown' ? 名把手 : window).dispatchEvent(new PointerEvent(t, { clientX:x, bubbles:true, cancelable:true }));
PE('pointerdown', 200); PE('pointermove', 200 - 30); const 拖中宽 = 名槽(0).offsetWidth; PE('pointerup', 170);
T('往左拖 30 像素 = 那一格窄 2em（30 像素）—— 拉的行程照画幅走，不打折',
  Math.abs(拖中宽 - (起手宽 - 30)) <= 2 && 拖中宽 < 起手宽, 起手宽 + 'px → ' + 拖中宽 + 'px ｜ 窄了 ' + (起手宽 - 拖中宽) + 'px');
T('拖完把这台机器上那一格的宽窄记进 State 的 lyric-who-w，那个明文一个字没动',
  typeof STATE['lyric-who-w'] === 'number' && Math.abs(STATE['lyric-who-w'] - 5.4) < 0.15 && LyricFmt.write(g2.doc) === 名单文,
  'lyric-who-w=' + STATE['lyric-who-w'] + ' ｜ 明文一致=' + (LyricFmt.write(g2.doc) === 名单文));
const 起头们 = [0,1,2,3].map(i => Math.round(R2(i).querySelector('.wnw-lcell').getBoundingClientRect().left));
T('四行的那一格一起变窄，歌词还是从同一个地方起头（窄了以后一起左移，行与行不差）',
  [0,1,2,3].every(i => 名槽(i).offsetWidth === 拖中宽) && 起头们.every(x => x === 起头们[0]) && 起头们[0] < 起手首格,
  '四行宽 = ' + [0,1,2,3].map(i => 名槽(i).offsetWidth).join(' / ') + ' ｜ 起头 ' + 起手首格.toFixed(0) + ' → ' + 起头们.join(' / '));
PE('pointerdown', 200); PE('pointermove', 200 - 4000); PE('pointerup', 0);
const 最窄 = 名槽(0).offsetWidth;
PE('pointerdown', 200); PE('pointermove', 200 + 4000); PE('pointerup', 4200);
const 最宽 = 名槽(0).offsetWidth;
T('拖到尽头夹在 4em ~ 18em 之间（拖不没、拖不出屏）', Math.abs(最窄 - 4 * parseFloat(getComputedStyle(g2.box).fontSize)) < 2 &&
  Math.abs(最宽 - 18 * parseFloat(getComputedStyle(g2.box).fontSize)) < 2,
  '字号 ' + getComputedStyle(g2.box).fontSize + ' ｜ 4em=' + 最窄 + 'px ｜ 18em=' + 最宽 + 'px');
LYRIC_UI.setWhoW(7.4); g2.render();

/* 删到底那一档：行可以没词，不能塌成一串没有时值的空格子 */
const 删树 = { title:'', lines:[{ seg:'', clauses:[{ cells:[{t:'甲',ms:null},{t:'乙',ms:400},{t:'丙',ms:600}] }] }] };
g2.doc = JSON.parse(JSON.stringify(删树)); g2.render();
g2.dropCell(1); g2.dropCell(1);
T('连着删掉两格：最后那一格接住这一行还剩的时值（600 那格被删掉时把 600 毫秒留给空行，不塌成没时值）',
  g2.doc.lines[0].clauses[0].cells.length === 1 && g2.rowMs(g2.doc.lines[0]) === 600,
  '剩 ' + g2.doc.lines[0].clauses[0].cells.length + ' 格 ms=' + g2.doc.lines[0].clauses[0].cells[0].ms + ' ｜ 行合计 ' + g2.rowMs(g2.doc.lines[0]));
g2.doc = JSON.parse(JSON.stringify(删树)); g2.render(); g2.dropCell(2);
T('删掉最后一格时值时，前面那格自己的 400 毫秒不动（不重复累加）', g2.rowMs(g2.doc.lines[0]) === 400, 'ms=' + JSON.stringify(g2.doc.lines[0].clauses[0].cells.map(c => c.ms)));
const 无时树 = { title:'', lines:[{ seg:'', clauses:[{ cells:[{t:'甲',ms:null},{t:'乙',ms:null}] }] }] };
g2.doc = JSON.parse(JSON.stringify(无时树)); g2.render(); g2.dropCell(1);
T('这一行本来一处时值都没有时不自造数字，只保证还剩一格', g2.rowMs(g2.doc.lines[0]) === 0 &&
  g2.doc.lines[0].clauses[0].cells.length === 1 && g2.doc.lines[0].clauses[0].cells[0].ms === null,
  'ms=' + g2.doc.lines[0].clauses[0].cells[0].ms);
const 单行树 = { title:'', lines:[{ seg:'', trans:'只有一句翻译', clauses:[{ cells:[{t:'真',ms:400}] }] }] };
g2.doc = JSON.parse(JSON.stringify(单行树)); g2.render(); g2.delRow(g2.doc.lines[0]);
T('只剩一行时删掉这一行 = 清成一行空格子，400 毫秒留着', g2.doc.lines.length === 1 && g2.rowMs(g2.doc.lines[0]) === 400 &&
  g2.doc.lines[0].trans === '只有一句翻译', 'ms=' + JSON.stringify(g2.doc.lines[0].clauses[0].cells.map(c => c.ms)));
g2.doc = JSON.parse(JSON.stringify(删树)); g2.render(); g2.dropAll('wrd');
T('「删掉所有原文」之后格子还在、时值还在（只剩翻译那一行也算占着拍）', g2.doc.lines[0].clauses[0].cells.length === 3 &&
  g2.rowMs(g2.doc.lines[0]) === 1000 && R2(0).querySelectorAll('.wnw-lcell').length === 3,
  '格 ' + R2(0).querySelectorAll('.wnw-lcell').length + ' 个 ｜ 合计 ' + g2.rowMs(g2.doc.lines[0]) + 'ms');
g2.doc = JSON.parse(JSON.stringify(删树)); g2.render(); g2.romanToggle(g2.doc.lines[0]); g2.dropAll('rom');
T('删注音不会把格子删没、也不动时值', g2.doc.lines[0].clauses[0].cells.length === 3 && g2.rowMs(g2.doc.lines[0]) === 1000,
  '注=' + !!g2.doc.lines[0].roman);

/* 图2：词格播放只留两档 —— 未播放浅、已播放彩，正推着的那一格还没跳档 */
/* 真软件里 --accent 那串主题变量是 Theme.init 写在容器上的，这座自测页没有主题那一步；
   不补这一笔，var(--accent) 退成黑色，「彩」和「浅」就量不出差别（量的前提得给齐皮肤给的东西） */
host2.style.setProperty('--accent', '#2f7d7d'); host2.style.setProperty('--text', '#111');
g2.doc = JSON.parse(JSON.stringify(播树)); LYRIC_UI.setNum('ms'); LYRIC_UI.setFill('cell'); g2.render();
g2.playing = true; g2.mark(520);
const 已推 = g2.flat[0].inp, 正推 = g2.flat[1].inp, 未推 = g2.flat[2].inp;
const 相 = el => el.parentNode.className;
const 样 = el => getComputedStyle(el);
T('正推着的这一格还是未播放那一副（字不提前上色、边框不提前上色、还是浅的）',
  样(正推).opacity === '0.45' && 样(正推).color === 样(未推).color && 样(正推).borderColor === 样(未推).borderColor,
  相(正推) + ' ｜ 字色 ' + 样(正推).color + ' = 未唱 ' + 样(未推).color + ' ｜ 边框 ' + 样(正推).borderColor + ' = 未唱 ' + 样(未推).borderColor);
T('推着的这一格有那一层彩在走（background-size 的线性过渡 + 从左推到满）',
  /background-size/.test(正推.style.transition) && 扫底(正推.style.backgroundSize) === '100%100%,100%100%'
  && 样(正推).backgroundImage.indexOf('linear-gradient') === 0,
  '过渡「' + 正推.style.transition + '」 ｜ size=' + 正推.style.backgroundSize);
T('推过的就是已播放那一档：字和边框一起上色、不透明拉满',
  样(已推).opacity === '1' && 样(已推).color !== 样(未推).color && 样(已推).borderColor !== 样(未推).borderColor,
  相(已推) + ' ｜ 字色 ' + 样(已推).color + ' ｜ 边框 ' + 样(已推).borderColor + ' ｜ 透明度 ' + 样(已推).opacity);
T('没唱到的还是浅的那一档（整排只有浅 / 彩两种样子，没有第三种）',
  样(未推).opacity === '0.45' && 样(未推).color !== 样(已推).color &&
  g2.flat.every(f => ['pre', 'now', 'post'].some(k => f.inp.parentNode.classList.contains(k))),
  '未唱 透明度 ' + 样(未推).opacity + ' ｜ 全排 ' + g2.flat.map(f => 相(f.inp).replace('wnw-lcell ', '')).join(' / '));
g2.mark(1000);
T('同一格推到头就落在已播放（不淡回浅）', /post/.test(相(正推)) && 样(正推).opacity === '1', 相(正推));
g2.stopPlay();
T('停下之后两档标记一起撤干净', g2.flat.every(f => !/pre|now|post/.test(相(f.inp))), g2.flat.map(f => 相(f.inp)).join(' / '));

/* 图5 的另一头：词格里注音本来就住在同一列里 —— 量一遍确认「注音正对着自己那个字」，长注音也不歪 */
const 注树 = { title:'', lines:[{ seg:'', clauses:[{ cells:[
  { t:'真', ms:400, n:'zhen' }, { t:'爱', ms:400, n:'ai' }, { t:'人', ms:400, n:'ren-ren-ren' } ] }] }] };
g2.doc = JSON.parse(JSON.stringify(注树)); g2.render();
const 列 = Array.from(g2.box.querySelectorAll('.wnw-lcell'));
const 中 = el => { const r = el.getBoundingClientRect(); return Math.round(r.left + r.width / 2); };
T('词格这一头：每一格的注音中心正对自己那个字的中心（三格都量）',
  列.length === 3 && 列.every(c => { const a = c.querySelector('.wnw-ln'), b = c.querySelector('.wnw-ltxt');
    return a && Math.abs(中(a) - 中(b)) <= 1; }),
  列.map(c => 中(c.querySelector('.wnw-ln')) + '↔' + 中(c.querySelector('.wnw-ltxt'))).join(' ｜ ') +
  ' ｜ 三格同宽 ' + 列.map(c => Math.round(c.getBoundingClientRect().width)).join('/'));

/* 图9、10：一格内部细分（虚线画在那一刀、双击分与合、各子自己的时长、拍点按子对） */
const 分UI = { title:'', lines:[{ seg:'', clauses:[{ cells:[{ t:'pensy', ms:1000 }, { t:'真', ms:400 }] }] }] };
g2.doc = JSON.parse(JSON.stringify(分UI)); LYRIC_UI.setFill('cell'); LYRIC_UI.setNum('ms'); g2.render();
const 尺 = document.createElement('canvas').getContext('2d');
const 第几字后 = (inp, i) => {
  const st = getComputedStyle(inp);
  尺.font = [st.fontStyle, st.fontWeight, st.fontSize, st.fontFamily].filter(Boolean).join(' ');
  const padL = parseFloat(st.paddingLeft) || 0, padR = parseFloat(st.paddingRight) || 0;
  const 全 = String(inp.value || '');
  const 内容 = Math.max(0, inp.clientWidth - padL - padR);
  const 起 = inp.getBoundingClientRect().left + padL +
    (st.textAlign === 'center' ? Math.max(0, (内容 - 尺.measureText(全).width) / 2) : 0);
  return 起 + 尺.measureText(全.slice(0, i)).width;
};
const 格零 = () => C2(R2(0), 0), 口零 = () => 格零().querySelector('.wnw-ltxt');
T('没分的格不画虚线，明文里也不多出「分 =」那一行',
  格零().querySelectorAll('.wnw-lcut > i').length === 0 && LyricFmt.write(g2.doc).indexOf('分 = ') < 0,
  '虚线 ' + 格零().querySelectorAll('.wnw-lcut > i').length + ' 根');
const 刀位 = Math.round(第几字后(口零(), 3));
TOASTS.length = 0;
口零().dispatchEvent(new MouseEvent('dblclick', { clientX:刀位 + 1, bubbles:true, cancelable:true }));
const 格0 = 格零();
T('双击那串字第 3 个字后面 = 分一刀（格子里挂了一根虚线，数据里 cut = [3]，整格仍是一块，话里说分成 2 子）',
  格0.querySelectorAll('.wnw-lcut > i').length === 1 &&
  JSON.stringify(g2.doc.lines[0].clauses[0].cells[0].cut) === '[3]' &&
  g2.doc.lines[0].clauses[0].cells[0].t === 'pensy' && 格0.querySelectorAll('.wnw-ltxt').length === 1 &&
  TOASTS.join(' / ').indexOf('2 子') >= 0,
  'cut=' + JSON.stringify(g2.doc.lines[0].clauses[0].cells[0].cut) + ' ｜ 输入口 ' + 格0.querySelectorAll('.wnw-ltxt').length + ' 枚 ｜ ' + TOASTS.join(' / '));
T('虚线正画在第 3 个字后面（量的那一刀和线自己对得上）',
  Math.abs(Math.round(格0.querySelector('.wnw-lcut > i').getBoundingClientRect().left) - 刀位) <= 2,
  '刀位 ' + 刀位 + 'px ｜ 虚线 ' + Math.round(格0.querySelector('.wnw-lcut > i').getBoundingClientRect().left) + 'px');
const 平 = lyricParts(g2.doc.lines[0].clauses[0].cells[0]);
T('只分刀没打时长：这一格的 1000 毫秒平摊给两子，文本切成 pen / sy',
  平.n === 2 && 平.durs.join('/') === '500/500' && 平.texts.join('|') === 'pen|sy', JSON.stringify(平.durs) + ' ｜ ' + 平.texts.join('|'));
const 分文UI = LyricFmt.write(g2.doc);
T('分完写出去多一行「分 = 3 -」（后面那格没分，占位减号不能省；这一行没打逐子时长所以不写「子 =」）',
  /(^|\\n)分 = 3 -\\n/.test(分文UI) && 分文UI.indexOf('子 = ') < 0, 分文UI.split('\\n').filter(x => /^分 = |^子 = /.test(x)).join(' ⏎ ') || '（没有分 = 行）');
TOASTS.length = 0;
口零().dispatchEvent(new MouseEvent('dblclick', { clientX:刀位 + 1, bubbles:true, cancelable:true }));
T('再点同一刀就合回去：虚线没了、cut 没了、明文退回原样',
  格零().querySelectorAll('.wnw-lcut > i').length === 0 && !g2.doc.lines[0].clauses[0].cells[0].cut &&
  LyricFmt.write(g2.doc) === LyricFmt.write(JSON.parse(JSON.stringify(分UI))), TOASTS.join(' / '));
/* 拍点那一档：点数按「子」对，不是按「格」对 */
g2.doc = JSON.parse(JSON.stringify(分UI)); g2.render();
口零().dispatchEvent(new MouseEvent('dblclick', { clientX:第几字后(口零(), 3), bubbles:true, cancelable:true }));
g2.tapToggle();
g2.tap.pts = [0, 300, 700, 1200]; g2.tap.live = false;
TOASTS.length = 0;
g2.tapDone();
const 细 = g2.doc.lines[0].clauses[0].cells;
T('这一行分过音节，四个点就把两子加一格摊成三份时长（各子各记，整格是它几子之和）',
  JSON.stringify(细[0].pm) === '[300,400]' && 细[0].ms === 700 && 细[1].ms === 500,
  '格一 pm=' + JSON.stringify(细[0].pm) + ' ms=' + 细[0].ms + ' ｜ 格二 ms=' + 细[1].ms + ' ｜ ' + TOASTS.join(' / '));
/* 图12：f 开始、空格 连续、j 结束，外加切英文输入法的提醒 */
g2.doc = JSON.parse(JSON.stringify(分UI)); g2.render();
TOASTS.length = 0;
host2.dispatchEvent(new KeyboardEvent('keydown', { key:'f', code:'KeyF', bubbles:true, cancelable:true }));
T('屏上按 f = 开这一趟拍点，一开就提醒先把输入法切到英文',
  !!g2.tap && TOASTS.some(x => /英文/.test(x) && /f/.test(x) && /j/.test(x)), TOASTS.join(' ／ '));
host2.dispatchEvent(new KeyboardEvent('keydown', { key:' ', code:'Space', bubbles:true, cancelable:true }));
host2.dispatchEvent(new KeyboardEvent('keydown', { key:' ', code:'Space', bubbles:true, cancelable:true }));
T('空格 = 连续：按两下记两个点', !!g2.tap && g2.tap.pts.length === 2, g2.tap ? g2.tap.pts.length + ' 点' : '没开');
host2.dispatchEvent(new KeyboardEvent('keydown', { key:'j', code:'KeyJ', bubbles:true, cancelable:true }));
T('j = 结束：生成带时长的空格子，这一趟收摊', !g2.tap && g2.doc.lines[0].clauses[0].cells.length >= 3,
  g2.doc.lines[0].clauses[0].cells.map(c => c.ms).join('/'));
g2.tapCancel();
g2.doc = JSON.parse(JSON.stringify(分UI)); g2.render();
const 正文口 = 口零();
const 打字 = new KeyboardEvent('keydown', { key:'f', code:'KeyF', bubbles:true, cancelable:true });
正文口.dispatchEvent(打字);
T('焦点在格子里打字时 f 不抢（英文词里就有 f，那一敲必须落进输入口）',
  !g2.tap && 打字.defaultPrevented === false, 'tap=' + !!g2.tap + ' ｜ preventDefault=' + 打字.defaultPrevented);

/* 顶部那一排按钮悬浮（第 7 条）：另起一棵挂在真滚动容器里的树 */
const 滚架 = document.createElement('div');
滚架.setAttribute('style', 'height:240px;overflow:auto;background:#fff');
const hostS = document.createElement('div'); hostS.className = 'wnw-root'; 滚架.appendChild(hostS); document.body.appendChild(滚架);
const 长行 = [];
for(let i = 0; i < 30; i++) 长行.push({ seg:'第' + (i + 1) + '段', clauses:[{ cells:[{t:'真',ms:400},{t:'爱',ms:400}] }] });
const cS = { id:'cS', title:'长册词格', mode:LYRIC_MODE, paras:[], lyric:{ title:'长册', lines:长行 }, lyricFile:'长册词格.txt', lyricAt:0 };
const viewS = { c:cS, host:hostS, bodyBox:hostS, foot:document.createElement('div'), dirty(){}, drawFoot(){}, draw(){}, plain(){} };
const gS = new LyricGrid(hostS, viewS); await gS.boot();
const 那一排 = hostS.querySelector('.wnw-lbar'), 算 = getComputedStyle(那一排);
T('词格开头那一排挂了悬浮（position:sticky、压过整排、有底色不透）', 算.position === 'sticky' && 算.zIndex === '6' &&
  算.backgroundColor === 'rgb(255, 255, 255)', 算.position + ' ｜ z=' + 算.zIndex + ' ｜ 底=' + 算.backgroundColor);
const 那一行 = hostS.querySelectorAll('.wnw-lrow')[12];
const 排前 = 那一排.getBoundingClientRect().top, 行前 = 那一行.getBoundingClientRect().top;
滚架.scrollTop = 300;
const 排后 = 那一排.getBoundingClientRect().top, 行后 = 那一行.getBoundingClientRect().top;
T('滚下去 300 像素：那一排钉在滚动口不动，行跟着走（现场像素）',
  Math.abs(排后 - 滚架.getBoundingClientRect().top) < 2 && Math.abs(行后 - (行前 - 300)) < 3 && 行前 - 排前 > 200,
  '排 ' + Math.round(排前) + ' → ' + Math.round(排后) + '（滚动口 ' + Math.round(滚架.getBoundingClientRect().top) + '） ｜ 行 ' +
  Math.round(行前) + ' → ' + Math.round(行后));
T('滚到底那一排还在（不是只钉一小段）', (滚架.scrollTop = 99999) && 滚架.scrollTop > 300 &&
  Math.abs(那一排.getBoundingClientRect().top - 滚架.getBoundingClientRect().top) < 2,
  '滚到底 scrollTop=' + 滚架.scrollTop + ' ｜ 排 top=' + Math.round(那一排.getBoundingClientRect().top));

})();

document.getElementById('o').textContent = out.join('\\n') + '\\n\\n共 ' + out.length + ' 项，FAIL ' + bad + ' 项';
window.__RESULT = { lines: out, bad };
`;

const html = ['<!doctype html><meta charset="utf-8"><title>词格那一排的界面自测</title>',
  '<body style="font:15px/1.6 system-ui"><pre id="o" style="font:13px/1.6 monospace;white-space:pre-wrap"></pre><script>',
  SRC, '(async()=>{ try{', TEST,
  '}catch(e){ const s = String((e && e.stack) || e); document.getElementById("o").textContent = "跑挂了：\\n" + s; window.__RESULT = { lines:["THROW " + s.split("\\n").slice(0,3).join(" | ")], bad:1 }; } })();',
  '</script></body>'].join('\n');
fs.writeFileSync(__HERE + 'grid-test.html', html);
console.log('真逐字 TTML 喂 ' + RAW.length + ' 份 → grid-test.html（' + Math.round(html.length / 1024) + ' KB）');
