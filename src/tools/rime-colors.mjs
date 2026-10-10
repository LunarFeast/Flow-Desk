/* 小企鹅（Weasel）配色里的色号：提取一次，嵌进软件本体。
   ----------
   为什么是「提取一次」而不是开机去读那份文件：那份文件住在 Rime 的用户目录里，装 Flow-Desk 的机器
   不一定有它，也不一定是同一套；要的是「这些色号从此是软件自带的一档料」，不是「运行时去别人家翻」。
   ----------
   口径两条，都不在这里另写一份：
     · 0x[AA]BBGGRR 反成 #RRGGBB —— 用 src\_shared\sh-color.js 里 parseColor 那把同一个尺（那一段注释
       就写着「蓝在前红在后」），这里不再手写一次 slice(4,6)+slice(2,4)+slice(0,2)。
     · 排序、去重交给色卡池那一份（CardPool.tune / hexes），这里只交「出现过、且不重复」的那一串。
   ----------
   跑法：node src/tools/rime-colors.mjs [另一份 weasel.yaml]
   默认读 %APPDATA%\Rime\build\weasel.yaml；读不到就停手报错，不拿上一次生成的那份糊过去。
   输出：src/_fd/src/fd12-rime-colors.js（这份是产物，跟着源码进构建名单）。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'src', '_fd', 'src', 'fd12-rime-colors.js');
const arg = process.argv[2];
const SRC = arg || path.join(process.env.APPDATA || '', 'Rime', 'build', 'weasel.yaml');
if(!fs.existsSync(SRC)){
  console.error('读不到那份 weasel.yaml：' + SRC + '\n  传一份路径进来：node src/tools/rime-colors.mjs "<weasel.yaml>"');
  process.exit(2);
}

/* ---------- 反序那把尺：搬真那份 ---------- */
const ctx = vm.createContext({ Math, JSON, String, Number, Object, Array, RegExp, isNaN, parseFloat, parseInt });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', '_shared', 'sh-color.js'), 'utf8'), ctx, { filename:'sh-color.js' });
vm.runInContext('globalThis.__c = { parseColor, resolveColor };', ctx);

const text = fs.readFileSync(SRC, 'utf8');
const lines = text.split(/\r?\n/);
let inPreset = false, cur = null;
const schemes = [];
const stat = { 配色段:0, 色号行:0, 认不出:0 };
for(const raw of lines){
  if(/^\S/.test(raw)){ inPreset = /^preset_color_schemes:\s*$/.test(raw.trim()); continue; }
  if(!inPreset || !raw.trim() || /^\s*#/.test(raw)) continue;
  const ind = (raw.match(/^\s*/)[0] || '').length;
  if(ind === 2){                                        /* 一套配色：顶格后两格的那个段名 */
    const m = /^  "?([^":]+)"?:\s*$/.exec(raw);
    cur = m ? { 名:m[1].trim(), 色:[] } : null;
    if(cur){ schemes.push(cur); stat.配色段++; }
    continue;
  }
  if(!cur || ind < 4) continue;
  const m = /^(\s+)([A-Za-z_0-9]*[Cc]olor[A-Za-z_0-9]*):\s*(\S.*?)\s*$/.exec(raw);
  if(!m) continue;
  const v = m[3].replace(/^"|"$/g, '');
  const p = ctx.__c.parseColor(v, 'auto');
  const hex = p && p.hex;
  if(!hex){ stat.认不出++; continue; }
  stat.色号行++;
  if(cur.色.indexOf(hex) < 0) cur.色.push(hex);
}
if(!schemes.length){ console.error('那份文件里没认出任何一套配色（preset_color_schemes 那一段是不是换了写法？）'); process.exit(2); }

/* 全体去重 + 按色相排（色相同的按明度），界面那一头再挑就别看顺序 */
const all = [...new Set(schemes.flatMap(s => s.色))];
const hueKey = h => { const c = ctx.__c.parseColor(h, 'auto'); const r = c ? ctx.__c.resolveColor(c, 'gracol') : null;
  return r && r.rgb ? r.rgb : [0, 0, 0]; };
const hueOf = rgb => { const [r, g, b] = rgb.map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if(!d) return -1;
  return (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6; };
const lumOf = rgb => (rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114) / 255;
all.sort((x, y) => { const a = hueKey(x), b = hueKey(y);
  const ha = hueOf(a), hb = hueOf(b);
  return (ha < 0 ? -1 : hb < 0 ? 1 : ha - hb) || (lumOf(a) - lumOf(b)); });

const stamp = new Date().toISOString().slice(0, 10);
/* 一串色号八个一行：一个一行要滚 211 行，这份是给人对着看的，不是给人逐个改的 */
const lines8 = [];
for(let i = 0; i < all.length; i += 8)
  lines8.push('  ' + all.slice(i, i + 8).map(h => "'" + h + "'").join(', ') + (i + 8 < all.length ? ',' : ''));
const body = [
  '/* 小企鹅（Weasel）配色里出现过的色号 —— 一次提取、嵌进软件本体（外29 乙组第三条）。',
  '   来源：' + SRC,
  '   提取：' + stamp + ' · 跑的是 node src/tools/rime-colors.mjs，人点的，开机不自动跑。',
  '   那份文件里写的是 0x[AA]BBGGRR：蓝在前红在后。反这一手用的是 src\\_shared\\sh-color.js 里',
  '   parseColor 那把同一个尺，这里没有第二份算法。',
  '   界面上那一枚「小企鹅配色进色卡」2026-10-09 撤了（外34 图8：多余按钮）—— 这一串眼下页面里没有任何入口在读，',
  '   留着还是整份撤，等作者定；没定之前 build.mjs 照旧把它拼进页面，谁也不许在这儿替色卡做第二套真相。',
  '   要换一批色：改那份 yaml，再跑一次这一台工具，这一份会被整个重写。 */',
  'const RIME_HEXES = [',
  ...lines8,
  '];',
  ''
].join('\n');
fs.writeFileSync(OUT, body);
console.log('那份文件：' + SRC);
console.log('认出配色 ' + schemes.length + ' 套 · 色号行 ' + stat.色号行 + ' 行 · 解不出 ' + stat.认不出 + ' 行');
console.log('去重之后 ' + all.length + ' 个写进 ' + path.relative(ROOT, OUT) + '（' + (Buffer.byteLength(body) / 1024).toFixed(1) + ' KB）');
console.log('头八个：' + all.slice(0, 8).join(' '));
