/* 组件往 ctx.state 存东西那道闸（外39 · 2026-10-09 现场量出来的一个旧 bug）
   ------------------------------------------------------------
   闸在 _shared/sh-load.js 的 stOk：从前只认「包 id 打头」的键。音乐遥控器存的是
   music-dir / music-ly 这一串，包 id 从前叫 to-music、现在叫 music-remote，两头都不打头 ——
   那 14 处读写一辈子全被挡，其中裹了 try 的静默失败、没裹的那两行（选完目录、选完歌词文件）当场抛。
   这一台钉三件事：
     一 · 判的是源码里那一句 stOk（端进虚拟机跑），不是抄一份第二判据
     二 · 六家组件往 state 写的每一个键都过一遍这道闸，一个不落
     三 · 说明书那一栏（manifest.stateKeys）没写就等于没过 —— 排掉这一档，music-dir 必须被挡回去
   图标那处一并记在这儿：pack-<id> 那把键两头本来就对得上（main.cjs 扫包用目录名、页面那头 icoFor 传 id），
   开发服务器量不到是因为那一棵没有主进程桥、按文件开头的说明退回出厂线稿 —— 不是 bug，别当漏修。 */
import fs from 'node:fs';
import { ROOT, rd, 记账 } from './lib-slice.mjs';

const 台 = 记账('组件状态键那道闸');
const 六家 = ['notes', 'schedule', 'music-remote', 'your-sentences', 'why-not-write', 'singbit-input-practice'];

/* ---------- 一 · 端真源码里那一句 ---------- */
台.题('一 · 判据是 sh-load.js 里那一句 stOk 本身');
const 源 = rd('src/_shared/sh-load.js');
const 那一句 = /^\s*const stOk = [\s\S]*?\};/m.exec(源);
if(!那一句) throw new Error('没在 sh-load.js 里找到 stOk 那一句（它换了写法，这台要跟着改）');
const 造闸 = new Function('id', 'm', 那一句[0] + '\nreturn stOk;');
台.数('端出来的那一句行数', 那一句[0].split('\n').length);
台.判('那一句里既有包 id 打头那一档、也认说明书点名的前缀（两头都在源码里，不是抄的）',
  /id \+ '-'/.test(那一句[0]) && /stateKeys/.test(那一句[0]), 那一句[0].replace(/\s+/g, ' ').slice(0, 120));
台.判('自检这一台判得住：给个假包，id 打头的键过、别的不过',
  造闸('demo', {})('demo-a') === true && 造闸('demo', {})('other-a') === false, 'demo-a / other-a');

/* ---------- 二 · 六家的键逐个过闸 ---------- */
台.题('二 · 六家组件往 state 写的每一个键，对着这道闸过一遍');
const 格 = ROOT + 'data/plugins';
const 键表 = [];
for(const 家 of 六家){
  const f = 格 + '/' + 家 + '/main.js';
  if(!fs.existsSync(f)) continue;
  const s = fs.readFileSync(f, 'utf8');
  const 键 = new Set();
  for(const m of s.matchAll(/(?:State|state)\.(?:get|set)\(\s*'([^']+)'/g)) 键.add(m[1]);
  const 说明 = JSON.parse(fs.readFileSync(格 + '/' + 家 + '/manifest.json', 'utf8'));
  for(const k of 键) 键表.push({ 家, k, 过: 造闸(家, 说明)(k),
    靠声明: 造闸(家, 说明)(k) === true && 造闸(家, {})(k) === false });
}
台.数('六家往 state 写的键', 键表.length + ' 个：' + 键表.map(x => x.家 + '/' + x.k).join('、'));
const 挡 = 键表.filter(x => !x.过);
台.判('一个不落全过闸（有一个不过就是存不进也读不到，界面上看不出来）', 挡.length === 0,
  挡.length ? 挡.map(x => x.家 + '/' + x.k).join('、') : '全过');
台.数('其中靠说明书那一栏才过得去的', 键表.filter(x => x.靠声明).length);

/* ---------- 三 · 说明书那一栏承重 ---------- */
台.题('三 · manifest.stateKeys 这一栏写没写、挡不挡得住');
const 音 = JSON.parse(fs.readFileSync(格 + '/music-remote/manifest.json', 'utf8'));
台.判('音乐遥控器说明书里点了 music- 这一档前缀', Array.isArray(音.stateKeys) && 音.stateKeys.includes('music-'), 音.stateKeys);
台.判('键名和包 id 打头那一档确实对不上（所以非靠这一栏不可）',
  !'music-dir'.startsWith(音.id + '-') && !'music-ly'.startsWith(音.id + '.'), 'id = ' + 音.id);
const 拆了 = 造闸('music-remote', {})('music-dir');
台.判('反证 · 把说明书那一栏拿掉，music-dir 必须被挡回去（挡不住说明这一栏没承重）', 拆了 === false, 拆了);
const 别家 = 造闸('notes', {})('music-dir');
台.判('这一栏不越界：便签那一头拿同一个键还是被挡', 别家 === false, 别家);

台.收尾();
