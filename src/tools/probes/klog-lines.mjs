/* 看一眼真跑出来的行长什么样：为什么 1 倍打字量是 110 KB 而不是上一轮那个 74 KB */
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync("D:/Programs/Flow-Desk/src/_wnw/src/w20-keystroke.js", "utf8");
let buf = '';
const FD_APP = { appendPageFile:async(rel, text)=>{ buf += text; }, readPageFile:async()=>buf, pageFileExists:async()=>buf.length>0 };
const ctx = { console, DB:{}, Blob, crypto, TextEncoder, WNW_DATA_PRE:'', Img:{ dir:() => '测试书' }, Hist:{ dirOf:ch => '测试书/history/' + ch },
  Work:{ book:{ id:'bk1' } }, location:{ protocol:'fdapp:' }, FD_APP, window:{ FD_APP } };
vm.createContext(ctx);
vm.runInContext(src + "\n;globalThis.__KLog = KLog;", ctx);
const KLog = ctx.__KLog;
const 目标字 = 15036;
const 字 = []; for(let i = 0; i < 目标字; i++) 字.push(String.fromCharCode(0x4e00 + (i % 2000)));
let seed = 7; const rnd = () => ((seed = seed * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);
const 词库 = []; for(let i = 0; i < 字.length; ){ const n = 1 + Math.floor(rnd() * 3); 词库.push(字.slice(i, i + n).join('')); i += n; }
let ps = ['']; let 段 = 0, k = 0;
async function step(fn){ const was = ps.slice(); fn(); await KLog.diff('c1', was, ps); }
for(let 成 = 0; 成 < 目标字; ){
  const w = 词库[k++ % 词库.length];
  await step(() => { ps[段] += w; });
  成 += [...w].length;
  if(rnd() < 0.004){ const at = Math.floor(rnd() * (ps[段].length + 1)); await step(() => { const tail = ps[段].slice(at); ps[段] = ps[段].slice(0, at); ps.splice(段 + 1, 0, tail); 段++; }); }
}
const L = buf.trim().split('\n');
const pct = f => (100 * L.filter(f).length / L.length).toFixed(0) + '%';
console.log('笔数 ' + L.length + ' · 文件 ' + (Buffer.byteLength(buf, 'utf8') / 1024).toFixed(1) + ' KB · 段数 ' + ps.length);
console.log('带 @ 的行 ' + pct(x => x.split('|')[0].includes('@')) + ' · 带 s 的行 ' + pct(x => /s\d/.test(x.split('|')[0])));
const R = L.filter(x => /^\d/.test(x));
console.log('记录行 ' + R.length + ' · 平均 ' + (R.reduce((a, x) => a + x.length, 0) / R.length).toFixed(1) + ' 字符 · 毫秒差位数平均 ' + (R.reduce((a, x) => a + /^\d+/.exec(x)[0].length, 0) / R.length).toFixed(1));
console.log('最长的三行：' + R.slice().sort((a, b) => b.length - a.length).slice(0, 3).join(' ⏎ '));
console.log('样例前 12 行：\n  ' + L.slice(0, 12).join('\n  '));
