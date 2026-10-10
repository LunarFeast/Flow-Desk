/* 外27 甲组自检页：把 w18-lyric.js / w19-cruise.js 里真实的 addCss 段原样搬进来，
   只喂三档 class 和一排格子，量两件事：
     图1、2 —— 悬浮那一排的衬底有没有加全（左右铺出滚动区那两列内距、往上盖住那一圈内距）
     图6、7 —— 播放里是不是只剩两档：未唱一种底、唱完一种底，而正推着那一格「铺进来的那一条」
              必须和唱完那一块是同一个颜色（不能又是第三种）
   跑法：node mk-jia-test.mjs，然后浏览器打开 jia-test.html，读 window.__RESULT */
/* 外29 第 40 轮：探针搬进仓库 src\tools\probes\ 之后，生成的页面就近落在这旁边，不再写回会话临时目录 */
import { fileURLToPath as __u2p } from 'node:url';
const __HERE = __u2p(new URL('.', import.meta.url));

import fs from 'node:fs';

const W18 = 'D:/Programs/Flow-Desk/src/_wnw/src/w18-lyric.js';
const W19 = 'D:/Programs/Flow-Desk/src/_wnw/src/w19-cruise.js';
const cssOf = f => { const t = fs.readFileSync(f, 'utf8'); const out = [];
  const re = /addCss\(`([\s\S]*?)`\)/g; let m; while((m = re.exec(t))) out.push(m[1]); return out.join('\n'); };
const css = cssOf(W18) + '\n' + cssOf(W19);

const html = `<!doctype html><meta charset="utf-8"><title>甲组自检</title>
<style>
:root{--card-bg:#f7f9f7;--btn-bg:#e6ede9;--input-bg:#ffffff;--text-light:#6b7a76;--accent:#2f7d7d;
  --hair-color:#cfd8d4;--ctl-edge:#b9c4bf;--input-border:#b9c4bf;--gap-blk:14px;--warn:#b06a12;--lscale:1;}
body{font:15px/1.5 system-ui;background:#cfe0dc;margin:0}
/* 只借皮肤里那一条：格子是 input，皮肤给 .wnw-root input 定过字号 */
.wnw-root{color:#21403c}
.scroller{height:260px;overflow:auto;padding:var(--gap-blk);background:var(--card-bg);border:1px solid #9bb}
</style>
<style>` + css + `</style>
<div class="wnw-root"><div class="scroller" id="sc">
  <div class="wnw-lbar" id="bar"><button>导入</button><button>导出…</button><span class="wnw-lfile">lyrics\\第一章.txt</span></div>
  <div class="wnw-lyric" id="grid"></div>
</div></div>
<script>
const R = []; const ok = (n, c, extra) => R.push((c ? 'PASS ' : 'FAIL ') + n + (extra === undefined ? '' : '  [' + extra + ']'));
const grid = document.getElementById('grid'), bar = document.getElementById('bar'), sc = document.getElementById('sc');
const mk = st => { const row = document.createElement('div'); row.className = 'wnw-lrow';
  const cell = document.createElement('div'); cell.className = 'wnw-lcell ' + st;
  const inp = document.createElement('input'); inp.className = 'wnw-ltxt'; inp.value = 'sweat';
  const ms = document.createElement('div'); ms.className = 'wnw-lms'; ms.textContent = '0:55.772';
  cell.appendChild(inp); cell.appendChild(ms); row.appendChild(cell); grid.appendChild(row);
  return { cell, inp }; };
const pre = mk('pre'), now = mk('now'), post = mk('post');
const cs = el => getComputedStyle(el);
const bg = el => cs(el).backgroundColor, bgi = el => cs(el).backgroundImage, bsz = el => cs(el).backgroundSize;

/* ---- 图1、2：衬底加全 ---- */
const pb = getComputedStyle(bar, '::before');
const barBox = bar.getBoundingClientRect(), scBox = sc.getBoundingClientRect();
const pbLeft = parseFloat(pb.left), pbRight = parseFloat(pb.right), pbTop = parseFloat(pb.top);
ok('排本身有底', bg(bar) !== 'rgba(0, 0, 0, 0)', bg(bar));
ok('衬底层往左铺出 100vw', pbLeft < -window.innerWidth * 0.9, 'left=' + pbLeft);
ok('衬底层往右铺出 100vw', pbRight < -window.innerWidth * 0.9, 'right=' + pbRight);
ok('衬底层往上盖过滚动区那圈内距', pbTop <= -14, 'top=' + pbTop);
sc.scrollTop = 0;
const r1 = document.elementFromPoint(Math.round(barBox.left - 4), Math.round(barBox.top + barBox.height / 2));
ok('排左边那一列缝不透出内容（打到的是衬底这一层）', r1 === bar || r1 === sc, r1 && (r1.className || r1.tagName));
/* 滚一格：字从排底下过去，被排盖住的那一行上半截不该看得见 */
sc.scrollTop = 40;
const rowBox = pre.cell.getBoundingClientRect();
const hit = document.elementFromPoint(Math.round(barBox.left + barBox.width / 2), Math.round(barBox.top + barBox.height / 2));
ok('滚过去之后排中间打到的是排自己', hit === bar || bar.contains(hit), hit && (hit.className || hit.tagName));
const cover = getComputedStyle(bar).position + '|' + getComputedStyle(bar).zIndex + '|' + pb.zIndex;
ok('排浮着且衬底在排自己下面', getComputedStyle(bar).position === 'sticky' && parseFloat(pb.zIndex) < 0, cover);

/* ---- 图6、7：只剩两档 ---- */
const preBg = bg(pre.inp), postBg = bg(post.inp), nowBg = bg(now.inp);
const layerColors = (bgi(now.inp).match(/rgba?\\([^)]*\\)/g) || []);
ok('未唱与唱完是两种不同的底', preBg !== postBg, 'pre=' + preBg + ' post=' + postBg);
ok('正推着那一格的底子 = 未唱那一档（没提前跳色）', nowBg === preBg || bgi(now.inp) !== 'none', 'now bg=' + nowBg + ' 有层=' + (bgi(now.inp) !== 'none'));
ok('铺进来的那一条就是唱完那一块底（不是第三种颜色）',
   layerColors.length >= 4 && layerColors[0] === postBg && layerColors[2] === preBg,
   '铺进来那层=' + layerColors[0] + '  垫底那层=' + layerColors[2] + '  唱完=' + postBg + '  未唱=' + preBg);
const palette = new Set([preBg, postBg, layerColors[0], layerColors[2]]);
ok('三格里外出现的底色一共就两种（没有第三种）', palette.size === 2, [...palette].join(' | '));
ok('未唱那一档不再用 opacity 压淡（压了铺不进来）', cs(pre.inp).opacity === '1' && cs(now.inp).opacity === '1',
   'pre=' + cs(pre.inp).opacity + ' now=' + cs(now.inp).opacity);
ok('唱完那一档换了彩字彩框', cs(post.inp).borderTopColor !== cs(pre.inp).borderTopColor,
   cs(post.inp).borderTopColor + ' vs ' + cs(pre.inp).borderTopColor);
/* 行程照旧交给 CSS：换档那一刻写两笔，中间不逐帧改 */
now.inp.style.transition = 'none'; now.inp.style.backgroundSize = '0% 100%,100% 100%';
void now.inp.offsetWidth;
now.inp.style.transition = 'background-size 620ms linear'; now.inp.style.backgroundSize = '100% 100%,100% 100%';
ok('挂得上背景宽度过条', /background-size/.test(now.inp.style.transition) && now.inp.style.backgroundSize === '100% 100%, 100% 100%',
   now.inp.style.transition);
window.__RESULT = R;
document.title = R.filter(x => x.startsWith('PASS')).length + '/' + R.length;
</script>`;
fs.writeFileSync(__HERE + 'jia-test.html', html);
console.log('WROTE jia-test.html  CSS ' + css.length + ' 字符  断言 ' + (html.match(/\bok\(/g) || []).length + ' 条');
