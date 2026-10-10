/* 外28 一组自检：把 w20-keystroke.js 那份真源码搬进沙箱跑，不抄第二份。
   驱动方式跟正文那头一模一样：改一摞段文本 → 把改前改后交给 KLog.diff。 */
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync("D:/Programs/Flow-Desk/src/_wnw/src/w20-keystroke.js", "utf8");
let buf = '', 读不动 = false;
/* Hist 那一个文件（w15-hist.js）在真页面里排在前面，逐字记录的目录就是问它要 —— 沙箱照同样的式子给一份 */
const WNW_DATA_PRE = '';
const FD_APP = { appendPageFile:async(rel, text)=>{ buf += text; },
  readPageFile:async()=>{ if(读不动) throw new Error('被别的程序锁住了'); return buf; },
  pageFileExists:async()=>buf.length > 0 };
const ctx = { console, DB:{}, Blob, crypto, TextEncoder, WNW_DATA_PRE, Img:{ dir:() => '测试书' },
  Hist:{ dirOf:ch => WNW_DATA_PRE + '测试书' + '/history/' + ch },
  Work:{ book:{ id:'bk1' } }, location:{ protocol:'fdapp:' }, FD_APP, window:{ FD_APP } };
vm.createContext(ctx);
vm.runInContext(src + "\n;globalThis.__KLog = KLog;", ctx);
const KLog = ctx.__KLog;
KLog.FP_EVERY = 8;                       /* 真档是 200，这里调小好把指纹那条路跑到 */
let pass = 0, fail = 0;
const ok = (n, c, extra) => { if(c){ pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + (extra ? " · " + extra : "")); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- 一、只追加：这一个文件里有没有改写或删除的路 ---------- */
const 危险 = Object.keys(KLog).filter(n => /^(drop|del|remove|erase|clear|overwrite|rewrite|trunc)/i.test(n));
ok("1 没有删除或改写某几笔的函数（方法名里查不到 drop/del/remove/overwrite 那一类）", 危险.length === 0, 危险.join(","));
ok("2 落盘只有 read 和 put 两口，put 走的是 appendPageFile", /appendPageFile\(this\.relOf/.test(src) && !/writePageFile/.test(src));

/* ---------- 二、真打字序列 ---------- */
const CH = 'ch01';
let ps = [''];
let seed = 5; const rnd = () => ((seed = seed * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);
const 词 = ['我们', '记录', '每一步', '写作', '的', '过程', '，', '包括', '删掉', '那些', '字', '。', 'a\\b', 'x|y', '1234', '"引号"'];
async function step(fn){ const was = ps.slice(); fn(); await KLog.diff(CH, was, ps); await sleep(1); }
const type = (pi, w) => step(() => { ps[pi] = (ps[pi] || '') + w; });
const erase = (pi, n) => step(() => { ps[pi] = [...ps[pi]].slice(0, Math.max(0, [...ps[pi]].length - n)).join(''); });
const split = (pi, at) => step(() => { const tail = ps[pi].slice(at); ps[pi] = ps[pi].slice(0, at); ps.splice(pi + 1, 0, tail); });
const join = (pi) => step(() => { ps[pi - 1] = ps[pi - 1] + ps[pi]; ps.splice(pi, 1); });
const delPara = (pi) => step(() => { ps.splice(pi, 1); });
const paste = (pi, arr) => step(() => { ps.splice(pi, 1, ...arr); });

let 段 = 0, 撤销点 = null;
for(let i = 0; i < 46; i++){
  if(i === 20) 撤销点 = ps.slice();
  await type(段, 词[Math.floor(rnd() * 词.length)]);
  if(rnd() < 0.18) await erase(段, 1 + Math.floor(rnd() * 3));
  if(rnd() < 0.10){ const at = Math.floor(rnd() * (ps[段].length + 1)); await split(段, at); 段++; }
  if(rnd() < 0.05 && 段 > 0){ await join(段); 段--; }
}
await type(段, '中间回改');
{ const b = ps[0]; ps[0] = b.slice(0, 2) + '（插一段）' + b.slice(2); await KLog.diff(CH, [b, ...ps.slice(1)].slice(0, ps.length), ps); }
await delPara(1);                                        /* 删掉一整段 */
await paste(ps.length - 1, ['粘贴第一段', '粘贴第二段', '粘贴第三段']);   /* 一段换三段 */
{ const now = 撤销点.slice(); const was = ps.slice(); ps = now; await KLog.diff(CH, was, ps); }   /* 撤销回 20 步之前 */
{ const was = ps.slice(); ps = was.concat(['收尾又起一段']); await KLog.diff(CH, was, ps); }

const txt = await KLog.read(CH);
const r = await KLog.decode(CH, txt);
ok("3 段数对得上（解出 " + r.paras.length + " 段，正文 " + ps.length + " 段）", r.paras.length === ps.length);
const bad = ps.findIndex((x, i) => x !== r.paras[i]);
ok("4 每一段逐字相同", bad < 0, bad >= 0 ? ("第 " + (bad + 1) + " 段 应 " + JSON.stringify(ps[bad]) + " 解出 " + JSON.stringify(r.paras[bad])) : "");
ok("5 反斜杠、竖线、引号、数字这些字面没被记号吃掉", txt.includes('a\\\\b') || r.paras.join("").includes("a\\b")) ;
ok("6 每 " + KLog.FP_EVERY + " 笔一枚指纹（" + r.n + " 笔 · " + r.seals + " 枚）", r.n > 40 && r.seals >= Math.floor(r.n / KLog.FP_EVERY));
ok("7 没动过的时候 tamper = 0", r.tamper === 0);

/* ---------- 三、篡改 ---------- */
const L = txt.split("\n");
const at1 = L.findIndex(l => l && l[0] !== "#");
const 改一笔 = L.slice(); 改一笔[at1 + 2] = 改一笔[at1 + 2].replace(/\|/, '|x');
const t1 = await KLog.decode(CH, 改一笔.join("\n"));
ok("8 改中间一笔 → 当场报对不上（tamper=" + t1.tamper + "）", t1.tamper >= 1);
const 改底片 = L.slice(); 改底片[0] = 改底片[0].replace(/"|"$/, '","偷偷"]');
const t2 = await KLog.decode(CH, 改底片.join("\n"));
ok("9 换掉底片 → 同样报对不上（tamper=" + t2.tamper + "）", t2.tamper >= 1);
{
  const 假 = Object.assign(Object.create(Object.getPrototypeOf(KLog)), KLog, { KEY:'别人自己造的钥匙' });
  let seg = '', prev = '', k = 0; const out = [];
  for(const l of 改一笔){ if(l.startsWith('#S')){ const d = await 假.seal(prev + seg); out.push('#S' + (++k) + ' ' + d); prev = d; seg = ''; } else { if(l) seg += l + '\n'; out.push(l); } }
  const t3 = await KLog.decode(CH, out.join("\n"));
  ok("10 改完再把后面的链整条重算一遍（没有那把钥匙）→ 照样对不上（tamper=" + t3.tamper + "）", t3.tamper >= 1);
}

/* ---------- 四、重开程序接着记 ---------- */
const 前 = r.n;
KLog.st.clear();
{ const was = ps.slice(); ps = was.concat(['重开后再敲']); await KLog.diff(CH, was, ps); }
const r4 = await KLog.decode(CH, await KLog.read(CH));
ok("11 清掉内存、重开、再记一笔：笔数接着长（" + 前 + " → " + r4.n + "，这一趟真记 2 笔：切一刀 + 填字）", r4.n === 前 + 2);
ok("12 重开后链仍然对得上（tamper=" + r4.tamper + "）", r4.tamper === 0);
ok("13 重开那一笔的落点接得上", ps.length === r4.paras.length && ps.findIndex((x, i) => x !== r4.paras[i]) < 0,
   "末段 正文 " + JSON.stringify(ps[ps.length - 1]) + " / 解出 " + JSON.stringify(r4.paras[r4.paras.length - 1]));

/* ---------- 四点五、外28 第 22 轮改的那六处 ---------- */
ok("14 目录口径只有一处：逐字记录问的是历史那一层的算法", KLog.dirOf('ch01') === ctx.Hist.dirOf('ch01')
   && !/WNW_DATA_PRE \+ Img\.dir\(\)/.test(src), 'w20 里还留着一份抄的式子');

{ /* 读不动 ≠ 没记过：绝不能一声不吭往同一个文件尾巴再补一枚底片 */
  const 底片数 = (buf.match(/^#B/gm) || []).length;
  KLog.st.delete(CH); 读不动 = true;
  let 抛 = ''; try{ await KLog.open(CH, ['随便']); }catch(e){ 抛 = e.message; }
  读不动 = false;
  await KLog.open(CH, ps);   /* 内存里那份状态被这一步删掉了，找回来给后面的用例用 */
  const 底片数2 = (buf.match(/^#B/gm) || []).length;
  ok("15 文件在、这一趟没读动 → 报错出去，不多补一枚底片（底片 " + 底片数 + " → " + 底片数2 + "）",
     抛.length > 0 && 底片数2 === 底片数, 抛 || '没报错');
}

{ /* 跑在 exe 里却没有只追加那条路 → 宁可报错，不许转存浏览器库 */
  const 原 = FD_APP.appendPageFile; delete FD_APP.appendPageFile;
  let 抛 = ''; try{ await KLog.put(CH, 'x\n'); }catch(e){ 抛 = e.message; }
  FD_APP.appendPageFile = 原;
  ok("16 桥没装只追加那一条 → 报出去（不是静默转存）", /只追加/.test(抛), 抛 || '没报错');
}

{ /* 隔几十天再动笔：时间差原样记下，不再被 11.5 天那顶帽子夹掉 */
  const s = KLog.st.get(CH); const 起 = s.last;
  const 隔 = 40 * 86400 * 1000 + 7;
  const line = await KLog.add(CH, { pi:0, at:0, ins:'隔了四十天', at_ms:起 + 隔 });
  ok("17 隔 40 天那一笔记的是真数（" + line.match(/^\d+/)[0] + "）", line.match(/^\d+/)[0] === String(隔));
}

{ /* 时刻由喊声那头带进来：同一批的两笔（先删后填）共用手指动的那一下 */
  const s = KLog.st.get(CH); const 刻 = s.last + 5000;
  const was = ps.slice(); const 末 = ps.length - 1;
  ps[末] = ps[末].slice(0, -1) + 'XY';                  /* 末字换两字 → 一笔删、一笔填 */
  await KLog.diffNow(CH, was, ps, 刻);
  /* 尾巴上可能夹着一枚刚补的指纹行，只数真正是记录的那两行 */
  const 尾 = buf.trimEnd().split('\n').filter(l => l && l[0] !== '#').slice(-2).map(l => l.match(/^\d+/)[0]);
  ok("18 一批两笔共用喊声那一刻（间隔记作 " + 尾.join(' 和 ') + "，不是排队排到才取的时间）",
     s.last === 刻 && 尾[0] === '5000' && 尾[1] === '0');
}

{ /* 指纹行里那个「第几枚」现在参与对账 */
  const L2 = buf.split('\n');
  const i = L2.findIndex(l => l.startsWith('#S'));
  const 改号 = L2.slice(); 改号[i] = '#S' + (Number(改号[i].slice(2)) + 7) + 改号[i].slice(2).replace(/^\d+/, '');
  const t4 = await KLog.decode(CH, 改号.join('\n'));
  ok("19 把指纹行那个号改一下（链没断）→ 也报对不上（tamper=" + t4.tamper + "）", t4.tamper >= 1);
}

/* ---------- 五、体积和回放耗时 ---------- */
const 成稿字 = r.paras.join("").length;   /* 用重放出来的那份，别用后面新用例改过的 ps */
let t0 = process.hrtime.bigint(); for(let i = 0; i < 10; i++) await KLog.decode(CH, txt);
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 10;
console.log("\n体积：" + r.n + " 笔 · 文件 " + (r.bytes / 1024).toFixed(2) + " KB · 成稿 " + 成稿字 + " 字 · 每成稿字 " + (r.bytes / 成稿字).toFixed(1) + " 字节");
console.log("回放：从头解一遍 " + ms.toFixed(1) + " 毫秒（10 遍平均，含 " + r.seals + " 枚指纹当场重算）");
console.log("头八行：\n  " + txt.split("\n").slice(0, 8).join("\n  "));
console.log("\n" + pass + " 过 " + fail + " 不过");
process.exit(fail ? 1 : 0);
