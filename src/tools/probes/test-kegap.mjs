/* 外30 丙组 · 图2「播放快快慢慢的（是按照实际打字速度吗？），增加一个播放倍速设置」
   先把问话答了：回放节奏吃的是 keystroke 里记下的 op.gap —— 当时那一笔真隔了多久就多快，
   只是夹在 40 毫秒到 1.2 秒之间（一次长停顿会把整遍卡住几分钟）。这一台量的就是那把夹子 + 新加的倍速。
   切的是仓库里那一份原文：keGap 整颗、Hist 整只（init 也走真身，只把 State 那一个边界换成假的）。 */
import vm from 'node:vm';
import { rd, 切, 记账 } from './lib-slice.mjs';

const R = 记账('test-kegap');
const W15 = rd('src/_wnw/src/w15-hist.js');
const 拼 = `
${切(W15, 'Hist')}
${切(W15, 'keGap')}
this.件 = { Hist, keGap };
`;
function 台(存, 码文){
  const 沙 = { R };
  vm.createContext(沙);
  vm.runInContext(`
    var 存过 = [];
    var State = { 表:${JSON.stringify(存 || {})},
      async get(k, d){ return this.表[k] === undefined ? d : this.表[k]; },
      async set(k, v){ this.表[k] = v; 存过.push([k, v]); return true; } };
    var window = { FD_APP:null }; var location = { protocol:'file:' };
  `, 沙);
  vm.runInContext(码文 || 拼, 沙);
  Object.assign(沙, 沙.件);
  return 沙;
}

/* ---------- 一、倍速没开那一档：就是真间隔，两头夹住 ---------- */
R.题('一、1× 那一档：吃真间隔，夹在 40 毫秒到 1.2 秒');
{
  const 沙 = 台();
  R.判('中间那段不动手脚：隔 500 毫秒就等 500 毫秒', 沙.keGap(500, 1) === 500, 沙.keGap(500, 1));
  R.判('敲得飞快（隔 5 毫秒）也不许低于 40 毫秒一屏', 沙.keGap(5, 1) === 40, 沙.keGap(5, 1));
  R.判('一次长停顿（隔 90 秒）夹成 1.2 秒（不夹放一遍要等几分钟）', 沙.keGap(90000, 1) === 1200, 沙.keGap(90000, 1));
  R.判('老记录里没有 gap（0 / 空 / 没这个字段）→ 按 40 毫秒走，不许 NaN 停住',
    沙.keGap(0, 1) === 40 && 沙.keGap(null, 1) === 40 && 沙.keGap(undefined, 1) === 40,
    [沙.keGap(0, 1), 沙.keGap(null, 1), 沙.keGap(undefined, 1)].join(' / '));
  R.判('倍速写成没这一档的数（3× / 乱码）退回 1×，不许把节奏算没',
    沙.keGap(500, 3) === 500 && 沙.keGap(500, 'abc') === 500 && 沙.keGap(500, '') === 500,
    [沙.keGap(500, 3), 沙.keGap(500, 'abc'), 沙.keGap(500, '')].join(' / '));
}

/* ---------- 二、六档倍速各算各的 ---------- */
R.题('二、六档倍速：0.25 / 0.5 / 1 / 2 / 4 / 8');
{
  const 沙 = 台();
  const 得 = 沙.Hist.RATES.map(b => [b, 沙.keGap(800, b)]);
  R.数('隔 800 毫秒那一笔，各档等多久', 得.map(x => x[0] + '×→' + x[1] + 'ms').join('  '));
  R.判('档就是名单里那六档（不多不少、顺序从小到大）',
    沙.Hist.RATES.join(',') === '0.25,0.5,1,2,4,8', 沙.Hist.RATES.join(','));
  R.判('倍速越大等得越短（一路单调，不许有哪一档反而更慢）',
    得.every((x, i) => !i || x[1] < 得[i - 1][1]), 得.map(x => x[1]).join(' > '));
  R.判('慢到 0.25× 就是把每一笔拖成四倍（800 → 3200 毫秒）', 沙.keGap(800, 0.25) === 3200, 沙.keGap(800, 0.25));
  R.判('快到 8× 就是八分之一（800 → 100 毫秒）', 沙.keGap(800, 8) === 100, 沙.keGap(800, 8));
  R.判('快到头也留 6 毫秒一层底（40 毫秒 ÷ 8 = 5 → 收在 6，不许 0 毫秒把自己转死）',
    沙.keGap(40, 8) === 6 && 沙.keGap(0, 8) === 6, 沙.keGap(40, 8) + ' / ' + 沙.keGap(0, 8));
  R.判('每一档算出来都是正数、都不是 NaN',
    沙.Hist.RATES.every(b => Number.isFinite(沙.keGap(500, b)) && 沙.keGap(500, b) > 0),
    沙.Hist.RATES.map(b => 沙.keGap(500, b)).join(','));
}

/* ---------- 三、那一档存全局：开机读得回来、坏值退回 1 ---------- */
R.题('三、存全局（hist.rate）：出厂 1×，读回坏值退回 1×');
{
  const 出厂 = 台();
  R.判('没存过 → 出厂 1×', 出厂.Hist.rate === 1, 出厂.Hist.rate);
  await 出厂.Hist.init();
  R.判('init 读完还是 1×（没存过不瞎改）', 出厂.Hist.rate === 1, 出厂.Hist.rate);
  const 存过 = 台({ 'hist.rate':4 });
  await 存过.Hist.init();
  R.判('存过 4× → 开机读回 4×', 存过.Hist.rate === 4, 存过.Hist.rate);
  const 坏 = 台({ 'hist.rate':'乱码' });
  await 坏.Hist.init();
  R.判('存档里那一位是乱码 → 退回 1×（不许把回放算成 NaN）', 坏.Hist.rate === 1, 坏.Hist.rate);
  const 歪 = 台({ 'hist.rate':3 });
  await 歪.Hist.init();
  R.判('存档里是一个没这一档的数（3）→ 也退回 1×', 歪.Hist.rate === 1, 歪.Hist.rate);
  const 点 = 台();
  await 点.Hist.init();
  点.Hist.rate = 2; await 点.State.set('hist.rate', 2);
  R.判('点一档就写进全局（下一次开机还是它）：存了 ' + JSON.stringify(点.存过), 点.存过.length === 1
    && 点.存过[0][0] === 'hist.rate' && 点.存过[0][1] === 2, JSON.stringify(点.存过));
}

/* ---------- 四、屏上那一排（只查接线，样式那一眼留给真页面） ---------- */
R.题('四、接线：那一排六档摆在「放一遍」旁边，tick 吃的是 keGap');
{
  R.判('回放那一笔的等待改走 keGap（从前那一句 Math.min(1200, Math.max(40, …)) 不再裸写）',
    /st\.timer = setTimeout\(tick, keGap\(K\.steps\[i\]\.op\.gap, Hist\.rate\)\)/.test(W15)
    && !/setTimeout\(tick, Math\.min\(1200/.test(W15),
    /setTimeout\(tick,[^\n]*/.exec(W15)[0]);
  R.判('那一排是按 Hist.RATES 摆的（加一档就少改一处），并且写了「倍速」这个名字',
    /for\(const b of Hist\.RATES\)/.test(W15) && /'倍速'\), rateSeg/.test(W15),
    /for\(const b of Hist\.RATES[^\n]*/.exec(W15)[0]);
  R.判('点一档：改 Hist.rate、写全局、重画那一排（放着的时候下一笔就按新档等）',
    /onclick:\(\) => \{ Hist\.rate = b; State\.set\('hist\.rate', b\); drawRate\(\); \}/.test(W15),
    /onclick:\(\) => \{ Hist\.rate[^\n]*/.exec(W15)[0]);
  R.判('倍速那一档不许动左边那一列写的真数：两处读数照旧走 fmtGap，只有排节奏那一条走 keGap',
    (W15.match(/fmtGap\(/g) || []).length === 3 && (W15.match(/keGap\(/g) || []).length === 2,
    'fmtGap ' + (W15.match(/fmtGap\(/g) || []).length + ' 次 / keGap ' + (W15.match(/keGap\(/g) || []).length + ' 次');
}

/* ---------- 五、咬口 ---------- */
R.题('五、咬口（改坏一句，上面那条必须变红）');
{
  const 坏一 = 拼.replace('Math.max(6, Math.min(1200, Math.max(40, +ms || 0)) / b)', 'Math.min(1200, Math.max(40, +ms || 0)) / b');
  if(坏一 === 拼) R.判('咬口一没咬到：找不到那层 6 毫秒的底', false, '');
  else {
    const 沙 = 台(null, 坏一);
    R.判('咬口一：拿掉那层底之后，8× 那一档能算到 6 毫秒以下（第二条判法当场失效）',
      沙.keGap(40, 8) < 6, 沙.keGap(40, 8));
  }
  const 坏二 = 拼.replace('const b = Hist.RATES.indexOf(+倍) >= 0 ? +倍 : 1;', 'const b = +倍;');
  if(坏二 === 拼) R.判('咬口二没咬到：找不到退回 1× 那一句', false, '');
  else {
    const 沙 = 台(null, 坏二);
    R.判('咬口二：不认档就照数的话，倍速写成乱码会算出 NaN（第一条判法当场失效）',
      !Number.isFinite(沙.keGap(500, 'abc')), 沙.keGap(500, 'abc'));
  }
}
R.收尾();
