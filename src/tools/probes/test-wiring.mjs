/* 外28 二组接线自检：把 w8-write.js 里真发出去的那几句（logKeys 本体 + dirty 里那一喊）
   原样搬出来跑，不抄第二份。查的是接线，不是编码器（编码器由 test-klog.mjs 管）。 */
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync("D:/Programs/Flow-Desk/src/_wnw/src/w8-write.js", "utf8");
const body = /(^|\n)  logKeys\(\)\{[\s\S]*?\n  \}/.exec(src);
if(!body){ console.log('FAIL 在 w8-write.js 里找不到 logKeys 本体'); process.exit(1); }
const dirty = /(^|\n)  dirty\(\)\{([\s\S]*?)\n  \}/.exec(src);
const 喊在第一位 = /this\.logKeys\(\);/.test(dirty[2]) && dirty[2].indexOf('this.logKeys()') < dirty[2].indexOf('clearTimeout');
console.log((喊在第一位 ? 'PASS' : 'FAIL') + ' · dirty() 一进来先记逐字，再排 1.2 秒那次存正文（顺序错了会把改动记到下一次之后）');

/* 真源码搬进沙箱：logKeys 里用到的 KLog 走真那份 */
let buf = '';
const FD_APP = { appendPageFile:async(rel, text)=>{ buf += text; }, readPageFile:async()=>buf, pageFileExists:async()=>buf.length > 0 };
/* 逐字记录问历史那一层要目录（w15-hist.js 的 Hist.dirOf），沙箱照同一个式子给一份 */
const k = fs.readFileSync("D:/Programs/Flow-Desk/src/_wnw/src/w20-keystroke.js", "utf8");
const ctx = { console, DB:{}, Blob, crypto, TextEncoder, WNW_DATA_PRE:'', Img:{ dir:() => '测试书' },
  Hist:{ dirOf:ch => '测试书' + '/history/' + ch },
  Work:{ book:{ id:'bk1' } }, location:{ protocol:'fdapp:' }, FD_APP, window:{ FD_APP }, toast(){}, drawFoot(){},
  LYRIC_MODE:'lyric' };
vm.createContext(ctx);
vm.runInContext(k + "\n;globalThis.__KLog = KLog;", ctx);
const KLog = ctx.__KLog;
/* 把真源码那一段方法体拼成函数跑（只搬自己仓里这个文件，不是外部输入） */
const 方法体 = body[0].replace(/^\n?  logKeys\(\)\{/, '').replace(/\n  \}$/, '');
const logKeys = new Function('KLog', 'LYRIC_MODE', 'return async function logKeys(){' + 方法体 + '}')(KLog, 'lyric');

/* 假一个 ChView：这一章开着，敲两下、分一段、再来一次撤销 */
const view = { c:{ id:'ch9', mode:'write', paras:[{ t:'' }] }, kWas:null, drawFoot(m){ console.log('  页脚：' + m); }, logKeys };
async function 敲(fn2){ fn2(view.c); view.kWas = null; const was = view.kWas; }
let 抄 = null;
async function 改一下(label, fn2){
  const was = (view.c.paras || []).map(p => p.t || '');
  fn2(view.c);
  view.kWas = was;
  await view.logKeys();
  await KLog.diff; /* 排队那条路：等一轮 */
  await new Promise(r => setTimeout(r, 30));
  console.log('  ' + label + ' → 记录到第 ' + buf.trim().split('\n').filter(x => !x.startsWith('#')).length + ' 笔');
}
await 改一下('打字「我们」', c => { c.paras[0].t += '我们'; });
await 改一下('回车分段', c => { c.paras.push({ t:'' }); });
await 改一下('第二段打字', c => { c.paras[1].t += '记录每一步'; });
await 改一下('撤销回上一段', c => { c.paras[1].t = ''; c.paras.pop(); c.paras[0].t = '我们'; });
const r = await KLog.decode('ch9', buf);
const 现在 = view.c.paras.map(p => p.t);
console.log((r.paras.length === 现在.length && r.paras.every((x, i) => x === 现在[i]) ? 'PASS' : 'FAIL') + ' · 走真接线记下来的那几笔，重放回来跟正文一模一样（' + JSON.stringify(r.paras) + '）');
console.log('记录原文：\n  ' + buf.trim().split('\n').join('\n  '));
