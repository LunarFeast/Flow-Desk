/* 外28 二组：拿真编码器 + 真调用口（diff）跑一章，量落盘大小和回放耗时
   打字量倍数 = （敲进去的字 + 删掉的字）÷ 成稿字数 */
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync("D:/Programs/Flow-Desk/src/_wnw/src/w20-keystroke.js", "utf8");
let buf = '';
const FD_APP = { appendPageFile:async(rel, text)=>{ buf += text; }, readPageFile:async()=>buf, pageFileExists:async()=>buf.length > 0 };
/* 上面那一版是"机器有多快敲多快"，毫秒差全是 0、1 —— 真人打字隔 40~300 毫秒一下，
   差值要写 2~3 位数字。这里给沙箱换一只假钟：每问一次时间就走 40~300 毫秒。 */
let 钟 = 1759000000000;
const 真Date = Date;
const 假Date = new Proxy(真Date, { construct(t, a){ return a.length ? new t(...a) : new t(钟); }, get(t, k){ return k === 'now' ? () => (钟 += Math.round(40 + Math.random() * 260)) : t[k]; } });
const ctx = { console, DB:{}, Blob, crypto, TextEncoder, WNW_DATA_PRE:'', Img:{ dir:() => '测试书' },
  Hist:{ dirOf:ch => '测试书' + '/history/' + ch },
  Work:{ book:{ id:'bk1' } }, location:{ protocol:'fdapp:' }, FD_APP, window:{ FD_APP }, Date:假Date };
vm.createContext(ctx);
vm.runInContext(src + "\n;globalThis.__KLog = KLog;", ctx);
const KLog = ctx.__KLog;
const KB = x => (x / 1024).toFixed(1) + ' KB';
const 目标字 = 15036;
const 字 = []; for(let i = 0; i < 目标字; i++) 字.push(String.fromCharCode(0x4e00 + (i % 2000)));
let seed = 7; const rnd = () => ((seed = seed * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);
const 词库 = []; for(let i = 0; i < 字.length; ){ const n = 1 + Math.floor(rnd() * 3); 词库.push(字.slice(i, i + n).join('')); i += n; }

async function run(倍){
  buf = ''; KLog.st.clear(); KLog.q.clear();
  let ps = ['']; let 段 = 0, k = 0, 敲 = 0, 删 = 0, 笔 = 0;
  const 要打 = Math.round(目标字 * 倍);
  const step = async fn => { const was = ps.slice(); fn(); 笔 += await KLog.diff('c1', was, ps); ps = ps.slice(); };
  const 成 = () => ps.reduce((s, x) => s + [...x].length, 0);
  while(敲 + 删 < 要打){
    const w = 词库[k++ % 词库.length];
    await step(() => { ps[段] += w; 敲 += [...w].length; });
    if(rnd() < 0.004){ const at = Math.floor(rnd() * (ps[段].length + 1)); await step(() => { const tail = ps[段].slice(at); ps[段] = ps[段].slice(0, at); ps.splice(段 + 1, 0, tail); 段++; }); }
    while(成() > 目标字 && 敲 + 删 < 要打){ const n = 1 + Math.floor(rnd() * 4); await step(() => { const cut = [...ps[段]]; const gone = cut.splice(Math.max(0, cut.length - n), n); if(!gone.length){ if(段 > 0){ 段--; return; } return; } ps[段] = cut.join(''); 删 += gone.length; }); }
  }
  while(成() > 目标字){ const n = 1 + Math.floor(rnd() * 3); const cut = [...ps[段]]; const gone = cut.splice(Math.max(0, cut.length - n), n); if(!gone.length) break; ps[段] = cut.join(''); 删 += gone.length; }
  const r0 = await KLog.decode('c1', buf);
  const t0 = process.hrtime.bigint(); for(let i = 0; i < 10; i++) await KLog.decode('c1', buf);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 10;
  const 对 = r0.paras.length === ps.length && ps.findIndex((x, i) => x !== r0.paras[i]) < 0;
  return { 笔:r0.n, ms, bytes:r0.bytes, seals:r0.seals, 成稿字:成(), 敲, 删, 段数:ps.length, 对, tamper:r0.tamper };
}

console.log('一章 ' + 目标字.toLocaleString('zh-CN') + ' 字 · 真编码器 + 真调用口（时间写十进制毫秒 · 一行一笔 · 每 200 笔一枚带钥匙指纹）\n');
for(const 倍 of [1, 2, 3, 5]){
  const r = await run(倍);
  console.log('  打字量 ' + 倍 + ' 倍（敲 ' + r.敲.toLocaleString('zh-CN') + ' 删 ' + r.删.toLocaleString('zh-CN') + '·' + r.段数 + ' 段）· 记录 '
    + String(r.笔).padStart(6) + ' 笔 · ' + KB(r.bytes).padStart(8) + ' · ' + (r.bytes / r.成稿字).toFixed(1) + ' 字节每成稿字 · '
    + r.seals + ' 枚指纹 · 重放逐字相同：' + (r.对 && r.tamper === 0 ? 'PASS' : 'FAIL') + ' · 从头解一遍 ' + ms(r) + ' 毫秒 · 一本 20 章 ' + (r.bytes * 20 / 1048576).toFixed(1) + ' MB');
}
function ms(r){ return r.ms.toFixed(1); }
const 老章底片 = '#B' + Date.now() + '|[' + (() => { const out = []; for(let i = 0; i < 字.length; ){ const n = 60 + (i % 7) * 13; out.push(JSON.stringify(字.slice(i, i + n).join(''))); i += n; } return out.join(','); })() + ']\n';
console.log('\n  老章补的那枚底片（15,036 字、134 段）= ' + KB(Buffer.byteLength(老章底片, 'utf8')) + ' · 新起的章 = ' + Buffer.byteLength('#B1759000000000|[]\n', 'utf8') + ' 字节（一次性的，不随打字长）');
console.log('  对照：现在存一版整本快照 = 54.3 KB · 笔落那口径 105 字节每字 = ' + KB(105 * 目标字));
