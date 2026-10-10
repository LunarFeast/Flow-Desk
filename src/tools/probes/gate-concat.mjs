/* 全清这一轮的闸：不写产物，只在内存里照两份装配单拼一遍，
   逐份 new vm.Script，再把整页拼起来 new vm.Script —— 查的是语法，和 build 里 add() 那一步同一把尺。
   为什么不直接跑 build.mjs：他说「我说"生成"才跑 build.mjs」。
   2026-10-09 为写分离（同步 GitHub 第 4 条）之后，名单分在两处：
     src\_fd\build.mjs            外壳那三十来份（顶层作用域）
     src\_wnw\build-kernel.mjs    为写那二十份（闭包），它的产物落在 src\_wnw\wnw-kernel.js
   整页 = 外壳 + 那颗产物 + 开机那一份，所以这一台还要顺手量一笔「产物落后没落后」。
   同一天晚些（外39「组件定制本身也要分离出来」）又多一棵：src\_wcustom\build-kernel.mjs
   出 src\_wcustom\wnw-custom-kernel.js，那份不套闭包、名字照旧落在顶层，产物在不在新不新同一把尺量。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { 号 } from '../../_build/version.mjs';

const ROOT = 'D:/Programs/Flow-Desk';
const build = fs.readFileSync(path.join(ROOT, 'src/_fd/build.mjs'), 'utf8');
const kernel = fs.readFileSync(path.join(ROOT, 'src/_wnw/build-kernel.mjs'), 'utf8');
const grab = (src, marker) => {
  const i = src.indexOf(marker);
  if(i < 0) throw new Error('装配单里找不着：' + marker);
  const j = src.indexOf('];', i);
  return src.slice(i + marker.length, j).split(',').map(s => s.trim()).filter(Boolean);
};
const names = s => s.replace(/['"]/g, '');
const parts = grab(build, 'const parts = [').map(names);
const wnw = grab(kernel, 'const PARTS = [').map(names);
const boot = /const BOOT = '([^']+)'/.exec(build)[1];
console.log('顶层份数 ' + parts.length + ' · 为写份数 ' + wnw.length + ' · 开机那份 ' + boot);

let js = '';
const fail = [];
const 查 = (name, src) => {
  try{ new vm.Script(src, { filename:name }); }
  catch(e){ fail.push(name + ' → ' + e.message); return false; }
  return true;
};
const add = (name, src) => { if(查(name, src)) js += '\n/* ==== ' + name + ' ==== */\n' + src; };
/* 页顶上那一句号：生成那一趟写在最前面（build.mjs 里那一句），这一台照同一句拼，
   再单独核「build.mjs 里还留着写这一句」—— 产物读不得，机制只能从装配这一头核。 */
js += '\nvar FD_VERSION = ' + JSON.stringify(号()) + ';\n';
const 有那一句 = /var FD_VERSION = /.test(build);
console.log(有那一句 ? '✓ build.mjs 还在往页顶写那一句号（这一趟的号是 ' + 号() + '）'
  : '✗ build.mjs 里不再写 FD_VERSION：为写和声笔练习那份号就断了来源');
const read = p => fs.readFileSync(p.startsWith('../')
  ? path.join(ROOT, 'src/_fd', p) : path.join(ROOT, 'src/_fd/src', p), 'utf8');
const readWnw = p => fs.readFileSync(path.join(ROOT, 'src/_wnw/src', p), 'utf8');
/* 内置代码编辑器的运行时（build 里 add('icode-src', icodeEmbed()) 那一坨）不在源码树里，这里不比 */
for(const p of parts) add(p, read(p));
/* 为写那二十份逐份过一遍语法（只查不拼 —— 拼进顶层会和下面那颗产物撞名，
   build-kernel 那一趟也是这个口径：逐份查完再整段关进闭包） */
for(const p of wnw) 查('为写/' + p, readWnw(p));
let body = '';
for(const p of wnw) body += readWnw(p) + '\n';
const 现拼 = '(function(){\n' + body + '\n})();\n';
const 盘上 = fs.existsSync(path.join(ROOT, 'src/_wnw/wnw-kernel.js'))
  ? fs.readFileSync(path.join(ROOT, 'src/_wnw/wnw-kernel.js'), 'utf8') : '';
const 新 = !!盘上 && 盘上.endsWith(现拼);
console.log(!盘上 ? '✗ 产物那一颗根本不在：跑 node src\\_wnw\\build-kernel.mjs'
  : 新 ? '✓ 为写内核产物是最新的（' + Buffer.byteLength(盘上) + ' 字节）'
  : '✗ 为写内核产物落后于源码（盘上 ' + Buffer.byteLength(盘上) + ' 字节）：跑 node src\\_wnw\\build-kernel.mjs');
/* 整页拿的是盘上那颗（build.mjs 读的就是它），不是现拼的这一份 */
if(盘上) add('wnw-kernel', 盘上);

/* ---------- 组件定制那颗产物（外39 分离，形状照为写那一套） ----------
   build.mjs 把它当成 parts 里的一份读，所以整页拼的已经是盘上那一颗；这里补两件事：
     ① 那四份源码逐份过一遍语法（只查不拼 —— 拼进顶层会和产物本身撞名）；
     ② 那颗产物和源码还对不对得上 —— 对不上就是改了源码没重跑那一趟，旧字会悄悄进页。
   比对不在这儿重算一遍拼法（拼法归那一棵的 build-kernel.mjs 管，抄第二份必然对不上口径），
   直接叫它自己的 --比，退出码就是答案。 */
const 定制棵 = path.join(ROOT, 'src/_wcustom/build-kernel.mjs');
const 定制产物 = path.join(ROOT, 'src/_wcustom/wnw-custom-kernel.js');
const 定制在 = fs.existsSync(定制产物);
const 定制名单 = fs.existsSync(定制棵) ? grab(fs.readFileSync(定制棵, 'utf8'), 'const PARTS = [').map(names) : [];
for(const p of 定制名单) 查('组件定制/' + p, fs.readFileSync(path.join(ROOT, 'src/_wcustom/src', p), 'utf8'));
let 定制新 = false, 定制话 = '';
try{ execFileSync(process.execPath, [定制棵, '--比'], {stdio:'pipe'}); 定制新 = true; }
catch(e){ 定制话 = String((e.stdout && String(e.stdout)) || (e.stderr && String(e.stderr)) || e.message).split(/\r?\n/)[0]; }
console.log(!定制在 ? '✗ 组件定制那颗产物不在：跑 node src\\_wcustom\\build-kernel.mjs'
  : 定制新 ? '✓ 组件定制内核产物是最新的（' + Buffer.byteLength(fs.readFileSync(定制产物)) + ' 字节 · ' + 定制名单.length + ' 份源码）'
  : '✗ 组件定制内核产物落后于源码：跑 node src\\_wcustom\\build-kernel.mjs —— ' + 定制话);

add(boot, read(boot));

console.log(fail.length ? '逐份语法：' + fail.length + ' 份不过\n' + fail.join('\n')
  : '逐份语法：' + (parts.length + wnw.length + 定制名单.length + 2) + ' 份全过');
let wholeErr = '';
try{ new vm.Script(js, { filename:'整页' }); }catch(e){ wholeErr = e.message; }
console.log(wholeErr ? '整页拼起来语法不过：' + wholeErr : '整页拼起来语法过（顶层作用域一份、为写闭包一份，接得上）');

/* 顶层名字有没有谁没定义就被用：抽三家共用层和为写闭包引用的那几个名字查一遍 */
const top = new Set();
for(const m of js.matchAll(/^(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) top.add(m[1]);
for(const n of ['randInt', 'pickOne', 'shuffle', 'idbOpen', 'idbRun', 'reasonOf', 'IDB', 'IDB_MS',
  'accentSlotVars', 'shClockPad', 'shTtmlClock', 'shLrcClock', 'shLrcStamp', 'markVar'])
  console.log((top.has(n) ? '✓ 顶层有 ' : '✗ 顶层缺 ') + n);
/* 那一句号的闸在上面（有那一句），产物在不在看 盘上 */
process.exit(fail.length || wholeErr || !盘上 || !新 || !定制在 || !定制新 || !有那一句 ? 1 : 0);
