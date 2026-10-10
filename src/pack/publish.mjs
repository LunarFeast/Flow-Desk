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
     dist\plugins\<id>.zip                     一个包一包，货架上摆的零卖货（解开文件夹 → 压平，插件清单重新序列化一遍）
     dist\index.json                              货架清单：每个包的名字/版本/大小/最低外壳版本/图标/作者来源，页面里挂货架就读它
     dist\Flow_Desk_setup_<fd>.exe                首装那一个：Windows 自带的 csc 编出来的小壳 + 粘在屁股后面这一整棵树的出厂内容

   这一棵树里进发布物的、和不进的，口径写死在下面几段：
     进：运行时（跟 electron dist 同名的那批 + 一个 exe + locales）、resources\app 那一层、
         pages\ 只带当前这一支号那一张（老版本一张都不带）和非产物文件、
         src\（重新生成页面要用，node_modules 不带）、
         data\plugins\<id>\ 与 data\plugins-factory\<id>\（外46：七家插件跟着本体一起出门，活的与原版各一份）
     不进：data\ 里除上面那两格以外的一切（用户写的书、词库副本、userdata-*、日志、这台机器的 off.json —— 私密，也不该跟着版本走）、
           update\（那是一台机器自己的更新账）、根上 icons\（给用户换的，自带的在 resources\app\icons 里能长回来）、
           老版本的 html（用户那棵树里想留几份留几份，发布物只带当前这一版）
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scan as packScan, writeZip } from '../_build/packs.mjs';
import { assertClean } from '../_build/scan-packs.mjs';
import { 号, 页名 } from '../_build/version.mjs';

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

/* ---------- 走目录、比版本号大小：这一份发布脚本到处在用。号本身从 _build/version.mjs 取，见下面 ---------- */
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
function cmpVer(a, b){ for(let i = 0; i < Math.max(a.length, b.length); i++){ const d = (a[i] || 0) - (b[i] || 0); if(d) return d; } return 0; }
/* 比大小只比 +build 之前那一段：短哈希不参与排序，它只负责认「是哪一笔提交」 */
function verNum(raw){ return String(raw).split('+')[0].split(/[^\d]+/).filter(Boolean).map(Number); }
/* 只有 Flow-Desk 这一个版本号：为写和声笔输入法练习的代码都拼在这一张页里，各自不再出独立页面。
   号只有一处真身（src\_build\version.mjs）—— 这一趟不再「从 pages\ 里挑号最大的那一张」：
   号从 1.4.0-dev 回跳到 1.0.0-alpha 之后，「最大」会挑回那张旧页，发布物就带着上上个版本出门了。 */
const VER = { fd: 号() };
const 当前页 = 页名(VER.fd);
if(!fs.existsSync(path.join(PAGES, 当前页)))
  throw new Error('pages\\ 里没有当前这一支号的页（' + 当前页 + '）—— 先跑 node src\\_fd\\build.mjs 生成，再来打包');
/* 每一家插件的版本由发布脚本传进来（各仓自己那一笔的短哈希那一串，见 src\_build\release.mjs）。
   插件清单里那一格 version 是老版本 —— 打包这一趟不写它也不取它（他 2026-10-10 定）。
   没传这一格（本地自己跑 publish 看清单）就照插件清单那一格摆。 */
const 递来的家 = (() => {
  const raw = String(process.env.FD_PLUGINS || '').trim();
  if(!raw) return null;
  try{ return JSON.parse(raw); }
  catch(e){ throw new Error('FD_PLUGINS 传进来的不是合法 JSON：' + e.message); }
})();

/* 当前这一支号那一张进发布物，其余老版本都不带 */
function superseded(rel){
  if(!/\.html$/.test(rel)) return false;
  const n = rel.split('/').pop();
  return /^Flow_Desk_/.test(n) && n !== 当前页;
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
/* 三、页面层：当前这一支号那一张页 */
addLayer('pages/', PAGES, rel => superseded(rel));
/* 四、源码：重新生成页面要读的（node_modules 一个字节都不带 —— 生成页面只用 node 自带模块） */
addLayer('src/', path.join(TREE, 'src'), rel => inNodeModules(rel) || /(^|\/)\.[^/]/.test(rel));
/* 五、插件：外46 起七家跟着本体一起进这一棵树（他 2026-10-10 定：取消发布物零插件）。
   活的铺到 data\plugins\<id>\、开机就能跑；原版铺到 data\plugins-factory\<id>\、「恢复出厂」取它。
   两格都取自下面「货架」那一段压零卖包的同一批字节（包内件），所以四处一个号、一份字节。
   卸没卸过那一格（off.json）不进包 —— 那是每台机器自己的状态，不在发布物里带。 */
/* 出货之前再过一遍越界这道门（和两个构建同一把尺）：货架上发的源码是要给别人看的，
   组件和主程序之间只能有接口调用，不能有内部耦合。 */
if(!assertClean(PACKS_DIR, '发插件')){ console.error('插件越界没清完，publish 停下。'); process.exit(1); }
const packs = packScan(PACKS_DIR).filter(p => !SKIP.has(p.id));

/* ---------- 货架：一个包压成一包 zip，清单里写清它是什么来路 ---------- */
/* 一个包里有哪些件（名字 → 字节）。货架压 zip 和首装那棵树铺插件两处都取这一里，
   所以零卖的包、树里活的那一份、树里原版那一份 —— 三处字节相同，不会各铺各的。 */
function 包内件(p, 用了号){
  const m = p.manifest;
  const names = Array.from(p.files.keys()).sort();
  if(!names.includes('manifest.json')) throw new Error('包 ' + p.id + ' 里没有 manifest.json');
  const entries = names.map(name => ({
    name,
    /* 插件清单按发布这一趟重序列化一遍：字段顺序、缩进都定下来，压出来的包字节可复现；
       版本号这一格换成发布脚本传进来的那一个 —— 源码里那一格是人手写的，不动它就永远老在原地，
       用户导入之后在「关于」里看到的就是上一个号。 */
    data: name === 'manifest.json'
      ? Buffer.from(JSON.stringify(Object.assign({}, m, { version: 用了号 }), null, 2) + '\n', 'utf8')
      : p.files.get(name)
  }));
  return entries;
}
function packZip(p, 用了号){ return writeZip(包内件(p, 用了号)); }
const shelf = [];
for(const p of packs){
  if(p.error) continue;
  const m = p.manifest;
  /* 发布脚本传进来的那一家自己的那一串优先；没传（单独跑 publish）才退回插件清单那一格 */
  const 出 = (递来的家 && 递来的家[m.id] && 递来的家[m.id].version) || m.version;
  const 件 = 包内件(p, 出);
  const buf = writeZip(件);
  shelf.push({
    id: m.id, name: m.name, desc: m.desc || '',
    version: 出,
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
  /* 外46（他 2026-10-10 定：取消发布物零插件）：这一家跟着本体一起进首装那一棵树，两格都铺 ——
     data\plugins\<id>\ 是开机就能跑的那一份，data\plugins-factory\<id>\ 是「恢复出厂」取的原版。
     版本号那一格用的就是上面传进来的那串，所以「关于」、零卖的包、树里活的、树里原版四处一个串。
     卸没卸过那一格（off.json）不进包：那是每台机器自己的状态。 */
  for(const e of 件){
    made.set('data/plugins/' + m.id + '/' + e.name, e.data);
    made.set('data/plugins-factory/' + m.id + '/' + e.name, e.data);
  }
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
  /* 每一家插件这一趟带的是哪一串号、它要的外壳最低是哪一号（发布脚本传进来的，不取插件清单那一格） */
  plugins: shelf.map(p => ({ id:p.id, name:p.name, version:p.version, 兼容外壳:p.minShell })),
  note: '这一棵树是首装摊出来的：整文件夹删掉就算卸载，不写注册表。插件跟着本体一起带（' + shelf.length + ' 家，活的在 data\\plugins\\，原版在 data\\plugins-factory\\），换新版本再双击一颗新的 setup 指到同一棵就是覆盖升级。'
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
  '            <书名>\\（正文和它的历史快照）、plugins\\（你装的插件和改过的代码）、',
  '            plugins-factory\\（导入那一下自动留的原版，「恢复出厂」取的就是这一格）、',
  '            gen-log\\（生成记录）、<包名>-bank\\（组件自带的词库）、logs\\（运行日志）',
  '  update\\   覆盖升级那一摊自己待着：backups\\（每一趟换下来的旧东西，照原样挪回去就还是上一版）',
  '  src\\      Flow-Desk 自己的源码：只有改了它才需要重新生成页面（功能模块不在这里，装卸和改功能代码都不用这一趟）',
  '',
  '这一份发布物带着插件（' + shelf.length + ' 家：' + shelf.map(p => p.name).join('、') + '）—— 本体和插件一起出门，开箱就有：',
  '  data\\plugins\\ 是开机就能跑的那一份；data\\plugins-factory\\ 是原版 —— 「改代码」改坏了点「恢复出厂」从那一格拷回来。',
  '再装一家新的（拿到的是 <id>.zip 或解开的文件夹）：',
  '  顶栏的 ＋（添加插件）→「导入插件」，挑那个压缩包或那个带插件清单的文件夹；',
  '  或者直接把那一格丢进 data\\plugins\\，重启一次软件就认（压缩包会当场摊开）。',
  '  导入的同一趟会往 data\\plugins-factory\\ 留一份原版，所以「改代码」改坏了有点「恢复出厂」拷回来。',
  '装卸都在这同一屏：每一家有「装上 / 卸掉 / info」。',
  '  卸掉 = 下一次开机不再加载它那一份代码（改名单 + 刷新这一页），不是藏起来；勾选「同步清除数据」才会连它存的词库和记录一起清。',
  '  每一个组件跑的就是 data\\plugins\\<它>\\main.js，改代码对话框里存了就用新的。',
  '',
  '更新：还是用这一颗 —— 下载新的 Flow_Desk_setup_<版本号>.exe，双击它、把目录指到这一棵上，点「覆盖升级」。',
  '它会先把要换的旧的挪进 update\\backups\\<时间戳>\\ 再摊新的：resources\\app\\ 整层挪（那一格里没有你写的东西），',
  'pages\\ 只换这一个包里带的那几个名 —— 你放在那一格里的稿子原地不动；data\\ 从头到尾一个字节不碰。',
  '这一棵正开着的时候它一个字节都不动，会让你先退干净（右下角托盘图标上右键 → 退出）。',
  '<id>.zip 那种包是给插件用的运输件，主程序换版用上面那一颗 exe。',
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

/* ---------- 一道硬闸：data\ 底下只许插件那两格跟着本体出门 ----------
   外46 之前这一道闸是「data\ 一个字节都不许进」；现在七家插件跟着本体走，放行的只有
   data\plugins\ 与 data\plugins-factory\ 两层。其余（用户写的书、词库副本、userdata-*、
   日志、这台机器卸没卸过的 off.json）进一个字节就当场停下 —— 那些是私密，也不该跟着版本走。 */
{
  const 放行 = k => k.startsWith('data/plugins/') || k.startsWith('data/plugins-factory/');
  const 全部 = [...files.keys(), ...made.keys()];
  const dirty = 全部.filter(k => (k === 'data' || k.startsWith('data/')) && !放行(k));
  if(dirty.length){
    console.error('首装那棵树里出现了数据层的格子（插件那两格之外一律不进）：\n  ' + dirty.slice(0, 12).join('\n  '));
    process.exit(1);
  }
  /* 正向再钉一条：货架上有几家，树里就得有每一家的两格 —— 漏铺一家就是用户装完少一个功能。 */
  const 缺 = shelf.filter(p => !made.has('data/plugins/' + p.id + '/manifest.json') || !made.has('data/plugins-factory/' + p.id + '/manifest.json'));
  if(缺.length){ console.error('插件没铺进首装那棵树：' + 缺.map(p => p.id).join('、')); process.exit(1); }
  console.log('  data\\ 那道闸过了：' + 全部.length + ' 份路径里落在 data\\ 底下的只有插件那两格 · ' + shelf.length + ' 家×两格齐');
}

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
console.log('  插件跟着本体走：' + shelf.length + ' 家在 data\\plugins\\（活的）与 data\\plugins-factory\\（原版）各一份 · 零卖的包另在 dist\\plugins\\ 那一格');
