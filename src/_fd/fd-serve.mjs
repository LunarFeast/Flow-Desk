/* Flow-Desk 本地服务器
   必须用它打开 FD：File System Access（授权真实数据目录）只在 http://127.0.0.1 或 https 下可用，file:// 不行。
   用法：node fd-serve.mjs   然后浏览器访问 http://127.0.0.1:8791/
   可选环境变量：PORT、FD_DIR（FD 产物目录）、FD_ICONS（图标那一层，挂到 /icons/）、
     FD_FACTORY_COMPONENTS（「恢复出厂」取的那一层出厂原文，默认指 resources\app\data\plugins）
   除了发文件，还挂三条写通道：/_comp 是「改代码」和装卸用的那三道闸（就是主进程那一把尺 src\pack\comp-files.cjs），
   /_lib 存的是 #291 色卡、#292 外观方案、外29 丁组 图片库那三份 YAML，/_img 收导入的那一张图的字节。
   还挂一条读的：/_icons 把 icons\ 和 data\images\ 两层扫成一张「名字 → 地址」的表（主进程那层桥在这台没有），
   每个页面末尾垫一小段接线把它交给 Ico —— 卡片上那些平铺纹理才铺得上；程序里吃的是主进程那份，不认这一段。
   开发浏览器里改的、装的、恢复出厂的都是真文件 —— 不出现「浏览器那份是草稿、程序那份才作数」两套真相。 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import tree from '../_build/tree.cjs';
import { 页名 } from '../_build/version.mjs';
import makeComp from '../pack/comp-files.cjs';

/* 源码定在 Flow-Desk\src\_fd：页面在 pages\、用户数据在 data\（第 15 条），
   两个都按相对位置找，整个 Flow-Desk 挪盘也能起服务。
   页面里写的还是老的同级相对路径（<词库目录>/…、help.md），
   所以页面层找不到时退回数据层再找一次，这一份兜底才仍然能用。 */
const PORT = +(process.env.PORT || 8791);
const HERE = path.resolve(import.meta.dirname);
const TREE = tree(HERE);
const FD_DIR = process.env.FD_DIR || TREE.pages;
const DATA_DIR = process.env.DATA_DIR || TREE.data;
/* 图标那一层挂在 /icons/ 下：程序里这一层由主进程扫成一张表递给页面，
   这一台没有主进程，就按目录发出去，图标和它那一张表才能在开发页面上验得出。 */
const ICONS_DIR = process.env.FD_ICONS || path.join(TREE.tree, 'icons');
/* 默认取 FD_DIR 里版本号最大的那份 Flow_Desk_*.html，出新版不用回来改这里；想钉住某一版就传 ENTRY。
   取号口径和 exe 那份一致：吃 -dev 这类字母后缀，非数字当分隔符，_v0.x 老文件不以数字开头所以天然不选。 */
const ENTRY = process.env.ENTRY || latestEntry();
function latestEntry(){
  const re = /^Flow_Desk_([\d][\w.+-]*)\.html$/;
  let best = null;
  try{
    for(const n of fs.readdirSync(FD_DIR)){
      const m = n.match(re);
      if(!m) continue;
      const raw = m[1], v = raw.split(/[^\d]+/).filter(Boolean).map(Number);
      const c = best ? cmpVer(v, best.v) : 1;
      if(c > 0 || (c === 0 && raw > best.raw)) best = { n, v, raw };
    }
  }catch(e){}
  return best ? best.n : 页名();
}
function cmpVer(a, b){
  for(let i = 0; i < Math.max(a.length, b.length); i++){ const d = (a[i] || 0) - (b[i] || 0); if(d) return d; }
  return 0;
}

const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.ico':'image/x-icon', '.yaml':'text/plain; charset=utf-8', '.md':'text/plain; charset=utf-8' };

function send(res, code, body, type){
  res.writeHead(code, { 'Content-Type':type || 'text/plain; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(body);
}
/* ---------- 图标清单：这一台替主进程扫一遍 ----------
   程序里 icons\ 由主进程扫成一张「名字 → 地址」的表递给页面：文件名去掉后缀就是名字，
   往里那一层子文件夹念作「文件夹名-文件名」；只认一层，再往里钻不算图标。
   数据层那一格 data\images\（他自己导进来的那些图，外29 丁组）也并进同一张表，口径一样，
   排在图标之后、同名不抢 —— 和主进程 iconScan 里那两趟 take 同一个次序、同一条规矩。
   这一台没有那层桥，就按同一个口径扫一遍挂到 /_icons 上，页面手里那条链路（平铺图、背景图、图标图片）才验得出来。 */
const ICON_EXT = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const DATA_IMG_DIR = path.join(DATA_DIR, 'images');     /* 图片库（外29 丁组）：按三种用途导进来的那些图 */
function iconKey(n){ return String(n).replace(/[^a-zA-Z0-9_-]/g, '-'); }
function iconScanDev(){
  const out = {};
  const take = (dir, pre, urlPre, keepFirst) => {
    let names = [];
    try{ names = fs.readdirSync(dir, { withFileTypes:true }); }catch(e){ return; }
    for(const st of names){
      if(st.isDirectory()){
        if(!pre && st.name && !st.name.startsWith('.'))
          take(path.join(dir, st.name), iconKey(st.name) + '-', urlPre + encodeURIComponent(st.name) + '/');
        continue;
      }
      const nm = String(st.name || '');
      const ext = path.extname(nm).toLowerCase();
      if(!ICON_EXT.includes(ext)) continue;
      const k = pre + iconKey(nm.slice(0, nm.length - ext.length));
      if(!k) continue;
      if(keepFirst && out[k]) continue;
      /* 尾巴带写入时间：同名换一张图，页面手里那份旧的就算作废（和主进程 iconUrl 同一个办法） */
      let t = 0;
      try{ t = Math.floor(fs.statSync(path.join(dir, nm)).mtimeMs); }catch(e){}
      out[k] = urlPre + encodeURIComponent(nm) + '?at=' + t;
    }
  };
  take(ICONS_DIR, '', '/icons/');
  /* 图片库那一格（外29 丁组）：和主进程 iconScan 里那一趟同一个口径，念作「images-<文件名>」 */
  take(DATA_IMG_DIR, 'images-', '/images/', true);
  return out;
}
/* 递进每一个页面末尾的那一段接线：把上面那张表交给 Ico，跟着把外观重算一遍。
   程序里 Ico 吃的是主进程递的那份，不认这一段；只有这一台会走到。
   重算那一下是必需的：纹理的地址在 Theme.apply 那一刻才定下来，
   清单比开机晚到一步时不补这一下，就得等下次动外观才铺得上。 */
const DEV_GLUE = '<script>(function(){fetch("/_icons").then(function(r){return r.json()}).then(function(list){' +
  'var ok=false;try{if(typeof Ico!=="undefined"&&Ico.scan){Ico.scan(list);ok=true}}catch(e){}' +
  'if(ok){try{if(typeof Theme!=="undefined"&&Theme.apply)Theme.apply()}catch(e){}}' +
  '}).catch(function(){})})();</scr' + 'ipt>';
function injectGlue(html){
  const at = html.lastIndexOf('</body>');
  if(at < 0) return html + DEV_GLUE;
  return html.slice(0, at) + DEV_GLUE + html.slice(at);
}
function serveFile(res, abs, alt){
  /* 页面层没有这一份、数据层有（词库、配方、生成记录、书目录都在那边）：用数据层那份 */
  if(alt && !fs.existsSync(abs)){ try{ if(fs.existsSync(alt)) abs = alt; }catch(e){} }
  fs.readFile(abs, (err, buf) => {
    if(err) return send(res, 404, '找不到 ' + abs);
    const ext = path.extname(abs).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    if(ext === '.html') return send(res, 200, injectGlue(buf.toString('utf8')), type);
    send(res, 200, buf, type);
  });
}
/* ---------- /_comp：插件那一格的读写（和主进程同一把尺） ----------
   页面递来的都是 {op, id, rel, text}：包名和路径由 comp-files.cjs 查过才落地，
   跑出 data\plugins\ 的一律写不进去。装卸那一头只碰 off.json 和目录清单两件事。
   原版那一格在 data\plugins-factory\（外43 从 resources\app\data\plugins 挪过来的，跟主进程同一个位置）。 */
const COMP = makeComp({
  live: path.join(DATA_DIR, 'plugins'),
  factory: process.env.FD_FACTORY_COMPONENTS || path.join(DATA_DIR, 'plugins-factory')
});
const OFF = () => path.join(DATA_DIR, 'plugins', 'off.json');
/* 名单反着记：off.json 里只有「被卸掉的」。文件不在 = 一家都没卸，扫到的全生效。 */
function readOff(){
  try{
    const d = JSON.parse(fs.readFileSync(OFF(), 'utf8'));
    const a = Array.isArray(d) ? d : (d && Array.isArray(d.off) ? d.off : []);
    return a.map(String);
  }catch(e){ return []; }
}
function writeOff(开着){
  /* 页面递上来的是「开着的」那几家，这里换成「卸掉的」落盘 —— 和主进程 pack:set 同一把尺。
     null = 一家都不卸，把这份文件删掉。op 的名字还叫 installed：那是通道名，不是名单名。 */
  const f = OFF();
  if(开着 === null || 开着 === undefined){
    try{ if(fs.existsSync(f)) fs.unlinkSync(f); return { ok:true, ids:null }; }
    catch(e){ return { ok:false, msg:'名单删不掉：' + (e && e.code || e) }; }
  }
  if(!Array.isArray(开着)) return { ok:false, msg:'名单得是一份 id 列表' };
  const on = new Set(开着.map(String));
  const off = scanDirs().map(p => String(p.id)).filter(x => !on.has(x));
  try{
    fs.mkdirSync(path.dirname(f), { recursive:true });
    fs.writeFileSync(f, JSON.stringify({ off }, null, 2) + '\n', 'utf8');
    return { ok:true, ids:Array.from(on) };
  }catch(e){ return { ok:false, msg:'名单写不进去：' + (e && e.code || e) }; }
}
/* 这一层有哪几格：解开的文件夹才算，zip 那份运输形状由程序那边的导入摊开 */
function scanDirs(){
  const root = path.join(DATA_DIR, 'plugins');
  const out = [];
  let names = [];
  try{ names = fs.readdirSync(root, { withFileTypes:true }); }catch(e){ return out; }
  for(const e of names){
    if(!e.isDirectory() || e.name.startsWith('.')) continue;
    const mf = path.join(root, e.name, 'manifest.json');
    if(!isFile(mf)) continue;
    let m = null;
    try{ m = JSON.parse(fs.readFileSync(mf, 'utf8')); }catch(err){ continue; }
    out.push({ id:m.id || e.name, kind:'dir', manifest:m });
  }
  return out;
}
/* 递给页面的形状和主进程 packList 那一个一致：{ dir, packs, off, error }
   —— 装卸那一头（PackOps）两种开法读同一份结构，不用分叉。 */
function packList(){
  return { dir:path.join(DATA_DIR, 'plugins'), packs:scanDirs(), off:readOff(), error:'' };
}
function isFile(p){ try{ return fs.statSync(p).isFile(); }catch(e){ return false; } }
function compReq(req, res){
  if(req.method !== 'POST'){ send(res, 405, JSON.stringify({ ok:false, msg:'/_comp 只收 POST' })); return; }
  let body = '';
  req.setEncoding('utf8');
  req.on('data', c => { body += c; if(body.length > 32 * 1024 * 1024){ req.destroy(); } });
  req.on('end', () => {
    let p = null;
    try{ p = JSON.parse(body || '{}'); }catch(e){ return send(res, 400, JSON.stringify({ ok:false, msg:'这份请求读不懂 JSON' })); }
    const id = String(p.id || '');
    /* rel 没给 = null：读和恢复出厂都按入口那份 main.js 办（和主进程那条通道同一个口径） */
    const rel = (p.rel === undefined || p.rel === null || p.rel === '') ? null : String(p.rel);
    let out = { ok:false, msg:'没有这一条操作：' + String(p.op) };
    try{
      switch(String(p.op)){
        case 'read':    out = COMP.read(id, rel === null ? undefined : rel); break;
        case 'list':    out = COMP.list(id); break;
        case 'write':   out = COMP.write(id, rel, p.text); break;
        case 'delete':  out = COMP.remove(id); break;
        case 'restore': out = COMP.restore(id, rel === null ? undefined : rel); break;
        case 'factory': out = { ok:true, files:COMP.factoryFiles(id), has:COMP.hasFactory(id) }; break;
        case 'installed': out = !('set' in p) ? { ok:true, off:readOff() } : writeOff(p.set); break;
        case 'dirs':      out = packList(); break;
        default: break;
      }
    }catch(e){ out = { ok:false, msg:String((e && e.message) || e) }; }
    send(res, 200, JSON.stringify(out), MIME['.json']);
  });
}

/* ---------- /_lib：库文件的存盘（#291 色卡两套 / #292 外观方案 / #298 待实现清单 / 外29 丁组 图片库） ----------
   读那一路不用新通道：GET /palettes.yaml 由下面的「页面层没有就往数据层再找一次」直接送到。
   写只认这几个名字，落在 数据\ 里同一个文件上 —— 和 Flow-Desk.exe 里 lib:write 那一条同一把尺
   （那一条认的是 src\pack\main.cjs 的 LIB_NAMES，这一份跟着它，少一个名字就是「开发浏览器里存不下去、程序里存得下去」两套真相）。
   色卡那一份（cards.yaml）漏登记过一整轮，界面上表现为「存不进文件：只认这几份库文件」—— 加一份库文件要两边各登记一次，
   src\tools\probes\test-libnames.mjs 每台核这一条。 */
const LIB_NAMES = ['palettes.yaml', 'cards.yaml', 'looks.yaml', 'lib-pending.json', 'images.yaml'];
function libReq(req, res){
  const q = new URL(req.url, 'http://127.0.0.1').searchParams.get('name') || '';
  if(!LIB_NAMES.includes(q)) return send(res, 200, JSON.stringify({ ok:false, msg:'只认这四份库文件：' + LIB_NAMES.join(' / ') }), MIME['.json']);
  if(req.method !== 'POST') return send(res, 200, JSON.stringify({ ok:false, msg:'/_lib 只收 POST' }), MIME['.json']);
  let body = '';
  req.setEncoding('utf8');
  req.on('data', c => { body += c; if(body.length > 8 * 1024 * 1024){ req.destroy(); } });
  req.on('end', () => {
    try{
      fs.mkdirSync(DATA_DIR, { recursive:true });
      fs.writeFileSync(path.join(DATA_DIR, q), body, 'utf8');
      send(res, 200, JSON.stringify({ ok:true, file:q }), MIME['.json']);
    }catch(e){ send(res, 200, JSON.stringify({ ok:false, msg:'存不进文件：' + (e && e.code || e) }), MIME['.json']); }
  });
}

/* ---------- /_img：图片库那一张图的字节存盘（外29 丁组） ----------
   程序里这一步走的是现成的 writePageBytes（fs:write，第三参带建目录），这一台没有那层桥，
   所以另开这一条小口子，落点和主进程完全一致：数据\images\。背景图 / 取色素材 / 纹理·四方连续图三种用途都走这一条。
   只认 A~Z a~z 0~9 . _ -，后缀必须是图片那几种，且拒 '..' —— 别绕到数据层外面去。
   上限给到 24 MB：背景图本来就比平铺小图大（那张平铺的顶在 4 MB，是反复贴那一层不该那么大）。
   从前这儿还有一条 /_tex（落 数据\textures\、只管纹理一种用途、顶 8 MB）：预设纹理全撤之后两条并一条，
   名字闸和主进程 putBytes 那一句同一个式子，两边不各写一套。 */
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
function imgReq(req, res){
  if(req.method !== 'POST') return send(res, 200, JSON.stringify({ ok:false, msg:'/_img 只收 POST' }), MIME['.json']);
  const q = String(new URL(req.url, 'http://127.0.0.1').searchParams.get('name') || '');
  if(!/^[A-Za-z0-9._-]{1,64}$/.test(q) || q.includes('..') || !IMG_EXT.includes(path.extname(q).toLowerCase()))
    return send(res, 200, JSON.stringify({ ok:false, msg:'这个文件名收不下：' + q }), MIME['.json']);
  const chunks = [];
  let size = 0;
  req.on('data', c => { size += c.length; if(size > 24 * 1024 * 1024){ req.destroy(); return; } chunks.push(c); });
  req.on('end', () => {
    try{
      fs.mkdirSync(DATA_IMG_DIR, { recursive:true });
      fs.writeFileSync(path.join(DATA_IMG_DIR, q), Buffer.concat(chunks));
      send(res, 200, JSON.stringify({ ok:true, file:q }), MIME['.json']);
    }catch(e){ send(res, 200, JSON.stringify({ ok:false, msg:'这张图存不进：' + (e && e.code || e) }), MIME['.json']); }
  });
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if(url === '/_comp') return compReq(req, res);
  if(url === '/_lib') return libReq(req, res);
  if(url === '/_img') return imgReq(req, res);
  if(url === '/_icons') return send(res, 200, JSON.stringify(iconScanDev()), MIME['.json']);
  /* /icons/：图标那一层（icons\ 和它下面那一层子文件夹）。
     程序里这一层由主进程扫成一张表递给页面，开发服务器上没那层桥，就按目录原样发出去。 */
  if(url.startsWith('/icons/')){
    const rel = path.normalize(url.slice(7)).replace(/^([/\\]|\.\.)+/, '');
    const abs = path.join(ICONS_DIR, rel);
    if(!abs.startsWith(path.resolve(ICONS_DIR))) return send(res, 403, '禁止越界访问');
    return serveFile(res, abs);
  }
  /* /material/：随包内置素材那一层（纹理那 6 张，src\pack\material\textures\，出包铺成 Flow-Desk\material\textures\）。
     程序里页面写的是相对地址 material/textures/xxx.png，fdapp:// 那套映射按树根去找；
     这一台照同一个口径：树根那一层有就发树根的（他换过的图跟着生效），还没有就退回 src\pack\material 那份原件 ——
     没出过包的源码树上也要验得出这一条，不然就成「程序里铺得上、开发页面上取不到」两套真相。 */
  if(url.startsWith('/material/')){
    const rel = path.normalize(url.slice(10)).replace(/^([/\\]|\.\.)+/, '');
    const 根 = [path.join(TREE.tree, 'material'), path.join(HERE, '..', 'pack', 'material')];
    for(const b of 根){
      const abs = path.join(b, rel);
      if(!abs.startsWith(path.resolve(b))) return send(res, 403, '禁止越界访问');
      if(fs.existsSync(abs) && fs.statSync(abs).isFile()) return serveFile(res, abs);
    }
    return send(res, 404, 'not found: ' + rel);
  }
  if(url === '/' || url === '/index.html') return serveFile(res, path.join(FD_DIR, ENTRY));
  const rel = path.normalize(url).replace(/^([/\\]|\.\.)+/, '');
  const abs = path.join(FD_DIR, rel);
  if(!abs.startsWith(path.resolve(FD_DIR))) return send(res, 403, '禁止越界访问');
  const alt = path.join(DATA_DIR, rel);
  serveFile(res, abs, alt.startsWith(path.resolve(DATA_DIR)) ? alt : null);
});
server.listen(PORT, '127.0.0.1', () => {
  console.log('Flow-Desk   http://127.0.0.1:' + PORT + '/');
  console.log('  FD 目录   ' + FD_DIR + '  入口 ' + ENTRY);
  console.log('  数据目录  ' + DATA_DIR + '  (页面层找不到的那几个文件往这儿再找一次)');
});
