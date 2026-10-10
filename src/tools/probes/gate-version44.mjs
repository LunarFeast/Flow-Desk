/* 外44 那一套版本号形状的闸（他 2026-10-10 定的：1.0.0-alpha+build.<git 短哈希>，内部计数撤掉）
   ------------------------------------------------------------
   钉四件事：
     一 · 号只有一处真身，形状对，短哈希不进版本格（先 commit → 拿哈希 → 号当环境变量传进打包）
     二 · 每生成一次页面自己加一那个内部计数（1.4.0-dev.17 尾巴那个 17）真的没了
     三 · 全链不再「挑号最大的那一张页」—— 号回跳之后那条会挑回旧页，屏幕上跑上上个版本
     四 · 比大小的那几处都不把短哈希当数字（1.0.0-alpha+build.977bc41 拆出来是 [1,0,0]）
   跑法：node src/tools/probes/gate-version44.mjs */
import { rd, 记账 } from './lib-slice.mjs';
import { 号, 底号, 页名 } from '../../_build/version.mjs';

const 台 = 记账('外44 版本号形状');

/* ---------- 一 · 一处真身 + 形状 ---------- */
台.题('一 · 号从哪儿来');
const vj = JSON.parse(rd('src/_build/version.json'));
台.数('version.json 里写的', JSON.stringify(vj));
台.判('版本格里只有前两段（主.次.补丁 + 预发布），没有 shell 之外的号段', typeof vj.shell === 'string' && /^\d+\.\d+\.\d+$/.test(vj.shell));
台.判('短哈希不写进版本格（它由打包那一刻传进来，源码一个字不改）', vj.build === undefined && !/build/.test(JSON.stringify(vj)));
const 串 = 号();
台.数('当前这一支号', 串);
台.判('形状是 主.次.补丁[-预发布][+build.短哈希]', /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+build\.[0-9a-f]{4,40})?$/.test(串), 串);
台.判('同一笔提交问两次是同一串号（不烧号、不自增）', 号() === 串);
台.判('不带 build 的那一支也在（比大小、认档用它）', typeof 底号() === 'string' && 底号().indexOf('+') < 0, 底号());
台.判('产物页名带的就是这一串', 页名() === 'Flow_Desk_' + 串 + '.html', 页名());

/* ---------- 二 · 内部计数撤干净 ---------- */
台.判('version.mjs 里没有「下一号」和「落账」这两颗（每生成一次加一那把尺废了）',
  !/下一号/.test(rd('src/_build/version.mjs')) && !/export function 落账/.test(rd('src/_build/version.mjs')));
const 生 = rd('src/_fd/build.mjs');
台.判('生成页面那一趟不再落账，也不再取「下一号」', !/落账\(/.test(生) && !/下一号/.test(生));
台.判('生成那一趟直接用当前号', /const 版 = 号\(\);/.test(生));

/* ---------- 三 · 不许再挑「号最大的那一张」 ---------- */
台.题('三 · 挑页那几处按什么认');
const 主 = rd('src/pack/main.cjs'), 镜 = rd('src/pack/mirror.mjs'),
      发 = rd('src/pack/publish.mjs'), 包 = rd('src/pack/build-update.mjs'), 服 = rd('src/_fd/fd-serve.mjs');
台.判('主进程挑入口页按文件时间认（号回跳之后「最大」会挑回旧页）',
  /mt - best\.mt \|\| cmpVer/.test(主) && /statSync\(path\.join\(dir, n\)\)\.mtimeMs/.test(主));
台.判('开发服务器那一处同一条规矩', /mt - best\.mt \|\| cmpVer/.test(服));
台.判('出厂镜像认当前号那一张页（不是 pages\\ 里最大的）', /页名\(\)/.test(镜));
台.判('打更新包的认当前号那一张页', /const VERSIONS = \{ fd: 号\(\) \}/.test(包) && !/function verIn/.test(包));
台.判('发布那一头也认当前号，并且页不在就停下', /const VER = \{ fd: 号\(\) \}/.test(发) && /没有当前这一支号的页/.test(发));
台.判('四处都不留 pickLatest 挑页那一手（镜像那一颗留给别处用，但不再挑页）',
  !/pickLatest\(PAGES/.test(包) && !/pickLatest\(PAGES/.test(发) && !/pickLatest\(SRC_PAGES, 'Flow_Desk_\*\.html'\);$/.test(镜.split('const 当前')[1] || ''));

/* ---------- 四 · 短哈希不参与比大小 ---------- */
台.题('四 · 比大小的那几把尺');
const 切 = s => (s.match(/function verNum\(raw\)\{ return ([^\n]+)\n/g) || []);
for(const [名, 文] of [['主进程', 主], ['出厂镜像', 镜], ['发布', 发], ['开发服务器', 服]]){
  const 有 = /split\('\+'\)\[0\]/.test(文) || /raw\.split\('\+'\)\[0\]/.test(文);
  台.判(名 + '那一处先把 +build 之后切掉再取数字段', 有);
}
台.数('四把尺都在', 切(主).length + 切(镜).length + 切(发).length + 切(服).length + ' 处 verNum');
台.判('比大小只看数字段（短哈希不参与）', 底号().split('+').length === 1);
台.收尾();
