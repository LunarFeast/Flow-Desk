/* 外26 四组自测页：图13 主日程里那一排子日程进度细条、图14 卡片展开时顶栏糊一层、图6 歌词延迟「归零」。
   三份源码都是切真身，不是照抄一遍：
   · fd3-shell.js 那一整块 CSS 是 document.head.appendChild(h('style',{html:`…`})) 里那一条字面量，
     从打头那行往后原样取到收尾。里头只有 body 那一条规则嵌了一处 ${FF_BASE_FD}，那一行剔掉，
     别的行一行都不剔 —— 剔多了会把「这条规则其实被上面某条盖住」这种真 bug 洗成 PASS。
   · schedule/main.js 取 export default 之前的全部（renderTree 和它底下那一串函数都在这一段），
     插件的 P 由这一页现挂一份。
   · music-remote/main.js 只切 musLag + MUS_LAG_MS + offsetField 三支（归零那个按钮就在这一支里），
     Music 交一份记账的假货，看归零那一下到底动了哪几处。*/
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const REPO = 'D:/Programs/Flow-Desk';
const L = s => s.split(/\r?\n/);

/* ---------- 一、fd3-shell.js 那一整块 CSS ---------- */
const SH = L(fs.readFileSync(REPO + '/src/_fd/src/fd3-shell.js', 'utf8'));
const c0 = SH.findIndex(l => l.includes("h('style', { html:`"));
const c1 = SH.findIndex((l, i) => i > c0 && /^\s*`\s*\}\)\);/.test(l));
if(c0 < 0 || c1 < 0) throw new Error('没圈住 fd3-shell.js 的 CSS 字面量');
/* 剔行的规矩：只剔嵌了 ${} 的那一条，别的行一行不许剔。剔多了会把「这条规则其实被上面某条盖住」
   这种真 bug 洗成 PASS。剔掉的是 body 那一句字体（FD_BASE_FD 由 Theme 现给），跟下面的断言无关。 */
const 剔 = [];
const CSS = SH.slice(c0 + 1, c1).filter(l => {
  if(l.indexOf('${') < 0) return true;
  剔.push(l.trim()); return false;
}).join('\n');
if(剔.length !== 1 || 剔[0].indexOf('font-family:var(--fd-font') < 0)
  throw new Error('剔的行不合规（该只剔 body 那一句字体）：' + JSON.stringify(剔));
/* 断言要用到的那几条规则，必须真的在这一次切进来的那一段里（不然测的是空气） */
for(const 条 of ['.fd-top.dim .fd-brand', '.sch-sub>i>b', '.sch-sub>i.full'])
  if(CSS.indexOf(条) < 0) throw new Error('切进来的 CSS 里没有「' + 条 + '」');
/* 那条规则只改 filter，transition 里也只列 filter —— 两边对不上才会出现"改 opacity 没过渡"。
   这里先闸一道：往糊那条上偷偷加 opacity 的话，这一页直接不生成。 */
const 糊条 = (CSS.match(/^\.fd-top\.dim \.fd-brand[^}]*\}/m) || [''])[0];
if(/opacity/.test(糊条)) throw new Error('图14 那条改了 opacity，可 transition 里没列：' + 糊条);

/* 进度那一排住在 .fd-row 里，而 .fd-row 那条 flex 写在 template.html（页面自带的样式），
   注入块里没有 —— 只贴注入那一块会让 flex:1 1 6em 落空，量出来的宽度是假的。
   真页面的顺序是先 template 的 style 再注入块，这里照这个顺序贴。 */
const TPL = fs.readFileSync(REPO + '/src/_fd/template.html', 'utf8');
const t0 = TPL.indexOf('<style>'), t1 = TPL.indexOf('</style>', t0);
if(t0 < 0 || t1 < 0) throw new Error('template.html 里没圈到 style');
const TPLCSS = TPL.slice(t0 + 7, t1);
if(TPLCSS.indexOf('${') >= 0) throw new Error('template.html 的 style 里有 ${}：这一页兜不住，先看是不是 build 的活');
/* 两份 CSS 都用 JSON.stringify 落成 JS 字符串字面量：CSS 注释里有反引号（template.html:258 那一条），
   String.raw 兜不住 —— 别为了少写一层引号把源码改形。 */
if(TPLCSS.indexOf('.fd-row{') < 0) throw new Error('template.html 的 style 里没有 .fd-row');

/* ---------- 二、schedule/main.js：export default 之前 whole 贴进来 ---------- */
const SCRH = fs.readFileSync(REPO + '/data/plugins/schedule/main.js', 'utf8');
const cut = SCRH.indexOf('export default');
if(cut < 0) throw new Error('schedule/main.js 里没找到 export default');
const SCHSRC = SCRH.slice(0, cut);
if(SCHSRC.indexOf('.sch-sub') >= 0) throw new Error('日程那个插件自己写了 .sch-sub？样式该在 fd3-shell 那一层');

/* ---------- 三、music-remote/main.js：musLag + MUS_LAG_MS + offsetField ---------- */
const TMSRC = fs.readFileSync(REPO + '/data/plugins/music-remote/main.js', 'utf8');
function tillBrace(src, head){
  const i = src.indexOf(head);
  if(i < 0) throw new Error('源码里找不到「' + head + '」');
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(!d){ j++; break; } }
  }
  return src.slice(i, j);
}
const MUMLAG = tillBrace(TMSRC, 'function musLag(ms)');
const LAGMS = (TMSRC.match(/^const MUS_LAG_MS = \d+;/m) || [null])[0];
if(!LAGMS) throw new Error('没抓到 const MUS_LAG_MS');
const OFFFIELD = tillBrace(TMSRC, 'offsetField(){').replace(/^offsetField\(\)/, 'function offsetField()');

const STUB = `
const out = []; let bad = 0;
const T = (nm, cond, extra) => { out.push((cond ? 'PASS ' : 'FAIL ') + nm + (extra == null ? '' : '  —— ' + extra)); if(!cond) bad++; };
const 等 = ms => new Promise(r => setTimeout(r, ms));
/* 组件宿主的 h：等 FD 那一份（tag/props/children，class 与 style 直接落） */
function h(tag, props, kids){
  const n = document.createElement(tag);
  for(const k in (props || {})){
    const v = props[k];
    if(v == null || v === false) continue;
    if(k === 'class') n.className = v;
    else if(k === 'style' || k === 'html') n[k] = v;
    else if(k === 'onclick') n.addEventListener('click', v);
    else if(k.slice(0, 2) === 'on' && k.length > 2) n.addEventListener(k.slice(2), v);
    else if(k.slice(0, 5) === 'data-') n.setAttribute(k, v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  const put = x => { if(x == null || x === false) return;
    if(Array.isArray(x)) return x.forEach(put);
    n.appendChild(typeof x === 'object' && x.nodeType ? x : document.createTextNode(String(x))); };
  put(kids);
  return n;
}
const ic = () => h('i');
/* 配色那一张卡给的真值：糊不糊要拿计算值比，变量没落上来会一片糊成 none 的假 PASS */
document.documentElement.style.cssText = '--accent:#2f7d7d;--ok:#2e8b57;--candidate-bg:#eef0f4;' +
  '--card-bg:#ffffff;--text:#222222;--text-light:#8a8a8a;--hair-color:#dddddd;--r-card:6px;--bw:1px';
`;

/* CSS 走真身那两条路：源码里它是一段模板字面量，运行时贴进 <style>。
   这里用 JSON.stringify 落成字符串字面量（CSS 注释里有反引号，String.raw 会当场断在中间），
   再由这一页贴两枚 style 进 head —— 直接把 CSS 抄进 script 会当 JS 解析。 */
const SRC = 'const CSS_TEXT = ' + JSON.stringify(CSS) + ';\n' +
  'const TPL_TEXT = ' + JSON.stringify(TPLCSS) + ';\n' + SCHSRC + '\n' + LAGMS + '\n' + MUMLAG + '\n' + OFFFIELD + '\n';

const TEST = `
/* 样式贴上去：跟真页面一个顺序 —— 先 template.html 自带的那一块，再 FD 运行时注入的那一块 */
{ const a = document.createElement('style'); a.textContent = TPL_TEXT; document.head.appendChild(a);
  const b = document.createElement('style'); b.textContent = CSS_TEXT; document.head.appendChild(b); }
/* ========== 图14：卡片展开时顶栏糊一层 ========== */
document.body.insertAdjacentHTML('afterbegin',
  '<header class="fd-top"><button class="fd-mbtn"></button>' +
  '<div class="fd-brand">Flow-Desk<small>personal workspace</small></div>' +
  '<div class="fd-when"><b>10:24</b></div><span class="fd-top-sp"></span>' +
  '<button class="fd-btn">添加插件</button></header>');
const 顶 = document.querySelector('.fd-top'), 名 = document.querySelector('.fd-brand'),
  表 = document.querySelector('.fd-when'), 钮 = document.querySelector('.fd-btn');
const 算 = el => getComputedStyle(el).filter;
/* 这一页要量的是层叠，先把两件跟层叠无关的事按住：
   · 后台标签里 CSS 过渡不推进，不等完量到的是 blur(0px)（上一趟就是这么红的）—— 掐掉过渡；
   · 探针浏览器的鼠标只要压在顶栏上，:hover 那一条会抢先 —— 顶栏关掉命中测试，:hover 就不命中了。
   掐掉的那两样各自另核一条（下面有），不许因为按住就把「本该有过渡」这件事蒙过去。 */
{ const s = document.createElement('style');
  s.textContent = '.fd-top,.fd-brand,.fd-when,.fd-btn{transition:none !important}';
  document.head.appendChild(s); }
顶.style.pointerEvents = 'none';
T('顶栏这一片本来不糊（计算值 filter: none）', 算(名) === 'none' && 算(表) === 'none', 算(名) + ' ｜ ' + 算(表));
顶.classList.add('dim');
T('挂上 .dim：名字糊了，blur(1.6px)', 算(名) === 'blur(1.6px)', 算(名));
T('挂上 .dim：时间那一条跟着糊（它是顶栏里另一句字，不该独醒）', 算(表) === 'blur(1.6px)', 算(表));
T('挂上 .dim：按钮不糊（菜单、添加插件、设置还是清楚的，糊了的钮看着像坏了）', 算(钮) === 'none', 算(钮));
/* 点名的只有「糊一些」，淡出是另一件事：这条量的是 opacity 一路都 1，没顺手把顶栏淡掉 */
T('只糊不淡：挂上 .dim 之后 opacity 还是 1', getComputedStyle(名).opacity === '1',
  'opacity=' + getComputedStyle(名).opacity);
顶.classList.remove('dim');
T('撤掉 .dim：立刻回到不糊（卡片缩回去顶栏就复原）', 算(名) === 'none', 算(名));
/* :hover 那一档 JS 逼不出来（真鼠标压不住），改从样式表里核两条：声明各是什么、权重谁高。
   .fd-top.dim:hover .fd-brand 四枚类级 = 40，.fd-top.dim .fd-brand 三枚 = 30，压得住靠的是权重不是顺序。
   选择器是成组写的（.foo , .bar 一条规则两个尾巴），所以要拆开比，不能整串等值。 */
const 条找 = sel => { for(const sh of document.styleSheets){ let rs; try{ rs = sh.cssRules; }catch(e){ continue; }
  for(const r of (rs || [])){
    const s2 = r.selectorText || '';
    if(s2.split(',').map(x => x.split(' ').join('')).indexOf(sel.split(' ').join('')) >= 0) return r;
  } } return null; };
const 权重 = sel => sel.split(',').map(x => x.split(' ').join(''))
  .reduce((a, x) => Math.max(a, (x.match(/[.:#[]/g) || []).length * 10), 0);
const 糊条 = 条找('.fd-top.dim .fd-brand'), 悬条 = 条找('.fd-top.dim:hover .fd-brand');
T('样式表里那两条都在：糊的那条 blur(1.6px)，鼠标进来那条 filter:none',
  !!糊条 && !!悬条 && 糊条.style.filter === 'blur(1.6px)' && 悬条.style.filter === 'none',
  (糊条 && 糊条.style.filter) + ' ｜ ' + (悬条 && 悬条.style.filter));
T('复原那条的权重压得过糊那条（40 > 30，不靠书写顺序碰运气）',
  !!悬条 && !!糊条 && 权重(悬条.selectorText) > 权重(糊条.selectorText),
  悬条 ? (权重(悬条.selectorText) + ' vs ' + 权重(糊条.selectorText)) : '-');
/* 过渡真在那一条上（上面按住它是为了量得准，不是它不该有）：只列 filter，没列 opacity —— 因为压根不改 opacity。
   这里一律拿字符串比，不写正则：这一段是模板字面量，反斜杠会先被模板吃掉一层。 */
const 过条 = ((CSS_TEXT.split('.fd-brand,.fd-when{')[1] || '').split('}')[0]).split(' ').join('');
T('淡入淡出那一条写在：transition 只列 filter（改了 opacity 却漏过渡那种不一致在这条上没有）',
  过条 === 'transition:filter.18s;', 过条 || '没找到这条');
/* 展开那一道闸：判定用的是布局，不是 DOM —— 量一遍算法本身跟 cardFor 是不是同一个式子 */
const 源 = ${JSON.stringify(SH.join('\n'))};
const 闸1 = (源.match(/const expanded = ([^;]+);/) || ['', ''])[1].split(' ').join('');
const 闸2 = (源.match(/const full = (GRID_COLS[^;]+);/) || ['', ''])[1].split(' ').join('');
T('dimTop 那道闸的面积式和 cardFor 的 expanded 完全一条（不会一张卡糊了另一张没糊）',
  !!闸1 && !!闸2 && 闸1.indexOf(闸2) >= 0, 'cardFor: ' + 闸1 + ' ｜ dimTop: ' + 闸2);
T('EXPAND_AREA 还是那一个数（大半个版面 = 0.25 满格）',
  /const EXPAND_AREA = \\.25;/.test(源), (源.match(/const EXPAND_AREA = [^;]+;/) || [''])[0]);

/* ========== 图13：主日程里那一排子日程进度细条 ========== */
P = { el:h, icon:ic, settings:{ get:() => null }, bus:{ emit(){} }, store:{}, toast(){}, dialog:{},
  slotColor:() => 'rgb(200,120,40)' };
const 子 = (ttl, prog, done) => ({ id:'c' + ttl, title:ttl, start:'2026-10-07T09:00', end:'2026-10-07T09:30',
  time:'09:00', endT:'09:30', slot:1, note:'', tags:[], children:[], done:!!done, progress:prog, at:0 });
const 父 = { id:'p1', title:'录音棚', start:'2026-10-07T09:00', end:'2026-10-07T12:00',
  time:'09:00', endT:'12:00', slot:2, note:'', tags:[], at:0,
  children:[子('试音', 100, true), 子('叠轨', 40), 子('混音', 0)] };
const 独 = { id:'p2', title:'买弦', start:'2026-10-07T14:00', end:'2026-10-07T14:20',
  time:'14:00', endT:'14:20', slot:3, note:'', tags:[], children:[], done:false, at:0 };
const s = { items:[父, 独], tags:[] };
const box = h('div');
box.style.cssText = 'width:460px';
document.body.appendChild(box);   /* 不贴进文档，getBoundingClientRect 全是 0，量的就是空气 */
renderTree(box, s, { el:h, icon:ic, bus:{ emit(){} }, settings:{ get:() => null }, slotColor:() => 'rgb(200,120,40)' });
const 排 = box.querySelector('.sch-sub');
T('有子日程的那一行摆出了进度那一排（class .sch-sub）', !!排, 排 ? 排.className : '没有这一层');
T('三条子日程 = 三根细条，一根不落', 排 && 排.children.length === 3, 排 ? String(排.children.length) : '-');
const 宽 = [...排.children].map(i => { const b = i.querySelector('b'); return b ? b.getAttribute('style') : null; });
T('细条里的填充宽度就是那一子自己的百分比（100 / 40 / 0）',
  宽[0].indexOf('100%') >= 0 && 宽[1].indexOf('40%') >= 0 && 宽[2].indexOf('0%') >= 0, JSON.stringify(宽));
T('满的那一根挂 .full（走 --ok 那一色，跟没满的强调色分得开）',
  排.children[0].classList.contains('full') && !排.children[1].classList.contains('full'),
  排.children[0].className + ' ｜ ' + 排.children[1].className);
const 条高 = [...排.children].map(i => Math.round(i.getBoundingClientRect().height));
const 条宽 = [...排.children].map(i => Math.round(i.getBoundingClientRect().width));
T('细条是有宽度的横条，不是线条：高 7px、宽 ' + 条宽[0] + 'px（≥ 80px）',
  条高.every(x => x === 7) && 条宽[0] >= 80, '高 ' + JSON.stringify(条高) + ' 宽 ' + JSON.stringify(条宽));
const 排高 = Math.round(排.getBoundingClientRect().height);
T('三根摞起来 + 缝 = 27px（7+7+7 再两条 3px 的 gap，横排里不会挤成一条线）',
  排高 === 27, '量到 ' + 排高 + 'px');
const 色满 = getComputedStyle(排.children[0].querySelector('b')).backgroundColor;
const 色半 = getComputedStyle(排.children[1].querySelector('b')).backgroundColor;
T('满的绿、没满的走强调色，两个色不一样', 色满 === 'rgb(46, 139, 87)' && 色半 === 'rgb(47, 125, 125)',
  色满 + ' ｜ ' + 色半);
T('没子日程的那一行不摆这一排（给光杆条摆一排空槽是添乱）',
  box.querySelectorAll('.sch-sub').length === 1, String(box.querySelectorAll('.sch-sub').length) + ' 排');
/* 父级进度：由子日程算，不是手填的那个数 */
const 父进 = nodeProgress(父), 平均 = Math.round((100 + 40 + 0) / 3);
T('父级进度由三条子日程算出来（100/40/0 → ' + 父进 + '）', 父进 === 平均, 'nodeProgress=' + 父进 + ' 平均=' + 平均);
const 全done = { id:'p3', title:'全勾', start:父.start, end:父.end, slot:1, children:[子('a', 0, true), 子('b', 0, true)], done:false };
T('三条子日程都勾了完成 = 父级 100%（勾了没填进度也算满）', nodeProgress(全done) === 100, String(nodeProgress(全done)));
const 一层 = { id:'p4', title:'光杆', start:父.start, end:父.end, slot:1, children:[], done:true };
T('没子日程的：勾了就 100、没勾就 0，不给它凭空造中间值',
  nodeProgress(一层) === 100 && nodeProgress({ ...一层, done:false }) === 0, String(nodeProgress(一层)));

/* ========== 图6：歌词延迟那一个「归零」 ========== */
const 记 = [];
/* 挂全局：offsetField 是在这一页的顶层声明的，它找 Music 找的是全局那一份 ——
   const 写在下面那个 async 括号里它够不着（上一趟就是这么报 Music is not defined 的） */
globalThis.Music = { flags:{ off:-300 }, gen:0, offsetMs(){ return Number(this.flags.off) || 0; },
  tell(){ 记.push('tell#' + this.gen); }, flagSet(k, v){ 记.push('flagSet ' + k + '=' + v); this.flags.off = v; } };
const bar = { };
const 排2 = offsetField.call(bar);
T('延迟那一栏包成了一个整体（滑杆 + 归零，中间用 .mu-lag-wrap 串着）',
  排2.classList.contains('mu-lag-wrap') && 排2.children.length === 2, 排2.className + ' ｜ ' + 排2.children.length + ' 个孩子');
const 杆 = 排2.querySelector('input[type=range]'), 字 = 排2.querySelector('.mu-lag-t'), 零 = 排2.querySelector('.mu-lag-rst');
T('归零那个按钮在位，上面写的是「归零」，题目把 0 毫秒那句话说全了',
  !!零 && 零.textContent === '归零' && 零.title.indexOf('0 毫秒') >= 0, 零 ? 零.textContent + ' ｜ ' + 零.title : '没这个');
T('按钮打了 data-nograb（遥控器卡面上那个不能被抓着拖动）', 零.getAttribute('data-nograb') === '1', 零.getAttribute('data-nograb'));
T('进这一屏时读的是当前那份延迟：-300 → 「歌词提前 300ms」', 字.textContent === '歌词提前 300ms' && 杆.value === '-300',
  字.textContent + ' ｜ 杆=' + 杆.value);
零.dispatchEvent(new MouseEvent('click', { bubbles:true }));
T('点归零：滑杆回中、当场那句变「歌词对齐」', 杆.value === '0' && 字.textContent === '歌词对齐',
  杆.value + ' ｜ ' + 字.textContent);
T('点归零：Music.flags.off 归 0、gen 加了一格、tell 走了一趟（歌词当场跳回原位）',
  Music.flags.off === 0 && Music.gen === 1 && 记.indexOf('tell#1') >= 0, JSON.stringify(记));
T('点归零：小抄也写了（flagSet off=0），另一端下次开是同一个数', 记.indexOf('flagSet off=0') >= 0, JSON.stringify(记));
/* 拖一趟还在老路上：归零不该把 input/change 那两条挤掉 */
杆.value = '250'; 杆.dispatchEvent(new Event('input', { bubbles:true }));
T('拖滑杆那一路照旧：input 只改内存里那份，不写小抄',
  Music.flags.off === 250 && Music.gen === 2 && 记.length === 3, JSON.stringify(记) + ' gen=' + Music.gen);
杆.dispatchEvent(new Event('change', { bubbles:true }));
T('松手才写小抄（一路写就是几十次文件改动）', 记[3] === 'flagSet off=250', JSON.stringify(记));
T('行程两端还是 ±800 毫秒，归零没把它改成单向',
  杆.min === '-800' && 杆.max === '800', 杆.min + ' ~ ' + 杆.max);
/* 归零那个的样子（字号小一档、不换行、跟滑杆并排）写在 music-remote 自己的 addCss 里，
   这一页没把那一整块样式贴进来 —— 拿 getComputedStyle 量只会量到浏览器默认值，是假数。
   所以这一条核的是源码里那三行声明真在、而且真带着这两个类名。 */
const 样式源 = ${JSON.stringify(TMSRC)};
const 零条 = (样式源.match(/^\.mu-lag-rst\{[^}]*\}/m) || [''])[0];
const 包条 = (样式源.match(/^\.mu-lag-wrap\{[^}]*\}/m) || [''])[0];
T('归零那个的样式写在 music-remote 自己那一份里：字号 .78em、不换行',
  零条.indexOf('font-size:.78em') >= 0 && 零条.indexOf('white-space:nowrap') >= 0, 零条 || '没这条');
T('那一栏包成 inline-flex 并排（滑杆 + 归零，中间 .35em 的缝）',
  包条.indexOf('inline-flex') >= 0 && 包条.indexOf('align-items:center') >= 0, 包条 || '没这条');

window.__RESULT = { lines: out, bad };
`;

const html = ['<!doctype html><meta charset="utf-8"><title>外26 四组：进度细条 / 顶栏糊一层 / 延迟归零</title>',
  '<body style="font:15px/1.6 system-ui"><pre id="o" style="font:13px/1.6 monospace;white-space:pre-wrap"></pre><script>',
  STUB, SRC, '(async()=>{ try{', TEST,
  '}catch(e){ const sp = String((e && e.stack) || e); document.getElementById("o").textContent = "跑挂了：\\n" + sp; window.__RESULT = { lines: out.concat(["THROW " + sp.split("\\n").slice(0,3).join(" | ")]), bad: bad + 1 }; } })();',
  '</script></body>'].join('\n');
if((STUB + SRC + TEST).includes('</script')) throw new Error('源码含 </script，会撕页');
const DST = __HERE + 'fd4-test.html';
fs.writeFileSync(DST, html);
fs.writeFileSync(DST.replace('fd4-test.html', '_chk_fd4.js'),
  html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')));
console.log('写了 fd4-test.html（' + Math.round(html.length / 1024) + ' KB）｜ CSS ' + CSS.length +
  ' ｜ 日程 ' + SCHSRC.length + ' ｜ 遥控器那一支 ' + OFFFIELD.length);
