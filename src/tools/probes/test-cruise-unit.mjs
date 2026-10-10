/* 外27 丙组 · 图8 单格巡航：把 w19-cruise.js 里真的 build() / cells() 抠出来跑，不照抄逻辑 */
import fs from 'node:fs';
import vm from 'node:vm';

const SRC = 'D:/Programs/Flow-Desk/src/_wnw/src/w19-cruise.js';
const txt = fs.readFileSync(SRC, 'utf8');

/* 一个沙箱里同时放真的 cruiseCells / LyricFmt 和被抠出来的方法：它们互相引用，分开编译就找不到彼此 */
const sb = { console, Math, JSON, Object, Array, Number, String,
  LyricFmt:{ okMs:v => Number(v) > 0 } };
vm.createContext(sb);

/* 顶层函数：整段抠出来 */
function loadTop(name){
  const i = txt.indexOf('\nfunction ' + name);
  const j = txt.indexOf('\n}\n', i);
  if(i < 0 || j < 0) throw new Error('找不到顶层函数 ' + name);
  vm.runInContext(txt.slice(i + 1, j + 2), sb);
}
/* 类里的方法：多行的抠到 '\n  }'，单行的抠到行尾 */
function loadMethod(name){
  const i = txt.indexOf('\n  ' + name + '(');
  if(i < 0) throw new Error('找不到方法 ' + name);
  const firstLine = txt.slice(i + 1, txt.indexOf('\n', i + 1));
  const src = /}\s*$/.test(firstLine) ? firstLine
    : txt.slice(i + 1, txt.indexOf('\n  }', i) + 4);
  vm.runInContext('globalThis.' + name + ' = function ' + src.trim() + ';', sb);
}
loadTop('cruiseCells');
loadMethod('build');
loadMethod('cells');
const { cruiseCells, build, cells } = sb;

/* 两行词格：第 1 行三格（中间那格是拆完留下的空档），第 2 行两格（第二格只有注音、没原文） */
const lines = [
  { clauses:[ { cells:[ {t:'un', ms:120, n:'ʌn'}, {t:'', ms:60}, {t:'mistakably', ms:400, n:'ˌmɪsˈteɪkəbli'} ] } ] },
  { clauses:[ { cells:[ {t:'sweat', ms:566, n:'swɛt'} ] }, { cells:[ {t:'', ms:80, n:'ət'} ] } ] }
];
const list = [{ id:'c1', title:'Chapter One', volT:'', doc:{ lines } }];

function run(unit, over){
  const self = { set:Object.assign({ scope:'all', ch:'', row:0, order:'fwd', unit }, over), list, q:[], i:0 };
  build.call(self);
  return self;
}
const out = [];
const ok = m => out.push('PASS ' + m), bad = m => out.push('FAIL ' + m);

const lineMode = run('line');
lineMode.q.length === 2 ? ok('整行那一档：队列 2 条 = 2 行') : bad('整行队列 = ' + lineMode.q.length);
lineMode.q.every(x => !x.c) ? ok('整行那一档：每条都不带 .c') : bad('整行队列混进了单格条目');

const cellMode = run('cell');
const got = cellMode.q.map(x => [x.c.t, x.k, x.i]);
const want = [['un', 0, 0], ['mistakably', 2, 0], ['sweat', 0, 1], ['', 1, 1]];
JSON.stringify(got) === JSON.stringify(want)
  ? ok('单格队列 4 条：un#0 / mistakably#2 / sweat#0 / （只剩注音那格）#1 —— 格号是它在行里的第几格，不是队列里的第几张')
  : bad('单格队列 = ' + JSON.stringify(got) + '，期望 ' + JSON.stringify(want));
cellMode.q.every(x => x.L && x.ch === 'Chapter One') ? ok('单格条目仍带着所属行与章名') : bad('单格条目丢了行上下文');

const rev = run('cell'); rev.set.order = 'rev'; build.call(rev);
rev.q[0].c.n === 'ət' ? ok('逆序 + 单格：第一张是最后那一格') : bad('逆序单格首张 = ' + JSON.stringify(rev.q[0].c));

const rowMode = run('cell', { scope:'row', row:1 });
rowMode.q.length === 2 && rowMode.q.every(x => x.i === 1) ? ok('行内 + 单格：只出第 2 行的 2 格') : bad('行内单格 = ' + rowMode.q.length);

/* 卡片那一头：一张卡摆几格 */
cells(cellMode.q[1]).length === 1 ? ok('单格那张卡只摆 1 格') : bad('单格卡摆 ' + cells(cellMode.q[1]).length + ' 格');
cells(lineMode.q[0]).length === 3 ? ok('整行那张卡摆 3 格') : bad('整行卡摆 ' + cells(lineMode.q[0]).length + ' 格');
cells(null).length === 0 ? ok('没有当前卡时 cells() 交回空数组，不炸') : bad('cells(null) 炸了');

/* 队列换档后落在第几张：整行 2 张走到第 2 张，切单格会变成 4 张，i 不该越界 */
const switched = run('line'); switched.i = 1; switched.set.unit = 'cell'; build.call(switched);
switched.i < switched.q.length ? ok('整行→单格后 i 没越界（i=' + switched.i + '，队列 ' + switched.q.length + '）')
  : bad('换档后 i=' + switched.i + ' 越界');

console.log(out.join('\n'));
console.log(out.some(x => x.startsWith('FAIL')) ? 'RESULT: FAIL' : 'RESULT: ALL PASS (' + out.length + ')');
