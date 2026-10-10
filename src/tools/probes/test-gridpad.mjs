/* 外32 图8 · 桌面四边那条边界（跑 src/tools/selfcheck.mjs 一起过，也可单跑）
   他报的是「便签 1 格、日程 3 格，统一为 1 格」，追问一句给的是「横版正常，拉长成竖版就放不过去了」。
   根子在 Shell.fitGrid 那两行：横着按 --cw 留半格、竖着按 --ch 留半格 —— 两轴的格子本来就不等边，
   窗口一拉长，同一句「留半格」量出来上缝是左缝的 3.6 倍（500×1400 探针实测：上缝 20.9 像素 = 2.7 横格、左缝 5.9 像素 = 0.76 横格）。
   这一台不抄第二份公式：把真源码里那颗 fitGrid 端进虚拟机跑四种窗口形状，再端一次改坏回老写法的那一颗作对照。 */
import vm from 'node:vm';
import { rd, 切, 切方法, 记账 } from './lib-slice.mjs';

const R = 记账('图8 · 桌面四边等距');
const S = rd('src/_fd/src/fd3-shell.js');
const LIB = rd('src/_fd/src/fd3-lib.js');

const 常量 = 切(S, 'GRID_COLS') + '\n' + 切(S, 'VSC_BASE') + '\n' + 切(LIB, 'lookGap') + '\n';
const 定fitGrid = 切方法(S, '  fitGrid(){');
const 定place = 切方法(S, '  place(card, it){');

/* 四种窗口形状：他平时那种横版、探针这一台的近方、他截图那种竖版、更窄更长的一档 */
const 形状 = [['横版 1600×900', 1600, 900], ['近方 966×1102', 966, 1102], ['竖版 500×1400', 500, 1400], ['窄长 400×1600', 400, 1600]];

/* 把 fitGrid + place 装进虚拟机：document 那一层给假的，量出来的数从 setProperty 里接。
   卡片那一层不跨realm 传，所以 place 在虚拟机里头自己造一张，交回四个串。 */
function 开一台(fitGrid){
  const 尺寸 = { w: 0, h: 0 };
  const 发 = {};
  const ctx = {
    Math, JSON, String, Number, parseFloat,
    document: {
      getElementById: () => ({ get clientWidth(){ return 尺寸.w; }, get clientHeight(){ return 尺寸.h; } }),
      querySelector: () => null,
      documentElement: { style: { setProperty(k, v){ 发[k] = v; } } }
    },
    Theme: { cfg: { gap: 0 } }        /* 间距走「自动」：这一台只管四边那条边界，不碰方案里钉死的那一档 */
  };
  vm.createContext(ctx);
  vm.runInContext(常量, ctx);
  vm.runInContext('var Shell = {\n  cellW:0, cellH:0, gap:0,\n' + fitGrid + ',\n' + 定place + '\n};', ctx);
  return {
    量(w, h){
      尺寸.w = w; 尺寸.h = h;
      const 串 = vm.runInContext(
        '(function(){ var c = {style:{setProperty(){}}}; Shell.fitGrid(); Shell.place(c, {x:0, y:0, w:64, h:36});' +
        'return [c.style.left, c.style.top, c.style.width, c.style.height].join("|"); })()', ctx);
      const n = k => parseFloat(发[k]);
      const cw = n('--cw'), ch = n('--ch'), px = n('--pad-x'), py = n('--pad-y'), gap = n('--gap');
      const [左串, 上串, 宽串, 高串] = 串.split('|');
      const 代 = s => s.replace(/var\(--cw[^)]*\)/g, cw).replace(/var\(--ch[^)]*\)/g, ch)
        .replace(/var\(--gap-half[^)]*\)/g, gap / 2).replace(/var\(--gap\)/g, gap)
        .replace(/var\(--pad-x[^)]*\)/g, px).replace(/var\(--pad-y[^)]*\)/g, py)
        .replace(/calc\(/g, '(').replace(/\)/g, ')');
      const 算 = s => { try{ return Function('"use strict";return (' + 代(s) + ')')(); }catch(e){ return NaN; } };
      const 左 = 算(左串), 上 = 算(上串), 宽 = 算(宽串), 高 = 算(高串);
      /* 占满整轴那一张：四道缝都该还在，而且四个数两两相等 */
      return { cw, ch, px, py, gap, 左, 上, 右: w - 左 - 宽, 下: h - 上 - 高 };
    }
  };
}

R.题('一 · 四种窗口形状，四边同一条数（真跑 fitGrid + place）');
const 台 = 开一台(定fitGrid);
for(const [名, w, h] of 形状){
  const r = 台.量(w, h);
  R.判(名 + '：--pad-x 和 --pad-y 是同一个数（从前横竖各算各的）', Math.abs(r.px - r.py) < 1e-9, [r.px, r.py]);
  /* 四个数吃的是同一串 toFixed(3) 的读数，凑在一起会差出 0.02 像素 —— 界面上看不出来，
     但比 1e-6 大，所以这道闸放半根头发丝的量。 */
  R.判(名 + '：一张卡的左缝 = 上缝 = 右缝 = 下缝', Math.max(r.左, r.上, r.右, r.下) - Math.min(r.左, r.上, r.右, r.下) < 0.05,
    [r.左, r.上, r.右, r.下].map(x => +x.toFixed(2)));
  R.判(名 + '：那条缝折成格子是 1 格多一点（多的是半个间距），两轴不再有差别', r.左 / r.cw >= 1 && r.左 / r.cw <= 1.5, +(r.左 / r.cw).toFixed(2));
  R.判(名 + '：占满整轴不溢出（上下左右四道缝都还在）', r.左 > 0 && r.上 > 0 && r.右 > 0 && r.下 > 0, [+r.右.toFixed(2), +r.下.toFixed(2)]);
  R.数(名 + ' · 横格 / 竖格 / 四边留白', [+r.cw.toFixed(2), +r.ch.toFixed(2), +r.px.toFixed(2)]);
}

R.题('二 · 改坏回老写法作对照：判法不是空的');
const 老 = 定fitGrid
  .replace(/const 外留 = [^\n]*\n\s*this\.cellW = [^\n]*\n/,
    '    this.cellW = W / (GRID_COLS + GRID_PAD * 2); this.cellH = H / (GRID_ROWS + GRID_PAD * 2);\n')
  .replace(/setProperty\('--pad-x', 外留\.toFixed\(3\)/, "setProperty('--pad-x', (this.cellW * GRID_PAD).toFixed(3)")
  .replace(/setProperty\('--pad-y', 外留\.toFixed\(3\)/, "setProperty('--pad-y', (this.cellH * GRID_PAD).toFixed(3)");
R.判('老那两行确实换上了（换不动就是这台在自欺）', 老 !== 定fitGrid && /cellW = W \/ \(GRID_COLS \+ GRID_PAD \* 2\)/.test(老) && /'--pad-y', \(this\.cellH \* GRID_PAD\)/.test(老),
  老.split('\n').find(l => /cellW = W/.test(l)));
const 老台 = 开一台(老);
for(const [名, w, h] of 形状){
  const r = 老台.量(w, h);
  const 倍 = r.上 / r.左;
  R.判(名 + '（老写法）：上缝是左缝的 ' + 倍.toFixed(2) + ' 倍 —— ' + (名[0] === '横' ? '横版看不出来' : '这就是那条「3 格」'),
    名[0] === '横' ? 倍 < 1.1 : 倍 > 1.5, +倍.toFixed(2));
}

R.题('三 · 源码形状：那一档就是 1 格，且四边吃同一个变量');
R.判('GRID_PAD 从 0.5 改成 1（他要的「统一为 1 格」就是这一档）', /^const GRID_COLS = 64, GRID_ROWS = 36, GRID_PAD = 1;$/m.test(S), /GRID_PAD = [\d.]+/.exec(S)[0]);
R.判('外留按两轴里紧的那一轴取（写成 Math.max 就还是两轴不等）', /const 外留 = Math\.min\(W \/ \(GRID_COLS \+ GRID_PAD \* 2\), H \/ \(GRID_ROWS \+ GRID_PAD \* 2\)\);/.test(定fitGrid));
R.判('格子按扣掉外留之后的余量摊（照旧整窗除以 64+1 就会溢出）', /this\.cellW = \(W - 外留 \* 2\) \/ GRID_COLS; this\.cellH = \(H - 外留 \* 2\) \/ GRID_ROWS;/.test(定fitGrid));
R.判('--pad-x 和 --pad-y 两处都写的是外留（还挂着一个乘 GRID_PAD 就说明只改了一半）',
  /setProperty\('--pad-x', 外留\.toFixed\(3\)/.test(定fitGrid) && /setProperty\('--pad-y', 外留\.toFixed\(3\)/.test(定fitGrid),
  定fitGrid.split('\n').filter(l => /pad-[xy]/.test(l)).join(' ⏎ '));
R.判('老那两串按轴各算的写法在这颗里没了（残留一处就是那条缝还在）', !/this\.cellW \* GRID_PAD|this\.cellH \* GRID_PAD/.test(定fitGrid));
R.判('落位那颗还在吃这两个变量（改了源头忘了接线，界面上什么都不会变）',
  /var\(--pad-x, 0px\)/.test(定place) && /var\(--pad-y, 0px\)/.test(定place), 定place.split('\n').slice(1, 3).join(' ⏎ '));
R.判('拖拽时那几条参考线跟着走同一对变量（线就是能给卡片贴的边，错位等于骗人）',
  /background-position:var\(--pad-x,0px\) var\(--pad-y,0px\)/.test(S));

R.题('四 · 别家不该跟着动');
R.判('格子还是 64×36（老布局存的整数照旧能用，这一轮只动边界）', /^const GRID_COLS = 64, GRID_ROWS = 36/m.test(S));
R.判('横轴那一口没顺手改（GRID_STEP 还是 2 = 半格；两轴同一个像素步长那一改在外33 第 2 条，量的是 test-dropfit.mjs）',
  /GRID_STEP/.test(S) && !/GRID_STEP = 1(?![.\d])/.test(S), /const GRID_STEP[^;]*/.exec(S)[0]);
R.判('卡片之间的间距口径没动（这一轮管的是四边，不是缝）', /this\.gap = 钉死 > 0 \? 钉死 : Math\.max\(4, Math\.min\(18, Math\.round\(Math\.min\(this\.cellW, this\.cellH\) \* \.16\)\)\);/.test(定fitGrid));

R.收尾();
