/* 外42 这一批的闸（他三条点名：删「临时调试」那一档 / 数据页加一键清理 / 更新改页面文字那台小工具）
   ------------------------------------------------------------
   三件事各自钉住，每一条都报数：
     一 · 那一档删干净了 —— 源码里注册没了、实现整块没了；
         设置左边剩下的档数点得出来（少一档，不是多一档）
     二 · 一键清理这一条链接得上 —— 页面点的那一颗 → preload 那颗方法 → 主进程那条通道，
         名字一处对一处；真删排在开机那一趟，所以调用位置必须在内核认领用户目录（setPath）之前；
         留哪三样点名；界面上两句问话一字不改地摆着（点按钮算第一次，两道窗是第二、第三次）
     三 · 改页面文字那台工具补的两处 —— html 里内嵌脚本的话收得进清单；
         原句以槽结尾时，用户写在句尾的字不再被悄悄丢掉；html 那一层报的行号对得上源码
   主进程那颗真删（userWipe）要跑起来才有现场，这一台判的是它的写法和不许动的三样；
   真点一遍归人工闸：他自己开探针浏览器按那三次确认。 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { ROOT, rd, 切, 记账 } from './lib-slice.mjs';

const 台 = 记账('外42 一键清理与改字工具');
const require = createRequire(import.meta.url);
const U = require(ROOT + 'src/pack/uitext.cjs');

/* ---------- 一 · 临时调试那一档删干净 ---------- */
台.题('一 · 那一档还在不在');
const fd4 = rd('src/_fd/src/fd4-builtin.js');
台.判('源码里不再注册「临时调试」那一档', !/SetupTabs\.add\(\s*'临时调试'/.test(fd4));
台.判('那一档的实现整块没了（tabDebug 一处不剩）', !/tabDebug/.test(fd4));
台.判('它自己那两张色位表也跟着没了（DBG_SLOTS / DBG_MORE）', !/DBG_SLOTS|DBG_MORE/.test(fd4));
const 档数 = (fd4.match(/^SetupTabs\.add\(/gm) || []).length;
台.数('设置里现在摆几档', 档数);
台.判('摆的是外观 / 程序 / 快捷键 / 数据那四档', 档数 === 4
  && /SetupTabs\.add\('外观'/.test(fd4) && /SetupTabs\.add\('程序'/.test(fd4)
  && /SetupTabs\.add\('快捷键'/.test(fd4) && /SetupTabs\.add\('数据'/.test(fd4));

/* ---------- 二 · 一键清理的接线 ---------- */
台.题('二 · 那一颗按钮到主进程这一串接得上');
const pre = rd('src/pack/preload.cjs'), main = rd('src/pack/main.cjs');
const 页面 = 切(fd4, 'tabData');
const 通道 = (pre.match(/async dataWipe[\s\S]{0,200}?invoke\('([^']+)'/) || [])[1] || '';
const 挂到 = (main.match(/ipcMain\.handle\('([^']+)'[^)]*\(\)\s*=>\s*\{[\s\S]{0,220}?WIPE_FILE\(\)/) || [])[1] || '';
台.数('preload 那颗方法走的通道名', 通道);
台.判('界面上有那一颗「一键清理所有用户数据」', 页面.includes('一键清理所有用户数据'));
台.判('preload 有 dataWipe 这一颗，走的是 data:wipe', 通道 === 'data:wipe', 通道);
台.判('主进程挂的通道名和 preload 那一条一模一样', 挂到 === 通道, { 挂到, 通道 });
const 字条 = (main.match(/const WIPE_FILE = \(\) => path\.join\(DATA_ROOT, '([^']+)'\)/) || [])[1] || '';
台.数('那张字条落在数据层哪一格', 字条);
台.判('字条就在 data\\ 根上（不在插件那一格里）', !!字条 && !字条.includes('/') && !字条.includes('\\'), 字条);
台.判('主进程读写用的都是同一个文件名', main.includes("fs.readFileSync(WIPE_FILE()") && main.includes('fs.writeFileSync(WIPE_FILE()'));
const 清 = 切(main, 'userWipe');
台.判('清的那一趟跳过字条自己（不然删不到最后一笔）', 清.includes("'" + 字条 + "'"), 字条);
台.判('每一项是整格删（目录带里面那份一起）', /rmSync\([\s\S]{0,140}?recursive:\s*true/.test(清));
台.判('删不掉的记一笔，不静默', /out\.failed\.push/.test(清));
const KEEP = (main.match(/const WIPE_KEEP = \[([^\]]+)\]/) || [])[1] || '';
台.数('留着的那几样', KEEP.replace(/\s+/g, ''));
台.判('留插件那一格（代码与名单不是用户数据）', KEEP.includes("'plugins'"));
台.判('留原版那一格（导入那一下留的底，跟代码走不是跟数据走）', KEEP.includes("'plugins-factory'"));
台.判('留日志', KEEP.includes("'logs'"));
台.判('留搬家那本账', KEEP.includes("'relocate.txt'"));
const 调用行 = main.split('\n').findIndex(l => /^const WIPE = userWipe\(\);/.test(l));
const 认领行 = main.split('\n').findIndex(l => l.includes("app.setPath('userData'"));
台.数('清那一趟在第几行 · 内核认目录在第几行', 调用行 + 1 + ' / ' + (认领行 + 1));
台.判('清排在内核认领用户目录之前（浏览器存储那格还没被占）', 调用行 >= 0 && 认领行 >= 0 && 调用行 < 认领行);
台.判('开机那一笔补记进日志（事后能查删了什么）', /WIPE\.log\.forEach/.test(main));
台.题('二 · 三次确认的口径');
/* 只盯这一颗按钮自己那一段：数据那一档里「断开目录」「导入」也各有一道确认，别混进来数 */
const 起 = 页面.indexOf('一键清理所有用户数据');
const 清块 = 起 >= 0 ? 页面.slice(起, 起 + 1400) : '';
台.判('点按钮算第一次，后面两道窗各问一句', (清块.match(/await fdAsk\(/g) || []).length === 2, (清块.match(/await fdAsk\(/g) || []).length);
台.判('第二道窗问的那句一字不改', 页面.includes('删除后无法从软件中找回，除非您已另有完整备份'));
台.判('第三道窗问的那句一字不改', 页面.includes('您确定要删除吗？'));
台.判('两句是连着问的（先过第二句才轮到第三句）', 页面.indexOf('删除后无法从软件中找回') < 页面.indexOf('您确定要删除吗？'));
台.判('第三道窗过了才真发那道清理', 页面.indexOf('您确定要删除吗？') < 页面.indexOf('dataWipe()'));
台.判('排下去之后给一次重启的选择（真删在下一趟开机）', 页面.includes('askRestart'));

/* ---------- 三 · 改页面文字那台工具 ---------- */
台.题('三 · 那台小工具补的两处');
const 尾 = U.splitTemplate('甲{1}{2}乙', 1);
台.数('一句「甲{1}{2}乙」只有一段字面量可写，拆出来是', JSON.stringify(尾));
台.判('写在句尾的「乙」没被丢掉（并进最后那一段）', 尾.length === 1 && 尾[0] === '甲乙', 尾);
const 中 = U.splitTemplate('一共 {1} 项', 2);
台.判('普通那句照旧拆成两段，没被这次改动带坏', 中.length === 2 && 中[0] === '一共 ' && 中[1] === ' 项', 中);
const { occ } = U.collectAll(ROOT.replace(/\/$/, ''));
const 骨架 = occ.filter(o => String(o.rel).replace(/\\/g, '/').endsWith('rp-base.html'));
const 脚本层 = 骨架.filter(o => o.why !== '静态页面');
台.数('声笔练习那页骨架收进多少处 · 其中内嵌脚本那一层', 骨架.length + ' · ' + 脚本层.length);
台.判('内嵌脚本里的话收得进清单（从前那一层整个被挖掉）', 脚本层.length > 0);
const 平 = s => String(s).replace(/\s+/g, ' ');   /* 清单里的字是把空白收拢过的（全角空格也算），比对时同一把尺 */
const 样本 = 脚本层.find(o => String(o.text).includes('lua-item')) || 脚本层[0];
const 骨架文 = rd('src/_build/rp-base.html');
台.判('脚本层报的行号对得上源码那一行', !!样本 && 平(骨架文.split('\n')[样本.line - 1] || '').includes(平(样本.text).slice(0, 10)), 样本 && 样本.line);
const 模板文 = rd('src/_fd/template.html');
const 标签后 = occ.filter(o => /\.html$/.test(String(o.rel).replace(/\\/g, '/')) && o.why === '静态页面');
const 错行 = 标签后.filter(o => {
  const 全文 = /rp-base\.html$/.test(o.rel) ? 骨架文 : 模板文;
  const 行 = 平(全文.split('\n')[o.line - 1] || '');
  return !行.includes(平(o.text).slice(0, 8));
});
台.数('html 标签之间那几处的行号 · 对不上的', 标签后.length + ' · ' + 错行.length);
台.判('标签之间那句的行号也对得上（从前差一行）', 错行.length === 0, 错行.slice(0, 2).map(o => o.line + ':' + o.text));

/* ---------- 四 · 清完那一趟就得是刚装好的样子（他真点了一遍才量出来的两处） ----------
   清理排在摆树之后：摆树刚铺好的详单、两份清单，紧接着就被这一趟删了，
   于是「重启之后就是刚装好的样子」要等再下一趟才成立。而 userdata-list.md 更狠 ——
   从头到尾没有任何一处把它铺回 data\，清完就永远读不到那一屏。 */
台.题('四 · 清完当场补铺，那几份别等下一趟');
const 补铺 = (main.slice(main.indexOf('const WIPE = userWipe();')).match(/^if\(WIPE\.deleted[\s\S]*?^\}/m) || [''])[0];
台.判('清掉过东西就再走一遍摆树（没清就不白跑）', 补铺.includes("if(WIPE.deleted.length)") && 补铺.includes('prepareTrees(TREE)'), 补铺.split('\n')[0]);
台.判('补铺那一趟的话并进同一笔日志（事后查得到铺了什么）', /WIPE\.log\.push\('清完补铺/.test(补铺));
台.判('补铺排在清理那一趟后面（顺序反了等于没清）', main.indexOf('const WIPE = userWipe();') < main.indexOf('if(WIPE.deleted.length)'));
const 铺 = 切(main, 'layList');
台.判('铺的那一步认「已经有了就一个字不动」（重跑不伤人）', /if\(fs\.existsSync\(work\)\) return true/.test(铺));
const 镜 = rd('src/pack/mirror.mjs');
const 底本段 = 镜.slice(镜.indexOf("note:'出厂底本"), 镜.indexOf("两份清单的出厂那份"));
const 三份 = (切(main, 'syncLists').match(/\[\s*'ui-text\.yaml'[^\]]*\]/) || [''])[0];
台.数('开机补铺那几份', 三份.replace(/\s+/g, ''));
台.判('补铺只铺那两份程序生成的清单（界面文字 / 卡片大小）', 三份.includes("'ui-text.yaml'") && 三份.includes("'card-size.yaml'") && 三份.split("'").length === 5, 三份);
台.判('用户数据详单不进出厂层（它是用户自己写的那一篇，首次安装就没有它）', !/userdata-list/.test(底本段) && !/userdata-list/.test(三份), 底本段 + ' | ' + 三份);
台.判('仓里也没有它的一份（不在公开面、也不在镜像取件处）', !fs.existsSync(ROOT + 'src/pack/data/userdata-list.md'));

/* ---------- 五 · 插件往发布物里走的三条路：两条仍然堵着，一条外46 又铺开了 ----------
   ① mirror 往 resources\app\data\plugins\ 铺一份 —— 仍然堵着（程序代码那一层不收插件）。
   ② 开机看见没有插件格就把自带那一层铺出来 —— 仍然堵着（seedMissing 没了）。
   ③ publish 把插件铺进首装树 —— 外43 拆过，外46 又铺开了：他 2026-10-10 定本体和插件一起打包，
      铺进去的是树里的 data\plugins\（活的）和 data\plugins-factory\（原版），不是 app 那一层。
   替代的形状仍在：导入那一下顺手往 data\plugins-factory\ 留一份原版，「恢复出厂」和随行文件兑底取这一格。 */
台.题('五 · 插件走发布物那三条路（两条堵着、一条外46 铺开）');
const pub = rd('src/pack/publish.mjs'), comp = rd('src/pack/comp-files.cjs'), serve = rd('src/_fd/fd-serve.mjs');
台.判('首装那棵树现在铺插件：活的与原版两处都落地（外46 起本体和插件一起打包）',
  pub.indexOf("made.set('data/plugins/'") >= 0 && pub.indexOf("made.set('data/plugins-factory/'") >= 0);
台.判('出厂镜像不再铺插件那一格（mode:\'packs\' 和那条 job 都没了）',
  !/mode:'packs'/.test(镜) && !/'data',\s*'plugins'/.test(镜));
台.判('镜像那把尺也不再认包（铺不了插件就不用来回扫包）', !/packScan/.test(镜));
台.判('开机不再把自带那一层铺成插件（seedMissing 主进程和那颗定义都没了）',
  !/seedMissing/.test(main) && !/seedMissing/.test(comp));
台.判('铺插件那一步换成了给老树搬家（从旧位置取过来，目标有了就不动）',
  /COMP\.adoptOldFactory\(/.test(main) && /adoptOldFactory\(from\)/.test(comp));
const 留底次数 = (main.match(/keepOriginal\(id\);/g) || []).length;
台.数('导入留底挂上了几处（开机摊 zip + 导入挑文件 + 导入挑文件夹）', 留底次数);
台.判('那三处都挂着（少一处就是有一条道装完没底）', 留底次数 === 3 && /function keepOriginal\(id\)/.test(main));
台.判('留底走的是 comp-files 那颗 keepFactory，先抹旧再整格复制', /keepFactory\(id\)/.test(comp) && /rmSync\(to, \{ recursive:true, force:true \}\)/.test(comp));
台.判('原版那一格在数据层（跟着用户的树走，更新包不碰 data\\）',
  /const ORIG_ROOT = path\.join\(DATA_ROOT, 'plugins-factory'\)/.test(main) && /factory:\(\) => ORIG_ROOT/.test(main));
台.判('开发服务器指的是同一格（两条通道同一个口径）', /'plugins-factory'/.test(serve) && !/resources', 'app', 'data', 'plugins'/.test(serve));
const 落地 = 切(main, 'landAsset');
台.判('随行文件的兜底也跟着换到那一格（不再从 resources\\app 取）',
  /path\.join\(ORIG_ROOT, id\)/.test(落地) && !/DATA_BUNDLED/.test(落地));
台.判('这一格不算书名（那道名字闸认它）', /'plugins', 'plugins-factory'/.test(main));
台.判('首装那份说明改口了（不再说一个插件都不带，改说跟着本体一起出门）',
  !/这一份发布物里一个插件都没有/.test(pub) && !/出厂带的那些包/.test(pub) && /这一份发布物带着/.test(pub));
台.收尾();
