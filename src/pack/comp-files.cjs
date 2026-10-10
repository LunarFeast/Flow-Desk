/* ============================================================
   插件文件层 · 主进程和开发探针共用的同一把尺
   ----------
   插件的代码和自带文件都住在 data\plugins\<id>\ 这一格里：
   「改代码」改的就是这一格里的 main.js，存了就是新的，刷新这一页立刻生效 ——
   不再有「写一份覆盖副本、等重新生成页面才嵌进去」那一趟。
   原版在 data\plugins-factory\<id>\：导入那一下顺手真复制一份进去（程序自带的那一份从前住
   resources\app\data\plugins\，外43 撤了 —— 插件跟主程序分开各自开发、各自发布，发布物里不许带插件代码；
   那一层又每次更新都被整个换掉，用户的底放进去等于交给更新撤走）。
   「恢复出厂」就是从原版那一格把这一格的文件拷回来（真复制，不用硬链接：
   链接会让活文件和底变成同一份，改了活的等于改了底，恢复出厂就成了空话）。
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
  const FACT = () => dir('factory');       /* data\plugins-factory\ —— 导入时留的原版 */

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
  /* 原版那一格里对应的位置（恢复出厂用） */
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

    /* ---------- 恢复出厂：从原版那一格把这一份原样拷回来 ---------- */
    restore(id, rel){
      const r = String(rel || 'main.js');
      const L = locate(id, r);
      if(L.msg) return { ok:false, msg:L.msg };
      const from = factFile(L.id, segsOf(r));
      if(!from) return { ok:false, msg:'原版那一格里没有这一家（' + L.id + '）的这一份 · 导入那一下才会留底，留了底才恢复得了' };
      try{ return { ok:true, size:copyFile(from, L.file) }; }
      catch(e){ return { ok:false, msg:'拷不回来：' + (e && e.code || e) }; }
    },
    /* 这一家有哪几份原版（信息页与「恢复出厂」的说明用得上） */
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
    /* ---------- 导入那一下顺手留底：把活的那一格原样复制进原版那一格 ----------
       真复制、不用链接（链接会让活文件和底变成同一份，「改代码」存一下就改了底，恢复出厂成空话）。
       先抹掉旧的再拷：这一格里不许留下一个新版没有的文件，不然「恢复出厂」会拿老文件补回新版里删掉的那份。
       只在导入 / 摊开那一条道上调用 —— 用户改过的东西绝不会被这一步碰到。 */
    keepFactory(id){
      const L = locate(id);
      if(L.msg) return { ok:false, msg:L.msg };
      if(!isDir(L.file)) return { ok:false, msg:'这一格还不在，留不出底：' + L.id };
      const fact = FACT();
      if(!fact) return { ok:false, msg:'原版那一格还没定下来' };
      const to = path.join(fact, L.id);
      if(to !== fact && !to.startsWith(fact + path.sep)) return { ok:false, msg:'落点跑出了原版那一格' };
      try{
        fs.rmSync(to, { recursive:true, force:true });
        const n = copyTree(L.file, to);
        return { ok:true, files:n, where:L.id + '/' };
      }catch(e){ return { ok:false, msg:'留底没留成：' + (e && e.code || e) }; }
    },
    /* ---------- 老树那一下：原版从前住在程序自带那一层（resources\app\data\plugins\），
       外43 挪进数据层。第一次开机从老位置一家家取过来，目标已经有这一家的一个字不动。
       只取不删：老那一格在程序层，下一次更新包换程序层时自己就没了。 */
    adoptOldFactory(from){
      const fact = FACT();
      const out = { moved:[], files:0 };
      if(!fact || !from || !isDir(from)) return out;
      if(path.resolve(from) === path.resolve(fact)) return out;
      try{
        fs.mkdirSync(fact, { recursive:true });
        for(const e of fs.readdirSync(from, { withFileTypes:true })){
          if(!e.isDirectory() || e.name.startsWith('.') || !ID_OK.test(e.name)) continue;
          if(!isFile(path.join(from, e.name, 'manifest.json'))) continue;
          const to = path.join(fact, e.name);
          if(isDir(to)) continue;
          out.files += copyTree(path.join(from, e.name), to);
          out.moved.push(e.name);
        }
      }catch(err){ return Object.assign(out, { msg:'原版那一格取不过来：' + (err && err.code || err) }); }
      return out;
    }
  };
};
