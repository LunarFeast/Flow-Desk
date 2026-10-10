'use strict';
/* ============================================================
   读一个 zip（只读，不写）—— 现在只剩插件那一摊用它：
     顶栏「导入插件」挑进来一个 <id>.zip，这一份把里面的插件清单和每一篇文件抠出来；
     插件列表那一屏也要靠它，才能不摊开就直接看见包里的东西。

   主程序换版不归这一份管了（外44 四）：那条「挑一个 FlowDesk_update_*.zip 装上」的路子
   整条撤了，更新就是双击一颗新的 Flow_Desk_setup_<版本号>.exe，指到同一棵树上点「覆盖升级」。
   那一颗自己带着一套读 zip 的代码（src\pack\sfx.cs 里的 Extract），不回头吃这一份。

   包由谁写：插件那七家由 src\_build\plugin-repos.mjs 铺、publish 压成 dist\plugins\<id>.zip。
   这一份只认两种条目：存储（method 0）和 deflate（method 8），压包那两头出的就是这两种。
   ============================================================ */
const zlib = require('zlib');

/* 路径先归成 / 分隔再挑：.. 这种跳出去的、空段、带盘符的全算脏 */
function cleanName(n){
  const s = String(n || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
  if(!s || s.indexOf(':') >= 0) return null;
  const seg = s.split('/').filter(x => x && x !== '.');
  if(!seg.length || seg.some(x => x === '..')) return null;
  return seg.join('/');
}
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

module.exports = { zipIndex, unzipEntry, cleanName };
