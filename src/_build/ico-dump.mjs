/* 出厂线稿 → 一个图标一个文件，写两处：
   1) src\pack\icons\     出厂默认（跟着代码走，改代码就重画，生成页面时带进 resources\app\icons）
   2) 树根 icons\         给他换图的那一层：只补没有的，他自己改过的那张绝不动
   node src/_build/ico-dump.mjs              出厂全按代码重画，树根只补缺
   node src/_build/ico-dump.mjs --force      两处都重画（树根那层他改过的会被覆盖）
   代码里那份 ICO_D 只是浏览器直接打开单文件时的兜底，真正改图改的是 icons\ 里的文件。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const TREE = path.resolve(import.meta.dirname, '../..');
const FACTORY = path.join(TREE, 'src', 'pack', 'icons');
const LIVE = path.join(TREE, 'icons');
const force = process.argv.includes('--force');

/* 从共享模块里把 ICO_D 抠出来：整份文件在沙箱里跑一遍，只认这一个常量 */
const src = fs.readFileSync(path.join(TREE, 'src/_shared/sh-ico.js'), 'utf8');
const ctx = vm.createContext({});
const m = /const ICO_D = (\{[\s\S]*?\n\});/.exec(src);
if(!m) { console.log('没在 sh-ico.js 里找到 ICO_D'); process.exit(1); }
const ICO_D = vm.runInContext('(' + m[1] + ')', ctx);

fs.mkdirSync(FACTORY, { recursive:true });
fs.mkdirSync(LIVE, { recursive:true });
let fac = 0, live = 0, kept = 0;
for(const name of Object.keys(ICO_D)){
  /* 独立成图时 currentColor 就是黑：写死 #000，遮罩只看 alpha，别留悬案 */
  const body = ICO_D[name].replace(/stroke="currentColor"/g, 'stroke="#000"');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="#000" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>\n';
  const fp = path.join(FACTORY, name + '.svg');
  fs.writeFileSync(fp, svg); fac++;
  const lp = path.join(LIVE, name + '.svg');
  if(fs.existsSync(lp) && !force){ kept++; continue; }
  fs.writeFileSync(lp, svg); live++;
}
console.log('出厂 src\\pack\\icons\\ 重画 ' + fac + ' 张 · 树根 icons\\ 补了 ' + live + ' 张，保住他改过的 ' + kept +
  ' 张 · 一共 ' + Object.keys(ICO_D).length + ' 个名字');
