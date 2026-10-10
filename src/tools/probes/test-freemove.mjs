/* 外34 第 1 条 · 桌面卡片自由移动（跑 src/tools/selfcheck.mjs 一起过，也可单跑）
   他的原话：「我希望是真正的 Flow-Desk，所有卡片可以自由移动」。
   从前落点被占就整单回弹（外33 那条「87 处合法落点」就是这条规矩的产物）；
   现在钉住落下的那一块，压着的别一张张推开，只有整张桌面真装不下这么多才作废。
   这一台不抄第二份算法：把真源码那七颗（rect / hits / fits / 在界内 / 推开 / 让位 / 夹进）端进虚拟机跑真布局。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('外34 · 卡片自由移动');
const S = rd('src/_fd/src/fd3-shell.js');

const 常量 = 切(S, 'GRID_COLS') + '\n';
const 七颗 = ['  rect(it){', '  hits(a, b){', '  fits(rect, self){', '  在界内(r){',
  '  推开(r, 定){', '  让位(rect, self){', '  夹进(rect){'].map(h => 切方法(S, h));
const 列 = ['rect', 'hits', 'fits', '在界内', '推开', '让位', '夹进'];
const 取 = 要 => { const i = 列.indexOf(要); if(i < 0) throw new Error('切不到这一颗：' + 要); return 七颗[i]; };

function 开一台(布局, 换 = {}) {
  const ctx = { Math, JSON, GRID_COLS: 64, GRID_ROWS: 36 };
  vm.createContext(ctx);
  const 段 = 七颗.map((src, i) => 换[列[i]] !== undefined ? 换[列[i]] : src);
  vm.runInContext(常量 + 'var Shell = { layout: { items: ' + JSON.stringify(布局) + ' },\n  ' +
    段.join(',\n  ') + '\n};', ctx);
  return ctx;
}
/* 落一次：返回「落点 + 谁被推去了哪 + 整桌终态」，并当场核三条硬不变量（出界 / 叠着） */
function 落(ctx, 第几张, x, y, w, h) {
  return JSON.parse(vm.runInContext('(function(){' +
    ' var 自己 = Shell.layout.items[' + 第几张 + '];' +
    ' var 要 = Shell.夹进({ x:' + x + ', y:' + y + ', w:' + (w || 自己.w) + ', h:' + (h || 自己.h) + ' });' +
    ' var 旧 = Shell.layout.items.map(function(i){ return { id:i.id, x:i.x, y:i.y }; });' +
    ' var 动 = Shell.让位(要, 自己);' +
    ' if(动 === null) return JSON.stringify({ 成:false, 落点:要, 推了几张:0, 挪:[], 越界:[], 撞车:[] });' +
    ' 动.forEach(function(m){ m.it.x = m.x; m.it.y = m.y; });' +
    ' Object.assign(自己, 要);' +
    ' var 新 = Shell.layout.items.map(function(i){ return { id:i.id, x:i.x, y:i.y, w:i.w, h:i.h }; });' +
    ' var 越界 = 新.filter(function(r){ return !Shell.在界内(r); }).map(function(r){ return r.id; });' +
    ' var 撞车 = [];' +
    ' for(var a = 0; a < 新.length; a++) for(var b = a + 1; b < 新.length; b++)' +
    '   if(Shell.hits(新[a], 新[b])) 撞车.push(新[a].id + "+" + 新[b].id);' +
    ' var 挪 = 新.filter(function(r){ var o = 旧.filter(function(q){ return q.id === r.id; })[0];' +
    '   return o && (o.x !== r.x || o.y !== r.y); }).map(function(r){ return r.id; });' +
    ' return JSON.stringify({ 成:true, 落点:要, 推了几张:动.length, 挪:挪, 越界:越界, 撞车:撞车 }); })()', ctx));
}

/* 他 2026-10-09 04:57 那次落盘的六张卡（日程 17.5 × 35 那一档 —— 外33 那 87 处合法落点就是这一份算出来的） */
const 他那桌 = () => [
  { id:'schedule', widget:'schedule', x:45.5, y:0, w:17.5, h:35 },
  { id:'notes', widget:'notes', x:0, y:0, w:11, h:36 },
  { id:'your-sentences', widget:'your-sentences', x:11, y:0, w:18, h:2.5 },
  { id:'tool-music-remote', widget:'tool-music-remote', x:11, y:4.5, w:15, h:5 },
  { id:'why-not-write', widget:'why-not-write', x:23.5, y:2.5, w:7, h:2 },
  { id:'singbit-input-practice', widget:'singbit-input-practice', x:26, y:4.5, w:6.5, h:2 }
];

R.题('一 · 那一笔他拖不动的：35 行高的日程落到「小卡下面那片空地」');
{
  const ctx = 开一台(他那桌());
  const 前 = vm.runInContext('Shell.fits({x:11, y:10, w:17.5, h:35}, Shell.layout.items[0])', ctx);
  R.判('改前那一判还是「放不下」（fits 这颗一个字没动，它现在只给「添加插件」「改高度」那两处问路）', 前 === false, 前);
  const 出 = 落(ctx, 0, 11, 10, 17.5, 35);
  R.判('改后这一笔落成了：日程停在 x=' + 出.落点.x + '、y=' + 出.落点.y + '（35 行的卡吃不满 36 行的桌面，竖轴夹到最低能落的那一档）',
    出.成 && 出.落点.x === 11 && 出.落点.y === 1, JSON.stringify(出.落点));
  R.判('压着的四张小卡让开了路：一共挪了 ' + 出.推了几张 + ' 张（' + 出.挪.join('、') + '）',
    出.成 && 出.推了几张 === 4, 出.推了几张 + ' 张 · ' + 出.挪.join('、'));
  R.判('整桌没有一张出界、也没有两张叠着（这两条是硬账，不是观感）',
    出.越界.length === 0 && 出.撞车.length === 0, JSON.stringify([出.越界, 出.撞车]));
  R.判('便签那条 36 行全占的竖带没被牵连（日程落在它右边，两条只是贴边）',
    出.挪.indexOf('notes') < 0, 出.挪.join('、'));
}

R.题('二 · 推到通路上有东西挡着：接着让、直到让开');
{
  const 出 = 落(开一台(他那桌()), 0, 0, 0, 17.5, 35);
  R.判('日程整张压到左上角：便签那条竖带只能整条搬走（挪了 ' + 出.推了几张 + ' 张：' + 出.挪.join('、') + '）',
    出.成 && 出.挪.indexOf('notes') >= 0, JSON.stringify([出.落点, 出.挪]));
  R.判('这一桌搬完还是不越界、不叠着', 出.越界.length === 0 && 出.撞车.length === 0, JSON.stringify([出.越界, 出.撞车]));
  const 二 = 落(开一台(他那桌()), 0, 30, 20, 17.5, 16);
  R.判('落到谁都不压的地方：一张都不用挪（' + 二.推了几张 + ' 张）', 二.成 && 二.推了几张 === 0, 二.推了几张);
  const 三 = 落(开一台([
    { id:'a', x:0, y:0, w:10, h:10 }, { id:'b', x:10, y:0, w:10, h:10 }, { id:'c', x:20, y:0, w:10, h:10 }
  ]), 0, 12, 0, 10, 10);
  R.判('推开一张又压上第二张时，连锁接得上（挪的：' + 三.挪.join('、') + '）',
    三.成 && 三.挪.length >= 2 && 三.撞车.length === 0 && 三.越界.length === 0, JSON.stringify([三.挪, 三.撞车]));
}

R.题('三 · 拖出桌面以外与整桌装不下：两笔都得有个说法');
{
  const 出 = 落(开一台(他那桌()), 0, 90, 90, 17.5, 35);
  R.判('往右下角死里拖：位置夹回桌面内（x=' + 出.落点.x + ' y=' + 出.落点.y + '，右边和下边正好贴住 64 × 36）',
    出.成 && 出.落点.x + 出.落点.w === 64 && 出.落点.y + 出.落点.h === 36, JSON.stringify(出.落点));
  const 满 = 落(开一台([{ id:'a', x:0, y:0, w:64, h:36 }, { id:'b', x:0, y:0, w:64, h:36 }]), 1, 0, 0, 64, 36);
  R.判('两张整桌大的挤一张桌子：这一笔判作废（只有这种时候才回弹）', 满.成 === false, JSON.stringify(满));
  const 缩 = 落(开一台(他那桌()), 0, 5, 5, 90, 90);
  R.判('拉大到装不下桌面：尺寸先削到桌面装得下（' + 缩.落点.w + ' × ' + 缩.落点.h + '），不是弹回原形',
    缩.落点.w === 64 && 缩.落点.h === 36, JSON.stringify(缩.落点));
  R.判('削满整桌之后其余六张无处可让 —— 这一笔照实作废（不假装搬得动）', 缩.成 === false, JSON.stringify(缩.成));
  R.判('作废那一笔吃的是新那句提示，从前那句「这里放不下」不再挂在每一次拖拽上',
    /桌面装不下这么多了 · 已回弹/.test(S) && !/这里放不下/.test(S),
    (S.match(/toast\('[^']*装不下[^']*'\)/) || ['一句都没找到'])[0]);
}

R.题('四 · 扰动最小：只动压着的，别跟着搬全场');
{
  const 一 = 落(开一台(他那桌()), 3, 11, 20, 15, 5);
  R.判('一张小卡挪到空地上：只动它自己（被推的 ' + 一.推了几张 + ' 张）', 一.成 && 一.推了几张 === 0, 一.推了几张);
  const 二 = 落(开一台(他那桌()), 5, 26, 4.5, 6.5, 2);
  R.判('原地落回（没换地方）也算合法：一张都不该挪', 二.成 && 二.推了几张 === 0, 二.推了几张);
  const 三 = 落(开一台(他那桌()), 2, 0, 0, 18, 2.5);
  R.判('金句压上便签那条竖带：只推那一张（' + 三.挪.join('、') + '），与落点无关的卡原地不动',
    三.成 && 三.推了几张 === 1 && 三.挪.indexOf('notes') === 0 && 三.撞车.length === 0, JSON.stringify([三.挪, 三.撞车]));
  const 四 = 落(开一台(他那桌()), 0, 11, 9.5, 17.5, 26);
  R.判('同一张日程改小成 26 行落到那片空地：这一笔从前就放得下（fits 判真），现在也一样一张都不挪',
    四.成 && 四.推了几张 === 0 && 四.落点.y === 9.5, JSON.stringify([四.落点, 四.推了几张]));
}

R.题('五 · 接线与改坏对照');
{
  const 定bindDrag = 切方法(S, '  bindDrag(card, it, def){');
  const 定done = 定bindDrag.slice(定bindDrag.indexOf('const done = () =>'));
  R.判('拖完那一步吃的是 让位（不再吃 fits 那一判）',
    /const 动 = shell\.让位\(落, it\)/.test(定done) && !/if\(shell\.fits\(cur, it\)\)/.test(定done),
    (定done.match(/const 落 =[^\n]*/) || [''])[0].trim());
  R.判('让开的每一张都当场重新落位（不整桌重画，组件不跟着重挂）',
    /document\.querySelector\('\[data-iid="' \+ m\.it\.id/.test(定done) && /if\(el\) shell\.place\(el, m\.it\)/.test(定done),
    (定done.match(/const el = document[^\n]*/) || [''])[0].trim());
  R.判('只有真推不动、或改了尺寸、或换了展开那一档才重画整桌',
    /if\(动\.length \|\| mode === 'resize' \|\| grew !== was\) shell\.render\(\);/.test(定done),
    (定done.match(/if\(动\.length[^\n]*/) || [''])[0].trim());
  /* 改坏：把 推开 里「四条边都不通就找第一块空地」那一圈拆掉（换成从前那种一步一格都扫不到） */
  const 坏推 = 取('推开').replace('for(let y = 0; y + r.h <= GRID_ROWS; y += 0.5)', 'for(let y = 0; y + r.h <= GRID_ROWS; y += 99)');
  R.判('坏的那一份确实只动了「找空地」那一圈（改不动就是这台在自欺）',
    坏推 !== 取('推开') && /y \+= 99/.test(坏推), (坏推.match(/for\(let y[^\n]*/) || [''])[0].trim());
  const 坏出 = 落(开一台(他那桌(), { 推开: 坏推 }), 0, 0, 0, 17.5, 35);
  R.判('拆掉那一圈，便签那条 36 行全占的竖带就成了死路（这一笔当场作废）', 坏出.成 === false, JSON.stringify(坏出));
  const 坏让 = 取('让位').replace('if(推.x !== r.x || 推.y !== r.y) 动.push({ it, x:推.x, y:推.y });',
    'if(推.x !== r.x || 推.y !== r.y) 动.push({ it, x:r.x, y:r.y });');
  const 坏让出 = 落(开一台(他那桌(), { 让位: 坏让 }), 2, 0, 0, 18, 2.5);
  R.判('坏二：让开的地方没真记下来（推了等于没推）—— 整桌当场叠着，判法咬得住',
    坏让 !== 取('让位') && 坏让出.撞车.length > 0, JSON.stringify(坏让出.撞车));
  R.判('fits 那颗一个字没动（添加插件、改高度那两处还靠它问路）',
    /return !this\.layout\.items\.some\(it => it !== self && this\.hits\(rect, this\.rect\(it\)\)\);/.test(取('fits')), 取('fits').split('\n').length + ' 行');
}

R.收尾();
