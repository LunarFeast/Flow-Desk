/* ============================================================
   Flow-Desk 更新包打包（第 16 条 · 甲案）

   出一个 zip：装的那一份是 src\pack\updater.cjs，它只认这个脚本出的形状。
     用法  node src/pack/build-update.mjs            日常包（页面层 + resources\app）
           node src/pack/build-update.mjs --runtime  整包（外加运行时：dll、pak、locales、一个 exe）
           后面再加 --dry 就只报清单和体积，不落盘
     产物  Flow-Desk\update\packages\FlowDesk_update_<fd>_<时间戳>.zip

   一条红线：包里永远不放 data\ 里的任何东西 —— 用户写的书、改过的功能模块、两份自建词库、
   userdata-* 都在那边，更新机制的设计前提就是它一个字节的覆盖都不会发生（第 15 条分树就是为了这个）。
   所以这个脚本只从 pages\ 和 resources\app\ 取东西；--runtime 带的那几个文件也都是程序自己的文件。

   zip 不引第三方库：本地文件头、中央目录、目录尾部三段手写，全 deflate（读的那份只认 存储 和 deflate）。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
/* 出厂镜像那一层和出包共用一份（mirror.mjs）：两边各写一遍就会有一边忘了改 */
import { apply as layMirror, plan as mirrorPlan, refuseRunning, MIRROR } from './mirror.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.FD_TREE || path.resolve(HERE, '..', '..');   /* Flow-Desk\ 那一层 */
const RUNTIME = process.argv.includes('--runtime');
const DRY = process.argv.includes('--dry');
const STAMP = (() => {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
})();

/* 出包脚本和 _build/tree.cjs 一把尺：树里是 pages 还是没改名的 页面 都认（改名由程序开机做，
   Flow-Desk 正开着的时候改不动，所以出包时可能还撞上老名字）。装的那份只认英文名，不留后门。 */
const pickL = list => { for(const p of list){ if(fs.existsSync(p)) return p; } return list[0]; };
const PAGES = pickL([path.join(OUT, 'pages'), path.join(OUT, '页面')]);
const APP = MIRROR;                       /* 和出包同一格：resources\app，别再各算一遍路径 */
const PK_DIR = path.join(pickL([path.join(OUT, 'update'), path.join(OUT, '更新')]), 'packages');

/* ---------- 打更新包之前先把出厂镜像铺齐（外20）----------
   为什么要在这儿动手：下面 addLayer 是把 resources\app 整层塞进包里送出去的。那一层过去只有
   build-app.mjs（出包）会刷，所以"没出包就打包"送出去的是上一次出包那天的旧镜像 ——
   2026-10-06 量到过一次：镜像里 main.cjs 停在前一天 08:51、界面文字清单少 96 行、
   监听脚本比原件少 1,781 字节，而装了这包的机器读的就是那一份旧代码，一句错都不报
   （那句里的「恢复出厂」外43 起不再走这一层了 —— 插件一家都不进程序包，原版改在导入那一下留进
   data\plugins-factory\；这一层剩下的还是主进程、界面文字清单、图标那几份）。
   他给的口径是「出厂备份最多比运行版本落后一轮」，所以这一趟必须先对齐再收集清单。
   --dry 只比不写（把差在哪报出来），其余情况真铺；铺完 checkShellRequires 那道闸跟着一起跑。 */
if(DRY){
  const p = mirrorPlan();
  const off = p.stale.length + p.missing.length;
  console.log('（--dry 没铺镜像）出厂镜像 ' + p.sameCount + ' 份和源一致' +
    (off ? ' · ' + off + ' 份落后或缺：\n  ' + [...p.stale, ...p.missing].join('\n  ') : ' · 一份不差'));
  if(p.extra.length) console.log('  镜像里多出来的：\n  ' + p.extra.join('\n  '));
} else {
  refuseRunning('打更新包（build-update.mjs）');
  console.log('先铺出厂镜像 ' + APP);
  for(const line of layMirror()) console.log(line);
}

/* 版本号按数字段比大小：1.0.10 比 1.0.4 大，照字符串比会挑错那份（到 10 那一档就翻车）。
   底下「只带最新那份」那段用的是同一把尺，别各写一套。 */
function verNum(raw){ return raw.split(/[^\d]+/).filter(Boolean).map(Number); }
function cmpVer(a, b){ for(let i = 0; i < Math.max(a.length, b.length); i++){ const d = (a[i] || 0) - (b[i] || 0); if(d) return d; } return 0; }
/* 版本号从 pages\ 的文件名里取（Flow-Desk 这一张页：1.4.0-dev.3 这种，尾巴 -dev 是还在开发中，
   最后那一段是生成流水号 —— 号写在 src\_build\version.json，别处只从文件名倒着取） */
function verIn(dir, pre, suf){
  let best = null;
  try{
    for(const n of fs.readdirSync(dir)){
      if(!n.startsWith(pre) || !n.endsWith(suf)) continue;
      const raw = n.slice(pre.length, -suf.length);
      const v = verNum(raw);
      if(!best || cmpVer(v, best.v) > 0) best = { raw, v };
    }
  }catch(e){}
  return best ? best.raw : '';
}
/* 版本号从 pages\ 的文件名里取（双段：1.4.0-dev.3 这种，前段程序版本、后段生成流水号）。
   只有 Flow-Desk 这一张页了：声笔输入法练习的代码拼在它里面，不再出独立页面。 */
const VERSIONS = { fd: verIn(PAGES, 'Flow_Desk_', '.html') };

/* ---------- pages\ 里只带最新那份 ----------
   这一层躺着历史产物（1.1.1 / 1.1.2 / 1.1.3…），一股脑塞进包里就是白背 11MB 老 html。
   口径和 publish.mjs 一把尺：版本号按数字段比大小，最新的留下，help.md 和别的一律照带。 */
const ARTIFACT = { '': 'Flow_Desk_' };
const newest = new Map();
for(const [sub, pre] of Object.entries(ARTIFACT)){
  const dir = sub ? path.join(PAGES, sub) : PAGES;
  let best = null;
  try{
    for(const n of fs.readdirSync(dir)){
      if(!n.startsWith(pre) || !n.endsWith('.html')) continue;
      const v = verNum(n.slice(pre.length, -'.html'.length));
      if(!best || cmpVer(v, best.v) > 0) best = { name: n, v };
    }
  }catch(e){}
  if(best) newest.set(pre, best.name);
}
function skipOldPage(rel){
  const i = rel.lastIndexOf('/');
  const dir = i < 0 ? '' : rel.slice(0, i + 1), n = i < 0 ? rel : rel.slice(i + 1);
  for(const [sub, pre] of Object.entries(ARTIFACT)){
    if(dir !== sub) continue;
    if(!n.startsWith(pre) || !n.endsWith('.html')) continue;
    return n !== newest.get(pre);
  }
  return false;
}

function walk(dir, base){
  const out = [];
  base = base || '';
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const rel = base ? base + '/' + e.name : e.name;
    if(e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

/* ---------- 要装进包的文件清单：包内路径 → 磁盘路径 ---------- */
const files = new Map();
function addLayer(pre, dir, skip){
  if(!fs.existsSync(dir)) throw new Error('没有这一层：' + dir);
  for(const rel of walk(dir)){
    const abs = path.join(dir, ...rel.split('/'));
    if(skip && skip(rel)) continue;
    files.set(pre + rel, abs);
  }
}
addLayer('flow-desk/pages/', PAGES, skipOldPage);
addLayer('flow-desk/resources/app/', APP);
/* resources\app\pages 和 data 是兜底副本，跟着 app 层一起进包（形状和树里一模一样） */

if(RUNTIME){
  const rootFiles = fs.readdirSync(OUT).filter(n => {
    const p = path.join(OUT, n);
    if(!fs.statSync(p).isFile()) return false;
    /* 只带程序自己的散文件：dll / pak / bin / dat / icu / LICENSE / version 这一类，
       他扔在根上的脚本、日志、说明一律不进包 */
    return /\.(dll|pak|bin|dat|exe|icd|json|txt)$/i.test(n) || n === 'LICENSE' || n === 'version';
  }).filter(n => {
    if(/relocate|restructure|README/i.test(n)) return false;
    if(n === 'vk_swiftshader_icd.json') return true;
    return !/\.json$|\.txt$/i.test(n) || n === 'version';
  });
  for(const n of rootFiles) files.set('flow-desk/runtime/' + n, path.join(OUT, n));
  /* 根上就那一颗 exe（Flow-Desk.exe），和运行时是同一段字节的门牌：整层带着走，不再挑名字删谁 */
  /* locales 是运行时自带的语言包；根上的 icons\ 不带 —— 那一层是给用户换的（自带的在 resources\app\icons 里，
     已经跟着 app 层进包了），整层覆盖不许吃到用户自己换的图 */
  for(const dir of ['locales']){
    const d = path.join(OUT, dir);
    if(fs.existsSync(d)) addLayer('flow-desk/runtime/' + dir + '/', d);
  }
}

/* ---------- 先看清单再打包：整包要背一个 exe 和 locales，不划算就别真打 ----------
   node src/pack/build-update.mjs --runtime --dry */
if(DRY){
  let n = 0, bytes = 0, rt = 0, rtBytes = 0;
  for(const [name, abs] of files){
    const s = fs.statSync(abs).size; n++; bytes += s;
    if(name.startsWith('flow-desk/runtime/')){ rt++; rtBytes += s; }
  }
  console.log('（没打包）' + n + ' 个文件 · 展开 ' + (bytes / 1048576).toFixed(1) + 'MB' +
    (RUNTIME ? ' · 其中运行时 ' + rt + ' 个 · ' + (rtBytes / 1048576).toFixed(1) + 'MB' : ''));
  console.log('版本 ' + JSON.stringify(VERSIONS));
  process.exit(0);
}

/* ---------- zip：本地头 + 数据 + 中央目录 + 尾部，全 deflate ---------- */
const CRC = (() => { const t = new Int32Array(256);
  for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t; })();
function crc32(u){ let c = -1; for(let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function dosTime(d){ return (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); }
function dosDate(d){ return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); }

/* 标记也进包：写在最前面，读的人一眼就知道这是给哪棵树、哪一版用的 */
const marker = {
  kind: 'flow-desk-update',
  made: new Date().toISOString(),
  versions: VERSIONS,
  parts: RUNTIME ? ['pages', 'app', 'runtime'] : ['pages', 'app'],
  files: files.size,
  note: '装这一包的程序：Flow-Desk 设置 → 程序 → 本地更新。data\\ 从不参与更新。'
};
const entries = [{ name: 'update-marker.json', buf: Buffer.from(JSON.stringify(marker, null, 2) + '\n', 'utf8') }];
for(const [name, abs] of files){
  const buf = fs.readFileSync(abs);
  entries.push({ name, buf, mtime: fs.statSync(abs).mtime });
}
const bodies = entries.map(e => ({ name: e.name, method: 8, raw: e.buf,
  packed: zlib.deflateRawSync(e.buf, { level: 6 }), crc: crc32(e.buf),
  time: dosTime(e.mtime || new Date()), date: dosDate(e.mtime || new Date()) }));

fs.mkdirSync(PK_DIR, { recursive: true });
const zipPath = path.join(PK_DIR, 'FlowDesk_update_' + VERSIONS.fd + '_' + STAMP + '.zip');
const fd = fs.openSync(zipPath, 'w');
let off = 0; const central = [];
for(const b of bodies){
  const nameBuf = Buffer.from(b.name, 'utf8');
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
  lh.writeUInt16LE(b.method, 8); lh.writeUInt16LE(b.time, 10); lh.writeUInt16LE(b.date, 12);
  lh.writeUInt32LE(b.crc, 14); lh.writeUInt32LE(b.packed.length, 18); lh.writeUInt32LE(b.raw.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
  fs.writeSync(fd, lh); fs.writeSync(fd, nameBuf); fs.writeSync(fd, b.packed);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0, 8); ch.writeUInt16LE(b.method, 10); ch.writeUInt16LE(b.time, 12); ch.writeUInt16LE(b.date, 14);
  ch.writeUInt32LE(b.crc, 16); ch.writeUInt32LE(b.packed.length, 20); ch.writeUInt32LE(b.raw.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(off, 42);
  central.push({ ch, nameBuf });
  off += 30 + nameBuf.length + b.packed.length;
}
let cdOff = off, cdSize = 0;
for(const c of central){ fs.writeSync(fd, c.ch); fs.writeSync(fd, c.nameBuf); cdSize += 46 + c.nameBuf.length; }
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(central.length, 8); eocd.writeUInt16LE(central.length, 10);
eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(cdOff, 16);
fs.writeSync(fd, eocd);
fs.closeSync(fd);

console.log('WROTE ' + zipPath + '  ' + fs.statSync(zipPath).size + ' bytes  (' +
  (fs.statSync(zipPath).size / 1048576).toFixed(1) + ' MB)');
console.log('  层：' + marker.parts.join(' + ') + ' · 文件 ' + entries.length + ' 个 · 装完是 Flow-Desk ' + VERSIONS.fd);
console.log('  data\\ 不在包里（' + path.join(OUT, 'data') + ' 一个字节都没读）');
