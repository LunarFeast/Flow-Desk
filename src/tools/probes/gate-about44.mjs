/* ============================================================
   gate-about44.mjs · 外44 四~七：zip 更新链撤干净 / 覆盖升级认得装着的那一棵 /
                      帮助文档整份撤 / 关于看得到当前版本号
   ------------------------------------------------------------
     node src/tools/probes/gate-about44.mjs
   钉的是"撤掉的确实没了、留下的还连着"，不是钉实现细节。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { rd, 记账, ROOT } from './lib-slice.mjs';

const 台 = 记账('gate-about44');
const 在 = 相 => fs.existsSync(path.join(ROOT, 相));
const 主 = rd('src/pack/main.cjs'), 发 = rd('src/_build/release.mjs'), 壳 = rd('src/pack/sfx.cs'),
      预 = rd('src/pack/preload.cjs'), 桥 = rd('src/_shared/sh-load.js'),
      页 = rd('src/_fd/src/fd4-builtin.js'), 拼 = rd('src/_fd/build.mjs'),
      顶 = rd('src/_fd/src/fd9-title.js'), 镜 = rd('src/pack/mirror.mjs'),
      公 = rd('src/pack/publish.mjs'), 单 = rd('src/pack/uitext.cjs');
/* 整棵源码扫一遍（node_modules 不算：那是 electron 自带的东西，改不了也不该改；
   这台探针自己也不算：它嘴里念的就是那些要撤干净的名字，算进去就成了自己抓自己） */
const 这台 = 'src/tools/probes/gate-about44.mjs';
function 全扫(认){
  const 中 = [];
  (function 走(dir){
    for(const e of fs.readdirSync(dir, { withFileTypes:true })){
      if(e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const f = path.join(dir, e.name);
      if(e.isDirectory()) 走(f);
      else if(/\.(cjs|mjs|js|cs|html)$/.test(e.name)){
        const 相 = path.relative(ROOT, f).replace(/\\/g, '/');
        if(相 === 这台) continue;
        if(认(fs.readFileSync(f, 'utf8'))) 中.push(相);
      }
    }
  })(path.join(ROOT, 'src'));
  return 中;
}

/* ---------- 一 · 主程序那条 zip 更新链 ---------- */
台.题('一、挑 zip 装更新那一条路撤干净了');
台.判('打更新包那颗脚本没了（src/pack/build-update.mjs）', !在('src/pack/build-update.mjs'));
台.判('装更新包那份脚本没了（src/pack/updater.cjs）', !在('src/pack/updater.cjs'));
台.判('四条通道名 upd:info / upd:pick / upd:plan / upd:start 一处不剩',
  全扫(s => /upd:(info|pick|plan|start)/.test(s)).length === 0, 全扫(s => /upd:(info|pick|plan|start)/.test(s)).join(' | '));
台.判('递到页面那四个名字 updInfo / updPick / updPlan / updStart 一处不剩',
  全扫(s => /upd(Info|Pick|Plan|Start)\b/.test(s)).length === 0, 全扫(s => /upd(Info|Pick|Plan|Start)\b/.test(s)).join(' | '));
台.判('插件读包那两颗还在：src/pack/zip-read.cjs 露 zipIndex 和 unzipEntry',
  在('src/pack/zip-read.cjs') && /module\.exports = \{ zipIndex, unzipEntry, cleanName \}/.test(rd('src/pack/zip-read.cjs')));
台.判('主进程读插件包改吃这一份（四处 require 全跟上）', (主.match(/require\('\.\/zip-read\.cjs'\)/g) || []).length === 4,
  (主.match(/require\('\.\/zip-read\.cjs'\)/g) || []).length);
台.判('发布脚本不再收 update\\packages 那一格（那一格是那条路的产物）', !发.includes('packages'));
台.判('那一格在盘上也收走了（树里已经没有 update\\packages）', !在('update/packages'));
台.判('覆盖升级换下来的旧东西还照原样进 update\\backups（这一格留着）', /"backups"/.test(壳));
台.判('「改页面文字」那台小工具认的文件名跟着换（不再认 updater.cjs）',
  !单.includes('src/pack/updater.cjs') && 单.includes('src/pack/zip-read.cjs'));

/* ---------- 二 · 双击新 exe 认出装过的那一棵 ---------- */
台.题('二、覆盖升级自己记着装在哪一棵（仍可换地方）');
台.判('记的落点是用户目录那一格（不写注册表、不在树里）',
  /SpecialFolder\.LocalApplicationData/.test(壳) && /"Flow-Desk"/.test(壳) && /install\.txt/.test(壳));
台.判('装成一次就记一次（成功那一步里调 MemoWrite）',
  /MemoWrite\(dest\)/.test(壳) && 壳.indexOf('j.Code = 0') < 壳.indexOf('MemoWrite(dest)'));
台.判('没指地方时先读那一格，读不到才回到 exe 旁边那棵',
  /string memo = Memo\(\);/.test(壳) && /string\.IsNullOrEmpty\(memo\)/.test(壳));
台.判('命令行 --dest= 那条路还在（探针和脚本照样能指地方）', /--dest=/.test(壳));
台.判('照样能换地方：那颗挑目录的钮和那行编辑框都还在', /Pick/.test(壳) && /TextBox Box/.test(壳));
台.判('记不上不算错：写那一格包在 try 里（读不到也只当没记）', /static void MemoWrite[\s\S]{0,220}catch\(Exception\)\{\}/.test(壳));

/* ---------- 三 · 帮助文档整份撤 ---------- */
台.题('三、帮助文档那一份和吃它的入口一起撤了');
台.判('页面里那一颗 fd7-help.js 没了', !在('src/_fd/src/fd7-help.js'));
台.判('拼页面的名单里不再点它（顶上那句历史账本提一句不算）', !拼.includes("'fd7-help.js'"));
台.判('主进程不再往 data\\ 铺工作副本（syncHelp 一处不剩）', 全扫(s => /syncHelp/.test(s)).length === 0, 全扫(s => /syncHelp/.test(s)).join(' | '));
台.判('出厂镜像不再把帮助当底本取件', !镜.includes("'help.md'"));
台.判('顶栏菜单里那一项没了（也没有 Ctrl H 那条快捷键）', !顶.includes('帮助文档') && !页.includes('打开帮助'));
台.判('主进程不再拦 Ctrl+H、不再往页面递 fd:help', !/winCtl\('help'\)/.test(主) && !/fd:help/.test(主) && !/fd:help/.test(预));
台.判('出厂那一层里也没有帮助的一份', !在('resources/app/data/help.md') || !镜.includes('help.md'));
台.判('源码里不再有「help.md」这个名（改名表那类历史账本除外）',
  全扫(s => /help\.md/.test(s)).length === 0, 全扫(s => /help\.md/.test(s)).join(' | '));

/* ---------- 四 · 关于：程序 + 每一家的号 ---------- */
台.题('四、关于那一屏看得到当前版本号');
台.判('主进程把装着的一家一家递出去（取的是运行时真正加载的那份说明书）',
  /packs:家/.test(主) && /packScan\(\)\.packs\.filter\(p => p\.manifest\)/.test(主));
台.判('没有说明书的那一格不列（不编一个号出来）', /filter\(p => p\.manifest\)/.test(主));
台.判('关于那一行把每一家列出来，没写号的照实说', 页.includes('r.packs') && 页.includes('说明书没写号'));
台.判('压零卖的包时把说明书那一格换成发布传进来的号（号只有一处真身）',
  /function packZip\(p, 用了号\)/.test(公) && /Object\.assign\(\{\}, m, \{ version: 用了号 \}\)/.test(公));
台.判('货架清单和安装标记里那一份号同源（都吃传进来的那一串）', /version: 出/.test(公) && /plugins: shelf\.map/.test(公));
台.判('关于那一格不再吃更新包的信息（只报本机是什么）', !主.includes('updVersions') && /aboutVersions/.test(主));

台.收尾();
