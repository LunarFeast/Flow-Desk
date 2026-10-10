/* ============================================================
   组件定制内核 · 私有那一棵自己出的一颗产物
   ------------------------------------------------------------
   外39（2026-10-09）：他定「组件定制本身也要分离出来，改名为 wnw-custom」，
   形状照为写那一套走 —— 源码单独一棵、自己出一颗产物、主程序构建只读那颗产物。
   仓库对应 Flow-Desk-plugin-WNW-Custom。

   和为写那颗不一样的一处：**这里不套闭包**。
   那四份代码里的名字（Gen、GenWizard、Banks、H、codeEntry… 一共 77 个）今天就是躺在整页的
   顶层作用域里，外壳那几处入口是照「这个名字在不在」来摆的（typeof codeEntry === 'function'
   这种判法，见 _fd/src/fd3-shell.js）。套一层闭包就得把 115 处引用全改成走一份出口对象，
   那是迁移不是分离 —— 他定的是分离，行为一个字都不该变。所以这里只按原序拼成一份，
   名字照旧落在页的顶层；产物缺了，那几只入口自己就不摆（外壳本来就是这么判的）。

   顺序不能重排：sh-banks 在最前（Banks / H 是另外三份和宿主都要读的底层），
   然后 sh-gen（生成器）、sh-wizard（向导）、sh-code（改代码那只口）。
   这四份都是纯声明（顶层不执行任何一句），所以拼在整页哪个位置都不影响求值，
   但拼进去的相对次序照原样留着，别给以后留一个「为什么先这份」的谜。

   用法：
     node src/_wcustom/build-kernel.mjs        出产物
     node src/_wcustom/build-kernel.mjs --比   只比不写（产物和现拼的是不是同一份）
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, 'src');
const OUT = path.join(HERE, 'wnw-custom-kernel.js');

/* 名单 = 这一棵的唯一真相；磁盘上多一份少一份都当场报错，不许悄悄漏掉一份源码 */
const PARTS = [
  'sh-banks.js',
  'sh-gen.js',
  'sh-wizard.js',
  'sh-code.js'
];

const 盘上 = fs.readdirSync(SRC).filter(n => /\.js$/.test(n)).sort();
const 缺 = PARTS.filter(n => !盘上.includes(n));
const 多 = 盘上.filter(n => !PARTS.includes(n));
if(缺.length || 多.length){
  console.error('名单和磁盘对不上（这一棵里每一份源码都得在名单上）：');
  if(缺.length) console.error('  名单上有、磁盘没有：' + 缺.join('、'));
  if(多.length) console.error('  磁盘上有、名单没有：' + 多.join('、'));
  process.exit(1);
}

let body = '';
for(const n of PARTS){
  const s = fs.readFileSync(path.join(SRC, n), 'utf8');
  try{ new vm.Script(s, { filename:n }); }
  catch(e){ console.error('语法不过 ' + n + '：' + e.message); process.exit(1); }
  body += '/* -------- ' + n + ' -------- */\n' + s + '\n';
}

const 头 = '/* ============================================================\n'
  + '   组件定制内核 · 这一份是产物，别手改\n'
  + '   由 node src/_wcustom/build-kernel.mjs 拼出来，源码在 src/_wcustom/src/ 那 '
  + PARTS.length + ' 份里。\n'
  + '   改逻辑去改源码再重跑这一趟；主程序那边只读这一颗（见 src/_fd/build.mjs）。\n'
  + '   不套闭包：这些名字照旧落在整页顶层，外壳那几只入口按「名字在不在」摆。\n'
  + '   ============================================================ */\n';
const 整份 = 头 + body;

if(process.argv.includes('--比')){
  const 现 = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if(现 === 整份){ console.log('产物和现拼的一致：' + path.relative(path.join(HERE, '..', '..'), OUT)); process.exit(0); }
  console.error('产物过期（改了源码没重跑这一趟）：盘上 ' + 现.length + ' 字 / 现拼 ' + 整份.length + ' 字');
  process.exit(1);
}

fs.writeFileSync(OUT, 整份, 'utf8');
console.log('WROTE ' + OUT + ' ' + Buffer.byteLength(整份) + ' 字节 ' + PARTS.length + ' 份源码');
