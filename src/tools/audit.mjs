/* ============================================================
   开工前跑一遍的自查（外20）：只报，不动任何东西。

     node src/tools/audit.mjs

   为什么要这一台：这一轮查出来的毛病全是同一类 —— 树里多了什么、旧了什么、有什么没人读了，
   而它们一处都不会报错：
     · 出厂镜像（resources\app\）停在上一次出包那天，更新包却把这一层整层送出去；
     · 同一个监听脚本同时存在五处，其中一处比原件少 1,781 字节；
     · main.cjs 的兜底点了一个从来没存在过的文件名（vol-watcher.ps1）；
     · src\_shared\sh-phrase.js 三棵源码树里唯一没被 build.mjs 点名的一份，产物里出现 0 次；
     · 同一个函数在两家各抄了一遍（第七节）—— 2026-10-07 那次人工审翻出来的，
       esc / randInt / pickOne / shuffle / copyBtn / saveBtnAt 各两份、插件的 ask 三份，
       逐字相同所以当下不报错，分叉之后才变成"同一个操作在一家对、另一家不对"；
     · 同一段 CSS 声明在两家各抄了一遍、只有选择器不同（第八节 · 外27 第 16 条那一类）——
       第七节只管函数体，看不见这一类，所以补了一节。
   写死名单又防不住漏 require（checkShellRequires 就是为那次 "Cannot find module './comp-files.cjs'" 加的），
   所以拿一台只读的机器每轮盯一遍，删不删由人决定。

   一条规矩跟着 AGENTS.md：dist\、update\、备份\ 是禁递归目录 —— 这里只看它们顶层的名字和大小，
   一层都不往里钻。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { plan as mirrorPlan, TREE_ROOT, PACK_DIR, SRC_DATA, MIRROR } from '../pack/mirror.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = TREE_ROOT;
/* 这些子树不参与"同一份东西出现几处"的扫描：运行时依赖、产物、存档，重复是它们的样子 */
const SKIP = new Set(['node_modules', '.git', 'dist', 'update', '备份', 'locales', 'logs',
  'userdata-fd', 'userdata-rp', 'userdata-wnw']);   /* 三份用户目录里是浏览器缓存，文件名没意义 */
const out = [];
const say = s => out.push(s);
let hits = 0;
function head(title){ say(''); say('── ' + title + ' ' + '─'.repeat(Math.max(0, 56 - title.length))); }
function bad(line){ hits++; say('  ! ' + line); }
function ok(line){ say('  · ' + line); }
function exists(p){ try{ fs.statSync(p); return true; }catch(e){ return false; } }
function walk(dir, base){
  const res = [];
  for(const e of fs.readdirSync(dir, { withFileTypes:true })){
    if(e.isDirectory()){ if(SKIP.has(e.name)) continue;
      res.push(...walk(path.join(dir, e.name), (base ? base + '/' : '') + e.name)); continue; }
    if(e.isFile()) res.push((base ? base + '/' : '') + e.name);
  }
  return res;
}

/* ---------- 一、出厂镜像比运行版本落后哪几样 ---------- */
head('一、出厂镜像 resources\\app\\ 比源那份落后什么');
{
  const p = mirrorPlan();
  say('  · 内容一致 ' + p.sameCount + ' 份');
  /* 这两份清单每次开机由程序自己往 data\ 落一次（src\pack\main.cjs:341），他在界面里改过一次字就和出厂那份不一样 ——
     那是设计如此，不是落差。单列一栏，别混进「要人看一眼」里把真落差淹掉（审查第 17 条：
     外27 收尾那一次报的 3 件里就有一件是这种噪声）。 */
  const 运行时自写 = ['ui-text.yaml', 'card-size.yaml'];
  const 是 = s => 运行时自写.some(n => s.includes(n));
  for(const s of p.stale) 是(s) ? say('  · 运行时自写的那份 · 人改过算正常：' + s) : bad('不一样：' + s);
  for(const s of p.missing) bad('缺：' + s);
  for(const s of p.extra) bad('多出来的：' + s);
  if(!p.stale.length && !p.missing.length && !p.extra.length) say('  ✓ 一份不差（打更新包那趟会自动铺齐）');
}

/* ---------- 二、同一份东西在树里出现几处，其中有没有内容不一样的 ---------- */
head('二、同一个名字出现多处 · 只报内容不一样的（一样的说明只是备份铺得到位）');
{
  /* 这一节按"光比名字"找重复，所以两类要先剔掉，不然全是假报：
     · resources\app\ 底下那一整层 —— 出厂镜像和源那份重名是设计如此，落差在第一节的 plan() 里报，
       比它详细得多（哪一格、哪一份、为什么该在这儿）；
     · 插件内部的标准名字（main.js / icon.svg / manifest.json / bank.txt / recipe.json）——
       每家都叫这个名，六家凑一起就成了"六个内容一种名字"，那也是第一节管的事。 */
  /* 名字一样、内容本来就该不一样的那几份：产物里的 root.json 按它自己的位置重算相对路径，
     package.json 是现场生成的三个 exe 共用入口（见 mirror.mjs）；
     fd-serve.mjs 在 src\tools 下那一个是老门牌，整个文件就是一句 import 转发到 src\_fd\ 那一份（它自己写着为什么）；
     help.md 两份各有身份 —— pages\ 那份是出厂底本、data\ 那份是归用户改的工作副本，
     谁跟着谁走由 main.cjs 的 syncHelp() 那把尺定（他没动过工作副本才刷），所以"不一样"是常态不是毛病。
     拿名字配对比它们就是假报。插件内部的标准名字（main.js / icon.svg / manifest.json / bank.txt /
     recipe.json）也一样：每家都叫这个名，六家凑一起就成了"六个内容一种名字"，那是第一节管的事。
     build-kernel.mjs 这一颗有两份 —— 为写那一棵（src\_wnw\）和组件定制那一棵（src\_wcustom\）各有一份出
     内核的脚本，名字照同一套起（外39 定「照为写那一套分」），各拼各的源码、各出各的产物，内容本来就该不一样。 */
  const SAME_NAME_DIFFERENT_JOB = ['root.json', 'package.json', 'fd-serve.mjs', 'help.md', 'build-kernel.mjs'];
  const PACK_STANDARD_NAMES = ['main.js', 'manifest.json', 'recipe.json', 'bank.txt', 'icon.svg'];
  const byName = new Map();
  for(const rel of walk(ROOT, '')){
    const n = path.basename(rel);
    if(!/\.(js|cjs|mjs|ps1|dll|md|yaml|json|svg|txt)$/.test(n)) continue;
    if(rel.replace(/\\/g, '/').startsWith('resources/app/')) continue;
    const m = rel.replace(/\\/g, '/').match(/^data\/plugins\/[^/]+\/(.+)$/);
    if(m && PACK_STANDARD_NAMES.indexOf(path.basename(m[1])) >= 0) continue;
    if(SAME_NAME_DIFFERENT_JOB.indexOf(n) >= 0) continue;
    if(!byName.has(n)) byName.set(n, []);
    byName.get(n).push(rel);
  }
  let dup = 0;
  for(const [n, list] of byName){
    if(list.length < 2) continue;        /* 该剔的在收名字那张表的时候就剔了 */
    const bySig = new Map();          /* 内容签名 → 落在哪几处 */
    const inos = new Map();           /* inode → 第一处，用来认出硬链接（硬链接不是两份） */
    for(const rel of list){
      const abs = path.join(ROOT, rel);
      let st = null, buf = null;
      try{ st = fs.statSync(abs); }catch(e){ continue; }
      if(st.ino && inos.has(st.ino)){ inos.get(st.ino).same.push(rel); continue; }
      try{ buf = fs.readFileSync(abs); }catch(e){ continue; }
      const sig = st.size + ':' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
      if(!bySig.has(sig)) bySig.set(sig, { first:rel, same:[] });
      else bySig.get(sig).same.push(rel);
      if(st.ino) inos.set(st.ino, bySig.get(sig));
    }
    if(bySig.size > 1){
      dup++;
      say('  ! ' + n + ' 在 ' + list.length + ' 处，内容有 ' + bySig.size + ' 种：');
      for(const [sig, g] of bySig) say('      ' + sig.split(':')[0].padStart(8) + ' 字节  ' +
        [g.first, ...g.same].join('、'));
    }
  }
  if(!dup) say('  ✓ 没有"同一个名字两份内容"这种东西');
  else hits += dup;
}

/* ---------- 三、源码树里没被生成脚本点名的 .js ---------- */
head('三、四棵源码树里没被生成脚本点名的 .js（拼不进产物，就是死源码）');
{
  const 读 = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
  /* 一颗出包脚本里点的名 = 那一棵的源码名单。两颗产物自己的名字、还有 '.js' 那种后缀字面量都不算源码。 */
  const 名单 = s => new Set([...s.matchAll(/['"]([^'"]*?\.js)['"]/g)].map(x => path.basename(x[1]))
    .filter(n => n !== 'wnw-kernel.js' && n !== 'wnw-custom-kernel.js' && n.length > 3));
  const named = 名单(读('src', '_fd', 'build.mjs'));
  /* 为写那一棵的名单不归 build.mjs 了（同步 GitHub 第 4 条「为写分离」），组件定制那一棵同理
     （外39「组件定制本身也要分离出来」）：公开这棵只读一颗产物，名单在它们各自的出包脚本里 ——
     查死源码要跟着换尺，不然那二十份和那四份全会被报成没人名。 */
  const namedW = 名单(读('src', '_wnw', 'build-kernel.mjs'));
  const namedC = 名单(读('src', '_wcustom', 'build-kernel.mjs'));
  const 几棵 = [
    ['src/_fd/src', named, 'build.mjs'],
    ['src/_shared', named, 'build.mjs'],
    ['src/_wnw/src', namedW, 'src\\_wnw\\build-kernel.mjs'],
    ['src/_wcustom/src', namedC, 'src\\_wcustom\\build-kernel.mjs']
  ];
  let dead = 0;
  for(const [d, 认, 出处] of 几棵){
    const dir = path.join(ROOT, ...d.split('/'));
    if(!exists(dir)) continue;
    for(const f of fs.readdirSync(dir)){
      if(!f.endsWith('.js') || 认.has(f)) continue;
      bad(d + '/' + f + ' · ' + fs.statSync(path.join(dir, f)).size + ' 字节 · ' + 出处 + ' 没点它的名');
      dead++;
    }
  }
  if(!dead) say('  ✓ 每一份都被点名了（宿主这边 ' + named.size + ' 个名字，为写 ' + namedW.size + ' 个，组件定制 ' + namedC.size + ' 个）');
}

/* ---------- 四、说明书点的随行文件在不在：包里 + 出厂那一格 ---------- */
head('四、插件说明书 assets 点的随行文件 · 包里和出厂那一格各在不在');
{
  const packs = path.join(SRC_DATA, 'plugins');
  let n = 0;
  if(exists(packs)) for(const e of fs.readdirSync(packs, { withFileTypes:true })){
    if(!e.isDirectory()) continue;
    const mf = path.join(packs, e.name, 'manifest.json');
    if(!exists(mf)) continue;
    let m = null; try{ m = JSON.parse(fs.readFileSync(mf, 'utf8')); }catch(err){ bad(e.name + ' 的 manifest.json 读不进来'); continue; }
    for(const k of Object.keys((m && m.assets) || {})){
      const rel = path.basename(String(m.assets[k]));
      n++;
      if(!exists(path.join(packs, e.name, rel))) bad(e.name + ' 说明书说 assets.' + k + ' 是 ' + rel + '，包里没这一份');
      if(!exists(path.join(MIRROR, 'data', 'plugins', e.name, rel)))
        bad(e.name + ' 的 ' + rel + ' 在出厂那一格里没有（这棵树上没建 data\\plugins 时就没兜底了）');
    }
  }
  if(!n) say('  · 没有任何包点随行文件');
  else say('  ✓ ' + n + ' 处点名的随行文件，两边都在');
}

/* ---------- 五、手工那一步有没有掉链子 ---------- */
head('五、要靠人手工拷的那一步 · 拷了没有');
{
  /* MusicBee 插件：build-plugin.ps1 出到 src\pack\plugin\dist\，得有人拷进音乐遥控器的包里才会送出去 */
  const built = path.join(PACK_DIR, 'plugin', 'dist', 'mb_FlowDesk.dll');
  const inPack = path.join(SRC_DATA, 'plugins', 'music-remote', 'mb_FlowDesk.dll');
  if(exists(built) && exists(inPack)){
    const a = fs.statSync(built), b = fs.statSync(inPack);
    if(a.size !== b.size || a.mtimeMs > b.mtimeMs + 1000)
      bad('插件编出来是 ' + a.size + ' 字节（' + new Date(a.mtimeMs).toLocaleString() + '），' +
        '包里那一份是 ' + b.size + ' 字节（' + new Date(b.mtimeMs).toLocaleString() + '）—— 拷进包里了吗？');
    else ok('插件：包里那一份不比 src\\pack\\plugin\\dist 的新，说明拷过了');
  } else if(exists(built)) bad('包里没有 mb_FlowDesk.dll，插件编译产物在 ' + built);
  else ok('没找到插件编译产物（没编过就算，不算毛病）');

  /* 图标：树根 icons\ 是给用户换的（keepExisting），镜像 icons\ 跟 src\pack\icons 一模一样；
     源码那份改了、根上那份还是旧的 —— 程序第一顺路读的是根上那份，屏幕上就看不到改动 */
  let diff = 0, n = 0;
  for(const rel of walk(path.join(PACK_DIR, 'icons'), '')){
    n++;
    const a = path.join(PACK_DIR, 'icons', rel), b = path.join(ROOT, 'icons', rel);
    if(!exists(b)){ bad('icons\\' + rel + ' 根上那一层没有（出包会补，先看一眼）'); diff++; continue; }
    if(!fs.readFileSync(a).equals(fs.readFileSync(b))){ bad('icons\\' + rel + ' 根上和 src\\pack\\icons 内容不一样 —— 根上那份是旧的'); diff++; }
  }
  if(!diff) say('  ✓ 图标两份源码层一致（' + n + ' 张）');
}

/* ---------- 六、树里哪些是大块存档（只列，不动） ---------- */
head('六、树里躺着的大块东西 · 删不删你定，这台工具一个字不动');
{
  const MB = n => (n / 1048576).toFixed(1) + 'MB';
  /* data\ 可以整棵算；备份\ 和 update\ 是禁递归目录 —— 里面的文件夹只报名字，一个字节都不进去数 */
  function bytesOf(dir){
    let n = 0;
    try{ for(const e of fs.readdirSync(dir, { withFileTypes:true })){
      if(e.isDirectory()) n += bytesOf(path.join(dir, e.name));
      else try{ n += fs.statSync(path.join(dir, e.name)).size; }catch(err){}
    } }catch(e){}
    return n;
  }
  for(const g of [['备份', false], ['update', false], ['data', true]]){
    const dir = path.join(ROOT, g[0]);
    if(!exists(dir)) continue;
    say('  ' + g[0] + '\\' + (g[1] ? '' : '（禁递归目录：里面的文件夹只报名字，不进去数）'));
    for(const e of fs.readdirSync(dir, { withFileTypes:true })){
      const p = path.join(dir, e.name);
      if(!e.isDirectory() && !/\.(zip|exe|txt)$/.test(e.name)) continue;
      say('      ' + e.name.padEnd(42) +
        (e.isDirectory() ? (g[1] ? MB(bytesOf(p)) : '一个文件夹 · 没往里数') : MB(fs.statSync(p).size)));
    }
  }
  say('  （这一节永远只是列出来给人看，不做任何删除、不挪任何一个文件）');
}

/* ---------- 七、同一个函数在两处各写一遍、而且函数体逐字相同 ---------- */
head('七、同一个函数名两处各定义一次 · 只报函数体逐字相同的（真双份，抄一遍的那种）');
{
  /* 为什么只报"逐字相同"：两棵树里同名不同物的东西是设计如此 —— 为写那十七份整段包在一层闭包里
     （见 src\_fd\build.mjs 那段注释：h / toast / Bus / State / Theme / Shell 这些名字两边各有实现），
     按名字报会一上来就一堆假报。函数体逐字相同才是真的抄了一遍：今天不报错，
     哪天改到其中一份，另一份照旧 —— 症状是"同一个操作在一家里对、另一家里不对"。 */
  const ALSO_OK_DUPES = [];   /* 故意各留一份的写这里（'名字' 形式），现在空 */
  const DIRS = ['src/_fd/src', 'src/_wnw/src', 'src/_shared', 'src/_wcustom/src'];
  const files = [];
  for(const d of DIRS){
    const dir = path.join(ROOT, ...d.split('/'));
    if(!exists(dir)) continue;
    for(const f of fs.readdirSync(dir)) if(f.endsWith('.js')) files.push(d + '/' + f);
  }
  /* 插件各家一个 main.js，运行时各自一层作用域，同样算进来 */
  const packs = path.join(SRC_DATA, 'plugins');
  if(exists(packs)) for(const e of fs.readdirSync(packs, { withFileTypes:true })){
    if(!e.isDirectory()) continue;
    const rel = 'data/plugins/' + e.name + '/main.js';
    if(exists(path.join(ROOT, rel))) files.push(rel);
  }
  const found = new Map();   /* 名字 + 函数体 → 落在哪几处 */
  for(const rel of files){
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split(/\r?\n/);
    for(let i = 0; i < lines.length; i++){
      const m = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
      if(!m) continue;
      let body = null;
      /* 一行写完的（randInt 那种）当场收；没写完的往下找到顶格那一枚 }，
         按排版收而不是数花括号 —— 字符串和正则里也有花括号，数会数错 */
      const open = (lines[i].match(/\{/g) || []).length, close = (lines[i].match(/\}/g) || []).length;
      if(open && open === close) body = lines[i];
      else{
        for(let j = i + 1; j < lines.length; j++){
          if(lines[j] === '}'){ body = lines.slice(i, j + 1).join('\n'); break; }
          if(j - i > 80) break;                 /* 顶格 } 找了一百行还没来 = 这函数太长，不比了 */
        }
      }
      if(body == null) continue;
      const key = m[1] + '\n' + body.replace(/\s+/g, ' ').trim();
      if(!found.has(key)) found.set(key, []);
      found.get(key).push(rel + ':' + (i + 1));
    }
  }
  let n = 0;
  for(const [key, at] of found){
    if(at.length < 2) continue;
    const name = key.split('\n')[0];
    if(ALSO_OK_DUPES.indexOf(name) >= 0) continue;
    bad(name + ' · 逐字相同的定义在 ' + at.length + ' 处：' + at.join('、'));
    n++;
  }
  if(!n) say('  ✓ 没有"同一个函数抄了两遍"这种东西');
  else say('  · 这些今天都不报错（各家作用域隔开），要等改到其中一份才显形');
}

/* ---------- 八、同一段 CSS 声明在两处各写一遍（只有选择器不同）---------- */
head('八、同一段 CSS 声明两处各写一遍 · 第七节只管函数体，这一段管 CSS');
{
  /* 为什么单独一节：外27 收尾那一次人工审的第 16 条 —— 悬浮那一排的衬底 ::before，
     为写那两棵源码里各写了一遍，除类名外逐字相同。那一类机器当时看不见（第七节只比函数体），
     改一处只生效一半，正是他被咬过的那类。
     只比真正的 CSS：模板串里那些（addCss(`…`)、K.style(`…`)、ctx.style(`…`)）。
     带 ${} 的整串跳过 —— 那一段是生成出来的，比不出「逐字相同」。
     门槛摆在这里：声明不到 4 项、归一化之后不到 100 字的不报。
     为什么要有这道门槛 —— 现场试跑过一遍，「名字截一段：overflow / text-overflow / white-space…」这种
     省略号三件套在四五处各写一遍，抄是抄了，可那是各自独立的规则，合并成一条选择器并列反而更难读；
     第 16 条那一类是 100 字往上的一整块（衬底 ::before 铺左右各一屏、吃掉那圈内距），那种才是改一处只生效一半。 */
  /* 故意各留一份的写这里（写这一组里任意一个选择器就整组放过）。
     他说过的：不同的按钮本来就不需要长一样 —— 下面三组是不同控件共用一套声明，不是抄漏。 */
  const ALSO_OK_DUPES = ['.wnw-bd-rowline', '.wnw-btn.on', '.wnw-input'];
  const DIRS = ['src/_fd/src', 'src/_wnw/src', 'src/_shared', 'src/_wcustom/src'];
  const files = [];
  for(const d of DIRS){
    const dir = path.join(ROOT, ...d.split('/'));
    if(!exists(dir)) continue;
    for(const f of fs.readdirSync(dir)) if(f.endsWith('.js')) files.push(d + '/' + f);
  }
  const packs = path.join(SRC_DATA, 'plugins');
  if(exists(packs)) for(const e of fs.readdirSync(packs, { withFileTypes:true })){
    if(!e.isDirectory()) continue;
    const rel = 'data/plugins/' + e.name + '/main.js';
    if(exists(path.join(ROOT, rel))) files.push(rel);
  }
  const found = new Map();   /* 归一化之后的声明串 → 落在哪几处 */
  const lineAt = (src, i) => src.slice(0, i).split('\n').length;
  for(const rel of files){
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const tl = /`([^`]*)`/g;
    let t;
    while((t = tl.exec(src))){
      const css = t[1];
      if(css.indexOf('${') >= 0) continue;
      if(!/[.#][A-Za-z_-][\w-]*[^{};]*\{/.test(css)) continue;   /* 不像 CSS 的模板串（线稿、明文样例）放过；
                                                                     伪类伪元素写在中间（.a::before{）也得认 */
      const rule = /([^{}\n][^{}]*?)\{([^{}]*)\}/g;
      let r;
      while((r = rule.exec(css))){
        /* 上一段规则的 } 之后到本条选择器之间常夹着注释，那一截不算选择器，也别把行号指到注释头上 */
        const pre = r[1].replace(/^(?:\s*\/\*[\s\S]*?\*\/)*\s*/, '');
        const sel = pre.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
        const body = r[2].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
          .replace(/\s*([:;,])\s*/g, '$1').replace(/;+$/, '').trim();
        if(!sel || body.length < 100) continue;
        if(body.split(';').filter(x => x.indexOf(':') > 0).length < 4) continue;
        const at = rel + ':' + lineAt(src, t.index + 1 + r.index + (r[1].length - pre.length));
        if(!found.has(body)) found.set(body, []);
        found.get(body).push({ at, sel });
      }
    }
  }
  let n = 0;
  for(const [body, where] of found){
    if(where.length < 2) continue;
    const sels = [...new Set(where.map(w => w.sel))];
    /* 名单里出现这一组中任何一个选择器，就整组放过 —— 原来只跳"选择器也完全一样"的那种，
       而"不同选择器、声明逐字相同"这一类正好一条都跳不到，那份名单等于虚设 */
    if(sels.some(s => ALSO_OK_DUPES.indexOf(s) >= 0)) continue;
    bad((sels.length === 1 ? '连选择器都一样的整条规则在 ' : '选择器不同、声明逐字相同的规则在 ')
      + where.length + ' 处 · ' + sels.join(' / ') + ' ｜ ' + where.map(w => w.at).join('、'));
    n++;
  }
  if(!n) say('  ✓ 没有「同一段 CSS 抄了两遍」这种东西');
  else say('  · 这些今天都不报错，要等改到其中一份才显形（合一条规则、选择器并列写就行）');
}

/* ---------- 九、逐字记录那个文件只许往后面接 ---------- */
head('九、有没有哪一处想拿「改写」或「删掉」去碰逐字记录那个文件 · 拦的是程序里的路，磁盘上手动改拦不住');
{
  /* 外28 定的规矩：逐字记录要当得了历史，靠的是"程序里没有改写的那一手"。
     界面上那两条删历史的路已经撤了（每行那枚 ✕、页脚那枚「全清掉」），这一节盯的是别再写回来。
     只按行认，跨行写的调用看不见 —— 这一棵树里那三条口子全是单行调用，真出现跨行的再说。 */
  const files = [];
  for(const d of ['src/_fd/src', 'src/_wnw/src', 'src/_shared', 'src/_wcustom/src']){
    const abs = path.join(ROOT, d);
    if(exists(abs)) for(const f of fs.readdirSync(abs)) if(f.endsWith('.js')) files.push(d + '/' + f);
  }
  const packs = path.join(SRC_DATA, 'plugins');
  if(exists(packs)) for(const e of fs.readdirSync(packs, { withFileTypes:true })){
    if(!e.isDirectory()) continue;
    const rel = 'data/plugins/' + e.name + '/main.js';
    if(exists(path.join(ROOT, rel))) files.push(rel);
  }
  let n = 0;
  for(const rel of files){
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const lines = src.split('\n');
    for(let i = 0; i < lines.length; i++){
      const l = lines[i];
      if(!/writePageFile\(|writePageBytes\(|delPageFile\(/.test(l)) continue;
      /* 路径里带这三样之一的，就是在指那一层或那一个文件 */
      if(l.indexOf('keystroke.txt') < 0 && l.indexOf('KLog.') < 0 && l.indexOf('/history') < 0) continue;
      bad('拿改写 / 删掉那两条口子指逐字记录：' + rel + ':' + (i + 1) + ' · ' + l.trim().slice(0, 90));
      n++;
    }
  }
  if(!n) say('  ✓ 程序里没有改写、删掉逐字记录的那一手');
  else say('  · 这一条一破，那一章的历史就不再是历史了（只往后面接的那条路在 src\\pack\\main.cjs 的 fs:append）');
}

say('');
say(hits ? '共 ' + hits + ' 件要人看一眼。这台工具什么都不改。' : '一件都没报。');
console.log(out.join('\n'));
