/* 插件 id 搬家（同步 GitHub 第 3 条 · 2026-10-09）
   ------------------------------------------------------------
   一张表（src\_build\pack-rename.mjs）管两头：页面里桌面搬家走生成时注入的那一份（var PACK_RENAME），
   盘上这一趟走这里 import 的同一份 —— 两边认的不是同一个名字就搬歪，所以只许有一张嘴。
   干三件事，都在 data\plugins 那一格里：
     · 包文件夹本身改名
     · 插件清单 manifest.json 里的 id 改名
     · 名单 off.json 里那一项改名
   包外散件（<id>.code.js 改代码副本、<id>.zip 压好的成品、<id>.js / <id>.recipe.json 定制散配方）
   跟着一起改名；这一台机器上现在一样都没有，脚本照样认，因为探针沙盒和别的机器可能有。
   桌面布局（data\userdata-fd\layout.json 里的 widget）不在这里动 —— 那是程序的活，
   由壳里那趟一次性搬家办（见 _fd/src/fd3-shell.js 的 改名搬家），脚本不许替程序改用户档。

   用法：
     node src\\tools\\rename-packs.mjs --看            只报该搬什么，一个字节不改
     node src\\tools\\rename-packs.mjs                 搬仓库这一棵（data\\plugins）
     node src\\tools\\rename-packs.mjs --树="E:\\...\\FD 探针沙盒"   搬探针那一棵 */
import fs from 'node:fs';
import path from 'node:path';
import { PACK_RENAME } from '../_build/pack-rename.mjs';

const argv = process.argv.slice(2);
const 看 = argv.includes('--看');
const t = (flag, d) => {
  /* 两种写法都认：--树=那一棵 和 --树 那一棵 */
  const 带 = argv.find(x => x.startsWith(flag + '='));
  if(带) return 带.slice(flag.length + 1);
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
/* 默认这棵树：脚本住在 Flow-Desk\src\tools，上一层的上一层就是根 */
const 根 = t('--树', path.resolve(import.meta.dirname, '..', '..'));
const 格 = path.join(根, 'data', 'plugins');
if(!fs.existsSync(格)){ console.error('这一格里没有插件：' + 格); process.exit(1); }
console.log((看 ? '【只看不改】' : '【动手】') + '树：' + 格);

let 动作 = 0;
const 做 = (说, 干) => { 动作++; console.log((看 ? '  会做 · ' : '  做了 · ') + 说); if(!看) 干(); };

/* 一、文件夹本身 */
for(const [旧, 新] of Object.entries(PACK_RENAME)){
  const a = path.join(格, 旧), b = path.join(格, 新);
  if(!fs.existsSync(a)) continue;
  if(fs.existsSync(b)){ console.error('  ! 新旧两格同时在：' + 旧 + ' 和 ' + 新 + ' —— 先看清哪一份是要留的，脚本不停在这一处'); continue; }
  做(旧 + '\\ → ' + 新 + '\\', () => fs.renameSync(a, b));
}
/* 二、插件清单里那一行 id（只改 id，中文名 name 不动 —— 界面上叫的还是「你的便签」） */
for(const [旧, 新] of Object.entries(PACK_RENAME)){
  const f = path.join(格, 新, 'manifest.json');
  if(!fs.existsSync(f)) continue;
  let m; try{ m = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch(e){ console.error('  ! 插件清单读不进来：' + f + '（' + e.message + '）'); continue; }
  if(m.id !== 旧) continue;
  做(新 + ' 的插件清单 id：' + 旧 + ' → ' + 新, () => {
    m.id = 新;
    fs.writeFileSync(f, JSON.stringify(m, null, 2) + '\n');
  });
}
/* 三、名单 off.json（记的是「被卸掉的」那几家） */
{
  const f = path.join(格, 'off.json');
  if(fs.existsSync(f)){
    let j; try{ j = JSON.parse(fs.readFileSync(f, 'utf8')); }catch(e){ j = null; }
    const 列 = j && Array.isArray(j.off) ? j.off : null;
    if(!列) console.error('  ! off.json 认不出一份名单，这一处没改（不动它比改坏强）');
    else{
      const 有 = 列.filter(n => PACK_RENAME[n]);
      if(有.length) 做('名单里 ' + 有.length + ' 项：' + 有.join('、'), () => {
        j.off = [...new Set(列.map(n => PACK_RENAME[n] || n))];
        fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
      });
    }
  }
}
/* 四、包外那三样散件（改名不换内容：谁引用它们认的都是文件名） */
for(const [旧, 新] of Object.entries(PACK_RENAME))
  for(const 尾 of ['.zip', '.code.js', '.js', '.recipe.json']){
    const a = path.join(格, 旧 + 尾), b = path.join(格, 新 + 尾);
    if(!fs.existsSync(a) || fs.existsSync(b)) continue;
    做(旧 + 尾 + ' → ' + 新 + 尾, () => fs.renameSync(a, b));
  }

/* 报账：搬完之后这棵树里还有哪些格 */
const 剩 = fs.readdirSync(格, { withFileTypes:true }).filter(e => e.isDirectory()).map(e => e.name).sort();
const 还带旧名 = 剩.filter(n => Object.keys(PACK_RENAME).includes(n));
console.log('组件格现在：' + 剩.join('、'));
console.log(还带旧名.length ? '  ! 还留着旧名：' + 还带旧名.join('、') : '  ✓ 表里那三个旧名在这棵树里已经没有了');
console.log('总共' + (看 ? '该做 ' : '做了 ') + 动作 + ' 笔');
process.exit(还带旧名.length ? 1 : 0);
