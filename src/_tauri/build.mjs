/* Flow-Desk 的 Tauri 壳 · 编译入口（外46）
   ------------------------------------------------------------
     node src/_tauri/build.mjs              编 release（GNU 三元组）
     node src/_tauri/build.mjs --debug      编 debug（快，看编译错够不够用）
     node src/_tauri/build.mjs --检查       只跑 cargo check（不出产物，最省时间）

   为什么要有这一颗，而不是直接喊 cargo：这台机器上这三样必须一起设对，少一样就翻车 ——
     · RUSTUP_HOME / CARGO_HOME 指到 D:\Rust，否则 rustup 按默认往 C 盘下一整套装具（2026-10-10 踩过，2.8 GB）；
     · PATH 前面要放一套**齐的** mingw binutils：windows-sys / windows-result 这些走 raw-dylib 要 dlltool，
       而 rustup 那套只把它单独放在 self-contained 格里，缺 as / ld 同伴照样干活失败；
     · 三元组必须是 x86_64-pc-windows-gnu：微软那条路这台机器堵死（没有 link.exe，Git 又自带一个同名的 link 抢在前面）。
   编完报产物在哪、多大。不推不发布，也不起窗口（起程序验不是我干的活）。 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const DEBUG = argv.includes('--debug');
const CHECK = argv.includes('--检查');

/* 这三处位置是这台机器的事，写在一个不进仓的地方读 —— 跟 src\tools\本地路径.cjs 同一待遇；
   那份还没登记 Tauri 这一格，所以先退回这几个默认值，量不出来就报清楚，别猜。 */
/* 这三颗位置从 src	ools本地路径.mjs 那一道取（它读不进仓的那份登记），这一份里不钉任何字面路径 ——
   钉了就把这台机器的盘符推到公开面上去了（外41 第五段那条规矩）。取不到就报清楚，别猜。 */
const { Rust工具链, Rust包缓存, Rust链接件 } = await import('../tools/本地路径.mjs');
const RUST_HOME = process.env.RUSTUP_HOME || Rust工具链;
const CARGO_HOME = process.env.CARGO_HOME || Rust包缓存;
const GNU = RUST_HOME ? path.join(RUST_HOME, 'toolchains', 'stable-x86_64-pc-windows-gnu', 'bin') : '';
const MINGW = process.env.FD_MINGW || Rust链接件;
if(!GNU || !MINGW){ console.error('编不了：本地那份登记里没写 Rust 那三颗位置（Rust工具链 / Rust包缓存 / Rust链接件），或者环境变量没给。'); process.exit(1); }

const 缺 = [GNU, MINGW].filter(d => !fs.existsSync(d));
if(缺.length){ console.error('这几格找不到，编不了（要装 Rust 的 GNU 那套和一套齐的 mingw binutils）：\n  ' + 缺.join('\n  ')); process.exit(1); }

const env = {
  ...process.env,
  RUSTUP_HOME: RUST_HOME,
  CARGO_HOME,
  PATH: [MINGW, GNU, path.join(CARGO_HOME, 'bin'), process.env.PATH].join(path.delimiter),
};
const 活 = CHECK ? 'check' : 'build';
const 参 = [活, ...(CHECK ? [] : ['--release']), '--target', 'x86_64-pc-windows-gnu'];
console.log('cargo ' + 参.join(' ') + '\n  壳在 ' + HERE + '\n  binutils 取 ' + MINGW);
const r = spawnSync('cargo', 参, { cwd: HERE, env, stdio: 'inherit' });
if(r.status !== 0) process.exit(r.status || 1);
if(CHECK){ console.log('check 过了（没出产物）'); process.exit(0); }
const exe = path.join(HERE, 'target', 'x86_64-pc-windows-gnu', DEBUG ? 'debug' : 'release', 'flowdesk.exe');
try{ console.log('产物 ' + exe + ' · ' + fs.statSync(exe).size.toLocaleString('en-US') + ' 字节'); }
catch(e){ console.log('说编完了，可在 ' + exe + ' 没找到那颗 exe —— 报一下，别当成功'); process.exit(1); }
