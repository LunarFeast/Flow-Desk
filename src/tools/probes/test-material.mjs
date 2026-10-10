/* 外31 一组自检 · 内置配色 v1（从作者那张《Colour v1.md》提出来的 1307 个色号）+ 随包的 6 张内置纹理
   ----------
   这台盯五件事，一件都不许拿"看着像"过：
     一 那份色号表本身：个数、色号写法、一个色号只在一档、他点名的那几档在不在、组内按明度从深到浅、
        每一档归档的那把尺自不自洽。三方对账 —— 产物那一份、生成器此刻的尺（从 src\tools\colour-v1.mjs 里端出来跑）、
        探针自己另写的一把尺，两把尺都算不出别的档才算对；改完生成器忘了重跑，这一条当场报。
        个数和集合还核他那份 md 里「色块小图的文件名」和「色号那一列」两个口径 —— 两列自己也对得上才算提干净。
     二 色卡那一头：内置配色走的是「照原样」，「一键微调」那一步不许碰它；同一串不走照原样就得被理掉几个。
        两个方向都判 —— 只判一头就成了「把 tune 整条改坏也没人报」。
     三 两颗按钮：光造出来没摆进那一排 = 代码在、没人点得到（外29 第 40 轮那条教训），所以两处接线都钉；
        还有「不许开机自动灌进用户那一层」—— COLOUR_V1、MATERIAL_TEXTURES 这两个名字只许出现在那份产物和那颗按钮里。
     四 随包 6 张图的字节：表里那一行和目录里那张一一对上（没缺张、也没人往里塞一张没人认的孤儿），字节和他本机那一格的原件一字不差（那一格的路径在 src\tools\本地路径.cjs，那颗不进仓）。
     五 登记的那几处：build.mjs 拼页名单、uitext.cjs 那块中文名片、build-app 铺 Flow-Desk\material、
        fd-serve 那条 /material/ 路由、主进程 fdapp:// 的门牌、出厂镜像「这一层不铺」这个决定 —— 漏一处就是「源码里跑得好、程序里取不到」。
   跑法：node src\tools\probes\test-material.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { ROOT, rd, 切, 记账 } from './lib-slice.mjs';
import { 色表, 素材目录 } from '../本地路径.mjs';

const R = 记账('test-material');
const GEN = 'src/_fd/src/fd13-colour-v1.js';
const TOOL = 'src/tools/colour-v1.mjs';
const MD = 色表;
const 原件目录 = 素材目录;
const 纹理去处 = 'src/pack/material/textures';
const 目录 = ROOT + 纹理去处;

/* ---------- 产物那份端进沙箱（里面只有顶层常量，整份跑一遍就够） ---------- */
const 沙 = vm.createContext({});
vm.runInContext(rd(GEN) + ';this.X = { COLOUR_V1, COLOUR_V1_N, MATERIAL_DIR, MATERIAL_TEXTURES };', 沙);
const { COLOUR_V1, COLOUR_V1_N, MATERIAL_DIR, MATERIAL_TEXTURES } = 沙.X;
const 组名 = Object.keys(COLOUR_V1);
const 全部 = 组名.reduce((a, g) => a.concat(COLOUR_V1[g]), []);
const 档名 = new Map();
for(const g of 组名) for(const hex of COLOUR_V1[g]) 档名.set(hex, g);

/* ---------- 探针自己那把 HSL 尺（和生成器各写一份，两处一起改错才会一起错） ---------- */
function 拆(hex){
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2 / 255;
  const s = d === 0 ? 0 : (d / 255) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if(d !== 0){
    if(mx === r) h = 60 * (((g - b) / d) % 6);
    else if(mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if(h < 0) h += 360;
  }
  return { h, s, l, 极差:d };
}
/* 从头到尾重分一遍：第一档命中的就是它该在的那一档（顺序换了、阈值动了，这里就会报不一样的档名） */
function 分(x){
  const { h, s, l, 极差 } = x;
  if(极差 <= 10 || s <= 0.14 || l <= 0.05 || l >= 0.975) return '黑白灰';
  if(h >= 18 && h < 75 && (s < 0.5 || l < 0.42)) return '大地色';
  if((h < 20 || h >= 330) && l >= 0.72) return '粉色系';
  if(h < 12 || h >= 348) return '红色系';
  if(h < 40) return '橙色系';
  if(h < 70) return '黄色系';
  if(h < 165) return '绿色系';
  if(h < 200) return '青色系';
  if(h < 258) return '蓝色系';
  return '紫色系';
}
function 该在哪档(hex){ return 分(拆(hex)); }
/* 踩在档界上的那几个不算（色相 20、40、75 这种整界，两边各算 0.1 度就能换一档，生成器按 0~1 的小数算、
   探针按 0~255 的整数算，浮点尾数就会在这儿分岔 —— 那不是分错档，是尺的写法）。
   拿 分() 自己抖一下：色相 ±0.1 度、饱和 ±0.01、明度 ±0.008、极差 ±1，抖完还是同一档才算「离界很远」。 */
function 离界很远(hex){
  const { h, s, l, 极差 } = 拆(hex), 本 = 分({ h, s, l, 极差 });
  for(const d of [[0.1, 0, 0, 0], [-0.1, 0, 0, 0], [0, 0.01, 0, 0], [0, -0.01, 0, 0],
    [0, 0, 0.008, 0], [0, 0, -0.008, 0], [0, 0, 0, 1], [0, 0, 0, -1]]){
      if(分({ h:h + d[0], s:Math.max(0, s + d[1]), l:l + d[2], 极差:极差 + d[3] }) !== 本) return false;
    }
  return true;
}
/* ---------- 生成器此刻那把尺：从工具源码里端出 hsl() 和 组() 两颗真函数来跑 ---------- */
function 生成器的尺(文){
  const c = vm.createContext({ Math, parseInt, String });
  vm.runInContext(切(文, 'hsl') + '\n' + 切(文, '组') + ';this.f = 组;', c);
  return c.f;
}
const 尺 = 生成器的尺(rd(TOOL));

R.题('一、那份色号表提取出来的样子');
R.判('产物里 ' + 全部.length + ' 个色号，和顶上写的 COLOUR_V1_N = ' + COLOUR_V1_N + ' 是同一个数',
  全部.length === COLOUR_V1_N && COLOUR_V1_N > 900, { 全部:全部.length, 写的:COLOUR_V1_N });
R.判('个个是 # 开头六位小写色号（界面上那一行、写进 cards.yaml 那一行都是它）',
  全部.every(x => /^#[0-9a-f]{6}$/.test(x)), 全部.filter(x => !/^#[0-9a-f]{6}$/.test(x)).slice(0, 5));
R.判('一个色号只属于一档：档内不重复、档之间也不重复（' + 全部.length + ' 个去重还是 ' + new Set(全部).size + ' 个）',
  new Set(全部).size === 全部.length, 全部.length - new Set(全部).size);
R.判('他点名的那四档都在而且不空（黑白灰 / 红色系 / 绿色系 / 大地色），一共 ' + 组名.length + ' 档，一档都不许空着',
  ['黑白灰', '红色系', '绿色系', '大地色'].every(g => (COLOUR_V1[g] || []).length > 0) &&
    组名.length >= 8 && 组名.every(g => COLOUR_V1[g].length > 0), 组名.map(g => g + ':' + COLOUR_V1[g].length));
R.判('不许有一档叫「未分组」（那是色卡里没挪过组的兜底名，内置这一份每一档都该有色系名）',
  组名.every(g => g !== '未分组'), 组名);
R.判('组内按明度从深到浅（每一档这一列都不减，同明度再按色相）',
  组名.every(g => COLOUR_V1[g].every((x, i) => !i || 拆(x).l >= 拆(COLOUR_V1[g][i - 1]).l - 1e-9)),
  组名.filter(g => COLOUR_V1[g].some((x, i) => i && 拆(x).l < 拆(COLOUR_V1[g][i - 1]).l)));
{
  const 稳的 = 全部.filter(离界很远);
  const 串 = [];
  for(const hex of 稳的) if(该在哪档(hex) !== 档名.get(hex)) 串.push(档名.get(hex) + '←' + hex + '（探针这把尺算它该在 ' + 该在哪档(hex) + '）');
  R.判('探针这把独立尺重算：离档界远的 ' + 稳的.length + ' 个（共 ' + 全部.length + ' 个，界上那几个见上面那段），' +
    '没有一个和产物那一档对不上（阈值或档序被改坏、或者有人手改产物里的档位，都从这一条露出来）',
    串.length === 0, 串.slice(0, 6));
}
{
  const 串 = [];
  for(const hex of 全部) if(尺(hex) !== 档名.get(hex)) 串.push(档名.get(hex) + '←' + hex + '（生成器此刻算它该在 ' + 尺(hex) + '）');
  R.判('生成器此刻的尺和产物那一份也对得上（改完 src\\tools\\colour-v1.mjs 忘了重跑，这条当场报 —— 和上一条是两件事）',
    串.length === 0, 串.slice(0, 6));
}
{
  const 极差中性 = 全部.filter(x => 拆(x).极差 <= 10);
  const 漏 = 极差中性.filter(x => 档名.get(x) !== '黑白灰');
  R.判('极差不到 10/255 那种「看着就是灰白」的都收在黑白灰那一档（全表这样的 ' + 极差中性.length + ' 个，黑白灰那一档 ' +
    COLOUR_V1['黑白灰'].length + ' 个）—— 发白发暗那两头 HSL 饱和会虚高，光靠饱和那条会漏进色系里',
    漏.length === 0, 漏.slice(0, 6));
}
if(fs.existsSync(MD)){
  const 文 = fs.readFileSync(MD, 'utf8');
  const 图名列 = [...new Set([...文.matchAll(/swatches\/([0-9a-fA-F]{6})\.png/g)].map(m => '#' + m[1].toLowerCase()))];
  const 色号列 = [...new Set([...文.matchAll(/\|\s*#([0-9a-fA-F]{6})\s*\|/g)].map(m => '#' + m[1].toLowerCase()))];
  const 缺 = 图名列.filter(x => !全部.includes(x)), 多 = 全部.filter(x => !图名列.includes(x));
  R.判('那份 md 里两列自己就对得上：色块小图的文件名 ' + 图名列.length + ' 个、色号那一列 ' + 色号列.length + ' 个，一个不差（对不上就是那张表本身乱了）',
    图名列.length === 色号列.length && 图名列.every(x => 色号列.includes(x)), { 图名:图名列.length, 色号:色号列.length });
  R.判('一个不漏一个不多：md 里 ' + 图名列.length + ' 个，产物里 ' + 全部.length + ' 个（缺 ' + 缺.length + '、多 ' + 多.length + '）',
    缺.length === 0 && 多.length === 0, '缺 ' + 缺.slice(0, 6).join(' ') + ' 多 ' + 多.slice(0, 6).join(' '));
} else if(!MD) console.log('  这台没配那张 md（src\\tools\\本地路径.cjs），它自己那两条不量');
else R.判('那份 md 不在这台机器上（' + MD + '），这两条量不了', false, MD);

R.题('二、色卡那一头：内置配色「照原样」进，一键微调那一步不碰它');
const 色卡池 = (() => {
  const 色 = rd('src/_shared/sh-color.js');
  const lib = rd('src/_fd/src/fd3-lib.js');
  const i = lib.indexOf('const LibYml = {');
  if(i < 0) throw new Error('fd3-lib.js 里找不到 LibYml');
  let d = 0, k = lib.indexOf('{', i);
  for(; k < lib.length; k++){ if(lib[k] === '{') d++; else if(lib[k] === '}'){ d--; if(!d) break; } }
  const 落 = [];
  const c = vm.createContext({ console, Date, Math, Number, String, Array, Object, JSON, RegExp, Set, Map, isNaN, parseInt, parseFloat, setTimeout,
    落, LibStore:{ fetchRaw:async () => '', putRaw:async (n, t) => { 落.push(n); return true; }, later(n){ 落.push(n); } },
    State:{ get:async (k2, dv) => dv, set:async () => true } });
  vm.runInContext(色 + '\n' + lib.slice(i, k + 1) + ';\n' + rd('src/_fd/src/fd11-cards.js') + '\n' + rd(GEN) +
    '\n;this.X = { CardPool, CARD_SRC, CARD_SRC_BACK, CARD_HEAD, CARD_FILE };', c);
  c.X.CardPool.ready = true;
  c.X.落 = 落;
  return c.X;
})();
const { CardPool, CARD_SRC, CARD_SRC_BACK, CARD_HEAD, CARD_FILE } = 色卡池;
R.判('来源那一栏登记了内置配色（v1 → 内置配色），写出去再读回来还是 v1（来回对不上，界面上那一栏就成了空）',
  CARD_SRC.v1 === '内置配色' && CARD_SRC_BACK['内置配色'] === 'v1', { v1:CARD_SRC.v1, 回:CARD_SRC_BACK['内置配色'] });
{
  const 没列 = Object.values(CARD_SRC).filter(n => !CARD_HEAD.includes(n));
  R.判('色卡那份文件头顶的说明把 ' + Object.keys(CARD_SRC).length + ' 个来源名字全列了出来（漏一个就是说明和码不同步，他照说明改文件会改不出来）',
    没列.length === 0, 没列);
}
const 样串 = ['#0a0a0a', '#ff0000', '#ff1a1a'];
R.判('「照原样」那一趟真的不动：三个样色原样进池（近黑没被推档、两个近邻没并掉）',
  (() => {
    CardPool.items = []; CardPool.tuneOn = true;
    const n = CardPool.addAll(样串, 'v1', '测试', true);
    return n === 3 && JSON.stringify(CardPool.items.map(c => c.colors[0].raw)) === JSON.stringify(样串);
  })(), CardPool.items.map(c => c.colors[0].raw));
R.判('同一串不走「照原样」就得被理一遍（一键微调那条路没被这次改动改坏）',
  (() => {
    CardPool.items = []; CardPool.tuneOn = true;
    const n = CardPool.addAll(样串, 'v1', '测试');
    const 存 = CardPool.items.map(c => c.colors[0].raw);
    return n === 2 && 存[0] !== '#0a0a0a' && !存.includes('#ff1a1a');
  })(), CardPool.items.map(c => c.colors[0].raw));
{
  CardPool.items = [];
  let 添 = 0;
  for(const g of 组名) 添 += CardPool.addAll(COLOUR_V1[g], 'v1', g, true);
  R.判('界面那颗走的这一趟：' + 组名.length + ' 档按档进池，添了 ' + 添 + ' 个 —— 和那一份的 ' + COLOUR_V1_N + ' 个一样多（一个都没被微调理掉）',
    添 === COLOUR_V1_N && CardPool.count() === COLOUR_V1_N, { 添, 池:CardPool.count() });
  R.判('每一档的组名落成了那个色系、来源落成 v1（界面上按组分块摊开靠的就是这两栏）',
    CardPool.items.every(c => (COLOUR_V1[c.group] || []).includes(c.colors[0].raw) && c.source === 'v1'),
    JSON.stringify(CardPool.items.find(c => c.source !== 'v1') || {}));
  let 再点 = 0;
  for(const g of 组名) 再点 += CardPool.addAll(COLOUR_V1[g], 'v1', g, true);
  R.判('再点一趟不攒第二个（连着点两回，色卡还是那 ' + CardPool.count() + ' 个）', 再点 === 0 && CardPool.count() === COLOUR_V1_N, 再点);
  const 写 = CardPool.text(), 前 = CardPool.items.map(c => [c.colors[0].raw, c.group, c.source]);
  CardPool.items = [];
  const 读回 = CardPool.adopt(写);
  R.判('写出去再读回来：' + 读回 + ' 段，色号 / 组名 / 来源「内置配色」一样不缺（那份文件他能在记事本里接着改）',
    读回 === COLOUR_V1_N && JSON.stringify(CardPool.items.map(c => [c.colors[0].raw, c.group, c.source])) === JSON.stringify(前),
    JSON.stringify(CardPool.items.slice(0, 2).map(c => [c.colors[0].raw, c.group, c.source])));
  R.判('往里加这一步存盘喊的是那条通道（写的是 ' + CARD_FILE + '，不是另起一份文件）',
    色卡池.落.length > 0 && 色卡池.落.every(n => n === CARD_FILE), 色卡池.落.slice(0, 3));
}
{
  CardPool.items = []; CardPool.tuneOn = true;
  let 理 = 0;
  for(const g of 组名) 理 += CardPool.addAll(COLOUR_V1[g], 'v1', g);
  R.判('把这 ' + COLOUR_V1_N + ' 个当散色走一遍（不给「照原样」那个词）：只剩 ' + 理 + ' 个，差了 ' + (COLOUR_V1_N - 理) +
    ' 个 —— 这就是内置那一份必须写定进池的理由',
    理 > 0 && 理 < COLOUR_V1_N, 理);
}

R.题('三、随包那两份的进法：开机就进，界面上那两颗按钮也还在');
const 页 = rd('src/_fd/src/fd4-builtin.js');
const 切按钮 = (名, 标) => {
  const m = new RegExp('const ' + 名 + " = h\\('button',[\\s\\S]*?\\}\\}, '" + 标 + "'\\);").exec(页);
  if(!m) throw new Error('切不到那颗按钮：' + 名 + '（界面上写的是「' + 标 + '」）');
  return m[0];
};
/* 「内置配色 v1 进色卡」那一枚按钮 2026-10-09 撤了（外34 图8：两个多余按钮）——
   开机那一步（fd11-cards.js 的 CardPool.boot）本来就把这一整张表灌进色卡，按钮只是「整批划掉了想再来一遍」。
   这里改钉两件事：界面上不再摆那一枚，而开机那一步一轮一轮按档灌的写法还在（撤按钮不能把灌色也带走）。 */
R.判('界面上不再摆「内置配色 v1 进色卡」那一枚（也不摆「小企鹅配色进色卡」）—— 钉的是按钮上那种带引号的写法，注释里引作者原话那一句不算摆上去；' +
   '留下的是「勾中的进色卡」「当前方案的色进色卡」「取色进色卡」「从这张背景图取色进色卡」这四枚',
  !/'内置配色 v1 进色卡'/.test(页) && !/'小企鹅配色进色卡'/.test(页));
const 开机灌 = rd('src/_fd/src/fd11-cards.js');
R.判('开机那一步照旧按档一轮一轮灌（档名从 COLOUR_V1 的键来，没把 ' + 组名.length + ' 这个数字写死在调用里）',
  /for\(const g of Object\.keys\(COLOUR_V1\)\)/.test(开机灌) && /CardPool\.addAll\(COLOUR_V1\[g\], 'v1', g, true\)|this\.addAll\(COLOUR_V1\[g\], 'v1', g, true\)/.test(开机灌),
  (开机灌.match(/for\(const g of Object\.keys\(COLOUR_V1\)\)[^\n]*/) || ['没找到'])[0].trim());
R.判('色卡那一排上「当前方案的色进色卡」还在，而且真的挂在那一排里（撤的是那两枚批量灌色的，不是这一枚）',
  /'当前方案的色进色卡'/.test(页) && !/顶\.append\([^)]*内置[^)]*\)/.test(页) && /顶\.append\(成组, 从方案, 加\)/.test(页),
  (页.match(/顶\.append\([^\n]*\)/g) || []).join(' ｜ '));
const 纹理钮 = 切按钮('内置收', '内置纹理收进图片库');
const 收文 = 切(页, '内置纹理收');
R.判('收字节这一步单独一颗「内置纹理收()」：界面上那颗按钮只喊这一颗，字节从随包那一层取（MATERIAL_DIR + 文件名）、走的是收图那一条现成的路 imgAccept（不在按钮里再抄一遍第二套真相）',
  /await 内置纹理收\(\)/.test(纹理钮) && !/await fetch\(/.test(纹理钮)
  && /await fetch\(MATERIAL_DIR \+ encodeURIComponent\(t\.文件\)\)/.test(收文) && /await imgAccept\(/.test(收文), 收文.slice(0, 120));
R.判('收进去的用途记成「纹理·四方连续图」、名字和作者跟着表里那一行走（屏幕上看到的是中文名，不是 cotton.png）',
  /imgAccept\(\{ name:t\.文件, arrayBuffer:async \(\) => buf\.buffer \}, t\.名字, '纹理·四方连续图', t\.作者\)/.test(收文), '');
R.判('图库里已经有同名的那张就不重收（按中文名查重，不拿包里那个英文名比）—— 现在开机每一趟都走这一颗，靠的就是这一道查重',
  /MATERIAL_TEXTURES\.filter\(t => !ImgLib\.find\(t\.名字\)\)/.test(收文), '');
R.判('那颗摆进了图片库那一排（外32 起分两块摆：按纹理那一块才 concat 上去，按背景图/取色素材那一块不摆）',
  /\.concat\([\s\S]{0,90}?\[内置收\]/.test(页), '');
R.判('这一颗里不许自己写 ImgLib.add，也不许自己补一道「贴不贴得开」检测（收图那一条路之外不留第二套真相）',
  !/ImgLib\.add\(/.test(收文) && !/TexTest\./.test(收文), '');
{
  const 格子 = ['src/_fd/src', 'src/_wnw/src', 'src/_shared', 'src/_fd', 'src/pack', 'src/_build'];
  const 撞 = [];
  for(const d of 格子){
    if(!fs.existsSync(ROOT + d)) continue;
    for(const f of fs.readdirSync(ROOT + d)){
      const p = path.join(ROOT + d, f);
      if(!fs.statSync(p).isFile() || !/\.(js|mjs|cjs)$/.test(f)) continue;
      if(d === 'src/_fd/src' && (f === 'fd13-colour-v1.js' || f === 'fd4-builtin.js' || f === 'fd11-cards.js')) continue;
      const 文 = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
      for(const n of ['COLOUR_V1', 'MATERIAL_TEXTURES', 'MATERIAL_DIR'])
        if(文.includes(n)) 撞.push(d + '/' + f + ' 写了 ' + n);
    }
  }
  /* 2026-10-08 作者改口：「说好的1000多个颜色呢？？md色号都给你了，嵌入呢！！！！！！！你的工作结果呢」
     —— 「嵌入」要的是开箱就有，不是摆一颗按钮等他去点。所以这一条从「开机不许自动灌」改成「开机就灌、
     而且只在没进过的时候灌」：色卡那一份在 CardPool.boot 里、纹理那一份在 bootLibs 里，各认各的查重。 */
  const 色 = rd('src/_fd/src/fd11-cards.js'), 图 = rd('src/_fd/src/fd3-lib.js');
  R.判('开机就自动灌（这一轮改的口）：色卡那 1307 个在 CardPool.boot 里灌、6 张纹理在 bootLibs 里收，'
    + '两处都只认「这一趟还没进过才进」—— 他删掉的那些下一趟不硬塞回来',
    撞.length === 0
      && /if\(!this\.items\.some\(c => c\.source === 'v1'\)\)\{[\s\S]{0,220}for\(const g of Object\.keys\(COLOUR_V1\)\) 添 \+= this\.addAll\(COLOUR_V1\[g\], 'v1', g, true\)/.test(色)
      && /try\{ await 内置纹理收\(\); \}/.test(图), 撞);
  {
    const 改 = 色.replace("if(!this.items.some(c => c.source === 'v1')){", 'if(true){');
    R.判('咬口·开机那一趟重复灌：把「认来源 v1 进过没有」那一道闸改成永远没进过 → 上面那条当场失效（每一回开机都往色卡里加一轮，'
      + '他把那张色卡删干净了也会第二天又满回来）', 改 !== 色 && !/items\.some\(c => c\.source === 'v1'\)/.test(改), '');
  }
}

R.题('四、随包 6 张内置纹理的字节');
R.判('地址前缀是 material/textures/ —— 页面写相对地址，主进程和开发服务器按同一个口径找（末尾那道斜杠也得有）',
  MATERIAL_DIR === 'material/textures/', MATERIAL_DIR);
R.判('表里 ' + MATERIAL_TEXTURES.length + ' 行，三栏都齐：中文名字、包里那个英文名（.png）、作者名（界面上显示前两栏）',
  MATERIAL_TEXTURES.length === 6 && MATERIAL_TEXTURES.every(t => t.名字 && /^[a-z0-9-]+\.png$/.test(t.文件) && t.作者),
  MATERIAL_TEXTURES.map(t => [t.名字, t.文件, t.作者]));
{
  const 有的 = fs.existsSync(目录) ? fs.readdirSync(目录).sort() : [];
  const 表的 = MATERIAL_TEXTURES.map(t => t.文件).sort();
  R.判('表里那一串和 ' + 纹理去处 + '\\ 里真有的文件一一对上（没缺张，也没人往里塞一张没人认的孤儿）',
    JSON.stringify(有的) === JSON.stringify(表的), { 目录:有的, 表:表的 });
  const 坏 = [];
  for(const t of MATERIAL_TEXTURES){
    const b = fs.readFileSync(path.join(目录, t.文件));
    const 头 = b.slice(0, 8).toString('hex');
    if(头 !== '89504e470d0a1a0a' || b.readUInt32BE(16) < 256 || b.readUInt32BE(20) < 256)
      坏.push(t.文件 + ' 头=' + 头.slice(0, 16) + ' 尺寸=' + (b.length > 24 ? b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) : '读不出'));
  }
  R.判('6 张都真是 png 图、边长不小于 256（不是占位的空文件，也不是一张改了名的文本）', 坏.length === 0, 坏);
}
if(fs.existsSync(原件目录)){
  const 不同 = [];
  for(const t of MATERIAL_TEXTURES){
    let 原 = null;
    for(const f of fs.readdirSync(原件目录)) if(f.startsWith(t.名字 + ' by ') || f === t.名字 + '.png'){ 原 = path.join(原件目录, f); break; }
    if(!原){ 不同.push(t.名字 + ' 在他那一层找不到原件'); continue; }
    if(!fs.readFileSync(原).equals(fs.readFileSync(path.join(目录, t.文件)))) 不同.push(t.名字 + ' 随包那一份和原件不一样了');
    const 作者 = / by (.+?)\.[a-z]+$/i.exec(path.basename(原));
    if(作者 && 作者[1] !== t.作者) 不同.push(t.名字 + ' 作者名对不上（表里 ' + t.作者 + '，原件叫 ' + 作者[1] + '）');
  }
  R.判('随包那 6 张的字节和他本机那一格里的原件一字不差、作者名跟着文件名里那一段走（图换过了就跑一遍 node src\\tools\\colour-v1.mjs 重新铺）',
    不同.length === 0, 不同);
} else if(!原件目录) console.log('  这台没配本地那一格（src\\tools\\本地路径.cjs），素材原件这两条不量');
else R.判('他那层素材目录不在（' + 原件目录 + '），字节比对这一条量不了', false, 原件目录);

R.题('五、登记的那几处（漏一处就是「源码里跑得好、程序里取不到」）');
R.判('build.mjs 拼页名单点到了这份产物（漏了它，产物页面里 COLOUR_V1 这个名字根本不存在，按那颗按钮当场炸）',
  /'fd13-colour-v1\.js'/.test(rd('src/_fd/build.mjs')), '');
R.判('uitext.cjs 那张中文名片里有它（改页面文字那台报出处时报得出「内置配色与随包纹理」，不是一串英文文件名）',
  /'fd13-colour-v1\.js':'内置配色与随包纹理'/.test(rd('src/pack/uitext.cjs')), '');
R.判('build-app 把随包素材铺到 Flow-Desk\\material（树根那一份，页面按相对地址取的就是它），keepExisting —— 他自己换过的图不被出包吃掉',
  /copyDir\(path\.join\(PACK_DIR, 'material'\), path\.join\(OUT, 'material'\), true\)/.test(rd('src/pack/build-app.mjs')), '');
{
  const 镜 = rd('src/pack/mirror.mjs');
  R.判('出厂镜像那一层「不铺 material」是定过的、不是漏的：没有这一颗 job，原因写在镜像那一段里',
    !/to:path\.join\(RES, 'material'\)/.test(镜) && /不在这里铺/.test(镜) && /fdapp/.test(镜) && /更新包/.test(镜), '');
}
{
  const 服 = rd('src/_fd/fd-serve.mjs');
  R.判('开发服务器有 /material/ 这一条路由，两个根挨个试（树根 Flow-Desk\\material → src\\pack\\material 那份原件），没出过包也验得出这一条',
    /url\.startsWith\('\/material\/'\)/.test(服) && /path\.join\(TREE\.tree, 'material'\)/.test(服) && /'pack', 'material'/.test(服), '');
  R.判('那条路由拒越界（拿 .. 绕到素材格子以外就不发）',
    /if\(!abs\.startsWith\(path\.resolve\(b\)\)\) return send\(res, 403/.test(服), '');
}
{
  const 主 = rd('src/pack/main.cjs');
  R.判('主进程 fdapp:// 那四个门牌里有「树根」那一条，所以 material/textures/xxx.png 不用新增门牌就到得了',
    /const cands = \[path\.resolve\(PAGES_ROOT, rel\), path\.resolve\(TREE, rel\)/.test(主) && /inside\(p, TREE\)/.test(主), '');
  const 树根 = path.resolve(ROOT.replace(/\/$/, ''));
  const 落 = path.resolve(树根, 'material/textures/cotton.png');
  R.判('拿真的树根实算一遍这一条门牌：树根拼 material/textures/cotton.png 落在树以内（不越界、也不绕到树以外那一格 —— 主进程 inside() 那道闸认的就是这个形状）',
    落.toLowerCase().startsWith(树根.toLowerCase() + path.sep) && !落.includes('..'), 落);
  R.数('Flow-Desk\\material\\textures\\cotton.png 铺了没有', fs.existsSync(落) ? '铺了，字节和原件一样：' +
    fs.readFileSync(落).equals(fs.readFileSync(目录 + '/cotton.png')) : '还没铺 —— 这一格由 node src\\pack\\build-app.mjs 铺（关掉程序跑那一步）');
}
R.判('生成那台工具在仓里，产物头顶写了这一句（node src\\tools\\colour-v1.mjs 重生成一份）',
  fs.existsSync(ROOT + TOOL) && /node src\\tools\\colour-v1\.mjs 重生成一份/.test(rd(GEN)), '');

R.题('六、咬口（确认上面那些判法真咬得住）');
{
  const 改 = rd(GEN).replace("  '大地色': [\n", "  '大地色': [\n    '#00ff00',\n");
  const 沙2 = vm.createContext({});
  vm.runInContext(改 + ';this.X = { COLOUR_V1 };', 沙2);
  const 串 = [];
  for(const g of Object.keys(沙2.X.COLOUR_V1)) for(const hex of 沙2.X.COLOUR_V1[g])
    if(离界很远(hex) && 该在哪档(hex) !== g) 串.push(g + '←' + hex);
  R.判('咬口一：往大地色那一档塞一个纯绿色号 → 「探针这把尺重算」那条当场失效（生成器算错档、或者有人手改产物档位，都是这个形状）',
    串.length === 1 && 串[0] === '大地色←#00ff00', 串);
}
{
  const 无那条 = rd(TOOL).replace('if(极差 <= 10 || s <= 0.14 || l <= 0.05 || l >= 0.975)', 'if(s <= 0.14 || l <= 0.05 || l >= 0.975)');
  const 尺2 = 生成器的尺(无那条);
  const 不一样 = 全部.filter(x => 尺2(x) !== 档名.get(x));
  R.判('咬口二：把生成器里「极差 <= 10」那一句删掉 → 产物和生成器的尺对不上（' + 不一样.length + ' 个色号跑到别的档去了），' +
    '「生成器此刻的尺和产物对得上」那条当场失效 —— 这就是改完工具必须重跑一遍的原因',
    不一样.length > 0, 不一样.slice(0, 4));
}
{
  const 改 = 开机灌.replace("this.addAll(COLOUR_V1[g], 'v1', g, true)", "this.addAll(COLOUR_V1[g], 'v1', g)");
  R.判('咬口三：把开机那一步里「照原样」那一个词掉了 → 「按档进池、一个都不被理掉」那条判法当场失效' +
    '（界面上看着还是添了一批，实际比 ' + COLOUR_V1_N + ' 少 —— 第二节那条量过差几个）',
    改 !== 开机灌 && !/addAll\(COLOUR_V1\[g\], 'v1', g, true\)/.test(改), '');
}
{
  const 改 = 页.replace('顶.append(成组, 从方案, 加)', '顶.append(成组, 加)');
  R.判('咬口四：把「当前方案的色进色卡」从那一排里摘掉 → 接线钉那条当场失效（外29 第 40 轮那四条毛病就是这个形状：函数在、按钮在、没人走得通）',
    改 !== 页 && !/顶\.append\([^)]*从方案[^)]*\)/.test(改), '');
}
{
  const 改 = rd('src/_fd/build.mjs').replace("'fd13-colour-v1.js',", '');
  R.判('咬口五：把这份产物从拼页名单里摘掉 → 「build.mjs 点到了它」当场失效（真页面上那颗一按就是 COLOUR_V1 认不出来）',
    /'fd13-colour-v1\.js'/.test(rd('src/_fd/build.mjs')) && !/'fd13-colour-v1\.js'/.test(改), '');
}
{
  const 改 = rd('src/pack/build-app.mjs').replace(/copyDir\(path\.join\(PACK_DIR, 'material'\)[^\n]*/, '');
  const 改2 = rd('src/_fd/fd-serve.mjs').replace(/if\(url\.startsWith\('\/material\/'\)\)\{/, 'if(false){');
  const 改3 = rd('src/pack/mirror.mjs') + "\nout.push({ k:'tree', mode:'flat', note:'补上', from:path.join(HERE, 'material'), to:path.join(RES, 'material') });\n";
  R.判('咬口六：出包那一句删掉 / 开发服务器那条路由改死 / 镜像那一层又冒出一颗 material 的 job → 对应三条判法各自当场失效',
    !/path\.join\(OUT, 'material'\)/.test(改) && !/url\.startsWith\('\/material\/'\)/.test(改2) &&
      /to:path\.join\(RES, 'material'\)/.test(改3), '');
}
{
  const 改 = rd(GEN).replace("{ 名字:'棉纸', 文件:'cotton.png'", "{ 名字:'棉纸', 文件:'cotton-v2.png'");
  const 沙3 = vm.createContext({});
  vm.runInContext(改 + ';this.X = { MATERIAL_TEXTURES };', 沙3);
  const 表的 = 沙3.X.MATERIAL_TEXTURES.map(t => t.文件).sort();
  const 有的 = fs.readdirSync(ROOT + 纹理去处).sort();
  R.判('咬口七：表里那一行的英文名改了、目录里那张没跟着改名 → 「一一对上」那条当场失效（随包那份字节就成了没人认的孤儿）',
    有的.includes('cotton.png') && !表的.includes('cotton.png'), { 表:表的, 目录:有的 });
}

R.数('色号', COLOUR_V1_N);
R.数('档', 组名.map(g => g + ' ' + COLOUR_V1[g].length).join(' · '));
R.数('内置纹理', MATERIAL_TEXTURES.map(t => t.名字 + '→' + t.文件).join(' · '));
R.收尾();
