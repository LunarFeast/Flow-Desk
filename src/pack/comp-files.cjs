/* ============================================================
   插件文件层 · 主进程和开发探针共用的同一把尺
   ----------
   插件的代码和自带文件都住在 data\plugins\<id>\ 这一格里：
   「改代码」改的就是这一格里的 main.js，存了就是新的，刷新这一页立刻生效 ——
   不再有「写一份覆盖副本、等重新生成页面才嵌进去」那一趟。
   出厂原文在程序自带的那一份 resources\app\data\plugins\ 里，
   「恢复出厂」就是从那儿把这一格的文件拷回来（真复制，不用硬链接：
   链接会让活文件和出厂副本变成同一份，改了活的等于改了出厂，恢复出厂就成了空话）。
   ----------
   三道闸（谁都绕不过去，包括页面里递上来的路径）：
     1 包名只认干净字符（字母数字点横线下划线），别的一律不落地；
     2 相对路径不许有 .. 或 . 或空段；
     3 落点算完必须在 plugins\<id>\ 里面，跑出去就报错。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ID_OK = /^[A-Za-z0-9._-]+$/;
/* 认作「可以打开来改」的文本后缀（清单只列这些；图片、随行 exe/dll/脚本不摆进编辑器） */
const TEXT_EXT = ['.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.css', '.html', '.yaml', '.yml'];
/* 一份文件走这条道的上限：代码、说明书、随行小文件都在这个数以内；
   真要搬大东西（几 MB 的词库底本）走的是包导入那条道，不经过这里。 */
const MAX_BYTES = 8 * 1024 * 1024;

/* 'a/b.txt' → ['a','b.txt']；脏路径回 null */
function segsOf(rel){
  const s = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '').split('/');
  const out = s.filter(Boolean);
  if(!out.length) return null;
  if(out.some(x => x === '.' || x === '..')) return null;
  return out;
}
function isDir(p){ try{ return fs.statSync(p).isDirectory(); }catch(e){ return false; } }
function isFile(p){ try{ return fs.statSync(p).isFile(); }catch(e){ return false; } }
/* 复制一份文件：连父目录一起建好；返回字节数 */
function copyFile(from, to){
  fs.mkdirSync(path.dirname(to), { recursive:true });
  fs.copyFileSync(from, to);
  try{ return fs.statSync(to).size; }catch(e){ return 0; }
}
/* 整格复制（出厂 → 活的那一层）：一层层走，链接/权限都不认，只认普通文件和目录 */
function copyTree(from, to){
  let n = 0;
  for(const e of fs.readdirSync(from, { withFileTypes:true })){
    if(e.name.startsWith('.')) continue;
    const f = path.join(from, e.name), t = path.join(to, e.name);
    if(e.isDirectory()) n += copyTree(f, t);
    else if(e.isFile() && isFile(f)) n += (copyFile(f, t), 1);
  }
  return n;
}

module.exports = function make(opt){
  const o = opt || {};
  const dir = k => { const v = typeof o[k] === 'function' ? o[k]() : o[k]; return v ? path.resolve(String(v)) : ''; };
  const LIVE = () => dir('live');          /* data\plugins\ —— 程序现在真正加载的那一层 */
  const FACT = () => dir('factory');       /* resources\app\data\plugins\ —— 出厂原文 */

  /* 包名 + 相对路径 → 这一格里的真路径；不干净的回错误话，绝不落盘 */
  function locate(id, rel){
    const nm = String(id || '').trim();
    if(!ID_OK.test(nm)) return { msg:'包名不干净，不敢动手：' + nm };
    const root = LIVE();
    if(!root) return { msg:'插件目录还没定下来' };
    const base = path.join(root, nm);
    if(rel === undefined || rel === null || rel === '') return { id:nm, file:base, root };
    const seg = segsOf(rel);
    if(!seg) return { msg:'路径不干净，不敢动手：' + String(rel) };
    const f = path.join(base, ...seg);
    if(f !== base && !f.startsWith(base + path.sep)) return { msg:'路径跑出了这一格：' + String(rel) };
    return { id:nm, file:f, root };
  }
  /* 出厂那一格里对应的位置（恢复出厂用） */
  function factFile(id, rel){
    const root = FACT();
    if(!root || !isDir(root)) return '';
    const seg = segsOf(rel);
    if(!seg || !ID_OK.test(String(id))) return '';
    const base = path.join(root, String(id));
    const f = path.join(base, ...seg);
    if(!f.startsWith(base + path.sep)) return '';
    return isFile(f) ? f : '';
  }

  return {
    MAX_BYTES,
    liveDir:LIVE, factoryDir:FACT,
    hasFactory(id){ return isDir(path.join(FACT() || '\0', String(id))); },

    /* ---------- 读这一格里的一份文件（改代码打开的就是它） ----------
       rel 没给（null / 空串 / undefined 三种都算，主进程那条通道传的是 null）：按入口那份 main.js 办 */
    read(id, rel){
      const what = (rel === undefined || rel === null || String(rel).trim() === '') ? 'main.js' : rel;
      const L = locate(id, what);
      if(L.msg) return { ok:false, msg:L.msg };
      if(!isFile(L.file)) return { ok:false, msg:'这一格里没有这份文件', path:String(what) };
      let st = null;
      try{ st = fs.statSync(L.file); }catch(e){ return { ok:false, msg:'读不到：' + (e && e.code || e) }; }
      if(st.size > MAX_BYTES) return { ok:false, msg:'这份文件 ' + Math.round(st.size / 1048576) + 'MB，太大不走这条路' };
      let text = '';
      try{ text = fs.readFileSync(L.file, 'utf8'); }catch(e){ return { ok:false, msg:'读不出文本：' + (e && e.code || e) }; }
      return { ok:true, text, size:st.size, mtime:Math.floor(st.mtimeMs),
        factory:!!factFile(L.id, segsOf(what)) };
    },
    /* ---------- 写这一格里的一份文件：存了就是新的 ---------- */
    write(id, rel, text){
      if(rel === undefined || rel === null || String(rel).trim() === '') return { ok:false, msg:'得说要写这一格里的哪份文件' };
      const L = locate(id, rel);
      if(L.msg) return { ok:false, msg:L.msg };
      const buf = Buffer.from(String(text == null ? '' : text), 'utf8');
      if(buf.length > MAX_BYTES) return { ok:false, msg:'这份 ' + Math.round(buf.length / 1048576) + 'MB，太大不走这条路' };
      try{
        fs.mkdirSync(path.dirname(L.file), { recursive:true });
        fs.writeFileSync(L.file, buf);
        return { ok:true, size:buf.length };
      }catch(e){ return { ok:false, msg:'写不进去：' + (e && e.code || e) }; }
    },
    /* ---------- 抹掉一整格：只按包名动手，不接子路径（「完全删除」那一步用的就是它） ---------- */
    remove(id){
      const L = locate(id);
      if(L.msg) return { ok:false, msg:L.msg };
      const gone = [];
      try{
        if(isDir(L.file)){ fs.rmSync(L.file, { recursive:true, force:true }); gone.push(L.id + '/'); }
        if(isFile(L.file + '.zip')){ fs.unlinkSync(L.file + '.zip'); gone.push(L.id + '.zip'); }
        if(!gone.length) return { ok:false, msg:'这一格本来就不在' };
        return { ok:true, removed:gone };
      }catch(e){ return { ok:false, msg:'删不掉：' + (e && e.code || e), removed:gone }; }
    },
    /* ---------- 这一格里有哪几份能改的文本文件 ----------
       「改代码」顶上那个挑文件的下拉吃这个：入口那份排最前，说明书跟着，剩下的按名字排。
       图片、dll、ps1 这些不进清单 —— 编辑器只认文本，把二进制摆上去只会让人改坏文件。 */
    list(id){
      const L = locate(id);
      if(L.msg) return { ok:false, msg:L.msg };
      if(!isDir(L.file)) return { ok:true, files:[] };
      const out = [];
      const walk = rel => {
        for(const e of fs.readdirSync(path.join(L.file, rel), { withFileTypes:true })){
          if(e.name.startsWith('.')) continue;
          const r = rel ? rel + '/' + e.name : e.name;
          if(e.isDirectory()){ walk(r); continue; }
          if(!e.isFile() || !TEXT_EXT.includes(path.extname(e.name).toLowerCase())) continue;
          try{ if(fs.statSync(path.join(L.file, r)).size > MAX_BYTES) continue; }catch(err){ continue; }
          out.push(r);
        }
      };
      try{ walk(''); }catch(e){ return { ok:false, msg:'列不出来：' + (e && e.code || e) }; }
      const head = ['main.js', 'manifest.json', 'recipe.json'];
      const rank = f => { const i = head.indexOf(f); return i < 0 ? head.length : i; };
      out.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
      return { ok:true, files:out };
    },

    /* ---------- 恢复出厂：从自带那一层把这一份原样拷回来 ---------- */
    restore(id, rel){
      const r = String(rel || 'main.js');
      const L = locate(id, r);
      if(L.msg) return { ok:false, msg:L.msg };
      const from = factFile(L.id, segsOf(r));
      if(!from) return { ok:false, msg:'程序自带的那一份里没有这一家（' + L.id + '）的出厂原文 · 恢复出厂用不了' };
      try{ return { ok:true, size:copyFile(from, L.file) }; }
      catch(e){ return { ok:false, msg:'拷不回来：' + (e && e.code || e) }; }
    },
    /* 这一家有哪几份出厂原文（信息页与「恢复出厂」的说明用得上） */
    factoryFiles(id){
      const base = path.join(FACT() || '\0', String(id));
      if(!ID_OK.test(String(id)) || !isDir(base)) return [];
      const out = [];
      const walk = (rel) => {
        for(const e of fs.readdirSync(path.join(base, rel), { withFileTypes:true })){
          if(e.name.startsWith('.')) continue;
          const r = rel ? rel + '/' + e.name : e.name;
          if(e.isDirectory()) walk(r);
          else out.push(r);
        }
      };
      try{ walk(''); }catch(e){ return []; }
      return out;
    },
    /* ---------- 第一趟：整棵 plugins 还没落地（新机器、整个文件夹拷过来）时，
       把自带那一层的一格格铺过去。已有的一个字不动，绝不覆盖用户改过的东西。 ---------- */
    seedMissing(){
      const root = LIVE(), fact = FACT();
      if(!root || !fact || !isDir(fact)) return { ok:true, laid:0, ids:[] };
      if(isDir(root) && fs.readdirSync(root).some(n => !n.startsWith('.'))) return { ok:true, laid:0, ids:[] };
      let laid = 0;
      const ids = [];
      try{
        fs.mkdirSync(root, { recursive:true });
        for(const e of fs.readdirSync(fact, { withFileTypes:true })){
          if(!e.isDirectory() || e.name.startsWith('.')) continue;
          if(!ID_OK.test(e.name)) continue;
          const to = path.join(root, e.name);
          if(isDir(to)) continue;
          laid += copyTree(path.join(fact, e.name), to);
          ids.push(e.name);
        }
        return { ok:true, laid, ids };
      }catch(e){ return { ok:false, msg:'出厂那一层铺不过来：' + (e && e.code || e), laid, ids }; }
    }
  };
};
