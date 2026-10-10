/* ============================================================
   插件越界扫描（两个构建各跑一次，命中就停下）

   为什么要有这一把尺：ES module 只把插件自己的顶层名字藏起来了，
   宿主那些经典脚本里的全局名（Store / Shell / Cover / Bus / Registry / PACK_META …）
   在模块里照样看得见 —— 实测在产物页面里 import 一段模块代码，typeof Store 就是 "object"。
   所以「组件只能走 ctx」这一条不是加载方式白给的，得有人查。

   查法三步：
     1 先把注释和字符串整段抹平（说明文字里提一句「宿主的 Store」不算越界）；
     2 记下这一家自己声明的局部名（const State = … 那种转发垫片把全局名挡住了，不算越界）；
     3 剩下的代码里逐个认禁用名，再看 document.x / window.x 点名外的那几个。
   命中就报「哪一家 · 第几行 · 引用了宿主的什么 · 该走哪条通道」，改的人一看就知道往哪儿挪。

   命令行走一句：node src/_build/scan-packs.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import tree from './tree.cjs';

/* 禁用名 → 该走的通道（这句话原样打进报错里，所以写明白） */
export const FORBID = {
  FD_APP: '要后台通道就在说明书 appChannels 里点名，运行时用 ctx.app',
  dataRead: 'ctx.store', dataWrite: 'ctx.store', dataList: 'ctx.store',
  readPageFile: '不开放（这是宿主自己的文件通道）', writePageFile: '不开放', writePageBytes: '不开放',
  delPageFile: '不开放', pagePath: '不开放', pathOf: '不开放',
  packList: '不开放（装卸归宿主）', packSet: '不开放（装卸归宿主）', packWipe: '不开放（装卸归宿主）',
  packImport: '不开放（装卸归宿主）', rebuild: '不开放（重新生成页面归宿主）',
  updInfo: '不开放（更新归宿主）', updPick: '不开放', updPlan: '不开放', updStart: '不开放',
  winCtl: '不开放（窗口归宿主）', restartApp: '不开放', closeChoice: '不开放',
  Store: 'ctx.store', Settings: 'ctx.settings', Modal: 'ctx.dialog', Overlay: 'ctx.dialog',
  Cover: 'ctx.cover', SetupTabs: '插件自己的齿轮对话框 settings(ctx)',
  Bus: 'ctx.bus', State: 'ctx.state', Banks: 'ctx.banks 或 ctx.bank(which)', mkBank: 'ctx.bank(which)',
  Theme: 'ctx.theme', Palette: 'ctx.theme', Shell: 'ctx.rerenderDesktop() / ctx.rerenderClock()',
  Registry: '不开放（注册表归宿主）', WIDGET_BASE: '不开放', Tools: '不开放', TOOL_BASE: '不开放',
  TOOL_DEFS: '不开放', Views: '不开放', Desk: '不开放', Work: '不开放',
  Packs: 'ctx.pack', PackOps: '不开放（装卸归宿主）', PackLoader: '不开放', PackCtx: '不开放',
  PACK_META: 'ctx.pack', FD_PACKS: 'ctx.pack',
  IDB: '数据必须经宿主落明文', localStorage: '数据必须经宿主落明文', indexedDB: '数据必须经宿主落明文',
  registerWidget: '登记由加载器按说明书 type 做，插件自己不调',
  registerTool: '登记由加载器按说明书 type 做，插件自己不调',
  Gen: '配方就是 export default 那一份，登记由加载器做',
  icoMarkup: 'ctx.icon', Ico: 'ctx.icon', Phrase: 'ctx.phrase',
  eval: '不许运行时造代码', Function: '不许运行时造代码'
};
/* document / window 上只认这几个：是浏览器自己的本事，不是 Flow-Desk 的内部 */
const DOC_OK = ['activeElement', 'hidden', 'visibilityState', 'createDocumentFragment',
  'createElement', 'addEventListener', 'removeEventListener'];
const WIN_OK = ['showOpenFilePicker', 'showDirectoryPicker', 'matchMedia', 'addEventListener',
  'removeEventListener', 'innerWidth', 'innerHeight', 'getComputedStyle', 'requestAnimationFrame',
  'navigator', 'location'];

/* 注释和字符串整段抹成空格（换行留着，行号才对得上） */
function strip(src){
  const out = [];
  let i = 0, mode = '', quote = '';
  const n = src.length;
  while(i < n){
    const c = src[i], nx = src[i + 1];
    if(mode === ''){
      if(c === '/' && nx === '*'){ mode = 'block'; out.push(' ', ' '); i += 2; continue; }
      if(c === '/' && nx === '/'){ mode = 'line'; out.push(' ', ' '); i += 2; continue; }
      if(c === '"' || c === "'" || c === '`'){ mode = 'str'; quote = c; out.push(' '); i++; continue; }
      out.push(c); i++; continue;
    }
    if(mode === 'block'){
      if(c === '*' && nx === '/'){ mode = ''; out.push(' ', ' '); i += 2; continue; }
      out.push(c === '\n' ? '\n' : ' '); i++; continue;
    }
    if(mode === 'line'){
      if(c === '\n'){ mode = ''; out.push('\n'); i++; continue; }
      out.push(' '); i++; continue;
    }
    if(c === '\\'){ out.push(' ', ' '); i += 2; continue; }        /* 转义：连后面那个字符一起抹 */
    if(c === quote){ mode = ''; out.push(' '); i++; continue; }
    out.push(c === '\n' ? '\n' : ' '); i++; continue;
  }
  return out.join('');
}

/* 这一家自己声明的局部名：const / let / var / class / function、解构、参数、对象简写都算 */
function localNames(code){
  const names = new Set();
  for(const m of code.matchAll(/\b(?:const|let|var|class|function)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for(const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g))
    for(const p of m[1].split(',')){ const t = p.split(':').pop().trim().replace(/^\.\.\./, ''); if(/^[A-Za-z_$][\w$]*$/.test(t)) names.add(t); }
  for(const m of code.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]/g))
    for(const p of m[1].split(',')){ const t = p.trim().replace(/^\.\.\./, ''); if(/^[A-Za-z_$][\w$]*$/.test(t)) names.add(t); }
  /* 箭头函数和函数参数：(a, b) => / function f(a, b) */
  for(const m of code.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g))
    for(const p of m[1].split(',')){ const t = p.split(/[=:\s]/).pop().trim(); if(/^[A-Za-z_$][\w$]*$/.test(t)) names.add(t); }
  for(const m of code.matchAll(/\bfunction\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g))
    for(const p of m[1].split(',')){ const t = p.split(/[=:\s]/).pop().trim(); if(/^[A-Za-z_$][\w$]*$/.test(t)) names.add(t); }
  return names;
}

function scanFile(id, file, src){
  const hits = [];
  const code = strip(src);
  const locals = localNames(code);
  const raw = src.split('\n');
  code.split('\n').forEach((line, idx) => {
    for(const m of line.matchAll(/[A-Za-z_$][\w$]*/g)){
      const w = m[0];
      if(locals.has(w)) continue;
      const why = Object.hasOwn(FORBID, w) ? FORBID[w] : null;
      if(!why) continue;
      const before = line.slice(0, m.index);
      if(/[.]\s*$/.test(before)) continue;                      /* obj.Store 这种成员访问另说 */
      if(/\b(?:const|let|var|class|function)\s+$/.test(before)) continue;
      const after = line.slice(m.index + w.length);
      if(/^ *:/.test(after) && !/\?\s*$/.test(before)) continue;  /* { State: x } 这种键名放过 */
      hits.push({ id, file, line:idx + 1, name:w, why, text:(raw[idx] || '').trim().slice(0, 160) });
    }
    for(const m of line.matchAll(/\b(document|window)\.([A-Za-z_$][\w$]*)/g)){
      const ok = (m[1] === 'document' ? DOC_OK : WIN_OK).includes(m[2]);
      if(ok) continue;
      hits.push({ id, file, line:idx + 1, name:m[0],
        why:'容器由宿主递给你，宿主的节点和 window 上的东西不碰', text:(raw[idx] || '').trim().slice(0, 160) });
    }
  });
  return hits;
}

/* 扫 data\plugins\ 这一层：返回 [{ id, file, line, name, why, text }] */
export function scanPacks(componentsDir){
  const hits = [];
  if(!fs.existsSync(componentsDir)) return hits;
  for(const d of fs.readdirSync(componentsDir)){
    const dir = path.join(componentsDir, d);
    let st = null;
    try{ st = fs.statSync(dir); }catch(e){ continue; }
    if(!st.isDirectory()) continue;
    for(const ent of fs.readdirSync(dir)){
      if(!/\.js$/.test(ent)) continue;
      try{ hits.push(...scanFile(d, ent, fs.readFileSync(path.join(dir, ent), 'utf8'))); }catch(e){}
    }
  }
  return hits;
}

export function report(hits){
  for(const h of hits) console.error('组件「' + h.id + '」越界 · ' + h.file + ':' + h.line +
    ' 引用了宿主的 ' + h.name + ' —— ' + h.why + '\n    ' + h.text);
}

/* 构建那边就调这一句：有命中打印出来 + 返回 false，调用方自己 process.exit(1) */
export function assertClean(componentsDir, tag){
  const hits = scanPacks(componentsDir);
  if(hits.length){ report(hits); console.error('插件越界扫描 · ' + hits.length +
    ' 处，' + (tag || '生成页面') + '停下：把这些改成 ctx 上的通道再跑。'); return false; }
  console.log('插件越界扫描 · 通过（' + (tag || '') + '）：' + componentsDir);
  return true;
}

/* 命令行直接跑 */
if(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)){
  const dir = path.join(tree(import.meta.dirname).data, 'plugins');
  const hits = scanPacks(dir);
  if(!hits.length) console.log('插件越界扫描 · 一家都没越界：' + dir);
  else{ report(hits); console.error('共 ' + hits.length + ' 处'); process.exitCode = 1; }
}
