'use strict';
/* ============================================================
   Flow-Desk 的自更新那一份（更新包 = 一个 zip，甲案）

   谁叫它：main.cjs 里「本地更新」那个按钮 —— 它把这一份用 detach 起来，自己退出。
   为什么非得退出去：要挪的 页面\ 和 resources\app\ 正被程序自己读着；
   带运行时的那种包还要挪三个 exe，所以那种情况下 main.cjs 先把这一份用临时目录里的
   一个拷贝来跑 —— 免得「正在搬的自己」把要搬的文件按在手里（Windows 不让挪正在跑的那个 exe）。

   就干四件事：
     ① 等三个程序真关干净（最多 30 秒，等不到就一个文件不动直接收工）
     ② 包里的东西解到 update\staging\<时间戳>\
     ③ 旧的 pages\、resources\app\（带运行时时还有那几个运行时文件和三个 exe）整体挪进
        update\backups\<时间戳>\，再把解出来的新文件挪到位 —— data\ 从头到尾一个字节不碰：
        解包之前先审一遍包，凡是路径里带 data 或 userdata 的条目直接判错停工
     ④ 起新版

   成败都留明文两处：update\result.txt（给人看的账）和 data\logs\<今天>.log（跟着三个工具那份日志排）。
   要回上一版：把 update\backups\<那一趟>\ 里的东西照原样挪回去就行，data 从来没被碰过。
   ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync, spawn } = require('child_process');

/* 根上只有一颗可执行文件：等它关干净、起新版、备份都认这一个名字。
   名字和 main.cjs 里 APP.label 那一格是同一个（外39 改成 Flow-Desk，和仓库名对齐）——
   这两处对不上，更新装完就会报「叫了两秒 新版没起」，因为找的是个不存在的文件名。 */
const EXE = 'Flow-Desk.exe';
const MARK = 'update-marker.json';
const ROOT_PRE = 'flow-desk/';                 /* 包里所有内容都挂这一层底下，别的路径一律不认 */
const LAYER_PRE = { pages: 'pages/', app: 'resources/app/', runtime: 'runtime/' };

function sleep(ms){
  try{ Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }catch(e){}
}
function stamp(d){
  d = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
/* 路径先归成 / 分隔再挑：.. 这种跳出去的、空段、带盘符的全算脏 */
function cleanName(n){
  const s = String(n || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
  if(!s || s.indexOf(':') >= 0) return null;
  const seg = s.split('/').filter(x => x && x !== '.');
  if(!seg.length || seg.some(x => x === '..')) return null;
  return seg.join('/');
}

/* ---------- zip：这一份只读不写（包由 src\pack\build-update.mjs 出）---------- */
function zipIndex(buf){
  let eocd = -1;
  for(let i = buf.length - 22; i >= 0; i--){ if(buf.readUInt32LE(i) === 0x06054b50){ eocd = i; break; } }
  if(eocd < 0) throw new Error('读不出目录：这不是一个 zip，或者尾部被截断了');
  const n = buf.readUInt16LE(eocd + 10);
  if(!n) throw new Error('这个包里一个文件都没有');
  const items = [];
  let off = buf.readUInt32LE(eocd + 16);
  for(let k = 0; k < n; k++){
    if(buf.readUInt32LE(off) !== 0x02014b50) throw new Error('zip 目录第 ' + (k + 1) + ' 条不对');
    const nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), cmtLen = buf.readUInt16LE(off + 32);
    const raw = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const name = cleanName(raw);
    if(!name) throw new Error('包里有条脏路径，不敢用：' + raw);
    items.push({ name, method: buf.readUInt16LE(off + 10), csize: buf.readUInt32LE(off + 20),
      usize: buf.readUInt32LE(off + 24), loff: buf.readUInt32LE(off + 42) });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return items;
}
/* 条目真正的数据从哪儿开始：本地头里的名字/附加长度和目录里可能不一样，以本地头为准 */
function dataStart(buf, it){
  const o = it.loff;
  if(buf.readUInt32LE(o) !== 0x04034b50) throw new Error('包里 ' + it.name + ' 的本地头不对');
  return o + 30 + buf.readUInt16LE(o + 26) + buf.readUInt16LE(o + 28);
}
function unzipEntry(buf, it){
  const s = dataStart(buf, it);
  const raw = buf.slice(s, s + it.csize);
  if(it.method === 0) return raw;
  if(it.method === 8) return zlib.inflateRawSync(raw);
  throw new Error('包里 ' + it.name + ' 用的压缩法是 ' + it.method + '，这一份只认 存储 和 deflate');
}
/* 打开一个包：目录 + 标记 + 整包字节（更新.exe 最大的包也就 90 来 MB，解的时候按条目取） */
function openZip(zip){
  const buf = fs.readFileSync(zip);
  const items = zipIndex(buf);
  const it = items.find(x => x.name === MARK);
  if(!it) throw new Error('包里没有 ' + MARK + '，不知道这是什么东西的更新包');
  let marker;
  try{ marker = JSON.parse(unzipEntry(buf, it).toString('utf8')); }
  catch(e){ throw new Error(MARK + ' 读不成 JSON：' + e.message); }
  if(marker.kind !== 'flow-desk-update') throw new Error('这包的标记是 ' + marker.kind + '，不是 Flow-Desk 的更新包');
  return { marker, items, buf };
}
/* 包里的路径 → 落在树的哪一层：只有 页面 / app / runtime 三块有地方 */
function layerOf(name){
  if(!name.startsWith(ROOT_PRE)) return null;
  const rel = name.slice(ROOT_PRE.length);
  for(const layer of Object.keys(LAYER_PRE)){
    const pre = LAYER_PRE[layer];
    if(rel.startsWith(pre) && rel.length > pre.length) return { layer, rel: rel.slice(pre.length) };
  }
  return null;
}
/* 装之前先审一遍：只准动这三层；树根那一层 data\ 和三份用户目录 userdata-fd / userdata-wnw / userdata-rp
   出现在包的任何一个位置上一律停工（第 15 条那条红线）。
   注意 resources\app\data\ 不在红线里：那是 exe 自带的出厂兜底副本，属于程序自己的文件，
   和用户那一层 data\ 只是重名 —— 用户那层在包里对应的是 flow-desk/data/，那条路不认。 */
function audit(items){
  const plan = { pages: 0, app: 0, runtime: 0, bytes: 0 };
  for(const it of items){
    if(it.name === MARK) continue;
    /* 双保险：目录读出来那一步已经挑过 .. 和盘符，这儿再审一遍，别让绕过那条道的人白绕 */
    if(it.name.split('/').indexOf('..') >= 0 || it.name.indexOf(':') >= 0)
      throw new Error('包里有跳出去的路径（' + it.name + '），这一包拒装');
    /* 认的是那三份用户目录的名字，不是「userdata 打头」这四个字：
       resources\app\data\userdata-list.md（用户数据详单的出厂底本，build-app 的 BUNDLED_DATA 特意带上的）
       也姓 userdata，把它当用户数据拦下来，等于自家出的包自家拒装。 */
    if(/^flow-desk\/data\//.test(it.name) || /(^|\/)userdata-(fd|wnw|rp)(\/|\.|$)/i.test(it.name))
      throw new Error('包里居然带了用户数据（' + it.name + '）—— 更新不许碰你写的数据，这一包拒装');
    /* 为写、声笔输入法练习那两张独立页面已经撤了（两份代码都拼进 Flow-Desk 那一张页里，由组件就地开）：
       旧版更新包还带着 pages/wnw/ 或 pages/rp/ 那一层，装上就是把废掉的东西又铺回来，直接拒装。 */
    if(/^flow-desk\/pages\/(wnw|rp)\//i.test(it.name))
      throw new Error('这一包还带着为写或声笔输入法练习的独立页面，那一层已经撤了，这一包拒装');
    const l = layerOf(it.name);
    if(!l) throw new Error('包里有不认识的路径（' + it.name + '），不知道往哪儿放，这一包拒装');
    plan[l.layer]++; plan.bytes += it.usize;
  }
  if(!plan.pages && !plan.app && !plan.runtime) throw new Error('包里的页面、程序、运行时一样都没有，没什么可装的');
  return plan;
}
function unzip(buf, items, dest){
  for(const it of items){
    if(it.name === MARK) continue;
    const l = layerOf(it.name);
    if(!l) continue;
    const to = path.join(dest, l.layer, ...l.rel.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, unzipEntry(buf, it));
  }
}

/* ---------- 挪位置：整层 rename，一次挪干净（同一块盘，rename 不复制、不占双份）---------- */
function moveAway(from, to){
  if(!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  return true;
}

/* ---------- 记账：update\result.txt + 跟着 data\logs 排一行 ---------- */
function note(A, lines){
  const msg = String(lines).replace(/\s*\n\s*/g, ' ⏎ ');
  try{
    fs.mkdirSync(A.upd, { recursive: true });
    fs.appendFileSync(path.join(A.upd, 'result.txt'),
      new Date().toLocaleString('zh-CN') + '  包 ' + path.basename(A.zip) + '\n' + msg + '\n\n');
  }catch(e){}
  try{
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const day = logDay(d);
    const dir = path.join(A.tree, 'data', 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, day + '.log'),
      '[' + day + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) +
      '.000] UPD| 更新 ' + msg + '\n');
  }catch(e){}
}
function logDay(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* ---------- ① 等三个程序关干净：自己那一个不算（带运行时那种包，跑的就是同名的一份拷贝）---------- */
function whoLives(){
  let txt = '';
  try{ txt = execSync('tasklist /fo csv /nh', { windowsHide: true, encoding: 'utf8' }); }catch(e){ return []; }
  const out = [];
  for(const line of txt.split(/\r?\n/)){
    const m = line.match(/^"([^"]+)","(\d+)"/);
    if(!m) continue;
    if(Number(m[2]) === process.pid) continue;
    if(m[1].toLowerCase() === EXE.toLowerCase() && out.indexOf(m[1]) < 0) out.push(m[1]);
  }
  return out;
}

/* ---------- ④ 起新版 ----------
   这一个一定要把 ELECTRON_RUN_AS_NODE 摘掉再 spawn：main.cjs 拉起 updater 时就是靠这个环境变量
   让同一份 exe 当纯 node 用的，环境变量会跟着传给子进程 —— 不摘的话「Flow-Desk.exe」也以纯 node
   起来，没脚本就读 stdin，stdio 又是 ignore，于是它一秒都不剩地自己退了：
   日志照写「已起新版」（spawn 只在同步抛错时才报错），屏幕上什么都没有。2026-10-01 就是这么没的。
   起了没起不靠猜：等两秒回 tasklist 数一遍，真看见那个 exe 才算起来。 */
function relaunch(A){
  const exe = path.join(A.tree, EXE);
  if(!fs.existsSync(exe)) return '新版没起：找不到 ' + exe;
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  let fail = '';
  try{
    const p = spawn(exe, [], { cwd: A.tree, detached: true, stdio: 'ignore', env });
    p.on('error', e => { fail = (e && e.message) || String(e); });
    p.unref();
  }catch(e){ return '新版没起（' + ((e && e.message) || e) + '）'; }
  for(let i = 0; i < 12 && !fail; i++){
    sleep(250);
    if(whoLives().indexOf(EXE) >= 0) return '已起新版 ' + EXE;
  }
  return '新版没起' + (fail ? '（' + fail + '）' : '：叫了两秒 ' + EXE + ' 没答应，双击开一下就行');
}
function walk(dir, base){
  const out = [];
  if(!fs.existsSync(dir)) return out;
  base = base || '';
  for(const e of fs.readdirSync(dir, { withFileTypes: true })){
    const rel = base ? base + '/' + e.name : e.name;
    if(e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

/* ---------- 正事：四步一条道走到黑，中途出错就停下记账，已挪走的都在备份里 ---------- */
function run(A){
  const log = [];
  const back = path.join(A.upd, 'backups', A.stamp);
  const stage = path.join(A.upd, 'staging', A.stamp);
  let live = whoLives();
  for(let i = 0; i < 120 && live.length; i++){ sleep(250); live = whoLives(); }
  if(live.length){
    note(A, '没装：' + live.join('、') + ' 到 30 秒还没关。一个文件没动，包 ' + path.basename(A.zip));
    relaunch(A);
    return;
  }
  try{
    const { items, buf } = openZip(A.zip);
    const plan = audit(items);
    log.push('包 ' + path.basename(A.zip) + ' · pages ' + plan.pages + ' 件 · app ' + plan.app +
      ' 件 · 运行时 ' + plan.runtime + ' 件 · 约 ' + Math.round(plan.bytes / 1048576) + 'MB');
    unzip(buf, items, stage);
    log.push('解到 update\\staging\\' + A.stamp);
    /* 这一包里带哪一层，才挪哪一层的旧的；不带的那层原地不动 */
    if(plan.pages){
      if(moveAway(path.join(A.tree, 'pages'), path.join(back, 'pages'))) log.push('旧的 pages\\ 挪进 update\\backups\\' + A.stamp);
    }
    if(plan.app){
      const from = path.join(A.tree, 'resources', 'app');
      if(moveAway(from, path.join(back, 'resources', 'app'))) log.push('旧的 resources\\app\\ 挪进备份');
    }
    if(plan.runtime){
      /* 运行时是散在树根上的：只挪这一包里带的那些，树根上别的东西（data\、src\、他自己的散文件）一个不动。
         exe 和运行时是同一段字节的门牌，包里没列到它也得一起挪，不然会出现一新一旧凑一套。 */
      const rels = walk(path.join(stage, 'runtime'));
      if(rels.indexOf(EXE) < 0) rels.push(EXE);
      for(const rel of rels){
        const from = path.join(A.tree, ...rel.split('/'));
        if(moveAway(from, path.join(back, 'runtime', ...rel.split('/')))) log.push('旧的 ' + rel + ' 挪进备份');
      }
    }
    for(const layer of ['pages', 'app', 'runtime']){
      const from = path.join(stage, layer);
      if(!fs.existsSync(from)) continue;
      const to = layer === 'pages' ? path.join(A.tree, 'pages')
        : layer === 'app' ? path.join(A.tree, 'resources', 'app') : A.tree;
      if(layer === 'runtime'){
        for(const rel of walk(from)) moveAway(path.join(from, ...rel.split('/')), path.join(A.tree, ...rel.split('/')));
      } else {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(from, to);
      }
      log.push('装上 ' + layer + ' 层');
    }
    /* 只留 Flow-Desk.exe 一个可执行文件：包里就带这一个，根上也只有这一个，
       不再往根上补 Why Not Write.exe / Rime Practice.exe 那两个同名门牌 ——
       为写和声笔输入法练习的代码都在 Flow-Desk 那一张页里，由组件在窗口内就地开，不另起 exe、也不另出页面。 */
    try{ fs.rmSync(path.join(A.upd, 'staging'), { recursive: true, force: true }); }catch(e){}
    log.push(relaunch(A));
    note(A, log.join('\n'));
  }catch(e){
    log.push('停了：' + ((e && e.message) || e));
    log.push('已经动过的都在 update\\backups\\' + A.stamp + '，照着挪回去就还是上一版');
    note(A, log.join('\n'));
    relaunch(A);
  }
}

/* 被 main.cjs 当模块用时露出去的这几个（读包、审包、算号）；
   自己被 detach 起来跑时才读 argv 干活。argv 是一个 JSON 串：{zip,tree,upd,stamp} */
module.exports = { zipIndex, openZip, audit, layerOf, cleanName, stamp, unzipEntry, EXE, MARK, ROOT_PRE };

if(require.main === module){
  let A = {};
  try{ A = JSON.parse(process.argv[2] || '{}'); }catch(e){}
  if(!A.zip || !A.tree){ console.log('用法：node updater.cjs {zip,tree,upd,stamp} 的 JSON'); process.exit(2); }
  A.upd = A.upd || path.join(A.tree, 'update');
  A.stamp = A.stamp || stamp();
  run(A);
  process.exit(0);
}
