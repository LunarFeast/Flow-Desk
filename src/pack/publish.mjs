/* ============================================================
   Flow-Desk 发布：一条命令出三份产物
   ------------------------------------------------------------
     node src/pack/publish.mjs                插件 + 货架清单 + 首装那个 exe（全套）
     node src/pack/publish.mjs --packs        只压包和清单（不动壳，快得多）
     node src/pack/publish.mjs --zip          额外留一份不套壳的 payload zip（自测、看清单用）
     node src/pack/publish.mjs --dry          只报清单和体积，不落盘
     node src/pack/publish.mjs --skip=zzprobe  本地试用的那个包别进发布物（逗号分隔）
     node src/pack/publish.mjs --out=<目录>   产物落到别处（默认 Flow-Desk\dist）

   三份产物：
     dist\plugins\<id>.zip                     一个包一包，货架上摆的零卖货（解开文件夹 → 压平，说明书重新序列化一遍）
     dist\index.json                              货架清单：每个包的名字/版本/大小/最低外壳版本/图标/作者来源，页面里挂货架就读它
     dist\Flow_Desk_setup_<fd>.exe                首装那一个：Windows 自带的 csc 编出来的小壳 + 粘在屁股后面这一整棵树的出厂内容

   这一棵树里进发布物的、和不进的，口径写死在下面几段：
     进：运行时（跟 electron dist 同名的那批 + 一个 exe + locales）、resources\app 那一层、
         pages\ 只留 Flow-Desk 版本号最大的那一份和非产物文件、
         src\（重新生成页面要用，node_modules 不带）、data\plugins\ 里出厂的那些包
     不进：data\ 里除了插件的一切（用户写的书、词库副本、userdata-*、日志 —— 私密，也不该跟着版本走）、
           update\（那是一台机器自己的更新账）、根上 icons\（给用户换的，自带的在 resources\app\icons 里能长回来）、
           plugins 里名单（off.json）和出厂那一层没有的散件、
           老版本的 html（用户那棵树里想留几份留几份，发布物只带当前这一版）
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan as packScan, writeZip } from '../_build/packs.mjs';
import { assertClean } from '../_build/scan-packs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TREE = process.env.FD_TREE ? path.resolve(process.env.FD_TREE) : path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = f => argv.some(a => a === f || a.startsWith(f + '='));
const val = (f, d) => { const a = argv.find(x => x.startsWith(f + '=')); return a ? a.slice(f.length + 1) : d; };
const DRY = has('--dry');
const PACKS_ONLY = has('--packs') || has('--no-exe');
const KEEP_ZIP = has('--zip');
const SKIP = new Set(val('--skip', '').split(',').map(s => s.trim()).filter(Boolean));
/* 三层名字跟着生成页面那把尺：树里可能还是没改完名的老样子 */
const pickL = list => { for(const p of list){ if(fs.existsSync(p)) return p; } return list[0]; };
const PAGES = pickL([path.join(TREE, 'pages'), path.join(TREE, '页面')]);
const DATA = pickL([path.join(TREE, 'data'), path.join(TREE, '数据')]);
const APP = path.join(TREE, 'resources', 'app');
const PACKS_DIR = path.join(DATA, 'plugins');
const OUT_DIR = path.resolve(val('--out', path.join(TREE, 'dist')));
const EXE_NAME = 'Flow-Desk.exe';

/* ---------- 版本号：和 build-app.mjs / build-update.mjs 同一个取法，各写各的谁也不碰谁 ---------- */
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
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function cmpVer(a, b){ for(let i = 0; i < Math.max(a.length, b.length); i++){ const d = (a[i] || 0) - (b[i] || 0); if(d) return d; } return 0; }
function verNum(raw){ return raw.split(/[^\d]+/).filter(Boolean).map(Number); }
function pickLatest(dir, pat){
  if(!fs.existsSync(dir)) return null;
  const re = new RegExp('^' + pat.split('*').map(esc).join('([\\d][\\w.+-]*)') + '$');
  let best = null;
  for(const n of fs.readdirSync(dir)){
    const m = n.match(re); if(!m) continue;
    const raw = m.slice(1).join('-'), v = verNum(raw);
    const c = best ? cmpVer(v, best.v) : 1;
    if(c > 0 || (c === 0 && raw > best.raw)) best = { f: path.join(dir, n), v, raw };
  }
  return best ? best.f : null;
}
function verOf(p, prefix){ return p ? path.basename(p).slice(prefix.length, -'.html'.length) : ''; }
/* 只有 Flow-Desk 这一个版本号：为写和声笔输入法练习的代码都拼在这一张页里，各自不再出独立页面 */
const VER = { fd: verOf(pickLatest(PAGES, 'Flow_Desk_*.html'), 'Flow_Desk_') };
/* 版本号最大的那一份是产物里当前的版本，其余的老版本不进发布物 */
const LATEST = new Set([pickLatest(PAGES, 'Flow_Desk_*.html')].filter(Boolean).map(p => path.resolve(p)));
function superseded(rel){
  if(!/\.html$/.test(rel)) return false;
  const n = rel.split('/').pop();
  if(!/^Flow_Desk_/.test(n)) return false;
  return !LATEST.has(path.resolve(path.join(PAGES, ...rel.split('/'))));
}

/* ---------- 这一棵树里哪些文件进发布物 ---------- */
const files = new Map();      /* 包内路径（/ 分隔）→ 磁盘路径 */
const made = new Map();       /* 现生成的那几份：包内路径 → Buffer */
function addLayer(pre, dir, skip){
  if(!fs.existsSync(dir)) throw new Error('没有这一层：' + dir);
  for(const rel of walk(dir)){
    if(skip && skip(rel)) continue;
    files.set(pre + rel, path.join(dir, ...rel.split('/')));
  }
}
const inNodeModules = rel => rel.split('/').includes('node_modules');

/* 一、运行时：根上那批跟 electron dist 同名的散文件（dll / pak / bin / dat / icu / LICENSE / version）。
   dist 在就照它那一份名单取（最准）；不在（用户那棵树里本来就没有）就退回按扩展名认。 */
const DIST = path.join(HERE, 'node_modules', 'electron', 'dist');
let distNames = null;
try{ distNames = new Set(fs.readdirSync(DIST).filter(n => fs.statSync(path.join(DIST, n)).isFile())); }catch(e){}
function isRuntime(n){
  if(distNames) return distNames.has(n) && n !== 'electron.exe';
  return /\.(dll|pak|bin|dat|icd\.json)$/i.test(n) || n === 'LICENSE' || n === 'version';
}
for(const n of fs.readdirSync(TREE)){
  const abs = path.join(TREE, n);
  if(!fs.statSync(abs).isFile()) continue;
  if(isRuntime(n)) files.set(n, abs);
}
/* 一个 exe 是整棵树唯一的门牌：为写和声笔输入法练习都在 Flow-Desk 那一张页里就地开，
   发布物里不再带它们的独立页面（要重新生成页面的机器上自己跑 node src/_fd/build.mjs） */
if(!fs.existsSync(path.join(TREE, EXE_NAME))) throw new Error('根上没有 ' + EXE_NAME + '，先跑 node src/pack/build-app.mjs');
files.set(EXE_NAME, path.join(TREE, EXE_NAME));
for(const d of ['locales']){
  const p = path.join(TREE, d);
  if(fs.existsSync(p)) addLayer(d + '/', p);
}
/* 二、app 层：外壳读的那一份代码 + 自带的兜底页面/数据 + 默认图标，整层跟着走 */
addLayer('resources/app/', APP);
/* 三、页面层：当前这一版 + 帮助明文这些非产物 */
addLayer('pages/', PAGES, rel => superseded(rel));
/* 四、源码：重新生成页面要读的（node_modules 一个字节都不带 —— 生成页面只用 node 自带模块） */
addLayer('src/', path.join(TREE, 'src'), rel => inNodeModules(rel) || /(^|\/)\.[^/]/.test(rel));
/* 五、插件：只放进厂的那一格。名单、包外散配方、覆盖副本都不带 ——
   没有 off.json 意味着新树第一次打开一家都没卸，这就是出厂样子。 */
/* 出货之前再过一遍越界这道门（和两个构建同一把尺）：货架上发的源码是要给别人看的，
   组件和主程序之间只能有接口调用，不能有内部耦合。 */
if(!assertClean(PACKS_DIR, '发插件')){ console.error('插件越界没清完，publish 停下。'); process.exit(1); }
const packs = packScan(PACKS_DIR).filter(p => !SKIP.has(p.id));
for(const p of packs){
  if(p.error){ console.log('  ! 包 ' + p.id + ' 说明书读不成：' + p.error); continue; }
  if(p.kind === 'zip'){ files.set('data/plugins/' + p.id + '.zip', p.path); continue; }
  for(const [name, buf] of p.files) made.set('data/plugins/' + p.id + '/' + name, buf);
}

/* ---------- 货架：一个包压成一包 zip，清单里写清它是什么来路 ---------- */
function packZip(p){
  const m = p.manifest;
  const names = Array.from(p.files.keys()).sort();
  if(!names.includes('manifest.json')) throw new Error('包 ' + p.id + ' 里没有 manifest.json');
  const entries = names.map(name => ({
    name,
    /* 说明书按发布这份重序列化一遍：字段顺序、缩进都定下来，压出来的包字节可复现 */
    data: name === 'manifest.json'
      ? Buffer.from(JSON.stringify(m, null, 2) + '\n', 'utf8')
      : p.files.get(name)
  }));
  return writeZip(entries);
}
const shelf = [];
for(const p of packs){
  if(p.error) continue;
  const buf = packZip(p);
  const m = p.manifest;
  shelf.push({
    id: m.id, name: m.name, version: m.version, desc: m.desc || '',
    author: m.author || '', source: m.source || '', icon: m.icon || '',
    host: m.host || ['fd'], order: m.order || 100, minShell: m.minShell || '0',
    file: 'plugins/' + m.id + '.zip',
    bytes: buf.length, size: (buf.length / 1024).toFixed(1) + ' KB',
    bank: m.bank || null, sharedKeys: m.sharedKeys || [], dataKeys: m.dataKeys || [], kvKeys: m.kvKeys || [],
    /* 这个包自己带的随行文件（监听脚本、桥插件那种），货架上照着摆，用户才知道装它要多拿几份 */
    assets: m.assets || {},
    files: Array.from(p.files.keys()).sort()
  });
  if(!DRY){ fs.mkdirSync(path.join(OUT_DIR, 'plugins'), { recursive: true }); fs.writeFileSync(path.join(OUT_DIR, 'plugins', m.id + '.zip'), buf); }
}
shelf.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
const minShell = shelf.reduce((a, x) => (!a || cmpVer(verNum(x.minShell), verNum(a)) > 0 ? x.minShell : a), '') || VER.fd;
const index = {
  kind: 'flow-desk-shelf',
  made: new Date().toISOString(),
  shell: { fd: VER.fd, minShell: minShell },
  setup: { file: 'Flow_Desk_setup_' + VER.fd + '.exe', bytes: 0, size: '' },
  packs: shelf,
  note: '货架清单：dist\\plugins\\<id>.zip 是零卖的插件，导入用；setup 那一个是首装整棵树。data\\ 里的用户内容从不参与发布。'
};

/* ---------- 树根上现生成的两份：给人看的说明 + 给壳读的那个标记 ---------- */
const label = 'Flow-Desk 便携版 ' + VER.fd;
made.set('flow-desk-install.json', Buffer.from(JSON.stringify({
  kind: 'flow-desk-tree', label: label, made: new Date().toISOString(),
  versions: VER, packs: shelf.map(p => p.id),
  note: '这一棵树是首装摊出来的：整文件夹删掉就算卸载，不写注册表。升级走 设置 → 程序 → 本地更新。'
}, null, 2) + '\n', 'utf8'));
made.set('安装说明.txt', Buffer.from([
  'Flow-Desk · 便携版（首装）',
  '========================================',
  '',
  '双击 Flow-Desk.exe 就开，不用安装，也不依赖系统里装了什么别的程序。',
  '整个文件夹可以随便改名、挪到别的盘、拷到别的电脑：程序和用户数据分两层放着，路径全按这个文件夹的相对位置找。',
  '',
  '  pages\\    程序读的那一张页面（换新版本见下面「更新」）',
  '  data\\     你自己长出来的东西，更新永远不会碰这一层：',
  '            <书名>\\（正文和它的历史快照）、plugins\\（改过的功能模块和出厂的插件）、',
  '            gen-log\\（生成记录）、<包名>-bank\\（组件自带的词库）、help.md（帮助的工作副本）、logs\\（运行日志）',
  '  update\\   更新那一摊自己待着：packages\\（更新包）、backups\\（每趟装之前的旧层）、result.txt（成没成的账）',
  '  src\\      Flow-Desk 自己的源码：只有改了它才需要重新生成页面（功能模块不在这里，装卸和改功能代码都不用这一趟）',
  '',
  '功能都是一个一个可选的组件，不要就能卸掉，卸掉还能装回来：',
  '  顶栏的 ＋（添加插件）里，每一个都有「装上 / 卸掉 / info」。',
  '  卸掉 = 下一次开机不再加载它那一份代码（改名单 + 刷新这一页），不是藏起来；勾选「同步清除数据」才会连它存的词库和记录一起清。',
  '  别人给你的插件（<id>.zip 或解开的文件夹）在同一个按钮「导入插件」里挑，导入即装上。',
  '  出厂带的那些包就住在 data\\plugins\\，随时装得回来。',
  '  每一个组件跑的就是 data\\plugins\\<它>\\main.js，改代码对话框里存了就用新的；',
  '  出厂原文另存一份在 resources\\app\\data\\plugins\\，改坏了点「恢复出厂」从那儿拷回来。',
  '',
  '更新：设置 → 程序 → 本地更新 里挑一个 FlowDesk_update_*.zip，它只换 pages\\ 和 resources\\app\\，',
  '旧的那份挪进 update\\backups\\<时间戳>\\，装完自动开新版；data\\ 一个字节都不动。',
  '',
  '图标：icons\\FD_Icon.png、WNW_Icon.png、RP_Icon.png，想换成自己的图就用同名正方形 PNG（256×256 起）覆盖它，重启后换成你的图。',
  '这一份发布物只带 Flow-Desk.exe 一个：写作和练习是从 FD 的启动卡里开的，页面跟着 pages\\ 走。',
  '',
  'MusicBee 的监听：它本体不往系统的媒体控件写东西，得给它装一个插件。',
  '  关掉 MusicBee，把 data\\plugins\\music-remote\\mb_FlowDesk.dll 拷到 <MusicBee>\\Plugins\\（同名就覆盖），再开 MusicBee。',
  '  音乐遥控器的卡片上也有那个「装插件」的钮。',
  '',
  '卸载：把整个 Flow-Desk 文件夹删掉就行，它不写注册表。',
  ''
].join('\r\n'), 'utf8'));

/* ---------- 体积先看一眼：整包里最肥的是那个 200MB 的 exe，不划算就别真打 ---------- */
let n = 0, bytes = 0;
for(const abs of files.values()){ n++; bytes += fs.statSync(abs).size; }
for(const buf of made.values()){ n++; bytes += buf.length; }
const packBytes = shelf.reduce((s, p) => s + p.bytes, 0);
console.log('发布清单：一棵树 ' + n + ' 个文件 · 展开 ' + (bytes / 1048576).toFixed(1) + 'MB' +
  ' · 货架 ' + shelf.length + ' 个包 · ' + (packBytes / 1024).toFixed(1) + ' KB');
console.log('  版本 ' + JSON.stringify(VER) + ' · 最低外壳 ' + minShell);
console.log('  产物在 ' + OUT_DIR);
if(DRY){
  console.log('（没落盘）' + (PACKS_ONLY ? '' : ' · 首装那个 = 壳 + 这一棵树的 zip，约 ' + (bytes / 1048576).toFixed(1) + 'MB 展开'));
  for(const p of shelf) console.log('  ' + p.id.padEnd(16) + (p.name + '').padEnd(12) + p.size.padStart(10) + ' · ' + p.host.join('/') + ' · ' + p.author + '/' + p.source);
  process.exit(0);
}

/* ---------- zip：整棵树那一包，边算边写，别把 200MB 的 exe 在内存里翻两份 ---------- */
const CRC = (() => { const t = new Int32Array(256);
  for(let i = 0; i < 256; i++){ let c = i; for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c; }
  return t; })();
function crc32(u){ let c = -1; for(let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function dosTime(d){ return (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); }
function dosDate(d){ return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); }
/* 大二进制压不动也不划算（那个 exe 自己就是压缩过的东西），按 1 档走个形式；其余 6 档 */
function levelOf(name, size){ return size > 20 * 1048576 ? 1 : 6; }

/* 写一整包：entries 里每项 { name, abs | buf }，落到 fd 的当前位置，返回写出的字节数 */
function writeZipTo(fd, entries){
  let off = 0; const central = [];
  for(const e of entries){
    const nameBuf = Buffer.from(e.name, 'utf8');
    const raw = e.buf ? e.buf : fs.readFileSync(e.abs);
    const packed = zlib.deflateRawSync(raw, { level: levelOf(e.name, raw.length) });
    const crc = crc32(raw);
    const st = e.buf ? null : fs.statSync(e.abs);
    const when = (st && st.mtime) || new Date();
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(dosTime(when), 10); lh.writeUInt16LE(dosDate(when), 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(packed.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    fs.writeSync(fd, lh); fs.writeSync(fd, nameBuf); fs.writeSync(fd, packed);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(dosTime(when), 12); ch.writeUInt16LE(dosDate(when), 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(off, 42);
    central.push(Buffer.concat([ch, nameBuf]));
    off += 30 + nameBuf.length + packed.length;
    if(off >= 0xFFFFFFFF) throw new Error('这一包超过 4GB，zip32 装不下：减点东西再发');
  }
  let cdSize = 0;
  for(const c of central){ fs.writeSync(fd, c); cdSize += c.length; }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length, 8); eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(cdSize, 12); eocd.writeUInt32LE(off, 16);
  fs.writeSync(fd, eocd);
  return off + cdSize + 22;
}

/* 条目排个定序：先树里读来的（按包内路径），再现生成的，同一路径不重复 */
const entries = [];
for(const [name, abs] of [...files].sort((a, b) => a[0] < b[0] ? -1 : 1)) entries.push({ name, abs });
for(const [name, buf] of [...made].sort((a, b) => a[0] < b[0] ? -1 : 1)){
  const i = entries.findIndex(e => e.name === name);
  if(i >= 0) entries.splice(i, 1);
  entries.push({ name, buf });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const TAG = VER.fd;
const tmp = path.join(OUT_DIR, '.payload-' + TAG + '.zip');
const zf = fs.openSync(tmp, 'w');
const zBytes = writeZipTo(zf, entries);
fs.closeSync(zf);
console.log('  树那一包 ' + (zBytes / 1048576).toFixed(1) + 'MB · ' + entries.length + ' 个文件（展开 ' + (bytes / 1048576).toFixed(1) + 'MB）');

if(KEEP_ZIP){
  const keep = path.join(OUT_DIR, 'Flow_Desk_payload_' + TAG + '.zip');
  fs.copyFileSync(tmp, keep);
  console.log('  不套壳那一份 ' + keep);
}
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');

/* ---------- 首装那个：壳（Windows 自带的 csc 现编，比 sfx.cs 旧才重编）+ 粘在后面的这一包 ---------- */
if(PACKS_ONLY){
  fs.rmSync(tmp, { force: true });
  console.log('写了 dist\\plugins\\*.zip 和 dist\\index.json（--packs：没出首装那个）');
  process.exit(0);
}
const CS = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const CS32 = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
const csc = fs.existsSync(CS) ? CS : fs.existsSync(CS32) ? CS32 : null;
const stubSrc = path.join(HERE, 'sfx.cs');
const stub = path.join(HERE, 'sfx-stub.exe');
if(!csc){
  console.log('  ! 这台机器没有 csc.exe（.NET Framework 4 自带的那个编译器），首装那个没出 —— 树那一包留在 dist\\Flow_Desk_payload_*.zip，加 --zip 就留住它');
  if(!KEEP_ZIP) fs.renameSync(tmp, path.join(OUT_DIR, 'Flow_Desk_payload_' + TAG + '.zip'));
  process.exit(0);
}
if(!fs.existsSync(stub) || fs.statSync(stub).mtimeMs < fs.statSync(stubSrc).mtimeMs){
  console.log('  编首装壳 sfx-stub.exe …');
  execFileSync(csc, ['-nologo', '-target:winexe', '-out:' + stub,
    '-r:System.Windows.Forms.dll', '-r:System.Drawing.dll', stubSrc], { cwd: HERE, stdio: 'pipe' });
}
const out = path.join(OUT_DIR, 'Flow_Desk_setup_' + TAG + '.exe');
const wfd = fs.openSync(out, 'w');
const stubBuf = fs.readFileSync(stub);
fs.writeSync(wfd, stubBuf);
/* 壳从末尾往回找 EOCD，再按目录里写的偏移倒推出这包从第几字节开始，所以前面垫多少都成 */
const rfd = fs.openSync(tmp, 'r');
const buf = Buffer.alloc(4 * 1048576);
let r, copied = 0;
while((r = fs.readSync(rfd, buf, 0, buf.length)) > 0){ fs.writeSync(wfd, buf, 0, r); copied += r; }
fs.closeSync(rfd); fs.closeSync(wfd);
fs.rmSync(tmp, { force: true });
if(!KEEP_ZIP) fs.rmSync(path.join(OUT_DIR, 'Flow_Desk_payload_' + TAG + '.zip'), { force: true });
index.setup.bytes = fs.statSync(out).size;
index.setup.size = (index.setup.bytes / 1048576).toFixed(1) + ' MB';
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log('WROTE ' + out);
console.log('  壳 ' + (stubBuf.length / 1024).toFixed(0) + 'KB + 树 ' + (copied / 1048576).toFixed(1) + 'MB = ' + index.setup.size);
console.log('  货架 ' + shelf.length + ' 个包在 dist\\plugins\\ · 清单 dist\\index.json');
console.log('  data\\ 的用户内容一个字节都没进包（除 ' + path.join('data', 'plugins') + ' 那一格）');
