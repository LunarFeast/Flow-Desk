/* 外27 己组 · 造一份 90 秒的测试音 + 一张页内自采样页
   页里每一个 100 毫秒记一次 {Date.now(), audio.currentTime}（真实媒体钟），
   窗口另一路 node 探针记监听脚本的 (pos, at)。两边同一个墙钟，回来对齐就能算斜率。
   只写我自己的临时目录，不碰 D:\Programs\Flow-Desk。 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname.slice(1));
const SR = 44100, SEC = 90, N = SR * SEC;
const data = Buffer.alloc(N * 2);
for(let s = 0; s < SEC; s++){                    /* 每一秒开头一个 1200Hz、10ms 的提示音 */
  const start = s * SR, len = Math.floor(0.01 * SR);
  for(let i = 0; i < len; i++){
    const v = Math.round(12000 * Math.sin(2 * Math.PI * 1200 * i / SR) * Math.exp(-i / (SR * 0.003)));
    data.writeInt16LE(v, (start + i) * 2);
  }
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
h.write('data', 36); h.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(DIR, 'tone90.wav'), Buffer.concat([h, data]));

const html = `<!doctype html><meta charset="utf-8"><title>FD sync probe</title>
<style>body{font:14px/1.5 system-ui;padding:14px}b{font-size:18px}pre{background:#f4f4f6;padding:8px;max-height:220px;overflow:auto}</style>
<button id="go" style="font-size:16px;padding:8px 18px">开始放 90 秒</button>
<div>采样 <b id="n">0</b> 条 · 当前 currentTime <b id="c">0</b></div>
<audio id="a" src="tone90.wav"></audio>
<script>
const A = document.getElementById('a');
window.__S = []; window.__DONE = false; window.__T0 = 0;
let timer = null;
function pump(){ window.__S.push({ t: Date.now(), c: A.currentTime * 1000 });
  document.getElementById('n').textContent = window.__S.length;
  document.getElementById('c').textContent = (A.currentTime).toFixed(3); }
document.getElementById('go').onclick = async () => {
  window.__S = []; window.__DONE = false;
  A.currentTime = 0;
  await A.play();
  window.__T0 = Date.now();
  timer = setInterval(pump, 100);
  A.onended = () => { clearInterval(timer); window.__DONE = true; pump(); };
};
window.__GET = () => JSON.stringify({ t0: window.__T0, done: window.__DONE, s: window.__S });
</script>`;
fs.writeFileSync(path.join(DIR, 'smtc-sync.html'), html);
console.log('WROTE ' + path.join(DIR, 'smtc-sync.html') + '  tone90.wav ' + (44 + data.length) + ' bytes  ' + SEC + 's');
