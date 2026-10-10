/* ============================================================
   插件加载器 · 生成页面和页面装卸共用这一把尺

   插件住在 data\plugins\ 里，两种样子都认：
     解开的文件夹  plugins\<id>\manifest.json + main.js + 出厂数据
     压好的 zip    plugins\<id>.zip
   同一个 id 两种都在，用文件夹 —— 本地开发就是要不用解压、直接改、直接生成页面。
   zip 是给人传阅和发布用的，一次传一个文件、不会漏件，里面还带着作者标记。

   名单反着记，在 plugins\off.json：{ "off":["notes", …] } —— 这一份里只有「被卸掉的」。
   名单不在（新树、还没装卸过）= 一家都没卸，扫到的全生效。
   所以往 plugins\ 里丢一个文件夹或一个 zip，重启软件就认（丢 zip 由主进程开机摊成文件夹，见 main.cjs 的 packAdopt）。
   卸掉 = 往这份名单里加一个名字 + 刷新这一页，包本身一个字不动，随时装得回来。
   外41 六段之前这份叫 installed.json、记的是「装了哪些」，那样丢进来不算装，必须在界面里点一次才认。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/* ---------- zip：读 ---------- */
/* 只认 store(0) 和 deflate(8)，也就是自己写出去的那两种；
   别人用别的算法压的包，明确报错而不是默默读出一堆乱码。 */
export function readZip(buf){
  const out = new Map();
  let e = buf.length - 22;
  while(e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if(e < 0) throw new Error('不像 zip：找不到中央目录结尾');
  const count = buf.readUInt16LE(e + 10);
  let off = buf.readUInt32LE(e + 16);
  for(let i = 0; i < count; i++){
    if(buf.readUInt32LE(off) !== 0x02014b50) throw new Error('zip 中央目录读歪了');
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nl = buf.readUInt16LE(off + 28), el = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32);
    const name = buf.toString('utf8', off + 46, off + 46 + nl).replace(/\\/g, '/');
    const lho = buf.readUInt32LE(off + 42);
    if(buf.readUInt32LE(lho) !== 0x04034b50) throw new Error('zip 里文件头对不上：' + name);
    const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnl + lel;
    if(!name.endsWith('/')){
      const raw = buf.subarray(start, start + csize);
      if(method === 0) out.set(name, Buffer.from(raw));
      else if(method === 8) out.set(name, zlib.inflateRawSync(raw));
      else throw new Error('zip 里用了不认得的压缩方式（' + method + '）：' + name);
    }
    off += 46 + nl + el + cl;
  }
  return out;
}

/* ---------- zip：写 ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for(let i = 0; i < 256; i++){ let c = i; for(let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c; }
  return t;
})();
function crc32(buf){
  let c = -1;
  for(let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
/* entries: [{ name, data(Buffer|string) }] → zip Buffer。全部 deflate，文件名一律 utf8。 */
export function writeZip(entries){
  const locals = [], centrals = [];
  let off = 0;
  for(const en of entries){
    const name = Buffer.from(String(en.name).replace(/\\/g, '/'), 'utf8');
    const data = Buffer.isBuffer(en.data) ? en.data : Buffer.from(String(en.data), 'utf8');
    const z = zlib.deflateRawSync(data, { level:9 });
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(z.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, name, z);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(z.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    centrals.push(Buffer.concat([ch, name]));
    off += 30 + name.length + z.length;
  }
  const body = Buffer.concat(locals);
  const cen = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cen.length, 12); eocd.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, cen, eocd]);
}

/* ---------- 包里有什么 ---------- */
/* 一个包摊平成的键值：文件夹走磁盘，zip 走内存，两边给上层的形状一模一样 */
function packFiles(dir, id){
  const base = path.join(dir, id);
  if(fs.existsSync(base) && fs.statSync(base).isDirectory()){
    const out = new Map();
    const walk = (rel) => {
      for(const e of fs.readdirSync(path.join(base, rel), { withFileTypes:true })){
        const r = rel ? rel + '/' + e.name : e.name;
        if(e.isDirectory()) walk(r);
        else if(!e.name.startsWith('.')) out.set(r, fs.readFileSync(path.join(base, r)));
      }
    };
    walk('');
    return { kind:'dir', path:base, files:out };
  }
  const z = path.join(dir, id + '.zip');
  if(fs.existsSync(z)) return { kind:'zip', path:z, files:readZip(fs.readFileSync(z)) };
  return null;
}

/* 说明书：manifest.json 必须是对象，id 以目录名为准（写歪了按目录名纠正） */
function manifestOf(pk, id){
  const raw = pk.files.get('manifest.json');
  if(!raw) throw new Error('包 ' + id + ' 里没有 manifest.json');
  let m;
  try{ m = JSON.parse(raw.toString('utf8')); }
  catch(e){ throw new Error('包 ' + id + ' 的 manifest.json 读不成 JSON：' + e.message); }
  return Object.assign({ id:id, name:id, version:'0', author:'', source:'', host:['fd'], entry:['main.js'],
    order:100, dataKeys:[], kvKeys:[], sharedKeys:[], desc:'', bank:null, assets:{} }, m, { id:id });
}

/* 扫目录：把 plugins\ 下面所有"像个包"的东西列出来（文件夹和 zip 都算，同 id 文件夹赢） */
export function scan(dir){
  const found = new Map();
  let names = [];
  try{ names = fs.readdirSync(dir); }catch(e){ return []; }
  for(const n of names){
    if(n.startsWith('.') || n.startsWith('_')) continue;
    if(n === OFF_LIST) continue;
    if(n.endsWith('.zip')){ const id = n.slice(0, -4); if(!found.has(id)) found.set(id, { id, from:'zip' }); continue; }
    if(fs.statSync(path.join(dir, n)).isDirectory() && fs.existsSync(path.join(dir, n, 'manifest.json')))
      found.set(n, { id:n, from:'dir' });
  }
  const out = [];
  for(const { id } of found.values()){
    const pk = packFiles(dir, id);
    if(!pk) continue;
    try{ out.push({ id, kind:pk.kind, path:pk.path, manifest:manifestOf(pk, id), files:pk.files }); }
    catch(e){ out.push({ id, kind:pk.kind, path:pk.path, error:e.message, manifest:null, files:pk.files }); }
  }
  return out.sort((a, b) => (a.manifest && a.manifest.order || 999) - (b.manifest && b.manifest.order || 999) || (a.id < b.id ? -1 : 1));
}

/* 名单反着记：off.json 里那几家是「这棵树上被卸掉的」，文件不在 = 一家都没卸，扫到的全生效。
   从前这一份叫 installed.json、记的是「装了哪些」—— 那样丢一个文件夹进来不算装，
   非得在界面里点一次「装上」写进名单才认。外41 六段翻过来，为的就是「放进插件文件夹、
   重启软件就生效」那一条。卸掉只往这份里加名字，包本身一个字不动。 */
export const OFF_LIST = 'off.json';
export function offIds(dir){
  try{
    const j = JSON.parse(fs.readFileSync(path.join(dir, OFF_LIST), 'utf8'));
    return Array.isArray(j) ? j : (Array.isArray(j.off) ? j.off : []);
  }catch(e){ return []; }
}
export function setOff(dir, ids){
  fs.mkdirSync(dir, { recursive:true });
  fs.writeFileSync(path.join(dir, OFF_LIST), JSON.stringify({ off:[...new Set(ids).values()] }, null, 2) + '\n', 'utf8');
}

/* ---------- 生成页面要的那一句 ----------
   host 是 'fd' 或 'wnw'：这一侧的外壳拼哪些包、按什么顺序拼。
   顺序 = manifest.order，同序按 id，两边扫同一批目录得出的是同一个次序。
   返回 { segments:[{name, src}], meta:{id:{…说明书里给运行时看的那几项}}, skipped:[{id, why}] } */
export function resolve(dir, host, opt){
  const o = opt || {};
  const all = scan(dir);
  const off = offIds(dir);
  const skipped = all.filter(p => p.error).map(p => ({ id:p.id, why:p.error }));
  const picked = all.filter(p => {
    if(p.error) return false;
    if(off.includes(p.id)){ skipped.push({ id:p.id, why:'在 off.json 里（卸掉了）' }); return false; }
    if(!(p.manifest.host || []).includes(host)){ skipped.push({ id:p.id, why:'这个宿主不挂它（只给 ' + (p.manifest.host || []).join('/') + '）' }); return false; }
    return true;
  });
  if(o.onProgress) picked.forEach((p, i) => o.onProgress(p, i, picked.length));
  const segments = [];
  const data = [];
  const meta = {};
  for(const p of picked){
    const m = p.manifest;
    for(const e of (m.entry || ['main.js'])){
      const f = p.files.get(e);
      if(f === undefined){ skipped.push({ id:p.id, why:'包里少了 ' + e }); continue; }
      segments.push({ name:'组件/' + p.id + '/' + e, src:f.toString('utf8'), pack:p.id });
    }
    /* 包里除说明书和代码之外的那些文件，就是这一家的出厂数据（词库、监听脚本、桥插件都算）。
       发布这一趟直接读内存，不落临时文件；哪家要压进 zip、哪家要解到 data\plugins\ 上，各挑各的。
       文本的顺手带一份 text，二进制的（桥插件那种 dll）只带 buf，别按 utf8 拆坏了。 */
    for(const [name, buf] of p.files){
      if(name === 'manifest.json' || /\.js$/.test(name)) continue;
      data.push({ pack:p.id, name, buf, text:/\.(txt|json|md|css|html|svg|ps1|psm1|cs|csproj|ini|cfg|xml|csv|tsv|lrc|ttml|elrc)$/i.test(name)
        ? buf.toString('utf8') : null });
    }
    meta[p.id] = { name:m.name, author:m.author, source:m.source, version:m.version, minShell:m.minShell,
      desc:m.desc || '', host:m.host, order:m.order, icon:m.icon || '',
      first:(typeof m.first === 'number' ? m.first : null), dataKeys:m.dataKeys || [], kvKeys:m.kvKeys || [],
      /* 词库跟着功能走：说明书点了 bank，这一家就自带那份底本（bank.txt），
         用户改出来的那一份写在包里点名的 user 位置上（数据层，不在包里），卸掉勾了「同步清除数据」才没。
         sharedKeys 是同一个意思的通用形状：数据层根（data\）那一侧、由各功能包自带的路径。 */
      sharedKeys:m.sharedKeys || [], bank:m.bank || null, assets:m.assets || {},
      where:p.kind === 'zip' ? p.id + '.zip' : p.id + '/' };
  }
  return { segments, meta, data, skipped, all };
}

/* 产物里不再拼组件段，也不再打说明书表（FD_PACKS 那一份已废）：
   开机由加载器 _shared/sh-load.js 现名单、现 import，说明书一家家填进 PACK_META。
   这一把尺只留给发布侧用 —— scan 读包、writeZip 压成品包，都是运输形状。 */
