/* ============================================================
   gate-pack46.mjs · 外46：本体和七家插件一起打包（取消发布物零插件）
   ------------------------------------------------------------
     node src/tools/probes/gate-pack46.mjs
   钉的是这么几件事：
     一、发布脚本把每一家铺两格 —— 活的（data\plugins\）和原版（data\plugins-factory\），
        两格用的就是零卖那包 zip 的同一批字节，号也是同一串；
     二、data\ 那道硬闸从「一个字节都不许进」改成「只许插件那两格」，再加一条正向钉：
        货架上有几家，树里就得有几家的两格，缺一家当场停工报名字；
     三、安装壳覆盖升级遇到 data\plugins\ 里已经有同一个名字的文件就不搬不写
        —— 那一格是「改代码」直接改的地方，换回出厂那一份就是弄丢用户写的东西；
     四、旧口径那几句话（一个插件都不带 / 一棵都不进 / 不许带插件代码）在所有说明和报错里消失；
     五、真跑一趟 publish --dry：树里报出的家数与货架上的包数对得上，且一个字节没写。
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { rd, 记账, ROOT } from './lib-slice.mjs';

const 台 = 记账('gate-pack46');
const pub = rd('src/pack/publish.mjs');
const sfx = rd('src/pack/sfx.cs');
const 闸 = rd('src/tools/audit.mjs');

台.题('一、每一家铺两格，用的是同一批字节');
台.判('包内件这一颗在（把一家拆成名字→字节）', pub.includes('function 包内件(p, 用了号){'));
台.判('压零卖的包走的就是这一批字节（packZip 只剩一行）',
  pub.includes('function packZip(p, 用了号){ return writeZip(包内件(p, 用了号)); }'));
台.判('活的那一格铺进树', pub.includes("made.set('data/plugins/' + m.id"));
台.判('原版那一格铺进树', pub.includes("made.set('data/plugins-factory/' + m.id"));
台.判('两格共用同一个循环里那一批件（不再读第二遍磁盘）', pub.includes('for(const e of 件){'));
台.判('插件清单那一格换成传进来的号（四处一个串）', pub.includes('version: 用了号'));

台.题('二、data 那道闸：只放两格，还正向钉齐不齐');
台.判('放行只看那两个前缀',
  pub.includes("k.startsWith('data/plugins/') || k.startsWith('data/plugins-factory/')"));
台.判('旧那句「一个字节都不许进」没了', !pub.includes('份路径里没有一个落在'));
台.判('报错话改成「插件那两格之外一律不进」', pub.includes('插件那两格之外一律不进'));
台.判('正向钉：哪一家缺格就报名字并停工',
  pub.includes('插件没铺进首装那棵树：') && pub.includes('process.exit(1)'));

台.题('三、安装壳让开用户改过的那一份');
台.判('KeepUserFile 这一颗在', sfx.includes('static bool KeepUserFile(string dest, Entry it)'));
台.判('认的是活的那一格（原版那一格不在这条前缀里）', sfx.includes('StartsWith("data/plugins/")'));
const 让 = (sfx.match(/KeepUserFile\(dest, it\)/g) || []).length;
台.数('让路那一手出现在几处', 让);
台.判('正好三处：占用检查、旧的搬备份、新的摊出去（少一处就是要么白搬走要么强覆盖）', 让 === 3);

台.题('四、旧口径那几句话消失');
for(const f of ['src/pack/publish.mjs', 'src/pack/main.cjs', 'src/pack/comp-files.cjs',
                'src/pack/mirror.mjs', 'src/tools/audit.mjs', 'src/_fd/fd-serve.mjs',
                'src/_build/release.mjs', 'src/pack/build-app.mjs']){
  台.判(f + ' 里不再说「一个插件都不带 / 一棵都不进 / 不许带插件代码」',
    !/一个插件都不|一棵都不进这一棵树|发布物里不许带插件代码/.test(rd(f)));
}
台.判('安装说明改口成「带着插件」', pub.includes('这一份发布物带着插件（'));
台.判('自查那条「程序代码那一层不收插件」还钉着（只换了理由）',
  闸.includes('出厂镜像里又出现了插件那一格') && 闸.includes('程序代码这一层不收'));

台.题('五、真跑一趟 publish --dry');
let 报 = '';
try{
  报 = execFileSync(process.execPath, ['src/pack/publish.mjs', '--dry'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}catch(e){ 报 = String((e && e.stdout) || '') + String((e && e.stderr) || (e && e.message) || e); }
const m = 报.match(/([0-9]+) 家×两格齐/);
const 货架 = (报.match(/货架 ([0-9]+) 个包/) || [])[1];
台.判('--dry 报出几家×两格齐（实际：' + (m ? m[1] + ' 家' : '没报') + '）', !!m);
台.判('树里那几家与货架那几个包同一个数（' + 货架 + '）', !!m && !!货架 && m[1] === 货架);
台.判('--dry 一个字节没写：那一趟自己说了（没落盘）', 报.includes('（没落盘）'));

台.收尾();
