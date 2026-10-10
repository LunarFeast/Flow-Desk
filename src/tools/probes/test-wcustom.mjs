/* 组件定制分离这一轮的闸（外39 · 2026-10-09 他定「组件定制本身也要分离出来，改名为 wnw-custom」）
   ------------------------------------------------------------
   形状照为写那一套：源码单独一棵（src\_wcustom\src\）→ 自己出一颗产物 → 主程序构建只读那颗产物；
   界面上多一张启动卡，包 id = wnw-custom，仓库对应 Flow-Desk-plugin-WNW-Custom。
   钉四件事，每条都报数：
     一 · 那一棵的形状：名单和磁盘一一对得上、老地方一处不剩、装配单点的是产物不是那四份源码
     二 · 不套闭包这条口径没被改掉（名字照旧落在整页顶层，理由写在 build-kernel.mjs 开头）
     三 · 这一家包在位：三份文件齐、说明书 id 对得上目录名、在名单里、那张卡只吃 ctx
     四 · 宿主递出去的那只口（fd5-load 里的 wcustom）两头都判：内核在开得起来、不在就说实话
   最后咬口：把「内核在不在」那一句判反 —— 干净那一跑开得得到的，必须变成开不到。 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, rd, 记账 } from './lib-slice.mjs';

const 台 = 记账('组件定制分离');
const 棵 = ROOT + 'src/_wcustom/';
const 包 = ROOT + 'data/plugins/wnw-custom/';

/* ---------- 一 · 那一棵的形状 ---------- */
台.题('一 · 一棵源码 + 一颗产物 + 装配单只读产物');
const 装 = rd('src/_wcustom/build-kernel.mjs');
const 名单 = (/const PARTS = \[([\s\S]*?)\]/.exec(装)[1].match(/'([^']+)'/g) || []).map(s => s.replace(/'/g, ''));
const 盘上 = fs.readdirSync(棵 + 'src').filter(n => /\.js$/.test(n)).sort();
台.数('名单 ' + 名单.length + ' 份 · 磁盘 ' + 盘上.length + ' 份', 盘上.join('、'));
台.判('名单和磁盘一一对得上（多一份少一份都算漏）',
  名单.slice().sort().join(',') === 盘上.join(','), 名单.join('、') + ' 对 ' + 盘上.join('、'));
const 旧位置 = ['sh-banks.js', 'sh-gen.js', 'sh-wizard.js', 'sh-code.js']
  .filter(n => fs.existsSync(ROOT + 'src/_shared/' + n));
台.判('那四份在老地方（src\\_shared\\）一份不剩', 旧位置.length === 0, 旧位置.join('、'));
const 装配 = rd('src/_fd/build.mjs');
台.判('装配单点的是那颗产物，不再点那四份源码',
  /\.\.\/_wcustom\/wnw-custom-kernel\.js/.test(装配)
  && !/_shared\/(?:sh-banks|sh-gen|sh-wizard|sh-code)\.js/.test(装配), 'build.mjs 的 parts 那一段');
let 新 = false, 话 = '';
try{ execFileSync(process.execPath, [棵 + 'build-kernel.mjs', '--比'], {stdio:'pipe'}); 新 = true; }
catch(e){ 话 = String((e.stderr && String(e.stderr)) || (e.stdout && String(e.stdout)) || e.message).split(/\r?\n/)[0]; }
台.判('盘上那颗产物和这四份源码对得上（改了源码没重跑，就是旧字进页）', 新, 话 || '一致');

/* ---------- 二 · 不套闭包 ---------- */
台.题('二 · 名字照旧落在整页顶层（这一棵和为写不一样的一处）');
const 产物 = fs.readFileSync(棵 + 'wnw-custom-kernel.js', 'utf8');
const 顶层名 = [...产物.matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
台.数('产物里顶层声明', 顶层名.length + ' 个');
台.判('产物没被整层闭包包住（去掉开头那段注释，第一句不是 (function）',
  !/^\s*\(function/.test(产物.replace(/^\/\*[\s\S]*?\*\//, '')), 产物.replace(/^\/\*[\s\S]*?\*\//, '').trim().slice(0, 30));
const 该有 = ['GenWizard', 'Gen', 'Banks', 'H', 'codeEntry', 'PackCode'];
台.判('外壳要认的那几个名字都落在顶层（缺一个就是那一处入口点了没动静）',
  该有.every(n => 顶层名.includes(n)), 该有.filter(n => !顶层名.includes(n)).join('、') || '全在');
const 壳 = rd('src/_fd/src/fd3-shell.js');
台.数('外壳里那种「名字在不在」的判法', (壳.match(/typeof (?:codeEntry|GenWizard|Gen|toolBankWhich)\s*[!=]==?\s*(?:'function'|'undefined')/g) || []).length);
台.判('外壳确实是一路按「名字在不在」摆入口（不带内核那一版才不会当场抛）',
  /typeof codeEntry === 'function'/.test(壳) && /typeof GenWizard !== 'undefined'/.test(壳), 'fd3-shell.js');

/* ---------- 三 · 这一家包在位 ---------- */
台.题('三 · wnw-custom 这一家在数据层');
const 缺 = ['manifest.json', 'main.js', 'images/icon.svg'].filter(f => !fs.existsSync(包 + f));
台.判('三份一份不缺（说明书 / 卡 / 自己那张图标）', 缺.length === 0, 缺.join('、') || '齐');
const 说 = JSON.parse(fs.readFileSync(包 + 'manifest.json', 'utf8'));
const 卸掉的 = (JSON.parse(fs.readFileSync(ROOT + 'data/plugins/off.json', 'utf8')).off || []).map(String);
台.判('说明书里的 id 就是目录名，界面上叫「组件定制」',
  说.id === 'wnw-custom' && 说.name === '组件定制', 说.id + ' / ' + 说.name);
/* 「在不在不加载名单里」是他那一格的数据状态，不是代码属性：清完用户数据、或者在「添加插件」里
   把七家都卸掉之后，这张卡本来就不该摆 —— 那种时候这一条没有可判的对象，报一句跳过的原因，
   不许按失败算（2026-10-10 他一句「首次安装就是空的」）。 */
const 卸了 = 卸掉的.includes('wnw-custom');
if(卸了) 台.数('这一条这一趟没判：它在「不加载」名单里（界面上本来就不摆这张卡）', 'off.json 记着 ' + 卸掉的.length + ' 家');
else 台.判('它没被卸掉（卸掉了就没有这张卡，也不该有）', true);
const 卡 = fs.readFileSync(包 + 'main.js', 'utf8');
const 伸手 = ['GenWizard', 'Gen', 'Banks', 'codeEntry', 'PackCode', 'window.'].filter(n => 卡.includes(n));
台.判('那张卡只吃 ctx，不伸手摸整页顶层那些名字（组件边界这一条不给打洞）',
  伸手.length === 0 && /ctx\.wcustom/.test(卡), 伸手.join('、') || '干净');

/* ---------- 四 · 宿主递出去的那只口 ---------- */
台.题('四 · fd5-load 交下去的 ctx.wcustom（内核在不在、开不开得起来）');
const 答 = rd('src/_fd/src/fd5-load.js');
const 块 = /wcustom:\{[\s\S]*?\n    \}/.exec(答);
if(!块) throw new Error('没在 fd5-load.js 里找到 wcustom 那一段（换了写法，这台要跟着改）');
const 造 = new Function('GenWizard', 'FD_VERSION', 'const WCUSTOM_MISSING = ' + JSON.stringify('组件定制的内核还没拼进这一版页面')
  + ';\nreturn ' + 块[0].replace(/^wcustom:/, '') + ';');
const 假内核 = { open(){ 假内核.叫过 = (假内核.叫过 || 0) + 1; }, onSaved:null };
const 有 = 造(假内核, '1.4.0');
有.open(() => {});
台.判('内核在：available 说 true，open 真把那台向导叫起来、回调交到了它手上',
  有.available === true && 假内核.叫过 === 1 && typeof 假内核.onSaved === 'function',
  'available=' + 有.available + ' · 叫了几次=' + 假内核.叫过 + ' · 回调=' + (typeof 假内核.onSaved));
const 没 = 造(undefined, '1.4.0');
台.判('内核不在：available 说 false，open 不抛个 undefined 而是给一句实话',
  没.available === false && /还没拼进这一版页面/.test(String(没.version)), 'available=' + 没.available + ' · version=' + 没.version);
let 抛 = '';
try{ 没.open(() => {}); }catch(e){ 抛 = e.message; }
台.判('内核不在还硬开：抛的是那一句实话（不是 undefined 那种看不懂的）', /还没拼进这一版页面/.test(抛), 抛 || '没抛');
/* 咬口：把 available 那一句判反，干净那一跑该开得起来的必须开不到 */
const 反 = new Function('GenWizard', 'FD_VERSION', 'const WCUSTOM_MISSING = "x";\nreturn '
  + 块[0].replace(/^wcustom:/, '').replace(/typeof GenWizard !== 'undefined'/, "typeof GenWizard === 'undefined'") + ';')(假内核, '1.4.0');
台.判('咬口 · 把「在不在」那一句判反，内核明明在却说没有（反不过说明那一句没承重）',
  反.available === false, 反.available);

台.收尾();
