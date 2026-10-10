/* 外42 补的一台小闸：仓里那份 .bat 签出来得是双击跑得动的样子。
   ------------------------------------------------------------
   2026-10-10 那颗推送脚本（住在仓外的 D:\Programs\FD 推送\）报了一屏
   「'm' 不是内部或外部命令」「'low-Desk:' …」「'his' …」—— 一句 rem 被 cmd 拆成三条命令。
   根因不在脚本写了什么：它是 LF 换行，而 cmd.exe 读 LF 会把每行开头几个字吃掉。
   更要紧的是 .gitattributes 顶上那一条 `* text=auto eol=lf` 管到了 .bat ——
   也就是说谁重新签出一次都会再坏一遍，光把那一颗改对不算修完。
   所以这一台钉两件事：① 那条例外在不在、位置对不对（git 认最后一条匹配）；
   ② 仓里每一颗 .bat 在工作区是不是 CRLF、在仓里是不是照旧 LF（别让仓库长出 CR）。
   仓外那一颗只在他这台机上有，不在就明说没量，不硬编成失败。 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ROOT, 记账 } from './lib-slice.mjs';

const 台 = 记账('gate-batcrlf');
/* 仓里那一颗按签出的口径读（catfile 拿的是仓内那颗字模，不经签出转换），所以自己补一次转换 */
const git = a => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });
const 签出 = (名, 串) => {
  const eol = git(['check-attr', 'text', 'eol', '--', 名]).match(/eol: (\w+)/);
  const 光 = 串.replace(/\r\n/g, '\n');
  return eol && eol[1] === 'crlf' ? 光.replace(/\n/g, '\r\n') : 光;
};
const 数 = 串 => { const b = Buffer.from(串, 'utf8'); let cr = 0, lf = 0; for(const x of b){ if(x === 13) cr++; if(x === 10) lf++; } return { cr, lf }; };

台.题('一 · .gitattributes 里那条批处理例外');
const attr = fs.readFileSync(ROOT + '.gitattributes', 'utf8').split(/\r?\n/);
const 行号 = p => attr.findIndex(p);
const 例外 = 行号(l => /^\*\.bat\s/.test(l) && /eol=crlf/.test(l));
const 全拒 = 行号(l => /^\*\s+text=auto/.test(l));
台.判('有一条 *.bat 走 eol=crlf', 例外 >= 0, 例外);
台.判('它排在 `* text=auto eol=lf` 后面（git 认最后一条匹配）', 例外 >= 0 && 全拒 >= 0 && 例外 > 全拒, { 例外行: 例外 + 1, 全拒行: 全拒 + 1 });
台.数('那条例外写的是', 例外 >= 0 ? attr[例外] : '（没找到）');

台.题('二 · 仓里每一颗 .bat 的工作区与仓内换行');
const 名单 = git(['ls-files']).split('\n').filter(n => /\.bat$/i.test(n));
台.数('仓里的 .bat 份数', 名单.length);
for(const 名 of 名单){
  const 盘上 = 数(fs.readFileSync(ROOT + 名, 'utf8'));
  const 仓里 = 数(签出(名, git(['cat-file', 'blob', ':' + 名])));
  台.判(名 + ' 工作区是 CRLF（行行数对上）', 盘上.cr > 0 && 盘上.cr === 盘上.lf, 盘上);
  台.判(名 + ' 换一棵新签出也是 CRLF（仓里那颗字模过一遍签出转换）', 仓里.cr > 0 && 仓里.cr === 仓里.lf, 仓里);
}

台.题('三 · 仓外那颗推送脚本（只在这台机上量得到）');
const 外 = 'D:/Programs/FD 推送/push-all.bat';
if(fs.existsSync(外)){
  const 盘上 = 数(fs.readFileSync(外));
  台.判('push-all.bat 是 CRLF', 盘上.cr > 0 && 盘上.cr === 盘上.lf, 盘上);
} else 台.数('那一格不在这台机上', '没量（仓外那份，不算失败）');

台.收尾();
