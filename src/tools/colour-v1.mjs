/* 把作者那份《Colour v1.md》提成软件里的内置配色清单（外31 一组）
   源文件：那张《Colour v1.md》住在这台机器自己的那一格里（路径在 src\tools\本地路径.cjs，不进仓）——
   一张三条列的表（色块 / 色号 / RGB），1307 个色号，不分小节。
   他给的话：「颜色较多，记得分组，比如黑白灰、红色系、绿色系、大地色等等」—— 分组这一层是这份工具算出来的，
   算的是色号本身（色相 / 饱和度 / 明度），不读表里那一列 RGB（同一件事，认一个口就够）。
   色号一个字都不改：这一份是作者写定的清单，不是从图上取回来的散色，所以进色卡那一步不推档、不并近色（只跳重复的同一个色号）。
   旁边那 1307 张 swatches\*.png 是这张表里的色块小图（色号已经在册），不入库。
   用法：node src/tools/colour-v1.mjs [那份 md] [那格纹理原件目录]  （两个参数不传就从本地路径那一颗取；改完 md 再跑一次，产物整份重写） */
import fs from 'node:fs';
import path from 'node:path';
import { 色表, 素材目录 } from './本地路径.mjs';

const ROOT = 'D:/Programs/Flow-Desk/';
const SRC = process.argv[2] || 色表;
const OUT = 'src/_fd/src/fd13-colour-v1.js';
if(!SRC){
  console.error('没地方读那张表：把 md 的路径当第二个参数传进来，或者照 src\\tools\\本地路径.cjs 那份形状写一颗本机自己的。');
  process.exit(1);
}

const 文 = fs.readFileSync(SRC, 'utf8');
const 见 = new Set(), 序 = [];
for(const 行 of 文.split(/\r?\n/)){
  const m = /\|\s*!?\[\]\(swatches\/[0-9A-Fa-f]{6}\.png\)\s*\|\s*#([0-9A-Fa-f]{6})\s*\|/.exec(行);
  const 色 = m ? '#' + m[1].toLowerCase() : (/^\|\s*#([0-9A-Fa-f]{6})\s*\|/.exec(行) || [])[1];
  if(!色) continue;
  const k = '#' + String(色).toLowerCase().replace('#', '');
  if(见.has(k)) continue;
  见.add(k); 序.push(k);
}
if(序.length < 900) throw new Error('只认到 ' + 序.length + ' 个色号，这份表不像对得上，不写产物');

/* ---------- 分组这一把尺（HSL，色相 0~360、饱和明度 0~1，末尾那颗是 R~B 三道的极差，按 0~255 给） ----------
   先黑白灰（几乎没色相的都算进来：HSL 饱和低、或者三道极差不到 10 —— 后面这一条是给发暗发亮那两头补的，
   一个 255 里只差 5 的点，HSL 的饱和能算到 0.3 以上，可眼睛看着就是灰白，摆进色系里反而找不着），
   再大地色（暖相而且发暗或发灰的那一堆：棕、土黄、橄榄、卡其），
   再粉色系（红那两头的高亮度），剩下按色相切六档。顺序就是这一段写的顺序，别换。 */
function hsl(hex){
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if(d !== 0){
    if(mx === r) h = 60 * (((g - b) / d) % 6);
    else if(mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if(h < 0) h += 360;
  }
  return [h, s, l, Math.round(d * 255)];
}
function 组(hex){
  const [h, s, l, 极差] = hsl(hex);
  if(极差 <= 10 || s <= 0.14 || l <= 0.05 || l >= 0.975) return '黑白灰';
  if(h >= 18 && h < 75 && (s < 0.5 || l < 0.42)) return '大地色';
  if((h < 20 || h >= 330) && l >= 0.72) return '粉色系';
  if(h < 12 || h >= 348) return '红色系';
  if(h < 40) return '橙色系';
  if(h < 70) return '黄色系';
  if(h < 165) return '绿色系';
  if(h < 200) return '青色系';
  if(h < 258) return '蓝色系';
  return '紫色系';
}
const 序名单 = ['黑白灰', '红色系', '粉色系', '橙色系', '黄色系', '大地色', '绿色系', '青色系', '蓝色系', '紫色系'];
const 桶 = new Map(序名单.map(n => [n, []]));
for(const hex of 序){ const g = 组(hex); if(!桶.has(g)) throw new Error('分出来的组名不在名单里：' + g); 桶.get(g).push(hex); }
/* 组内按明度从深到浅、同明度按色相排 —— 摊成一排的时候是渐变似的一条，不是一串乱点 */
for(const [n, list] of 桶) list.sort((a, b) => (hsl(a)[2] - hsl(b)[2]) || (hsl(a)[0] - hsl(b)[0]) || a.localeCompare(b));

const 计数 = 序名单.map(n => n + ' ' + 桶.get(n).length).join(' · ');
console.log('认到色号 ' + 序.length + ' 个（表里 ' + (文.split(/\r?\n/).filter(l => /^\|\s*!?\[\]\(swatches/.test(l)).length) + ' 行）');
console.log('分组：' + 计数);
console.log('每组头尾：' + 序名单.map(n => n + '[' + (桶.get(n)[0] || '') + '→' + (桶.get(n)[桶.get(n).length - 1] || '') + ']').join(' '));

/* ---------- 随包内置的纹理（外31 一组第二条）----------
   原件在这台机器自己的那一格里（路径在 src\tools\本地路径.cjs，不进仓）：「名字 by 作者.png」。
   随包那一份落在 src\pack\material\textures\，换成不带中文的文件名 —— 页面拿相对地址去取它，
   中文名在 fdapp:// 那套映射里要多绕一道编码，能不趟就不趟；界面上显示的还是中文名字。
   这张对照表是唯一落点：再来一张先在这儿登记，工具不自己编英文名（编错了两份对不上，随包那份就成了没人认的孤儿）。
   字节跟原件不一样就照原件重新铺一份 —— 随包那一层永远跟着他的原件走。 */
const 纹目录 = process.argv[3] || 素材目录;
const 纹去处 = 'src/pack/material/textures';
const 纹对照 = [
  ['棉纸', 'cotton.png'], ['棉纸2', 'cotton2.png'], ['牛皮纸', 'kraft.png'],
  ['牛皮纸2', 'kraft2.png'], ['牛皮纸盒', 'kraft-box.png'], ['素描纸', 'sketch.png']
];
function 找原件(名){
  if(!纹目录) throw new Error('没地方找纹理原件：把那一格的路径当第三个参数传进来，或者照 src\\tools\\本地路径.cjs 那份形状写一颗本机自己的。');
  for(const f of fs.readdirSync(纹目录)) if(f.startsWith(名 + ' by ') || f === 名 + '.png') return path.join(纹目录, f);
  return null;
}
const 纹理 = 纹对照.map(([名, 落]) => {
  const 原 = 找原件(名);
  if(!原) throw new Error('对照表里这一张没找到原件：' + 名 + '（在 ' + 纹目录 + '）');
  const a = fs.readFileSync(原), 去 = path.join(ROOT, 纹去处, 落);
  if(!fs.existsSync(去) || !fs.readFileSync(去).equals(a)){
    fs.mkdirSync(path.dirname(去), { recursive:true });
    fs.writeFileSync(去, a);
    console.log('  重铺 ' + 落 + ' ← ' + path.basename(原) + '（' + (a.length / 1048576).toFixed(2) + ' MB）');
  }
  const 作者 = / by (.+?)\.[a-z]+$/i.exec(path.basename(原));
  return { 名, 落, 作者:作者 ? 作者[1] : '', 字节:a.length, 宽:a.readUInt32BE(16), 高:a.readUInt32BE(20) };
});
console.log('内置纹理 ' + 纹理.length + ' 张：' + 纹理.map(x => x.名 + '→' + x.落 + ' ' + x.宽 + 'x' + x.高).join(' · '));

const 体 = 序名单.filter(n => 桶.get(n).length).map(n => {
  const l = 桶.get(n), 行 = [];
  for(let i = 0; i < l.length; i += 12) 行.push('    ' + l.slice(i, i + 12).map(x => "'" + x + "'").join(', ') + ',');
  return "  '" + n + "': [\n" + 行.join('\n') + '\n  ]';
}).join(',\n');

const 头 = '/* ============================================================\n' +
  '   内置素材 v1（外31 一组）：作者给的两样随包走的东西，提取一次嵌进软件，不是这会儿去读原文件。\n' +
  '     · 配色：《Colour v1.md》那张表里的 ' + 序.length + ' 个色号，按色系分 ' + 序名单.filter(n => 桶.get(n).length).length + ' 档（一档一个组名，界面上色卡那一屏按组摊开）。\n' +
  '       源表在 ' + SRC + '（不在仓里）；分组是 src\\tools\\colour-v1.mjs 按色号算的（黑白灰 / 大地色 这几档是他点的名，剩下按色相切），\n' +
  '       组内按明度从深到浅排；一个色号只属于一档，表里重复的在提取那一步就跳掉了。旁边那 1307 张 swatches\\*.png 是表里的色块小图，色号已经在这儿，小图不入库。\n' +
  '       色号原样：谁也不许在这儿推档、并近色 —— 那是色卡那一头「一键微调」给取回来的散色用的，两份东西不混。\n' +
  '     · 纹理：' + 纹理.length + ' 张无缝四方连续图，字节在 src\\pack\\material\\textures\\（出包时铺到 Flow-Desk\\material\\textures\\，页面按相对地址取）。\n' +
  '       中文名和作者名记在下面这一串里，界面上「方案编辑 · 纹理那一排」看到的就是这个名字。\n' +
  '   两样都在开机那一步自动进用户那一层（外31 三组第三条：他说的是「嵌入」，不是摆一颗按钮等着去点）——\n' +
  '   配色按档一轮一轮灌进色卡（认来源 v1，进过就一个字不动），纹理按中文名查重后收进图片库；\n' +
  '   界面上只留「内置纹理收进图片库」那一枚手动补收的按钮，配色那一枚「内置配色 v1 进色卡」2026-10-09 撤了（外34 图8：多余按钮）。\n' +
  '   原表或原图改了：node src\\tools\\colour-v1.mjs 重生成一份。\n' +
  '   ============================================================ */\n';

const 纹体 = 纹理.map(x => "  { 名字:'" + x.名 + "', 文件:'" + x.落 + "', 作者:'" + x.作者 + "' }").join(',\n');
fs.writeFileSync(ROOT + OUT, 头 + 'const COLOUR_V1 = {\n' + 体 + '\n};\n' +
  'const COLOUR_V1_N = ' + 序.length + ';\n' +
  '/* 随包那 6 张内置纹理的地址前缀：页面写相对地址 material/textures/文件名，出包后落在 Flow-Desk\\material\\textures\\ */\n' +
  "const MATERIAL_DIR = 'material/textures/';\n" +
  'const MATERIAL_TEXTURES = [\n' + 纹体 + '\n];\n', 'utf8');
console.log('WROTE ' + ROOT + OUT + '  ' + fs.statSync(ROOT + OUT).size + ' 字节');
