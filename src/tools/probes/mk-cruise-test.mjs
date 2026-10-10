/* 外25 四组 · 词巡航自测页：把 sh-ttml.js + w18-lyric.js + w19-cruise.js 原样塞进浏览器，
   外面只补 kernel 交给它们的那几枚全局（h / State / Menu / Overlay / addCss / Views / Work）和一座假磁盘桥（FD_APP），
   然后真开一趟巡航：真排队列、真点显隐、真打字判分、真等倒计时翻卡。
   为什么在浏览器里跑：这一档全是真 DOM 与真定时器，node 里那套是假的。
   最要紧的一条在最后：整趟跑完，那个明文文件和章对象必须一个字都没变（巡航只读）。 */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const REPO = 'D:/Programs/Flow-Desk';
const SH = fs.readFileSync(REPO + '/src/_shared/sh-ttml.js', 'utf8');
const LY = fs.readFileSync(REPO + '/src/_wnw/src/w18-lyric.js', 'utf8');
const CZ = fs.readFileSync(REPO + '/src/_wnw/src/w19-cruise.js', 'utf8');
const W7 = fs.readFileSync(REPO + '/src/_wnw/src/w7-data.js', 'utf8');
/* metaHasLyr 是目录上那个 ly 的读法，词巡航判"这一章算不算词格"吃的是它 —— 从数据层原样切下来，不另写一份 */
function pick(src, head){
  const i = src.indexOf(head);
  if(i < 0) throw new Error('源码里找不到「' + head + '」');
  const b = src.indexOf('{', i);
  let d = 0, j = b;
  for(; j < src.length; j++){ const c = src.charCodeAt(j); if(c === 123) d++; else if(c === 125){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
const META = pick(W7, 'function metaHasLyr');

/* 两个真词格（明文），走的是真解析那一条路：LyricFmt.parse 吃的就是这一段字 */
const FILES = {
  '第一章.txt': '【主歌1】\n注 = 这一遍轻一点\n译 = 真爱\n译 = 第二行加注\n音 = chen _ hai _\n时 = 480 420 390 410\n词 = 真 爱 人 海\n【副歌】\n时 = 500 500\n词 = 醒 来\n',
  '第二章.txt': '【主歌1】\n人 = 甲、乙\n唱 = 合唱\n时 = 300 300 300\n词 = 潮 水 退\n'
};

const STUB = `
const TOASTS = [], WRITES = [], FILES = ${JSON.stringify(FILES)};
const FILES0 = JSON.parse(JSON.stringify(FILES));   /* 开趟之前的原样，最后拿它比对 */
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
function download(){}
function newPara(k, t){ return { id:'p' + Math.random(), k:k || 'p', t:t || '', done:false }; }
function cleanText(p){ return (p && p.t) || ''; }
function icoMarkup(){ return ''; }
let LAST_MENU = [];
const Menu = { open(x, y, items){ LAST_MENU = (items || []).filter(Boolean); return true; }, under(el, items){ return this.open(0, 0, items); } };
const STATE = {};
const State = { async get(k, fb){ return (k in STATE) ? STATE[k] : fb; }, set(k, v){ STATE[k] = JSON.parse(JSON.stringify(v)); return true; } };
let OVERLAY = null;
const Overlay = { open(title, box, btns){ OVERLAY = { title, box, btns }; return true; }, close(){ OVERLAY = null; } };
/* 假磁盘桥：读得到两个文件，写就记一笔（最后一条断言要数这一笔） */
window.FD_APP = {
  async dataDir(){ return 'X:/lyrics'; },
  async dirTree(p, exts){ return Object.keys(FILES).map(n => ({ name:n, size:FILES[n].length, mtime:1 })).filter(() => true); },
  async dataRead(p){ const n = String(p).split('/').pop(); return (n in FILES) ? FILES[n] : null; },
  async dataWrite(p, t){ WRITES.push(p); FILES[p.split('/').pop()] = t; return true; }
};
const VIEWS = {};
const Views = { reg(id, o){ VIEWS[id] = o; }, get(id){ return VIEWS[id]; } };
${META}
/* 一本书：第一卷两章都是词格（够格开巡航），第二卷掺一章写作（不够格） */
const CH = {
  c1:{ id:'c1', vid:'v1', title:'第一章', mode:'lyric', w:0, ly:1, lyricFile:'第一章.txt' },
  c2:{ id:'c2', vid:'v1', title:'第二章', mode:'lyric', w:0, ly:1, lyricFile:'第二章.txt' },
  c3:{ id:'c3', vid:'v2', title:'第三章', mode:'write', w:120, ly:0 }
};
for(const k in CH) CH[k].paras = [];
const Work = {
  cur:'c1',
  book:{ id:'b', title:'测试书', vols:[{ id:'v1', title:'第一卷' }, { id:'v2', title:'第二卷' }],
    chs:[CH.c1, CH.c2, CH.c3], goal:0, chGoal:0, daily:{} },
  vol(id){ return this.book.vols.find(v => v.id === id) || null; },
  chMeta(id){ return this.book.chs.find(c => c.id === id) || null; },
  orderedChs(){ const b = this.book, out = [];
    for(const v of b.vols) for(const c of b.chs) if(c.vid === v.id) out.push(c);
    for(const c of b.chs) if(out.indexOf(c) < 0) out.push(c); return out; },
  async ch(id){ return CH[id] || null; }
};
`;

const SRC = STUB + '\n' + SH + '\n' + LY + '\n' + META + '\n' + CZ + '\n';
if(SRC.includes('</script')) throw new Error('源码里含 </script，会撕页');

const TEST = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + nm + (extra == null ? '' : '  ·  ' + extra)); if(!cond) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
window.__out = out;
const 字 = el => (el ? String(el.textContent || '') : '');

/* 〇、入口条件：整卷都是词格才摆这一条 */
T('第一卷（两章都是词格）够格开词巡航', cruiseReady('v1') === true);
T('第二卷掺了一章写作 · 不够格', cruiseReady('v2') === false);
T('「＋打开内容」那条指的是第一卷', cruiseAnyVol() === 'v1', cruiseAnyVol());

/* 一、开一趟巡航：明文那个文件是真源（走的是 render 里那同一条路：new + boot） */
(async () => {
 try {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const V = new LyricCruise(host, { ref:'v1', dispose:() => {} });
  await V.boot();
  const pane = host.querySelector('.wnw-cruise');
  const card = () => pane.querySelector('.wnw-czcard');
  const 原文行 = () => pane.querySelector('.wnw-czword');
  const 藏 = () => pane.querySelector('.wnw-czslot');
  const 计数 = () => 字(pane.querySelector('.wnw-cznum'));
  T('顶栏那一排摆出来了（范围 / 次序 / 显隐 / 时间 / 用法）',
    !!pane.querySelector('.wnw-czbar') && pane.querySelectorAll('.wnw-czbar button').length >= 5,
    pane.querySelectorAll('.wnw-czbar button').length + ' 个按钮');
  T('计数那一格说的是这一卷几个词格、队列几行、走到第几张',
    /2 个词格 · 队列 3 行 · 第 1 张/.test(计数()), 计数());
  T('第一张卡是从明文里读出来的那一行（真 爱 人 海 四格）',
    !!原文行() && 原文行().querySelectorAll('.c').length === 4 && 字(原文行()).replace(/\\s/g, '') === '真爱人海',
    字(原文行()));
  T('默认只藏原文以外的那两层（注音、注释各占一格可点开的槽）',
    pane.querySelectorAll('.wnw-czslot').length === 2, pane.querySelectorAll('.wnw-czslot').length + ' 格槽');
  T('卡头上写着章名、行号、段名，合唱那一个还带上人名与唱法',
    /第一章/.test(字(card())) && /第 1 行 · 主歌1/.test(字(card())), 字(card().querySelector('.wnw-czhead')));

  /* 二、显隐设定：三档各管一层，注释条数 1 / 2 / 全部 */
  const set = (k, x) => { V.set[k] = x; V.saveSet(); V.build(); V.buildBar(); V.draw(); };
  set('show', { wrd:false, rom:true, nte:true });
  const 注音 = pane.querySelector('.wnw-czrom');
  T('原文关掉、注音打开：卡上没字了，但格子数目照旧（4 个空框）',
    pane.querySelectorAll('.wnw-czhide .c').length === 4 && 字(card()).indexOf('真') < 0,
    '空框 ' + pane.querySelectorAll('.wnw-czhide .c').length + ' 个');
  T('注音那一层摆得出来（一格一段，空着的那一格是个点）',
    !!注音 && 字(注音).replace(/\\s/g, '') === 'chen·hai·', 字(注音));
  set('nteN', 'all');
  T('注释摆全部 = 3 条（一段前说明 + 两行翻译）',
    pane.querySelectorAll('.wnw-cznote > div').length === 3,
    pane.querySelectorAll('.wnw-cznote > div').length + ' 条');
  set('nteN', '1');
  T('注释摆 1 条就只显段前说明那一条',
    pane.querySelectorAll('.wnw-cznote > div').length === 1 && 字(pane.querySelector('.wnw-cznote > div')) === '这一遍轻一点',
    pane.querySelectorAll('.wnw-cznote > div').length + ' 条');
  set('nteN', '2');
  T('注释摆 2 条：段前说明 + 翻译头一行',
    字(pane.querySelectorAll('.wnw-cznote > div')[1]) === '真爱', 字(pane.querySelectorAll('.wnw-cznote > div')[1]));

  /* 三、范围与次序 */
  set('scope', 'ch'); set('ch', 'c2');
  T('范围收到「章内」：队列只剩那一章的 1 行', /队列 1 行/.test(计数()), 计数());
  set('scope', 'row'); set('ch', 'c1'); set('row', 1); set('show', { wrd:true, rom:false, nte:true });
  T('范围收到「行内」：队列 1 行、卡上摆的是副歌那一行',
    /队列 1 行/.test(计数()) && 字(原文行()).replace(/\\s/g, '') === '醒来', 字(原文行()));
  set('scope', 'all'); set('row', 0); set('order', 'fwd');
  const 序 = () => V.q.map(x => x.ch + (1 + x.i)).join(',');
  T('整卷顺序：三行按 第一章1,第一章2,第二章1 排', 序() === '第一章1,第一章2,第二章1', 序());
  set('order', 'rev');
  T('整卷逆序：完全倒过来', 序() === '第二章1,第一章2,第一章1', 序());
  set('order', 'rand');
  let 不同过 = false, 集对 = true;
  for(let i = 0; i < 30; i++){ set('order', 'rand');
    if(V.q.map(x => x.ch + (1 + x.i)).sort().join(',') !== '第一章1,第一章2,第二章1') 集对 = false;
    if(序() !== '第一章1,第一章2,第二章1') 不同过 = true; }
  T('随机：30 趟每趟都是这三行（不多不少），且至少有一趟和顺序不一样', 不同过 && 集对, 序());
  set('order', 'fwd');

  /* 四、默背与提示：这一行注音和原文都藏着，点的是写着「原文」那一格 */
  set('mode', 'hide'); set('show', { wrd:false, rom:false, nte:false });
  const 原文槽 = () => Array.from(pane.querySelectorAll('.wnw-czslot')).find(x => /原文/.test(x.title || ''));
  const 显出来的原文 = () => Array.from(pane.querySelectorAll('.wnw-czslot')).find(x => x.querySelector('.wnw-czword'));
  原文槽().click();
  T('默背：点一下藏着的原文显出来', 字(原文行()).replace(/\\s/g, '') === '真爱人海', 字(原文行()));
  显出来的原文().click();
  T('默背：显出来那一层再点一下收回', !原文行() && !!原文槽(), 字(pane.querySelector('.wnw-czcard')));
  set('mode', 'hint');
  const 槽2 = 原文槽();
  槽2.click();
  const 亮了 = 字(原文行()).replace(/\\s/g, '') === '真爱人海';
  await sleep(HINT_MS + 260);
  T('提示：点一下只亮 ' + HINT_MS + ' 毫秒就自己收回（真等了一趟）',
    亮了 && !原文行(), '亮的时候有字 = ' + 亮了 + ' · 又等 ' + 260 + ' 毫秒后卡上还有原文吗：' + (!!原文行()));

  /* 五、填写：三格输入、判对错、一个字都不落 */
  set('mode', 'type'); set('show', { wrd:false, rom:false, nte:true }); set('nteN', 'all');
  V.go(1);
  const ins = () => Array.from(pane.querySelectorAll('.wnw-czword.type input.c'));
  T('填写：第二行两格（醒 来）摆两个框', ins().length === 2, ins().length + ' 个框');
  const 打 = (i, s) => { const el = ins()[i]; el.value = s; el.dispatchEvent(new Event('input')); };
  打(0, '醒'); 打(1, '错');
  ins()[1].dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
  T('填写：对 1 / 2 格，错的那一格边上写着原文',
    /对 1 \\/ 2 格/.test(字(pane.querySelector('.wnw-czfoot'))), 字(pane.querySelector('.wnw-czfoot')));
  T('错格标红、对格标绿', ins()[0].classList.contains('ok') && ins()[1].classList.contains('bad'),
    ins()[0].className + ' ｜ ' + ins()[1].className);
  T('答案就写在错的那一格边上', 字(ins()[1].nextElementSibling) === '来', 字(ins()[1].nextElementSibling));
  V.go(1); V.go(-1);
  T('翻过这张卡，打进去的字就没了（内存里也不留）',
    ins().every(x => x.value === ''), ins().map(x => x.value).join(','));

  /* 六、键盘与倒计时 */
  set('mode', 'hide'); set('show', { wrd:true, rom:false, nte:false }); V.i = 0; V.draw();
  pane.dispatchEvent(new KeyboardEvent('keydown', { key:' ', bubbles:true }));
  T('空格 = 下一张', /第 2 张/.test(计数()), 计数());
  pane.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowLeft', bubbles:true }));
  T('左箭头 = 上一张', /第 1 张/.test(计数()), 计数());
  set('secs', 1);
  const 线 = pane.querySelector('.wnw-cztime');
  const 走时 = 线.style.transition;
  const 幅 = el => { const m = /matrix\\(([-\\d.]+)/.exec(getComputedStyle(el).transform); return m ? Number(m[1]) : -9; };
  const 起点 = 幅(线);
  await sleep(460);
  const 半路 = 幅(线);
  await sleep(460);
  const 到底 = 幅(线);          /* 920 毫秒：还没到翻点，那条线仍挂在屏上 */
  await sleep(340);
  T('倒计时：那条线挂的是 1 秒线性、终点是空（scaleX(0)）',
    /transform 1000ms linear/.test(走时) && 线.style.transform === 'scaleX(0)',
    '挂的过渡「' + 走时 + '」 · 终点 ' + 线.style.transform + ' ｜ 起点 ' + 起点.toFixed(2) + ' → 460 毫秒 ' +
    半路.toFixed(2) + ' → 920 毫秒 ' + 到底.toFixed(2) + '（页面在后台：' + document.hidden + '，不画帧时中间量不到）');
  T('退完自己翻到下一张', /第 2 张/.test(计数()), 计数());
  const 张 = 计数();
  set('secs', 0);
  const 线2 = pane.querySelector('.wnw-cztime');
  await sleep(1200);
  T('时间填 0 = 那条线不动（没挂上过渡）、也不自动翻',
    线2.style.transition === '' && 幅(线2) === 0 && 计数() === 张,
    '挂的过渡：「' + 线2.style.transition + '」 · 宽度 ' + 幅(线2) + ' · 还是 ' + 计数());

  /* 六之二、手动那一档还能用下箭头 / 上箭头 / 鼠标滚轮（外26 第 4 条） */
  set('secs', 0); V.i = 0; V.draw();
  const 钮 = Array.from(pane.querySelectorAll('.wnw-czbar button'));
  const 钮2title = t => { const b = Array.from(pane.querySelectorAll('.wnw-czfoot button')).find(x => x.textContent === t); return b ? b.title : '（没这个钮）'; };
  const 手动钮 = 钮.find(b => b.textContent === '手动翻');
  T('顶栏那个「手动翻」悬停提示里写着能用哪几枚键和滚轮',
    !!手动钮 && /下箭头/.test(手动钮.title) && /滚轮/.test(手动钮.title) && /上箭头/.test(手动钮.title),
    手动钮 ? 手动钮.title : '没找到那个钮');
  T('页脚两个翻卡钮的提示也写着按键', /空格.*右箭头.*下箭头.*滚轮/.test(钮2title('下一张')) && /左箭头.*上箭头.*滚轮/.test(钮2title('上一张')),
    '下一张：' + 钮2title('下一张'));
  pane.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true, cancelable:true }));
  T('下箭头 = 下一张', /第 2 张/.test(计数()), 计数());
  pane.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowUp', bubbles:true, cancelable:true }));
  T('上箭头 = 上一张', /第 1 张/.test(计数()), 计数());
  for(let k = 0; k < 4; k++) pane.dispatchEvent(new WheelEvent('wheel', { deltaY:120, bubbles:true, cancelable:true }));
  T('往下滚一格滚轮（浏览器连发 4 个事件）只翻一张', /第 2 张/.test(计数()), 计数());
  await sleep(300);
  for(let k = 0; k < 4; k++) pane.dispatchEvent(new WheelEvent('wheel', { deltaY:-120, bubbles:true, cancelable:true }));
  T('往上滚 = 上一张', /第 1 张/.test(计数()), 计数());
  await sleep(300);
  set('secs', 3); V.i = 0; V.draw();
  pane.dispatchEvent(new WheelEvent('wheel', { deltaY:120, bubbles:true, cancelable:true }));
  pane.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true, cancelable:true }));
  T('倒计时那一档滚轮和下箭头不抢自动翻（还是第 1 张）', /第 1 张/.test(计数()), 计数());
  pane.dispatchEvent(new KeyboardEvent('keydown', { key:' ', bubbles:true, cancelable:true }));
  T('倒计时那一档空格照样能手动翻（这条老规矩没被带坏）', /第 2 张/.test(计数()), 计数());
  set('secs', 0); V.i = 0; V.draw();

  /* 六之三、开头那一排按钮悬浮（外26 第 7 条）：把这一屏挪进一座真滚动容器里量 */
  const 那一排 = pane.querySelector('.wnw-czbar');
  const 排算 = getComputedStyle(那一排);
  T('词巡航开头那一排挂了悬浮（position:sticky、压过卡片、有底色不透）',
    排算.position === 'sticky' && 排算.zIndex === '6' && 排算.backgroundColor === 'rgb(255, 255, 255)',
    排算.position + ' ｜ z=' + 排算.zIndex + ' ｜ 底=' + 排算.backgroundColor);
  const 滚架 = document.createElement('div');
  滚架.setAttribute('style', 'height:150px;overflow:auto;background:#fff');
  document.body.appendChild(滚架); 滚架.appendChild(host);
  set('show', { wrd:true, rom:true, nte:true }); set('nteN', 'all');
  const 卡 = pane.querySelector('.wnw-czcard');
  const 那一排2 = pane.querySelector('.wnw-czbar');   /* 上面那两次 set 会重画顶栏，旧指针已经挂在树外了，量它得到全 0 */
  const 顶0 = 那一排2.getBoundingClientRect().top, 卡0 = 卡.getBoundingClientRect().top;
  滚架.scrollTop = 90;
  T('滚下去 90 像素：那一排钉在滚动口不动，卡片跟着走',
    Math.abs(那一排2.getBoundingClientRect().top - 滚架.getBoundingClientRect().top) < 2 &&
    Math.abs(卡.getBoundingClientRect().top - (卡0 - 90)) < 3,
    '排 ' + Math.round(顶0) + ' → ' + Math.round(那一排2.getBoundingClientRect().top) + '（滚动口 ' + Math.round(滚架.getBoundingClientRect().top) + '） ｜ 卡 ' +
    Math.round(卡0) + ' → ' + Math.round(卡.getBoundingClientRect().top) + ' ｜ 内容高 ' + 滚架.scrollHeight);
  滚架.scrollTop = 0; set('show', { wrd:true, rom:false, nte:false });

  /* 六之四、注音对原文逐格对齐 + 那一档可切换（外26 第 5 条） */
  set('scope', 'all'); set('show', { wrd:true, rom:true, nte:false }); V.i = 0; V.draw();
  const 中心 = el => { const r = el.getBoundingClientRect(); return Math.round(r.left + r.width / 2); };
  const 宽of = el => Math.round(el.getBoundingClientRect().width);
  const 两排 = () => ({ 音: Array.from(pane.querySelector('.wnw-czrom').children), 词: Array.from(pane.querySelector('.wnw-czword').children) });
  const 差 = () => { const x = 两排(); return x.音.map((a, i) => 中心(a) - 中心(x.词[i])); };
  T('默认那一档：四格的注音中心正对着自己那个字（一格都不歪）', 差().every(d => Math.abs(d) <= 1),
    差().join(' / ') + ' 像素 ｜ 注音宽 ' + 两排().音.map(宽of).join('/') + ' ｜ 原文宽 ' + 两排().词.map(宽of).join('/'));
  const 显钮 = Array.from(pane.querySelectorAll('.wnw-czbar button')).find(b => b.textContent === '显隐');
  LAST_MENU = []; if(显钮) 显钮.click();
  T('「显隐」那张单子里多了注音摆法两条（跟每一格对齐 / 整行一条）',
    LAST_MENU.some(x => x.label === '注音对原文：跟每一格对齐') && LAST_MENU.some(x => x.label === '注音对原文：整行一条'),
    LAST_MENU.filter(x => x.label).map(x => x.label).join(' / '));
  /* 注音标成一长串时最考验这一条：那一格的注音比字宽得多 */
  V.list[0].doc.lines[0].clauses[0].cells[1].n = 'chang-de-zhu-yin'; V.draw();
  const 长差 = 差();
  T('注音比那个字宽得多时仍旧对得齐（两排一起加宽，不各排各的居中）',
    长差.every(d => Math.abs(d) <= 1) && 宽of(两排().音[1]) > 60,
    '差 ' + 长差.join(' / ') + ' ｜ 那一格注音 ' + 宽of(两排().音[1]) + 'px = 原文 ' + 宽of(两排().词[1]) + 'px');
  const 音长 = 宽of(两排().音[1]), 词长 = 宽of(两排().词[1]);
  V.pick('romW', 'line');
  T('切到「整行一条」：原文那一格回落到自己那一份宽（不再被注音拉平），那一格的中心也歪开了',
    宽of(pane.querySelector('.wnw-czword').children[1]) < 词长 && 音长 === 宽of(pane.querySelector('.wnw-czrom').children[1]) &&
    Math.abs(中心(pane.querySelector('.wnw-czrom').children[1]) - 中心(pane.querySelector('.wnw-czword').children[1])) > 1,
    '逐格那一档 音 ' + 音长 + ' / 词 ' + 词长 + 'px ｜ 整行那一档 音 ' + 宽of(pane.querySelector('.wnw-czrom').children[1]) +
    ' / 词 ' + 宽of(pane.querySelector('.wnw-czword').children[1]) + 'px');
  T('切换记进设置那一条里（cruise.set 的 romW），重开一趟还认这一档',
    STATE['cruise.set'].romW === 'line', JSON.stringify(STATE['cruise.set'].romW));
  V.pick('romW', 'cell');
  T('切回逐格对齐还是正的', 差().every(d => Math.abs(d) <= 1), 差().join(' / '));

  /* 七、这一档只读：一个文件、一个章对象都不许动 */
  T('整趟巡航没往那个明文文件写一个字', WRITES.length === 0, '写盘 ' + WRITES.length + ' 趟');
  T('两个明文的字节和开趟之前一模一样',
    FILES['第一章.txt'] === FILES0['第一章.txt'] && FILES['第二章.txt'] === FILES0['第二章.txt'],
    '第一章 ' + FILES['第一章.txt'].length + ' 字节 · 第二章 ' + FILES['第二章.txt'].length + ' 字节');
  T('章对象没被巡航改过（mode、词格缓存、正文原样）',
    CH.c1.mode === 'lyric' && CH.c3.mode === 'write' && !CH.c1.paras.length && CH.c1.lyricFile === '第一章.txt');
  T('记住的只有设置这一条（cruise.set），没往别处写', Object.keys(STATE).join(',') === 'cruise.set', Object.keys(STATE).join(','));
  T('设置里存的就是当前这一档', STATE['cruise.set'].mode === 'hide' && STATE['cruise.set'].order === 'fwd',
    JSON.stringify(STATE['cruise.set']));

  /* 八、书巡航（外26 追加）：同一张类，ref 换成那枚哨兵，读的是整本书每一卷。
     这一段里的 \\n 是给生成页留的一层反斜杠：TEST 本身是模板字面量，会先吃掉一层。 */
  FILES['第四章.txt'] = '【尾段】\\n注 = 第二卷里的一个词格\\n时 = 200 200\\n词 = 归 途\\n';
  CH.c4 = { id:'c4', vid:'v2', title:'第四章', mode:'lyric', w:0, ly:1, lyricFile:'第四章.txt', paras:[] };
  Work.book.chs.push(CH.c4);
  T('第二卷掺了写作章 · 卷那一档还是不够格（这道闸没跟着放宽）', cruiseReady('v2') === false);
  T('可这本书有词格的章 · 书那一档就摆得出来（放宽到一章，不看整卷）', cruiseBookReady() === true);
  const host2 = document.createElement('div');
  document.body.appendChild(host2);
  const W = new LyricCruise(host2, { ref:CRUISE_BOOK, dispose:() => {} });
  await W.boot();
  const pane2 = host2.querySelector('.wnw-cruise');
  const 卡2 = () => pane2.querySelector('.wnw-czcard');
  const 计2 = () => 字(pane2.querySelector('.wnw-cznum'));
  const 钮2 = 前 => [...pane2.querySelectorAll('.wnw-czbar button')].find(b => 字(b).indexOf(前) === 0);
  /* 上一档（卷那一趟）把设置写进了 State，scope 未必还是整本 —— 先按这一档摆正再量 */
  W.set.scope = 'all'; W.build(); W.buildBar(); W.draw();
  T('书巡航认得自己是书那一档（bookMode 真、vid 就是那枚哨兵）',
    W.bookMode === true && W.vid === CRUISE_BOOK, W.bookMode + ' ｜ ' + W.vid);
  T('读进来的是整本书的词格章：三个（卷那一档只有两个）', W.list.length === 3,
    W.list.map(x => x.volT + '/' + x.title).join(' 、 '));
  T('计数那一格跟着改口：3 个词格 · 队列 4 行（第一卷 3 行 + 第二卷 1 行）',
    /3 个词格 · 队列 4 行 · 第 1 张/.test(计2()), 计2());
  T('范围那个写的是「整本」不是「整卷」', 字(钮2('范围')) === '范围：整本', 字(钮2('范围')));
  T('次序照文件里那样：第一卷两个的行走完才轮到第二卷',
    W.q.map(x => x.volT + '·' + x.ch).join(' | ') === '第一卷·第一章 | 第一卷·第一章 | 第一卷·第二章 | 第二卷·第四章',
    W.q.map(x => x.volT + '·' + x.ch).join(' | '));
  T('卡头上带卷名（跨卷之后光一个章名认不出是谁家的）',
    /第一卷 · 第一章/.test(字(卡2().querySelector('.wnw-czhead'))), 字(卡2().querySelector('.wnw-czhead')));
  /* 章那一档：菜单里每一个前面写着自家的卷名，挑中第二卷的那个也只出它自己的行 */
  W.set.scope = 'ch'; W.set.ch = 'c4'; W.build(); W.buildBar(); W.draw();
  钮2('章').click();
  T('「章」那份名单把整本书的词格章都列出来，前面带卷名',
    LAST_MENU.map(x => x.label).join(' | ') === '第一卷 · 第一章 | 第一卷 · 第二章 | 第二卷 · 第四章',
    LAST_MENU.map(x => x.label).join(' | '));
  T('挑了第二卷那个：队列就它一行，卡头是第二卷 · 第四章',
    W.q.length === 1 && /第二卷 · 第四章/.test(字(卡2().querySelector('.wnw-czhead'))),
    W.q.length + ' 行 ｜ ' + 字(卡2().querySelector('.wnw-czhead')));
  T('行那一档在书这一档里也走得通（本章某一行 = 就这一行反复背）', (() => {
    W.set.scope = 'row'; W.set.row = 0; W.build(); W.buildBar(); W.draw();
    return W.q.length === 1 && 字(钮2('范围')) === '范围：行内';
  })(), W.q.length + ' 行 ｜ ' + 字(钮2('范围')));
  /* 空书那一档的话术得跟着换：说「这一卷里没有词格模式的章」是答非所问 */
  W.list = []; W.q = []; W.i = 0; W.draw();
  T('这本书一个词格都没有时，说的是这本书不是这一卷',
    /这本书里没有词格模式的章/.test(字(pane2.querySelector('.wnw-cznone'))), 字(pane2.querySelector('.wnw-cznone')));
  T('标签那两个字分得开：书那一档叫书巡航，卷那一档叫词巡航',
    VIEWS.cruise.title(CRUISE_BOOK) === '书巡航' && VIEWS.cruise.title('v1') === '词巡航',
    VIEWS.cruise.title(CRUISE_BOOK) + ' ｜ ' + VIEWS.cruise.title('v1'));
  T('书巡航这一趟也一个字节都没写（那个第四章是开趟前塞进来的假磁盘）', WRITES.length === 0, '写盘 ' + WRITES.length + ' 趟');
  /* 全书都没词格时这一条不许摆出来：改完模式立刻还原，别把上一档的状态弄脏。
     认词格看的是 metaHasLyr = m.ly == null ? mode === 'lyric' : !!m.ly，
     这三个都写着 ly:1，光改 mode 不改 ly 是关不掉的（上一趟就是这么红的）。 */
  const 原样 = [CH.c1, CH.c2, CH.c4].map(c => c.mode + '/' + c.ly).join(',');
  for(const c of [CH.c1, CH.c2, CH.c4]){ c.mode = 'write'; c.ly = 0; }
  const 空书 = cruiseBookReady();
  CH.c1.mode = CH.c2.mode = CH.c4.mode = 'lyric'; CH.c1.ly = CH.c2.ly = CH.c4.ly = 1;
  T('整本书一个词格都没有：这一条不摆（摆一条点开来是空屏的比少一条更糟）', 空书 === false, 空书 + '');
  T('还原回来了（这一段改了 mode 与 ly 又改回去，没留脏）',
    [CH.c1, CH.c2, CH.c4].map(c => c.mode + '/' + c.ly).join(',') === 原样,
    [CH.c1, CH.c2, CH.c4].map(c => c.mode + '/' + c.ly).join(','));

  window.__RESULT = { lines:out, bad };
 } catch(e){
  out.push('FAIL 半路断了：' + (e && e.message) + ' ｜ 断在第 ' + (out.length + 1) + ' 项');
  bad++;
  window.__RESULT = { lines:out, bad };
 }
})();
`;

const HTML = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>词巡航自测</title><style>' +
  ':root{--text:#222;--text-light:#888;--accent:#2f7d7d;--card-bg:#fff;--card-border:#ddd;--btn-bg:#eef2fa;' +
  '--input-bg:#fff;--input-border:#b9bec7;--ctl-edge:#b9bec7;--candidate-bg:#f0f2f5;--hair-color:#e3e3e3;' +
  '--ok:#2e8b57;--bad:#c0392b;--r-card:6px;--bw:1px;--hair:1px solid #eee}' +
  'body{font:14px/1.6 system-ui,sans-serif;margin:0;padding:8px;background:#fff;color:var(--text)}' +
  '.wnw-btn{border:1px solid var(--ctl-edge);background:var(--btn-bg);border-radius:4px;padding:2px 8px;font:inherit;cursor:pointer}' +
  '</style></head><body><script>' + SRC + TEST + '</script></body></html>';

fs.writeFileSync(__HERE + 'cruise-test.html', HTML);
console.log('写了 cruise-test.html：' + (HTML.length / 1024).toFixed(0) + ' KB');
