/* ============================================================
   出厂镜像那一层（resources\app\）：铺它（apply）和比它（plan）都走这一份。

   为什么要从 build-app.mjs 里抽出来 —— 镜像过去只有「出包」这一趟会刷，
   而更新包是把 `resources\app\` 整层塞进包里送出去的（build-update.mjs 的 addLayer）：
   不出包就打更新包，送出去的就是上一次出包那天的旧镜像，装了它的机器「恢复出厂」
   会还原到旧代码，而且一句错都不报。2026-10-06 量到过一次实的：
   镜像里 main.cjs 停在 08:51、smtc-watcher.ps1 停在 13:35、界面文字清单少 96 行。

   口径是他 2026-10-06 定的那句：每次更新之前先把当前版本放进出厂备份，再动运行那一份，
   所以出厂备份最多比运行版本落后一轮 —— 落到代码上就是「收集清单之前先 apply 一次」，
   加上 updater 本来就把旧的整层挪进 update\backups\<这一趟>\。

   plan() 只比不写（src\tools\audit.mjs 每轮开工前跑它），apply() 才落盘。
   两个都吃同一份 jobs()，不会出现"比的是 A 铺的是 B"。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
/* 认插件那把尺和生成页面用的是同一把（_build/packs.mjs）—— 外43 起这一层不再铺插件，
   那把尺只有 publish 打货架的时候用。 */
/* 号也只有一处真身：这一层铺的是「当前这一支号那一张页」，不是「pages\ 里号最大的那一张」 */
import { 页名 } from '../_build/version.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* 产物就在 Flow-Desk\ 根上（src\pack 往上两级）：运行时、exe、pages、data、src 同级 */
const OUT = path.resolve(HERE, '..', '..');
/* FD_TREE 只改「从哪棵树取 pages / data 做内置副本」，运行时和 README 还是铺在 OUT */
const TREE = process.env.FD_TREE ? path.resolve(process.env.FD_TREE) : OUT;
/* 和 _build/tree.cjs 一把尺：构建脚本落在哪个名字上都对（程序开机第一件事就是把中文三层改名，
   三个程序还开着的时候改不动，所以树里可能还是老名字）。内置副本必须跟着真目录走 ——
   找不到就不打进产物，resources\app 那份兜底会被 rmSync 清空，等于把兜底撤了。
   程序自己（读数据、装更新包）只认英文名，不留老名字的后门。 */
const SRC_PAGES = pick([path.join(TREE, 'pages'), path.join(TREE, '页面')]) || path.join(TREE, 'pages');
const SRC_DATA = pick([path.join(TREE, 'data'), path.join(TREE, '数据')]) || path.join(TREE, 'data');
const RES = path.join(OUT, 'resources', 'app');

function pick(list){ for(const p of list){ if(fs.existsSync(p)) return p; } return null; }
function walk(dir, base = ''){
  const out = [];
  for(const e of fs.readdirSync(dir, { withFileTypes:true })){
    const rel = base ? base + '/' + e.name : e.name;
    if(e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}
function copyInto(src, dst){
  fs.mkdirSync(path.dirname(dst), { recursive:true });
  fs.copyFileSync(src, dst);
}
function sameBytes(a, b){
  let x, y;
  try{ x = fs.readFileSync(a); }catch(e){ return false; }
  try{ y = fs.readFileSync(b); }catch(e){ return false; }
  return x.length === y.length && x.equals(y);
}
/* 页面 + 出厂数据各铺一份进 resources/app，路径形状和树里一模一样：
   这样 fdapp:// 的 URL 不变，页面里写的相对路径照样命中。
   同一块盘上改用硬链接铺：兜底那份不额外占地方，整个文件夹拷去别的电脑时链接会自然摊平成普通文件，
   内容一个字不少；链接建不上（跨盘）就退回复制。
   只有页面走这条。help.md 和 userdata-list.md 这两份出厂底本必须真复制（real:true）：
   它们和用户的 data\ 里那一份是同一个名字，链上去就成了同一个文件 —— 用户改了底本就跟着变，
   「恢复出厂」和 syncHelp 里那把「他没动过才刷新」的尺都作废了。跟出厂清单、出厂组件一个口径。 */
function into(src, dst){
  fs.mkdirSync(path.dirname(dst), { recursive:true });
  fs.rmSync(dst, { force:true });
  try{ fs.linkSync(src, dst); }
  catch(e){ copyInto(src, dst); }
}
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function cmpVer(a, b){ for(let i = 0; i < Math.max(a.length, b.length); i++){ const d = (a[i]||0) - (b[i]||0); if(d) return d; } return 0; }
/* 和 main.cjs 里那套一样的取版本法：文件名里 * 的位置取号，取最大的。
   号段能吃 -alpha / -beta、点和 +build 那一串：1.0.0-alpha+build.977bc41 拆成 [1,0,0]，
   短哈希不参与比大小（它只负责认是哪一笔提交），数字相同再比原始串。 */
function verNum(raw){ return String(raw).split('+')[0].split(/[^\d]+/).filter(Boolean).map(Number); }
function pickLatest(dir, pat){
  const one = path.join(dir, pat);
  if(!pat.includes('*')) return fs.existsSync(one) ? one : null;
  const re = new RegExp('^' + pat.split('*').map(esc).join('([\\d][\\w.+-]*)') + '$');
  let best = null;
  try{
    for(const n of fs.readdirSync(dir)){
      const m = n.match(re); if(!m) continue;
      const raw = m.slice(1).join('-'), v = verNum(raw);
      const c = best ? cmpVer(v, best.v) : 1;
      if(c > 0 || (c === 0 && raw > best.raw)) best = { f:path.join(dir, n), v, raw };
    }
  }catch(e){ return null; }
  return best ? best.f : null;
}
/* root.json 里是相对打包目录的路径，这里同样按 __dirname 解，和 main.cjs 一个口径。
   src 只有开发机上才有（重新构建要用），产物里那一份照旧按相对位置带。 */
const SRC = (() => {
  let j = {};
  try{ j = JSON.parse(fs.readFileSync(path.join(HERE, 'root.json'), 'utf8')); }catch(e){}
  return j.src ? path.resolve(HERE, j.src) : '';
})();
/* 产物里的 root.json 要按它自己的位置重算相对路径：
   resources\app 比 Flow-Desk 根深两层，照抄开发那一份会指到产物外面去。
   写的键是 tree（Flow-Desk\ 那一层）—— 页面层和数据层由 exe 自己在树里认。 */
function distRootJson(res){
  const rel = t => path.relative(res, t).split(path.sep).join('/');
  return JSON.stringify({ tree: rel(OUT), src: SRC ? rel(SRC) : '' }, null, 2) + '\n';
}

/* 外20 那一刀：随行监听脚本的原件在音乐遥控器的包里，app 层不收第二份（见下面 jobs 里程序壳那段） */
const SHELL_SKIP = ['smtc-watcher.ps1'];

/* ---------- 这一层该有什么：一张活儿清单，apply 照着铺，plan 照着比 ----------
   五种活儿：
     file  一个文件（from 是树上那一份）—— 页面产物、两份出厂底本、两份出厂清单、程序壳那些 .cjs/.ps1
     buf   一个文件（内容是现场从包里取的）—— 词库底本
     gen   一个文件（内容是现场算出来的）—— root.json、package.json
     tree  一整格，先抹后铺 —— 出厂插件那一层（「恢复出厂」取的就是它）
     keep  一整格，已有的不动 —— 自带默认图标
   note 上写的是"这份凭什么在这儿"，plan() 报的时候带着它，看的人不用回来翻脚本。 */
function jobs(){
  const out = [];
  /* 页面层兜底：认当前这一支号那一张页（号回跳到 1.0.0-alpha 之后，「挑号最大的」会挑回旧页）。
     当前号那张还没落盘（改了源码没跑生成）就退回挑一张，并报一句 —— 别让整个镜像铺不下去。 */
  const 当前 = path.join(SRC_PAGES, 页名());
  const page = fs.existsSync(当前) ? 当前 : pickLatest(SRC_PAGES, 'Flow_Desk_*.html');
  if(page) out.push({ k:'file', note:'页面兜底', from:page, to:path.join(RES, 'pages', path.basename(page)) });
  else console.log('  ! ' + SRC_PAGES + ' 里没有 Flow_Desk_*.html，页面兜底这份没打进产物');
  /* 出厂底本：帮助那一份的原件就是 pages\help.md（程序读的是它），跟着更新走。
     2026-10-10 外42 改根：这一处从前和「用户数据详单」一起从 data\ 那一格取件 —— 可那一格是用户层，
     「一键清理所有用户数据」删的就是它。取不到件的时候这一层会被撤掉（顶上那句注释写的就是这件事）：
     07:35 那一趟铺镜像就照着清理之后的空 data\ 铺，两份底本一起没了。
     详单那一份从此不进出厂层，也不进仓：它是用户自己写的那一篇（文件开头就写着「用 Notepad++ 改完保存」），
     首次安装本来就没有它 —— 那一屏点开说「读不到」才是对的样子（他 2026-10-10 的原话）。 */
  out.push({ k:'file', real:true, note:'出厂底本 · 第一次开机照这份铺成用户那一份',
    from:path.join(SRC_PAGES, 'help.md'), to:path.join(RES, 'data', 'help.md') });
  /* 两份清单的出厂那份（#270）：程序第一次开机照这份铺到用户的 data\ 里（syncLists） */
  for(const name of ['ui-text.yaml', 'card-size.yaml'])
    out.push({ k:'file', real:true, note:'出厂清单 · 界面文字 / 卡片大小',
      from:path.join(SRC_DATA, name), to:path.join(RES, 'data', name) });
  /* 程序壳：src\pack 里所有 .cjs 一个不落，外加 app 层自己的 .ps1。
     为什么不写死名单 —— 2026-10-03 那次「A JavaScript error occurred in the main process：
     Cannot find module './comp-files.cjs'」就是这么来的：main.cjs 新 require 了一份模块，
     名单没跟着补，程序直接起不来（cardsize.cjs 漏在同一处，它包在 try 里，表现为卡片大小那条设置静默失灵）。
     下面 checkShellRequires() 是同一类病的检查：铺完就把 require 的名字逐个对一遍，缺一份当场报错。
     SHELL_SKIP 是外20 那一刀：监听的随行脚本（smtc-watcher.ps1 / vol-watcher.ps1）和桥插件的原件
     都在音乐遥控器的包里，app 层不再收一份 —— 同一份东西在程序里最多"运行的那一份 + 出厂那一份"。
     ocr-swatch.ps1 不在任何包里（它是取色用的，跟组件无关），所以它照旧走这一层。 */
  for(const f of fs.readdirSync(HERE).filter(x => /\.(cjs|ps1)$/.test(x)).sort()){
    if(SHELL_SKIP.indexOf(f) >= 0) continue;
    out.push({ k:'file', real:true, note:'程序壳 · ' + (/\.ps1$/.test(f) ? 'app 层自己的脚本' : '主进程那份代码'),
      from:path.join(HERE, f), to:path.join(RES, f) });
  }
  /* 插件那一整格从前铺在这里（resources\app\data\plugins\）：「恢复出厂」和随行文件的兜底都取这一层。
     外43 撤了 —— 插件跟主程序分开各自开发、各自发布，程序这一层不带一个插件的字节；
     而且这一层每次更新包都被整个换掉，用户的原版放进去等于交给下一趟更新撤走。
     现在原版住在 data\plugins-factory\，导入那一下由 main.cjs 的 keepOriginal() 留，恢复出厂取那一格。
     词库底本那一段跟着一起撤：它的来源本来就是这里的插件包，包里没插件了也就没有底本可落
     （撤之前那一趟也是空转 —— 七家说明书里没一家写 bank）。 */
  /* 图标这一层分两处看：树根 icons\ 是给用户换的（build-app 那边 keepExisting，他换过的图不许被出包吃掉），
     镜像这一层是"自带的默认"，就该和 src\pack\icons\ 一模一样 —— 所以先抹后铺（tree），不保留。
     外20 之前这里是"已有的不动"，结果源码 Oct 2 撤掉的名字在镜像里活到了今天：
     resources\app\icons\seam.svg（276 字节）两份源码层都没有它，它跟着每一个更新包往下发。 */
  out.push({ k:'tree', mode:'flat', note:'自带默认图标 · 跟 src\\pack\\icons 一模一样',
    from:path.join(HERE, 'icons'), to:path.join(RES, 'icons') });
  /* 随包内置素材那一层（外31 一组：纹理那 6 张，24 MB）不在这里铺，也不是漏了：
     ① fdapp:// 那套映射只按四个门牌找文件（页面层 → 树根 → 自带的 pages → 自带的 data，main.cjs 的 serve），
        resources\app\material 这一格页面根本取不到，铺在这儿就是一份没人认的字节；
     ② build-update.mjs 是把 resources\app 整层塞进包的，铺进来等于每一个更新包多背 24 MB。
     所以这一层只有一个铺点：build-app.mjs 从 src\pack\material 铺到 Flow-Desk\material（树根那一层，页面按相对地址取，
     和根上 icons\ 同一待遇 —— 用户那一格 keepExisting，他自己换的图不被出包吃掉）。
     要撤这一条得先把 main.cjs 的门牌加上第五个，再想包体积的事，别只在这儿补一颗 job。 */
  out.push({ k:'gen', text:distRootJson(RES), note:'树根位置', to:path.join(RES, 'root.json') });
  /* 这份 package.json 三个 exe 共用，里面不能写 fdApp 是哪一个：入口由 exe 的文件名决定。
     版本号跟着上面那一份页面走（同一趟产物必须同一个号），不再自己钉一份 —— 从前这里写着 1.0.0，
     和页面文件名、和页面里显示的那一串都对不上。 */
  const 页上号 = page ? path.basename(page).slice('Flow_Desk_'.length, -'.html'.length) : '';
  out.push({ k:'gen', note:'入口指 main.cjs', to:path.join(RES, 'package.json'),
    text:JSON.stringify({ name:'flow-desk', version:页上号 || '0.0.0', private:true, main:'main.cjs' }, null, 2) });
  return out;
}

/* 一整格要比哪些文件。两种格口径不同，混用就会假报：
     packs —— 插件那一格：顶层只认目录（off.json 是这台机器卸没卸过、<id>.zip 是压好的成品、
              <id>.code.js 是「改代码」的本地覆盖副本，三样都不属于"出厂原文"），往里走跳过点的开头的；
     flat  —— 图标那一格：整个目录原样比，往里那一层子目录也要进去。 */
function treePairs(from, to){
  let names = [];
  try{ names = fs.readdirSync(from); }catch(e){ return null; }
  const src = new Map();
  for(const rel of walk(from)) if(!rel.split('/').some(s => s.startsWith('.'))) src.set(rel, path.join(from, ...rel.split('/')));
  const dst = new Map();
  try{ for(const rel of walk(to)) dst.set(rel, path.join(to, ...rel.split('/'))); }catch(e){}
  return { src, dst };
}

/* ---------- 只比不写：audit.mjs 吃这个 ---------- */
function plan(){
  const stale = [], missing = [], extra = [], same = [];
  for(const j of jobs()){
    if(j.k === 'tree'){
      const p = treePairs(j.from, j.to);
      if(!p){ missing.push(j.note + ' · 源那一格没有：' + j.from); continue; }
      for(const [rel, f] of p.src){
        const d = p.dst.get(rel);
        const what = path.relative(OUT, path.join(j.to, ...rel.split('/'))).split(path.sep).join('\\');
        if(!d) missing.push(what + ' · 缺（' + j.note + '）');
        else if(!sameBytes(f, d)) stale.push(what + ' · 和源那份不一样（' + j.note + '）');
        else same.push(what);
      }
      for(const rel of p.dst.keys())
        if(!p.src.has(rel))
          extra.push(path.relative(OUT, path.join(j.to, ...rel.split('/'))).split(path.sep).join('\\') +
            ' · 镜像里多出来的（源那一格已经没有这个名字了）');
      continue;
    }
    const want = j.k === 'gen' ? Buffer.from(j.text) : j.k === 'buf' ? j.buf : null;
    let ok = false;
    if(want){
      let have = null;
      try{ have = fs.readFileSync(j.to); }catch(e){}
      ok = !!have && have.length === want.length && have.equals(want);
    } else ok = sameBytes(j.from, j.to);
    const what = path.relative(OUT, j.to).split(path.sep).join('\\');
    if(ok) same.push(what);
    else if(!fs.existsSync(j.to)) missing.push(what + ' · 镜像里根本没有（' + j.note + '）');
    else stale.push(what + ' · 和源那份不一样（' + j.note + '）');
  }
  return { stale, missing, extra, sameCount:same.length, res:RES, tree:OUT };
}

/* ---------- 真铺：build-app.mjs 和 build-update.mjs 吃这个 ----------
   第一刀是整个抹掉 resources\app 再照活儿清单铺：留着一层旧的就等于把"上一次那一份"混进这一次的产物里
   —— 现在盘上那份 resources\app\plugin\mb_FlowDesk.dll 就是这么留下的（外20 之后 app 层不收插件了，
   兜底改走出厂插件那一格，可这个目录不抹就一直跟着包发）。 */
function apply(){
  const log = [];
  fs.rmSync(RES, { recursive:true, force:true });
  fs.mkdirSync(RES, { recursive:true });
  for(const j of jobs()){
    if(j.k === 'file'){
      if(!fs.existsSync(j.from)){ log.push('  ! 没有这一份，跳过：' + j.from); continue; }
      if(j.real){ fs.rmSync(j.to, { force:true }); copyInto(j.from, j.to); }
      else into(j.from, j.to);
    } else if(j.k === 'buf'){
      fs.mkdirSync(path.dirname(j.to), { recursive:true });
      fs.writeFileSync(j.to, j.buf);
    } else if(j.k === 'gen'){
      fs.mkdirSync(path.dirname(j.to), { recursive:true });
      fs.writeFileSync(j.to, j.text);
    } else if(j.k === 'tree'){
      if(!fs.existsSync(j.from)){ log.push('  ! ' + j.from + ' 里没有这一格，跳过：' + j.note); continue; }
      fs.rmSync(j.to, { recursive:true, force:true });
      const files = copyPackTree(j.from, j.to);
      log.push('  ' + j.note + ' · 铺了 ' + files + ' 个文件');
    }
  }
  checkShellRequires(RES);
  const p = plan();
  log.push('  镜像已对齐：' + p.sameCount + ' 份内容一致' +
    (p.stale.length + p.missing.length ? ' · 还没铺上 ' + (p.stale.length + p.missing.length) + ' 份（见上）' : ''));
  return log;
}
function copyPackTree(from, to){
  let n = 0;
  for(const e of fs.readdirSync(from, { withFileTypes:true })){
    if(e.name.startsWith('.')) continue;                 /* 点的开头的（.DS_Store 那一类）不进出厂层 */
    const f = path.join(from, e.name), t = path.join(to, e.name);
    if(e.isDirectory()) n += copyPackTree(f, t);
    else if(e.isFile()){ copyInto(f, t); n++; }
  }
  return n;
}
/* 图标那一层整个搬过去，往里那一层子文件夹也进去
   （主进程扫描时认「文件夹名-文件名」这一串名字，出厂层少了哪一张，界面上就永远长不回那一张）。 */
function copyDir(from, to, keepExisting){
  let n = 0;
  for(const e of fs.readdirSync(from, { withFileTypes:true })){
    if(e.isDirectory()){ n += copyDir(path.join(from, e.name), path.join(to, e.name), keepExisting); continue; }
    if(!e.isFile()) continue;
    const dst = path.join(to, e.name);
    if(keepExisting && fs.existsSync(dst)) continue;
    copyInto(path.join(from, e.name), dst); n++;
  }
  return n;
}
/* 铺完自查：这几份 .cjs 里每一句 require('./某份') 都得在 resources\app 里真有一份等着它。
   认 main.cjs 那种写法（./x.cjs）也认不带后缀的（./x 会去找 x.cjs / x.js / x.json / x\index.*）。
   少一份就把构建打断 —— 让写产物的人看见，别让用程序的人看见那个英文错误框。 */
function checkShellRequires(dir){
  const exts = ['', '.cjs', '.js', '.json', path.join('index.cjs'), path.join('index.js'), path.join('index.json')];
  const missing = [];
  for(const f of fs.readdirSync(dir).filter(x => x.endsWith('.cjs'))){
    let src = '';
    try{ src = fs.readFileSync(path.join(dir, f), 'utf8'); }catch(e){ continue; }
    for(const m of src.matchAll(/require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g)){
      const rel = m[1].slice(2);
      if(!exts.some(x => { try{ return fs.statSync(path.join(dir, rel + x)).isFile(); }catch(e){ return false; } }))
        missing.push(f + ' 要 ' + m[1]);
    }
  }
  if(missing.length) throw new Error('程序壳少文件（铺进 resources\\app 的名单没跟上一句 require）：\n  ' + missing.join('\n  '));
}

/* 铺镜像之前问一句程序开没开：只挡真会咬住这一层的进程。
   跑着的那颗 exe 是从 resources\app 里读代码起家的，整层抹掉就是抽它脚下的板；
   为写和声笔输入法练习那两个门牌（老产物里还有）一起挡。
   MusicBee.exe 和后台 powershell.exe 不挡 —— 它们咬的是 D:\Programs\MusicBee\Plugins\ 里那个插件
   和 %LOCALAPPDATA%\Flow-Desk\watcher\ 里落地的脚本，这两处都不在 resources\app 这一层里。
   2026-10-06 头一趟跑就把开着 MusicBee 挡下了，那是我把名单写宽了。
   认不准就别拦路：FD_IGNORE_RUNNING=1 跳过，tasklist 那条失败也当"没开着"。 */
function running(){
  if(process.env.FD_IGNORE_RUNNING) return [];
  let out = '';
  try{ out = execSync('tasklist /fo csv /nh', { encoding:'utf8' }); }
  catch(e){ return []; }
  const hit = [];
  for(const n of ['Flow-Desk.exe', 'Why Not Write.exe', 'Rime Practice.exe'])
    if(out.toLowerCase().includes('"' + n.toLowerCase() + '"')) hit.push(n);
  return hit;
}
function refuseRunning(who){
  const hit = running();
  if(!hit.length) return;
  throw new Error(who + ' 要写 resources\\app 那一层，而这些进程正开着：' + hit.join('、') +
    '。\n  先关掉它们（托盘里右键退出），或者加环境变量 FD_IGNORE_RUNNING=1 硬来。');
}

/* 这一层的目录形状要能跟别人对齐着看，所以把三个根也露出去；
   那几份小工具函数（walk / copyInto / copyDir / pickLatest）build-app 铺运行时要再用一遍，
   不再抄第二份 —— 抄一份就会有一处忘了改。 */
export { jobs, plan, apply, walk, copyInto, copyDir, pickLatest, running, refuseRunning,
  RES as MIRROR, OUT as TREE_ROOT, SRC_DATA, SRC_PAGES, HERE as PACK_DIR };
export default { jobs, plan, apply };
