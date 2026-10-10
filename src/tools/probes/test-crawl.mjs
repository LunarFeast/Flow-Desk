/* 打字机那一趟的帧级仿真（作者：「有滚动速度变速、上下弹动，有卡顿」）
   这一台不抄第二份算法：把真源码里那七颗方法（crawl / 下一趟 / scrollTo / padList / highlight / lineAt / rowStates）
   端进虚拟机，自己造两屏假歌词（平铺那一首：每句 3 秒、块高一样；复杂那一首：同戳叠行 + 叠唱 + 间奏 + 三种块高），
   再拨一台带 ±90 毫秒噪声的钟（2026-10-05 只读探针量到的那一份），按 60 帧一秒一帧一帧推。
   量的是「写进 box.scrollTop 的那一列数」：倒退 = 上下弹动，空着的帧 = 卡顿，相邻帧步幅突然变档 = 变速。
   2026-10-09 改之前跑出来的账：倒退 1 笔 -21.72 像素、台阶比 65、1905 帧里只写了 914 帧（一半的帧空着）。 */
import vm from 'node:vm';
import { rd, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('打字机帧级仿真');
const M = rd('data/plugins/music-remote/main.js');
const 七颗 = ['  crawl(){', '  下一趟(从现在){', '  scrollTo(el, force){', '  padList(){',
  '  highlight(ms){', '  lineAt(ms, lines){', '  rowStates(li, ms){'].map(头 => 切方法(M, 头));
const [定crawl, 定下一趟, 定scrollTo, 定padList, 定highlight, 定lineAt, 定rowStates] = 七颗;

const GAP = 12, 档高 = 20, 视高 = 600;
/* 平铺那一首：每句 3 秒、都是三档块 —— 速度本该是一条 steady 的斜线 */
const 平铺 = [];
for(let i = 0; i < 10; i++) 平铺.push({ ms: 1000 + i * 3000, ms2: 1000 + (i + 1) * 3000, 档: 3 });
/* 复杂那一首：同戳的翻译、叠唱、间奏、两档 / 三档 / 四档块混着排 */
const 复杂 = [
  { ms: 1000,  ms2: 4000,  档: 2 },
  { ms: 4000,  ms2: 7000,  档: 4 },
  { ms: 7000,  ms2: 9500,  档: 3 },
  { ms: 9500,  ms2: 9500,  档: 2 },        /* 同戳的翻译：行尾要接下一个时刻 */
  { ms: 9500,  ms2: 12000, 档: 2 },
  { ms: 12000, ms2: 18000, 档: 2 },        /* 间奏前面这一句拖得长 */
  { ms: 18000, ms2: 21000, 档: 4 },
  { ms: 21000, ms2: 22500, 档: 3 },
  { ms: 21500, ms2: 22400, 档: 2 },        /* 叠唱：和声写在主唱后面、开口落在主唱窗口中间 */
  { ms: 24000, ms2: 27000, 档: 3 },
  { ms: 27000, ms2: 30000, 档: 2 },
  { ms: 30000, ms2: 33000, 档: 4 },
];
/* 行尾接「下一个时刻」，和 _shared/sh-ttml.js 里 shTtmlClose 一个口径 */
for(const 行 of [平铺, 复杂]){
  const 时刻 = 行.map(x => x.ms);
  for(const L of 行) if(!(L.ms2 > L.ms)){
    const nx = 时刻.find(t => t > L.ms);
    L.ms2 = nx === undefined ? L.ms + 4000 : nx;
  }
}

/* 一屏的几何：行矩形的顶 = 内容偏移 + 上下内边距 - 当前 scrollTop ——
   真浏览器里那句「两个矩形之差再加回 box.scrollTop」量到的就是同一个内容坐标，这把尺一致。
   写进 scrollTop 的每一笔记下是谁写的、哪一刻写的。 */
function 开一屏(行, 噪声, 终点, 顶){
  const 替 = 顶 || {};
  const 内容顶 = [];
  let 累 = 0;
  for(const L of 行){ 内容顶.push(累); 累 += L.档 * 档高 + GAP; }
  const 总高 = 累 - GAP;
  const 起始 = Math.min(...行.map(L => L.ms));
  const 盒 = { top: 0, style: {}, isConnected: true, 写: [], 谁: '', 刻: 起始 };
  Object.defineProperty(盒, 'scrollTop', { get(){ return 盒.top; }, set(v){ 盒.top = v; 盒.写.push([盒.谁 || '打字机', v, 盒.刻]); } });
  Object.defineProperty(盒, 'clientHeight', { get(){ return 视高; } });
  盒.getBoundingClientRect = () => ({ top: 0 });
  盒.scrollTo = o => {
    const 顶 = parseFloat(盒.style.paddingTop) || 0;
    盒.谁 = 'scrollTo';
    盒.scrollTop = Math.max(0, Math.min(o.top, Math.max(0, 总高 + 2 * 顶 - 视高)));
    盒.谁 = '';
  };
  const rows = 行.map((L, i) => ({
    L,
    row: {
      classList: { toggle(){}, add(){}, remove(){} },
      getBoundingClientRect: () => ({ top: 内容顶[i] + (parseFloat(盒.style.paddingTop) || 0) - 盒.top, height: L.档 * 档高 })
    }
  }));
  let now = 起始;
  const 沙 = {
    Math, JSON, console, isFinite, Number, String, Array, Object, parseFloat, Date: { now: () => now },
    requestAnimationFrame: fn => { 沙.帧子 = fn; return 1; },
    MusLy: { doc: { timed: true, lines: 行 } },
    Music: { gen: 1, playing: () => true, lyricMs: () => now + 噪声(now) },
    盒, rows
  };
  vm.createContext(沙);
  vm.runInContext('var V = {\n  full:true, li:-1, wi:-1, 滚到:-1, liGen:-1, stick:0, list:盒, rows:rows, padHalf:-1,'
    + ' crawling:0, crawlTo:null, crawlSet:null, crawlKey:"", crawlP:0, crawlGen:-1, segKey:"", geo:null, geoKey:"", geoRow:null, geoAt:0,\n'
    + ' mark(){}, gapTick(){}, setWho(){},\n'
    + [替.crawl || 定crawl, 替.下一趟 || 定下一趟, 定scrollTo, 定padList,
       替.highlight || 定highlight, 定lineAt, 定rowStates].join(',\n') + '\n};', 沙, { filename: '假台' });
  vm.runInContext('V.crawl();', 沙);              /* 打字机起手：真页面里这一趟由 update 在挂上时排 */
  return {
    盒, 沙,
    跑到(){
      const 帧数 = Math.round((终点 - now) / 16.7);
      for(let 帧 = 0; 帧 < 帧数; 帧++, now += 16.7){
        盒.刻 = now;
        沙.V.highlight(now + 噪声(now));          /* 播放器那一头每一帧也照报一次位置 */
        if(沙.帧子){ const f = 沙.帧子; 沙.帧子 = null; f(); }
      }
      return { 记录: 盒.写, 帧数 };
    }
  };
}

function 量(跑, 帧数){
  const 列 = 跑.记录.map(x => x[1]);
  const 退 = [], 步 = [];
  for(let i = 1; i < 列.length; i++){
    const d = 列[i] - 列[i - 1];
    if(d < -0.001) 退.push([+跑.记录[i][2].toFixed(0), +d.toFixed(2)]);
    步.push([+跑.记录[i][2].toFixed(0), d]);
  }
  const 正 = 步.map(x => x[1]).filter(d => d > 0.001).sort((a, b) => a - b);
  const 中位 = 正[Math.floor(正.length / 2)] || 0, 最大 = 正[正.length - 1] || 0;
  let 最长停 = 0, 当前停 = 0;
  for(const [, d] of 步){ if(d <= 0.001){ 当前停++; 最长停 = Math.max(最长停, 当前停); } else 当前停 = 0; }
  return { 写了几笔: 列.length, 空帧占比: +(100 * (1 - 列.length / 帧数)).toFixed(1),
    倒退几笔: 退.length, 退的明细: 退.slice(0, 6), 中位步幅: +中位.toFixed(3), 最大步幅: +最大.toFixed(3),
    台阶比: 中位 ? +(最大 / 中位).toFixed(2) : 0, 最长停帧: 最长停,
    五笔大台阶: 步.filter(x => x[1] > 中位 * 5).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => [x[0], +x[1].toFixed(2)]) };
}

const 无噪声 = () => 0;
const 抖 = t => Math.round(Math.sin(t / 137) * 90);        /* ±90 毫秒的低频晃，探针量到的那一份 */
const 终点 = 33000;

R.题('一 · 平铺那一首、钟干净：该是一条每帧挪一点点的斜线');
/* 跑到最后一句开口为止：那一句之后没有下一句可赶，顶到 1 停住是对的，不算空帧 */
const 台平 = 开一屏(平铺, 无噪声, 28000);
const 平 = 台平.跑到(); const 账平 = 量(平, 平.帧数);
for(const k in 账平) R.数(k, 账平[k]);
R.判('不倒退一笔（倒退就是「上下弹动」）', 账平.倒退几笔 === 0, 账平.退的明细);
R.判('最长停顿不超过 20 帧（约三分之一秒，再多就是看得见的卡住）', 账平.最长停帧 <= 20, 账平.最长停帧);
R.判('空着的帧不超过 10%（一帧该动却没动 = 卡顿）', 账平.空帧占比 <= 10, 账平.空帧占比);
R.判('步幅台阶比不超过 3（每句都是 3 秒，快慢不该有档差）', 账平.台阶比 <= 3, 账平.台阶比);

R.题('二 · 复杂那一首（同戳 + 叠唱 + 间奏 + 三种块高）、钟干净');
const 台复 = 开一屏(复杂, 无噪声, 终点);
const 复 = 台复.跑到(); const 账复 = 量(复, 复.帧数);
for(const k in 账复) R.数(k, 账复[k]);
R.判('不倒退：叠唱收口那一下高亮落回前一行，也不许带着整列往回走', 账复.倒退几笔 === 0, 账复.退的明细);
R.判('最长停顿不超过 20 帧', 账复.最长停帧 <= 20, 账复.最长停帧);
R.判('空着的帧不超过 20%（间奏那一段本来会顶到 1 停住，允许一点，但不能一半的帧空着）', 账复.空帧占比 <= 20, 账复.空帧占比);
R.数('台阶比只报数不判：开口本来就疏密不一，500 毫秒接一句和 3 秒接一句，快慢跟着变是应该的', 账复.台阶比);

R.题('三 · 复杂那一首 + 钟带 ±90 毫秒噪声');
const 台噪 = 开一屏(复杂, 抖, 终点);
const 噪 = 台噪.跑到(); const 账噪 = 量(噪, 噪.帧数);
for(const k in 账噪) R.数(k, 账噪[k]);
R.判('带噪声也全程不倒退（时间被拽回去不许带着整列退）', 账噪.倒退几笔 === 0, 账噪.退的明细);
R.判('带噪声时最长停顿不超过 20 帧', 账噪.最长停帧 <= 20, 账噪.最长停帧);
R.判('带噪声时空着的帧不超过 25%（噪声那一段进度按着不动是闸该拦的，但拦完要接着走）', 账噪.空帧占比 <= 25, 账噪.空帧占比);

R.题('四 · 谁在写这一列：打字机和换行那两趟不许抢');
const 谁 = {};
for(const [来源] of 噪.记录) 谁[来源] = (谁[来源] || 0) + 1;
R.数('各来源写的笔数', 谁);
R.判('换行那一趟全程只许发一次滚动（开机落位那一下，基准换了号）：往后每一趟换行都归打字机自己接',
  (谁.scrollTo || 0) <= 1, 谁);

R.题('五 · 源码形状');
R.判('回拽那道闸算出来的数要真写进 DOM（从前算好了 crawlTo、写下去的却是没闸的那个 to）',
  /box\.scrollTop = this\.crawlTo/.test(定crawl),
  定crawl.split('\n').filter(l => /box\.scrollTop =|Math\.abs\(/.test(l)).join(' ⏎ '));
R.判('落点写下去之前那一判的门槛不许比一帧走的还大（每句 3 秒走 72 像素，一帧才 0.4 像素）',
  (() => { const m = /- this\.crawlTo\) > ([\d.]+)\)/.exec(定crawl); return !!m && parseFloat(m[1]) <= 0.1; })(),
  (/- this\.crawlTo\) > [\d.]+\)/.exec(定crawl) || ['没找到这道门槛'])[0]);
R.判('那一段的终点只认「开口」，不认行尾（跟着行尾算就会被叠唱收口那一下拿 91 毫秒赶一整行的路）',
  !/L\.ms2 > 从现在/.test(定下一趟) && /isFinite\(L\.ms\) && L\.ms > 从现在/.test(定下一趟),
  定下一趟.split('\n').filter(l => /isFinite/.test(l)).join(' ⏎ '));
R.判('终点量出来不在起点下面时是原地不动，不是再往下硬走一格（硬走那一格就是猛冲）',
  /再不行就原地不动|s1 = \(n != null && n > g\.s0\) \? n : g\.s0;/.test(定crawl),
  定crawl.split('\n').filter(l => /s1 = /.test(l)).join(' ⏎ '));

R.题('六 · 改坏两处作对照：上面那些判法咬得住');
const 坏门 = 定crawl.replace('- this.crawlTo) > 0.05)', '- this.crawlTo) > 0.5)');
R.判('坏一确实改到了那一行（改不动就是这台在自欺）', 坏门 !== 定crawl && /- this\.crawlTo\) > 0\.5\)/.test(坏门));
const 跑坏门 = 开一屏(平铺, 无噪声, 28000, { crawl: 坏门 }).跑到();
const 账坏门 = 量(跑坏门, 跑坏门.帧数);
R.判('门槛放回从前的 0.5 像素，空帧占比立刻涨上去（每句 3 秒、一帧才 0.4 像素，0.5 的门槛就是两三帧才动一次）',
  账坏门.空帧占比 > 30, 账坏门.空帧占比);
/* 坏二：把改之前那一版的两笔一起装回去 —— 起点现量当前这一行的正中（而不是上一帧真正写下的那一格），
   并且把没闸的那个数直接写进 DOM。叠唱收口那一下高亮落回上面那一行，起点就凭空抬到上面去了，
   这就是改之前量到的那一笔 -21.72 像素。单独拆一道都被另一道接着（每一道都在管同一件事），所以要一起拆。 */
const 坏起 = 定crawl.replace('this.geo = { s0: 起,',
  'this.geo = { s0: (() => { const q = this.rows[this.li], bb = q.row.getBoundingClientRect(), cc = box.getBoundingClientRect();' +
  '  return bb.top - cc.top + box.scrollTop + bb.height / 2 - box.clientHeight / 2; })(),')
  .replace('box.scrollTop = this.crawlTo', 'box.scrollTop = to')
  .replace('- this.crawlTo) > 0.05)', '- to) > 0.05)');
R.判('坏二确实改到了那三笔（改不动就是这台在自欺）',
  坏起 !== 定crawl && /bb\.height \/ 2 - box\.clientHeight \/ 2/.test(坏起) && /box\.scrollTop = to;/.test(坏起));
const 跑坏起 = 开一屏(复杂, 无噪声, 终点, { crawl: 坏起 }).跑到();
const 账坏起 = 量(跑坏起, 跑坏起.帧数);
R.判('两笔一起装回去，叠唱那一段立刻倒退（上面「不倒退」那条判法就是管它的）',
  账坏起.倒退几笔 > 0, 账坏起.退的明细);
/* 坏三试过了，没立起来：把「行尾」混进下一趟的候选、再拆掉「终点必须在起点下面」那一道，
   这一屏里出来的不是猛冲而是一笔被回拽那道闸按住的倒退（台阶比和干净那一跑一模一样，5.05）。
   留在这儿只说一句：第五节「只认开口」那条判法目前只有源码形状在管，没有帧级对照撑着。 */

R.收尾();
