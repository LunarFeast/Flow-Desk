/* 历史版本那一屏开不开得出来（外29 第 44 轮）：
   2026-10-07 现场报的是「点了完全没反应」—— 开层之前先 await 一笔读档，那一步吃的桥名字
   （FD_APP.pageFileExists）是同批才加进 preload 的，装着的壳落后一步就是 undefined，
   调用点又不 catch，于是既开不出来也不说一句话。这台断的就是这三道口子。
   跑的是真源码：Hist.app() 和 KLog.read() 从原文里抠出来塞进一个假对象进沙箱，不抄第二份。 */
import fs from 'node:fs';
import vm from 'node:vm';

const ROOT = 'D:/Programs/Flow-Desk';
const HIST = fs.readFileSync(ROOT + '/src/_wnw/src/w15-hist.js', 'utf8');
const KSH = fs.readFileSync(ROOT + '/src/_wnw/src/w20-keystroke.js', 'utf8');
const W8 = fs.readFileSync(ROOT + '/src/_wnw/src/w8-write.js', 'utf8');

/* 从「方法名(」起做花括号配平，切出来的就是原文那一段对象方法 */
function method(src, name){
  const i = src.search(new RegExp('\\n  (?:async )?' + name + '\\('));
  if(i < 0) throw new Error('找不到方法 ' + name);
  const j0 = src.indexOf('{', i + 1);
  let d = 0, j = j0;
  for(let k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i + 1, k + 1); }
  }
  throw new Error(name + ' 花括号没配平');
}
function block(src, marker){
  const i = src.indexOf(marker);
  if(i < 0) throw new Error('找不到 ' + marker);
  let d = 0, j = src.indexOf('{', i);
  for(let k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); }
  }
  throw new Error(marker + ' 花括号没配平');
}

let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log('  PASS ' + n); } else { fail++; console.log('  FAIL ' + n + (extra ? ' · ' + extra : '')); } };

/* ---------- 一、三道口子在源码里都堵上了没有 ---------- */
const ver = /  verDlg\(\)\{[^\n]*\n/.exec(W8);
ok('1 verDlg 接住了开层失败的每一笔（.catch），不再「点了没反应」', !!ver && /\.catch\(e *=> *toast\(/.test(ver[0]), (ver || ['没抓到这一句'])[0]);
ok('2 那句提示写的是人话，还带得出门的下一步（重新打包）', !!ver && /历史版本这一屏没打开/.test(ver[0]) && /得重新打包/.test(ver[0]), (ver || [''])[0]);

const openBody = block(HIST, 'async open(view)');
const before = openBody.slice(0, openBody.indexOf('Overlay.open('));
ok('3 那一行逐字统计读不到时不许挡住整层：取逐笔那一笔被 try 包住（第 50 轮起界面吃的是 KLog.steps，从前是 stats）',
   /try\{\s*K = await KLog\.steps\(c\.id\);\s*\}\s*catch/.test(before), before.slice(before.indexOf('KLog'), before.indexOf('KLog') + 90));
ok('4 读不到的时候界面上要有一枚说得出原因的记号（不是静静少一行字）',
   /kErr/.test(before) && /逐字记录读不到/.test(before));

const readBody = method(KSH, 'read');
ok('5 逐字记录那份文件「在不在」没装时，报的是白话而不是 TypeError',
   /if\(!FD_APP\.pageFileExists\) throw new Error\(/.test(readBody) && /没装上（程序壳没跟上，得重新打包）/.test(readBody));

/* ---------- 二、拿旧壳跑真函数：守卫得说「这条路走不通」，而不是走一半炸 ---------- */
const histApp = method(HIST, 'app'), klogApp = method(KSH, 'app');
function runApp(fdapp, proto){
  const sb = { window:{ FD_APP:fdapp }, location:{ protocol:proto || 'fdapp:' }, FD_APP:fdapp };
  vm.createContext(sb);
  vm.runInContext('globalThis.__o = { ' + histApp + ' };', sb);
  return sb.__o.app();
}
ok('6 壳里只有 writePageFile（就是这一批之前那一版的样子）→ Hist.app() 说 false，不去点没装的读那一步',
   runApp({ writePageFile(){} }) === false);
ok('7 四样齐了才说 true（writePageFile / readPageFile / openDir / pagePath）',
   runApp({ writePageFile(){}, readPageFile(){}, openDir(){}, pagePath(){} }) === true);
ok('8 开发服务器（协议不是 fdapp:）照旧 false —— 这一改动没把开发那一路带倒',
   runApp({ writePageFile(){}, readPageFile(){}, openDir(){}, pagePath(){} }, 'http:') === false);

async function readWith(fdapp){
  const sb = { window:{ FD_APP:fdapp }, location:{ protocol:'fdapp:' }, FD_APP:fdapp,
    DB:{ async get(){ return '库里的旧底片'; } }, console };
  vm.createContext(sb);
  vm.runInContext('globalThis.__k = { ' + klogApp + ',' + readBody +
    ', relOf(ch){ return "书/history/" + ch + "/keystroke.txt"; } };', sb);
  return await sb.__k.read('章1');
}
/* 旧壳：能读但读不动，且没有 pageFileExists 这个名字 */
let msg = '';
try{ const r = await readWith({ readPageFile(){ throw new Error('这一趟没读动'); } }); msg = '没抛，交回了「' + r + '」'; }
catch(e){ msg = String((e && e.message) || e); }
ok('9 拿旧壳跑真 read：报出来的是「主进程那个在不在没装上」，不是 TypeError，也没悄悄当成没记过（那一手会让整章正文重放两遍）',
   /在不在/.test(msg) && /没装上/.test(msg), msg);
/* 新壳：读不动但文件在 → 原样抛，不许吞 */
let msg2 = '';
try{ const r = await readWith({ readPageFile(){ throw new Error('这一趟没读动'); }, pageFileExists(){ return true; } }); msg2 = '没抛，交回了「' + r + '」'; }
catch(e){ msg2 = String((e && e.message) || e); }
ok('10 新壳下「文件在却没读动」照旧把原错抛出去（这道守卫不能被改松）',
   /没读动/.test(msg2), msg2);
/* 新壳：文件确实没有 → 交回空，走第一次建文件那条路 */
const r3 = await readWith({ readPageFile(){ throw new Error('ENOENT'); }, pageFileExists(){ return false; } });
ok('11 真没有这个文件时交回空串（第一次建文件那一路没被堵住）', r3 === '', JSON.stringify(r3));

console.log('\n' + pass + ' 过 ' + fail + ' 不过');
process.exit(fail ? 1 : 0);
