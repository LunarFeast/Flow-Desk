/* ============================================================
   gate-upgrade44.mjs · 外44 二：首装那一颗 exe 要能覆盖升级（升级走 exe，zip 归插件）
   ------------------------------------------------------------
     node src/tools/probes/gate-upgrade44.mjs
   钉的是这几件事，不是钉实现细节：
     ① 目标那一棵已经在了不再拒绝（从前那句「升级别用这一个」是这条链的断口）
     ② 动手之前先问「那一棵开着没有」，开着就一个字节不动
     ③ 旧的先去 update\backups\<时间戳>\：resources\app\ 整层挪、别的一个文件一份，
        pages\ 不许整层挪（那一格同时是他放文稿的地方）
     ④ data\ 一个字节不碰 —— 靠 publish 那道「包里不许有 data\」的硬闸 + 这一颗只做两件事：挪走和摊开
     ⑤ 编译得过（这一颗是 Windows 自带的 csc 现编的，编不过就没有首装包）
   往探针工区（src\tools\本地路径.cjs 里那颗「工区」）编一颗检查用的壳，仓里那颗 sfx-stub.exe 不碰，C 盘不留东西。
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { rd, 记账, ROOT } from './lib-slice.mjs';
import { 工区 } from '../本地路径.mjs';

const 台 = 记账('gate-upgrade44');
const sfx = rd('src/pack/sfx.cs');
const pub = rd('src/pack/publish.mjs');
const upc = rd('src/pack/updater.cjs');

const 段 = 名 => {
  const 起 = sfx.indexOf('static Job ' + 名);
  if(起 < 0) throw new Error('切不到这一颗：' + 名);
  const 止 = sfx.indexOf('\n    }', 起);
  return sfx.slice(起, 止 < 0 ? sfx.length : 止 + 8);
};
const Install = 段('Install');

台.题('一、已经有的那一棵不再被拒');
台.判('从前那句「升级别用这一个」已经没了', !sfx.includes('升级别用这一个'));
台.判('从前那条「这儿已经有一棵」的拒绝整块没了', !sfx.includes('这儿已经有一棵'));
台.判('旧那个拒绝用的返回码不再往外抛（return 2 一处都没有）', !/(^|[^\d])return 2;/.test(sfx), (sfx.match(/return 2;/g) || []).length);
台.判('首装和覆盖升级走同一条道（Install 这一颗既是入口也认那一棵在不在）', /bool up = IsTree\(dest\);/.test(Install));
台.判('界面上那颗按钮跟着换话（覆盖升级 / 开始安装两副面孔）', /Go\.Text = upgrade \? "覆盖升级" : "开始安装";/.test(sfx));
台.判('窗口标题和错误框都认得出这一趟是升级', /"Flow-Desk 覆盖升级"/.test(sfx));

台.题('二、那一棵正开着就一个字节都不动');
台.判('动手前先问一遍能不能写（Busy 这一颗在）', /static string Busy\(string dest, Payload pl\)/.test(sfx));
台.判('探测的办法是独占打开（FileShare.None），不是猜进程名', /new FileStream\(to, FileMode\.Open, FileAccess\.Write, FileShare\.None\)/.test(sfx));
台.判('开着的时候先返回、不落到挪和摊那两步', Install.indexOf('Busy(dest, pl)') < Install.indexOf('Stash(dest, pl, back)'));
台.判('开着这一条给的是单独的码 7（不是"出了岔子"那个 4）', /j\.Code = 7;/.test(Install));
台.判('码 7 不关窗口，让他退了再点一次', /if\(code != 7\)/.test(sfx));
台.判('码 7 那一趟把三颗控件放开（不是死窗口）', /d\.Go\.Enabled = true; d\.Pick\.Enabled = true; d\.Box\.Enabled = true;/.test(sfx));
台.判('话里说明白「一个字节都还没动」', Install.includes('一个字节都还没动'));

台.题('三、旧的先去备份，落点和 zip 那一头同一格');
台.判('备份落在 update\\backups\\<时间戳>（和 updater.cjs 同一格）', /Path\.Combine\(dest, "update"\)/.test(Install) && upc.includes("'backups'"));
台.判('时间戳形状和 zip 那一头同一把尺（四位年两位月日 - 时分秒，两边排在一起才对）',
  /ToString\("yyyyMMdd-HHmmss"\)/.test(sfx) && /getFullYear\(\)[\s\S]{0,120}getSeconds\(\)/.test(upc));
台.判('程序里那一屏列备份是按名字排的（这一颗起的名字要能插进去，不能自成一套）',
  /\.readdirSync\(dir\)\.filter\(n => !n\.startsWith\('\.'\)\)\.sort\(\)\.reverse\(\)/.test(rd('src/pack/main.cjs')));
台.判('整层挪只有 resources\\app\\ 这一处（Directory.Move 全文就一次）', (sfx.match(/Directory\.Move/g) || []).length === 1, (sfx.match(/Directory\.Move/g) || []).length);
台.判('那一处挪的就是 app 这一层，不是页面层', /Directory\.Move\(app, to\)/.test(sfx));
台.判('pages\\ 不做整层挪（源码里 pages 和 Directory.Move 不沾边）', !/Directory\.Move\([^)]*pages/i.test(sfx));
台.判('别的是一个一个文件挪（File.Move 在逐条目那一段里）', /File\.Move\(from, to\)/.test(sfx));
台.判('整层挪过的那些不再重复挪（跳过 resources/app/ 前缀）', /it\.Name\.StartsWith\("resources\/app\/"\)/.test(sfx));
台.判('挪不动就停下报是哪一份，已挪的把落点报出来', /旧的 " \+ it\.Name \+ " 挪不动/.test(sfx) && /已经挪走的旧文件都在/.test(Install));

台.题('四、data\\ 不碰这件事靠什么成立');
台.判('publish 那道「包里不许有 data\\」的硬闸还在', pub.includes('首装那棵树里出现了数据层的格子'));
台.判('这一颗只有两种落子：挪走和摊开（没有删除那一手）', !/File\.Delete|Directory\.Delete/.test(sfx), (sfx.match(/File\.Delete|Directory\.Delete/g) || []).length);
台.判('摊开的目标只从选定的那一棵拼（不写死别的格）', /Path\.Combine\(dest, it\.Name\.Replace\(\'\/\', Path\.DirectorySeparatorChar\)\)/.test(sfx));

台.题('五、闷头那一条道（探针和脚本用的 --quiet）也走同一步');
台.判('--quiet 走的是 Install 这一颗，不是老的 Extract 直摊', /Job j = Install\(self, pl, dest, null\);/.test(sfx));
台.判('Extract 不再自己去开包（号取一次、检查一遍，同一个 Payload 用到底）', /static Result Extract\(string self, Payload pl, string dest/.test(sfx));
台.判('包读不出来当场停（码 3），不去动已有那一棵', /if\(pl == null\)\{ Say\(quiet, "这个 exe 后面没有包/.test(sfx));

台.题('六、编得过才算数');
const CS64 = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const CS32 = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
const csc = fs.existsSync(CS64) ? CS64 : fs.existsSync(CS32) ? CS32 : null;
台.判('这台机器有 Windows 自带的那个编译器', !!csc, csc);
if(csc && 工区){
  const out = path.join(工区, 'gate-upgrade44.exe');
  let 编 = '过', 成 = false;
  try{
    fs.mkdirSync(path.dirname(out), { recursive: true });   /* 工区那一格不在就先补一颗，别把检查用的壳落到 C 盘 */
    execFileSync(csc, ['-nologo', '-target:winexe', '-out:' + out,
      '-r:System.Windows.Forms.dll', '-r:System.Drawing.dll', path.join(ROOT, 'src/pack/sfx.cs')],
      { stdio: 'pipe' });
    成 = true;
  }catch(e){ 编 = String((e && (e.stdout || e.stderr)) || e.message).replace(/\r?\n/g, ' ').slice(0, 300); }
  台.判('这一颗 C# 编得成（检查用的壳落在探针工区那一格，仓里那颗 sfx-stub.exe 没碰）', 成, 编);
}else 台.数('编译那一步', '这台没登记编译器或探针工区（src\\tools\\本地路径.cjs 里那颗「工区」），不在就不量');
台.判('发布那一头仍会重编：壳比源码旧就再来一遍', /fs\.statSync\(stub\)\.mtimeMs < fs\.statSync\(stubSrc\)\.mtimeMs/.test(pub));
台.判('首装包的名字带完整号（含 +build.短哈希那一截）', /'Flow_Desk_setup_' \+ VER\.fd \+ '\.exe'/.test(pub) && /const TAG = VER\.fd;/.test(pub));
台.判('安装说明改口成「再双击一颗 exe 就是覆盖升级」', pub.includes('点「覆盖升级」') && pub.includes('resources\\\\app\\\\ 整层挪'));
台.判('安装说明里 zip 那条降级成老路子，不再当唯一出口', pub.includes('那条挑 FlowDesk_update_*.zip 的老路还在'));

台.收尾();
