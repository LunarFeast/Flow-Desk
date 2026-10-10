/* 外32 图9 自检：FD 首页那一张音乐遥控器的「拖大就原地摊开」。
   作者的话：「音乐遥控器拖大就在首页原地摊开」—— 摊开成整页那一副（这一份里叫 full），
   收回小卡还照卡片大小自动缩。
   根因写在下面第 5 条：外壳那条「占到整块栅格四分之一面积」的线，出厂那张（16 × 7 = 112 格）
   一辈子够不着，所以桌面这一档看着就是「展开模式没了」。
   这一台整份读源码量数，不搬进虚拟机：要真的跑一遍拖拽得开探针浏览器，那半写在最后那句报话里。 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/Programs/Flow-Desk';
const SRC = fs.readFileSync(path.join(ROOT, 'data/plugins/music-remote/main.js'), 'utf8');
const SHELL = fs.readFileSync(path.join(ROOT, 'src/_fd/src/fd3-shell.js'), 'utf8');
const TOOLS = fs.readFileSync(path.join(ROOT, 'src/_fd/src/fd8-tools.js'), 'utf8');
const YAML = fs.readFileSync(path.join(ROOT, 'data/card-size.yaml'), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、两道线只剩一个名字 ---------- */
const IN = Number(/const MUS_IN = (\d+), MUS_OUT = (\d+)/.exec(SRC)[1]);
const OUT = Number(/const MUS_IN = \d+, MUS_OUT = (\d+)/.exec(SRC)[1]);
ok('1 进的那道线是 ' + IN + ' 像素、出的是 ' + OUT + ' 像素（跟为写右栏停靠那一对同一个数，不另起一把尺）',
  IN === 300 && OUT === 240);
ok('2 观察器里吃的是这两个名字，源码里再没有第二处写着 240 / 300 那两个裸数',
  /hh >= MUS_OUT : hh >= MUS_IN/.test(SRC) && !/hh >= (240|300)\b/.test(SRC));
ok('3 观察器管的宿主两家：为写右栏停靠（where 是 dock）和 FD 桌面上那一张（where 根本没写）',
  /const 看大小 = \(ctx\.where === 'dock' \|\| ctx\.where === undefined\);/.test(SRC));
ok('4 撤卡时观察器跟着断掉，不留下没人认账的那一趟',
  /if\(this\.ro\)\{ try\{ this\.ro\.disconnect/.test(SRC));

/* ---------- 二、根因：外壳那条面积线，出厂那张够不着 ---------- */
const GC = Number(/const GRID_COLS = (\d+), GRID_ROWS = (\d+)/.exec(SHELL)[1]);
const GR = Number(/const GRID_COLS = \d+, GRID_ROWS = (\d+)/.exec(SHELL)[1]);
const EA = Number(/const EXPAND_AREA = ([\d.]+)/.exec(SHELL)[1]);
const AT = GC * GR * EA;
const seg = /音乐遥控器:\n\s+出厂: *(\d+) *× *(\d+)/.exec(YAML);
const FW = seg ? +seg[1] : -1, FH = seg ? +seg[2] : -1;
ok('5 外壳那一档要 ' + AT + ' 格才算展开（' + GC + ' × ' + GR + ' 的 ' + (EA * 100) + '%），' +
   '而音乐遥控器出厂 ' + FW + ' × ' + FH + ' = ' + (FW * FH) + ' 格 —— 靠面积那一条它一辈子走不到（图9 就是这么丢的）',
  AT === 576 && FW * FH === 112 && FW * FH < AT);
ok('6 所以桌面这一档不再只看外壳那一位：这一张自己按卡高定档，外壳那一条（ctx.expanded）照旧认',
  /this\.full = !!\(ctx\.expanded \|\| ctx\.where === 'pane'\)/.test(SRC) &&
  /!this\.full && host\.clientHeight >= MUS_IN\) this\.full = true/.test(SRC));
/* 挂载上下文里到底有什么：宿主那一段只递 { expanded }，格数根本没进来 —— 这就是量节点不量格数的理由 */
const native = /def\.mount\(host, \{ expanded:!!expanded \}\)/.test(TOOLS);
ok('7 宿主递给 native 卡（就是这一张）的挂载上下文只有 expanded 这一位，没有卡片格数 —— ' +
   '所以定档量的是节点高度，不是 C.item 那对格数（日程那张吃的才是格数）',
  native && !/def\.mount\(host, \{ expanded:!!expanded, item/.test(TOOLS));
ok('8 按卡高定档这一条只归桌面上那一张：源码里两处认 where 没写的那一位（挂上来的那一下 + 挂上之后的增减），' +
   '为写左边那一栏（left）一处都没有',
  (SRC.match(/ctx\.where === undefined/g) || []).length === 2 && !/ctx\.where === 'left'/.test(SRC));

/* ---------- 三、字号那两根滑杆跟着档走 ---------- */
ok('9 摊开就放开手动字号、粗细那两根，收回小卡又自动缩：两处写的是同一句（构造函数一处、观察器一处）',
  (SRC.match(/this\.typed = this\.full \|\| ctx\.where === 'dock';/g) || []).length === 2);

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
console.log('真拖那一下我自己开探针浏览器做（绝不动他正开着那一家）：这台窗口是隐藏态，' +
  'requestAnimationFrame 和 ResizeObserver 的第一趟都不送到，所以拖完那一下的档必须由顶上第 6 条那句在挂上来时定对 —— 那一句正好量得到。');
