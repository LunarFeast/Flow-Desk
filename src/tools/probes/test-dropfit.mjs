/* 外33 第 1、2、3 条 · 拖不动 / 操作漂移 / 日程不再算展开（跑 src/tools/selfcheck.mjs 一起过，也可单跑）
   他报的三笔连在一起看是一件事：竖屏窗口里日程卡拖到哪都弹回原地，连着放大缩小几趟之后指针和卡边对不上。
   这一台先把「明明还有格子，为什么放不下」用真源码量清楚（Shell.fits / hits / rect 三颗原样端进虚拟机，不抄第二份），
   再量吸附那一步在两个轴上各是多少像素（外33 第 2 条改的就是这里），
   最后钉住「日程任意大小都不算展开」这一条新规矩（外33 第 3 条，按他的原话取消的）。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('外33 · 拖位、吸附与日程展开');
const S = rd('src/_fd/src/fd3-shell.js');
const LIB = rd('src/_fd/src/fd3-lib.js');
const SCH = rd('data/plugins/schedule/main.js');

const 定snapQ = 切(S, 'snapQ');
/* 对照那一份不另写公式：只把真源码那颗 snapQ 里「1/8 格这一档」的三处 GRID_STEP * 4 换成 GRID_STEP，
   得到的就是从前「两轴各吃自己的半格」—— 一口恒为 0.5 格。 */
const 坏snapQ = 定snapQ.replace(/GRID_STEP \* 4/g, 'GRID_STEP');
const 常量 = Q => [切(S, 'GRID_COLS'), 切(S, 'GRID_STEP'), Q,
  切(S, 'snapDelta'), 切(S, 'EXPAND_AREA'), 切(S, 'isExpanded'), 切(S, 'VSC_BASE'),
  切(LIB, 'lookGap')].join('\n') + '\n';

const 定fitGrid = 切方法(S, '  fitGrid(){');
const 定place = 切方法(S, '  place(card, it){');
const 定fits = 切方法(S, '  fits(rect, self){');
const 定hits = 切方法(S, '  hits(a, b){');
const 定rect = 切方法(S, '  rect(it){');
const 定bindDrag = 切方法(S, '  bindDrag(card, it, def){');

/* 手按下去以后指针每走 1 像素问一次：吸附之后这一张卡的边落在哪个像素上 */
const 扫 = 'p, snapDelta(p, Shell.cellW, 步) * Shell.cellW, snapDelta(p, Shell.cellH, 步) * Shell.cellH';

/* 一台：真 fitGrid 出格长，再拿真 snapDelta + 指定那一份 snapQ 扫一趟指针 */
function 开一台(Q) {
  const 尺寸 = { w: 0, h: 0 };
  const 发 = {};
  const ctx = {
    Math, JSON, String, Number, parseFloat,
    document: {
      getElementById: () => ({ get clientWidth(){ return 尺寸.w; }, get clientHeight(){ return 尺寸.h; } }),
      querySelector: () => null,
      documentElement: { style: { setProperty(k, v){ 发[k] = v; } } }
    },
    Theme: { cfg: { gap: 0 } }        /* 间距走「自动」：这一台只管拖位那一步，不碰方案里钉死的那一档 */
  };
  vm.createContext(ctx);
  vm.runInContext(常量(Q), ctx);
  vm.runInContext('var Shell = { cellW:0, cellH:0, gap:0,\n  ' + 定fitGrid + ',\n  ' + 定place + '\n};', ctx);
  return {
    走(w, h) {
      尺寸.w = w; 尺寸.h = h;
      vm.runInContext('Shell.fitGrid();', ctx);
      const cw = ctx.Shell.cellW, ch = ctx.Shell.cellH;
      const 串 = vm.runInContext('(function(){ var 步 = Math.min(Shell.cellW, Shell.cellH) / GRID_STEP, o = [];' +
        ' for(var p = 0; p <= 160; p++) o.push([' + 扫 + ']); return JSON.stringify(o); })()', ctx);
      return { cw, ch, 点: JSON.parse(串) };
    }
  };
}

/* 从「指针 → 卡边」那一串里算：一口多大、最大错位几像素 */
function 析(点) {
  const 一轴 = k => {
    const 列 = 点.map(p => p[k]);
    let 口 = 0;
    for(let i = 1; i < 列.length; i++){ const d = 列[i] - 列[i - 1]; if(d > 1e-9 && (!口 || d < 口)) 口 = d; }
    return { 口, 错位: Math.max(...列.map((v, i) => Math.abs(v - 点[i][0]))) };
  };
  const x = 一轴(1), y = 一轴(2);
  return { x, y, 步长比: Math.max(x.口, y.口) / Math.min(x.口, y.口), 不平差: Math.abs(x.错位 - y.错位) };
}
/* 是不是某一口的整数倍（浮点除法不指望它正好落在整数上） */
const 整倍 = v => Math.abs(v - Math.round(v)) < 1e-6;

/* 四种窗口形状 + 一档极窄的：400 像素宽里一格才 6 像素、竖格却是 44 像素，
   1/8 格已经是最细的干净分数，再细就要落 1/16 那种难看的数，所以那一档的口子放宽到 2.0 */
const 形状 = [['横版 1600×900', 1600, 900, 1.6], ['探针 966×1163', 966, 1163, 1.6],
  ['他截图那种竖版 700×1400', 700, 1400, 1.6], ['更窄长 500×1400', 500, 1400, 1.6], ['极窄 400×1600', 400, 1600, 2.0]];

R.题('一 · 吸附那一步：两个轴必须是同一个像素数（真 fitGrid + 真 snapDelta + 真 snapQ）');
{
  const 台 = 开一台(定snapQ);
  for(const [名, w, h, 限] of 形状) {
    const 出 = 析(台.走(w, h).点);
    R.判(名 + '：两轴一口之比 ≤ ' + 限 + '（横 ' + 出.x.口.toFixed(2) + ' / 竖 ' + 出.y.口.toFixed(2) + ' 像素，实际比 ' + 出.步长比.toFixed(2) + '）',
      出.步长比 <= 限, 出.步长比);
    R.判(名 + '：两轴「指针与卡边最大错位」之差 ≤ 1.3 像素（横 ' + 出.x.错位.toFixed(2) + ' / 竖 ' + 出.y.错位.toFixed(2) + '）',
      出.不平差 <= 1.3, 出.不平差);
  }
  const 横 = 台.走(1600, 900);
  R.判('横版那一种两轴都还是半格一口（与从前逐字相同，他「横版正常」那句不许被这一轮改坏）',
    横.点.every(p => 整倍(p[1] / (横.cw / 2)) && 整倍(p[2] / (横.ch / 2))),
    横.cw.toFixed(2) + '×' + 横.ch.toFixed(2) + ' 像素一格');
  const 竖 = 台.走(700, 1400);
  R.判('落盘的格数全在 1/8 格这一档上（layout.json 里不出现 0.1387 这种数）',
    竖.点.every(p => 整倍(p[1] / 竖.cw * 8) && 整倍(p[2] / 竖.ch * 8)),
    竖.点.slice(1, 5).map(p => (p[1] / 竖.cw).toFixed(3) + '×' + (p[2] / 竖.ch).toFixed(3)).join(' '));
}

R.题('二 · 改坏对照：把 snapQ 那一档从 1/8 格换回半格，漂移立刻回来');
{
  const 新 = 析(开一台(定snapQ).走(700, 1400).点), 老 = 析(开一台(坏snapQ).走(700, 1400).点);
  R.判('坏的那一份确实只动了那一档（一处都换不动，就是这台在自欺）',
    坏snapQ !== 定snapQ && /GRID_STEP \* 4/.test(定snapQ) && !/GRID_STEP \* 4/.test(坏snapQ), 坏snapQ.split('\n')[0].trim());
  R.判('老写法在 700×1400 上两轴一口之比 = 格子本身的不等边倍数（横 ' + 老.x.口.toFixed(2) + ' 像素、竖 ' + 老.y.口.toFixed(2) + ' 像素）',
    老.步长比 > 3, 老.步长比);
  R.判('老写法两轴的错位差拉到 5 像素以上 —— 一边跟手走、一边 19 像素整格跳，这就是他报的「操作漂移」',
    老.不平差 > 5, 老.不平差);
  R.判('新写法把这一笔收到老写法三成以内（' + 新.不平差.toFixed(2) + ' 对 ' + 老.不平差.toFixed(2) + ' 像素）',
    新.不平差 < 老.不平差 * 0.3, [新.不平差, 老.不平差]);
  const 横老 = 析(开一台(坏snapQ).走(1600, 900).点);
  R.判('老写法在横版上本来就不吃亏（两轴一口几乎一样）—— 所以这个毛病只在竖屏出现，和他那句「横版正常」对得上',
    横老.步长比 < 1.1, 横老.步长比);
  R.判('接线接对了：拖和拉那一颗走的是 snapDelta，从前那颗两轴各算的 snapCell 整个外壳里没有了',
    /snapDelta\(e\.clientX - x0, shell\.cellW, 步\)/.test(定bindDrag) &&
    /snapDelta\(e\.clientY - y0, shell\.cellH, 步\)/.test(定bindDrag) && !/snapCell/.test(S),
    (定bindDrag.match(/const 步[^\n]*/) || [''])[0].trim());
  R.判('公共步长取的是两轴里较小的那一格的半口（拿较大的算，竖屏照旧粗）',
    /Math\.min\(shell\.cellW, shell\.cellH\) \/ GRID_STEP/.test(定bindDrag), (定bindDrag.match(/const 步[^\n]*/) || [''])[0].trim());
  R.判('GRID_STEP 还是 2：横轴那一口没顺手改（半格落位这条是他定的）', /^const GRID_STEP = 2;/m.test(S), (S.match(/const GRID_STEP[^;]*/) || [''])[0]);
}

R.题('三 · 「明明还有格子，为什么放不下」：落点全数一遍，判法吃的是外壳那三颗');
{
  /* 他那一屏当时的存档（2026-10-09 04:57 那次落盘）：日程 17.5 × 35，便签整摞占满 36 行，四张小卡压在左上 */
  const 当时 = [
    { id:'schedule', widget:'schedule', x:45.5, y:0, w:17.5, h:35 },
    { id:'notes', widget:'notes', x:0, y:0, w:11, h:36 },
    { id:'your-sentences', widget:'your-sentences', x:11, y:0, w:18, h:2.5 },
    { id:'tool-music-remote', widget:'tool-music-remote', x:11, y:4.5, w:15, h:5 },
    { id:'why-not-write', widget:'why-not-write', x:23.5, y:2.5, w:7, h:2 },
    { id:'singbit-input-practice', widget:'singbit-input-practice', x:26, y:4.5, w:6.5, h:2 }
  ];
  const ctx = { Math, JSON, GRID_COLS: 64, GRID_ROWS: 36 };
  vm.createContext(ctx);
  vm.runInContext('var Shell = { layout: { items: ' + JSON.stringify(当时) + ' },\n  ' +
    定rect + ',\n  ' + 定hits + ',\n  ' + 定fits + '\n};', ctx);
  const 数 = (w, h, 低从) => JSON.parse(vm.runInContext('(function(){ var 自己 = Shell.layout.items[0];' +
    ' 自己.w = ' + w + '; 自己.h = ' + h + ';' +
    ' var n = 0, ys = [], xs = [], 低 = 0;' +
    ' for(var y = 0; y + 自己.h <= GRID_ROWS; y += 0.5) for(var x = 0; x + 自己.w <= GRID_COLS; x += 0.5)' +
    ' if(Shell.fits({x:x, y:y, w:自己.w, h:自己.h}, 自己)){ n++; ys.push(y); xs.push(x); if(y >= ' + 低从 + ') 低++; }' +
    ' return JSON.stringify({n:n, y下:Math.min.apply(null,ys), y上:Math.max.apply(null,ys),' +
    ' x下:Math.min.apply(null,xs), x上:Math.max.apply(null,xs), 低:低}); })()', ctx));
  const 当 = 数(17.5, 35, 9.5);
  R.判('35 行的卡吃满 36 行那一竖轴：纵向只剩 y ' + 当.y下 + ' 到 ' + 当.y上 + ' 三档 —— 竖屏一格 38.3 像素，等于整张卡总共只能挪 38 像素',
    当.y下 === 0 && 当.y上 === 1, 'y ' + 当.y下 + '..' + 当.y上);
  R.判('横向只在 x ' + 当.x下 + ' 到 ' + 当.x上 + ' 这一条里合法：便签占了 0..11 那一整条竖带（36 行全占），四张小卡又压着 11..32.5',
    当.x下 === 32.5 && 当.x上 === 46.5, 'x ' + 当.x下 + '..' + 当.x上);
  R.判('合法落点 ' + 当.n + ' 处，落进「小卡下面那一片空地」（y ≥ 9.5）的 ' + 当.低 + ' 处 —— 他眼睛看见的那片空格子这张卡确实进不去',
    当.n === 87 && 当.低 === 0, '共 ' + 当.n + ' 处 · 空地 ' + 当.低 + ' 处');
  const 空格 = (() => {
    const g = Array.from({ length: 36 }, () => new Array(64).fill(0));
    for(const it of 当时) for(let y = Math.floor(it.y); y < Math.ceil(it.y + it.h); y++)
      for(let x = Math.floor(it.x); x < Math.ceil(it.x + it.w); x++) if(g[y]) g[y][x] = 1;
    let f = 0; for(const r of g) for(const c of r) if(!c) f++;
    return f;
  })();
  R.判('空格子 ' + 空格 + ' 个（整张 2304 个里占三成以上），可它们不连成一整块 —— 外壳判的是一整块连着的空地，不是空格子总数',
    空格 > 1000 && 当.n < 100, 空格 + ' 个空格子 / 只 ' + 当.n + ' 处放得下');
  const 现在 = 数(19, 16, 9.5);
  R.判('同一份存档把日程改成 19 × 16（他后来自己拉的这一档）：合法落点 ' + 现在.n + ' 处、其中 ' + 现在.低 + ' 处就在那片空地上 —— 卡到 35 行才是没处挪',
    现在.n > 1500 && 现在.低 > 1000, 现在.n + ' / ' + 现在.低);
  R.判('外壳那颗 fits 这一轮一个字没动（改的是吸附和展开，不放开碰撞规则）',
    /if\(rect\.x < 0 \|\| rect\.y < 0 \|\| rect\.w < 1 \|\| rect\.h < 1\) return false;/.test(定fits) &&
    /if\(rect\.x \+ rect\.w > GRID_COLS \|\| rect\.y \+ rect\.h > GRID_ROWS\) return false;/.test(定fits) &&
    /return !this\.layout\.items\.some\(it => it !== self && this\.hits\(rect, this\.rect\(it\)\)\);/.test(定fits), 定fits.split('\n').length + ' 行');
  /* 外34 自由移动这一轮改的是「什么时候才回弹」：只有推开邻居也腾不出地方的那一步才弹回来，
     提示跟着改口说「桌面装不下这么多了」，不再指着一格说「这里放不下」。 */
  R.判('回弹只在真装不下的那一步发生，提示跟着说清是整张桌面装不下（外34 改口，外33 那句「这里放不下」不再成立）',
    /shell\.place\(card, base\); toast\('桌面装不下这么多了 · 已回弹'\)/.test(S) &&
    !/这里放不下/.test(S) &&
    /const 动 = shell\.让位\(落, it\);/.test(S), (S.match(/已回弹/g) || []).length + ' 处回弹');
}

R.题('四 · 日程不再按面积算展开（外33 第 3 条，他的原话：任意拖拽大小均不视为展开）');
{
  const ctx = { Math, GRID_COLS: 64, GRID_ROWS: 36, EXPAND_AREA: 0.25 };
  vm.createContext(ctx);
  vm.runInContext(切(S, 'isExpanded'), ctx);
  const 问 = (def, w, h) => vm.runInContext('isExpanded(' + JSON.stringify(def) + ', {w:' + w + ', h:' + h + '})', ctx);
  R.判('日程 17.5 × 35 = 612.5 格，早过了四分之一那道闸（576 格），点了 noExpanded 之后判假',
    17.5 * 35 > 576 && 问({ id:'schedule', noExpanded:true }, 17.5, 35) === false, 问({ id:'schedule', noExpanded:true }, 17.5, 35));
  R.判('别家不受影响：同样大小没点 noExpanded 的那一家照样算展开',
    问({ id:'tool-music-remote' }, 17.5, 35) === true, 问({ id:'tool-music-remote' }, 17.5, 35));
  R.判('小卡照旧不算（日程出厂 7 × 8 = 56 格、别家 30 × 18 = 540 格都差那一档没到）',
    问({ id:'schedule', noExpanded:true }, 7, 8) === false && 问({ id:'x' }, 30, 18) === false);
  R.判('说明书里真的点了这一位（少了这一行，上面那些判法全是空的）',
    /^  noExpanded:true,/m.test(SCH), (SCH.match(/^\s*noExpanded:[^\n]*/m) || [''])[0].trim());
  R.判('外壳只有一处在比面积，就是 isExpanded 那颗：cardFor 与拖完那一步都改吃它，没留第二处裸算',
    (S.match(/GRID_COLS \* GRID_ROWS \* EXPAND_AREA/g) || []).length === 1 &&
    /const expanded = isExpanded\(def, it\);/.test(S) &&
    /const grew = isExpanded\(def, 落\), was = isExpanded\(def, it\);/.test(S),
    (S.match(/GRID_COLS \* GRID_ROWS \* EXPAND_AREA/g) || []).length + ' 处');
  R.判('日程 mount 里那条「展开就铺全套视图」的路拆了，⛶ 那一条（openScheduleFull + scheduleFullNode）整条还在',
    !/if\(C\.expanded\)\{/.test(SCH) && /expand\(ctx\)\{ openScheduleFull\(/.test(SCH) &&
    /function openScheduleFull\(/.test(SCH) && /function scheduleFullNode\(/.test(SCH));
  R.判('⛶ 那颗钮这一轮之后恒常摆得出来：它只在「没展开」时摆，日程现在永远没展开',
    /if\(def\.expand && !expanded\) tools\.push\(h\('button', \{ class:'fd-tool', title:'放大'/.test(S));
  R.判('顶栏糊名字那一条（外32 图14）的口径没动：还是看封面开着、或哪张卡自己带 .expanded',
    /const on = \(!!cov && cov\.hidden === false\) \|\| !!document\.querySelector\('\.fd-card\.expanded'\);/.test(S),
    (S.match(/const on =[^\n]*/) || [''])[0].trim());
  R.判('日程那三档画法（简略 / 显眼 / 详细）还在，卡片拉到多大都由 tierOf 接着，不再靠「展开」那一档跳去全套视图',
    /const tier = C\.item \? tierOf\(C\.item\.w, C\.item\.h\) : 0;/.test(SCH) && /TIER_CLASS\[tier\]/.test(SCH));
}

R.收尾();
