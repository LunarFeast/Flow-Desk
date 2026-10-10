/* 外36 · 正文那一屏的三处 + 外35 那条「最近打开允许手动删除」
   作者原话：
     「卡片出场次数统计上了，但是高亮、关连失败，样式没有变化，也不能从正鼠标悬浮看到卡片，也不能点击跳转卡片」
     「文字在正文中没有高亮/突出显示」
     「停靠的最近打开允许手动删除」
     「现在软件内的圆点形式排序比较乱，感觉色相、亮度都有点起起伏伏」
   规矩照这一仓来：仓库里那一份原文一颗一颗切进 node:vm 跑（高亮那 20 条样式是从 w8-write.js 顶上那份 addCss
   模板当场算出来的，点跳转用的是真 bindCtx 里那一只监听，色卡排的是真 CardPool.sortIn，去掉一笔用的是真 recentDrop），
   只在边界使替身（容器、假事件、存档那一层）。每条都报数，最后咬三口。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('test-hl36');
const W8 = rd('src/_wnw/src/w8-write.js'), W3 = rd('src/_wnw/src/w3-shell.js'),
      W11 = rd('src/_fd/src/fd11-cards.js'), SK = rd('src/_wnw/src/w0-skin.js'),
      W10 = rd('src/_wnw/src/w10-cards.js');
const 底 = { console, Math, JSON, Object, Array, String, Number, RegExp, isNaN, parseInt, parseFloat, Set, Map, Date };

/* ---------- 一、高亮那 20 条样式：当场把 w8-write.js 顶上那份 addCss 的模板算出来 ---------- */
R.题('一、高亮样式（真那份 addCss 跑出来的文本）');
function 端模板(src){
  const 头 = 'addCss(`', i = src.indexOf(头);
  if(i < 0) throw new Error('找不到 addCss(`');
  /* 从开引号往后配平：模板串里可以嵌 ${}、${} 里又可以嵌反引号，两种都要数着走（少一样就会停在里层那一根反引号上） */
  let k = i + 头.length, 花 = 0;
  while(k < src.length){
    const c = src[k];
    if(c === '\\'){ k += 2; continue; }
    if(c === '`' && !花) return src.slice(i + 头.length - 1, k + 1);
    if(c === '$' && src[k + 1] === '{'){ 花++; k += 2; continue; }
    if(花){ if(c === '{') 花++; else if(c === '}') 花--; }
    k++;
  }
  throw new Error('那一份 addCss 的模板没收尾');
}
const 台一 = vm.createContext(Object.assign({}, 底));
vm.runInContext('this.CSS = ' + 端模板(W8), 台一);
const CSS = 台一.CSS;
const 无注 = CSS.replace(/\/\*[\s\S]*?\*\//g, '');      /* 样式里那些说明是写给人看的，别拿它当规则比 */
const 条 = [...无注.matchAll(/([^\n{};]*hl-\d+[^\n{};]*)\s*\{/g)].map(m => m[1].trim());
R.数('样式里带 hl- 档号的条数', 条.length);
R.数('头三条', 条.slice(0, 3).join(' ｜ '));
R.判('二十档一条不缺，每档都有', 条.length === 20 && [...Array(20)].every((x, i) => 条.some(s => s.endsWith('.hl-' + (i + 1)))));
R.判('每一条都是「从容器往里找那一颗字」那一档（.wnw-root .hl-N，中间一格空格）',
  条.every(s => /^\.wnw-root \.hl-\d+$/.test(s)), 条.filter(s => !/^\.wnw-root \.hl-\d+$/.test(s)).join(' ｜ '));
R.判('一条同元素顶两个类名的写法都没有（.wnw-root.hl-N 这种一辈子配不上）', !/\.wnw-root\.hl-/.test(无注));
R.判('每条第 N 档先取标记色第 N 个、兜底才是配色那五个强调位轮着来（外13-N 定的口径）',
  [...Array(20)].every((x, i) => CSS.includes('.wnw-root .hl-' + (i + 1) + '{color:var(--mark-' + (i + 1) +
    ', var(--slot-' + (i % 5 + 1) + '));')));
const 挂根 = (W3.match(/classList\.add\('wnw-root'\)/g) || []).length + (W8.match(/class:'wnw-root/g) || []).length +
  (rd('src/_wnw/src/w0-skin.js').match(/class:'wnw-root/g) || []).length;
R.数('源码里把 wnw-root 这个类写到一个元素上的地方', 挂根);
R.判('wnw-root 只写在容器那一个元素上（正文那些字只带 hl-N，两头不会撞在同一个元素上）', 挂根 === 1);

/* ---------- 二、点高亮那一个字跳转那张卡：真 bindCtx 里那一只 click 监听 ---------- */
R.题('二、正文点高亮卡片名 → 开那张卡（真 bindCtx 跑出来的监听）');
const 台二 = vm.createContext(Object.assign({}, 底, {
  h:(t, a, k) => ({ t, a:a || {}, k:k || [] }), icoMarkup:n => 'ico:' + n, cut:s => String(s || ''),
  Menu:{ open(){} }, Overlay:{ open(){}, close(){} }, toast(){},
  Cards:{ tpls:[], async forBook(){ return []; }, async get(){ return null; } },
  Desk:{ 记: [], async addTab(k, r){ this.记.push([k, r]); } },
  window:{ 记: [], open(u){ this.记.push(u); } }
}));
vm.runInContext('this.O = {' + 切方法(W8, '  bindCtx(){') + '};', 台二);
const 收 = {};
const 这 = { edHost:{ addEventListener:(t, f) => { 收[t] = f; } }, c:{ id:'ch1', paras:[] }, ed:null };
台二.O.bindCtx.call(这);
const 元 = (属, 值) => ({ getAttribute:k => (k === 属 ? 值 : null) });
const 事 = (按住, 哪一个) => ({ ctrlKey:按住, metaKey:false, 挡:false, preventDefault(){ this.挡 = true; },
  target:{ closest:() => 哪一个 } });
R.数('bindCtx 往正文那一屏挂的监听', Object.keys(收).join(' + '));
R.判('右键菜单和点击两只都在（点击这一只是这一轮新添的口）', !!收.contextmenu && !!收.click);
await 收.click.call(这, 事(true, 元('data-card', 'k9')));
R.判('按住 Ctrl 点在带 data-card 的那一颗字上 → 开的是那张卡（Desk.addTab 收到 card + k9）',
  JSON.stringify(台二.Desk.记) === '[["card","k9"]]', JSON.stringify(台二.Desk.记));
台二.Desk.记.length = 0; 台二.window.记.length = 0;
const 没按 = 事(false, 元('data-card', 'k9'));
await 收.click.call(这, 没按);
R.判('普通一下不抢（没按住 Ctrl / ⌘ 一次都不开，那一下还是要留给放光标打字）',
  台二.Desk.记.length === 0 && !没按.挡, JSON.stringify(台二.Desk.记));
台二.Desk.记.length = 0; 台二.window.记.length = 0;
await 收.click.call(这, 事(true, 元('data-href', 'https://x.test/a')));
R.判('按住 Ctrl 点的是一颗链接 → 仍旧开外部、不去开卡（老那一头没被这次改动碰坏）',
  台二.window.记.join('') === 'https://x.test/a' && 台二.Desk.记.length === 0,
  台二.window.记.join(' ') + ' ｜ ' + JSON.stringify(台二.Desk.记));
R.判('悬浮摘要认的是同一枚门牌（鼠标停在带 data-card 的字上才浮那张卡）',
  /closest\('\[data-card\]'\)/.test(W10) && /data-card="' \+ \(cm\.card|data-card="' \+ cm\.card/.test(W8),
  W8.match(/data-card[^\n]*/g)[0]);

/* ---------- 三、色卡一组之内那一排：真 CardPool.sortIn ---------- */
R.题('三、色卡组内排序（明度为轴 → 挨着的拢成一层 → 层内走色相、一层往右下一层往左）');
const 起三 = W11.indexOf('const CardPool = {'), 找三 = W11.indexOf('\nconst ', 起三);
const 止三 = 找三 < 0 ? W11.length : 找三;      /* CardPool 是这份文件最后一颗顶层声明，往后没有下一个 const */
/* 端一台只装真 CardPool 那三颗（hexOf / hex / sortIn）：咬口要换一把尺，就照同一份拼法另起一台，别改这一台 */
const 端卡 = 文 => { const 台 = vm.createContext(Object.assign({}, 底));
  vm.runInContext(rd('src/_shared/sh-color.js'), 台, { filename:'sh-color.js' });
  vm.runInContext('this.CV = CV;', 台);
  vm.runInContext('this.卡 = {' + 切方法(文, '  hexOf(', 起三, 止三) + ',' +
    切方法(文, '  hex(', 起三, 止三) + ',' + 切方法(文, '  sortIn(', 起三, 止三) + '};', 台);
  台.CardPool = 台.卡; return 台; };   /* 切出来的方法里叫的是自由名 CardPool，得挂到这一台的窗口上才认得 */
const 台三 = 端卡(W11);
const 卡 = 台三.卡; 台三.CardPool = 卡;
const 色 = (...hs) => hs.map(hh => ({ code:'c', colors:[{ raw:hh, format:'auto' }] }));
const H = c => 台三.CV.hslOf(卡.hex(c.colors[0].raw));
const 相 = c => H(c)[0] * 360, 明 = c => H(c)[2];
const 极差 = c => { const h = 卡.hex(c.colors[0].raw);
  const n = [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)); return Math.max(...n) - Math.min(...n); };
const 倒退 = (a, b) => ((b - a + 540) % 360) - 180;
const 码 = 个 => 个.map(c => 卡.hex(c.colors[0].raw));
/* 这一排里「有没有方向」那一闸 —— 照 sortIn 里同一把尺再算一遍（彩度加权的合力 + R~B 极差的中位） */
function 闸(个){
  const 差 = 个.map(极差).sort((a, b) => a - b);
  let x = 0, y = 0, 总 = 0;
  for(const c of 个){ const r = 相(c) * Math.PI / 180; x += 极差(c) * Math.cos(r); y += 极差(c) * Math.sin(r); 总 += 极差(c); }
  return { 走:(总 ? Math.hypot(x, y) / 总 : 0) >= .45 && 差[Math.floor(差.length / 2)] >= 24,
    合力:总 ? Math.hypot(x, y) / 总 : 0, 中位:差[Math.floor(差.length / 2)] };
}
/* 排好的每一颗落在第几层：层要切在「排之前」那一趟上。
   sortIn 是在从深往浅的队列上积 8 个点换一层的，可它排完把奇数层整个反过来 ——
   拿输出重新一颗一颗积层，奇数层里明度是倒着走的，层界线当场切歪（本轮就踩过：这么量出 507 处「走反」，
   其实是量法的错）。所以这里照同一把尺在输入上切层，再用对象本身把层号带回输出上。 */
function 层表(个){
  const 深 = 个.slice().sort((a, b) => (明(a) - 明(b)) || 卡.hexOf(a).localeCompare(卡.hexOf(b)));
  const 表 = new Map();
  for(let i = 0, 号 = 0; i < 深.length; 号++){
    let j = i;
    while(j < 深.length && 明(深[j]) - 明(深[i]) <= .08) j++;
    for(let x = i; x < j; x++) 表.set(深[x], 号);
    i = j;
  }
  return 表;
}
/* 两把眼睛的尺：明度往回走最多走了几个点（「深色混在浅色里」）+ 相邻两颗色相跳多远（「起起伏伏」） */
function 眼力(个){
  let 回 = 0, 跳 = 0, 大 = 0;
  for(let i = 1; i < 个.length; i++){
    回 = Math.max(回, 明(个[i - 1]) - 明(个[i]));
    const h = Math.abs(倒退(相(个[i - 1]), 相(个[i])));
    跳 += h; if(h > 30) 大++;
  }
  return { 回:回 * 100, 跳:跳 / Math.max(1, 个.length - 1), 大 };
}
/* 他真那一份内置配色（软件里色卡那一屏摆的就是这些） */
const 台数 = vm.createContext(Object.assign({}, 底));
vm.runInContext(rd('src/_fd/src/fd13-colour-v1.js'), 台数, { filename:'fd13-colour-v1.js' });
vm.runInContext('this.表 = COLOUR_V1;', 台数);
const 真档 = Object.keys(台数.表).filter(g => g !== '黑白灰')
  .map(g => ({ 名:g, 个:台数.表[g].map(hh => ({ code:hh, colors:[{ raw:hh }] })) }));
/* 他点名的那张参考卡：蓝色系 50 色，图上每块底下印着色号 —— 一颗一颗照图抄下来（读序 1..50） */
const 参 = ['#a7d8e8','#e6f1f7','#9bc4e2','#c0ddee','#a8d3e7','#8fbfd6','#7ec0d9','#6fb3ce','#5da7c9','#4f9ec4',
  '#7db6dd','#6aa9ce','#5b9cc6','#4e8fbe','#3f82b5','#3a7ab0','#3b6f9e','#35689a','#2e5e8c','#26608a',
  '#1f5a82','#1b4f7a','#15446e','#103b62','#0e3460','#0b2f56','#1a3b7a','#243d7a','#2c4a9a','#3158b0',
  '#3a6acb','#4b7bd9','#566fcc','#2a7b8f','#238e9b','#1e6b8c','#1697a5','#0f8c8d','#2e6f8e','#1e5f7a',
  '#2a7e9e','#4a6f8a','#364f6b','#2a3f5b','#1f3557','#152f4a','#0f2742','#0a1f36','#081a2f','#061423']
  .map(hh => ({ code:hh, colors:[{ raw:hh }] }));
function 贴参考(排){
  const 位 = new Map(排.map((c, i) => [卡.hex(c.colors[0].raw), i]));
  const 反 = 序 => { let n = 0;
    for(let i = 0; i < 序.length; i++) for(let j = i + 1; j < 序.length; j++)
      if(位.get(卡.hex(序[i].colors[0].raw)) > 位.get(卡.hex(序[j].colors[0].raw))) n++;
    return n / (序.length * (序.length - 1) / 2); };
  return Math.min(反(参), 反(参.slice().reverse()));   /* 那张是浅 → 深读的，软件里是深 → 浅：两个方向都试，取贴得近的 */
}

const 蓝 = 色('#0f2a4a', '#1e3a5f', '#2a4d80', '#3b6cb5', '#5b8fd6', '#a8c6e8', '#7a2ec7', '#c9a0dc', '#123b6e');
const 排蓝 = 卡.sortIn(蓝), 表蓝 = 层表(蓝), 层蓝 = 排蓝.map(c => 表蓝.get(c));
R.数('这一支蓝排出来', 码(排蓝).join(' '));
R.数('落第几层 / 明度回了几个点 / 相邻色相平均跳', 层蓝.join('') + ' ｜ ' +
  眼力(排蓝).回.toFixed(1) + ' 个点 ｜ ' + 眼力(排蓝).跳.toFixed(1) + '°');
R.判('认成「有方向」的一支（彩度加权合力 ' + Math.round(闸(蓝).合力 * 100) + '% · 中位极差 ' + 闸(蓝).中位 + '）', 闸(蓝).走);
R.判('整排明度一次都不往回走超过一层（8 个点）—— 这一条就是「深色混在浅色里面」那一句的反面',
  眼力(排蓝).回 <= 8.001, 眼力(排蓝).回.toFixed(2) + ' 个点');
/* 层内怎么走：拿他真那九档量（这一支蓝只有 9 颗，一层里常常就一颗，方向看不出来）。
   色相是个环，所以判方向要用「原始度数」而不是绕圈后的差 —— 一整层跨了 0° 那道缝时，
   绕圈量法会把首尾那一步读成反向，那是量法的错，不是排法错了（这一条本轮踩过，记在这儿）。 */
function 层验(排){
  const 表 = 层表(排), 堆 = [];
  排.forEach(c => { const k = 表.get(c);
    if(!堆.length || 堆[堆.length - 1][0] !== k) 堆.push([k, [c]]); else 堆[堆.length - 1][1].push(c); });
  let 反 = 0, 高 = 0;
  堆.forEach(([k, 段]) => {
    高 = Math.max(高, (明(段[段.length - 1]) - 明(段[0])) * 100);
    const 该升 = k % 2 === 0;                     /* 偶数层色相往上走、奇数层往下走 = 一层往右下一层往左 */
    for(let i = 1; i < 段.length; i++){
      const d = 相(段[i]) - 相(段[i - 1]);
      if(该升 ? d < -1e-9 : d > 1e-9) 反++;
    }
  });
  return { 反, 高, 层数:堆.length, 最挤:Math.max(...堆.map(x => x[1].length)) };
}
let 反总 = 0, 高总 = 0, 层总 = 0, 样 = '';
for(const 档 of 真档){
  const v = 层验(卡.sortIn(档.个));
  反总 += v.反; 高总 = Math.max(高总, v.高); 层总 += v.层数;
  if(档.名 === '红色系') 样 = v.层数 + ' 层 · 最挤一层 ' + v.最挤 + ' 颗';
}
R.数('九档合起来的层：一共 ' + 层总 + ' 层（红色系那一档：' + 样 + '）· 最厚一层 · 层内走反',
  高总.toFixed(1) + ' 个点 ｜ ' + 反总);
R.判('每一层里色相一路走到底，且偶数层往上、奇数层往下（一层往右、下一层往左，接头那一下不对跳）', 反总 === 0, 反总 + ' 处走反');
R.判('一层最厚也不超过 8 个点（层的定义就是这一句）', 高总 <= 8.001, 高总.toFixed(2) + ' 个点');
R.判('同一串色排两遍落子一模一样（同一个色号永远在同一个位子上）',
  码(排蓝).join(',') === 码(卡.sortIn(蓝)).join(','));
R.判('色相也挨着、明度也挨着的时候按色号排（#800101 打头送进去，落位还是在 #800000 后面）',
  卡.hex(卡.sortIn(色('#800101', '#800000'))[0].colors[0].raw) === '#800000' &&
  卡.hex(卡.sortIn(色('#800000', '#800101'))[0].colors[0].raw) === '#800000',
  码(卡.sortIn(色('#800101', '#800000'))).join(' '));

/* 他真那九档彩色：一把尺量到底（上一版那条 12° 色相带在这一堆上量到 39 处回跳、最狠 85 个点，本轮撤掉的正是它） */
let 回总 = 0, 跳总 = 0, 大总 = 0, 颗 = 0;
for(const 档 of 真档){
  const e = 眼力(卡.sortIn(档.个));
  回总 = Math.max(回总, e.回); 大总 += e.大; 颗 += 档.个.length; 跳总 += e.跳 * (档.个.length - 1);
}
R.数('九档彩色 ' + 颗 + ' 颗：最大一次明度回跳 / 相邻色相平均跳 / 跳过 30° 的地方',
  回总.toFixed(1) + ' 个点 ｜ ' + (跳总 / (颗 - 9)).toFixed(1) + '° ｜ ' + 大总 + ' 处');
R.判('真数据上也不许出现「浅色后面紧跟一颗深色」：最大回跳不超过一层', 回总 <= 8.001, 回总.toFixed(2) + ' 个点');
R.判('色相拢得住：九档合起来相邻平均跳不超过 6°（只按明度那一版是 16.5°）',
  跳总 / (颗 - 9) <= 6, (跳总 / (颗 - 9)).toFixed(2) + '°');
const 贴 = 贴参考(卡.sortIn(参));
R.数('贴他点名的那张参考卡（反序对占比，越小越像）· 上一版那条 12° 带本轮量到 49.1%', (贴 * 100).toFixed(1) + '%');
R.判('比只按明度（18.1%）不差、比那条色相带（49.1%）近得多', 贴 <= .20, (贴 * 100).toFixed(1) + '%');
/* 咬口一：把「一层 8 个点」收成零 —— 一层只装得下明度一模一样的，等于退回只按明度，色相就该散 */
const 散 = (() => { const 文 = W11.replace('<= .08', '<= 0');
  if(文 === W11) throw new Error('咬口一没抓到要换的那一句（一层高的写法改了，这台要跟着改）');
  const 台 = 端卡(文); let 跳 = 0, 颗2 = 0;
  for(const 档 of 真档){ const 排 = 台.卡.sortIn(档.个); 跳 += 眼力(排).跳 * (排.length - 1); 颗2 += 排.length; }
  return 跳 / (颗2 - 9); })();
R.数('咬口一：一层收成零（等于只按明度），相邻色相平均跳', 散.toFixed(1) + '°');
R.判('咬口一过：那一把尺一松，色相就散到 10° 以上（判法认的是这一句，不是运气）', 散 > 10);
/* 咬口二：把层内那一步从色相换回明度 —— 等于没拢，回跳不该变，但层内就该看出色相在跳 */
const 乱 = (() => { const 文 = W11.replace('(a.相 - b.相) || a.h.localeCompare(b.h)', 'a.h.localeCompare(b.h)');
  if(文 === W11) throw new Error('咬口二没抓到要换的那一句（层内排序的写法改了，这台要跟着改）');
  const 台 = 端卡(文); let 跳 = 0, 颗2 = 0;
  for(const 档 of 真档){ const 排 = 台.卡.sortIn(档.个); 跳 += 眼力(排).跳 * (排.length - 1); 颗2 += 排.length; }
  return 跳 / (颗2 - 9); })();
R.数('咬口二：层内不走色相了，相邻色相平均跳', 乱.toFixed(1) + '°');
R.判('咬口二过：层内那一步真的在拢色相（撤掉它就散）', 乱 > 10);

/* 黑白灰那一支：纯灰那几颗的色相按 HSL 的写法一律算 0°，不加权量出来的「方向」全是假的 */
const 灰 = 色('#000000', '#1a1a1a', '#4d4d4d', '#808080', '#b3b3b3', '#e6e6e6', '#ffffff', '#fef0f0', '#fdfdfd', '#151015');
const 排灰 = 卡.sortIn(灰), 闸灰 = 闸(灰);
let ux = 0, uy = 0;
for(const c of 灰){ const r = 相(c) * Math.PI / 180; ux += Math.cos(r); uy += Math.sin(r); }
const 白合力 = Math.hypot(ux, uy) / 灰.length;
R.数('这一支灰：不加权合力 / 彩度加权那一闸判出来 / 中位极差', (白合力 * 100).toFixed(0) + '% ｜ ' +
  (闸灰.走 ? '走' : '不走') + ' ｜ 中位极差 ' + 灰.map(极差).sort((a, b) => a - b)[5]);
R.判('咬口：这一支纯灰的色相全是 0°（HSL 的写法），不加权量出来「方向」高达 ' + Math.round(白合力 * 100) +
  '% —— 拿它当「有没有方向」会被骗；彩度加权 + 极差这一把认成没方向', 白合力 >= .3 && !闸灰.走);
R.判('判成没方向的那一支，整排一路从深往浅，一次回跳都没有（灰点不拢色相）', (() => {
  let 回 = 0; for(let i = 1; i < 排灰.length; i++) if(明(排灰[i]) < 明(排灰[i - 1]) - .0001) 回++;
  R.数('整排明度回跳次数', 回); return 回 === 0; })());
R.判('最暗那颗（#000000）落在头一个、最亮那颗（#ffffff）落在最后一个',
  卡.hex(排灰[0].colors[0].raw) === '#000000' && 卡.hex(排灰[排灰.length - 1].colors[0].raw) === '#ffffff',
  码(排灰).join(' → '));

/* ---------- 四、最近打开那一笔：真 recentDrop ---------- */
R.题('四、「最近打开」手动去掉一笔（真 recentDrop）');
const 台四 = vm.createContext(Object.assign({}, 底, {
  State:{ 档:null, 写:0, async get(){ return this.档; }, async set(k, v){ this.档 = v; this.写++; } }
}));
vm.runInContext(切(W3, 'recentDrop') + '\nthis.去 = recentDrop;', 台四);
台四.State.档 = [
  { kind:'ch', ref:'a7', label:'第七章', at:5 }, { kind:'ch', ref:'b3', label:'第七章', at:4 },
  { kind:'ch', ref:'c9', label:'第七章', at:3 }, { kind:'board', ref:'d1', label:'测试 · 看板', at:2 },
  { kind:'card', ref:'e5', label:'宝珠', at:1 } ];
await 台四.去({ kind:'ch', ref:'b3', label:'第七章' });
R.数('去掉一笔以后剩几笔', 台四.State.档.length);
R.判('同名的另外两笔一个字没动 —— 认的是「哪一种 + 哪一号」那一对，不是名字（他那张列表里三行都叫 第七章）',
  台四.State.档.filter(x => x.label === '第七章').map(x => x.ref).join(',') === 'a7,c9',
  台四.State.档.map(x => x.kind + ':' + x.ref).join(' '));
R.判('被点掉的那一笔真不见了，别家别号一笔不带走，顺序也不乱',
  !台四.State.档.some(x => x.kind === 'ch' && x.ref === 'b3') && 台四.State.档.length === 4 &&
  台四.State.档.map(x => x.ref).join(',') === 'a7,c9,d1,e5', 台四.State.档.map(x => x.ref).join(','));
R.判('名单是写回去的（一次写，不是只在屏幕上抹掉、下次开又冒出来）', 台四.State.写 === 1);
台四.State.档 = null;
await 台四.去({ kind:'ch', ref:'x', label:'随便' });
R.判('名单还空着的时候点去掉不炸，写回一份空名单', Array.isArray(台四.State.档) && 台四.State.档.length === 0);
R.判('界面那一头逐枚摆了那颗 ×，走的就是这只口', /class:'x', title:'从最近打开里去掉'/.test(W3) && /await recentDrop\(rc\)/.test(W3));
R.判('样式里那颗 × 是停上去才露脸（跟灵感那一条同一个画法）', /\.wnw-pick-item:hover \.x\{opacity:1/.test(SK));
R.判('去掉一笔不动那一页内容本身（recentDrop 里只碰 recent 这一份名单，一次读写之外没有第二家）',
  (切(W3, 'recentDrop').match(/State\.(get|set)\('recent'/g) || []).length === 2, 切(W3, 'recentDrop'));

R.收尾();
